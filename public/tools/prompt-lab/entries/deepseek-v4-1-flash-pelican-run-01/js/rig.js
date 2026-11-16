import * as THREE from '../vendor/three.module.min.js';
import { tube, merge, blob, feather, box, mesh, placeBetween, solveTwoBone } from './geo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const lerp = (a, b, t) => a + (b - a) * t;

const COLORS = {
  feather: 0xf1e8d7,
  featherShade: 0xe2d6c0,
  beak: 0xf0a03e,
  beakDark: 0xd8822c,
  pouch: 0xe9873f,
  feet: 0xe98b36,
  frame: 0x2d6f68,
  cream: 0xf4e6c7,
  brass: 0xc9a15f,
  tire: 0x1b2128,
  leather: 0x7c4c31,
  steel: 0x9aa7b4,
  glass: 0xffc978,
  eye: 0x11100f,
  sclera: 0xf8f2e2,
  scarf: 0xe2553e,
  scarfShade: 0xc24432,
  basket: 0xb98c5d,
  goggle: 0x121b26,
  wickerDark: 0x8f6a43,
};

function makeGlowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.62)');
  g.addColorStop(0.44, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMaterials() {
  const m = (color, opts = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0,
    ...opts,
  });
  return {
    feather: m(COLORS.feather, { roughness: 0.88 }),
    featherShade: m(COLORS.featherShade, { roughness: 0.9 }),
    beak: m(COLORS.beak, { roughness: 0.46 }),
    beakDark: m(COLORS.beakDark, { roughness: 0.5 }),
    pouch: m(COLORS.pouch, { roughness: 0.52, emissive: 0x2a0c02, emissiveIntensity: 0.4 }),
    feet: m(COLORS.feet, { roughness: 0.55 }),
    frame: m(COLORS.frame, { roughness: 0.32, metalness: 0.55 }),
    cream: m(COLORS.cream, { roughness: 0.55 }),
    brass: m(COLORS.brass, { roughness: 0.28, metalness: 0.85 }),
    tire: m(COLORS.tire, { roughness: 0.92 }),
    leather: m(COLORS.leather, { roughness: 0.62 }),
    steel: m(COLORS.steel, { roughness: 0.3, metalness: 0.9 }),
    glass: m(COLORS.glass, { emissive: 0xffa94d, emissiveIntensity: 3.4, roughness: 0.2, transparent: true, opacity: 1 }),
    eye: m(COLORS.eye, { roughness: 0.15, metalness: 0.1 }),
    sclera: m(COLORS.sclera, { roughness: 0.35 }),
    glint: m(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.2 }),
    scarf: m(COLORS.scarf, { roughness: 0.8, side: THREE.DoubleSide }),
    scarfShade: m(COLORS.scarfShade, { roughness: 0.8, side: THREE.DoubleSide }),
    basket: m(COLORS.basket, { roughness: 0.82 }),
    wickerDark: m(COLORS.wickerDark, { roughness: 0.85 }),
    goggle: m(COLORS.goggle, { roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.5 }),
    cargo: m(0x9df2e4, { roughness: 0.35, emissive: 0x3fc9b4, emissiveIntensity: 1.3 }),
  };
}

function buildBeak() {
  const rings = 12;
  const seg = 10;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const z = -0.035 - t * 0.415;
    const y = 0.018 - t * 0.052 - t * t * 0.028;
    const w = 0.061 * Math.pow(1 - t, 0.62) + 0.009;
    const h = 0.036 * Math.pow(1 - t, 0.7) + 0.005;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      pos.push(cx * w, y + sy * h * (sy > 0 ? 1 : 0.62), z);
      uv.push(j / seg, t);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeWheel(matTire, matBrass, matSteel) {
  const R = 0.36;
  const g = new THREE.Group();
  const tire = new THREE.TorusGeometry(R, 0.037, 8, 48);
  tire.rotateY(Math.PI / 2);
  g.add(mesh(tire, matTire));
  const rim = new THREE.TorusGeometry(R - 0.052, 0.0115, 6, 40);
  rim.rotateY(Math.PI / 2);
  const parts = [rim];
  const spokeCount = 16;
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * TAU;
    const inner = V(i % 2 ? 0.026 : -0.026, Math.cos(a) * 0.03, Math.sin(a) * 0.03);
    const outer = V(i % 2 ? 0.012 : -0.012, Math.cos(a) * (R - 0.06), Math.sin(a) * (R - 0.06));
    parts.push(tube(inner, outer, 0.0032, 0.0032, 3));
  }
  const hub = new THREE.CylinderGeometry(0.027, 0.027, 0.135, 10);
  hub.rotateZ(Math.PI / 2);
  parts.push(hub);
  g.add(mesh(merge(parts), matBrass));
  const dust = new THREE.Mesh(
    new THREE.CircleGeometry(0.026, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
  );
  dust.position.set(0.069, 0, 0);
  g.add(dust);
  return g;
}

function buildRig() {
  const root = new THREE.Group();
  const M = makeMaterials();
  const glowTex = makeGlowTexture();
  const R = 0.36;
  const BB = V(0, 0.33, 0.1);
  const rear = V(0, R, 0.5);
  const front = V(0, R, -0.54);
  const seatTop = V(0, 0.93, 0.3);
  const headTop = V(0, 0.97, -0.34);
  const headBot = V(0, 0.7, -0.4);

  const bike = new THREE.Group();
  root.add(bike);

  // ——— 车架 ———
  const frameParts = [
    tube(BB, seatTop, 0.022),
    tube(seatTop, headTop, 0.02),
    tube(BB, headBot, 0.024),
    tube(headTop, headBot, 0.026),
    tube(V(0, 0.9, 0.29), V(0, 1.0, 0.3), 0.016),
  ];
  for (const sx of [-0.036, 0.036]) {
    frameParts.push(tube(V(sx, BB.y, BB.z), V(sx * 0.8, rear.y, rear.z), 0.013, 0.011, 5));
    frameParts.push(tube(V(sx, 0.9, 0.285), V(sx * 0.8, rear.y, rear.z), 0.011, 0.009, 5));
    frameParts.push(tube(V(sx * 0.7, headBot.y, headBot.z), V(sx * 0.6, front.y, front.z), 0.014, 0.011, 5));
  }
  const crown = new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8);
  crown.rotateZ(Math.PI / 2);
  crown.translate(0, headBot.y, headBot.z);
  frameParts.push(crown);
  bike.add(mesh(merge(frameParts), M.frame));

  // ——— 挡泥板与车筐 ———
  const creamParts = [];
  for (const axle of [rear, front]) {
    const fender = new THREE.TorusGeometry(0.398, 0.013, 6, 32, 2.35);
    fender.rotateY(Math.PI / 2);
    fender.rotateX(0.37);
    fender.translate(axle.x, axle.y, axle.z);
    creamParts.push(fender);
  }
  const basketX = 0;
  const basketY = 0.99;
  const basketZ = -0.63;
  creamParts.push(box(0.3, 0.11, 0.19, basketX, basketY, basketZ));
  const basketRim = new THREE.TorusGeometry(0.155, 0.009, 5, 18);
  basketRim.rotateX(Math.PI / 2);
  basketRim.scale(1, 1, 0.66);
  basketRim.translate(basketX, basketY + 0.055, basketZ);
  creamParts.push(basketRim);
  const handle = new THREE.TorusGeometry(0.15, 0.008, 5, 16, Math.PI);
  handle.translate(basketX, basketY + 0.06, basketZ);
  creamParts.push(handle);
  bike.add(mesh(merge(creamParts), M.cream));

  const wicker = [];
  for (let i = 0; i < 4; i++) {
    const x = -0.105 + i * 0.07;
    for (const dz of [-0.093, 0.093]) {
      wicker.push(tube(V(x, basketY - 0.05, basketZ + dz), V(x, basketY + 0.045, basketZ + dz), 0.0035, 0.0035, 3));
    }
  }
  for (const y of [-0.03, 0.02, 0.055]) {
    for (const dz of [-0.095, 0.095]) {
      wicker.push(tube(V(-0.145, basketY + y, basketZ + dz), V(0.145, basketY + y, basketZ + dz), 0.0035, 0.0035, 3));
    }
    for (const dx of [-0.148, 0.148]) {
      wicker.push(tube(V(dx, basketY + y, basketZ - 0.09), V(dx, basketY + y, basketZ + 0.09), 0.0035, 0.0035, 3));
    }
  }
  bike.add(mesh(merge(wicker), M.wickerDark));

  // 车筐里的两条月光鱼（纯装饰，但暗示“今晚有货”）
  const cargo = [];
  for (const [x, tilt] of [[-0.055, -0.42], [0.05, 0.3]]) {
    cargo.push(blob(x, basketY + 0.08, basketZ + 0.02, 0.035, 0.045, 0.07, 10));
    const tail = feather(0.13, 0.032, 0.01);
    tail.rotateX(Math.PI / 2 - 0.2);
    tail.rotateY(tilt);
    tail.translate(x, basketY + 0.1, basketZ + 0.06);
    cargo.push(tail);
  }
  const cargoMesh = mesh(merge(cargo), M.cargo);
  bike.add(cargoMesh);

  // ——— 车轮 ———
  const rearWheel = makeWheel(M.tire, M.brass, M.steel);
  rearWheel.position.copy(rear);
  root.add(rearWheel);
  const frontPivot = new THREE.Group();
  frontPivot.position.copy(front);
  const frontWheel = makeWheel(M.tire, M.brass, M.steel);
  frontPivot.add(frontWheel);
  root.add(frontPivot);

  // ——— 传动 ———
  const chainParts = [
    tube(V(0.055, BB.y + 0.09, BB.z), V(0.055, rear.y + 0.048, rear.z), 0.0045, 0.0045, 4),
    tube(V(0.055, BB.y - 0.09, BB.z), V(0.055, rear.y - 0.048, rear.z), 0.0045, 0.0045, 4),
  ];
  const cog = new THREE.TorusGeometry(0.05, 0.009, 5, 20);
  cog.rotateY(Math.PI / 2);
  cog.translate(0.055, rear.y, rear.z);
  chainParts.push(cog);
  bike.add(mesh(merge(chainParts), M.steel));

  const crank = new THREE.Group();
  crank.position.copy(BB);
  const crankParts = [];
  const ring = new THREE.TorusGeometry(0.095, 0.01, 5, 30);
  ring.rotateY(Math.PI / 2);
  ring.translate(0.055, 0, 0);
  crankParts.push(ring);
  for (const side of [-1, 1]) {
    crankParts.push(tube(V(side * 0.075, 0, 0), V(side * 0.075, side * 0.17, 0), 0.013, 0.011, 5));
    crankParts.push(tube(V(side * 0.075, side * 0.17, 0), V(side * 0.155, side * 0.17, 0), 0.01, 0.01, 5));
  }
  const spindle = new THREE.CylinderGeometry(0.017, 0.017, 0.19, 8);
  spindle.rotateZ(Math.PI / 2);
  crankParts.push(spindle);
  crank.add(mesh(merge(crankParts), M.steel));
  root.add(crank);

  const pedals = [];
  const feet = [];
  for (const side of [-1, 1]) {
    const pedal = new THREE.Group();
    const pg = merge([
      box(0.095, 0.016, 0.058, 0, 0, 0),
      box(0.1, 0.01, 0.062, 0, 0.012, 0),
    ]);
    pedal.add(mesh(pg, M.leather));
    pedal.add(mesh(box(0.078, 0.004, 0.012, 0, 0.019, 0.022), M.brass));
    root.add(pedal);
    pedals.push({ side, group: pedal });

    const foot = new THREE.Group();
    const toes = [];
    for (const [yaw, len] of [[-0.38, 0.11], [0, 0.13], [0.38, 0.11]]) {
      const toe = feather(len, 0.024, 0.012);
      toe.rotateX(-Math.PI / 2);
      toe.rotateY(yaw);
      toe.translate(0, 0.012, -0.02);
      toes.push(toe);
    }
    toes.push(blob(0, 0.012, -0.01, 0.045, 0.022, 0.045, 10));
    const claws = [];
    for (let i = 0; i < 3; i++) {
      const a = -0.38 + i * 0.38;
      claws.push(blob(Math.sin(a) * 0.12, 0.01, -0.16 * Math.cos(a), 0.008, 0.006, 0.016, 6));
    }
    foot.add(mesh(merge([...toes, ...claws]), M.feet));
    root.add(foot);
    feet.push({ side, group: foot });
  }

  // ——— 车把 / 铃 / 车灯 ———
  const barPivot = new THREE.Group();
  barPivot.position.copy(headTop);
  root.add(barPivot);
  const barCurve = new THREE.CatmullRomCurve3([
    V(-0.21, 0.08, 0.02),
    V(-0.14, 0.095, -0.09),
    V(0, 0.1, -0.125),
    V(0.14, 0.095, -0.09),
    V(0.21, 0.08, 0.02),
  ]);
  const barGeo = new THREE.TubeGeometry(barCurve, 28, 0.016, 6, false);
  const stem = tube(V(0, 0, 0.0), V(0, 0.1, -0.125), 0.017, 0.015, 6);
  barPivot.add(mesh(merge([barGeo, stem]), M.steel));
  const gripGeos = [];
  for (const side of [-1, 1]) {
    gripGeos.push(tube(V(side * 0.21, 0.08, 0.02), V(side * 0.245, 0.074, 0.1), 0.02, 0.018, 7));
  }
  barPivot.add(mesh(merge(gripGeos), M.leather));

  const bell = new THREE.Group();
  bell.position.set(0.105, 0.115, -0.095);
  const bellDome = new THREE.SphereGeometry(0.026, 12, 8, 0, TAU, 0, Math.PI / 2);
  const bellBase = new THREE.CylinderGeometry(0.028, 0.028, 0.008, 10);
  bell.add(mesh(merge([bellDome, bellBase]), M.brass));
  const bellLever = mesh(tube(V(0.02, 0.012, 0.01), V(0.04, 0.03, 0.02), 0.004, 0.003, 4), M.steel);
  bell.add(bellLever);
  barPivot.add(bell);

  // 车灯（挂在车把左前侧的木杆上）
  const lantern = new THREE.Group();
  lantern.position.set(-0.255, 0.9, -0.46);
  const lanternParts = [
    tube(V(-0.255, 1.13, -0.43), V(-0.255, 1.0, -0.46), 0.008, 0.008, 5),
    (() => {
      const cap = new THREE.ConeGeometry(0.075, 0.06, 10);
      cap.translate(0, 0.095, 0);
      return cap;
    })(),
    (() => {
      const base = new THREE.CylinderGeometry(0.06, 0.065, 0.02, 12);
      base.translate(0, -0.09, 0);
      return base;
    })(),
  ];
  const lanternStatic = mesh(merge(lanternParts), M.brass);
  lantern.add(lanternStatic);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.15, 12, 1, true), M.glass);
  glass.position.y = 0.005;
  lantern.add(glass);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffb567, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95, fog: false,
  }));
  flame.scale.setScalar(0.55);
  flame.position.y = 0.005;
  lantern.add(flame);
  const lanternLight = new THREE.PointLight(0xffb168, 2.4, 6.5, 2);
  lantern.add(lanternLight);
  bike.add(lantern);

  // 车尾反光片
  const reflector = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), new THREE.MeshBasicMaterial({ color: 0xff6f4f }));
  reflector.position.set(0, 0.9, 0.47);
  reflector.rotation.y = Math.PI;
  bike.add(reflector);

  // ——— 鹈鹕身体 ———
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 1.0, 0.17);
  root.add(bodyPivot);

  const bodyGeo = merge([
    blob(0, 0.19, 0.0, 0.222, 0.225, 0.29, 22),
    blob(0, 0.15, -0.11, 0.185, 0.195, 0.175, 20),
    blob(0, 0.26, -0.055, 0.15, 0.09, 0.12, 14),
    blob(0, 0.17, 0.21, 0.17, 0.165, 0.17, 18),
    blob(0.17, 0.27, 0.02, 0.062, 0.11, 0.175, 14),
    blob(-0.17, 0.27, 0.02, 0.062, 0.11, 0.175, 14),
    blob(0, 0.355, -0.055, 0.12, 0.075, 0.12, 16),
  ]);
  bodyPivot.add(mesh(bodyGeo, M.feather));
  const backFeathers = [];
  for (let i = 0; i < 6; i++) {
    const f = feather(0.2 - i * 0.01, 0.05, 0.012);
    f.rotateX(Math.PI / 2 + 0.28);
    f.rotateY((i - 2.5) * 0.16);
    f.translate((i - 2.5) * 0.07, 0.34, 0.02 + Math.abs(i - 2.5) * 0.03);
    backFeathers.push(f);
  }
  bodyPivot.add(mesh(merge(backFeathers), M.featherShade));

  // 尾羽
  const tail = new THREE.Group();
  tail.position.set(0, 0.2, 0.32);
  const tailGeos = [];
  for (const [x, yaw, tilt, len] of [[0, 0, 1.2, 0.4], [-0.06, 0.26, 1.1, 0.35], [0.06, -0.26, 1.1, 0.35], [-0.11, 0.4, 1.0, 0.29], [0.11, -0.4, 1.0, 0.29]]) {
    const f = feather(len, 0.055, 0.012);
    f.rotateX(tilt);
    f.rotateY(yaw);
    f.translate(x, 0, 0);
    tailGeos.push(f);
  }
  tail.add(mesh(merge(tailGeos), M.featherShade));
  bodyPivot.add(tail);

  // 脖子
  const neck = new THREE.Group();
  neck.position.set(0, 0.35, -0.09);
  bodyPivot.add(neck);
  const neckCurve = new THREE.CatmullRomCurve3([
    V(0, -0.03, 0.03),
    V(0, 0.1, -0.045),
    V(0, 0.22, -0.05),
    V(0, 0.33, -0.13),
    V(0, 0.4, -0.21),
  ]);
  const neckGeo = new THREE.TubeGeometry(neckCurve, 22, 0.058, 10, false);
  neck.add(mesh(neckGeo, M.feather));
  // 脖子上的细羽环
  const ruff = new THREE.TorusGeometry(0.062, 0.014, 5, 12);
  ruff.rotateX(Math.PI / 2);
  ruff.translate(0, 0.03, -0.015);
  neck.add(mesh(ruff, M.featherShade));
  const neckFeathers = [];
  for (let i = 0; i < 5; i++) {
    const f = feather(0.1, 0.03, 0.008);
    f.rotateX(0.6);
    f.rotateZ((i - 2) * 0.3);
    f.translate((i - 2) * 0.02, 0.02, 0.03);
    neckFeathers.push(f);
  }
  neck.add(mesh(merge(neckFeathers), M.feather));

  // 头
  const head = new THREE.Group();
  head.position.set(0, 0.4, -0.21);
  neck.add(head);
  const skull = merge([
    blob(0, 0.02, 0, 0.105, 0.1, 0.118, 20),
    blob(0, -0.005, -0.055, 0.075, 0.07, 0.075, 14),
  ]);
  head.add(mesh(skull, M.feather));

  // 冠羽
  const crestGeos = [];
  for (const [x, yaw, tilt] of [[-0.04, 0.3, 1.32], [0.0, 0.05, 1.45], [0.04, -0.25, 1.32]]) {
    const f = feather(0.14, 0.03, 0.009);
    f.rotateX(tilt);
    f.rotateY(yaw);
    f.translate(x, 0.09, 0.06);
    crestGeos.push(f);
  }
  head.add(mesh(merge(crestGeos), M.featherShade));

  // 眼睛
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.083, 0.035, -0.045);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), M.sclera);
    sclera.scale.set(0.72, 1, 1);
    eye.add(sclera);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), M.eye);
    iris.position.x = side * 0.018;
    iris.scale.set(0.6, 1, 1);
    eye.add(iris);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), M.glint);
    glint.position.set(side * 0.028, 0.009, -0.006);
    eye.add(glint);
    head.add(eye);
    eyes.push(eye);
  }

  // 护目镜
  const goggleGeos = [];
  const lensGeos = [];
  for (const side of [-1, 1]) {
    const rim = new THREE.TorusGeometry(0.043, 0.008, 6, 16);
    rim.rotateZ(side * 0.1);
    rim.translate(side * 0.062, 0.082, -0.078);
    goggleGeos.push(rim);
    const lens = new THREE.CircleGeometry(0.037, 16);
    const lm = new THREE.Matrix4();
    lm.makeTranslation(side * 0.062, 0.082, -0.081);
    lens.applyMatrix4(lm);
    lensGeos.push(lens);
    const strapEnd = V(side * 0.095, 0.078, 0.01);
    goggleGeos.push(tube(V(side * 0.075, 0.075, -0.065), strapEnd, 0.008, 0.008, 4));
  }
  const strap = new THREE.TorusGeometry(0.108, 0.007, 5, 20);
  strap.rotateX(Math.PI / 2);
  strap.translate(0, 0.075, 0.005);
  goggleGeos.push(strap);
  head.add(mesh(merge(goggleGeos), M.leather));
  const lensMesh = new THREE.Mesh(merge(lensGeos), M.goggle);
  lensMesh.material.side = THREE.DoubleSide;
  head.add(lensMesh);

  // 喙与喉囊
  head.add(mesh(merge([buildBeak(), blob(0, -0.048, -0.445, 0.018, 0.016, 0.02, 10)]), M.beak));
  const lowerBeak = mesh(tube(V(0, -0.012, -0.075), V(0, -0.088, -0.44), 0.014, 0.007, 6), M.beakDark);
  head.add(lowerBeak);
  const hook = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 7), M.beakDark);
  hook.position.set(0, -0.082, -0.435);
  hook.rotation.x = Math.PI;
  head.add(hook);

  const pouch = new THREE.Group();
  pouch.position.set(0, -0.125, -0.215);
  const pouchGeo = merge([
    blob(0, 0, 0, 0.118, 0.135, 0.22, 20),
    blob(0, 0.012, -0.15, 0.052, 0.05, 0.075, 12),
  ]);
  const pouchMesh = mesh(pouchGeo, M.pouch);
  pouch.add(pouchMesh);
  head.add(pouch);

  // ——— 翅膀（收拢时贴着身体，跃起时展开） ———
  const wingGroups = [];
  function buildWing(side) {
    const group = new THREE.Group();
    // 肩部小覆羽，遮住羽根
    group.add(mesh(merge([
      blob(side * 0.012, 0.0, 0.04, 0.045, 0.09, 0.11, 12),
    ]), M.feather));
    const coverts = [];
    for (let i = 0; i < 5; i++) {
      const f = feather(0.15 + i * 0.016, 0.045, 0.01);
      f.rotateX(Math.PI / 2 + 0.12);
      f.rotateY(side * (i - 2) * 0.1);
      f.translate(side * 0.012, 0.02 - i * 0.006, 0.04 + i * 0.032);
      coverts.push(f);
    }
    group.add(mesh(merge(coverts), M.feather));
    const secondaries = [];
    for (let i = 0; i < 5; i++) {
      const f = feather(0.26 + i * 0.012, 0.05, 0.011);
      f.rotateX(Math.PI / 2 + 0.26);
      f.rotateY(side * (i - 2) * 0.12);
      f.translate(side * 0.015, -0.015, 0.14 + i * 0.03);
      secondaries.push(f);
    }
    group.add(mesh(merge(secondaries), M.featherShade));
    const primaries = [];
    for (let i = 0; i < 6; i++) {
      const f = feather(0.3 + i * 0.026, 0.045, 0.01);
      f.rotateX(Math.PI / 2 + 0.4 + i * 0.02);
      f.rotateY(side * (i - 2.5) * 0.1);
      f.translate(side * (0.02 + i * 0.006), -0.055 - i * 0.004, 0.28 + i * 0.02);
      primaries.push(f);
    }
    group.add(mesh(merge(primaries), M.featherShade));
    group.position.set(side * 0.17, 1.3, 0.04);
    root.add(group);
    return { side, group };
  }
  wingGroups.push(buildWing(-1), buildWing(1));

  // ——— 腿脚 ———
  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 1, 4, 9), M.feet);
    thigh.geometry.translate(0, 0.5, 0);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 1, 4, 8), M.feet);
    shin.geometry.translate(0, 0.5, 0);
    root.add(thigh, shin);
    const foot = feet.find((f) => f.side === side).group;
    legs.push({ side, thigh, shin, foot });
  }

  // ——— 围巾 ———
  const scarfGroup = new THREE.Group();
  bodyPivot.add(scarfGroup);
  const SCARF_N = 14;
  const scarfGeo = new THREE.BufferGeometry();
  const scarfPos = new Float32Array((SCARF_N + 1) * 2 * 3);
  const scarfUv = new Float32Array((SCARF_N + 1) * 2 * 2);
  const scarfIdx = [];
  for (let i = 0; i <= SCARF_N; i++) {
    scarfUv.set([0, i / SCARF_N, 1, i / SCARF_N], i * 4);
    if (i < SCARF_N) {
      const a = i * 2;
      scarfIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  scarfGeo.setAttribute('position', new THREE.BufferAttribute(scarfPos, 3));
  scarfGeo.setAttribute('uv', new THREE.BufferAttribute(scarfUv, 2));
  scarfGeo.setIndex(scarfIdx);
  const scarf = new THREE.Mesh(scarfGeo, M.scarf);
  scarfGroup.add(scarf);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.scarf);
  knot.position.set(0, 0.4, 0.18);
  knot.scale.set(1.1, 0.85, 0.9);
  scarfGroup.add(knot);
  const scarfTail = new THREE.Mesh(scarfGeo, M.scarfShade);
  scarfTail.position.set(0.05, 0.02, 0.1);
  scarfTail.scale.set(0.55, 0.55, 0.88);
  scarfGroup.add(scarfTail);

  // ——— 地面接触阴影 ———
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sc = shadowCanvas.getContext('2d');
  const sg = sc.createRadialGradient(64, 64, 4, 64, 64, 64);
  sg.addColorStop(0, 'rgba(0,0,0,0.78)');
  sg.addColorStop(0.45, 'rgba(0,0,0,0.4)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  sc.fillStyle = sg;
  sc.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.015, -0.1);
  shadow.renderOrder = 2;

  // ——— 动画状态 ———
  let crankAngle = 0;
  let wheelAngle = 0;
  let pouchSpring = 0;
  let pouchVel = 0;
  let pouchTarget = 0;
  let blinkTimer = 2.4;
  let blinkPhase = 0;
  let gulp = 0;
  let bellPulse = 0;
  let wingFlap = 0;
  const lookAt = new THREE.Vector2(0, 0);
  const lookSmooth = new THREE.Vector2(0, 0);
  const hipL = V(-0.125, 0.02, 0.06);
  const hipR = V(0.125, 0.02, 0.06);
  const tmpHip = new THREE.Vector3();
  const knee = new THREE.Vector3();
  const footPos = new THREE.Vector3();
  const bendDir = new THREE.Vector3();
  const pouchWorld = new THREE.Vector3();

  function update(state, dt, time) {
    const speed = state.speed;
    const air = state.air || 0;
    const hop = state.hop || 0;
    const steer = state.steer || 0;
    const motion = state.reduced ? 0.45 : 1;

    // 车轮 / 曲柄
    wheelAngle += (speed / R) * dt;
    crankAngle += (speed / 4.05) * dt * TAU;
    rearWheel.rotation.x = -wheelAngle;
    frontWheel.rotation.x = -wheelAngle;
    crank.rotation.x = -crankAngle;

    const bob = Math.sin(crankAngle * 2) * 0.011 * motion + Math.sin(time * 1.7) * 0.003;
    const push = 0.012 * speed / 8;
    bodyPivot.position.y = 1.0 + bob + push;
    bodyPivot.position.z = 0.17 + Math.sin(crankAngle * 2 + 0.7) * 0.006 * motion;
    const lean = -steer * 0.16 - Math.sin(time * 0.9) * 0.006 * motion;
    root.rotation.z = lean;
    root.rotation.y = steer * 0.04;
    root.position.x = state.x || 0;
    root.position.y = hop;
    bodyPivot.rotation.x = -0.05 - speed * 0.006 + Math.sin(crankAngle * 2 + 1.4) * 0.008 * motion - air * 0.12;
    bodyPivot.rotation.z = -lean * 0.62 + Math.sin(crankAngle * 2 + 0.4) * 0.014 * motion;
    bodyPivot.rotation.y = steer * 0.1;

    bodyPivot.updateMatrix();

    // 车把与前轮转向
    barPivot.rotation.y = steer * 0.16;
    frontPivot.rotation.y = steer * 0.3;

    // 铃铛的余震
    bellPulse = Math.max(0, bellPulse - dt * 2.4);
    bell.rotation.z = Math.sin(time * 34) * 0.18 * bellPulse;
    bell.rotation.x = Math.cos(time * 29) * 0.12 * bellPulse;

    // 车灯摆动
    lantern.rotation.z = Math.sin(time * 1.9) * 0.035 - steer * 0.1;
    lantern.rotation.x = Math.sin(time * 1.3 + 1) * 0.03;
    flame.material.opacity = 0.8 + Math.sin(time * 11) * 0.06 + Math.sin(time * 5.3) * 0.05;
    lanternLight.intensity = 2.25 + Math.sin(time * 9.2) * 0.18;

    // 脖子与头
    const headBob = Math.sin(crankAngle * 2 + 2.1) * 0.045 * motion;
    neck.rotation.x = 0.06 + Math.sin(time * 1.15) * 0.018 + air * 0.1;
    neck.rotation.z = -lean * 0.85 + Math.sin(time * 0.85) * 0.012 * motion;
    neck.rotation.y = -0.1 - steer * 0.12;
    head.rotation.x = -0.18 + headBob - air * 0.18 + gulp * 0.25;
    head.rotation.y = -0.3 + clamp(lookSmooth.x * 0.5, -0.36, 0.36);
    head.rotation.z = Math.sin(time * 1.4 + 0.4) * 0.028 * motion + lean * 0.35;
    lookAt.lerp(state.look || lookAt, 1 - Math.pow(0.001, dt));
    lookSmooth.lerp(lookAt, 1 - Math.pow(0.004, dt));

    // 眨眼
    blinkTimer -= dt;
    if (blinkTimer < 0) {
      blinkTimer = 2.6 + Math.random() * 4.2;
      blinkPhase = 1;
    }
    if (blinkPhase > 0) blinkPhase = Math.max(0, blinkPhase - dt * 6.5);
    const blink = 1 - Math.sin(blinkPhase * Math.PI) * 0.92;
    for (const eye of eyes) eye.scale.y = blink;

    // 喉囊弹簧
    pouchTarget = state.fill || 0;
    gulp = Math.max(0, gulp - dt * 2.6);
    const targetSpring = pouchTarget + Math.sin(time * 2.1) * 0.012 * pouchTarget;
    const accel = (targetSpring - pouchSpring) * 130 - pouchVel * 15;
    pouchVel += accel * dt;
    pouchSpring += pouchVel * dt;
    const pf = clamp(pouchSpring, 0, 1.3);
    pouch.scale.set(1 + pf * 0.07, 1 + pf * 0.62 + gulp * 0.16, 1 + pf * 0.04);
    pouch.position.y = -0.085 - pf * 0.02;
    pouch.rotation.x = Math.sin(time * 2.4) * 0.03 * pf + Math.sin(time * 8.7) * 0.05 * gulp;
    pouch.rotation.z = Math.sin(time * 3.1) * 0.02 * pf;
    pouchMesh.material.emissiveIntensity = 0.4 + pf * 0.5;

    // 腿：脚踏位置驱动两骨 IK
    const hipBase = [hipL, hipR];
    legs.forEach((leg, i) => {
      const side = leg.side;
      const phase = side === 1 ? 0 : Math.PI;
      const a = crankAngle + phase;
      const px = side * 0.155;
      const py = BB.y + Math.cos(a) * 0.17;
      const pz = BB.z - Math.sin(a) * 0.17;
      footPos.set(px, py + 0.03, pz);
      if (air > 0.02) {
        footPos.y += 0.16 * air;
        footPos.z += 0.1 * air;
      }
      // 抬脚时脚尖略上翘
      const ankle = air > 0.02 ? -0.25 : Math.sin(a) * 0.16;
      leg.foot.position.copy(footPos);
      leg.foot.rotation.x = ankle;
      leg.foot.rotation.z = side * 0.06;

      const pedalGroup = pedals[i].group;
      pedalGroup.position.set(px, py, pz);
      pedalGroup.rotation.x = 0;
      pedalGroup.rotation.z = Math.sin(time * 2 + phase) * 0.03;

      tmpHip.copy(hipBase[i]).applyMatrix4(bodyPivot.matrix);
      bendDir.set(0, 0.05, 1);
      solveTwoBone(tmpHip, footPos, 0.4, 0.44, bendDir, knee);
      placeBetween(leg.thigh, tmpHip, knee, 1);
      placeBetween(leg.shin, knee, footPos, 1);
    });

    // 翅膀：贴着身侧，跃起时展开并扇动
    const flap = air > 0.01 ? Math.sin(time * 16) * 0.15 * air : 0;
    for (const wing of wingGroups) {
      const side = wing.side;
      const spread = air;
      wing.group.rotation.x = 0.18 + Math.sin(time * 1.3 + side) * 0.02 * motion + spread * (0.28 + flap);
      wing.group.rotation.y = side * (0.2 + spread * 0.95);
      wing.group.rotation.z = side * (-0.04 - spread * 0.25) + Math.sin(time * 1.7) * 0.02;
      wing.group.position.y = 1.3 + Math.sin(crankAngle * 2 + 0.5) * 0.006;
      wing.group.position.z = 0.04 + spread * -0.08;
    }

    // 尾羽 / 围巾
    tail.rotation.x = 0.12 + Math.sin(time * 1.6) * 0.05 * motion + air * 0.5;
    tail.rotation.z = Math.sin(time * 1.2 + 0.3) * 0.04;
    tail.rotation.y = -steer * 0.3;

    const sp = clamp(speed / 9, 0, 1.4);
    const amp = (0.02 + sp * 0.075) * motion;
    const posAttr = scarfGeo.attributes.position;
    for (let i = 0; i <= SCARF_N; i++) {
      const t = i / SCARF_N;
      const w = 0.062 * (1 - t * 0.3);
      const twist = 0.5 + t * 0.9 + Math.sin(time * 2.1 + t * 2.4) * 0.22;
      const wave = Math.sin(t * 5.2 - time * 7.2) * amp * 0.7 * t + Math.sin(t * 2.3 - time * 3.4) * amp * 0.5 * t;
      const lift = t * (0.04 + sp * 0.05) + Math.sin(t * 3.4 - time * 5.1) * 0.05 * t * motion + air * 0.18 * t;
      const x = wave + Math.sin(t * 1.4 - time * 1.2) * 0.035 * t;
      const y = 0.4 + lift + Math.cos(t * 4.1 - time * 4.4) * 0.045 * t * motion;
      const z = 0.19 + t * 0.82;
      const dx = Math.cos(twist) * w;
      const dy = Math.sin(twist) * w * 0.7;
      posAttr.setXYZ(i * 2, x - dx, y - dy, z);
      posAttr.setXYZ(i * 2 + 1, x + dx, y + dy, z);
    }
    posAttr.needsUpdate = true;
    scarfGeo.computeVertexNormals();
    scarfGeo.computeBoundingSphere();
    knot.rotation.z = Math.sin(time * 2.2) * 0.06;

    // 记录喉囊位置（主循环判定吃鱼用）
    pouchMesh.getWorldPosition(pouchWorld);

  }

  function triggerGulp() {
    gulp = 1;
    pouchVel += 2.4;
  }

  function triggerBell() {
    bellPulse = 1;
  }

  function reset() {
    crankAngle = 0;
    wheelAngle = 0;
    pouchSpring = 0;
    pouchVel = 0;
    pouchTarget = 0;
    blinkTimer = 2;
    gulp = 0;
    lookAt.set(0, 0);
    lookSmooth.set(0, 0);
  }

  return {
    root,
    shadow,
    glowTex,
    update,
    reset,
    triggerGulp,
    triggerBell,
    pouchWorld,
    setLook(v) { lookAt.copy(v); },
    get pouchFill() { return pouchSpring; },
    materials: M,
  };
}

export { buildRig, COLORS };
