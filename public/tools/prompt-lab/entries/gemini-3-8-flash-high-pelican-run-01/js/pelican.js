import * as THREE from '../vendor/three.module.min.js';

export class Pelican {
  constructor(bike) {
    this.bike = bike;
    this.group = new THREE.Group();

    // State variables
    this.isFlapping = false;
    this.flapTimer = 0;
    this.blinkTimer = 0;
    this.gulpTimer = 0;
    this.swallowBulge = 0;
    this.windJiggle = 0;

    // Materials
    this.matFeathers = new THREE.MeshStandardMaterial({
      color: 0xfcfdfd, // Bright white/ivory plumage
      roughness: 0.65,
      metalness: 0.05
    });

    this.matWingTips = new THREE.MeshStandardMaterial({
      color: 0x2b333c, // Dark slate charcoal primary flight feathers
      roughness: 0.7,
      metalness: 0.1
    });

    this.matBeak = new THREE.MeshStandardMaterial({
      color: 0xff9900, // Vibrant sunny pelican beak orange
      roughness: 0.35,
      metalness: 0.1
    });

    this.matPouch = new THREE.MeshStandardMaterial({
      color: 0xfcb040, // Elastic translucent throat pouch
      roughness: 0.5,
      metalness: 0.05
    });

    this.matFeet = new THREE.MeshStandardMaterial({
      color: 0xf37021, // Webbed feet orange
      roughness: 0.45,
      metalness: 0.05
    });

    this.matCap = new THREE.MeshStandardMaterial({
      color: 0x182433, // Navy blue sailor cap
      roughness: 0.5,
      metalness: 0.2
    });

    this.matGold = new THREE.MeshStandardMaterial({
      color: 0xefc034, // Captain anchor badge gold
      roughness: 0.25,
      metalness: 0.8
    });

    this.matScarf = new THREE.MeshStandardMaterial({
      color: 0xe63946, // Vibrant coral crimson scarf
      roughness: 0.65,
      metalness: 0.05
    });

    this.matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.matEyePupil = new THREE.MeshBasicMaterial({ color: 0x111111 });

    this.buildPelican();
  }

  buildPelican() {
    // Root pelican pelvis/torso group
    this.pelvis = new THREE.Group();
    this.group.add(this.pelvis);

    // 1. Torso / Body (Teardrop plump shape)
    const bodyGeom = new THREE.SphereGeometry(0.24, 16, 12);
    bodyGeom.scale(0.85, 1.15, 1.35);
    this.bodyMesh = new THREE.Mesh(bodyGeom, this.matFeathers);
    this.bodyMesh.position.set(0, 0.22, 0.06);
    this.bodyMesh.rotation.x = 0.35; // Leaning forward slightly towards handlebars
    this.pelvis.add(this.bodyMesh);

    // Fluffy tail feathers
    const tailGeom = new THREE.ConeGeometry(0.12, 0.25, 5);
    tailGeom.rotateX(-Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeom, this.matWingTips);
    tailMesh.position.set(0, 0.26, -0.32);
    tailMesh.rotation.x = -0.25;
    this.pelvis.add(tailMesh);

    // 2. Articulated Swan-curve Neck
    this.neckBase = new THREE.Group();
    this.neckBase.position.set(0, 0.38, 0.22);
    this.pelvis.add(this.neckBase);

    const neck1Geom = new THREE.CylinderGeometry(0.08, 0.09, 0.22, 10);
    this.neck1 = new THREE.Mesh(neck1Geom, this.matFeathers);
    this.neck1.position.set(0, 0.1, 0);
    this.neck1.rotation.x = 0.45;
    this.neckBase.add(this.neck1);

    this.neckMid = new THREE.Group();
    this.neckMid.position.set(0, 0.20, 0.08);
    this.neckBase.add(this.neckMid);

    const neck2Geom = new THREE.CylinderGeometry(0.07, 0.08, 0.22, 10);
    this.neck2 = new THREE.Mesh(neck2Geom, this.matFeathers);
    this.neck2.position.set(0, 0.1, 0);
    this.neck2.rotation.x = -0.3;
    this.neckMid.add(this.neck2);

    // Swallowing food bulge mesh (travels down neck!)
    this.foodBulge = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.matPouch);
    this.foodBulge.scale.set(1.2, 0.8, 1.2);
    this.foodBulge.visible = false;
    this.neckBase.add(this.foodBulge);

    // 3. Head & Captain Cap
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.22, -0.04);
    this.neckMid.add(this.headGroup);

    const headGeom = new THREE.SphereGeometry(0.13, 14, 12);
    headGeom.scale(0.9, 1.0, 1.15);
    const headMesh = new THREE.Mesh(headGeom, this.matFeathers);
    this.headGroup.add(headMesh);

    // Captain Sailor Cap
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.12, 0.02);
    capGroup.rotation.x = 0.15;

    const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.07, 16), this.matCap);
    capGroup.add(capBase);

    // Gold braided band
    const capBraid = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.012, 6, 16), this.matGold);
    capBraid.rotation.x = Math.PI / 2;
    capBraid.position.y = -0.015;
    capGroup.add(capBraid);

    // Gold Anchor badge
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 10), this.matGold);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 0.01, 0.135);
    capGroup.add(badge);

    // Visor / Brim
    const visorGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.012, 16, 1, false, -Math.PI / 3, (Math.PI * 2) / 3);
    const capVisor = new THREE.Mesh(visorGeom, this.matCap);
    capVisor.position.set(0, -0.025, 0.06);
    capVisor.rotation.x = 0.35;
    capGroup.add(capVisor);

    this.headGroup.add(capGroup);

    // Eyes (expressive big eyes with blinking eyelids)
    this.eyes = [];
    for (const sx of [-0.09, 0.09]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(sx, 0.04, 0.09);

      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), this.matEyeWhite);
      eyeGroup.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), this.matEyePupil);
      pupil.position.set(0, 0, 0.025);
      eyeGroup.add(pupil);

      // Eyelid for blinking
      const eyelidGeom = new THREE.SphereGeometry(0.042, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const eyelid = new THREE.Mesh(eyelidGeom, this.matFeathers);
      eyelid.rotation.x = -Math.PI / 2;
      eyelid.position.set(0, 0.01, 0);
      eyelid.visible = false;
      eyeGroup.add(eyelid);

      this.headGroup.add(eyeGroup);
      this.eyes.push({ group: eyeGroup, pupil, eyelid });
    }

    // 4. Iconic Huge Pelican Beak & Elastic Throat Pouch
    this.buildBeak();

    // 5. Trailing Crimson Scarf
    this.buildScarf();

    // 6. Wings (Dual mode: Gripping handlebars or Flapping)
    this.buildWings();

    // 7. Legs & Webbed Feet (2-bone IK hooked to pedals)
    this.buildLegs();

    // Shadows
    this.group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  buildBeak() {
    this.beakGroup = new THREE.Group();
    this.beakGroup.position.set(0, -0.01, 0.12);
    this.headGroup.add(this.beakGroup);

    // Upper Mandible (Long arched bill with hook at tip)
    const upperBillGeom = new THREE.ConeGeometry(0.075, 0.52, 6);
    upperBillGeom.rotateX(Math.PI / 2);
    upperBillGeom.scale(0.85, 0.55, 1.0);
    this.upperBill = new THREE.Mesh(upperBillGeom, this.matBeak);
    this.upperBill.position.set(0, 0.02, 0.24);
    this.upperBill.rotation.x = 0.05;
    this.beakGroup.add(this.upperBill);

    // Hook at tip
    const hookGeom = new THREE.ConeGeometry(0.025, 0.06, 5);
    hookGeom.rotateX(Math.PI * 0.85);
    const hook = new THREE.Mesh(hookGeom, this.matBeak);
    hook.position.set(0, -0.015, 0.49);
    this.beakGroup.add(hook);

    // Lower Mandible & Expandable Gular Pouch (喉囊)
    this.lowerJaw = new THREE.Group();
    this.lowerJaw.position.set(0, -0.02, 0.06);

    const jawGeom = new THREE.BoxGeometry(0.09, 0.022, 0.46);
    const jawBone = new THREE.Mesh(jawGeom, this.matBeak);
    jawBone.position.set(0, 0, 0.22);
    this.lowerJaw.add(jawBone);

    // Elastic Throat Pouch Mesh
    const pouchGeom = new THREE.SphereGeometry(0.12, 14, 10);
    pouchGeom.scale(0.65, 1.1, 1.8);
    this.pouchMesh = new THREE.Mesh(pouchGeom, this.matPouch);
    this.pouchMesh.position.set(0, -0.09, 0.20);
    this.lowerJaw.add(this.pouchMesh);

    this.beakGroup.add(this.lowerJaw);
  }

  buildScarf() {
    this.scarfGroup = new THREE.Group();
    this.scarfGroup.position.set(0, 0.36, 0.2);

    // Scarf neck collar
    const collarGeom = new THREE.TorusGeometry(0.11, 0.035, 8, 16);
    collarGeom.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeom, this.matScarf);
    this.scarfGroup.add(collar);

    // Trailing fluttering tails (articulated segments)
    this.scarfTails = [];
    for (const sx of [-0.04, 0.04]) {
      const tailRoot = new THREE.Group();
      tailRoot.position.set(sx, -0.02, -0.08);

      const segments = [];
      let parent = tailRoot;
      for (let i = 0; i < 4; i++) {
        const seg = new THREE.Group();
        seg.position.set(0, -0.03, -0.08);

        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.06 - i * 0.008, 0.012, 0.09), this.matScarf);
        piece.position.set(0, 0, -0.04);
        seg.add(piece);

        parent.add(seg);
        segments.push(seg);
        parent = seg;
      }
      this.scarfGroup.add(tailRoot);
      this.scarfTails.push(segments);
    }

    this.pelvis.add(this.scarfGroup);
  }

  buildWings() {
    this.wings = {
      left: this.createWing(-1),
      right: this.createWing(1)
    };
    this.pelvis.add(this.wings.left.root);
    this.pelvis.add(this.wings.right.root);
  }

  createWing(side) {
    // side: -1 for Left, 1 for Right
    const root = new THREE.Group();
    root.position.set(side * 0.20, 0.28, 0.12);

    // Shoulder joint
    const upperWing = new THREE.Group();
    root.add(upperWing);

    const bicepGeom = new THREE.ConeGeometry(0.12, 0.35, 6);
    bicepGeom.rotateZ(side * -Math.PI / 4);
    const bicep = new THREE.Mesh(bicepGeom, this.matFeathers);
    bicep.position.set(side * 0.12, -0.1, 0.04);
    upperWing.add(bicep);

    // Forearm / wing elbow
    const forearm = new THREE.Group();
    forearm.position.set(side * 0.24, -0.16, 0.06);
    upperWing.add(forearm);

    // Long primary flight feathers
    const featherGeom = new THREE.BoxGeometry(0.34, 0.02, 0.16);
    const wingFeathers = new THREE.Mesh(featherGeom, this.matWingTips);
    wingFeathers.position.set(side * 0.16, 0, 0.04);
    forearm.add(wingFeathers);

    // Hand / wing tip that clasps handlebar grips
    const hand = new THREE.Group();
    hand.position.set(side * 0.32, 0, 0.08);
    forearm.add(hand);

    return { root, upperWing, forearm, hand, side };
  }

  buildLegs() {
    this.thighLen = 0.26;
    this.shinLen = 0.28;

    this.legs = {
      right: this.createLeg(1),
      left: this.createLeg(-1)
    };

    this.pelvis.add(this.legs.right.hip);
    this.pelvis.add(this.legs.left.hip);
  }

  createLeg(side) {
    // side: 1 for Right, -1 for Left
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0.04, -0.08);

    // Thigh (feathered drumstick)
    const thighMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, this.thighLen, 6), this.matFeathers);
    thighMesh.rotation.x = Math.PI;
    thighMesh.position.set(0, -this.thighLen / 2, 0);

    const thigh = new THREE.Group();
    thigh.add(thighMesh);
    hip.add(thigh);

    // Knee joint
    const knee = new THREE.Group();
    knee.position.set(0, -this.thighLen, 0);
    thigh.add(knee);

    // Shin (bird tarsus)
    const shinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, this.shinLen, 8), this.matFeet);
    shinMesh.position.set(0, -this.shinLen / 2, 0);

    const shin = new THREE.Group();
    shin.add(shinMesh);
    knee.add(shin);

    // Ankle / Webbed Foot
    const ankle = new THREE.Group();
    ankle.position.set(0, -this.shinLen, 0);
    shin.add(ankle);

    // Large paddle webbed foot (3 toes with webbing)
    const footMesh = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), this.matFeet);
    footMesh.scale.set(1.4, 0.25, 1.0);
    footMesh.rotation.x = Math.PI / 2;
    footMesh.position.set(0, 0.015, 0.07);
    ankle.add(footMesh);

    return { hip, thigh, knee, shin, ankle, side };
  }

  solveLegIK(leg, targetWorldPos) {
    // Transform target world pos to hip local space
    const targetLocal = new THREE.Vector3();
    leg.hip.parent.worldToLocal(targetLocal.copy(targetWorldPos));
    const toTarget = new THREE.Vector3().subVectors(targetLocal, leg.hip.position);

    const dist = THREE.MathUtils.clamp(toTarget.length(), 0.12, (this.thighLen + this.shinLen) * 0.98);

    // Law of cosines for 2-bone IK
    const a = this.thighLen;
    const b = this.shinLen;
    const c = dist;

    const cosKnee = THREE.MathUtils.clamp((a * a + b * b - c * c) / (2 * a * b), -1, 1);
    const kneeAngle = Math.PI - Math.acos(cosKnee);

    const cosHip = THREE.MathUtils.clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1);
    const hipAngle = Math.acos(cosHip);

    // Direct thigh towards target, then offset by hipAngle
    const dir = toTarget.clone().normalize();
    const forward = new THREE.Vector3(0, 0, 1);
    const down = new THREE.Vector3(0, -1, 0);

    // Rotation so leg points down/forward toward pedal
    leg.thigh.quaternion.setFromUnitVectors(down, dir);
    leg.thigh.rotateX(-hipAngle);
    leg.knee.rotation.x = kneeAngle;

    // Orient foot flat along bicycle pedal
    leg.ankle.rotation.x = -leg.thigh.rotation.x - leg.knee.rotation.x;
  }

  triggerGulp() {
    this.gulpTimer = 0.8; // Duration of gulp animation
    this.swallowBulge = 1.0;
  }

  triggerFlap() {
    this.isFlapping = true;
    this.flapTimer = 1.2;
  }

  update(dt, speed, steerTarget, isJumping, isSprinting) {
    const crankAngle = this.bike.crankAngle;

    // 1. Dynamic Pelvis Bobbing (Pelican hops rhythmically in saddle with pedaling strokes!)
    const pedalingBob = Math.sin(crankAngle * 2) * 0.022;
    const sprintLean = isSprinting ? 0.12 : 0;
    this.pelvis.position.y = 0.96 + pedalingBob + (isJumping ? 0.08 : 0);
    this.pelvis.position.z = -0.22 + sprintLean;
    this.pelvis.rotation.x = 0.08 + Math.sin(crankAngle * 2) * 0.04 + sprintLean;
    this.pelvis.rotation.y = -steerTarget * 0.3;

    // 2. Neck & Head Natural Inertia & Counter-bobbing
    const neckSway = Math.sin(crankAngle * 2 + 1.2) * 0.06;
    this.neck1.rotation.x = 0.42 - neckSway * 0.5;
    this.neck2.rotation.x = -0.28 + neckSway * 0.4;
    this.headGroup.rotation.x = 0.12 + neckSway * 0.3 + (isSprinting ? 0.15 : 0);
    this.headGroup.rotation.y = steerTarget * 0.45;

    // 3. Eyelids blink system
    this.blinkTimer += dt;
    if (this.blinkTimer > 3.2) {
      const blinkProgress = (this.blinkTimer - 3.2) / 0.18;
      const isClosed = blinkProgress < 1.0;
      this.eyes.forEach(eye => {
        eye.eyelid.visible = isClosed;
      });
      if (this.blinkTimer > 3.4) {
        this.blinkTimer = Math.random() * 0.8; // Randomize next blink
      }
    } else {
      this.eyes.forEach(eye => (eye.eyelid.visible = false));
    }

    // 4. Elastic Gular Pouch Jiggle & Gulp Animation
    this.windJiggle += dt * (12 + speed * 1.5);
    const naturalPouchJiggle = Math.sin(this.windJiggle) * (0.04 + speed * 0.004);

    if (this.gulpTimer > 0) {
      this.gulpTimer -= dt;
      const gulpProgress = 1 - this.gulpTimer / 0.8;
      // Jaw drops open wide then snaps shut
      const jawDrop = Math.sin(gulpProgress * Math.PI) * 0.65;
      this.lowerJaw.rotation.x = -jawDrop;
      this.pouchMesh.scale.set(
        1.0 + jawDrop * 1.2,
        1.1 + jawDrop * 1.8,
        1.8 + jawDrop * 0.8
      );
    } else {
      this.lowerJaw.rotation.x = -Math.max(0, naturalPouchJiggle * 0.3);
      this.pouchMesh.scale.set(
        1.0 + naturalPouchJiggle * 0.4,
        1.1 + naturalPouchJiggle * 0.6,
        1.8
      );
    }

    // Swallowing food bulge traveling down neck
    if (this.swallowBulge > 0) {
      this.swallowBulge -= dt * 1.4;
      this.foodBulge.visible = true;
      const progress = 1 - this.swallowBulge;
      this.foodBulge.position.set(0, 0.22 - progress * 0.22, 0.08 - progress * 0.1);
      const bulgeScale = Math.sin(progress * Math.PI) * 1.4;
      this.foodBulge.scale.setScalar(bulgeScale);
      if (this.swallowBulge <= 0) {
        this.foodBulge.visible = false;
      }
    }

    // 5. Scarf Trailing Aerodynamics
    const windSpeedFactor = 1 + speed * 0.15;
    this.scarfTails.forEach((tailSegments, sideIdx) => {
      tailSegments.forEach((seg, i) => {
        const wave = Math.sin(this.windJiggle * 1.5 - i * 0.8 + sideIdx * 0.5);
        seg.rotation.x = 0.25 * windSpeedFactor + wave * 0.18;
        seg.rotation.y = wave * 0.12;
      });
    });

    // 6. Wings: Riding / Handlebar Grip vs Spread & Flap
    if (this.isFlapping || isJumping || isSprinting) {
      if (this.flapTimer > 0) this.flapTimer -= dt;
      else if (!isJumping && !isSprinting) this.isFlapping = false;

      // Vigorous majestic wing flapping!
      const flapRate = isSprinting ? 24 : 16;
      const flap = Math.sin(this.windJiggle * (flapRate / 10));

      // Left wing spread
      this.wings.left.root.rotation.set(0.2, -0.4, -0.6 + flap * 0.85);
      this.wings.left.forearm.rotation.z = -0.4 + flap * 0.5;

      // Right wing spread
      this.wings.right.root.rotation.set(0.2, 0.4, 0.6 - flap * 0.85);
      this.wings.right.forearm.rotation.z = 0.4 - flap * 0.5;
    } else {
      // Natural grip on handlebars
      const steer = steerTarget * 0.5;
      this.wings.left.root.rotation.set(0.55 + steer, -0.25, -0.32);
      this.wings.left.forearm.rotation.set(-0.35, 0.2, 0.2);

      this.wings.right.root.rotation.set(0.55 - steer, 0.25, 0.32);
      this.wings.right.forearm.rotation.set(-0.35, -0.2, -0.2);
    }

    // 7. Leg 2-bone Inverse Kinematics synced to Bike Pedals
    const pedals = this.bike.getPedalPositions();
    this.solveLegIK(this.legs.right, pedals.right);
    this.solveLegIK(this.legs.left, pedals.left);
  }
}
