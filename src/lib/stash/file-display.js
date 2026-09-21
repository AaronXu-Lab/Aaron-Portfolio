export function formatSize(size) {
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024 && Math.round(size / 1024) < 1024) return `${Math.round(size / 1024)} KB`;
  const units = ['MB', 'GB', 'TB'];
  let value = size / 1024 / 1024, unit = 0;
  while (Number(value.toFixed(1)) >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(1)} ${units[unit]}`;
}
// CSS can shorten the stem while keeping the last character and extension visible.
export function filenameParts(name) {
  const dot = name.lastIndexOf('.');
  const stem = Array.from(dot > 0 && dot < name.length - 1 ? name.slice(0, dot) : name);
  const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot) : '';
  const tailLength = extension ? 1 : Math.min(4, stem.length);
  return [stem.slice(0, -tailLength).join(''), stem.slice(-tailLength).join('') + extension];
}

export function imageMime(name = '') {
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon' };
  return types[name.split('.').pop().toLowerCase()] || null;
}
