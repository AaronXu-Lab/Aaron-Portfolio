import * as THREE from '../vendor/three.min.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Sunlit Mediterranean sandstone promenade road texture with subtle paving blocks,
 * warm cream curbs, and a turquoise coastal bike-lane stripe.
 */
export function createRoadTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');

  // Base warm limestone/terracotta tint
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, '#d8ccb8');
  grad.addColorStop(0.08, '#e8dcc7');
  grad.addColorStop(0.14, '#e5d4bb');
  grad.addColorStop(0.5, '#ebd9c0');
  grad.addColorStop(0.86, '#e5d4bb');
  grad.addColorStop(0.92, '#e8dcc7');
  grad.addColorStop(1.0, '#d2c7b6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle paving stone grid
  const rows = 16;
  const cols = 12;
  const rowH = 512 / rows;
  const colW = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const shade = ((r * 31 + col * 17) % 11) - 5;
      ctx.fillStyle = shade > 0
        ? `rgba(255,250,240,${shade * 0.015})`
        : `rgba(140,110,80,${-shade * 0.012})`;
      ctx.fillRect(col * colW + offset + 1, r * rowH + 1, colW - 2, rowH - 2);
    }
  }

  // Fine mineral grain speckles
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73.13) % 512;
    const y = (i * 191.71) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,252,245,0.22)' : 'rgba(128,100,72,0.14)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Painted turquoise coastal cycling edge stripes
  ctx.fillStyle = 'rgba(42, 157, 152, 0.58)';
  ctx.fillRect(46, 0, 10, 512);
  ctx.fillRect(456, 0, 10, 512);

  // Subtle warm cream edge shoulders
  ctx.fillStyle = 'rgba(255, 250, 240, 0.65)';
  ctx.fillRect(24, 0, 16, 512);
  ctx.fillRect(472, 0, 16, 512);

  // Dashed center line
  ctx.fillStyle = 'rgba(255, 251, 242, 0.86)';
  for (let y = 16; y < 512; y += 64) {
    ctx.beginPath();
    ctx.roundRect(252, y, 8, 34, 4);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Woven golden rattan / wicker basket texture for the front bicycle basket.
 */
export function createWickerTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a8743c';
  ctx.fillRect(0, 0, 256, 256);

  const step = 16;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const alt = ((x / step) + (y / step)) % 2 === 0;
      const g = alt
        ? ctx.createLinearGradient(x, y, x + step, y)
        : ctx.createLinearGradient(x, y, x, y + step);
      g.addColorStop(0, '#8d5b28');
      g.addColorStop(0.3, '#d7a25f');
      g.addColorStop(0.55, '#e7ba78');
      g.addColorStop(0.85, '#b67d3d');
      g.addColorStop(1, '#7a4d20');
      ctx.fillStyle = g;
      if (alt) {
        ctx.fillRect(x, y + 1, step, step - 2);
      } else {
        ctx.fillRect(x + 1, y, step - 2, step);
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 1.8);
  return tex;
}

/**
 * Striped coastal fabric for the pelican's fluttering scarf and beach towel.
 */
export function createStripeTexture(colorA = '#e05744', colorB = '#fff5e4', stripes = 8) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const h = 256 / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
    ctx.fillRect(0, i * h, 256, h + 1);
  }
  // Subtle fabric weave
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = 0; x < 256; x += 4) {
    ctx.fillRect(x, 0, 1, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Soft warm whitewashed limestone block texture for the coastal seawall & lighthouse.
 */
export function createStoneTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe7d9';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 4;
  const rh = 256 / rows;
  const cw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    for (let k = -1; k <= cols; k++) {
      const v = ((r * 13 + k * 7) % 5) * 4;
      ctx.fillStyle = `rgb(${242 - v}, ${233 - v}, ${217 - v})`;
      ctx.fillRect(k * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

/**
 * Sun-bleached pier / ramp wood plank texture.
 */
export function createWoodTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c89b6e';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 8; i++) {
    const y = i * 32;
    const tone = (i % 3) * 8;
    ctx.fillStyle = `rgb(${205 - tone}, ${156 - tone}, ${106 - tone})`;
    ctx.fillRect(0, y + 2, 256, 29);
    ctx.fillStyle = 'rgba(92, 58, 28, 0.28)';
    ctx.fillRect(0, y, 256, 2);
    // Grain streaks
    ctx.fillStyle = 'rgba(120, 76, 36, 0.14)';
    for (let g = 0; g < 6; g++) {
      ctx.fillRect(0, y + 4 + g * 4, 256, 1);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Subtle layered feather sheen texture for the pelican body & wings.
 */
export function createFeatherTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#fffcf6');
  g.addColorStop(0.55, '#fbf2e3');
  g.addColorStop(1, '#f5e4cd');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Delicate scalloped feather arcs
  ctx.strokeStyle = 'rgba(198, 174, 146, 0.22)';
  ctx.lineWidth = 1.6;
  for (let row = 0; row < 16; row++) {
    const y = row * 18;
    const ox = (row % 2) * 14;
    for (let x = -14; x < 280; x += 28) {
      ctx.beginPath();
      ctx.arc(x + ox, y, 13, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Soft radial sprite texture for sunlit sparkles, sea spray, and lantern halos.
 */
export function createGlowTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,248,225,0.72)');
  g.addColorStop(0.65, 'rgba(255,220,160,0.18)');
  g.addColorStop(1.0, 'rgba(255,220,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
