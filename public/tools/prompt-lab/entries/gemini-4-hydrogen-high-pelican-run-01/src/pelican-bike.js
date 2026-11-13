import * as THREE from '../vendor/three.min.js';

const R_WHEEL = 0.36;
const CRANK_R = 0.15;
const BB_POS = new THREE.Vector3(0, 0.31, 0.06);
const REAR_AXLE = new THREE.Vector3(0, R_WHEEL, 0.57);
const FRONT_AXLE = new THREE.Vector3(0, R_WHEEL, -0.58);
const SEAT_CLUSTER = new THREE.Vector3(0, 0.72, 0.25);
const HT_TOP = new THREE.Vector3(0, 0.78, -0.39);
const HT_BOT = new THREE.Vector3(0, 0.58, -0.46);

const LEG_L1 = 0.38;
const LEG_L2 = 0.38;
const PEDAL_X = 0.165;
const HIP_X = 0.11;

function tubeBetween(p1, p2, radius, mat, radialSegments = 10) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegments);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addLug(parent, pos, radius, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat);
  m.position.copy(pos);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function makeFishMesh(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), mats.fishBody);
  body.scale.set(0.52, 0.72, 1.85);
  body.castShadow = true;
  g.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), mats.fishBelly);
  belly.scale.set(0.45, 0.55, 1.5);
  belly.position.set(0, -0.012, 0.004);
  g.add(belly);

  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(0.045, 0.042);
  tailShape.lineTo(0.025, 0);
  tailShape.lineTo(0.045, -0.042);
  tailShape.closePath();
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.008, bevelEnabled: false });
  tailGeo.center();
  const tail = new THREE.Mesh(tailGeo, mats.fishFin);
  tail.rotation.y = Math.PI / 2;
  tail.position.set(0, 0, 0.115);
  g.add(tail);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), mats.eyeDark);
  eyeL.position.set(0.022, 0.012, -0.055);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.022;
  g.add(eyeL, eyeR);
  return g;
}

export class PelicanBike {
  constructor() {
    this.root = new THREE.Group();
    this.tiltGroup = new THREE.Group(); // roll / pitch / squash-stretch
    this.root.add(this.tiltGroup);

    this.mats = this._createMaterials();
    this.interactiveMeshes = [];

    this._buildBike();
    this._buildPelican();

    // Animation & interaction states
    this.wheelAngle = 0;
    this.crankAngle = 0.6;
    this.steerAngle = 0;
    this.rollAngle = 0;
    this.pitchAngle = 0;
    this.squashY = 1;

    this.blinkTimer = 2.4;
    this.blinkVal = 0;
    this.honkTimer = 0;
    this.bellTimer = 0;
    this.gulpTimer = 0;
    this.waveTimer = 0;
    this.wingSpread = 0;
    this.flapPhase = 0;
    this.sprintBlend = 0;
    this.scarfTime = 0;
    this.basketFishCount = 2;

    this._tmpV1 = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
  }

  _createMaterials() {
    return {
      frame: new THREE.MeshStandardMaterial({
        color: 0xe8533c,
        roughness: 0.28,
        metalness: 0.18,
      }),
      frameDark: new THREE.MeshStandardMaterial({
        color: 0xb93725,
        roughness: 0.35,
        metalness: 0.2,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: 0xdce3ec,
        roughness: 0.2,
        metalness: 0.85,
      }),
      tire: new THREE.MeshStandardMaterial({
        color: 0x2a2f38,
        roughness: 0.82,
        metalness: 0.05,
      }),
      creamWall: new THREE.MeshStandardMaterial({
        color: 0xf4ead4,
        roughness: 0.72,
        metalness: 0.04,
      }),
      leather: new THREE.MeshStandardMaterial({
        color: 0xc27138,
        roughness: 0.58,
        metalness: 0.06,
      }),
      cork: new THREE.MeshStandardMaterial({
        color: 0xd8a468,
        roughness: 0.82,
        metalness: 0.02,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: 0xf1bf47,
        roughness: 0.24,
        metalness: 0.86,
      }),
      wicker: new THREE.MeshStandardMaterial({
        color: 0xd6a56b,
        roughness: 0.86,
        metalness: 0.02,
      }),
      wickerRim: new THREE.MeshStandardMaterial({
        color: 0xb58046,
        roughness: 0.8,
        metalness: 0.04,
      }),
      lampLens: new THREE.MeshStandardMaterial({
        color: 0xfff3c8,
        emissive: 0xffd573,
        emissiveIntensity: 0.35,
        roughness: 0.15,
      }),
      plumage: new THREE.MeshStandardMaterial({
        color: 0xfbf7ee,
        roughness: 0.72,
        metalness: 0.02,
      }),
      plumageWarm: new THREE.MeshStandardMaterial({
        color: 0xf2e9d6,
        roughness: 0.78,
        metalness: 0.02,
      }),
      featherGrey: new THREE.MeshStandardMaterial({
        color: 0x6f8399,
        roughness: 0.68,
        metalness: 0.04,
      }),
      featherDark: new THREE.MeshStandardMaterial({
        color: 0x425163,
        roughness: 0.7,
        metalness: 0.05,
      }),
      beakTop: new THREE.MeshStandardMaterial({
        color: 0xf6a926,
        roughness: 0.36,
        metalness: 0.05,
      }),
      beakTip: new THREE.MeshStandardMaterial({
        color: 0xe65b3e,
        roughness: 0.36,
        metalness: 0.04,
      }),
      pouch: new THREE.MeshStandardMaterial({
        color: 0xf4846d,
        roughness: 0.45,
        metalness: 0.02,
      }),
      footOrange: new THREE.MeshStandardMaterial({
        color: 0xf07b28,
        roughness: 0.55,
        metalness: 0.03,
      }),
      scarfBlue: new THREE.MeshStandardMaterial({
        color: 0x2674be,
        roughness: 0.76,
        metalness: 0.02,
      }),
      scarfGold: new THREE.MeshStandardMaterial({
        color: 0xffcf56,
        roughness: 0.72,
        metalness: 0.02,
      }),
      eyeDark: new THREE.MeshStandardMaterial({
        color: 0x161b22,
        roughness: 0.15,
        metalness: 0.1,
      }),
      eyeWhite: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
      }),
      fishBody: new THREE.MeshStandardMaterial({
        color: 0x8ad0e8,
        roughness: 0.25,
        metalness: 0.45,
      }),
      fishBelly: new THREE.MeshStandardMaterial({
        color: 0xeef8fc,
        roughness: 0.3,
        metalness: 0.3,
      }),
      fishFin: new THREE.MeshStandardMaterial({
        color: 0x569db8,
        roughness: 0.4,
        metalness: 0.2,
      }),
    };
  }

  _tagHit(obj, partName) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.userData.hitPart = partName;
        this.interactiveMeshes.push(child);
      }
    });
  }

  _buildWheel() {
    const wheel = new THREE.Group();

    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(0.326, 0.034, 14, 42),
      this.mats.tire
    );
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    tire.receiveShadow = true;
    wheel.add(tire);

    const creamWall = new THREE.Mesh(
      new THREE.TorusGeometry(0.304, 0.02, 10, 40),
      this.mats.creamWall
    );
    creamWall.rotation.y = Math.PI / 2;
    wheel.add(creamWall);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.285, 0.014, 10, 36),
      this.mats.chrome
    );
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.11, 14),
      this.mats.chrome
    );
    hub.rotation.z = Math.PI / 2;
    hub.castShadow = true;
    wheel.add(hub);

    const spokeGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.56, 5);
    const numSpokes = 12;
    for (let i = 0; i < numSpokes; i++) {
      const a = (i / numSpokes) * Math.PI;
      const spoke = new THREE.Mesh(spokeGeo, this.mats.chrome);
      spoke.rotation.x = a;
      spoke.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.055;
      wheel.add(spoke);
    }

    return wheel;
  }

  _buildBike() {
    this.bikeGroup = new THREE.Group();
    this.tiltGroup.add(this.bikeGroup);

    // Curved top & down tubes for classic cruiser silhouette
    const topCurve = new THREE.CatmullRomCurve3([
      HT_TOP.clone().add(new THREE.Vector3(0, -0.02, 0.02)),
      new THREE.Vector3(0, 0.72, -0.08),
      SEAT_CLUSTER.clone(),
    ]);
    const topTube = new THREE.Mesh(
      new THREE.TubeGeometry(topCurve, 18, 0.019, 10, false),
      this.mats.frame
    );
    topTube.castShadow = true;
    this.bikeGroup.add(topTube);

    const downCurve = new THREE.CatmullRomCurve3([
      HT_BOT.clone().add(new THREE.Vector3(0, 0.02, 0.01)),
      new THREE.Vector3(0, 0.43, -0.22),
      BB_POS.clone(),
    ]);
    const downTube = new THREE.Mesh(
      new THREE.TubeGeometry(downCurve, 18, 0.022, 10, false),
      this.mats.frame
    );
    downTube.castShadow = true;
    this.bikeGroup.add(downTube);

    // Head tube & seat tube
    this.bikeGroup.add(tubeBetween(HT_BOT, HT_TOP, 0.026, this.mats.frame, 12));
    const seatPostTop = new THREE.Vector3(0, 0.805, 0.28);
    this.bikeGroup.add(tubeBetween(BB_POS, SEAT_CLUSTER, 0.021, this.mats.frame, 12));
    this.bikeGroup.add(tubeBetween(SEAT_CLUSTER, seatPostTop, 0.015, this.mats.chrome, 10));

    addLug(this.bikeGroup, BB_POS, 0.036, this.mats.frameDark);
    addLug(this.bikeGroup, SEAT_CLUSTER, 0.025, this.mats.frameDark);

    // Chainstays & seatstays
    for (const side of [-1, 1]) {
      const bbSide = new THREE.Vector3(side * 0.032, BB_POS.y, BB_POS.z);
      const scSide = new THREE.Vector3(side * 0.024, SEAT_CLUSTER.y, SEAT_CLUSTER.z);
      const dropout = new THREE.Vector3(side * 0.062, REAR_AXLE.y, REAR_AXLE.z);
      this.bikeGroup.add(tubeBetween(bbSide, dropout, 0.013, this.mats.frame, 8));
      this.bikeGroup.add(tubeBetween(scSide, dropout, 0.011, this.mats.frame, 8));
      addLug(this.bikeGroup, dropout, 0.019, this.mats.chrome);
    }

    // Rear mudguard
    const rearFender = new THREE.Mesh(
      new THREE.TorusGeometry(0.388, 0.026, 8, 28, Math.PI * 0.95),
      this.mats.frame
    );
    rearFender.rotation.y = Math.PI / 2;
    rearFender.rotation.z = Math.PI * 0.12;
    rearFender.scale.set(1, 1, 1.5);
    rearFender.position.copy(REAR_AXLE);
    rearFender.castShadow = true;
    this.bikeGroup.add(rearFender);

    // Rear luggage rack + cute leather coastal satchel
    const rackBack = new THREE.Vector3(0, 0.78, 0.74);
    const rackFront = new THREE.Vector3(0, 0.78, 0.36);
    for (const side of [-1, 1]) {
      this.bikeGroup.add(
        tubeBetween(
          new THREE.Vector3(side * 0.075, rackFront.y, rackFront.z),
          new THREE.Vector3(side * 0.075, rackBack.y, rackBack.z),
          0.008,
          this.mats.chrome,
          8
        )
      );
      this.bikeGroup.add(
        tubeBetween(
          new THREE.Vector3(side * 0.062, REAR_AXLE.y, REAR_AXLE.z),
          new THREE.Vector3(side * 0.075, rackBack.y, rackBack.z - 0.04),
          0.007,
          this.mats.chrome,
          8
        )
      );
    }
    this.bikeGroup.add(
      tubeBetween(
        new THREE.Vector3(-0.075, rackBack.y, rackBack.z),
        new THREE.Vector3(0.075, rackBack.y, rackBack.z),
        0.008,
        this.mats.chrome,
        8
      )
    );

    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.16, 0.22), this.mats.leather);
    satchel.position.set(0.105, 0.69, 0.56);
    satchel.castShadow = true;
    this.bikeGroup.add(satchel);
    const satchelFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.07, 0.228),
      this.mats.scarfGold
    );
    satchelFlap.position.set(0.108, 0.74, 0.56);
    this.bikeGroup.add(satchelFlap);

    // Saddle
    const saddleGroup = new THREE.Group();
    saddleGroup.position.copy(seatPostTop);
    const saddleBase = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), this.mats.leather);
    saddleBase.scale.set(1.05, 0.32, 1.55);
    saddleBase.position.set(0, 0.025, 0.01);
    saddleBase.castShadow = true;
    saddleGroup.add(saddleBase);
    for (const s of [-0.04, 0.04]) {
      const spring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.032, 8),
        this.mats.chrome
      );
      spring.position.set(s, 0.0, 0.06);
      saddleGroup.add(spring);
    }
    this.bikeGroup.add(saddleGroup);

    // Rear wheel
    this.rearWheel = this._buildWheel();
    this.rearWheel.position.copy(REAR_AXLE);
    this.bikeGroup.add(this.rearWheel);

    // Chainring, chain & cranks
    const chainring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.012, 24),
      this.mats.chrome
    );
    chainring.rotation.z = Math.PI / 2;
    chainring.position.set(0.055, BB_POS.y, BB_POS.z);
    this.bikeGroup.add(chainring);

    const rearCog = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.012, 16),
      this.mats.chrome
    );
    rearCog.rotation.z = Math.PI / 2;
    rearCog.position.set(0.055, REAR_AXLE.y, REAR_AXLE.z);
    this.bikeGroup.add(rearCog);

    this.bikeGroup.add(
      tubeBetween(
        new THREE.Vector3(0.055, BB_POS.y + 0.088, BB_POS.z),
        new THREE.Vector3(0.055, REAR_AXLE.y + 0.034, REAR_AXLE.z),
        0.006,
        this.mats.tire,
        6
      )
    );
    this.bikeGroup.add(
      tubeBetween(
        new THREE.Vector3(0.055, BB_POS.y - 0.088, BB_POS.z),
        new THREE.Vector3(0.055, REAR_AXLE.y - 0.034, REAR_AXLE.z),
        0.006,
        this.mats.tire,
        6
      )
    );

    // Crank group
    this.crankGroup = new THREE.Group();
    this.crankGroup.position.copy(BB_POS);
    this.bikeGroup.add(this.crankGroup);

    const crankAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.22, 10),
      this.mats.chrome
    );
    crankAxle.rotation.z = Math.PI / 2;
    this.crankGroup.add(crankAxle);

    // Right crank arm (+Y at crankAngle = 0)
    const rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, CRANK_R + 0.02, 0.026),
      this.mats.chrome
    );
    rightArm.position.set(0.105, CRANK_R * 0.5, 0);
    this.crankGroup.add(rightArm);

    this.rightPedal = new THREE.Group();
    this.rightPedal.position.set(PEDAL_X, CRANK_R, 0);
    const pedalPadR = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.02, 0.065), this.mats.tire);
    const pedalRefR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.072), this.mats.beakTop);
    this.rightPedal.add(pedalPadR, pedalRefR);
    this.crankGroup.add(this.rightPedal);

    // Left crank arm (-Y at crankAngle = 0)
    const leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, CRANK_R + 0.02, 0.026),
      this.mats.chrome
    );
    leftArm.position.set(-0.105, -CRANK_R * 0.5, 0);
    this.crankGroup.add(leftArm);

    this.leftPedal = new THREE.Group();
    this.leftPedal.position.set(-PEDAL_X, -CRANK_R, 0);
    this.leftPedal.add(pedalPadR.clone(), pedalRefR.clone());
    this.crankGroup.add(this.leftPedal);

    // === Steering assembly tilted along real head-tube rake ===
    const headTilt = Math.atan2(HT_TOP.z - HT_BOT.z, HT_TOP.y - HT_BOT.y);
    this.steerPivot = new THREE.Group();
    this.steerPivot.position.copy(HT_TOP);
    this.steerPivot.rotation.x = headTilt;
    this.bikeGroup.add(this.steerPivot);

    this.steerTurn = new THREE.Group();
    this.steerPivot.add(this.steerTurn);

    // Transform FRONT_AXLE into steerTurn local space so fork blades align perfectly!
    const invHeadQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(headTilt, 0, 0)).invert();
    const localFrontAxle = FRONT_AXLE.clone().sub(HT_TOP).applyQuaternion(invHeadQ);
    const localCrown = HT_BOT.clone().sub(HT_TOP).applyQuaternion(invHeadQ);

    // Fork crown + blades
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.044), this.mats.chrome);
    crown.position.copy(localCrown);
    this.steerTurn.add(crown);

    for (const side of [-1, 1]) {
      const cPt = localCrown.clone().add(new THREE.Vector3(side * 0.045, 0, 0));
      const aPt = localFrontAxle.clone().add(new THREE.Vector3(side * 0.056, 0, 0));
      this.steerTurn.add(tubeBetween(cPt, aPt, 0.014, this.mats.frame, 10));
      addLug(this.steerTurn, aPt, 0.017, this.mats.chrome);
    }

    // Front wheel inside steerTurn
    this.frontWheel = this._buildWheel();
    this.frontWheel.position.copy(localFrontAxle);
    this.steerTurn.add(this.frontWheel);
    this._tagHit(this.frontWheel, 'wheel');

    // Front mudguard
    const frontFender = new THREE.Mesh(
      new THREE.TorusGeometry(0.388, 0.025, 8, 24, Math.PI * 0.72),
      this.mats.frame
    );
    frontFender.rotation.y = Math.PI / 2;
    frontFender.rotation.z = Math.PI * 0.25;
    frontFender.scale.set(1, 1, 1.45);
    frontFender.position.copy(localFrontAxle);
    frontFender.castShadow = true;
    this.steerTurn.add(frontFender);

    // Chrome stem
    const stemTop = new THREE.Vector3(0, 0.145, -0.025);
    this.steerTurn.add(tubeBetween(new THREE.Vector3(0, 0, 0), stemTop, 0.015, this.mats.chrome, 10));

    // Swept cruiser handlebars
    const barCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.31, 0.16, 0.12),
      new THREE.Vector3(-0.24, 0.185, 0.02),
      new THREE.Vector3(-0.08, 0.165, -0.025),
      stemTop.clone(),
      new THREE.Vector3(0.08, 0.165, -0.025),
      new THREE.Vector3(0.24, 0.185, 0.02),
      new THREE.Vector3(0.31, 0.16, 0.12),
    ]);
    const barMesh = new THREE.Mesh(
      new THREE.TubeGeometry(barCurve, 28, 0.012, 10, false),
      this.mats.chrome
    );
    barMesh.castShadow = true;
    this.steerTurn.add(barMesh);

    // Cork grips & exact grip anchors for pelican wingtips
    const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.11, 12);
    this.leftGripAnchor = new THREE.Group();
    this.leftGripAnchor.position.set(-0.285, 0.172, 0.085);
    this.steerTurn.add(this.leftGripAnchor);
    const gripL = new THREE.Mesh(gripGeo, this.mats.cork);
    gripL.rotation.x = Math.PI / 2 - 0.22;
    gripL.rotation.z = -0.45;
    this.leftGripAnchor.add(gripL);

    this.rightGripAnchor = new THREE.Group();
    this.rightGripAnchor.position.set(0.285, 0.172, 0.085);
    this.steerTurn.add(this.rightGripAnchor);
    const gripR = new THREE.Mesh(gripGeo, this.mats.cork);
    gripR.rotation.x = Math.PI / 2 - 0.22;
    gripR.rotation.z = 0.45;
    this.rightGripAnchor.add(gripR);

    // Brass bell on right handlebar
    this.bellGroup = new THREE.Group();
    this.bellGroup.position.set(0.21, 0.2, 0.01);
    const bellDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      this.mats.brass
    );
    bellDome.castShadow = true;
    const bellBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.029, 0.032, 0.014, 14),
      this.mats.chrome
    );
    bellBase.position.y = -0.006;
    this.bellLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.008, 0.012),
      this.mats.chrome
    );
    this.bellLever.position.set(0.024, -0.004, 0.016);
    this.bellGroup.add(bellDome, bellBase, this.bellLever);
    this.steerTurn.add(this.bellGroup);
    this._tagHit(this.bellGroup, 'bell');

    // Retro headlight
    const lampPos = localCrown.clone().add(new THREE.Vector3(0, 0.075, -0.065));
    const lampGroup = new THREE.Group();
    lampGroup.position.copy(lampPos);
    const lampShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.028, 0.078, 16),
      this.mats.chrome
    );
    lampShell.rotation.x = Math.PI / 2;
    lampShell.castShadow = true;
    const lampLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.039, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      this.mats.lampLens
    );
    lampLens.rotation.x = -Math.PI / 2;
    lampLens.position.z = -0.032;
    lampGroup.add(lampShell, lampLens);
    this.steerTurn.add(lampGroup);

    // Actual SpotLight beam for sunset & night
    this.headlightSpot = new THREE.SpotLight(0xffe19c, 0, 14, Math.PI * 0.26, 0.6, 1.4);
    this.headlightSpot.position.set(0, 0, -0.06);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -0.5, -5.5);
    lampGroup.add(spotTarget);
    this.headlightSpot.target = spotTarget;
    lampGroup.add(this.headlightSpot);

    // Woven front basket
    this.basketGroup = new THREE.Group();
    this.basketGroup.position.set(0, 0.02, -0.155);
    this.steerTurn.add(this.basketGroup);

    const basketBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.11, 0.16, 16, 1, true),
      this.mats.wicker
    );
    basketBody.material.side = THREE.DoubleSide;
    basketBody.castShadow = true;
    this.basketGroup.add(basketBody);

    const basketBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.012, 16),
      this.mats.wickerRim
    );
    basketBottom.position.y = -0.076;
    this.basketGroup.add(basketBottom);

    const basketRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.147, 0.014, 8, 22),
      this.mats.wickerRim
    );
    basketRim.rotation.x = Math.PI / 2;
    basketRim.position.y = 0.08;
    this.basketGroup.add(basketRim);

    const basketMidBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.129, 0.008, 6, 20),
      this.mats.wickerRim
    );
    basketMidBand.rotation.x = Math.PI / 2;
    basketMidBand.position.y = 0.0;
    this.basketGroup.add(basketMidBand);

    // Fish inside basket (up to 6 visible)
    this.basketFish = [];
    const fishSlots = [
      { pos: [-0.04, 0.02, -0.02], rot: [0.4, 0.4, 0.15] },
      { pos: [0.045, 0.03, 0.015], rot: [-0.35, -0.3, -0.2] },
      { pos: [0.0, 0.04, -0.03], rot: [0.25, 1.1, 0.1] },
      { pos: [-0.035, 0.065, 0.025], rot: [-0.5, 0.7, -0.15] },
      { pos: [0.03, 0.075, -0.015], rot: [0.45, -0.8, 0.25] },
      { pos: [0.0, 0.095, 0.01], rot: [-0.2, 0.2, 0.3] },
    ];
    for (let i = 0; i < fishSlots.length; i++) {
      const f = makeFishMesh(this.mats);
      f.position.set(...fishSlots[i].pos);
      f.rotation.set(...fishSlots[i].rot);
      f.userData.baseY = fishSlots[i].pos[1];
      f.visible = i < 2;
      this.basketGroup.add(f);
      this.basketFish.push(f);
    }
    this._tagHit(this.basketGroup, 'basket');
  }

  _buildPelican() {
    this.pelicanGroup = new THREE.Group();
    this.tiltGroup.add(this.pelicanGroup);

    // Torso pivot sits around the hip/saddle area
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.set(0, 0.87, 0.24);
    this.pelicanGroup.add(this.torsoPivot);

    // Sculpted plump body using LatheGeometry
    const bodyProfile = [
      new THREE.Vector2(0.001, -0.17),
      new THREE.Vector2(0.11, -0.15),
      new THREE.Vector2(0.185, -0.06),
      new THREE.Vector2(0.195, 0.05),
      new THREE.Vector2(0.165, 0.16),
      new THREE.Vector2(0.11, 0.25),
      new THREE.Vector2(0.05, 0.30),
      new THREE.Vector2(0.001, 0.31),
    ];
    const bodyGeo = new THREE.LatheGeometry(bodyProfile, 22);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.mats.plumage);
    bodyMesh.scale.set(0.92, 1.0, 1.24);
    bodyMesh.rotation.x = -0.34;
    bodyMesh.position.set(0, 0.08, -0.03);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.torsoPivot.add(bodyMesh);

    // Breast warm plumage accent
    const breast = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 16, 12),
      this.mats.plumageWarm
    );
    breast.scale.set(0.95, 1.15, 0.9);
    breast.position.set(0, 0.14, -0.13);
    this.torsoPivot.add(breast);

    // Tail feathers fan
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(0, -0.01, 0.22);
    this.torsoPivot.add(this.tailGroup);
    for (let i = -2; i <= 2; i++) {
      const feather = new THREE.Mesh(
        new THREE.ConeGeometry(0.042, 0.22, 6),
        Math.abs(i) === 2 ? this.mats.featherDark : this.mats.featherGrey
      );
      feather.scale.set(0.65, 1, 0.25);
      feather.rotation.x = Math.PI * 0.56;
      feather.rotation.z = i * 0.16;
      feather.position.set(i * 0.025, 0.02, 0.06);
      feather.castShadow = true;
      this.tailGroup.add(feather);
    }

    // Coastal striped neckerchief around base of neck
    this.scarfCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.092, 0.024, 10, 20),
      this.mats.scarfBlue
    );
    this.scarfCollar.rotation.x = Math.PI / 2 + 0.28;
    this.scarfCollar.position.set(0, 0.30, -0.13);
    this.scarfCollar.castShadow = true;
    this.torsoPivot.add(this.scarfCollar);

    const scarfKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 8),
      this.mats.scarfGold
    );
    scarfKnot.position.set(0.05, 0.305, -0.035);
    this.torsoPivot.add(scarfKnot);

    this.scarfTail1 = new THREE.Group();
    this.scarfTail1.position.set(0.055, 0.308, -0.025);
    const tailSeg1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.011, 0.145),
      this.mats.scarfBlue
    );
    tailSeg1.position.set(0, 0, 0.072);
    tailSeg1.castShadow = true;
    this.scarfTail1.add(tailSeg1);
    this.torsoPivot.add(this.scarfTail1);

    this.scarfTail2 = new THREE.Group();
    this.scarfTail2.position.set(0, 0, 0.142);
    const tailSeg2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.01, 0.125),
      this.mats.scarfGold
    );
    tailSeg2.position.set(0, 0, 0.062);
    tailSeg2.castShadow = true;
    this.scarfTail2.add(tailSeg2);
    this.scarfTail1.add(this.scarfTail2);

    // === Neck & Head ===
    this.neckBase = new THREE.Group();
    this.neckBase.position.set(0, 0.31, -0.12);
    this.torsoPivot.add(this.neckBase);

    const neckLower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.115, 8, 14),
      this.mats.plumage
    );
    neckLower.position.set(0, 0.088, 0.018);
    neckLower.rotation.x = 0.2;
    neckLower.castShadow = true;
    this.neckBase.add(neckLower);

    this.neckUpper = new THREE.Group();
    this.neckUpper.position.set(0, 0.165, 0.032);
    this.neckBase.add(this.neckUpper);

    const neckJointBridge = new THREE.Mesh(
      new THREE.SphereGeometry(0.064, 14, 10),
      this.mats.plumage
    );
    neckJointBridge.castShadow = true;
    this.neckUpper.add(neckJointBridge);

    const neckTop = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06, 0.11, 8, 14),
      this.mats.plumage
    );
    neckTop.position.set(0, 0.078, -0.024);
    neckTop.rotation.x = -0.28;
    neckTop.castShadow = true;
    this.neckUpper.add(neckTop);

    // Head Pivot
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.16, -0.055);
    this.neckUpper.add(this.headPivot);

    const cranium = new THREE.Mesh(
      new THREE.SphereGeometry(0.088, 18, 14),
      this.mats.plumage
    );
    cranium.scale.set(0.95, 0.94, 1.12);
    cranium.castShadow = true;
    this.headPivot.add(cranium);

    // Fluffy crest tuft feathers
    for (let i = 0; i < 3; i++) {
      const crest = new THREE.Mesh(
        new THREE.ConeGeometry(0.018, 0.075, 6),
        this.mats.plumageWarm
      );
      crest.position.set(0, 0.088 - i * 0.01, 0.025 + i * 0.025);
      crest.rotation.x = -0.55 - i * 0.25;
      this.headPivot.add(crest);
    }

    // Expressive eyes + blinking eyelids
    this.eyelids = [];
    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.068, 0.024, -0.036);
      eyeGroup.rotation.y = side * 0.42;

      const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.023, 12, 10),
        this.mats.eyeWhite
      );
      sclera.scale.set(0.65, 1.0, 1.0);
      eyeGroup.add(sclera);

      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 10, 8),
        this.mats.eyeDark
      );
      pupil.position.set(side * 0.008, 0, -0.008);
      eyeGroup.add(pupil);

      const catchlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.005, 6, 6),
        this.mats.eyeWhite
      );
      catchlight.position.set(side * 0.016, 0.006, -0.015);
      eyeGroup.add(catchlight);

      const eyelid = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
        this.mats.plumageWarm
      );
      eyelid.scale.set(0.7, 1.05, 1.05);
      eyelid.rotation.x = -1.25; // open position
      eyeGroup.add(eyelid);
      this.eyelids.push(eyelid);

      this.headPivot.add(eyeGroup);
    }

    // Iconic Pelican Upper Beak
    const upperBeakGroup = new THREE.Group();
    upperBeakGroup.position.set(0, 0.008, -0.07);
    this.headPivot.add(upperBeakGroup);

    const beakUpperGeo = new THREE.CylinderGeometry(0.018, 0.048, 0.34, 14);
    const beakUpper = new THREE.Mesh(beakUpperGeo, this.mats.beakTop);
    beakUpper.scale.set(1.0, 1.0, 0.56);
    beakUpper.rotation.x = Math.PI / 2 + 0.05;
    beakUpper.position.set(0, -0.01, -0.155);
    beakUpper.castShadow = true;
    upperBeakGroup.add(beakUpper);

    // Hooked coral tip ("nail")
    const beakHook = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.042, 10),
      this.mats.beakTip
    );
    beakHook.rotation.x = Math.PI * 0.88;
    beakHook.position.set(0, -0.032, -0.328);
    upperBeakGroup.add(beakHook);

    // Lower Jaw & Elastic Coral Throat Pouch!
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, -0.016, -0.068);
    this.headPivot.add(this.jawPivot);

    const lowerRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.042, 0.32, 12),
      this.mats.beakTop
    );
    lowerRim.scale.set(0.95, 1.0, 0.4);
    lowerRim.rotation.x = Math.PI / 2 + 0.05;
    lowerRim.position.set(0, -0.008, -0.145);
    lowerRim.castShadow = true;
    this.jawPivot.add(lowerRim);

    this.pouchGroup = new THREE.Group();
    this.pouchGroup.position.set(0, -0.012, -0.13);
    this.jawPivot.add(this.pouchGroup);

    const pouchMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 16, 12),
      this.mats.pouch
    );
    pouchMesh.scale.set(0.68, 0.92, 2.05);
    pouchMesh.position.set(0, -0.045, 0);
    pouchMesh.castShadow = true;
    this.pouchGroup.add(pouchMesh);

    // Mini fish inside pouch (briefly flashes when gulping!)
    this.pouchFish = makeFishMesh(this.mats);
    this.pouchFish.scale.setScalar(0.8);
    this.pouchFish.position.set(0, -0.045, -0.03);
    this.pouchFish.visible = false;
    this.pouchGroup.add(this.pouchFish);

    // === Wings (Upper arm + Forewing with layered primary feathers) ===
    this.wings = {
      left: this._buildWing(-1),
      right: this._buildWing(1),
    };

    // === Legs (Feathered thigh + knee + orange tarsus + webbed foot) ===
    this.legs = {
      left: this._buildLeg(-1),
      right: this._buildLeg(1),
    };

    this._tagHit(this.pelicanGroup, 'pelican');
  }

  _buildWing(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.165, 0.22, -0.05);
    this.torsoPivot.add(shoulder);

    // Upper wing (length 0.24 along -Y)
    const upper = new THREE.Group();
    shoulder.add(upper);

    const upperMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.044, 0.18, 6, 12),
      this.mats.plumage
    );
    upperMesh.scale.set(0.65, 1, 1.35);
    upperMesh.position.set(0, -0.11, 0.01);
    upperMesh.castShadow = true;
    upper.add(upperMesh);

    // Forearm / elbow
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.23, 0);
    upper.add(elbow);

    const foreMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.034, 0.2, 6, 12),
      this.mats.plumageWarm
    );
    foreMesh.scale.set(0.55, 1, 1.4);
    foreMesh.position.set(0, -0.11, 0.015);
    foreMesh.castShadow = true;
    elbow.add(foreMesh);

    // Primary flight feathers fanned at wingtip
    const featherGroup = new THREE.Group();
    featherGroup.position.set(0, -0.18, 0.025);
    elbow.add(featherGroup);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, 0.16 - i * 0.015, 6),
        i < 2 ? this.mats.featherDark : this.mats.featherGrey
      );
      f.scale.set(0.35, 1, 1.1);
      f.rotation.x = Math.PI + 0.16 * i;
      f.position.set(0, -0.05, i * 0.022);
      f.castShadow = true;
      featherGroup.add(f);
    }

    return { side, shoulder, upper, elbow, featherGroup };
  }

  _buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * HIP_X, 0.85, 0.22);
    this.pelicanGroup.add(hip);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.056, LEG_L1 - 0.08, 6, 12),
      this.mats.plumage
    );
    thigh.position.y = -LEG_L1 * 0.5;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -LEG_L1;
    hip.add(knee);

    const kneeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 10, 8),
      this.mats.footOrange
    );
    knee.add(kneeSphere);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.016, LEG_L2, 10),
      this.mats.footOrange
    );
    shin.position.y = -LEG_L2 * 0.5;
    shin.castShadow = true;
    knee.add(shin);

    // Webbed foot at ankle
    const foot = new THREE.Group();
    foot.position.y = -LEG_L2;
    knee.add(foot);

    const webShape = new THREE.Shape();
    webShape.moveTo(0, 0.025);
    webShape.lineTo(-0.048, -0.085);
    webShape.quadraticCurveTo(-0.022, -0.072, 0, -0.095);
    webShape.quadraticCurveTo(0.022, -0.072, 0.048, -0.085);
    webShape.closePath();

    const webGeo = new THREE.ExtrudeGeometry(webShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    webGeo.rotateX(Math.PI / 2);
    const webMesh = new THREE.Mesh(webGeo, this.mats.footOrange);
    webMesh.position.set(0, 0.006, 0.015);
    webMesh.castShadow = true;
    foot.add(webMesh);

    return { side, hip, knee, foot };
  }

  /**
   * Exact 2-bone IK in the sagittal (YZ) plane (plus subtle lateral X tilt)
   * so webbed feet stay firmly planted on the pedals at every crank angle.
   */
  _solveLegIK(leg, hipPos, footTarget) {
    const dx = footTarget.x - hipPos.x;
    const dy = footTarget.y - hipPos.y;
    const dz = footTarget.z - hipPos.z;

    const planarYZ = Math.hypot(dy, dz);
    const maxReach = (LEG_L1 + LEG_L2) * 0.985;
    const d = THREE.MathUtils.clamp(planarYZ, 0.12, maxReach);

    // Target direction angle in YZ plane from straight down (-Y) toward forward (-Z)
    // For (dy, dz): straight down is (dy = -1, dz = 0) -> alpha = 0
    // Forward (-Z) gives positive rotation around X (WAIT: let's check!)
    // In Three.js, rotating (0, -1, 0) by +theta around +X gives (0, -cos(theta), -sin(theta))!
    // Yes! Positive rotation.x swings -Y forward toward -Z!
    const alpha = Math.atan2(-dz, -dy);

    const cosA = THREE.MathUtils.clamp(
      (LEG_L1 * LEG_L1 + d * d - LEG_L2 * LEG_L2) / (2 * LEG_L1 * d),
      -1,
      1
    );
    const angleA = Math.acos(cosA);

    const cosB = THREE.MathUtils.clamp(
      (LEG_L1 * LEG_L1 + LEG_L2 * LEG_L2 - d * d) / (2 * LEG_L1 * LEG_L2),
      -1,
      1
    );
    const interiorB = Math.acos(cosB);

    // Knee bends forward (+rotation.x on hip, negative knee bend back)
    const hipRotX = alpha + angleA;
    const kneeRotX = -(Math.PI - interiorB);

    leg.hip.position.copy(hipPos);
    leg.hip.rotation.x = hipRotX;
    // Slight lateral roll so ankle reaches pedal X cleanly
    leg.hip.rotation.z = Math.atan2(dx, Math.max(0.25, -dy)) * 0.85;
    leg.knee.rotation.x = kneeRotX;
    // Keep webbed foot horizontal on the pedal!
    leg.foot.rotation.x = -(hipRotX + kneeRotX) + 0.08;
    leg.foot.rotation.z = -leg.hip.rotation.z;
  }

  _updateWing(wing, targetLocalToTorso, spreadBlend, flapOffset, time) {
    // 2-bone IK from shoulder to handlebar grip; smoothly blends into wide gliding flap
    const side = wing.side;
    const shPos = wing.shoulder.position;
    const W1 = 0.23;
    const W2 = 0.23;

    const dir = this._tmpV1.copy(targetLocalToTorso).sub(shPos);
    const planarYZ = Math.hypot(dir.y, dir.z);
    const d = THREE.MathUtils.clamp(planarYZ, 0.14, (W1 + W2) * 0.97);

    const pitch = Math.atan2(-dir.z, -dir.y);
    const cosA = THREE.MathUtils.clamp((W1 * W1 + d * d - W2 * W2) / (2 * W1 * d), -1, 1);
    const cosB = THREE.MathUtils.clamp((W1 * W1 + W2 * W2 - d * d) / (2 * W1 * W2), -1, 1);
    const angleA = Math.acos(cosA);
    const interiorB = Math.acos(cosB);

    const gripShoulderX = pitch - angleA;
    const gripElbowX = Math.PI - interiorB;
    const gripShoulderZ = THREE.MathUtils.clamp(dir.x * 0.9, -0.45, 0.45) + side * 0.06;

    // Flying / gliding spread pose
    const flapWave = Math.sin(this.flapPhase + flapOffset);
    const spreadShoulderZ = side * (1.28 + flapWave * 0.42);
    const spreadShoulderX = 0.18 + Math.cos(this.flapPhase + flapOffset) * 0.16;
    const spreadElbowX = 0.18 - flapWave * 0.15;

    wing.shoulder.rotation.x = THREE.MathUtils.lerp(gripShoulderX, spreadShoulderX, spreadBlend);
    wing.shoulder.rotation.z = THREE.MathUtils.lerp(gripShoulderZ, spreadShoulderZ, spreadBlend);
    wing.shoulder.rotation.y = THREE.MathUtils.lerp(0, side * 0.18, spreadBlend);

    wing.elbow.rotation.x = THREE.MathUtils.lerp(gripElbowX, spreadElbowX, spreadBlend);
    wing.elbow.rotation.z = THREE.MathUtils.lerp(0, side * (0.22 + flapWave * 0.22), spreadBlend);
    wing.featherGroup.rotation.x = THREE.MathUtils.lerp(0.05, -0.15 + flapWave * 0.15, spreadBlend);

    // Subtle bell-ring wave on right wing!
    if (side > 0 && this.waveTimer > 0) {
      const w = Math.sin((this.waveTimer / 0.55) * Math.PI);
      wing.shoulder.rotation.z += w * 0.55;
      wing.shoulder.rotation.x += w * 0.35;
      wing.elbow.rotation.x -= w * 0.35;
    }

    // Idle breathing micro-motion
    wing.shoulder.rotation.z += Math.sin(time * 2.5 + side) * 0.015;
  }

  triggerBell() {
    this.bellTimer = 0.45;
    this.waveTimer = 0.52;
  }

  triggerHonk() {
    this.honkTimer = 0.48;
  }

  triggerGulp() {
    this.gulpTimer = 0.68;
    if (this.basketFishCount < this.basketFish.length) {
      this.basketFishCount++;
      this.basketFish.forEach((f, idx) => {
        f.visible = idx < this.basketFishCount;
      });
    }
  }

  setHeadlightIntensity(intensity) {
    this.headlightSpot.intensity = intensity;
    this.mats.lampLens.emissiveIntensity = 0.25 + intensity * 0.55;
  }

  update(dt, state) {
    const {
      speed,
      steerInput,
      isCoasting,
      isAirborne,
      isGliding,
      isSprinting,
      isPaused,
      time,
      lookYaw = 0,
    } = state;

    const activeDt = isPaused ? 0 : dt;

    // 1. Wheel & crank rotation
    if (!isPaused) {
      const dist = speed * activeDt;
      this.wheelAngle += dist / R_WHEEL;
      if (!isCoasting && speed > 0.2) {
        // Gear ratio ~2.25 turns of wheel per crank revolution feels brisk and natural
        this.crankAngle += (dist / R_WHEEL) * 0.68;
      }
    }

    this.frontWheel.rotation.x = -this.wheelAngle;
    this.rearWheel.rotation.x = -this.wheelAngle;
    this.crankGroup.rotation.x = -this.crankAngle;
    this.rightPedal.rotation.x = this.crankAngle;
    this.leftPedal.rotation.x = this.crankAngle;

    // 2. Steering, bike roll-into-turn, and jump pitch/squash
    const targetSteer = -steerInput * 0.38;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, Math.min(1, dt * 10));
    this.steerTurn.rotation.y = this.steerAngle;

    const speedFactor = THREE.MathUtils.clamp(speed / 12, 0.2, 1.3);
    const targetRoll = -steerInput * 0.22 * speedFactor;
    this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRoll, Math.min(1, dt * 8));

    const targetPitch = isAirborne
      ? THREE.MathUtils.clamp(state.velY * 0.045, -0.18, 0.24)
      : isSprinting
        ? -0.025
        : 0;
    this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, Math.min(1, dt * 9));

    this.squashY = THREE.MathUtils.lerp(this.squashY, 1, Math.min(1, dt * 12));
    const invSq = 1 / Math.sqrt(this.squashY);

    this.tiltGroup.rotation.z = this.rollAngle;
    this.tiltGroup.rotation.x = this.pitchAngle;
    this.tiltGroup.scale.set(invSq, this.squashY, invSq);

    // 3. Sprint stand-up vs seated bob
    this.sprintBlend = THREE.MathUtils.lerp(
      this.sprintBlend,
      isSprinting && !isCoasting ? 1 : 0,
      Math.min(1, dt * 7)
    );

    const pedalBob = isCoasting || isAirborne ? 0 : Math.abs(Math.sin(this.crankAngle)) * 0.018;
    const plankVibration =
      !isAirborne && !isPaused ? Math.sin(time * (18 + speed * 2.2)) * 0.0025 * speedFactor : 0;

    const hipBaseY = 0.85 + this.sprintBlend * 0.055 + pedalBob + plankVibration;
    const hipBaseZ = 0.22 - this.sprintBlend * 0.065;

    this.torsoPivot.position.set(0, hipBaseY + 0.02, hipBaseZ + 0.02);
    this.torsoPivot.rotation.x = -0.12 * this.sprintBlend + (isAirborne ? -0.08 : 0);
    this.torsoPivot.rotation.z =
      Math.sin(this.crankAngle) * (0.04 + 0.05 * this.sprintBlend) - this.rollAngle * 0.25;
    this.torsoPivot.rotation.y = -steerInput * 0.08;

    // 4. Exact 2-bone Leg IK to pedals
    const rPedalY = BB_POS.y + CRANK_R * Math.cos(this.crankAngle) + 0.022;
    const rPedalZ = BB_POS.z - CRANK_R * Math.sin(this.crankAngle);
    const lPedalY = BB_POS.y - CRANK_R * Math.cos(this.crankAngle) + 0.022;
    const lPedalZ = BB_POS.z + CRANK_R * Math.sin(this.crankAngle);

    this._solveLegIK(
      this.legs.right,
      new THREE.Vector3(HIP_X, hipBaseY, hipBaseZ),
      new THREE.Vector3(PEDAL_X, rPedalY, rPedalZ)
    );
    this._solveLegIK(
      this.legs.left,
      new THREE.Vector3(-HIP_X, hipBaseY, hipBaseZ),
      new THREE.Vector3(-PEDAL_X, lPedalY, lPedalZ)
    );

    // 5. Wings: grip handlebars or spread wide on jumps/glides
    const targetSpread = isGliding ? 1.0 : isAirborne ? 0.82 : 0.0;
    this.wingSpread = THREE.MathUtils.lerp(this.wingSpread, targetSpread, Math.min(1, dt * 11));
    if (this.wingSpread > 0.05 && !isPaused) {
      this.flapPhase += dt * (isGliding ? 13.5 : 8.5);
    }

    // Compute grip positions inside torsoPivot local space
    this.tiltGroup.updateMatrixWorld(true);
    const invTorso = this.torsoPivot.matrixWorld.clone().invert();
    const leftTarget = this.leftGripAnchor.getWorldPosition(new THREE.Vector3()).applyMatrix4(invTorso);
    const rightTarget = this.rightGripAnchor.getWorldPosition(new THREE.Vector3()).applyMatrix4(invTorso);

    this._updateWing(this.wings.left, leftTarget, this.wingSpread, 0, time);
    this._updateWing(this.wings.right, rightTarget, this.wingSpread, 0.15, time);

    // 6. Neck, Head, Beak, Elastic Throat Pouch & Blinking
    if (this.bellTimer > 0) this.bellTimer = Math.max(0, this.bellTimer - dt);
    if (this.waveTimer > 0) this.waveTimer = Math.max(0, this.waveTimer - dt);
    if (this.honkTimer > 0) this.honkTimer = Math.max(0, this.honkTimer - dt);
    if (this.gulpTimer > 0) this.gulpTimer = Math.max(0, this.gulpTimer - dt);

    // Bell shake
    if (this.bellTimer > 0) {
      this.bellLever.rotation.y = Math.sin(this.bellTimer * 48) * 0.45;
      this.bellGroup.rotation.z = Math.sin(this.bellTimer * 52) * 0.08;
    } else {
      this.bellLever.rotation.y = 0;
      this.bellGroup.rotation.z = 0;
    }

    // Neck bobbing with cadence + turning look
    const cadenceBob = isCoasting ? 0 : Math.sin(this.crankAngle * 2) * 0.035;
    this.neckBase.rotation.x = 0.05 + cadenceBob + this.sprintBlend * 0.14;
    this.neckUpper.rotation.x = -0.06 - cadenceBob * 0.8;
    this.headPivot.rotation.y = THREE.MathUtils.lerp(
      this.headPivot.rotation.y,
      -steerInput * 0.35 + lookYaw,
      Math.min(1, dt * 8)
    );
    this.headPivot.rotation.x =
      this.honkTimer > 0
        ? -Math.sin((this.honkTimer / 0.48) * Math.PI) * 0.25
        : this.gulpTimer > 0
          ? -Math.sin((this.gulpTimer / 0.68) * Math.PI * 2) * 0.18
          : 0.03;

    // Beak & Pouch animation
    let jawOpen = 0.02;
    let pouchPuff = 0;
    if (this.honkTimer > 0) {
      const p = Math.sin((this.honkTimer / 0.48) * Math.PI);
      jawOpen = 0.38 * p;
      pouchPuff = 0.45 * p;
    }
    if (this.gulpTimer > 0) {
      const tNorm = 1 - this.gulpTimer / 0.68;
      if (tNorm < 0.45) {
        const snap = Math.sin((tNorm / 0.45) * Math.PI);
        jawOpen = Math.max(jawOpen, 0.56 * snap);
        pouchPuff = Math.max(pouchPuff, 0.85 * snap);
        this.pouchFish.visible = tNorm > 0.12 && tNorm < 0.45;
      } else {
        const swallow = Math.sin(((tNorm - 0.45) / 0.55) * Math.PI);
        pouchPuff = Math.max(pouchPuff, 0.55 * swallow);
        this.pouchFish.visible = false;
      }
    } else {
      this.pouchFish.visible = false;
    }

    this.jawPivot.rotation.x = jawOpen;
    this.pouchGroup.scale.set(1 + pouchPuff * 0.42, 1 + pouchPuff * 0.68, 1 + pouchPuff * 0.15);

    // Natural eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 2.8;
      this.blinkVal = 1;
    }
    if (this.blinkVal > 0) {
      this.blinkVal = Math.max(0, this.blinkVal - dt * 6.5);
    }
    const squint = this.honkTimer > 0 || this.gulpTimer > 0 ? 0.45 : 0;
    const lidClose = Math.max(Math.sin(this.blinkVal * Math.PI), squint);
    for (const lid of this.eyelids) {
      lid.rotation.x = THREE.MathUtils.lerp(-1.25, -0.05, lidClose);
    }

    // 7. Scarf wind flutter + tail feathers + basket fish bounce
    if (!isPaused) {
      this.scarfTime += dt * (4.5 + speed * 0.9);
    }
    const windAmp = THREE.MathUtils.clamp(0.16 + speed * 0.032, 0.14, 0.56);
    this.scarfTail1.rotation.x = -0.32 - windAmp * 0.36 + Math.sin(this.scarfTime) * windAmp * 0.28;
    this.scarfTail1.rotation.y = 0.24 + Math.cos(this.scarfTime * 0.8) * windAmp * 0.38;
    this.scarfTail2.rotation.x = Math.sin(this.scarfTime - 1.1) * windAmp * 0.45;
    this.scarfTail2.rotation.y = Math.cos(this.scarfTime * 0.9 - 0.8) * windAmp * 0.48;

    this.tailGroup.rotation.x = Math.sin(this.scarfTime * 0.5) * 0.04;

    // Basket fish subtle bounce
    const bounce = Math.abs(Math.sin(time * 8)) * (isAirborne ? 0.015 : 0.004 * speedFactor);
    for (let i = 0; i < this.basketFish.length; i++) {
      const f = this.basketFish[i];
      if (f.visible) {
        f.position.y = f.userData.baseY + bounce * (1 + (i % 2) * 0.35);
      }
    }
  }
}
