import {
  CANDIES,
  SPECIALS,
  advanceTask,
  areAdjacent,
  createBoard,
  createTask,
  findValidMoves,
  isTaskComplete,
  resolveTurn,
  seededRandom,
  specialOf,
  swap,
  typeOf,
} from './core.js';

const $ = (selector) => document.querySelector(selector);
const boardEl = $('#board');
const liveStatus = $('#live-status');
const boardStatus = $('#board-status');
const gameOverDialog = $('#game-over-dialog');
const installDialog = $('#install-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const STATS_KEY = 'candy-match.v2.stats';
const SOUND_KEY = 'candy-match.v2.sound';
const candyColors = ['#e84169', '#e7b130', '#7a48c5', '#48b67d', '#36a8d0', '#ef6e3f'];
const comboWords = ['', '', '甜蜜连锁！', '糖果风暴！', '太精彩了！', '漫游奇迹！'];

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 隐私模式或存储已满时仍可继续本局。
  }
}

function normalizeStats(value) {
  return {
    bestScore: Math.max(0, Number(value?.bestScore) || 0),
    totalTickets: Math.max(0, Number(value?.totalTickets) || 0),
  };
}

let stats = normalizeStats(readJSON(STATS_KEY, null));
let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
let audioContext = null;
let deferredInstallPrompt = null;
let runRandom = seededRandom(Date.now());
let refillRandom = seededRandom(Date.now() + 91);
let dragStart = null;
let suppressClick = false;
let timer = 0;

const state = {
  board: [],
  selected: null,
  locked: false,
  gameOver: false,
  completingTask: false,
  timeExpired: false,
  task: null,
  taskProgress: 0,
  taskStartedAt: 0,
  taskEndsAt: 0,
  tasksDone: 0,
  runScore: 0,
  runTickets: 0,
  recordToBeat: 0,
};

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? Math.min(10, ms) : ms));

function setStatus(message, boardMessage = message) {
  liveStatus.textContent = message;
  boardStatus.textContent = boardMessage;
}

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString('zh-CN');
}

function formatClock(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function playSound(kind, cascade = 1) {
  if (!soundOn) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const notes = {
      select: [440],
      error: [180, 155],
      clear: [510 + cascade * 70, 650 + cascade * 85],
      skill: [660, 880, 1100],
      reward: [523, 659, 784, 1047],
      lose: [330, 277, 220],
    }[kind] ?? [440];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind === 'clear' || kind === 'skill' ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.05, now + index * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.055 + 0.15);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + index * 0.055);
      oscillator.stop(now + index * 0.055 + 0.17);
    });
  } catch {
    // Web Audio 不可用时静默降级。
  }
}

function candyLabel(index, cell) {
  const row = Math.floor(index / 8) + 1;
  const column = (index % 8) + 1;
  const special = specialOf(cell);
  const skill = special ? `，${SPECIALS[special].name}，${SPECIALS[special].effect}` : '';
  return `第 ${row} 行第 ${column} 列，${CANDIES[typeOf(cell)].name}${skill}`;
}

function renderBoard() {
  const focusedIndex = document.activeElement?.closest?.('.candy-cell')?.dataset.index;
  const fragment = document.createDocumentFragment();

  state.board.forEach((cell, index) => {
    const type = typeOf(cell);
    const special = specialOf(cell);
    const button = document.createElement('button');
    button.className = 'candy-cell';
    button.type = 'button';
    button.dataset.index = index;
    button.dataset.kind = type;
    if (special) button.dataset.special = special;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', candyLabel(index, cell));
    button.setAttribute('aria-selected', String(state.selected === index));
    if (state.selected === index) button.classList.add('is-selected');

    const piece = document.createElement('span');
    piece.className = 'candy-piece';
    piece.setAttribute('aria-hidden', 'true');
    button.append(piece);

    if (special) {
      const mark = document.createElement('span');
      mark.className = 'special-mark';
      mark.dataset.special = special;
      mark.setAttribute('aria-hidden', 'true');
      if (special === 'burst') mark.textContent = '✦';
      button.append(mark);
    }
    fragment.append(button);
  });

  boardEl.replaceChildren(fragment);
  if (focusedIndex != null) {
    boardEl.querySelector(`[data-index="${focusedIndex}"]`)?.focus({ preventScroll: true });
  }
}

function describeTask(task) {
  if (task.kind === 'collect') return `收集 ${task.target} 颗${CANDIES[task.type].short}`;
  if (task.kind === 'skill') return `制造或触发 ${task.target} 颗技能糖`;
  return `获得 ${formatNumber(task.target)} 分`;
}

function renderTask() {
  const task = state.task;
  $('#task-number').textContent = `任务 ${String(task.id).padStart(2, '0')}`;
  $('#task-reward').textContent = `+${task.reward}`;
  $('#task-title').textContent = describeTask(task);
  $('#task-progress-label').textContent =
    `${formatNumber(state.taskProgress)} / ${formatNumber(task.target)}`;
  $('#task-progress-bar').style.width = `${(state.taskProgress / task.target) * 100}%`;

  const icon = $('#task-icon');
  icon.dataset.kind = task.kind;
  icon.textContent = task.kind === 'skill' ? '✦' : task.kind === 'collect' ? '' : '◆';
  icon.style.setProperty('--task-color', task.kind === 'collect' ? candyColors[task.type] : '');
}

function updateRunStats() {
  if (state.runScore > stats.bestScore) {
    stats.bestScore = state.runScore;
    saveJSON(STATS_KEY, stats);
  }
  $('#run-score').textContent = formatNumber(state.runScore);
  $('#tasks-done').textContent = state.tasksDone;
  $('#run-tickets').textContent = state.runTickets;
  $('#best-score').textContent = formatNumber(stats.bestScore);
  $('#total-tickets').textContent = stats.totalTickets;
}

function beginTask() {
  const previousKind = state.task?.kind ?? null;
  state.task = createTask({
    number: state.tasksDone + 1,
    random: runRandom,
    avoidKind: previousKind,
  });
  state.taskProgress = 0;
  state.taskStartedAt = Date.now();
  state.taskEndsAt = state.taskStartedAt + state.task.timeMs;
  state.completingTask = false;
  state.timeExpired = false;
  renderTask();
  updateTimer();
  setStatus(describeTask(state.task), '新任务已出现');
}

function startRun() {
  runRandom = seededRandom(Date.now());
  refillRandom = seededRandom(Date.now() + 91);
  state.board = createBoard({ seed: Date.now() });
  state.selected = null;
  state.locked = false;
  state.gameOver = false;
  state.completingTask = false;
  state.timeExpired = false;
  state.task = null;
  state.taskProgress = 0;
  state.tasksDone = 0;
  state.runScore = 0;
  state.runTickets = 0;
  state.recordToBeat = stats.bestScore;
  renderBoard();
  updateRunStats();
  beginTask();
  clearInterval(timer);
  timer = window.setInterval(updateTimer, 100);
}

function updateTimer() {
  if (!state.task || state.gameOver || state.completingTask) return;
  const now = Date.now();
  const remaining = Math.max(0, state.taskEndsAt - now);
  const ratio = Math.max(0, Math.min(1, remaining / state.task.timeMs));
  const urgent = remaining <= 8000;
  $('#time-label').textContent = formatClock(remaining);
  $('#time-label').classList.toggle('is-urgent', urgent);
  $('#time-bar').style.width = `${ratio * 100}%`;
  $('#time-bar').classList.toggle('is-urgent', urgent);

  if (remaining <= 0) {
    if (state.locked) state.timeExpired = true;
    else endRun();
  }
}

function selectCell(index) {
  state.selected = index;
  renderBoard();
  playSound('select');
  setStatus(`已选中${CANDIES[typeOf(state.board[index])].name}。`, '选择相邻糖果');
}

function showBurst(element, text) {
  element.textContent = text;
  element.classList.remove('is-visible');
  void element.offsetWidth;
  element.classList.add('is-visible');
}

function playSkillEffects(step) {
  const layer = $('#effect-layer');
  layer.replaceChildren();
  for (const index of step.activated) {
    const special = specialOf(step.boardBefore[index]);
    if (!special) continue;
    const effect = document.createElement('i');
    effect.className = `effect ${special}`;
    effect.style.setProperty('--row', Math.floor(index / 8));
    effect.style.setProperty('--column', index % 8);
    layer.append(effect);
  }
  if (step.activated.length) playSound('skill');
  window.setTimeout(() => layer.replaceChildren(), reducedMotion.matches ? 20 : 520);
}

async function completeTask() {
  state.completingTask = true;
  state.tasksDone += 1;
  state.runTickets += state.task.reward;
  stats.totalTickets += state.task.reward;
  saveJSON(STATS_KEY, stats);
  updateRunStats();
  showBurst($('#reward-burst'), `+${state.task.reward} 糖果券`);
  setStatus(`任务完成，获得 ${state.task.reward} 张糖果券。`, '奖励已收入');
  playSound('reward');
  await wait(720);
  if (state.gameOver) return;
  beginTask();
  state.locked = false;
}

async function attemptSwap(a, b) {
  if (state.locked || state.gameOver || !areAdjacent(a, b)) return;
  state.locked = true;
  state.selected = null;

  const result = resolveTurn(state.board, a, b, { random: refillRandom });
  if (!result.valid) {
    renderBoard();
    [a, b].forEach((index) =>
      boardEl.querySelector(`[data-index="${index}"]`)?.classList.add('is-invalid')
    );
    playSound('error');
    setStatus('没有组成消除，换个方向试试。', '无效交换');
    await wait(340);
    if (state.timeExpired || Date.now() >= state.taskEndsAt) endRun();
    else state.locked = false;
    return;
  }

  state.board = swap(state.board, a, b);
  renderBoard();
  await wait(110);

  for (const step of result.steps) {
    state.board = step.boardBefore;
    renderBoard();
    step.matched.forEach((index) =>
      boardEl.querySelector(`[data-index="${index}"]`)?.classList.add('is-matched')
    );
    playSkillEffects(step);
    playSound('clear', step.cascade);
    if (step.cascade > 1) {
      showBurst(
        $('#combo-burst'),
        comboWords[Math.min(comboWords.length - 1, step.cascade)] ?? `${step.cascade} 连锁！`
      );
    }
    const skillCopy = step.activated.length
      ? `，触发 ${step.activated.length} 颗技能糖`
      : step.created.length
        ? `，生成 ${step.created.length} 颗技能糖`
        : '';
    setStatus(
      `消除 ${step.matched.length} 颗糖果${skillCopy}，获得 ${step.score} 分。`,
      step.activated.length ? '技能连锁' : step.created.length ? '技能糖已生成' : '甜蜜消除'
    );
    await wait(280);
    state.board = step.boardAfter;
    renderBoard();
    await wait(140);
  }

  state.board = result.board;
  state.runScore += result.score;
  state.taskProgress = advanceTask(state.task, state.taskProgress, result);
  renderBoard();
  renderTask();
  updateRunStats();

  if (result.shuffled) setStatus('没有可走的交换，糖果已自动摇匀。', '棋盘已摇匀');

  if (state.timeExpired || Date.now() >= state.taskEndsAt) {
    endRun();
  } else if (isTaskComplete(state.task, state.taskProgress)) {
    await completeTask();
  } else {
    state.locked = false;
  }
}

function endRun() {
  if (state.gameOver) return;
  state.gameOver = true;
  state.locked = true;
  state.completingTask = false;
  clearInterval(timer);
  const wasRecord = state.runScore > state.recordToBeat;
  if (state.runScore > stats.bestScore) stats.bestScore = state.runScore;
  saveJSON(STATS_KEY, stats);
  updateRunStats();
  $('#final-score').textContent = formatNumber(state.runScore);
  $('#final-tasks').textContent = state.tasksDone;
  $('#final-tickets').textContent = state.runTickets;
  $('#record-note').textContent = wasRecord ? '新的最佳成绩！' : `最佳成绩 ${formatNumber(stats.bestScore)}`;
  playSound('lose');
  setStatus('任务超时，本局结束。', '时间到');
  gameOverDialog.showModal();
}

function showHint() {
  if (state.locked || state.gameOver) return;
  const move = findValidMoves(state.board)[0];
  if (!move) return;
  move.forEach((index) =>
    boardEl.querySelector(`[data-index="${index}"]`)?.classList.add('is-hint')
  );
  setStatus('闪动的两颗糖果可以交换。', '提示已标出');
  playSound('select');
}

function openInstallGuide() {
  const standalone =
    matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
  const steps = $('#install-steps');
  const confirm = $('#confirm-install-button');

  if (standalone) {
    $('#install-copy').textContent = '糖果漫游已经安装在这台设备上，可以直接离线游玩。';
    steps.replaceChildren();
    confirm.textContent = '知道了';
    confirm.dataset.mode = 'close';
  } else if (deferredInstallPrompt) {
    $('#install-copy').textContent = '安装后可以从主屏幕直接打开，断网也能继续游戏。';
    steps.replaceChildren();
    confirm.textContent = '安装应用';
    confirm.dataset.mode = 'prompt';
  } else if (isIOS) {
    $('#install-copy').textContent = 'Safari 不会主动弹出安装框，请按下面的步骤添加到主屏幕。';
    steps.innerHTML = '<li>点浏览器底部的“分享”按钮。</li><li>向下滑动，选择“添加到主屏幕”。</li>';
    confirm.textContent = '知道了';
    confirm.dataset.mode = 'close';
  } else if (isSamsung) {
    $('#install-copy').textContent =
      '三星浏览器安装的 WebAPK 可能触发 Android 安全警告，建议改用最新版 Chrome 打开本页后安装。';
    steps.innerHTML = '<li>在最新版 Chrome 中打开本页。</li><li>点菜单里的“安装应用”。</li>';
    confirm.textContent = '知道了';
    confirm.dataset.mode = 'close';
  } else {
    $('#install-copy').textContent = '当前浏览器需要从菜单手动安装。';
    steps.innerHTML = '<li>打开浏览器菜单。</li><li>选择“安装应用”或“添加到主屏幕”。</li>';
    confirm.textContent = '知道了';
    confirm.dataset.mode = 'close';
  }
  installDialog.showModal();
}

boardEl.addEventListener('click', (event) => {
  if (suppressClick || state.locked || state.gameOver) return;
  const cell = event.target.closest('.candy-cell');
  if (!cell) return;
  const index = Number(cell.dataset.index);
  if (state.selected == null) selectCell(index);
  else if (state.selected === index) {
    state.selected = null;
    renderBoard();
    setStatus('已取消选择。', '选择一颗糖果');
  } else if (areAdjacent(state.selected, index)) {
    attemptSwap(state.selected, index);
  } else {
    selectCell(index);
  }
});

boardEl.addEventListener('keydown', (event) => {
  const cell = event.target.closest('.candy-cell');
  if (!cell) return;
  const index = Number(cell.dataset.index);
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
  const offset = offsets[event.key];
  if (!offset) return;
  const target = index + offset;
  if (
    target < 0 ||
    target >= 64 ||
    (event.key === 'ArrowLeft' && index % 8 === 0) ||
    (event.key === 'ArrowRight' && index % 8 === 7)
  ) return;
  event.preventDefault();
  boardEl.querySelector(`[data-index="${target}"]`)?.focus();
});

boardEl.addEventListener('pointerdown', (event) => {
  if (state.locked || state.gameOver || event.button !== 0) return;
  const cell = event.target.closest('.candy-cell');
  if (!cell) return;
  dragStart = {
    index: Number(cell.dataset.index),
    x: event.clientX,
    y: event.clientY,
  };
});

boardEl.addEventListener('pointerup', (event) => {
  if (!dragStart || state.locked || state.gameOver) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) {
    dragStart = null;
    return;
  }
  let target = dragStart.index;
  if (Math.abs(dx) > Math.abs(dy)) target += dx > 0 ? 1 : -1;
  else target += dy > 0 ? 8 : -8;
  if (areAdjacent(dragStart.index, target)) {
    suppressClick = true;
    attemptSwap(dragStart.index, target);
    setTimeout(() => {
      suppressClick = false;
    }, 50);
  }
  dragStart = null;
});

boardEl.addEventListener('pointercancel', () => {
  dragStart = null;
});

$('#hint-button').addEventListener('click', showHint);
$('#restart-button').addEventListener('click', startRun);
$('#play-again-button').addEventListener('click', () => {
  gameOverDialog.close();
  startRun();
});
gameOverDialog.addEventListener('cancel', (event) => event.preventDefault());

$('#sound-button').addEventListener('click', (event) => {
  soundOn = !soundOn;
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
  } catch {
    // 存储不可用不影响当前开关。
  }
  event.currentTarget.setAttribute('aria-pressed', String(soundOn));
  event.currentTarget.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
  if (soundOn) playSound('select');
});

$('#install-button').addEventListener('click', openInstallGuide);
$('#confirm-install-button').addEventListener('click', async (event) => {
  if (event.currentTarget.dataset.mode === 'prompt' && deferredInstallPrompt) {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    installDialog.close();
    await prompt.prompt();
    await prompt.userChoice;
  } else {
    installDialog.close();
  }
});

document.addEventListener('click', (event) => {
  const close = event.target.closest('[data-close]');
  if (close) document.getElementById(close.dataset.close)?.close();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  $('#install-button').textContent = '已安装';
  setStatus('糖果漫游已经安装，可以从主屏幕打开。', '应用已安装');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/tools/candy-match/sw.js').catch(() => {
      setStatus('离线缓存暂时不可用，联网时仍可正常游玩。', '在线游玩');
    });
  });
}

$('#sound-button').setAttribute('aria-pressed', String(soundOn));
$('#sound-button').setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
history.replaceState(null, '', location.pathname);
updateRunStats();
startRun();
