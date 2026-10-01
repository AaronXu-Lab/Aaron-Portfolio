// 鹈鹕 + 自行车：全部由程序化几何体搭建，腿和翅膀用两段式 IK 驱动。
import * as THREE from './vendor/three.module.min.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _d = V(0, 0, 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.78, metalness: 0, ...o });
const smooth = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });

const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const ballGeo = new THREE.SphereGeometry(1, 16, 12);
const ballLo = new THREE.SphereGeometry(1, 10, 8);

// 把单位圆柱摆成 a→b 的一段，可单独指定截面缩放
function seg(m, a, b, sx, sz) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-4;
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
  m.scale.set(sx ?? m.scale.x, len, sz ?? m.scale.z);
  return len;
}

// 两段式 IK：返回关节点（pole 为关节弯曲方向提示）
const _dir = V(0, 0, 0), _p = V(0, 0, 0);
function ik(out, root, target, a, b, pole) {
  _dir.subVectors(target, root);
  let d = _dir.length();
  const dc = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.005);
  _dir.multiplyScalar(1 / (d || 1e-4));
  _p.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_p.lengthSq() < 1e-6) _p.set(0, 0, -1);
  _p.normalize();
  const cosA = (a * a + dc * dc - b * b) / (2 * a * dc);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  out.copy(root).addScaledVector(_dir, a * cosA).addScaledVector(_p, a * sinA);
  return out;
}

export function buildPelican() {
  const root = new THREE.Group();
  const lean = new THREE.Group();
  const pivot = new THREE.Group();
  const bike = new THREE.Group();
  pivot.position.y = 1;
  bike.position.y = -1;
  root.add(lean); lean.add(pivot); pivot.add(bike);

  const mWhite = std(0xfaf5ea, { emissive: 0x4a443a }), mCream = std(0xeadfc8, { emissive: 0x3a352c }), mDark = std(0x5a534d), mOrange = std(0xffb23a, { emissive: 0x5a3000 }),
    mNeck = smooth(0xfaf5ea, { emissive: 0x4a443a }), mPouch = std(0xff9a78, { emissive: 0x4a1c0e }), mLeg = std(0xf0a35e), mFrame = std(0x14b8a6, { roughness: 0.4, metalness: 0.2 }),
    mFrame2 = std(0xff7a59, { roughness: 0.5 }), mTire = std(0x23252b, { roughness: 0.9 }),
    mRim = std(0xe9e2d0, { metalness: 0.5, roughness: 0.35 }), mHelm = std(0xe8483b, { roughness: 0.4 }),
    mScarf = std(0xffd23f, { side: THREE.DoubleSide }), mEye = std(0xffffff), mBlack = std(0x15141a),
    mBasket = std(0xb77a45), mSeat = std(0x3a2a24), mFish = std(0xaed9f2, { metalness: 0.4, roughness: 0.35 });

  const add = (parent, geo, mat, pos, scl, rot) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    if (scl) m.scale.set(...scl);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const tube = (parent, mat, r, a, b) => {
    const m = add(parent, tubeGeo, mat, null, [r, 1, r]);
    if (a) seg(m, a, b);
    return m;
  };

  // ---------- 自行车 ----------
  const BB = V(0, 0.5, 0.1), SEAT = V(0, 1.08, 0.42), RH = V(0, 0.42, 0.78), HT = V(0, 1.02, -0.6), HB = V(0, 0.82, -0.64), FH = V(0, 0.42, -0.75);
  tube(bike, mFrame, 0.04, BB, SEAT);
  tube(bike, mFrame, 0.04, BB, HB);
  tube(bike, mFrame, 0.04, SEAT, HT);
  tube(bike, mFrame, 0.04, HT, HB);
  tube(bike, mFrame2, 0.03, BB, RH);
  tube(bike, mFrame2, 0.03, SEAT, RH);
  add(bike, ballGeo, mSeat, V(0, 1.12, 0.45), [0.13, 0.05, 0.24]);

  function makeWheel() {
    const g = new THREE.Group();
    add(g, new THREE.TorusGeometry(0.42, 0.06, 8, 24), mTire, null, null, [0, Math.PI / 2, 0]);
    add(g, new THREE.TorusGeometry(0.37, 0.012, 6, 24), mRim, null, null, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 5; i++) {
      const s = add(g, new THREE.BoxGeometry(0.018, 0.74, 0.018), mRim);
      s.rotation.x = (i / 5) * Math.PI;
    }
    add(g, ballLo, mFrame, null, [0.05, 0.05, 0.05]);
    return g;
  }
  const rearWheel = makeWheel(); rearWheel.position.copy(RH); bike.add(rearWheel);

  // 前叉组（随转向旋转）
  const front = new THREE.Group(); front.position.copy(HB); bike.add(front);
  const frontWheel = makeWheel(); frontWheel.position.subVectors(FH, HB); front.add(frontWheel);
  tube(front, mFrame, 0.03, V(0, 0, 0), frontWheel.position);
  tube(front, mFrame, 0.03, V(0, 0, 0), V(0, 0.22, 0.05));
  const barY = 0.3, barZ = 0.06;
  add(front, tubeGeo, mFrame, V(0, barY, barZ), [0.025, 0.8, 0.025], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) add(front, tubeGeo, mBlack, V(s * 0.38, barY, barZ), [0.035, 0.12, 0.035], [0, 0, Math.PI / 2]);
  // 车铃
  const bell = add(front, ballLo, mRim, V(0.12, barY + 0.06, barZ - 0.01), [0.055, 0.045, 0.055]);
  // 车篮
  const basket = new THREE.Group(); basket.position.set(0, 0.24, -0.4); front.add(basket);
  add(basket, new THREE.BoxGeometry(0.5, 0.03, 0.36), mBasket, V(0, 0, 0));
  add(basket, new THREE.BoxGeometry(0.5, 0.16, 0.03), mBasket, V(0, 0.08, -0.18));
  add(basket, new THREE.BoxGeometry(0.5, 0.16, 0.03), mBasket, V(0, 0.08, 0.18));
  for (const s of [-1, 1]) add(basket, new THREE.BoxGeometry(0.03, 0.16, 0.36), mBasket, V(s * 0.25, 0.08, 0));
  const fishGeo = new THREE.SphereGeometry(1, 10, 8);
  const basketFish = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Group();
    add(f, fishGeo, mFish, null, [0.05, 0.16, 0.05]);
    add(f, new THREE.ConeGeometry(0.06, 0.12, 4), mFish, V(0, 0.2, 0), null, [Math.PI, 0, 0]);
    f.position.set(-0.17 + i * 0.085, 0.16, ((i % 2) - 0.5) * 0.12);
    f.rotation.set(((i % 2) - 0.5) * 0.3, 0, (i - 2) * 0.18);
    f.visible = false;
    basket.add(f);
    basketFish.push(f);
  }

  // 曲柄、链轮、脚踏
  const crank = new THREE.Group(); crank.position.copy(BB); bike.add(crank);
  add(crank, new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14), mRim, V(0.1, 0, 0), null, [0, 0, Math.PI / 2]);
  const crankArm = [tube(bike, mRim, 0.025), tube(bike, mRim, 0.025)];
  const pedal = [add(bike, new THREE.BoxGeometry(0.1, 0.03, 0.17), mBlack), add(bike, new THREE.BoxGeometry(0.1, 0.03, 0.17), mBlack)];

  // ---------- 鹈鹕 ----------
  const body = add(bike, ballGeo, mWhite, V(0, 1.5, 0.4), [0.45, 0.42, 0.68], [-0.28, 0, 0]);
  const chest = add(bike, ballGeo, mWhite, V(0, 1.45, 0.0), [0.34, 0.34, 0.34]);
  const tail = add(bike, new THREE.ConeGeometry(0.2, 0.55, 4), mCream, V(0, 1.38, 1.0), [1, 1, 0.35], [Math.PI / 2 + 0.15, 0, 0]);

  // 腿
  const HIP = [V(-0.15, 1.2, 0.44), V(0.15, 1.2, 0.44)];
  const thigh = [tube(bike, mWhite, 0.085), tube(bike, mWhite, 0.085)];
  const shin = [tube(bike, mLeg, 0.05), tube(bike, mLeg, 0.05)];
  const foot = [0, 1].map(() => {
    const f = add(bike, new THREE.ConeGeometry(0.13, 0.34, 3), mOrange, null, [1, 1, 0.3], [-Math.PI / 2, 0, 0]);
    return f;
  });

  // 脖子：贝塞尔曲线上的小球链
  const neck = [];
  for (let i = 0; i < 10; i++) neck.push(add(bike, ballGeo, mNeck, null, [0.12, 0.12, 0.12]));

  // 头
  const head = new THREE.Group(); bike.add(head);
  add(head, ballGeo, mNeck, null, [0.2, 0.19, 0.21]);
  const helmet = add(head, new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mHelm, V(0, 0.04, 0.02), [0.235, 0.2, 0.25]);
  add(head, ballLo, mHelm, V(0, 0.07, -0.2), [0.1, 0.025, 0.1]); // 帽檐
  // 上喙：渐细的长条，尖端有钩
  const bg = new THREE.BoxGeometry(1, 1, 1, 1, 1, 4);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const z = bp.getZ(i); // -0.5..0.5
    const k = 1 - (0.5 - z) * 0.75; // 前端变窄
    bp.setX(i, bp.getX(i) * (k < 0.25 ? 0.25 : k));
    bp.setY(i, bp.getY(i) * (0.55 + 0.45 * k));
  }
  bg.computeVertexNormals();
  add(head, bg, mOrange, V(0, -0.02, -0.64), [0.2, 0.09, 1.0]);
  add(head, ballLo, mHelm, V(0, -0.045, -1.14), [0.035, 0.04, 0.06]);
  // 喉囊（下喙）
  const pouch = add(head, ballGeo, mPouch, V(0, -0.14, -0.56), [0.17, 0.15, 0.62]);
  const eyes = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(s * 0.155, 0.04, -0.1); head.add(g);
    add(g, ballLo, mEye, null, [0.06, 0.065, 0.06]);
    add(g, ballLo, mBlack, V(s * 0.012, 0, -0.04), [0.034, 0.04, 0.03]);
    return g;
  });

  // 围巾
  const scarfSegs = [];
  for (let i = 0; i < 7; i++) {
    const m = add(bike, new THREE.BoxGeometry(0.17, 0.018, 0.17), mScarf);
    m.castShadow = false;
    scarfSegs.push(m);
  }
  const scarfKnot = add(bike, ballLo, mScarf, null, [0.13, 0.1, 0.13]);

  // 翅膀
  const wing = [-1, 1].map((s) => ({
    s,
    shoulder: V(s * 0.38, 1.62, 0.24),
    elbow: V(), hand: V(), pole: V(s, -0.5, 0.35),
    up: tube(bike, mWhite, 0.1),
    fore: tube(bike, mCream, 0.06),
    tip: tube(bike, mDark, 0.04),
    glove: add(bike, ballLo, mDark, null, [0.06, 0.06, 0.06]),
  }));

  // 姿态状态
  const st = { yaw: 0, wingPose: 0, bulge: 0, blink: 0, nextBlink: 2, head: V(0, 2.26, -0.42), headV: V(0, 0, 0) };
  const hand = V(), target = V(), foot3 = V(), knee = V(), hips = V();
  const nb = V(0, 1.68, -0.02), nc = V(), nh = V(), np = V();
  const tipEnd = V(), legPole = V(), cA = V(), cB = V();

  /**
   * 每帧驱动。S: 游戏状态（x 速度、y、vy、speed、grounded、gliding、pedal、flip 等）
   */
  function update(S, dt, t) {
    const air = !S.grounded;
    const over = S.mode === 'over';
    const steer = clamp(S.vx * 0.022, -0.4, 0.4);

    // 轮子
    const wr = (S.wheel);
    rearWheel.rotation.x = -wr;
    frontWheel.rotation.x = -wr;
    front.rotation.y = -steer * 1.5;
    lean.rotation.y = -steer * 0.5;
    lean.rotation.z = clamp(-S.vx * 0.028, -0.4, 0.4) + (S.crash > 0 ? Math.sin(t * 34) * S.crash * 0.22 : 0);
    // 俯仰 + 空翻
    pivot.rotation.x = clamp(S.vy * 0.025, -0.3, 0.3) - S.flipVis;
    const sq = S.squash;
    pivot.scale.set(1 + sq * 0.12, 1 - sq * 0.22, 1 + sq * 0.12);
    bike.visible = !(S.inv > 0 && Math.floor(t * 16) % 2 === 0);

    // 曲柄
    const th = S.pedal;
    crank.rotation.x = -th;
    const R = 0.2;
    const sway = Math.sin(th) * 0.018;
    for (let i = 0; i < 2; i++) {
      const a = th + i * Math.PI, s = i ? 1 : -1;
      const px = s * 0.19, py = BB.y + R * Math.cos(a), pz = BB.z - R * Math.sin(a);
      pedal[i].position.set(px, py, pz);
      seg(crankArm[i], cA.set(s * 0.12, BB.y, BB.z), cB.set(px, py, pz));
      foot3.set(px + s * 0.01, py + 0.045, pz - 0.1);
      foot[i].position.copy(foot3);
      foot[i].rotation.x = -Math.PI / 2 + (air ? 0.5 : 0.12 + Math.cos(a) * 0.15);
      // 腿
      hips.set(HIP[i].x + sway, HIP[i].y + Math.sin(th * 2) * 0.012, HIP[i].z);
      target.set(px, py + 0.06, pz + 0.02);
      if (over) target.set(px, 0.35 + i * 0.1, 0.1 + i * 0.1);
      ik(knee, hips, target, 0.54, 0.54, legPole.set(s * 0.12, 0, -1));
      seg(thigh[i], hips, knee);
      seg(shin[i], knee, target);
    }

    // 身体律动
    const bob = Math.sin(th * 2) * 0.015 + (over ? -0.1 : 0);
    body.position.set(sway, 1.5 + bob, 0.4);
    chest.position.set(sway, 1.45 + bob, 0.02);
    tail.position.set(sway, 1.38 + bob, 1.0);
    tail.rotation.z = Math.sin(t * 6) * 0.04 + sway * 2;

    // 翅膀：握把 ↔ 展开
    st.wingPose = lerp(st.wingPose, over ? 0.35 : air ? (S.gliding ? 1 : 0.55) : 0, 1 - Math.exp(-9 * dt));
    const w = st.wingPose;
    const flap = Math.sin(t * (S.gliding ? 5 : 13)) * (S.gliding ? 0.14 : 0.32) * w;
    const cs = Math.cos(front.rotation.y), sn = Math.sin(front.rotation.y);
    for (let i = 0; i < 2; i++) {
      const W = wing[i], s = W.s;
      const lx = s * 0.34, lz = barZ + 0.02;
      hand.set(lx * cs + lz * sn, HB.y + barY + 0.02, HB.z - lx * sn + lz * cs);
      target.set(s * 2.05, 1.78 + flap * 2.2, 0.2 + flap * 0.4);
      hand.lerp(target, w);
      const a = 0.5 * (1 + 0.7 * w), b = 0.58 * (1 + 0.7 * w);
      W.shoulder.x = s * 0.38; W.shoulder.y = 1.62 + bob;
      ik(W.elbow, W.shoulder, hand, a, b, W.pole);
      seg(W.up, W.shoulder, W.elbow, 0.1, 0.1);
      seg(W.fore, W.elbow, hand, 0.05, 0.12 + 0.34 * w);
      _d.subVectors(hand, W.elbow).normalize();
      tipEnd.copy(hand).addScaledVector(_d, 0.06 + 0.85 * w);
      seg(W.tip, hand, tipEnd, 0.035, 0.08 + 0.26 * w);
      W.glove.position.copy(hand);
      W.glove.scale.setScalar(0.07 * (1 - w) + 0.001);
    }

    // 头颈
    const hx = clamp(-S.vx * 0.006, -0.08, 0.08);
    const hy = 2.26 + Math.sin(th * 2 + 1) * 0.02 + clamp(-S.vy * 0.018, -0.14, 0.1) + (over ? -0.28 : 0);
    const hz = -0.44 + (S.boost ? -0.1 : 0) + (over ? 0.12 : 0);
    nh.set(hx, hy, hz);
    // 弹簧跟随（脖子有点软）
    st.headV.x += ((nh.x - st.head.x) * 90 - st.headV.x * 10) * dt;
    st.headV.y += ((nh.y - st.head.y) * 90 - st.headV.y * 10) * dt;
    st.headV.z += ((nh.z - st.head.z) * 90 - st.headV.z * 10) * dt;
    st.head.addScaledVector(st.headV, dt);
    nc.set(st.head.x * 0.5, 2.5, 0.14);
    for (let i = 0; i < neck.length; i++) {
      const u = i / (neck.length - 1), iu = 1 - u;
      np.set(
        iu * iu * nb.x + 2 * iu * u * nc.x + u * u * st.head.x,
        iu * iu * nb.y + 2 * iu * u * nc.y + u * u * st.head.y,
        iu * iu * nb.z + 2 * iu * u * nc.z + u * u * st.head.z
      );
      neck[i].position.copy(np);
      neck[i].scale.setScalar(0.135 - u * 0.02);
    }
    head.position.copy(st.head);
    const glance = Math.sin(t * 0.55) * Math.sin(t * 0.31 + 1) * 0.9;
    st.yaw = lerp(st.yaw, over ? 0 : -clamp(S.vx * 0.06, -0.8, 0.8) + (Math.abs(S.vx) < 1 ? glance : 0), 1 - Math.exp(-7 * dt));
    head.rotation.y = st.yaw;
    head.rotation.x = -0.24 - clamp(S.vy * 0.02, -0.2, 0.25) + (over ? 0.35 : 0) + Math.sin(th * 2) * 0.02;
    head.rotation.z = over ? Math.sin(t * 5) * 0.25 : hx * 1.5;

    // 喉囊
    st.bulge = Math.max(0, st.bulge - dt * 2.2);
    pouch.scale.set(0.17 + st.bulge * 0.05, 0.15 + st.bulge * 0.14, 0.62 + st.bulge * 0.04);
    pouch.position.y = -0.14 - st.bulge * 0.06;
    pouch.rotation.x = Math.sin(th * 2 + 0.6) * 0.03 - S.vy * 0.004;

    // 眨眼
    st.nextBlink -= dt;
    if (st.nextBlink < 0) { st.blink = 0.12; st.nextBlink = 1.5 + Math.random() * 3; }
    st.blink = Math.max(0, st.blink - dt);
    const eyeY = over ? 0.25 : st.blink > 0 ? 0.1 : 1;
    for (const e of eyes) e.scale.y = eyeY;

    // 围巾
    const flutter = 0.4 + S.speed * 0.05;
    for (let i = 0; i < scarfSegs.length; i++) {
      const u = (i + 1) / scarfSegs.length;
      scarfSegs[i].position.set(
        Math.sin(t * 9 + i * 0.9) * 0.06 * u * flutter,
        1.78 + bob + Math.sin(t * 7 + i * 0.8) * 0.05 * u * flutter - u * 0.05,
        0.04 + (i + 1) * 0.15
      );
      scarfSegs[i].rotation.set(Math.sin(t * 7 + i) * 0.25, 0, Math.sin(t * 8 + i * 0.7) * 0.3);
      scarfSegs[i].scale.x = 1 - u * 0.35;
    }
    scarfKnot.position.set(0, 1.76 + bob, 0.02);

    // 车篮里的鱼
    const n = Math.min(5, S.fishInBasket);
    for (let i = 0; i < 5; i++) basketFish[i].visible = i < n;
  }

  function bulgeNow() { st.bulge = 1; }
  function ring() { bell.scale.set(0.09, 0.075, 0.09); setTimeout(() => bell.scale.set(0.055, 0.045, 0.055), 90); }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, update, bulgeNow, ring };
}
