import {
  CANDIES,
  LEVELS,
  areAdjacent,
  createBoard,
  findValidMoves,
  getLevel,
  isLevelComplete,
  makeIce,
  mergeCollected,
  remainingIce,
  resolveTurn,
  seededRandom,
  starsFor,
  swap,
} from './core.js';

const $ = (selector) => document.querySelector(selector);
const boardEl = $('#board');
const liveStatus = $('#live-status');
const boardStatus = $('#board-status');
const levelDialog = $('#level-dialog');
const resultDialog = $('#result-dialog');
const installDialog = $('#install-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const PROGRESS_KEY = 'candy-match.v1.progress';
const SOUND_KEY = 'candy-match.v1.sound';
const candyColors = ['#e84169', '#e7b130', '#7a48c5', '#48b67d', '#36a8d0', '#ef6e3f'];
const comboWords = ['', '', '甜蜜连锁！', '糖果风暴！', '太精彩了！', '漫游奇迹！'];

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
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

function normalizeProgress(raw) {
  const unlocked = Math.min(LEVELS.length, Math.max(1, Number(raw?.unlocked) || 1));
  const stars = {};
  for (const level of LEVELS) {
    const value = Number(raw?.stars?.[level.id]) || 0;
    stars[level.id] = Math.min(3, Math.max(0, value));
  }
  return { unlocked, stars };
}

let progress = normalizeProgress(readJSON(PROGRESS_KEY, null));
let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
let audioContext = null;
let deferredInstallPrompt = null;
let levelRandom = seededRandom(1);
let suppressClick = false;
let dragStart = null;

const state = {
  level: LEVELS[0],
  board: [],
  ice: [],
  movesLeft: 0,
  score: 0,
  collected: Array(CANDIES.length).fill(0),
  selected: null,
  locked: false,
};

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 10) : ms));

function setStatus(message, boardMessage = message) {
  liveStatus.textContent = message;
  boardStatus.textContent = boardMessage;
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
      win: [523, 659, 784, 1047],
      lose: [330, 277, 220],
    }[kind] ?? [440];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind === 'clear' ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.055, now + index * 0.07 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.16);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + index * 0.07);
      oscillator.stop(now + index * 0.07 + 0.18);
    });
  } catch {
    // Web Audio 不可用时静默降级。
  }
}

function candyLabel(index, type) {
  const row = Math.floor(index / 8) + 1;
  const column = (index % 8) + 1;
  const jelly = state.ice[index]
    ? `，${state.ice[index] === 2 ? '双层' : '单层'}果冻`
    : '';
  return `第 ${row} 行第 ${column} 列，${CANDIES[type].name}${jelly}`;
}

function renderBoard() {
  const focusedIndex = document.activeElement?.closest?.('.candy-cell')?.dataset.index;
  const fragment = document.createDocumentFragment();
  state.board.forEach((type, index) => {
    const button = document.createElement('button');
    button.className = 'candy-cell';
    button.type = 'button';
    button.dataset.index = index;
    button.dataset.kind = type;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', candyLabel(index, type));
    button.setAttribute('aria-selected', String(state.selected === index));
    if (state.selected === index) button.classList.add('is-selected');

    const piece = document.createElement('span');
    piece.className = 'candy-piece';
    piece.setAttribute('aria-hidden', 'true');
    button.append(piece);

    if (state.ice[index] > 0) {
      const ice = document.createElement('span');
      ice.className = 'ice';
      ice.dataset.layers = state.ice[index];
      ice.setAttribute('aria-hidden', 'true');
      button.append(ice);
    }
    fragment.append(button);
  });
  boardEl.replaceChildren(fragment);
  if (focusedIndex != null) {
    boardEl.querySelector(`[data-index="${focusedIndex}"]`)?.focus({ preventScroll: true });
  }
}

function objectiveRow({ icon, label, value, target, color }) {
  const complete = value >= target;
  const item = document.createElement('li');
  item.className = `objective${complete ? ' is-done' : ''}`;
  item.style.setProperty('--objective-color', color);
  item.innerHTML = `
    <span class="objective-icon">${complete ? '✓' : icon}</span>
    <span class="objective-copy">
      <b>${label}</b>
      <i style="--progress:${Math.min(100, (value / target) * 100)}%"></i>
    </span>
    <span class="objective-value">${Math.min(value, target)} / ${target}</span>
  `;
  return item;
}

function renderObjectives() {
  const list = $('#objective-list');
  const rows = [
    {
      icon: '◆',
      label: '获得旅行积分',
      value: state.score,
      target: state.level.score,
      color: '#6f3cc3',
    },
  ];

  for (const [type, target] of Object.entries(state.level.collect)) {
    const candy = Number(type);
    rows.push({
      icon: `<span class="mini-objective-candy" style="--objective-color:${candyColors[candy]}"></span>`,
      label: `收集${CANDIES[candy].short}`,
      value: state.collected[candy],
      target,
      color: candyColors[candy],
    });
  }

  const iceTarget = state.level.ice.reduce((sum, [, layers]) => sum + layers, 0);
  if (iceTarget) {
    rows.push({
      icon: '◇',
      label: '敲开全部果冻',
      value: iceTarget - remainingIce(state.ice),
      target: iceTarget,
      color: '#36a8d0',
    });
  }

  list.replaceChildren(...rows.map(objectiveRow));
}

function updateHUD() {
  $('#chapter-label').textContent = state.level.chapter;
  $('#level-number').textContent = String(state.level.id).padStart(2, '0');
  $('#level-title').textContent = state.level.name;
  $('#route-level').textContent = `${String(state.level.id).padStart(2, '0')} / ${LEVELS.length}`;
  $('#route-chapter').textContent = state.level.chapter;
  $('#moves-left').textContent = state.movesLeft;
  $('#moves-left').classList.toggle('is-low', state.movesLeft <= 5);
  $('#score').textContent = state.score.toLocaleString('zh-CN');
  renderObjectives();
}

function startLevel(levelId) {
  const requested = getLevel(levelId);
  const safeId = Math.min(requested.id, progress.unlocked);
  state.level = getLevel(safeId);
  levelRandom = seededRandom(state.level.seed + Date.now());
  state.board = createBoard({ seed: state.level.seed });
  state.ice = makeIce(state.level);
  state.movesLeft = state.level.moves;
  state.score = 0;
  state.collected = Array(CANDIES.length).fill(0);
  state.selected = null;
  state.locked = false;
  renderBoard();
  updateHUD();
  renderLevelMap();
  setStatus(`第 ${state.level.id} 关，${state.level.name}。请选择一颗糖果开始。`, '旅程开始');
  history.replaceState(null, '', `?level=${state.level.id}`);
}

function selectCell(index) {
  state.selected = index;
  renderBoard();
  playSound('select');
  setStatus(`已选中${CANDIES[state.board[index]].name}。请选择相邻糖果交换。`, '已选择糖果');
}

async function attemptSwap(a, b) {
  if (state.locked || !areAdjacent(a, b)) return;
  state.locked = true;
  state.selected = null;

  const result = resolveTurn(state.board, a, b, {
    ice: state.ice,
    random: levelRandom,
  });

  if (!result.valid) {
    renderBoard();
    const cells = [a, b].map((index) => boardEl.querySelector(`[data-index="${index}"]`));
    cells.forEach((cell) => cell?.classList.add('is-invalid'));
    playSound('error');
    setStatus('这一步没有组成三连，换个方向试试。', '没有组成三连');
    await wait(360);
    state.locked = false;
    return;
  }

  state.board = swap(state.board, a, b);
  renderBoard();
  await wait(150);

  for (const step of result.steps) {
    state.board = step.boardBefore;
    renderBoard();
    for (const index of step.matched) {
      boardEl.querySelector(`[data-index="${index}"]`)?.classList.add('is-matched');
    }
    playSound('clear', step.cascade);
    if (step.cascade > 1) showCombo(step.cascade);
    setStatus(
      step.cascade > 1
        ? `连续消除 ${step.cascade} 次，本轮获得 ${step.score} 分。`
        : `消除 ${step.matched.length} 颗糖果，获得 ${step.score} 分。`,
      step.cascade > 1 ? `${step.cascade} 连锁` : '甜蜜消除'
    );
    await wait(310);
    state.board = step.boardAfter;
    renderBoard();
    await wait(170);
  }

  state.board = result.board;
  state.ice = result.ice;
  state.movesLeft -= 1;
  state.score += result.score;
  state.collected = mergeCollected(state.collected, result.collected);
  renderBoard();
  updateHUD();

  if (result.shuffled) {
    setStatus('没有可走的交换，糖果罐已自动重新摇匀。', '棋盘已摇匀');
  }

  if (isLevelComplete(state.level, state)) {
    finishLevel(true);
    return;
  }
  if (state.movesLeft <= 0) {
    finishLevel(false);
    return;
  }

  state.locked = false;
}

function showCombo(cascade) {
  const burst = $('#combo-burst');
  burst.textContent = comboWords[Math.min(comboWords.length - 1, cascade)] ?? `${cascade} 连锁！`;
  burst.classList.remove('is-visible');
  void burst.offsetWidth;
  burst.classList.add('is-visible');
}

function finishLevel(won) {
  state.locked = true;
  const resultEmblem = $('#result-emblem');
  const nextButton = $('#next-level-button');
  const stars = won ? starsFor(state.level, state.movesLeft) : 0;
  resultEmblem.dataset.stars = stars;
  $('#result-score').textContent = state.score.toLocaleString('zh-CN');
  $('#result-moves').textContent = `${state.movesLeft} 步`;

  if (won) {
    progress.stars[state.level.id] = Math.max(progress.stars[state.level.id] || 0, stars);
    progress.unlocked = Math.max(
      progress.unlocked,
      Math.min(LEVELS.length, state.level.id + 1)
    );
    saveJSON(PROGRESS_KEY, progress);
    renderLevelMap();
    $('#result-kicker').textContent =
      state.level.id === LEVELS.length ? '整段旅程完成' : '下一站已解锁';
    $('#result-title').textContent = `${state.level.name}，到站`;
    $('#result-copy').textContent =
      stars === 3
        ? '步数规划得很漂亮，整罐糖果都在为你鼓掌。'
        : '旅行清单已经全部完成，地图上又亮起了一站。';
    nextButton.textContent =
      state.level.id === LEVELS.length ? '查看关卡地图' : '前往下一站';
    playSound('win');
    setStatus(`关卡完成，获得 ${stars} 颗星。`, '旅行完成');
  } else {
    $('#result-kicker').textContent = '步数已经用完';
    $('#result-title').textContent = '差一点到站';
    $('#result-copy').textContent = '留意旅行清单里还差哪一项，连锁消除能更快累积分数。';
    nextButton.textContent = '选择其他关卡';
    playSound('lose');
    setStatus('步数用完了，可以重新挑战本关。', '差一点到站');
  }

  nextButton.dataset.won = String(won);
  resultDialog.showModal();
}

function chapterGroups() {
  const groups = [];
  for (const level of LEVELS) {
    const last = groups.at(-1);
    if (!last || last.name !== level.chapter) groups.push({ name: level.chapter, levels: [] });
    groups.at(-1).levels.push(level);
  }
  return groups;
}

function renderLevelMap() {
  const totalStars = Object.values(progress.stars).reduce((sum, value) => sum + value, 0);
  $('#journey-progress').textContent = `已解锁 ${progress.unlocked} / ${LEVELS.length}`;
  $('#journey-stars').textContent = `${totalStars} 颗星`;
  $('#journey-bar').style.width = `${(progress.unlocked / LEVELS.length) * 100}%`;

  const fragment = document.createDocumentFragment();
  chapterGroups().forEach((chapter, chapterIndex) => {
    const section = document.createElement('section');
    section.className = 'chapter-block';
    const label = document.createElement('div');
    label.className = 'chapter-name';
    label.innerHTML = `<span>CHAPTER ${String(chapterIndex + 1).padStart(2, '0')}</span><b>${chapter.name}</b>`;

    const levels = document.createElement('div');
    levels.className = 'chapter-levels';
    chapter.levels.forEach((level) => {
      const unlocked = level.id <= progress.unlocked;
      const button = document.createElement('button');
      button.className = `level-node${level.id === state.level.id ? ' is-current' : ''}`;
      button.type = 'button';
      button.dataset.level = level.id;
      button.disabled = !unlocked;
      button.setAttribute(
        'aria-label',
        unlocked
          ? `第 ${level.id} 关，${level.name}，${progress.stars[level.id] || 0} 颗星`
          : `第 ${level.id} 关尚未解锁`
      );
      button.innerHTML = `
        ${unlocked ? '' : '<span class="lock" aria-hidden="true">◆</span>'}
        <strong>${String(level.id).padStart(2, '0')}</strong>
        <small>${'★'.repeat(progress.stars[level.id] || 0)}</small>
      `;
      levels.append(button);
    });

    section.append(label, levels);
    fragment.append(section);
  });
  $('#level-map').replaceChildren(fragment);
}

function showHint() {
  if (state.locked) return;
  const move = findValidMoves(state.board)[0];
  if (!move) return;
  boardEl.querySelectorAll('.is-hint').forEach((cell) => cell.classList.remove('is-hint'));
  move.forEach((index) => boardEl.querySelector(`[data-index="${index}"]`)?.classList.add('is-hint'));
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
    $('#install-copy').textContent =
      '安装后可以从主屏幕直接打开，断网也能继续旅程。游戏进度仍只保存在这台设备上。';
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
  if (suppressClick || state.locked) return;
  const cell = event.target.closest('.candy-cell');
  if (!cell) return;
  const index = Number(cell.dataset.index);
  if (state.selected == null) {
    selectCell(index);
  } else if (state.selected === index) {
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
  if (state.locked || event.button !== 0) return;
  const cell = event.target.closest('.candy-cell');
  if (!cell) return;
  dragStart = {
    index: Number(cell.dataset.index),
    x: event.clientX,
    y: event.clientY,
  };
});

boardEl.addEventListener('pointerup', (event) => {
  if (!dragStart || state.locked) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  const threshold = 18;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
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

$('#level-button').addEventListener('click', () => {
  renderLevelMap();
  levelDialog.showModal();
});

$('#level-map').addEventListener('click', (event) => {
  const button = event.target.closest('[data-level]');
  if (!button || button.disabled) return;
  levelDialog.close();
  startLevel(Number(button.dataset.level));
});

$('#hint-button').addEventListener('click', showHint);
$('#restart-button').addEventListener('click', () => startLevel(state.level.id));
$('#retry-button').addEventListener('click', () => {
  resultDialog.close();
  startLevel(state.level.id);
});

$('#next-level-button').addEventListener('click', (event) => {
  resultDialog.close();
  const won = event.currentTarget.dataset.won === 'true';
  if (won && state.level.id < LEVELS.length) startLevel(state.level.id + 1);
  else {
    renderLevelMap();
    levelDialog.showModal();
  }
});

document.addEventListener('click', (event) => {
  const close = event.target.closest('[data-close]');
  if (!close) return;
  document.getElementById(close.dataset.close)?.close();
});

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

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('#install-button').textContent = '安装应用';
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
const requestedLevel = Number(new URLSearchParams(location.search).get('level')) || 1;
startLevel(requestedLevel);
