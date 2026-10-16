// Detailed procedural 3D Pelican & Coastal Cruiser Bicycle Rig + Two-Bone Analytic IK
import * as THREE from './vendor/three.module.min.js';

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vK = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _u1 = new THREE.Vector3();
const _u2 = new THREE.Vector3();
const _poleLocal = new THREE.Vector3();
const _xAxis = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _mBasis = new THREE.Matrix4();
const _DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Exact Analytic Two-Bone IK Solver in 3D.
 * Computes the exact 3D joint position K in parent space using the Law of Cosines,
 * then aligns `rootBone` (-Y -> K - A) and `midBone` (-Y -> B - K) with zero twist error.
 */
export function solveTwoBoneIK(rootBone, midBone, L1, L2, targetWorldPos, poleWorldPos) {
  rootBone.parent.updateWorldMatrix(true, false);
  _m1.copy(rootBone.parent.matrixWorld).invert();

  _vA.copy(rootBone.position); // hip/shoulder in parent space
  _vB.copy(targetWorldPos).applyMatrix4(_m1); // target in parent space
  _vC.copy(poleWorldPos).applyMatrix4(_m1);   // pole in parent space

  _dir.subVectors(_vB, _vA);
  const distRaw = _dir.length();
  const minDist = Math.abs(L1 - L2) + 0.005;
  const maxDist = (L1 + L2) - 0.005;
  const d = THREE.MathUtils.clamp(distRaw, minDist, maxDist);

  if (distRaw > 1e-5) {
    _dir.divideScalar(distRaw);
  } else {
    _dir.set(0, -1, 0);
  }

  // Clamped target position
  _vB.copy(_vA).addScaledVector(_dir, d);

  // Law of cosines for distance along _dir and perpendicular along _poleLocal
  const cosTheta1 = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const sinTheta1 = Math.sqrt(Math.max(0, 1 - cosTheta1 * cosTheta1));

  // Pole direction perpendicular to _dir
  _poleLocal.subVectors(_vC, _vA);
  _poleLocal.addScaledVector(_dir, -_poleLocal.dot(_dir));
  if (_poleLocal.lengthSq() < 1e-5) {
    _poleLocal.set(0, 0, 1);
  } else {
    _poleLocal.normalize();
  }

  // Exact knee/elbow position K in parent space
  _vK.copy(_vA)
    .addScaledVector(_dir, L1 * cosTheta1)
    .addScaledVector(_poleLocal, L1 * sinTheta1);

  // Upper bone unit vector (-Y of rootBone should point along _u1 = normalize(K - A))
  _u1.subVectors(_vK, _vA).normalize();
  const negU1 = _u1.clone().negate(); // +Y axis of rootBone
  _xAxis.crossVectors(_poleLocal, negU1);
  if (_xAxis.lengthSq() < 1e-5) {
    _xAxis.set(1, 0, 0);
  } else {
    _xAxis.normalize();
  }
  _zAxis.crossVectors(_xAxis, negU1).normalize();
  _mBasis.makeBasis(_xAxis, negU1, _zAxis);
  rootBone.quaternion.setFromRotationMatrix(_mBasis);

  // Lower bone unit vector in rootBone local space (-Y of midBone points along B - K)
  _u2.subVectors(_vB, _vK).normalize();
  _q1.copy(rootBone.quaternion).invert();
  _u2.applyQuaternion(_q1);
  midBone.quaternion.setFromUnitVectors(_DOWN, _u2);
}

/**
 * Helper to create a cylinder tube between two 3D points.
 */
function createTubeSegment(p1, p2, r1, r2, material, radialSegments = 12) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geom = new THREE.CylinderGeometry(r2, r1, len, radialSegments);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a silver coastal sardine/mackerel mesh.
 */
export function createFishMesh(scale = 1) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.22,
    metalness: 0.65
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.3,
    metalness: 0.4
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    roughness: 0.4,
    side: THREE.DoubleSide
  });

  const bodyGeom = new THREE.SphereGeometry(0.11, 14, 10);
  bodyGeom.scale(0.58, 0.72, 2.25);
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.castShadow = true;
  group.add(body);

  const bellyGeom = new THREE.SphereGeometry(0.095, 12, 8);
  bellyGeom.scale(0.55, 0.55, 2.05);
  const belly = new THREE.Mesh(bellyGeom, bellyMat);
  belly.position.set(0, -0.025, 0.01);
  group.add(belly);

  // Forked tail fin
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(0, 0.12);
  tailShape.lineTo(-0.16, 0.03);
  tailShape.lineTo(-0.07, 0);
  tailShape.lineTo(-0.16, -0.11);
  tailShape.closePath();

  const tailGeom = new THREE.ShapeGeometry(tailShape);
  const tail = new THREE.Mesh(tailGeom, finMat);
  tail.rotation.y = Math.PI * 0.5;
  tail.position.set(0, 0.01, -0.22);
  group.add(tail);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const eyeGeom = new THREE.SphereGeometry(0.018, 8, 8);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(s * 0.052, 0.02, 0.16);
    group.add(eye);
  }

  group.userData.tail = tail;
  return group;
}

/**
 * Builds a wheel with cream balloon tire, alloy rim, brass hub, and 16 spokes.
 */
function buildWheel(wheelRadius, materials) {
  const wheelGroup = new THREE.Group();
  const rimRadius = wheelRadius - 0.072;

  // Cream balloon tire
  const tireGeom = new THREE.TorusGeometry(rimRadius, 0.074, 14, 36);
  tireGeom.rotateY(Math.PI * 0.5);
  const tire = new THREE.Mesh(tireGeom, materials.creamTire);
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheelGroup.add(tire);

  // Polished alloy rim
  const rimGeom = new THREE.TorusGeometry(rimRadius - 0.015, 0.022, 10, 32);
  rimGeom.rotateY(Math.PI * 0.5);
  const rim = new THREE.Mesh(rimGeom, materials.chrome);
  wheelGroup.add(rim);

  // Center hub + brass flanges
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.14, 14).rotateZ(Math.PI * 0.5),
    materials.brass
  );
  wheelGroup.add(hub);

  for (const side of [-1, 1]) {
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.016, 14).rotateZ(Math.PI * 0.5),
      materials.chrome
    );
    flange.position.x = side * 0.048;
    wheelGroup.add(flange);
  }

  // 16 cross-laced spokes
  const spokeCount = 16;
  const spokeGeom = new THREE.CylinderGeometry(0.0055, 0.0055, rimRadius - 0.03, 6);
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const side = i % 2 === 0 ? 1 : -1;
    const spoke = new THREE.Mesh(spokeGeom, materials.chrome);
    const midR = (rimRadius - 0.03) * 0.5;
    spoke.position.set(side * 0.022, Math.cos(angle) * midR, Math.sin(angle) * midR);
    spoke.rotation.x = -angle;
    spoke.rotation.z = side * 0.055;
    wheelGroup.add(spoke);
  }

  // Cute brass valve stem + reflector for visible spin clarity
  const reflector = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.055, 0.11),
    materials.amberGlow
  );
  reflector.position.set(0, rimRadius * 0.68, 0);
  wheelGroup.add(reflector);

  return wheelGroup;
}

/**
 * Constructs the full Pelican + Coastal Cruiser Bicycle Rig.
 */
export function buildPelicanBikeRig() {
  const root = new THREE.Group();

  // Shared PBR material palette
  const materials = {
    frameTeal: new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      roughness: 0.25,
      metalness: 0.35
    }),
    frameCoral: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.3,
      metalness: 0.2
    }),
    creamTire: new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.65,
      metalness: 0.05
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.85
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.22,
      metalness: 0.82
    }),
    leather: new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.55,
      metalness: 0.08
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.6
    }),
    wicker: new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.78,
      metalness: 0.02
    }),
    featherWhite: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.52,
      metalness: 0.02
    }),
    featherCream: new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.55,
      metalness: 0.02
    }),
    featherSlate: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.05
    }),
    beakYellow: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.32,
      metalness: 0.08
    }),
    beakTipCoral: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.28,
      metalness: 0.1
    }),
    pouchAmber: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.38,
      metalness: 0.05,
      side: THREE.DoubleSide
    }),
    webbedFoot: new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.42,
      metalness: 0.05
    }),
    navyCap: new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.45,
      metalness: 0.12
    }),
    amberGlow: new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2
    }),
    lampGlass: new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 1.5,
      roughness: 0.1
    })
  };

  // Bike suspension & roll container
  const bikeChasis = new THREE.Group();
  root.add(bikeChasis);

  const wheelRadius = 0.62;
  const rearAxlePos = new THREE.Vector3(0, wheelRadius, -0.82);
  const frontAxlePos = new THREE.Vector3(0, wheelRadius, 0.84);
  const bbPos = new THREE.Vector3(0, 0.56, -0.14);
  const seatClusterPos = new THREE.Vector3(0, 1.22, -0.42);
  const headTopPos = new THREE.Vector3(0, 1.30, 0.52);
  const headBotPos = new THREE.Vector3(0, 1.00, 0.60);

  // Rear wheel
  const rearWheel = buildWheel(wheelRadius, materials);
  rearWheel.position.copy(rearAxlePos);
  bikeChasis.add(rearWheel);

  // Rear cruiser fender
  const rearFenderGeom = new THREE.TorusGeometry(wheelRadius + 0.035, 0.052, 10, 24, Math.PI * 0.95);
  rearFenderGeom.rotateY(Math.PI * 0.5);
  rearFenderGeom.rotateX(-Math.PI * 0.08);
  const rearFender = new THREE.Mesh(rearFenderGeom, materials.frameTeal);
  rearFender.position.copy(rearAxlePos);
  rearFender.castShadow = true;
  bikeChasis.add(rearFender);

  // Tubular Frame (Seat tube, Down tube, Swept cruiser Top tube, Stays)
  const frameGroup = new THREE.Group();
  bikeChasis.add(frameGroup);

  frameGroup.add(createTubeSegment(bbPos, seatClusterPos, 0.036, 0.034, materials.frameTeal));
  frameGroup.add(createTubeSegment(bbPos, headBotPos, 0.04, 0.038, materials.frameTeal));
  frameGroup.add(createTubeSegment(headBotPos, headTopPos, 0.044, 0.044, materials.brass));

  // Curved vintage cruiser top-tube + secondary brace tube
  const topCurve = new THREE.QuadraticBezierCurve3(
    seatClusterPos.clone().add(new THREE.Vector3(0, -0.04, 0)),
    new THREE.Vector3(0, 1.34, 0.08),
    headTopPos.clone().add(new THREE.Vector3(0, -0.04, 0))
  );
  const topTube = new THREE.Mesh(
    new THREE.TubeGeometry(topCurve, 20, 0.034, 12, false),
    materials.frameTeal
  );
  topTube.castShadow = true;
  frameGroup.add(topTube);

  const midCurve = new THREE.QuadraticBezierCurve3(
    seatClusterPos.clone().add(new THREE.Vector3(0, -0.22, 0.05)),
    new THREE.Vector3(0, 1.12, 0.12),
    headBotPos.clone().add(new THREE.Vector3(0, 0.06, 0))
  );
  const midTube = new THREE.Mesh(
    new THREE.TubeGeometry(midCurve, 16, 0.026, 10, false),
    materials.frameCoral
  );
  midTube.castShadow = true;
  frameGroup.add(midTube);

  // Dual chain stays & seat stays
  for (const side of [-1, 1]) {
    const axleSide = rearAxlePos.clone().add(new THREE.Vector3(side * 0.085, 0, 0));
    const bbSide = bbPos.clone().add(new THREE.Vector3(side * 0.055, 0, 0));
    const seatSide = seatClusterPos.clone().add(new THREE.Vector3(side * 0.035, -0.05, 0));
    frameGroup.add(createTubeSegment(bbSide, axleSide, 0.022, 0.018, materials.frameTeal));
    frameGroup.add(createTubeSegment(seatSide, axleSide, 0.02, 0.016, materials.frameTeal));
  }

  // Bottom bracket shell & Chainring + Chain guard
  const bbShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.16, 16).rotateZ(Math.PI * 0.5),
    materials.brass
  );
  bbShell.position.copy(bbPos);
  frameGroup.add(bbShell);

  const chainring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.016, 24).rotateZ(Math.PI * 0.5),
    materials.chrome
  );
  chainring.position.set(0.095, bbPos.y, bbPos.z);
  frameGroup.add(chainring);

  // Drive chain loop
  const chainUpper = createTubeSegment(
    new THREE.Vector3(0.095, bbPos.y + 0.17, bbPos.z),
    new THREE.Vector3(0.075, rearAxlePos.y + 0.07, rearAxlePos.z),
    0.01,
    0.01,
    materials.darkMetal
  );
  const chainLower = createTubeSegment(
    new THREE.Vector3(0.095, bbPos.y - 0.17, bbPos.z),
    new THREE.Vector3(0.075, rearAxlePos.y - 0.07, rearAxlePos.z),
    0.01,
    0.01,
    materials.darkMetal
  );
  frameGroup.add(chainUpper, chainLower);

  // Crankset & Rotating Pedals
  const crankGroup = new THREE.Group();
  crankGroup.position.copy(bbPos);
  bikeChasis.add(crankGroup);

  const crankLength = 0.24;
  const leftPedalPivot = new THREE.Group();
  const rightPedalPivot = new THREE.Group();
  const leftFootAnchor = new THREE.Object3D();
  const rightFootAnchor = new THREE.Object3D();

  for (const isLeft of [true, false]) {
    const side = isLeft ? 1 : -1;
    const phaseZ = isLeft ? 1 : -1;
    const armStart = new THREE.Vector3(side * 0.105, 0, 0);
    const armEnd = new THREE.Vector3(side * 0.125, 0, phaseZ * crankLength);
    crankGroup.add(createTubeSegment(armStart, armEnd, 0.022, 0.018, materials.chrome));

    const pedalPivot = isLeft ? leftPedalPivot : rightPedalPivot;
    pedalPivot.position.set(side * 0.195, 0, phaseZ * crankLength);
    crankGroup.add(pedalPivot);

    const spindle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8).rotateZ(Math.PI * 0.5),
      materials.chrome
    );
    spindle.position.x = -side * 0.035;
    pedalPivot.add(spindle);

    const pedalPlatform = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.032, 0.16),
      materials.darkMetal
    );
    pedalPlatform.castShadow = true;
    pedalPivot.add(pedalPlatform);

    const reflectorStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.02, 0.165),
      materials.amberGlow
    );
    pedalPivot.add(reflectorStrip);

    const anchor = isLeft ? leftFootAnchor : rightFootAnchor;
    anchor.position.set(0, 0.038, 0.02);
    pedalPivot.add(anchor);
  }

  // Seatpost & Sprung Leather Cruiser Saddle
  const saddlePos = new THREE.Vector3(0, 1.38, -0.46);
  frameGroup.add(createTubeSegment(seatClusterPos, saddlePos, 0.026, 0.024, materials.chrome));

  const saddleGroup = new THREE.Group();
  saddleGroup.position.copy(saddlePos);
  frameGroup.add(saddleGroup);

  const saddleMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12).scale(1.05, 0.36, 1.45),
    materials.leather
  );
  saddleMesh.castShadow = true;
  saddleGroup.add(saddleMesh);

  for (const side of [-1, 1]) {
    const spring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.09, 10),
      materials.brass
    );
    spring.position.set(side * 0.09, -0.06, -0.10);
    saddleGroup.add(spring);
  }

  // Rear Cargo Rack + Woven Wicker Fish Basket + Whip Flag
  const rackPos = new THREE.Vector3(0, 1.06, -0.82);
  for (const side of [-1, 1]) {
    frameGroup.add(
      createTubeSegment(
        rearAxlePos.clone().add(new THREE.Vector3(side * 0.08, 0.03, 0)),
        rackPos.clone().add(new THREE.Vector3(side * 0.11, 0, -0.16)),
        0.014,
        0.014,
        materials.chrome
      )
    );
    frameGroup.add(
      createTubeSegment(
        seatClusterPos.clone().add(new THREE.Vector3(side * 0.04, -0.08, 0)),
        rackPos.clone().add(new THREE.Vector3(side * 0.11, 0, 0.14)),
        0.014,
        0.014,
        materials.chrome
      )
    );
  }

  const basketGroup = new THREE.Group();
  basketGroup.position.set(0, 1.19, -0.86);
  frameGroup.add(basketGroup);

  const basketOuter = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.25, 0.36),
    materials.wicker
  );
  basketOuter.castShadow = true;
  basketOuter.receiveShadow = true;
  basketGroup.add(basketOuter);

  const basketRim = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.04, 0.39),
    materials.leather
  );
  basketRim.position.y = 0.12;
  basketGroup.add(basketRim);

  // Caught fish indicators tucked inside the rear wicker basket
  const basketFishNodes = [];
  for (let i = 0; i < 5; i++) {
    const f = createFishMesh(0.75);
    f.position.set((i - 2) * 0.065, 0.14, (i % 2 === 0 ? 1 : -1) * 0.04);
    f.rotation.x = -Math.PI * 0.42 + (i - 2) * 0.08;
    f.rotation.z = (i - 2) * 0.18;
    f.visible = i < 1; // start with 1 decorative fish
    basketGroup.add(f);
    basketFishNodes.push(f);
  }

  // Flexible Whip Flag on rear basket
  const flagPolePivot = new THREE.Group();
  flagPolePivot.position.set(-0.18, 0.12, -0.14);
  basketGroup.add(flagPolePivot);

  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.014, 0.95, 8),
    materials.chrome
  );
  flagPole.position.y = 0.475;
  flagPolePivot.add(flagPole);

  const pennantShape = new THREE.Shape();
  pennantShape.moveTo(0, 0);
  pennantShape.lineTo(0, 0.20);
  pennantShape.lineTo(-0.38, 0.10);
  pennantShape.closePath();
  const pennantGeom = new THREE.ShapeGeometry(pennantShape);
  pennantGeom.rotateY(Math.PI * 0.5);
  const pennantMesh = new THREE.Mesh(
    pennantGeom,
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.4,
      side: THREE.DoubleSide
    })
  );
  pennantMesh.position.set(0, 0.74, -0.01);
  flagPolePivot.add(pennantMesh);

  // Front Steering Assembly (Fork, Front Wheel, Swept Cruiser Handlebars, Brass Bell, Dynamo Lamp)
  const steeringPivot = new THREE.Group();
  steeringPivot.position.set(0, 0, 0.68);
  bikeChasis.add(steeringPivot);

  const frontWheel = buildWheel(wheelRadius, materials);
  frontWheel.position.set(0, wheelRadius, frontAxlePos.z - 0.68);
  steeringPivot.add(frontWheel);

  const frontFenderGeom = new THREE.TorusGeometry(wheelRadius + 0.035, 0.052, 10, 24, Math.PI * 0.85);
  frontFenderGeom.rotateY(Math.PI * 0.5);
  frontFenderGeom.rotateX(Math.PI * 0.18);
  const frontFender = new THREE.Mesh(frontFenderGeom, materials.frameTeal);
  frontFender.position.copy(frontWheel.position);
  frontFender.castShadow = true;
  steeringPivot.add(frontFender);

  // Fork crown & dual fork blades
  const forkCrownPos = new THREE.Vector3(0, 1.00, 0.60 - 0.68);
  const stemTopPos = new THREE.Vector3(0, 1.54, 0.46 - 0.68);
  steeringPivot.add(createTubeSegment(forkCrownPos, stemTopPos, 0.03, 0.026, materials.chrome));

  for (const side of [-1, 1]) {
    steeringPivot.add(
      createTubeSegment(
        forkCrownPos.clone().add(new THREE.Vector3(side * 0.055, 0, 0)),
        frontWheel.position.clone().add(new THREE.Vector3(side * 0.08, 0, 0)),
        0.024,
        0.016,
        materials.frameTeal
      )
    );
  }

  // Vintage Brass Headlamp on fork crown
  const lampGroup = new THREE.Group();
  lampGroup.position.set(0, 1.18, 0.68 - 0.68);
  steeringPivot.add(lampGroup);

  const lampBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.05, 0.12, 14).rotateX(Math.PI * 0.5),
    materials.brass
  );
  lampGroup.add(lampBody);

  const lampLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.064, 12, 10).scale(1, 1, 0.35),
    materials.lampGlass
  );
  lampLens.position.z = 0.06;
  lampGroup.add(lampLens);

  // Volumetric headlight cone (visible in dusk/night mode)
  const beamConeGeom = new THREE.ConeGeometry(1.15, 4.2, 20, 1, true);
  beamConeGeom.translate(0, -2.1, 0);
  beamConeGeom.rotateX(-Math.PI * 0.5);
  const beamConeMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const headlightCone = new THREE.Mesh(beamConeGeom, beamConeMat);
  headlightCone.position.set(0, 0, 0.08);
  lampGroup.add(headlightCone);

  // Swept-back Gullwing Cruiser Handlebars + Cork Grips + Brass Bell
  const leftGripAnchor = new THREE.Object3D();
  const rightGripAnchor = new THREE.Object3D();

  for (const side of [-1, 1]) {
    const barCurve = new THREE.CubicBezierCurve3(
      stemTopPos.clone(),
      new THREE.Vector3(side * 0.18, 1.62, 0.50 - 0.68),
      new THREE.Vector3(side * 0.38, 1.60, 0.36 - 0.68),
      new THREE.Vector3(side * 0.44, 1.54, 0.18 - 0.68)
    );
    const barTube = new THREE.Mesh(
      new THREE.TubeGeometry(barCurve, 16, 0.022, 10, false),
      materials.chrome
    );
    barTube.castShadow = true;
    steeringPivot.add(barTube);

    const gripPos = new THREE.Vector3(side * 0.44, 1.54, 0.16 - 0.68);
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.030, 0.16, 12).rotateX(Math.PI * 0.44),
      materials.leather
    );
    grip.position.copy(gripPos);
    grip.rotation.y = -side * 0.22;
    steeringPivot.add(grip);

    const anchor = side > 0 ? leftGripAnchor : rightGripAnchor;
    anchor.position.copy(gripPos);
    steeringPivot.add(anchor);
  }

  // Shiny Brass Bicycle Bell on left handlebar + Expanding Ring Wave
  const bellGroup = new THREE.Group();
  bellGroup.position.set(0.28, 1.63, 0.38 - 0.68);
  steeringPivot.add(bellGroup);

  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
    materials.brass
  );
  bellDome.castShadow = true;
  bellGroup.add(bellDome);

  const bellRingWave = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.09, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    })
  );
  bellRingWave.rotation.x = -Math.PI * 0.35;
  bellRingWave.position.y = 0.05;
  bellGroup.add(bellRingWave);

  // ============================================================================
  // CAPTAIN BARNABY THE PELICAN (Articulated Character with IK Limbs & Pouch)
  // ============================================================================
  const pelicanRoot = new THREE.Group();
  pelicanRoot.position.set(0, 1.46, -0.44); // Seated on cruiser saddle
  bikeChasis.add(pelicanRoot);

  // Pelvis / Torso container
  const torsoGroup = new THREE.Group();
  pelicanRoot.add(torsoGroup);

  // Plump sculpted pelican body
  const bodyGeom = new THREE.SphereGeometry(0.36, 20, 16);
  bodyGeom.scale(0.92, 1.16, 1.28);
  const bodyMesh = new THREE.Mesh(bodyGeom, materials.featherWhite);
  bodyMesh.position.set(0, 0.24, 0.08);
  bodyMesh.rotation.x = 0.28; // Slight forward cycling lean
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  torsoGroup.add(bodyMesh);

  // Soft warm breast patch
  const breastMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 16, 12).scale(0.84, 0.95, 0.9),
    materials.featherCream
  );
  breastMesh.position.set(0, 0.26, 0.24);
  torsoGroup.add(breastMesh);

  // Courier leather cross-body satchel strap + pouch on hip
  const strapMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.024, 8, 28),
    materials.leather
  );
  strapMesh.position.set(0, 0.26, 0.09);
  strapMesh.rotation.set(0.35, 0.48, 0.55);
  strapMesh.scale.set(0.95, 1.18, 1.08);
  torsoGroup.add(strapMesh);

  // Tail feathers that flutter in the slipstream
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.10, -0.34);
  torsoGroup.add(tailPivot);

  for (let i = -2; i <= 2; i++) {
    const feather = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.28, 8).scale(1.1, 1, 0.32),
      i % 2 === 0 ? materials.featherWhite : materials.featherSlate
    );
    feather.rotation.x = -Math.PI * 0.62;
    feather.rotation.z = i * 0.16;
    feather.position.set(i * 0.045, -0.02, -0.10);
    feather.castShadow = true;
    tailPivot.add(feather);
  }

  // Articulated 3-segment S-Curved Pelican Neck with seamless spherical joints
  const neckBase = new THREE.Group();
  neckBase.position.set(0, 0.50, 0.26);
  torsoGroup.add(neckBase);

  const neckBaseBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 14, 12),
    materials.featherWhite
  );
  neckBase.add(neckBaseBulb);

  const neckSeg1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.142, 0.28, 14),
    materials.featherWhite
  );
  neckSeg1.position.set(0, 0.12, -0.02);
  neckSeg1.rotation.x = -0.22; // Sweeps slightly back at base of S-curve
  neckSeg1.castShadow = true;
  neckBase.add(neckSeg1);

  const neckMid = new THREE.Group();
  neckMid.position.set(0, 0.24, -0.05);
  neckBase.add(neckMid);

  const neckMidBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.118, 14, 12),
    materials.featherWhite
  );
  neckMid.add(neckMidBulb);

  const neckSeg2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.118, 0.26, 14),
    materials.featherWhite
  );
  neckSeg2.position.set(0, 0.12, 0.03);
  neckSeg2.rotation.x = 0.28; // Curves gracefully forward at top of S-curve
  neckSeg2.castShadow = true;
  neckMid.add(neckSeg2);

  // Pelican Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.24, 0.07);
  neckMid.add(headGroup);

  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 16, 14).scale(0.92, 0.96, 1.15),
    materials.featherWhite
  );
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Crest feather tuft at back of crown
  for (let i = 0; i < 3; i++) {
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.14, 7),
      materials.featherCream
    );
    tuft.position.set(0, 0.11 - i * 0.025, -0.16 - i * 0.02);
    tuft.rotation.x = -1.1 - i * 0.15;
    headGroup.add(tuft);
  }

  // Expressive Eyes with Golden Orbital Rings & Blinking Eyelids
  const eyelids = [];
  const pupils = [];
  const eyeRingMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 });
  const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(side * 0.125, 0.045, 0.10);
    eyeSocket.rotation.y = side * 0.35;
    headGroup.add(eyeSocket);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.011, 8, 16), eyeRingMat);
    eyeSocket.add(ring);

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), scleraMat);
    eyeSocket.add(eyeball);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), pupilMat);
    pupil.position.set(side * 0.008, 0, 0.028);
    eyeSocket.add(pupil);
    pupils.push(pupil);

    const eyelid = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      materials.featherCream
    );
    eyelid.rotation.x = -Math.PI * 0.42; // Open by default
    eyeSocket.add(eyelid);
    eyelids.push(eyelid);
  }

  // Jaunty Coastal Courier Cap + Spinning Brass Anemometer Propeller
  const capGroup = new THREE.Group();
  capGroup.position.set(0, 0.145, 0.01);
  capGroup.rotation.x = -0.12;
  headGroup.add(capGroup);

  const capCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.115, 0.09, 16),
    materials.navyCap
  );
  capCrown.castShadow = true;
  capGroup.add(capCrown);

  const capBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.118, 0.026, 16),
    materials.brass
  );
  capBand.position.y = -0.025;
  capGroup.add(capBand);

  const capVisor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.018, 16, 1, false, -Math.PI * 0.4, Math.PI * 0.8),
    materials.darkMetal
  );
  capVisor.scale.set(0.95, 1, 1.35);
  capVisor.position.set(0, -0.035, 0.06);
  capGroup.add(capVisor);

  const capPropeller = new THREE.Group();
  capPropeller.position.set(0, 0.065, 0);
  capGroup.add(capPropeller);
  const propBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.01, 0.028),
    materials.brass
  );
  const propHub = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 8),
    materials.frameCoral
  );
  capPropeller.add(propBlade, propHub);

  // ============================================================================
  // GIANT PELICAN BEAK & ELASTIC GULAR POUCH (喉囊)
  // ============================================================================
  const beakRoot = new THREE.Group();
  beakRoot.position.set(0, -0.01, 0.14);
  headGroup.add(beakRoot);

  // Upper Mandible Pivot
  const upperBeakGroup = new THREE.Group();
  beakRoot.add(upperBeakGroup);

  const billLen = 0.88;
  const upperBillGeom = new THREE.ConeGeometry(0.11, billLen, 14);
  upperBillGeom.rotateX(Math.PI * 0.5);
  upperBillGeom.scale(0.88, 0.42, 1.0);
  upperBillGeom.translate(0, 0.02, billLen * 0.5);
  const upperBillMesh = new THREE.Mesh(upperBillGeom, materials.beakYellow);
  upperBillMesh.castShadow = true;
  upperBeakGroup.add(upperBillMesh);

  // Culmen ridge along top of upper bill
  const culmenMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.028, billLen * 0.88),
    materials.frameCoral
  );
  culmenMesh.position.set(0, 0.052, billLen * 0.45);
  upperBeakGroup.add(culmenMesh);

  // Iconic Coral Hooked Nail at tip of upper bill
  const hookNail = new THREE.Mesh(
    new THREE.ConeGeometry(0.032, 0.095, 10),
    materials.beakTipCoral
  );
  hookNail.position.set(0, -0.015, billLen - 0.02);
  hookNail.rotation.x = Math.PI * 0.88;
  upperBeakGroup.add(hookNail);

  // Lower Mandible + Elastic Deformable Gular Throat Pouch
  const lowerJawGroup = new THREE.Group();
  lowerJawGroup.position.set(0, -0.02, 0);
  beakRoot.add(lowerJawGroup);

  for (const side of [-1, 1]) {
    const rami = createTubeSegment(
      new THREE.Vector3(side * 0.085, 0, 0),
      new THREE.Vector3(0, 0.005, billLen * 0.94),
      0.016,
      0.010,
      materials.beakYellow
    );
    lowerJawGroup.add(rami);
  }

  // Sculpted Gular Pouch Mesh (inflates & jiggles dynamically with caught fish!)
  const pouchPivot = new THREE.Group();
  pouchPivot.position.set(0, 0, 0.36);
  lowerJawGroup.add(pouchPivot);

  const pouchGeom = new THREE.SphereGeometry(0.22, 20, 16, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68);
  pouchGeom.scale(0.56, 0.85, 1.95);
  const pouchMesh = new THREE.Mesh(pouchGeom, materials.pouchAmber);
  pouchMesh.position.set(0, -0.01, 0);
  pouchMesh.castShadow = true;
  pouchPivot.add(pouchMesh);

  // Wriggling fish tails peeking inside the pelican's throat pouch when carrying fish
  const pouchFishGroup = new THREE.Group();
  pouchFishGroup.position.set(0, -0.04, 0.06);
  pouchPivot.add(pouchFishGroup);

  const pouchFishMeshes = [];
  for (let i = 0; i < 5; i++) {
    const pf = createFishMesh(0.85);
    pf.position.set((i - 2) * 0.035, -0.02 - (i % 2) * 0.025, 0.05 + (i % 3) * 0.04);
    pf.rotation.y = Math.PI + (i - 2) * 0.25;
    pf.rotation.x = 0.35;
    pf.visible = false;
    pouchFishGroup.add(pf);
    pouchFishMeshes.push(pf);
  }

  // ============================================================================
  // TWO-BONE IK LEGS & WEBBED ORANGE FEET
  // ============================================================================
  const legL1 = 0.44;
  const legL2 = 0.46;

  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.165, -0.04, 0.02);
    pelicanRoot.add(hip);

    // Feathered upper thigh (Drumstick) along local -Y
    const thighDrum = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10).scale(0.85, 1.55, 0.95),
      materials.featherWhite
    );
    thighDrum.position.set(0, -legL1 * 0.38, 0);
    thighDrum.castShadow = true;
    hip.add(thighDrum);

    const thighShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.022, legL1, 10),
      materials.webbedFoot
    );
    thighShaft.position.set(0, -legL1 * 0.5, 0);
    thighShaft.castShadow = true;
    hip.add(thighShaft);

    const knee = new THREE.Group();
    knee.position.set(0, -legL1, 0);
    hip.add(knee);

    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 8),
      materials.webbedFoot
    );
    knee.add(kneeCap);

    const shinShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.018, legL2, 10),
      materials.webbedFoot
    );
    shinShaft.position.set(0, -legL2 * 0.5, 0);
    shinShaft.castShadow = true;
    knee.add(shinShaft);

    const ankle = new THREE.Group();
    ankle.position.set(0, -legL2, 0);
    knee.add(ankle);

    // Broad Webbed Pelican Foot
    const footShape = new THREE.Shape();
    footShape.moveTo(-0.028, -0.04);
    footShape.lineTo(0.028, -0.04);
    footShape.lineTo(0.095, 0.17);
    footShape.quadraticCurveTo(0.045, 0.14, 0, 0.19);
    footShape.quadraticCurveTo(-0.045, 0.14, -0.095, 0.17);
    footShape.closePath();

    const footExtrude = new THREE.ExtrudeGeometry(footShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008
    });
    footExtrude.rotateX(Math.PI * 0.5);
    const footMesh = new THREE.Mesh(footExtrude, materials.webbedFoot);
    footMesh.position.set(0, 0.01, -0.02);
    footMesh.castShadow = true;
    ankle.add(footMesh);

    return { hip, knee, ankle };
  }

  const leftLeg = buildLeg(1);
  const rightLeg = buildLeg(-1);

  // ============================================================================
  // TWO-BONE IK WING ARMS GRIPPING SWEPT-BACK HANDLEBARS
  // ============================================================================
  const wingL1 = 0.44;
  const wingL2 = 0.46;

  function buildWingArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 0.38, 0.16);
    torsoGroup.add(shoulder);

    const shoulderCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      materials.featherWhite
    );
    shoulder.add(shoulderCap);

    // Upper wing covert feathers along local -Y
    const upperWing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.055, wingL1, 12).scale(0.65, 1, 1.35),
      materials.featherWhite
    );
    upperWing.position.set(0, -wingL1 * 0.5, 0);
    upperWing.castShadow = true;
    shoulder.add(upperWing);

    const elbow = new THREE.Group();
    elbow.position.set(0, -wingL1, 0);
    shoulder.add(elbow);

    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 10, 8),
      materials.featherWhite
    );
    elbow.add(elbowCap);

    const foreWing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.038, wingL2, 12).scale(0.6, 1, 1.4),
      materials.featherWhite
    );
    foreWing.position.set(0, -wingL2 * 0.5, 0);
    foreWing.castShadow = true;
    elbow.add(foreWing);

    // Dark primary flight feather tips wrapping the handlebar grip
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -wingL2, 0);
    elbow.add(handGroup);

    for (let i = -1; i <= 1; i++) {
      const tipFeather = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 10, 8).scale(0.6, 1.4, 0.9),
        i === 0 ? materials.featherSlate : materials.featherWhite
      );
      tipFeather.position.set(side * 0.01, -0.02, i * 0.028);
      handGroup.add(tipFeather);
    }

    return { shoulder, elbow, handGroup };
  }

  const leftWing = buildWingArm(1);
  const rightWing = buildWingArm(-1);

  return {
    root,
    bikeChasis,
    materials,
    rearWheel,
    frontWheel,
    crankGroup,
    leftPedalPivot,
    rightPedalPivot,
    leftFootAnchor,
    rightFootAnchor,
    steeringPivot,
    leftGripAnchor,
    rightGripAnchor,
    bellGroup,
    bellRingWave,
    headlightCone,
    lampLens,
    flagPolePivot,
    pennantMesh,
    basketFishNodes,
    pelicanRoot,
    torsoGroup,
    tailPivot,
    neckBase,
    neckMid,
    headGroup,
    eyelids,
    pupils,
    capPropeller,
    upperBeakGroup,
    lowerJawGroup,
    pouchPivot,
    pouchMesh,
    pouchFishMeshes,
    leftLeg,
    rightLeg,
    leftWing,
    rightWing,
    legL1,
    legL2,
    wingL1,
    wingL2,
    wheelRadius
  };
}
