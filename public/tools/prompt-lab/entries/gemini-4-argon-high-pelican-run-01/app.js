// Main 3D Simulation, Biomechanical IK Animation, Touch/Keyboard Controller & HUD
import * as THREE from './vendor/three.module.min.js';
import { SoundEngine } from './audio.js';
import { buildPelicanBikeRig, solveTwoBoneIK, createFishMesh } from './models.js';
import {
  buildCoastalWorld,
  sampleTrack,
  LIGHTING_PRESETS,
  TRACK_HALF_WIDTH,
  TRACK_PERIMETER
} from './world.js';

const STORAGE_STATS_KEY = 'gemini-4-argon-high-pelican-run-01:stats';
const isQA = new URLSearchParams(window.location.search).has('qa');

// Cruise gear presets
const CRUISE_GEARS = [
  { id: 'cruise', label: '巡航', baseSpeed: 6.2 },
  { id: 'fast', label: '疾驰', baseSpeed: 9.8 },
  { id: 'slow', label: '慢骑', baseSpeed: 3.2 },
  { id: 'stand', label: '驻车', baseSpeed: 0.0 }
];

// Camera view presets
const CAMERA_MODES = [
  { id: 'chase', label: '跟拍', yaw: 0.25, pitch: 0.30, dist: 5.2 },
  { id: 'side', label: '侧视', yaw: 1.48, pitch: 0.16, dist: 4.1 },
  { id: 'front', label: '车头', yaw: 2.75, pitch: 0.18, dist: 4.0 },
  { id: 'orbit', label: '环视', yaw: 0.85, pitch: 0.38, dist: 5.8 }
];

const stageEl = document.getElementById('stage');
const speedValEl = document.getElementById('hud-speed');
const pouchValEl = document.getElementById('hud-pouch');
const deliveredValEl = document.getElementById('hud-delivered');
const toastEl = document.getElementById('hud-toast');

const btnLight = document.getElementById('btn-light');
const btnCam = document.getElementById('btn-cam');
const btnGear = document.getElementById('btn-gear');
const btnSound = document.getElementById('btn-sound');
const btnHelp = document.getElementById('btn-help');
const btnCloseHelp = document.getElementById('btn-close-help');
const helpModal = document.getElementById('help-modal');

const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const steerPad = document.getElementById('steer-pad');
const btnSprint = document.getElementById('btn-sprint');
const btnBrake = document.getElementById('btn-brake');
const btnHop = document.getElementById('btn-hop');
const btnBeak = document.getElementById('btn-beak');
const btnBell = document.getElementById('btn-bell');

const sound = new SoundEngine();

// Load persisted delivered count
let deliveredTotal = 0;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_STATS_KEY) || '{}');
  if (Number.isFinite(saved.delivered)) deliveredTotal = saved.delivered;
} catch {
  deliveredTotal = 0;
}
deliveredValEl.textContent = String(deliveredTotal);

// Three.js Scene & Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(LIGHTING_PRESETS[0].skyHorizon);
scene.fog = new THREE.FogExp2(LIGHTING_PRESETS[0].fogColor, 0.0085);

const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.1,
  220
);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xfde68a, 1.15);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.35);
sunLight.position.set(34, 48, 24);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 120;
const dCam = 34;
sunLight.shadow.camera.left = -dCam;
sunLight.shadow.camera.right = dCam;
sunLight.shadow.camera.top = dCam;
sunLight.shadow.camera.bottom = -dCam;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Build World & Pelican-Bike Rig
const world = buildCoastalWorld(scene);
const rig = buildPelicanBikeRig();
scene.add(rig.root);

// Flying fish projectiles for pier delivery & celebratory splash particles
const flyingDeliveries = [];
const particlePool = [];
const particleGeom = new THREE.SphereGeometry(0.065, 8, 8);
const particleMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
for (let i = 0; i < 28; i++) {
  const p = new THREE.Mesh(particleGeom, particleMat.clone());
  p.visible = false;
  scene.add(p);
  particlePool.push({
    mesh: p,
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1
  });
}

function spawnParticles(origin, colorHex = 0xfef08a, count = 10) {
  let spawned = 0;
  for (const item of particlePool) {
    if (item.life <= 0 && spawned < count) {
      item.life = 0.55 + Math.random() * 0.35;
      item.maxLife = item.life;
      item.mesh.material.color.setHex(colorHex);
      item.mesh.position.copy(origin);
      item.mesh.scale.setScalar(1);
      item.mesh.visible = true;
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.8;
      item.vel.set(Math.cos(angle) * spd, 2.2 + Math.random() * 2.6, Math.sin(angle) * spd);
      spawned++;
    }
  }
}

// Toast Notification Helper
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, 1900);
}

// Simulation State
const state = {
  trackTheta: -0.45,
  laneOffset: 0.0,
  lateralVel: 0.0,
  speed: CRUISE_GEARS[0].baseSpeed,
  crankAngle: 0.5,
  wheelAngle: 0.0,
  steerInput: 0.0,
  steerAngle: 0.0,
  leanAngle: 0.0,

  // Actions
  sprintHeld: false,
  brakeHeld: false,
  boostTimer: 0.0,

  // Jump / Bunny Hop
  jumpY: 0.0,
  jumpVelY: 0.0,
  isGrounded: true,
  flapPhase: 0.0,

  // Beak & Gular Pouch
  beakOpenTarget: 0.0,
  beakOpen: 0.0,
  beakTimer: 0.0,
  pouchFishCount: 1, // Start with 1 fish in pouch so users immediately see the plump throat pouch
  pouchScale: 1.0,
  pouchScaleVel: 0.0,

  // Bell
  bellWaveTimer: 0.0,

  // Blinking
  blinkTimer: 2.2,
  blinkProgress: 0.0,

  // Modes
  lightIdx: 0,
  camIdx: 0,
  gearIdx: 0,

  // Orbit Camera Offsets
  camYawOffset: 0.0,
  camPitchOffset: 0.0,
  camDistScale: 1.0,
  isDraggingCam: false
};

const camCurrentPos = new THREE.Vector3();
const camCurrentLook = new THREE.Vector3();
let camInitialized = false;

function syncPouchVisuals() {
  pouchValEl.textContent = `${state.pouchFishCount} / 5`;
  for (let i = 0; i < rig.pouchFishMeshes.length; i++) {
    rig.pouchFishMeshes[i].visible = i < state.pouchFishCount;
  }
  for (let i = 0; i < rig.basketFishNodes.length; i++) {
    rig.basketFishNodes[i].visible = i < Math.max(1, state.pouchFishCount);
  }
}
syncPouchVisuals();

// Apply Lighting Preset
function applyLightingPreset(index) {
  state.lightIdx = (index + LIGHTING_PRESETS.length) % LIGHTING_PRESETS.length;
  const p = LIGHTING_PRESETS[state.lightIdx];

  scene.background.setHex(p.skyHorizon);
  scene.fog.color.setHex(p.fogColor);
  world.waterMat.color.setHex(p.waterColor);
  sunLight.color.setHex(p.sunColor);
  sunLight.intensity = p.sunIntensity;
  sunLight.position.set(...p.sunPos);
  hemiLight.color.setHex(p.hemiSky);
  hemiLight.groundColor.setHex(p.hemiGround);
  hemiLight.intensity = p.hemiIntensity;

  world.lanternBulbMat.emissiveIntensity = p.lanternEmissive;
  world.beaconMat.opacity = p.beamOpacity;
  world.starMat.opacity = p.starsOpacity;
  rig.headlightCone.material.opacity = p.beamOpacity * 0.85;
  rig.materials.lampGlass.emissiveIntensity = p.beamOpacity > 0 ? 2.4 : 0.6;

  btnLight.querySelector('.pill-val').textContent = p.shortLabel;
}
applyLightingPreset(0);

// Cycle Camera Mode
function setCameraMode(index, announce = true) {
  state.camIdx = (index + CAMERA_MODES.length) % CAMERA_MODES.length;
  state.camYawOffset = 0;
  state.camPitchOffset = 0;
  state.camDistScale = 1.0;
  const mode = CAMERA_MODES[state.camIdx];
  btnCam.querySelector('.pill-val').textContent = mode.label;
  if (announce) showToast(`视角：${mode.label}`);
}

// Cycle Cruise Gear
function cycleCruiseGear() {
  state.gearIdx = (state.gearIdx + 1) % CRUISE_GEARS.length;
  const gear = CRUISE_GEARS[state.gearIdx];
  btnGear.querySelector('.pill-val').textContent = gear.label;
  showToast(`巡航挡位：${gear.label}`);
}

// Trigger Bunny Hop & Wing Flap
function triggerBunnyHop(jumpStrength = 5.4) {
  if (!state.isGrounded && state.jumpY > 0.25) return;
  state.isGrounded = false;
  state.jumpVelY = jumpStrength;
  state.flapPhase = 1.0;
  state.pouchScaleVel -= 3.5;
  sound.playJump();
  spawnParticles(rig.root.position, 0xfef08a, 8);
}

// Trigger Beak Snap & Pouch Catch / Toss
function triggerBeakAction() {
  state.beakTimer = 0.55;
  state.beakOpenTarget = 0.72;
  state.pouchScaleVel += 5.5;

  // Check if any leaping fish is within generous scoop range
  let caughtAny = false;
  for (const fish of world.leapingFish) {
    if (fish.caughtCooldown <= 0) {
      const dist = fish.worldPos.distanceTo(rig.root.position);
      if (dist < 4.2 && state.pouchFishCount < 5) {
        fish.caughtCooldown = 4.0;
        state.pouchFishCount = Math.min(5, state.pouchFishCount + 1);
        caughtAny = true;
        spawnParticles(fish.worldPos, 0x38bdf8, 12);
      }
    }
  }

  // If near the Harbor Pier and carrying fish, deliver them!
  world.pierBasketGroup.getWorldPosition(world.pierBasketPosWorld);
  const distToPier = rig.root.position.distanceTo(world.pierBasketPosWorld);
  if (distToPier < 9.5 && state.pouchFishCount > 0) {
    deliverPouchFishToPier();
    return;
  }

  syncPouchVisuals();
  sound.playBeakSnap(caughtAny);
  if (caughtAny) {
    showToast(`喉囊捕鱼 +1（当前 ${state.pouchFishCount}/5）`);
  }
}

// Launch fish from throat pouch into the Harbor Pier basket
function deliverPouchFishToPier() {
  const count = state.pouchFishCount;
  if (count <= 0) return;

  state.pouchFishCount = 0;
  state.beakTimer = 0.65;
  state.beakOpenTarget = 0.82;
  state.pouchScaleVel -= 6.5;
  syncPouchVisuals();

  const startWorld = new THREE.Vector3();
  rig.pouchPivot.getWorldPosition(startWorld);
  world.pierBasketGroup.getWorldPosition(world.pierBasketPosWorld);

  for (let i = 0; i < count; i++) {
    const mesh = createFishMesh(1.15);
    scene.add(mesh);
    flyingDeliveries.push({
      mesh,
      start: startWorld.clone(),
      end: world.pierBasketPosWorld.clone().add(new THREE.Vector3(0, 0.4, 0)),
      progress: -i * 0.14,
      arcHeight: 2.4 + i * 0.35
    });
  }

  deliveredTotal += count;
  deliveredValEl.textContent = String(deliveredTotal);
  try {
    localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify({ delivered: deliveredTotal }));
  } catch {
    // ignore storage errors
  }

  sound.playDelivery(count);
  spawnParticles(world.pierBasketPosWorld, 0xfde047, 16);
  showToast(`鲜鱼送达灯塔栈桥 +${count} ★`);
}

// Trigger Brass Bicycle Bell
function triggerBell() {
  state.bellWaveTimer = 1.0;
  state.blinkProgress = 1.0;
  sound.playBell();

  // Startle nearby fish into a higher leap
  for (const f of world.leapingFish) {
    f.phase += 0.45;
  }
}

// ============================================================================
// INPUT HANDLING: TOUCH, POINTER STEERING, ORBIT DRAG & KEYBOARD SHORTCUTS
// ============================================================================
const activeKeys = new Set();

function updateSteerFromKeys() {
  const left = activeKeys.has('KeyA') || activeKeys.has('ArrowLeft');
  const right = activeKeys.has('KeyD') || activeKeys.has('ArrowRight');
  state.steerInput = (left ? 1 : 0) + (right ? -1 : 0);
  btnLeft.classList.toggle('is-active', left);
  btnRight.classList.toggle('is-active', right);
}

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) {
      btnHop.classList.add('is-active');
      triggerBunnyHop();
    }
    return;
  }

  if (e.key === '?' || e.code === 'KeyH' || e.code === 'Slash') {
    e.preventDefault();
    toggleHelpModal();
    return;
  }

  if (e.code === 'Escape' && !helpModal.hidden) {
    toggleHelpModal(false);
    return;
  }

  activeKeys.add(e.code);
  updateSteerFromKeys();

  if (e.code === 'KeyW' || e.code === 'ArrowUp') {
    e.preventDefault();
    state.sprintHeld = true;
    btnSprint.classList.add('is-active');
  } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
    e.preventDefault();
    state.brakeHeld = true;
    btnBrake.classList.add('is-active');
  } else if ((e.code === 'KeyE' || e.code === 'KeyF') && !e.repeat) {
    btnBeak.classList.add('is-active');
    triggerBeakAction();
  } else if (e.code === 'KeyB' && !e.repeat) {
    btnBell.classList.add('is-active');
    triggerBell();
  } else if (e.code === 'KeyC' && !e.repeat) {
    cycleCruiseGear();
  } else if (e.code === 'KeyV' && !e.repeat) {
    setCameraMode(state.camIdx + 1);
  } else if ((e.code === 'KeyL' || e.code === 'KeyT') && !e.repeat) {
    applyLightingPreset(state.lightIdx + 1);
    showToast(`天色：${LIGHTING_PRESETS[state.lightIdx].label}`);
  } else if (e.code === 'KeyM' && !e.repeat) {
    const muted = sound.toggleMute();
    btnSound.querySelector('.pill-val').textContent = muted ? '静音' : '开启';
    showToast(muted ? '音效已静音' : '音效已开启');
  } else if (e.code === 'KeyR' && !e.repeat) {
    state.camYawOffset = 0;
    state.camPitchOffset = 0;
    state.camDistScale = 1.0;
    showToast('镜头已复位');
  }
});

window.addEventListener('keyup', (e) => {
  activeKeys.delete(e.code);
  updateSteerFromKeys();

  if (e.code === 'KeyW' || e.code === 'ArrowUp') {
    state.sprintHeld = false;
    btnSprint.classList.remove('is-active');
  } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
    state.brakeHeld = false;
    btnBrake.classList.remove('is-active');
  } else if (e.code === 'Space') {
    btnHop.classList.remove('is-active');
  } else if (e.code === 'KeyE' || e.code === 'KeyF') {
    btnBeak.classList.remove('is-active');
  } else if (e.code === 'KeyB') {
    btnBell.classList.remove('is-active');
  }
});

// Touch / Pointer Hold helper
function bindHoldButton(btn, onDown, onUp) {
  const start = (e) => {
    e.preventDefault();
    btn.classList.add('is-active');
    onDown();
  };
  const end = (e) => {
    e.preventDefault();
    btn.classList.remove('is-active');
    if (onUp) onUp();
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('pointerleave', (e) => {
    if (btn.classList.contains('is-active')) end(e);
  });
}

// Continuous thumb-slide steering on `#steer-pad` (plus individual Left/Right buttons)
let steerPointerId = null;
function updateSteerFromPad(clientX) {
  const rect = steerPad.getBoundingClientRect();
  const center = rect.left + rect.width * 0.5;
  const norm = THREE.MathUtils.clamp((clientX - center) / (rect.width * 0.36), -1, 1);
  // Left side of pad -> steer left (+1), Right side of pad -> steer right (-1)
  state.steerInput = Math.abs(norm) < 0.12 ? 0 : -norm;
  btnLeft.classList.toggle('is-active', state.steerInput > 0.15);
  btnRight.classList.toggle('is-active', state.steerInput < -0.15);
}

steerPad.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  steerPointerId = e.pointerId;
  steerPad.setPointerCapture(e.pointerId);
  updateSteerFromPad(e.clientX);
});

steerPad.addEventListener('pointermove', (e) => {
  if (e.pointerId !== steerPointerId) return;
  updateSteerFromPad(e.clientX);
});

const releaseSteerPad = (e) => {
  if (e.pointerId !== steerPointerId) return;
  steerPointerId = null;
  state.steerInput = 0;
  btnLeft.classList.remove('is-active');
  btnRight.classList.remove('is-active');
};
steerPad.addEventListener('pointerup', releaseSteerPad);
steerPad.addEventListener('pointercancel', releaseSteerPad);

bindHoldButton(
  btnSprint,
  () => {
    state.sprintHeld = true;
    sound.ensureContext();
  },
  () => {
    state.sprintHeld = false;
  }
);

bindHoldButton(
  btnBrake,
  () => {
    state.brakeHeld = true;
  },
  () => {
    state.brakeHeld = false;
  }
);

bindHoldButton(btnHop, () => triggerBunnyHop());
bindHoldButton(btnBeak, () => triggerBeakAction());
bindHoldButton(btnBell, () => triggerBell());

// Top Bar Pill Buttons
btnLight.addEventListener('click', () => {
  applyLightingPreset(state.lightIdx + 1);
  showToast(`天色：${LIGHTING_PRESETS[state.lightIdx].label}`);
});

btnCam.addEventListener('click', () => {
  setCameraMode(state.camIdx + 1);
});

btnGear.addEventListener('click', () => {
  cycleCruiseGear();
});

btnSound.querySelector('.pill-val').textContent = sound.muted ? '静音' : '开启';
btnSound.addEventListener('click', () => {
  const muted = sound.toggleMute();
  btnSound.querySelector('.pill-val').textContent = muted ? '静音' : '开启';
  showToast(muted ? '音效已静音' : '音效已开启');
});

function toggleHelpModal(force) {
  const nextOpen = typeof force === 'boolean' ? force : helpModal.hidden;
  helpModal.hidden = !nextOpen;
  btnHelp.setAttribute('aria-expanded', String(nextOpen));
}

btnHelp.addEventListener('click', () => toggleHelpModal());
btnCloseHelp.addEventListener('click', () => toggleHelpModal(false));
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) toggleHelpModal(false);
});

// 3D Viewport Touch / Drag Camera Orbit & Pinch Zoom + Double-Tap Interaction
const activePointers = new Map();
let prevPinchDist = 0;
let lastStageTapTime = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
  sound.ensureContext();
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  state.isDraggingCam = true;

  const now = performance.now();
  if (activePointers.size === 1 && now - lastStageTapTime < 280) {
    triggerBell();
    triggerBunnyHop(4.6);
  }
  lastStageTapTime = now;
});

window.addEventListener('pointermove', (e) => {
  if (!activePointers.has(e.pointerId)) return;
  const prev = activePointers.get(e.pointerId);
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  prev.x = e.clientX;
  prev.y = e.clientY;

  if (activePointers.size === 1) {
    state.camYawOffset -= dx * 0.0075;
    state.camPitchOffset = THREE.MathUtils.clamp(
      state.camPitchOffset + dy * 0.0055,
      -0.22,
      0.65
    );
  } else if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (prevPinchDist > 0) {
      const delta = (prevPinchDist - dist) * 0.004;
      state.camDistScale = THREE.MathUtils.clamp(state.camDistScale + delta, 0.58, 1.65);
    }
    prevPinchDist = dist;
  }
});

const endStagePointer = (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) prevPinchDist = 0;
  if (activePointers.size === 0) state.isDraggingCam = false;
};
window.addEventListener('pointerup', endStagePointer);
window.addEventListener('pointercancel', endStagePointer);

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    state.camDistScale = THREE.MathUtils.clamp(
      state.camDistScale + e.deltaY * 0.001,
      0.58,
      1.65
    );
  },
  { passive: false }
);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ============================================================================
// MAIN ANIMATION & BIOMECHANICAL IK UPDATE LOOP
// ============================================================================
const _footTargetL = new THREE.Vector3();
const _footTargetR = new THREE.Vector3();
const _kneePoleL = new THREE.Vector3();
const _kneePoleR = new THREE.Vector3();
const _gripTargetL = new THREE.Vector3();
const _gripTargetR = new THREE.Vector3();
const _elbowPoleL = new THREE.Vector3();
const _elbowPoleR = new THREE.Vector3();
const _flapTargetL = new THREE.Vector3();
const _flapTargetR = new THREE.Vector3();

let lastTime = performance.now();

function updateSimulation(dt, elapsed) {
  // 1. Speed, Boost & Cruise Gear Dynamics
  const gear = CRUISE_GEARS[state.gearIdx];
  if (state.boostTimer > 0) {
    state.boostTimer = Math.max(0, state.boostTimer - dt);
  }

  let targetSpeed = gear.baseSpeed;
  if (state.sprintHeld) {
    targetSpeed = Math.max(targetSpeed + 5.6, 12.2);
  }
  if (state.boostTimer > 0) {
    targetSpeed += 4.2;
  }
  if (state.brakeHeld) {
    targetSpeed = 0.0;
  }

  state.speed = THREE.MathUtils.lerp(state.speed, targetSpeed, 1 - Math.exp(-dt * 4.5));
  const kmh = Math.round(state.speed * 2.8);
  speedValEl.textContent = String(kmh);

  // 2. Steering & Lateral Boardwalk Lane Motion
  const steerTarget = state.steerInput * 0.46;
  state.steerAngle = THREE.MathUtils.lerp(state.steerAngle, steerTarget, 1 - Math.exp(-dt * 10));

  const forwardFactor = THREE.MathUtils.clamp(state.speed / 5.5, 0.2, 1.6);
  state.laneOffset -= state.steerAngle * forwardFactor * 4.2 * dt;
  state.laneOffset = THREE.MathUtils.clamp(state.laneOffset, -TRACK_HALF_WIDTH + 0.42, TRACK_HALF_WIDTH - 0.42);

  // Advance along the closed coastal loop (unless in stationary 'stand' mode without sprinting)
  const angularSpeed = (state.speed / TRACK_PERIMETER) * Math.PI * 2;
  state.trackTheta = (state.trackTheta + angularSpeed * dt) % (Math.PI * 2);

  const trackSample = sampleTrack(state.trackTheta, state.laneOffset);

  // 3. Jump / Bunny Hop Physics
  if (!state.isGrounded || state.jumpVelY > 0) {
    state.jumpY += state.jumpVelY * dt;
    state.jumpVelY -= 15.5 * dt; // Gravity
    if (state.jumpY <= 0) {
      state.jumpY = 0;
      state.jumpVelY = 0;
      state.isGrounded = true;
      state.pouchScaleVel -= 3.2; // Landing jiggle
    }
  }
  if (state.flapPhase > 0) {
    state.flapPhase = Math.max(0, state.flapPhase - dt * 2.4);
  }

  // Place Bike Root on Boardwalk
  rig.root.position.copy(trackSample.position);
  rig.root.position.y += state.jumpY;
  rig.root.rotation.set(0, trackSample.heading - state.steerAngle * 0.25, 0);

  // Dynamic Banking Lean + Slope Pitch + Bunny Hop Pitch
  const targetLean = state.steerAngle * THREE.MathUtils.clamp(state.speed / 6.5, 0.25, 1.35) * 0.58;
  state.leanAngle = THREE.MathUtils.lerp(state.leanAngle, targetLean, 1 - Math.exp(-dt * 8));
  const hopPitch = state.isGrounded ? 0 : THREE.MathUtils.clamp(state.jumpVelY * 0.045, -0.22, 0.26);

  rig.bikeChasis.rotation.z = state.leanAngle;
  rig.bikeChasis.rotation.x = -trackSample.slope - hopPitch;

  // 4. Wheel Spin, Crank Cadence & Counter-Rotating Level Pedals
  // Even in stationary 'stand' gear, keep a gentle showcase cadence if user presses sprint, or slow idle spin
  const effectiveWheelSpeed =
    gear.id === 'stand' && !state.sprintHeld && !state.brakeHeld ? 2.4 : state.speed;

  const wheelDelta = (effectiveWheelSpeed * dt) / rig.wheelRadius;
  state.wheelAngle += wheelDelta;
  rig.rearWheel.rotation.x = state.wheelAngle;
  rig.frontWheel.rotation.x = state.wheelAngle;

  const crankDelta = wheelDelta * 0.48;
  const prevCrankStep = Math.floor(state.crankAngle / (Math.PI * 0.5));
  state.crankAngle += crankDelta;
  const nextCrankStep = Math.floor(state.crankAngle / (Math.PI * 0.5));
  if (nextCrankStep !== prevCrankStep && effectiveWheelSpeed > 1.0) {
    sound.playHubTick();
  }

  rig.crankGroup.rotation.x = state.crankAngle;
  rig.leftPedalPivot.rotation.x = -state.crankAngle;
  rig.rightPedalPivot.rotation.x = -state.crankAngle;

  // Front fork & handlebar steering
  rig.steeringPivot.rotation.y = state.steerAngle;

  // Whip flag & Cap propeller spin
  rig.flagPolePivot.rotation.x = -0.08 - Math.min(0.32, state.speed * 0.024);
  rig.flagPolePivot.rotation.z = Math.sin(elapsed * 8.5) * (0.04 + state.speed * 0.008);
  rig.pennantMesh.rotation.y = Math.PI * 0.5 + Math.sin(elapsed * 14.0) * 0.26;
  rig.capPropeller.rotation.y += dt * (3.5 + state.speed * 1.6);

  // Brass Bell Wave animation
  if (state.bellWaveTimer > 0) {
    state.bellWaveTimer = Math.max(0, state.bellWaveTimer - dt * 2.2);
    const prog = 1 - state.bellWaveTimer;
    rig.bellRingWave.scale.setScalar(1 + prog * 3.8);
    rig.bellRingWave.material.opacity = state.bellWaveTimer * 0.85;
    rig.bellGroup.rotation.z = Math.sin(prog * Math.PI * 8) * 0.18 * state.bellWaveTimer;
  } else {
    rig.bellRingWave.material.opacity = 0;
    rig.bellGroup.rotation.z = 0;
  }

  // 5. Pelican Torso, S-Neck, Beak & Elastic Gular Pouch Physics
  const cadenceSin = Math.sin(state.crankAngle);
  const cadenceCos = Math.cos(state.crankAngle);

  // Subtle hip rock & bounce with pedaling cadence
  rig.pelicanRoot.position.y = 1.46 + Math.abs(cadenceSin) * 0.032;
  rig.torsoGroup.rotation.z = -cadenceCos * 0.065 + state.steerAngle * 0.12;
  rig.torsoGroup.rotation.y = cadenceCos * 0.045;
  const aeroLean = state.sprintHeld || state.boostTimer > 0 ? 0.18 : 0.0;
  rig.torsoGroup.rotation.x = aeroLean + Math.sin(state.crankAngle * 2) * 0.025;

  // Tail feather flutter
  rig.tailPivot.rotation.x = Math.sin(elapsed * 12 + state.crankAngle * 2) * (0.06 + state.speed * 0.008);

  // S-Curved Neck secondary spring motion
  rig.neckBase.rotation.x = -aeroLean * 0.5 + Math.sin(state.crankAngle * 2 - 0.6) * 0.055;
  rig.neckBase.rotation.z = -state.steerAngle * 0.18;
  rig.neckMid.rotation.x = Math.cos(state.crankAngle * 2) * 0.045 - hopPitch * 0.4;

  // Head gaze toward steering + nearest fish
  rig.headGroup.rotation.y = THREE.MathUtils.lerp(
    rig.headGroup.rotation.y,
    state.steerAngle * 0.65,
    1 - Math.exp(-dt * 8)
  );
  rig.headGroup.rotation.z = -state.steerAngle * 0.15;

  // Periodic natural eye blink
  state.blinkTimer -= dt;
  if (state.blinkTimer <= 0) {
    state.blinkTimer = 2.4 + Math.random() * 2.8;
    state.blinkProgress = 1.0;
  }
  if (state.blinkProgress > 0) {
    state.blinkProgress = Math.max(0, state.blinkProgress - dt * 7.5);
    const closeAmt = Math.sin(state.blinkProgress * Math.PI);
    for (const lid of rig.eyelids) {
      lid.rotation.x = -Math.PI * 0.42 + closeAmt * 0.42;
    }
  }

  // Beak opening & Elastic Throat Pouch spring-damper physics
  if (state.beakTimer > 0) {
    state.beakTimer = Math.max(0, state.beakTimer - dt);
    if (state.beakTimer <= 0) state.beakOpenTarget = 0.0;
  }
  state.beakOpen = THREE.MathUtils.lerp(state.beakOpen, state.beakOpenTarget, 1 - Math.exp(-dt * 14));
  rig.upperBeakGroup.rotation.x = -state.beakOpen * 0.45;
  rig.lowerJawGroup.rotation.x = state.beakOpen * 0.52;

  // Spring physics for the inflatable gular throat pouch
  const targetPouchScale = 0.82 + state.pouchFishCount * 0.18 + state.beakOpen * 0.25;
  const springForce = (targetPouchScale - state.pouchScale) * 140.0;
  state.pouchScaleVel += springForce * dt;
  state.pouchScaleVel *= Math.exp(-dt * 6.5);
  state.pouchScale += state.pouchScaleVel * dt;

  const jiggleWave = Math.sin(elapsed * 9.0 + state.crankAngle * 2) * (0.025 + state.pouchFishCount * 0.012);
  const sy = Math.max(0.55, state.pouchScale + jiggleWave);
  const sx = Math.max(0.75, 0.92 + state.pouchFishCount * 0.11 - jiggleWave * 0.4);
  rig.pouchPivot.scale.set(sx, sy, 1.0 + state.pouchFishCount * 0.04);

  // Wriggle caught fish tails inside the pouch
  for (let i = 0; i < state.pouchFishCount; i++) {
    const pf = rig.pouchFishMeshes[i];
    if (pf) {
      pf.rotation.z = Math.sin(elapsed * 14 + i * 1.7) * 0.22;
    }
  }

  // 6. Solve Analytic Two-Bone IK for Both Legs (Webbed Feet Locked to Pedals!)
  rig.root.updateWorldMatrix(true, true);
  rig.leftFootAnchor.getWorldPosition(_footTargetL);
  rig.rightFootAnchor.getWorldPosition(_footTargetR);

  // Knee pole targets in front of the pelican's hips so knees always bend forward
  _kneePoleL.set(0.28, 1.25, 0.95).applyMatrix4(rig.bikeChasis.matrixWorld);
  _kneePoleR.set(-0.28, 1.25, 0.95).applyMatrix4(rig.bikeChasis.matrixWorld);

  solveTwoBoneIK(rig.leftLeg.hip, rig.leftLeg.knee, rig.legL1, rig.legL2, _footTargetL, _kneePoleL);
  solveTwoBoneIK(rig.rightLeg.hip, rig.rightLeg.knee, rig.legL1, rig.legL2, _footTargetR, _kneePoleR);

  // Keep webbed feet level with pedals in world space + subtle ankle cadence rock
  rig.leftLeg.knee.updateWorldMatrix(true, false);
  rig.rightLeg.knee.updateWorldMatrix(true, false);
  const bikeWorldQ = new THREE.Quaternion();
  rig.bikeChasis.getWorldQuaternion(bikeWorldQ);

  const kneeWorldQL = new THREE.Quaternion();
  rig.leftLeg.knee.getWorldQuaternion(kneeWorldQL).invert();
  const ankleRockL = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(Math.sin(state.crankAngle) * 0.14, 0, 0)
  );
  rig.leftLeg.ankle.quaternion.copy(kneeWorldQL).multiply(bikeWorldQ).multiply(ankleRockL);

  const kneeWorldQR = new THREE.Quaternion();
  rig.rightLeg.knee.getWorldQuaternion(kneeWorldQR).invert();
  const ankleRockR = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.sin(state.crankAngle) * 0.14, 0, 0)
  );
  rig.rightLeg.ankle.quaternion.copy(kneeWorldQR).multiply(bikeWorldQ).multiply(ankleRockR);

  // 7. Solve Analytic Two-Bone IK for Both Wing Arms (Gripping Handlebars + Flap on Jump!)
  rig.leftGripAnchor.getWorldPosition(_gripTargetL);
  rig.rightGripAnchor.getWorldPosition(_gripTargetR);

  if (state.flapPhase > 0.01) {
    const flapLift = Math.sin(state.flapPhase * Math.PI * 2) * 0.42;
    const flapSpread = Math.sin(state.flapPhase * Math.PI) * 0.45;
    _flapTargetL.set(0.44 + flapSpread, 1.65 + flapLift, 0.05).applyMatrix4(rig.bikeChasis.matrixWorld);
    _flapTargetR.set(-0.44 - flapSpread, 1.65 + flapLift, 0.05).applyMatrix4(rig.bikeChasis.matrixWorld);
    _gripTargetL.lerp(_flapTargetL, Math.min(1, state.flapPhase * 1.4));
    _gripTargetR.lerp(_flapTargetR, Math.min(1, state.flapPhase * 1.4));
  }

  _elbowPoleL.set(0.68, 1.42, -0.35).applyMatrix4(rig.bikeChasis.matrixWorld);
  _elbowPoleR.set(-0.68, 1.42, -0.35).applyMatrix4(rig.bikeChasis.matrixWorld);

  solveTwoBoneIK(rig.leftWing.shoulder, rig.leftWing.elbow, rig.wingL1, rig.wingL2, _gripTargetL, _elbowPoleL);
  solveTwoBoneIK(rig.rightWing.shoulder, rig.rightWing.elbow, rig.wingL1, rig.wingL2, _gripTargetR, _elbowPoleR);

  // 8. World Interactions: Ocean Waves, Lighthouse Beacon, Boost Rings, Jump Ramps & Leaping Fish
  const waterPos = world.waterMesh.geometry.attributes.position;
  for (let i = 0; i < waterPos.count; i++) {
    const wx = waterPos.getX(i);
    const wz = waterPos.getZ(i);
    const wave = Math.sin(wx * 0.14 + elapsed * 1.8) * 0.12 + Math.cos(wz * 0.16 + elapsed * 1.4) * 0.10;
    waterPos.setY(i, world.waterBaseY[i] + wave);
  }
  waterPos.needsUpdate = true;

  world.beaconPivot.rotation.y = elapsed * 0.65;
  world.targetHalo.rotation.z = elapsed * 1.2;

  // Companion seagulls overhead
  for (let i = 0; i < world.gulls.length; i++) {
    const g = world.gulls[i];
    const angle = elapsed * 0.28 + g.phase;
    g.group.position.set(Math.cos(angle) * 18, 7.5 + Math.sin(elapsed * 1.5 + i) * 0.6, Math.sin(angle) * 14);
    g.group.rotation.y = -angle;
    const flap = Math.sin(elapsed * 7.5 + g.phase) * 0.42;
    g.wingL.rotation.z = flap;
    g.wingR.rotation.z = -flap;
  }

  // Check Boost Rings
  for (const gate of world.boostGates) {
    gate.mesh.rotation.z = elapsed * 2.2;
    if (gate.cooldown > 0) {
      gate.cooldown -= dt;
    } else if (rig.root.position.distanceTo(gate.position) < 1.85) {
      gate.cooldown = 3.0;
      state.boostTimer = 2.4;
      sound.playBoost();
      spawnParticles(rig.root.position, 0x38bdf8, 12);
      showToast('顺风气流加速！');
    }
  }

  // Check Wooden Jump Ramps
  for (const ramp of world.jumpRamps) {
    if (ramp.cooldown > 0) {
      ramp.cooldown -= dt;
    } else if (state.isGrounded && rig.root.position.distanceTo(ramp.position) < 1.35) {
      ramp.cooldown = 2.0;
      triggerBunnyHop(6.2);
      showToast('栈道跳台腾空！');
    }
  }

  // Update Leaping Silver Fish Schools & Auto/Active Catch
  for (const fish of world.leapingFish) {
    if (fish.caughtCooldown > 0) {
      fish.caughtCooldown -= dt;
      fish.mesh.visible = false;
      fish.marker.visible = false;
      continue;
    }

    fish.mesh.visible = true;
    fish.marker.visible = true;
    fish.phase += dt * fish.speed;

    const arcSin = Math.sin(fish.phase);
    const lateralSweep = Math.cos(fish.phase) * 1.65;
    const height = Math.max(-0.6, arcSin * 1.65 + 0.55);

    const sample = sampleTrack(fish.theta, fish.lane + lateralSweep * 0.35);
    fish.worldPos.copy(sample.position);
    fish.worldPos.y += height;

    fish.mesh.position.copy(fish.worldPos);
    fish.mesh.rotation.y = sample.heading + Math.PI * 0.5;
    fish.mesh.rotation.x = -Math.cos(fish.phase) * 0.65;
    if (fish.mesh.userData.tail) {
      fish.mesh.userData.tail.rotation.y = Math.PI * 0.5 + Math.sin(elapsed * 18) * 0.35;
    }

    fish.marker.position.set(fish.worldPos.x, sample.position.y + 0.04, fish.worldPos.z);
    const markerScale = THREE.MathUtils.clamp(1.2 - Math.abs(height - 0.8) * 0.4, 0.4, 1.2);
    fish.marker.scale.setScalar(markerScale);

    // Catch check: automatic if riding right into fish, or wider radius when beak is open
    const catchRadius = state.beakTimer > 0 ? 2.85 : 1.45;
    if (state.pouchFishCount < 5 && fish.worldPos.distanceTo(rig.root.position) < catchRadius) {
      fish.caughtCooldown = 4.5;
      state.pouchFishCount = Math.min(5, state.pouchFishCount + 1);
      state.beakTimer = 0.45;
      state.beakOpenTarget = 0.68;
      state.pouchScaleVel += 5.2;
      syncPouchVisuals();
      sound.playBeakSnap(true);
      spawnParticles(fish.worldPos, 0x38bdf8, 12);
      showToast(`喉囊捕鱼 +1（${state.pouchFishCount}/5）`);
    }
  }

  // Check Harbor Pier Delivery Zone (automatic delivery when riding past pier arch with fish)
  world.pierBasketGroup.getWorldPosition(world.pierBasketPosWorld);
  if (state.pouchFishCount > 0 && rig.root.position.distanceTo(world.pierSample.center) < 3.4) {
    deliverPouchFishToPier();
  }

  // Update flying delivery fish arcs
  for (let i = flyingDeliveries.length - 1; i >= 0; i--) {
    const fd = flyingDeliveries[i];
    fd.progress += dt * 1.85;
    if (fd.progress < 0) continue;
    if (fd.progress >= 1) {
      scene.remove(fd.mesh);
      flyingDeliveries.splice(i, 1);
      continue;
    }
    const t = fd.progress;
    fd.mesh.position.lerpVectors(fd.start, fd.end, t);
    fd.mesh.position.y += Math.sin(t * Math.PI) * fd.arcHeight;
    fd.mesh.rotation.x += dt * 8.0;
    fd.mesh.rotation.y += dt * 5.0;
  }

  // Update celebration particles
  for (const item of particlePool) {
    if (item.life > 0) {
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
      } else {
        item.mesh.position.addScaledVector(item.vel, dt);
        item.vel.y -= 6.5 * dt;
        item.mesh.scale.setScalar(item.life / item.maxLife);
      }
    }
  }

  // 9. Camera Follow & Orbit Update
  const camPreset = CAMERA_MODES[state.camIdx];
  if (!state.isDraggingCam && camPreset.id !== 'orbit') {
    state.camYawOffset = THREE.MathUtils.lerp(state.camYawOffset, 0, 1 - Math.exp(-dt * 1.8));
  }

  const totalYaw =
    trackSample.heading + Math.PI + camPreset.yaw + state.camYawOffset - state.steerAngle * 0.25;
  const totalPitch = THREE.MathUtils.clamp(camPreset.pitch + state.camPitchOffset, 0.06, 1.15);

  // Responsive distance scaling on narrow portrait viewports so the full bike + pelican beak fit
  const aspectFactor =
    camera.aspect < 1.0 ? THREE.MathUtils.clamp(1.08 / Math.sqrt(camera.aspect), 1.22, 1.62) : 1.0;
  const dist = camPreset.dist * state.camDistScale * aspectFactor;

  const horizDist = Math.cos(totalPitch) * dist;
  const vertDist = Math.sin(totalPitch) * dist;

  const targetLook = new THREE.Vector3(0, 1.32, 0.14).applyMatrix4(rig.root.matrixWorld);
  const targetCamPos = new THREE.Vector3(
    targetLook.x + Math.sin(totalYaw) * horizDist,
    rig.root.position.y + 1.22 + vertDist,
    targetLook.z + Math.cos(totalYaw) * horizDist
  );

  if (!camInitialized || isQA) {
    camCurrentPos.copy(targetCamPos);
    camCurrentLook.copy(targetLook);
    camInitialized = true;
  } else {
    camCurrentPos.lerp(targetCamPos, 1 - Math.exp(-dt * 8.5));
    camCurrentLook.lerp(targetLook, 1 - Math.exp(-dt * 10.5));
  }

  camera.position.copy(camCurrentPos);
  camera.lookAt(camCurrentLook);
}

// Animation Loop
function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = (now - lastTime) * 0.001;
  lastTime = now;
  const dt = isQA ? 1 / 60 : Math.min(0.05, Math.max(0.001, rawDt));
  const elapsed = isQA ? 1.2 : now * 0.001;

  updateSimulation(dt, elapsed);
  renderer.render(scene, camera);
}

// Initial deterministic frame for ?qa screenshot stability
if (isQA) {
  setCameraMode(1, false); // Side profile view shows pelican + bicycle + IK legs clearly in QA
  updateSimulation(1 / 60, 1.2);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
