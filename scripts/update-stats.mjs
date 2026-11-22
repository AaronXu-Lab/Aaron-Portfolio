// 抓 GitHub stars 写进 src/data/stats.json；数字没变就不动文件（Actions 据此决定是否提交）。
// 用法：node scripts/update-stats.mjs        （本地也能跑）
// Figma 的 likes / users 不在这里：Figma 对非浏览器请求一律 403，只能手改 stats.json。
// 抓取失败时不改文件、以非零码退出，页面继续用上一次的数字。

import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../src/data/stats.json', import.meta.url);
const data = JSON.parse(await readFile(FILE, 'utf8'));

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'xuweinan-stats' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(`https://api.github.com/repos/${data.github.repo}`, { headers });
if (!res.ok) {
  console.error(`GitHub API HTTP ${res.status}，stats.json 保持不变`);
  process.exit(1);
}
const stars = (await res.json()).stargazers_count;
if (!Number.isInteger(stars) || stars < 0) {
  console.error(`返回的 stargazers_count 异常：${stars}，stats.json 保持不变`);
  process.exit(1);
}

if (stars === data.github.stars) {
  console.log(`GitHub stars 仍为 ${stars}，无需更新`);
} else {
  console.log(`GitHub stars ${data.github.stars} → ${stars}`);
  data.github.stars = stars;
  data.github.updatedAt = new Date().toISOString().slice(0, 10);
  await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`);
}
