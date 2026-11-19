import * as THREE from '../vendor/three.min.js';
import {
  createRoadTexture,
  createWickerTexture,
  createStripeTexture,
  createStoneTexture,
  createWoodTexture,
  createFeatherTexture,
  createGlowTexture,
} from './textures.js';
import { CoastalAudio } from './audio.js';
import { CoastalEnvironment, createProceduralEnvMap } from './environment.js';
import { CruiserBike, WHEEL_RADIUS } from './bike.js';
import { PelicanRider } from './pelican.js';
import { CoastalWorld, LANE_LIMIT, roadY, roadYDeriv } from './world.js';

const STORAGE_PREFIX = 'gemini-4-neon-high-pelican-run-01:';

const CAMERA_MODES = [
  { id: 'follow', label: '追随视角', yaw: -0.26, pitch: 0.24, dist: 5.2, targetY: 1.06, autoReturn: true },
  { id: 'side', label: '侧拍骑行', yaw: -1.42, pitch: 0.14, dist: 4.15, targetY: 1.02, autoReturn: true },
  { id: 'hero', label: '正面特写', yaw: -2.74, pitch: 0.17, dist: 3.95, targetY: 1.12, autoReturn: true },
  { id: 'orbit', label: '自由环视', yaw: -0.58, pitch: 0.24, dist: 4.6, targetY: 1.04, autoReturn: false },
];

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw !== null ? raw : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, String(value));
  } catch {
    // Ignore restricted iframe storage
  }
}

class PelicanCapeApp {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.ui = {
      speed: document.getElementById('hud-speed'),
      fish: document.getElementById('hud-fish'),
      dist: document.getElementById('hud-dist'),
      btnCamera: document.getElementById('btn-camera'),
      btnTime: document.getElementById('btn-time'),
      btnAudio: document.getElementById('btn-audio'),
      btnHelp: document.getElementById('btn-help'),
      steerPad: document.getElementById('steer-pad'),
      steerThumb: document.getElementById('steer-thumb'),
      btnBell: document.getElementById('btn-bell'),
      btnHop: document.getElementById('btn-hop'),
      btnSprint: document.getElementById('btn-sprint'),
      helpModal: document.getElementById('help-popover'),
      helpClose: document.getElementById('help-close'),
      toast: document.getElementById('toast'),
    };

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.environment = createProceduralEnvMap(this.renderer);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.15, 360);

    // Procedural textures (all generated locally via Canvas2D)
    this.textures = {
      road: createRoadTexture(),
      wicker: createWickerTexture(),
      scarf: createStripeTexture('#df5442', '#fff4e2', 10),
      towel: createStripeTexture('#2b969c', '#fff4df', 8),
      stone: createStoneTexture(),
      wood: createWoodTexture(),
      feather: createFeatherTexture(),
      glow: createGlowTexture(),
    };

    // Subsystems
    this.audio = new CoastalAudio();
    this.env = new CoastalEnvironment(this.scene);
    this.world = new CoastalWorld(this.scene, this.textures);
    this.bike = new CruiserBike(this.textures);
    this.pelican = new PelicanRider(this.textures);

    // Unified Rider Assembly (moves laterally, hops, banks, pitches with hills)
    this.riderRoot = new THREE.Group();
    this.riderRoot.add(this.bike.root);
    this.riderRoot.add(this.pelican.root);
    this.scene.add(this.riderRoot);

    // Initial preferences from scoped localStorage
    const savedTime = parseInt(readStorage('timeIndex', '0'), 10);
    if (!Number.isNaN(savedTime)) {
      this.env.setPreset(savedTime);
    }
    const savedMuted = readStorage('muted', '0') === '1';
    this.audio.setMuted(savedMuted);
    this._syncAudioIcon();
    this._syncTimeIcon();

    // Simulation state
    this.state = {
      paused: false,
      elapsed: 0,
      dist: 0,
      speed: 8.8,
      baseSpeed: 8.8,
      boostTimer: 0,
      laneX: 0,
      laneVel: 0,
      steerAngle: 0,
      leanRoll: 0,
      pitchSlope: 0,
      wheelAngle: 0,
      crankAngle: 0,
      jumpY: 0,
      jumpVy: 0,
      isAirborne: false,
      isGliding: false,
      isSprinting: false,
      isCoasting: false,
      fishCount: parseInt(readStorage('fishCount', '0'), 10) || 0,
      combo: 0,
      comboTimer: 0,
    };
    this.ui.fish.textContent = String(this.state.fishCount);

    // Input state (merged keyboard + touch)
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      hop: false,
    };
    this.touch = {
      steerVal: 0,
      steerPointerId: null,
      sprint: false,
      hop: false,
    };

    // Camera orbit state
    this.camIndex = 0;
    this.camYaw = CAMERA_MODES[0].yaw;
    this.camPitch = CAMERA_MODES[0].pitch;
    this.camDist = CAMERA_MODES[0].dist;
    this.camTarget = new THREE.Vector3(0, 1.08, 0);
    this.orbitDrag = {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      moved: false,
      downTime: 0,
    };
    this.pinch = { active: false, dist: 0, pointers: new Map() };

    // Scratch vectors
    this._leftPedal = new THREE.Vector3();
    this._rightPedal = new THREE.Vector3();
    this._leftGrip = new THREE.Vector3();
    this._rightGrip = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._toastTimer = null;

    this._bindEvents();
    this._onResize();

    this._lastNow = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _showToast(text) {
    this.ui.toast.textContent = text;
    this.ui.toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.ui.toast.classList.remove('visible');
    }, 1500);
  }

  _syncTimeIcon() {
    const preset = this.env.targetPreset;
    this.ui.btnTime.dataset.mode = preset.id;
    this.ui.btnTime.setAttribute('aria-label', `切换时段：当前${preset.label}`);
  }

  _syncAudioIcon() {
    this.ui.btnAudio.classList.toggle('is-muted', this.audio.muted);
    this.ui.btnAudio.setAttribute('aria-label', this.audio.muted ? '开启音效' : '静音');
  }

  _triggerHop() {
    this.audio.unlock();
    if (!this.state.isAirborne) {
      this.state.jumpVy = 5.45;
      this.state.isAirborne = true;
      this.bike.impulseCargo(1.8);
      this.audio.playHop();
    }
  }

  _triggerBell() {
    this.audio.unlock();
    this.bike.ringBell();
    this.pelican.triggerHonk();
    this.world.startleGulls(this.state.dist);
    this.audio.playBell();
    this.audio.playHonk();
    this.ui.btnBell.classList.add('is-pulse');
    setTimeout(() => this.ui.btnBell.classList.remove('is-pulse'), 240);
  }

  _cycleCamera() {
    this.camIndex = (this.camIndex + 1) % CAMERA_MODES.length;
    const mode = CAMERA_MODES[this.camIndex];
    this._showToast(`${mode.label} · C`);
  }

  _cycleTime() {
    const preset = this.env.cyclePreset();
    writeStorage('timeIndex', this.env.presetIndex);
    this._syncTimeIcon();
    this._showToast(`${preset.label} · T`);
  }

  _toggleAudio() {
    const muted = this.audio.toggleMute();
    writeStorage('muted', muted ? '1' : '0');
    this._syncAudioIcon();
    this._showToast(muted ? '音效已静音 · M' : '海风音效已开启 · M');
  }

  _togglePause() {
    this.state.paused = !this.state.paused;
    this._showToast(this.state.paused ? '已暂停（可环视模型）· P' : '继续骑行 · P');
  }

  _resetView() {
    const mode = CAMERA_MODES[this.camIndex];
    this.camYaw = mode.yaw;
    this.camPitch = mode.pitch;
    this.camDist = mode.dist;
    this.state.laneX = 0;
    this.state.laneVel = 0;
    this._showToast('已复位 · R');
  }

  _toggleHelp(force) {
    const show = typeof force === 'boolean' ? force : !this.ui.helpModal.classList.contains('open');
    this.ui.helpModal.classList.toggle('open', show);
    this.ui.btnHelp.classList.toggle('is-active', show);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());

    // ─── Top Bar Buttons ───
    this.ui.btnCamera.addEventListener('click', () => this._cycleCamera());
    this.ui.btnTime.addEventListener('click', () => this._cycleTime());
    this.ui.btnAudio.addEventListener('click', () => this._toggleAudio());
    this.ui.btnHelp.addEventListener('click', () => this._toggleHelp());
    this.ui.helpClose.addEventListener('click', () => this._toggleHelp(false));
    this.ui.helpModal.addEventListener('click', (e) => {
      if (e.target === this.ui.helpModal) this._toggleHelp(false);
    });

    // ─── Bottom Touch Controls ───
    // Continuous slide-across steering rocker
    const updateSteerFromPointer = (e) => {
      const rect = this.ui.steerPad.getBoundingClientRect();
      const norm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.touch.steerVal = THREE.MathUtils.clamp(norm * 1.25, -1, 1);
    };

    this.ui.steerPad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.audio.unlock();
      this.touch.steerPointerId = e.pointerId;
      this.ui.steerPad.setPointerCapture(e.pointerId);
      this.ui.steerPad.classList.add('is-active');
      updateSteerFromPointer(e);
    });
    this.ui.steerPad.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.touch.steerPointerId) {
        updateSteerFromPointer(e);
      }
    });
    const endSteer = (e) => {
      if (e.pointerId === this.touch.steerPointerId) {
        this.touch.steerPointerId = null;
        this.touch.steerVal = 0;
        this.ui.steerPad.classList.remove('is-active');
      }
    };
    this.ui.steerPad.addEventListener('pointerup', endSteer);
    this.ui.steerPad.addEventListener('pointercancel', endSteer);

    // Bell button
    this.ui.btnBell.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._triggerBell();
    });

    // Hop & Glide button (tap to hop, hold mid-air to glide)
    const bindHold = (el, onDown, onUp) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.audio.unlock();
        el.setPointerCapture(e.pointerId);
        onDown();
      });
      const release = () => onUp();
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
    };

    bindHold(
      this.ui.btnHop,
      () => {
        this.touch.hop = true;
        this._triggerHop();
      },
      () => {
        this.touch.hop = false;
      }
    );

    bindHold(
      this.ui.btnSprint,
      () => {
        this.touch.sprint = true;
      },
      () => {
        this.touch.sprint = false;
      }
    );

    // ─── Canvas Direct Orbit, Pinch Zoom & Tap-to-Poke Pelican ───
    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      this.pinch.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pinch.pointers.size === 2) {
        const pts = [...this.pinch.pointers.values()];
        this.pinch.active = true;
        this.pinch.dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.orbitDrag.active = false;
        return;
      }

      this.orbitDrag.active = true;
      this.orbitDrag.pointerId = e.pointerId;
      this.orbitDrag.lastX = e.clientX;
      this.orbitDrag.lastY = e.clientY;
      this.orbitDrag.moved = false;
      this.orbitDrag.downTime = performance.now();
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.pinch.pointers.has(e.pointerId)) {
        this.pinch.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (this.pinch.active && this.pinch.pointers.size === 2) {
        const pts = [...this.pinch.pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const delta = this.pinch.dist - d;
        this.camDist = THREE.MathUtils.clamp(this.camDist + delta * 0.015, 2.5, 9.5);
        this.pinch.dist = d;
        return;
      }

      if (!this.orbitDrag.active || e.pointerId !== this.orbitDrag.pointerId) return;
      const dx = e.clientX - this.orbitDrag.lastX;
      const dy = e.clientY - this.orbitDrag.lastY;
      if (Math.hypot(dx, dy) > 4) this.orbitDrag.moved = true;

      this.camYaw -= dx * 0.0072;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.0055, 0.05, 0.92);
      this.orbitDrag.lastX = e.clientX;
      this.orbitDrag.lastY = e.clientY;
    });

    const endCanvasPointer = (e) => {
      this.pinch.pointers.delete(e.pointerId);
      if (this.pinch.pointers.size < 2) this.pinch.active = false;

      if (this.orbitDrag.active && e.pointerId === this.orbitDrag.pointerId) {
        this.orbitDrag.active = false;
        const tapDuration = performance.now() - this.orbitDrag.downTime;
        if (!this.orbitDrag.moved && tapDuration < 260) {
          this._handleCanvasTap(e.clientX, e.clientY);
        }
      }
    };
    this.canvas.addEventListener('pointerup', endCanvasPointer);
    this.canvas.addEventListener('pointercancel', endCanvasPointer);

    // Wheel zoom for desktop / trackpad
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camDist = THREE.MathUtils.clamp(this.camDist + e.deltaY * 0.004, 2.5, 9.5);
      },
      { passive: false }
    );

    // ─── Comprehensive Keyboard Shortcuts ───
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      const key = e.key.toLowerCase();

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) {
        e.preventDefault();
      }
      this.audio.unlock();

      if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = true;
      else if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = true;
      else if (code === 'ArrowUp' || code === 'KeyW') this.keys.up = true;
      else if (code === 'ArrowDown' || code === 'KeyS') this.keys.down = true;
      else if (code === 'Space') {
        if (!this.keys.hop) this._triggerHop();
        this.keys.hop = true;
      } else if (!e.repeat) {
        if (code === 'KeyB' || code === 'KeyE') this._triggerBell();
        else if (code === 'KeyC') this._cycleCamera();
        else if (code === 'KeyT') this._cycleTime();
        else if (code === 'KeyM') this._toggleAudio();
        else if (code === 'KeyP') this._togglePause();
        else if (code === 'KeyR') this._resetView();
        else if (code === 'KeyH' || key === '?') this._toggleHelp();
        else if (code === 'Escape') this._toggleHelp(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = false;
      else if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = false;
      else if (code === 'ArrowUp' || code === 'KeyW') this.keys.up = false;
      else if (code === 'ArrowDown' || code === 'KeyS') this.keys.down = false;
      else if (code === 'Space') this.keys.hop = false;
    });
  }

  _handleCanvasTap(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this._ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const hits = this._raycaster.intersectObjects(this.pelican.clickableMeshes, false);
    if (hits.length > 0) {
      this.pelican.triggerPoke();
      this.bike.impulseCargo(1.1);
      this.audio.playHonk();
      this.world.spawnBurst(hits[0].point, 8, false);
    }
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  _updateSimulation(dt) {
    const s = this.state;

    // Combine keyboard & touch inputs
    let steerInput = this.touch.steerVal;
    if (this.keys.left) steerInput -= 1;
    if (this.keys.right) steerInput += 1;
    steerInput = THREE.MathUtils.clamp(steerInput, -1, 1);

    const sprintActive = this.keys.up || this.touch.sprint;
    const coastActive = this.keys.down && !sprintActive;
    const hopHeld = this.keys.hop || this.touch.hop;

    // Reflect active controls visibly in mobile HUD
    this.ui.steerThumb.style.transform = `translateX(${steerInput * 28}px)`;
    this.ui.btnSprint.classList.toggle('is-active', sprintActive);
    this.ui.btnHop.classList.toggle('is-active', hopHeld || s.isGliding);

    // Speed & acceleration
    if (s.boostTimer > 0) s.boostTimer = Math.max(0, s.boostTimer - dt);
    if (s.comboTimer > 0) {
      s.comboTimer = Math.max(0, s.comboTimer - dt);
      if (s.comboTimer === 0) s.combo = 0;
    }

    const boostBonus = s.boostTimer > 0 ? 3.2 : 0;
    const targetSpeed = sprintActive
      ? 15.8 + boostBonus
      : coastActive
        ? 3.4
        : s.baseSpeed + boostBonus;

    const prevSpeed = s.speed;
    const accelRate = sprintActive ? 3.6 : coastActive ? 2.8 : 2.1;
    s.speed += (targetSpeed - s.speed) * Math.min(1, dt * accelRate);
    const accel = (s.speed - prevSpeed) / Math.max(0.001, dt);

    s.isSprinting = sprintActive || s.boostTimer > 0.2;
    s.isCoasting = coastActive && !s.isSprinting;

    // Advance along coastal route
    s.dist += s.speed * dt;
    s.wheelAngle += (s.speed * dt) / WHEEL_RADIUS;

    // Pedaling cadence (coasts smoothly when braking or soaring mid-air!)
    const pedalFactor = s.isAirborne || s.isCoasting ? 0.08 : 1.0;
    s.crankAngle += ((s.speed * 0.62) / WHEEL_RADIUS) * pedalFactor * dt;

    // Smooth steering, carving & realistic bicycle banking lean
    const targetSteer = steerInput * 0.42;
    s.steerAngle += (targetSteer - s.steerAngle) * Math.min(1, dt * 11);

    const lateralSpeed = steerInput * (4.4 + s.speed * 0.14);
    s.laneVel += (lateralSpeed - s.laneVel) * Math.min(1, dt * 9);
    s.laneX += s.laneVel * dt;

    // Soft coastal curb boundary spring
    if (s.laneX > LANE_LIMIT) {
      s.laneX = LANE_LIMIT;
      s.laneVel = Math.min(0, s.laneVel);
    } else if (s.laneX < -LANE_LIMIT) {
      s.laneX = -LANE_LIMIT;
      s.laneVel = Math.max(0, s.laneVel);
    }

    const targetRoll = -steerInput * Math.min(0.27, 0.12 + s.speed * 0.01);
    s.leanRoll += (targetRoll - s.leanRoll) * Math.min(1, dt * 9);

    // Hop & Wing-Spread Coastal Glide physics
    s.isGliding = s.isAirborne && hopHeld && s.jumpVy < 1.2;
    if (s.isAirborne) {
      const gravity = s.isGliding ? 3.4 : 15.2;
      s.jumpVy -= gravity * dt;
      if (s.isGliding && s.jumpVy < -1.15) s.jumpVy = -1.15;
      s.jumpY += s.jumpVy * dt;
      if (s.jumpY <= 0) {
        s.jumpY = 0;
        s.jumpVy = 0;
        s.isAirborne = false;
        s.isGliding = false;
        this.bike.impulseCargo(1.3);
      }
    }

    // Coastal road elevation pitch
    const slope = Math.atan2(roadYDeriv(s.dist), 1);
    const airPitch = s.isAirborne ? THREE.MathUtils.clamp(s.jumpVy * 0.045, -0.18, 0.22) : 0;
    s.pitchSlope += (slope + airPitch - s.pitchSlope) * Math.min(1, dt * 9);

    // Apply transform to rider assembly
    this.riderRoot.position.set(s.laneX, s.jumpY, 0);
    this.riderRoot.rotation.set(s.pitchSlope, -s.steerAngle * 0.22, s.leanRoll);

    // Update Bike mechanics & exact anchors
    this.bike.update(dt, s.steerAngle, s.crankAngle, s.wheelAngle, this.env.cur.lampGlow, s.speed, accel);
    this.bike.getPedalPositions(s.crankAngle, this._leftPedal, this._rightPedal);
    this.bike.getGripPositions(this._leftGrip, this._rightGrip);

    // Update Pelican IK legs, wings, neck, pouch, scarf & eyes
    this.pelican.update(
      dt,
      s.elapsed,
      s,
      this._leftPedal,
      this._rightPedal,
      this._leftGrip,
      this._rightGrip
    );

    // Update Coastal World & Gameplay pickups/ramps
    this.world.update(
      dt,
      s.elapsed,
      s.dist,
      s.laneX,
      s.jumpY,
      this.env.cur.lampGlow,
      (isGolden) => {
        const pts = isGolden ? 3 : 1;
        s.fishCount += pts;
        s.combo += 1;
        s.comboTimer = 4.0;
        s.boostTimer = Math.max(s.boostTimer, isGolden ? 1.9 : 1.0);
        writeStorage('fishCount', s.fishCount);
        this.ui.fish.textContent = String(s.fishCount);
        this.ui.fish.parentElement.classList.remove('is-pop');
        void this.ui.fish.parentElement.offsetWidth;
        this.ui.fish.parentElement.classList.add('is-pop');
        this.pelican.triggerGulp();
        this.bike.impulseCargo(1.5);
        this.audio.playCatch(s.combo);
      },
      () => {
        // Launched off a coastal wooden ramp!
        s.jumpVy = 6.8;
        s.isAirborne = true;
        s.boostTimer = Math.max(s.boostTimer, 1.5);
        this.pelican.triggerHonk();
        this.bike.impulseCargo(2.2);
        this.audio.playHop();
      }
    );

    // Ambient ocean surf, wind & freewheel ticks
    this.audio.updateAmbient(s.elapsed, s.speed, s.isCoasting, s.isAirborne, dt);

    // Telemetry readout
    this.ui.speed.textContent = String(Math.round(s.speed * 2.4));
    this.ui.dist.textContent = `${(s.dist / 1000).toFixed(2)} km`;
  }

  _updateCamera(dt) {
    const mode = CAMERA_MODES[this.camIndex];
    const isPortrait = window.innerHeight > window.innerWidth;
    const portraitDistScale = isPortrait ? 1.18 : 1.0;
    const targetDist = mode.dist * portraitDistScale;

    if (!this.orbitDrag.active && !this.pinch.active && mode.autoReturn) {
      const k = Math.min(1, dt * 3.2);
      // Shortest angular interpolation
      let dyaw = ((mode.yaw - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.camYaw += dyaw * k;
      this.camPitch += (mode.pitch - this.camPitch) * k;
      this.camDist += (targetDist - this.camDist) * k;
    }

    // Dynamic FOV sensation when sprinting or soaring
    const targetFov = (isPortrait ? 52 : 47) + Math.max(0, (this.state.speed - 9) * 0.85) + (this.state.isGliding ? 3.5 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
      this.camera.updateProjectionMatrix();
    }

    // Shift look target slightly downward on narrow phones so the pelican sits cleanly above bottom thumb controls
    const portraitYOffset = isPortrait ? -0.14 : 0.0;
    const desiredTargetX = this.state.laneX * 0.72;
    const desiredTargetY = mode.targetY + this.state.jumpY * 0.65 + portraitYOffset;
    this.camTarget.x += (desiredTargetX - this.camTarget.x) * Math.min(1, dt * 7);
    this.camTarget.y += (desiredTargetY - this.camTarget.y) * Math.min(1, dt * 7);
    this.camTarget.z = 0;

    const r = this.camDist;
    const cp = Math.cos(this.camPitch);
    const sp = Math.sin(this.camPitch);
    const cx = this.camTarget.x + Math.sin(this.camYaw) * cp * r;
    const cy = Math.max(0.45, this.camTarget.y + sp * r);
    const cz = this.camTarget.z + Math.cos(this.camYaw) * cp * r;

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.camTarget);
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - this._lastNow) / 1000));
    this._lastNow = now;

    if (!this.state.paused) {
      this.state.elapsed += dt;
      this._updateSimulation(dt);
    }

    const oceanY = -roadY(this.state.dist) - 0.55;
    this.env.update(dt, this.state.elapsed, this.state.dist, oceanY, this.state.laneX);
    this._updateCamera(dt);

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PelicanCapeApp();
});
