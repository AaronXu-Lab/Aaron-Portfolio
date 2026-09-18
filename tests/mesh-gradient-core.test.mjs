import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_COLORS, DEFAULT_PADDING, DEFAULT_SHADOW, DEFAULT_RADIUS,
  layoutFor, hexToRgb, canvasSize, clampRadius, meshBuffer, shadowRgba,
  serializeConfig, parseConfig,
} from '../public/tools/mesh-gradient/js/core.js';

test('画布尺寸 = 图片尺寸 + 四周 Padding', () => {
  assert.deepEqual(canvasSize({ imageWidth: 1200, imageHeight: 800, padding: 100 }), {
    width: 1400, height: 1000,
  });
});

test('点数决定位置分布，非法点数回落到 4 点', () => {
  assert.equal(layoutFor(2).length, 2);
  assert.equal(layoutFor(3).length, 3);
  assert.equal(layoutFor(9).length, 4);
});

test('hexToRgb 认 #RGB 与 #RRGGBB，非法值给黑色', () => {
  assert.deepEqual(hexToRgb('#CEDAEB'), [206, 218, 235]);
  assert.deepEqual(hexToRgb('#abc'), [170, 187, 204]);
  assert.deepEqual(hexToRgb('nope'), [0, 0, 0]);
});

test('meshBuffer 的四角偏向各自最近的渐变点，且全不透明', () => {
  const size = 32;
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
  const buf = meshBuffer(size, size, colors);
  assert.equal(buf.length, size * size * 4);

  const at = (x, y) => {
    const o = (y * size + x) * 4;
    return [buf[o], buf[o + 1], buf[o + 2], buf[o + 3]];
  };
  const dominant = (px) => px.indexOf(Math.max(px[0], px[1], px[2]));

  assert.equal(dominant(at(0, 0)), 0, '左上偏红');
  assert.equal(dominant(at(size - 1, 0)), 1, '右上偏绿');
  assert.equal(dominant(at(0, size - 1)), 2, '左下偏蓝');
  assert.equal(at(5, 5)[3], 255);
});

test('meshBuffer 相邻像素平滑过渡，不出现硬边', () => {
  const size = 48;
  const buf = meshBuffer(size, size, DEFAULT_COLORS);
  for (let y = 0; y < size; y++) {
    for (let x = 1; x < size; x++) {
      const a = (y * size + x - 1) * 4;
      const b = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        assert.ok(Math.abs(buf[b + c] - buf[a + c]) <= 8, `x=${x} y=${y} 通道 ${c} 跳变过大`);
      }
    }
  }
});

test('圆角最多到短边的一半，负值归零', () => {
  assert.equal(clampRadius(12, 200, 100), 12);
  assert.equal(clampRadius(400, 200, 100), 50);
  assert.equal(clampRadius(-8, 200, 100), 0);
});

test('shadowRgba 拼出 canvas 能用的颜色', () => {
  assert.equal(shadowRgba({ color: '#10151F', opacity: 0.28 }), 'rgba(16, 21, 31, 0.28)');
});

test('配置文件往返后状态一致', () => {
  const state = {
    colors: ['#112233', '#445566', '#778899'],
    padding: 64,
    radius: { image: 12, canvas: 24 },
    shadow: { ...DEFAULT_SHADOW, y: 10, opacity: 0.5 },
    image: 'data:image/png;base64,AAA',
  };
  assert.deepEqual(parseConfig(serializeConfig(state)), state);
});

test('parseConfig 拒绝外来文件，并补齐缺失字段', () => {
  assert.throws(() => parseConfig({ foo: 1 }), /配置文件/);
  const filled = parseConfig({ format: 'mesh-gradient-tool' });
  assert.deepEqual(filled.colors, DEFAULT_COLORS);
  assert.equal(filled.padding, DEFAULT_PADDING);
  assert.deepEqual(filled.radius, DEFAULT_RADIUS);
  assert.deepEqual(filled.shadow, DEFAULT_SHADOW);
  assert.equal(filled.image, null);
});

test('parseConfig 丢掉非图片的 image 字段', () => {
  assert.equal(parseConfig({ format: 'mesh-gradient-tool', image: '/Users/me/a.png' }).image, null);
});
