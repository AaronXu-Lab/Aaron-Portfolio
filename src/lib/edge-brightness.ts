import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 相对亮度（0 黑 - 1 白）高于此值判为 light：边缘接近白色页面底色，浅色主题需要描边 */
export const LIGHT_THRESHOLD = 0.85;
/** 相对亮度低于此值判为 dark：边缘接近深色页面底色，深色主题需要描边 */
export const DARK_THRESHOLD = 0.2;
/** 不透明判定：alpha 不小于此值才参与采样与边界计算（过滤四角半透明的抗锯齿像素） */
const ALPHA_MIN = 200;
/** 采样环从内容边界向内缩进的比例，避开圆角与抗锯齿 */
const INSET_RATIO = 0.04;
/** 采样环厚度（px，栅格化到 RASTER_SIZE 之后） */
const RING = 2;
/** 栅格化边长；SVG 用高 density 读入再缩放，保证清晰 */
const RASTER_SIZE = 128;

/** 图片边缘一圈（整张画布内缩 INSET_RATIO）里，不透明像素占比低于此值判为抠图（cutout）：没有自己的边界，始终描边 */
export const CUTOUT_OPAQUE_RATIO = 0.5;

export type Edge = 'light' | 'dark' | 'mid' | 'cutout';

const cache = new Map<string, Promise<Edge>>();

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

async function compute(src: string): Promise<Edge> {
  try {
    const buf = await readFile(join(process.cwd(), 'public', src));
    const isSvg = src.toLowerCase().endsWith('.svg');
    const { data, info } = await sharp(buf, isSvg ? { density: 384 } : undefined)
      .resize(RASTER_SIZE, RASTER_SIZE, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const px = (x: number, y: number) => (y * w + x) * 4;

    // 先看整张画布的边缘一圈：不透明占比低说明是透明抠图，直接 cutout（优先于亮度判断）
    {
      const m = Math.max(1, Math.round(Math.min(w, h) * INSET_RATIO));
      let ring = 0, opaque = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const d = Math.min(x, w - 1 - x, y, h - 1 - y);
          if (d < m || d >= m + RING) continue;
          ring++;
          if (data[px(x, y) + 3] >= ALPHA_MIN) opaque++;
        }
      }
      if (ring && opaque / ring < CUTOUT_OPAQUE_RATIO) return 'cutout';
    }

    // 内容边界：不透明像素的外接矩形（整张不透明时即整图；四角透明的图取实际内容）
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[px(x, y) + 3] >= ALPHA_MIN) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return 'mid';

    const inset = Math.max(1, Math.round(Math.min(x1 - x0 + 1, y1 - y0 + 1) * INSET_RATIO));
    let sum = 0, n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.min(x - x0, x1 - x, y - y0, y1 - y);
        if (d < inset || d >= inset + RING) continue;
        const i = px(x, y);
        if (data[i + 3] < ALPHA_MIN) continue;
        sum += 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
        n++;
      }
    }
    if (!n) return 'mid';
    const L = sum / n;
    return L > LIGHT_THRESHOLD ? 'light' : L < DARK_THRESHOLD ? 'dark' : 'mid';
  } catch {
    return 'mid';
  }
}

/** 构建时判断图标边缘明暗；同一路径只算一次 */
export function getEdge(src: string): Promise<Edge> {
  let p = cache.get(src);
  if (!p) cache.set(src, (p = compute(src)));
  return p;
}
