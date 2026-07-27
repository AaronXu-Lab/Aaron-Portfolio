/**
 * 专注森林 · 应用层 —— 状态机 + HTML 覆盖层，3D 只是它的一块画布。
 *
 * 两条纪律：
 *  1. 数据先落盘再动 3D。开始 / 完成都是先写 localStorage,场景出任何问题都不丢记录。
 *  2. 3D 是可选层。WebGL 不可用或 three 加载失败就切 2D,计时、记录、离线一律照常。
 */

import {
  commit,
  createSession,
  dayLabel,
  formatClock,
  formatDuration,
  isDone,
  loadActive,
  loadSessions,
  pageLabel,
  paginate,
  progressOf,
  remainingMs,
  saveActive,
  saveSessions,
  stageOf,
  summary,
  timeLabel,
} from './core.js';

const $ = (id) => document.getElementById(id);
const body = document.body;
const params = new URLSearchParams(location.search);
const qa = params.has('qa');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (qa) body.classList.add('qa');

let sessions = loadSessions();
let active = loadActive();
let minutes = 25;
let scene = null;
let ticker = 0;
let pages = [];
let pageIndex = 0;
let dimTimer = 0;
let resetTimer = 0;

// ---------------------------------------------------------------- 3D 层（可选）

async function mount3D() {
  const canvas = $('stage');
  try {
    const mod = await import('./scene.js');
    if (!mod.isWebGLAvailable()) throw new Error('WebGL unavailable');
    scene = mod.createScene(canvas, { motion: !reduced && !qa });
    body.classList.remove('no-3d');
    $('flat').hidden = true;
  } catch (err) {
    console.warn('[focus-forest] 3D 不可用，使用 2D 简版：', err);
    scene = null;
    body.classList.add('no-3d');
    $('flat').hidden = false;
    $('flat-note').textContent =
      err?.message === 'WebGL unavailable'
        ? '当前设备未启用 3D，已切换为简版画面。计时与记录不受影响。'
        : '3D 资源加载失败，已切换为简版画面。计时与记录不受影响。';
  }
  // 挂载可能晚于首屏：把已经决定好的进度与可用空间补给场景
  syncGrowth();
  syncMode();
  syncBand();
  if (body.dataset.view === 'forest') renderForest();
}

/** 进度同步到两套画面:3D 连续生长 + 2D SVG(降级路径仍按五阶段切换)。 */
let progressShown = 1;
function applyProgress(p, animate = true) {
  progressShown = p;
  document.documentElement.dataset.stage = String(stageOf(p));
  scene?.setProgress(p, { animate });
}

/** 没有进行中的专注时，首页展示成熟形态当作「这次要种的植物」的预览。 */
function currentProgress() {
  return active ? progressOf(active, Date.now()) : 1;
}

/**
 * 专注中把整段时间区间交给场景，让它每帧自己插值。
 * 这里的 ticker 只有 2Hz，用它去推 3D 会把生长切成半秒一级的台阶。
 */
function syncGrowth() {
  // 没有进行中的专注就把当前决定好的进度钉住（含 ?p= 定格）
  if (!active) return applyProgress(progressShown, false);
  progressShown = progressOf(active, Date.now());
  document.documentElement.dataset.stage = String(stageOf(progressShown));
  scene?.trackProgress(active.startedAt, active.endsAt);
}

function syncMode() {
  scene?.setMode(body.dataset.view === 'forest' ? 'forest' : 'plant');
}

/**
 * 把「3D 还剩多少地方」量给场景：可用空间 = 顶栏底边 → 卡片顶边(收起时是把手顶边)。
 * 收起后这块地方变高，构图就该整体往下走，才仍然是居中的 —— 场景据此做镜头平移。
 */
function syncBand() {
  const panel = $(`view-${body.dataset.view}`);
  // 把面板占位高度告诉 CSS：收起时把手要滑到这个距离之外，translate 才能做过渡
  body.style.setProperty('--panel-h', `${panel.offsetHeight}px`);
  if (!scene) return;
  /*
   * 一律用 offsetTop / offsetHeight 这类「不含 transform」的量。
   * 面板与把手此刻正走 0.3s 的收起过渡，getBoundingClientRect 拿到的是过渡途中的位置 ——
   * 那会读成上一个状态的几何，收起与展开的取景刚好互换，看起来就是「收起后树往上跑」。
   */
  const shell = document.querySelector('.shell').getBoundingClientRect().top;
  const top = $('bar-top').getBoundingClientRect().bottom;
  const panelTop = shell + panel.offsetTop;
  const bottom = body.classList.contains('ui-min')
    ? panelTop + panel.offsetHeight - $('fold').offsetHeight // 收起后把手落在面板原本占位的底边
    : panelTop;
  scene.setBand(((top + bottom) / 2) / (innerHeight || 1));
}

// ---------------------------------------------------------------- 视图切换

function show(view) {
  body.dataset.view = view;
  syncMode();
  if (view === 'focus') startTicker();
  else stopTicker();
  if (view !== 'focus') $('fold-clock').textContent = '';
  // 换视图就撤掉所有待确认状态，不留一个「确认清空？」在那儿等着被误点
  disarmGiveUp();
  disarmClear();
  if (view === 'home') renderHomeStat();
  if (view === 'forest') openForest();
  syncBand();
}

// ---------------------------------------------------------------- 专注流程

function beginFocus() {
  askNotify(); // 借这次点击(用户手势)申请通知权限,完成时才有资格提醒
  const session = createSession({ minutes, now: Date.now() });
  // 先落盘，再碰场景
  active = session;
  saveActive(active);
  clearTimeout(resetTimer); // 放弃后的复位还没跑就又开始了,别让它回头把进度改掉
  scene?.resetPlant();
  applyProgress(0, false);
  scene?.drop();
  syncGrowth();
  renderFocus();
  show('focus');
}

/** 完成：记录先写死，再放动画。 */
function finishFocus() {
  if (!active) return;
  const done = active;
  sessions = commit(sessions, done);
  saveSessions(sessions);
  active = null;
  saveActive(null);
  stopTicker();
  notifyDone(done.minutes);

  $('done-min').textContent = formatDuration(done.minutes);
  applyProgress(1, false);
  setFold(false); // 完成卡不该被收起状态吞掉
  show('done');
  scene?.celebrate();
}

// ---------------------------------------------------------------- 完成通知

/** 只在权限还没问过时申请;必须由用户手势触发,所以挂在「开始专注」的点击里。 */
function askNotify() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch {
    /* iOS 未安装为 PWA 时没有这个 API,忽略 */
  }
}

/** 完成提醒：人不在页面上才发系统通知(看着的话庆祝动画就够了),Android 上再加一下震动。 */
async function notifyDone(min) {
  navigator.vibrate?.([120, 60, 120]);
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  const options = {
    body: `专注 ${formatDuration(min)} 完成，这棵树已经种进你的森林。`,
    icon: '/tools/focus-forest/icon-192.png',
    badge: '/tools/focus-forest/icon-192.png',
    tag: 'focus-forest-done',
  };
  // 独立窗口 / Android 里 new Notification() 会抛错,优先走 Service Worker
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) return void (await reg.showNotification('专注完成', options));
  } catch {
    /* 落到下面的兜底 */
  }
  try {
    new Notification('专注完成', options);
  } catch {
    /* 两条路都不通就算了,记录本身没丢 */
  }
}

/**
 * 会丢数据的操作都走按钮自身的两段式确认：先变成「确认…？」，4 秒内再点一次才真的执行。
 * 不能用 window.confirm —— 内嵌浏览器和部分 PWA 独立窗口会直接把它压掉并返回 false,
 * 按钮就永远没反应。返回撤销函数，换视图时调用。
 */
function armable(button, armedLabel, run) {
  // 图标按钮（角落那种）改 tooltip 与 aria-label，文字按钮改自身文案
  const byTip = button.dataset.tip !== undefined;
  const label = byTip ? button.dataset.tip : button.textContent;
  const say = (text) => {
    if (!byTip) return void (button.textContent = text);
    button.dataset.tip = text;
    button.setAttribute('aria-label', text);
  };
  let armed = false;
  let timer = 0;
  const disarm = () => {
    clearTimeout(timer);
    armed = false;
    say(label);
    button.classList.remove('armed');
  };
  button.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      say(armedLabel);
      button.classList.add('armed');
      clearTimeout(timer);
      timer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    run();
  });
  return disarm;
}

const disarmGiveUp = armable($('give-up'), '确认放弃？', giveUp);
const disarmClear = armable($('clear-forest'), '确认清空？', clearForest);

function giveUp() {
  if (!active) return show('home');
  active = null;
  saveActive(null);
  stopTicker();
  applyProgress(progressShown, false); // 停在放弃那一刻的形态,别让淡出中的植株继续长
  scene?.fadeOutPlant();
  show('home');
  // 等淡出放完,再把场景复位成首页那株「要种的植物」预览
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    scene?.resetPlant();
    applyProgress(currentProgress(), false);
  }, 900);
}

function renderFocus() {
  if (!active) return;
  const now = Date.now();
  progressShown = progressOf(active, now);
  const left = formatClock(remainingMs(active, now));
  $('clock').textContent = left;
  $('fold-clock').textContent = left; // 收起状态下把手兼任迷你倒计时,显隐归 CSS 管
  // 3D 的生长由场景每帧自算，这里只同步 2D 降级画面的阶段
  document.documentElement.dataset.stage = String(stageOf(progressShown));
  if (isDone(active, now)) finishFocus();
}

function startTicker() {
  stopTicker();
  renderFocus();
  ticker = setInterval(renderFocus, 500);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = 0;
}

// ---------------------------------------------------------------- 森林

function openForest() {
  pages = paginate(sessions);
  pageIndex = Math.max(0, pages.length - 1);
  renderForest();
}

function renderForest() {
  const page = pages[pageIndex] ?? [];
  const all = summary(sessions);
  $('forest-stat').textContent = all.count
    ? `共 ${all.count} 棵树 · 累计 ${formatDuration(all.minutes)}`
    : '还没有树。完成一次专注就会种下第一棵。';
  $('page-label').textContent = pages.length > 1
    ? `${pageLabel(page)} · ${pageIndex + 1}/${pages.length}`
    : pageLabel(page);
  $('prev-page').disabled = pageIndex <= 0;
  $('next-page').disabled = pageIndex >= pages.length - 1;
  $('prev-page').hidden = $('next-page').hidden = pages.length <= 1;
  $('detail').hidden = true;
  $('clear-forest').hidden = !sessions.length; // 没有树就没什么可清
  scene?.showForest(page, showDetail);
}

/** 清空：只删已种下的树，进行中的那次专注不受影响。 */
function clearForest() {
  sessions = [];
  saveSessions(sessions);
  openForest();
  renderHomeStat();
}

function showDetail(record) {
  const box = $('detail');
  if (!record) {
    box.hidden = true;
    return;
  }
  $('d-min').textContent = formatDuration(record.minutes);
  $('d-meta').textContent = [
    `${dayLabel(record.endedAt)} ${timeLabel(record.endedAt)}`,
    record.interruptions ? `中断 ${record.interruptions} 次` : '全程未离开',
  ].join(' · ');
  box.hidden = false;
}

/** 一棵树都还没有时不写字，首页保持干净。 */
function renderHomeStat() {
  const all = summary(sessions);
  $('home-stat').textContent = all.count
    ? `已种下 ${all.count} 棵树 · 累计专注 ${formatDuration(all.minutes)}`
    : '';
}

// ---------------------------------------------------------------- 时长选择

const segment = document.querySelector('.segment');
// 调试档(15 秒)只在 ?dev 下保留;不给就从 DOM 里摘掉,分段控件回到四格
const segs = [...document.querySelectorAll('.seg[data-min]')].filter((seg) => {
  if (seg.dataset.dev === undefined || params.has('dev')) return true;
  seg.remove();
  return false;
});

/** 同步选中态,并把滑块的格数 / 格号写进 --n / --i。 */
function syncChips() {
  let index = -1;
  segment.style.setProperty('--n', String(segs.length));
  segs.forEach((seg, i) => {
    const on = Number(seg.dataset.min) === minutes;
    seg.classList.toggle('is-on', on);
    seg.setAttribute('aria-checked', String(on));
    if (on) index = i;
  });
  segment.toggleAttribute('data-off', index < 0);
  if (index >= 0) segment.style.setProperty('--i', String(index));
}

for (const seg of segs) {
  seg.addEventListener('click', () => {
    minutes = Number(seg.dataset.min);
    syncChips();
  });
}

// ---------------------------------------------------------------- 事件接线

$('start').addEventListener('click', beginFocus);
$('again').addEventListener('click', () => {
  scene?.resetPlant();
  applyProgress(currentProgress(), false);
  show('home');
});
$('to-forest').addEventListener('click', () => show('forest'));
$('see-forest').addEventListener('click', () => show('forest'));
$('back-home').addEventListener('click', () => {
  scene?.resetPlant();
  applyProgress(currentProgress(), false);
  show(active ? 'focus' : 'home');
});
$('prev-page').addEventListener('click', () => {
  pageIndex = Math.max(0, pageIndex - 1);
  renderForest();
});
$('next-page').addEventListener('click', () => {
  pageIndex = Math.min(pages.length - 1, pageIndex + 1);
  renderForest();
});
$('retry-3d').addEventListener('click', mount3D);

// ---------------------------------------------------------------- 面板收起/展开

const foldButton = $('fold');
const KEY_FOLD = 'ff.v1.fold';

function setFold(min) {
  body.classList.toggle('ui-min', min);
  foldButton.setAttribute('aria-expanded', String(!min));
  foldButton.setAttribute('aria-label', min ? '展开面板' : '收起面板');
  syncBand(); // 卡片让出/占回空间，构图跟着重新居中
  try {
    localStorage.setItem(KEY_FOLD, min ? '1' : '');
  } catch {
    /* 存不上就不记住,功能照常 */
  }
}

foldButton.addEventListener('click', () => setFold(!body.classList.contains('ui-min')));

// 视口变了（转屏、缩放、手机地址栏收放）可用空间也变，重新量一次
addEventListener('resize', syncBand);

// 上次的收起状态跨启动记住(完成页会强制展开,不怕被永远收起)
try {
  syncBand(); // 先把 --panel-h 量准,免得启动就是收起态时把手用默认值落错位置
  if (localStorage.getItem(KEY_FOLD) === '1') setFold(true);
} catch {
  /* ignore */
}

/**
 * 离开页面：计一次中断并把环境压暗；不可见时停渲染，计时靠 endsAt 继续走。
 * 回到前台：按真实时间重算进度，再把环境亮回来。
 */
document.addEventListener('visibilitychange', () => {
  const focusing = body.dataset.view === 'focus' && active;
  if (document.hidden) {
    if (focusing) {
      active.interruptions++;
      saveActive(active);
      scene?.setDim(true);
      body.classList.add('is-dim');
    }
    scene?.pause();
    return;
  }

  scene?.resume();
  if (!focusing) return;
  renderFocus();
  if (!active) return; // renderFocus 可能已经判定完成
  clearTimeout(dimTimer);
  dimTimer = setTimeout(() => {
    scene?.setDim(false);
    body.classList.remove('is-dim');
  }, 450);
});

// ---------------------------------------------------------------- PWA 安装

const installButton = $('install');
const installHint = $('pwa-hint');
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
let installPrompt;

/** 安装反馈只作为浮层短暂出现,说完就收,不在版面上留下常驻文字。 */
let hintTimer = 0;
const say = (msg) => {
  installHint.textContent = msg;
  clearTimeout(hintTimer);
  if (msg) hintTimer = setTimeout(() => (installHint.textContent = ''), 6000);
};

const hideInstall = () => {
  installButton.hidden = true;
  installPrompt = undefined;
};

// 已经是独立窗口打开的:直接收起入口,不用弹提示
if (isStandalone) hideInstall();

// Chromium 满足条件时给出此事件；存下来等用户主动点按钮再触发，绝不自动弹
addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  if (!isStandalone) installButton.hidden = false;
});

addEventListener('appinstalled', () => {
  hideInstall();
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
    navigator.serviceWorker.register('/tools/focus-forest/sw.js', { updateViaCache: 'none' });
  });
}

// ---------------------------------------------------------------- 启动

// 关掉标签页期间跑完的那次专注，回来直接落成记录
if (active && isDone(active, Date.now())) {
  finishFocus();
} else if (active) {
  minutes = active.minutes;
  syncChips();
  show('focus');
} else {
  syncChips();
  applyProgress(1, false);
  show('home');
}

// 调植物用:?p=0.35 把生长定格在该进度(仅无进行中的专注时;配 ?qa 关动画便于截图)
const debugP = params.get('p');
if (!active && debugP !== null) {
  applyProgress(Math.min(1, Math.max(0, Number(debugP) || 0)), false);
}

renderHomeStat();
mount3D();
