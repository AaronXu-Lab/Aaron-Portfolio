// 公共工具：数学、噪声、几何合并、球面摆放
import * as THREE from '../vendor/three.module.min.js';

export { THREE };
export const V3 = THREE.Vector3;
export const R = 40; // 小星球半径

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randDir(rand, out = new V3()) {
  const y = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - y * y);
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
}

// ---------- 值噪声 ----------
function h3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = lerp(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx);
  const b = lerp(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx);
  const c = lerp(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx);
  const d = lerp(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx);
  return lerp(lerp(a, b, fy), lerp(c, d, fy), fz) * 2 - 1;
}
export function fbm(x, y, z, oct = 4) {
  let amp = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * noise3(x * f, y * f, z * f);
    n += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// ---------- 几何 ----------
const _col = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new V3();
const _s = new V3();
const UP = new V3(0, 1, 0);

export function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  _col.set(hex);
  for (let i = 0; i < n; i++) {
    a[i * 3] = _col.r;
    a[i * 3 + 1] = _col.g;
    a[i * 3 + 2] = _col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// 上色并做一次 TRS 变换
export function part(geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const g = paint(geo, hex);
  _p.set(pos[0], pos[1], pos[2]);
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  _s.set(scl[0], scl[1], scl[2]);
  g.applyMatrix4(_m.compose(_p, _q, _s));
  return g;
}

// 两点之间的圆管
export function tube(a, b, r, hex, seg = 6, r2 = r) {
  const d = new V3().subVectors(b, a);
  const len = d.length();
  const g = paint(new THREE.CylinderGeometry(r2, r, len, seg, 1), hex);
  _q.setFromUnitVectors(UP, d.normalize());
  _p.addVectors(a, b).multiplyScalar(0.5);
  g.applyMatrix4(_m.compose(_p, _q, _s.set(1, 1, 1)));
  return g;
}

export function polyTube(pts, r, hex, seg = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push(tube(pts[i], pts[i + 1], r, hex, seg));
  for (let i = 1; i < pts.length - 1; i++) {
    out.push(part(new THREE.SphereGeometry(r, seg, 4), hex, [pts[i].x, pts[i].y, pts[i].z]));
  }
  return out;
}

export function mergeGeos(list) {
  let n = 0;
  const parts = list.map((g) => {
    const q = g.index ? g.toNonIndexed() : g;
    if (!q.attributes.normal) q.computeVertexNormals();
    n += q.attributes.position.count;
    return q;
  });
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3).fill(1);
  let o = 0;
  for (const q of parts) {
    pos.set(q.attributes.position.array, o * 3);
    nor.set(q.attributes.normal.array, o * 3);
    if (q.attributes.color) col.set(q.attributes.color.array, o * 3);
    o += q.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// 贴在球面上的实例矩阵：Y 轴对齐法线，绕法线自转 spin
const _q2 = new THREE.Quaternion();
export function surfaceMatrix(dir, h = 0, spin = 0, scale = 1, out = new THREE.Matrix4()) {
  _q.setFromUnitVectors(UP, dir);
  _q2.setFromAxisAngle(UP, spin);
  _q.multiply(_q2);
  _p.copy(dir).multiplyScalar(R + h);
  if (typeof scale === 'number') _s.set(scale, scale, scale);
  else _s.copy(scale);
  return out.compose(_p, _q, _s);
}

// 让物体本地 +Z 朝向球面上另一点所需的 spin
const _x0 = new V3(), _z0 = new V3(), _f = new V3();
export function spinToward(dir, target) {
  _q.setFromUnitVectors(UP, dir);
  _x0.set(1, 0, 0).applyQuaternion(_q);
  _z0.set(0, 0, 1).applyQuaternion(_q);
  _f.copy(target).sub(dir);
  _f.addScaledVector(dir, -_f.dot(dir));
  return Math.atan2(_f.dot(_x0), _f.dot(_z0));
}
