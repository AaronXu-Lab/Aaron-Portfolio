import * as THREE from './vendor/three.module.min.js';

/* 喉囊快递 · Pouch Express
   鹈鹕骑车沿海岸兜鱼，经过雏鸟站自动投喂。
   世界是跑步机：骑手固定在 z=0，场景以 speed 向 +z 流动。 */

const ID = 'opus-5-5-high-pelican-run-01';
const store = {
  get(k, d) { try { const v = localStorage.getItem(`${ID}:${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`${ID}:${k}`, JSON.stringify(v)); } catch { /* 隐私模式 */ } },
};
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const mod = (a, n) => ((a % n) + n) % n;
const smooth = (t) => t * t * (3 - 2 * t);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 38, 170);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.2);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 50 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);

/* ---------------- materials & geometry ---------------- */
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, flatShading: true, ...opts }));
  return matCache.get(key);
}
const soft = (color, opts) => mat(color, { flatShading: false, ...opts });

const G = {
  sphere: new THREE.SphereGeometry(1, 18, 12),
  low: new THREE.SphereGeometry(1, 9, 6),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dodec: new THREE.DodecahedronGeometry(1, 0),
  rod: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cone3: new THREE.ConeGeometry(1, 1, 3),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  prism: new THREE.CylinderGeometry(1, 1, 1, 3),
};

function add(parent, geo, material, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], shadow = true) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(p[0], p[1], p[2]);
  o.scale.set(s[0], s[1], s[2]);
  o.rotation.set(r[0], r[1], r[2]);
  o.castShadow = shadow;
  parent.add(o);
  return o;
}

const UP = V(0, 1, 0);
const _a = V(), _b = V(), _d = V(), _p = V(), _x = V(), _y = V(), _z = V();
const _m4 = new THREE.Matrix4();

/** 静态圆杆：从 a 到 b */
function rod(parent, a, b, r, material, shadow = true) {
  const o = add(parent, G.rod, material, [0, 0, 0], [r, 1, r], [0, 0, 0], shadow);
  _d.subVectors(b, a);
  const len = _d.length();
  o.position.copy(a);
  o.scale.y = len;
  o.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  return o;
}

/** 让 group 的 +y 指向 b；hint 决定绕轴扭转，避免四元数翻转 */
function aim(g, a, b, hint) {
  g.position.copy(a);
  _y.subVectors(b, a).normalize();
  _z.crossVectors(hint, _y);
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
  _z.normalize();
  _x.crossVectors(_y, _z);
  _m4.makeBasis(_x, _y, _z);
  g.quaternion.setFromRotationMatrix(_m4);
}

/** 两段 IK：返回关节位置 */
function ik(a, t, l1, l2, pole, out) {
  _d.subVectors(t, a);
  const d = clamp(_d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  _d.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
  return out.copy(a).addScaledVector(_d, x).addScaledVector(_p, h);
}

function limb(parent, len, rx, rz, material) {
  const g = new THREE.Group();
  add(g, G.sphere, material, [0, len / 2, 0], [rx, len / 2 + Math.min(rx, rz) * 0.5, rz]);
  parent.add(g);
  return g;
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = radialTexture([[0, 1], [0.25, 0.55], [0.6, 0.12], [1, 0]]);
const poolTex = radialTexture([[0, 0.9], [0.5, 0.35], [1, 0]]);
const glowMat = (color, opacity = 1) => new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });

/* ---------------- palette ---------------- */
const C = {
  feather: 0xfbf7f0, featherShade: 0xe6ddd0, wingTip: 0x2d2c36, beak: 0xffb238, pouch: 0xff8f63, hook: 0xe0503a,
  leg: 0xff9433, eye: 0x17171f, eyeRing: 0xffe58a, cap: 0xe8453c, scarf: 0xe8453c,
  frame: 0x1fa39a, tire: 0x25252b, metal: 0xc8ced6, dark: 0x3a3d48, saddle: 0x6b3b2a, flag: 0xff7a1a,
  road: 0x6f7383, line: 0xf6f1e6, dash: 0xffd36b, walk: 0xe7ddcc, wall: 0xb8a992, grass: 0x8cc269, wood: 0x9a6a45,
};
const featherM = soft(C.feather, { roughness: 0.9 });
const shadeM = soft(C.featherShade, { roughness: 0.9 });
const tipM = soft(C.wingTip, { roughness: 0.7 });
const beakM = soft(C.beak, { roughness: 0.5 });
const pouchM = soft(C.pouch, { roughness: 0.45 });
const hookM = soft(C.hook, { roughness: 0.5 });
const legM = soft(C.leg, { roughness: 0.55 });
const frameM = soft(C.frame, { roughness: 0.3, metalness: 0.35 });
const metalM = soft(C.metal, { roughness: 0.25, metalness: 0.8 });
const tireM = soft(C.tire, { roughness: 0.95 });
const darkM = soft(C.dark, { roughness: 0.6 });
const nightGlowMats = []; // 夜间发光：emissiveIntensity 随夜色变化
function nightMat(color, emissive) {
  const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, roughness: 0.5, flatShading: true });
  nightGlowMats.push(m);
  return m;
}

/* =================================================================
   Rig：自行车 + 鹈鹕（全部挂在 rig 下，单位：米，前方 = -z）
   ================================================================= */
const rig = new THREE.Group();
scene.add(rig);
const WR = 0.36; // 车轮半径
const P = {
  R: V(0, WR, 0.56), F: V(0, WR, -0.56), BB: V(0, 0.3, 0.1),
  S: V(0, 0.8, 0.2), H: V(0, 0.88, -0.36), Hb: V(0, 0.68, -0.42),
};

function buildWheel(parent, pos) {
  const pivot = new THREE.Group();
  pivot.position.copy(pos);
  parent.add(pivot);
  const spin = new THREE.Group();
  pivot.add(spin);
  add(spin, new THREE.TorusGeometry(WR - 0.032, 0.034, 8, 30), tireM, [0, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
  add(spin, new THREE.TorusGeometry(WR - 0.07, 0.012, 6, 30), metalM, [0, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 8; i++) add(spin, G.box, metalM, [0, 0, 0], [0.005, (WR - 0.07) * 2, 0.005], [(i * Math.PI) / 8, 0, 0], false);
  add(spin, G.cyl, metalM, [0, 0, 0], [0.035, 0.11, 0.035], [0, 0, Math.PI / 2]);
  // 反光片：旋转时一闪一闪
  add(spin, G.box, soft(0xffa630, { emissive: 0xff7a00, emissiveIntensity: 0.4 }), [0.012, WR - 0.14, 0], [0.01, 0.06, 0.02], [0, 0, 0], false);
  return spin;
}

const rearSpin = buildWheel(rig, P.R);
// 车架
rod(rig, P.BB, P.S, 0.024, frameM);
rod(rig, P.S, P.H, 0.021, frameM);
rod(rig, P.BB, P.Hb, 0.026, frameM);
rod(rig, P.Hb, P.H, 0.03, frameM);
for (const s of [-1, 1]) {
  rod(rig, V(s * 0.03, P.BB.y, P.BB.z), V(s * 0.055, WR, P.R.z), 0.013, frameM);
  rod(rig, V(s * 0.025, P.S.y - 0.02, P.S.z), V(s * 0.055, WR, P.R.z), 0.012, frameM);
}
rod(rig, P.S, V(0, 0.95, 0.25), 0.015, metalM);
add(rig, G.sphere, soft(C.saddle, { roughness: 0.6 }), [0, 0.975, 0.26], [0.075, 0.03, 0.15], [0.08, 0, 0]);
// 后挡泥板 + 货架 + 安全旗
add(rig, new THREE.TorusGeometry(WR + 0.03, 0.022, 4, 16, Math.PI * 0.65), frameM, [0, WR, P.R.z], [1, 1, 1.6], [0, Math.PI / 2, Math.PI * 0.4]);
for (const s of [-1, 1]) rod(rig, V(s * 0.06, WR, P.R.z), V(s * 0.08, 0.66, 0.62), 0.01, metalM);
add(rig, G.box, darkM, [0, 0.67, 0.62], [0.2, 0.025, 0.34]);
const crate = add(rig, G.box, soft(0xd79b5b, { roughness: 0.8 }), [0, 0.78, 0.63], [0.26, 0.2, 0.28]);
add(crate, G.box, soft(0x9a6a45), [0, 0.3, 0], [1.04, 0.2, 1.04]);
rod(rig, V(0.08, 0.68, 0.76), V(0.1, 2.2, 0.86), 0.007, darkM);
const flag = new THREE.Group();
flag.position.set(0.1, 2.2, 0.86);
rig.add(flag);
{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.24, 0, 0, -0.1, 0.36], 3));
  g.computeVertexNormals();
  add(flag, g, soft(C.flag, { side: THREE.DoubleSide, roughness: 0.6 }));
}
// 链轮 / 链条 / 飞轮
add(rig, new THREE.TorusGeometry(0.1, 0.012, 5, 20), metalM, [0.07, P.BB.y, P.BB.z], [1, 1, 1], [0, Math.PI / 2, 0]);
add(rig, G.cyl, metalM, [0.06, WR, P.R.z], [0.05, 0.02, 0.05], [0, 0, Math.PI / 2]);
rod(rig, V(0.07, P.BB.y + 0.1, P.BB.z), V(0.065, WR + 0.05, P.R.z), 0.006, darkM, false);
rod(rig, V(0.07, P.BB.y - 0.1, P.BB.z), V(0.065, WR - 0.05, P.R.z), 0.006, darkM, false);
// 曲柄（旋转）与脚踏（保持水平，逐帧定位）
const crankG = new THREE.Group();
crankG.position.copy(P.BB);
rig.add(crankG);
rod(crankG, V(0.09, 0, 0), V(0.09, 0.17, 0), 0.014, metalM);
rod(crankG, V(-0.09, 0, 0), V(-0.09, -0.17, 0), 0.014, metalM);
add(crankG, G.cyl, metalM, [0, 0, 0], [0.03, 0.2, 0.03], [0, 0, Math.PI / 2]);
const pedals = [1, -1].map(() => add(rig, G.box, darkM, [0, 0, 0], [0.1, 0.022, 0.07]));

// 车把组（转向）
const fork = new THREE.Group();
fork.position.copy(P.Hb);
rig.add(fork);
{
  const fz = P.F.clone().sub(P.Hb);
  for (const s of [-1, 1]) rod(fork, V(s * 0.045, 0.02, 0), V(s * 0.05, fz.y, fz.z), 0.013, frameM);
  add(fork, new THREE.TorusGeometry(WR + 0.03, 0.02, 4, 14, Math.PI * 0.55), frameM, [0, fz.y, fz.z], [1, 1, 1.6], [0, Math.PI / 2, -Math.PI * 0.05]);
  fork.userData.wheel = buildWheel(fork, fz);
  rod(fork, V(0, 0.2, 0.06), V(0, 0.31, 0.03), 0.017, metalM);
  rod(fork, V(-0.25, 0.31, 0.04), V(0.25, 0.31, 0.04), 0.013, metalM);
  for (const s of [-1, 1]) rod(fork, V(s * 0.2, 0.31, 0.04), V(s * 0.28, 0.31, 0.05), 0.021, darkM);
  // 车铃
  const bell = new THREE.Group();
  bell.position.set(0.13, 0.33, 0.03);
  fork.add(bell);
  add(bell, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), soft(0xffd24a, { metalness: 0.7, roughness: 0.25 }), [0, 0, 0], [0.035, 0.03, 0.035]);
  fork.userData.bell = bell;
  // 车灯
  const lamp = add(fork, G.cyl, nightMat(0xfff4d0, 0xfff1b8), [0, 0.13, -0.05], [0.045, 0.06, 0.045], [Math.PI / 2, 0, 0]);
  add(lamp, G.cyl, darkM, [0, 0.35, 0], [1.15, 0.7, 1.15], [0, 0, 0], false);
  // 前车筐
  const basket = add(fork, G.box, soft(0xc98a4b, { roughness: 0.9 }), [0, 0.22, -0.2], [0.3, 0.18, 0.2]);
  basket.userData.front = true;
  add(basket, G.box, soft(0x9a6a45), [0, 0.45, 0], [1.06, 0.12, 1.06]);
}

// 车灯光斑（夜间）
const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.5), new THREE.MeshBasicMaterial({ map: poolTex, color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
beam.rotation.x = -Math.PI / 2;
beam.position.set(0, 0.03, -3.8);
rig.add(beam);

/* ---------------- 鹈鹕 ---------------- */
const torso = new THREE.Group();
rig.add(torso);
add(torso, G.sphere, featherM, [0, 0.24, -0.01], [0.26, 0.33, 0.3]);
add(torso, G.sphere, featherM, [0, 0.36, -0.13], [0.2, 0.2, 0.18]);
for (const s of [-1, 1]) add(torso, G.sphere, shadeM, [s * 0.19, 0.3, 0.06], [0.1, 0.21, 0.26], [0.25, 0, s * 0.12]);
add(torso, G.cone, shadeM, [0, 0.08, 0.3], [0.13, 0.22, 0.05], [Math.PI / 2 + 0.5, 0, 0]);
add(torso, G.cone, tipM, [0, 0.03, 0.4], [0.07, 0.1, 0.03], [Math.PI / 2 + 0.5, 0, 0]);
{
  const curve = new THREE.CatmullRomCurve3([V(0, 0.4, -0.08), V(0, 0.56, -0.19), V(0, 0.7, -0.13), V(0, 0.84, -0.2)]);
  add(torso, new THREE.TubeGeometry(curve, 20, 0.066, 10), featherM);
}
add(torso, new THREE.TorusGeometry(0.09, 0.032, 8, 16), soft(C.scarf, { roughness: 0.8 }), [0, 0.5, -0.16], [1, 1, 1], [Math.PI / 2 - 0.3, 0, 0]);
// 围巾尾巴：链式节段，逐帧摆动
const scarf = [];
{
  let parent = new THREE.Group();
  parent.position.set(0.04, 0.5, -0.06);
  torso.add(parent);
  const sm = soft(C.scarf, { roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    if (i) seg.position.y = 0.075;
    add(seg, G.box, sm, [0, 0.04, 0], [0.07 - i * 0.005, 0.08, 0.015]);
    parent.add(seg);
    scarf.push(seg);
    parent = seg;
  }
}

// 头
const head = new THREE.Group();
head.position.set(0, 0.84, -0.2);
torso.add(head);
add(head, G.sphere, featherM, [0, 0.05, 0], [0.11, 0.105, 0.13]);
const eyes = [];
for (const s of [-1, 1]) {
  const e = new THREE.Group();
  e.position.set(s * 0.078, 0.075, -0.045);
  head.add(e);
  add(e, G.low, soft(C.eyeRing, { roughness: 0.4 }), [0, 0, 0], [0.026, 0.028, 0.028], [0, 0, 0], false);
  add(e, G.low, soft(C.eye, { roughness: 0.2 }), [s * 0.012, 0.002, -0.01], [0.015, 0.017, 0.016], [0, 0, 0], false);
  add(e, G.low, soft(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), [s * 0.02, 0.01, -0.02], [0.005, 0.005, 0.005], [0, 0, 0], false);
  eyes.push(e);
}
// 骑行帽
add(head, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), soft(C.cap, { roughness: 0.6 }), [0, 0.1, 0.01], [0.118, 0.085, 0.132], [0.12, 0, 0]);
add(head, G.sphere, soft(0xffffff), [0, 0.105, 0.012], [0.12, 0.012, 0.134], [0.12, 0, 0], false);
add(head, G.sphere, soft(C.cap, { roughness: 0.6 }), [0, 0.112, -0.115], [0.085, 0.011, 0.07], [-0.1, 0, 0]);
const crest = add(head, G.cone, featherM, [0, 0.12, 0.13], [0.035, 0.12, 0.02], [-1.1, 0, 0]);
// 喙与喉囊
const beak = new THREE.Group();
beak.position.set(0, 0.03, -0.1);
head.add(beak);
add(beak, new THREE.CylinderGeometry(0.02, 0.05, 1, 10), beakM, [0, 0, -0.24], [1.15, 0.48, 0.5], [-Math.PI / 2, 0, 0]);
add(beak, G.sphere, hookM, [0, -0.012, -0.475], [0.022, 0.024, 0.032]);
const jaw = new THREE.Group();
jaw.position.set(0, -0.012, 0);
beak.add(jaw);
add(jaw, new THREE.CylinderGeometry(0.014, 0.04, 1, 8), beakM, [0, -0.008, -0.23], [1.1, 0.45, 0.35], [-Math.PI / 2, 0, 0]);
const pouchMesh = add(jaw, G.sphere, pouchM, [0, -0.03, -0.2], [0.042, 0.035, 0.2]);

// 四肢（rig 空间，逐帧 IK）
const LEG1 = 0.45, LEG2 = 0.43, ARM1 = 0.32, ARM2 = 0.34;
const legs = [1, -1].map((s) => {
  const thigh = limb(rig, LEG1, 0.075, 0.085, featherM);
  const shin = limb(rig, LEG2, 0.024, 0.024, legM);
  const foot = new THREE.Group();
  rig.add(foot);
  add(foot, G.cone3, legM, [0, -0.03, -0.07], [0.075, 0.16, 0.02], [Math.PI / 2, 0, 0]);
  add(foot, G.low, legM, [0, 0, 0], [0.03, 0.03, 0.03]);
  return { s, thigh, shin, foot, knee: V(), hip: V(), ankle: V(), pedal: V() };
});
const wings = [1, -1].map((s) => {
  const upper = limb(rig, ARM1, 0.1, 0.05, featherM);
  const fore = limb(rig, ARM2, 0.09, 0.042, featherM);
  // 初级飞羽：黑色翼尖，展开时像手指
  const tips = [];
  for (let i = 0; i < 3; i++) {
    tips.push(add(fore, G.sphere, tipM, [(i - 1) * 0.035, ARM2 * 0.95 + i * 0.01, 0], [0.028, 0.13 - i * 0.015, 0.018], [0, 0, (i - 1) * 0.25]));
  }
  return { s, upper, fore, tips, elbow: V(), shoulder: V(), grip: V(), target: V() };
});

/* =================================================================
   环境
   ================================================================= */
const ROAD_HALF = 3;
const LIM = 2.35; // 可骑行横向范围
// 路面
add(scene, G.box, mat(C.road, { roughness: 0.95 }), [0, -0.05, -80], [ROAD_HALF * 2, 0.1, 230], [0, 0, 0], false).receiveShadow = true;
for (const s of [-1, 1]) add(scene, G.box, mat(C.line), [s * (ROAD_HALF - 0.18), 0.005, -80], [0.1, 0.01, 230], [0, 0, 0], false).receiveShadow = true;
// 海堤步道 + 堤面
add(scene, G.box, mat(C.walk), [-3.45, 0.04, -80], [0.9, 0.16, 230], [0, 0, 0], false).receiveShadow = true;
add(scene, G.box, mat(C.wall), [-3.95, -0.8, -80], [0.2, 1.8, 230], [0, 0, 0], false);
add(scene, G.box, mat(0xffffff, { roughness: 0.5 }), [-3.78, 0.95, -80], [0.05, 0.05, 230], [0, 0, 0], false);
add(scene, G.box, mat(0xffffff, { roughness: 0.5 }), [-3.78, 0.55, -80], [0.035, 0.035, 230], [0, 0, 0], false);
// 草地 + 路缘
add(scene, G.box, mat(C.grass, { roughness: 1 }), [63, -0.08, -80], [120, 0.1, 230], [0, 0, 0], false).receiveShadow = true;
add(scene, G.box, mat(0xd9d2c3), [3.1, 0.03, -80], [0.22, 0.12, 230], [0, 0, 0], false);

// 实例化：中心虚线、栏杆立柱
const dummy = new THREE.Object3D();
function instanced(geo, material, count) {
  const m = new THREE.InstancedMesh(geo, material, count);
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
const dashes = instanced(G.box, mat(C.dash, { roughness: 0.7 }), 36);
const posts = instanced(G.box, mat(0xffffff, { roughness: 0.5 }), 72);
function placeInstances(mesh, count, spacing, x, y, sx, sy, sz, dist) {
  const span = count * spacing;
  for (let i = 0; i < count; i++) {
    dummy.position.set(x, y, 15 - span + mod(i * spacing + dist, span));
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

// 海面：低多边形波浪（CPU 顶点动画，flatShading 出棱面反光）
const seaGeo = new THREE.PlaneGeometry(380, 320, 64, 56);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = seaGeo.attributes.position.array.slice();
const seaM = new THREE.MeshStandardMaterial({ color: 0x1f9fb4, roughness: 0.28, metalness: 0.15, flatShading: true });
const sea = new THREE.Mesh(seaGeo, seaM);
sea.position.set(-194, -1.25, -120);
sea.receiveShadow = true;
scene.add(sea);
function updateSea(t, dist) {
  const pos = seaGeo.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    const x = seaBase[i] + sea.position.x;
    const z = seaBase[i + 2] + sea.position.z - dist;
    const near = clamp((x + 4) / -30 + 1, 0, 1); // 靠岸处浪略大
    pos[i + 1] = Math.sin(x * 0.32 + t * 1.1 + z * 0.18) * 0.2
      + Math.sin(z * 0.45 - t * 1.7) * 0.13
      + Math.sin((x + z) * 1.1 + t * 2.3) * 0.05 * (1 + near);
  }
  seaGeo.attributes.position.needsUpdate = true;
}
// 堤脚浪花
const foam = add(scene, G.box, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, roughness: 0.4 }), [-4.2, -1.12, -80], [0.5, 0.08, 230], [0, 0, 0], false);

// 天空
const skyU = {
  top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
  sunDir: { value: V(0, 1, 0) }, sunCol: { value: new THREE.Color() }, disk: { value: 1 },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `
    uniform vec3 top, hor, bot, sunCol, sunDir; uniform float disk; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(hor, top, pow(clamp(h, 0., 1.), .55));
      col = mix(col, bot, smoothstep(0., -.25, h));
      float s = max(dot(d, normalize(sunDir)), 0.);
      col += sunCol * (smoothstep(.9994 - .0006 * disk, .9997, s) * 2.2 + pow(s, 14.) * .32 * disk + pow(s, 3.) * .08);
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -1;
scene.add(sky);
// 星空
const stars = (() => {
  const n = 500, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.acos(rand(0.05, 1));
    arr.set([Math.sin(v) * Math.cos(u) * 420, Math.cos(v) * 420, Math.sin(v) * Math.sin(u) * 420], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(p);
  return p;
})();

// 远山剪影（不雾化，颜色跟随天色）
const mountainM = new THREE.MeshBasicMaterial({ color: 0x8899bb, fog: false });
const mountains = new THREE.Group();
[[70, -340, 80, 30], [150, -300, 90, 44], [240, -250, 70, 34], [330, -170, 80, 38], [-160, -390, 70, 14], [20, -400, 100, 20]].forEach(([x, z, r, h]) => {
  add(mountains, G.ico, mountainM, [x, -4, z], [r, h, r * 0.8], [0, rand(0, 3), 0], false);
});
scene.add(mountains);

// 云
const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, fog: false, emissive: 0xffffff, emissiveIntensity: 0.15 });
const clouds = [];
for (let i = 0; i < 11; i++) {
  const c = new THREE.Group();
  const n = 3 + ((Math.random() * 3) | 0);
  for (let j = 0; j < n; j++) add(c, G.ico1, cloudM, [j * 5 - n * 2.5, rand(-1, 2), rand(-2, 2)], [rand(4, 7), rand(3, 5), rand(3.5, 5)], [0, 0, 0], false);
  c.position.set(rand(-260, 260), rand(38, 70), rand(-400, 0));
  c.scale.setScalar(rand(0.8, 1.5));
  scene.add(c);
  clouds.push(c);
}

// 空中海鸥（装饰）
const skyBirds = [];
function buildGullShape(parent, scale = 1) {
  const g = new THREE.Group();
  add(g, G.sphere, soft(0xffffff), [0, 0, 0], [0.12, 0.1, 0.3]);
  add(g, G.sphere, soft(0xffffff), [0, 0.07, -0.26], [0.08, 0.08, 0.09]);
  add(g, G.cone, beakM, [0, 0.06, -0.38], [0.02, 0.1, 0.02], [-Math.PI / 2, 0, 0]);
  add(g, G.cone3, soft(0xb9c0cc), [0, 0.02, 0.33], [0.1, 0.18, 0.02], [Math.PI / 2, 0, 0]);
  const wl = new THREE.Group(), wr = new THREE.Group();
  add(wl, G.sphere, soft(0xb9c0cc), [-0.35, 0, 0], [0.36, 0.02, 0.12]);
  add(wl, G.sphere, tipM, [-0.66, 0, 0.02], [0.08, 0.021, 0.08]);
  add(wr, G.sphere, soft(0xb9c0cc), [0.35, 0, 0], [0.36, 0.02, 0.12]);
  add(wr, G.sphere, tipM, [0.66, 0, 0.02], [0.08, 0.021, 0.08]);
  g.add(wl, wr);
  g.userData = { wl, wr };
  g.scale.setScalar(scale);
  parent.add(g);
  return g;
}
for (let i = 0; i < 5; i++) {
  const b = buildGullShape(scene, rand(1.4, 2));
  b.userData.orbit = { cx: rand(-40, -10), cz: rand(-80, -30), y: rand(12, 22), r: rand(6, 14), w: rand(0.25, 0.45) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, 6.28) };
  skyBirds.push(b);
}

/* ---------------- 路灯（间距固定、公式定位） ---------------- */
const lampPoolM = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffc97a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const lampGlowM = glowMat(0xffd08a, 0);
const bulbM = nightMat(0xfff3d6, 0xffcf7a);
const lamps = [];
for (let i = 0; i < 13; i++) {
  const g = new THREE.Group();
  const poleM = mat(0x2f3b52, { roughness: 0.4, metalness: 0.4 });
  rod(g, V(0, 0, 0), V(0, 3.4, 0), 0.05, poleM, false);
  rod(g, V(0, 3.35, 0), V(-0.7, 3.5, 0), 0.035, poleM, false);
  add(g, G.cone, poleM, [-0.72, 3.45, 0], [0.18, 0.16, 0.18], [0, 0, 0], false);
  add(g, G.low, bulbM, [-0.72, 3.36, 0], [0.09, 0.06, 0.09], [0, 0, 0], false);
  const glow = new THREE.Sprite(lampGlowM);
  glow.position.set(-0.72, 3.3, 0);
  glow.scale.setScalar(2.4);
  g.add(glow);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), lampPoolM);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-1.1, 0.02, 0);
  g.add(pool);
  // 彩旗绳：挂在相邻路灯之间
  scene.add(g);
  lamps.push(g);
}

/* ---------------- 布景道具池（循环） ---------------- */
const props = [];
const greens = [0x6fb35a, 0x88c464, 0x5a9e52, 0x9ccf6a];
const pastels = [0xf4b6a0, 0xf6d99a, 0xa8d8d0, 0xc9b7e8, 0xf2a2a2, 0xffffff];
const windowM = nightMat(0x5a6a88, 0xffc56a);
const builders = {
  tree() {
    const g = new THREE.Group();
    rod(g, V(0, 0, 0), V(0, 1.6, 0), 0.12, mat(0x8a5a3c), false);
    const m = mat(pick(greens));
    add(g, G.ico1, m, [0, 2.2, 0], [1.1, 1, 1.1], [0, 0, 0], false);
    add(g, G.ico1, m, [0.5, 1.8, 0.3], [0.7, 0.6, 0.7], [0, 0, 0], false);
    return g;
  },
  pine() {
    const g = new THREE.Group();
    rod(g, V(0, 0, 0), V(0, 0.8, 0), 0.1, mat(0x7a4f36), false);
    const m = mat(0x3f8a5a);
    for (let i = 0; i < 3; i++) add(g, G.cone, m, [0, 1.3 + i * 0.75, 0], [1 - i * 0.25, 1.4, 1 - i * 0.25], [0, i, 0], false);
    return g;
  },
  palm() {
    const g = new THREE.Group();
    const trunkM = mat(0xa9855f);
    let prev = V(0, 0, 0);
    for (let i = 1; i <= 5; i++) {
      const p = V(Math.sin(i * 0.35) * 0.35 * i * 0.3, i * 0.75, 0);
      rod(g, prev, p, 0.13 - i * 0.012, trunkM, false);
      prev = p;
    }
    const top = new THREE.Group();
    top.position.copy(prev);
    g.add(top);
    const leafM = mat(0x4fa35a);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Group();
      leaf.rotation.set(0, (i / 7) * Math.PI * 2, 0);
      add(leaf, G.sphere, leafM, [1.1, -0.25, 0], [1.2, 0.05, 0.28], [0, 0, -0.35], false);
      top.add(leaf);
    }
    add(top, G.low, mat(0x6b4a2a), [0.15, -0.15, 0.1], [0.13, 0.13, 0.13], [0, 0, 0], false);
    g.userData.sway = top;
    return g;
  },
  house() {
    const g = new THREE.Group();
    const w = rand(2.4, 3.6), d = rand(2.4, 3.2), h = rand(1.8, 2.6);
    add(g, G.box, mat(pick(pastels)), [0, h / 2, 0], [w, h, d], [0, 0, 0], false);
    add(g, G.prism, mat(pick([0xd9614c, 0x4d6f9a, 0x6b7a5a, 0xc7845a])), [0, h + 0.55, 0], [(w / 2 + 0.2) / 0.866, d + 0.3, 1.1], [-Math.PI / 2, 0, 0], false);
    add(g, G.box, mat(0x6b4a3a), [-w / 2 - 0.01, 0.55, 0], [0.04, 1.1, 0.6], [0, 0, 0], false);
    for (const z of [-d / 4 - 0.3, d / 4 + 0.3]) add(g, G.box, windowM, [-w / 2 - 0.02, h * 0.62, z], [0.04, 0.5, 0.5], [0, 0, 0], false);
    add(g, G.box, mat(0xffffff), [-w / 2 - 0.3, 0.3, 0], [0.04, 0.6, d + 0.6], [0, 0, 0], false);
    return g;
  },
  bush() {
    const g = new THREE.Group();
    const m = mat(pick(greens));
    for (let i = 0; i < 3; i++) add(g, G.ico1, m, [i * 0.45 - 0.45, 0.3, rand(-0.2, 0.2)], [0.45, 0.4, 0.45], [0, 0, 0], false);
    const fm = mat(pick([0xff8fa3, 0xffd35a, 0xffffff, 0xc59cff]));
    for (let i = 0; i < 4; i++) add(g, G.low, fm, [rand(-0.8, 0.8), rand(0.45, 0.7), rand(-0.3, 0.3)], [0.07, 0.07, 0.07], [0, 0, 0], false);
    return g;
  },
  rock() {
    const g = new THREE.Group();
    add(g, G.dodec, mat(0x9aa0a8), [0, 0.2, 0], [0.8, 0.6, 0.7], [rand(0, 3), rand(0, 3), 0], false);
    add(g, G.dodec, mat(0x868c96), [0.7, 0.1, 0.2], [0.4, 0.35, 0.4], [rand(0, 3), 0, 0], false);
    return g;
  },
  seaRock() {
    const g = new THREE.Group();
    add(g, G.dodec, mat(0x7d828c), [0, -0.9, 0], [1.2, 1, 1], [rand(0, 3), rand(0, 3), 0], false);
    add(g, G.dodec, mat(0x6b707a), [0.9, -1.1, 0.4], [0.6, 0.5, 0.6], [rand(0, 3), 0, 0], false);
    return g;
  },
  buoy() {
    const g = new THREE.Group();
    add(g, G.cone, mat(0xe8453c), [0, -0.6, 0], [0.35, 0.9, 0.35], [0, 0, 0], false);
    add(g, G.box, mat(0xffffff), [0, -0.55, 0], [0.4, 0.14, 0.4], [0, 0, 0], false);
    add(g, G.low, nightMat(0xffe39a, 0xff9a3a), [0, -0.1, 0], [0.08, 0.08, 0.08], [0, 0, 0], false);
    g.userData.bob = true;
    return g;
  },
  boat() {
    const g = new THREE.Group();
    add(g, G.box, mat(pick([0xffffff, 0x2f6f9a, 0xe8453c])), [0, -1.05, 0], [1.1, 0.45, 3.2], [0, 0, 0], false);
    add(g, G.prism, mat(0xffffff), [0, -0.9, -1.8], [0.55, 0.45, 0.8], [Math.PI / 2, 0, 0], false);
    rod(g, V(0, -0.9, 0), V(0, 3.4, 0), 0.05, mat(0x6b4a2a), false);
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.3, 0, 0, -0.5, 0, 0, -0.5, 1.9, 0, 3.3, 0, 0, -0.5, 0, 0, -0.5, -1.4], 3));
    sailGeo.computeVertexNormals();
    add(g, sailGeo, mat(0xfff7ea, { side: THREE.DoubleSide }), [0.02, 0, 0], [1, 1, 1], [0, 0, 0], false);
    g.userData.bob = true;
    return g;
  },
  lighthouse() {
    const g = new THREE.Group();
    add(g, G.ico, mat(0x8f8a7a), [0, -1.8, 0], [7, 2.5, 6], [0, 0.5, 0], false);
    add(g, G.ico, mat(0x7da35c), [0, -0.3, 0], [5, 0.6, 4.5], [0, 0.3, 0], false);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const r0 = 1.1 - i * 0.12;
      add(g, new THREE.CylinderGeometry(r0 - 0.12, r0, 1.6, 12), mat(i % 2 ? 0xe8453c : 0xffffff), [0, i * 1.6 + 0.8, 0], [1, 1, 1], [0, 0, 0], false);
    }
    add(g, G.cyl, windowM, [0, 8.6, 0], [0.55, 0.9, 0.55], [0, 0, 0], false);
    add(g, G.cone, mat(0x2f3b52), [0, 9.45, 0], [0.75, 0.8, 0.75], [0, 0, 0], false);
    const beamG = new THREE.Group();
    beamG.position.set(0, 8.6, 0);
    const bm = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    add(beamG, new THREE.ConeGeometry(2.2, 34, 16, 1, true), bm, [0, 0, -17], [1, 1, 0.45], [Math.PI / 2, 0, 0], false);
    g.add(beamG);
    g.userData = { beam: beamG, beamM: bm };
    return g;
  },
};

const placeLand = (near, far) => (o) => { o.position.x = rand(near, far); o.position.y = 0; o.rotation.y = rand(0, Math.PI * 2); o.scale.setScalar(rand(0.8, 1.25)); };
function addProps(kind, count, span, place) {
  for (let i = 0; i < count; i++) {
    const o = builders[kind]();
    place(o);
    o.position.z = 15 - rand(0, span);
    scene.add(o);
    props.push({ o, span, place, kind });
  }
}
addProps('palm', 10, 200, placeLand(3.8, 7));
addProps('tree', 12, 200, placeLand(7, 30));
addProps('pine', 7, 200, placeLand(14, 40));
addProps('bush', 12, 200, placeLand(3.8, 12));
addProps('rock', 4, 200, placeLand(5, 20));
addProps('house', 7, 210, (o) => { o.position.x = rand(9, 26); o.rotation.y = rand(-0.4, 0.4); o.scale.setScalar(rand(0.9, 1.2)); });
addProps('seaRock', 6, 200, (o) => { o.position.x = rand(-5, -10); o.rotation.y = rand(0, 6.28); o.scale.setScalar(rand(0.6, 1.2)); });
addProps('buoy', 3, 200, (o) => { o.position.x = rand(-14, -26); o.position.y = 0; });
addProps('boat', 4, 360, (o) => { o.position.x = rand(-30, -90); o.position.y = 0; o.rotation.y = rand(-0.5, 0.5); o.scale.setScalar(rand(1, 1.6)); });
addProps('lighthouse', 1, 520, (o) => { o.position.x = rand(-40, -55); o.position.y = 0; });
props.filter((p) => p.kind === 'lighthouse').forEach((p) => { p.o.position.z = -120; });

/* =================================================================
   路面道具：鱼 / 金鱼 / 螃蟹 / 海鸥 / 路锥 / 水坑 / 跳台 / 雏鸟站
   ================================================================= */
const fishM = soft(0x8fd0f0, { metalness: 0.3, roughness: 0.3, emissive: 0x2a7aa0, emissiveIntensity: 0.45 });
const goldM = soft(0xffc53d, { metalness: 0.6, roughness: 0.25, emissive: 0xff9a00, emissiveIntensity: 0.35 });
function buildFish(gold, glow = true) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const m = gold ? goldM : fishM;
  add(body, G.sphere, m, [0, 0, 0], [0.075, 0.12, 0.22]);
  add(body, G.sphere, soft(gold ? 0xfff0b8 : 0xe9f4fa), [0, -0.035, -0.02], [0.06, 0.08, 0.18], [0, 0, 0], false);
  const tail = new THREE.Group();
  tail.position.set(0, 0, 0.2);
  body.add(tail);
  add(tail, G.cone3, m, [0, 0, 0.08], [0.12, 0.16, 0.025], [-Math.PI / 2, 0, 0]);
  add(body, G.cone3, m, [0, 0.12, 0.02], [0.02, 0.09, 0.07], [0, 0, 0], false);
  for (const s of [-1, 1]) add(body, G.low, soft(C.eye), [s * 0.055, 0.03, -0.13], [0.018, 0.018, 0.018], [0, 0, 0], false);
  if (glow) {
    const sp = new THREE.Sprite(glowMat(gold ? 0xffc040 : 0x9fe6ff, gold ? 0.9 : 0.55));
    sp.scale.setScalar(gold ? 1.3 : 0.95);
    g.add(sp);
  }
  g.userData = { body, tail };
  return g;
}

const itemBuilders = {
  fish: () => buildFish(false),
  gold: () => buildFish(true),
  crab() {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const red = soft(0xe5553b, { roughness: 0.5 });
    add(body, G.sphere, red, [0, 0.2, 0], [0.24, 0.1, 0.18]);
    for (const s of [-1, 1]) {
      rod(body, V(s * 0.06, 0.25, -0.1), V(s * 0.08, 0.36, -0.12), 0.012, red);
      add(body, G.low, soft(0xffffff), [s * 0.08, 0.37, -0.12], [0.03, 0.03, 0.03]);
      add(body, G.low, soft(C.eye), [s * 0.08, 0.375, -0.145], [0.015, 0.015, 0.015], [0, 0, 0], false);
      rod(body, V(s * 0.18, 0.2, -0.08), V(s * 0.3, 0.26, -0.2), 0.022, red);
      add(body, G.sphere, red, [s * 0.32, 0.28, -0.24], [0.08, 0.06, 0.09]);
      for (let i = 0; i < 3; i++) rod(body, V(s * 0.18, 0.18, (i - 1) * 0.08), V(s * 0.34, 0.02, (i - 1) * 0.12), 0.011, red, false);
    }
    g.userData = { body };
    return g;
  },
  gull() {
    const g = new THREE.Group();
    const bird = buildGullShape(g, 1.1);
    bird.position.y = 0.45;
    for (const s of [-1, 1]) rod(g, V(s * 0.05, 0, 0), V(s * 0.05, 0.38, 0), 0.012, legM, false);
    bird.userData.wl.rotation.z = -1.2;
    bird.userData.wr.rotation.z = 1.2;
    g.userData = { bird };
    return g;
  },
  cone() {
    const g = new THREE.Group();
    add(g, G.box, soft(0xff6a1a), [0, 0.02, 0], [0.42, 0.04, 0.42]);
    add(g, new THREE.ConeGeometry(0.16, 0.56, 12), soft(0xff6a1a, { roughness: 0.5 }), [0, 0.3, 0]);
    add(g, new THREE.CylinderGeometry(0.085, 0.11, 0.1, 12), soft(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.1 }), [0, 0.28, 0], [1, 1, 1], [0, 0, 0], false);
    return g;
  },
  puddle() {
    const g = new THREE.Group();
    add(g, new THREE.CircleGeometry(1, 20), new THREE.MeshStandardMaterial({ color: 0x5ab4d6, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.8 }), [0, 0.012, 0], [0.9, 1.3, 1], [-Math.PI / 2, 0, 0], false).receiveShadow = true;
    return g;
  },
  ramp() {
    const g = new THREE.Group();
    const wood = mat(0xc98a4b);
    const deck = add(g, G.box, wood, [0, 0.3, 0], [1.5, 0.08, 2.4], [0.26, 0, 0]);
    deck.receiveShadow = true;
    for (let i = 0; i < 5; i++) add(deck, G.box, mat(0xa86f3a), [0, 0.6, -0.4 + i * 0.2], [1.02, 0.4, 0.02], [0, 0, 0], false);
    for (const s of [-1, 1]) add(g, G.box, mat(0x8a5a36), [s * 0.7, 0.28, -0.5], [0.08, 0.56, 0.08]);
    add(g, G.box, soft(0xffd36b, { emissive: 0xffb000, emissiveIntensity: 0.3 }), [0, 0.63, -1.16], [1.5, 0.04, 0.1], [0.26, 0, 0], false);
    return g;
  },
  station() {
    const g = new THREE.Group();
    const wood = mat(C.wood);
    for (const x of [-3.3, 3.3]) rod(g, V(x, 0, 0), V(x, 3.8, 0), 0.1, wood);
    add(g, G.box, wood, [0, 3.8, 0], [7.1, 0.22, 0.22]);
    // 招牌
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#fffaf0'; x.beginPath(); x.roundRect(6, 6, 500, 116, 26); x.fill();
    x.strokeStyle = '#e8453c'; x.lineWidth = 8; x.stroke();
    x.fillStyle = '#1d2433'; x.font = '700 58px -apple-system, "PingFang SC", "Noto Sans CJK SC", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('雏鸟喂食站', 256, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    sign.position.set(0, 3.35, 0.12);
    g.add(sign);
    // 彩旗
    const cols = [0xe8453c, 0xffd36b, 0x1fa39a, 0xffffff];
    for (let i = 0; i < 12; i++) {
      const px = -3.1 + i * 0.56;
      add(g, G.cone3, soft(cols[i % 4], { side: THREE.DoubleSide }), [px, 3.55 - Math.sin((i / 11) * Math.PI) * 0.12, 0.05], [0.16, 0.3, 0.01], [Math.PI, 0, 0], false);
    }
    // 海边的鸟巢平台
    const nest = new THREE.Group();
    nest.position.set(-5.3, 0, 0);
    g.add(nest);
    rod(nest, V(0, -1.4, 0), V(0, 0.9, 0), 0.14, wood);
    add(nest, G.cyl, wood, [0, 0.95, 0], [1, 0.12, 1]);
    add(nest, new THREE.TorusGeometry(0.62, 0.2, 6, 14), mat(0xb08a55), [0, 1.12, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    add(nest, G.cyl, mat(0x8f6a3a), [0, 1.05, 0], [0.55, 0.1, 0.55], [0, 0, 0], false);
    const chicks = [];
    for (let i = 0; i < 3; i++) {
      const ch = new THREE.Group();
      ch.position.set((i - 1) * 0.36, 1.1, (i % 2) * 0.15 - 0.05);
      add(ch, G.sphere, soft(0xd7d3cc, { roughness: 1 }), [0, 0.18, 0], [0.17, 0.2, 0.16]);
      const hd = new THREE.Group();
      hd.position.set(0, 0.42, 0);
      ch.add(hd);
      add(hd, G.sphere, soft(0xe6e2da, { roughness: 1 }), [0, 0, 0], [0.11, 0.11, 0.11]);
      for (const s of [-1, 1]) add(hd, G.low, soft(C.eye), [s * 0.06, 0.03, -0.08], [0.018, 0.018, 0.018], [0, 0, 0], false);
      const bk = add(hd, G.cone, beakM, [0, 0.08, -0.07], [0.035, 0.16, 0.035], [-0.5, 0, 0]);
      ch.userData = { hd, bk, jump: 0 };
      nest.add(ch);
      chicks.push(ch);
    }
    const halo = new THREE.Sprite(glowMat(0xffd36b, 0.5));
    halo.position.set(0, 1.5, 0);
    halo.scale.setScalar(3);
    nest.add(halo);
    g.userData = { nest, chicks };
    return g;
  },
};

const items = [];
const itemPools = {};
function spawn(kind, x, z, extra = {}) {
  const pool = (itemPools[kind] ||= []);
  let it = pool.pop();
  if (!it) {
    it = { kind, obj: itemBuilders[kind]() };
    scene.add(it.obj);
  }
  Object.assign(it, { x, y: 0, z, t: Math.random() * 10, done: false, dir: 1, flee: 0, vx: 0 }, extra);
  it.obj.visible = true;
  it.obj.position.set(x, it.y, z);
  it.obj.rotation.set(0, 0, 0);
  items.push(it);
  return it;
}
function despawn(i) {
  const it = items[i];
  it.obj.visible = false;
  itemPools[it.kind].push(it);
  items.splice(i, 1);
}

/* ---------------- 粒子 ---------------- */
const particles = [];
const partPools = {};
const partKinds = {
  feather: () => add(scene, G.sphere, featherM, [0, 0, 0], [0.05, 0.012, 0.13], [0, 0, 0], false),
  splash: () => add(scene, G.ico, new THREE.MeshStandardMaterial({ color: 0xcdefff, roughness: 0.2, transparent: true, opacity: 0.85 }), [0, 0, 0], [1, 1, 1], [0, 0, 0], false),
  dust: () => add(scene, G.ico, mat(0xd8cbb4), [0, 0, 0], [1, 1, 1], [0, 0, 0], false),
  spark: () => { const s = new THREE.Sprite(glowMat(0xffe08a, 1)); scene.add(s); return s; },
  fish: () => { const f = buildFish(false, false); f.scale.setScalar(0.8); scene.add(f); return f; },
};
function emit(kind, pos, n, { spread = 1, up = 2, size = 0.06, life = 0.8, grav = 9, vz = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const pool = (partPools[kind] ||= []);
    const o = pool.pop() || partKinds[kind]();
    o.visible = true;
    o.position.copy(pos);
    const sz = size * rand(0.7, 1.3);
    if (kind !== 'fish' && kind !== 'feather') o.scale.setScalar(sz);
    particles.push({
      kind, o, sz, life: life * rand(0.7, 1.2), age: 0, grav,
      v: V(rand(-spread, spread), up * rand(0.6, 1.2), rand(-spread, spread) + vz),
      spin: V(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
    });
  }
}
function updateParticles(dt, speed) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      p.o.visible = false;
      partPools[p.kind].push(p.o);
      particles.splice(i, 1);
      continue;
    }
    const drag = p.kind === 'feather' ? 3 : 0.4;
    p.v.y -= p.grav * dt;
    p.v.multiplyScalar(Math.exp(-drag * dt));
    p.o.position.addScaledVector(p.v, dt);
    p.o.position.z += speed * dt; // 随世界后退
    if (p.kind === 'feather') p.o.position.x += Math.sin(p.age * 9 + p.sz * 50) * dt * 0.8;
    p.o.rotation.x += p.spin.x * dt;
    p.o.rotation.y += p.spin.y * dt;
    const k = 1 - p.age / p.life;
    if (p.kind === 'spark') p.o.scale.setScalar(p.sz * (0.4 + k));
    else if (p.kind === 'splash' || p.kind === 'dust') p.o.scale.setScalar(p.sz * Math.min(1, k * 2));
    else if (p.kind === 'fish') p.o.scale.setScalar(0.8 * Math.min(1, k * 2.5));
  }
}

// 投喂飞鱼：从喙飞向雏鸟
const flyers = [];
function launchFeed(station, n) {
  for (let i = 0; i < n; i++) {
    const pool = (partPools.fish ||= []);
    const o = pool.pop() || partKinds.fish();
    o.visible = true;
    o.scale.setScalar(0.8);
    flyers.push({ o, station, chick: i % 3, delay: i * 0.09, t: 0, from: V() });
  }
}

/* =================================================================
   天色（关键帧插值）
   ================================================================= */
const SKY = [
  { top: '#6f90d8', hor: '#ffd3b4', bot: '#3f7fa0', sea: '#3e8fb2', sun: '#ffd6a0', sunI: 1.9, hs: '#d6e3ff', hg: '#e9c8a8', hi: 1.15, dir: [0.75, 0.2, 0.5], disk: 1, night: 0, cloud: '#ffe9dc' },
  { top: '#2f80e0', hor: '#d2ecff', bot: '#1f8fb0', sea: '#1aa3b8', sun: '#fff5e4', sunI: 2.7, hs: '#dcefff', hg: '#b9d5a0', hi: 1.3, dir: [0.3, 1, 0.25], disk: 1, night: 0, cloud: '#ffffff' },
  { top: '#39468f', hor: '#ff9a6c', bot: '#35568a', sea: '#3a5f8f', sun: '#ff9d5a', sunI: 2.3, hs: '#ffbca0', hg: '#7a5a8a', hi: 1.0, dir: [-0.45, 0.1, -1], disk: 1.6, night: 0.2, cloud: '#ffb8a0' },
  { top: '#060c22', hor: '#27305e', bot: '#0b1430', sea: '#0f1d40', sun: '#b4c8ff', sunI: 0.6, hs: '#4252a0', hg: '#141a30', hi: 0.6, dir: [-0.35, 0.65, -0.65], disk: 0.45, night: 1, cloud: '#3b4575' },
].map((k) => {
  const o = { ...k };
  for (const key of ['top', 'hor', 'bot', 'sea', 'sun', 'hs', 'hg', 'cloud']) o[key] = new THREE.Color(k[key]);
  o.dir = V(...k.dir).normalize();
  return o;
});
const skyState = { night: 0, dir: V(), hor: new THREE.Color() };
const _col = new THREE.Color();
function applySky(tod) {
  const f = mod(tod, 1) * 4;
  const i = Math.floor(f);
  const a = SKY[i], b = SKY[(i + 1) % 4];
  const u = smooth(clamp((f - i - 0.35) / 0.65, 0, 1)); // 每个时段先停留一会儿
  skyU.top.value.lerpColors(a.top, b.top, u);
  skyU.hor.value.lerpColors(a.hor, b.hor, u);
  skyU.bot.value.lerpColors(a.bot, b.bot, u);
  skyU.sunCol.value.lerpColors(a.sun, b.sun, u);
  skyU.disk.value = lerp(a.disk, b.disk, u);
  skyState.dir.lerpVectors(a.dir, b.dir, u).normalize();
  skyU.sunDir.value.copy(skyState.dir);
  skyState.night = lerp(a.night, b.night, u);
  skyState.hor.copy(skyU.hor.value);
  scene.fog.color.copy(skyU.hor.value);
  seaM.color.lerpColors(a.sea, b.sea, u);
  sun.color.lerpColors(a.sun, b.sun, u);
  sun.intensity = lerp(a.sunI, b.sunI, u);
  hemi.color.lerpColors(a.hs, b.hs, u);
  hemi.groundColor.lerpColors(a.hg, b.hg, u);
  hemi.intensity = lerp(a.hi, b.hi, u);
  cloudM.color.lerpColors(a.cloud, b.cloud, u);
  cloudM.emissive.copy(cloudM.color);
  mountainM.color.copy(skyU.hor.value).lerp(_col.copy(skyU.top.value), 0.35).multiplyScalar(0.82);
  const n = skyState.night;
  stars.material.opacity = smooth(clamp((n - 0.4) / 0.6, 0, 1));
  const lampOn = smooth(clamp((n - 0.12) / 0.5, 0, 1));
  for (const m of nightGlowMats) m.emissiveIntensity = lampOn * 1.6;
  lampGlowM.opacity = lampOn * 0.9;
  lampPoolM.opacity = lampOn * 0.55;
  beam.material.opacity = lampOn * 0.6;
  foam.material.opacity = lerp(0.75, 0.35, n);
  renderer.toneMappingExposure = lerp(1, 1.15, n);
}

/* =================================================================
   音效（WebAudio 合成，无外部素材）
   ================================================================= */
let actx = null, master = null, windGain = null, noiseBuf = null;
let muted = store.get('muted', false);
function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    // 海浪 + 风声
    const src = actx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const waveGain = actx.createGain();
    waveGain.gain.value = 0.1;
    const lfo = actx.createOscillator();
    const lfoGain = actx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(waveGain.gain);
    src.connect(lp).connect(waveGain).connect(master);
    const src2 = actx.createBufferSource();
    src2.buffer = noiseBuf;
    src2.loop = true;
    src2.playbackRate.value = 1.7;
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 0.6;
    windGain = actx.createGain();
    windGain.gain.value = 0;
    src2.connect(bp).connect(windGain).connect(master);
    src.start();
    src2.start();
    lfo.start();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f, f2, dur, vol, type = 'sine', delay = 0) {
  if (!actx || muted) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur, vol, freq, type = 'lowpass', delay = 0) {
  if (!actx || muted) return;
  const t = actx.currentTime + delay;
  const s = actx.createBufferSource();
  s.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}
const sfx = {
  bell() { tone(2093, 0, 1.3, 0.16); tone(2637, 0, 1.0, 0.09); tone(4186, 0, 0.4, 0.04); tone(2093, 0, 1.0, 0.1, 'sine', 0.16); tone(2637, 0, 0.8, 0.06, 'sine', 0.16); },
  gulp() { tone(420, 140, 0.16, 0.28); tone(260, 90, 0.12, 0.16, 'triangle', 0.08); },
  gold() { tone(1320, 0, 0.18, 0.12, 'triangle'); tone(1760, 0, 0.3, 0.12, 'triangle', 0.08); tone(2640, 0, 0.35, 0.06, 'sine', 0.16); },
  hop() { tone(260, 520, 0.14, 0.12, 'triangle'); },
  land() { noise(0.1, 0.25, 500); },
  bonk() { noise(0.18, 0.5, 900); tone(170, 55, 0.3, 0.3, 'triangle'); },
  splash() { noise(0.4, 0.35, 1800, 'bandpass'); noise(0.25, 0.2, 600, 'lowpass', 0.05); },
  launch() { tone(300, 900, 0.35, 0.12, 'triangle'); noise(0.3, 0.2, 2500, 'highpass'); },
  chirp(i = 0) { for (let k = 0; k < 3; k++) tone(2300 + i * 200, 3400 + i * 200, 0.07, 0.07, 'sine', k * 0.09 + i * 0.12); },
  full() { tone(660, 0, 0.12, 0.1, 'square'); tone(520, 0, 0.18, 0.1, 'square', 0.12); },
  squawk() { tone(900, 500, 0.18, 0.08, 'sawtooth'); tone(1000, 600, 0.14, 0.06, 'sawtooth', 0.12); },
};

/* =================================================================
   状态
   ================================================================= */
const CAP = 12;
const STATION_EVERY = 380;
const state = {};
function reset() {
  for (let i = items.length - 1; i >= 0; i--) despawn(i);
  Object.assign(state, {
    dist: 0, speed: 0, x: 0, vx: 0, targetX: 0, y: 0, vy: 0, grounded: true,
    crank: 0, wheel: 0, sprint: 0, pouch: 0, fed: 0, wobble: 0, invuln: 0,
    hopBuffer: 0, flap: 0, gulp: 0, pouchV: 0, pouchS: 0, beakOpen: 0, headYaw: 0,
    squash: 0, squashV: 0, blink: 2, bellT: 0, nextSpawn: 40, nextStation: STATION_EVERY, air: 0,
  });
}
reset();
let tod = params.has('tod') ? Number(params.get('tod')) || 0 : 0.455;
let todTarget = null;
let camMode = clamp(Number(store.get('cam', 0)) || 0, 0, 2);
let paused = false;
let lifetimeFed = store.get('fed', 0);

/* ---------------- 生成节奏 ---------------- */
function pattern(z) {
  const d = state.dist;
  const hard = clamp((d - 150) / 1500, 0, 1);
  const roll = Math.random();
  const lane = rand(-1.8, 1.8);
  if (d < 140 || roll < 0.3 - hard * 0.1) {
    const kind = Math.random() < 0.5 ? 'line' : 'wave';
    for (let i = 0; i < 6; i++) spawn('fish', kind === 'line' ? lane : Math.sin(i * 0.7 + lane) * 1.7, z - i * 2.6, { y: 1.5 });
    return 20;
  }
  if (roll < 0.45) {
    const c = spawn('crab', rand(-2, 2), z, { dir: Math.random() < 0.5 ? -1 : 1 });
    c.vx = rand(0.8, 1.4 + hard);
    for (let i = 0; i < 3; i++) spawn('fish', lane, z - 8 - i * 2.4, { y: 1.5 });
    return 22;
  }
  if (roll < 0.58) {
    const n = 1 + (Math.random() < 0.3 + hard * 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) spawn('gull', clamp(lane + i * 1.6 * (lane > 0 ? -1 : 1), -2.1, 2.1), z - i * 3);
    spawn('fish', -lane, z - 4, { y: 1.5 });
    return 18;
  }
  if (roll < 0.7) {
    const s = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      spawn('cone', s * (i % 2 ? -1.3 : 1.3), z - i * 7);
      spawn('fish', -s * (i % 2 ? -1.3 : 1.3), z - i * 7, { y: 1.5 });
    }
    return 26;
  }
  if (roll < 0.8) {
    spawn('puddle', lane, z);
    spawn('fish', lane, z, { y: 1.5 });
    spawn('gold', lane, z - 6, { y: 2.75 });
    return 16;
  }
  if (roll < 0.92) {
    const rx = clamp(lane, -1.5, 1.5);
    spawn('ramp', rx, z);
    // 空中弧线上的鱼：按巡航速度估算落点
    const vy = 8.4, sp = 9.5;
    for (let i = 1; i <= 6; i++) {
      const t = i * 0.16;
      spawn(i === 4 ? 'gold' : 'fish', rx, z + 0.9 - sp * t, { y: 1.6 + vy * t - 8 * t * t });
    }
    return 30;
  }
  for (let i = 0; i < 3; i++) spawn('gold', lane, z - i * 3, { y: 2.75 });
  spawn('crab', lane, z - 12, { dir: lane > 0 ? -1 : 1, vx: 0.6 });
  return 22;
}
function spawner() {
  const ahead = 150;
  while (state.nextSpawn < state.dist + ahead) {
    const z = -(state.nextSpawn - state.dist);
    if (Math.abs(state.nextSpawn - state.nextStation) < 26) {
      state.nextSpawn = state.nextStation + 26;
      continue;
    }
    state.nextSpawn += pattern(z) + rand(4, 10);
  }
  if (state.nextStation < state.dist + ahead && !items.some((it) => it.kind === 'station' && !it.done)) {
    spawn('station', 0, -(state.nextStation - state.dist));
  }
}

/* =================================================================
   HUD
   ================================================================= */
const $ = (id) => document.getElementById(id);
const hud = {
  pouchN: $('pouchN'), pouchBar: $('pouchBar'), pouch: document.querySelector('.pouch'),
  fedN: $('fedN'), distN: $('distN'), station: $('station'), stationN: $('stationN'),
  toast: $('toast'), coach: $('coach'), panel: $('panel'), totalN: $('totalN'),
};
let toastTimer = 0;
function toast(text, tone = 'good') {
  hud.toast.textContent = text;
  hud.toast.className = `toast show ${tone}`;
  toastTimer = 1.6;
}
const hudCache = {};
function setText(el, key, text) {
  if (hudCache[key] !== text) { hudCache[key] = text; el.textContent = text; }
}
function bumpPouch() {
  hud.pouch.classList.remove('bump');
  void hud.pouch.offsetWidth;
  hud.pouch.classList.add('bump');
}
function updateHud(dt) {
  setText(hud.pouchN, 'p', String(state.pouch));
  hud.pouchBar.style.width = `${(state.pouch / CAP) * 100}%`;
  hud.pouch.classList.toggle('full', state.pouch >= CAP);
  setText(hud.fedN, 'f', `送达 ${state.fed}`);
  const d = state.dist;
  setText(hud.distN, 'd', d < 1000 ? `${Math.floor(d)} m` : `${(d / 1000).toFixed(2)} km`);
  const toStation = Math.max(0, Math.ceil(state.nextStation - d));
  setText(hud.stationN, 's', String(toStation));
  hud.station.classList.toggle('near', toStation < 60);
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) hud.toast.classList.remove('show');
  }
}
hud.coach.textContent = finePointer
  ? '← → 转向 · 空格 跳跃 · 按住 ↑ 冲刺 · B 按铃'
  : '左右拖动转向 · 轻点跳跃 · 按住闪电冲刺';
let coachTimer = 6;
function dismissCoach() { if (coachTimer > 0) { coachTimer = 0; hud.coach.classList.add('hide'); } }

/* =================================================================
   交互
   ================================================================= */
const keys = {};
let sprintHold = false;
function hop() { audio(); state.hopBuffer = 0.16; dismissCoach(); }
function ringBell() {
  audio();
  sfx.bell();
  state.bellT = 0.5;
  const btn = $('btnBell');
  btn.classList.remove('ring'); void btn.offsetWidth; btn.classList.add('ring');
  let scared = 0;
  for (const it of items) if (it.kind === 'gull' && !it.flee && it.z > -32 && it.z < 1) { it.flee = 0.001; scared++; }
  if (scared) { sfx.squawk(); toast(scared > 1 ? `吓飞 ${scared} 只海鸥` : '海鸥让路啦'); }
}
function cycleTime() { todTarget = (Math.floor(mod(tod, 1) * 4 + 0.35) + 1) / 4 + 0.001; }
const camNames = ['追尾视角', '侧面视角', '正面视角'];
function cycleCam() { camMode = (camMode + 1) % 3; store.set('cam', camMode); toast(camNames[camMode]); }
const soundBtn = $('btnSound');
function setMuted(m) {
  muted = m;
  store.set('muted', m);
  soundBtn.classList.toggle('muted', m);
  soundBtn.setAttribute('aria-pressed', String(!m));
  if (master) master.gain.value = m ? 0 : 0.8;
}
setMuted(muted);
function setPaused(p) {
  paused = p;
  hud.panel.hidden = !p;
  if (p) {
    hud.totalN.textContent = `累计投喂 ${lifetimeFed} 条鱼 · 本次骑行 ${(state.dist / 1000).toFixed(2)} km`;
    $('btnResume').focus({ preventScroll: true });
    sprintHold = false;
    for (const k in keys) keys[k] = false;
  } else canvas.focus({ preventScroll: true });
}
function restart() {
  reset();
  for (let i = flyers.length - 1; i >= 0; i--) { flyers[i].o.visible = false; partPools.fish.push(flyers[i].o); }
  flyers.length = 0;
  setPaused(false);
  toast('重新出发');
}

// 拖动转向 / 轻点跳跃 / 上滑跳跃
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  audio();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), tx: state.targetX, moved: 0 };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  drag.moved = Math.max(drag.moved, Math.hypot(dx, e.clientY - drag.y));
  const sens = (LIM * 2) / Math.max(200, innerWidth * 0.62);
  state.targetX = clamp(drag.tx + dx * sens, -LIM, LIM);
  if (drag.moved > 12) dismissCoach();
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dt = performance.now() - drag.t;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (e.type === 'pointerup' && ((drag.moved < 10 && dt < 350) || (dy < -40 && Math.abs(dy) > Math.abs(dx) * 1.2 && dt < 450))) hop();
  drag = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const sprintBtn = $('btnSprint');
sprintBtn.addEventListener('pointerdown', (e) => { audio(); try { sprintBtn.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ } sprintHold = true; dismissCoach(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) sprintBtn.addEventListener(ev, () => { sprintHold = false; });
sprintBtn.addEventListener('contextmenu', (e) => e.preventDefault());
$('btnHop').addEventListener('pointerdown', (e) => { e.preventDefault(); hop(); });
$('btnHop').addEventListener('click', (e) => { if (e.detail === 0) hop(); }); // 键盘激活按钮
$('btnBell').addEventListener('click', ringBell);
$('btnTime').addEventListener('click', () => { audio(); cycleTime(); });
$('btnCam').addEventListener('click', () => { audio(); cycleCam(); });
soundBtn.addEventListener('click', () => { audio(); setMuted(!muted); });
$('btnPause').addEventListener('click', () => setPaused(!paused));
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnRestart').addEventListener('click', restart);

const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; e.preventDefault(); audio(); dismissCoach(); return; }
  if (e.repeat) return;
  switch (e.code) {
    case 'Space': e.preventDefault(); if (!paused) hop(); break;
    case 'KeyB': if (!paused) ringBell(); break;
    case 'KeyC': cycleCam(); break;
    case 'KeyT': cycleTime(); break;
    case 'KeyM': audio(); setMuted(!muted); break;
    case 'KeyP': case 'Escape': case 'KeyH': case 'Slash': setPaused(!paused); break;
    case 'KeyR': if (paused) restart(); break;
    default:
  }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; sprintHold = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && !paused) setPaused(true); });

/* =================================================================
   模拟
   ================================================================= */
const beakWorld = V();
function crash(it) {
  state.wobble = 1.1;
  state.invuln = 1.8;
  state.speed *= 0.35;
  state.flap = 1;
  sfx.bonk();
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(60);
  const lose = Math.ceil(state.pouch / 2);
  state.pouch -= lose;
  beakWorld.set(state.x, state.y + 1.7, -0.5);
  emit('feather', beakWorld, 14, { spread: 1.6, up: 2.5, life: 1.4, grav: 2 });
  if (lose) emit('fish', beakWorld, Math.min(lose, 6), { spread: 2.2, up: 4.5, life: 1.2, grav: 12 });
  toast(lose ? `哎哟！洒了 ${lose} 条鱼` : '哎哟！', 'bad');
  bumpPouch();
  if (it.kind === 'gull') { it.flee = 0.001; sfx.squawk(); }
  if (it.kind === 'cone') it.knock = 1;
  if (it.kind === 'crab') it.flee = 0.001;
}

function collectFish(it) {
  it.done = true;
  it.obj.visible = false;
  const val = it.kind === 'gold' ? 3 : 1;
  if (state.pouch >= CAP) {
    toast('喉囊满啦，快去雏鸟站', 'bad');
    sfx.full();
    return;
  }
  state.pouch = Math.min(CAP, state.pouch + val);
  state.gulp = 1;
  state.pouchV += 5;
  state.beakOpen = 1;
  bumpPouch();
  if (it.kind === 'gold') { sfx.gold(); toast('金鱼 +3'); } else sfx.gulp();
  emit('spark', _a.set(it.x, it.y, it.z), it.kind === 'gold' ? 10 : 5, { spread: 1.2, up: 1.5, size: it.kind === 'gold' ? 0.5 : 0.3, life: 0.5, grav: 0 });
  if (state.pouch >= CAP) setTimeout(() => toast('喉囊满载！前往雏鸟站'), 350);
}

function deliver(it) {
  it.done = true;
  const n = state.pouch;
  state.nextStation += STATION_EVERY;
  if (!n) { toast('雏鸟饿着肚子…下次多带点', 'bad'); return; }
  const bonus = n >= CAP ? 4 : 0;
  state.fed += n + bonus;
  lifetimeFed += n + bonus;
  store.set('fed', lifetimeFed);
  state.pouch = 0;
  state.pouchV -= 3;
  state.beakOpen = 1;
  launchFeed(it, Math.min(n, 9));
  it.obj.userData.chicks.forEach((ch, i) => { ch.userData.jump = 1 + i * 0.15; sfx.chirp(i); });
  toast(bonus ? `满载投喂 +${n} · 奖励 +${bonus}` : `投喂 +${n}`);
  bumpPouch();
}

function updateItems(dt, T) {
  const sp = state.speed;
  const beakY = state.y + 1.62;
  let nearest = null, nearD = 14;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.z += sp * dt;
    it.t += dt;
    const o = it.obj;
    if (it.z > 14 || (it.done && (it.kind === 'fish' || it.kind === 'gold'))) { despawn(i); continue; }
    const dz = it.z, dx = it.x - state.x;
    switch (it.kind) {
      case 'fish':
      case 'gold': {
        const u = o.userData;
        o.position.set(it.x, it.y + Math.sin(it.t * 3) * 0.08, it.z);
        u.body.rotation.y = it.t * 2.2;
        u.body.rotation.z = Math.sin(it.t * 5) * 0.2;
        u.tail.rotation.y = Math.sin(it.t * 14) * 0.5;
        if (!it.done && dz > -nearD && dz < 0.5 && Math.abs(dx) < 1.5) { nearD = -dz; nearest = it; }
        if (!it.done && Math.abs(dz) < 0.8 && Math.abs(dx) < 0.72 && Math.abs(it.y - beakY) < 0.72) collectFish(it);
        break;
      }
      case 'crab': {
        if (it.flee) {
          it.flee += dt;
          it.x += it.dir * 5 * dt;
          o.position.y = Math.max(0, Math.sin(it.flee * 8) * 0.3);
        } else {
          it.x += it.dir * it.vx * dt;
          if (Math.abs(it.x) > 2.4) { it.dir *= -1; it.x = clamp(it.x, -2.4, 2.4); }
        }
        o.position.x = it.x;
        o.position.z = it.z;
        o.userData.body.position.y = Math.abs(Math.sin(it.t * 14)) * 0.03;
        o.userData.body.rotation.z = Math.sin(it.t * 14) * 0.1;
        o.rotation.y = Math.PI; // 面朝骑手，横着走
        if (!it.done && !it.flee) hitCheck(it, dx, dz, 0.36, 0.3);
        break;
      }
      case 'gull': {
        const b = o.userData.bird;
        if (it.flee) {
          it.flee += dt;
          const f = it.flee;
          o.position.set(it.x + f * f * 3 * Math.sign(it.x || 1), f * f * 4 + f * 2, it.z - f * 2);
          b.userData.wl.rotation.z = Math.sin(f * 30) * 0.9;
          b.userData.wr.rotation.z = -Math.sin(f * 30) * 0.9;
          b.rotation.x = -0.4;
          if (f > 3) it.done = true;
        } else {
          o.position.set(it.x, 0, it.z);
          o.rotation.y = Math.sin(it.t * 0.7) * 0.8;
          b.rotation.x = Math.max(0, Math.sin(it.t * 2.3)) ** 8 * 0.7; // 啄食
          b.userData.wl.rotation.z = -1.2;
          b.userData.wr.rotation.z = 1.2;
          if (!it.done) hitCheck(it, dx, dz, 0.35, 0.55);
        }
        break;
      }
      case 'cone': {
        o.position.set(it.x, 0, it.z);
        if (it.knock) {
          it.knock += dt;
          o.rotation.x = -Math.min(1.5, it.knock * 6);
          o.position.x = it.x + Math.sign(dx || 1) * -it.knock * 2;
        }
        if (!it.done) hitCheck(it, dx, dz, 0.28, 0.55);
        break;
      }
      case 'puddle':
        o.position.set(it.x, 0, it.z);
        if (!it.done && Math.abs(dz) < 1.2 && Math.abs(dx) < 1 && state.y < 0.1) {
          it.done = true;
          it.obj.visible = true;
          sfx.splash();
          state.speed *= 0.85;
          emit('splash', _a.set(state.x, 0.1, 0), 18, { spread: 1.4, up: 3.5, size: 0.08, life: 0.7, grav: 12 });
        }
        break;
      case 'ramp':
        o.position.set(it.x, 0, it.z);
        if (!it.done && Math.abs(dz) < 0.9 && Math.abs(dx) < 0.85 && state.grounded) {
          it.done = true;
          state.vy = 8.4;
          state.grounded = false;
          state.air = 0;
          state.flap = 1;
          sfx.launch();
          toast('起飞！');
        }
        break;
      case 'station': {
        o.position.set(0, 0, it.z);
        const u = o.userData;
        u.chicks.forEach((ch, k) => {
          const cu = ch.userData;
          const beg = 1 + Math.sin(it.t * 9 + k * 2) * 0.5;
          cu.hd.rotation.x = -0.35 + Math.sin(it.t * 7 + k) * 0.15;
          cu.bk.scale.y = 0.16 * beg;
          if (cu.jump > 0) { cu.jump -= dt; ch.position.y = 1.1 + Math.abs(Math.sin(cu.jump * 9)) * 0.25 * Math.min(1, cu.jump); }
        });
        if (!it.done && dz > -0.5) deliver(it);
        break;
      }
      default:
    }
  }
  return nearest;
}
function hitCheck(it, dx, dz, w, h) {
  if (Math.abs(dz) < 0.75 && Math.abs(dx) < w + 0.28) {
    if (state.y > h - 0.05 || state.invuln > 0) return;
    it.done = true;
    crash(it);
  }
}

function updateFlyers(dt) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    if (f.delay > 0) {
      f.delay -= dt;
      f.o.visible = false;
      f.from.set(state.x, state.y + 1.65, -0.5);
      continue;
    }
    f.o.visible = true;
    f.t += dt / 0.55;
    const nest = f.station.obj.userData.nest;
    const ch = f.station.obj.userData.chicks[f.chick];
    _b.set(nest.position.x + ch.position.x, 1.6, f.station.z + ch.position.z);
    const t = Math.min(1, f.t);
    f.o.position.lerpVectors(f.from, _b, t);
    f.o.position.y += Math.sin(t * Math.PI) * 1.6;
    f.o.rotation.set(t * 8, t * 3, 0);
    f.o.scale.setScalar(0.8 * (1 - t * 0.4));
    if (f.t >= 1) {
      emit('spark', _b, 4, { spread: 0.6, up: 1, size: 0.3, life: 0.4, grav: 0 });
      f.o.visible = false;
      partPools.fish.push(f.o);
      flyers.splice(i, 1);
    }
  }
}

// 侧面视角时，隐藏挡在相机与骑手之间的路灯与布景
const blocksSideCam = (p) => camMode === 1 && p.x > state.x + 0.6 && p.x < state.x + 9 && Math.abs(p.z + 0.6) < 3.2;
function updateWorld(dt, T) {
  const d = state.dist;
  placeInstances(dashes, 36, 6, 0, 0.006, 0.12, 0.012, 2.4, d);
  placeInstances(posts, 72, 3, -3.78, 0.5, 0.06, 0.9, 0.06, d);
  lamps.forEach((g, i) => {
    g.position.set(3.35, 0, 15 - 208 + mod(i * 16 + d, 208));
    g.visible = !blocksSideCam(g.position);
  });
  for (const p of props) {
    const o = p.o;
    o.position.z += state.speed * dt;
    if (o.position.z > 18) {
      p.place(o);
      o.position.z -= p.span + rand(0, 20);
    }
    o.visible = !blocksSideCam(o.position);
    if (o.userData.bob) {
      o.position.y = Math.sin(T * 1.3 + o.position.x) * 0.12;
      o.rotation.z = Math.sin(T * 1.1 + o.position.z * 0.1) * 0.06;
    }
    if (o.userData.sway) o.userData.sway.rotation.z = Math.sin(T * 1.2 + o.position.x) * 0.06;
    if (o.userData.beam) {
      o.userData.beam.rotation.y = T * 0.8;
      o.userData.beamM.opacity = skyState.night * 0.22;
    }
  }
  for (const c of clouds) {
    c.position.z += (state.speed * 0.08 + 0.6) * dt;
    if (c.position.z > 60) { c.position.z = -420; c.position.x = rand(-260, 260); }
  }
  skyBirds.forEach((b) => {
    const o = b.userData.orbit;
    const a = o.ph + T * o.w;
    b.position.set(o.cx + Math.cos(a) * o.r, o.y + Math.sin(T * 0.7 + o.ph) * 1.2, o.cz + Math.sin(a) * o.r);
    b.rotation.set(0, -a + (o.w > 0 ? 0 : Math.PI), Math.sign(o.w) * 0.3);
    const flap = Math.sin(T * 6 + o.ph);
    b.userData.wl.rotation.z = flap * 0.5 + 0.1;
    b.userData.wr.rotation.z = -flap * 0.5 - 0.1;
  });
  updateSea(T, d);
  foam.position.y = -1.12 + Math.sin(T * 1.7) * 0.06;
}

/* ---------------- 骑手动画 ---------------- */
const POLE_LEG = V(0, 0.35, -1).normalize();
const HINT_X = V(1, 0, 0);
const HINT_F = V(0, 0, -1);
const pelvis = V();
const hipLocal = V(), shoulderLocal = V(), gripLocal = V();
function updateRider(dt, T, nearest) {
  const s = state.sprint;
  const c = state.crank;
  const air = !state.grounded;
  const wob = state.wobble;

  // 骨盆：坐姿 / 站立冲刺，随踏频起伏
  const bob = air ? 0 : Math.sin(c * 2) * 0.012 * (1 + s * 2);
  pelvis.set(Math.sin(c) * 0.03 * s, lerp(1.03, 1.06, s) + bob, lerp(0.24, 0.13, s));
  torso.position.copy(pelvis);
  const lean = lerp(0.42, 0.66, s) + (air ? -state.vy * 0.02 : 0);
  torso.rotation.set(-lean, Math.sin(T * 30) * 0.12 * wob, Math.sin(c) * 0.07 * s + state.vx * 0.03 + Math.sin(T * 25) * 0.15 * wob);
  // 落地挤压
  torso.scale.set(1 + state.squash * 0.5, 1 - state.squash, 1 + state.squash * 0.5);
  torso.updateMatrix();
  fork.updateMatrix();

  // 头：抵消身体前倾，看向最近的鱼，偶尔眨眼
  let yawT = Math.sin(T * 0.6) * 0.15;
  if (nearest) yawT = clamp(Math.atan2(-(nearest.x - state.x), -nearest.z + 0.4) * 0.8, -0.7, 0.7);
  if (wob > 0) yawT = Math.sin(T * 22) * 0.6;
  state.headYaw = damp(state.headYaw, yawT, 8, dt);
  const nod = air ? 0 : Math.sin(c * 2 + 0.6) * 0.04;
  head.rotation.set(lean * 0.92 - 0.12 + nod - (nearest && nearest.y > state.y + 2.2 ? 0.25 : 0), state.headYaw, 0);
  state.blink -= dt;
  if (state.blink < -0.12) state.blink = rand(1.8, 4.5);
  const eyeS = state.blink < 0 ? 0.12 : 1;
  eyes.forEach((e) => { e.scale.y = eyeS; });
  crest.rotation.x = -1.1 - state.speed * 0.02 + Math.sin(T * 13) * 0.08 * (state.speed / 10);

  // 喙张合 + 喉囊（弹簧抖动，大小随鱼量）
  const wantOpen = nearest && nearD(nearest) < 3.2 ? 0.7 : 0;
  state.beakOpen = damp(state.beakOpen, wantOpen, state.beakOpen > wantOpen ? 9 : 14, dt);
  jaw.rotation.x = -state.beakOpen * 0.45;
  const fill = state.pouch / CAP;
  state.pouchV += (-state.pouchS * 90 - state.pouchV * 7) * dt;
  state.pouchS += state.pouchV * dt;
  const ps = 1 + state.pouchS * 0.12;
  pouchMesh.scale.set(0.042 + fill * 0.03, (0.035 + fill * 0.075) * ps, 0.2 + fill * 0.02);
  pouchMesh.position.y = -0.03 - fill * 0.055;

  // 腿：两段 IK 追踪踏板
  legs.forEach((L) => {
    const a = state.crank + (L.s > 0 ? 0 : Math.PI);
    L.pedal.set(L.s * 0.14, P.BB.y + 0.17 * Math.cos(a), P.BB.z - 0.17 * Math.sin(a));
    pedals[L.s > 0 ? 0 : 1].position.copy(L.pedal);
    L.ankle.set(L.pedal.x, L.pedal.y + 0.06, L.pedal.z + 0.07);
    hipLocal.set(L.s * 0.1, 0.05, 0.03).applyMatrix4(torso.matrix);
    L.hip.copy(hipLocal);
    ik(L.hip, L.ankle, LEG1, LEG2, POLE_LEG, L.knee);
    aim(L.thigh, L.hip, L.knee, HINT_X);
    aim(L.shin, L.knee, L.ankle, HINT_X);
    L.foot.position.copy(L.ankle);
    L.foot.rotation.set(-0.25 + Math.sin(a) * 0.25, 0, 0);
  });

  // 翅膀：平时握把，空中/摔跤/按铃时扇动
  const flapT = state.flap;
  wings.forEach((W) => {
    W.shoulder.copy(shoulderLocal.set(W.s * 0.2, 0.4, -0.05).applyMatrix4(torso.matrix));
    W.grip.copy(gripLocal.set(W.s * 0.24, 0.32, 0.05).applyMatrix4(fork.matrix));
    let bell = 0;
    if (W.s > 0 && state.bellT > 0) bell = Math.sin((state.bellT / 0.5) * Math.PI);
    const beat = Math.sin(T * 22 + (W.s > 0 ? 0 : 0.3));
    _a.set(W.shoulder.x + W.s * 0.62, W.shoulder.y + 0.1 + beat * 0.35, W.shoulder.z + 0.12 - beat * 0.08);
    W.target.lerpVectors(W.grip, _a, flapT);
    if (bell) W.target.y += bell * 0.12;
    ik(W.shoulder, W.target, ARM1, ARM2, _b.set(W.s, 0.25, 0.35).normalize(), W.elbow);
    aim(W.upper, W.shoulder, W.elbow, HINT_F);
    aim(W.fore, W.elbow, W.target, HINT_F);
    W.tips.forEach((tp, i) => { tp.rotation.z = (i - 1) * (0.25 + flapT * 0.35) * W.s; });
  });

  // 围巾随风
  const wind = clamp(state.speed / 14, 0.15, 1.2);
  scarf.forEach((seg, i) => {
    seg.rotation.x = i === 0 ? 1.9 - wind * 0.5 : Math.sin(T * 14 - i * 1.1) * 0.25 * wind + 0.08;
    seg.rotation.z = Math.sin(T * 9 - i * 0.9) * 0.18 * wind;
  });
  flag.rotation.y = Math.sin(T * 9) * 0.3 * wind + 0.1;
  flag.rotation.x = Math.sin(T * 13) * 0.08;
  fork.userData.bell.rotation.z = state.bellT > 0 ? Math.sin(state.bellT * 60) * 0.4 : 0;
}
const nearD = (it) => -it.z;

/* ---------------- 主模拟步 ---------------- */
let T = 0;
function update(dt) {
  T += dt;
  // 时段
  if (todTarget !== null) {
    tod += dt * 0.3;
    if (tod >= todTarget) { tod = todTarget; todTarget = null; }
  } else tod += dt / 240;
  applySky(tod);

  // 输入 → 目标
  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (steer) state.targetX = clamp(state.targetX + steer * 4.4 * dt, -LIM, LIM);
  const sprinting = (keys.up || sprintHold) && state.wobble <= 0;
  const braking = keys.down;
  sprintBtn.classList.toggle('on', sprinting);
  state.sprint = damp(state.sprint, sprinting && state.grounded ? 1 : 0, 5, dt);
  const target = state.wobble > 0 ? 3 : braking ? 3.2 : sprinting ? 15 : 9.5;
  state.speed = damp(state.speed, target, target > state.speed ? (state.speed < 4 ? 0.9 : 1.4) : 2.2, dt);

  // 横向弹簧
  state.vx += ((state.targetX - state.x) * 30 - state.vx * 10) * dt;
  state.x = clamp(state.x + state.vx * dt, -LIM - 0.1, LIM + 0.1);

  // 跳跃 / 空中
  state.hopBuffer -= dt;
  if (state.hopBuffer > 0 && state.grounded && state.wobble <= 0) {
    state.vy = 5.3;
    state.grounded = false;
    state.hopBuffer = 0;
    state.air = 0;
    state.flap = 0.55;
    sfx.hop();
  }
  if (!state.grounded) {
    state.air += dt;
    state.vy -= 16 * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      state.y = 0;
      state.grounded = true;
      state.squashV -= Math.min(4, -state.vy * 0.45);
      state.vy = 0;
      sfx.land();
      emit('dust', _a.set(state.x, 0.05, 0.4), 8, { spread: 1, up: 1, size: 0.07, life: 0.5, grav: 3 });
    }
  }
  state.flap = damp(state.flap, state.wobble > 0 ? 1 : 0, !state.grounded && state.air < 0.35 ? 0.5 : 5, dt);
  state.squashV += (-state.squash * 160 - state.squashV * 11) * dt;
  state.squash = clamp(state.squash + state.squashV * dt * 0.1, -0.08, 0.12);

  // 踏板与车轮
  state.dist += state.speed * dt;
  state.wheel += (state.speed / WR) * dt;
  if (state.grounded && !braking) state.crank += (state.speed / WR / lerp(2.3, 3.0, state.sprint)) * dt;
  state.wobble = Math.max(0, state.wobble - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.bellT = Math.max(0, state.bellT - dt);
  if (coachTimer > 0) { coachTimer -= dt; if (coachTimer <= 0) hud.coach.classList.add('hide'); }

  spawner();
  const nearest = updateItems(dt, T);
  updateFlyers(dt);
  updateWorld(dt, T);
  updateParticles(dt, state.speed);

  // rig 姿态
  rig.position.set(state.x, state.y, 0);
  const wob = state.wobble;
  const rock = Math.sin(state.crank) * 0.045 * state.sprint;
  rig.rotation.set(
    state.grounded ? 0 : clamp(state.vy * 0.035, -0.25, 0.3),
    -state.vx * 0.05 + Math.sin(T * 18) * 0.12 * wob,
    clamp(-state.vx * 0.07, -0.35, 0.35) + rock + Math.sin(T * 21) * 0.2 * wob,
  );
  rearSpin.rotation.x = -state.wheel;
  fork.userData.wheel.rotation.x = -state.wheel;
  fork.rotation.y = clamp(-state.vx * 0.09, -0.4, 0.4) + Math.sin(T * 17) * 0.3 * wob;
  crankG.rotation.x = -state.crank;
  // 无敌闪烁
  rig.visible = state.invuln <= 0 || state.wobble > 0 || Math.sin(T * 40) > -0.3;

  updateRider(dt, T, nearest);

  if (windGain) windGain.gain.value = muted ? 0 : clamp((state.speed - 4) / 14, 0, 1) * 0.07;
  updateHud(dt);
}

/* ---------------- 相机 ---------------- */
const camPos = V(0, 4, 9), camLook = V(0, 1, -6), camWantPos = V(), camWantLook = V();
let portrait = false;
function updateCamera(dt, snap = false) {
  const x = state.x, y = state.y;
  const sp = state.speed;
  if (camMode === 0) {
    const back = portrait ? 6.6 : 5.6, high = portrait ? 3.7 : 2.9;
    camWantPos.set(x * 0.55 + 0.6, high + y * 0.5, back + sp * 0.06);
    camWantLook.set(x * 0.8, 1.2 + y * 0.6, portrait ? -7.5 : -6);
  } else if (camMode === 1) {
    camWantPos.set(x + (portrait ? 5.4 : 4.2), 1.35 + y * 0.8, -0.6);
    camWantLook.set(x, 1.05 + y * 0.9, -0.35);
  } else {
    camWantPos.set(x + 1.1, 1.7 + y * 0.7, portrait ? -5.2 : -4.3);
    camWantLook.set(x, 1.15 + y * 0.8, 0.1);
  }
  const k = snap ? 1 : 1 - Math.exp(-4.5 * dt);
  camPos.lerp(camWantPos, k);
  camLook.lerp(camWantLook, k);
  camera.position.copy(camPos);
  if (!reduceMotion && state.wobble > 0) camera.position.x += Math.sin(T * 45) * 0.06 * state.wobble;
  camera.lookAt(camLook);
  const baseFov = portrait ? 62 : 52;
  const fov = baseFov + (camMode === 0 ? clamp(sp - 9.5, 0, 6) * 0.9 : 0);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = snap ? fov : damp(camera.fov, fov, 3, dt);
    camera.updateProjectionMatrix();
  }
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  // 阴影相机跟随骑手
  sun.position.copy(skyState.dir).multiplyScalar(22).add(_a.set(x, 0, -1));
  sun.target.position.set(x, 0, -1);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  portrait = camera.aspect < 0.8;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ---------------- 主循环（含自适应分辨率） ---------------- */
let last = performance.now();
let perfAcc = 0, perfN = 0;
applySky(tod);
updateCamera(0, true);
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw, 1 / 20);
  if (!paused) update(dt);
  updateCamera(paused ? 0 : dt);
  renderer.render(scene, camera);
  if (!paused && raw < 0.5) {
    perfAcc += raw;
    perfN++;
    if (perfN >= 90) {
      const avg = perfAcc / perfN;
      if (avg > 0.024 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
      perfAcc = 0;
      perfN = 0;
    }
  }
}
requestAnimationFrame(frame);
canvas.tabIndex = 0;
window.__pelican = { state, items, get tod() { return tod; } }; // 调试用
