import * as THREE from '../vendor/three.module.min.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** 沿两点生成一段圆柱（默认沿 +Y 的 CylinderGeometry 变形而来） */
export function tube(a, b, r, rTop = r, radial = 8) {
  const geo = new THREE.CylinderGeometry(rTop, r, 1, radial, 1, false);
  const dir = _dir.subVectors(b, a);
  const len = Math.max(dir.length(), 1e-4);
  _q.setFromUnitVectors(UP, dir.clone().normalize());
  geo.scale(1, len, 1);
  geo.applyQuaternion(_q);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

/** 合并若干几何体（统一转成 non-indexed，便于一次性绘制） */
export function merge(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let p = 0;
  let u = 0;
  for (const g of geos) {
    const np = g.attributes.position.array;
    const nn = g.attributes.normal ? g.attributes.normal.array : null;
    const nu = g.attributes.uv ? g.attributes.uv.array : null;
    pos.set(np, p);
    if (nn) nor.set(nn, p);
    if (nu) uv.set(nu, u);
    p += np.length;
    u += g.attributes.position.count * 2;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/** 椭圆形球体，建模时最常用的软体块 */
export function blob(x, y, z, sx, sy, sz, segments = 18) {
  const g = new THREE.SphereGeometry(1, segments, Math.max(8, Math.round(segments * 0.66)));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

/** 羽毛/叶片：沿 +Y 伸展的扁椭球 */
export function feather(len, width, thick = 0.02) {
  const g = new THREE.SphereGeometry(1, 10, 8);
  g.scale(width, len / 2, thick);
  g.translate(0, len / 2, 0);
  return g;
}

export function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** 用几何体快速生成 Mesh */
export function mesh(geo, material, cast = false) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = false;
  return m;
}

/** 对齐两点之间的动态肢体（几何体需沿 Y 轴、基准长度 baseLen） */
export function placeBetween(object, a, b, baseLen) {
  const dir = _dir.subVectors(b, a);
  const len = Math.max(dir.length(), 1e-4);
  object.position.copy(a).addScaledVector(dir, 0.5);
  object.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
  object.scale.set(1, len / baseLen, 1);
}

/** 两骨 IK：在 hip→foot 连线上，把膝/肘朝 bendDir 方向推出 */
export function solveTwoBone(hip, foot, l1, l2, bendDir, outKnee) {
  const dir = _a.subVectors(foot, hip);
  let d = dir.length();
  if (d < 1e-4) d = 1e-4;
  const max = (l1 + l2) * 0.999;
  const min = Math.abs(l1 - l2) + 0.001;
  const dd = Math.min(Math.max(d, min), max);
  dir.multiplyScalar(1 / d);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const perp = _b.copy(bendDir);
  perp.addScaledVector(dir, -perp.dot(dir));
  if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1);
  perp.normalize();
  outKnee.copy(hip).addScaledVector(dir, a).addScaledVector(perp, h);
  return outKnee;
}
