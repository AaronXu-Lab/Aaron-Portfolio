// Controls Manager for Pelican Coast Cruiser
// Full mobile multi-touch support + responsive desktop keyboard controls

export class Controls {
  constructor(canvas, onAction) {
    this.canvas = canvas;
    this.onAction = onAction;

    // Movement state
    this.steerInput = 0; // -1 to 1
    this.isAccelerating = false;
    this.isBraking = false;
    this.isSprinting = false;

    // Camera orbit controls state (for orbit camera mode)
    this.orbitAngles = { theta: 0, phi: 0.25 };
    this.isDraggingOrbit = false;
    this.dragStart = { x: 0, y: 0 };

    this.keysDown = {};

    this.setupKeyboard();
    this.setupTouchGestures();
    this.setupUIButtons();
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Prevent default scrolling for game keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      this.keysDown[e.code] = true;

      // Single-trigger actions
      if (e.code === 'KeyB') {
        this.onAction('bell');
      } else if (e.code === 'KeyE') {
        this.onAction('gulp');
      } else if (e.code === 'KeyC') {
        this.onAction('camera');
      } else if (e.code === 'KeyT') {
        this.onAction('time');
      } else if (e.code === 'KeyM') {
        this.onAction('sound');
      } else if (e.code === 'KeyH' || e.key === '?') {
        this.onAction('help');
      } else if (e.code === 'Space') {
        this.onAction('jump');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
    });
  }

  setupTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastTapTime = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = performance.now();

        // Check double tap for sprint boost
        const now = performance.now();
        if (now - lastTapTime < 300) {
          this.onAction('boost');
        }
        lastTapTime = now;

        this.dragStart.x = touchStartX;
        this.dragStart.y = touchStartY;
        this.isDraggingOrbit = true;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDraggingOrbit) {
        const dx = e.touches[0].clientX - this.dragStart.x;
        const dy = e.touches[0].clientY - this.dragStart.y;
        this.dragStart.x = e.touches[0].clientX;
        this.dragStart.y = e.touches[0].clientY;

        // Pass orbit delta
        this.orbitAngles.theta -= dx * 0.008;
        this.orbitAngles.phi = Math.max(0.05, Math.min(Math.PI / 2.2, this.orbitAngles.phi + dy * 0.008));
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      this.isDraggingOrbit = false;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const deltaTime = performance.now() - touchStartTime;

      // Detect swipes
      if (deltaTime < 350) {
        // Vertical swipe up -> Jump
        if (deltaY < -40 && Math.abs(deltaY) > Math.abs(deltaX)) {
          this.onAction('jump');
        }
        // Lateral swipe -> Quick lane shift
        else if (Math.abs(deltaX) > 40) {
          if (deltaX < 0) this.onAction('dodgeLeft');
          else this.onAction('dodgeRight');
        }
      }
    }, { passive: true });

    // Mouse drag for orbit cam on desktop
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDraggingOrbit = true;
        this.dragStart.x = e.clientX;
        this.dragStart.y = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingOrbit) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.dragStart.x = e.clientX;
        this.dragStart.y = e.clientY;

        this.orbitAngles.theta -= dx * 0.008;
        this.orbitAngles.phi = Math.max(0.05, Math.min(Math.PI / 2.2, this.orbitAngles.phi + dy * 0.008));
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingOrbit = false;
    });
  }

  setupUIButtons() {
    // Touch on-screen directional & pedal buttons
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnPedal = document.getElementById('btn-pedal');
    const btnJump = document.getElementById('btn-jump');
    const btnBell = document.getElementById('btn-bell');
    const btnGulp = document.getElementById('btn-gulp');
    const btnCamera = document.getElementById('btn-camera');
    const btnTime = document.getElementById('btn-time');
    const btnSound = document.getElementById('btn-sound');
    const btnHelp = document.getElementById('btn-help');

    // Helper for touch/pointer hold
    const bindHold = (el, onStart, onEnd) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onStart();
      });
      el.addEventListener('pointerup', (e) => {
        e.preventDefault();
        onEnd();
      });
      el.addEventListener('pointerleave', onEnd);
      el.addEventListener('pointercancel', onEnd);
    };

    // Steering buttons
    bindHold(
      btnLeft,
      () => { this.touchSteer = -1; },
      () => { if (this.touchSteer === -1) this.touchSteer = 0; }
    );

    bindHold(
      btnRight,
      () => { this.touchSteer = 1; },
      () => { if (this.touchSteer === 1) this.touchSteer = 0; }
    );

    // Pedal accelerator button
    bindHold(
      btnPedal,
      () => { this.touchPedal = true; },
      () => { this.touchPedal = false; }
    );

    // Jump button
    if (btnJump) {
      btnJump.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onAction('jump');
      });
    }

    // Quick action buttons
    if (btnBell) btnBell.addEventListener('click', () => this.onAction('bell'));
    if (btnGulp) btnGulp.addEventListener('click', () => this.onAction('gulp'));
    if (btnCamera) btnCamera.addEventListener('click', () => this.onAction('camera'));
    if (btnTime) btnTime.addEventListener('click', () => this.onAction('time'));
    if (btnSound) btnSound.addEventListener('click', () => this.onAction('sound'));
    if (btnHelp) btnHelp.addEventListener('click', () => this.onAction('help'));
  }

  update() {
    // 1. Steering calculation
    let steer = 0;
    if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft']) steer -= 1;
    if (this.keysDown['KeyD'] || this.keysDown['ArrowRight']) steer += 1;
    if (this.touchSteer) steer += this.touchSteer;

    this.steerInput = THREE.MathUtils.clamp(steer, -1, 1);

    // 2. Acceleration / Pedaling
    this.isAccelerating = (
      this.keysDown['KeyW'] ||
      this.keysDown['ArrowUp'] ||
      this.touchPedal === true
    );

    // 3. Braking
    this.isBraking = (
      this.keysDown['KeyS'] ||
      this.keysDown['ArrowDown']
    );

    // 4. Sprint
    this.isSprinting = !!(this.keysDown['ShiftLeft'] || this.keysDown['ShiftRight']);
  }
}
