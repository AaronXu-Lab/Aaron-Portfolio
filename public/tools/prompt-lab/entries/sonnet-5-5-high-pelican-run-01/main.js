import * as THREE from './vendor/three.module.min.js';
import { buildPelican } from './pelican.js';

const ID = 'sonnet-5-5-high-pelican-run-01';
const store = {
  get(k, d) { try { const v = localStorage.getItem(ID + ':' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(ID + ':' + k, JSON.stringify(v)); } catch { /* 无存储时忽略 */ } },
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const $ = (id) => document.getElementById(id);
const coarse = matchMedia('(pointer:coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

// ======================= 渲染器 / 场景 =======================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffa879, 34, 128);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xe8c9a0, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---- 天空穹顶 / 太阳 / 星星 ----
const skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 24, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bot;varying float h;void main(){gl_FragColor=vec4(mix(bot,top,smoothstep(0.0,.55,h)),1.);}',
  })
);
sky.renderOrder = -10;
scene.add(sky);
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(15, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }));
const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(34, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true, opacity: 0.25, depthWrite: false }));
sunMesh.add(sunGlow);
scene.add(sunMesh);
const starsGeo = new THREE.BufferGeometry();
{
  const p = [];
  for (let i = 0; i < 260; i++) {
    const a = rnd(0, Math.PI * 2), e = rnd(0.12, 1.2);
    p.push(Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280);
  }
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false }));
scene.add(stars);

// 昼夜关键帧：清晨 → 正午 → 日落 → 夜晚
const C = (h) => new THREE.Color(h);
const KF = [
  { top: C('#6fb7e8'), bot: C('#ffd9b0'), sun: C('#fff1c9'), li: 1.15, hi: 0.85, sy: 0.3, night: 0, sea: C('#3cc6c6'), cloud: C('#fff4e6'), hemiS: C('#cfe8ff'), hemiG: C('#e8c9a0') },
  { top: C('#2f8fe0'), bot: C('#c4e8ff'), sun: C('#ffffff'), li: 1.35, hi: 0.95, sy: 1.0, night: 0, sea: C('#1fb5d4'), cloud: C('#ffffff'), hemiS: C('#d8efff'), hemiG: C('#f0dcb0') },
  { top: C('#5b4fa8'), bot: C('#ff9a6b'), sun: C('#ffb36b'), li: 1.0, hi: 0.72, sy: 0.12, night: 0, sea: C('#2a98a8'), cloud: C('#ffc9a8'), hemiS: C('#ffb59a'), hemiG: C('#7a5a8a') },
  { top: C('#0d1236'), bot: C('#4a3a78'), sun: C('#aab4ff'), li: 0.62, hi: 0.5, sy: 0.55, night: 1, sea: C('#16406e'), cloud: C('#6a6aa8'), hemiS: C('#5560b0'), hemiG: C('#2a2050') },
];
const STOP = 320; // 每段昼夜持续的米数
const env = { top: new THREE.Color(), bot: new THREE.Color(), sun: new THREE.Color(), sea: new THREE.Color(), cloud: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), night: 0 };
function updateEnv(dist) {
  const ph = (((dist / STOP) + 2) % 4 + 4) % 4; // 从日落开始
  const i = Math.floor(ph), a = KF[i], b = KF[(i + 1) % 4];
  let t = ph - i; t = t * t * (3 - 2 * t);
  env.top.copy(a.top).lerp(b.top, t); env.bot.copy(a.bot).lerp(b.bot, t); env.sun.copy(a.sun).lerp(b.sun, t);
  env.sea.copy(a.sea).lerp(b.sea, t); env.cloud.copy(a.cloud).lerp(b.cloud, t);
  env.hs.copy(a.hemiS).lerp(b.hemiS, t); env.hg.copy(a.hemiG).lerp(b.hemiG, t);
  env.night = lerp(a.night, b.night, t);
  const li = lerp(a.li, b.li, t), hi = lerp(a.hi, b.hi, t), sy = lerp(a.sy, b.sy, t);
  skyU.top.value.copy(env.top); skyU.bot.value.copy(env.bot);
  scene.fog.color.copy(env.bot);
  renderer.setClearColor(env.bot);
  hemi.color.copy(env.hs); hemi.groundColor.copy(env.hg); hemi.intensity = hi;
  sun.color.copy(env.sun); sun.intensity = li;
  sunMesh.material.color.copy(env.sun);
  sunGlow.material.color.copy(env.sun);
  sunMesh.position.set(camera.position.x - 70, sy * 170 - 6, camera.position.z - 260);
  sunMesh.scale.setScalar(env.night > 0.5 ? 0.55 : 1);
  stars.material.opacity = clamp((env.night - 0.25) * 1.4, 0, 1);
  stars.position.copy(camera.position);
  seaMat.color.copy(env.sea);
  cloudMat.color.copy(env.cloud);
  bulbMat.color.setHex(0xfff4c4).lerp(C('#ffd24a'), env.night);
  bulbMat.opacity = 0.55 + env.night * 0.45;
}

// ======================= 工具：合并几何体 =======================
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
const UPV = new THREE.Vector3(0, 1, 0);
const SM = (a, b, sx, sz = sx) => { // 两点间的一段
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UPV, d.divideScalar(len)), new THREE.Vector3(sx, len, sz));
};
const P3 = (x, y, z) => new THREE.Vector3(x, y, z);
function bake(parts) {
  const pos = [], col = [];
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    g.applyMatrix4(p.m);
    const a = g.attributes.position.array, c = new THREE.Color(p.c);
    for (let i = 0; i < a.length; i++) pos.push(a[i]);
    for (let i = 0; i < a.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  G.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  G.computeVertexNormals();
  return G;
}
const matV = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
const gBox = new THREE.BoxGeometry(1, 1, 1), gCyl = new THREE.CylinderGeometry(0.7, 1, 1, 7), gCyl2 = new THREE.CylinderGeometry(1, 1, 1, 10), gCone = new THREE.ConeGeometry(1, 1, 8), gBall = new THREE.SphereGeometry(1, 9, 7);
function jitterIco(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3);
    if (!map.has(k)) map.set(k, 0.78 + 0.34 * Math.abs(Math.sin(seed + i * 12.9898 + k.length * 3.1)));
    const f = map.get(k);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.85, p.getZ(i) * f);
  }
  return g;
}

// ======================= 地面 / 道路 / 大海 =======================
const LANES = [-1.6, 0, 1.6];
const ROAD_W = 5.2;
function canvasTex(w, h, draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}
const ROAD_LEN = 260, ROAD_Z0 = 40; // 路从 z=+40 延伸到 z=-220
const roadTile = 8;
const roadTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3b3e4a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.1})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = '#f5efe0';
  g.fillRect(w * 0.025, 0, 6, h); g.fillRect(w * 0.975 - 6, 0, 6, h);
  for (const u of [0.346, 0.654]) { g.fillRect(u * w - 3, 0, 6, 64); g.fillRect(u * w - 3, 128, 6, 64); }
}, 1, ROAD_LEN / roadTile);
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }));
road.rotation.x = -Math.PI / 2; road.position.set(0, 0, ROAD_Z0 - ROAD_LEN / 2); road.receiveShadow = true;
scene.add(road);
for (const s of [-1, 1]) {
  const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, ROAD_LEN), new THREE.MeshStandardMaterial({ color: 0xf0e4cc, roughness: 0.9 }));
  curb.position.set(s * (ROAD_W / 2 + 0.11), 0.05, ROAD_Z0 - ROAD_LEN / 2); curb.receiveShadow = true;
  scene.add(curb);
}

const sandTile = 16;
const sandTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#efd9a8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(130,180,100,.28)' : 'rgba(190,150,90,.2)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(8, 26), rnd(5, 16), Math.random() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(120,90,50,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, 8, ROAD_LEN / sandTile);
const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 });
const sandR = new THREE.Mesh(new THREE.PlaneGeometry(130, ROAD_LEN), sandMat);
sandR.rotation.x = -Math.PI / 2; sandR.position.set(ROAD_W / 2 + 0.2 + 65, -0.03, ROAD_Z0 - ROAD_LEN / 2); sandR.receiveShadow = true;
const sandL = new THREE.Mesh(new THREE.PlaneGeometry(3.4, ROAD_LEN), sandMat.clone());
sandL.material.map = sandTex.clone(); sandL.material.map.repeat.set(0.5, ROAD_LEN / sandTile); sandL.material.map.needsUpdate = true;
sandL.rotation.x = -Math.PI / 2; sandL.position.set(-(ROAD_W / 2 + 0.2 + 1.7), -0.03, ROAD_Z0 - ROAD_LEN / 2); sandL.receiveShadow = true;
scene.add(sandR, sandL);

// 大海：顶点波浪（每帧更新约千个顶点）
const SEA_X0 = -(ROAD_W / 2 + 3.7);
const seaGeo = new THREE.PlaneGeometry(110, ROAD_LEN, 22, 52);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = Float32Array.from(seaGeo.attributes.position.array);
{
  const c = [], p = seaGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = clamp(1 - (p.getX(i) + 55) / 110 * 0, 0, 1); // 占位，渐变在下面按离岸距离算
    const off = (p.getX(i) + 55) / 110; // 0 外海 → 1 岸边
    const k = 0.62 + 0.38 * Math.pow(off, 2.2);
    c.push(k, k * 1.02, k * 1.04);
  }
  seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
}
const seaMat = new THREE.MeshStandardMaterial({ color: 0x3cc6c6, vertexColors: true, flatShading: true, roughness: 0.35, metalness: 0.1 });
const sea = new THREE.Mesh(seaGeo, seaMat);
sea.position.set(SEA_X0 - 55, -0.38, ROAD_Z0 - ROAD_LEN / 2);
sea.receiveShadow = true;
scene.add(sea);
const foam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, ROAD_LEN), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: true }));
foam.rotation.x = -Math.PI / 2; foam.position.set(SEA_X0 - 0.3, -0.3, ROAD_Z0 - ROAD_LEN / 2);
scene.add(foam);
function updateSea(t, dist) {
  const p = seaGeo.attributes.position, a = p.array;
  for (let i = 0; i < p.count; i++) {
    const x = seaBase[i * 3], z = seaBase[i * 3 + 2] - dist; // 波形随世界一起向后流动
    a[i * 3 + 1] = Math.sin(z * 0.32 + t * 1.3) * 0.12 + Math.sin(x * 0.2 + z * 0.12 + t * 0.9) * 0.1;
  }
  p.needsUpdate = true;
  foam.material.opacity = 0.35 + Math.sin(t * 1.6) * 0.2;
  foam.position.x = SEA_X0 - 0.3 + Math.sin(t * 1.2) * 0.25;
}

// ======================= 路边景物（合并几何，一个景物一次绘制） =======================
const SPAN = 192, ZMAX = 30;
const props = [];
function addProp(obj, x, z, reroll) {
  obj.position.x = x; obj.position.z = z;
  obj.userData.reroll = reroll;
  scene.add(obj); props.push(obj);
  return obj;
}
function palmGeo(seed) {
  const parts = [], lean = rnd(-0.5, 0.5), H = rnd(4.2, 6);
  const pts = [];
  for (let i = 0; i <= 5; i++) { const u = i / 5; pts.push(P3(lean * u * u * 1.6, u * H, 0)); }
  for (let i = 0; i < 5; i++) parts.push({ g: gCyl, m: SM(pts[i], pts[i + 1], 0.2 - i * 0.02), c: i % 2 ? 0x9b6b43 : 0x8a5c38 });
  const top = pts[5];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + seed, dx = Math.cos(a), dz = Math.sin(a);
    let prev = top.clone();
    for (let j = 0; j < 3; j++) {
      const L = 1.0 - j * 0.12;
      const nxt = prev.clone().add(P3(dx * L, 0.45 - j * 0.55, dz * L));
      parts.push({ g: gBox, m: SM(prev, nxt, 0.5 - j * 0.12, 0.05), c: k % 2 ? 0x3f9e5a : 0x56b870 });
      prev = nxt;
    }
  }
  parts.push({ g: gBall, m: M(0.2, H - 0.15, 0.1, 0, 0, 0, 0.22), c: 0x6b4423 }, { g: gBall, m: M(-0.18, H - 0.2, -0.12, 0, 0, 0, 0.2), c: 0x6b4423 });
  return bake(parts);
}
const palmGeos = [palmGeo(0.2), palmGeo(1.7), palmGeo(3.1)];
function umbrellaGeo(c1) {
  const parts = [{ g: gCyl2, m: M(0, 1.1, 0, 0, 0, 0, 0.04, 2.2, 0.04), c: 0xe8e0d0 }];
  for (let k = 0; k < 8; k++) parts.push({ g: new THREE.ConeGeometry(1.2, 0.55, 8, 1, false, (k / 8) * Math.PI * 2, Math.PI / 4), m: M(0, 2.3, 0), c: k % 2 ? c1 : 0xfff6e6 });
  parts.push({ g: gBox, m: M(1.2, 0.13, 0.2, 0, 0.3, 0, 0.5, 0.18, 1.6), c: 0xffffff }, { g: gBox, m: M(1.2, 0.13, 0.2, 0, 0.3, 0, 0.52, 0.12, 0.35), c: c1 });
  return bake(parts);
}
const umbGeos = [umbrellaGeo(0xff6b6b), umbrellaGeo(0x2dd4bf), umbrellaGeo(0xffc233)];
const rockGeos = [bake([{ g: jitterIco(1, 1), m: M(0, 0.3, 0, 0, 0, 0, 1, 0.9, 1), c: 0x8d8a99 }, { g: jitterIco(0.6, 5), m: M(1, 0.1, 0.4), c: 0x7b7887 }]), bake([{ g: jitterIco(1.4, 9), m: M(0, 0.4, 0), c: 0x9a96a6 }])];
const hillGeo = bake([{ g: gCone, m: M(0, 9, 0, 0, 0.4, 0, 22, 18, 22), c: 0x7aa86a }, { g: gCone, m: M(14, 6, 6, 0, 1, 0, 15, 12, 15), c: 0x6a9a62 }, { g: gCone, m: M(-12, 5, -4, 0, 2, 0, 14, 10, 14), c: 0x8ab47a }]);
const lighthouseGeo = bake([
  { g: jitterIco(7, 2), m: M(0, -1.5, 0, 0, 0, 0, 1, 0.55, 1), c: 0x8a8794 },
  { g: gCyl, m: M(0, 5, 0, 0, 0, 0, 3.2, 10, 3.2), c: 0xffffff },
  { g: gCyl, m: M(0, 9, 0, 0, 0, 0, 2.7, 4, 2.7), c: 0xe0483f },
  { g: gCyl, m: M(0, 12.5, 0, 0, 0, 0, 2.5, 3, 2.5), c: 0xffffff },
  { g: gCyl2, m: M(0, 14.2, 0, 0, 0, 0, 3.1, 0.3, 3.1), c: 0x3a3a48 },
  { g: gCyl2, m: M(0, 15.2, 0, 0, 0, 0, 1.4, 1.8, 1.4), c: 0xffe9a0 },
  { g: gCone, m: M(0, 17.3, 0, 0, 0, 0, 1.8, 1.6, 1.8), c: 0xe0483f },
]);
const lampGeo = bake([{ g: gCyl2, m: M(0, 1.7, 0, 0, 0, 0, 0.06, 3.4, 0.06), c: 0x4a4a58 }, { g: gBox, m: M(-0.45, 3.4, 0, 0, 0, 0, 1, 0.08, 0.1), c: 0x4a4a58 }]);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff4c4, transparent: true });
const buoyGeo = bake([{ g: gBall, m: M(0, 0.35, 0, 0, 0, 0, 0.45, 0.4, 0.45), c: 0xff5a4a }, { g: gCyl2, m: M(0, 0.35, 0, 0, 0, 0, 0.47, 0.12, 0.47), c: 0xffffff }, { g: gCyl2, m: M(0, 0.9, 0, 0, 0, 0, 0.04, 0.5, 0.04), c: 0x444444 }]);
const sailGeo = bake([{ g: gBox, m: M(0, 0.25, 0, 0, 0, 0, 0.7, 0.45, 2.4), c: 0xfff2dc }, { g: gCyl2, m: M(0, 1.4, 0, 0, 0, 0, 0.04, 2.6, 0.04), c: 0x6a4a35 }, { g: new THREE.ConeGeometry(1, 1, 3), m: M(0.04, 1.7, 0.1, 0, 0, 0, 0.02, 2.3, 0.9), c: 0xff7a59 }]);

function propMesh(geo, mat = matV) { const m = new THREE.Mesh(geo, mat); m.castShadow = false; m.receiveShadow = false; return m; }
function seedProps() {
  // 棕榈：右侧成片，左岸少量
  for (let i = 0; i < 26; i++) {
    const m = propMesh(pick(palmGeos));
    addProp(m, rnd(5, 22), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = rnd(5, 22); o.rotation.y = rnd(0, 6); o.scale.setScalar(rnd(0.85, 1.25)); });
    m.rotation.y = rnd(0, 6);
  }
  for (let i = 0; i < 9; i++) {
    const m = propMesh(pick(palmGeos));
    addProp(m, -rnd(4.2, 5.6), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = -rnd(4.2, 5.6); o.rotation.y = rnd(0, 6); });
    m.scale.setScalar(0.8);
  }
  for (let i = 0; i < 7; i++) {
    const m = propMesh(pick(umbGeos));
    addProp(m, rnd(4.2, 8), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = rnd(4.2, 8); o.rotation.y = rnd(0, 6); });
    m.scale.setScalar(0.85);
  }
  for (let i = 0; i < 12; i++) addProp(propMesh(pick(rockGeos)), rnd(3.6, 30), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = rnd(3.6, 30); o.rotation.y = rnd(0, 6); o.scale.setScalar(rnd(0.5, 1.5)); });
  for (let i = 0; i < 10; i++) { const m = propMesh(pick(rockGeos)); m.userData.y = -0.4; addProp(m, -rnd(8, 60), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = -rnd(8, 60); o.scale.setScalar(rnd(1, 3)); }); m.position.y = -0.4; m.scale.setScalar(rnd(1, 3)); }
  for (let i = 0; i < 6; i++) { const m = propMesh(hillGeo); addProp(m, rnd(70, 120), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = rnd(70, 120); o.rotation.y = rnd(0, 6); }); m.scale.setScalar(rnd(1.2, 2)); m.position.y = -2; }
  // 浮标、帆船
  for (let i = 0; i < 8; i++) { const m = propMesh(buoyGeo); m.userData.bob = true; addProp(m, -rnd(8, 26), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = -rnd(8, 26); }); m.position.y = -0.38; }
  for (let i = 0; i < 3; i++) { const m = propMesh(sailGeo); m.userData.bob = true; addProp(m, -rnd(20, 50), -rnd(0, SPAN) + ZMAX, (o) => { o.position.x = -rnd(20, 50); o.rotation.y = rnd(-0.5, 0.5); }); m.position.y = -0.38; }
  // 灯塔
  const lh = propMesh(lighthouseGeo); addProp(lh, -34, -80, (o) => { o.position.x = -rnd(30, 44); });
  lh.userData.once = true;
  // 路灯（每 24 米一根，SPAN 为 24 的整数倍）
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    g.add(propMesh(lampGeo));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), bulbMat); b.position.set(-0.8, 3.3, 0); g.add(b);
    g.rotation.y = 0; addProp(g, ROAD_W / 2 + 0.7, -i * 24 + ZMAX - 6, null);
    g.userData.lamp = true;
  }
}
// 云
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
const clouds = [];
{
  const cg = bake([{ g: gBall, m: M(0, 0, 0, 0, 0, 0, 8, 3, 4), c: 0xffffff }, { g: gBall, m: M(7, 0.6, 1, 0, 0, 0, 6, 3.3, 3.5), c: 0xffffff }, { g: gBall, m: M(-7, -0.3, 0, 0, 0, 0, 5.5, 2.6, 3), c: 0xffffff }]);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(cg, cloudMat);
    m.position.set(rnd(-160, 160), rnd(34, 62), -rnd(90, 230));
    m.scale.setScalar(rnd(0.7, 1.5)); m.userData.v = rnd(0.5, 2);
    scene.add(m); clouds.push(m);
  }
}
// 海鸥
const gullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
const gulls = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(gBall, gullMat); body.scale.set(0.18, 0.15, 0.5); g.add(body);
  const wings = [-1, 1].map((s) => { const p = new THREE.Group(); const w = new THREE.Mesh(gBox, gullMat); w.scale.set(1.4, 0.03, 0.4); w.position.x = s * 0.7; p.add(w); g.add(p); return { p, s }; });
  g.userData = { wings, a: rnd(0, 6), r: rnd(18, 50), cx: rnd(-40, -10), cy: rnd(7, 16), cz: -rnd(25, 90), sp: rnd(0.2, 0.45) };
  scene.add(g); gulls.push(g);
}

// ======================= 鹈鹕 =======================
const pel = buildPelican();
scene.add(pel.root);

// ======================= 实体：障碍 / 鱼 =======================
const boxGeoCrate = bake([
  { g: gBox, m: M(0, 0.45, 0, 0, 0, 0, 0.95, 0.9, 0.95), c: 0xd9a05b },
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ g: gBox, m: M(a * 0.46, 0.45, b * 0.46, 0, 0, 0, 0.1, 0.94, 0.1), c: 0x8a5a2b })),
  { g: gBox, m: M(0, 0.9, 0, 0, 0, 0, 1, 0.08, 1), c: 0x8a5a2b }, { g: gBox, m: M(0, 0.03, 0, 0, 0, 0, 1, 0.08, 1), c: 0x8a5a2b },
  { g: gBox, m: M(0, 0.45, 0.49, 0, 0, 0.78, 0.09, 1.22, 0.04), c: 0xb5772f }, { g: gBox, m: M(0, 0.45, -0.49, 0, 0, -0.78, 0.09, 1.22, 0.04), c: 0xb5772f },
]);
const coneGeo = bake([
  { g: gBox, m: M(0, 0.03, 0, 0, 0, 0, 0.7, 0.06, 0.7), c: 0x33343c },
  { g: new THREE.ConeGeometry(0.3, 0.85, 10), m: M(0, 0.48, 0), c: 0xff7a1a },
  { g: new THREE.CylinderGeometry(0.19, 0.22, 0.14, 10), m: M(0, 0.5, 0), c: 0xffffff },
  { g: new THREE.CylinderGeometry(0.1, 0.12, 0.12, 10), m: M(0, 0.7, 0), c: 0xffffff },
]);
const wallParts = [];
for (let i = 0; i < 12; i++) wallParts.push({ g: gBox, m: M(-1.45 + i * 0.264, 0.62, 0, 0, 0, 0, 0.27, 0.28, 0.2), c: i % 2 ? 0xffffff : 0xe8483b });
wallParts.push({ g: gBox, m: M(-1.35, 0.3, 0, 0, 0, 0, 0.1, 0.6, 0.12), c: 0x555566 }, { g: gBox, m: M(1.35, 0.3, 0, 0, 0, 0, 0.1, 0.6, 0.12), c: 0x555566 }, { g: gBox, m: M(0, 0.62, 0, 0, 0, 0, 3.2, 0.06, 0.24), c: 0x33343c });
const wallGeo = bake(wallParts);
const boulderGeo = bake([{ g: jitterIco(1.1, 4), m: M(0, 0.85, 0, 0, 0, 0, 1, 1.05, 1), c: 0x8d8a99 }, { g: jitterIco(0.6, 8), m: M(0.55, 0.4, 0.4), c: 0x7b7887 }, { g: gBall, m: M(-0.3, 1.8, 0.1, 0, 0, 0, 0.3, 0.16, 0.3), c: 0x6fae5a }]);
const crabGeo = bake([
  { g: gBall, m: M(0, 0.3, 0, 0, 0, 0, 0.42, 0.22, 0.3), c: 0xf0553f },
  ...[-1, 1].map((s) => ({ g: gBall, m: M(s * 0.4, 0.42, -0.2, 0, 0, 0, 0.17, 0.13, 0.14), c: 0xff7a59 })),
  ...[-1, 1].map((s) => ({ g: gBox, m: SM(P3(s * 0.28, 0.3, -0.1), P3(s * 0.38, 0.4, -0.2), 0.04, 0.04), c: 0xf0553f })),
  ...[-1, 1].flatMap((s) => [0, 1, 2].map((i) => ({ g: gBox, m: SM(P3(s * 0.3, 0.26, -0.06 + i * 0.1), P3(s * 0.55, 0.08, -0.06 + i * 0.12), 0.025, 0.025), c: 0xd94730 }))),
  ...[-1, 1].map((s) => ({ g: gBall, m: M(s * 0.1, 0.5, -0.2, 0, 0, 0, 0.05), c: 0xffffff })),
  ...[-1, 1].map((s) => ({ g: gBall, m: M(s * 0.1, 0.5, -0.24, 0, 0, 0, 0.025), c: 0x111111 })),
]);
function fishGeo(c1, c2) {
  return bake([
    { g: gBall, m: M(0, 0, 0, 0, 0, 0, 0.17, 0.2, 0.42), c: c1 },
    { g: new THREE.ConeGeometry(1, 1, 3), m: M(0, 0, 0.5, Math.PI / 2, 0, 0, 0.16, 0.3, 0.02), c: c2 },
    { g: new THREE.ConeGeometry(1, 1, 3), m: M(0, 0.2, 0.05, 0, 0, 0, 0.02, 0.2, 0.2), c: c2 },
    { g: gBall, m: M(0.1, 0.04, -0.28, 0, 0, 0, 0.04), c: 0x111111 }, { g: gBall, m: M(-0.1, 0.04, -0.28, 0, 0, 0, 0.04), c: 0x111111 },
  ]);
}
const fishG = [fishGeo(0xaedcf5, 0x5fb3e6), fishGeo(0xffd23f, 0xff9f1a)];
const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.35, emissive: 0x335577, emissiveIntensity: 0.25 });
const goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.6, emissive: 0xaa7700, emissiveIntensity: 0.5 });
// 坡道：斜面朝前（-z）升高
const rampGeo = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) > 0) p.setY(i, -0.5);
  g.computeVertexNormals();
  const out = [{ g, m: M(0, 0.275, 0, 0, 0, 0, 1.7, 0.55, 3.2), c: 0xc78b52 }];
  for (let i = 0; i < 6; i++) out.push({ g: gBox, m: M(0, 0.3 - ((i - 2.5) * 0.12), ((i - 2.5) * -0.5), 0, 0, 0, 1.72, 0.04, 0.06), c: 0x8a5a2b });
  out.push({ g: gBox, m: M(-0.8, 0.3, 0, 0, 0, 0, 0.08, 0.5, 3.2), c: 0xffd23f }, { g: gBox, m: M(0.8, 0.3, 0, 0, 0, 0, 0.08, 0.5, 3.2), c: 0xffd23f });
  return bake(out);
})();

const obstacles = [], pickups = [];
function mkObs(type, geo, x, z, hw, hd, h, extra) {
  const mesh = new THREE.Mesh(geo, matV);
  mesh.castShadow = true;
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const o = { type, mesh, x, z, hw, hd, h, fly: null, ...extra };
  obstacles.push(o);
  return o;
}
function mkFish(x, y, z, gold) {
  const mesh = new THREE.Mesh(fishG[gold ? 1 : 0], gold ? goldMat : fishMat);
  mesh.castShadow = true;
  mesh.scale.setScalar(gold ? 1.2 : 0.85);
  scene.add(mesh);
  const f = { mesh, x, y, z, gold, ph: rnd(0, 6), got: false };
  mesh.position.set(x, y, z);
  pickups.push(f);
}

// ---------- 关卡片段 ----------
const Z0 = -112;
function fishLine(lane, n, z, y = 0.95, sp = 2.1) { for (let i = 0; i < n; i++) mkFish(LANES[lane], y, z - i * sp, false); return n * sp; }
function arcOver(lane, zc, span = 5, n = 5, base = 0.95, peak = 2.3) {
  for (let i = 0; i < n; i++) { const u = i / (n - 1), y = base + Math.sin(u * Math.PI) * (peak - base); mkFish(LANES[lane], y, zc + span / 2 - u * span, false); }
}
const others = (l) => [0, 1, 2].filter((i) => i !== l);
const PATTERNS = {
  fishes(S) { const l = Math.floor(rnd(0, 3)); return fishLine(l, 6, Z0); },
  crate(S) {
    const l = Math.floor(rnd(0, 3)), z = Z0 - 6;
    mkObs('crate', boxGeoCrate, LANES[l], z, 0.5, 0.5, 0.95);
    arcOver(l, z, 5, 5, 1, 2.35);
    fishLine(pick(others(l)), 5, Z0 - 2);
    return 15;
  },
  wall(S) {
    const l = Math.floor(rnd(0, 3)), free = l, z = Z0 - 6;
    const pair = free === 1 ? pick([[0], [2]]) : [1];
    // 墙挡住除 free 之外的两条道
    const blocked = others(free);
    const cx = (LANES[blocked[0]] + LANES[blocked[1]]) / 2, hw = Math.abs(LANES[blocked[0]] - LANES[blocked[1]]) / 2 + 0.55;
    if (blocked[0] === 0 && blocked[1] === 2) { // 两侧都挡，只留中间：拆成两面窄墙
      mkObs('crate', boxGeoCrate, LANES[0], z, 0.5, 0.5, 0.95);
      mkObs('crate', boxGeoCrate, LANES[2], z, 0.5, 0.5, 0.95);
    } else {
      const o = mkObs('wall', wallGeo, cx, z, hw, 0.2, 1.15);
      o.mesh.scale.x = (hw * 2) / 3.2;
    }
    fishLine(free, 6, Z0 - 1);
    return 12;
  },
  boulder(S) {
    const l = Math.floor(rnd(0, 3)), z = Z0 - 6, o = others(l);
    mkObs('boulder', boulderGeo, LANES[l], z, 0.95, 0.9, 2.1);
    mkObs('cone', coneGeo, LANES[o[0]], z - 3, 0.35, 0.35, 0.85);
    fishLine(o[1], 6, Z0 - 1);
    return 12;
  },
  cones(S) {
    const l = Math.floor(rnd(0, 3)), o = others(l);
    for (let k = 0; k < 2; k++) for (const i of o) mkObs('cone', coneGeo, LANES[i], Z0 - 4 - k * 5, 0.35, 0.35, 0.85);
    fishLine(l, 7, Z0);
    if (Math.random() < 0.5) mkFish(LANES[l], 0.95, Z0 - 8, true);
    return 14;
  },
  ramp(S) {
    const l = Math.floor(rnd(0, 3)), z = Z0 - 6;
    mkObs('ramp', rampGeo, LANES[l], z, 0.85, 1.6, 0.55);
    // 飞出坡道后沿抛物线布鱼（按当前速度估算）
    const v = S.speed, vy = 8.5 + v * 0.3, exitZ = z - 1.6;
    for (let k = 0; k < 7; k++) { const t = 0.14 + k * 0.115; mkFish(LANES[l], 0.95 + 0.55 + vy * t - 13 * t * t, exitZ - v * t, k === 3 && S.dist > 500); }
    fishLine(pick(others(l)), 5, Z0);
    return 12 + v * 0.95;
  },
  crabs(S) {
    const l = Math.floor(rnd(0, 3));
    mkObs('crab', crabGeo, LANES[l], Z0 - 6, 0.4, 0.35, 0.55, { vx: pick([-1, 1]) * rnd(1.2, 2.2), scuttle: 0 });
    if (S.dist > 250) mkObs('crab', crabGeo, LANES[(l + 1) % 3], Z0 - 14, 0.4, 0.35, 0.55, { vx: pick([-1, 1]) * rnd(1.2, 2.2), scuttle: 0 });
    fishLine(Math.floor(rnd(0, 3)), 5, Z0 - 2);
    return 18;
  },
  snake(S) {
    const l0 = Math.floor(rnd(0, 3));
    for (let i = 0; i < 10; i++) { const l = Math.round(1 + Math.sin(i * 0.8 + l0 * 2)); mkFish(LANES[clamp(l, 0, 2)], 0.95, Z0 - i * 2.2, false); }
    return 22;
  },
};
function spawnPattern() {
  const d = S.dist, hard = clamp(d / 900, 0, 1);
  let name;
  if (d < 40) name = 'fishes';
  else {
    const pool = ['fishes', 'crate', 'crate', 'cones', 'snake', 'ramp'];
    if (d > 80) pool.push('wall', 'crabs');
    if (d > 180) pool.push('boulder', 'boulder', 'wall', 'ramp');
    if (d > 400) pool.push('boulder', 'crabs', 'cones');
    name = pick(pool);
    if (name === S.lastPattern && Math.random() < 0.7) name = pick(pool);
  }
  S.lastPattern = name;
  const len = PATTERNS[name](S);
  S.spawnNeed = len + lerp(15, 8, hard) + S.speed * 0.25;
  S.spawnAcc = 0;
}

// ======================= 粒子 =======================
const pMats = { feather: new THREE.MeshBasicMaterial({ color: 0xffffff }), spark: new THREE.MeshBasicMaterial({ color: 0xffe27a }), dust: new THREE.MeshBasicMaterial({ color: 0xf0d9a8 }), splash: new THREE.MeshBasicMaterial({ color: 0xbfe9ff }), crate: new THREE.MeshBasicMaterial({ color: 0xc58a4d }) };
const pGeo = new THREE.BoxGeometry(0.1, 0.02, 0.18);
const parts = [];
for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(pGeo, pMats.dust); m.visible = false; scene.add(m); parts.push({ m, life: 0, v: new THREE.Vector3(), g: 0, spin: 0, max: 1 }); }
let pIdx = 0;
function emit(type, x, y, z, n, spread = 2, up = 2, life = 0.8, g = 9) {
  for (let i = 0; i < n; i++) {
    const p = parts[pIdx++ % parts.length];
    p.m.material = pMats[type]; p.m.visible = true; p.m.position.set(x, y, z);
    p.v.set(rnd(-spread, spread), rnd(up * 0.4, up), rnd(-spread, spread));
    p.life = p.max = life * rnd(0.7, 1.2); p.g = g; p.spin = rnd(-8, 8);
    p.m.scale.setScalar(rnd(0.7, 1.4));
  }
}
function updateParticles(dt, speed) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; continue; }
    p.v.y -= p.g * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.position.z += speed * dt * 0.9; // 跟随世界向后
    p.m.rotation.x += p.spin * dt; p.m.rotation.z += p.spin * 0.7 * dt;
    const k = p.life / p.max;
    p.m.scale.setScalar(Math.max(0.05, k) * 1.2);
  }
}

// ======================= 音效（Web Audio 合成，无外部资源） =======================
let AC = null, master = null, muted = store.get('muted', false);
function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return AC; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(AC.destination);
    // 海浪环境声：滤波噪声 + 缓慢起伏
    const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = AC.createGain(); g.gain.value = 0.16;
    const lfo = AC.createOscillator(); lfo.frequency.value = 0.13;
    const lg = AC.createGain(); lg.gain.value = 0.09;
    lfo.connect(lg); lg.connect(g.gain); src.connect(lp); lp.connect(g); g.connect(master);
    src.start(); lfo.start();
  } catch { AC = null; }
  return AC;
}
function tone(f, d, type = 'sine', v = 0.2, slide = 0, delay = 0) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
}
const sfx = {
  fish(c) { const f = 620 * Math.pow(1.06, Math.min(c, 10)); tone(f, 0.12, 'triangle', 0.18); tone(f * 1.5, 0.14, 'sine', 0.12, 0, 0.05); },
  gold() { [784, 988, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, 0, i * 0.07)); },
  jump() { tone(280, 0.18, 'sine', 0.16, 320); },
  land() { tone(110, 0.1, 'sine', 0.2, -50); },
  lane() { tone(420, 0.07, 'triangle', 0.07, 180); },
  hit() { tone(140, 0.28, 'sawtooth', 0.22, -90); tone(90, 0.3, 'square', 0.12, -40, 0.03); },
  bell() { tone(1760, 0.7, 'sine', 0.2); tone(2637, 0.5, 'sine', 0.1); tone(3520, 0.3, 'sine', 0.05); },
  flip() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, 0, i * 0.06)); },
  over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, 0, i * 0.18)); },
  boost() { tone(220, 0.3, 'sawtooth', 0.06, 440); },
};

// ======================= 游戏状态 =======================
const S = {
  mode: 'run', // run | paused | over
  time: 0, dist: 0, speed: 0, lives: 3, fish: 0, bonus: 0, combo: 0, comboT: 0,
  inv: 0, crash: 0, squash: 0, shake: 0,
  lane: 1, x: 0, vx: 0, y: 0, vy: 0, grounded: true, gliding: false, jumpHeld: false, jumpBuf: 0,
  boost: false, boostHeld: false, energy: 0.5,
  pedal: 0, wheel: 0, flip: 0, flipVis: 0, flipRate: 0, flipping: false, ramp: null,
  fishInBasket: 0, spawnAcc: 0, spawnNeed: 0, lastPattern: '', camMode: store.get('cam', 0), overT: 0, dustT: 0, best: store.get('best', 0),
};
window.__pelican = S; // 调试用：可通过 __frame(ts) 手动推进帧
const G = 26, JUMP_V = 9.6;

// ---- HUD ----
const el = { score: $('score'), dist: $('dist'), fish: $('fish'), combo: $('combo'), hearts: $('hearts'), toast: $('toast'), hint: $('hint'), fx: $('fx'), overlay: $('overlay'), ovTitle: $('ovTitle'), ovText: $('ovText'), ovBtn: $('ovBtn'), boost: document.querySelector('.pb.boost') };
for (let i = 0; i < 3; i++) el.hearts.appendChild(document.createElement('i'));
const hud = { score: -1, dist: -1, fish: -1, lives: -1, combo: '', e: -1 };
let toastT = 0;
function toast(msg, dur = 1.1) { el.toast.textContent = msg; el.toast.classList.add('show'); toastT = dur; }
function hudUpdate() {
  const sc = Math.floor(S.dist) + S.bonus;
  if (sc !== hud.score) { hud.score = sc; el.score.textContent = sc; }
  const d = Math.floor(S.dist);
  if (d !== hud.dist) { hud.dist = d; el.dist.textContent = d; }
  if (S.fish !== hud.fish) { hud.fish = S.fish; el.fish.textContent = S.fish; }
  if (S.lives !== hud.lives) { hud.lives = S.lives; [...el.hearts.children].forEach((h, i) => h.classList.toggle('off', i >= S.lives)); }
  const cb = S.combo >= 3 ? '×' + S.combo : '';
  if (cb !== hud.combo) { hud.combo = cb; el.combo.textContent = cb; }
  const e = Math.round(S.energy * 50) / 50;
  if (e !== hud.e) { hud.e = e; el.boost.style.setProperty('--e', e); }
}

// ======================= 玩法 =======================
function startRun() {
  Object.assign(S, { mode: 'run', time: 0, dist: 0, speed: 8, lives: 3, fish: 0, bonus: 0, combo: 0, comboT: 0, inv: 0, crash: 0, squash: 0, shake: 0,
    lane: 1, x: 0, vx: 0, y: 0, vy: 0, grounded: true, gliding: false, jumpBuf: 0, boost: false, energy: 0.5, flip: 0, flipVis: 0, flipping: false, ramp: null,
    fishInBasket: 0, spawnAcc: 0, spawnNeed: 18, lastPattern: '', overT: 0 });
  for (const o of obstacles) scene.remove(o.mesh); obstacles.length = 0;
  for (const f of pickups) scene.remove(f.mesh); pickups.length = 0;
  el.overlay.hidden = true; el.fx.className = '';
  document.body.classList.remove('over');
  showHint(coarse ? '左右滑动变道 · 上滑或按「跳」· 空中按住滑翔' : '← → 变道 · 空格跳跃（空中按住滑翔）· Shift 冲刺', 5);
}
let hintT = 0;
function showHint(t, d) { el.hint.textContent = t; el.hint.classList.add('show'); hintT = d; }

function moveLane(d) {
  if (S.mode !== 'run') return;
  const n = clamp(S.lane + d, 0, 2);
  if (n !== S.lane) { S.lane = n; sfx.lane(); }
}
function jumpPress() {
  if (S.mode !== 'run') return;
  if (S.grounded) doJump(); else S.jumpBuf = 0.14;
}
function doJump() {
  S.vy = JUMP_V; S.grounded = false; S.ramp = null; S.squash = -0.2; sfx.jump();
  emit('dust', S.x, 0.1, 0.4, 5, 1.2, 1.5, 0.5);
}
function ringBell() {
  if (S.mode !== 'run') return;
  audio(); sfx.bell(); pel.ring();
  for (const o of obstacles) if (o.type === 'crab' && o.z > -45 && !o.fly) { o.flee = o.x >= 0 ? 1 : -1; o.vx = o.flee * 7; }
  for (const g of gulls) g.userData.scare = 1;
  toast('叮铃～', 0.6);
}
function setBoost(v) { S.boostHeld = v; }
function cycleCam() { S.camMode = (S.camMode + 1) % 3; store.set('cam', S.camMode); toast(['追尾视角', '低位视角', '侧面视角'][S.camMode], 0.8); }
function toggleMute() { muted = !muted; store.set('muted', muted); if (master) master.gain.value = muted ? 0 : 0.55; document.querySelector('[data-act=mute]').classList.toggle('off', muted); }
function togglePause(force) {
  if (S.mode === 'over') return;
  const p = force ?? S.mode === 'run';
  if (p && S.mode === 'run') { S.mode = 'paused'; showOverlay('暂停', '风还在吹，鹈鹕等你。', '继续'); }
  else if (!p && S.mode === 'paused') { S.mode = 'run'; el.overlay.hidden = true; }
}
function showOverlay(title, text, btn, end) { el.overlay.classList.toggle('end', !!end); el.ovTitle.textContent = title; el.ovText.innerHTML = text; el.ovBtn.textContent = btn; el.overlay.hidden = false; setTimeout(() => el.ovBtn.focus({ preventScroll: true }), 50); }
function gameOver() {
  S.mode = 'over'; S.overT = 0; sfx.over();
  const sc = Math.floor(S.dist) + S.bonus, nb = sc > S.best;
  if (nb) { S.best = sc; store.set('best', sc); }
  setTimeout(() => { if (S.mode === 'over') showOverlay('骑累了', `得分 <b>${sc}</b> · 里程 ${Math.floor(S.dist)} m · 鱼 ${S.fish}<br>${nb ? '新纪录！' : '最高 ' + S.best}`, '再骑一次', true); }, 1400);
}
function hurt(o) {
  S.lives--; S.inv = 1.8; S.crash = 1; S.shake = 0.6; S.combo = 0; S.speed *= 0.5; S.energy = Math.max(0, S.energy - 0.1);
  sfx.hit(); audio();
  emit('feather', S.x, 1.5, 0, 16, 3, 4, 1.1, 6);
  el.fx.className = 'hurt'; setTimeout(() => { if (el.fx.className === 'hurt') el.fx.className = ''; }, 260);
  o.fly = { vx: rnd(-3, 3), vy: rnd(5, 8), vz: rnd(-6, -2), rx: rnd(-8, 8), rz: rnd(-8, 8) };
  emit('crate', o.x, 0.6, o.z, 8, 3, 5, 0.9, 12);
  if (S.lives <= 0) gameOver();
}
function rampAt() {
  for (const o of obstacles) if (o.type === 'ramp' && !o.fly && Math.abs(o.x - S.x) < o.hw && Math.abs(o.z) <= o.hd) return o;
  return null;
}

function simulate(dt) {
  S.time += dt;
  const over = S.mode === 'over';
  // 速度
  const base = 13 + Math.min(S.dist * 0.011, 12);
  S.boost = !over && S.boostHeld && S.energy > 0.001;
  const target = over ? 0 : base * (S.boost ? 1.45 : 1) * (S.crash > 0.4 ? 0.75 : 1);
  S.speed = damp(S.speed, target, over ? 1.6 : S.boost ? 4 : 1.4, dt);
  S.energy = clamp(S.energy + (S.boost ? -0.2 : 0.02) * dt, 0, 1);
  if (S.boost && S.energy <= 0.001) S.boostHeld = false;
  const adv = S.speed * dt;
  if (!over) S.dist += adv;
  S.inv = Math.max(0, S.inv - dt); S.crash = Math.max(0, S.crash - dt * 1.4); S.shake = Math.max(0, S.shake - dt * 1.8);
  S.comboT -= dt; if (S.comboT <= 0 && S.combo > 0) S.combo = 0;
  S.squash = damp(S.squash, 0, 14, dt);

  // 横向
  if (!over) {
    const nx = damp(S.x, LANES[S.lane], 11, dt);
    S.vx = damp(S.vx, (nx - S.x) / dt, 30, dt); S.x = nx;
  } else S.vx = damp(S.vx, 0, 6, dt);

  // 坡道
  const r = rampAt();
  const gy = r ? r.h * (r.hd + r.z) / (2 * r.hd) : 0; // 以玩家 z=0，局部坐标 zl=-r.z；越靠前越高
  // 竖向
  S.gliding = !S.grounded && S.jumpHeld && S.vy < 0 && !over;
  if (S.grounded) {
    S.y = gy;
    if (S.ramp && !r && S.ramp.z >= S.ramp.hd - 0.1 && !over) { // 从坡道前端飞出
      S.vy = 8.5 + S.speed * 0.3; S.grounded = false; S.flipping = true; S.flip = 0; S.flipRate = (Math.PI * 2) / (2 * S.vy / G) * 1.04;
      S.squash = -0.25; sfx.jump(); toast('起飞！', 0.7);
    }
    S.ramp = r;
    if (S.jumpBuf > 0 && S.grounded) { S.jumpBuf = 0; doJump(); }
  } else {
    S.vy -= G * (S.gliding ? 0.22 : S.vy > 0 && S.jumpHeld ? 0.85 : 1) * dt;
    if (S.gliding) S.vy = Math.max(S.vy, -2.4);
    S.y += S.vy * dt;
    if (S.flipping) S.flip = Math.min(Math.PI * 2, S.flip + S.flipRate * dt);
    if (S.y <= gy && S.vy <= 0) { // 落地
      S.y = gy; S.vy = 0; S.grounded = true; S.squash = 0.35; sfx.land();
      emit('dust', S.x, 0.1, 0.4, 8, 1.8, 2, 0.6);
      if (S.flipping) {
        if (S.flip > Math.PI * 1.75) { S.bonus += 50; toast('漂亮的空翻！+50', 1.3); sfx.flip(); emit('spark', S.x, 1.5, 0, 14, 3, 4, 0.8, 5); S.flip = Math.PI * 2; }
        S.flipping = false;
        S.flipVis = S.flip; S.flipSettle = true;
      }
      if (S.jumpBuf > 0) { S.jumpBuf = 0; doJump(); }
    }
  }
  S.jumpBuf = Math.max(0, S.jumpBuf - dt);
  if (S.flipping) S.flipVis = S.flip;
  else if (S.flipSettle) { S.flipVis = damp(S.flipVis, Math.round(S.flipVis / (Math.PI * 2)) * Math.PI * 2, 14, dt); if (Math.abs(S.flipVis - Math.round(S.flipVis / (Math.PI * 2)) * Math.PI * 2) < 0.01) { S.flipVis = 0; S.flip = 0; S.flipSettle = false; } }

  // 踏板与车轮
  S.pedal += (over ? 0 : S.speed * 0.55 * (S.grounded ? 1 : 0.3)) * dt;
  S.wheel += Math.min(S.speed / 0.42, 30) * dt;

  // 生成
  if (!over) { S.spawnAcc += adv; if (S.spawnAcc >= S.spawnNeed) spawnPattern(); }

  // 实体推进 + 碰撞
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.z += adv;
    if (o.fly) {
      const f = o.fly; f.vy -= 24 * dt;
      o.x += f.vx * dt; o.mesh.position.y += f.vy * dt; o.z += f.vz * dt;
      o.mesh.rotation.x += f.rx * dt; o.mesh.rotation.z += f.rz * dt;
      if (o.mesh.position.y < -3) o.z = 99;
    } else if (o.type === 'crab') {
      if (!o.flee) { o.x += o.vx * dt; if (Math.abs(o.x) > 2.1) o.vx = -Math.sign(o.x) * Math.abs(o.vx); }
      else { o.x += o.vx * dt; if (Math.abs(o.x) > 6) o.mesh.visible = false; }
      o.mesh.rotation.z = Math.sin(S.time * 18 + o.z) * 0.06;
      o.mesh.rotation.y = Math.sign(o.vx) * 0.35;
    }
    o.mesh.position.x = o.x; o.mesh.position.z = o.z;
    if (o.z > 9 || (o.mesh.visible === false && o.z > -2)) { scene.remove(o.mesh); obstacles.splice(i, 1); continue; }
    if (!over && !o.fly && o.type !== 'ramp' && S.inv <= 0 && o.mesh.visible && Math.abs(o.z) < o.hd + 0.4 && Math.abs(o.x - S.x) < o.hw + 0.36 && S.y + 0.12 < o.h) hurt(o);
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const f = pickups[i];
    f.z += adv;
    f.mesh.position.set(f.x, f.y + Math.sin(S.time * 4 + f.ph) * 0.08, f.z);
    f.mesh.rotation.y = S.time * 2.4 + f.ph;
    if (f.z > 6) { scene.remove(f.mesh); pickups.splice(i, 1); continue; }
    if (!over && Math.abs(f.z) < 0.85 && Math.abs(f.x - S.x) < 0.8 && Math.abs(f.y - (S.y + 1.05)) < 1.15) {
      S.fish++; S.combo++; S.comboT = 2; S.fishInBasket = (S.fishInBasket + 1) % 6;
      const pts = (f.gold ? 50 : 10) * (1 + Math.floor(S.combo / 5)); S.bonus += pts;
      S.energy = clamp(S.energy + (f.gold ? 0.3 : 0.07), 0, 1);
      pel.bulgeNow(); f.gold ? sfx.gold() : sfx.fish(S.combo);
      emit('spark', f.x, f.y, f.z, f.gold ? 14 : 6, 1.6, 2.5, 0.5, 4);
      if (f.gold) toast('金鱼！+' + pts, 1); else if (S.combo > 0 && S.combo % 5 === 0) toast('连击 ×' + S.combo, 0.9);
      scene.remove(f.mesh); pickups.splice(i, 1);
    }
  }

  // 沙尘 / 冲刺火花
  S.dustT -= dt;
  if (S.dustT <= 0 && S.grounded && !over && S.speed > 6) {
    S.dustT = S.boost ? 0.03 : 0.12;
    emit(S.boost ? 'spark' : 'dust', S.x + rnd(-0.1, 0.1), 0.15, 1.2, S.boost ? 2 : 1, 0.6, 1, 0.45, 4);
  }
}

// ======================= 景物 / 环境动画 =======================
function updateWorld(dt, t) {
  const adv = S.speed * dt;
  for (const o of props) {
    o.position.z += adv;
    if (o.userData.bob) o.position.y = -0.38 + Math.sin(t * 1.4 + o.position.z * 0.3) * 0.08;
    if (o.position.z > ZMAX) { o.position.z -= SPAN; o.userData.reroll?.(o); }
  }
  // 道路 / 沙地贴图滚动
  roadTex.offset.y = (S.dist / roadTile) % 1;
  sandTex.offset.y = (S.dist / sandTile) % 1;
  sandL.material.map.offset.y = (S.dist / sandTile) % 1;
  updateSea(t, S.dist);
  for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 200) c.position.x = -200; c.position.z += adv * 0.02; if (c.position.z > -60) c.position.z = -240; }
  for (const g of gulls) {
    const u = g.userData; u.a += dt * u.sp; u.scare = Math.max(0, (u.scare || 0) - dt * 0.4);
    const a = u.a, bank = Math.cos(a);
    g.position.set(u.cx + Math.sin(a) * u.r, u.cy + Math.sin(a * 2.3) * 1.2 + u.scare * 6, u.cz + Math.cos(a) * u.r * 0.6 + (S.dist * 0.0));
    g.rotation.y = -a + Math.PI; g.rotation.z = bank * 0.3;
    const fl = Math.sin(t * (7 + u.sp * 6) + u.r) * 0.55;
    for (const w of u.wings) w.p.rotation.z = w.s * fl;
  }
}

// ======================= 相机 =======================
const camPos = new THREE.Vector3(0, 3, 8), camLook = new THREE.Vector3(0, 1, -6);
const tp = new THREE.Vector3(), tl = new THREE.Vector3();
let fovBase = 62, camDist = 7.4;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const asp = w / h;
  camera.aspect = asp;
  // 竖屏时加大垂直视角，保证三条车道可见
  fovBase = clamp(2 * Math.atan(0.5 / Math.max(asp, 0.2)) * 180 / Math.PI * 1.02 + 20, 52, 80);
  if (asp > 1.2) fovBase = 56;
  camDist = Math.max(7, 3.7 / (Math.tan(fovBase * Math.PI / 360) * asp));
  camera.fov = fovBase; camera.updateProjectionMatrix();
}
function updateCamera(dt, t) {
  const m = S.camMode, over = S.mode === 'over';
  const x = S.x, boost = S.boost ? 1 : 0;
  if (over) {
    S.overT += dt;
    const a = Math.min(S.overT * 0.5, Math.PI * 0.85) + 0.3;
    tp.set(x + Math.sin(a) * 5.2, 2.4, Math.cos(a) * 5.2); tl.set(x, 1.5, 0);
  } else if (m === 0) { tp.set(x * 0.9 + 2.0, 2.7 + S.y * 0.35, camDist * 0.64); tl.set(x * 0.8 + 0.5, 1.3 + S.y * 0.4, -5); }
  else if (m === 1) { tp.set(x * 0.7, 1.55 + S.y * 0.3, camDist * 0.62 + 0.3); tl.set(x * 0.4, 1.3 + S.y * 0.4, -7); }
  else { tp.set(x + 5.6 + (camDist - 7) * 0.35, 1.8, 1.4); tl.set(x - 0.2, 1.4 + S.y * 0.5, -1.2); }
  const k = over || m === 2 ? 4 : 7;
  camPos.x = damp(camPos.x, tp.x, k, dt); camPos.y = damp(camPos.y, tp.y, k, dt); camPos.z = damp(camPos.z, tp.z, k, dt);
  camLook.x = damp(camLook.x, tl.x, k, dt); camLook.y = damp(camLook.y, tl.y, k, dt); camLook.z = damp(camLook.z, tl.z, k, dt);
  camera.position.copy(camPos);
  if (S.shake > 0 && !reduced) camera.position.add(_v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(S.shake * 0.18));
  camera.lookAt(camLook);
  const fov = fovBase + boost * 7 + Math.min(S.speed, 30) * 0.12;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 5, dt); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
}

// ======================= 主循环 =======================
let last = performance.now(), simT = 0;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  if (dt < 0.0005) return; // 同一时间戳重复回调时不推进，避免除零
  if (S.mode !== 'paused') {
    simulate(dt);
    updateParticles(dt, S.speed);
    simT += dt;
  }
  const t = simT;
  pel.root.position.set(S.x, S.y, 0);
  pel.update(S, S.mode === 'paused' ? 0 : dt, t);
  updateWorld(S.mode === 'paused' ? 0 : dt, t);
  updateCamera(dt, t);
  updateEnv(S.dist);
  sun.position.set(S.x - 7, 12, 8); sun.target.position.set(S.x, 0, -1); sun.target.updateMatrixWorld();
  el.fx.classList.toggle('on', S.boost && S.mode === 'run');
  if (el.fx.className === 'hurt') { /* 受击闪红 */ }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('show'); }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) el.hint.classList.remove('show'); }
  hudUpdate();
  renderer.render(scene, camera);
}

// ======================= 输入 =======================
const keyAct = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'boost', KeyS: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost',
  KeyB: 'bell', KeyC: 'cam', KeyM: 'mute', KeyP: 'pause', Escape: 'pause', KeyR: 'restart', Enter: 'enter',
};
function act(a, down) {
  if (down) audio();
  switch (a) {
    case 'left': if (down) moveLane(-1); break;
    case 'right': if (down) moveLane(1); break;
    case 'jump': S.jumpHeld = down; if (down) jumpPress(); break;
    case 'boost': if (down && S.mode === 'run' && S.energy > 0.02 && !S.boostHeld) sfx.boost(); setBoost(down && S.mode === 'run'); break;
    case 'bell': if (down) ringBell(); break;
    case 'cam': if (down) cycleCam(); break;
    case 'mute': if (down) toggleMute(); break;
    case 'pause': if (down) togglePause(); break;
    case 'restart': if (down && S.mode !== 'run') startRun(); break;
    case 'enter': if (down) { if (S.mode === 'over') startRun(); else if (S.mode === 'paused') togglePause(false); } break;
  }
}
addEventListener('keydown', (e) => {
  const a = keyAct[e.code];
  if (!a) return;
  if (e.target === el.ovBtn && (e.code === 'Enter' || e.code === 'Space')) return; // 交给按钮自身
  e.preventDefault();
  if (e.repeat) return;
  if (S.mode === 'paused' && (a === 'jump')) { togglePause(false); return; }
  act(a, true);
});
addEventListener('keyup', (e) => { const a = keyAct[e.code]; if (a === 'jump' || a === 'boost') act(a, false); });
addEventListener('blur', () => { S.jumpHeld = false; S.boostHeld = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'run') togglePause(true); });
addEventListener('pointerdown', () => { window.focus(); }, { capture: true });

// 屏幕按钮（多指同时按：每个按钮独立记录指针）
for (const b of document.querySelectorAll('[data-act]')) {
  const a = b.dataset.act, hold = a === 'jump' || a === 'boost';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ } b.classList.add('down'); if (S.mode === 'paused' && a === 'jump') { togglePause(false); return; } act(a, true); });
  const up = () => { b.classList.remove('down'); if (hold) act(a, false); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}
el.ovBtn.addEventListener('click', () => { if (S.mode === 'over') startRun(); else togglePause(false); });

// 画布手势：左右滑动变道、上滑跳跃、下滑冲刺
{
  let id = null, sx = 0, sy = 0;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; audio(); if (S.mode === 'paused') togglePause(false); });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, T = 26;
    if (Math.abs(dx) > T && Math.abs(dx) > Math.abs(dy)) { moveLane(dx > 0 ? 1 : -1); sx = e.clientX; sy = e.clientY; }
    else if (dy < -T && Math.abs(dy) > Math.abs(dx)) { act('jump', true); setTimeout(() => act('jump', false), 220); sx = e.clientX; sy = e.clientY; }
  });
  const end = (e) => { if (e.pointerId === id) id = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ======================= 启动 =======================
addEventListener('resize', resize);
document.querySelector('[data-act=mute]').classList.toggle('off', muted);
seedProps();
resize();
startRun();
// 开场沿用「日落」时段；先让相机落位避免第一帧跳动
camPos.set(0, 2.8, camDist * 0.95 + 0.6); camLook.set(0, 1.2, -6);
window.__frame = frame; window.__dbg = { camera, pel, THREE };
renderer.setAnimationLoop(frame);
