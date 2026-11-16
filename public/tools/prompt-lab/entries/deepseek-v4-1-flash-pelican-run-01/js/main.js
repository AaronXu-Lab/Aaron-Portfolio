import * as THREE from '../vendor/three.module.min.js';
import { buildRig } from './rig.js';
import { createWorld } from './scene.js';
import { createAudio } from './audio.js';

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const params = new URLSearchParams(location.search);
const QA = params.has('qa');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('scene');
const boot = document.getElementById('boot');
const bootText = document.getElementById('bootText');
const pouchEl = document.getElementById('pouch');
const dotsEl = document.getElementById('dots');
const totalEl = document.getElementById('total');
const hintEl = document.getElementById('hint');
const hopBtn = document.getElementById('hop');
const soundBtn = document.getElementById('sound');
const dawnBtn = document.getElementById('dawn');
const helpBtn = document.getElementById('help');
const helpDialog = document.getElementById('helpDialog');
const closeHelpBtn = document.getElementById('closeHelp');
const toastEl = document.getElementById('toast');

for (let i = 0; i < 6; i++) dotsEl.appendChild(document.createElement('i'));
const dots = Array.from(dotsEl.children);

const audio = createAudio();
const keys = { left: false, right: false, up: false, down: false };

let toastTimer = 0;
let hintTimer = 0;
let shake = 0;
let introT = QA || reducedMotion ? 1 : 0;
let soundOn = true;

function showToast(text, ms = 2200) {
  toastEl.textContent = text;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms);
}

function hideHint() {
  if (hintEl.classList.contains('is-hidden')) return;
  hintEl.classList.add('is-hidden');
  clearTimeout(hintTimer);
}

function updateHud() {
  dots.forEach((d, i) => d.classList.toggle('on', i < collectCount));
  pouchEl.classList.toggle('is-full', collectCount >= 6);
  totalEl.textContent = String(totalFish);
}

let collectCount = 0;
let totalFish = 0;
let freeingPouch = false;

function handleCollect() {
  if (freeingPouch) return;
  collectCount++;
  totalFish++;
  state.fill = clamp(collectCount / 6, 0, 1);
  rig.triggerGulp();
  audio.blip(collectCount - 1);
  const p = rig.pouchWorld;
  world.burst(p.x, p.y - 0.05, p.z, 'teal', 7);
  shake = Math.min(0.6, shake + 0.08);
  updateHud();
  if (collectCount >= 6) {
    freeingPouch = true;
    showToast('喉囊满了 · 六条月光鱼', 2600);
    audio.full();
    state.boost = 2.4;
    const q = rig.pouchWorld;
    world.burst(q.x, q.y, q.z, 'gold', 34);
    setTimeout(() => {
      collectCount = 0;
      state.fill = 0;
      freeingPouch = false;
      updateHud();
      pouchEl.classList.remove('is-full');
    }, 900);
  }
}

function setDawnUI() {
  dawnBtn.setAttribute('aria-pressed', String(world.dawn));
  dawnBtn.setAttribute('aria-label', world.dawn ? '切回月夜' : '切换到拂晓');
}

function toggleDawn() {
  world.setDawn(!world.dawn);
  setDawnUI();
  showToast(world.dawn ? '拂晓 · 盐湖醒过来了' : '月夜 · 潮水安静下来');
  hideHint();
}

function toggleSound() {
  soundOn = !soundOn;
  audio.setEnabled(soundOn);
  if (soundOn) audio.ensure();
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.setAttribute('aria-label', soundOn ? '静音' : '开启声音');
  showToast(soundOn ? '声音已开启' : '已静音');
}

function openHelp() {
  if (!helpDialog.open) {
    if (typeof helpDialog.showModal === 'function') helpDialog.showModal();
    else helpDialog.setAttribute('open', '');
    closeHelpBtn.blur();
  }
  hideHint();
}

function closeHelp() {
  if (typeof helpDialog.close === 'function') helpDialog.close();
  else helpDialog.removeAttribute('open');
}

function doHop() {
  if (state.airborne) return;
  state.airborne = true;
  state.hopVel = 4.4;
  state.hop = Math.max(state.hop, 0.001);
  hopBtn.classList.add('is-air');
  audio.ensure();
  audio.whoosh();
  hideHint();
}

function land() {
  hopBtn.classList.remove('is-air');
  audio.land();
  shake = Math.min(0.8, shake + 0.28);
  world.spawnSplash(state.x, 0.03, 0.15, 22, 1.15);
  world.wake(state.x - 0.15, 0.3, 0);
  world.wake(state.x + 0.18, 0.42, 0);
}

function ringBell() {
  hideHint();
  audio.ensure();
  audio.bell();
  rig.triggerBell();
  world.wake(state.x + 0.16, 0.12, 0);
  world.wake(state.x - 0.12, 0.04, 0);
  world.spawnSplash(state.x, 0.02, 0.05, 4, 0.35);
  for (const f of world.fish.list) {
    if (f.mode === 'idle' && f.z < -1 && f.z > -36) {
      f.baseX += (state.x - f.baseX) * 0.78;
      f.baseY += (1.5 - f.baseY) * 0.35;
      f.glow.material.opacity = 1;
    }
  }
}

function resetRide() {
  state.targetX = 0;
  state.x = 0;
  state.speed = 6;
  state.targetSpeed = 6;
  state.hop = 0;
  state.hopVel = 0;
  state.airborne = false;
  state.air = 0;
  state.fill = 0;
  state.boost = 0;
  collectCount = 0;
  totalFish = 0;
  freeingPouch = false;
  rig.reset();
  world.reset(0);
  updateHud();
  hopBtn.classList.remove('is-air');
  showToast('重新出发 · 浪还在原处');
}

const state = {
  x: 0,
  targetX: 0,
  speed: 6,
  targetSpeed: 6,
  steer: 0,
  hop: 0,
  hopVel: 0,
  air: 0,
  airborne: false,
  fill: 0,
  boost: 0,
  cameraX: 0,
  cameraZ: 4.3,
  reduced: reducedMotion,
  look: new THREE.Vector2(0, -0.2),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b16);
const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 600);
camera.position.set(2.1, 2.7, 8.9);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
} catch (err) {
  console.error(err);
  bootText.textContent = 'WebGL 没能启动，请换一个浏览器试试';
  throw err;
}
renderer.setClearColor(0x070b16, 1);

const rig = buildRig();
scene.add(rig.root);
scene.add(rig.shadow);

const world = createWorld(scene, renderer);

const QUALITY = {
  2: { dpr: 2, ref: 0.5, every: 1 },
  1: { dpr: 1.6, ref: 0.4, every: 2 },
  0: { dpr: 1.3, ref: 0.33, every: 2 },
};
let quality = 2;
let refScale = 0.5;
let refEvery = 1;
let dprCap = 2;
const _size = new THREE.Vector2();

function applySize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(_size);
  world.resize(_size.x, _size.y, refScale);
}

function applyQuality(q) {
  quality = q;
  const cfg = QUALITY[q];
  dprCap = cfg.dpr;
  refScale = cfg.ref;
  refEvery = cfg.every;
  applySize();
}

applySize();
world.resize(renderer.domElement.width, renderer.domElement.height, refScale);
setDawnUI();
updateHud();
soundBtn.setAttribute('aria-pressed', 'true');
soundBtn.setAttribute('aria-label', '静音');

if (QA) {
  camera.position.set(1.25, 1.55, 3.85);
  camera.lookAt(0.03, 1.0, -0.85);
  camera.updateMatrixWorld();
  boot.classList.add('is-out');
  hintEl.classList.add('is-hidden');
} else if (reducedMotion) {
  boot.classList.add('is-out');
}

hintTimer = setTimeout(hideHint, 10000);

// ——— 触控 ———
let pointer = null;

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  audio.ensure();
  hideHint();
  pointer = {
    id: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    t0: performance.now(),
    moved: false,
    swiped: false,
    dx: 0,
  };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) { /* 某些浏览器不支持捕获 */ }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  const dx = e.clientX - pointer.lastX;
  pointer.lastX = e.clientX;
  pointer.dx += Math.abs(dx);
  const dy = e.clientY - pointer.y0;
  if (pointer.dx > 7 || Math.abs(dy) > 7) pointer.moved = true;
  state.targetX = clamp(state.targetX + dx * (11.2 / Math.max(280, window.innerWidth)), -5.4, 5.4);
  const elapsed = performance.now() - pointer.t0;
  if (!pointer.swiped && dy < -38 && Math.abs(dy) > pointer.dx * 0.8 && elapsed < 480) {
    pointer.swiped = true;
    doHop();
  }
}, { passive: true });

function endPointer(e, cancelled) {
  if (!pointer || e.pointerId !== pointer.id) return;
  const elapsed = performance.now() - pointer.t0;
  if (!cancelled && !pointer.moved && !pointer.swiped && elapsed < 320) ringBell();
  pointer = null;
}
canvas.addEventListener('pointerup', (e) => endPointer(e, false));
canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('dragstart', (e) => e.preventDefault());

hopBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.ensure();
  doHop();
});
soundBtn.addEventListener('click', () => toggleSound());
dawnBtn.addEventListener('click', () => toggleDawn());
helpBtn.addEventListener('click', () => openHelp());
closeHelpBtn.addEventListener('click', () => closeHelp());
helpDialog.addEventListener('click', (e) => {
  if (e.target === helpDialog) closeHelp();
});

// ——— 键盘 ———
window.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (helpDialog.open) {
    if (e.code === 'Escape' || e.code === 'KeyH') {
      e.preventDefault();
      closeHelp();
    }
    return;
  }

  switch (e.code) {
    case 'ArrowLeft':
      keys.left = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
      keys.right = true;
      e.preventDefault();
      break;
    case 'ArrowUp':
      keys.up = true;
      e.preventDefault();
      break;
    case 'ArrowDown':
      keys.down = true;
      e.preventDefault();
      break;
    case 'Space':
      if (!e.repeat) doHop();
      e.preventDefault();
      break;
    case 'KeyB':
      if (!e.repeat) ringBell();
      break;
    case 'KeyN':
      if (!e.repeat) toggleDawn();
      break;
    case 'KeyM':
      if (!e.repeat) toggleSound();
      break;
    case 'KeyR':
      if (!e.repeat) resetRide();
      break;
    case 'KeyH':
      if (!e.repeat) openHelp();
      break;
    case 'Slash':
      if (e.shiftKey) {
        if (!e.repeat) openHelp();
        e.preventDefault();
      }
      break;
    default:
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowLeft': keys.left = false; break;
    case 'ArrowRight': keys.right = false; break;
    case 'ArrowUp': keys.up = false; break;
    case 'ArrowDown': keys.down = false; break;
    default: break;
  }
});

window.addEventListener('blur', () => {
  keys.left = keys.right = keys.up = keys.down = false;
});

// ——— 尺寸 ———
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applySize, 100);
});
window.addEventListener('orientationchange', () => setTimeout(applySize, 220));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else audio.resume();
});

// ——— 主循环 ———
let lastFrame = performance.now();
let time = 0;
let frameNo = 0;
let fpsAcc = 0;
let fpsFrames = 0;
let qualityCooldown = 0;
let wakeAcc = 0;
let splashAcc = 0;
const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

function stepInput(dt) {
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir !== 0) {
    state.targetX = clamp(state.targetX + dir * 5.4 * dt, -5.4, 5.4);
    hideHint();
  }

  let wanted = 6 + Math.sin(time * 0.12) * 0.4;
  if (keys.up) wanted = 9.6;
  if (keys.down) wanted = 3.4;
  if (state.boost > 0) wanted += 1.2;
  state.boost = Math.max(0, state.boost - dt);
  state.targetSpeed = damp(state.targetSpeed, wanted, 1.5, dt);
  state.speed = damp(state.speed, state.targetSpeed, 2.4, dt);

  state.x = damp(state.x, state.targetX, 6.4, dt);
  state.steer = damp(state.steer, clamp((state.targetX - state.x) * 1.7, -1, 1), 9, dt);

  if (state.airborne) {
    state.hop += state.hopVel * dt;
    state.hopVel -= 14.6 * dt;
    if (state.hop <= 0) {
      state.hop = 0;
      state.hopVel = 0;
      state.airborne = false;
      land();
    }
  }
  state.air = clamp(state.hop / 0.52, 0, 1);
}

function updateCamera(dt) {
  introT = Math.min(1, introT + dt / 2.5);
  const e = easeOutCubic(introT);
  const speedK = (state.speed - 6) * 0.05;
  const dist = 3.85 + (1 - e) * 4.6 - speedK;
  const height = 1.55 + (1 - e) * 1.15 + state.hop * 0.24 + (reducedMotion ? 0 : Math.sin(time * 0.7) * 0.016);
  const side = 1.25 + (1 - e) * 1.0;
  camTarget.set(state.x * 0.9 + side, height, dist);
  const follow = 1 - Math.exp(-dt * (introT < 1 ? 4.2 : 3.6));
  camera.position.lerp(camTarget, follow);

  camera.lookAt(state.x * 0.9 + 0.03, 1.0 + state.hop * 0.24, -0.85);
  camera.rotateZ(-state.steer * 0.016);
  const wide = camera.aspect > 1.15;
  const fov = (wide ? 43 : 56) + speedK * 4 + state.air * 1.1;
  camera.fov = damp(camera.fov, fov, 3, dt);
  camera.updateProjectionMatrix();

  if (shake > 0.001 && !reducedMotion) {
    camera.position.x += Math.sin(time * 73) * shake * 0.05;
    camera.position.y += Math.cos(time * 61) * shake * 0.04;
  }
  shake = Math.max(0, shake - dt * 2.6);
  camera.updateMatrixWorld();
  state.cameraX = camera.position.x;
  state.cameraZ = camera.position.z;
}

function updateLook() {
  let best = null;
  let bestScore = 1e9;
  for (const f of world.fish.list) {
    if (f.mode !== 'idle' || f.z > -1.5 || f.z < -24) continue;
    const score = -f.z + Math.abs(f.group.position.x - state.x) * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  if (best) {
    lookTarget.set(
      clamp((best.group.position.x - state.x) / 2.2, -1, 1),
      clamp((best.group.position.y - 1.62) / 1.1, -1, 1)
    );
    state.look.lerp(lookTarget, 0.12);
  } else {
    state.look.lerp(lookTarget.set(0, -0.25), 0.03);
  }
}

function updateEffects(dt) {
  if (state.speed > 1.2) {
    wakeAcc += dt * (state.speed / 4.5);
    if (wakeAcc > 0.2 && !state.airborne) {
      wakeAcc = 0;
      world.wake(state.x + (Math.random() - 0.5) * 0.12, 0.5 + Math.random() * 0.15, time);
    }
    splashAcc += dt * state.speed * 0.9;
    while (splashAcc > 1) {
      splashAcc -= 1;
      if (!state.airborne) {
        world.spawnSplash(state.x + (Math.random() - 0.5) * 0.18, 0.02, 0.48 + Math.random() * 0.1, 1, 0.4 + state.speed * 0.035);
      }
    }
  }
  audio.setWind(state.speed, state.air);
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  time += dt;
  frameNo++;

  stepInput(dt);
  updateCamera(dt);
  updateLook();

  const got = world.updateEnvironment(dt, time, state, state.x, rig.pouchWorld);
  for (let i = 0; i < got; i++) handleCollect();

  rig.update(state, dt, time);
  updateEffects(dt);

  rig.shadow.position.set(state.x, 0.016, -0.04);
  rig.shadow.material.opacity = 0.55 * (1 - state.air * 0.65);
  rig.shadow.scale.setScalar(1 + state.air * 0.45);

  if (frameNo % refEvery === 0) world.renderReflection(renderer, camera, [rig.shadow, world.moon.group]);
  renderer.render(scene, camera);

  if (frameNo === 2) {
    setTimeout(() => boot.classList.add('is-out'), 380);
  }

  // 自适应降级：宁可少一点反射与像素，也要保持手感
  qualityCooldown -= dt;
  if (time > 4.5) {
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc > 3) {
      const fps = fpsFrames / fpsAcc;
      fpsAcc = 0;
      fpsFrames = 0;
      if (fps < 42 && quality > 0 && qualityCooldown <= 0) {
        applyQuality(quality - 1);
        qualityCooldown = 6;
      }
    }
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
