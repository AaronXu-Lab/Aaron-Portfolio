import * as THREE from '../vendor/three.module.min.js';
import { Bicycle } from './bike.js';
import { Pelican } from './pelican.js';
import { World } from './world.js';
import { Controls } from './controls.js';
import { sounds } from './audio.js';

class PelicanApp {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.container = document.getElementById('app-container');

    // Stats
    this.fishCaught = 0;
    this.distanceTraveled = 0;
    this.currentSpeedKmh = 18;

    // Movement physics
    this.pos = new THREE.Vector3(0, 0, 0);
    this.speed = 5.0; // m/s (~18 km/h)
    this.minSpeed = 1.5;
    this.cruiseSpeed = 5.2;
    this.maxSpeed = 9.2;
    this.sprintSpeed = 13.5;

    this.jumpY = 0;
    this.jumpVelY = 0;
    this.gravity = 24.0;
    this.isGrounded = true;

    this.steerAngle = 0;
    this.steerTarget = 0;

    // Camera modes: 'follow', 'beak', 'side', 'orbit'
    this.cameraModes = ['follow', 'beak', 'side', 'orbit'];
    this.currentCamIndex = 0;

    this.clock = new THREE.Clock();

    this.initScene();
    this.initEntities();
    this.initControls();
    this.initHUD();

    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    // Start render loop
    requestAnimationFrame((t) => this.render(t));
  }

  initScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 2.5, -4.8);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  initEntities() {
    // 1. World (Ocean, Road, Scenery, Lighting)
    this.world = new World(this.scene);

    // 2. Bicycle
    this.bike = new Bicycle();
    this.scene.add(this.bike.group);

    // 3. Pelican Rider
    this.pelican = new Pelican(this.bike);
    this.bike.group.add(this.pelican.group);
  }

  initControls() {
    this.controls = new Controls(this.canvas, (action) => this.handleAction(action));
  }

  initHUD() {
    this.hudFish = document.getElementById('stat-fish');
    this.hudDistance = document.getElementById('stat-distance');
    this.hudSpeed = document.getElementById('stat-speed');
    this.hudCamLabel = document.getElementById('label-cam');
    this.hudTimeLabel = document.getElementById('label-time');
    this.modalHelp = document.getElementById('modal-help');
    this.btnHelpClose = document.getElementById('btn-help-close');

    if (this.btnHelpClose) {
      this.btnHelpClose.addEventListener('click', () => {
        this.modalHelp.classList.add('hidden');
      });
    }

    // Dismiss help when clicking outside modal
    if (this.modalHelp) {
      this.modalHelp.addEventListener('click', (e) => {
        if (e.target === this.modalHelp) {
          this.modalHelp.classList.add('hidden');
        }
      });
    }
  }

  handleAction(action) {
    sounds.init();

    switch (action) {
      case 'bell':
        this.bike.triggerBell();
        this.world.triggerBellReactions();
        sounds.playBell();
        this.showToast('🔔 叮铃！海风拂过');
        break;

      case 'gulp':
        this.pelican.triggerGulp();
        sounds.playGulp();
        this.checkFishCatch(2.6); // Wider reach when gulping!
        break;

      case 'jump':
        if (this.isGrounded) {
          this.jumpVelY = 7.2;
          this.isGrounded = false;
          this.pelican.triggerFlap();
          sounds.playJump();
        }
        break;

      case 'boost':
        this.speed = Math.min(this.speed + 4.5, this.sprintSpeed);
        this.pelican.triggerFlap();
        sounds.playHonk();
        this.showToast('⚡ 顺风展翅冲刺！');
        break;

      case 'dodgeLeft':
        this.pos.x = Math.max(-2.2, this.pos.x - 1.2);
        break;

      case 'dodgeRight':
        this.pos.x = Math.min(2.2, this.pos.x + 1.2);
        break;

      case 'camera':
        this.currentCamIndex = (this.currentCamIndex + 1) % this.cameraModes.length;
        const camMode = this.cameraModes[this.currentCamIndex];
        const camNames = {
          follow: '跟随视角',
          beak: '鸟喙第一人称',
          side: '追焦侧拍',
          orbit: '自由环绕'
        };
        if (this.hudCamLabel) this.hudCamLabel.textContent = camNames[camMode];
        this.showToast(`📷 ${camNames[camMode]}`);
        break;

      case 'time':
        const newTime = this.world.cycleTimeOfDay();
        const timeNames = {
          day: '阳光明媚',
          sunset: '落日余晖',
          night: '星夜海风'
        };
        if (this.hudTimeLabel) this.hudTimeLabel.textContent = timeNames[newTime];
        this.showToast(`🌅 ${timeNames[newTime]}`);
        break;

      case 'sound':
        const muted = sounds.toggleMute();
        const btnSound = document.getElementById('btn-sound');
        if (btnSound) {
          btnSound.innerHTML = muted ? '🔇' : '🔊';
        }
        this.showToast(muted ? '🔇 静音' : '🔊 声音开启');
        break;

      case 'help':
        if (this.modalHelp) {
          this.modalHelp.classList.toggle('hidden');
        }
        break;
    }
  }

  showToast(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden', 'fade-out');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.classList.add('hidden'), 400);
    }, 1400);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  checkFishCatch(reachRadius = 1.4) {
    const pelicanHeadPos = new THREE.Vector3();
    this.pelican.headGroup.getWorldPosition(pelicanHeadPos);

    for (let i = this.world.collectibles.length - 1; i >= 0; i--) {
      const fish = this.world.collectibles[i];
      if (fish.isCollected) continue;

      const dist = fish.position.distanceTo(pelicanHeadPos);
      if (dist < reachRadius) {
        fish.isCollected = true;
        this.world.scene.remove(fish);
        this.world.collectibles.splice(i, 1);

        this.fishCaught++;
        sounds.playCatch();
        this.pelican.triggerGulp();
        this.showToast(`✨ 捕获飞鱼！总计 ${this.fishCaught} 尾`);

        if (this.hudFish) this.hudFish.textContent = this.fishCaught;
      }
    }
  }

  updatePhysics(dt) {
    this.controls.update();

    // 1. Acceleration / Sprint / Braking
    let targetSpeed = this.cruiseSpeed;
    if (this.controls.isSprinting) {
      targetSpeed = this.sprintSpeed;
    } else if (this.controls.isAccelerating) {
      targetSpeed = this.maxSpeed;
    } else if (this.controls.isBraking) {
      targetSpeed = this.minSpeed;
    }

    const accelRate = this.controls.isBraking ? 9.0 : 4.5;
    this.speed += (targetSpeed - this.speed) * Math.min(dt * accelRate, 1.0);

    // 2. Forward Movement
    const deltaZ = this.speed * dt;
    this.pos.z += deltaZ;
    this.distanceTraveled += deltaZ / 1000; // in km

    // 3. Lateral Steering
    const steerInput = this.controls.steerInput;
    this.steerTarget = steerInput * 0.42;

    const lateralSpeed = steerInput * (2.8 + this.speed * 0.25);
    this.pos.x += lateralSpeed * dt;
    // Keep bicycle safely on boardwalk
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -2.2, 2.2);

    // 4. Jump & Gravity
    if (!this.isGrounded) {
      this.jumpY += this.jumpVelY * dt;
      this.jumpVelY -= this.gravity * dt;

      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpVelY = 0;
        this.isGrounded = true;
      }
    }

    // 5. Update Bike World Position & Orientation
    this.bike.group.position.set(this.pos.x, this.jumpY, this.pos.z);

    // Subtle road vibration bump
    const roadBump = Math.sin(this.pos.z * 5.0) * 0.008;
    this.bike.group.position.y += roadBump;

    // 6. Check Fish Catching (normal proximity)
    this.checkFishCatch(1.35);

    // 7. Update HUD
    this.currentSpeedKmh = Math.round(this.speed * 3.6);
    if (this.hudSpeed) this.hudSpeed.textContent = this.currentSpeedKmh;
    if (this.hudDistance) this.hudDistance.textContent = this.distanceTraveled.toFixed(2);

    // 8. Audio ambient sound update
    const speedRatio = (this.speed - this.minSpeed) / (this.sprintSpeed - this.minSpeed);
    sounds.updateWind(speedRatio);
  }

  updateCamera(dt) {
    const camMode = this.cameraModes[this.currentCamIndex];
    const targetPos = new THREE.Vector3();
    const lookAtPos = new THREE.Vector3();

    if (camMode === 'follow') {
      // Dynamic follow cam with gentle smoothing
      const lateralLag = this.pos.x * 0.65;
      const targetCamPos = new THREE.Vector3(
        lateralLag,
        2.2 + this.jumpY * 0.4,
        this.pos.z - 4.5
      );
      this.camera.position.lerp(targetCamPos, Math.min(dt * 7, 1.0));

      lookAtPos.set(this.pos.x * 0.9, 1.3 + this.jumpY * 0.5, this.pos.z + 3.0);
      this.camera.lookAt(lookAtPos);

    } else if (camMode === 'beak') {
      // First-person perspective looking down beak
      const headWorldPos = new THREE.Vector3();
      this.pelican.headGroup.getWorldPosition(headWorldPos);

      this.camera.position.copy(headWorldPos).add(new THREE.Vector3(0, 0.08, 0.12));
      lookAtPos.set(this.pos.x + this.bike.steerAngle * 1.5, 1.2 + this.jumpY, this.pos.z + 8.0);
      this.camera.lookAt(lookAtPos);

    } else if (camMode === 'side') {
      // Low cinematic tracking angle showcasing full pedaling animation
      targetPos.set(
        this.pos.x - 3.8,
        1.1 + this.jumpY * 0.3,
        this.pos.z - 0.4
      );
      this.camera.position.lerp(targetPos, Math.min(dt * 8, 1.0));
      lookAtPos.set(this.pos.x, 1.0 + this.jumpY, this.pos.z + 0.5);
      this.camera.lookAt(lookAtPos);

    } else if (camMode === 'orbit') {
      // Free drag orbit around the pelican
      const angles = this.controls.orbitAngles;
      const radius = 4.2;
      const ox = radius * Math.cos(angles.phi) * Math.sin(angles.theta);
      const oy = radius * Math.sin(angles.phi);
      const oz = radius * Math.cos(angles.phi) * Math.cos(angles.theta);

      targetPos.set(this.pos.x + ox, 1.0 + this.jumpY + oy, this.pos.z + oz);
      this.camera.position.lerp(targetPos, Math.min(dt * 10, 1.0));
      lookAtPos.set(this.pos.x, 1.0 + this.jumpY, this.pos.z);
      this.camera.lookAt(lookAtPos);
    }
  }

  render(timestamp) {
    requestAnimationFrame((t) => this.render(t));

    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Update Physics & Controls
    this.updatePhysics(dt);

    // Update 3D Bicycle
    const isNight = this.world.timeOfDay === 'night';
    this.bike.update(dt, this.speed, this.steerTarget, isNight);

    // Update 3D Pelican Character
    this.pelican.update(
      dt,
      this.speed,
      this.steerTarget,
      !this.isGrounded,
      this.controls.isSprinting
    );

    // Update Procedural World (Ocean, Road loop, Birds, Fish)
    this.world.update(dt, this.speed, this.pos.z, () => this.checkFishCatch());

    // Update Camera
    this.updateCamera(dt);

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.pelicanApp = new PelicanApp();
});
