import * as THREE from '../vendor/three.min.js';

export const WHEEL_RADIUS = 0.43;
export const CRANK_RADIUS = 0.175;
export const BB_POS = new THREE.Vector3(0, 0.36, 0.10);
export const REAR_AXLE = new THREE.Vector3(0, WHEEL_RADIUS, 0.66);
export const FRONT_AXLE = new THREE.Vector3(0, WHEEL_RADIUS, -0.66);
export const SADDLE_TOP = new THREE.Vector3(0, 0.96, 0.34);

function makeTubeBetween(a, b, r, mat, radialSegments = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r, r, len, radialSegments);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCurvedTube(points, r, mat, tubularSegments = 20, radialSegments = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, r, radialSegments, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWheel(mats) {
  const wheel = new THREE.Group();

  // Cream-walled vintage tire + charcoal outer tread
  const wallGeo = new THREE.TorusGeometry(WHEEL_RADIUS - 0.036, 0.036, 14, 36);
  wallGeo.rotateY(Math.PI / 2);
  const wall = new THREE.Mesh(wallGeo, mats.tireWall);
  wall.castShadow = true;
  wheel.add(wall);

  const treadGeo = new THREE.TorusGeometry(WHEEL_RADIUS - 0.022, 0.024, 12, 36);
  treadGeo.rotateY(Math.PI / 2);
  const tread = new THREE.Mesh(treadGeo, mats.tireTread);
  tread.castShadow = true;
  wheel.add(tread);

  // Polished aluminum inner rim
  const rimGeo = new THREE.TorusGeometry(WHEEL_RADIUS - 0.068, 0.015, 10, 36);
  rimGeo.rotateY(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, mats.chrome);
  wheel.add(rim);

  // Flanged hub
  const hubGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.11, 14);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, mats.chrome);
  wheel.add(hub);

  const flangeGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.012, 14);
  flangeGeo.rotateZ(Math.PI / 2);
  const flL = new THREE.Mesh(flangeGeo, mats.chrome);
  flL.position.x = -0.036;
  const flR = flL.clone();
  flR.position.x = 0.036;
  wheel.add(flL, flR);

  // 16 fine stainless spokes (8 per side, slightly dished)
  const spokeLen = WHEEL_RADIUS - 0.072;
  const spokeGeo = new THREE.CylinderGeometry(0.0032, 0.0032, spokeLen, 5);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const side = i % 2 === 0 ? 1 : -1;
    const spoke = new THREE.Mesh(spokeGeo, mats.spoke);
    const dy = Math.cos(angle) * (spokeLen * 0.5);
    const dz = Math.sin(angle) * (spokeLen * 0.5);
    spoke.position.set(side * 0.018, dy, dz);
    spoke.rotation.x = angle;
    spoke.rotation.z = side * 0.06;
    wheel.add(spoke);
  }

  // Brass valve stem detail
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6), mats.brass);
  valve.position.set(0, -(WHEEL_RADIUS - 0.10), 0);
  wheel.add(valve);

  return wheel;
}

function createFender(radius, arcLen, startAngle, mat, chromeMat) {
  const g = new THREE.Group();
  const geo = new THREE.TorusGeometry(radius, 0.032, 10, 28, arcLen);
  geo.rotateY(Math.PI / 2);
  // Flatten radial profile slightly so it looks like a sleek curved fender
  geo.scale(1.25, 1, 1);
  const fender = new THREE.Mesh(geo, mat);
  fender.rotation.x = startAngle;
  fender.castShadow = true;
  g.add(fender);

  // Twin chrome fender stays to axle
  const stayAngles = [startAngle + 0.15, startAngle + arcLen * 0.52];
  stayAngles.forEach((a) => {
    const end = new THREE.Vector3(0, Math.sin(a) * radius, Math.cos(a) * radius);
    [-0.055, 0.055].forEach((sx) => {
      const aPos = new THREE.Vector3(sx, 0, 0);
      const bPos = new THREE.Vector3(sx * 0.72, end.y, end.z);
      g.add(makeTubeBetween(aPos, bPos, 0.0045, chromeMat, 6));
    });
  });

  return g;
}

function createFishProp(silverMat, goldMat, isGold = false) {
  const fish = new THREE.Group();
  const mat = isGold ? goldMat : silverMat;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat);
  body.scale.set(0.55, 0.85, 2.2);
  fish.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.07, 4), mat);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 0.11;
  tail.scale.set(0.4, 1, 1);
  fish.add(tail);
  return fish;
}

export class CruiserBike {
  constructor(textures) {
    this.root = new THREE.Group();

    // Shared materials (warm vintage turquoise, cream, brass, saddle leather, chrome)
    const mats = {
      frame: new THREE.MeshStandardMaterial({
        color: '#258f94',
        roughness: 0.26,
        metalness: 0.32,
      }),
      frameAccent: new THREE.MeshStandardMaterial({
        color: '#f7efe0',
        roughness: 0.34,
        metalness: 0.12,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: '#dfa848',
        roughness: 0.24,
        metalness: 0.85,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: '#eef2f5',
        roughness: 0.16,
        metalness: 0.92,
      }),
      spoke: new THREE.MeshStandardMaterial({
        color: '#d9e0e6',
        roughness: 0.22,
        metalness: 0.88,
      }),
      leather: new THREE.MeshStandardMaterial({
        color: '#8c4e2a',
        roughness: 0.62,
        metalness: 0.05,
      }),
      tireWall: new THREE.MeshStandardMaterial({
        color: '#efe3ca',
        roughness: 0.78,
        metalness: 0.02,
      }),
      tireTread: new THREE.MeshStandardMaterial({
        color: '#2d3138',
        roughness: 0.88,
        metalness: 0.04,
      }),
      wicker: new THREE.MeshStandardMaterial({
        map: textures.wicker,
        roughness: 0.86,
        metalness: 0.02,
      }),
      towel: new THREE.MeshStandardMaterial({
        map: textures.towel,
        roughness: 0.88,
        metalness: 0.02,
      }),
      lampBulb: new THREE.MeshStandardMaterial({
        color: '#fff4cf',
        emissive: '#ffbf5e',
        emissiveIntensity: 0.2,
        roughness: 0.2,
      }),
      fishSilver: new THREE.MeshStandardMaterial({
        color: '#95b9cc',
        roughness: 0.24,
        metalness: 0.72,
      }),
      lemon: new THREE.MeshStandardMaterial({
        color: '#f5cb36',
        roughness: 0.42,
        metalness: 0.04,
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: '#343b42',
        roughness: 0.48,
        metalness: 0.68,
      }),
    };
    this.mats = mats;

    const htTop = new THREE.Vector3(0, 0.98, -0.36);
    const htBot = new THREE.Vector3(0, 0.74, -0.44);
    const stTop = new THREE.Vector3(0, 0.86, 0.30);

    // ─── Main Frame ───
    const frameGroup = new THREE.Group();
    this.root.add(frameGroup);

    // Seat tube & head tube
    frameGroup.add(makeTubeBetween(BB_POS, stTop, 0.021, mats.frame));
    frameGroup.add(makeTubeBetween(htBot, htTop, 0.024, mats.frame));

    // Brass lugs at frame joints
    [htTop, htBot, stTop, BB_POS].forEach((p) => {
      const lug = new THREE.Mesh(new THREE.SphereGeometry(0.029, 10, 8), mats.brass);
      lug.position.copy(p);
      frameGroup.add(lug);
    });

    // Bottom bracket shell
    const bbShell = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.12, 14), mats.frame);
    bbShell.rotation.z = Math.PI / 2;
    bbShell.position.copy(BB_POS);
    frameGroup.add(bbShell);

    // Graceful double step-through cruiser tubes (top curve + lower downtube)
    frameGroup.add(
      makeCurvedTube(
        [
          new THREE.Vector3(0, 0.94, -0.37),
          new THREE.Vector3(0, 0.84, -0.14),
          new THREE.Vector3(0, 0.75, 0.14),
          new THREE.Vector3(0, 0.79, 0.27),
        ],
        0.017,
        mats.frame
      )
    );
    frameGroup.add(
      makeCurvedTube(
        [
          new THREE.Vector3(0, 0.76, -0.43),
          new THREE.Vector3(0, 0.56, -0.22),
          new THREE.Vector3(0, 0.42, -0.02),
          BB_POS.clone(),
        ],
        0.020,
        mats.frame
      )
    );

    // Forked rear chainstays & seatstays embracing rear wheel
    [-1, 1].forEach((side) => {
      const axleSide = new THREE.Vector3(side * 0.068, REAR_AXLE.y, REAR_AXLE.z);
      const bbSide = new THREE.Vector3(side * 0.042, BB_POS.y, BB_POS.z);
      const stSide = new THREE.Vector3(side * 0.026, stTop.y - 0.03, stTop.z - 0.01);
      frameGroup.add(makeTubeBetween(bbSide, axleSide, 0.012, mats.frame, 8));
      frameGroup.add(makeTubeBetween(stSide, axleSide, 0.011, mats.frame, 8));
    });

    // ─── Saddle & Chrome Seatpost with Twin Coil Springs ───
    frameGroup.add(makeTubeBetween(stTop, new THREE.Vector3(0, 0.93, 0.33), 0.015, mats.chrome));

    const saddleGroup = new THREE.Group();
    saddleGroup.position.copy(SADDLE_TOP);
    const saddleBody = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), mats.leather);
    saddleBody.scale.set(1.15, 0.34, 1.48);
    saddleBody.position.set(0, -0.015, 0.01);
    saddleBody.castShadow = true;
    saddleGroup.add(saddleBody);

    // Narrow nose of cruiser saddle
    const saddleNose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), mats.leather);
    saddleNose.scale.set(0.85, 0.48, 1.85);
    saddleNose.position.set(0, -0.012, -0.11);
    saddleGroup.add(saddleNose);

    // Brass rivets along rear rim of saddle
    for (let i = -2; i <= 2; i++) {
      const ang = i * 0.36;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), mats.brass);
      rivet.position.set(Math.sin(ang) * 0.095, -0.025, 0.11 + Math.cos(ang) * 0.045);
      saddleGroup.add(rivet);
    }

    // Twin chrome suspension springs under saddle
    [-0.058, 0.058].forEach((sx) => {
      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.068, 10), mats.chrome);
      spring.position.set(sx, -0.062, 0.085);
      saddleGroup.add(spring);
    });
    frameGroup.add(saddleGroup);

    // ─── Rear Wheel, Fender, Rack, Rolled Beach Towel & Swinging Lantern ───
    this.rearWheel = createWheel(mats);
    this.rearWheel.position.copy(REAR_AXLE);
    this.root.add(this.rearWheel);

    // Rear cassette sprocket on right side
    const rearSprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.014, 16), mats.darkMetal);
    rearSprocket.rotation.z = Math.PI / 2;
    rearSprocket.position.x = 0.058;
    this.rearWheel.add(rearSprocket);

    // Rear curved fender
    const rearFender = createFender(WHEEL_RADIUS + 0.032, Math.PI * 1.14, -Math.PI * 0.06, mats.frame, mats.chrome);
    rearFender.position.copy(REAR_AXLE);
    this.root.add(rearFender);

    // Rear luggage rack
    const rackY = 0.91;
    const rackZ1 = 0.44;
    const rackZ2 = 0.96;
    [-0.095, 0.095].forEach((sx) => {
      frameGroup.add(
        makeTubeBetween(
          new THREE.Vector3(sx, rackY, rackZ1),
          new THREE.Vector3(sx, rackY, rackZ2),
          0.008,
          mats.chrome,
          6
        )
      );
      frameGroup.add(
        makeTubeBetween(
          new THREE.Vector3(sx * 0.72, REAR_AXLE.y, REAR_AXLE.z),
          new THREE.Vector3(sx, rackY, rackZ2 - 0.08),
          0.007,
          mats.chrome,
          6
        )
      );
    });
    [rackZ1, 0.62, 0.79, rackZ2].forEach((rz) => {
      frameGroup.add(
        makeTubeBetween(
          new THREE.Vector3(-0.095, rackY, rz),
          new THREE.Vector3(0.095, rackY, rz),
          0.007,
          mats.chrome,
          6
        )
      );
    });

    // Rolled striped beach towel strapped to rear rack
    const towel = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.28, 16), mats.towel);
    towel.rotation.z = Math.PI / 2;
    towel.position.set(0, rackY + 0.068, 0.70);
    towel.castShadow = true;
    frameGroup.add(towel);

    // Leather straps holding towel
    [-0.075, 0.075].forEach((sx) => {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.071, 0.008, 6, 18), mats.leather);
      strap.rotation.y = Math.PI / 2;
      strap.position.set(sx, rackY + 0.068, 0.70);
      frameGroup.add(strap);
    });

    // Swinging vintage brass lantern hanging from tail of rear rack
    this.lanternPivot = new THREE.Group();
    this.lanternPivot.position.set(0, rackY - 0.01, rackZ2 + 0.02);
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.036, 10), mats.brass);
    lanternCap.position.y = -0.05;
    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.068, 10), mats.lampBulb);
    lanternGlass.position.y = -0.095;
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.022, 10), mats.brass);
    lanternBase.position.y = -0.135;
    const lanternWire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), mats.brass);
    lanternWire.position.y = -0.02;
    this.lanternPivot.add(lanternWire, lanternCap, lanternGlass, lanternBase);
    frameGroup.add(this.lanternPivot);

    // ─── Drivetrain: Chainring, Chain Guard, Chain Runs, Cranks & Self-Leveling Pedals ───
    this.crankGroup = new THREE.Group();
    this.crankGroup.position.copy(BB_POS);
    this.root.add(this.crankGroup);

    // Front chainring
    const ringGeo = new THREE.TorusGeometry(0.095, 0.011, 8, 24);
    ringGeo.rotateY(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, mats.chrome);
    ring.position.x = 0.062;
    this.crankGroup.add(ring);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.092, 0.016), mats.chrome);
      arm.position.set(0.062, Math.cos(a) * 0.045, Math.sin(a) * 0.045);
      arm.rotation.x = a;
      this.crankGroup.add(arm);
    }

    // Upper & lower chain lines + painted partial chain guard
    frameGroup.add(
      makeTubeBetween(
        new THREE.Vector3(0.062, BB_POS.y + 0.095, BB_POS.z),
        new THREE.Vector3(0.060, REAR_AXLE.y + 0.056, REAR_AXLE.z),
        0.0065,
        mats.darkMetal,
        6
      )
    );
    frameGroup.add(
      makeTubeBetween(
        new THREE.Vector3(0.062, BB_POS.y - 0.095, BB_POS.z),
        new THREE.Vector3(0.060, REAR_AXLE.y - 0.056, REAR_AXLE.z),
        0.0065,
        mats.darkMetal,
        6
      )
    );

    // Stylish cream-accented upper chain guard
    const guardCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.082, BB_POS.y + 0.02, BB_POS.z - 0.105),
      new THREE.Vector3(0.082, BB_POS.y + 0.112, BB_POS.z + 0.02),
      new THREE.Vector3(0.080, REAR_AXLE.y + 0.082, REAR_AXLE.z - 0.05),
    ]);
    const guardMesh = new THREE.Mesh(new THREE.TubeGeometry(guardCurve, 18, 0.024, 8, false), mats.frameAccent);
    guardMesh.scale.set(0.35, 1.0, 1.0);
    guardMesh.position.x = 0.055;
    frameGroup.add(guardMesh);

    // Left & Right Crank Arms + Self-Leveling Pedals
    const makeCrankAndPedal = (side) => {
      // side = +1 (Right, starts UP at θ=0), side = -1 (Left, starts DOWN at θ=0)
      const xArm = side * 0.085;
      const xPedal = side * 0.145;
      const yEnd = side * CRANK_RADIUS;

      const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.016, CRANK_RADIUS + 0.024, 0.024), mats.chrome);
      crankArm.position.set(xArm, yEnd * 0.5, 0);
      crankArm.castShadow = true;
      this.crankGroup.add(crankArm);

      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), mats.chrome);
      spindle.rotation.z = Math.PI / 2;
      spindle.position.set(side * 0.135, yEnd, 0);
      this.crankGroup.add(spindle);

      const pedalPivot = new THREE.Group();
      pedalPivot.position.set(xPedal, yEnd, 0);
      const platform = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.024, 0.072), mats.darkMetal);
      platform.castShadow = true;
      pedalPivot.add(platform);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.01, 0.076), mats.brass);
      pedalPivot.add(trim);
      this.crankGroup.add(pedalPivot);
      return pedalPivot;
    };

    this.rightPedal = makeCrankAndPedal(1);
    this.leftPedal = makeCrankAndPedal(-1);

    // ─── Steering Assembly (Headset, Fork, Front Wheel, Handlebars, Basket, Bell, Headlamp) ───
    const headAngle = Math.atan2(htTop.z - htBot.z, htTop.y - htBot.y); // ~ +0.3218 rad
    this.steerAxis = new THREE.Group();
    this.steerAxis.position.copy(htTop);
    this.steerAxis.rotation.x = headAngle;
    this.root.add(this.steerAxis);

    this.steerPivot = new THREE.Group();
    this.steerAxis.add(this.steerPivot);

    // Compute exact front axle position in steerPivot local space so wheel touches y = 0 cleanly
    const axleDeltaWorld = new THREE.Vector3().subVectors(FRONT_AXLE, htTop);
    const frontAxleLocal = axleDeltaWorld.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -headAngle);
    const forkCrownLocal = new THREE.Vector3(0, -0.25, 0);

    // Fork crown + curved chrome-tipped fork blades
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.032, 0.044), mats.brass);
    crown.position.copy(forkCrownLocal);
    this.steerPivot.add(crown);

    [-1, 1].forEach((side) => {
      const p0 = new THREE.Vector3(side * 0.056, forkCrownLocal.y, 0);
      const p1 = new THREE.Vector3(side * 0.068, (forkCrownLocal.y + frontAxleLocal.y) * 0.55, frontAxleLocal.z * 0.25);
      const p2 = new THREE.Vector3(side * 0.064, frontAxleLocal.y, frontAxleLocal.z);
      this.steerPivot.add(makeCurvedTube([p0, p1, p2], 0.013, mats.frame, 12, 8));
    });

    // Front wheel & fender (un-rotated from headAngle so fender aligns vertically with tire)
    const frontWheelHolder = new THREE.Group();
    frontWheelHolder.position.copy(frontAxleLocal);
    frontWheelHolder.rotation.x = -headAngle;
    this.steerPivot.add(frontWheelHolder);

    this.frontWheel = createWheel(mats);
    frontWheelHolder.add(this.frontWheel);

    const frontFender = createFender(WHEEL_RADIUS + 0.032, Math.PI * 0.95, Math.PI * 0.14, mats.frame, mats.chrome);
    frontWheelHolder.add(frontFender);

    // Chrome stem & swept-back cruiser mustache handlebars
    this.steerPivot.add(makeTubeBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.16, 0), 0.014, mats.chrome));
    const stemClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), mats.brass);
    stemClamp.rotation.z = Math.PI / 2;
    stemClamp.position.set(0, 0.16, -0.035);
    this.steerPivot.add(stemClamp);

    // Build handlebars in level orientation attached at stem top
    const barHolder = new THREE.Group();
    barHolder.position.set(0, 0.16, -0.035);
    barHolder.rotation.x = -headAngle;
    this.steerPivot.add(barHolder);

    const barPoints = [
      new THREE.Vector3(-0.33, 0.01, 0.21),
      new THREE.Vector3(-0.27, 0.03, 0.07),
      new THREE.Vector3(-0.14, 0.03, -0.02),
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(0.14, 0.03, -0.02),
      new THREE.Vector3(0.27, 0.03, 0.07),
      new THREE.Vector3(0.33, 0.01, 0.21),
    ];
    barHolder.add(makeCurvedTube(barPoints, 0.013, mats.chrome, 26, 10));

    // Stitched leather handgrips + anchor markers for pelican wingtips
    this.leftGripAnchor = new THREE.Object3D();
    this.rightGripAnchor = new THREE.Object3D();

    [-1, 1].forEach((side) => {
      const pStart = new THREE.Vector3(side * 0.285, 0.024, 0.105);
      const pEnd = new THREE.Vector3(side * 0.335, 0.008, 0.22);
      barHolder.add(makeTubeBetween(pStart, pEnd, 0.021, mats.leather, 10));
      const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 8), mats.brass);
      endCap.position.copy(pEnd);
      barHolder.add(endCap);

      // Chrome brake lever
      const lever = makeTubeBetween(
        new THREE.Vector3(side * 0.27, 0.01, 0.08),
        new THREE.Vector3(side * 0.30, -0.02, 0.16),
        0.005,
        mats.chrome,
        6
      );
      barHolder.add(lever);

      const anchor = side < 0 ? this.leftGripAnchor : this.rightGripAnchor;
      anchor.position.copy(pStart).lerp(pEnd, 0.55);
      anchor.position.y += 0.015;
      barHolder.add(anchor);
    });

    // ─── Gleaming Brass Bicycle Bell (right handlebar) ───
    this.bellGroup = new THREE.Group();
    this.bellGroup.position.set(0.21, 0.048, 0.01);
    const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.014, 14), mats.chrome);
    const bellDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.029, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      mats.brass
    );
    bellDome.position.y = 0.006;
    const bellFinial = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), mats.brass);
    bellFinial.position.y = 0.036;
    this.bellStriker = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.028), mats.chrome);
    this.bellStriker.position.set(-0.026, 0.005, 0.015);
    this.bellGroup.add(bellBase, bellDome, bellFinial, this.bellStriker);
    barHolder.add(this.bellGroup);

    // ─── Woven Wicker Front Basket with Fish & Citrus Cargo ───
    const basketGroup = new THREE.Group();
    basketGroup.position.set(0, -0.12, -0.175);
    barHolder.add(basketGroup);

    const basketBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.125, 0.21, 14, 1, false),
      mats.wicker
    );
    basketBody.scale.set(1.18, 1.0, 0.88);
    basketBody.castShadow = true;
    basketBody.receiveShadow = true;
    basketGroup.add(basketBody);

    const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.176, 0.018, 8, 22), mats.wicker);
    basketRim.rotation.x = Math.PI / 2;
    basketRim.scale.set(1.18, 0.88, 1.0);
    basketRim.position.y = 0.102;
    basketGroup.add(basketRim);

    // Leather mounting straps to handlebar
    [-0.11, 0.11].forEach((sx) => {
      basketGroup.add(
        makeTubeBetween(
          new THREE.Vector3(sx, 0.09, 0.12),
          new THREE.Vector3(sx, 0.15, 0.165),
          0.009,
          mats.leather,
          6
        )
      );
    });

    // Bouncing cargo inside basket: fresh silver fish + bright coastal lemons!
    this.cargoGroup = new THREE.Group();
    this.cargoGroup.position.y = 0.095;
    basketGroup.add(this.cargoGroup);

    const fish1 = createFishProp(mats.fishSilver, mats.brass, false);
    fish1.position.set(-0.06, 0.03, 0.01);
    fish1.rotation.set(-0.45, 0.35, 0.25);
    const fish2 = createFishProp(mats.fishSilver, mats.brass, false);
    fish2.position.set(0.04, 0.025, -0.02);
    fish2.rotation.set(-0.55, -0.4, -0.2);
    this.cargoGroup.add(fish1, fish2);

    const lemonPositions = [
      [-0.08, 0.01, -0.04],
      [0.09, 0.015, 0.03],
      [0.01, 0.01, 0.05],
    ];
    lemonPositions.forEach(([lx, ly, lz], i) => {
      const lem = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), mats.lemon);
      lem.scale.set(1.25, 0.92, 0.92);
      lem.position.set(lx, ly, lz);
      lem.rotation.y = i * 1.1;
      lem.castShadow = true;
      this.cargoGroup.add(lem);
    });

    // ─── Vintage Chrome Headlamp + Volumetric Glow Cone (active in Sunset/Dusk) ───
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0, -0.22, -0.22);
    barHolder.add(lampGroup);

    const lampShell = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.032, 0.082, 14), mats.chrome);
    lampShell.rotation.x = Math.PI / 2;
    lampGroup.add(lampShell);

    const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), mats.lampBulb);
    lampLens.position.z = -0.042;
    lampLens.rotation.y = Math.PI;
    lampGroup.add(lampLens);

    // Subtle soft headlamp light cone pointing FORWARD (-Z) for twilight/dusk atmosphere
    const beamGeo = new THREE.ConeGeometry(0.72, 4.6, 18, 1, true);
    beamGeo.translate(0, -2.3, 0);
    beamGeo.rotateX(Math.PI / 2);
    this.beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uOpacity: { value: 0.0 },
        uColor: { value: new THREE.Color('#ffe29c') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          // vUv.y = 1 at lamp apex, 0 at far cone end -> fade smoothly out
          float fade = smoothstep(0.0, 0.72, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          gl_FragColor = vec4(uColor, fade * uOpacity);
        }
      `,
    });
    this.headlampBeam = new THREE.Mesh(beamGeo, this.beamMat);
    this.headlampBeam.position.set(0, 0, -0.045);
    this.headlampBeam.rotation.x = -0.15;
    lampGroup.add(this.headlampBeam);

    // Secondary dynamics state
    this.bellTimer = 0;
    this.cargoBounce = 0;
    this.cargoVel = 0;
    this.lanternAngle = 0;
    this.lanternVel = 0;
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  ringBell() {
    this.bellTimer = 0.65;
    this.cargoVel += 0.9;
  }

  impulseCargo(strength = 1.4) {
    this.cargoVel += strength;
  }

  /**
   * Returns exact bike-local pedal surface positions for 2-bone IK feet.
   */
  getPedalPositions(crankAngle, leftOut, rightOut) {
    const c = Math.cos(crankAngle);
    const s = Math.sin(crankAngle);
    // Right pedal at +CRANK_RADIUS along rotated +Y
    rightOut.set(0.145, BB_POS.y + CRANK_RADIUS * c + 0.022, BB_POS.z - CRANK_RADIUS * s);
    // Left pedal 180 deg opposite
    leftOut.set(-0.145, BB_POS.y - CRANK_RADIUS * c + 0.022, BB_POS.z + CRANK_RADIUS * s);
  }

  /**
   * Returns exact bike-local handlebar grip positions (tracking steering rotation).
   */
  getGripPositions(leftOut, rightOut) {
    this.root.updateMatrixWorld(true);
    this.leftGripAnchor.getWorldPosition(this._tmpA);
    this.rightGripAnchor.getWorldPosition(this._tmpB);
    leftOut.copy(this.root.worldToLocal(this._tmpA));
    rightOut.copy(this.root.worldToLocal(this._tmpB));
  }

  update(dt, steerAngle, crankAngle, wheelAngle, lampGlow, speed, accel = 0) {
    // Wheels spin forward toward -Z
    this.rearWheel.rotation.x = -wheelAngle;
    this.frontWheel.rotation.x = -wheelAngle;

    // Steering pivot: positive steerAngle = turn RIGHT (+X) -> negative Y rotation
    this.steerPivot.rotation.y = -steerAngle;

    // Crank rotation + self-leveling pedals
    this.crankGroup.rotation.x = -crankAngle;
    this.rightPedal.rotation.x = crankAngle;
    this.leftPedal.rotation.x = crankAngle;

    // Bell jiggle animation
    if (this.bellTimer > 0) {
      this.bellTimer = Math.max(0, this.bellTimer - dt);
      const vib = Math.sin(this.bellTimer * 52) * this.bellTimer * 0.65;
      this.bellGroup.rotation.z = vib * 0.35;
      this.bellStriker.rotation.y = vib * 1.4;
    } else {
      this.bellGroup.rotation.z = 0;
      this.bellStriker.rotation.y = 0;
    }

    // Springy wicker basket cargo bounce
    const springF = -48 * this.cargoBounce - 7.5 * this.cargoVel;
    this.cargoVel += springF * dt;
    this.cargoBounce += this.cargoVel * dt;
    if (this.cargoBounce < 0) {
      this.cargoBounce = 0;
      this.cargoVel = Math.abs(this.cargoVel) * 0.28;
    }
    this.cargoGroup.position.y = 0.095 + Math.min(0.11, this.cargoBounce * 0.08);

    // Swinging rear brass lantern pendulum
    const targetSwing = Math.min(0.65, speed * 0.022 + accel * 0.04);
    const lAcc = -28 * (this.lanternAngle - targetSwing) - 4.2 * this.lanternVel;
    this.lanternVel += lAcc * dt;
    this.lanternAngle += this.lanternVel * dt;
    this.lanternPivot.rotation.x = this.lanternAngle;
    this.lanternPivot.rotation.z = -steerAngle * 0.55;

    // Headlamp & rear lantern emissive + soft light cone
    this.mats.lampBulb.emissiveIntensity = 0.25 + lampGlow * 1.45;
    this.beamMat.uniforms.uOpacity.value = Math.max(0, (lampGlow - 0.32) * 0.26);
  }
}
