import * as THREE from '../vendor/three.min.js';
import { createPelicanBike } from './pelican-bike.js';
import { createCoastalWorld } from './world.js';
import { createSoundEngine } from './audio.js';

const STORAGE_KEY = 'gemini-4-carbon-high-pelican-run-01:delivered';
const MAX_POUCH_FISH = 6;
const MAX_CRATE_FISH = 5;

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

// Progressive soft boundary resistance (Apple rubber-band formula)
function rubberband(overshoot, dim, c = 0.55) {
  return (overshoot * dim * c) / (dim + c * Math.abs(overshoot));
}

function readSavedDelivered() {
  try {
    const v = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

function writeSavedDelivered(val) {
  try {
    localStorage.setItem(STORAGE_KEY, String(val));
  } catch {
    // Ignore restricted iframe storage environments gracefully
  }
}

// =========================================================================
// 1. RENDERER, SCENE, CAMERA & ACTORS INITIALIZATION
// =========================================================================
const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.12, 360);

const pelicanBike = createPelicanBike();
scene.add(pelicanBike.root);

const world = createCoastalWorld(scene, pelicanBike.materials);
const sound = createSoundEngine();

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = reducedMotionQuery.matches;
reducedMotionQuery.addEventListener?.('change', (e) => {
  reducedMotion = e.matches;
});

// =========================================================================
// 2. CAMERA PRESETS & PORTRAIT-ADAPTIVE ORBIT CONTROLLER (320–430px Tuned!)
// =========================================================================
const CAMERA_PRESETS = [
  { key: '3/4', name: '3/4 伴骑视角', relYaw: 0.96, pitch: 0.25, dist: 4.25, targetY: 1.05 },
  { key: '迎面', name: '迎面特写视角', relYaw: 2.22, pitch: 0.21, dist: 3.75, targetY: 1.12 },
  { key: '侧视', name: '侧面机械联动', relYaw: 1.54, pitch: 0.16, dist: 3.95, targetY: 0.96 },
  { key: '尾视', name: '正尾追风视角', relYaw: 0.0, pitch: 0.31, dist: 4.65, targetY: 1.08 },
];

const camState = {
  presetIndex: 0,
  userYaw: 0,
  userPitch: 0,
  yawVel: 0,
  pitchVel: 0,
  zoomScale: 1.0,
  smoothAzimuth: 0.64,
  smoothPitch: 0.28,
  smoothDist: 4.5,
  lookPos: new THREE.Vector3(),
  initialized: false,
};

function updateViewportSizing() {
  const w = window.innerWidth;
  const h = Math.max(1, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);

  const aspect = w / h;
  // Widen vertical FOV slightly on narrow 320–430px portrait screens so the full bike & lagoon frame cleanly!
  camera.fov = aspect < 1 ? clamp(45 / Math.pow(aspect, 0.30), 45, 58) : 44;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', updateViewportSizing);
updateViewportSizing();

// =========================================================================
// 3. RIDING & GAMEPLAY STATE
// =========================================================================
const ride = {
  s: 2.0, // Arc-length position along coastal loop
  lateral: 0.0, // Offset from centerline (+left, -right)
  lateralVel: 0.0,
  speed: 6.1, // m/s (~22 km/h natural coastal cruise)
  boostSpeed: 0.0,
  driveMode: 'cruise', // 'cruise' | 'coast' | 'park'
  jumpY: 0.0,
  velY: 0.0,
  airborne: false,
  gliding: false,
  bellActiveTimer: 0,
  pouchFish: 0,
  crateFish: 0,
  deliveredTotal: readSavedDelivered(),
  deliveryCooldown: 0,
  worldPos: new THREE.Vector3(),
  mouthPos: new THREE.Vector3(),
  leftDir: new THREE.Vector3(),
  u: 0,
};

const input = {
  keyLeft: false,
  keyRight: false,
  keySprint: false,
  keyBrake: false,
  keyJumpHeld: false,
  touchSteer: 0, // -1 .. +1 from analog thumb capsule
  touchSprint: false,
  touchJumpHeld: false,
};

// =========================================================================
// 4. DOM HUD REFERENCES & FEEDBACK HELPERS
// =========================================================================
const ui = {
  modeBtn: document.getElementById('mode-btn'),
  speedDot: document.getElementById('speed-dot'),
  modeLabel: document.getElementById('mode-label'),
  speedNum: document.getElementById('speed-num'),
  pouchPill: document.getElementById('pouch-pill'),
  pouchCount: document.getElementById('pouch-count'),
  deliveredCount: document.getElementById('delivered-count'),
  camBtn: document.getElementById('cam-btn'),
  camLabel: document.getElementById('cam-label'),
  themeBtn: document.getElementById('theme-btn'),
  soundBtn: document.getElementById('sound-btn'),
  soundOn: document.getElementById('sound-icon-on'),
  soundOff: document.getElementById('sound-icon-off'),
  helpBtn: document.getElementById('help-btn'),
  sheet: document.getElementById('shortcut-sheet'),
  sheetClose: document.getElementById('sheet-close'),
  toast: document.getElementById('event-toast'),
  steerPad: document.getElementById('steer-pad'),
  steerThumb: document.getElementById('steer-thumb'),
  bellBtn: document.getElementById('bell-btn'),
  hopBtn: document.getElementById('hop-btn'),
  hopLabel: document.getElementById('hop-label'),
  sprintBtn: document.getElementById('sprint-btn'),
};

ui.deliveredCount.textContent = String(ride.deliveredTotal);

let toastTimeout = null;
function showToast(msg, durationMs = 1550) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    ui.toast.classList.remove('visible');
  }, durationMs);
}

function pulseFishPill() {
  ui.pouchPill.classList.remove('bump');
  // Force reflow for crisp repeat bump
  void ui.pouchPill.offsetWidth;
  ui.pouchPill.classList.add('bump');
  setTimeout(() => ui.pouchPill.classList.remove('bump'), 190);
}

function syncFishHUD() {
  const carrying = ride.pouchFish + ride.crateFish;
  ui.pouchCount.textContent = String(carrying);
  ui.deliveredCount.textContent = String(ride.deliveredTotal);
}

// =========================================================================
// 5. ACTIONS (Hop / Glide, Bell Lure, Camera, Theme, Mode, Reset)
// =========================================================================
function performHop() {
  sound.unlock();
  if (!ride.airborne) {
    // Take off from cedar boardwalk!
    ride.airborne = true;
    ride.velY = 5.45;
    ride.gliding = false;
    // Resume cruise if jumping out of parked state
    if (ride.driveMode === 'park') {
      ride.driveMode = 'cruise';
      ride.speed = Math.max(ride.speed, 3.8);
    }
    pelicanBike.triggerFlap(0.65);
    sound.playHop(false);
    world.spawnBurst(ride.worldPos, 7, 0xfff5dc, 2.5, 9.0);
  } else if (!ride.gliding) {
    // Mid-air wing unfurl!
    ride.gliding = true;
    ride.velY = Math.max(ride.velY, 1.15);
    pelicanBike.triggerFlap(1.0);
    sound.playHop(true);
  }
}

function performBellAndChomp() {
  sound.unlock();
  sound.playBell();
  pelicanBike.triggerBell();
  pelicanBike.triggerChomp(false);
  ride.bellActiveTimer = 0.75;
  const lured = world.triggerBellLure(ride.worldPos, ride.lateral);
  if (lured > 0) {
    showToast(`叮铃！唤起 ${lured} 尾银鱼跃出海面`, 1350);
  }
}

function selectCameraPreset(index) {
  camState.presetIndex = ((index % CAMERA_PRESETS.length) + CAMERA_PRESETS.length) % CAMERA_PRESETS.length;
  camState.userYaw = 0;
  camState.userPitch = 0;
  camState.yawVel = 0;
  camState.pitchVel = 0;
  const preset = CAMERA_PRESETS[camState.presetIndex];
  ui.camLabel.textContent = preset.key;
  showToast(`视角：${preset.name}`, 1200);
}

function cycleDriveMode() {
  sound.unlock();
  const order = ['cruise', 'coast', 'park'];
  const next = order[(order.indexOf(ride.driveMode) + 1) % order.length];
  ride.driveMode = next;
  const labels = {
    cruise: '巡航骑行',
    coast: '自由棘轮滑行',
    park: '驻车单脚歇息',
  };
  showToast(labels[next], 1250);
}

function resetViewAndLane() {
  camState.userYaw = 0;
  camState.userPitch = 0;
  camState.yawVel = 0;
  camState.pitchVel = 0;
  camState.zoomScale = 1.0;
  ride.lateral = 0;
  ride.lateralVel = 0;
  ride.driveMode = 'cruise';
  showToast('已重置视角与航道', 1200);
}

function toggleSheet(forceOpen) {
  const open = typeof forceOpen === 'boolean' ? forceOpen : ui.sheet.hidden;
  ui.sheet.hidden = !open;
  ui.helpBtn.setAttribute('aria-expanded', String(open));
}

// =========================================================================
// 6. TOUCH & POINTER GESTURE CONTROLLERS (Multi-Touch Independent!)
// =========================================================================
// 6A. Left Thumb 1:1 Analog Steering Capsule (`#steer-pad`)
let steerPointerId = null;
let steerMaxPx = 38;

function updateSteerFromClientX(clientX) {
  const rect = ui.steerPad.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  steerMaxPx = Math.max(24, (rect.width - 54) * 0.5);
  const rawDx = clientX - centerX;
  const clampedDx =
    Math.abs(rawDx) <= steerMaxPx
      ? rawDx
      : Math.sign(rawDx) * (steerMaxPx + rubberband(Math.abs(rawDx) - steerMaxPx, 28));

  // Screen left (dx < 0) -> steer +1 (bike left); Screen right (dx > 0) -> steer -1 (bike right)
  input.touchSteer = clamp(-rawDx / steerMaxPx, -1, 1);
  visualThumbX = clampedDx;
  ui.steerThumb.style.transform = `translate3d(${clampedDx.toFixed(1)}px, 0, 0)`;
  ui.steerPad.setAttribute('aria-valuenow', String(Math.round(-input.touchSteer * 100)));
}

ui.steerPad.addEventListener('pointerdown', (e) => {
  if (steerPointerId !== null) return;
  sound.unlock();
  steerPointerId = e.pointerId;
  ui.steerPad.setPointerCapture(e.pointerId);
  updateSteerFromClientX(e.clientX);
});

ui.steerPad.addEventListener('pointermove', (e) => {
  if (e.pointerId !== steerPointerId) return;
  updateSteerFromClientX(e.clientX);
});

function endSteerDrag(e) {
  if (e.pointerId !== steerPointerId) return;
  steerPointerId = null;
  input.touchSteer = 0;
  ui.steerPad.setAttribute('aria-valuenow', '0');
}
ui.steerPad.addEventListener('pointerup', endSteerDrag);
ui.steerPad.addEventListener('pointercancel', endSteerDrag);

// 6B. Action Buttons (respond immediately on pointerdown, zero 300ms delay!)
function bindHoldButton(btn, onDown, onUp) {
  let activePid = null;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (activePid !== null) return;
    sound.unlock();
    activePid = e.pointerId;
    btn.setPointerCapture(e.pointerId);
    btn.removeAttribute('data-key-active');
    btn.classList.add('is-active');
    onDown();
  });
  const release = (e) => {
    if (e.pointerId !== activePid) return;
    activePid = null;
    btn.classList.remove('is-active');
    onUp?.();
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
}

bindHoldButton(
  ui.sprintBtn,
  () => {
    input.touchSprint = true;
    if (ride.driveMode !== 'cruise') ride.driveMode = 'cruise';
  },
  () => {
    input.touchSprint = false;
  }
);

bindHoldButton(
  ui.hopBtn,
  () => {
    input.touchJumpHeld = true;
    performHop();
  },
  () => {
    input.touchJumpHeld = false;
  }
);

bindHoldButton(
  ui.bellBtn,
  () => {
    performBellAndChomp();
  },
  null
);

// Top HUD Tool Buttons
ui.modeBtn.addEventListener('click', () => cycleDriveMode());
ui.camBtn.addEventListener('click', () => selectCameraPreset(camState.presetIndex + 1));
ui.themeBtn.addEventListener('click', () => {
  sound.unlock();
  const nextTheme = world.cycleTheme();
  showToast(`天色：${nextTheme.name}`, 1300);
});
ui.soundBtn.addEventListener('click', () => {
  const nextMuted = sound.setMuted(!sound.isMuted());
  ui.soundBtn.setAttribute('aria-pressed', String(!nextMuted));
  ui.soundOn.classList.toggle('hidden', nextMuted);
  ui.soundOff.classList.toggle('hidden', !nextMuted);
  showToast(nextMuted ? '音效已静音' : '海风音效已开启', 1100);
});
ui.helpBtn.addEventListener('click', () => toggleSheet());
ui.sheetClose.addEventListener('click', () => toggleSheet(false));
ui.sheet.addEventListener('click', (e) => {
  if (e.target === ui.sheet) toggleSheet(false);
});

// 6C. 3D Canvas Direct Orbit, Pinch-to-Zoom & Tap-Pelican Interaction!
const activeCanvasPointers = new Map();
let lastPinchDist = 0;
let orbitDragMoved = 0;
let orbitStartTime = 0;
let lastPointerTime = 0;
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  canvas.setPointerCapture(e.pointerId);
  activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activeCanvasPointers.size === 1) {
    orbitDragMoved = 0;
    orbitStartTime = performance.now();
    lastPointerTime = orbitStartTime;
    camState.yawVel = 0;
    camState.pitchVel = 0;
  } else if (activeCanvasPointers.size === 2) {
    const pts = [...activeCanvasPointers.values()];
    lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
});

canvas.addEventListener('pointermove', (e) => {
  const prev = activeCanvasPointers.get(e.pointerId);
  if (!prev) return;

  if (activeCanvasPointers.size === 1) {
    const now = performance.now();
    const dtMs = Math.max(8, now - lastPointerTime);
    lastPointerTime = now;

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    orbitDragMoved += Math.hypot(dx, dy);

    const yawDelta = -dx * 0.0075;
    const pitchDelta = dy * 0.0055;
    camState.userYaw += yawDelta;
    camState.userPitch = clamp(camState.userPitch + pitchDelta, -0.26, 0.58);

    // Track release velocity for smooth momentum handoff
    camState.yawVel = (yawDelta / dtMs) * 1000;
    camState.pitchVel = (pitchDelta / dtMs) * 1000;
  } else if (activeCanvasPointers.size === 2) {
    prev.x = e.clientX;
    prev.y = e.clientY;
    const pts = [...activeCanvasPointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (lastPinchDist > 12) {
      const ratio = lastPinchDist / Math.max(12, dist);
      camState.zoomScale = clamp(camState.zoomScale * ratio, 0.58, 1.65);
    }
    lastPinchDist = dist;
    return;
  }

  prev.x = e.clientX;
  prev.y = e.clientY;
});

function releaseCanvasPointer(e) {
  const prev = activeCanvasPointers.get(e.pointerId);
  activeCanvasPointers.delete(e.pointerId);
  if (activeCanvasPointers.size < 2) lastPinchDist = 0;

  // Quick tap on the 3D scene without dragging -> check if user tapped the Pelican!
  if (prev && activeCanvasPointers.size === 0 && orbitDragMoved < 10 && performance.now() - orbitStartTime < 320) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(pelicanBike.root, true);
    if (hits.length > 0) {
      pelicanBike.triggerFlap(1.0);
      pelicanBike.triggerChomp(false);
      sound.playCatch(false);
      world.spawnBurst(ride.mouthPos, 8, 0xfff8eb, 3.0, 6.5);
    }
  }
}
canvas.addEventListener('pointerup', releaseCanvasPointer);
canvas.addEventListener('pointercancel', releaseCanvasPointer);

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    camState.zoomScale = clamp(camState.zoomScale + e.deltaY * 0.0009, 0.58, 1.65);
  },
  { passive: false }
);

// =========================================================================
// 7. KEYBOARD SHORTCUTS (Instant Zero-Lag Response)
// =========================================================================
function setKeyButtonVisual(btn, active) {
  if (active) {
    btn.setAttribute('data-key-active', 'true');
    btn.classList.add('is-active');
  } else {
    btn.classList.remove('is-active');
    btn.removeAttribute('data-key-active');
  }
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const code = e.code;
  const key = e.key;

  if (
    code === 'Space' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown' ||
    code === 'ArrowLeft' ||
    code === 'ArrowRight'
  ) {
    e.preventDefault();
  }

  if (code === 'Escape' && !ui.sheet.hidden) {
    toggleSheet(false);
    return;
  }

  if (key === '?' || code === 'KeyH') {
    if (!e.repeat) toggleSheet();
    return;
  }

  sound.unlock();

  switch (code) {
    case 'KeyA':
    case 'ArrowLeft':
      input.keyLeft = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      input.keyRight = true;
      break;
    case 'KeyW':
    case 'ArrowUp':
    case 'ShiftLeft':
    case 'ShiftRight':
      input.keySprint = true;
      if (ride.driveMode !== 'cruise') ride.driveMode = 'cruise';
      setKeyButtonVisual(ui.sprintBtn, true);
      break;
    case 'KeyS':
    case 'ArrowDown':
      input.keyBrake = true;
      break;
    case 'Space':
      if (!e.repeat) performHop();
      input.keyJumpHeld = true;
      setKeyButtonVisual(ui.hopBtn, true);
      break;
    case 'KeyB':
    case 'KeyF':
    case 'Enter':
      if (!e.repeat) {
        setKeyButtonVisual(ui.bellBtn, true);
        performBellAndChomp();
      }
      break;
    case 'KeyQ':
      if (!e.repeat) cycleDriveMode();
      break;
    case 'KeyC':
    case 'KeyV':
      if (!e.repeat) selectCameraPreset(camState.presetIndex + 1);
      break;
    case 'Digit1':
    case 'Digit2':
    case 'Digit3':
    case 'Digit4':
      if (!e.repeat) selectCameraPreset(Number(code.slice(-1)) - 1);
      break;
    case 'KeyT':
      if (!e.repeat) {
        const t = world.cycleTheme();
        showToast(`天色：${t.name}`, 1300);
      }
      break;
    case 'KeyM':
      if (!e.repeat) ui.soundBtn.click();
      break;
    case 'KeyR':
      if (!e.repeat) resetViewAndLane();
      break;
    default:
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyA':
    case 'ArrowLeft':
      input.keyLeft = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      input.keyRight = false;
      break;
    case 'KeyW':
    case 'ArrowUp':
    case 'ShiftLeft':
    case 'ShiftRight':
      input.keySprint = false;
      setKeyButtonVisual(ui.sprintBtn, false);
      break;
    case 'KeyS':
    case 'ArrowDown':
      input.keyBrake = false;
      break;
    case 'Space':
      input.keyJumpHeld = false;
      setKeyButtonVisual(ui.hopBtn, false);
      break;
    case 'KeyB':
    case 'KeyF':
    case 'Enter':
      setKeyButtonVisual(ui.bellBtn, false);
      break;
    default:
      break;
  }
});

// Reset held keys cleanly if iframe/tab loses focus
window.addEventListener('blur', () => {
  input.keyLeft = false;
  input.keyRight = false;
  input.keySprint = false;
  input.keyBrake = false;
  input.keyJumpHeld = false;
  setKeyButtonVisual(ui.sprintBtn, false);
  setKeyButtonVisual(ui.hopBtn, false);
  setKeyButtonVisual(ui.bellBtn, false);
});

// =========================================================================
// 8. MAIN SIMULATION & RENDER LOOP
// =========================================================================
let prevTime = performance.now();
let elapsed = 0;
let visualThumbX = 0;
const _camOffset = new THREE.Vector3();
const _targetPoint = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
  prevTime = now;
  elapsed += dt;

  // 1. Combine Touch & Keyboard Steering + Spring Return on Thumb Slider
  const keySteer = (input.keyLeft ? 1 : 0) - (input.keyRight ? 1 : 0);
  const rawSteer = steerPointerId !== null ? input.touchSteer : keySteer !== 0 ? keySteer : 0;

  if (steerPointerId === null) {
    const targetPx = -rawSteer * steerMaxPx;
    visualThumbX = damp(visualThumbX, targetPx, 16, dt);
    if (Math.abs(visualThumbX - targetPx) < 0.08 && targetPx === 0) {
      visualThumbX = 0;
    }
    ui.steerThumb.style.transform = `translate3d(${visualThumbX.toFixed(1)}px, 0, 0)`;
  }

  // 2. Speed, Slope Gravity, Sprint ("摇车"), Coasting & Parking Physics
  const sprinting = input.keySprint || input.touchSprint;
  const braking = input.keyBrake;
  const jumpHeld = input.keyJumpHeld || input.touchJumpHeld;

  const prevSample = world.sampleTrack(ride.s);
  // Downhill (slopePitch > 0 in our convention) gently accelerates; uphill adds mild resistance
  const slopeAccel = Math.sin(prevSample.slopePitch) * 3.8;

  let targetBaseSpeed = 6.2; // Cruise ~22 km/h
  if (sprinting) {
    targetBaseSpeed = 11.2; // Sprint ~40 km/h
  } else if (braking) {
    targetBaseSpeed = 0.0;
    if (ride.speed < 0.35) ride.driveMode = 'park';
  } else if (ride.driveMode === 'coast') {
    targetBaseSpeed = 3.9;
  } else if (ride.driveMode === 'park') {
    targetBaseSpeed = 0.0;
  }

  ride.boostSpeed = Math.max(0, ride.boostSpeed - dt * 2.1);
  const accelRate = braking ? 5.2 : sprinting ? 4.4 : 2.6;
  ride.speed = clamp(
    damp(ride.speed, targetBaseSpeed + ride.boostSpeed, accelRate, dt) + slopeAccel * dt * (ride.speed > 0.2 ? 1 : 0),
    0,
    15.2
  );

  // Advance along coastal spline loop
  ride.s = (ride.s + ride.speed * dt) % world.trackLength;
  const sample = world.sampleTrack(ride.s);
  ride.u = sample.u;
  ride.leftDir.copy(sample.left);

  // Lateral carving across the cedar boardwalk with soft curb rubber-banding
  const steerAuthority = clamp(ride.speed / 4.2, 0.08, 1.18);
  const targetLatVel = rawSteer * 4.8 * steerAuthority;
  ride.lateralVel = damp(ride.lateralVel, targetLatVel, 10.5, dt);
  ride.lateral += ride.lateralVel * dt;

  const maxLane = world.roadHalfWidth - 0.36;
  if (Math.abs(ride.lateral) > maxLane) {
    ride.lateral = Math.sign(ride.lateral) * maxLane;
    ride.lateralVel *= -0.25;
  }

  // 3. Bunny-Hop & Mid-Air Wing-Glide Physics!
  if (ride.airborne) {
    // Holding Space / Hop button after cresting the jump peak unfurls the wings into smooth glide!
    if (jumpHeld && (ride.velY < 2.2 || ride.gliding)) {
      if (!ride.gliding) {
        ride.gliding = true;
        pelicanBike.triggerFlap(0.85);
      }
    } else if (!jumpHeld) {
      ride.gliding = false;
    }

    const gravity = ride.gliding ? 4.1 : 15.2;
    ride.velY -= gravity * dt;
    if (ride.gliding && ride.velY < -1.45) {
      ride.velY = damp(ride.velY, -1.45, 8, dt);
    }
    ride.jumpY += ride.velY * dt;

    if (ride.jumpY <= 0) {
      const impact = Math.abs(ride.velY);
      ride.jumpY = 0;
      ride.velY = 0;
      ride.airborne = false;
      ride.gliding = false;
      pelicanBike.triggerLandingImpact(impact);
      sound.playLand(impact);
      world.spawnBurst(ride.worldPos, 6, 0xf7ecd2, 2.2, 9.5);
    }
  }
  ui.hopLabel.textContent = ride.airborne && ride.gliding ? '滑翔' : '跃·翔';

  // Position & orient Pelican Bike root on boardwalk
  ride.worldPos
    .copy(sample.point)
    .addScaledVector(sample.left, ride.lateral);
  pelicanBike.root.position.copy(ride.worldPos);

  const trackYaw = Math.atan2(sample.forward.x, sample.forward.z);
  const carveYaw = Math.atan2(ride.lateralVel, Math.max(1.8, ride.speed)) * 0.65;
  const bikeHeading = trackYaw + carveYaw;
  pelicanBike.root.rotation.y = bikeHeading;

  if (ride.bellActiveTimer > 0) ride.bellActiveTimer = Math.max(0, ride.bellActiveTimer - dt);
  if (ride.deliveryCooldown > 0) ride.deliveryCooldown = Math.max(0, ride.deliveryCooldown - dt);

  // Compute exact mouth world position for fish catches & harbor throws
  pelicanBike.getMouthWorldPosition(ride.mouthPos);
  ride.mouthPos.y = Math.max(ride.mouthPos.y, ride.worldPos.y + ride.jumpY + 1.15);

  // 4. Update World, Fish, Seagulls, Tailwind Rings & Harbor Delivery!
  const totalCarrying = ride.pouchFish + ride.crateFish;
  const worldFeedback = world.update(
    dt,
    elapsed,
    {
      u: ride.u,
      worldPos: ride.worldPos,
      mouthPos: ride.mouthPos,
      leftDir: ride.leftDir,
      bellActive: ride.bellActiveTimer > 0,
      carryingFish: totalCarrying,
    },
    {
      onCatchFish(isGold) {
        const gain = isGold ? 2 : 1;
        for (let g = 0; g < gain; g++) {
          if (ride.pouchFish < MAX_POUCH_FISH) {
            ride.pouchFish++;
          } else if (ride.crateFish < MAX_CRATE_FISH) {
            ride.crateFish++;
          }
        }
        pelicanBike.triggerChomp(true);
        sound.playCatch(isGold);
        syncFishHUD();
        pulseFishPill();
        if (isGold) {
          showToast('捕获金鳞飞鱼！喉囊 +2', 1350);
        }
      },
      onWindBoost() {
        ride.boostSpeed = 3.8;
        if (ride.driveMode !== 'cruise') ride.driveMode = 'cruise';
        pelicanBike.triggerFlap(0.75);
        sound.playBoost();
        showToast('顺风气流加速！', 1150);
      },
      onHarborZone(launchFishFn) {
        if (ride.deliveryCooldown > 0) return;
        const count = ride.pouchFish + ride.crateFish;
        if (count <= 0) return;

        ride.deliveryCooldown = 2.8;
        const launchVisualCount = Math.min(6, count);
        for (let i = 0; i < launchVisualCount; i++) {
          setTimeout(() => {
            pelicanBike.getMouthWorldPosition(ride.mouthPos);
            pelicanBike.triggerChomp(false);
            launchFishFn(ride.mouthPos);
          }, i * 75);
        }
        ride.deliveredTotal += count;
        ride.pouchFish = 0;
        ride.crateFish = 0;
        writeSavedDelivered(ride.deliveredTotal);
        syncFishHUD();
        pulseFishPill();
        sound.playDelivery(count);
        showToast(`渔港投递 +${count} 尾鲜鱼！喉囊轻装出发`, 1850);
      },
    }
  );

  // 5. Update Pelican & Bicycle Rig (2-Bone IK Legs, Dual-Mode Wings, Elastic Pouch!)
  const isCoasting = braking || ride.driveMode === 'coast' || ride.driveMode === 'park';
  pelicanBike.update(dt, {
    speed: ride.speed,
    steer: rawSteer,
    sprinting,
    coasting: isCoasting,
    airborne: ride.airborne,
    gliding: ride.gliding,
    jumpHeight: ride.jumpY,
    velY: ride.velY,
    slopePitch: sample.slopePitch,
    pouchFish: ride.pouchFish,
    crateFish: ride.crateFish,
    lookOffsetYaw: worldFeedback.lookOffsetYaw,
    nightFactor: worldFeedback.nightFactor,
    reducedMotion,
  });

  // 6. Update Procedural Audio
  sound.update(dt, {
    speed: ride.speed,
    coasting: isCoasting,
    airborne: ride.airborne,
    gliding: ride.gliding,
  });

  // 7. Update HUD Speed & Mode Indicator
  const kmh = Math.round(ride.speed * 3.6);
  ui.speedNum.textContent = String(kmh);
  if (sprinting && ride.speed > 2) {
    ui.modeLabel.textContent = '摇车';
    ui.speedDot.dataset.mode = 'sprint';
  } else if (ride.speed < 0.25 && isCoasting) {
    ui.modeLabel.textContent = '驻车';
    ui.speedDot.dataset.mode = 'park';
  } else if (isCoasting) {
    ui.modeLabel.textContent = '滑行';
    ui.speedDot.dataset.mode = 'coast';
  } else {
    ui.modeLabel.textContent = '巡航';
    ui.speedDot.dataset.mode = 'cruise';
  }

  // 8. Portrait-Adaptive Spring Camera Update (with Orbit Inertial Decay!)
  if (activeCanvasPointers.size === 0) {
    camState.userYaw += camState.yawVel * dt;
    camState.userPitch = clamp(camState.userPitch + camState.pitchVel * dt, -0.26, 0.58);
    const friction = Math.exp(-5.5 * dt);
    camState.yawVel *= friction;
    camState.pitchVel *= friction;
  }

  const preset = CAMERA_PRESETS[camState.presetIndex];
  const aspect = camera.aspect;
  // Pull camera slightly back on narrow 320–430px portrait screens so bike + surroundings never clip!
  const portraitDistBoost = aspect < 1 ? clamp(1 / Math.pow(aspect, 0.34), 1.0, 1.38) : 1.0;
  const speedPullback = clamp((ride.speed - 6.2) * 0.08, -0.15, 0.55) * (reducedMotion ? 0.2 : 1.0);
  const desiredDist = (preset.dist * portraitDistBoost + speedPullback) * camState.zoomScale;

  const desiredAzimuth = bikeHeading + preset.relYaw + camState.userYaw;
  const desiredPitch = clamp(preset.pitch + camState.userPitch, 0.05, 1.15);

  if (!camState.initialized) {
    camState.smoothAzimuth = desiredAzimuth;
    camState.smoothPitch = desiredPitch;
    camState.smoothDist = desiredDist;
    camState.lookPos.copy(ride.worldPos).y += preset.targetY;
    camState.initialized = true;
  } else {
    //Shortest angular delta for silky wrap-around azimuth damping
    let azDiff = desiredAzimuth - camState.smoothAzimuth;
    while (azDiff > Math.PI) azDiff -= Math.PI * 2;
    while (azDiff < -Math.PI) azDiff += Math.PI * 2;
    camState.smoothAzimuth += azDiff * (1 - Math.exp(-9.5 * dt));
    camState.smoothPitch = damp(camState.smoothPitch, desiredPitch, 9.5, dt);
    camState.smoothDist = damp(camState.smoothDist, desiredDist, 8.5, dt);
  }

  const horizDist = Math.cos(camState.smoothPitch) * camState.smoothDist;
  const vertDist = Math.sin(camState.smoothPitch) * camState.smoothDist;

  // Frame target slightly higher on portrait so Pelican sits cleanly above the bottom thumb dock!
  const portraitTargetShiftY = aspect < 1 ? -0.12 : 0.0;
  _targetPoint.set(
    ride.worldPos.x + sample.forward.x * 0.38,
    ride.worldPos.y + ride.jumpY * 0.55 + preset.targetY + portraitTargetShiftY,
    ride.worldPos.z + sample.forward.z * 0.38
  );
  camState.lookPos.lerp(_targetPoint, 1 - Math.exp(-14 * dt));

  _camOffset.set(
    -Math.sin(camState.smoothAzimuth) * horizDist,
    vertDist,
    -Math.cos(camState.smoothAzimuth) * horizDist
  );
  camera.position.copy(camState.lookPos).add(_camOffset);
  // Prevent camera from dipping below ocean surface
  camera.position.y = Math.max(0.55, camera.position.y);
  camera.lookAt(camState.lookPos);

  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
