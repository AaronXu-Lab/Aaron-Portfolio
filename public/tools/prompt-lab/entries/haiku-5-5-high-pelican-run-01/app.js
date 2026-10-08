// 鹈鹕骑自行车 · 沿海木栈道
// Pelican bicycle ride along a sunset boardwalk. Every model is procedural.

import * as THREE from './vendor/three.module.min.js';

const { PI } = Math;
const TAU = PI * 2;
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const LANES = [-1.2, 0, 1.2];
const VMAX = 11;
const WHEEL_R = 0.45;
const GEAR = 3.4;
const CRANK_R = 0.17;
const BB = new THREE.Vector3(0, 0.4, 0.02);
const PIVOT = new THREE.Vector3(0, 1.28, 0.22);
const SEA_Y = -0.55;
const PALETTE_LEN = 520;
const BEST_KEY = 'pelican-haiku-5-5:best';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const toU = (p) => V(p.x - PIVOT.x, p.y - PIVOT.y, p.z - PIVOT.z);

// ---------- 材质与几何 / materials & geometry ----------
const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });
const M = {
  body: std(0xf6f3ec, { roughness: 0.5 }),
  wing: std(0x9aa7ae),
  tip: std(0x4d5b63),
  beak: std(0xf2b43a, { roughness: 0.35 }),
  pouch: std(0xf5a25c, { roughness: 0.45 }),
  leg: std(0xf07a2a, { roughness: 0.5 }),
  eye: std(0x101418, { roughness: 0.2 }),
  frame: std(0x2f6f8c, { roughness: 0.35, metalness: 0.1 }),
  chrome: std(0xd9dde0, { roughness: 0.2, metalness: 0.6 }),
  rubber: std(0x1d2226, { roughness: 0.8 }),
  wood: std(0xb47a48),
  plank: std(0xa8703f),
  seat: std(0x6b3d24, { roughness: 0.5 }),
  basket: std(0x8a5a33, { side: THREE.DoubleSide }),
  crate: std(0xc08a4e),
  crateBand: std(0x5e3b20),
  rock: std(0x7b8790, { flatShading: true }),
  fish: std(0xffb830, { roughness: 0.35, emissive: 0x3a2000 }),
  leaf: std(0x3f9a4f),
  leaf2: std(0x2f7d3e),
  coco: std(0x6a4a2a),
  white: std(0xf5f5f0, { roughness: 0.9 }),
  buoy: std(0xe2483a, { roughness: 0.4 }),
  sand: std(0xf0d9a8, { roughness: 1 }),
  lighthouse: std(0xf5f2ea),
  lamp: std(0xffe27a, { emissive: 0xffd24a, emissiveIntensity: 1.2 }),
};
const G = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  taper: new THREE.CylinderGeometry(0.4, 1, 1, 12),
  sph: new THREE.SphereGeometry(1, 20, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 10),
  rock: new THREE.DodecahedronGeometry(1, 0),
  stone: new THREE.IcosahedronGeometry(0.34, 0),
};

const tmpV = new THREE.Vector3();
// 让圆柱 / 锥体（单位尺寸）沿 a→b 方向排布
function setRod(m, a, b, r) {
  tmpV.subVectors(b, a);
  const len = tmpV.length();
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(AXIS_Y, tmpV.normalize());
  m.scale.set(r, len, r);
  return m;
}
function rod(parent, a, b, r, mat, geo = G.cyl) {
  const m = new THREE.Mesh(geo, mat);
  setRod(m, a, b, r);
  m.castShadow = true;
  parent.add(m);
  return m;
}
// 椭球：radii 为 [宽, 高, 长]，长轴沿 dir（缺省为局部 Z）
function setBlob(m, c, radii, dir) {
  m.position.copy(c);
  if (dir) m.quaternion.setFromUnitVectors(AXIS_Z, dir.clone().normalize());
  m.scale.set(radii[0], radii[1], radii[2]);
  return m;
}
function blob(parent, c, radii, mat, dir) {
  const m = new THREE.Mesh(G.sph, mat);
  setBlob(m, c, radii, dir);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// ---------- 渲染器与场景 / renderer & scene ----------
const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc8ecf3, 42, 120);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);

// 天空穹顶：渐变 + 太阳光晕
const skyU = {
  top: { value: new THREE.Color() },
  hor: { value: new THREE.Color() },
  glow: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 glow; uniform vec3 sunDir; varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 1.7, 0.0, 1.0);
        vec3 c = mix(hor, top, pow(h, 0.65));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += glow * (pow(s, 7.0) * 0.45 + pow(s, 60.0) * 0.6);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
scene.add(sky);

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const sunGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,255,255,1)', 'rgba(255,240,200,0.5)'),
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  })
);
sunGlow.scale.set(70, 70, 1);
scene.add(sunGlow);

// 光照：太阳 + 半球光
const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
Object.assign(sunLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 90 });
sunLight.shadow.bias = -0.0008;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight, sunLight.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.8);
scene.add(hemi);

// 昼夜色盘：day → golden → sunset → dusk，来回循环
const PAL = [
  { top: 0x5fb6e8, hor: 0xc8ecf3, sea: 0x1f8fb0, sand: 0xf0d9a8, sun: 0xfff1d0, sunI: 2.6, hemi: 0.9, el: 62 },
  { top: 0x4a7fcf, hor: 0xffd39c, sea: 0x2a7f9c, sand: 0xe9c088, sun: 0xffb36e, sunI: 2.4, hemi: 0.7, el: 16 },
  { top: 0x5a48a6, hor: 0xff8f6b, sea: 0x3b6190, sand: 0xd89b72, sun: 0xff7a4f, sunI: 1.9, hemi: 0.55, el: 4 },
  { top: 0x25286b, hor: 0xc4748f, sea: 0x2c4777, sand: 0xa7735f, sun: 0xffb0a0, sunI: 0.9, hemi: 0.42, el: -4 },
];
const RING = [0, 1, 2, 3, 2, 1];
const cur = {
  top: new THREE.Color(), hor: new THREE.Color(), sea: new THREE.Color(),
  sand: new THREE.Color(), sun: new THREE.Color(), sunI: 0, hemi: 0, el: 0,
};
const tmpC = new THREE.Color();
const sunDir = new THREE.Vector3();
function mixPalette(dist) {
  const x = (dist / PALETTE_LEN) % RING.length;
  const i = Math.floor(x);
  const f = smooth(x - i);
  const a = PAL[RING[i]];
  const b = PAL[RING[(i + 1) % RING.length]];
  for (const k of ['top', 'hor', 'sea', 'sand', 'sun']) {
    cur[k].setHex(a[k]);
    tmpC.setHex(b[k]);
    cur[k].lerp(tmpC, f);
  }
  cur.sunI = a.sunI + (b.sunI - a.sunI) * f;
  cur.hemi = a.hemi + (b.hemi - a.hemi) * f;
  cur.el = a.el + (b.el - a.el) * f;
}

// ---------- 海与木栈道 / sea & boardwalk ----------
const seaMat = std(0x1f8fb0, { roughness: 0.3 });
const seaGeo = new THREE.PlaneGeometry(90, 260, 60, 120);
seaGeo.rotateX(-PI / 2);
seaGeo.translate(2.4 + 45, SEA_Y, -100);
const seaBase = Float32Array.from(seaGeo.attributes.position.array);
const sea = new THREE.Mesh(seaGeo, seaMat);
sea.receiveShadow = true;
scene.add(sea);

function updateSea(t, scroll) {
  const p = seaGeo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const x = seaBase[i];
    const z = seaBase[i + 2] - scroll;
    p[i + 1] = SEA_Y
      + 0.05 * Math.sin(z * 0.9 + t * 1.6)
      + 0.04 * Math.sin(x * 1.3 + z * 0.4 + t * 1.9)
      + 0.025 * Math.sin(x * 2.7 - t * 2.3);
  }
  seaGeo.attributes.position.needsUpdate = true;
  seaGeo.computeVertexNormals();
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const planks = 6;
  const w = 256 / planks;
  for (let k = 0; k < planks; k++) {
    g.fillStyle = `hsl(${28 + rand(-3, 3)}, ${40 + rand(-5, 5)}%, ${48 + rand(-4, 4)}%)`;
    g.fillRect(k * w, 0, w, 256);
    g.fillStyle = 'rgba(70,40,18,0.55)';
    g.fillRect(k * w, 0, 3, 256);
    g.fillStyle = 'rgba(70,40,18,0.5)';
    g.fillRect(k * w, rand(0, 256), w, 2);
    g.strokeStyle = 'rgba(90,55,28,0.18)';
    for (let n = 0; n < 6; n++) {
      const gx = k * w + rand(6, w - 6);
      g.beginPath();
      g.moveTo(gx, 0);
      g.lineTo(gx + rand(-2, 2), 256);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(1, 300 / 2.4);
  return tex;
}
const deckGeo = new THREE.PlaneGeometry(4.8, 300);
deckGeo.rotateX(-PI / 2);
deckGeo.translate(0, 0, -100);
const deckMat = std(0xffffff, { map: woodTexture(), roughness: 0.85 });
const deck = new THREE.Mesh(deckGeo, deckMat);
deck.receiveShadow = true;
scene.add(deck);

const sandMat = std(0xf0d9a8, { roughness: 1 });
const sandGeo = new THREE.PlaneGeometry(60, 300);
sandGeo.rotateX(-PI / 2);
sandGeo.translate(-2.4 - 30, -0.12, -100);
const sandPlane = new THREE.Mesh(sandGeo, sandMat);
sandPlane.receiveShadow = true;
scene.add(sandPlane);

// 栏杆柱：循环滚动，栏杆段随柱子走
const POST_STEP = 4.5;
const posts = [];
for (let i = 0; i < 44; i++) {
  const g = new THREE.Group();
  rod(g, V(0, 0, 0), V(0, 0.95, 0), 0.05, M.wood);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, POST_STEP), M.wood);
  rail.position.set(0, 0.88, -POST_STEP / 2);
  rail.castShadow = true;
  g.add(rail);
  g.position.set(2.42, 0, -198 + i * POST_STEP);
  scene.add(g);
  posts.push(g);
}

// ---------- 远景道具 / scenery ----------
function palm() {
  const g = new THREE.Group();
  const top = V(0.15, 3.4, 0.1);
  rod(g, V(0, 0, 0), top, 0.14, M.wood, G.taper);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rand(-0.2, 0.2);
    const dir = V(Math.cos(a), -0.35, Math.sin(a)).normalize();
    blob(g, top.clone().addScaledVector(dir, 0.75), [0.16, 0.03, 0.9], i % 2 ? M.leaf : M.leaf2, dir);
  }
  blob(g, top.clone().add(V(0.05, -0.1, 0.05)), [0.07, 0.07, 0.07], M.coco);
  blob(g, top.clone().add(V(-0.05, -0.12, 0.02)), [0.07, 0.07, 0.07], M.coco);
  return g;
}
const umbrellaCanopy = new THREE.ConeGeometry(1.05, 0.5, 10);
function umbrella() {
  const g = new THREE.Group();
  rod(g, V(0, 0, 0), V(0, 2.1, 0), 0.035, M.chrome);
  const color = [0xe2483a, 0xf2b43a, 0x2fa3b8, 0xffffff][Math.floor(Math.random() * 4)];
  const canopy = new THREE.Mesh(umbrellaCanopy, std(color));
  canopy.position.y = 2.2;
  canopy.castShadow = true;
  g.add(canopy);
  return g;
}
function hut() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    rod(g, V(x, 0, z), V(x, 2.2, z), 0.05, M.wood);
  }
  const plat = new THREE.Mesh(G.box, M.wood);
  plat.scale.set(1.7, 0.12, 1.7);
  plat.position.y = 2.2;
  plat.castShadow = true;
  g.add(plat);
  const cabin = new THREE.Mesh(G.box, M.white);
  cabin.scale.set(1.2, 0.9, 1.2);
  cabin.position.y = 2.75;
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(G.cone, std(0xe2483a));
  roof.scale.set(1.15, 0.6, 1.15);
  roof.rotation.y = PI / 4;
  roof.position.y = 3.6;
  g.add(roof);
  return g;
}
function dune() {
  return blob(new THREE.Group(), V(0, -0.3, 0), [4.6, 1.4, 3.4], M.sand);
}
function buoy() {
  const g = new THREE.Group();
  blob(g, V(0, -0.3, 0), [0.32, 0.4, 0.32], M.buoy);
  blob(g, V(0, 0.08, 0), [0.2, 0.1, 0.2], M.white);
  return g;
}
function seaRock() {
  const m = new THREE.Mesh(G.rock, M.rock);
  m.scale.set(1.2, 0.7, 1.1);
  m.position.y = -0.25;
  m.castShadow = true;
  return m;
}
function lighthouse() {
  const g = new THREE.Group();
  rod(g, V(0, 0, 0), V(0, 6, 0), 0.9, M.lighthouse, G.taper);
  const band = new THREE.Mesh(G.cyl, M.buoy);
  setRod(band, V(0, 2.6, 0), V(0, 3.2, 0), 0.82);
  g.add(band);
  blob(g, V(0, 6.3, 0), [0.45, 0.4, 0.45], M.lamp);
  return g;
}

// 按侧边分槽位：沙滩一侧与海上一侧，各自循环
const scenery = [];
function addSlot(obj, xMin, xMax, z, y = 0) {
  obj.position.set(rand(xMin, xMax), y, z);
  scene.add(obj);
  scenery.push({ o: obj, xMin, xMax });
}
const SAND_KINDS = [palm, palm, palm, umbrella, umbrella, hut, dune, dune];
for (let i = 0; i < 24; i++) {
  addSlot(SAND_KINDS[Math.floor(Math.random() * SAND_KINDS.length)](), -14, -5.2, -200 + i * 8.6);
}
for (let i = 0; i < 16; i++) {
  const item = i % 3 === 0 ? seaRock() : buoy();
  addSlot(item, 5.5, 13, -200 + i * 12.5, item.isMesh ? item.position.y : -0.45);
}
addSlot(lighthouse(), 34, 38, -150, -0.5);

// ---------- 云与海鸥 / clouds & gulls ----------
const cloudMat = std(0xffffff, { roughness: 1, emissive: 0x222222 });
const clouds = [];
for (let i = 0; i < 7; i++) {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(G.sph, cloudMat);
    m.scale.set(rand(1.6, 2.6), rand(0.8, 1.2), rand(1.2, 1.8));
    m.position.set(k * 1.6 - 2.4 + rand(-0.3, 0.3), rand(-0.1, 0.4), rand(-0.4, 0.4));
    g.add(m);
  }
  g.position.set(rand(-40, 40), rand(9, 14), -200 + i * 28 + rand(-8, 8));
  scene.add(g);
  clouds.push(g);
}
const gullMat = std(0xfbfbf8, { roughness: 0.7, side: THREE.DoubleSide });
const gulls = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  blob(g, V(0, 0, 0), [0.07, 0.05, 0.18], gullMat);
  const wings = [];
  for (const side of [-1, 1]) {
    const wp = new THREE.Group();
    wp.position.set(0, 0.02, 0);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.1), gullMat);
    w.position.x = side * 0.25;
    wp.add(w);
    g.add(wp);
    wings.push(wp);
  }
  g.position.set(rand(-16, 16), rand(7, 10), -200 + i * 50);
  scene.add(g);
  gulls.push({ g, wings, phase: rand(0, TAU) });
}

// ---------- 自行车 / bicycle ----------
const bike = new THREE.Group();
scene.add(bike);

function wheel(z, rear) {
  const axle = new THREE.Group();
  axle.position.set(0, WHEEL_R, z);
  bike.add(axle);
  const spin = new THREE.Group();
  axle.add(spin);
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.04, 0.05, 10, 36), M.rubber);
  tire.rotation.y = PI / 2;
  tire.castShadow = true;
  spin.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.1, 0.012, 6, 36), M.chrome);
  rim.rotation.y = PI / 2;
  spin.add(rim);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    rod(spin, V(0, 0, 0), V(0, Math.cos(a) * (WHEEL_R - 0.1), Math.sin(a) * (WHEEL_R - 0.1)), 0.006, M.chrome);
  }
  rod(spin, V(-0.08, 0, 0), V(0.08, 0, 0), 0.05, M.chrome);
  if (rear) rod(spin, V(0.08, 0, 0), V(0.11, 0, 0), 0.07, M.chrome);
  return spin;
}
const wheelFront = wheel(-0.7, false);
const wheelRear = wheel(0.55, true);

const RA = V(0, WHEEL_R, 0.55);
const FA = V(0, WHEEL_R, -0.7);
const ST = V(0, 1.08, 0.2);
const HT = V(0, 1.2, -0.52);
const HB = V(0, 0.92, -0.52);
rod(bike, BB, ST, 0.035, M.frame);
rod(bike, ST, HT, 0.03, M.frame);
rod(bike, BB, HB, 0.035, M.frame);
rod(bike, HT, V(0, 1.32, -0.56), 0.03, M.chrome);
for (const s of [-1, 1]) {
  const off = (p, k = 1) => V(p.x + s * 0.12 * k, p.y, p.z);
  rod(bike, off(BB), off(RA), 0.026, M.frame);
  rod(bike, off(ST), off(RA), 0.02, M.frame);
  rod(bike, off(HB), V(FA.x + s * 0.06, FA.y, FA.z), 0.024, M.frame);
}
rod(bike, V(-0.14, BB.y, BB.z), V(0.14, BB.y, BB.z), 0.022, M.chrome);
rod(bike, V(-0.3, 1.36, -0.6), V(0.3, 1.36, -0.6), 0.024, M.chrome);
for (const s of [-1, 1]) {
  blob(bike, V(s * 0.3, 1.36, -0.6), [0.04, 0.04, 0.09], M.rubber);
}
rod(bike, ST, V(0, 1.14, 0.24), 0.02, M.chrome);
blob(bike, V(0, 1.18, 0.24), [0.11, 0.05, 0.22], M.seat);

const basket = new THREE.Group();
basket.position.set(0, 1.12, -0.98);
bike.add(basket);
const basketWall = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.22, 16, 1, true), M.basket);
basketWall.castShadow = true;
basket.add(basketWall);
const basketBottom = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), M.basket);
basketBottom.rotation.x = -PI / 2;
basketBottom.position.y = -0.11;
basket.add(basketBottom);

// 链盘与曲柄
const ringGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.025, 28);
ringGeo.rotateZ(PI / 2);
const chainring = new THREE.Mesh(ringGeo, M.chrome);
chainring.position.copy(BB);
bike.add(chainring);
const crankArms = [-1, 1].map(() => rod(bike, BB, BB.clone().add(V(0, -0.1, 0)), 0.02, M.chrome));
const pedals = [-1, 1].map(() => {
  const p = new THREE.Mesh(G.box, M.rubber);
  p.scale.set(0.14, 0.03, 0.09);
  bike.add(p);
  return p;
});

// ---------- 鹈鹕 / pelican ----------
const bird = new THREE.Group();
bike.add(bird);
const upper = new THREE.Group();
upper.position.copy(PIVOT);
bird.add(upper);

// 躯干：尾到胸的椭球，躯干随踩踏左右摇摆
{
  const T = V(0, 1.36, 0.36);
  const C = V(0, 1.92, -0.14);
  const dir = new THREE.Vector3().subVectors(C, T).normalize();
  blob(upper, toU(T.clone().add(C).multiplyScalar(0.5)), [0.27, 0.26, 0.5], M.body, dir);
  blob(upper, toU(V(0, 1.4, 0.7)), [0.15, 0.05, 0.22], M.wing, V(0, 0.12, 1));
  blob(upper, toU(V(0, 1.46, 0.08)), [0.22, 0.2, 0.34], M.body, V(0, -0.2, 1));
}

// 翅膀：羽片为挤出形状，根部在肩上，rest 为折叠姿态，up 为展开
const wingShape = (() => {
  const L = 1.05;
  const s = new THREE.Shape();
  s.moveTo(0, 0.2);
  s.quadraticCurveTo(L * 0.5, 0.26, L * 0.92, 0.04);
  s.lineTo(L, -0.1);
  s.quadraticCurveTo(L * 0.6, -0.16, L * 0.25, -0.2);
  s.lineTo(0, -0.14);
  s.closePath();
  return s;
})();
const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
  depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 10,
});
wingGeo.translate(0, 0, -0.025);
const tipShape = new THREE.Shape();
tipShape.moveTo(0.66, 0.14);
tipShape.quadraticCurveTo(0.86, 0.1, 1.05, -0.02);
tipShape.lineTo(1.05, -0.1);
tipShape.quadraticCurveTo(0.84, -0.15, 0.66, -0.17);
tipShape.closePath();
const tipGeo = new THREE.ExtrudeGeometry(tipShape, { depth: 0.06, bevelEnabled: false, curveSegments: 8 });
tipGeo.translate(0, 0, -0.03);

const WING_REST = V(0.15, -0.8, 0.6).normalize();
const WING_UP = V(0.8, 0.55, -0.2).normalize();
const wingDir = new THREE.Vector3();
const wings = [-1, 1].map((side) => {
  const root = new THREE.Group();
  root.position.copy(toU(V(side * 0.24, 1.9, -0.06)));
  upper.add(root);
  const body = new THREE.Mesh(wingGeo, M.wing);
  body.castShadow = true;
  root.add(body);
  const tip = new THREE.Mesh(tipGeo, M.tip);
  root.add(tip);
  return { root, side };
});
function setWing(w, f) {
  wingDir.lerpVectors(WING_REST, WING_UP, f).normalize();
  wingDir.x *= w.side;
  w.root.quaternion.setFromUnitVectors(AXIS_X, wingDir);
}

// 脖子：6 段圆柱 + 关节球，每帧按控制点重排
const NECK_SEG = 6;
const neckRods = [];
const neckJoints = [];
for (let i = 0; i < NECK_SEG; i++) neckRods.push(rod(upper, V(0, 0, 0), V(0, 0.1, 0), 0.1, M.body));
for (let i = 0; i <= NECK_SEG; i++) neckJoints.push(blob(upper, V(0, 0, 0), [0.1, 0.1, 0.1], M.body));
const neckCurve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)]);
const neckPts = Array.from({ length: NECK_SEG + 1 }, () => V(0, 0, 0));
const headBase = V(0, 2.58, -0.5);
const head = blob(upper, V(0, 0, 0), [0.15, 0.15, 0.19], M.body);
const eyes = [-1, 1].map((s) => blob(upper, V(0, 0, 0), [0.04, 0.04, 0.04], M.eye));
const beakUp = new THREE.Mesh(G.taper, M.beak);
const beakLow = new THREE.Mesh(G.taper, M.beak);
const pouch = blob(upper, V(0, 0, 0), [0.1, 0.2, 0.17], M.pouch);
upper.add(beakUp, beakLow);
beakUp.castShadow = beakLow.castShadow = true;

// 腿：髋 → 膝 → 脚，两骨骼 IK，脚放在踏板上
const HIP_L = V(-0.13, 1.25, 0.22);
const HIP_R = V(0.13, 1.25, 0.22);
const THIGH = 0.5;
const SHIN = 0.5;
const legs = [HIP_L, HIP_R].map((hip) => {
  const part = () => {
    const m = new THREE.Mesh(G.cyl, M.leg);
    m.castShadow = true;
    bird.add(m);
    return m;
  };
  const thigh = part();
  const shin = part();
  const kneeJoint = blob(bird, V(0, 0, 0), [0.055, 0.055, 0.055], M.leg);
  const foot = blob(bird, V(0, 0, 0), [0.06, 0.025, 0.13], M.leg, V(0, 0, -1));
  return { hip, knee: V(0, 0, 0), thigh, shin, kneeJoint, foot };
});

const tmpD = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const poleFwd = V(0, 0, -1);
// 两骨骼 IK：膝盖朝前弯，返回实际可达的脚位
function solveLeg(leg, target) {
  tmpD.subVectors(target, leg.hip);
  let len = clamp(tmpD.length(), 0.001, THIGH + SHIN - 0.002);
  const u = tmpD.clone().normalize();
  const a = (THIGH * THIGH - SHIN * SHIN + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(0, THIGH * THIGH - a * a));
  const base = leg.hip.clone().addScaledVector(u, a);
  tmpP.copy(poleFwd).addScaledVector(u, -poleFwd.dot(u)).normalize();
  leg.knee.copy(base).addScaledVector(tmpP, h);
  return leg.hip.clone().addScaledVector(u, len);
}

// ---------- 状态与输入 / state & input ----------
const state = {
  started: false,
  paused: false,
  v: 0,
  dist: 0,
  fish: 0,
  laneIdx: 1,
  X: 0,
  hy: 0,
  vy: 0,
  theta: 0,
  wheelAng: 0,
  effort: 0,
  roll: 0,
  shake: 0,
  wobble: 0,
  hopReq: 0,
  camMode: 0,
  orbit: 0,
  best: 0,
  muted: false,
};
const held = { pointer: false, pedalKey: false, brakeKey: false };
let spawnAcc = 0;
let nextSpawn = 9;

try {
  state.best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch (err) {
  state.best = 0;
}

// 音频：Web Audio 合成，首次交互后启动
const audio = { ctx: null, master: null, wind: null, windF: null };
function audioUnlock() {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = state.muted ? 0 : 0.55;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const windF = ctx.createBiquadFilter();
    windF.type = 'bandpass';
    windF.frequency.value = 500;
    windF.Q.value = 0.6;
    const wind = ctx.createGain();
    wind.gain.value = 0;
    src.connect(windF).connect(wind).connect(master);
    src.start();
    Object.assign(audio, { ctx, master, wind, windF });
  } catch (err) {
    // 无音频也能玩
  }
}
function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 1, when = 0 } = {}) {
  const { ctx, master } = audio;
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const sfx = {
  click: () => tone(1500, 0.03, { type: 'square', vol: 0.035, slide: 0.6 }),
  chime: () => { tone(988, 0.18, { vol: 0.16 }); tone(1319, 0.26, { vol: 0.12, when: 0.07 }); },
  thud: () => tone(120, 0.35, { type: 'triangle', vol: 0.4, slide: 0.4 }),
};
function setMuted(m) {
  state.muted = m;
  if (audio.master) audio.master.gain.setTargetAtTime(m ? 0 : 0.55, audio.ctx.currentTime, 0.05);
}

// 指针：按住踩踏板，横滑变道，上滑跳跃
let anchorX = 0;
let anchorY = 0;
const isUi = (target) => target instanceof Element && target.closest('button, .help, .overlay');
stage.addEventListener('pointerdown', (e) => {
  if (isUi(e.target)) return;
  audioUnlock();
  start();
  held.pointer = true;
  anchorX = e.clientX;
  anchorY = e.clientY;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!held.pointer) return;
  const dx = e.clientX - anchorX;
  const dy = e.clientY - anchorY;
  if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) {
    changeLane(Math.sign(dx));
    anchorX = e.clientX;
    anchorY = e.clientY;
  } else if (dy < -44 && Math.abs(dy) > Math.abs(dx)) {
    hop();
    anchorX = e.clientX;
    anchorY = e.clientY;
  }
});
const release = () => { held.pointer = false; };
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);

// 键盘：Space/W/↑ 踩踏，←→/AD 变道，J/K 跳跃，S/↓ 刹车，C 镜头，P/Esc 暂停，M 声音，R 重来，H 快捷键
const PEDAL_KEYS = ['Space', 'KeyW', 'ArrowUp'];
const BRAKE_KEYS = ['KeyS', 'ArrowDown'];
const ONE_SHOT = {
  ArrowLeft: () => changeLane(-1),
  KeyA: () => changeLane(-1),
  ArrowRight: () => changeLane(1),
  KeyD: () => changeLane(1),
  KeyJ: () => hop(),
  KeyK: () => hop(),
  KeyC: () => cycleCamera(),
  KeyP: () => togglePause(),
  Escape: () => (helpEl.hidden ? togglePause() : toggleHelp(false)),
  KeyM: () => setMuted(!state.muted),
  KeyR: () => reset(),
  KeyH: () => toggleHelp(),
};
window.addEventListener('keydown', (e) => {
  const k = e.code;
  if (PEDAL_KEYS.includes(k) || BRAKE_KEYS.includes(k) || ONE_SHOT[k]) e.preventDefault();
  audioUnlock();
  if (PEDAL_KEYS.includes(k)) { held.pedalKey = true; start(); }
  if (BRAKE_KEYS.includes(k)) held.brakeKey = true;
  if (ONE_SHOT[k] && !e.repeat) ONE_SHOT[k]();
});
window.addEventListener('keyup', (e) => {
  if (PEDAL_KEYS.includes(e.code)) held.pedalKey = false;
  if (BRAKE_KEYS.includes(e.code)) held.brakeKey = false;
});
window.addEventListener('blur', () => { held.pedalKey = held.brakeKey = held.pointer = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

function start() {
  if (state.started) return;
  state.started = true;
  hideToast();
}
function changeLane(dir) {
  if (!dir) return;
  state.laneIdx = clamp(state.laneIdx + dir, 0, LANES.length - 1);
}
function hop() {
  state.hopReq = 0.18;
  if (!state.started) start();
}
function setPaused(p) {
  if (!state.started && p) return;
  state.paused = p;
  if (p) saveBest();
  $('pause').hidden = !p;
  $('btn-pause').setAttribute('aria-pressed', String(p));
}
function togglePause() {
  if (!state.started) return;
  setPaused(!state.paused);
}
// 打开快捷键时自动暂停，关闭时只恢复由它造成的暂停
let helpPaused = false;
function toggleHelp(force) {
  const open = force === undefined ? helpEl.hidden : force;
  helpEl.hidden = !open;
  if (open && state.started && !state.paused) {
    helpPaused = true;
    setPaused(true);
  } else if (!open && helpPaused) {
    helpPaused = false;
    setPaused(false);
  }
}
function cycleCamera() {
  state.camMode = (state.camMode + 1) % CAM_NAMES.length;
  toast(`镜头：${CAM_NAMES[state.camMode]}`);
}
function reset() {
  saveBest();
  Object.assign(state, { started: false, paused: false, v: 0, dist: 0, fish: 0, laneIdx: 1, hy: 0, vy: 0, wobble: 0, shake: 0 });
  for (const o of obstacles) { o.on = false; o.g.visible = false; }
  for (const f of fishes) { f.on = false; f.g.visible = false; }
  spawnAcc = 0;
  nextSpawn = 9;
  $('pause').hidden = true;
  toast('按住屏幕或 Space 开始踩踏');
}

// ---------- 障碍与鱼 / obstacles & fish ----------
const CRATE_TOP = 0.7;
const ROCK_TOP = 0.5;
const obstacles = [];
for (let i = 0; i < 14; i++) {
  const kind = i % 2 ? 'crate' : 'rock';
  const g = new THREE.Group();
  if (kind === 'crate') {
    const box = new THREE.Mesh(G.box, M.crate);
    box.scale.set(0.7, 0.7, 0.7);
    box.castShadow = true;
    g.add(box);
    for (const y of [-0.22, 0.22]) {
      const band = new THREE.Mesh(G.box, M.crateBand);
      band.scale.set(0.73, 0.06, 0.73);
      band.position.y = y;
      g.add(band);
    }
  } else {
    const rock = new THREE.Mesh(G.stone, M.rock);
    rock.scale.set(1.25, 0.9, 1.1);
    rock.castShadow = true;
    g.add(rock);
  }
  g.visible = false;
  scene.add(g);
  obstacles.push({ g, kind, top: kind === 'crate' ? CRATE_TOP : ROCK_TOP, on: false, hit: false, fall: 0, vx: 0 });
}

const fishProto = new THREE.Group();
{
  const body = new THREE.Mesh(G.sph, M.fish);
  body.scale.set(0.12, 0.1, 0.28);
  body.castShadow = true;
  fishProto.add(body);
  const tail = new THREE.Mesh(G.cone.clone().rotateX(PI / 2), M.fish);
  tail.scale.set(0.1, 0.1, 0.18);
  tail.position.z = -0.36;
  fishProto.add(tail);
  const eye = new THREE.Mesh(G.sph, M.eye);
  eye.scale.setScalar(0.022);
  eye.position.set(0.06, 0.03, 0.17);
  fishProto.add(eye);
}
const fishes = [];
for (let i = 0; i < 40; i++) {
  const g = fishProto.clone();
  g.visible = false;
  scene.add(g);
  fishes.push({ g, on: false, base: 1, phase: rand(0, TAU), pop: 0 });
}

// 篮子里的鱼（数量随收集增加）
const basketFish = Array.from({ length: 6 }, (_, i) => {
  const g = fishProto.clone();
  g.scale.setScalar(0.55);
  g.position.set((i % 3 - 1) * 0.1, -0.02 + Math.floor(i / 3) * 0.06, (i % 2) * 0.05 - 0.03);
  g.rotation.y = rand(-0.5, 0.5);
  g.visible = false;
  basket.add(g);
  return g;
});

function takeFree(list) {
  return list.find((o) => !o.on);
}
function spawnObstacle(lane, kind) {
  const o = obstacles.find((x) => !x.on && x.kind === kind) || obstacles.find((x) => !x.on);
  if (!o) return;
  o.on = true;
  o.hit = false;
  o.fall = 0;
  o.g.visible = true;
  o.g.position.set(LANES[lane], o.kind === 'crate' ? 0.35 : 0.25, -95);
  o.g.rotation.set(0, rand(-0.3, 0.3), 0);
}
function spawnFishRow(lane, n = 5) {
  for (let i = 0; i < n; i++) {
    const f = takeFree(fishes);
    if (!f) return;
    f.on = true;
    f.pop = 0;
    f.g.visible = true;
    f.g.scale.setScalar(1);
    f.base = 0.8 + 0.6 * Math.sin((i / (n - 1)) * PI);
    f.g.position.set(LANES[lane], f.base, -95 - i * 1.1);
  }
}
function spawnPattern() {
  const r = Math.random();
  if (r < 0.55) {
    spawnObstacle(Math.floor(Math.random() * 3), Math.random() < 0.5 ? 'crate' : 'rock');
  } else if (r < 0.85) {
    const open = Math.floor(Math.random() * 3);
    for (let lane = 0; lane < 3; lane++) {
      if (lane !== open) spawnObstacle(lane, Math.random() < 0.5 ? 'crate' : 'rock');
    }
    if (Math.random() < 0.6) spawnFishRow(open, 4);
  } else {
    spawnFishRow(Math.floor(Math.random() * 3), 5);
  }
}

// ---------- 模拟步进 / simulation step ----------
function crash(o) {
  o.hit = true;
  o.fall = 0;
  o.vx = (o.g.position.x < state.X ? -1 : 1) * 1.8;
  state.v *= 0.35;
  state.shake = 0.5;
  state.wobble = 1;
  sfx.thud();
  toast('撞上了，速度下降');
}

function step(ds, t) {
  const pedal = held.pointer || held.pedalKey;
  const brake = held.brakeKey;
  const accel = pedal ? 4.6 * (1 - state.v / VMAX) : 0;
  const drag = 0.35 + 0.05 * state.v;
  const brakeF = brake ? 7 : 0;
  state.v = Math.max(0, state.v + (accel - drag - brakeF) * ds);
  const move = state.v * ds;
  state.dist += move;
  state.effort += ((pedal ? 1 : 0) - state.effort) * Math.min(1, ds * 6);

  // 踏板与轮子
  state.theta += (move / WHEEL_R) / GEAR;
  if (Math.floor(state.theta / PI) !== Math.floor((state.theta - (move / WHEEL_R) / GEAR) / PI) && state.v > 0.8) sfx.click();
  state.wheelAng += move / WHEEL_R;

  // 跳跃
  if (state.hopReq > 0) state.hopReq -= ds;
  if (state.hopReq > 0 && state.hy <= 0.001) {
    state.vy = 5.2;
    state.hopReq = 0;
  }
  state.vy -= 12 * ds;
  state.hy += state.vy * ds;
  if (state.hy <= 0) {
    state.hy = 0;
    state.vy = 0;
  }

  // 变道与车身倾斜
  const targetX = LANES[state.laneIdx];
  state.X += (targetX - state.X) * Math.min(1, ds * 9);
  state.roll += ((targetX - state.X) * 0.35 - state.roll) * Math.min(1, ds * 8);
  state.wobble = Math.max(0, state.wobble - ds * 1.4);
  state.shake = Math.max(0, state.shake - ds * 2.2);
  deckMat.map.offset.y = state.dist / 2.4;

  // 生成
  spawnAcc += move;
  if (spawnAcc > nextSpawn) {
    spawnPattern();
    spawnAcc = 0;
    nextSpawn = rand(9, 14);
  }

  // 障碍：移动 / 碰撞 / 倒下
  const bx = state.X;
  const by = state.hy;
  for (const o of obstacles) {
    if (!o.on) continue;
    if (o.hit) {
      o.fall += ds;
      o.g.position.x += o.vx * ds;
      o.g.position.y += ds * 2.5;
      o.g.position.z += move * 0.4;
      o.g.rotation.x += ds * 7;
      o.g.rotation.z += ds * 5;
      if (o.fall > 1.1) { o.on = false; o.g.visible = false; }
      continue;
    }
    o.g.position.z += move;
    if (o.g.position.z > 3) { o.on = false; o.g.visible = false; continue; }
    if (Math.abs(o.g.position.z) < 0.55 && Math.abs(o.g.position.x - bx) < 0.5 && by < o.top - 0.1) crash(o);
  }

  // 鱼：移动 / 收集
  for (const f of fishes) {
    if (!f.on) continue;
    if (f.pop > 0) {
      f.pop -= ds;
      f.g.scale.setScalar(Math.max(0.01, f.pop / 0.25));
      f.g.position.y += ds * 3;
      if (f.pop <= 0) { f.on = false; f.g.visible = false; }
      continue;
    }
    f.g.position.z += move;
    f.g.position.y = f.base + Math.sin(t * 3 + f.phase) * 0.05;
    f.g.rotation.y = Math.sin(t * 2 + f.phase) * 0.4;
    if (f.g.position.z > 3) { f.on = false; f.g.visible = false; continue; }
    if (Math.abs(f.g.position.z) < 0.7 && Math.abs(f.g.position.x - bx) < 0.55 && Math.abs(f.g.position.y - (by + 1.0)) < 0.85) {
      f.pop = 0.25;
      state.fish += 1;
      sfx.chime();
      $('fish').classList.remove('bump');
      void $('fish').offsetWidth;
      $('fish').classList.add('bump');
    }
  }

  // 滚动装饰与海浪
  for (const s of scenery) {
    s.o.position.z += move;
    if (s.o.position.z > 22) {
      s.o.position.z -= 200;
      s.o.position.x = rand(s.xMin, s.xMax);
    }
  }
  for (const p of posts) {
    p.position.z += move;
    if (p.position.z > 6) p.position.z -= POST_STEP * 44;
  }
  for (const c of clouds) {
    c.position.z += move * 0.25;
    c.position.x += ds * 0.6;
    if (c.position.z > 20) { c.position.z -= 220; c.position.x = rand(-40, 40); }
  }
  for (const g of gulls) {
    g.g.position.z += move * 0.5 - ds * 1.5;
    g.g.position.x += Math.sin(t * 0.7 + g.phase) * ds * 1.2;
    if (g.g.position.z > 14 || g.g.position.z < -210) {
      g.g.position.z = -200 + rand(-10, 10);
      g.g.position.x = rand(-16, 16);
    }
  }
  if (audio.wind) {
    audio.wind.gain.setTargetAtTime(clamp(state.v / VMAX, 0, 1) * 0.1, audio.ctx.currentTime, 0.1);
    audio.windF.frequency.setTargetAtTime(300 + state.v * 40, audio.ctx.currentTime, 0.2);
  }
}

// ---------- 动画 / pose ----------
function animate(t) {
  const sway = Math.sin(state.theta);
  // 自行车
  bike.position.set(state.X, state.hy, 0);
  bike.rotation.z = -state.roll * 0.6 + state.wobble * Math.sin(t * 22) * 0.12;
  bike.rotation.y = sway * 0.012;
  wheelFront.rotation.x = -state.wheelAng;
  wheelRear.rotation.x = -state.wheelAng;
  chainring.rotation.x = -state.theta;
  basket.rotation.z = -bike.rotation.z * 0.5;

  // 上身摇摆、胸部前倾
  upper.rotation.z = sway * 0.035 * (0.5 + state.effort);
  upper.rotation.x = -0.05 * state.effort - state.wobble * 0.2;
  pouch.scale.y = 0.2 * (1 + 0.35 * state.effort + 0.04 * Math.sin(t * 7));

  // 颈部与头：S 形控制点，随踩踏起伏
  const bob = Math.sin(t * 3.2) * 0.02 + state.effort * 0.03 * sway;
  const pts = [V(0, 1.95, -0.14), V(0, 2.2, -0.28), V(0, 2.42, -0.36), V(0, headBase.y + bob, headBase.z)];
  neckCurve.points = pts;
  for (let i = 0; i <= NECK_SEG; i++) neckPts[i].copy(neckCurve.getPoint(i / NECK_SEG));
  for (let i = 0; i < NECK_SEG; i++) {
    const r = 0.1 - (i / NECK_SEG) * 0.025;
    setRod(neckRods[i], toU(neckPts[i]), toU(neckPts[i + 1]), r);
  }
  for (let i = 0; i <= NECK_SEG; i++) {
    neckJoints[i].position.copy(toU(neckPts[i]));
    neckJoints[i].scale.setScalar(0.1 - (i / NECK_SEG) * 0.025);
  }
  const H = V(0, headBase.y + bob, headBase.z);
  head.position.copy(toU(H));
  for (const [i, s] of [-1, 1].entries()) eyes[i].position.copy(toU(H).add(V(s * 0.1, 0.04, -0.06)));
  setRod(beakUp, toU(V(0, H.y - 0.08, H.z - 0.16)), toU(V(0, H.y - 0.2, H.z - 0.92)), 0.085);
  setRod(beakLow, toU(V(0, H.y - 0.1, H.z - 0.2)), toU(V(0, H.y - 0.22, H.z - 0.84)), 0.045);
  pouch.position.copy(toU(V(0, H.y - 0.33, H.z - 0.5)));

  // 翅膀：空中拍翅，地面轻微扇动
  const airborne = state.hy > 0.02;
  const flap = airborne
    ? 0.55 + 0.45 * Math.sin(t * 12)
    : 0.06 + 0.05 * Math.sin(t * 2.4) + state.effort * 0.04 * Math.sin(t * 9);
  for (const w of wings) setWing(w, flap);

  // 腿：脚跟随曲柄，IK 求膝
  for (const [i, leg] of legs.entries()) {
    const ang = state.theta + (i === 0 ? PI : 0);
    const pedal = V(i === 0 ? -0.16 : 0.16, BB.y + CRANK_R * Math.cos(ang), BB.z - CRANK_R * Math.sin(ang));
    const foot = solveLeg(leg, pedal.clone().add(V(0, 0.04, 0)));
    setRod(leg.thigh, leg.hip, leg.knee, 0.05);
    setRod(leg.shin, leg.knee, foot, 0.04);
    leg.kneeJoint.position.copy(leg.knee);
    leg.foot.position.copy(foot).add(V(0, 0.02, 0.02));
    pedals[i].position.copy(pedal);
    setRod(crankArms[i], V(i === 0 ? -0.1 : 0.1, BB.y, BB.z), pedal, 0.02);
  }
}

// ---------- 镜头 / camera ----------
const CAM_NAMES = ['追随', '侧面', '环绕'];
const camPos = V(0, 2, 5);
const camLook = V(0, 1.2, -3);
const desired = V(0, 0, 0);
const desiredLook = V(0, 0, 0);
function updateCamera(dt) {
  const k = clamp(0.9 / camera.aspect, 1, 1.9);
  const X = state.X;
  const y = state.hy;
  state.orbit += dt * 0.22;
  if (state.camMode === 0) {
    desired.set(X * 0.5, 2.3 + y * 0.4, 5 * k);
    desiredLook.set(X * 0.4, 1.25 + y * 0.5, -3);
  } else if (state.camMode === 1) {
    desired.set(X + 6.6 * k, 1.7 + y * 0.3, 0);
    desiredLook.set(X, 1.15 + y, 0);
  } else {
    desired.set(X + Math.sin(state.orbit) * 5.2 * k, 2.2 + y * 0.3, Math.cos(state.orbit) * 5.2 * k);
    desiredLook.set(X, 1.1 + y, 0);
  }
  const f = 1 - Math.exp(-dt * (state.camMode === 2 ? 3 : 6));
  camPos.lerp(desired, f);
  camLook.lerp(desiredLook, f);
  const sh = state.shake * 0.12;
  camera.position.set(camPos.x + rand(-sh, sh), camPos.y + rand(-sh, sh), camPos.z);
  camera.lookAt(camLook);
  sunLight.target.position.set(X, 0, 0);
  sunLight.position.copy(sunDir).multiplyScalar(40).add(sunLight.target.position);
  sky.position.copy(camera.position);
  sunGlow.position.copy(sunDir).multiplyScalar(220).add(camera.position);
}

// ---------- 界面 / UI ----------
const $ = (id) => document.getElementById(id);
const helpEl = $('help');
const toastEl = $('toast');
let toastTimer = 0;
function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function hideToast() {
  toastEl.classList.remove('show');
}
function saveBest() {
  if (state.dist > state.best) {
    state.best = state.dist;
    try { localStorage.setItem(BEST_KEY, String(Math.floor(state.best))); } catch (err) { /* 无存储时只保留内存值 */ }
  }
}
let hud = { fish: '', dist: '', best: '' };
function updateHud() {
  const fishText = String(state.fish);
  const distText = state.dist >= 1000 ? `${(state.dist / 1000).toFixed(2)} km` : `${Math.floor(state.dist)} m`;
  const bestText = state.best >= 1 ? `最佳 ${Math.floor(state.best)} m` : '';
  if (hud.fish !== fishText) { $('fish').textContent = fishText; hud.fish = fishText; }
  if (hud.dist !== distText) { $('dist').textContent = distText; hud.dist = distText; }
  if (hud.best !== bestText) { $('best').textContent = bestText; hud.best = bestText; }
  basketFish.forEach((g, i) => { g.visible = i < Math.min(state.fish, 6); });
}
$('btn-sound').addEventListener('click', (e) => {
  audioUnlock();
  setMuted(!state.muted);
  $('btn-sound').setAttribute('aria-pressed', String(state.muted));
  e.currentTarget.blur();
});
$('btn-cam').addEventListener('click', (e) => { cycleCamera(); e.currentTarget.blur(); });
$('btn-pause').addEventListener('click', (e) => { togglePause(); e.currentTarget.blur(); });
$('btn-resume').addEventListener('click', (e) => { togglePause(); e.currentTarget.blur(); });
$('btn-help').addEventListener('click', (e) => { toggleHelp(); e.currentTarget.blur(); });
$('btn-help-close').addEventListener('click', (e) => { toggleHelp(false); e.currentTarget.blur(); });

// ---------- 主循环与尺寸 / loop & resize ----------
function resize() {
  const w = stage.clientWidth || window.innerWidth;
  const h = stage.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.75 ? 62 : 52;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let clockT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const live = state.started && !state.paused;
  clockT += dt;
  // 未开始或暂停时模拟静止，海浪与镜头仍在动
  if (live) step(dt, clockT);
  mixPalette(state.dist);
  applyPalette();
  updateSea(clockT, state.dist);
  animate(clockT);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
}

function applyPalette() {
  skyU.top.value.copy(cur.top);
  skyU.hor.value.copy(cur.hor);
  skyU.glow.value.copy(cur.sun);
  scene.fog.color.copy(cur.hor);
  seaMat.color.copy(cur.sea);
  sandMat.color.copy(cur.sand);
  sunLight.color.copy(cur.sun);
  sunLight.intensity = cur.sunI;
  hemi.color.copy(cur.top);
  hemi.groundColor.copy(cur.sand);
  hemi.intensity = cur.hemi;
  sunGlow.material.color.copy(cur.sun);
  const e = (cur.el * PI) / 180;
  sunDir.set(0.5, Math.sin(e), -Math.cos(e)).normalize();
  skyU.sunDir.value.copy(sunDir);
}

// 作品尚未开始时给出提示
toast('按住屏幕或 Space 开始踩踏', 4000);
requestAnimationFrame(frame);
