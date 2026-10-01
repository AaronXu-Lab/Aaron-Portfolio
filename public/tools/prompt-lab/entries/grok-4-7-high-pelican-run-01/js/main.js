import * as THREE from '../vendor/three.module.js';

// Bike faces local -Z. rig.rotation.y is the only heading.
// World forward = quaternion * (0,0,-1) = (-sin yaw, 0, -cos yaw).
// Right = forward × up. Positive yaw is a left turn.
// Wheel axle is local +X. Positive rotation.x sends the tire bottom toward
// -Z, so rolling forward decreases wheelSpin.

const UP = new THREE.Vector3(0, 1, 0);
const WHEEL_R = 0.34;
const GEAR = 2.45;
const CRANK_ARM = 0.17;
const PIER_R = 14.2;
const PIER_W = 4.5;
const INNER = PIER_R - PIER_W / 2;
const OUTER = PIER_R + PIER_W / 2;
const CRUISE = 3.35;
const VMAX = 7.5;
const STORE = 'grok-4-7-high-pelican-run-01:';
const SUN = new THREE.Vector3(9.2, 4.6, 3.2);
const FILL_OFF = new THREE.Vector3(-6, 4, -5);

const REAR = new THREE.Vector3(0, WHEEL_R, 0.4);
const FRONT = new THREE.Vector3(0, WHEEL_R, -0.72);
const BB = new THREE.Vector3(0, 0.3, 0.02);
const HEAD_TUBE = new THREE.Vector3(0, 0.78, -0.48);
const BARS = new THREE.Vector3(0, 0.97, -0.3);

const THIGH = 0.36;
const SHIN = 0.38;
const UPPER_ARM = 0.24;
const FOREARM = 0.26;

const CAMS = [
  { dist: 2.9, height: 1.48, look: 0.98, side: 2.55, fov: 50, ahead: 0.62 },
  { dist: 2.75, height: 1.28, look: 1.0, side: 2.2, fov: 50, ahead: 0.72 },
  { dist: 4.4, height: 0.64, look: 0.74, side: 0.85, fov: 48, ahead: 1.5 },
];

const canvas = document.getElementById('c');
const failEl = document.getElementById('fail');
const hintEl = document.getElementById('hint');
const helpEl = document.getElementById('help');
const soundBtn = document.getElementById('btn-sound');

const buttons = { left: false, right: false, boost: false, brake: false };
const held = new Set();
let dragId = null;
let dragX = 0;
let dragSteer = 0;
let hintGone = false;

const state = {
  yaw: -Math.PI / 2,
  speed: CRUISE,
  wheelSpin: -2.05,
  steerSm: 0,
  lean: 0,
  pitch: 0,
  time: 0,
  squawkT: -1,
  bellT: -1,
  bellLock: -1,
  squawkLock: -1,
  blink: 0,
  nextBlink: 1.6,
  cam: 0,
  muted: true,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  override: null,
  bob: 0,
  pouch: 0,
  pouchV: 0,
};

const camPos = new THREE.Vector3(4, 3, 18);
const camLook = new THREE.Vector3(0, 1, 14);
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const radial = new THREE.Vector3();
const tangent = new THREE.Vector3();
const desire = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const sunPos = new THREE.Vector3();
const footR = new THREE.Vector3();
const footL = new THREE.Vector3();
const handR = new THREE.Vector3();
const handL = new THREE.Vector3();
const hipR = new THREE.Vector3();
const hipL = new THREE.Vector3();
const shoulderR = new THREE.Vector3();
const shoulderL = new THREE.Vector3();
const knee = new THREE.Vector3();
const elbow = new THREE.Vector3();
const neckP = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const headFwd = new THREE.Vector3();
const bodyCenter = new THREE.Vector3();
const rocked = new THREE.Vector3();

const _ikA = new THREE.Vector3();
const _ikB = new THREE.Vector3();
const _obX = new THREE.Vector3();
const _obY = new THREE.Vector3();
const _obZ = new THREE.Vector3();
const _obM = new THREE.Matrix4();
const _hX = new THREE.Vector3();
const _hY = new THREE.Vector3();
const _hZ = new THREE.Vector3();
const _hM = new THREE.Matrix4();

function showFail() {
  failEl.hidden = false;
  canvas.hidden = true;
}

function loadPref(key, fallback) {
  try {
    const v = localStorage.getItem(STORE + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function savePref(key, value) {
  try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* private mode */ }
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
}

function yawForForward(x, z) {
  return Math.atan2(-x, -z);
}

function hideHint() {
  if (hintGone) return;
  hintGone = true;
  hintEl.classList.add('is-gone');
}

function stdMat(color, roughness, metalness, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color,
    roughness,
    metalness,
  }, extra || {}));
}

function lambert(color, extra) {
  return new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
}

function tube(a, b, radius, material, segs) {
  const dir = _ikA.subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return new THREE.Object3D();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, segs || 7), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
  mesh.castShadow = true;
  return mesh;
}

function arc(cx, cy, cz, radius, a0, a1, segments, tubeR, material, parent) {
  for (let i = 0; i < segments; i++) {
    const t0 = a0 + (a1 - a0) * (i / segments);
    const t1 = a0 + (a1 - a0) * ((i + 1) / segments);
    parent.add(tube(
      new THREE.Vector3(cx, cy + Math.cos(t0) * radius, cz + Math.sin(t0) * radius),
      new THREE.Vector3(cx, cy + Math.cos(t1) * radius, cz + Math.sin(t1) * radius),
      tubeR,
      material,
      5,
    ));
  }
}

function profileTube(sections, radial) {
  const positions = [];
  const indices = [];
  sections.forEach((s) => {
    for (let i = 0; i < radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      positions.push(Math.cos(a) * s.w, Math.sin(a) * s.h + s.y, s.z);
    }
  });
  for (let s = 0; s < sections.length - 1; s++) {
    for (let i = 0; i < radial; i++) {
      const i0 = s * radial + i;
      const i1 = s * radial + ((i + 1) % radial);
      const i2 = (s + 1) * radial + i;
      const i3 = (s + 1) * radial + ((i + 1) % radial);
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  let best = 0;
  let bestX = 0;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(pos.getX(i));
    if (ax > bestX) { bestX = ax; best = i; }
  }
  const sign = Math.sign(pos.getX(best)) || 1;
  if (nor.getX(best) * sign < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = tmp;
    }
    geo.setIndex(indices);
    geo.computeVertexNormals();
  }
  return geo;
}

function boneMesh(len, r0, r1, material) {
  const geo = new THREE.CylinderGeometry(r1, r0, len, 7);
  geo.translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.userData.len = len;
  return mesh;
}

function solveJoint(hip, ankle, upperLen, lowerLen, pole, out) {
  _ikA.subVectors(ankle, hip);
  const raw = _ikA.length();
  const max = upperLen + lowerLen - 1e-4;
  const min = Math.abs(upperLen - lowerLen) + 1e-4;
  const dist = Math.min(max, Math.max(min, raw));
  if (raw > 1e-6) _ikA.multiplyScalar(1 / raw);
  else _ikA.set(0, -1, 0);
  const h = (upperLen * upperLen - lowerLen * lowerLen + dist * dist) / (2 * dist);
  out.copy(hip).addScaledVector(_ikA, h);
  _ikB.copy(pole);
  _ikB.addScaledVector(_ikA, -_ikB.dot(_ikA));
  if (_ikB.lengthSq() < 1e-8) _ikB.set(1, 0, 0);
  _ikB.normalize();
  out.addScaledVector(_ikB, Math.sqrt(Math.max(0, upperLen * upperLen - h * h)));
  return out;
}

function orientBone(bone, from, to, pole) {
  bone.position.copy(from);
  _obY.subVectors(to, from);
  const len = _obY.length();
  if (len < 1e-5) return;
  _obY.multiplyScalar(1 / len);
  _obX.copy(pole);
  _obX.addScaledVector(_obY, -_obX.dot(_obY));
  if (_obX.lengthSq() < 1e-8) _obX.set(1, 0, 0);
  _obX.normalize();
  _obZ.crossVectors(_obX, _obY).normalize();
  bone.quaternion.setFromRotationMatrix(_obM.makeBasis(_obX, _obY, _obZ));
  const rest = bone.userData.len || 1;
  bone.scale.set(1, len / rest, 1);
}

function feather(len, wid, material) {
  const geo = new THREE.BoxGeometry(len, 0.012, wid);
  geo.translate(len / 2, 0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7a4e32';
  g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 1) {
    const n = Math.sin(y * 0.17) * 0.5 + Math.sin(y * 0.05) * 0.5;
    g.fillStyle = `rgba(48, 24, 12, ${0.05 + n * 0.08})`;
    g.fillRect(0, y, 128, 1);
  }
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = `rgba(36, 16, 8, ${0.12 + (i % 4) * 0.04})`;
    g.lineWidth = 1;
    g.beginPath();
    const x = (i * 37) % 128;
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 8, 70, x - 10, 150, x + 3, 256);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.5)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function awningTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  for (let x = 0; x < 64; x += 8) {
    g.fillStyle = (x / 8) % 2 === 0 ? '#f0ddc0' : '#c4552a';
    g.fillRect(x, 0, 8, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
} catch {
  showFail();
  throw new Error('webgl');
}
if (!renderer.getContext()) {
  showFail();
  throw new Error('webgl');
}
window.__pelicanReady = true;

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 520 ? 1.5 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0xf0a56e, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf0a56e, 26, 82);
const camera = new THREE.PerspectiveCamera(36, 1, 0.08, 280);

const hemi = new THREE.HemisphereLight(0xffd2a4, 0x1c3a40, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb36a, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.035;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 26;
sun.shadow.camera.left = -5;
sun.shadow.camera.right = 5;
sun.shadow.camera.top = 5;
sun.shadow.camera.bottom = -5;
scene.add(sun);
scene.add(sun.target);
const fill = new THREE.DirectionalLight(0x8ec8d0, 0.4);
scene.add(fill);
const key = new THREE.DirectionalLight(0xffe2c4, 1.35);
scene.add(key);
scene.add(key.target);

const waterUniforms = {
  uTime: { value: 0 },
  uSun: { value: SUN.clone().normalize() },
};
const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: `
    uniform float uTime;
    varying vec3 vWorld;
    varying float vWave;
    void main() {
      vec3 p = position;
      float w = sin(p.x * 0.33 + uTime * 1.25) * cos(p.z * 0.27 - uTime * 0.85);
      w += sin(p.x * 0.11 - p.z * 0.14 + uTime * 0.55) * 0.55;
      p.y += w * 0.07;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vWorld = wp.xyz;
      vWave = w;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uSun;
    varying vec3 vWorld;
    varying float vWave;
    void main() {
      vec3 deep = vec3(0.015, 0.045, 0.055);
      vec3 mid = vec3(0.03, 0.11, 0.12);
      vec3 shoal = vec3(0.05, 0.16, 0.15);
      float r = length(vWorld.xz);
      float shore = smoothstep(22.0, 7.0, r);
      vec3 col = mix(deep, mid, shore);
      col = mix(col, shoal, clamp(vWave * 0.22 + 0.12, 0.0, 1.0) * shore * 0.45);
      vec3 viewDir = normalize(cameraPosition - vWorld);
      vec3 n = normalize(vec3(
        cos(vWorld.x * 0.33 + uTime * 1.25) * 0.16,
        1.0,
        -sin(vWorld.z * 0.27 - uTime * 0.85) * 0.16
      ));
      vec3 halfV = normalize(viewDir + normalize(uSun));
      float spec = pow(max(dot(n, halfV), 0.0), 42.0);
      vec3 sunCol = vec3(1.0, 0.62, 0.28);
      col += sunCol * spec * 0.9;
      float path = pow(max(dot(normalize(vec3(uSun.x, 0.0, uSun.z)), normalize(vec3(viewDir.x, 0.0, viewDir.z))), 0.0), 5.0);
      col = mix(col, sunCol, path * 0.22 * smoothstep(0.0, 0.35, viewDir.y + 0.15));
      float fogF = smoothstep(26.0, 82.0, length(cameraPosition - vWorld));
      col = mix(col, vec3(0.86, 0.38, 0.16), fogF);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const water = new THREE.Mesh(new THREE.CircleGeometry(78, 72), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.78;
water.receiveShadow = true;
scene.add(water);

const skyUniforms = { uSun: { value: SUN.clone().normalize() } };
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false,
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vDir = position;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 uSun;
    varying vec3 vDir;
    void main() {
      vec3 dir = normalize(vDir);
      float h = dir.y;
      vec3 top = vec3(0.012, 0.03, 0.055);
      vec3 mid = vec3(0.16, 0.18, 0.22);
      vec3 hor = vec3(0.98, 0.38, 0.12);
      vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
      col = mix(col, top, smoothstep(0.18, 0.75, h));
      float band = exp(-abs(h - 0.02) * 9.0);
      col = mix(col, vec3(0.98, 0.62, 0.32), band * 0.42);
      float sun = pow(max(dot(dir, normalize(uSun)), 0.0), 36.0);
      col += vec3(1.0, 0.78, 0.45) * sun * 1.6;
      float haze = pow(max(dot(dir, normalize(uSun)), 0.0), 4.0) * smoothstep(0.35, -0.05, h);
      col += vec3(0.95, 0.55, 0.25) * haze * 0.35;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 48, 24), skyMat);
sky.frustumCulled = false;
sky.renderOrder = -1;
scene.add(sky);

const deckMat = lambert(0xffffff, { map: woodTexture() });
const plankCount = 300;
const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(PIER_W + 0.2, 0.1, 0.2), deckMat, plankCount);
planks.receiveShadow = true;
const dummy = new THREE.Object3D();
const tint = new THREE.Color();
for (let i = 0; i < plankCount; i++) {
  const a = (i / plankCount) * Math.PI * 2;
  dummy.position.set(Math.sin(a) * PIER_R, -0.05, Math.cos(a) * PIER_R);
  dummy.rotation.set(0, a - Math.PI / 2, 0);
  dummy.updateMatrix();
  planks.setMatrixAt(i, dummy.matrix);
  const shade = 0.78 + (i % 3) * 0.08;
  tint.setRGB(shade, shade * 0.96, shade * 0.9);
  planks.setColorAt(i, tint);
}
scene.add(planks);

const subMat = lambert(0x3a2418);
const sub = new THREE.Mesh(new THREE.RingGeometry(INNER - 0.15, OUTER + 0.15, 80), subMat);
sub.rotation.x = -Math.PI / 2;
sub.position.y = -0.16;
sub.receiveShadow = true;
scene.add(sub);

const postMat = lambert(0x2c3834);
const postGeo = new THREE.CylinderGeometry(0.045, 0.055, 1.2, 6);
postGeo.translate(0, 0.45, 0);
const postCount = 42;
const posts = new THREE.InstancedMesh(postGeo, postMat, postCount * 2);
for (let i = 0; i < postCount; i++) {
  const a = (i / postCount) * Math.PI * 2;
  for (let k = 0; k < 2; k++) {
    const radius = k === 0 ? INNER + 0.12 : OUTER - 0.12;
    dummy.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    posts.setMatrixAt(i * 2 + k, dummy.matrix);
  }
}
scene.add(posts);

const ropeMat = lambert(0xc8b89a);
function rope(radius, y) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.02, 6, 90), ropeMat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  scene.add(mesh);
}
rope(INNER + 0.12, 0.58);
rope(INNER + 0.12, 0.98);
rope(OUTER - 0.12, 0.58);
rope(OUTER - 0.12, 0.98);

const reedGeo = new THREE.ConeGeometry(0.07, 1.05, 4);
reedGeo.translate(0, 0.52, 0);
const reeds = new THREE.InstancedMesh(reedGeo, lambert(0x2f5a48), 150);
const rng = mulberry32(11);
let reedN = 0;
for (let n = 0; n < 220 && reedN < 150; n++) {
  const a = rng() * Math.PI * 2;
  const outer = rng() > 0.45;
  const radius = outer ? OUTER + 0.35 + rng() * 2.4 : 3.2 + rng() * (INNER - 4.2);
  if (!outer && radius > INNER - 0.6) continue;
  dummy.position.set(Math.sin(a) * radius, -0.78, Math.cos(a) * radius);
  dummy.rotation.set(0, rng() * 3, (rng() - 0.5) * 0.25);
  const s = 0.75 + rng() * 0.7;
  dummy.scale.set(s, 0.8 + rng() * 0.9, s);
  dummy.updateMatrix();
  reeds.setMatrixAt(reedN, dummy.matrix);
  tint.setHex(rng() > 0.5 ? 0x356554 : 0x234838);
  reeds.setColorAt(reedN, tint);
  reedN += 1;
}
reeds.count = reedN;
scene.add(reeds);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rig = new THREE.Group();
scene.add(rig);
const leanG = new THREE.Group();
rig.add(leanG);
const pitch = new THREE.Group();
leanG.add(pitch);

const paint = stdMat(0x1c7a72, 0.42, 0.04);
const paintDark = stdMat(0x14564f, 0.5, 0.04);
const cream = stdMat(0xefe2d0, 0.62, 0.02);
const tireMat = stdMat(0x1a1a18, 0.96, 0);
const brass = stdMat(0xe0c078, 0.32, 0.18);
const leather = stdMat(0x6b3a2a, 0.72, 0);
const chainMat = stdMat(0x2a2c30, 0.45, 0.4);
const paperMat = stdMat(0xf0ddc0, 0.8, 0);
const stringMat = stdMat(0xa33b32, 0.6, 0);

function addWheel(spinGroup) {
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.022, 8, 20), tireMat);
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  spinGroup.add(tire);
  const wall = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.012, 0.012, 6, 18), cream);
  wall.rotation.y = Math.PI / 2;
  spinGroup.add(wall);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.008, 6, 18), brass);
  rim.rotation.y = Math.PI / 2;
  spinGroup.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), brass);
  hub.rotation.z = Math.PI / 2;
  spinGroup.add(hub);
  const spokeGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.29, 4);
  spokeGeo.translate(0, 0.145, 0);
  for (let i = 0; i < 12; i++) {
    const spoke = new THREE.Mesh(spokeGeo, brass);
    const ang = (i / 12) * Math.PI * 2;
    spoke.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, Math.cos(ang), Math.sin(ang)).normalize());
    spinGroup.add(spoke);
  }
  const cog = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 10), chainMat);
  cog.rotation.z = Math.PI / 2;
  cog.position.x = 0.04;
  spinGroup.add(cog);
}

const rearWheel = new THREE.Group();
rearWheel.position.copy(REAR);
addWheel(rearWheel);
pitch.add(rearWheel);
const frontWheel = new THREE.Group();
addWheel(frontWheel);

const frame = new THREE.Group();
pitch.add(frame);
frame.add(tube(REAR, BB, 0.016, paint));
frame.add(tube(new THREE.Vector3(-0.04, REAR.y, REAR.z), new THREE.Vector3(-0.02, BB.y, BB.z), 0.012, paint));
frame.add(tube(new THREE.Vector3(0.04, REAR.y, REAR.z), new THREE.Vector3(0.05, BB.y, BB.z), 0.012, paint));
const seat = new THREE.Vector3(0, 0.9, 0.2);
frame.add(tube(BB, seat, 0.016, paint));
frame.add(tube(REAR, new THREE.Vector3(0, 0.78, 0.16), 0.012, paint));
frame.add(tube(BB, new THREE.Vector3(0, 0.4, -0.32), 0.016, paint));
frame.add(tube(new THREE.Vector3(0, 0.4, -0.32), HEAD_TUBE, 0.015, paint));
const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), leather);
saddle.scale.set(1, 0.42, 1.55);
saddle.position.copy(seat);
saddle.castShadow = true;
frame.add(saddle);

arc(0, REAR.y, REAR.z, WHEEL_R + 0.045, -2.15, 2.15, 7, 0.012, cream, frame);
const rack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.34), paintDark);
rack.position.set(0, 0.64, 0.4);
rack.castShadow = true;
frame.add(rack);
const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.2), paperMat);
parcel.position.set(0, 0.71, 0.4);
parcel.castShadow = true;
frame.add(parcel);
frame.add(tube(new THREE.Vector3(-0.08, 0.71, 0.4), new THREE.Vector3(0.08, 0.71, 0.4), 0.006, stringMat, 4));
frame.add(tube(new THREE.Vector3(0, 0.71, 0.3), new THREE.Vector3(0, 0.71, 0.5), 0.006, stringMat, 4));
const fishTail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 0.1), stdMat(0xd7d2c8, 0.45, 0.05));
fishTail.position.set(0, 0.73, 0.54);
fishTail.geometry.translate(0, 0, 0.04);
frame.add(fishTail);

const chainX = 0.075;
frame.add(tube(
  new THREE.Vector3(chainX, BB.y + 0.09, BB.z),
  new THREE.Vector3(chainX, REAR.y + 0.04, REAR.z),
  0.007, chainMat, 4,
));
frame.add(tube(
  new THREE.Vector3(chainX, BB.y - 0.09, BB.z),
  new THREE.Vector3(chainX, REAR.y - 0.04, REAR.z),
  0.007, chainMat, 4,
));

const fork = new THREE.Group();
fork.position.copy(HEAD_TUBE);
pitch.add(fork);
const wheelLocal = FRONT.clone().sub(HEAD_TUBE);
frontWheel.position.copy(wheelLocal);
fork.add(frontWheel);
fork.add(tube(new THREE.Vector3(-0.035, 0, 0), wheelLocal.clone().add(new THREE.Vector3(-0.03, 0, 0)), 0.012, paint));
fork.add(tube(new THREE.Vector3(0.035, 0, 0), wheelLocal.clone().add(new THREE.Vector3(0.03, 0, 0)), 0.012, paint));
arc(wheelLocal.x, wheelLocal.y, wheelLocal.z, WHEEL_R + 0.045, -1.7, 1.7, 6, 0.012, cream, fork);

const barLocal = BARS.clone().sub(HEAD_TUBE);
fork.add(tube(new THREE.Vector3(0, 0.02, 0.02), barLocal, 0.014, paint));
fork.add(tube(barLocal.clone().add(new THREE.Vector3(-0.22, 0, 0)), barLocal.clone().add(new THREE.Vector3(0.22, 0, 0)), 0.012, paintDark));
const gripL = new THREE.Object3D();
gripL.position.copy(barLocal).add(new THREE.Vector3(-0.27, -0.02, 0.07));
const gripR = new THREE.Object3D();
gripR.position.copy(barLocal).add(new THREE.Vector3(0.27, -0.02, 0.07));
fork.add(gripL, gripR);
fork.add(tube(barLocal.clone().add(new THREE.Vector3(-0.2, 0, 0)), gripL.position, 0.011, leather));
fork.add(tube(barLocal.clone().add(new THREE.Vector3(0.2, 0, 0)), gripR.position, 0.011, leather));

const bell = new THREE.Group();
bell.position.copy(gripL.position).add(new THREE.Vector3(0.05, 0.045, -0.01));
const bellCup = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), brass);
bellCup.scale.set(1, 0.62, 1);
bell.add(bellCup);
fork.add(bell);

const lamp = new THREE.Group();
lamp.position.copy(wheelLocal).add(new THREE.Vector3(0, 0.16, -0.02));
const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.07, 8), brass);
lampBody.rotation.x = Math.PI / 2;
lamp.add(lampBody);
const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 10), new THREE.MeshBasicMaterial({ color: 0xffe1b0 }));
lens.position.z = -0.03;
lamp.add(lens);
fork.add(lamp);
const lampLight = new THREE.PointLight(0xffc89a, 4.5, 6.5, 2);
lampLight.position.copy(lamp.position);
fork.add(lampLight);

const crank = new THREE.Group();
crank.position.copy(BB);
pitch.add(crank);
const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.014, 16), chainMat);
ring.rotation.z = Math.PI / 2;
ring.position.x = 0.06;
crank.add(ring);
function makePedal(side) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018, CRANK_ARM, 0.026), paintDark);
  arm.geometry.translate(0, -side * CRANK_ARM / 2, 0);
  arm.position.x = side * 0.045;
  arm.castShadow = true;
  crank.add(arm);
  const pedal = new THREE.Group();
  pedal.position.set(side * 0.1, -side * CRANK_ARM, 0);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.018, 0.052), stdMat(0xc4a574, 0.62, 0.04));
  pad.castShadow = true;
  pedal.add(pad);
  const mark = new THREE.Object3D();
  mark.position.y = 0.03;
  pedal.add(mark);
  crank.add(pedal);
  return { pedal, mark };
}
const pedalRight = makePedal(1);
const pedalLeft = makePedal(-1);

const bodyMat = stdMat(0x7d6a5c, 0.72, 0);
const bellyMat = stdMat(0xc8b6a4, 0.74, 0);
const neckMat = stdMat(0xf4efe6, 0.68, 0);
const headMat = stdMat(0xf3e3b0, 0.6, 0);
const napeMat = stdMat(0x6a4034, 0.75, 0);
const beakMat = stdMat(0xe0a84a, 0.4, 0.02);
const beakDark = stdMat(0x8c4e30, 0.46, 0);
const pouchMat = stdMat(0xc46b52, 0.48, 0);
const wingMat = stdMat(0x4a525c, 0.7, 0);
const primMat = stdMat(0x24282e, 0.62, 0);
const legMat = stdMat(0x6a7278, 0.72, 0);
const footMat = stdMat(0x7d868c, 0.7, 0, { side: THREE.DoubleSide });
const wingPlaneMat = stdMat(0x6d6258, 0.72, 0, { side: THREE.DoubleSide });
const primPlaneMat = stdMat(0x2c3136, 0.64, 0, { side: THREE.DoubleSide });

const body = new THREE.Group();
pitch.add(body);
const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), bodyMat);
bodyMesh.scale.set(1.05, 0.82, 1.45);
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
body.add(bodyMesh);
const belly = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), bellyMat);
belly.scale.set(0.95, 0.75, 1.15);
belly.position.set(0, -0.06, 0.02);
belly.castShadow = true;
body.add(belly);
const chest = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), neckMat);
chest.scale.set(1, 0.9, 0.95);
chest.position.set(0, 0.05, -0.16);
chest.castShadow = true;
body.add(chest);
for (const side of [-1, 1]) {
  const mass = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), wingMat);
  mass.scale.set(0.42, 0.85, 1.25);
  mass.position.set(side * 0.2, -0.02, 0.02);
  mass.rotation.z = side * -0.22;
  mass.castShadow = true;
  body.add(mass);
}
const tail = new THREE.Group();
tail.position.set(0, 0.02, 0.26);
body.add(tail);
for (let i = -2; i <= 2; i++) {
  const geo = new THREE.BoxGeometry(0.055, 0.01, 0.24);
  geo.translate(0, 0, 0.11);
  const f = new THREE.Mesh(geo, i === 0 ? napeMat : primMat);
  f.rotation.y = i * 0.16;
  f.castShadow = true;
  tail.add(f);
}

const neckSeg = [
  boneMesh(0.22, 0.086, 0.064, neckMat),
  boneMesh(0.22, 0.064, 0.05, neckMat),
  boneMesh(0.2, 0.05, 0.042, neckMat),
];
neckSeg.forEach((seg) => pitch.add(seg));

const head = new THREE.Group();
pitch.add(head);
const skull = new THREE.Mesh(new THREE.SphereGeometry(0.108, 18, 14), headMat);
skull.scale.set(1.02, 0.78, 1.18);
skull.castShadow = true;
head.add(skull);
const nape = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 8), napeMat);
nape.scale.set(0.95, 0.72, 0.85);
nape.position.set(0, 0.035, 0.06);
head.add(nape);
for (let i = -1; i <= 1; i++) {
  const tuft = feather(0.11, 0.034, napeMat);
  tuft.position.set(i * 0.022, 0.05, 0.05);
  tuft.rotation.y = Math.PI * 0.55;
  tuft.rotation.z = i * 0.28 + 0.45;
  head.add(tuft);
}
const beak = new THREE.Mesh(profileTube([
  { z: 0, y: 0.012, w: 0.072, h: 0.046 },
  { z: -0.18, y: 0.004, w: 0.058, h: 0.032 },
  { z: -0.36, y: -0.012, w: 0.036, h: 0.02 },
  { z: -0.52, y: -0.028, w: 0.012, h: 0.01 },
], 10), beakMat);
beak.castShadow = true;
beak.position.set(0, 0.018, -0.09);
head.add(beak);
const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.42), beakDark);
ridge.position.set(0, 0.055, -0.3);
head.add(ridge);
const nail = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), beakDark);
nail.scale.set(0.7, 0.85, 1.3);
nail.position.set(0, -0.016, -0.63);
head.add(nail);
const beakTip = new THREE.Object3D();
beakTip.position.set(0, -0.028, -0.52);
beak.add(beakTip);
const pouch = new THREE.Mesh(profileTube([
  { z: 0.04, y: -0.02, w: 0.055, h: 0.04 },
  { z: -0.12, y: -0.11, w: 0.125, h: 0.095 },
  { z: -0.28, y: -0.17, w: 0.105, h: 0.075 },
  { z: -0.46, y: -0.06, w: 0.032, h: 0.022 },
], 10), pouchMat);
pouch.castShadow = true;
pouch.position.set(0, -0.03, -0.07);
head.add(pouch);
for (const side of [-1, 1]) {
  const eye = new THREE.Group();
  eye.position.set(side * 0.068, 0.028, -0.07);
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), stdMat(0xf7f1df, 0.35, 0));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), stdMat(0x16181c, 0.3, 0));
  pupil.position.set(side * 0.012, -0.002, -0.022);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glint.position.set(side * 0.014, 0.01, -0.026);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0045, 6, 12), stdMat(0x6a8ea4, 0.4, 0));
  ring.rotation.y = Math.PI / 2;
  eye.add(white, pupil, glint, ring);
  head.add(eye);
  eye.userData.side = side;
  if (side < 0) head.userData.eyeL = eye;
  else head.userData.eyeR = eye;
}

const thighR = boneMesh(THIGH, 0.055, 0.04, legMat);
const shinR = boneMesh(SHIN, 0.038, 0.026, legMat);
const thighL = boneMesh(THIGH, 0.055, 0.04, legMat);
const shinL = boneMesh(SHIN, 0.038, 0.026, legMat);
const armR = boneMesh(UPPER_ARM, 0.048, 0.036, bodyMat);
const farmR = boneMesh(FOREARM, 0.034, 0.024, wingMat);
const armL = boneMesh(UPPER_ARM, 0.048, 0.036, bodyMat);
const farmL = boneMesh(FOREARM, 0.034, 0.024, wingMat);
[thighR, shinR, thighL, shinL, armR, farmR, armL, farmL].forEach((m) => pitch.add(m));

function drapeMesh(material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.castShadow = true;
  pitch.add(mesh);
  return mesh;
}
const wingR = [drapeMesh(wingPlaneMat), drapeMesh(primPlaneMat)];
const wingL = [drapeMesh(wingPlaneMat), drapeMesh(primPlaneMat)];
const _wf = new THREE.Vector3();
const _wt = new THREE.Vector3();
const _wx = new THREE.Vector3();
const _wy = new THREE.Vector3();
const _wz = new THREE.Vector3();
const _wm = new THREE.Matrix4();
function hangPlane(mesh, from, to, drop, side) {
  _wf.copy(from);
  _wt.copy(to);
  _wy.subVectors(_wt, _wf);
  if (_wy.lengthSq() < 1e-6) _wy.set(0, 0, -1);
  const span = Math.max(0.1, _wy.length());
  _wy.normalize();
  _wx.set(side * 0.38, -1, 0.05);
  _wx.addScaledVector(_wy, -_wx.dot(_wy));
  if (_wx.lengthSq() < 1e-5) _wx.set(side, 0, 0);
  _wx.normalize();
  _wz.crossVectors(_wx, _wy).normalize();
  mesh.position.copy(_wf).lerp(_wt, 0.55);
  mesh.position.addScaledVector(_wx, drop * 0.48);
  mesh.scale.set(drop, span * 1.04, 1);
  mesh.quaternion.setFromRotationMatrix(_wm.makeBasis(_wx, _wy, _wz));
}
for (const side of [-1, 1]) {
  for (let i = 0; i < 5; i++) {
    const len = 0.36 - i * 0.025;
    const geo = new THREE.BoxGeometry(0.05, 0.014, len);
    geo.translate(0, 0, len * 0.42);
    const f = new THREE.Mesh(geo, i > 3 ? primPlaneMat : wingPlaneMat);
    f.position.set(side * (0.14 + i * 0.015), 0.04 - i * 0.015, -0.04);
    f.rotation.y = side * (0.55 + i * 0.14);
    f.rotation.x = -0.55 - i * 0.07;
    f.castShadow = true;
    body.add(f);
  }
}

function webFoot() {
  const positions = [
    0, 0.01, 0.02,
    -0.05, 0.008, -0.09,
    0.05, 0.008, -0.09,
    0, 0.012, -0.12,
    0, -0.004, 0.02,
    -0.05, -0.006, -0.09,
    0.05, -0.006, -0.09,
  ];
  const indices = [
    0, 1, 3, 0, 3, 2,
    4, 6, 5,
    0, 4, 1, 1, 4, 5,
    0, 2, 4, 2, 6, 4,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, footMat);
  mesh.castShadow = true;
  return mesh;
}
const footMeshR = webFoot();
const footMeshL = webFoot();
footMeshR.scale.set(1.4, 1, 1.5);
footMeshL.scale.set(1.4, 1, 1.5);
pitch.add(footMeshR, footMeshL);
const kneeBallR = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), legMat);
const kneeBallL = kneeBallR.clone();
const elbowBallR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), wingMat);
const elbowBallL = elbowBallR.clone();
[kneeBallR, kneeBallL, elbowBallR, elbowBallL].forEach((m) => { m.castShadow = true; pitch.add(m); });

function placeProp(angle, radius, group) {
  group.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  group.rotation.y = angle;
  scene.add(group);
}

const house = new THREE.Group();
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.1, 8), lambert(0x6a5a4a));
plinth.position.y = -0.2;
house.add(plinth);
const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 3.1, 10), lambert(0xf2efe6));
tower.position.y = 1.7;
house.add(tower);
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.28, 10), lambert(0xa33b32));
band.position.y = 2.35;
house.add(band);
const room = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 8), new THREE.MeshStandardMaterial({
  color: 0xffd7a2, emissive: 0xffa24a, emissiveIntensity: 0.7, roughness: 0.4,
}));
room.position.y = 3.4;
house.add(room);
const roof = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.4, 8), lambert(0x2a3338));
roof.position.y = 3.8;
house.add(roof);
const beam = new THREE.Mesh(new THREE.ConeGeometry(1.1, 12, 10, 1, true), new THREE.MeshBasicMaterial({
  color: 0xffe0b0, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
}));
beam.rotation.z = Math.PI / 2;
beam.position.set(6.2, 3.4, 0);
house.add(beam);
placeProp(0.85, OUTER + 1.35, house);

const stall = new THREE.Group();
const counter = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.55), lambert(0x6b422c));
counter.position.y = 0.45;
stall.add(counter);
const awning = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.9), lambert(0xffffff, { map: awningTexture() }));
awning.position.set(0, 1.25, 0.05);
awning.rotation.x = -0.18;
stall.add(awning);
const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), postMat);
poleL.position.set(-0.6, 0.7, 0.2);
const poleR = poleL.clone();
poleR.position.x = 0.6;
stall.add(poleL, poleR);
for (let i = 0; i < 3; i++) {
  const fish = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), stdMat(0xd7a15a, 0.45, 0.08));
  fish.scale.set(0.7, 0.45, 1.4);
  fish.position.set(-0.28 + i * 0.26, 0.86, 0.02);
  fish.rotation.y = 0.4;
  stall.add(fish);
}
placeProp(2.15, OUTER - 0.55, stall);

const pots = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.28, 8), lambert(0x355c58));
  pot.position.y = 0.2 + i * 0.26;
  pots.add(pot);
}
placeProp(3.55, OUTER - 0.45, pots);

const boat = new THREE.Group();
const hull = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), lambert(0x8a4a32));
hull.scale.set(0.55, 0.28, 1.2);
boat.add(hull);
const seatPlank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.16), cream);
seatPlank.position.y = 0.12;
boat.add(seatPlank);
boat.position.set(Math.sin(4.4) * (INNER - 2.4), -0.78, Math.cos(4.4) * (INNER - 2.4));
scene.add(boat);

const buoy = new THREE.Group();
const buoyBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lambert(0xd8573a));
buoy.add(buoyBall);
const buoyBand = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.08, 10), lambert(0xf4efe6));
buoy.add(buoyBand);
buoy.position.set(Math.sin(5.3) * 5.5, -0.62, Math.cos(5.3) * 5.5);
scene.add(buoy);

function makeGull() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lambert(0xf7f4ee));
  b.scale.set(0.55, 0.4, 1.2);
  g.add(b);
  const wingGeo = new THREE.BoxGeometry(0.48, 0.015, 0.12);
  wingGeo.translate(0.26, 0, 0);
  const wL = new THREE.Mesh(wingGeo, lambert(0xd9d3c8));
  const wR = new THREE.Mesh(wingGeo, lambert(0xd9d3c8));
  wR.scale.x = -1;
  g.add(wL, wR);
  g.userData.wings = [wL, wR];
  scene.add(g);
  return g;
}
const gulls = [makeGull(), makeGull()];

function makeFish() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), stdMat(0xe7d5c4, 0.4, 0.1));
  b.scale.set(0.45, 0.7, 1.3);
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.1), stdMat(0xd8a07a, 0.5, 0));
  t.position.z = 0.16;
  g.add(b, t);
  g.visible = false;
  scene.add(g);
  return g;
}
const jumpers = [makeFish(), makeFish()];

const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({
  map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false,
}));
blob.rotation.x = -Math.PI / 2;
blob.renderOrder = 2;
scene.add(blob);

const lanterns = [];
const lanternMat = new THREE.MeshStandardMaterial({
  color: 0xffb15a, emissive: 0xff7a2a, emissiveIntensity: 1.15, roughness: 0.55,
});
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 + 0.2;
  const root = new THREE.Group();
  root.position.set(Math.sin(a) * (OUTER - 0.12), 0, Math.cos(a) * (OUTER - 0.12));
  root.rotation.y = a;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.35, 6), postMat);
  pole.position.y = 1.15;
  root.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.85), postMat);
  arm.position.set(0, 2.28, -0.4);
  root.add(arm);
  const hanger = new THREE.Group();
  hanger.position.set(0, 2.26, -0.78);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 4), ropeMat);
  cord.position.y = -0.14;
  hanger.add(cord);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lanternMat);
  globe.scale.y = 0.82;
  globe.position.y = -0.36;
  hanger.add(globe);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.06, 8), lambert(0x6a3030));
  cap.position.y = -0.24;
  hanger.add(cap);
  root.add(hanger);
  scene.add(root);
  lanterns.push(hanger);
}

for (let i = 0; i < 5; i++) {
  const a = 1.2 + i * 1.15;
  const hill = new THREE.Mesh(new THREE.ConeGeometry(2.2 + (i % 3), 3 + (i % 2) * 1.4, 6), lambert(0x1d3a44));
  hill.position.set(Math.sin(a) * (42 + i * 3), -1.2, Math.cos(a) * (42 + i * 3));
  scene.add(hill);
}

let audio = null;
function ensureAudio() {
  if (audio) return audio;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.992 * b0 + 0.008 * white;
    data[i] = b0 * 1.8;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  const amb = ctx.createGain();
  amb.gain.value = 0.0001;
  src.connect(filter);
  filter.connect(amb);
  amb.connect(master);
  src.start();
  audio = { ctx, master, amb };
  return audio;
}

function setAmbient(on) {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  audio.amb.gain.cancelScheduledValues(now);
  audio.amb.gain.linearRampToValueAtTime(on ? 0.04 : 0.0001, now + 0.18);
}

function tone(freqA, freqB, dur, type, gain) {
  if (state.muted) return;
  const a = ensureAudio();
  if (!a) return;
  if (a.ctx.state === 'suspended') a.ctx.resume();
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  const o2 = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = type;
  o2.type = 'sine';
  o.frequency.setValueAtTime(freqA, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freqB), t + dur);
  o2.frequency.setValueAtTime(freqA * 1.5, t);
  o2.frequency.exponentialRampToValueAtTime(Math.max(40, freqB * 1.25), t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o2.connect(g);
  g.connect(a.master);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.02);
  o2.stop(t + dur + 0.02);
}

function ringBell() {
  if (state.time - state.bellLock < 0.28) return;
  state.bellLock = state.time;
  state.bellT = 0;
  tone(1318, 988, 0.62, 'sine', 0.16);
}

function doSquawk() {
  if (state.time - state.squawkLock < 0.55) return;
  state.squawkLock = state.time;
  state.squawkT = 0;
  tone(460, 140, 0.42, 'triangle', 0.1);
}

function syncSoundButton() {
  soundBtn.textContent = state.muted ? '声关' : '声开';
  soundBtn.setAttribute('aria-pressed', state.muted ? 'false' : 'true');
  soundBtn.setAttribute('aria-label', state.muted ? '声音关，按 M 打开' : '声音开，按 M 关闭');
}

function toggleSound() {
  state.muted = !state.muted;
  if (!state.muted) {
    const a = ensureAudio();
    if (a && a.ctx.state === 'suspended') a.ctx.resume();
    setAmbient(true);
  } else {
    setAmbient(false);
  }
  syncSoundButton();
  savePref('muted', state.muted);
}

function cycleCam() {
  state.cam = (state.cam + 1) % CAMS.length;
  camera.fov = CAMS[state.cam].fov;
  resize();
  savePref('cam', state.cam);
}

function toggleHelp() {
  const open = helpEl.hidden;
  helpEl.hidden = !open;
  document.getElementById('btn-help').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) hideHint();
}

function resetRide() {
  state.yaw = -Math.PI / 2;
  rig.position.set(0, 0, PIER_R);
  rig.rotation.set(0, state.yaw, 0);
  state.speed = CRUISE;
  state.wheelSpin = -2.05;
  state.steerSm = 0;
  state.lean = 0;
  state.pitch = 0;
  leanG.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
}

function rockPoint(x, y, z, angle, out) {
  const dx = x - bodyCenter.x;
  const dy = y - bodyCenter.y;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out.set(
    bodyCenter.x + dx * c - dy * s,
    bodyCenter.y + dx * s + dy * c,
    z,
  );
  return out;
}

function squawkEnv() {
  if (state.squawkT < 0 || state.squawkT > 0.72) return 0;
  return Math.sin((state.squawkT / 0.72) * Math.PI);
}

function portraitFov(base) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect >= 0.72) return base;
  const horizontal = 27 * Math.PI / 180;
  const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / aspect) * 180 / Math.PI;
  return Math.min(58, Math.max(base, vertical));
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dockH = document.querySelector('.dock').getBoundingClientRect().height;
  const lift = Math.min(dockH * 0.92, h * 0.34);
  camera.fov = portraitFov(CAMS[state.cam].fov);
  camera.aspect = w / Math.max(1, h);
  camera.setViewOffset(w, h + lift, 0, 0, w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 520 ? 1.5 : 1.75));
  renderer.setSize(w, h, false);
}

function readBasis() {
  fwd.set(0, 0, -1).applyQuaternion(rig.quaternion);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1);
  fwd.normalize();
  right.crossVectors(fwd, UP).normalize();
}

function update(dt) {
  state.time += dt;
  const steerRaw = state.override
    ? state.override.steer
    : Math.max(-1, Math.min(1,
      (held.has('ArrowLeft') || held.has('KeyA') || buttons.left ? -1 : 0)
      + (held.has('ArrowRight') || held.has('KeyD') || buttons.right ? 1 : 0)
      + dragSteer));
  const boost = state.override ? state.override.boost : (buttons.boost || held.has('KeyW') || held.has('ArrowUp'));
  const brake = state.override ? state.override.brake : (buttons.brake || held.has('KeyS') || held.has('ArrowDown'));
  state.steerSm = damp(state.steerSm, steerRaw, 14, dt);

  const speedTarget = brake ? 0 : (boost ? VMAX : CRUISE);
  const speedLambda = brake ? 3.2 : (boost ? 1.7 : 0.7);
  state.speed = damp(state.speed, speedTarget, speedLambda, dt);

  const turn = 1.55 * (1 - Math.min(state.speed, VMAX) / VMAX * 0.28);
  state.yaw += -state.steerSm * turn * dt;

  rig.rotation.y = state.yaw;
  readBasis();
  const assist = Math.abs(state.steerSm) < 0.08 && !brake;
  radial.set(rig.position.x, 0, rig.position.z);
  const rlen = Math.max(0.001, radial.length());
  radial.multiplyScalar(1 / rlen);
  const ccwX = radial.z;
  const ccwZ = -radial.x;
  const ccwDot = fwd.x * ccwX + fwd.z * ccwZ;
  const cwDot = -ccwDot;
  const ccw = ccwDot >= cwDot;
  tangent.set(ccw ? ccwX : -ccwX, 0, ccw ? ccwZ : -ccwZ);
  if (assist && state.speed > 0.15) {
    const radialErr = rlen - PIER_R;
    const bias = Math.max(-0.32, Math.min(0.32, radialErr * 0.1));
    const targetYaw = yawForForward(tangent.x, tangent.z) + (ccw ? 1 : -1) * bias;
    state.yaw = dampAngle(state.yaw, targetYaw, 3.4, dt);
    state.yaw += (ccw ? 1 : -1) * (state.speed / rlen) * dt;
    rig.rotation.y = state.yaw;
    readBasis();
  }

  rig.position.addScaledVector(fwd, state.speed * dt);
  let rr = Math.hypot(rig.position.x, rig.position.z);
  const minR = INNER + 0.7;
  const maxR = OUTER - 0.7;
  if (rr < minR || rr > maxR) {
    const clamped = Math.min(maxR, Math.max(minR, rr));
    const s = clamped / Math.max(rr, 0.001);
    rig.position.x *= s;
    rig.position.z *= s;
    state.speed *= 0.992;
    rr = clamped;
  }

  state.wheelSpin -= state.speed * dt / WHEEL_R;
  const crankAng = state.wheelSpin / GEAR;
  const leanTarget = -state.steerSm * 0.26 * Math.min(1, state.speed / 3);
  state.lean = damp(state.lean, leanTarget, 6, dt);
  const accel = speedTarget - state.speed;
  const pitchTarget = Math.max(-0.08, Math.min(0.07, accel * 0.02));
  state.pitch = damp(state.pitch, brake ? -0.05 : pitchTarget, 4, dt);
  leanG.rotation.z = state.lean;
  pitch.rotation.x = state.pitch;
  fork.rotation.y = -state.steerSm * 0.42;
  crank.rotation.x = crankAng;
  rearWheel.rotation.x = state.wheelSpin;
  frontWheel.rotation.x = state.wheelSpin;
  pedalRight.pedal.rotation.x = -crankAng;
  pedalLeft.pedal.rotation.x = -crankAng;

  const cadence = Math.abs(state.speed) / (WHEEL_R * GEAR * Math.PI * 2);
  const bobAmp = state.reduced ? 0.003 : Math.min(0.022, 0.01 + cadence * 0.01);
  const rockAmp = state.reduced ? 0.006 : 0.045;
  state.bob = -Math.cos(crankAng * 2) * bobAmp;
  const rock = -Math.cos(crankAng) * rockAmp;
  bodyCenter.set(0, 1.0 + state.bob, 0.3);
  body.position.copy(bodyCenter);
  body.rotation.z = rock;

  const sq = squawkEnv();
  if (state.squawkT >= 0) {
    state.squawkT += dt;
    if (state.squawkT > 0.72) state.squawkT = -1;
  }
  rockPoint(0, 1.1 + state.bob, 0.1, rock, neckP[0]);
  rockPoint(0, 1.28 + state.bob * 0.6, -0.02, rock, neckP[1]);
  rockPoint(0, 1.42 + state.bob * 0.3 + sq * 0.05, -0.16 + sq * 0.08, rock, neckP[2]);
  rockPoint(0, 1.38 + state.bob * 0.15 + sq * 0.1, -0.32 + sq * 0.12, rock, neckP[3]);
  const neckPole = desire.set(0.2, 1, 0);
  for (let i = 0; i < 3; i++) orientBone(neckSeg[i], neckP[i], neckP[i + 1], neckPole);
  head.position.copy(neckP[3]);
  headFwd.set(-state.steerSm * 0.22, -0.26 + sq * 0.95, -1 + sq * 0.35).normalize();
  _hZ.copy(headFwd).negate();
  _hX.crossVectors(UP, _hZ);
  if (_hX.lengthSq() < 1e-6) _hX.set(1, 0, 0);
  _hX.normalize();
  _hY.crossVectors(_hZ, _hX).normalize();
  head.quaternion.setFromRotationMatrix(_hM.makeBasis(_hX, _hY, _hZ));

  const pouchTarget = sq * 0.34 - state.bob * 1.6;
  state.pouchV += (pouchTarget - state.pouch) * 28 * dt - state.pouchV * 6.5 * dt;
  state.pouch += state.pouchV * dt;
  const pouchScale = 1 + state.pouch;
  pouch.scale.set(1 + state.pouch * 0.45, pouchScale, 1 + state.pouch * 0.25);
  pouch.position.y = -0.03 - state.pouch * 0.08;

  if (state.time > state.nextBlink) {
    state.blink = 0.001;
    state.nextBlink = state.time + 2.4 + Math.random() * 3.4;
  }
  if (state.blink > 0) {
    state.blink += dt;
    const u = state.blink / 0.16;
    const shut = u < 1 ? Math.sin(Math.min(u, 1) * Math.PI) : 0;
    const s = Math.max(0.08, 1 - shut * 0.92);
    head.userData.eyeL.scale.y = s;
    head.userData.eyeR.scale.y = s;
    if (state.blink > 0.16) state.blink = 0;
  }

  tail.rotation.x = -0.42 + Math.sin(crankAng * 2) * (state.reduced ? 0 : 0.06);
  tail.rotation.y = -state.steerSm * 0.28 + Math.sin(state.time * 2.1) * (state.reduced ? 0 : 0.05);
  if (state.bellT >= 0) {
    state.bellT += dt;
    const k = Math.max(0, 1 - state.bellT / 0.45);
    bell.rotation.z = Math.sin(state.bellT * 46) * 0.4 * k;
    if (state.bellT > 0.45) state.bellT = -1;
  }
  fishTail.rotation.y = Math.sin(state.time * 5.5) * 0.22;

  rig.updateMatrixWorld(true);
  pedalRight.mark.getWorldPosition(footR);
  pedalLeft.mark.getWorldPosition(footL);
  gripR.getWorldPosition(handR);
  gripL.getWorldPosition(handL);
  pitch.worldToLocal(footR);
  pitch.worldToLocal(footL);
  pitch.worldToLocal(handR);
  pitch.worldToLocal(handL);

  rockPoint(0.08, 0.78 + state.bob, 0.12, rock, hipR);
  rockPoint(-0.08, 0.78 + state.bob, 0.12, rock, hipL);
  rockPoint(0.16, 1.06 + state.bob, 0.06, rock, shoulderR);
  rockPoint(-0.16, 1.06 + state.bob, 0.06, rock, shoulderL);
  shoulderR.y += Math.sin(crankAng) * 0.008;
  shoulderL.y += Math.sin(crankAng + Math.PI) * 0.008;

  solveJoint(hipR, footR, THIGH, SHIN, desire.set(0.55, 0.1, 0.85), knee);
  orientBone(thighR, hipR, knee, desire.set(0.55, 0.1, 0.85));
  orientBone(shinR, knee, footR, desire.set(0.55, 0.1, 0.85));
  kneeBallR.position.copy(knee);
  solveJoint(hipL, footL, THIGH, SHIN, desire.set(-0.55, 0.1, 0.85), knee);
  orientBone(thighL, hipL, knee, desire.set(-0.55, 0.1, 0.85));
  orientBone(shinL, knee, footL, desire.set(-0.55, 0.1, 0.85));
  kneeBallL.position.copy(knee);

  solveJoint(shoulderR, handR, UPPER_ARM, FOREARM, desire.set(1, 0.2, 0.35), elbow);
  orientBone(armR, shoulderR, elbow, desire.set(1, 0.2, 0.35));
  orientBone(farmR, elbow, handR, desire.set(1, 0.2, 0.35));
  elbowBallR.position.copy(elbow);
  hangPlane(wingR[0], shoulderR, elbow, 0.16, 1);
  hangPlane(wingR[1], elbow, handR, 0.11, 1);
  solveJoint(shoulderL, handL, UPPER_ARM, FOREARM, desire.set(-1, 0.2, 0.35), elbow);
  orientBone(armL, shoulderL, elbow, desire.set(-1, 0.2, 0.35));
  orientBone(farmL, elbow, handL, desire.set(-1, 0.2, 0.35));
  elbowBallL.position.copy(elbow);
  hangPlane(wingL[0], shoulderL, elbow, 0.16, -1);
  hangPlane(wingL[1], elbow, handL, 0.11, -1);

  footMeshR.position.copy(footR);
  footMeshL.position.copy(footL);
  footMeshR.rotation.set(0.2, 0.12, 0.04);
  footMeshL.rotation.set(0.2, -0.12, -0.04);

  const sway = state.reduced ? 0 : 1;
  lanterns.forEach((h, i) => {
    h.rotation.z = Math.sin(state.time * 1.25 + i) * 0.07 * sway;
  });
  beam.rotation.y = state.time * 0.35;
  boat.position.y = -0.78 + Math.sin(state.time * 0.8) * 0.04 * sway;
  boat.rotation.z = Math.sin(state.time * 0.6) * 0.03 * sway;
  buoy.position.y = -0.62 + Math.sin(state.time * 1.3 + 1) * 0.06 * sway;

  gulls.forEach((g, i) => {
    const th = state.time * (0.13 + i * 0.04) + i * 2.2;
    const rad = 24 + i * 6;
    const px = Math.cos(th) * rad;
    const pz = Math.sin(th) * rad;
    g.position.set(px, 5.2 + Math.sin(state.time * 0.7 + i) * 0.35, pz);
    const vx = -Math.sin(th);
    const vz = Math.cos(th);
    g.rotation.y = yawForForward(vx, vz);
    const flap = Math.sin(state.time * (state.reduced ? 0 : 6.2) + i) * 0.55;
    g.userData.wings[0].rotation.z = flap;
    g.userData.wings[1].rotation.z = -flap;
  });

  jumpers.forEach((fish, i) => {
    const period = 6.8;
    const phase = (state.time * (state.reduced ? 0.35 : 1) + i * 3.1) % period;
    if (phase > 1.25) {
      fish.visible = false;
      return;
    }
    fish.visible = true;
    const u = phase / 1.25;
    const ang = 1.4 + i * 2.4;
    const rad = 5.2 + i * 1.3;
    fish.position.set(Math.sin(ang) * rad, -0.78 + Math.sin(u * Math.PI) * 1.05, Math.cos(ang) * rad);
    fish.rotation.x = Math.cos(u * Math.PI) * 0.9;
  });

  waterUniforms.uTime.value = state.reduced ? state.time * 0.15 : state.time;

  const mode = CAMS[state.cam];
  readBasis();
  desire.copy(rig.position).addScaledVector(fwd, -mode.dist).addScaledVector(right, mode.side);
  desire.y += mode.height;
  lookTarget.copy(rig.position).addScaledVector(fwd, mode.ahead);
  lookTarget.y += mode.look;
  const camLambda = state.reduced ? 10 : 3.3;
  const blend = 1 - Math.exp(-camLambda * dt);
  camPos.lerp(desire, blend);
  camLook.lerp(lookTarget, blend);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  sun.position.copy(rig.position).add(SUN);
  sun.target.position.set(rig.position.x, 0.7, rig.position.z);
  fill.position.copy(rig.position).add(FILL_OFF);
  key.position.copy(camera.position);
  key.target.position.set(rig.position.x, 0.95, rig.position.z);
  sky.position.copy(camera.position);
  blob.position.set(rig.position.x, 0.02, rig.position.z);
  blob.scale.set(1.15, 1.7, 1);
}

function render() {
  renderer.render(scene, camera);
}

let lastTick = 0;
function tick(now) {
  if (!lastTick) lastTick = now;
  const dt = Math.min(0.05, (now - lastTick) / 1000);
  lastTick = now;
  update(dt);
  render();
  requestAnimationFrame(tick);
}

function selfTest() {
  const errors = [];
  const check = (name, ok, extra) => { if (!ok) errors.push(`${name}${extra ? ` ${extra}` : ''}`); };
  const saved = {
    override: state.override,
    yaw: state.yaw,
    speed: state.speed,
    wheelSpin: state.wheelSpin,
    pos: rig.position.clone(),
    cam: state.cam,
  };
  resetRide();
  state.override = { steer: 0, boost: false, brake: false };
  for (let i = 0; i < 20; i++) update(1 / 60);
  readBasis();
  const f0 = fwd.clone();
  const r0 = right.clone();
  const p0 = rig.position.clone();
  const spin0 = state.wheelSpin;
  for (let i = 0; i < 60; i++) update(1 / 60);
  const d = rig.position.clone().sub(p0);
  d.y = 0;
  check('moved', d.length() > 1.2, d.length().toFixed(2));
  check('faces travel', f0.dot(d.clone().normalize()) > 0.8, f0.dot(d.clone().normalize()).toFixed(2));
  check('wheel rolls forward', state.wheelSpin < spin0 - 0.2, (state.wheelSpin - spin0).toFixed(2));
  rig.updateMatrixWorld(true);
  const beakW = new THREE.Vector3();
  const headW = new THREE.Vector3();
  beakTip.getWorldPosition(beakW);
  head.getWorldPosition(headW);
  const beakDir = beakW.sub(headW);
  beakDir.y = 0;
  beakDir.normalize();
  readBasis();
  check('beak forward', beakDir.dot(fwd) > 0.65, beakDir.dot(fwd).toFixed(2));
  pedalRight.mark.getWorldPosition(footR);
  pitch.worldToLocal(footR);
  check('pedal on foot', footMeshR.position.distanceTo(footR) < 0.02, footMeshR.position.distanceTo(footR).toFixed(3));

  resetRide();
  state.override = { steer: 1, boost: false, brake: false };
  readBasis();
  const fr = fwd.clone();
  const rr = right.clone();
  const pr = rig.position.clone();
  for (let i = 0; i < 48; i++) update(1 / 60);
  const dr = rig.position.clone().sub(pr);
  dr.y = 0;
  check('steer right', dr.dot(rr) > 0.18, dr.dot(rr).toFixed(2));
  check('right still ahead', dr.dot(fr) > 0.4, dr.dot(fr).toFixed(2));

  resetRide();
  state.override = { steer: -1, boost: false, brake: false };
  readBasis();
  const fl = fwd.clone();
  const rl = right.clone();
  const pl = rig.position.clone();
  for (let i = 0; i < 48; i++) update(1 / 60);
  const dl = rig.position.clone().sub(pl);
  dl.y = 0;
  check('steer left', dl.dot(rl) < -0.18, dl.dot(rl).toFixed(2));
  check('left still ahead', dl.dot(fl) > 0.4, dl.dot(fl).toFixed(2));

  resetRide();
  state.override = { steer: 0, boost: true, brake: false };
  for (let i = 0; i < 70; i++) update(1 / 60);
  check('boost', state.speed > CRUISE + 1.2, state.speed.toFixed(2));
  state.override = { steer: 0, boost: false, brake: true };
  for (let i = 0; i < 50; i++) update(1 / 60);
  check('brake', state.speed < 1.2, state.speed.toFixed(2));

  state.override = saved.override;
  state.yaw = saved.yaw;
  state.speed = saved.speed;
  state.wheelSpin = saved.wheelSpin;
  state.cam = saved.cam;
  rig.position.copy(saved.pos);
  rig.rotation.y = state.yaw;
  return { ok: errors.length === 0, errors };
}

state.muted = loadPref('muted', true);
state.cam = loadPref('cam', 0) % CAMS.length;
camera.fov = CAMS[state.cam].fov;
syncSoundButton();
resetRide();
resize();
update(1 / 60);
camPos.copy(desire);
camLook.copy(lookTarget);
camera.position.copy(camPos);
camera.lookAt(camLook);
render();

window.addEventListener('resize', resize);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  state.reduced = e.matches;
});

function bindHold(id, key) {
  const el = document.getElementById(id);
  const down = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    buttons[key] = true;
    el.classList.add('is-down');
    hideHint();
  };
  const up = () => {
    buttons[key] = false;
    el.classList.remove('is-down');
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}
bindHold('btn-left', 'left');
bindHold('btn-right', 'right');
bindHold('btn-boost', 'boost');
bindHold('btn-brake', 'brake');

document.getElementById('btn-bell').addEventListener('click', ringBell);
document.getElementById('btn-squawk').addEventListener('click', doSquawk);
document.getElementById('btn-cam').addEventListener('click', cycleCam);
soundBtn.addEventListener('click', toggleSound);
document.getElementById('btn-help').addEventListener('click', toggleHelp);

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #help')) return;
  dragId = e.pointerId;
  dragX = e.clientX;
  dragSteer = 0;
  hideHint();
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId) return;
  dragSteer = THREE.MathUtils.clamp((e.clientX - dragX) / 62, -1, 1);
});
function endDrag(e) {
  if (e.pointerId !== dragId) return;
  dragId = null;
  dragSteer = 0;
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
  }
  if (e.repeat && ['Space', 'KeyH', 'KeyC', 'KeyM', 'KeyK', 'KeyR'].includes(e.code)) return;
  held.add(e.code);
  hideHint();
  if (e.code === 'Space') ringBell();
  else if (e.code === 'KeyH') doSquawk();
  else if (e.code === 'KeyC') cycleCam();
  else if (e.code === 'KeyM') toggleSound();
  else if (e.code === 'KeyK' || e.code === 'Slash') toggleHelp();
  else if (e.code === 'KeyR') resetRide();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => {
  held.clear();
  buttons.left = buttons.right = buttons.boost = buttons.brake = false;
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

setTimeout(() => hideHint(), 5600);

window.__pelican = {
  state,
  selfTest,
  resetRide,
  update,
  render,
  rig,
  camera,
};

if (new URLSearchParams(location.search).has('autotest')) {
  const result = selfTest();
  resetRide();
  update(1 / 60);
  render();
  const pre = document.createElement('pre');
  pre.id = 'test-out';
  pre.textContent = JSON.stringify(result);
  pre.style.cssText = 'position:fixed;left:0;top:0;z-index:8;max-width:100%;max-height:42vh;overflow:auto;background:#140e0a;color:#f6efe4;font-size:11px;padding:8px';
  document.body.appendChild(pre);
}

requestAnimationFrame(tick);
