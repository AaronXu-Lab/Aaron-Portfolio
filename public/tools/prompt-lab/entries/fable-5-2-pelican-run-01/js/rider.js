// 鹈鹕 + 自行车：建模与程序化骑行动画
// 模型空间：+Z 为前，+Y 为上，原点在两轮触地点连线中点
import { THREE, V3, clamp, lerp, sstep, damp, part, tube, polyTube, mergeGeos } from './util.js';

const WR = 0.36;
const REAR = new V3(0, WR, -0.55), FRONT = new V3(0, WR, 0.58);
const BB = new V3(0, 0.33, -0.08), CRANK = 0.17, PEDX = 0.15;
const SEAT = new V3(0, 0.93, -0.3);
const HT_TOP = new V3(0, 0.98, 0.36), HT_BOT = new V3(0, 0.74, 0.42);
const TILT = Math.atan2(HT_BOT.z - HT_TOP.z, HT_TOP.y - HT_BOT.y);
const XA = new V3(1, 0, 0), ZA = new V3(0, 0, 1);
const HALF_PI = Math.PI / 2;

const THIGH = 0.4, SHIN = 0.46, WING1 = 0.3, WING2 = 0.34;
const HIP = [new V3(0.15, 0.1, 0.06), new V3(-0.15, 0.1, 0.06)];
const SHOULDER = [new V3(0.25, 0.42, 0.3), new V3(-0.25, 0.42, 0.3)];
const TORSO_PITCH = 0.32;

const C = {
  frame: '#f2503f', cream: '#fff1d6', tire: '#262830', steel: '#d5dbe4', dark: '#3a3f4b',
  leather: '#6b4630', wicker: '#cf9f5e', wickerDark: '#a87a42', white: '#fbfaf4', shade: '#ece7da',
  beak: '#f8b62e', beakDark: '#ee8a2a', pouch: '#ffc54d', leg: '#f48a2c', black: '#23232b',
  scarf: '#2f7bf0', eye: '#ffd640', gold: '#f1c24b', red: '#e23b3b',
};

// 车把组本地坐标 = 绕 X 旋转 TILT 后的（模型坐标 - 头管下端）
const toSteer = (x, y, z) => new V3(x, y - HT_BOT.y, z - HT_BOT.z).applyAxisAngle(XA, TILT);

// ---------- 两段骨骼 IK ----------
const _d = new V3(), _perp = new V3();
function ik2(root, target, l1, l2, pole, joint, end) {
  _d.subVectors(target, root);
  const raw = _d.length() || 1e-4;
  const dist = clamp(raw, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.004);
  _d.multiplyScalar(1 / raw);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  _perp.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, 0, 1);
  _perp.normalize();
  joint.copy(root).addScaledVector(_d, a).addScaledVector(_perp, h);
  end.copy(root).addScaledVector(_d, dist);
}

// 让骨骼的 +Y 指向 to，+Z 尽量贴近 hint
const _bx = new V3(), _by = new V3(), _bz = new V3(), _bm = new THREE.Matrix4();
function aim(obj, from, to, hint) {
  _by.subVectors(to, from);
  const len = _by.length() || 1e-4;
  _by.multiplyScalar(1 / len);
  _bx.crossVectors(_by, hint);
  if (_bx.lengthSq() < 1e-6) _bx.set(1, 0, 0);
  _bx.normalize();
  _bz.crossVectors(_bx, _by);
  obj.position.copy(from);
  obj.quaternion.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz));
  return len;
}

function wheelGeo() {
  const g = [
    part(new THREE.TorusGeometry(WR - 0.04, 0.04, 8, 28), C.tire, [0, 0, 0], [0, HALF_PI, 0]),
    part(new THREE.TorusGeometry(WR - 0.047, 0.026, 6, 28), C.cream, [0, 0, 0], [0, HALF_PI, 0], [1, 1, 1.25]),
    part(new THREE.TorusGeometry(WR - 0.085, 0.014, 6, 28), C.steel, [0, 0, 0], [0, HALF_PI, 0]),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.11, 8), C.dark, [0, 0, 0], [0, 0, HALF_PI]),
  ];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.push(tube(
      new V3(i % 2 ? 0.03 : -0.03, 0, 0),
      new V3(0, Math.cos(a) * (WR - 0.09), Math.sin(a) * (WR - 0.09)),
      0.006, C.steel, 4,
    ));
  }
  return mergeGeos(g);
}

function fishGeo() {
  return mergeGeos([
    part(new THREE.SphereGeometry(1, 10, 8), '#ffd23f', [0, 0, 0], [0, 0, 0], [0.13, 0.2, 0.38]),
    part(new THREE.ConeGeometry(0.2, 0.28, 4), '#ff9a2e', [0, 0, -0.46], [HALF_PI, 0, 0], [0.22, 1, 1]),
    part(new THREE.SphereGeometry(0.032, 6, 5), '#1a1a22', [0.095, 0.05, 0.22]),
    part(new THREE.SphereGeometry(0.032, 6, 5), '#1a1a22', [-0.095, 0.05, 0.22]),
  ]);
}

export class Rider {
  constructor() {
    const bikeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.3 });
    const birdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    const mesh = (geo, mat, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      if (parent) parent.add(m);
      return m;
    };

    this.group = new THREE.Group();
    this.pitchG = new THREE.Group();
    this.leanG = new THREE.Group();
    this.group.add(this.pitchG);
    this.pitchG.add(this.leanG);
    const L = this.leanG;

    // ===== 车架（静态合并）=====
    {
      const g = [
        tube(BB, new V3(0, 0.9, -0.285), 0.022, C.frame, 8),
        tube(new V3(0, 0.86, -0.275), new V3(0, 0.95, 0.365), 0.02, C.frame, 8),
        tube(BB, new V3(0, 0.78, 0.405), 0.025, C.frame, 8),
        tube(HT_BOT, HT_TOP, 0.032, C.frame, 8),
        tube(new V3(0, 0.9, -0.285), new V3(0, 0.945, -0.297), 0.014, C.steel, 6),
        part(new THREE.CylinderGeometry(0.036, 0.036, 0.12, 8), C.frame, [BB.x, BB.y, BB.z], [0, 0, HALF_PI]),
        part(new THREE.SphereGeometry(1, 12, 8), C.leather, [0, 0.957, -0.3], [0, 0, 0], [0.105, 0.034, 0.17]),
        part(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 10), C.steel, [-0.05, REAR.y, REAR.z], [0, 0, HALF_PI]),
        tube(new V3(-0.05, BB.y + 0.085, BB.z), new V3(-0.05, REAR.y + 0.042, REAR.z), 0.007, C.dark, 4),
        tube(new V3(-0.05, BB.y - 0.085, BB.z), new V3(-0.05, REAR.y - 0.042, REAR.z), 0.007, C.dark, 4),
      ];
      for (const sx of [0.06, -0.06]) {
        g.push(tube(new V3(sx * 0.4, BB.y, BB.z), new V3(sx, REAR.y, REAR.z), 0.013, C.frame, 6));
        g.push(tube(new V3(sx * 0.3, 0.86, -0.275), new V3(sx, REAR.y, REAR.z), 0.012, C.frame, 6));
      }
      // 后挡泥板
      const pts = [];
      for (let i = 0; i <= 9; i++) {
        const a = -0.25 + (i / 9) * 2.2, r = WR + 0.032;
        pts.push(new V3(0, REAR.y + r * Math.sin(a), REAR.z - r * Math.cos(a)));
      }
      g.push(...polyTube(pts, 0.017, C.cream, 5));
      g.push(part(new THREE.SphereGeometry(0.032, 8, 6), C.red, [pts[0].x, pts[0].y, pts[0].z - 0.01]));
      mesh(mergeGeos(g), bikeMat, L);
    }

    // ===== 车轮与曲柄 =====
    const wg = wheelGeo();
    this.rearWheel = mesh(wg, bikeMat, L);
    this.rearWheel.position.copy(REAR);

    this.crankG = new THREE.Group();
    this.crankG.position.copy(BB);
    L.add(this.crankG);
    mesh(mergeGeos([
      part(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 18), C.steel, [-0.05, 0, 0], [0, 0, HALF_PI]),
      tube(new V3(0.075, 0, 0), new V3(0.075, CRANK, 0), 0.014, C.dark, 6),
      tube(new V3(-0.075, 0, 0), new V3(-0.075, -CRANK, 0), 0.014, C.dark, 6),
      tube(new V3(-0.08, 0, 0), new V3(0.08, 0, 0), 0.016, C.dark, 6),
    ]), bikeMat, this.crankG);
    this.pedals = [0, 1].map((i) => {
      const p = mesh(part(new THREE.BoxGeometry(0.12, 0.024, 0.075), C.dark), bikeMat, this.crankG);
      p.position.set(i ? -PEDX : PEDX, i ? -CRANK : CRANK, 0);
      return p;
    });

    // ===== 转向组：前叉、车把、车篮、车灯、前轮 =====
    this.steerPivot = new THREE.Group();
    this.steerPivot.position.copy(HT_BOT);
    this.steerPivot.rotation.x = -TILT;
    L.add(this.steerPivot);
    this.steerG = new THREE.Group();
    this.steerPivot.add(this.steerG);
    const S = this.steerG;
    {
      const sp = (geo, hex, p, scl) => part(geo, hex, toSteer(p[0], p[1], p[2]).toArray(), [TILT, 0, 0], scl);
      const g = [
        tube(toSteer(0, 0.98, 0.36), toSteer(0, 1.105, 0.35), 0.016, C.steel, 6),
        tube(toSteer(-0.06, 0.72, 0.425), toSteer(0.06, 0.72, 0.425), 0.022, C.frame, 6),
      ];
      for (const sx of [0.055, -0.055]) {
        g.push(tube(toSteer(sx, 0.72, 0.425), toSteer(sx, FRONT.y, FRONT.z), 0.015, C.frame, 6));
      }
      const bar = [[-0.3, 1.135, 0.25], [-0.24, 1.125, 0.37], [0, 1.105, 0.39], [0.24, 1.125, 0.37], [0.3, 1.135, 0.25]]
        .map((p) => toSteer(p[0], p[1], p[2]));
      g.push(...polyTube(bar, 0.014, C.steel, 6));
      g.push(tube(toSteer(-0.31, 1.137, 0.23), toSteer(-0.275, 1.131, 0.3), 0.022, C.leather, 8));
      g.push(tube(toSteer(0.31, 1.137, 0.23), toSteer(0.275, 1.131, 0.3), 0.022, C.leather, 8));
      // 车篮
      const bc = [0, 0.985, 0.62];
      g.push(sp(new THREE.BoxGeometry(0.36, 0.014, 0.25), C.wickerDark, [bc[0], bc[1] - 0.1, bc[2]]));
      g.push(sp(new THREE.BoxGeometry(0.36, 0.2, 0.014), C.wicker, [bc[0], bc[1], bc[2] + 0.125]));
      g.push(sp(new THREE.BoxGeometry(0.36, 0.2, 0.014), C.wicker, [bc[0], bc[1], bc[2] - 0.125]));
      g.push(sp(new THREE.BoxGeometry(0.014, 0.2, 0.25), C.wicker, [bc[0] + 0.18, bc[1], bc[2]]));
      g.push(sp(new THREE.BoxGeometry(0.014, 0.2, 0.25), C.wicker, [bc[0] - 0.18, bc[1], bc[2]]));
      g.push(sp(new THREE.BoxGeometry(0.39, 0.022, 0.28), C.wickerDark, [bc[0], bc[1] + 0.1, bc[2]], [1, 1, 1]));
      g.push(sp(new THREE.BoxGeometry(0.33, 0.03, 0.22), '#3d2a1c', [bc[0], bc[1] + 0.085, bc[2]]));
      g.push(tube(toSteer(0, 1.105, 0.39), toSteer(0, 1.02, 0.5), 0.01, C.steel, 4));
      // 车灯外壳
      g.push(part(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 10), C.steel, toSteer(0, 0.86, 0.78).toArray(), [TILT + HALF_PI, 0, 0]));
      // 前挡泥板
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = 0.55 + (i / 8) * 2.1, r = WR + 0.032;
        pts.push(toSteer(0, FRONT.y + r * Math.sin(a), FRONT.z + r * Math.cos(a)));
      }
      g.push(...polyTube(pts, 0.017, C.cream, 5));
      mesh(mergeGeos(g), bikeMat, S);
      this.lensMat = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffe2a0', emissiveIntensity: 0.2, roughness: 0.3 });
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), this.lensMat);
      lens.position.copy(toSteer(0, 0.86, 0.815));
      S.add(lens);
      this.coneMat = new THREE.MeshBasicMaterial({
        color: '#ffe9a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const cg = new THREE.ConeGeometry(1.1, 3.6, 16, 1, true);
      cg.rotateX(-HALF_PI);
      cg.translate(0, 0, 1.8);
      const cone = new THREE.Mesh(cg, this.coneMat);
      cone.position.copy(lens.position);
      cone.rotation.x = TILT + 0.22;
      S.add(cone);
      this.spot = new THREE.SpotLight('#ffe2a0', 0, 16, 0.55, 0.7, 1.4);
      this.spot.position.copy(lens.position);
      this.spot.target.position.copy(toSteer(0, 0, 5));
      S.add(this.spot, this.spot.target);
    }
    this.frontWheel = mesh(wg, bikeMat, S);
    this.frontWheel.position.copy(toSteer(FRONT.x, FRONT.y, FRONT.z));
    // 车铃
    this.bellG = new THREE.Group();
    this.bellG.position.copy(toSteer(0.17, 1.15, 0.385));
    S.add(this.bellG);
    mesh(mergeGeos([
      part(new THREE.SphereGeometry(0.042, 12, 8, 0, Math.PI * 2, 0, HALF_PI), C.gold, [0, 0.01, 0]),
      part(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6), C.dark, [0, 0, 0]),
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.8 }), this.bellG);
    // 车篮里的鱼
    this.basketFish = [];
    const fg = fishGeo();
    const fmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2, emissive: '#ff9a1f', emissiveIntensity: 0.25 });
    for (let i = 0; i < 6; i++) {
      const f = mesh(fg, fmat, S);
      const x = (i % 3 - 1) * 0.1 + (i > 2 ? 0.04 : 0);
      f.position.copy(toSteer(x, 1.07 + (i > 2 ? 0.03 : 0), 0.6 + (i > 2 ? 0.05 : -0.04)));
      f.rotation.set(TILT - 1.2 + (i % 2) * 0.3, i * 1.1, (i - 2.5) * 0.18);
      f.scale.setScalar(0.42);
      f.visible = false;
      this.basketFish.push(f);
    }
    this.grips = [toSteer(0.292, 1.15, 0.265), toSteer(-0.292, 1.15, 0.265)];

    // ===== 鹈鹕躯干 =====
    this.torso = new THREE.Group();
    this.torso.position.copy(SEAT);
    L.add(this.torso);
    mesh(mergeGeos([
      part(new THREE.SphereGeometry(1, 22, 16), C.white, [0, 0.3, 0.1], [0, 0, 0], [0.3, 0.29, 0.44]),
      part(new THREE.SphereGeometry(1, 16, 12), C.white, [0, 0.35, 0.42], [0, 0, 0], [0.2, 0.21, 0.2]),
      part(new THREE.SphereGeometry(1, 14, 10), C.shade, [0, 0.2, -0.2], [0, 0, 0], [0.24, 0.21, 0.25]),
    ]), birdMat, this.torso);
    this.tailG = new THREE.Group();
    this.tailG.position.set(0, 0.3, -0.3);
    this.torso.add(this.tailG);
    mesh(mergeGeos([
      part(new THREE.ConeGeometry(0.17, 0.3, 8), C.white, [0, 0, -0.13], [-HALF_PI, 0, 0], [1.35, 1, 0.3]),
      part(new THREE.ConeGeometry(0.07, 0.26, 6), C.shade, [0.1, -0.012, -0.11], [-HALF_PI, 0, 0.4], [1, 1, 0.3]),
      part(new THREE.ConeGeometry(0.07, 0.26, 6), C.shade, [-0.1, -0.012, -0.11], [-HALF_PI, 0, -0.4], [1, 1, 0.3]),
    ]), birdMat, this.tailG);

    // ===== 脖子、围巾、头 =====
    this.neckG = new THREE.Group();
    this.neckG.position.set(0, 0.45, 0.47);
    this.torso.add(this.neckG);
    {
      const curve = new THREE.CatmullRomCurve3([
        new V3(0, -0.06, -0.03), new V3(0, 0.12, 0.05), new V3(0, 0.29, 0.06), new V3(0, 0.44, 0.1),
      ]);
      mesh(mergeGeos([
        part(new THREE.TubeGeometry(curve, 12, 0.08, 12), C.white),
        part(new THREE.SphereGeometry(0.12, 12, 10), C.white, [0, -0.02, 0]),
        part(new THREE.TorusGeometry(0.088, 0.04, 8, 18), C.scarf, [0, 0.15, 0.05], [HALF_PI - 0.1, 0, 0]),
        part(new THREE.SphereGeometry(0.05, 8, 6), C.scarf, [0, 0.15, -0.065]),
      ]), birdMat, this.neckG);
    }
    this.scarf = [];
    {
      let parent = this.neckG;
      for (let i = 0; i < 5; i++) {
        const seg = new THREE.Group();
        seg.position.set(0, i ? 0 : 0.15, i ? -0.17 : -0.08);
        parent.add(seg);
        mesh(part(new THREE.BoxGeometry(0.15 - i * 0.012, 0.02, 0.19), C.scarf, [0, 0, -0.085]), birdMat, seg);
        this.scarf.push(seg);
        parent = seg;
      }
    }

    this.headG = new THREE.Group();
    this.headG.position.set(0, 0.48, 0.12);
    this.headG.scale.setScalar(1.14);
    this.neckG.add(this.headG);
    mesh(mergeGeos([
      part(new THREE.SphereGeometry(0.185, 20, 14), C.white, [0, 0, 0], [0, 0, 0], [1, 0.96, 1.06]),
      // 头盔
      part(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, HALF_PI), C.frame, [0, 0.03, -0.012], [-0.16, 0, 0], [1.03, 0.95, 1.1]),
      part(new THREE.TorusGeometry(0.2, 0.02, 6, 14, Math.PI), C.cream, [0, 0.032, -0.012], [-0.16, HALF_PI, 0], [1, 0.97, 1]),
      part(new THREE.BoxGeometry(0.3, 0.02, 0.1), C.frame, [0, 0.045, 0.2], [0.25, 0, 0]),
    ]), birdMat, this.headG);
    this.eyes = [1, -1].map((sx) => {
      const e = new THREE.Group();
      e.position.set(sx * 0.143, -0.012, 0.11);
      this.headG.add(e);
      mesh(mergeGeos([
        part(new THREE.SphereGeometry(0.05, 12, 10), C.eye, [0, 0, 0], [0, 0, 0], [0.6, 1, 1]),
        part(new THREE.SphereGeometry(0.032, 10, 8), C.black, [sx * 0.02, 0, 0.006], [0, 0, 0], [0.6, 1, 1]),
        part(new THREE.SphereGeometry(0.01, 6, 5), '#ffffff', [sx * 0.037, 0.012, 0.016]),
      ]), birdMat, e);
      return e;
    });
    // 上喙
    this.beakUp = new THREE.Group();
    this.beakUp.position.set(0, -0.025, 0.15);
    this.headG.add(this.beakUp);
    mesh(mergeGeos([
      part(new THREE.CylinderGeometry(0.024, 0.08, 0.7, 12), C.beak, [0, 0, 0.35], [HALF_PI, 0, 0], [1.25, 1, 0.42]),
      part(new THREE.CylinderGeometry(0.01, 0.022, 0.68, 6), C.beakDark, [0, 0.027, 0.35], [HALF_PI, 0, 0]),
      part(new THREE.SphereGeometry(0.034, 8, 6), C.beakDark, [0, -0.02, 0.7], [0, 0, 0], [0.9, 1.2, 1]),
    ]), birdMat, this.beakUp);
    // 下喙与喉囊
    this.jawG = new THREE.Group();
    this.jawG.position.set(0, -0.05, 0.14);
    this.headG.add(this.jawG);
    mesh(part(new THREE.CylinderGeometry(0.016, 0.064, 0.66, 10), C.beakDark, [0, 0, 0.33], [HALF_PI, 0, 0], [1.2, 1, 0.3]), birdMat, this.jawG);
    this.pouchG = new THREE.Group();
    this.pouchG.position.set(0, 0, 0.04);
    this.jawG.add(this.pouchG);
    mesh(part(new THREE.SphereGeometry(1, 16, 12), C.pouch, [0, -0.08, 0.25], [0, 0, 0], [0.07, 0.1, 0.28]),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: '#ff9a2e', emissiveIntensity: 0.08 }), this.pouchG);

    // ===== 腿 =====
    const footShape = new THREE.Shape();
    footShape.moveTo(-0.03, -0.05);
    footShape.lineTo(-0.1, 0.15);
    footShape.lineTo(-0.045, 0.13);
    footShape.lineTo(0, 0.2);
    footShape.lineTo(0.045, 0.13);
    footShape.lineTo(0.1, 0.15);
    footShape.lineTo(0.03, -0.05);
    const footGeo = part(new THREE.ExtrudeGeometry(footShape, { depth: 0.022, bevelEnabled: false }), C.leg, [0, -0.045, 0], [HALF_PI, 0, 0]);
    this.legs = [0, 1].map(() => {
      const thigh = new THREE.Group(), shin = new THREE.Group(), foot = new THREE.Group();
      L.add(thigh, shin, foot);
      mesh(part(new THREE.CapsuleGeometry(0.072, THIGH - 0.12, 4, 10), C.white, [0, THIGH / 2, 0]), birdMat, thigh);
      mesh(mergeGeos([
        tube(new V3(0, 0, 0), new V3(0, SHIN, 0), 0.03, C.leg, 8, 0.024),
        part(new THREE.SphereGeometry(0.04, 8, 6), C.leg),
        part(new THREE.SphereGeometry(0.034, 8, 6), C.leg, [0, SHIN, 0]),
      ]), birdMat, shin);
      mesh(footGeo, birdMat, foot);
      return { thigh, shin, foot, knee: new V3(), end: new V3() };
    });

    // ===== 翅膀 =====
    this.wings = [0, 1].map(() => {
      const upper = new THREE.Group(), lower = new THREE.Group();
      L.add(upper, lower);
      mesh(part(new THREE.SphereGeometry(1, 12, 8), C.white, [0, WING1 / 2, 0.03], [0, 0, 0], [0.055, WING1 * 0.62, 0.15]), birdMat, upper);
      const g = [
        part(new THREE.SphereGeometry(1, 12, 8), C.white, [0, WING2 / 2, 0.02], [0, 0, 0], [0.045, WING2 * 0.58, 0.125]),
        part(new THREE.SphereGeometry(1, 10, 6), C.black, [0, WING2 * 0.5, 0.12], [0, 0, 0], [0.02, WING2 * 0.42, 0.075]),
      ];
      for (let i = 0; i < 4; i++) {
        g.push(part(new THREE.ConeGeometry(0.04, 0.2, 5), C.black, [0, WING2 * 0.86 + 0.03 - i * 0.03, 0.03 + i * 0.04], [0.15 + i * 0.3, 0, 0], [0.3, 1, 1]));
      }
      mesh(mergeGeos(g), birdMat, lower);
      return { upper, lower, E: new V3(), T: new V3() };
    });

    // 状态
    this.t = 0;
    this.theta = HALF_PI;
    this.rate = 0;
    this.spin = 0;
    this.effort = 0;
    this.stopK = 1;
    this.airK = 0;
    this.glideK = 0;
    this.flapAmp = 0;
    this.sq = 0; this.sqV = 0;
    this.pz = 0; this.pzV = 0;
    this.px = 0; this.pxV = 0;
    this.prevLean = 0;
    this.hy = 0; this.hp = 0;
    this.gulpT = 0;
    this.bulge = 0;
    this.load = 0;
    this.bellK = 0;
    this.blinkT = 2;
    this.wagK = 0;
    this._v = [new V3(), new V3(), new V3(), new V3(), new V3(), new V3(), new V3(), new V3()];
  }

  gulp() { this.gulpT = 0.42; this.bulge = 0.5; this.wagK = 1; }
  ring() { this.bellK = 1; }
  land(impact) { this.sqV -= Math.min(impact, 10) * 0.11; }
  hop() { this.sqV += 0.5; this.flapAmp = 1; }
  setLoad(n, frac) {
    this.load = frac;
    this.basketFish.forEach((f, i) => { f.visible = i < n; });
  }
  setNight(night) {
    this.lensMat.emissiveIntensity = 0.15 + night * 3;
    this.coneMat.opacity = night * 0.13;
    this.spot.intensity = night * 26;
  }
  beakWorld(out) {
    this.jawG.updateWorldMatrix(true, false);
    return out.set(0, -0.03, 0.38).applyMatrix4(this.jawG.matrixWorld);
  }

  // s: { speed, steer(-1..1，右正), lean, pedal, air, vy, glide, look(V3|null，模型空间), wind }
  update(dt, s) {
    const t = (this.t += dt);
    const [v0, v1, v2, v3, v4, v5, v6, v7] = this._v;
    const pedaling = s.pedal && !s.air;
    this.effort = damp(this.effort, pedaling ? 1 : 0, 6, dt);
    const eff = this.effort;

    // 曲柄：踩踏时与车速联动，滑行时回到水平位
    const target = pedaling ? Math.max(s.speed / WR / 2.3, 2.6) : 0;
    this.rate = damp(this.rate, target, pedaling ? 7 : 5, dt);
    this.theta += this.rate * dt;
    if (!pedaling && this.rate < 1.2) {
      const level = Math.round((this.theta - HALF_PI) / Math.PI) * Math.PI + HALF_PI;
      this.theta = damp(this.theta, level, 5, dt);
    }
    const th = this.theta;
    this.spin += (s.speed * dt) / WR;
    this.rearWheel.rotation.x = this.spin;
    this.frontWheel.rotation.x = this.spin;
    this.crankG.rotation.x = th;
    this.pedals[0].rotation.x = -th;
    this.pedals[1].rotation.x = -th;

    this.stopK = damp(this.stopK, s.speed < 0.4 && !s.air && !s.pedal ? 1 : 0, 5, dt);
    const stopK = this.stopK;
    this.airK = damp(this.airK, s.air ? 1 : 0, 10, dt);
    this.glideK = damp(this.glideK, s.glide, 11, dt);
    const gl = this.glideK;

    const lean = lerp(s.lean, -0.12, stopK);
    this.leanG.rotation.z = lean;
    this.steerG.rotation.y = lerp(-s.steer * 0.42 * lerp(1, 0.45, sstep(2, 8, s.speed)), 0.28, stopK);
    this.pitchG.rotation.x = -clamp(s.vy * 0.035, -0.3, 0.3) * this.airK;
    this.steerPivot.updateMatrix();
    this.steerG.updateMatrix();

    // 落地压缩弹簧
    this.sqV += (-170 * this.sq - 15 * this.sqV) * dt;
    this.sq += this.sqV * dt;
    const sq = clamp(this.sq, -0.09, 0.07);

    // 躯干：随踩踏左右摇、上下起伏
    const roll = Math.sin(th) * 0.055 * eff - lean * 0.35;
    const idle = Math.sin(t * 1.6) * 0.008 * stopK;
    this.torso.position.set(0, SEAT.y + Math.cos(th * 2) * 0.011 * eff + sq + idle, SEAT.z);
    this.torso.rotation.set(TORSO_PITCH + 0.05 * eff - sq * 1.2 - gl * 0.12, Math.sin(th) * 0.03 * eff, roll);
    this.torso.updateMatrix();

    // 脖子与头：反向稳定 + 看向目标
    let yawT, pitchT;
    if (s.look) {
      const dx = s.look.x, dy = s.look.y - 1.75, dz = s.look.z - 0.4;
      yawT = clamp(Math.atan2(dx, Math.max(dz, 0.2)), -1.0, 1.0);
      pitchT = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.45);
    } else {
      yawT = -s.steer * 0.45 + Math.sin(t * 0.55) * 0.5 * stopK;
      pitchT = Math.sin(t * 0.8) * 0.06 * stopK;
    }
    this.hy = damp(this.hy, yawT, 5, dt);
    this.hp = damp(this.hp, pitchT, 5, dt);
    this.neckG.rotation.set(-TORSO_PITCH - 0.02 - 0.05 * eff + sq * 2.2 + Math.cos(th * 2) * 0.02 * eff, this.hy * 0.3, -roll * 0.9);
    this.headG.rotation.set(this.hp + 0.04 - sq * 1.5, this.hy * 0.7, Math.sin(th) * 0.02 * eff);

    // 喙与喉囊
    let open = 0;
    if (this.gulpT > 0) {
      this.gulpT -= dt;
      open = Math.sin(Math.PI * clamp(1 - this.gulpT / 0.42, 0, 1));
    }
    this.bulge = damp(this.bulge, 0, 3.5, dt);
    this.beakUp.rotation.x = 0.17 - open * 0.14;
    this.jawG.rotation.x = 0.2 + open * 0.6;
    const dLean = (lean - this.prevLean) / Math.max(dt, 1e-3);
    this.prevLean = lean;
    this.pzV += (-95 * this.pz - 7 * this.pzV - dLean * 9 + Math.sin(th) * eff * 2.2) * dt;
    this.pz += this.pzV * dt;
    this.pxV += (-95 * this.px - 7 * this.pxV + this.sqV * 40 + Math.cos(th * 2) * eff * 1.4) * dt;
    this.px += this.pxV * dt;
    this.pouchG.rotation.set(clamp(this.px, -0.4, 0.4), 0, clamp(this.pz, -0.5, 0.5));
    this.pouchG.scale.set(1 + this.load * 0.35 + this.bulge * 0.5, 1 + this.load * 0.55 + this.bulge * 0.9 + Math.sin(t * 2.2) * 0.03, 1 + this.bulge * 0.1);

    // 眨眼
    this.blinkT -= dt;
    if (this.blinkT < -0.11) this.blinkT = 1.8 + Math.random() * 3.2;
    const eyeS = this.blinkT < 0 ? 0.12 : 1;
    this.eyes[0].scale.y = this.eyes[1].scale.y = eyeS;

    // 尾羽与围巾
    this.wagK = damp(this.wagK, 0, 2.5, dt);
    this.tailG.rotation.set(
      -0.5 + Math.cos(th * 2) * 0.05 * eff - sq * 3,
      Math.sin(th) * 0.16 * eff + Math.sin(t * 14) * 0.35 * this.wagK + Math.sin(t * 1.3) * 0.05,
      0,
    );
    const wind = sstep(0.3, 7, s.speed);
    this.scarf.forEach((seg, i) => {
      if (i === 0) {
        seg.rotation.set(lerp(-1.15, 0.12, wind) + Math.sin(t * 10) * 0.1 * wind, Math.sin(t * 6.1) * 0.2 * wind + s.steer * 0.3 * wind, 0);
      } else {
        seg.rotation.set(Math.sin(t * 10 - i * 1.1) * (0.06 + 0.24 * wind), Math.sin(t * 6.3 - i * 0.9) * 0.22 * wind + s.steer * 0.12 * wind, 0);
      }
    });

    // 车铃
    this.bellK = damp(this.bellK, 0, 3.2, dt);
    this.bellG.rotation.z = Math.sin(t * 62) * 0.3 * this.bellK;
    this.bellG.scale.setScalar(1 + this.bellK * 0.5);

    // ----- 腿：IK 到脚踏；停车时左脚撑地 -----
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      const sx = i ? -1 : 1;
      const a = th + (i ? Math.PI : 0);
      const ankle = v0.set(sx * PEDX, BB.y + CRANK * Math.cos(a) + 0.075, BB.z + CRANK * Math.sin(a) - 0.03);
      let onGround = 0;
      if (i === 0 && stopK > 0.001) {
        onGround = stopK;
        v1.set(0.4, 0.07, 0.02).applyAxisAngle(ZA, -lean);
        ankle.lerp(v1, stopK);
      }
      const hip = v2.copy(HIP[i]).applyMatrix4(this.torso.matrix);
      const pole = v3.set(sx * (0.22 + onGround * 0.5), 0.1, 1);
      ik2(hip, ankle, THIGH, SHIN, pole, leg.knee, leg.end);
      aim(leg.thigh, hip, leg.knee, ZA);
      aim(leg.shin, leg.knee, leg.end, ZA);
      leg.foot.position.copy(leg.end);
      leg.foot.rotation.set(Math.sin(a + 0.7) * 0.24 * (1 - onGround), onGround * 0.35, -lean * onGround);
    }

    // ----- 翅膀：握把 IK 与展翅滑翔之间混合 -----
    this.flapAmp = damp(this.flapAmp, s.air && s.vy > 1.5 ? 1 : 0.14, 6, dt);
    const flap = Math.sin(t * 15) * this.flapAmp + Math.sin(t * 2.4) * 0.08;
    for (let i = 0; i < 2; i++) {
      const w = this.wings[i];
      const sx = i ? -1 : 1;
      const sh = v0.copy(SHOULDER[i]).applyMatrix4(this.torso.matrix);
      const grip = v1.copy(this.grips[i]).applyMatrix4(this.steerG.matrix).applyMatrix4(this.steerPivot.matrix);
      ik2(sh, grip, WING1, WING2, v2.set(sx * 0.3, 0.35, -1), w.E, w.T);
      if (gl > 0.001) {
        v3.set(sh.x + sx * 0.46, sh.y + 0.1 + flap * 0.17, sh.z - 0.03);
        v4.set(v3.x + sx * 0.66, v3.y - 0.03 + flap * 0.42, v3.z - 0.12);
        w.E.lerp(v3, gl);
        w.T.lerp(v4, gl);
      }
      const hint = v5.set(sx * lerp(0.25, 0, gl), lerp(-1, 0, gl), lerp(-0.25, -1, gl)).normalize();
      const l1 = aim(w.upper, sh, w.E, hint);
      w.upper.scale.set(1, l1 / WING1, lerp(1, 1.6, gl));
      const l2 = aim(w.lower, w.E, w.T, hint);
      w.lower.scale.set(1, l2 / WING2, lerp(1, 2, gl));
    }
  }
}
