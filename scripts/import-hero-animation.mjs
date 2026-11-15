#!/usr/bin/env node
/**
 * 把 Rive 项目（rive-quiet-work）导出的网页版动画转成首页插图用的数据包。
 *
 * 用法：node scripts/import-hero-animation.mjs <rive-quiet-work/web-animation/index.html>
 * 产物：public/media/home/quiet-work.json  { viewBox, svg, anims, base }
 *
 * 处理：
 *  · 去掉 1280×720 的纸色底板（首页背景跟随主题）
 *  · viewBox 裁到与静态插图 hero-illustration.webp 完全一致的区域，换图时不跳位
 *  · 路径坐标保留 1 位小数（展示宽度约 640px，误差 < 0.05px）
 *  · 全部 id 加 qw- 前缀，避免与页面其它元素冲突
 * 播放器在 src/pages/index.astro 的客户端脚本里。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('用法：node scripts/import-hero-animation.mjs <web-animation/index.html>');
  process.exit(1);
}

/** 静态插图在 Rive 画布里的裁切框（hero-illustration.webp 为 1094×620，偏移 92,46） */
const VIEWBOX = '92 46 1094 620';
const OUT = resolve('public/media/home/quiet-work.json');

const html = readFileSync(src, 'utf8');

let svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>') + '</svg>'.length);
const pick = (name) => {
  const m = html.match(new RegExp(`const ${name} = (.*?);\\n`, 's'));
  if (!m) throw new Error(`没找到 ${name}`);
  return JSON.parse(m[1]);
};
const anims = pick('ANIMS');
const base = pick('BASE');

// 1. 去掉纸色底板
const bg = /<g ?><path d="M0 0L1280 0L1280 720L0 720L0 0Z" fill="#[0-9a-f]{6}"\/><\/g>/;
if (!bg.test(svg)) throw new Error('没找到底板，导出格式可能变了');
svg = svg.replace(bg, '');

// 2. 只保留内部结构，外层 <svg> 由播放器生成
svg = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

// 3. id 加前缀
svg = svg
  .replace(/\bid="([^"]+)"/g, 'id="qw-$1"')
  .replace(/url\(#([^)]+)\)/g, 'url(#qw-$1)')
  .replace(/ transform=""/g, '');

// 4. 坐标精度：path d 里的数字保留 1 位小数
const round = (n) => {
  const v = Math.round(parseFloat(n) * 10) / 10;
  return Object.is(v, -0) ? '0' : String(v);
};
svg = svg.replace(/\bd="([^"]+)"/g, (_, d) => `d="${d.replace(/-?\d*\.?\d+(?:e-?\d+)?/g, round)}"`);

const ids = Object.keys(base).map((id) => `qw-o${id.replace(':', '_')}`);
for (const id of ids) {
  if (!svg.includes(`id="${id}"`)) throw new Error(`SVG 里缺少动画节点 ${id}`);
}

writeFileSync(OUT, JSON.stringify({ viewBox: VIEWBOX, svg, anims, base }));
console.log(`写入 ${OUT}（${(JSON.stringify({ svg }).length / 1024).toFixed(0)} KB SVG，${anims.length} 段动画）`);
