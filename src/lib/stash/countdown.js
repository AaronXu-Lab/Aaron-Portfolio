export function countdown(expiresAt, now = Date.now()) {
  if (!expiresAt) return '';
  const seconds = Math.ceil((expiresAt - now) / 1000);
  if (seconds <= 0) return '即将清空';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const parts = [];
  if (days) parts.push(`${days} 天`);
  if (hours || days) parts.push(`${hours} 小时`);
  if (minutes || hours || days) parts.push(`${minutes} 分钟`);
  else parts.push(`${seconds} 秒`);
  return `${parts.join(' ')}后清空`;
}
