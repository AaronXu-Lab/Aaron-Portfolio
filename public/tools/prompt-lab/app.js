import { mountModelMenu } from './model-menu.js';
const $ = (id) => document.getElementById(id);
let prompt = '';
let entries = [];
let noticeTimer;
function notify(message) { $('status').textContent = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('status').textContent = '', 4500); }
function selectEntry(id) {
  const item = entries.find(item => item.id === id) || entries[0];
  if (!item) return;
  $('preview').src = item.entry;
  $('preview').title = item.title + '：' + item.model;
  $('preview').hidden = false;
  $('open-work').href = item.entry;
  $('open-work').removeAttribute('aria-disabled');
  const url = new URL(location.href); url.searchParams.set('model', item.id); history.replaceState(null, '', url);
}
try {
  const responses = await Promise.all([fetch('./prompt.txt'), fetch('./entries.json')]);
  if (responses.some(response => !response.ok)) throw new Error('加载失败');
  [prompt, entries] = await Promise.all([responses[0].text(), responses[1].json()]);
  $('prompt').textContent = prompt;
  $('copy').disabled = false;
  selectEntry(new URLSearchParams(location.search).get('model'));
  mountModelMenu($('model'), entries, entries.find(item => item.id === new URLSearchParams(location.search).get('model'))?.id || entries[0]?.id || '', selectEntry);
  if (!entries.length) { $('empty').hidden = false; $('empty-message').textContent = '还没有作品。添加作品后，重新加载即可查看。'; }
} catch { $('model').textContent = '加载失败'; $('prompt').textContent = '加载失败，请联网后重试。'; $('empty').hidden = false; $('empty-message').textContent = '加载失败，请检查网络后重试。'; }
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(prompt); notify('已复制 Prompt'); }
  catch { if (!$('prompt-dialog').open) $('prompt-dialog').showModal(); const range = document.createRange(); range.selectNodeContents($('prompt')); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); notify('无法自动复制，已选中 Prompt，请手动复制。'); }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => notify('离线缓存暂不可用，仍可在线使用。'));
