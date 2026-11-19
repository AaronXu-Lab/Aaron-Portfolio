import * as THREE from '../vendor/three.min.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const LEG_L1 = 0.45;
const LEG_L2 = 0.43;
const WING_L1 = 0.36;
const WING_L2 = 0.38;

/**
 * Exact 3D analytical 2-bone IK solver.
 * Places the mid joint (knee / elbow) in the plane defined by `poleDir`.
 */
function solveTwoBoneIK(rootPos, targetPos, l1, l2, poleDir, outMid) {
  const vx = targetPos.x - rootPos.x;
  const vy = targetPos.y - rootPos.y;
  const vz = targetPos.z - rootPos.z;
  let d = Math.hypot(vx, vy, vz);
  const maxD = l1 + l2 - 0.004;
  const minD = Math.abs(l1 - l2) + 0.04;
  d = Math.min(maxD, Math.max(minD, d));

  const invD = 1 / Math.max(1e-5, Math.hypot(vx, vy, vz));
  const dx = vx * invD;
  const dy = vy * invD;
  const dz = vz * invD;

  // Orthonormalize poleDir perpendicular to dir
  const dot = poleDir.x * dx + poleDir.y * dy + poleDir.z * dz;
  let bx = poleDir.x - dx * dot;
  let by = poleDir.y - dy * dot;
  let bz = poleDir.z - dz * dot;
  const bLen = Math.hypot(bx, by, bz);
  if (bLen > 1e-4) {
    bx /= bLen;
    by /= bLen;
    bz /= bLen;
  } else {
    bx = 0;
    by = 0;
    bz = -1;
  }

  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  outMid.set(
    rootPos.x + dx * (l1 * cosA) + bx * (l1 * sinA),
    rootPos.y + dy * (l1 * cosA) + by * (l1 * sinA),
    rootPos.z + dz * (l1 * cosA) + bz * (l1 * sinA)
  );
}

function orientSegment(obj, from, to, refAxis = DOWN) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  obj.position.copy(from);
  if (len > 1e-5) {
    dir.divideScalar(len);
    obj.quaternion.setFromUnitVectors(refAxis, dir);
  }
}

function createWebbedFoot(footMat, clawMat) {
  const foot = new THREE.Group();

  // Central tarsus ankle pad
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), footMat);
  pad.scale.set(1.0, 0.55, 1.3);
  pad.position.set(0, 0.012, 0.01);
  foot.add(pad);

  // Three forward toes + soft orange webbing fan
  const toeAngles = [-0.42, 0, 0.42];
  const toeLens = [0.095, 0.112, 0.095];
  toeAngles.forEach((ang, idx) => {
    const len = toeLens[idx];
    const toePivot = new THREE.Group();
    toePivot.rotation.y = ang;
    const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, len, 4, 8), footMat);
    toe.rotation.x = Math.PI / 2;
    toe.position.set(0, 0.012, -len * 0.52);
    toe.castShadow = true;
    toePivot.add(toe);

    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 6), clawMat);
    claw.rotation.x = -Math.PI * 0.42;
    claw.position.set(0, 0.008, -len - 0.008);
    toePivot.add(claw);
    foot.add(toePivot);
  });

  // Sculpted webbing membrane connecting the 3 toes
  const webShape = new THREE.Shape();
  webShape.moveTo(0, 0.02);
  webShape.lineTo(-0.048, -0.088);
  webShape.quadraticCurveTo(-0.022, -0.075, 0, -0.105);
  webShape.quadraticCurveTo(0.022, -0.075, 0.048, -0.088);
  webShape.closePath();

  const webGeo = new THREE.ExtrudeGeometry(webShape, { depth: 0.009, bevelEnabled: false });
  webGeo.rotateX(Math.PI / 2);
  const web = new THREE.Mesh(webGeo, footMat);
  web.position.set(0, 0.014, 0);
  web.castShadow = true;
  foot.add(web);

  return foot;
}

export class PelicanRider {
  constructor(textures) {
    this.root = new THREE.Group();
    this.clickableMeshes = [];

    const mats = {
      plumage: new THREE.MeshStandardMaterial({
        map: textures.feather,
        color: '#fffbf4',
        roughness: 0.62,
        metalness: 0.02,
      }),
      chestWarm: new THREE.MeshStandardMaterial({
        color: '#fce6c8',
        roughness: 0.66,
        metalness: 0.02,
      }),
      wingTip: new THREE.MeshStandardMaterial({
        color: '#2d3540',
        roughness: 0.58,
        metalness: 0.06,
      }),
      beakUpper: new THREE.MeshStandardMaterial({
        color: '#f2b163',
        roughness: 0.34,
        metalness: 0.08,
      }),
      beakHook: new THREE.MeshStandardMaterial({
        color: '#de6f42',
        roughness: 0.30,
        metalness: 0.08,
      }),
      pouch: new THREE.MeshStandardMaterial({
        color: '#f7a531',
        roughness: 0.44,
        metalness: 0.04,
      }),
      foot: new THREE.MeshStandardMaterial({
        color: '#ee8833',
        roughness: 0.46,
        metalness: 0.04,
      }),
      claw: new THREE.MeshStandardMaterial({
        color: '#5a4435',
        roughness: 0.4,
      }),
      eyeRing: new THREE.MeshStandardMaterial({
        color: '#f7c873',
        roughness: 0.35,
      }),
      eyeIris: new THREE.MeshStandardMaterial({
        color: '#1b2738',
        roughness: 0.12,
        metalness: 0.2,
      }),
      eyeWhite: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 0.35,
        roughness: 0.1,
      }),
      scarf: new THREE.MeshStandardMaterial({
        map: textures.scarf,
        roughness: 0.78,
        side: THREE.DoubleSide,
      }),
      capBlue: new THREE.MeshStandardMaterial({
        color: '#22599c',
        roughness: 0.72,
      }),
      capCream: new THREE.MeshStandardMaterial({
        color: '#fff4e0',
        roughness: 0.72,
      }),
    };
    this.mats = mats;

    // ─── Pelvis / Torso Pivot (sits right atop bicycle saddle) ───
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.set(0, 1.03, 0.30);
    this.root.add(this.torsoPivot);

    // Sculpted plump pear-shaped pelican body via LatheGeometry
    const bodyProfile = [
      new THREE.Vector2(0.001, -0.14),
      new THREE.Vector2(0.11, -0.12),
      new THREE.Vector2(0.195, -0.04),
      new THREE.Vector2(0.225, 0.09),
      new THREE.Vector2(0.205, 0.25),
      new THREE.Vector2(0.155, 0.39),
      new THREE.Vector2(0.092, 0.49),
      new THREE.Vector2(0.001, 0.52),
    ];
    const bodyGeo = new THREE.LatheGeometry(bodyProfile, 22);
    bodyGeo.scale(0.92, 1.0, 1.18);
    const bodyMesh = new THREE.Mesh(bodyGeo, mats.plumage);
    bodyMesh.rotation.x = -0.34; // Natural cheerful forward riding posture
    bodyMesh.position.set(0, 0.04, 0.02);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.torsoPivot.add(bodyMesh);
    this.clickableMeshes.push(bodyMesh);

    // Warm golden-peach breast cushion
    const breast = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 12), mats.chestWarm);
    breast.scale.set(0.88, 1.12, 0.72);
    breast.position.set(0, 0.23, -0.16);
    breast.castShadow = true;
    this.torsoPivot.add(breast);

    // Sculpted fanned tail feathers (5 blades)
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(0, 0.05, 0.23);
    this.torsoPivot.add(this.tailGroup);
    for (let i = -2; i <= 2; i++) {
      const feather = new THREE.Mesh(
        new THREE.ConeGeometry(0.042, 0.24, 6),
        Math.abs(i) === 2 ? mats.wingTip : mats.plumage
      );
      feather.scale.set(0.85, 1, 0.28);
      feather.rotation.x = Math.PI * 0.62;
      feather.rotation.z = i * 0.22;
      feather.position.set(i * 0.036, 0.02 - Math.abs(i) * 0.008, 0.11);
      feather.castShadow = true;
      this.tailGroup.add(feather);
    }

    // ─── Sailor Scarf Collar + Two Dynamic Fluttering Tails ───
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.034, 10, 22), mats.scarf);
    collar.rotation.x = Math.PI / 2 - 0.28;
    collar.position.set(0, 0.44, -0.11);
    collar.castShadow = true;
    this.torsoPivot.add(collar);

    this.scarfTails = [];
    [-0.045, 0.045].forEach((sx, idx) => {
      const chain = [];
      let parent = this.torsoPivot;
      for (let seg = 0; seg < 4; seg++) {
        const pivot = new THREE.Group();
        if (seg === 0) {
          pivot.position.set(sx, 0.43, -0.01);
        } else {
          pivot.position.set(0, 0, 0.13);
        }
        const width = 0.072 - seg * 0.006;
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(width, 0.020, 0.14), mats.scarf);
        ribbon.position.z = 0.068;
        ribbon.castShadow = true;
        pivot.add(ribbon);
        parent.add(pivot);
        chain.push(pivot);
        parent = pivot;
      }
      this.scarfTails.push({ chain, phase: idx * 1.4 });
    });

    // ─── Articulated S-Curved Neck & Expressive Head ───
    this.neckBase = new THREE.Group();
    this.neckBase.position.set(0, 0.44, -0.12);
    this.torsoPivot.add(this.neckBase);

    const neckLower = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.095, 0.24, 14), mats.plumage);
    neckLower.position.set(0, 0.11, 0.02);
    neckLower.rotation.x = 0.18;
    neckLower.castShadow = true;
    this.neckBase.add(neckLower);

    this.neckMid = new THREE.Group();
    this.neckMid.position.set(0, 0.21, 0.04);
    this.neckBase.add(this.neckMid);

    const neckJoint = new THREE.Mesh(new THREE.SphereGeometry(0.069, 12, 10), mats.plumage);
    this.neckMid.add(neckJoint);

    const neckUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.068, 0.22, 14), mats.plumage);
    neckUpper.position.set(0, 0.105, -0.025);
    neckUpper.rotation.x = -0.22;
    neckUpper.castShadow = true;
    this.neckMid.add(neckUpper);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.20, -0.05);
    this.neckMid.add(this.headPivot);

    // Rounded pelican cranium + cheeky nape crest feathers
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), mats.plumage);
    headMesh.scale.set(0.92, 0.96, 1.15);
    headMesh.castShadow = true;
    this.headPivot.add(headMesh);
    this.clickableMeshes.push(headMesh);

    for (let i = 0; i < 3; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.11, 6), mats.plumage);
      tuft.position.set(0, 0.04 - i * 0.028, 0.105 + i * 0.01);
      tuft.rotation.x = 1.15 + i * 0.2;
      this.headPivot.add(tuft);
    }

    // Jaunty French Vintage Cycling Cap (Casquette)
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.068, -0.008);
    capGroup.rotation.set(-0.18, 0, -0.09);
    const capCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.094, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      mats.capBlue
    );
    capCrown.scale.set(0.96, 0.84, 1.14);
    capCrown.castShadow = true;
    capGroup.add(capCrown);

    // Classic cream racing stripe down the center of the cap
    const capStripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.088, 0.011, 6, 16, Math.PI),
      mats.capCream
    );
    capStripe.rotation.y = Math.PI / 2;
    capStripe.scale.set(1.08, 0.86, 1);
    capGroup.add(capStripe);

    // Little upturned visor brim
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.088, 0.012, 16, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      mats.capCream
    );
    brim.rotation.x = -0.35;
    brim.position.set(0, 0.008, -0.072);
    capGroup.add(brim);

    const capButton = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), mats.capCream);
    capButton.position.set(0, 0.08, 0);
    capGroup.add(capButton);
    this.headPivot.add(capGroup);

    // Expressive eyes with warm gold eye-ring, glossy dark iris, twin catchlights & blinking eyelids
    this.eyelids = [];
    [-1, 1].forEach((side) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.082, 0.022, -0.056);
      eyeGroup.rotation.y = side * 0.38;

      const ring = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), mats.eyeRing);
      ring.scale.set(0.65, 1.0, 1.0);
      eyeGroup.add(ring);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), mats.eyeIris);
      iris.position.set(side * 0.011, 0, -0.005);
      eyeGroup.add(iris);

      const catchBig = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 8), mats.eyeWhite);
      catchBig.position.set(side * 0.028, 0.009, -0.016);
      eyeGroup.add(catchBig);

      const catchSmall = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), mats.eyeWhite);
      catchSmall.position.set(side * 0.029, -0.006, -0.006);
      eyeGroup.add(catchSmall);

      // Eyelid hemisphere that closes downward when blinking
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.0345, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mats.plumage
      );
      lid.scale.set(0.74, 1.04, 1.04);
      lid.rotation.x = -Math.PI * 0.52; // open
      eyeGroup.add(lid);
      this.eyelids.push(lid);

      this.headPivot.add(eyeGroup);
    });

    // ─── Iconic Long Pelican Beak & Elastic Golden-Orange Gular Pouch ───
    const upperBeakGroup = new THREE.Group();
    upperBeakGroup.position.set(0, -0.004, -0.085);
    this.headPivot.add(upperBeakGroup);

    // Tapered sculpted upper mandible
    const upperBeakGeo = new THREE.CylinderGeometry(0.022, 0.052, 0.36, 12);
    upperBeakGeo.rotateX(Math.PI / 2);
    upperBeakGeo.scale(1.12, 0.44, 1.0);
    const upperBeak = new THREE.Mesh(upperBeakGeo, mats.beakUpper);
    upperBeak.position.set(0, 0.012, -0.175);
    upperBeak.castShadow = true;
    upperBeakGroup.add(upperBeak);
    this.clickableMeshes.push(upperBeak);

    // Ridge stripe along top of beak
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.33), mats.beakHook);
    ridge.position.set(0, 0.028, -0.17);
    upperBeakGroup.add(ridge);

    // Iconic downward-curved pelican beak hook (nail)
    const hook = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.056, 8), mats.beakHook);
    hook.rotation.x = Math.PI * 0.85;
    hook.position.set(0, -0.008, -0.362);
    upperBeakGroup.add(hook);

    // Hinged lower jaw + elastic gular pouch!
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, -0.018, -0.08);
    this.headPivot.add(this.jawPivot);

    // Lower jaw U-frame rim
    const jawRimCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.052, 0.005, 0.0),
      new THREE.Vector3(-0.044, -0.004, -0.17),
      new THREE.Vector3(0, -0.012, -0.345),
      new THREE.Vector3(0.044, -0.004, -0.17),
      new THREE.Vector3(0.052, 0.005, 0.0),
    ]);
    const jawRim = new THREE.Mesh(
      new THREE.TubeGeometry(jawRimCurve, 22, 0.012, 8, false),
      mats.beakUpper
    );
    jawRim.castShadow = true;
    this.jawPivot.add(jawRim);

    // Soft elastic golden-orange gular pouch slung beneath lower mandible
    this.pouchMesh = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 12), mats.pouch);
    this.pouchMesh.scale.set(0.68, 0.92, 1.98);
    this.pouchMesh.position.set(0, -0.068, -0.155);
    this.pouchMesh.castShadow = true;
    this.jawPivot.add(this.pouchMesh);
    this.clickableMeshes.push(this.pouchMesh);

    // ─── Articulated 2-Segment Wings (Lush Avian Coverts + Handlebar Grip + Wide Glide!) ───
    const makeWing = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.175, 0.31, -0.02);
      // Soft feathered shoulder covert bridging cleanly into the plump torso
      const covert = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), mats.plumage);
      covert.scale.set(0.75, 1.05, 1.38);
      covert.position.set(side * 0.01, -0.02, 0.02);
      covert.castShadow = true;
      shoulder.add(covert);
      this.torsoPivot.add(shoulder);

      const upperGroup = new THREE.Group();
      const upperBlade = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, WING_L1 - 0.08, 8, 12), mats.plumage);
      upperBlade.scale.set(0.84, 1.0, 1.48);
      upperBlade.position.set(0, -WING_L1 * 0.5, 0.015);
      upperBlade.castShadow = true;
      upperGroup.add(upperBlade);

      const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.066, 10, 10), mats.plumage);
      elbowCap.scale.set(0.85, 0.92, 1.32);
      elbowCap.position.set(0, -WING_L1, 0.015);
      upperGroup.add(elbowCap);
      this.root.add(upperGroup);

      const foreGroup = new THREE.Group();
      const foreBlade = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, WING_L2 - 0.07, 8, 12), mats.plumage);
      foreBlade.scale.set(0.76, 1.0, 1.36);
      foreBlade.position.set(0, -WING_L2 * 0.48, 0.01);
      foreBlade.castShadow = true;
      foreGroup.add(foreBlade);

      // Fanned layered primary feathers (cream coverts + dark slate flight tips!)
      const fanGroup = new THREE.Group();
      fanGroup.position.set(0, -WING_L2 * 0.62, 0.03);
      for (let f = 0; f < 5; f++) {
        const isTip = f >= 2;
        const len = 0.16 + f * 0.028;
        const feather = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.022, len, 4, 8),
          isTip ? mats.wingTip : mats.plumage
        );
        feather.scale.set(0.42, 1.0, 1.12);
        feather.position.set(0, -len * 0.25, 0.055 + f * 0.018);
        feather.rotation.x = 0.35 + f * 0.12;
        feather.castShadow = true;
        fanGroup.add(feather);
      }
      foreGroup.add(fanGroup);
      this.root.add(foreGroup);

      return { side, shoulder, upperGroup, foreGroup, fanGroup };
    };

    this.leftWing = makeWing(-1);
    this.rightWing = makeWing(1);

    // ─── Analytical 2-Bone IK Legs & Webbed Feet ───
    const makeLeg = (side) => {
      const hipAnchor = new THREE.Object3D();
      hipAnchor.position.set(side * 0.135, -0.04, -0.04);
      this.torsoPivot.add(hipAnchor);

      const thighGroup = new THREE.Group();
      // Fluffy feathered upper thigh
      const thighFluff = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, LEG_L1 * 0.52, 6, 10), mats.plumage);
      thighFluff.position.set(0, -LEG_L1 * 0.32, 0);
      thighFluff.castShadow = true;
      thighGroup.add(thighFluff);

      const thighStem = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.020, LEG_L1 * 0.56, 10), mats.foot);
      thighStem.position.set(0, -LEG_L1 * 0.72, 0);
      thighStem.castShadow = true;
      thighGroup.add(thighStem);

      const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), mats.foot);
      kneeBall.position.set(0, -LEG_L1, 0);
      thighGroup.add(kneeBall);
      this.root.add(thighGroup);

      const shinGroup = new THREE.Group();
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, LEG_L2, 10), mats.foot);
      shin.position.set(0, -LEG_L2 * 0.5, 0);
      shin.castShadow = true;
      shinGroup.add(shin);
      this.root.add(shinGroup);

      const foot = createWebbedFoot(mats.foot, mats.claw);
      this.root.add(foot);

      return { side, hipAnchor, thighGroup, shinGroup, foot };
    };

    this.leftLeg = makeLeg(-1);
    this.rightLeg = makeLeg(1);

    // Dynamic expressive animation state
    this.honkTimer = 0;
    this.gulpTimer = 0;
    this.flapTimer = 0;
    this.blinkTimer = 2.4;
    this.blinkProgress = 0;
    this.pouchJiggle = 0;
    this.pouchVel = 0;
    this.glideBlend = 0;

    // Scratch vectors
    this._hipPos = new THREE.Vector3();
    this._kneePos = new THREE.Vector3();
    this._shoulderPos = new THREE.Vector3();
    this._elbowPos = new THREE.Vector3();
    this._wingTarget = new THREE.Vector3();
    this._legPole = new THREE.Vector3(0, 0, -1);
    this._wingPole = new THREE.Vector3();
  }

  triggerHonk() {
    this.honkTimer = 0.42;
    this.pouchVel += 4.2;
  }

  triggerGulp() {
    this.gulpTimer = 0.55;
    this.pouchVel += 6.2;
    this.flapTimer = 0.35;
  }

  triggerPoke() {
    this.honkTimer = 0.38;
    this.flapTimer = 0.55;
    this.pouchVel += 5.0;
  }

  update(dt, elapsed, state, leftPedal, rightPedal, leftGrip, rightGrip) {
    const {
      crankAngle,
      speed,
      steerAngle,
      isSprinting,
      isAirborne,
      isGliding,
      isCoasting,
    } = state;

    // ─── 1. Torso Biomechanics: Pelvis Rocking, Sprint Tuck & Hop Lift ───
    const pedalPhase = Math.sin(crankAngle);
    const pedalBounce = Math.abs(Math.sin(crankAngle));
    const cadenceAmp = isCoasting ? 0.15 : 1.0;

    const targetRoll = -pedalPhase * 0.065 * cadenceAmp - steerAngle * 0.18;
    const targetPitch = isSprinting ? -0.20 : isGliding ? -0.12 : -0.04;
    const targetY = 1.03 + pedalBounce * 0.022 * cadenceAmp + (isAirborne ? 0.03 : 0);

    this.torsoPivot.rotation.z += (targetRoll - this.torsoPivot.rotation.z) * Math.min(1, dt * 12);
    this.torsoPivot.rotation.x += (targetPitch - this.torsoPivot.rotation.x) * Math.min(1, dt * 9);
    this.torsoPivot.position.y += (targetY - this.torsoPivot.position.y) * Math.min(1, dt * 14);

    // Tail feather happy wag & wind flutter
    this.tailGroup.rotation.x = Math.sin(elapsed * (6 + speed * 0.5)) * 0.06 - (isAirborne ? 0.18 : 0);
    this.tailGroup.rotation.y = Math.sin(crankAngle) * 0.11 * cadenceAmp;

    // ─── 2. Articulated S-Neck & Head Looking Into Turns ───
    const honkLift = this.honkTimer > 0 ? Math.sin((this.honkTimer / 0.42) * Math.PI) : 0;
    const gulpLift = this.gulpTimer > 0 ? Math.sin((this.gulpTimer / 0.55) * Math.PI) : 0;

    this.neckBase.rotation.x =
      (isSprinting ? -0.22 : -0.04) +
      Math.cos(crankAngle * 2) * 0.035 * cadenceAmp +
      honkLift * 0.18 +
      gulpLift * 0.24;
    this.neckMid.rotation.x = (isSprinting ? 0.18 : 0.05) + honkLift * 0.16;

    const targetHeadYaw = -steerAngle * 0.72 + Math.sin(elapsed * 1.1) * 0.05;
    this.headPivot.rotation.y += (targetHeadYaw - this.headPivot.rotation.y) * Math.min(1, dt * 9);
    this.headPivot.rotation.x =
      (isSprinting ? 0.09 : 0.0) - honkLift * 0.22 - gulpLift * 0.28 + Math.sin(crankAngle * 2) * 0.025;
    this.headPivot.rotation.z = -steerAngle * 0.25;

    // ─── 3. Jaw & Elastic Gular Pouch Spring Physics ───
    if (this.honkTimer > 0) this.honkTimer = Math.max(0, this.honkTimer - dt);
    if (this.gulpTimer > 0) this.gulpTimer = Math.max(0, this.gulpTimer - dt);
    if (this.flapTimer > 0) this.flapTimer = Math.max(0, this.flapTimer - dt);

    const jawOpen = Math.max(honkLift * 0.48, gulpLift * 0.55);
    this.jawPivot.rotation.x = jawOpen;

    // Elastic pouch spring wobble driven by cadence, honks, and gulps
    const pouchTarget = (gulpLift * 0.55) + (honkLift * 0.28) + Math.sin(crankAngle * 2) * 0.04;
    const pAcc = -65 * (this.pouchJiggle - pouchTarget) - 7.5 * this.pouchVel;
    this.pouchVel += pAcc * dt;
    this.pouchJiggle += this.pouchVel * dt;

    const pInflate = 1 + Math.max(-0.18, this.pouchJiggle * 0.65);
    this.pouchMesh.scale.set(
      0.68 * (1 + this.pouchJiggle * 0.38),
      0.92 * pInflate,
      1.98 * (1 - this.pouchJiggle * 0.08)
    );
    this.pouchMesh.position.y = -0.068 - Math.max(0, this.pouchJiggle * 0.045);

    // ─── 4. Expressive Eye Blinking ───
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkProgress = 1.0;
      this.blinkTimer = 2.4 + Math.random() * 2.8;
    }
    if (this.blinkProgress > 0) {
      this.blinkProgress = Math.max(0, this.blinkProgress - dt * 6.5);
    }
    const blinkAmt = Math.sin(this.blinkProgress * Math.PI);
    const happySquint = Math.max(blinkAmt, gulpLift * 0.55);
    const lidRot = -Math.PI * 0.52 + happySquint * (Math.PI * 0.52);
    this.eyelids.forEach((lid) => {
      lid.rotation.x = lidRot;
    });

    // ─── 5. Fluttering Striped Sailor Scarf ───
    const windSpeed = 4.5 + speed * 1.15;
    this.scarfTails.forEach(({ chain, phase }) => {
      chain.forEach((pivot, idx) => {
        const wave = Math.sin(elapsed * windSpeed - idx * 1.05 + phase);
        const pitch = idx === 0
          ? -0.22 + Math.min(0.42, speed * 0.025) + wave * 0.14
          : wave * (0.22 + idx * 0.05);
        const yaw = Math.cos(elapsed * windSpeed * 0.72 - idx * 0.9 + phase) * 0.16 - steerAngle * 0.25;
        pivot.rotation.x = pitch;
        pivot.rotation.y = yaw;
      });
    });

    // Update torso world/local matrices before solving IK in pelican-root space
    this.root.updateMatrixWorld(true);

    // ─── 6. Exact 2-Bone IK Legs Locked to Pedals ───
    const updateLeg = (leg, pedalPos, phaseOffset) => {
      leg.hipAnchor.getWorldPosition(this._hipPos);
      this.root.worldToLocal(this._hipPos);

      solveTwoBoneIK(this._hipPos, pedalPos, LEG_L1, LEG_L2, this._legPole, this._kneePos);

      orientSegment(leg.thighGroup, this._hipPos, this._kneePos, DOWN);
      orientSegment(leg.shinGroup, this._kneePos, pedalPos, DOWN);

      leg.foot.position.copy(pedalPos);
      // Natural cyclist ankling pitch across the 360-degree stroke
      leg.foot.rotation.x = -0.06 + Math.sin(crankAngle + phaseOffset) * 0.24 * cadenceAmp;
      leg.foot.rotation.y = leg.side * 0.05;
    };

    updateLeg(this.rightLeg, rightPedal, 0);
    updateLeg(this.leftLeg, leftPedal, Math.PI);

    // ─── 7. Articulated Wings: Handlebar Grip <-> Majestic Coastal Glide Spread ───
    const wantGlide = isGliding || isAirborne || this.flapTimer > 0 ? 1 : 0;
    this.glideBlend += (wantGlide - this.glideBlend) * Math.min(1, dt * 8.5);

    const updateWing = (wing, gripPos) => {
      wing.shoulder.getWorldPosition(this._shoulderPos);
      this.root.worldToLocal(this._shoulderPos);

      // Compute soaring outstretched wingtip target
      const flapSpeed = this.flapTimer > 0 ? 17 : isGliding ? 5.5 : 11;
      const flapAmp = this.flapTimer > 0 ? 0.34 : isGliding ? 0.14 : 0.24;
      const flapY = Math.sin(elapsed * flapSpeed) * flapAmp;
      const soarTarget = new THREE.Vector3(
        wing.side * 0.86,
        this._shoulderPos.y + 0.12 + flapY,
        this._shoulderPos.z + 0.14
      );

      this._wingTarget.copy(gripPos).lerp(soarTarget, this.glideBlend);

      // Tucked avian elbow pole when gripping bars, lifted & wide when gliding
      this._wingPole.set(
        wing.side * (0.44 - this.glideBlend * 0.14),
        -0.62 + this.glideBlend * 0.92,
        0.46
      );

      solveTwoBoneIK(this._shoulderPos, this._wingTarget, WING_L1, WING_L2, this._wingPole, this._elbowPos);

      orientSegment(wing.upperGroup, this._shoulderPos, this._elbowPos, DOWN);
      orientSegment(wing.foreGroup, this._elbowPos, this._wingTarget, DOWN);

      // Fan the primary feathers wider when gliding!
      const fanScale = 1.0 + this.glideBlend * 0.62;
      wing.fanGroup.scale.set(1, fanScale, 1 + this.glideBlend * 0.35);
    };

    updateWing(this.leftWing, leftGrip);
    updateWing(this.rightWing, rightGrip);
  }
}
