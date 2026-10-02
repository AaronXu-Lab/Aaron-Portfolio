import * as THREE from '../vendor/three.module.min.js';

export class Bicycle {
  constructor() {
    this.group = new THREE.Group();

    // Key dimensions
    this.wheelRadius = 0.44;
    this.wheelBase = 1.38;
    this.rearWheelPos = new THREE.Vector3(0, 0.44, -0.66);
    this.frontWheelPos = new THREE.Vector3(0, 0.44, 0.72);
    this.bbPos = new THREE.Vector3(0, 0.38, 0.0); // Bottom bracket
    this.saddlePos = new THREE.Vector3(0, 0.94, -0.22);
    this.crankLength = 0.18;
    this.pedalOffset = 0.14; // half-width between pedals

    this.wheelAngle = 0;
    this.crankAngle = 0;
    this.steerAngle = 0;
    this.leanAngle = 0;

    // Materials
    this.matFrame = new THREE.MeshStandardMaterial({
      color: 0x229e96, // Coastal seafoam mint
      roughness: 0.28,
      metalness: 0.35
    });

    this.matChrome = new THREE.MeshStandardMaterial({
      color: 0xe6edf2,
      roughness: 0.15,
      metalness: 0.88
    });

    this.matBrass = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.75
    });

    this.matTire = new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      roughness: 0.85,
      metalness: 0.05
    });

    this.matGumwall = new THREE.MeshStandardMaterial({
      color: 0xcc9966, // Classic vintage tan wall
      roughness: 0.7,
      metalness: 0.05
    });

    this.matLeather = new THREE.MeshStandardMaterial({
      color: 0x6e3820, // Rich warm brown leather
      roughness: 0.55,
      metalness: 0.1
    });

    this.matWicker = new THREE.MeshStandardMaterial({
      color: 0xd6a667,
      roughness: 0.75,
      metalness: 0.05
    });

    this.matHeadlightLens = new THREE.MeshStandardMaterial({
      color: 0xfff3cc,
      emissive: 0xffe082,
      emissiveIntensity: 0.7,
      roughness: 0.1,
      metalness: 0.1
    });

    this.matBellWave = new THREE.MeshBasicMaterial({
      color: 0xffea79,
      transparent: true,
      opacity: 0,
      wireframe: true
    });

    this.buildBicycle();
  }

  createTube(p1, p2, radius, material) {
    const direction = new THREE.Vector3().subVectors(p2, p1);
    const length = direction.length();
    const geom = new THREE.CylinderGeometry(radius, radius, length, 12);
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Orient cylinder (default along Y) along direction vector
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  createWheel() {
    const wheelGroup = new THREE.Group();

    // Tire
    const tireGeom = new THREE.TorusGeometry(this.wheelRadius, 0.045, 12, 28);
    const tire = new THREE.Mesh(tireGeom, this.matTire);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Gumwall sidewall rim
    const rimGeom = new THREE.TorusGeometry(this.wheelRadius - 0.02, 0.03, 10, 24);
    const rim = new THREE.Mesh(rimGeom, this.matGumwall);
    rim.rotation.y = Math.PI / 2;
    wheelGroup.add(rim);

    // Chrome rim hoop
    const innerRimGeom = new THREE.TorusGeometry(this.wheelRadius - 0.045, 0.015, 8, 24);
    const innerRim = new THREE.Mesh(innerRimGeom, this.matChrome);
    innerRim.rotation.y = Math.PI / 2;
    wheelGroup.add(innerRim);

    // Hub
    const hubGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10);
    const hub = new THREE.Mesh(hubGeom, this.matChrome);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    // Radial Spokes
    const spokeGeom = new THREE.CylinderGeometry(0.003, 0.003, this.wheelRadius * 1.88, 4);
    const spokeMat = this.matChrome;
    const numSpokes = 8;
    for (let i = 0; i < numSpokes; i++) {
      const spoke = new THREE.Mesh(spokeGeom, spokeMat);
      spoke.rotation.x = (i * Math.PI) / numSpokes;
      spoke.position.x = (i % 2 === 0 ? 0.02 : -0.02);
      wheelGroup.add(spoke);
    }

    return wheelGroup;
  }

  buildBicycle() {
    // 1. Rear Wheel
    this.rearWheel = this.createWheel();
    this.rearWheel.position.copy(this.rearWheelPos);
    this.group.add(this.rearWheel);

    // 2. Main Frame
    const headTubeTop = new THREE.Vector3(0, 0.98, 0.52);
    const headTubeBottom = new THREE.Vector3(0, 0.76, 0.58);
    const seatTubeTop = new THREE.Vector3(0, 0.86, -0.18);

    // Head tube
    this.group.add(this.createTube(headTubeBottom, headTubeTop, 0.032, this.matFrame));

    // Seat tube
    this.group.add(this.createTube(this.bbPos, seatTubeTop, 0.028, this.matFrame));

    // Down tube
    this.group.add(this.createTube(this.bbPos, headTubeBottom, 0.03, this.matFrame));

    // Curved cruiser top tube (2 segments arch)
    const topTubeMid = new THREE.Vector3(0, 0.95, 0.18);
    this.group.add(this.createTube(headTubeTop, topTubeMid, 0.026, this.matFrame));
    this.group.add(this.createTube(topTubeMid, seatTubeTop, 0.026, this.matFrame));

    // Secondary lower curve for beach cruiser aesthetic
    const twinTubeMid = new THREE.Vector3(0, 0.85, 0.16);
    this.group.add(this.createTube(headTubeBottom, twinTubeMid, 0.02, this.matFrame));
    this.group.add(this.createTube(twinTubeMid, this.bbPos, 0.02, this.matFrame));

    // Chain stays (BB to rear dropouts)
    const rearDropLeft = new THREE.Vector3(-0.065, this.rearWheelPos.y, this.rearWheelPos.z);
    const rearDropRight = new THREE.Vector3(0.065, this.rearWheelPos.y, this.rearWheelPos.z);
    this.group.add(this.createTube(this.bbPos, rearDropLeft, 0.016, this.matFrame));
    this.group.add(this.createTube(this.bbPos, rearDropRight, 0.016, this.matFrame));

    // Seat stays (Seat tube top to rear dropouts)
    this.group.add(this.createTube(seatTubeTop, rearDropLeft, 0.016, this.matFrame));
    this.group.add(this.createTube(seatTubeTop, rearDropRight, 0.016, this.matFrame));

    // Rear Luggage Rack
    this.buildRearRack(seatTubeTop, rearDropLeft, rearDropRight);

    // 3. Saddle
    this.buildSaddle(seatTubeTop);

    // 4. Drivetrain & Cranks
    this.buildDrivetrain();

    // 5. Front Steer Assembly (Fork, Front Wheel, Handlebars, Basket, Headlight, Bell)
    this.buildSteerAssembly(headTubeTop, headTubeBottom);

    // Shadow optimization
    this.group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  buildRearRack(seatTop, dropL, dropR) {
    const rackTop = new THREE.Group();
    const rackPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.42),
      this.matChrome
    );
    rackPlate.position.set(0, 0.84, -0.62);
    rackTop.add(rackPlate);

    // Wooden slat inlays on rack
    for (let z = -0.15; z <= 0.15; z += 0.075) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.012, 0.05),
        this.matWicker
      );
      slat.position.set(0, 0.852, -0.62 + z);
      rackTop.add(slat);
    }

    // Support stays
    this.group.add(this.createTube(new THREE.Vector3(0, 0.84, -0.45), seatTop, 0.012, this.matChrome));
    this.group.add(this.createTube(new THREE.Vector3(-0.07, 0.84, -0.72), dropL, 0.012, this.matChrome));
    this.group.add(this.createTube(new THREE.Vector3(0.07, 0.84, -0.72), dropR, 0.012, this.matChrome));
    this.group.add(rackTop);
  }

  buildSaddle(seatTop) {
    const seatPost = this.createTube(seatTop, this.saddlePos, 0.022, this.matChrome);
    this.group.add(seatPost);

    const saddleGroup = new THREE.Group();
    saddleGroup.position.copy(this.saddlePos);

    // Broad comfortable cruiser saddle
    const saddleGeom = new THREE.ConeGeometry(0.13, 0.28, 5);
    saddleGeom.rotateX(Math.PI / 2);
    saddleGeom.scale(1.3, 0.45, 1.0);
    const saddle = new THREE.Mesh(saddleGeom, this.matLeather);
    saddle.position.set(0, 0.04, -0.04);
    saddleGroup.add(saddle);

    // Rear chrome springs under saddle
    for (const sx of [-0.07, 0.07]) {
      const spring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8),
        this.matChrome
      );
      spring.position.set(sx, -0.01, -0.1);
      saddleGroup.add(spring);
    }
    this.group.add(saddleGroup);
  }

  buildDrivetrain() {
    this.cranksetGroup = new THREE.Group();
    this.cranksetGroup.position.copy(this.bbPos);

    // Chainring
    const chainringGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.008, 18);
    chainringGeom.rotateZ(Math.PI / 2);
    const chainring = new THREE.Mesh(chainringGeom, this.matChrome);
    chainring.position.x = 0.055;
    this.cranksetGroup.add(chainring);

    // Right crank arm & pedal
    this.rightCrank = new THREE.Group();
    const rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, this.crankLength, 0.012),
      this.matChrome
    );
    rightArm.position.set(0.06, -this.crankLength / 2, 0);
    this.rightCrank.add(rightArm);

    this.rightPedal = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.09),
      this.matChrome
    );
    this.rightPedal.position.set(0.06 + this.pedalOffset, -this.crankLength, 0);
    this.rightCrank.add(this.rightPedal);
    this.cranksetGroup.add(this.rightCrank);

    // Left crank arm & pedal (180 deg opposite)
    this.leftCrank = new THREE.Group();
    this.leftCrank.rotation.x = Math.PI;
    const leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, this.crankLength, 0.012),
      this.matChrome
    );
    leftArm.position.set(-0.06, -this.crankLength / 2, 0);
    this.leftCrank.add(leftArm);

    this.leftPedal = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.09),
      this.matChrome
    );
    this.leftPedal.position.set(-0.06 - this.pedalOffset, -this.crankLength, 0);
    this.leftCrank.add(this.leftPedal);
    this.cranksetGroup.add(this.leftCrank);

    this.group.add(this.cranksetGroup);
  }

  buildSteerAssembly(headTop, headBottom) {
    this.steerGroup = new THREE.Group();
    this.steerGroup.position.copy(headTop);

    // Stem post
    const stemGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10);
    const stem = new THREE.Mesh(stemGeom, this.matChrome);
    stem.position.set(0, 0.06, 0);
    this.steerGroup.add(stem);

    // Handlebar curve
    const barCenter = new THREE.Vector3(0, 0.15, -0.02);
    const barLeft = new THREE.Vector3(-0.29, 0.13, -0.16);
    const barRight = new THREE.Vector3(0.29, 0.13, -0.16);

    const barCurveL = new THREE.QuadraticBezierCurve3(barCenter, new THREE.Vector3(-0.16, 0.18, -0.04), barLeft);
    const barCurveR = new THREE.QuadraticBezierCurve3(barCenter, new THREE.Vector3(0.16, 0.18, -0.04), barRight);

    const tubeGeomL = new THREE.TubeGeometry(barCurveL, 10, 0.015, 8, false);
    const tubeGeomR = new THREE.TubeGeometry(barCurveR, 10, 0.015, 8, false);
    this.steerGroup.add(new THREE.Mesh(tubeGeomL, this.matChrome));
    this.steerGroup.add(new THREE.Mesh(tubeGeomR, this.matChrome));

    // Handlebar Grips
    const gripGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.11, 10);
    gripGeom.rotateX(Math.PI / 2.3);

    const gripL = new THREE.Mesh(gripGeom, this.matLeather);
    gripL.position.copy(barLeft).add(new THREE.Vector3(0, 0, 0.02));
    this.steerGroup.add(gripL);

    const gripR = new THREE.Mesh(gripGeom, this.matLeather);
    gripR.position.copy(barRight).add(new THREE.Vector3(0, 0, 0.02));
    this.steerGroup.add(gripR);

    // Bell on left handlebar
    this.bellGroup = new THREE.Group();
    this.bellGroup.position.set(-0.21, 0.20, -0.09);
    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), this.matBrass);
    this.bellGroup.add(bellDome);

    this.bellStriker = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.015, 0.025), this.matChrome);
    this.bellStriker.position.set(0.025, 0.01, -0.015);
    this.bellGroup.add(this.bellStriker);

    // Sonic wave ring (expands when bell rings)
    this.bellWave = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.06, 24), this.matBellWave);
    this.bellWave.rotation.x = -Math.PI / 2;
    this.bellWave.position.y = 0.04;
    this.bellGroup.add(this.bellWave);

    this.steerGroup.add(this.bellGroup);

    // Front fork legs down to front wheel
    const frontAxleLocal = new THREE.Vector3().subVectors(this.frontWheelPos, headTop);
    const forkL = this.createTube(new THREE.Vector3(-0.05, -0.22, 0.06), new THREE.Vector3(-0.05, frontAxleLocal.y, frontAxleLocal.z), 0.018, this.matFrame);
    const forkR = this.createTube(new THREE.Vector3(0.05, -0.22, 0.06), new THREE.Vector3(0.05, frontAxleLocal.y, frontAxleLocal.z), 0.018, this.matFrame);
    const forkCrown = this.createTube(new THREE.Vector3(-0.05, -0.22, 0.06), new THREE.Vector3(0.05, -0.22, 0.06), 0.022, this.matChrome);
    this.steerGroup.add(forkL);
    this.steerGroup.add(forkR);
    this.steerGroup.add(forkCrown);

    // Front wheel mounted to steer assembly
    this.frontWheel = this.createWheel();
    this.frontWheel.position.copy(frontAxleLocal);
    this.steerGroup.add(this.frontWheel);

    // Front Vintage Headlight
    const headlightBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.09, 12), this.matChrome);
    headlightBody.rotation.x = Math.PI / 2;
    headlightBody.position.set(0, -0.16, 0.12);
    this.steerGroup.add(headlightBody);

    const headlightLens = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.matHeadlightLens);
    headlightLens.rotation.x = -Math.PI / 2;
    headlightLens.position.set(0, -0.16, 0.165);
    this.steerGroup.add(headlightLens);

    // Headlight dynamic spot light
    this.headlightSpot = new THREE.SpotLight(0xfff1cf, 2.5, 24, Math.PI / 5, 0.4, 1.2);
    this.headlightSpot.position.set(0, -0.16, 0.2);
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, -0.5, 6.0);
    this.steerGroup.add(this.headlightTarget);
    this.headlightSpot.target = this.headlightTarget;
    this.steerGroup.add(this.headlightSpot);

    // Front Wicker Basket with Caught Fish!
    this.buildBasket();

    this.group.add(this.steerGroup);
  }

  buildBasket() {
    this.basketGroup = new THREE.Group();
    this.basketGroup.position.set(0, 0.04, 0.18);

    // Wicker basket box
    const basketBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.19, 0.22),
      this.matWicker
    );
    this.basketGroup.add(basketBox);

    // Wicker border rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.015, 6, 16),
      this.matLeather
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.1;
    this.basketGroup.add(rim);

    // 2-3 Cute Golden Fish poking out of basket
    this.basketFish = [];
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      roughness: 0.3,
      metalness: 0.4
    });

    for (let i = 0; i < 3; i++) {
      const fish = new THREE.Group();
      const fishBody = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 6), fishMat);
      fishBody.rotation.x = Math.PI * 0.7;
      fish.add(fishBody);

      const fishTail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, 0.04), fishMat);
      fishTail.position.set(0, 0.06, -0.06);
      fish.add(fishTail);

      fish.position.set((i - 1) * 0.08, 0.06, (i % 2 === 0 ? 0.03 : -0.03));
      fish.rotation.z = (i - 1) * 0.25;
      this.basketGroup.add(fish);
      this.basketFish.push(fish);
    }

    this.steerGroup.add(this.basketGroup);
  }

  // Getters for pelican's kinematics
  getSaddleWorldPosition() {
    const pos = new THREE.Vector3();
    this.group.localToWorld(pos.copy(this.saddlePos));
    return pos;
  }

  getHandlebarGripPositions() {
    // Local grips inside steerGroup
    const leftLocal = new THREE.Vector3(-0.29, 0.13, -0.16);
    const rightLocal = new THREE.Vector3(0.29, 0.13, -0.16);

    const leftWorld = new THREE.Vector3();
    const rightWorld = new THREE.Vector3();

    this.steerGroup.localToWorld(leftWorld.copy(leftLocal));
    this.steerGroup.localToWorld(rightWorld.copy(rightLocal));

    return { left: leftWorld, right: rightWorld };
  }

  getPedalPositions() {
    // Current crank rotation angle
    const cosA = Math.cos(this.crankAngle);
    const sinA = Math.sin(this.crankAngle);

    // Right pedal: arm along (0, -crankLength, 0) rotated by crankAngle around X
    const rightOffset = new THREE.Vector3(
      0.06 + this.pedalOffset,
      -this.crankLength * cosA,
      this.crankLength * sinA
    );
    const rightLocal = new THREE.Vector3().addVectors(this.bbPos, rightOffset);

    // Left pedal is 180° opposite
    const leftOffset = new THREE.Vector3(
      -0.06 - this.pedalOffset,
      this.crankLength * cosA,
      -this.crankLength * sinA
    );
    const leftLocal = new THREE.Vector3().addVectors(this.bbPos, leftOffset);

    const rightWorld = new THREE.Vector3();
    const leftWorld = new THREE.Vector3();
    this.group.localToWorld(rightWorld.copy(rightLocal));
    this.group.localToWorld(leftWorld.copy(leftLocal));

    return {
      right: rightWorld,
      left: leftWorld,
      rightLocal,
      leftLocal
    };
  }

  triggerBell() {
    this.bellRingTime = 0;
  }

  update(dt, speed, steerTarget, isNight) {
    // 1. Wheel & Crank rotation synchronized with speed
    const wheelCircumference = 2 * Math.PI * this.wheelRadius;
    const wheelDelta = (speed * dt) / this.wheelRadius;
    this.wheelAngle += wheelDelta;

    // Pedaling gear ratio (1.8x crank rotations per wheel rotation)
    this.crankAngle += wheelDelta * 0.75;

    // Spin rear wheel
    this.rearWheel.rotation.x = this.wheelAngle;
    // Spin front wheel
    this.frontWheel.rotation.x = this.wheelAngle;

    // Rotate crankset
    this.cranksetGroup.rotation.x = this.crankAngle;
    // Keep pedals horizontal relative to bike
    this.rightPedal.rotation.x = -this.crankAngle;
    this.leftPedal.rotation.x = this.crankAngle; // left crank is already inverted

    // 2. Steering & Dynamic Banking/Lean
    this.steerAngle += (steerTarget - this.steerAngle) * Math.min(dt * 12, 1.0);
    this.steerGroup.rotation.y = this.steerAngle;

    // Centrifugal lean into turns
    const targetLean = -this.steerAngle * 0.65 * Math.min(speed / 4, 1.3);
    this.leanAngle += (targetLean - this.leanAngle) * Math.min(dt * 8, 1.0);
    this.group.rotation.z = this.leanAngle;

    // 3. Basket fish flopping with bicycle motion
    if (this.basketFish && this.basketFish.length) {
      const flop = Math.sin(this.wheelAngle * 4) * 0.15;
      this.basketFish.forEach((f, idx) => {
        f.rotation.x = Math.PI * 0.7 + flop * (idx % 2 === 0 ? 1 : -1);
      });
    }

    // 4. Bell animation & sonic wave
    if (this.bellRingTime !== undefined && this.bellRingTime < 0.6) {
      this.bellRingTime += dt;
      const t = this.bellRingTime / 0.6;
      this.bellStriker.rotation.y = Math.sin(t * Math.PI * 16) * 0.25;
      this.bellWave.scale.setScalar(1 + t * 4.5);
      this.matBellWave.opacity = (1 - t) * 0.85;
    } else {
      this.matBellWave.opacity = 0;
      this.bellStriker.rotation.y = 0;
    }

    // 5. Headlight intensity toggle
    if (isNight) {
      this.headlightSpot.intensity = 3.5;
      this.matHeadlightLens.emissiveIntensity = 1.0;
    } else {
      this.headlightSpot.intensity = 0.5;
      this.matHeadlightLens.emissiveIntensity = 0.4;
    }
  }
}
