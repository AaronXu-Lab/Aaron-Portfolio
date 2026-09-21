import { imageMime } from './file-display.js';

export function createImagePreview() {
  const preview = document.getElementById('image-preview');
  const thumbnail = document.getElementById('preview-image');
  const icon = document.getElementById('file-icon');
  const lightbox = document.getElementById('lightbox');
  const enlarged = document.getElementById('lightbox-image');
  let key, controller, objectURL;
  function reset() {
    controller?.abort();
    lightbox.close();
    thumbnail.removeAttribute('src'); enlarged.removeAttribute('src');
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = null;
    preview.hidden = true; icon.hidden = false;
  }
  preview.addEventListener('click', () => {
    if (!objectURL) return;
    enlarged.src = objectURL;
    enlarged.alt = thumbnail.alt;
    lightbox.showModal();
  });
  document.getElementById('close-lightbox').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  return async file => {
    if (file?.key === key) return;
    key = file?.key;
    reset();
    const mime = imageMime(file?.name);
    if (!file || !mime) return;
    const current = key;
    controller = new AbortController();
    try {
      const response = await fetch('/api/stash/file', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return;
      const blob = await response.blob();
      if (key !== current) return;
      objectURL = URL.createObjectURL(new Blob([blob], { type: mime }));
      thumbnail.alt = file.name;
      thumbnail.src = objectURL;
      await thumbnail.decode();
      if (key !== current) return;
      preview.hidden = false; icon.hidden = true;
    } catch {
      // Unsupported or unreadable images remain downloadable as ordinary files.
      if (key === current) reset();
    }
  };
}
