/**
 * Mesh Gradient 图片生成工具 · 纯逻辑核（无 DOM 依赖，被 app.js 与 tests/ 共用）
 *
 * 只负责三件事：画布尺寸、Mesh Gradient 的像素、配置文件的读写。
 * 真正的绘制（贴图、阴影、导出）留给 app.js。
 */

/** 默认四点浅蓝 Gradient。 */
export const DEFAULT_COLORS = ['#F1F6FC', '#E7EFF7', '#DEE6F2', '#CEDAEB'];

export const DEFAULT_SHADOW = {
  on: true,
  x: 0,
  y: 0,
  blur: 60,
  spread: -4,
  color: '#10151F',
  opacity: 0.12,
};

export const DEFAULT_PADDING = 36;

/** 圆角:image = 上传图片自身的圆角，canvas = 整张成品图的圆角。 */
export const DEFAULT_RADIUS = { image: 4, canvas: 0 };

/** 各点数的固定位置分布（归一化坐标，0 - 1）。 */
const LAYOUTS = {
  2: [[0.2, 0.18], [0.8, 0.82]],
  3: [[0.18, 0.16], [0.84, 0.3], [0.5, 0.9]],
  4: [[0.12, 0.12], [0.88, 0.16], [0.16, 0.88], [0.9, 0.86]],
};

/** 取某个点数的默认位置分布；点数非法时回落到 4 点。 */
export function layoutFor(count) {
  return LAYOUTS[count] ?? LAYOUTS[4];
}

/** #RGB / #RRGGBB → [r, g, b]；非法值返回黑色。 */
export function hexToRgb(hex) {
  const s = String(hex).trim().replace(/^#/, '');
  const full = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** 最终画布尺寸 = 图片尺寸 + 四周 Padding。 */
export function canvasSize({ imageWidth, imageHeight, padding }) {
  return {
    width: Math.max(1, Math.round(imageWidth + padding * 2)),
    height: Math.max(1, Math.round(imageHeight + padding * 2)),
  };
}

/**
 * 在 w × h 的低分辨率网格上算 Mesh Gradient，返回 RGBA 缓冲。
 * 反距离加权（p = 2，带 eps 软化）：点少、颜色近时融合自然，
 * 也不会出现径向渐变那种圆形光斑边界。上屏时由 drawImage 平滑放大。
 */
export function meshBuffer(w, h, colors) {
  const points = layoutFor(colors.length);
  const rgb = colors.map(hexToRgb);
  const data = new Uint8ClampedArray(w * h * 4);
  const eps = 0.012; // 避免点上除零，同时把尖峰抹平

  for (let y = 0; y < h; y++) {
    const ny = h === 1 ? 0.5 : y / (h - 1);
    for (let x = 0; x < w; x++) {
      const nx = w === 1 ? 0.5 : x / (w - 1);
      let wr = 0, wg = 0, wb = 0, sum = 0;
      for (let i = 0; i < points.length; i++) {
        const dx = nx - points[i][0];
        const dy = ny - points[i][1];
        const weight = 1 / (dx * dx + dy * dy + eps);
        sum += weight;
        wr += rgb[i][0] * weight;
        wg += rgb[i][1] * weight;
        wb += rgb[i][2] * weight;
      }
      const o = (y * w + x) * 4;
      data[o] = wr / sum;
      data[o + 1] = wg / sum;
      data[o + 2] = wb / sum;
      data[o + 3] = 255;
    }
  }
  return data;
}

/** 圆角不能超过短边的一半，否则画不出形状。 */
export function clampRadius(radius, width, height) {
  return Math.max(0, Math.min(radius, Math.min(width, height) / 2));
}

/** 阴影颜色 + 透明度 → canvas / CSS 都能用的 rgba()。 */
export function shadowRgba({ color, opacity }) {
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** 当前编辑状态 → 配置文件对象（图片以 dataURL 内嵌，不存本地路径）。 */
export function serializeConfig({ colors, padding, radius, shadow, image }) {
  return {
    format: 'mesh-gradient-tool',
    version: 1,
    colors: [...colors],
    padding,
    radius: { ...radius },
    shadow: { ...shadow },
    image: image ?? null,
  };
}

/**
 * 配置文件对象 → 编辑状态；缺字段用默认值补齐，格式不对抛错。
 */
export function parseConfig(raw) {
  if (!raw || typeof raw !== 'object' || raw.format !== 'mesh-gradient-tool') {
    throw new Error('这不是本工具的配置文件');
  }
  const colors = Array.isArray(raw.colors) && [2, 3, 4].includes(raw.colors.length)
    ? raw.colors.map((c) => (/^#[0-9a-fA-F]{6}$/.test(String(c)) ? String(c) : '#FFFFFF'))
    : [...DEFAULT_COLORS];
  const padding = Number.isFinite(raw.padding) && raw.padding >= 0 ? raw.padding : DEFAULT_PADDING;
  const r = raw.radius && typeof raw.radius === 'object' ? raw.radius : {};
  const radius = {
    image: Number.isFinite(r.image) && r.image >= 0 ? r.image : DEFAULT_RADIUS.image,
    canvas: Number.isFinite(r.canvas) && r.canvas >= 0 ? r.canvas : DEFAULT_RADIUS.canvas,
  };
  const s = raw.shadow && typeof raw.shadow === 'object' ? raw.shadow : {};
  const shadow = {
    on: typeof s.on === 'boolean' ? s.on : DEFAULT_SHADOW.on,
    x: Number.isFinite(s.x) ? s.x : DEFAULT_SHADOW.x,
    y: Number.isFinite(s.y) ? s.y : DEFAULT_SHADOW.y,
    blur: Number.isFinite(s.blur) && s.blur >= 0 ? s.blur : DEFAULT_SHADOW.blur,
    spread: Number.isFinite(s.spread) ? s.spread : DEFAULT_SHADOW.spread,
    color: /^#[0-9a-fA-F]{6}$/.test(String(s.color)) ? String(s.color) : DEFAULT_SHADOW.color,
    opacity: Number.isFinite(s.opacity) && s.opacity >= 0 && s.opacity <= 1 ? s.opacity : DEFAULT_SHADOW.opacity,
  };
  const image = typeof raw.image === 'string' && raw.image.startsWith('data:image/') ? raw.image : null;
  return { colors, padding, radius, shadow, image };
}
