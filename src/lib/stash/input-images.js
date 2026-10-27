import { imageMime } from './file-display.js';

export const isImage = file => file.type.startsWith('image/') || Boolean(imageMime(file.name));
export const inputImageType = file => imageMime(file.name) || file.type;

// Keep image URLs out of persisted text and release them when a tile disappears.
export function createInputImages(container, remove) {
  const entries = new Map();
  function tile(label) {
    const node = document.createElement('div');
    node.className = 'input-image';
    node.setAttribute('aria-label', label);
    container.append(node);
    return node;
  }
  return {
    pending(file) {
      const node = tile('图片保存中');
      const image = document.createElement('img');
      const url = URL.createObjectURL(file);
      image.src = url; image.alt = '图片保存中';
      const label = document.createElement('span'); label.textContent = '保存中…';
      node.append(image, label);
      return () => { node.remove(); URL.revokeObjectURL(url); };
    },
    render(images) {
      for (const [id, entry] of entries) {
        if (images.some(image => image.id === id)) continue;
        entry.controller.abort(); entry.node.remove();
        if (entry.url) {
          const enlarged = document.getElementById('lightbox-image');
          if (enlarged.getAttribute('src') === entry.url) {
            document.getElementById('lightbox').close();
            enlarged.removeAttribute('src');
          }
          URL.revokeObjectURL(entry.url);
        }
        entries.delete(id);
      }
      for (const image of images) {
        if (entries.has(image.id)) continue;
        const node = tile('暂存图片');
        const open = document.createElement('button');
        open.className = 'input-image-open'; open.setAttribute('aria-label', '放大查看图片');
        const thumbnail = document.createElement('img'); thumbnail.alt = '暂存图片';
        open.append(thumbnail);
        const button = document.createElement('button');
        button.className = 'input-image-remove'; button.textContent = '×'; button.setAttribute('aria-label', '删除图片');
        button.addEventListener('click', async () => { button.disabled = true; try { await remove(image.id); } finally { button.disabled = false; } });
        node.append(open, button);
        const entry = { node, controller: new AbortController(), url: null };
        entries.set(image.id, entry);
        open.addEventListener('click', () => {
          if (!entry.url) return;
          document.getElementById('lightbox-image').src = entry.url;
          document.getElementById('lightbox-image').alt = '暂存图片';
          document.getElementById('lightbox').showModal();
        });
        fetch(`/api/stash/image?id=${encodeURIComponent(image.id)}`, { cache: 'no-store', signal: entry.controller.signal })
          .then(async response => {
            if (!response.ok) throw new Error('图片读取失败');
            const blob = await response.blob();
            if (entry.controller.signal.aborted) return;
            entry.url = URL.createObjectURL(new Blob([blob], { type: image.type }));
            thumbnail.src = entry.url;
          }).catch(() => { if (!entry.controller.signal.aborted) thumbnail.alt = '图片读取失败，请刷新重试'; });
      }
    },
  };
}
