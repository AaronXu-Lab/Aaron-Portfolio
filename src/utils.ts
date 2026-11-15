/** 按北京时间格式化为 YYYY.MM.DD(博客原始日期均为中国时区) */
export function formatDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')}`;
}

export function yearOf(d: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  })
    .format(d)
    .replace(/年/, '');
}

const stripInline = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`|~~)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\s　]+/g, ' ')
    .trim();

/**
 * 文章简介（首页 03 博客用）：
 *  1. 正文开头（跳过封面图）的引用块即作者写的简介；
 *  2. 没写简介的，取正文第一段文字（跳过图片、标题、代码块）。
 * 兼容 Markdown 与旧 Hexo 导入的 HTML 正文。
 */
export function postSummary(body: string | undefined): string {
  if (!body) return '';
  let s = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/<pre[\s\S]*?<\/pre>/gi, '\n')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '\n')
    .replace(/<img[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 1. 开头的引用块
  const lead = s.trimStart();
  const htmlQuote = lead.match(/^<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (htmlQuote) {
    const text = stripInline(htmlQuote[1]);
    if (text) return text;
  }
  const mdQuote = lead.match(/^(?:>[^\n]*(?:\n|$))+/);
  if (mdQuote) {
    const text = stripInline(mdQuote[0].replace(/^>\s?/gm, ' '));
    if (text) return text;
  }

  // 2. 正文第一段
  s = s.replace(/<\/(p|div|li|blockquote|tr)>|<br\s*\/?>/gi, '\n');
  for (const line of s.split(/\n/)) {
    if (/^\s*#{1,6}\s/.test(line)) continue; // Markdown 标题
    if (/^\s*([-*_]\s*){3,}$/.test(line)) continue; // 分隔线
    const text = stripInline(line.replace(/^\s*(>|[-*+]\s|\d+\.\s)\s*/, ''));
    if (text.length >= 2) return text;
  }
  return '';
}
