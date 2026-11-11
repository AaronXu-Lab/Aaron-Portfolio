// 小星球：地形、海、环路、植被、村舍、路灯、云、热气球、鱼群与粒子
import {
  THREE, V3, R, clamp, lerp, sstep, damp, rng, randDir, fbm,
  part, tube, mergeGeos, surfaceMatrix, spinToward,
} from './util.js';

// ---------- 环路：绕轴 A 的一条蜿蜒大圆 ----------
const A = new V3(0.2, 0.1, 0.97).normalize();
const E1 = new V3(0, 1, 0).addScaledVector(A, -A.y).normalize();
const E2 = new V3().crossVectors(A, E1).normalize();
const AMP = 0.27, K = 4;
const _a = new V3(), _b = new V3(), _c = new V3();

function roadCenter(lon, out) {
  const lat = AMP * Math.sin(K * lon), cl = Math.cos(lat);
  return out.set(0, 0, 0)
    .addScaledVector(E1, cl * Math.cos(lon))
    .addScaledVector(E2, cl * Math.sin(lon))
    .addScaledVector(A, Math.sin(lat));
}
export function roadTangent(lon, out = new V3()) {
  roadCenter(lon + 0.004, out);
  roadCenter(lon - 0.004, _a);
  return out.sub(_a).normalize();
}
// off > 0 为行进方向左侧（单位：世界长度）
export function roadDir(lon, off = 0, out = new V3()) {
  roadCenter(lon, out);
  if (off) {
    roadTangent(lon, _b);
    _c.crossVectors(out, _b).normalize();
    out.addScaledVector(_c, off / R).normalize();
  }
  return out;
}
// 到路中心线的近似角距离（弧度）
export function roadDist(p) {
  const lat = Math.asin(clamp(p.dot(A), -1, 1));
  const lon = Math.atan2(p.dot(E2), p.dot(E1));
  const sl = AMP * K * Math.cos(K * lon);
  return Math.abs(lat - AMP * Math.sin(K * lon)) / Math.sqrt(1 + sl * sl);
}

// ---------- 陆地 / 海 ----------
const SEA_T = -0.085;
export function landVal(p) {
  return fbm(p.x * 1.55 + 7.3, p.y * 1.55 - 2.1, p.z * 1.55 + 4.9, 4)
    + 0.7 * sstep(0.36, 0.1, roadDist(p)) - SEA_T;
}
export const depthAt = (p) => 1.5 * sstep(0, 0.22, -landVal(p));

const HEX = {
  g1: '#86c75a', g2: '#6bb650', g3: '#a6d568', meadow: '#c9dc6c',
  sand: '#f1e0ae', bedA: '#d8dcaa', bedB: '#2f7f86',
  road: '#e6c998', trunk: '#8a5a3a', rock: '#9aa4b0',
};

export function buildWorld(scene) {
  const rand = rng(20261111);
  const planet = new THREE.Group();
  planet.position.set(0, -R, 0);
  scene.add(planet);

  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
  const obstacles = [];
  const free = (d, rad) => {
    for (const o of obstacles) {
      const lim = (rad + o.r) / R;
      if (2 - 2 * d.dot(o.dir) < lim * lim) return false;
    }
    return true;
  };
  const block = (dir, r, h) => obstacles.push({ dir: dir.clone(), r, h });

  // ----- 地表 -----
  {
    let geo = new THREE.IcosahedronGeometry(R, 42);
    if (geo.index) geo = geo.toNonIndexed();
    const pos = geo.attributes.position;
    const v = new V3(), c = new V3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const r = R - depthAt(v);
      pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    }
    const col = new Float32Array(pos.count * 3);
    const C = {};
    for (const k in HEX) C[k] = new THREE.Color(HEX[k]);
    const out = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      c.set(0, 0, 0);
      for (let j = 0; j < 3; j++) c.add(v.fromBufferAttribute(pos, i + j));
      c.normalize();
      const lv = landVal(c);
      if (lv < 0) out.copy(C.bedA).lerp(C.bedB, sstep(0, -0.2, lv));
      else if (lv < 0.045) out.copy(C.sand);
      else {
        const n = fbm(c.x * 4.2 + 3, c.y * 4.2, c.z * 4.2 - 8, 3);
        out.copy(C.g2).lerp(C.g1, sstep(-0.25, 0.05, n)).lerp(C.g3, sstep(0.05, 0.3, n));
        const m = fbm(c.x * 2.3 - 5, c.y * 2.3 + 9, c.z * 2.3, 2);
        out.lerp(C.meadow, sstep(0.18, 0.4, m) * 0.8);
        out.lerp(C.sand, sstep(0.09, 0.045, lv) * 0.6);
      }
      const j = 0.95 + rand() * 0.1;
      for (let k = 0; k < 3; k++) {
        col[(i + k) * 3] = out.r * j;
        col[(i + k) * 3 + 1] = out.g * j;
        col[(i + k) * 3 + 2] = out.b * j;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.deleteAttribute('uv');
    const mesh = new THREE.Mesh(geo, flat);
    mesh.receiveShadow = true;
    planet.add(mesh);
  }

  // ----- 海面 -----
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#3fb8cc', roughness: 0.16, metalness: 0.05, transparent: true, opacity: 0.8,
  });
  const water = new THREE.Mesh(new THREE.IcosahedronGeometry(R - 0.16, 28), waterMat);
  water.receiveShadow = true;
  planet.add(water);

  // ----- 环路路面 -----
  {
    const N = 900, hw = 1.25, rr = R + 0.035;
    const pos = new Float32Array((N + 1) * 6), nor = new Float32Array((N + 1) * 6);
    const idx = [];
    const c = new V3(), t = new V3(), s = new V3();
    for (let i = 0; i <= N; i++) {
      const lon = (i / N) * Math.PI * 2;
      roadCenter(lon, c);
      roadTangent(lon, t);
      s.crossVectors(c, t).normalize();
      for (let k = 0; k < 2; k++) {
        const p = _b.copy(c).addScaledVector(s, (k ? -hw : hw) / R).normalize();
        pos.set([p.x * rr, p.y * rr, p.z * rr], (i * 2 + k) * 3);
        nor.set([p.x, p.y, p.z], (i * 2 + k) * 3);
      }
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: HEX.road, roughness: 1, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    m.receiveShadow = true;
    planet.add(m);
  }

  const inst = (geo, mat, list, shadow = true) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.frustumCulled = false;
    im.castShadow = shadow;
    planet.add(im);
    return im;
  };

  // ----- 村舍 -----
  const winMat = new THREE.MeshStandardMaterial({ color: '#5a6b86', emissive: '#ffc766', emissiveIntensity: 0, roughness: 0.4 });
  {
    const roofs = ['#e8604c', '#4f8fd6', '#f0a13c', '#7d6bd8', '#3aa58c'];
    for (let i = 0; i < 12; i++) {
      const lon = 0.75 + i * (Math.PI * 2 / 12) + (rand() - 0.5) * 0.2;
      const side = i % 2 ? 1 : -1;
      const dir = roadDir(lon, side * (5 + rand() * 1.2));
      if (landVal(dir) < 0.07) continue;
      const g = mergeGeos([
        part(new THREE.BoxGeometry(1.8, 1.2, 1.5), '#fff3dc', [0, 0.6, 0]),
        part(new THREE.ConeGeometry(1.55, 0.95, 4), roofs[i % roofs.length], [0, 1.66, 0], [0, Math.PI / 4, 0], [1, 1, 0.86]),
        part(new THREE.BoxGeometry(0.38, 0.62, 0.06), '#8a5a3a', [0, 0.31, 0.76]),
        part(new THREE.BoxGeometry(0.24, 0.55, 0.24), '#d6c6b4', [0.52, 1.7, -0.2]),
        part(new THREE.BoxGeometry(2.1, 0.08, 1.8), '#cdbb9a', [0, 0.02, 0]),
      ]);
      const w = mergeGeos([
        part(new THREE.BoxGeometry(0.34, 0.34, 0.06), '#ffffff', [-0.55, 0.72, 0.76]),
        part(new THREE.BoxGeometry(0.34, 0.34, 0.06), '#ffffff', [0.55, 0.72, 0.76]),
        part(new THREE.BoxGeometry(0.06, 0.34, 0.34), '#ffffff', [0.91, 0.72, 0]),
        part(new THREE.BoxGeometry(0.06, 0.34, 0.34), '#ffffff', [-0.91, 0.72, 0]),
      ]);
      const mtx = surfaceMatrix(dir, -0.02, spinToward(dir, roadDir(lon)), 1.3);
      const house = new THREE.Mesh(g, flat);
      house.applyMatrix4(mtx);
      house.castShadow = true;
      const win = new THREE.Mesh(w, winMat);
      win.applyMatrix4(mtx);
      planet.add(house, win);
      block(dir, 1.75, 3);
    }
  }

  // ----- 风车 -----
  let blades = null;
  {
    let dir = null;
    for (const off of [-8, 8, -6.5, 6.5]) {
      const d = roadDir(2.35, off);
      if (landVal(d) > 0.1 && free(d, 2)) { dir = d; break; }
    }
    if (dir) {
      const g = mergeGeos([
        part(new THREE.CylinderGeometry(0.46, 0.8, 3, 8), '#fff0d8', [0, 1.5, 0]),
        part(new THREE.ConeGeometry(0.6, 0.6, 8), '#e8604c', [0, 3.3, 0]),
        part(new THREE.BoxGeometry(0.34, 0.6, 0.08), '#8a5a3a', [0, 0.3, 0.76]),
        part(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), '#6b4630', [0, 2.75, 0.6], [Math.PI / 2, 0, 0]),
      ]);
      const mill = new THREE.Group();
      const body = new THREE.Mesh(g, flat);
      body.castShadow = true;
      mill.add(body);
      const bg = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const b1 = part(new THREE.BoxGeometry(0.07, 1.7, 0.05), '#6b4630', [0, 0.95, 0]);
        const b2 = part(new THREE.BoxGeometry(0.42, 1.25, 0.03), '#fffaf0', [0.22, 1.15, 0]);
        for (const b of [b1, b2]) b.applyMatrix4(new THREE.Matrix4().makeRotationZ(a));
        bg.push(b1, b2);
      }
      blades = new THREE.Mesh(mergeGeos(bg), flat);
      blades.position.set(0, 2.75, 0.86);
      blades.castShadow = true;
      mill.add(blades);
      mill.applyMatrix4(surfaceMatrix(dir, -0.02, spinToward(dir, roadDir(2.35)), 1.25));
      planet.add(mill);
      block(dir, 1.3, 5);
    }
  }

  // ----- 路灯 -----
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#8d94a3' });
  const glowMat = new THREE.MeshBasicMaterial({
    color: '#ffb648', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  {
    const poleGeo = mergeGeos([
      tube(new V3(0, 0, 0), new V3(0, 2, 0), 0.05, '#3c4a5c', 6, 0.035),
      tube(new V3(0, 2, 0), new V3(0, 2.12, 0.42), 0.03, '#3c4a5c', 5),
      part(new THREE.ConeGeometry(0.17, 0.14, 8), '#3c4a5c', [0, 2.16, 0.45]),
      part(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 6), '#2f3a49', [0, 0.06, 0]),
    ]);
    const bulbGeo = new THREE.SphereGeometry(0.1, 10, 8);
    const glowGeo = new THREE.SphereGeometry(0.27, 12, 8);
    const poolGeo = new THREE.CircleGeometry(3, 22).toNonIndexed();
    {
      const p = poolGeo.attributes.position, c = new Float32Array(p.count * 3);
      const base = new THREE.Color('#ffc66b');
      for (let i = 0; i < p.count; i++) {
        const d = Math.hypot(p.getX(i), p.getY(i)) / 3;
        const k = Math.pow(1 - d, 1.6);
        c.set([base.r * k, base.g * k, base.b * k], i * 3);
      }
      poolGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      poolGeo.rotateX(-Math.PI / 2);
    }
    const poles = [], bulbs = [], glows = [], pools = [];
    const NL = 26, tmp = new V3();
    for (let i = 0; i < NL; i++) {
      const lon = 0.2 + (i / NL) * Math.PI * 2;
      const side = i % 2 ? 1 : -1;
      const dir = roadDir(lon, side * 1.85);
      const m = surfaceMatrix(dir, 0, spinToward(dir, roadDir(lon)));
      poles.push(m);
      tmp.set(0, 2.08, 0.45).applyMatrix4(m);
      bulbs.push(new THREE.Matrix4().makeTranslation(tmp.x, tmp.y, tmp.z));
      glows.push(new THREE.Matrix4().makeTranslation(tmp.x, tmp.y, tmp.z));
      pools.push(surfaceMatrix(tmp.clone().normalize(), 0.06));
      block(dir, 0.22, 2.4);
    }
    inst(poleGeo, flat, poles);
    inst(bulbGeo, bulbMat, bulbs, false);
    inst(glowGeo, glowMat, glows, false);
    inst(poolGeo, poolMat, pools, false).renderOrder = 2;
  }

  // ----- 岩石 -----
  {
    const g = part(new THREE.IcosahedronGeometry(0.5, 0), HEX.rock, [0, 0.22, 0], [0.3, 0.2, 0.1], [1.2, 0.8, 1]);
    const list = [], d = new V3();
    for (let n = 0, tries = 0; n < 120 && tries < 9000; tries++) {
      randDir(rand, d);
      if (landVal(d) < -0.03 || roadDist(d) * R < 2.2) continue;
      const s = 0.7 + rand() * 1.1;
      if (!free(d, 0.5 * s + 0.2)) continue;
      list.push(surfaceMatrix(d, -0.03, rand() * 6.28, new V3(s, s * (0.7 + rand() * 0.6), s)));
      block(d, 0.5 * s, 0.6 * s);
      n++;
    }
    inst(g, flat, list);
  }

  // ----- 树 -----
  {
    const pine = mergeGeos([
      tube(new V3(0, 0, 0), new V3(0, 0.6, 0), 0.1, HEX.trunk, 6, 0.08),
      part(new THREE.ConeGeometry(0.62, 0.9, 7), '#2f8f5a', [0, 0.9, 0]),
      part(new THREE.ConeGeometry(0.48, 0.78, 7), '#3aa066', [0, 1.4, 0]),
      part(new THREE.ConeGeometry(0.33, 0.66, 7), '#4db478', [0, 1.86, 0]),
    ]);
    const round = mergeGeos([
      tube(new V3(0, 0, 0), new V3(0, 0.85, 0), 0.11, HEX.trunk, 6, 0.08),
      part(new THREE.IcosahedronGeometry(0.62, 1), '#5fb85a', [0, 1.25, 0]),
      part(new THREE.IcosahedronGeometry(0.44, 1), '#78ca66', [0.34, 1.62, 0.1]),
      part(new THREE.IcosahedronGeometry(0.38, 1), '#92d674', [-0.3, 1.56, -0.14]),
    ]);
    const blossom = mergeGeos([
      tube(new V3(0, 0, 0), new V3(0, 0.8, 0), 0.1, '#7a4a3a', 6, 0.07),
      part(new THREE.IcosahedronGeometry(0.58, 1), '#ffb3cf', [0, 1.2, 0]),
      part(new THREE.IcosahedronGeometry(0.42, 1), '#ffc9dc', [0.3, 1.5, 0.12]),
      part(new THREE.IcosahedronGeometry(0.36, 1), '#ff9dc0', [-0.28, 1.46, -0.1]),
    ]);
    const lists = [[], [], []], d = new V3();
    for (let n = 0, tries = 0; n < 680 && tries < 50000; tries++) {
      randDir(rand, d);
      if (landVal(d) < 0.08 || roadDist(d) * R < 2.7) continue;
      const forest = fbm(d.x * 3.1 + 1, d.y * 3.1 - 4, d.z * 3.1 + 2, 2);
      if (forest < -0.12 && rand() > 0.25) continue;
      const s = 0.8 + rand() * 0.75;
      if (!free(d, 0.4 * s + 0.25)) continue;
      const kind = forest > 0.12 ? (rand() < 0.75 ? 0 : 1) : rand() < 0.12 ? 2 : rand() < 0.55 ? 1 : 0;
      lists[kind].push(surfaceMatrix(d, -0.03, rand() * 6.28, new V3(s, s * (0.9 + rand() * 0.3), s)));
      block(d, 0.3 * s, 2.2 * s);
      n++;
    }
    inst(pine, flat, lists[0]);
    inst(round, flat, lists[1]);
    inst(blossom, flat, lists[2]);
  }

  // ----- 花与草 -----
  {
    const flower = mergeGeos([
      tube(new V3(0, 0, 0), new V3(0, 0.2, 0), 0.012, '#4f9a48', 4),
      part(new THREE.IcosahedronGeometry(0.07, 0), '#ffffff', [0, 0.23, 0], [0, 0, 0], [1, 0.7, 1]),
    ]);
    const tuft = mergeGeos([
      part(new THREE.ConeGeometry(0.045, 0.32, 4), '#4fa24c', [0, 0.16, 0]),
      part(new THREE.ConeGeometry(0.04, 0.26, 4), '#5cb054', [0.07, 0.12, 0.02], [0, 0, -0.35]),
      part(new THREE.ConeGeometry(0.04, 0.24, 4), '#47983f', [-0.06, 0.11, -0.03], [0.2, 0, 0.4]),
    ]);
    const tints = ['#ffffff', '#ffd84a', '#ff9ac2', '#b79bff', '#ff7a66', '#8fd6ff'].map((h) => new THREE.Color(h));
    const fl = [], tf = [], fc = [], d = new V3(), d2 = new V3();
    for (let n = 0, tries = 0; n < 300 && tries < 14000; tries++) {
      randDir(rand, d);
      if (landVal(d) < 0.07 || roadDist(d) * R < 1.6) continue;
      const tint = tints[(rand() * tints.length) | 0];
      const k = 3 + ((rand() * 4) | 0);
      for (let j = 0; j < k; j++) {
        d2.set(d.x + (rand() - 0.5) * 0.035, d.y + (rand() - 0.5) * 0.035, d.z + (rand() - 0.5) * 0.035).normalize();
        fl.push(surfaceMatrix(d2, 0, rand() * 6.28, 0.8 + rand() * 0.9));
        fc.push(tint);
      }
      n++;
    }
    for (let n = 0, tries = 0; n < 1400 && tries < 30000; tries++) {
      randDir(rand, d);
      if (landVal(d) < 0.06 || roadDist(d) * R < 1.45) continue;
      tf.push(surfaceMatrix(d, 0, rand() * 6.28, 0.7 + rand() * 1));
      n++;
    }
    const fm = inst(flower, flat, fl, false);
    fc.forEach((c, i) => fm.setColorAt(i, c));
    inst(tuft, flat, tf, false);
  }

  // ----- 小帆船 -----
  const boats = [];
  {
    const g = mergeGeos([
      part(new THREE.CylinderGeometry(0.34, 0.2, 0.3, 6), '#e8604c', [0, 0.1, 0], [0, 0, 0], [1, 1, 2.2]),
      part(new THREE.BoxGeometry(0.5, 0.04, 1.1), '#f6e3bd', [0, 0.26, 0]),
      tube(new V3(0, 0.25, 0.1), new V3(0, 1.7, 0.1), 0.03, '#6b4630', 5),
      part(new THREE.ConeGeometry(0.62, 1.25, 3), '#fffaf0', [0, 1.02, -0.2], [0, Math.PI / 6, 0], [0.08, 1, 1]),
    ]);
    const d = new V3();
    for (let n = 0, tries = 0; n < 8 && tries < 6000; tries++) {
      randDir(rand, d);
      if (landVal(d) > -0.26 || !free(d, 4)) continue;
      const m = new THREE.Mesh(g, flat);
      m.castShadow = true;
      m.userData = { dir: d.clone(), spin: rand() * 6.28, ph: rand() * 6 };
      planet.add(m);
      boats.push(m);
      block(d, 1, 2);
      n++;
    }
  }

  // ----- 云层与热气球 -----
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', flatShading: true, roughness: 1, emissive: '#dfe8ff', emissiveIntensity: 0.3,
  });
  const cloudLayer = new THREE.Group();
  planet.add(cloudLayer);
  {
    const g = mergeGeos([
      part(new THREE.IcosahedronGeometry(1, 1), '#fff', [0, 0, 0], [0, 0, 0], [1.5, 0.75, 1.1]),
      part(new THREE.IcosahedronGeometry(0.8, 1), '#fff', [1.2, -0.1, 0.2], [0, 0, 0], [1.2, 0.7, 1]),
      part(new THREE.IcosahedronGeometry(0.7, 1), '#fff', [-1.2, -0.15, -0.1], [0, 0, 0], [1.2, 0.7, 1]),
      part(new THREE.IcosahedronGeometry(0.6, 1), '#fff', [0.3, 0.45, -0.2]),
    ]);
    const list = [], d = new V3();
    for (let i = 0; i < 42; i++) {
      randDir(rand, d);
      list.push(surfaceMatrix(d, 12 + rand() * 8, rand() * 6.28, 0.9 + rand() * 1.3));
    }
    const im = new THREE.InstancedMesh(g, cloudMat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.frustumCulled = false;
    cloudLayer.add(im);
  }
  const balloonOrbit = new THREE.Group();
  planet.add(balloonOrbit);
  {
    let env = new THREE.SphereGeometry(1.7, 14, 10).toNonIndexed();
    const p = env.attributes.position, col = new Float32Array(p.count * 3);
    const ca = new THREE.Color('#ff6f59'), cb = new THREE.Color('#fff3d6'), cc = new THREE.Color('#ffc247');
    for (let i = 0; i < p.count; i += 3) {
      const cx = p.getX(i) + p.getX(i + 1) + p.getX(i + 2), cz = p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2);
      const k = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 14) % 3;
      const c = k === 0 ? ca : k === 1 ? cb : cc;
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
    }
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < 0) {
        const f = 1 + (y / 1.7) * 0.6;
        p.setXYZ(i, p.getX(i) * f, y * 1.25, p.getZ(i) * f);
      }
    }
    env.setAttribute('color', new THREE.BufferAttribute(col, 3));
    env.computeVertexNormals();
    const g = mergeGeos([
      env,
      part(new THREE.BoxGeometry(0.6, 0.45, 0.6), '#b98548', [0, -3.1, 0]),
      tube(new V3(0.28, -2.9, 0.28), new V3(0.5, -1.8, 0.5), 0.015, '#6b4630', 4),
      tube(new V3(-0.28, -2.9, 0.28), new V3(-0.5, -1.8, 0.5), 0.015, '#6b4630', 4),
      tube(new V3(0.28, -2.9, -0.28), new V3(0.5, -1.8, -0.5), 0.015, '#6b4630', 4),
      tube(new V3(-0.28, -2.9, -0.28), new V3(-0.5, -1.8, -0.5), 0.015, '#6b4630', 4),
    ]);
    const b = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, emissive: '#ffb070', emissiveIntensity: 0.1 }));
    b.applyMatrix4(surfaceMatrix(roadDir(1.2, 7), 13, 0, 1.2));
    balloonOrbit.add(b);
  }

  const fishes = new Fishes(planet, free);
  const particles = new Particles(planet);
  const _bq = new THREE.Matrix4();

  return {
    planet, obstacles, fishes, particles,
    update(dt, t) {
      if (blades) blades.rotation.z -= dt * 0.9;
      cloudLayer.rotateOnAxis(A, dt * 0.012);
      balloonOrbit.rotateOnAxis(E2, dt * 0.03);
      const tide = 1 + Math.sin(t * 0.5) * 0.0012;
      water.scale.setScalar(tide);
      for (const b of boats) {
        const u = b.userData;
        surfaceMatrix(u.dir, -0.2 + Math.sin(t * 1.3 + u.ph) * 0.05, u.spin + Math.sin(t * 0.4 + u.ph) * 0.2, 1, _bq);
        b.matrix.copy(_bq);
        b.matrixAutoUpdate = false;
      }
      particles.update(dt);
    },
    setLight(night, day) {
      winMat.emissiveIntensity = night * 2.4;
      bulbMat.color.set('#8d94a3').lerp(_warm, night);
      glowMat.opacity = night * 0.4;
      poolMat.opacity = night * 0.55;
      waterMat.color.set('#173a66').lerp(_sea, day);
      cloudMat.emissiveIntensity = lerp(0.1, 0.34, day);
    },
  };
}
const _warm = new THREE.Color('#ffe2a0');
const _sea = new THREE.Color('#3fb8cc');

// ---------- 鱼群 ----------
const ROUND_SIZE = 36;
class Fishes {
  constructor(planet, free) {
    this.free = free;
    const geo = mergeGeos([
      part(new THREE.SphereGeometry(1, 12, 8), '#ffd23f', [0, 0, 0], [0, 0, 0], [0.13, 0.2, 0.38]),
      part(new THREE.ConeGeometry(0.2, 0.28, 4), '#ff9a2e', [0, 0, -0.46], [Math.PI / 2, 0, 0], [0.22, 1, 1]),
      part(new THREE.ConeGeometry(0.09, 0.17, 4), '#ff9a2e', [0, 0.2, -0.02], [-0.5, 0, 0], [0.25, 1, 1]),
      part(new THREE.SphereGeometry(0.032, 6, 5), '#1a1a22', [0.095, 0.05, 0.22]),
      part(new THREE.SphereGeometry(0.032, 6, 5), '#1a1a22', [-0.095, 0.05, 0.22]),
    ]);
    this.geo = geo;
    this.mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.35, metalness: 0.25, emissive: '#ff9a1f', emissiveIntensity: 0.45,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, ROUND_SIZE);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    planet.add(this.mesh);
    this.items = [];
    this.total = ROUND_SIZE;
    this.left = 0;
    this.nearest = new V3();
    this.hasNearest = false;
    this.airNear = false;
    this.onCatch = null;
    this._w = new V3();
    this._m = new THREE.Matrix4();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._gold = new THREE.Color('#ffffff');
    this._air = new THREE.Color('#ff9fd0');
  }

  spawn(round) {
    const rand = rng(977 + round * 131);
    const items = [];
    const base = rand() * 6.28;
    for (let g = 0; g < 7; g++) {
      const lon = base + g * (Math.PI * 2 / 7) + (rand() - 0.5) * 0.35;
      for (let j = 0; j < 3; j++) {
        items.push({ dir: roadDir(lon + j * 0.075, Math.sin(j * 1.4 + g) * 0.75), h: 1.15, kind: 0 });
      }
    }
    for (let n = 0, tries = 0; n < 9 && tries < 3000; tries++) {
      const lon = rand() * 6.28;
      const off = (3 + rand() * 7) * (rand() < 0.5 ? -1 : 1);
      const d = roadDir(lon, off);
      if (!this.free(d, 1.2)) continue;
      items.push({ dir: d, h: 1.15, kind: 0 });
      n++;
    }
    for (let n = 0; n < 6; n++) {
      const lon = base + 0.45 + n * (Math.PI * 2 / 6) + (rand() - 0.5) * 0.3;
      items.push({ dir: roadDir(lon, (rand() - 0.5) * 1.2), h: 3.3 + rand() * 0.9, kind: 1 });
    }
    items.forEach((it, i) => {
      it.active = true;
      it.s = 0;
      it.ph = rand() * 6.28;
      this.mesh.setColorAt(i, it.kind ? this._air : this._gold);
    });
    this.mesh.instanceColor.needsUpdate = true;
    this.items = items;
    this.total = items.length;
    this.left = items.length;
  }

  // q：星球姿态；pLocal：鹈鹕在星球本地的方向；riderY：离地高度；magnet：是否在吸鱼
  update(dt, t, q, pLocal, riderY, magnet) {
    const w = this._w, m = this._m;
    let best = 144;
    this.hasNearest = false;
    this.airNear = false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      if (it.s < 1) it.s = Math.min(1, it.s + dt * 1.8);
      const hh = it.h + Math.sin(t * 2.3 + it.ph) * 0.13;
      w.copy(it.dir).applyQuaternion(q);
      if (w.y > 0.86) {
        const rr = R + hh;
        const dx = w.x * rr, dz = w.z * rr, wy = w.y * rr - R;
        const dy = wy - (riderY + 1.15);
        const d2 = dx * dx + dz * dz;
        if (magnet && d2 < 110) {
          it.dir.lerp(pLocal, 1 - Math.exp(-3.4 * dt)).normalize();
          it.h = damp(it.h, riderY + 1.2, 4, dt);
        }
        if (d2 < 1.6 && Math.abs(dy) < 1.35) {
          it.active = false;
          this.left--;
          this.mesh.setMatrixAt(i, this._zero);
          if (this.onCatch) this.onCatch(w.set(dx, wy, dz), it.kind);
          continue;
        }
        if (d2 < best) {
          best = d2;
          this.nearest.set(dx, wy, dz);
          this.hasNearest = true;
        }
        if (it.kind === 1 && d2 < 90) this.airNear = true;
      }
      const s = (it.s < 1 ? 1 - Math.pow(1 - it.s, 3) : 1);
      this.mesh.setMatrixAt(i, surfaceMatrix(it.dir, hh, t * 1.5 + it.ph, s, m));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- 粒子（星球本地坐标，重力指向球心）----------
const PMAX = 260;
class Particles {
  constructor(planet) {
    this.planet = planet;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      PMAX,
    );
    this.mesh.frustumCulled = false;
    this.p = [];
    for (let i = 0; i < PMAX; i++) {
      this.p.push({ life: 0, max: 1, size: 0.1, grav: 0, pos: new V3(), vel: new V3() });
      this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      this.mesh.setColorAt(i, new THREE.Color('#fff'));
    }
    planet.add(this.mesh);
    this.cursor = 0;
    this.qInv = new THREE.Quaternion();
    this._c = new THREE.Color();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new V3();
    this._g = new V3();
  }

  // 传入世界坐标与世界速度
  emit(pos, vel, life, size, hex, grav = 9, dim = 1) {
    const i = this.cursor;
    this.cursor = (i + 1) % PMAX;
    const p = this.p[i];
    p.pos.copy(pos).sub(this.planet.position).applyQuaternion(this.qInv);
    p.vel.copy(vel).applyQuaternion(this.qInv);
    p.life = p.max = life;
    p.size = size;
    p.grav = grav;
    this._c.set(hex).multiplyScalar(dim);
    this.mesh.setColorAt(i, this._c);
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < PMAX; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) {
        this.mesh.setMatrixAt(i, this._m.makeScale(0, 0, 0));
        continue;
      }
      this._g.copy(p.pos).normalize();
      p.vel.addScaledVector(this._g, -p.grav * dt);
      p.pos.addScaledVector(p.vel, dt);
      const k = p.life / p.max;
      const s = p.size * Math.min(1, k * 2.2) * (0.5 + 0.5 * Math.min(1, (1 - k) * 8));
      this.mesh.setMatrixAt(i, this._m.compose(p.pos, this._q, this._s.set(s, s, s)));
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
