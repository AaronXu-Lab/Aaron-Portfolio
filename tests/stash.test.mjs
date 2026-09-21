import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { TTL, MAX_FILE, cleanup, change } from '../workers/stash/index.js';
class Bucket {
  objects = new Map();
  version = 0;
  async get(key) {
    const value = this.objects.get(key);
    return value ? { ...value, json: async () => JSON.parse(value.data), body: value.data } : null;
  }
  async put(key, data, options = {}) {
    const old = this.objects.get(key), condition = options.onlyIf;
    if (condition?.get('If-Match') && old?.httpEtag !== condition.get('If-Match')) return null;
    if (condition?.get('If-None-Match') === '*' && old) return null;
    const value = { key, data, size: typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength, httpEtag: `"${++this.version}"`, uploaded: new Date() };
    this.objects.set(key, value); return value;
  }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key); }
  async list({ prefix }) { return { objects: [...this.objects.values()].filter(o => o.key.startsWith(prefix)), truncated: false }; }
}
const call = (bucket, path = '', options) => worker.fetch(new Request('https://www.xuweinan.com/api/stash' + path, options), { BOX: bucket });
test('file replaces text and blocks editing until removed; downloads do not extend expiry', async () => {
  const b = new Bucket();
  assert.equal((await (await call(b)).json()).expiresAt, null);
  const saved = await (await call(b, '/text', { method: 'PUT', body: '你好 <script>alert(1)</script>' })).json();
  assert.equal(saved.expiresAt - saved.updatedAt, TTL);
  const bytes = new Uint8Array([0, 255, 12]);
  const uploaded = await (await call(b, '/file', { method: 'PUT', headers: { 'X-File-Name': encodeURIComponent('测试.html') }, body: bytes })).json();
  assert.equal(uploaded.text, '');
  assert.equal((await call(b, '/text', { method: 'PUT', body: 'blocked' })).status, 409);
  assert.equal(uploaded.file.size, 3);
  const downloaded = await call(b, '/file');
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes);
  assert.match(downloaded.headers.get('Content-Disposition'), /^attachment;/);
  assert.equal((await (await call(b)).json()).expiresAt, uploaded.expiresAt);
  const replacement = await (await call(b, '/file', { method: 'PUT', body: 'new' })).json();
  assert.notEqual(replacement.file.key, uploaded.file.key);
  const empty = await (await call(b, '/file', { method: 'DELETE' })).json();
  assert.equal(empty.text, ''); assert.equal(empty.expiresAt, null);
  assert.equal((await call(b, '/text', { method: 'PUT', body: 'new text' })).status, 200);
});
test('enforces actual bytes even without Content-Length; accepts exactly 10 MiB', async () => {
  const b = new Bucket();
  assert.equal((await call(b, '/file', { method: 'PUT', body: new Uint8Array(MAX_FILE) })).status, 200);
  const state = await (await call(b)).json();
  assert.equal((await call(b, '/file', { method: 'PUT', body: new Uint8Array(MAX_FILE + 1) })).status, 413);
  assert.equal((await (await call(b)).json()).file.key, state.file.key);
  assert.equal((await call(b, '/text', { method: 'PUT', body: '中'.repeat(40000) })).status, 413);
});
test('expired contents cannot be read before cleanup runs; edits reset whole-box TTL', async () => {
  const b = new Bucket();
  await change(b, () => ({ text: 'old', file: null }), Date.now() - TTL - 1);
  assert.equal((await (await call(b)).json()).text, '');
  assert.equal((await call(b, '/file')).status, 404);
  await cleanup(b);
  assert.equal((await b.get('box.json')).data.includes('old'), false);
  const current = await change(b, () => ({ text: 'new', file: null }), 1000);
  const edited = await change(b, state => ({ ...state, text: 'edited' }), 2000);
  assert.equal(edited.expiresAt, 2000 + TTL);
  assert.deepEqual(edited.file, current.file);
});
test('concurrent text and file changes retain only file; stale cleanup cannot erase an edit', async () => {
  const b = new Bucket();
  await Promise.all([change(b, s => ({ ...s, text: 'hello' })), change(b, s => ({ ...s, file: { key: 'files/a' } }))]);
  const state = (await b.get('box.json')); assert.equal((await state.json()).text, ''); assert.equal((await state.json()).file.key, 'files/a');
  await change(b, () => ({ text: 'expired', file: null }), Date.now() - TTL - 100);
  const originalPut = b.put.bind(b); let raced = false;
  b.put = async (key, data, options) => {
    if (key === 'box.json' && JSON.parse(data).expiresAt === null && !raced) {
      raced = true;
      await change(b, s => ({ ...s, text: 'fresh' }));
    }
    return originalPut(key, data, options);
  };
  await cleanup(b);
  assert.equal((await (await call(b)).json()).text, 'fresh');
});
test('cleanup deletes old orphan files, preserves current files and recent in-flight uploads', async () => {
  const b = new Bucket();
  for (const name of ['current', 'orphan', 'pending']) await b.put('files/' + name, 'x');
  for (const name of ['current', 'orphan']) b.objects.get('files/' + name).uploaded = new Date(Date.now() - 2 * 86400000);
  await change(b, () => ({ text: '', file: { key: 'files/current' } }));
  await cleanup(b);
  assert.ok(await b.get('files/current')); assert.ok(await b.get('files/pending')); assert.equal(await b.get('files/orphan'), null);
  await call(b, '', { method: 'DELETE' });
  assert.equal((await (await call(b)).json()).expiresAt, null);
});

test('failed oversized upload preserves text and expiry', async () => {
  const b = new Bucket();
  const saved = await (await call(b, '/text', { method: 'PUT', body: 'keep me' })).json();
  assert.equal((await call(b, '/file', { method: 'PUT', body: new Uint8Array(MAX_FILE + 1) })).status, 413);
  assert.deepEqual(await (await call(b)).json(), saved);
});
test('legacy mixed contents never restore old text after file deletion', async () => {
  const b = new Bucket();
  await b.put('box.json', JSON.stringify({ text: 'legacy', file: { key: 'files/a' }, updatedAt: Date.now(), expiresAt: Date.now() + TTL }));
  assert.equal((await (await call(b)).json()).text, '');
  const state = await (await call(b, '/file', { method: 'DELETE' })).json();
  assert.equal(state.text, ''); assert.equal(state.expiresAt, null);
});

test('empty and one-byte files upload and download without a minimum size', async () => {
  for (const bytes of [new Uint8Array(), new Uint8Array([42])]) {
    const b = new Bucket();
    const response = await call(b, '/file', { method: 'PUT', body: bytes });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).file.size, bytes.length);
    assert.deepEqual(new Uint8Array(await (await call(b, '/file')).arrayBuffer()), bytes);
  }
});
