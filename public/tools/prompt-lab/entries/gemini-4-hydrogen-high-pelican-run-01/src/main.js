import * as THREE from '../vendor/three.min.js';
import { PelicanBike } from './pelican-bike.js';
import { CoastalWorld } from './world.js';
import { SoundEngine } from './audio.js';

const CAMERA_PRESETS = [
  { id: 'hero', label: '3/4 视角', yaw: 1.18, pitch: 0.22, dist: 3.85, targetY: 0.78 },
  { id: 'side', label: '正侧骑行', yaw: 1.56, pitch: 0.13, dist: 3.55, targetY: 0.76 },
  { id: 'chase', label: '追风视角', yaw: 0.24, pitch: 0.27, dist: 3.65, targetY: 0.85 },
  { id: 'front', label: '前脸特写', yaw: 2.52, pitch: 0.16, dist: 3.15, targetY: 0.84 },
];

const TIME_LABELS = {
  noon: '晴朗午后',
  sunset: '金橘日落',
  night: '星夜灯塔',
};

const TIME_ICONS = {
  noon: '☀️',
  sunset: '🌅',
  night: '🌙',
};

class App {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.sound = new SoundEngine();

    this._initRenderer();
    this._initScene();
    this._initState();
    this._initUI();
    this._initInput();

    this.clock = new THREE.Clock();
    this._animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      46,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      260
    );

    this.world = new CoastalWorld(this.scene);
    this.pelicanBike = new PelicanBike();
    this.scene.add(this.pelicanBike.root);

    this.raycaster = new THREE.Raycaster();
  }

  _initState() {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.elapsed = 0;

    // Bike physics state
    this.bikeX = 0;
    this.bikeY = 0;
    this.velY = 0;
    this.speed = 6.2; // m/s (~22 km/h natural cruise)
    this.baseCruiseSpeed = 6.2;
    this.boostBurst = 0;
    this.steerSmooth = 0;
    this.isAirborne = false;
    this.isGliding = false;
    this.canAirFlap = true;
    this.isPaused = false;

    this.fishScore = 0;
    this.distanceMeters = 0;

    // Camera orbit state
    this.presetIndex = 0;
    const p = CAMERA_PRESETS[0];
    this.camYaw = p.yaw;
    this.camPitch = p.pitch;
    this.camDist = p.dist;
    this.camTargetY = p.targetY;
    this.manualOrbitYaw = 0;
    this.manualOrbitPitch = 0;
    this.manualOrbitDist = 0;

    // Input flags
    this.keys = new Set();
    this.touchInput = {
      left: false,
      right: false,
      sprint: false,
      brake: false,
    };

    // Toast feedback timer
    this.toastTimer = 0;
  }

  _initUI() {
    this.elFishCount = document.getElementById('fish-count');
    this.elSpeedReadout = document.getElementById('speed-readout');
    this.elTimeBtn = document.getElementById('btn-time');
    this.elCamBtn = document.getElementById('btn-camera');
    this.elMuteBtn = document.getElementById('btn-mute');
    this.elHelpBtn = document.getElementById('btn-help');
    this.elHelpModal = document.getElementById('help-modal');
    this.elHelpClose = document.getElementById('help-close');
    this.elToast = document.getElementById('hud-toast');

    this.elBtnLeft = document.getElementById('btn-left');
    this.elBtnRight = document.getElementById('btn-right');
    this.elBtnBell = document.getElementById('btn-bell');
    this.elBtnJump = document.getElementById('btn-jump');
    this.elBtnSprint = document.getElementById('btn-sprint');

    this._syncTopButtons();
  }

  _syncTopButtons() {
    const mode = this.world.getCurrentMode();
    this.elTimeBtn.textContent = TIME_ICONS[mode];
    this.elTimeBtn.setAttribute('aria-label', `切换天色：${TIME_LABELS[mode]}`);
    this.elTimeBtn.title = `${TIME_LABELS[mode]} (T)`;

    const preset = CAMERA_PRESETS[this.presetIndex];
    this.elCamBtn.setAttribute('aria-label', `切换视角：${preset.label}`);
    this.elCamBtn.title = `${preset.label} (C)`;

    this.elMuteBtn.textContent = this.sound.muted ? '🔇' : '🔊';
    this.elMuteBtn.setAttribute('aria-label', this.sound.muted ? '开启声音 (M)' : '静音 (M)');
  }

  showToast(msg) {
    this.elToast.textContent = msg;
    this.elToast.classList.add('visible');
    this.toastTimer = 1.65;
  }

  // === Primary Actions ===
  doBell() {
    this.sound.playBell();
    this.pelicanBike.triggerBell();
    this.world.scatterSeagulls();
    this.showToast('叮铃铃 · 海鸥起飞');
  }

  doHonk() {
    this.sound.playHonk();
    this.pelicanBike.triggerHonk();
    this.pelicanBike.squashY = 1.07;
  }

  doJump() {
    this.sound.unlock();
    if (!this.isAirborne) {
      this.velY = 5.4;
      this.isAirborne = true;
      this.canAirFlap = true;
      this.isGliding = false;
      this.pelicanBike.squashY = 1.14;
      this.sound.playJump(false);
      this.world.spawnBurst(
        new THREE.Vector3(this.bikeX, this.bikeY + 0.1, 0.2),
        8,
        0xfbf7ee,
        0.75,
        5
      );
    } else if (this.canAirFlap) {
      // Mid-air wing-assisted flap boost & glide!
      this.velY = Math.max(this.velY + 2.6, 3.2);
      this.canAirFlap = false;
      this.isGliding = true;
      this.sound.playJump(true);
      this.world.spawnBurst(
        new THREE.Vector3(this.bikeX, this.bikeY + 0.9, 0.1),
        10,
        0xffffff,
        0.95,
        2.5
      );
    }
  }

  doCycleTime() {
    this.sound.unlock();
    const mode = this.world.cycleTimeMode();
    this._syncTopButtons();
    this.showToast(`${TIME_ICONS[mode]} ${TIME_LABELS[mode]}`);
  }

  doCycleCamera() {
    this.sound.unlock();
    this.presetIndex = (this.presetIndex + 1) % CAMERA_PRESETS.length;
    this.manualOrbitYaw = 0;
    this.manualOrbitPitch = 0;
    this.manualOrbitDist = 0;
    this._syncTopButtons();
    this.showToast(`📷 ${CAMERA_PRESETS[this.presetIndex].label}`);
  }

  doResetCamera() {
    this.manualOrbitYaw = 0;
    this.manualOrbitPitch = 0;
    this.manualOrbitDist = 0;
    this.showToast('📷 视角已回正');
  }

  doTogglePause() {
    this.isPaused = !this.isPaused;
    this.showToast(this.isPaused ? '⏸ 暂停骑行（可环绕观察）' : '▶ 继续骑行');
  }

  doToggleMute() {
    this.sound.setMuted(!this.sound.muted);
    this._syncTopButtons();
    this.showToast(this.sound.muted ? '🔇 已静音' : '🔊 音效已开启');
  }

  toggleHelp(force) {
    const show = typeof force === 'boolean' ? force : !this.elHelpModal.classList.contains('open');
    this.elHelpModal.classList.toggle('open', show);
    this.elHelpModal.setAttribute('aria-hidden', String(!show));
  }

  _bindHoldButton(btn, keyName) {
    const down = (e) => {
      e.preventDefault();
      this.sound.unlock();
      this.touchInput[keyName] = true;
      btn.classList.add('active');
    };
    const up = (e) => {
      if (e) e.preventDefault();
      this.touchInput[keyName] = false;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  }

  _initInput() {
    // Hold buttons
    this._bindHoldButton(this.elBtnLeft, 'left');
    this._bindHoldButton(this.elBtnRight, 'right');
    this._bindHoldButton(this.elBtnSprint, 'sprint');

    // Tap buttons
    this.elBtnBell.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.doBell();
    });
    this.elBtnJump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.doJump();
    });

    // Top bar buttons
    this.elTimeBtn.addEventListener('click', () => this.doCycleTime());
    this.elCamBtn.addEventListener('click', () => this.doCycleCamera());
    this.elMuteBtn.addEventListener('click', () => this.doToggleMute());
    this.elHelpBtn.addEventListener('click', () => this.toggleHelp());
    this.elHelpClose.addEventListener('click', () => this.toggleHelp(false));
    this.elHelpModal.addEventListener('click', (e) => {
      if (e.target === this.elHelpModal) this.toggleHelp(false);
    });

    // Canvas drag orbit + pinch zoom + direct 3D tap raycast
    const activePointers = new Map();
    let prevPinchDist = null;
    let dragStart = null;
    let movedDist = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) {
        dragStart = { x: e.clientX, y: e.clientY };
        movedDist = 0;
        prevPinchDist = null;
      } else if (activePointers.size === 2) {
        const pts = [...activePointers.values()];
        prevPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      const prev = activePointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1 && dragStart) {
        movedDist += Math.hypot(dx, dy);
        this.manualOrbitYaw -= dx * 0.0072;
        this.manualOrbitPitch = THREE.MathUtils.clamp(
          this.manualOrbitPitch + dy * 0.0055,
          -0.16,
          0.75
        );
      } else if (activePointers.size === 2) {
        const pts = [...activePointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (prevPinchDist !== null) {
          const delta = dist - prevPinchDist;
          this.manualOrbitDist = THREE.MathUtils.clamp(
            this.manualOrbitDist - delta * 0.012,
            -1.45,
            3.6
          );
        }
        prevPinchDist = dist;
      }
    });

    const endPointer = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      const wasSingleTap = activePointers.size === 1 && movedDist < 7;
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) prevPinchDist = null;

      if (wasSingleTap) {
        this._handleCanvasTap(e.clientX, e.clientY);
      }
    };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    // Wheel zoom
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.manualOrbitDist = THREE.MathUtils.clamp(
          this.manualOrbitDist + e.deltaY * 0.0028,
          -1.45,
          3.6
        );
      },
      { passive: false }
    );

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const code = e.code;
      const key = e.key.toLowerCase();

      if (code === 'Escape') {
        this.toggleHelp(false);
        return;
      }

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }

      this.keys.add(code);

      if (e.repeat) return;
      this.sound.unlock();

      if (code === 'Space') this.doJump();
      else if (key === 'b') this.doBell();
      else if (key === 'g' || key === 'f') this.doHonk();
      else if (key === 'c') this.doCycleCamera();
      else if (key === 't') this.doCycleTime();
      else if (key === 'p') this.doTogglePause();
      else if (key === 'm') this.doToggleMute();
      else if (key === 'r') this.doResetCamera();
      else if (key === 'h' || key === '?' || (e.shiftKey && code === 'Slash')) this.toggleHelp();
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = Math.max(1, window.innerHeight);
      this.camera.aspect = w / h;
      // Slightly wider FOV on very narrow portrait screens so the full bike stays framed
      this.camera.fov = w < 440 ? 52 : 46;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h, false);
    });
    // Trigger initial responsive FOV
    window.dispatchEvent(new Event('resize'));
  }

  _handleCanvasTap(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pelicanBike.interactiveMeshes, false);
    if (hits.length > 0) {
      const part = hits[0].object.userData.hitPart;
      if (part === 'bell') {
        this.doBell();
      } else if (part === 'pelican') {
        this.doHonk();
        this.showToast('嘎！喉囊鼓起来了');
      } else if (part === 'basket') {
        this.doHonk();
        this.world.spawnBurst(hits[0].point.clone(), 8, 0x99def5, 0.8, 5);
      } else if (part === 'wheel') {
        this.boostBurst = Math.max(this.boostBurst, 2.2);
        this.showToast('⚡ 轻踩加速');
      }
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.isPaused) {
      this.elapsed += dt;
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.elToast.classList.remove('visible');
      }
    }

    // 1. Gather steering / sprint / brake inputs
    const leftPressed =
      this.touchInput.left || this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const rightPressed =
      this.touchInput.right || this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const sprintPressed =
      this.touchInput.sprint ||
      this.keys.has('KeyW') ||
      this.keys.has('ArrowUp') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight');
    const brakePressed =
      this.touchInput.brake || this.keys.has('KeyS') || this.keys.has('ArrowDown');

    const rawSteer = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    this.steerSmooth = THREE.MathUtils.lerp(this.steerSmooth, rawSteer, Math.min(1, dt * 10));

    // 2. Speed & boost physics
    if (!this.isPaused) {
      this.boostBurst = Math.max(0, this.boostBurst - dt * 1.9);
      let targetSpeed = this.baseCruiseSpeed;
      if (sprintPressed) targetSpeed = 10.6;
      else if (brakePressed) targetSpeed = 1.6;
      targetSpeed += this.boostBurst;

      const accelRate = brakePressed ? 5.2 : sprintPressed ? 4.4 : 2.6;
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, Math.min(1, dt * accelRate));
    }

    // Lateral pier movement (stay safely inside the wooden curbs [-1.52, +1.52])
    if (!this.isPaused) {
      const lateralSpeed = this.steerSmooth * (2.6 + this.speed * 0.22);
      this.bikeX = THREE.MathUtils.clamp(this.bikeX + lateralSpeed * dt, -1.52, 1.52);
      this.distanceMeters += this.speed * dt;
    }

    // 3. World step (ramps, fish pickups, ocean, gulls)
    const forwardDist = this.speed * dt;
    const worldEvents = this.world.update(
      dt,
      this.elapsed,
      forwardDist,
      new THREE.Vector3(this.bikeX, this.bikeY, 0),
      this.isPaused,
      this.pelicanBike
    );

    if (worldEvents.hitRampLaunch && !this.isAirborne) {
      this.velY = 6.2;
      this.isAirborne = true;
      this.isGliding = true;
      this.canAirFlap = true;
      this.sound.playJump(true);
      this.world.spawnBurst(new THREE.Vector3(this.bikeX, this.bikeY + 0.2, 0.2), 10, 0xffe07d, 1, 4);
      this.showToast('🪽 木板飞跃滑翔！');
    }

    if (worldEvents.caughtFish) {
      this.fishScore++;
      this.elFishCount.textContent = String(this.fishScore);
      this.boostBurst = 2.6;
      this.pelicanBike.triggerGulp();
      this.sound.playFishCatch();
      this.showToast(`🐟 叼到海鱼 ×${this.fishScore}`);
    }

    // 4. Vertical jump / ramp / landing physics
    if (!this.isPaused) {
      const groundH = worldEvents.activeRampHeight;
      if (this.isAirborne) {
        const grav = this.isGliding && this.velY < 0 ? 6.2 : 13.5;
        this.velY -= grav * dt;
        this.bikeY += this.velY * dt;
        if (this.bikeY <= groundH) {
          this.bikeY = groundH;
          this.velY = 0;
          this.isAirborne = false;
          this.isGliding = false;
          this.pelicanBike.squashY = 0.84; // soft landing squash!
          this.world.spawnBurst(
            new THREE.Vector3(this.bikeX, this.bikeY + 0.06, 0),
            6,
            0xe6d3ad,
            0.65,
            5
          );
        }
      } else {
        this.bikeY = THREE.MathUtils.lerp(this.bikeY, groundH, Math.min(1, dt * 18));
      }
    }

    this.pelicanBike.root.position.set(this.bikeX, this.bikeY, 0);

    // 5. Update Pelican & Bike articulated rig
    const isCoasting = brakePressed || this.isAirborne;
    this.pelicanBike.update(dt, {
      speed: this.speed,
      velY: this.velY,
      steerInput: this.steerSmooth,
      isCoasting,
      isAirborne: this.isAirborne,
      isGliding: this.isGliding,
      isSprinting: sprintPressed || this.boostBurst > 0.6,
      isPaused: this.isPaused,
      time: this.elapsed,
    });

    // 6. Update HUD speed & audio wind/freewheel
    const kmh = Math.round(this.speed * 3.6);
    this.elSpeedReadout.textContent = `${this.isPaused ? 0 : kmh} km/h`;
    this.sound.updateRide(dt, this.speed / 12, isCoasting, this.isPaused);

    // 7. Smooth follow + orbit camera
    const preset = CAMERA_PRESETS[this.presetIndex];
    this.camYaw = THREE.MathUtils.lerp(this.camYaw, preset.yaw, Math.min(1, dt * 5.5));
    this.camPitch = THREE.MathUtils.lerp(this.camPitch, preset.pitch, Math.min(1, dt * 5.5));
    this.camDist = THREE.MathUtils.lerp(this.camDist, preset.dist, Math.min(1, dt * 5.5));
    this.camTargetY = THREE.MathUtils.lerp(
      this.camTargetY,
      preset.targetY + this.bikeY * 0.55,
      Math.min(1, dt * 6)
    );

    const totalYaw = this.camYaw + this.manualOrbitYaw;
    const totalPitch = THREE.MathUtils.clamp(this.camPitch + this.manualOrbitPitch, 0.04, 1.05);
    const totalDist = THREE.MathUtils.clamp(this.camDist + this.manualOrbitDist, 2.0, 8.0);

    // Subtle speed breath on camera distance (disabled under reduced-motion)
    const speedFovBoost = this.reducedMotion ? 0 : Math.max(0, (this.speed - 6.2) * 0.6);
    const baseFov = window.innerWidth < 440 ? 52 : 46;
    const desiredFov = baseFov + speedFovBoost;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, desiredFov, Math.min(1, dt * 5));
      this.camera.updateProjectionMatrix();
    }

    const targetX = this.bikeX * 0.68;
    const targetZ = -0.08;
    const camX = targetX + Math.sin(totalYaw) * Math.cos(totalPitch) * totalDist;
    const camY = this.camTargetY + Math.sin(totalPitch) * totalDist;
    const camZ = targetZ + Math.cos(totalYaw) * Math.cos(totalPitch) * totalDist;

    this.camera.position.set(camX, Math.max(0.45, camY), camZ);
    this.camera.lookAt(targetX, this.camTargetY, targetZ);

    this.renderer.render(this.scene, this.camera);
  }
}

new App();
