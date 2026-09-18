/* Mesh Gradient 图片生成器 —— 只做读输入、画 canvas、写 DOM；算法在 core.js。 */

import {
  DEFAULT_COLORS, DEFAULT_SHADOW, DEFAULT_PADDING, DEFAULT_RADIUS,
  canvasSize, clampRadius, meshBuffer, shadowRgba, serializeConfig, parseConfig,
} from './core.js';

const $ = (id) => document.getElementById(id);

const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const mesh = document.createElement('canvas');
const meshCtx = mesh.getContext('2d');
const MESH_RES = 96; // 低分辨率算完再平滑放大，既快又不会出现光斑边界

const state = {
  colors: [...DEFAULT_COLORS],
  padding: DEFAULT_PADDING,
  radius: { ...DEFAULT_RADIUS },
  shadow: { ...DEFAULT_SHADOW },
  image: null, // dataURL
};

let img = null;

/* ------------------------------------------------------------------ 绘制 */

function drawMesh(w, h) {
  mesh.width = MESH_RES;
  mesh.height = MESH_RES;
  const buf = meshBuffer(MESH_RES, MESH_RES, state.colors);
  meshCtx.putImageData(new ImageData(buf, MESH_RES, MESH_RES), 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mesh, 0, 0, MESH_RES, MESH_RES, 0, 0, w, h);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, clampRadius(r, w, h));
}

function render() {
  if (!img) {
    canvas.hidden = true;
    $('empty').hidden = false;
    $('drop').classList.remove('has-image');
    return;
  }

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const pad = state.padding;
  const { width, height } = canvasSize({ imageWidth: iw, imageHeight: ih, padding: pad });

  canvas.width = width;
  canvas.height = height;
  canvas.hidden = false;
  $('empty').hidden = true;
  $('drop').classList.add('has-image');

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (state.radius.canvas > 0) {
    roundRect(0, 0, width, height, state.radius.canvas);
    ctx.clip(); // 整张成品图的圆角：角上留透明，导出的 PNG 也是圆角
  }

  drawMesh(width, height);

  const s = state.shadow;
  if (s.on) {
    const sw = iw + s.spread * 2;
    const sh = ih + s.spread * 2;
    if (sw > 0 && sh > 0) {
      // canvas 没有 spread：改画一个按 spread 缩放的矩形，
      // 并把它挪到画布外、用 shadowOffset 把影子投回原位，矩形本体不会露出来。
      const off = width * 2;
      ctx.save();
      ctx.shadowColor = shadowRgba(s);
      ctx.shadowBlur = s.blur;
      ctx.shadowOffsetX = s.x + off;
      ctx.shadowOffsetY = s.y;
      ctx.fillStyle = '#000';
      roundRect(pad - s.spread - off, pad - s.spread, sw, sh, state.radius.image + s.spread);
      ctx.fill();
      ctx.restore();
    }
  }

  if (state.radius.image > 0) {
    ctx.save();
    roundRect(pad, pad, iw, ih, state.radius.image);
    ctx.clip();
    ctx.drawImage(img, pad, pad, iw, ih);
    ctx.restore();
  } else {
    ctx.drawImage(img, pad, pad, iw, ih);
  }
  ctx.restore();
  $('export-png').disabled = false;
}

// 只用来报错:成功的事看预览就知道了，不占版面
const say = (text) => window.alert(text);

/* ------------------------------------------------------------------ 图片 */

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error('图片读取失败'));
    next.src = dataUrl;
  });
}

async function setImage(dataUrl) {
  try {
    img = await loadImage(dataUrl);
    state.image = dataUrl;
    render();
  } catch {
    say('这张图片读不出来，换一张试试');
  }
}

function readFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    say('只支持图片文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => setImage(String(reader.result));
  reader.onerror = () => say('文件读取失败');
  reader.readAsDataURL(file);
}

/* ------------------------------------------------------------------ 配色 */

function renderSwatches() {
  $('swatches').innerHTML = '';
  state.colors.forEach((color, i) => {
    const row = document.createElement('label');
    row.className = 'swatch';
    row.innerHTML = `<span>POINT ${i + 1}</span><code>${color.toUpperCase()}</code>`;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = color;
    input.setAttribute('aria-label', `渐变点 ${i + 1} 颜色`);
    input.addEventListener('input', () => {
      state.colors[i] = input.value;
      row.querySelector('code').textContent = input.value.toUpperCase();
      render();
    });
    row.append(input);
    $('swatches').append(row);
  });
}

function setCount(count) {
  const base = DEFAULT_COLORS;
  state.colors = Array.from({ length: count }, (_, i) => state.colors[i] ?? base[i]);
  document.querySelectorAll('.seg-btn').forEach((b) => {
    const on = Number(b.dataset.count) === count;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', String(on));
  });
  renderSwatches();
  render();
}

/* ------------------------------------------------------------------ 表单 */

const SHADOW_INPUTS = [
  ['sx', 'x', 'sx-val'],
  ['sy', 'y', 'sy-val'],
  ['sb', 'blur', 'sb-val'],
  ['sp', 'spread', 'sp-val'],
  ['so', 'opacity', 'so-val'],
];

// 滑杆自己的默认量程，撑开后还能收回去
const RANGE_BOUNDS = new Map(
  [...document.querySelectorAll("input[type='range']")].map((el) => [el.id, [el.min, el.max]]),
);

/**
 * 写一个值进滑杆:配置文件带来的值超出量程时把量程撑到装得下，
 * 而不是被 input 悄悄夹回边界 —— 老配置 / 手改配置的数值一律照单全收。
 */
function setRange(id, value, out) {
  const el = $(id);
  const [min, max] = RANGE_BOUNDS.get(id);
  el.min = Math.min(Number(min), value);
  el.max = Math.max(Number(max), value);
  el.value = value;
  $(out).textContent = value;
}

function syncForm() {
  setRange('padding', state.padding, 'padding-val');
  ['image', 'canvas'].forEach((key) => setRange(`r-${key}`, state.radius[key], `r-${key}-val`));
  $('shadow-on').checked = state.shadow.on;
  $('shadow-fields').classList.toggle('is-off', !state.shadow.on);
  SHADOW_INPUTS.forEach(([id, key, out]) => setRange(id, state.shadow[key], out));
  $('sc').value = state.shadow.color;
  setCount(state.colors.length);
}

$('padding').addEventListener('input', () => {
  state.padding = Number($('padding').value);
  $('padding-val').textContent = state.padding;
  render();
});

['image', 'canvas'].forEach((key) => {
  $(`r-${key}`).addEventListener('input', () => {
    state.radius[key] = Number($(`r-${key}`).value);
    $(`r-${key}-val`).textContent = state.radius[key];
    render();
  });
});

$('shadow-on').addEventListener('change', () => {
  state.shadow.on = $('shadow-on').checked;
  $('shadow-fields').classList.toggle('is-off', !state.shadow.on);
  render();
});

SHADOW_INPUTS.forEach(([id, key, out]) => {
  $(id).addEventListener('input', () => {
    state.shadow[key] = Number($(id).value);
    $(out).textContent = state.shadow[key];
    render();
  });
});

$('sc').addEventListener('input', () => {
  state.shadow.color = $('sc').value;
  render();
});

document.querySelectorAll('.seg-btn').forEach((b) => {
  b.addEventListener('click', () => setCount(Number(b.dataset.count)));
});

// 配色、Padding、阴影一起回到出厂值；已上传的图片不动（删图另有按钮）。
$('reset').addEventListener('click', () => {
  state.colors = [...DEFAULT_COLORS];
  state.padding = DEFAULT_PADDING;
  state.radius = { ...DEFAULT_RADIUS };
  state.shadow = { ...DEFAULT_SHADOW };
  syncForm();
  render();
});

/* ------------------------------------------------------------------ 上传 */

$('file').addEventListener('change', (e) => {
  readFile(e.target.files[0]);
  e.target.value = '';
});

const drop = $('drop');
drop.addEventListener('click', () => $('file').click()); // 有图时点一下就是换图
['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => {
  e.preventDefault();
  drop.classList.add('is-over');
}));
['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, (e) => {
  e.preventDefault();
  drop.classList.remove('is-over');
}));
drop.addEventListener('drop', (e) => readFile(e.dataTransfer?.files?.[0]));

/* ------------------------------------------------------------------ 导出 */

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

$('export-png').addEventListener('click', () => {
  if (!img) return;
  canvas.toBlob((blob) => {
    if (blob) download(blob, `mesh-gradient-${canvas.width}x${canvas.height}.png`);
  }, 'image/png');
});

$('export-config').addEventListener('click', () => {
  const json = JSON.stringify(serializeConfig(state), null, 2);
  download(new Blob([json], { type: 'application/json' }), 'mesh-gradient-config.json');
});

$('import').addEventListener('click', () => $('config-file').click());
$('config-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const next = parseConfig(JSON.parse(String(reader.result)));
      state.colors = next.colors;
      state.padding = next.padding;
      state.radius = next.radius;
      state.shadow = next.shadow;
      syncForm();
      if (next.image) {
        await setImage(next.image);
      } else {
        img = null;
        state.image = null;
        $('export-png').disabled = true;
        render();
      }
        } catch (err) {
      say(err instanceof SyntaxError ? '配置文件不是合法 JSON' : err.message);
    }
  };
  reader.readAsText(file);
});

syncForm();
render();
