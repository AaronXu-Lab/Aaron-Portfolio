import * as T from './vendor/three.module.min.js';

export { T };
export const TAU = Math.PI * 2;
export const vec = (x, y, z) => new T.Vector3(x, y, z);
export const paint = (color, options = {}) => new T.MeshStandardMaterial({ color, roughness: .83, ...options });
export const group = (parent, x = 0, y = 0, z = 0) => {
  const object = new T.Group();
  object.position.set(x, y, z);
  parent.add(object);
  return object;
};

const ball = new T.SphereGeometry(1, 21, 14);
const cube = new T.BoxGeometry(1, 1, 1);
const rod = new T.CylinderGeometry(1, 1, 1, 12);
const up = vec(0, 1, 0);
const direction = vec(0, 0, 0);
const axis = vec(0, 0, 0);

export function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

export function oval(parent, material, x, y, z, sx, sy, sz, angle = 0) {
  const object = mesh(parent, ball, material, x, y, z);
  object.scale.set(sx, sy, sz);
  object.rotation.z = angle;
  return object;
}

export function box(parent, material, x, y, z, sx, sy, sz) {
  const object = mesh(parent, cube, material, x, y, z);
  object.scale.set(sx, sy, sz);
  return object;
}

export function alignRod(object, a, b, radius) {
  direction.subVectors(b, a);
  object.position.copy(a).addScaledVector(direction, .5);
  object.quaternion.setFromUnitVectors(up, axis.copy(direction).normalize());
  object.scale.set(radius, direction.length(), radius);
}

export function bar(parent, material, a, b, radius) {
  const object = mesh(parent, rod, material);
  alignRod(object, a, b, radius);
  return object;
}

export function line(parent, material, points, radius, smooth = false) {
  if (smooth) {
    const curve = new T.CatmullRomCurve3(points);
    return mesh(parent, new T.TubeGeometry(curve, 24, radius, 8, false), material);
  }
  for (let i = 1; i < points.length; i++) bar(parent, material, points[i - 1], points[i], radius);
}

export function loft(parent, material, profile) {
  const points = [];
  const indices = [];
  const count = 32;
  for (const [x, y, height, width] of profile) {
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU;
      points.push(x, y + Math.cos(a) * height, Math.sin(a) * width);
    }
  }
  for (let row = 1; row < profile.length; row++) {
    for (let i = 0; i < count; i++) {
      const a = (row - 1) * count + i;
      const b = (row - 1) * count + (i + 1) % count;
      indices.push(a, b, a + count, b, b + count, a + count);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

export function batch(root, scene) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((object) => {
    if (!object.isMesh) return;
    const key = object.geometry.id + ':' + object.material.id + ':' + object.castShadow;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  });
  for (const objects of buckets.values()) {
    const first = objects[0];
    const instances = new T.InstancedMesh(first.geometry, first.material, objects.length);
    objects.forEach((object, index) => instances.setMatrixAt(index, object.matrixWorld));
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = first.castShadow;
    scene.add(instances);
  }
}

export function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
