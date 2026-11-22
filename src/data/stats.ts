/**
 * 首页 MasterGo Importer 统计数字的唯一入口（首屏证据卡 + 「大产品」主推卡）。
 * 数据在同目录 stats.json：
 * - github.stars 由 GitHub Actions（.github/workflows/update-stats.yml）每天抓取，变了才提交；
 * - figma.likes / figma.users 手改（Figma 不给非浏览器请求返回数据），改完把 updatedAt 一起改掉。
 */
import data from './stats.json';

/** 1605 → 1.6k，1000 → 1k，67 → 67 */
export const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);

export const stats = data;

export const githubStars = `${compact(data.github.stars)} stars`;
export const figmaUsers = `${compact(data.figma.users)} users`;
export const figmaLikes = `${compact(data.figma.likes)} likes`;
