export const MAX_FILE = 10 * 1024 * 1024;
export const MAX_TEXT = 100 * 1024;
export const TTL = 7 * 24 * 60 * 60 * 1000;
const KEY = 'box.json';
const empty = () => ({ text: '', file: null, updatedAt: null, expiresAt: null });
const live = (state, now) => state.expiresAt && state.expiresAt <= now ? empty() : state.file ? { ...state, text: '' } : state;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
async function read(bucket) {
  const object = await bucket.get(KEY);
  return { state: object ? await object.json() : empty(), etag: object?.httpEtag };
}
// Conditional writes enforce a single payload even when text and file requests race.
export async function change(bucket, update, now = Date.now()) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const { state, etag } = await read(bucket);
    const next = update(live(state, now));
    const active = next.text !== '' || next.file;
    const result = { ...next, text: next.file ? '' : next.text, updatedAt: active ? now : null, expiresAt: active ? now + TTL : null };
    const written = await bucket.put(KEY, JSON.stringify(result), {
      onlyIf: new Headers(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }),
    });
    if (written) return result;
  }
  throw new HttpError(503, '暂时无法保存，请稍后重试');
}
async function bodyBytes(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, '内容超过大小限制');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, '内容超过大小限制'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function cleanup(bucket, now = Date.now()) {
  const { state, etag } = await read(bucket);
  if (state.expiresAt && state.expiresAt <= now) {
    // Never delete the manifest: CAS against its generation prevents racing a save.
    await bucket.put(KEY, JSON.stringify(empty()), { onlyIf: new Headers({ 'If-Match': etag }) });
  }
  let cursor;
  do {
    const page = await bucket.list({ prefix: 'files/', limit: 100, ...(cursor ? { cursor } : {}) });
    // Fresh uploads have a grace period so in-flight commits cannot lose their file.
    const candidates = page.objects.filter(object => +object.uploaded < now - 24 * 60 * 60 * 1000);
    if (candidates.length) {
      const current = (await read(bucket)).state;
      const unused = candidates.filter(object => object.key !== current.file?.key).map(object => object.key);
      if (unused.length) await bucket.delete(unused);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const route = url.pathname.replace(/^\/api\/stash/, '') || '/';
      const method = request.method;
      if (!['/', '/text', '/file'].includes(route)) return json({ error: '未找到' }, 404);
      if (method !== 'GET') {
        const origin = request.headers.get('Origin');
        if (origin && origin !== url.origin) return json({ error: '请从暂存箱页面操作' }, 403);
        if (env.WRITE_LIMIT && !(await env.WRITE_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' })).success) {
          return json({ error: '操作太频繁，请稍后重试' }, 429);
        }
      }
      if (method === 'GET' && route === '/') return json(live((await read(env.BOX)).state, Date.now()));
      if (method === 'PUT' && route === '/text') {
        const text = new TextDecoder().decode(await bodyBytes(request, MAX_TEXT));
        return json(await change(env.BOX, state => {
          if (state.file) throw new HttpError(409, '删除文件后才能输入文字');
          return { ...state, text };
        }));
      }
      if (method === 'PUT' && route === '/file') {
        let name;
        try { name = decodeURIComponent(request.headers.get('X-File-Name') || '未命名文件'); }
        catch { throw new HttpError(400, '文件名无法识别'); }
        name = name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 240) || '未命名文件';
        const data = await bodyBytes(request, MAX_FILE);
        const key = `files/${crypto.randomUUID()}`;
        await env.BOX.put(key, data, { httpMetadata: { contentType: 'application/octet-stream' } });
        // Uncommitted files are reclaimed by cleanup, including interrupted requests.
        return json(await change(env.BOX, state => ({ ...state, text: '', file: { key, name, size: data.byteLength } })));
      }
      if (method === 'DELETE' && route === '/file') return json(await change(env.BOX, state => ({ ...state, file: null })));
      if (method === 'DELETE' && route === '/') return json(await change(env.BOX, empty));
      if (method === 'GET' && route === '/file') {
        const state = live((await read(env.BOX)).state, Date.now());
        if (!state.file) return json({ error: '箱子里没有文件' }, 404);
        const file = await env.BOX.get(state.file.key);
        if (!file) return json({ error: '文件已不存在' }, 404);
        return new Response(file.body, { headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(state.file.name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`,
          'Content-Length': String(file.size), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "sandbox; default-src 'none'",
        } });
      }
      return json({ error: '不支持此操作' }, 405);
    } catch (error) {
      if (!error.status) console.error('Stash request failed', error.name);
      return json({ error: error.status ? error.message : '暂存箱连接失败，请稍后重试' }, error.status || 500);
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(cleanup(env.BOX)); },
};
