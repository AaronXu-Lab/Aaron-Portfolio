import * as THREE from '../vendor/three.min.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * Generates a crisp procedural striped canvas texture (for sailor bandana & crate accents).
 */
function createStripeTexture(colorA = '#d93b2b', colorB = '#fff8eb', stripes = 8) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const h = c.height / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
    ctx.fillRect(0, i * h, c.width, h + 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates subtle woven wicker / wood slats texture for rear cargo basket.
 */
function createCrateTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c68b4e';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = y % 32 === 0 ? '#b77b3f' : '#d2995d';
    ctx.fillRect(0, y + 1, 128, 13);
    ctx.fillStyle = 'rgba(72, 40, 12, 0.28)';
    ctx.fillRect(0, y + 14, 128, 2);
  }
  for (let x = 12; x < 128; x += 32) {
    ctx.fillStyle = 'rgba(90, 52, 18, 0.22)';
    ctx.fillRect(x, 0, 4, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Helper: builds a cylinder strut connecting exact 3D points A -> B.
 */
function makeTubeSegment(pA, pB, radiusTop, radiusBottom, material, radialSegments = 12) {
  const diff = new THREE.Vector3().subVectors(pB, pA);
  const len = diff.length();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, radialSegments, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(pA).addScaledVector(diff, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, diff.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Analytical 2-bone Inverse Kinematics solver in 3D space.
 * Returns exact knee position so Hip->Knee = L1 and Knee->Ankle = L2,
 * bending cleanly toward `bendDir` without flipping or detaching.
 */
const _ikDiff = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikOrtho = new THREE.Vector3();

function solveTwoBoneIK(hipPos, anklePos, L1, L2, bendDir, outKnee) {
  _ikDiff.subVectors(anklePos, hipPos);
  const rawDist = _ikDiff.length();
  const minDist = Math.abs(L1 - L2) + 0.008;
  const maxDist = L1 + L2 - 0.006;
  const d = clamp(rawDist, minDist, maxDist);

  if (rawDist > 1e-5) {
    _ikDir.copy(_ikDiff).divideScalar(rawDist);
  } else {
    _ikDir.set(0, -1, 0);
  }

  // Law of cosines for angle at hip
  const cosAlpha = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Project bendDir perpendicular to hip->ankle axis
  _ikOrtho.copy(bendDir).addScaledVector(_ikDir, -bendDir.dot(_ikDir));
  const orthoLen = _ikOrtho.length();
  if (orthoLen > 1e-4) {
    _ikOrtho.divideScalar(orthoLen);
  } else {
    _ikOrtho.set(0, 0, 1);
  }

  outKnee
    .copy(hipPos)
    .addScaledVector(_ikDir, L1 * cosAlpha)
    .addScaledVector(_ikOrtho, L1 * sinAlpha);
  return outKnee;
}

/**
 * Builds a small sculpted silver/golden fish mesh (reusable for basket & mouth).
 */
export function createFishMesh(materials, isGold = false) {
  const g = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.065, 12, 10);
  bodyGeo.scale(0.55, 0.72, 1.85);
  const body = new THREE.Mesh(bodyGeo, isGold ? materials.goldFish : materials.silverFish);
  body.castShadow = true;
  g.add(body);

  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(0, 0.068);
  tailShape.lineTo(-0.075, 0.025);
  tailShape.lineTo(-0.04, 0);
  tailShape.lineTo(-0.075, -0.025);
  tailShape.lineTo(0, -0.068);
  tailShape.closePath();

  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.01, bevelEnabled: false });
  tailGeo.center();
  const tail = new THREE.Mesh(tailGeo, isGold ? materials.goldFin : materials.silverFin);
  tail.rotation.y = Math.PI * 0.5;
  tail.position.z = -0.135;
  g.add(tail);

  const eyeGeo = new THREE.SphereGeometry(0.012, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, materials.pupil);
  eyeL.position.set(0.028, 0.014, 0.078);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.028;
  g.add(eyeL, eyeR);

  g.userData.tail = tail;
  return g;
}

/**
 * Constructs the complete articulated Pelican + Vintage Coastal Bicycle rig.
 * Coordinates: +Y up, +Z forward, +X rider's left, -X rider's right.
 */
export function createPelicanBike() {
  const root = new THREE.Group();

  // Tilt/roll/squash container so jumps & turns pivot around the tire contact patch (y = 0)
  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  const chassis = new THREE.Group();
  leanGroup.add(chassis);

  // Shared tactile materials
  const stripeTex = createStripeTexture('#d63b2f', '#fff7e8', 8);
  const crateTex = createCrateTexture();

  const mats = {
    frameRed: new THREE.MeshStandardMaterial({
      color: 0xd83b31,
      roughness: 0.28,
      metalness: 0.18,
    }),
    frameCream: new THREE.MeshStandardMaterial({
      color: 0xfaf2e1,
      roughness: 0.34,
      metalness: 0.08,
    }),
    fenderTeal: new THREE.MeshStandardMaterial({
      color: 0x1e6f7d,
      roughness: 0.32,
      metalness: 0.2,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xe6b44c,
      roughness: 0.24,
      metalness: 0.72,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xdce4ec,
      roughness: 0.2,
      metalness: 0.82,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x2e3640,
      roughness: 0.45,
      metalness: 0.55,
    }),
    tireCream: new THREE.MeshStandardMaterial({
      color: 0xf3ead8,
      roughness: 0.78,
      metalness: 0.02,
    }),
    tireRubberDark: new THREE.MeshStandardMaterial({
      color: 0x2b3038,
      roughness: 0.82,
      metalness: 0.04,
    }),
    leather: new THREE.MeshStandardMaterial({
      color: 0x9c5525,
      roughness: 0.52,
      metalness: 0.06,
    }),
    cork: new THREE.MeshStandardMaterial({
      color: 0xc89258,
      roughness: 0.76,
      metalness: 0.02,
    }),
    crateWood: new THREE.MeshStandardMaterial({
      map: crateTex,
      roughness: 0.72,
      metalness: 0.04,
    }),
    lampGlass: new THREE.MeshStandardMaterial({
      color: 0xfff8d6,
      emissive: 0xffd269,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.1,
    }),
    plumage: new THREE.MeshStandardMaterial({
      color: 0xfbf7ef,
      roughness: 0.62,
      metalness: 0.02,
    }),
    plumageWarm: new THREE.MeshStandardMaterial({
      color: 0xf5ebd8,
      roughness: 0.65,
      metalness: 0.02,
    }),
    wingDark: new THREE.MeshStandardMaterial({
      color: 0x2c3644,
      roughness: 0.56,
      metalness: 0.05,
    }),
    beakOrange: new THREE.MeshStandardMaterial({
      color: 0xf27427,
      roughness: 0.38,
      metalness: 0.04,
    }),
    beakHook: new THREE.MeshStandardMaterial({
      color: 0xd93e26,
      roughness: 0.32,
      metalness: 0.06,
    }),
    pouchAmber: new THREE.MeshStandardMaterial({
      color: 0xf8aa44,
      roughness: 0.44,
      metalness: 0.02,
    }),
    footOrange: new THREE.MeshStandardMaterial({
      color: 0xee6b24,
      roughness: 0.46,
      metalness: 0.03,
    }),
    eyeRing: new THREE.MeshStandardMaterial({
      color: 0x8bc9e8,
      roughness: 0.5,
      metalness: 0.02,
    }),
    pupil: new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.14,
      metalness: 0.1,
    }),
    eyeShine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    bandana: new THREE.MeshStandardMaterial({
      map: stripeTex,
      roughness: 0.65,
      side: THREE.DoubleSide,
    }),
    goggleLens: new THREE.MeshStandardMaterial({
      color: 0x56c5e8,
      emissive: 0x164a63,
      emissiveIntensity: 0.25,
      roughness: 0.15,
      metalness: 0.35,
    }),
    silverFish: new THREE.MeshStandardMaterial({
      color: 0xb9dcff,
      roughness: 0.22,
      metalness: 0.68,
    }),
    silverFin: new THREE.MeshStandardMaterial({
      color: 0x7cb5e8,
      roughness: 0.32,
      metalness: 0.4,
      side: THREE.DoubleSide,
    }),
    goldFish: new THREE.MeshStandardMaterial({
      color: 0xffcf4d,
      emissive: 0x7a4800,
      emissiveIntensity: 0.22,
      roughness: 0.2,
      metalness: 0.72,
    }),
    goldFin: new THREE.MeshStandardMaterial({
      color: 0xff9f2e,
      roughness: 0.3,
      metalness: 0.45,
      side: THREE.DoubleSide,
    }),
    pinwheelA: new THREE.MeshStandardMaterial({ color: 0xff6b57, roughness: 0.4, side: THREE.DoubleSide }),
    pinwheelB: new THREE.MeshStandardMaterial({ color: 0xffd24c, roughness: 0.4, side: THREE.DoubleSide }),
    pinwheelC: new THREE.MeshStandardMaterial({ color: 0x3ec6c0, roughness: 0.4, side: THREE.DoubleSide }),
  };

  // =========================================================================
  // 1. BICYCLE GEOMETRY & MECHANICAL ASSEMBLIES
  // =========================================================================
  const R_WHEEL = 0.34;
  const R_TIRE = 0.046;
  const R_RIM = R_WHEEL - R_TIRE; // 0.294

  const posRearAxle = new THREE.Vector3(0, R_WHEEL, -0.46);
  const posFrontAxle = new THREE.Vector3(0, R_WHEEL, 0.50);
  const posBB = new THREE.Vector3(0, 0.31, -0.02);
  const posSeatCluster = new THREE.Vector3(0, 0.71, -0.15);
  const posHeadBottom = new THREE.Vector3(0, 0.65, 0.39);
  const posHeadTop = new THREE.Vector3(0, 0.80, 0.34);

  function buildWheel() {
    // Outer squash group stays axis-aligned with wheel plane so tire squish doesn't wobble as wheel spins
    const wheelHolder = new THREE.Group();
    const spinGroup = new THREE.Group();
    wheelHolder.add(spinGroup);

    // Cream balloon tire (Torus lies in XY plane by default -> rotate Y by 90 deg for YZ bike plane)
    const tireGeo = new THREE.TorusGeometry(R_RIM, R_TIRE, 14, 36);
    tireGeo.rotateY(Math.PI * 0.5);
    const tire = new THREE.Mesh(tireGeo, mats.tireCream);
    tire.castShadow = true;
    tire.receiveShadow = true;
    spinGroup.add(tire);

    // Polished Westwood rim
    const rimGeo = new THREE.TorusGeometry(R_RIM - 0.016, 0.015, 10, 32);
    rimGeo.rotateY(Math.PI * 0.5);
    const rim = new THREE.Mesh(rimGeo, mats.chrome);
    spinGroup.add(rim);

    // Hub shell + flanges (along X axis)
    const hubGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.09, 12);
    hubGeo.rotateZ(Math.PI * 0.5);
    const hub = new THREE.Mesh(hubGeo, mats.chrome);
    spinGroup.add(hub);

    for (const side of [-1, 1]) {
      const flangeGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.008, 14);
      flangeGeo.rotateZ(Math.PI * 0.5);
      const flange = new THREE.Mesh(flangeGeo, mats.brass);
      flange.position.x = side * 0.034;
      spinGroup.add(flange);
    }

    // 16 tangential cross-laced spokes
    const spokeCount = 16;
    for (let i = 0; i < spokeCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const a0 = (i / spokeCount) * TAU;
      const a1 = a0 + (i % 4 < 2 ? 0.34 : -0.34);
      const pHub = new THREE.Vector3(side * 0.034, Math.cos(a0) * 0.034, Math.sin(a0) * 0.034);
      const pRim = new THREE.Vector3(side * 0.004, Math.cos(a1) * (R_RIM - 0.02), Math.sin(a1) * (R_RIM - 0.02));
      const spoke = makeTubeSegment(pHub, pRim, 0.0028, 0.0028, mats.chrome, 5);
      spoke.castShadow = false;
      spinGroup.add(spoke);
    }

    // Red valve stem + brass cap so wheel rotation is crisp and readable
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.035, 6), mats.frameRed);
    valve.position.set(0, -(R_RIM - 0.035), 0);
    spinGroup.add(valve);

    return { wheelHolder, spinGroup };
  }

  // Rear wheel mounted to chassis
  const rearWheel = buildWheel();
  rearWheel.wheelHolder.position.copy(posRearAxle);
  chassis.add(rearWheel.wheelHolder);

  // Rear fender (mudguard) + stays + cream mudflap
  const rearFenderGeo = new THREE.TorusGeometry(R_WHEEL + 0.022, 0.032, 10, 24, Math.PI * 0.96);
  rearFenderGeo.rotateY(Math.PI * 0.5);
  // Orient arc over top-rear of rear wheel
  const rearFender = new THREE.Mesh(rearFenderGeo, mats.fenderTeal);
  rearFender.position.copy(posRearAxle);
  rearFender.rotation.x = -Math.PI * 0.06;
  rearFender.scale.set(1.35, 1, 1);
  rearFender.castShadow = true;
  chassis.add(rearFender);

  for (const sx of [-0.052, 0.052]) {
    const pAx = new THREE.Vector3(sx, posRearAxle.y, posRearAxle.z);
    const pStay = new THREE.Vector3(sx * 0.7, posRearAxle.y + 0.16, posRearAxle.z - 0.32);
    chassis.add(makeTubeSegment(pAx, pStay, 0.004, 0.004, mats.chrome, 6));
  }

  // Main lugged diamond frame tubes
  chassis.add(makeTubeSegment(posBB, posSeatCluster, 0.017, 0.018, mats.frameRed, 12)); // Seat tube
  chassis.add(makeTubeSegment(posBB, posHeadBottom, 0.019, 0.02, mats.frameRed, 12)); // Down tube
  chassis.add(makeTubeSegment(posSeatCluster, posHeadTop, 0.016, 0.016, mats.frameRed, 12)); // Top tube
  chassis.add(makeTubeSegment(posHeadBottom, posHeadTop, 0.023, 0.023, mats.frameCream, 14)); // Cream headtube

  // Brass frame lugs at headtube & seat cluster
  for (const pLug of [posHeadBottom, posHeadTop, posSeatCluster]) {
    const lug = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), mats.brass);
    lug.position.copy(pLug);
    chassis.add(lug);
  }

  // Bottom bracket shell
  const bbShellGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.095, 14);
  bbShellGeo.rotateZ(Math.PI * 0.5);
  const bbShell = new THREE.Mesh(bbShellGeo, mats.brass);
  bbShell.position.copy(posBB);
  chassis.add(bbShell);

  // Twin chainstays & twin seatstays flanking the rear wheel
  for (const side of [-1, 1]) {
    const pDropout = new THREE.Vector3(side * 0.056, posRearAxle.y, posRearAxle.z);
    const pBBx = new THREE.Vector3(side * 0.04, posBB.y, posBB.z);
    const pSeatX = new THREE.Vector3(side * 0.022, posSeatCluster.y - 0.02, posSeatCluster.z);
    chassis.add(makeTubeSegment(pBBx, pDropout, 0.011, 0.014, mats.frameRed, 10));
    chassis.add(makeTubeSegment(pSeatX, pDropout, 0.01, 0.012, mats.frameRed, 10));

    const dropoutCap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10), mats.brass);
    dropoutCap.rotation.z = Math.PI * 0.5;
    dropoutCap.position.copy(pDropout);
    chassis.add(dropoutCap);
  }

  // Seatpost + Sprung Honey-Leather Saddle
  const posSaddleBase = new THREE.Vector3(0, 0.80, -0.18);
  chassis.add(makeTubeSegment(posSeatCluster, posSaddleBase, 0.013, 0.013, mats.chrome, 10));

  // Twin coil springs under the rear of the saddle (compress dynamically!)
  const saddleSpringGroup = new THREE.Group();
  saddleSpringGroup.position.set(0, 0.79, -0.23);
  chassis.add(saddleSpringGroup);
  for (const side of [-1, 1]) {
    const coilStack = new THREE.Group();
    coilStack.position.x = side * 0.048;
    for (let r = 0; r < 4; r++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0045, 6, 14), mats.chrome);
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = r * 0.012;
      coilStack.add(ring);
    }
    saddleSpringGroup.add(coilStack);
  }

  const saddleGroup = new THREE.Group();
  saddleGroup.position.set(0, 0.845, -0.185);
  chassis.add(saddleGroup);

  const saddleShape = new THREE.Shape();
  saddleShape.moveTo(0, 0.13); // Narrow nose (+Z after rotation)
  saddleShape.bezierCurveTo(0.032, 0.12, 0.042, 0.03, 0.095, -0.05);
  saddleShape.bezierCurveTo(0.115, -0.1, 0.085, -0.135, 0, -0.13);
  saddleShape.bezierCurveTo(-0.085, -0.135, -0.115, -0.1, -0.095, -0.05);
  saddleShape.bezierCurveTo(-0.042, 0.03, -0.032, 0.12, 0, 0.13);

  const saddleGeo = new THREE.ExtrudeGeometry(saddleShape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 3,
  });
  saddleGeo.rotateX(Math.PI * 0.5);
  const saddleMesh = new THREE.Mesh(saddleGeo, mats.leather);
  saddleMesh.position.y = 0.014;
  saddleMesh.castShadow = true;
  saddleGroup.add(saddleMesh);

  // Brass rivets along rear cantle of leather saddle
  for (let i = -2; i <= 2; i++) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 6), mats.brass);
    rivet.position.set(i * 0.032, 0.018, -0.112 + Math.abs(i) * 0.007);
    saddleGroup.add(rivet);
  }

  // =========================================================================
  // 2. INCLINED STEERING ASSEMBLY (Fork + Front Wheel + Bars + Bell + Headlamp)
  // =========================================================================
  const steerAxisDir = new THREE.Vector3().subVectors(posHeadTop, posHeadBottom).normalize();
  const steerFrame = new THREE.Group();
  steerFrame.position.copy(posHeadTop);
  steerFrame.quaternion.setFromUnitVectors(UP, steerAxisDir);
  chassis.add(steerFrame);

  // Rotating child around local +Y (the exact 72° head-tube axis!)
  const steerPivot = new THREE.Group();
  steerFrame.add(steerPivot);

  // Convert chassis-space coordinates into steerPivot local space at neutral steering
  const steerFrameInv = steerFrame.matrixWorld.clone();
  steerFrame.updateMatrixWorld(true);
  steerFrameInv.copy(steerFrame.matrixWorld).invert();
  const toSteerLocal = (worldPt) => worldPt.clone().applyMatrix4(steerFrameInv);

  const sForkCrown = toSteerLocal(new THREE.Vector3(0, 0.635, 0.40));
  const sFrontAxle = toSteerLocal(posFrontAxle);

  // Fork crown + twin curved/raked fork blades
  const crownLug = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.032, 0.044), mats.brass);
  crownLug.position.copy(sForkCrown);
  steerPivot.add(crownLug);

  for (const side of [-1, 1]) {
    const pCrownSide = sForkCrown.clone().add(new THREE.Vector3(side * 0.048, 0, 0));
    const pMid = sForkCrown
      .clone()
      .lerp(sFrontAxle, 0.55)
      .add(new THREE.Vector3(side * 0.054, -0.01, -0.015));
    const pAxleSide = sFrontAxle.clone().add(new THREE.Vector3(side * 0.052, 0, 0));
    const forkCurve = new THREE.CatmullRomCurve3([pCrownSide, pMid, pAxleSide]);
    const forkGeo = new THREE.TubeGeometry(forkCurve, 12, 0.012, 8, false);
    const forkMesh = new THREE.Mesh(forkGeo, mats.frameRed);
    forkMesh.castShadow = true;
    steerPivot.add(forkMesh);

    const fCap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 10), mats.brass);
    fCap.rotation.z = Math.PI * 0.5;
    fCap.position.copy(pAxleSide);
    steerPivot.add(fCap);
  }

  // Front wheel inside steerPivot (aligned back to chassis orientation at neutral steer)
  const frontWheelMount = new THREE.Group();
  frontWheelMount.position.copy(sFrontAxle);
  frontWheelMount.quaternion.copy(steerFrame.quaternion).invert();
  steerPivot.add(frontWheelMount);

  const frontWheel = buildWheel();
  frontWheelMount.add(frontWheel.wheelHolder);

  // Front teal fender + stays
  const frontFenderGeo = new THREE.TorusGeometry(R_WHEEL + 0.022, 0.031, 10, 22, Math.PI * 0.78);
  frontFenderGeo.rotateY(Math.PI * 0.5);
  const frontFender = new THREE.Mesh(frontFenderGeo, mats.fenderTeal);
  frontFender.rotation.x = -Math.PI * 0.08;
  frontFender.scale.set(1.32, 1, 1);
  frontFender.castShadow = true;
  frontWheelMount.add(frontFender);

  // Vintage Brass Dynamo Headlamp mounted ahead of the fork crown
  const headlampMount = new THREE.Group();
  headlampMount.position.copy(toSteerLocal(new THREE.Vector3(0, 0.695, 0.455)));
  headlampMount.quaternion.copy(steerFrame.quaternion).invert();
  steerPivot.add(headlampMount);

  const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.068, 14), mats.brass);
  lampBody.rotation.x = Math.PI * 0.54;
  lampBody.castShadow = true;
  headlampMount.add(lampBody);

  const lampRim = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 8, 16), mats.chrome);
  lampRim.position.set(0, -0.002, 0.034);
  headlampMount.add(lampRim);

  const lampLens = new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 10), mats.lampGlass);
  lampLens.scale.set(1, 1, 0.35);
  lampLens.position.set(0, -0.002, 0.032);
  headlampMount.add(lampLens);

  // Volumetric translucent beam cone + real SpotLight (illuminates boardwalk in dusk/night!)
  const beamConeGeo = new THREE.ConeGeometry(0.62, 2.7, 20, 1, true);
  beamConeGeo.translate(0, -1.35, 0);
  beamConeGeo.rotateX(-Math.PI * 0.5);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe69c,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const headlampCone = new THREE.Mesh(beamConeGeo, beamMat);
  headlampCone.position.set(0, -0.01, 0.04);
  headlampCone.rotation.x = 0.16;
  headlampMount.add(headlampCone);

  const headlampLight = new THREE.SpotLight(0xffe29a, 0, 8.5, 0.52, 0.65, 1.2);
  headlampLight.position.set(0, 0, 0.05);
  const headlampTarget = new THREE.Object3D();
  headlampTarget.position.set(0, -0.68, 2.9);
  headlampMount.add(headlampLight, headlampTarget);
  headlampLight.target = headlampTarget;

  // Quill stem + Swept-back North-Road Cruiser Handlebars + Cork Grips + Brass Bell
  const barMount = new THREE.Group();
  barMount.position.copy(toSteerLocal(new THREE.Vector3(0, 0.91, 0.31)));
  barMount.quaternion.copy(steerFrame.quaternion).invert();
  steerPivot.add(barMount);

  // Chrome quill stem rising out of headtube
  steerPivot.add(
    makeTubeSegment(
      new THREE.Vector3(0, 0, 0),
      toSteerLocal(new THREE.Vector3(0, 0.91, 0.31)),
      0.013,
      0.014,
      mats.chrome,
      10
    )
  );
  // Forward stem extension
  const stemExt = makeTubeSegment(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.015, 0.055),
    0.014,
    0.014,
    mats.chrome,
    10
  );
  barMount.add(stemExt);

  // Swept-back mustache cruiser bar curve
  const barCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.265, 0.02, -0.145),
    new THREE.Vector3(0.24, 0.032, -0.02),
    new THREE.Vector3(0.13, 0.022, 0.058),
    new THREE.Vector3(0, 0.015, 0.055),
    new THREE.Vector3(-0.13, 0.022, 0.058),
    new THREE.Vector3(-0.24, 0.032, -0.02),
    new THREE.Vector3(-0.265, 0.02, -0.145),
  ]);
  const barMesh = new THREE.Mesh(new THREE.TubeGeometry(barCurve, 28, 0.0115, 10, false), mats.chrome);
  barMesh.castShadow = true;
  barMount.add(barMesh);

  // Cork handlebar grips + wing-tip grip anchors (for 1:1 wing-to-handlebar tracking!)
  const gripLeftAnchor = new THREE.Object3D();
  const gripRightAnchor = new THREE.Object3D();
  for (const side of [1, -1]) {
    const pG0 = new THREE.Vector3(side * 0.244, 0.029, -0.042);
    const pG1 = new THREE.Vector3(side * 0.268, 0.019, -0.155);
    const grip = makeTubeSegment(pG0, pG1, 0.0175, 0.0165, mats.cork, 10);
    barMount.add(grip);

    const endPlug = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), mats.brass);
    endPlug.position.copy(pG1);
    barMount.add(endPlug);

    // Brake lever under each grip
    const lever = makeTubeSegment(
      new THREE.Vector3(side * 0.24, 0.022, -0.03),
      new THREE.Vector3(side * 0.265, -0.005, 0.038),
      0.0045,
      0.0035,
      mats.chrome,
      6
    );
    barMount.add(lever);

    const anchor = side > 0 ? gripLeftAnchor : gripRightAnchor;
    anchor.position.set(side * 0.258, 0.034, -0.095);
    barMount.add(anchor);
  }

  // Brass Dome Bicycle Bell on right side of handlebar (`叮铃!`)
  const bellGroup = new THREE.Group();
  bellGroup.position.set(-0.145, 0.045, 0.048);
  barMount.add(bellGroup);

  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 14, 10, 0, TAU, 0, Math.PI * 0.58),
    mats.brass
  );
  bellDome.castShadow = true;
  bellGroup.add(bellDome);

  const bellStriker = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.032), mats.chrome);
  bellStriker.position.set(0.022, -0.004, -0.016);
  bellGroup.add(bellStriker);

  // =========================================================================
  // 3. DRIVETRAIN (Chainring + Marching Chain + Cranks + Ankling Pedals)
  // =========================================================================
  const R_CHAINRING = 0.088;
  const R_COG = 0.042;

  // Chain loop connecting BB chainring and Rear Axle cog (on right side x = -0.046)
  const chainX = -0.048;
  const chainPts = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.45 + (i / 10) * Math.PI * 0.9;
    chainPts.push(new THREE.Vector3(chainX, posBB.y + Math.sin(a) * R_CHAINRING, posBB.z + Math.cos(a) * R_CHAINRING));
  }
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.55 + (i / 8) * Math.PI * 0.9;
    chainPts.push(
      new THREE.Vector3(chainX, posRearAxle.y + Math.sin(a) * R_COG, posRearAxle.z + Math.cos(a) * R_COG)
    );
  }
  const chainCurve = new THREE.CatmullRomCurve3(chainPts, true);
  const chainRail = new THREE.Mesh(new THREE.TubeGeometry(chainCurve, 44, 0.0055, 6, true), mats.darkSteel);
  chassis.add(chainRail);

  // Animated chain rollers marching along the chainCurve
  const CHAIN_LINK_COUNT = 28;
  const chainLinkGeo = new THREE.BoxGeometry(0.012, 0.013, 0.022);
  const chainInstanced = new THREE.InstancedMesh(chainLinkGeo, mats.brass, CHAIN_LINK_COUNT);
  chassis.add(chainInstanced);

  // Rear cog
  const rearCog = new THREE.Mesh(new THREE.CylinderGeometry(R_COG, R_COG, 0.008, 16), mats.darkSteel);
  rearCog.rotation.z = Math.PI * 0.5;
  rearCog.position.set(chainX, posRearAxle.y, posRearAxle.z);
  chassis.add(rearCog);

  // Crankset rotating around BB
  const crankPivot = new THREE.Group();
  crankPivot.position.copy(posBB);
  chassis.add(crankPivot);

  // 5-spoke chainring on right side
  const chainringRim = new THREE.Mesh(new THREE.TorusGeometry(R_CHAINRING - 0.006, 0.007, 8, 24), mats.chrome);
  chainringRim.rotation.y = Math.PI * 0.5;
  chainringRim.position.x = chainX;
  crankPivot.add(chainringRim);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const pOut = new THREE.Vector3(chainX, Math.cos(a) * (R_CHAINRING - 0.008), Math.sin(a) * (R_CHAINRING - 0.008));
    crankPivot.add(makeTubeSegment(new THREE.Vector3(chainX, 0, 0), pOut, 0.006, 0.008, mats.chrome, 6));
  }

  const R_CRANK = 0.155;
  const pedalLeftPivot = new THREE.Group();
  const pedalRightPivot = new THREE.Group();

  // Left crank at angle 0 (+Y), Right crank at angle PI (-Y)
  for (const [side, angleOffset, pedalPivot] of [
    [1, 0, pedalLeftPivot],
    [-1, Math.PI, pedalRightPivot],
  ]) {
    const xArm = side * 0.064;
    const tipY = Math.cos(angleOffset) * R_CRANK;
    const tipZ = Math.sin(angleOffset) * R_CRANK;

    crankPivot.add(
      makeTubeSegment(new THREE.Vector3(xArm, 0, 0), new THREE.Vector3(xArm, tipY, tipZ), 0.009, 0.013, mats.chrome, 8)
    );

    // Spindle extending outward to pedal platform
    const xPedal = side * 0.126;
    crankPivot.add(
      makeTubeSegment(
        new THREE.Vector3(xArm, tipY, tipZ),
        new THREE.Vector3(xPedal, tipY, tipZ),
        0.006,
        0.006,
        mats.darkSteel,
        6
      )
    );

    pedalPivot.position.set(xPedal, tipY, tipZ);
    crankPivot.add(pedalPivot);

    // Wide rubber-and-brass platform pedal sized comfortably for webbed pelican feet!
    const pedalBody = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.018, 0.105), mats.darkSteel);
    pedalBody.castShadow = true;
    pedalPivot.add(pedalBody);

    for (const zR of [-0.048, 0.048]) {
      const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.01, 0.008), mats.brass);
      reflector.position.z = zR;
      pedalPivot.add(reflector);
    }
  }

  // =========================================================================
  // 4. REAR WOODEN CARGO CRATE + STORED FISH + SPINNING PINWHEEL
  // =========================================================================
  const rackGroup = new THREE.Group();
  rackGroup.position.set(0, 0.725, -0.49);
  chassis.add(rackGroup);

  // Rear rack struts from seat cluster & rear axle
  for (const side of [-1, 1]) {
    chassis.add(
      makeTubeSegment(
        new THREE.Vector3(side * 0.025, posSeatCluster.y - 0.02, posSeatCluster.z),
        new THREE.Vector3(side * 0.08, 0.72, -0.42),
        0.006,
        0.006,
        mats.chrome,
        6
      )
    );
    chassis.add(
      makeTubeSegment(
        new THREE.Vector3(side * 0.052, posRearAxle.y + 0.02, posRearAxle.z),
        new THREE.Vector3(side * 0.08, 0.72, -0.52),
        0.006,
        0.006,
        mats.chrome,
        6
      )
    );
  }

  // Slatted wooden fish crate (open top)
  const crateFloor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.25), mats.crateWood);
  crateFloor.castShadow = true;
  rackGroup.add(crateFloor);

  const wallFB = new THREE.BoxGeometry(0.24, 0.13, 0.018);
  const wallLR = new THREE.BoxGeometry(0.018, 0.13, 0.25);
  for (const [geo, px, pz] of [
    [wallFB, 0, 0.116],
    [wallFB, 0, -0.116],
    [wallLR, 0.111, 0],
    [wallLR, -0.111, 0],
  ]) {
    const w = new THREE.Mesh(geo, mats.crateWood);
    w.position.set(px, 0.07, pz);
    w.castShadow = true;
    rackGroup.add(w);
  }

  // Pre-built fish slots inside the rear crate (revealed as fish count grows!)
  const crateFishMeshes = [];
  for (let i = 0; i < 5; i++) {
    const f = createFishMesh(mats, i === 4);
    f.scale.setScalar(0.86);
    f.position.set((i % 2 === 0 ? -1 : 1) * 0.048, 0.11 + Math.floor(i / 2) * 0.032, -0.03 + (i % 3) * 0.032);
    f.rotation.set(-0.78 + (i % 2) * 0.22, (i - 2) * 0.25, (i % 2 === 0 ? 1 : -1) * 0.2);
    f.visible = false;
    rackGroup.add(f);
    crateFishMeshes.push(f);
  }

  // Cheerful spinning coastal pinwheel mounted on back-left corner of crate!
  const pinwheelStick = makeTubeSegment(
    new THREE.Vector3(0.105, 0.08, -0.11),
    new THREE.Vector3(0.13, 0.29, -0.14),
    0.005,
    0.006,
    mats.frameCream,
    6
  );
  rackGroup.add(pinwheelStick);

  const pinwheelHub = new THREE.Group();
  pinwheelHub.position.set(0.13, 0.29, -0.148);
  rackGroup.add(pinwheelHub);

  const bladeMats = [mats.pinwheelA, mats.pinwheelB, mats.pinwheelC, mats.pinwheelB];
  for (let i = 0; i < 4; i++) {
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.quadraticCurveTo(0.038, 0.015, 0.068, 0.062);
    bladeShape.quadraticCurveTo(0.015, 0.068, 0, 0.025);
    bladeShape.closePath();
    const blade = new THREE.Mesh(new THREE.ShapeGeometry(bladeShape), bladeMats[i]);
    blade.rotation.z = (i / 4) * TAU;
    blade.rotation.y = 0.26;
    pinwheelHub.add(blade);
  }
  pinwheelHub.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), mats.brass));

  // =========================================================================
  // 5. SCULPTED PELICAN CYCLIST (Torso + Sailor Scarf + S-Neck + Pouch + Wings + IK Legs)
  // =========================================================================
  const pelicanPelvis = new THREE.Group();
  // Base seated hip-pelvis position right atop the leather saddle
  const PELVIS_SEATED = new THREE.Vector3(0, 0.995, -0.165);
  const PELVIS_SPRINT = new THREE.Vector3(0, 1.115, 0.035);
  pelicanPelvis.position.copy(PELVIS_SEATED);
  chassis.add(pelicanPelvis);

  // Plump sculpted avian body via LatheGeometry deformed into an ergonomic teardrop
  const lathePts = [];
  const profileSteps = 18;
  for (let i = 0; i <= profileSteps; i++) {
    const t = i / profileSteps; // 0 = tail end, 1 = chest/neck base
    const y = (t - 0.45) * 0.50;
    const r = Math.sin(Math.pow(t, 0.78) * Math.PI) * 0.205 + 0.004;
    lathePts.push(new THREE.Vector2(r, y));
  }
  const torsoGeo = new THREE.LatheGeometry(lathePts, 22);
  torsoGeo.rotateX(Math.PI * 0.32); // Tilt breast forward-upward (+Z, +Y)
  torsoGeo.scale(0.94, 1.04, 1.12);
  const torsoMesh = new THREE.Mesh(torsoGeo, mats.plumage);
  torsoMesh.position.set(0, 0.045, 0.03);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  pelicanPelvis.add(torsoMesh);

  // Soft warm breast plumage patch
  const chestGeo = new THREE.SphereGeometry(0.165, 16, 14);
  chestGeo.scale(0.86, 1.05, 0.92);
  const chestMesh = new THREE.Mesh(chestGeo, mats.plumageWarm);
  chestMesh.position.set(0, 0.07, 0.11);
  pelicanPelvis.add(chestMesh);

  // Fanned 7-blade Tail Feathers
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.01, -0.205);
  pelicanPelvis.add(tailGroup);

  for (let i = -3; i <= 3; i++) {
    const fGeo = new THREE.SphereGeometry(0.042, 8, 8);
    fGeo.scale(0.68, 0.22, 2.7 - Math.abs(i) * 0.18);
    const fMat = Math.abs(i) >= 2 ? mats.wingDark : mats.plumage;
    const feather = new THREE.Mesh(fGeo, fMat);
    feather.rotation.y = i * 0.16;
    feather.rotation.x = 0.22 + Math.abs(i) * 0.03;
    feather.position.set(i * 0.024, Math.abs(i) * 0.004, -0.075);
    feather.castShadow = true;
    tailGroup.add(feather);
  }

  // Red-and-Cream Striped Sailor Bandana / Neckerchief around neck base + fluttering tails!
  const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.028, 10, 20), mats.bandana);
  scarfCollar.rotation.x = Math.PI * 0.42;
  scarfCollar.position.set(0, 0.205, 0.145);
  pelicanPelvis.add(scarfCollar);

  const scarfKnot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), mats.bandana);
  scarfKnot.position.set(0.03, 0.19, 0.025);
  pelicanPelvis.add(scarfKnot);

  const scarfTails = [];
  for (let t = 0; t < 2; t++) {
    const ribbonGeo = new THREE.PlaneGeometry(0.048, 0.21, 1, 5);
    ribbonGeo.translate(0, -0.105, 0);
    ribbonGeo.rotateX(-Math.PI * 0.42);
    const ribbon = new THREE.Mesh(ribbonGeo, mats.bandana);
    ribbon.position.set(0.035 + t * 0.032, 0.19, 0.022);
    ribbon.rotation.y = (t === 0 ? 1 : -1) * 0.18;
    pelicanPelvis.add(ribbon);
    scarfTails.push({ mesh: ribbon, basePos: ribbonGeo.attributes.position.array.slice(), phase: t * 1.4 });
  }

  // -------------------------------------------------------------------------
  // 5B. ARTICULATED S-CURVED NECK & GIANT PELICAN HEAD + ELASTIC THROAT POUCH
  // -------------------------------------------------------------------------
  const neckBase = new THREE.Group();
  neckBase.position.set(0, 0.215, 0.155);
  pelicanPelvis.add(neckBase);

  const neckSeg1 = makeTubeSegment(
    new THREE.Vector3(0, -0.02, 0),
    new THREE.Vector3(0, 0.16, -0.035),
    0.072,
    0.095,
    mats.plumage,
    14
  );
  neckBase.add(neckSeg1);

  const neckMid = new THREE.Group();
  neckMid.position.set(0, 0.15, -0.032);
  neckBase.add(neckMid);

  const neckSeg2 = makeTubeSegment(
    new THREE.Vector3(0, -0.015, 0),
    new THREE.Vector3(0, 0.165, 0.048),
    0.064,
    0.073,
    mats.plumage,
    14
  );
  neckMid.add(neckSeg2);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.165, 0.052);
  neckMid.add(headGroup);

  // Sculpted Pelican Skull
  const skullGeo = new THREE.SphereGeometry(0.096, 16, 14);
  skullGeo.scale(0.92, 0.96, 1.16);
  const skull = new THREE.Mesh(skullGeo, mats.plumage);
  skull.castShadow = true;
  headGroup.add(skull);

  // Jaunty backward-sweeping Crest Feathers (冠羽)
  const crestFeathers = [];
  for (let i = 0; i < 4; i++) {
    const cfGeo = new THREE.ConeGeometry(0.018 - i * 0.002, 0.115 - i * 0.012, 7);
    cfGeo.translate(0, 0.055, 0);
    cfGeo.rotateX(-Math.PI * 0.66);
    const cf = new THREE.Mesh(cfGeo, i % 2 === 0 ? mats.plumageWarm : mats.plumage);
    cf.position.set((i - 1.5) * 0.012, 0.072 - i * 0.008, -0.045 - i * 0.014);
    headGroup.add(cf);
    crestFeathers.push(cf);
  }

  // Expressive Eyes + Sky-Blue Orbital Rings + Blinking Eyelids
  const eyelids = [];
  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(side * 0.074, 0.024, 0.048);
    eyeSocket.rotation.y = side * 0.36;
    headGroup.add(eyeSocket);

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.014, 14), mats.eyeRing);
    ring.rotation.z = Math.PI * 0.5;
    eyeSocket.add(ring);

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), mats.pupil);
    eyeball.position.x = side * 0.006;
    eyeSocket.add(eyeball);

    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 6, 6), mats.eyeShine);
    shine.position.set(side * 0.022, 0.008, 0.01);
    eyeSocket.add(shine);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 10, 8, 0, TAU, 0, Math.PI * 0.52),
      mats.eyeRing
    );
    lid.position.x = side * 0.006;
    lid.rotation.z = -side * 0.1;
    lid.scale.set(1.05, 0.08, 1.05); // Open by default
    eyeSocket.add(lid);
    eyelids.push(lid);
  }

  // Brass Aviator Goggles (perched on forehead at cruise; slide over eyes during Sprint!)
  const gogglesGroup = new THREE.Group();
  gogglesGroup.position.set(0, 0.068, 0.036);
  gogglesGroup.rotation.x = -0.52;
  headGroup.add(gogglesGroup);

  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.011, 8, 20), mats.leather);
  strap.rotation.x = Math.PI * 0.5;
  strap.scale.set(0.95, 1.12, 1);
  gogglesGroup.add(strap);

  for (const side of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.029, 0.028, 14), mats.brass);
    cup.rotation.x = Math.PI * 0.5;
    cup.rotation.y = side * 0.34;
    cup.position.set(side * 0.056, 0, 0.088);
    gogglesGroup.add(cup);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 14), mats.goggleLens);
    lens.rotation.y = side * 0.34;
    lens.position.set(side * 0.061, 0, 0.103);
    gogglesGroup.add(lens);
  }

  // Iconic Long Keeled Upper Bill (上喙) + Reddish Terminal Hook (喙端弯钩)
  const upperBillGroup = new THREE.Group();
  upperBillGroup.position.set(0, 0.004, 0.088);
  headGroup.add(upperBillGroup);

  const billCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.012, 0),
    new THREE.Vector3(0, 0.008, 0.16),
    new THREE.Vector3(0, 0.004, 0.32),
    new THREE.Vector3(0, 0.002, 0.44),
  ]);
  const upperBillGeo = new THREE.TubeGeometry(billCurve, 16, 0.036, 10, false);
  upperBillGeo.scale(1.18, 0.62, 1);
  const upperBillMesh = new THREE.Mesh(upperBillGeo, mats.beakOrange);
  upperBillMesh.castShadow = true;
  upperBillGroup.add(upperBillMesh);

  // Dorsal culmen ridge along top of bill
  const ridgeGeo = new THREE.CylinderGeometry(0.007, 0.016, 0.43, 8);
  ridgeGeo.rotateX(Math.PI * 0.5);
  const ridgeMesh = new THREE.Mesh(ridgeGeo, mats.beakOrange);
  ridgeMesh.position.set(0, 0.022, 0.215);
  upperBillGroup.add(ridgeMesh);

  // Terminal nail hook at tip of beak
  const hookGeo = new THREE.ConeGeometry(0.022, 0.058, 8);
  hookGeo.rotateX(Math.PI * 0.88);
  const hookMesh = new THREE.Mesh(hookGeo, mats.beakHook);
  hookMesh.position.set(0, -0.012, 0.452);
  upperBillGroup.add(hookMesh);

  // Hinged Lower Mandible + Deformable Elastic Gular Throat Pouch (喉囊)
  const lowerJawGroup = new THREE.Group();
  lowerJawGroup.position.set(0, -0.018, 0.082);
  headGroup.add(lowerJawGroup);

  // Left & Right thin mandible rami framing the pouch opening
  for (const side of [-1, 1]) {
    const ramusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.044, 0, 0),
      new THREE.Vector3(side * 0.038, -0.004, 0.22),
      new THREE.Vector3(0, 0, 0.435),
    ]);
    const ramus = new THREE.Mesh(new THREE.TubeGeometry(ramusCurve, 12, 0.008, 6, false), mats.beakOrange);
    lowerJawGroup.add(ramus);
  }

  // Elastic Throat Pouch group (driven by 3D spring-damper & fish count!)
  const pouchPivot = new THREE.Group();
  pouchPivot.position.set(0, -0.004, 0.16);
  lowerJawGroup.add(pouchPivot);

  const pouchGeo = new THREE.SphereGeometry(0.115, 18, 14);
  // Sculpt asymmetric pelican gular pouch: sleek near beak tip, deep rounded belly toward throat!
  const pPos = pouchGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    let x = pPos.getX(i);
    let y = pPos.getY(i);
    let z = pPos.getZ(i);
    // Flatten top rim so it attaches cleanly along the lower mandible rami
    if (y > 0) {
      y *= 0.18;
    } else {
      const bellyFactor = 1.0 + clamp((-z + 0.04) * 3.2, -0.35, 0.55);
      y *= 1.18 * bellyFactor;
    }
    const widthTaper = clamp(1.0 - (z / 0.12) * 0.48, 0.25, 1.25);
    x *= 0.56 * widthTaper;
    z *= 1.95;
    pPos.setXYZ(i, x, y, z);
  }
  pouchGeo.computeVertexNormals();

  const pouchMesh = new THREE.Mesh(pouchGeo, mats.pouchAmber);
  pouchMesh.position.set(0, -0.002, 0.035);
  pouchMesh.castShadow = true;
  pouchPivot.add(pouchMesh);

  // Subtle fish tail peeking out of beak during fresh catch animation!
  const caughtPeekFish = createFishMesh(mats, false);
  caughtPeekFish.position.set(0, 0.01, 0.28);
  caughtPeekFish.rotation.y = Math.PI;
  caughtPeekFish.scale.setScalar(0.85);
  caughtPeekFish.visible = false;
  lowerJawGroup.add(caughtPeekFish);

  // Mouth world-position helper for catching/tossing fish
  const mouthAnchor = new THREE.Object3D();
  mouthAnchor.position.set(0, -0.01, 0.34);
  upperBillGroup.add(mouthAnchor);

  // -------------------------------------------------------------------------
  // 5C. DUAL-MODE IK WINGS (Exact Handlebar Cork-Grip IK <-> 2.2m Glider Span!)
  // -------------------------------------------------------------------------
  const L_HUMERUS = 0.245;
  const L_ULNA = 0.265;

  function buildWing(side) {
    // side = +1 (left), -1 (right)
    const shoulderAnchor = new THREE.Object3D();
    shoulderAnchor.position.set(side * 0.148, 0.135, 0.085);
    pelicanPelvis.add(shoulderAnchor);

    // Shoulder plumage cap
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), mats.plumage);
    shoulderAnchor.add(shoulderCap);

    // Upper wing (Humerus: Shoulder -> Elbow) placed in leanGroup space via exact 2-bone IK!
    const upperGroup = new THREE.Group();
    const upperGeo = new THREE.CylinderGeometry(0.042, 0.062, L_HUMERUS, 10);
    upperGeo.scale(0.62, 1, 1.35);
    const upperMesh = new THREE.Mesh(upperGeo, mats.plumage);
    upperMesh.castShadow = true;
    upperGroup.add(upperMesh);
    leanGroup.add(upperGroup);

    // Elbow plumage joint cap for seamless bend silhouette
    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), mats.plumage);
    elbowCap.scale.set(0.7, 0.9, 1.15);
    leanGroup.add(elbowCap);

    // Forearm wing (Ulna: Elbow -> Carpal Wrist on Cork Grip!)
    const foreGroup = new THREE.Group();
    const foreGeo = new THREE.CylinderGeometry(0.030, 0.044, L_ULNA, 10);
    foreGeo.scale(0.55, 1, 1.42);
    const foreMesh = new THREE.Mesh(foreGeo, mats.plumage);
    foreMesh.castShadow = true;
    foreGroup.add(foreMesh);
    leanGroup.add(foreGroup);

    // Wrist / Carpal joint + fanned dark-charcoal Primary Flight Feathers
    const wristGroup = new THREE.Group();
    leanGroup.add(wristGroup);

    const wristCap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), mats.plumageWarm);
    wristGroup.add(wristCap);

    const primaries = [];
    for (let p = 0; p < 6; p++) {
      const pGeo = new THREE.SphereGeometry(0.032, 8, 6);
      const lenScale = 3.5 - p * 0.28;
      // Default feather points backward (-Z) when gripping bars, fans outward in flight!
      pGeo.scale(0.46, 0.16, lenScale);
      pGeo.translate(0, 0, -0.032 * lenScale * 0.85);
      const pMesh = new THREE.Mesh(pGeo, p < 4 ? mats.wingDark : mats.plumageWarm);
      pMesh.castShadow = true;
      pMesh.position.set(side * 0.008, -p * 0.004, 0.01);
      wristGroup.add(pMesh);
      primaries.push(pMesh);
    }

    return { side, shoulderAnchor, upperGroup, elbowCap, foreGroup, wristGroup, primaries };
  }

  const wingLeft = buildWing(1);
  const wingRight = buildWing(-1);

  // -------------------------------------------------------------------------
  // 5D. 2-BONE ANALYTICAL IK LEGS (Feathered Thigh + Orange Tarsus + Webbed Foot)
  // -------------------------------------------------------------------------
  const L_THIGH = 0.258;
  const L_SHIN = 0.276;

  function buildLeg(side) {
    const hipAnchor = new THREE.Object3D();
    hipAnchor.position.set(side * 0.105, -0.058, 0.028);
    pelicanPelvis.add(hipAnchor);

    // Fluffy hip plumage cuff so leg blends organically into the body
    const hipFluff = new THREE.Mesh(new THREE.SphereGeometry(0.074, 10, 8), mats.plumage);
    hipFluff.scale.set(0.88, 1.08, 1.05);
    hipFluff.position.y = -0.015;
    hipAnchor.add(hipFluff);

    // Leg meshes live in `leanGroup` space so we place them directly from exact IK coordinates!
    const thighGroup = new THREE.Group();
    const thighGeo = new THREE.CylinderGeometry(0.032, 0.062, L_THIGH, 12);
    // Cylinder centered at origin; top is +L/2 (at knee? Wait: wider at hip, narrower at knee!)
    // In CylinderGeometry(radiusTop, radiusBottom): +Y is top, -Y is bottom.
    // If we orient +Y from Hip -> Knee, then Hip is at -Y and Knee is at +Y, so radiusTop=knee(0.032), radiusBottom=hip(0.065)!
    const thighMesh = new THREE.Mesh(thighGeo, mats.plumage);
    thighMesh.castShadow = true;
    thighGroup.add(thighMesh);
    leanGroup.add(thighGroup);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.031, 10, 8), mats.footOrange);
    kneeCap.castShadow = true;
    leanGroup.add(kneeCap);

    const shinGroup = new THREE.Group();
    const shinGeo = new THREE.CylinderGeometry(0.017, 0.024, L_SHIN, 10);
    const shinMesh = new THREE.Mesh(shinGeo, mats.footOrange);
    shinMesh.castShadow = true;
    shinGroup.add(shinMesh);
    leanGroup.add(shinGroup);

    // Sculpted 3-toed Webbed Orange Pelican Foot!
    const footGroup = new THREE.Group();
    leanGroup.add(footGroup);

    const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), mats.footOrange);
    footGroup.add(ankleJoint);

    const webShape = new THREE.Shape();
    webShape.moveTo(-0.022, -0.03); // Heel
    webShape.lineTo(-0.062, 0.088); // Outer toe
    webShape.quadraticCurveTo(-0.03, 0.072, 0, 0.105); // Webbing -> Middle toe
    webShape.quadraticCurveTo(0.03, 0.072, 0.062, 0.088); // Webbing -> Inner toe
    webShape.lineTo(0.022, -0.03);
    webShape.closePath();

    const webGeo = new THREE.ExtrudeGeometry(webShape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    webGeo.rotateX(Math.PI * 0.5);
    const webMesh = new THREE.Mesh(webGeo, mats.footOrange);
    webMesh.position.set(0, -0.008, 0.015);
    webMesh.castShadow = true;
    footGroup.add(webMesh);

    // 3 raised toe ridges for crisp readable silhouette
    for (const angle of [-0.42, 0, 0.42]) {
      const toeLen = angle === 0 ? 0.115 : 0.102;
      const toeGeo = new THREE.CylinderGeometry(0.006, 0.011, toeLen, 7);
      toeGeo.translate(0, toeLen * 0.5, 0);
      toeGeo.rotateX(Math.PI * 0.5);
      const toe = new THREE.Mesh(toeGeo, mats.footOrange);
      toe.position.set(0, -0.008, -0.008);
      toe.rotation.y = angle;
      footGroup.add(toe);
    }

    return { side, hipAnchor, thighGroup, kneeCap, shinGroup, footGroup };
  }

  const legLeft = buildLeg(1);
  const legRight = buildLeg(-1);

  // =========================================================================
  // 6. ANIMATION & PROCEDURAL PHYSICS STATE
  // =========================================================================
  const anim = {
    wheelAngle: 0,
    crankAngle: 0.35,
    chainPhase: 0,
    steerVisual: 0,
    leanRoll: 0,
    sprintBlend: 0, // 0 = seated cruise, 1 = out-of-saddle standing sprint!
    glideBlend: 0, // 0 = hands on bars, 1 = full wingspan spread!
    parkBlend: 0, // 0 = both feet on pedals, 1 = right foot planted on boardwalk!
    squashY: 1,
    squashVel: 0,
    bellTimer: 0,
    chompTimer: 0,
    catchPeekTimer: 0,
    flapImpulse: 0,
    blinkTimer: 2.4,
    happyEyeTimer: 0,
    pouchOffsetY: 0,
    pouchVelY: 0,
    pouchSwayX: 0,
    pouchVelX: 0,
    pouchFishVisual: 0,
    prevHeight: 0,
    prevVelY: 0,
    time: 0,
    pinwheelAngle: 0,
  };

  // Scratch vectors/matrices to ensure ZERO garbage collection stalls per frame!
  const _invLeanMat = new THREE.Matrix4();
  const _hipPos = new THREE.Vector3();
  const _pedalPos = new THREE.Vector3();
  const _ankleTarget = new THREE.Vector3();
  const _groundPlant = new THREE.Vector3();
  const _kneePos = new THREE.Vector3();
  const _bendDir = new THREE.Vector3();
  const _segVec = new THREE.Vector3();
  const _gripLocal = new THREE.Vector3();
  const _chainPt = new THREE.Vector3();
  const _chainTan = new THREE.Vector3();
  const _chainMat = new THREE.Matrix4();
  const _chainQuat = new THREE.Quaternion();
  const _chainScale = new THREE.Vector3(1, 1, 1);

  function triggerBell() {
    anim.bellTimer = 0.55;
    anim.happyEyeTimer = 0.65;
  }

  function triggerChomp(showFishPeek = false) {
    anim.chompTimer = 0.42;
    anim.happyEyeTimer = 0.7;
    anim.pouchVelY -= 0.95; // Juicy downward gulp impulse on the throat pouch!
    if (showFishPeek) anim.catchPeekTimer = 0.32;
  }

  function triggerFlap(strength = 1.0) {
    anim.flapImpulse = Math.max(anim.flapImpulse, strength);
    anim.happyEyeTimer = 0.55;
  }

  function triggerLandingImpact(impactSpeed) {
    const strength = clamp(impactSpeed * 0.055, 0.04, 0.24);
    anim.squashVel -= strength * 9.5;
    anim.pouchVelY -= strength * 6.5;
  }

  /**
   * Updates all mechanical linkages, 2-bone IK legs, dual-mode wings, throat-pouch spring,
   * chain rollers, pinwheel, and lighting intensity for the current frame.
   */
  function update(dt, state) {
    const {
      speed = 6.0, // m/s forward speed
      steer = 0, // -1 (right) .. +1 (left)
      sprinting = false,
      coasting = false,
      airborne = false,
      gliding = false,
      jumpHeight = 0,
      velY = 0,
      slopePitch = 0,
      pouchFish = 0,
      crateFish = 0,
      lookOffsetYaw = 0,
      nightFactor = 0, // 0 = day, 0.35 = sunset, 1 = starlight night
      reducedMotion = false,
    } = state;

    anim.time += dt;
    const motionScale = reducedMotion ? 0.35 : 1.0;

    // 1. Wheel rotation (exact no-slip rolling: +X rotation advances +Z top of wheel!)
    const ds = speed * dt;
    anim.wheelAngle = (anim.wheelAngle + ds / R_WHEEL) % TAU;
    rearWheel.spinGroup.rotation.x = anim.wheelAngle;
    frontWheel.spinGroup.rotation.x = anim.wheelAngle;

    // 2. Riding mode blends: Sprint (standing rock), Park (foot down at 0 speed), Coast/Glide
    const isParked = !airborne && speed < 0.18 && coasting;
    anim.parkBlend = damp(anim.parkBlend, isParked ? 1 : 0, 7.5, dt);
    anim.sprintBlend = damp(anim.sprintBlend, sprinting && speed > 1.2 && !airborne ? 1 : 0, 8.5, dt);

    const targetGlide = (airborne && gliding) || anim.flapImpulse > 0.08 ? 1 : 0;
    anim.glideBlend = damp(anim.glideBlend, targetGlide, targetGlide > 0.5 ? 11 : 7.5, dt);
    anim.flapImpulse = Math.max(0, anim.flapImpulse - dt * 2.4);

    // 3. Crank cadence & marching roller chain
    let crankOmega = 0;
    if (!coasting && !gliding && anim.parkBlend < 0.45 && speed > 0.12) {
      // Gear ratio tuned so pedaling cadence looks natural and energetic (~70-115 RPM)
      const gearRatio = lerp(0.46, 0.54, anim.sprintBlend);
      crankOmega = (speed / R_WHEEL) * gearRatio;
      anim.crankAngle = (anim.crankAngle + crankOmega * dt) % TAU;
      anim.chainPhase = (anim.chainPhase + crankOmega * 0.095 * dt) % 1;
    } else if (coasting || gliding) {
      // Smoothly level the cranks toward horizontal rest (PI/2 or 3PI/2) when coasting/gliding!
      const targetRest = anim.crankAngle > Math.PI ? Math.PI * 1.5 : Math.PI * 0.5;
      let diff = targetRest - anim.crankAngle;
      if (diff > Math.PI) diff -= TAU;
      if (diff < -Math.PI) diff += TAU;
      anim.crankAngle = (anim.crankAngle + diff * Math.min(1, dt * 4.5) + TAU) % TAU;
    }
    crankPivot.rotation.x = anim.crankAngle;

    // Counter-rotate pedals so platforms stay nearly horizontal + realistic cyclist ankling pitch!
    const anklingAmp = 0.22 * (1 - anim.parkBlend);
    pedalLeftPivot.rotation.x = -anim.crankAngle + Math.sin(anim.crankAngle - 0.35) * anklingAmp;
    pedalRightPivot.rotation.x = -anim.crankAngle + Math.sin(anim.crankAngle + Math.PI - 0.35) * anklingAmp;

    // Update marching chain links along closed curve
    for (let i = 0; i < CHAIN_LINK_COUNT; i++) {
      const u = (i / CHAIN_LINK_COUNT + anim.chainPhase) % 1;
      chainCurve.getPointAt(u, _chainPt);
      chainCurve.getTangentAt(u, _chainTan);
      _chainQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _chainTan);
      _chainMat.compose(_chainPt, _chainQuat, _chainScale);
      chainInstanced.setMatrixAt(i, _chainMat);
    }
    chainInstanced.instanceMatrix.needsUpdate = true;

    // 4. Steering, dynamic banking lean, out-of-saddle frame sway ("摇车"), & landing squash
    anim.steerVisual = damp(anim.steerVisual, steer, 12, dt);
    // Subtle track-stand bar wiggle at very low speed
    const lowSpeedBalance =
      !isParked && speed < 1.8 && !airborne ? Math.sin(anim.time * 4.2) * 0.08 * (1 - speed / 1.8) : 0;
    steerPivot.rotation.y = anim.steerVisual * 0.52 + lowSpeedBalance;

    // Out-of-saddle sprint rocks the bike frame opposite to the active pedal downstroke!
    const sprintFrameSway = -Math.sin(anim.crankAngle) * 0.135 * anim.sprintBlend * motionScale;
    const turnBank = -anim.steerVisual * clamp(speed / 9.5, 0.15, 1.0) * 0.36;
    const parkTilt = -0.105 * anim.parkBlend; // Lean slightly right onto planted right foot!
    anim.leanRoll = damp(anim.leanRoll, turnBank + sprintFrameSway + parkTilt, 10, dt);

    // Squash & stretch spring around tire contact patch
    const squashForce = (1.0 - anim.squashY) * 145 - anim.squashVel * 15;
    anim.squashVel += squashForce * dt;
    anim.squashY = clamp(anim.squashY + anim.squashVel * dt, 0.82, 1.14);

    // Apply tire radial squish on wheels without affecting chassis geometry excessively
    const tireSquish = clamp(1 - (1 - anim.squashY) * 0.75, 0.86, 1.08);
    rearWheel.wheelHolder.scale.set(1, tireSquish, 2 - tireSquish);
    frontWheel.wheelHolder.scale.set(1, tireSquish, 2 - tireSquish);

    // Bunny-hop wheelie pitch
    const hopPitch = airborne ? clamp(-velY * 0.055, -0.22, 0.20) : 0;
    leanGroup.position.y = jumpHeight - (1 - tireSquish) * R_TIRE * 0.6;
    leanGroup.rotation.z = anim.leanRoll;
    leanGroup.rotation.x = slopePitch + hopPitch;

    // 5. Pelvis bounce, Saddle coil spring compression & Torso posture
    const cadenceBounce =
      !coasting && !airborne
        ? Math.abs(Math.sin(anim.crankAngle)) * (0.016 + anim.sprintBlend * 0.026) * motionScale
        : 0;
    pelicanPelvis.position.lerpVectors(PELVIS_SEATED, PELVIS_SPRINT, anim.sprintBlend);
    pelicanPelvis.position.y += cadenceBounce - (1 - anim.squashY) * 0.14;

    // Pelvis counter-rolls slightly against sprint bike rock so the pelican's head stays centered!
    pelicanPelvis.rotation.z =
      -sprintFrameSway * 0.65 + Math.sin(anim.crankAngle) * 0.035 * (1 - anim.sprintBlend) * motionScale;
    pelicanPelvis.rotation.x = lerp(0.06, 0.28, anim.sprintBlend) + (airborne && gliding ? 0.14 : 0);

    // Compress visible saddle coil springs ONLY when seated!
    const seatedLoad = (1 - anim.sprintBlend) * (1 + (1 - anim.squashY) * 2.2 - cadenceBounce * 4);
    const springScaleY = clamp(1.06 - seatedLoad * 0.16, 0.68, 1.12);
    saddleSpringGroup.scale.y = springScaleY;
    saddleGroup.position.y = 0.825 + springScaleY * 0.022;

    // 6. S-Curved Neck Follow-Through, Goggles Slide, Eye Blink & Beak Chomp
    const accelVert = (velY - anim.prevVelY) / Math.max(dt, 0.004);
    anim.prevVelY = velY;
    anim.prevHeight = jumpHeight;

    const neckCadence = Math.sin(anim.crankAngle * 2 - 0.6) * 0.045 * (1 - (coasting ? 0.8 : 0)) * motionScale;
    neckBase.rotation.x = lerp(0.14, 0.34, anim.sprintBlend) + neckCadence;
    neckBase.rotation.z = -anim.steerVisual * 0.12;

    neckMid.rotation.x = lerp(-0.24, -0.42, anim.sprintBlend) - neckCadence * 0.7;
    neckMid.rotation.y = damp(
      neckMid.rotation.y,
      anim.steerVisual * 0.26 + lookOffsetYaw * 0.5 + (isParked ? Math.sin(anim.time * 1.3) * 0.32 : 0),
      8,
      dt
    );

    // Keep head level and expressive
    headGroup.rotation.x = lerp(0.04, -0.16, anim.sprintBlend) - hopPitch * 0.45;
    headGroup.rotation.y = anim.steerVisual * 0.18 + lookOffsetYaw * 0.5;
    headGroup.rotation.z = anim.steerVisual * 0.14;

    // Aviator goggles slide smoothly from forehead down over eyes during Sprint!
    gogglesGroup.position.y = lerp(0.068, 0.024, anim.sprintBlend);
    gogglesGroup.position.z = lerp(0.036, 0.012, anim.sprintBlend);
    gogglesGroup.rotation.x = lerp(-0.52, -0.04, anim.sprintBlend);

    // Crest feathers flutter in wind
    const windSpeed = Math.max(1.5, speed);
    for (let i = 0; i < crestFeathers.length; i++) {
      crestFeathers[i].rotation.x =
        Math.sin(anim.time * (8 + windSpeed * 1.1) + i * 0.9) * 0.09 * motionScale - windSpeed * 0.012;
    }

    // Sailor bandana ribbons ripple in breeze
    for (const st of scarfTails) {
      const posAttr = st.mesh.geometry.attributes.position;
      const base = st.basePos;
      for (let v = 0; v < posAttr.count; v++) {
        const bx = base[v * 3];
        const by = base[v * 3 + 1];
        const bz = base[v * 3 + 2];
        const distFactor = clamp(-bz / 0.2, 0, 1);
        const wave = Math.sin(anim.time * (7 + windSpeed * 1.4) - distFactor * 4.2 + st.phase) * 0.028 * distFactor;
        posAttr.setXYZ(v, bx + wave * 0.6, by + wave + clamp(windSpeed * 0.008, 0, 0.06) * distFactor, bz);
      }
      posAttr.needsUpdate = true;
    }

    // Tail fan spread during jumps/glides
    const tailSpread = 1 + anim.glideBlend * 0.35;
    tailGroup.scale.set(tailSpread, 1, 1);
    tailGroup.rotation.x = Math.sin(anim.crankAngle * 2) * 0.06 * motionScale - anim.glideBlend * 0.18;

    // Blinking & happy eye squints
    anim.blinkTimer -= dt;
    if (anim.blinkTimer <= 0) {
      anim.blinkTimer = 2.6 + Math.random() * 2.8;
    }
    if (anim.happyEyeTimer > 0) anim.happyEyeTimer = Math.max(0, anim.happyEyeTimer - dt);
    const isBlinking = anim.blinkTimer < 0.13;
    const lidClose = isBlinking ? 1.0 : anim.happyEyeTimer > 0 ? 0.58 : anim.sprintBlend * 0.28;
    for (const lid of eyelids) {
      lid.scale.y = lerp(0.08, 1.05, lidClose);
    }

    // Beak snap (`咔嗒!`) & Elastic Throat Pouch Spring-Damper Physics!
    if (anim.chompTimer > 0) anim.chompTimer = Math.max(0, anim.chompTimer - dt);
    if (anim.catchPeekTimer > 0) anim.catchPeekTimer = Math.max(0, anim.catchPeekTimer - dt);
    caughtPeekFish.visible = anim.catchPeekTimer > 0;
    if (caughtPeekFish.visible) {
      caughtPeekFish.rotation.z = Math.sin(anim.time * 38) * 0.35;
    }

    const chompPhase = anim.chompTimer > 0 ? Math.sin((anim.chompTimer / 0.42) * Math.PI) : 0;
    upperBillGroup.rotation.x = -chompPhase * 0.24;
    lowerJawGroup.rotation.x = chompPhase * 0.46;

    // Smooth visual fish volume inside gular pouch
    anim.pouchFishVisual = damp(anim.pouchFishVisual, pouchFish, 9, dt);
    const pouchMassScale = 1 + anim.pouchFishVisual * 0.16;

    // Spring-damper excited by vertical acceleration, pedaling rhythm & steering!
    const pouchDriveY = clamp(-accelVert * 0.0035, -0.06, 0.06) - cadenceBounce * 0.45;
    const kPouch = 135 / pouchMassScale;
    const cPouch = 9.5;
    anim.pouchVelY += ((pouchDriveY - anim.pouchOffsetY) * kPouch - anim.pouchVelY * cPouch) * dt;
    anim.pouchOffsetY = clamp(anim.pouchOffsetY + anim.pouchVelY * dt, -0.055, 0.045);

    const pouchDriveX = -anim.steerVisual * 0.06 * clamp(speed / 6, 0.2, 1.4);
    anim.pouchVelX += ((pouchDriveX - anim.pouchSwayX) * 95 - anim.pouchVelX * 8.5) * dt;
    anim.pouchSwayX = clamp(anim.pouchSwayX + anim.pouchVelX * dt, -0.06, 0.06);

    const bulgeW = 1 + anim.pouchFishVisual * 0.14 - anim.pouchOffsetY * 2.2;
    const bulgeH = 1 + anim.pouchFishVisual * 0.22 - anim.pouchOffsetY * 3.8 * motionScale;
    pouchPivot.scale.set(bulgeW, clamp(bulgeH, 0.78, 2.35), 1 + anim.pouchFishVisual * 0.04);
    pouchPivot.rotation.z = anim.pouchSwayX * 3.2 * motionScale;

    // Brass bell striker flick & vibration
    if (anim.bellTimer > 0) {
      anim.bellTimer = Math.max(0, anim.bellTimer - dt);
      bellStriker.rotation.y = Math.sin(anim.bellTimer * 36) * 0.42;
      bellDome.scale.setScalar(1 + Math.sin(anim.bellTimer * 55) * 0.08);
    } else {
      bellStriker.rotation.y = 0;
      bellDome.scale.setScalar(1);
    }

    // Rear crate stored fish + coastal pinwheel rotation
    for (let i = 0; i < crateFishMeshes.length; i++) {
      crateFishMeshes[i].visible = i < crateFish;
    }
    anim.pinwheelAngle = (anim.pinwheelAngle + (2.2 + speed * 1.65) * dt) % TAU;
    pinwheelHub.rotation.z = anim.pinwheelAngle;

    // Headlamp dusk/night illumination
    const lampStrength = clamp((nightFactor - 0.18) / 0.82, 0, 1);
    mats.lampGlass.emissiveIntensity = lerp(0.35, 2.6, lampStrength);
    beamMat.opacity = lampStrength * 0.15;
    headlampLight.intensity = lampStrength * 6.5;

    // 7. Update world matrices inside `leanGroup` so Wings & IK Legs solve with 100% precision!
    leanGroup.updateMatrixWorld(true);
    _invLeanMat.copy(leanGroup.matrixWorld).invert();

    // 7A. Dual-Mode 2-Bone IK Wings: 100% locked onto Cork Handlebar Grips when riding,
    // seamlessly unfurling into a wide 2.2m cambered wingspan when gliding or flapping!
    const flapWave =
      anim.flapImpulse > 0.02
        ? Math.sin(anim.time * 18) * 0.26 * anim.flapImpulse
        : Math.sin(anim.time * 4.2) * 0.035 * motionScale;

    for (const [wing, gripAnchor] of [
      [wingLeft, gripLeftAnchor],
      [wingRight, gripRightAnchor],
    ]) {
      const s = wing.side; // +1 left, -1 right
      wing.shoulderAnchor.getWorldPosition(_hipPos).applyMatrix4(_invLeanMat);
      gripAnchor.getWorldPosition(_gripLocal).applyMatrix4(_invLeanMat);

      // Open glider wrist target in leanGroup space
      _ankleTarget.set(
        _hipPos.x + s * 0.48,
        _hipPos.y + 0.08 + flapWave,
        _hipPos.z - 0.02
      );

      const g = anim.glideBlend;
      // Blend wrist target continuously between Cork Handlebar Grip (g=0) and Open Glider Span (g=1)!
      _pedalPos.lerpVectors(_gripLocal, _ankleTarget, g);

      // Elbow bends slightly outward and upward/aft like a real cyclist/bird elbow
      _bendDir.set(s * 0.85, lerp(0.28, 0.45, g), lerp(-0.45, -0.25, g)).normalize();
      solveTwoBoneIK(_hipPos, _pedalPos, L_HUMERUS, L_ULNA, _bendDir, _kneePos);

      // Upper wing (Shoulder -> Elbow)
      _segVec.subVectors(_kneePos, _hipPos);
      const uLen = _segVec.length();
      wing.upperGroup.position.copy(_hipPos).addScaledVector(_segVec, 0.5);
      wing.upperGroup.quaternion.setFromUnitVectors(UP, _segVec.divideScalar(Math.max(uLen, 1e-4)));
      wing.upperGroup.scale.y = uLen / L_HUMERUS;

      // Elbow cap + Forearm wing (Elbow -> Wrist on Cork Grip / Span)
      wing.elbowCap.position.copy(_kneePos);
      _segVec.subVectors(_pedalPos, _kneePos);
      const fLen = _segVec.length();
      wing.foreGroup.position.copy(_kneePos).addScaledVector(_segVec, 0.5);
      wing.foreGroup.quaternion.setFromUnitVectors(UP, _segVec.divideScalar(Math.max(fLen, 1e-4)));
      wing.foreGroup.scale.y = fLen / L_ULNA;

      // Wrist + Primary flight feathers: tucked sleekly aft along handlebars at g=0, fanned wide outward at g=1!
      wing.wristGroup.position.copy(_pedalPos);
      wing.wristGroup.rotation.set(
        lerp(-0.22, 0.04, g),
        lerp(-s * 0.18, -s * 1.38, g),
        lerp(0, s * (0.12 + flapWave * 0.6), g)
      );
      for (let p = 0; p < wing.primaries.length; p++) {
        wing.primaries[p].rotation.y = lerp(-s * p * 0.035, s * (2.5 - p) * 0.14, g);
        wing.primaries[p].rotation.x = lerp(-p * 0.04, -p * 0.015, g);
      }
    }

    // 7B. Exact 2-Bone 3D Analytical Leg IK (Hip -> Knee -> Ankle -> Webbed Foot on Pedal / Plank!)
    for (const [leg, pedalPivot, crankPhase] of [
      [legLeft, pedalLeftPivot, anim.crankAngle],
      [legRight, pedalRightPivot, anim.crankAngle + Math.PI],
    ]) {
      // Hip position in leanGroup space
      leg.hipAnchor.getWorldPosition(_hipPos).applyMatrix4(_invLeanMat);

      // Pedal platform surface in leanGroup space
      pedalPivot.getWorldPosition(_pedalPos).applyMatrix4(_invLeanMat);
      _ankleTarget.copy(_pedalPos);
      _ankleTarget.y += 0.024; // Webbed foot sole thickness above pedal center

      // When parked (speed ~ 0), right foot smoothly plants onto the wooden boardwalk beside the bike!
      if (leg.side < 0 && anim.parkBlend > 0.005) {
        _groundPlant.set(-0.27, 0.018, -0.06);
        _ankleTarget.lerp(_groundPlant, anim.parkBlend);
      }

      // Knee bend hint points forward (+Z) and slightly outward (side * X) so knees clear belly & top-tube!
      _bendDir.set(leg.side * 0.32, 0.15, 1.0).normalize();
      solveTwoBoneIK(_hipPos, _ankleTarget, L_THIGH, L_SHIN, _bendDir, _kneePos);

      // Position & orient feathered thigh (Hip -> Knee)
      _segVec.subVectors(_kneePos, _hipPos);
      const thighLen = _segVec.length();
      leg.thighGroup.position.copy(_hipPos).addScaledVector(_segVec, 0.5);
      leg.thighGroup.quaternion.setFromUnitVectors(UP, _segVec.divideScalar(Math.max(thighLen, 1e-4)));
      leg.thighGroup.scale.y = thighLen / L_THIGH;

      // Knee joint cap
      leg.kneeCap.position.copy(_kneePos);

      // Position & orient orange tarsus/shin (Knee -> Ankle)
      _segVec.subVectors(_ankleTarget, _kneePos);
      const shinLen = _segVec.length();
      leg.shinGroup.position.copy(_kneePos).addScaledVector(_segVec, 0.5);
      leg.shinGroup.quaternion.setFromUnitVectors(UP, _segVec.divideScalar(Math.max(shinLen, 1e-4)));
      leg.shinGroup.scale.y = shinLen / L_SHIN;

      // Position & orient 3-toed Webbed Foot flat on pedal (or flat on boardwalk when parked!)
      leg.footGroup.position.copy(_ankleTarget);
      const pedalPitch = Math.sin(crankPhase - 0.35) * anklingAmp;
      const footPitch = leg.side < 0 ? lerp(pedalPitch, -leanGroup.rotation.x, anim.parkBlend) : pedalPitch;
      const footRoll = leg.side < 0 ? lerp(0, -leanGroup.rotation.z, anim.parkBlend) : 0;
      leg.footGroup.rotation.set(footPitch, leg.side * 0.06, footRoll);
    }
  }

  function getMouthWorldPosition(outVec) {
    mouthAnchor.updateWorldMatrix(true, false);
    return mouthAnchor.getWorldPosition(outVec);
  }

  return {
    root,
    leanGroup,
    chassis,
    materials: mats,
    anim,
    update,
    triggerBell,
    triggerChomp,
    triggerFlap,
    triggerLandingImpact,
    getMouthWorldPosition,
  };
}
