/**
 * 博客文章规范化共享库 —— import-blog.mjs(全量导入)与 add-post.mjs(单篇新增)共用,
 * 保证两条链路产出的 frontmatter 完全一致。
 */
import matter from 'gray-matter';

export const toArray = (v) =>
  (v == null ? [] : Array.isArray(v) ? v : [v]).map(String).filter(Boolean);

/** Markdown/HTML → 纯文本(用于摘要与字数) */
export const plainText = (s) =>
  s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/[#>*`~_|-]+/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[　\s]+/g, ' ')
    .trim();

/**
 * 解析 Hexo 语义的日期:裸时间戳按中国时区(+08:00)理解。
 * - YAML 时间戳会被 js-yaml 按 UTC 解析成 Date → 取其 UTC 分量(即原始墙钟数字)重建为 +08:00
 * - 字符串同理手动解析
 * 返回 Date 或 null。
 */
export function parseChinaDate(val) {
  const p = (n) => String(n).padStart(2, '0');
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return new Date(
      `${val.getUTCFullYear()}-${p(val.getUTCMonth() + 1)}-${p(val.getUTCDate())}` +
        `T${p(val.getUTCHours())}:${p(val.getUTCMinutes())}:${p(val.getUTCSeconds())}+08:00`
    );
  }
  if (val) {
    const m = String(val)
      .trim()
      .match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      const d = new Date(
        `${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4] ?? 0)}:${p(m[5] ?? 0)}:${p(m[6] ?? 0)}+08:00`
      );
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/**
 * 组装规范化的文章文件内容。
 * body 中的 <!-- more --> 之前作摘要,阅读时长按中文 400 字/分钟估算。
 */
export function buildPostFile({ title, date, author, tags, categories, body }) {
  const moreIdx = body.search(/<!--\s*more\s*-->/i);
  const excerptSource = moreIdx >= 0 ? body.slice(0, moreIdx) : body;
  let excerpt = plainText(excerptSource).slice(0, 140);
  if (!excerpt) excerpt = title;

  const charCount = plainText(body).replace(/\s/g, '').length;
  const minutes = Math.max(1, Math.round(charCount / 400));

  const cleanBody = body.replace(/<!--\s*more\s*-->/i, '');

  return matter.stringify(cleanBody, {
    title,
    date: date.toISOString(),
    author: author ? String(author) : 'Aaron Xu',
    tags,
    categories,
    excerpt,
    minutes,
  });
}
