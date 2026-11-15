#!/usr/bin/env node
/**
 * 生成首页「下载简历」用的 PDF：起一个 astro preview，用本机 Chrome 无头打印 /resume/。
 *
 * 用法：npm run build:resume（= astro build + 本脚本）
 * 产物：public/media/resume/aaron-xu-resume.pdf（提交进仓库；Cloudflare 构建环境没有 Chrome，不在线上生成）
 * 改了 src/data/about.ts 或 src/pages/resume.astro 后要重跑。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const PORT = 4329;
const OUT = resolve('public/media/resume/aaron-xu-resume.pdf');
const CHROME =
  process.env.CHROME_PATH ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));

if (!CHROME) {
  console.error('找不到 Chrome，可用 CHROME_PATH 指定可执行文件路径');
  process.exit(1);
}
if (!existsSync('dist/resume/index.html')) {
  console.error('dist/ 里没有 /resume/，先跑 npm run build');
  process.exit(1);
}

const preview = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

const waitForServer = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/resume/`);
      if (r.ok) return;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('astro preview 没能启动');
};

try {
  await waitForServer();
  mkdirSync(dirname(OUT), { recursive: true });
  await new Promise((done, fail) => {
    const chrome = spawn(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--virtual-time-budget=4000',
        `--print-to-pdf=${OUT}`,
        `http://127.0.0.1:${PORT}/resume/`,
      ],
      { stdio: 'ignore' }
    );
    chrome.on('exit', (code) => (code === 0 ? done() : fail(new Error(`Chrome 退出码 ${code}`))));
  });
  console.log(`写入 ${OUT}（${(statSync(OUT).size / 1024).toFixed(0)} KB）`);
} finally {
  preview.kill();
}
