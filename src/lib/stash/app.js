import { createImagePreview } from './image-preview.js';
import { countdown } from './countdown.js';
import { formatSize, filenameParts } from './file-display.js';
import { createEditor } from './editor.js';
const $ = id => document.getElementById(id);
const api = '/api/stash';
const updateImagePreview = createImagePreview();
let activeUpload = null;
let selection = 0, loadErrorShown = false, connected = false;
let surface = 'loading';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function reveal(node) {
  if (reducedMotion.matches) return;
  node.getAnimations().forEach(animation => animation.cancel());
  node.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
}
let box = null, dirty = false, revision = 0, timer, busy = 0, queue = Promise.resolve(), composing = false, uploading = false;
function status(state) {
  const labels = { loading: '加载中...', idle: '自动保存', saving: '保存中...', saved: '已保存', failed: '未保存' };
  $('save-status').dataset.state = state;
  $('save-status').textContent = labels[state];
}
function syncConnectivity() {
  const offline = !navigator.onLine || !connected;
  text.disabled = offline || !box || uploading || Boolean(box.file);
  $('upload').disabled = offline || !box || uploading;
  $('remove').disabled = offline || uploading;
  $('download').setAttribute('aria-disabled', String(offline));
}
function offlineNotice() { error('当前离线', '连接网络后才能读取或存放内容'); }
function updateSurface() {
  $('toolbar').hidden = uploading || Boolean(box?.file);
  $('text').hidden = uploading || Boolean(box?.file);
  $('file-content').hidden = uploading || !box?.file;
  $('upload-progress').hidden = !uploading;
  const next = uploading ? 'upload-progress' : box?.file ? 'file-content' : box ? 'text' : 'loading';
  if (next !== surface && next !== 'loading') reveal($(next));
  surface = next;
  syncConnectivity();
}
function progress(loaded, total) {
  const percent = total ? Math.min(100, loaded / total * 100) : 100;
  $('progress').setAttribute('aria-valuenow', String(Math.round(percent)));
  $('progress').setAttribute('aria-valuetext', `${formatSize(loaded)} / ${formatSize(total)}`);
  $('ring-fill').style.strokeDashoffset = String(100 - percent);
  $('progress-size').textContent = `${formatSize(loaded)} / ${formatSize(total)}`;
}
function sizeDialog() {
  $('file').value = '';
  error('文件超过大小限制', '选择不超过 10 MB 的文件');
}
function error(title = '', description = '') {
  if (!title) return;
  $('message-title').textContent = title;
  $('message-description').textContent = description;
  if (!$('message-dialog').open) $('message-dialog').showModal();
}
let toastTimer;
function toast(message) {
  const node = $('toast');
  node.textContent = message;
  if (node.hidden) { node.hidden = false; reveal(node); }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3000);
}
// Cmd/Ctrl+S never reaches the browser save dialog or the save pipeline; saving is automatic.
window.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    toast('内容修改后会自动保存，无需手动保存');
  }
}, true);
function folderDialog() {
  $('file').value = '';
  error('无法直接上传文件夹', '请先压缩为 ZIP 文件再上传，Playground 等文件夹包也需要压缩');
}
const failure = (title, description) => Object.assign(new Error(title), { description });
function filename(name) {
  const node = $('file-name');
  node.replaceChildren(); node.title = name || '';
  if (!name) { node.textContent = '暂无文件'; return; }
  filenameParts(name).forEach((value, index) => {
    const span = document.createElement('span');
    span.className = index ? 'filename-tail' : 'filename-stem';
    span.textContent = value; node.append(span);
  });
}
function updateCountdown() {
  document.querySelector('.intro').classList.toggle('has-countdown', Boolean(box?.expiresAt));
  $('countdown').setAttribute('aria-hidden', String(!box?.expiresAt));
  if (box?.expiresAt) $('countdown').textContent = countdown(box.expiresAt);
  $('countdown').title = box?.expiresAt ? new Date(box.expiresAt).toLocaleString('zh-CN', { hour12: false }) : '';
}
function render(state, syncText = false) {
  const hadFile = Boolean(box?.file);
  box = state;
  const hasFile = Boolean(state.file);
  if (hasFile) {
    clearTimeout(timer); dirty = false; composing = false; revision++;
    if (!hadFile || text.value) text.reset();
  } else if (hadFile) {
    text.reset(); dirty = false;
  }
  if (!hasFile && syncText && !dirty) text.value = state.text;
  text.disabled = hasFile || uploading;
  $('text').hidden = hasFile;
  $('file-content').hidden = !hasFile;
  $('copy').hidden = hasFile;
  $('copy').disabled = !text.value;
  $('upload').hidden = hasFile;
  $('upload').disabled = uploading;
  $('remove').disabled = uploading;
  filename(state.file?.name);
  updateImagePreview(state.file);
  $('file-detail').textContent = hasFile ? formatSize(state.file.size) : '';
  status(dirty ? 'saving' : state.text ? 'saved' : 'idle');
  updateSurface();
  updateCountdown();
}
async function request(path = '', options) {
  const response = await fetch(api + path, { cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw Object.assign(failure('', response.status === 429 ? '操作频繁，请稍后重试' : data.error || '请稍后重试'), { status: response.status });
  return data;
}
function enqueue(action, title = '文字保存失败', recovery = '文字尚未保存，继续编辑后会再次保存') {
  busy++;
  const task = queue.then(action).catch(e => {
    error(e.message && e.description ? e.message : title, e.description || recovery);
    if (dirty) status('failed');
  }).finally(() => busy--);
  queue = task;
  return task;
}
function save() {
  clearTimeout(timer);
  if (!dirty || composing || uploading || box?.file) return;
  if (!navigator.onLine || !connected) { status('failed'); return; }
  const value = text.value, version = revision;
  if (new TextEncoder().encode(value).length > 100 * 1024) { status('failed'); error('文字超过大小限制', '最多 100 KB，请缩短后保存'); return; }
  return enqueue(async () => {
    if (box?.file) return;
    status('saving');
    let state;
    try { state = await request('/text', { method: 'PUT', body: value, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }); }
    catch (e) {
      if (e.status === 409) { render(await request(), true); return; }
      throw e;
    }
    if (revision === version) dirty = false;
    render(state);
    status(dirty ? 'saving' : 'saved');
    error('');
  });
}
const text = createEditor($('text'), () => {
  dirty = true; revision++;
  $('copy').disabled = !text.value;
  status('saving');
  clearTimeout(timer);
  if (!composing) timer = setTimeout(save, 700);
}, save, active => {
  composing = active;
  clearTimeout(timer);
  if (!active && dirty) timer = setTimeout(save, 700);
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(text.value); $('copy').setAttribute('aria-label', '已复制'); $('copy').title = '已复制'; setTimeout(() => { $('copy').setAttribute('aria-label', '复制文字'); $('copy').title = '复制文字'; }, 1500); }
  catch { error('文字复制失败', '选中文字后手动复制'); }
});
function finishUpload(operation) {
  if (activeUpload !== operation) return;
  activeUpload = null;
  uploading = false; text.disabled = Boolean(box.file);
  $('upload').disabled = false; $('remove').disabled = false;
  updateSurface(); $('file').value = '';
  if (dirty && !box.file) { clearTimeout(timer); timer = setTimeout(save, 700); }
}
async function upload(file) {
  if (!file || !box) return;
  if (!navigator.onLine || !connected) { offlineNotice(); return; }
  const selected = ++selection;
  if (file.size > 10 * 1024 * 1024) { sizeDialog(); return; }
  let body;
  try {
    body = new Blob([await file.arrayBuffer()], { type: 'application/octet-stream' });
  } catch {
    if (selected === selection) error('无法读取文件', '请确认文件已下载到本机且可读取；如果是文件夹或 Playground 文件夹包，请先压缩为 ZIP 再上传');
    $('file').value = '';
    return;
  }
  if (selected !== selection) return;
  if (body.size > 10 * 1024 * 1024) { sizeDialog(); return; }
  if (activeUpload) { activeUpload.cancelled = true; activeUpload.xhr?.abort(); }
  clearTimeout(timer);
  const operation = { cancelled: false, xhr: null };
  activeUpload = operation;
  uploading = true; error(''); progress(0, file.size); updateSurface();
  text.disabled = true;
  $('upload').disabled = true;
  enqueue(async () => {

    try {
      if (operation.cancelled) return;
      if (box.file) {
        const cleared = await request('/file', { method: 'DELETE' });
        if (operation.cancelled) return;
        render(cleared, true);
      }
      const state = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        operation.xhr = xhr;
        xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
        xhr.open('PUT', api + '/file');
        xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.upload.onprogress = e => { if (activeUpload === operation) progress(e.loaded, file.size); };
        xhr.onload = () => { try { const data = JSON.parse(xhr.responseText); xhr.status < 300 ? resolve(data) : xhr.status === 413 ? reject(failure('文件超过大小限制', '选择不超过 10 MB 的文件')) : reject(failure('文件上传失败', data.error || '重新选择文件上传')); } catch { reject(failure('文件上传失败', '重新选择文件上传')); } };
        xhr.onerror = () => reject(failure('文件上传失败', '无法连接服务器，请检查网络后重新上传'));
        xhr.ontimeout = () => reject(failure('文件上传超时', '重新选择文件上传'));
        xhr.timeout = 180000;
        xhr.send(body);
      });
      if (!operation.cancelled) { render(state); error(''); }
    } catch (e) {
      if (!operation.cancelled && e.name !== 'AbortError') throw e;
    } finally {
      finishUpload(operation);
    }
  }, '文件上传失败', '检查网络后重新上传文件');
}
$('cancel-upload').addEventListener('click', () => {
  if (!activeUpload) return;
  const operation = activeUpload;
  operation.cancelled = true;
  operation.xhr?.abort();
  finishUpload(operation);
});
$('upload').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', () => upload($('file').files[0]));
$('drop').addEventListener('dragover', event => { event.preventDefault(); if (box && event.dataTransfer.types.includes('Files')) { event.dataTransfer.dropEffect = 'copy'; $('drop').classList.add('dragover'); } });
$('drop').addEventListener('dragleave', event => { if (!$('drop').contains(event.relatedTarget)) $('drop').classList.remove('dragover'); });
$('drop').addEventListener('drop', event => {
  event.preventDefault(); $('drop').classList.remove('dragover');
  if ([...event.dataTransfer.items].some(item => item.webkitGetAsEntry?.()?.isDirectory)) { selection++; folderDialog(); return; }
  if (event.dataTransfer.files.length !== 1) { error('文件数量超出限制', '每次选择 1 个文件'); return; }
  upload(event.dataTransfer.files[0]);
});
$('remove').addEventListener('click', () => { enqueue(async () => { render(await request('/file', { method: 'DELETE' }), true); error(''); }, '文件删除失败', '稍后点击「删除文件」重试'); });
async function refresh() {
  if (busy || document.hidden) return;
  const version = revision;
  try {
    const state = await request();
    connected = true; syncConnectivity();
    if (busy || dirty || version !== revision) return;
    render(state, !text.focused);
    syncConnectivity();

    loadErrorShown = false;
  } catch {
    connected = false; syncConnectivity();
    if (!loadErrorShown) { if (!navigator.onLine) offlineNotice(); else error('暂存箱加载失败', '检查网络，页面会自动重试'); }
    loadErrorShown = true; status('failed');
  }
}
window.addEventListener('beforeunload', event => {
  if (!dirty && !uploading) return;
  event.preventDefault(); event.returnValue = '';
});
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else refresh(); });
setInterval(refresh, 15000);
setInterval(updateCountdown, 1000);
refresh();

window.addEventListener('offline', () => { connected = false; syncConnectivity(); offlineNotice(); loadErrorShown = true; });
window.addEventListener('online', () => { loadErrorShown = false; syncConnectivity(); refresh(); });
$('download').addEventListener('click', event => { if (!navigator.onLine || !connected) { event.preventDefault(); offlineNotice(); } });
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/tools/stash/sw.js', { scope: '/tools/stash/', updateViaCache: 'none' }).catch(() => {});
  });
}
