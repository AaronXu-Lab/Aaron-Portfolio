/**
 * Grid Breakpoint 计算器 · 应用层 —— 只做读输入、调 core、写 DOM 三件事。
 * 所有数学都在 core.js 里，这里只负责取整与排版。
 */

import { calculateGrid, columnWidthAt, columnsAt, idealWidth, validate } from './core.js';

const $ = (id) => document.getElementById(id);
const KEY = 'grid-breakpoint:config';

const inputs = { maxWidth: $('max-width'), columns: $('columns'), spacing: $('spacing') };
const vw = $('vw');
const errorBox = $('error');

/** 展示层取整：整数就不带小数，否则留两位。 */
const px = (n) => `${Number.isInteger(n) ? n : Number(n.toFixed(2))}px`;
const num = (n) => (Number.isInteger(n) ? n : Number(n.toFixed(2)));
const sub = (n) => `<i class="sym">I<sub>${n}</sub></i>`;

/** 预览舞台的可用宽度（已扣掉 padding），缩放与初始 max-width 都按它来。 */
const stageInner = () => $('stage').clientWidth - 28;

function readConfig() {
  return {
    maxWidth: Number(inputs.maxWidth.value),
    columns: Number(inputs.columns.value),
    spacing: Number(inputs.spacing.value),
  };
}

function renderTable(breakpoints, activeColumns) {
  $('rows').innerHTML = breakpoints
    .map(
      (bp) => `<tr${bp.fromColumns === activeColumns ? ' class="is-on"' : ''}>
        <td>${bp.fromColumns} → ${bp.toColumns} 列</td>
        <td>${px(bp.breakpoint)}</td>
        <td>${px(bp.widthMin)}</td>
        <td>${px(bp.widthMax)}</td>
        <td>±${px(bp.deviation)} · ±${bp.deviationPercent.toFixed(1)}%</td>
      </tr>`
    )
    .join('');
}

function renderTicks(breakpoints, min, max) {
  $('ticks').innerHTML = breakpoints
    .filter((bp) => bp.breakpoint >= min && bp.breakpoint <= max)
    .map((bp) => {
      const at = ((bp.breakpoint - min) / (max - min)) * 100;
      return `<i style="left:${at.toFixed(2)}%">${Math.round(bp.breakpoint)}</i>`;
    })
    .join('');
}

/**
 * 预览：把当前预览宽度按 scale 缩到舞台里。
 * 列格子一次造满 columns 个并绝对定位，切换列数时只改 width / transform / opacity，
 * 这样过渡才连得上；用 grid-template-columns 换列会因为轨道数变化直接跳。
 */
function renderPreview(config, result) {
  const width = Number(vw.value);
  const n = columnsAt(width, result.breakpoints);
  const columnWidth = columnWidthAt(width, config, n);
  const scale = Math.min(1, stageInner() / config.maxWidth);

  $('viewport').style.width = `${width * scale}px`;

  const cols = $('cols');
  if (cols.childElementCount !== config.columns) {
    cols.innerHTML = '<i></i>'.repeat(config.columns);
  }
  [...cols.children].forEach((cell, i) => {
    // 用不上的格子按当前列宽继续往右排，于是它们是「滑出去并淡掉」而不是凭空消失
    cell.style.width = `${columnWidth * scale}px`;
    cell.style.transform = `translateX(${i * (columnWidth + config.spacing) * scale}px)`;
    cell.style.opacity = i < n ? '1' : '0';
  });

  $('vw-read').textContent = `${width}px`;
  $('cols-read').textContent = `${n} 列`;
  $('cw-read').textContent = `${px(columnWidth)} / 列`;

  const delta = columnWidth - result.defaultWidth;
  const flat = Math.abs(delta) < 0.005;
  const sign = delta > 0 ? '+' : '−';
  const devRead = $('dev-read');
  devRead.classList.toggle('is-flat', flat);
  devRead.textContent = flat
    ? '与默认列宽持平'
    : `${sign}${px(Math.abs(delta))} · ${sign}${Math.abs(
        (delta / result.defaultWidth) * 100
      ).toFixed(1)}%`;

  renderTable(result.breakpoints, n);
}

/** 计算过程：把公式和当前这组数字并排写出来，折叠在 details 里。 */
function renderSteps({ maxWidth, columns, spacing }, { defaultWidth: D, breakpoints }) {
  const step = D + spacing;
  const ideals = [];
  for (let n = columns; n >= 1; n--) {
    ideals.push(`${sub(n)} = ${px(idealWidth(n, D, spacing))}`);
  }

  const line = (bp, body) => `<p class="fx"><b>${bp.fromColumns} → ${bp.toColumns}</b>${body}</p>`;

  $('steps').innerHTML = `
    <h3>1 · 默认列宽 D</h3>
    <p class="fx">D = (max-width − (列数 − 1) × 间距) ÷ 列数</p>
    <p class="fx">= (${maxWidth} − ${columns - 1} × ${spacing}) ÷ ${columns} = <b>${px(D)}</b></p>
    <p class="why">max-width 下摆满 ${columns} 列时的单列宽度。后面每一步都在让实际列宽尽量贴近它。</p>

    <h3>2 · 理想宽度 Iₙ</h3>
    <p class="fx">${sub('n')} = n × D + (n − 1) × 间距</p>
    <p class="fx">${ideals.join('　·　')}</p>
    <p class="why">n 列都恰好等于 D 时，Grid 该有多宽。相邻两级恒差 D + 间距 = ${px(step)}，
      所以理想宽度是一把等距的尺子。</p>

    <h3>3 · 断点 BPₙ</h3>
    <p class="fx">BPₙ = ${sub('n')} − n ÷ (2n − 1) × (D + 间距)</p>
    ${breakpoints
      .map((bp) =>
        line(
          bp,
          `：${num(bp.idealFrom)} − ${bp.fromColumns}/${2 * bp.fromColumns - 1} × ${num(
            step
          )} = <b>${px(bp.breakpoint)}</b>`
        )
      )
      .join('')}
    <p class="why">断点取在「切换前后的列宽相对 D 偏差相等」的位置，即 切换前 + 切换后 = 2D。
      再晚，多的那一列被压得过窄；再早，少一列后又过宽 —— 这个位置让最坏偏差最小。</p>

    <h3>4 · 偏差 Eₙ</h3>
    <p class="fx">Eₙ = (D + 间距) ÷ (2n − 1)，列宽区间 = D ± Eₙ</p>
    ${breakpoints
      .map((bp) =>
        line(
          bp,
          `：${num(step)} ÷ ${2 * bp.fromColumns - 1} = <b>±${px(bp.deviation)}</b>　→　${px(
            bp.widthMin
          )} ↔ ${px(bp.widthMax)}，中点正好 ${px(D)}`
        )
      )
      .join('')}
    <p class="why">分母 2n − 1 随列数变小而变小，所以越靠近单列，同一次切换的跳变越大。</p>
  `;
}

function render() {
  const config = readConfig();
  const invalid = validate(config);

  errorBox.hidden = !invalid;
  if (invalid) {
    errorBox.textContent = invalid;
    return;
  }

  const result = calculateGrid(config);
  $('default-width').textContent = px(result.defaultWidth);

  // 预览下限固定在 max-width 的 20%，保证 1 列状态一定进得去
  const min = Math.max(1, Math.round(config.maxWidth * 0.2));
  const wasMax = Number(vw.value) >= Number(vw.max);
  vw.min = min;
  vw.max = config.maxWidth;
  if (wasMax || Number(vw.value) > config.maxWidth) vw.value = config.maxWidth;
  if (Number(vw.value) < min) vw.value = min;

  renderTicks(result.breakpoints, min, config.maxWidth);
  renderPreview(config, result);
  renderSteps(config, result);
  localStorage.setItem(KEY, JSON.stringify(config));
}

const rerender = (fn) => () => {
  const config = readConfig();
  if (!validate(config)) fn(config, calculateGrid(config));
};

// 恢复上次的参数；没有存档就按当前可用宽度取个百位整数，保证一进来预览是 1:1 而不是被缩到很小
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (saved && !validate(saved)) {
    inputs.maxWidth.value = saved.maxWidth;
    inputs.columns.value = saved.columns;
    inputs.spacing.value = saved.spacing;
  } else {
    inputs.maxWidth.value = Math.max(320, Math.floor(stageInner() / 100) * 100);
  }
} catch {
  /* 存档坏了就当没存过 */
}

for (const input of Object.values(inputs)) input.addEventListener('input', render);
vw.addEventListener('input', rerender(renderPreview));
addEventListener('resize', rerender(renderPreview));

render();

// ---------------------------------------------------------------- PWA 安装

const installButton = $('install');
const installHint = $('pwa-hint');
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
let installPrompt;
let hintTimer = 0;

/** 安装反馈只短暂浮现，不在版面上留常驻文字。 */
const say = (msg) => {
  installHint.textContent = msg;
  clearTimeout(hintTimer);
  if (msg) hintTimer = setTimeout(() => (installHint.textContent = ''), 6000);
};

// 独立窗口打开的不必再给入口；其余环境一律显示，iOS 走「添加到主屏幕」说明
if (!isStandalone) installButton.hidden = false;

// Chromium 满足条件时给出此事件；存下来等用户主动点按钮再触发，绝不自动弹
addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});

addEventListener('appinstalled', () => {
  installButton.hidden = true;
  installPrompt = undefined;
  say('已安装为应用');
});

installButton.addEventListener('click', async () => {
  if (isSamsung) {
    say('三星浏览器安装包可能触发安全警告，请改用最新版 Chrome 安装');
    return;
  }
  if (installPrompt) {
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    say(outcome === 'accepted' ? '正在安装…' : '已取消安装，可稍后重试');
    installPrompt = undefined;
    return;
  }
  say(
    isIOS
      ? '请点 Safari 分享按钮，再选「添加到主屏幕」'
      : '请打开浏览器菜单，选择「安装应用」或「添加到主屏幕」'
  );
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/tools/grid-breakpoint/sw.js', { updateViaCache: 'none' });
  });
}
