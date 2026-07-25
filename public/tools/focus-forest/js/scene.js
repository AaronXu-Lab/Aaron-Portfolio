/**
 * 专注森林 · 3D 场景层 —— 只负责场景与动画，不承载任何界面文字。
 *
 * 植物不是离散的阶段模型,而是一份「生长脚本」:整株按部件登记(anchor, birth,
 * span, retire)排期,setProgress(0–1) 连续驱动。每个部件只做一件事 —— 从自己的
 * 「挂点」等比缩放:枝干挂在基点上,所以是从基点抽长变粗;叶 / 叶团 / 花挂在树干或
 * 主冠内部,所以是从那里鼓出来再推到就位 —— 幼小时贴着母体,不会在半空凭空出现一个
 * 缩小版的自己;幼叶到期沿原路缩回挂点谢幕。
 * 方法论与新增植物样式的步骤见 workflows/focus-forest-plants.md。
 *
 * 环境动感：画面静止时视角仍在极缓慢地摆动，全场树木像被轻风吹拂一样轻晃。
 * 代价是可见时会持续渲染(不再「静止即停 rAF」);低性能与 prefers-reduced-motion
 * 下环境动画整体关掉，页面不可见时照旧完全停渲染。
 */

import * as THREE from '../vendor/three.module.min.js';
import { forestSpot, hash01 } from './core.js';

/** 单页森林上限，超过就分页 —— 也是 clone 方案的适用上限。 */
const FOREST_LIMIT = 30;

/**
 * 相机锁死在两套取景里,只让用户转动视角(不能缩放 / 平移 / 自由移动)。
 * 水平方向不设限,可以一直拖着转;俯仰仍然夹紧,否则会翻到地面以下。
 * target 压到接近地面：被摄主体（植物）因此落在画面上半部，底部留给 HTML 面板。
 */
const CAM = {
  plant: { fov: 38, radius: 10, polar: 1.13, target: [0, -0.35, 0] },
  // 森林用更长的焦段 + 拉远，压掉近大远小，像个手办盆景
  forest: { fov: 26, radius: 26, polar: 1.05, target: [0, 0.6, 0] },
};
const POLAR_MIN = 0.5;
const POLAR_MAX = 1.36;
/** 滚轮 / 双指捏合缩放只在森林里开放,倍率相对该模式的默认机位。 */
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.7;
/** 森林取景要装进画面的半宽:岛半径(2.5 × 2.6)加一点呼吸边。 */
const FOREST_FIT = 7.2;

/** 环境运镜：极慢、幅度极小,只为让画面不死。 */
const DRIFT = { azSpeed: 0.13, azAmp: 0.11, polarSpeed: 0.09, polarAmp: 0.025 };
/** 轻风：每株植物按自己的相位晃,不整齐划一。 */
const BREEZE = { rollSpeed: 0.85, rollAmp: 0.022, pitchSpeed: 0.63, pitchAmp: 0.015 };

/** three r155+ 用物理光照单位，强度量级比旧版大。 */
const LIGHT = { hemi: 2.1, sun: 2.4 };

/**
 * 生长追赶的时间常数（秒）：每帧按 1 - e^(-dt/τ) 逼近目标。
 * 指数逼近的好处是目标移动时速度连续 —— 匀速追赶在目标每次跳变时会有折角,
 * 那正是「秒级刷新驱动生长」看起来卡顿的来源。0.3 秒既跟得上又能吃掉抖动。
 */
const GROW_TAU = 0.3;

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** 木质化：芽是嫩绿的，树干是木色的，同一根枝干在生长中间过渡过去。 */
const SPROUT_GREEN = new THREE.Color(0x63a95c);
const BARK_BROWN = new THREE.Color(0x8a6244);
/** 过渡区间：破土后不久开始上色，抽到半高时已完全木质化。 */
const WOOD = { from: 0.12, span: 0.38 };

function makeMaterials() {
  const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
  return {
    soil: lambert(0x9a6f52),
    grass: lambert(0x7cc46b),
    bark: lambert(BARK_BROWN),
    leaf: lambert(0x8ad272),
    leafDeep: lambert(0x5faa54),
    blossom: lambert(0xf6a8c0),
    seed: lambert(0x6d4a33),
  };
}

/**
 * 全场共用的几何体：每种基元只造一次，靠 scale / position 复用。
 * 精度比初版高一档:圆柱类的分段数直接翻倍;多面体族的面数是 base × (detail+1)²,
 * 所以树冠 80→180(×2.25,最接近「翻倍」的一档),叶 / 花 20→80,石 36→144。
 * 成熟株因此从 736 升到 1864 三角面,仍远低于 20k 预算;每帧只改 transform,
 * 面数只压 GPU 光栅化,不影响 CPU 帧耗时。
 */
const GEO = {
  stem: new THREE.CylinderGeometry(0.55, 1, 1, 12, 1),
  leaf: new THREE.IcosahedronGeometry(1, 1),
  blob: new THREE.IcosahedronGeometry(1, 2),
  soil: new THREE.CylinderGeometry(2.5, 2.15, 0.72, 36),
  grass: new THREE.CylinderGeometry(2.54, 2.5, 0.2, 36),
  rock: new THREE.DodecahedronGeometry(1, 1),
};

/** 枝干方向换算用的基准轴（GEO.stem 沿 +Y）。 */
const UP = new THREE.Vector3(0, 1, 0);

function part(geo, mat, [x, y, z], [sx, sy, sz], rot) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  return mesh;
}

/** 叶片：压扁的二十面体。 */
const leafOf = (mat, pos, size, rot) => part(GEO.leaf, mat, pos, [size, size * 0.62, size], rot);
/** 树冠团块：稍微不规则的球,细分一级,面数仍很低。 */
const blobOf = (mat, pos, r, rot) => part(GEO.blob, mat, pos, [r, r * 0.86, r * 0.94], rot);
/** 花：小球。 */
const bloomOf = (mat, pos, r) => part(GEO.leaf, mat, pos, [r, r, r], [r * 9, r * 5, r * 3]);

/**
 * 生长脚本:整株植物是一张部件清单,每个部件登记 anchor(挂点)、birth(出生进度)、
 * span(生长跨度)、可选 retire = [开始, 跨度](到期原路缩回挂点退场 —— 幼叶谢幕)。
 * 驱动只有一个原语:从挂点等比缩放 0→1。挂点决定语义 ——
 * 枝干挂在自己的基点上,缩放即从基点抽长变粗(幼年主干天然又细又矮,就是芽);
 * 叶 / 叶团 / 花挂在树干或主冠内部,缩放同时把它从挂点推到就位,所以是「从母体鼓出来」。
 * 挂点不能省:几何中心就是终点位置,只缩放的话幼小时是一个悬在终点半空的缩小版自己。
 * 排期约束:birth 必须晚于挂点可达的进度(树干长过挂点高度),否则挂点本身就是悬空的。
 * 成品(p=1)silhouette 与原成熟株一致:约 740 三角面、5 种材质、零贴图。
 */
function buildPlant(mat) {
  const root = new THREE.Group();
  const parts = [];

  const enroll = (node, anchor, birth, span, ease, retire) => {
    root.add(node);
    parts.push({
      node,
      base: node.scale.clone(),
      home: node.position.clone(),
      anchor: anchor ? new THREE.Vector3(...anchor) : null,
      birth,
      span,
      ease,
      retire,
    });
    return node;
  };
  /** 叶 / 叶团 / 花 / 种子:从挂点鼓出并推到就位,带一点回弹。 */
  const pop = (mesh, anchor, birth, span, retire) =>
    enroll(mesh, anchor, birth, span, backOut01, retire);
  /** 枝干:直接给基点与末端,挂点即基点,不必再手算欧拉角与中点。 */
  const limb = (base, tip, thick, birth, span) => {
    const from = new THREE.Vector3(...base);
    const dir = new THREE.Vector3(...tip).sub(from);
    const len = dir.length();
    const g = new THREE.Group();
    g.position.copy(from);
    g.quaternion.setFromUnitVectors(UP, dir.normalize());
    g.add(part(GEO.stem, mat.bark, [0, len / 2, 0], [thick, len, thick]));
    // 组本身就落在基点上,缩放天然从基点起算,不需要额外的挂点
    return enroll(g, null, birth, span, smooth);
  };

  // 0–0.25 种子:一摊土 + 半埋的豆,主干破壳而出后缩回土里(挂点在地面)
  pop(part(GEO.rock, mat.soil, [0, 0.02, 0], [0.44, 0.085, 0.44], [0, 0.4, 0]), [0, 0, 0], -0.01, 0.01, [0.16, 0.14]);
  pop(part(GEO.leaf, mat.seed, [0, 0.115, 0], [0.17, 0.13, 0.17], [0.4, 0.3, 0.2]), [0, 0, 0], -0.01, 0.01, [0.1, 0.12]);

  // 0.02–0.52 主干:从细芽到树干始终是同一根,自地面抽长
  limb([0, 0, 0], [0, 1.7, 0], 0.15, 0.02, 0.5);

  // 初叶与中层叶:挂点沿树干由低到高,各自等树干长过挂点才出现;树冠成形前后依次缩回树干
  pop(leafOf(mat.leaf, [-0.11, 0.28, 0.04], 0.14, [0, 0.4, 0.6]), [0, 0.24, 0], 0.15, 0.08, [0.46, 0.14]);
  pop(leafOf(mat.leaf, [0.13, 0.33, 0.01], 0.17, [0, 0, -0.55]), [0, 0.28, 0], 0.17, 0.08, [0.5, 0.14]);
  pop(leafOf(mat.leafDeep, [0.02, 0.42, -0.08], 0.11, [0.4, 0, 0.1]), [0, 0.38, 0], 0.19, 0.08, [0.54, 0.14]);
  pop(leafOf(mat.leafDeep, [-0.2, 0.5, -0.06], 0.17, [0, 0.5, 0.55]), [0, 0.46, 0], 0.21, 0.1, [0.58, 0.16]);
  pop(leafOf(mat.leaf, [0.22, 0.6, 0.05], 0.2, [0, 0, -0.5]), [0, 0.55, 0], 0.23, 0.1, [0.62, 0.16]);

  // 0.24–0.55 分枝:基点埋在树干里(末端不动,只把根挪进去),树干长过基点后依次萌出;0.42 起根盘鼓出
  limb([0.01, 0.58, 0.02], [0.33, 0.95, 0.15], 0.05, 0.24, 0.14);
  limb([0.02, 0.74, 0.01], [0.52, 1.22, 0.06], 0.07, 0.29, 0.14);
  limb([-0.02, 0.92, -0.02], [-0.44, 1.34, 0.02], 0.06, 0.34, 0.14);
  limb([-0.02, 1.2, -0.03], [-0.27, 1.59, -0.12], 0.048, 0.41, 0.13);
  pop(part(GEO.rock, mat.bark, [0, 0.05, 0], [0.25, 0.11, 0.25], [0, 0.6, 0]), [0, 0, 0], 0.42, 0.16);

  // 0.5–0.88 树冠:第一团自树干顶端鼓出,其余五团从主冠内部推出去,一团一团鼓起来
  pop(blobOf(mat.leaf, [0, 2.05, 0], 0.56), [0, 1.66, 0], 0.5, 0.18);
  pop(blobOf(mat.leaf, [0.5, 1.76, 0.12], 0.38, [0, 0.7, 0.2]), [0.05, 1.85, 0.02], 0.56, 0.16);
  pop(blobOf(mat.leafDeep, [-0.47, 1.86, -0.14], 0.34, [0.3, 0, 0.4]), [-0.05, 1.9, -0.02], 0.61, 0.16);
  pop(blobOf(mat.leafDeep, [0.27, 1.6, 0.33], 0.27, [0.2, 0.5, 0]), [0.04, 1.8, 0.05], 0.66, 0.15);
  pop(blobOf(mat.leaf, [-0.22, 2.0, -0.34], 0.26, [0, 0.9, 0.3]), [-0.03, 1.98, -0.05], 0.7, 0.15);
  pop(blobOf(mat.leafDeep, [0.1, 1.66, -0.24], 0.22, [0.4, 0, 0.2]), [0.02, 1.82, -0.04], 0.74, 0.14);

  // 0.84–1 开花:各自从贴着的那团叶子里挤出来,最后一朵恰好在 1.0 长完
  pop(bloomOf(mat.blossom, [0.28, 2.52, 0.1], 0.075), [0.2, 2.38, 0.07], 0.84, 0.07);
  pop(bloomOf(mat.blossom, [0.72, 1.82, 0.24], 0.068), [0.55, 1.8, 0.18], 0.87, 0.07);
  pop(bloomOf(mat.blossom, [-0.66, 1.98, -0.06], 0.062), [-0.5, 1.94, -0.05], 0.9, 0.07);
  pop(bloomOf(mat.blossom, [0.34, 1.62, 0.56], 0.058), [0.26, 1.66, 0.42], 0.93, 0.06);
  pop(bloomOf(mat.blossom, [-0.3, 2.36, -0.3], 0.055), [-0.22, 2.26, -0.22], 0.96, 0.04);

  applyGrowth(parts, 1);
  return { root, parts };
}

/** 把进度应用到整份生长脚本:局部进度 → 缓动 → 谢幕衰减 → 从挂点等比缩放并推到就位。 */
function applyGrowth(parts, p) {
  for (const it of parts) {
    let k = it.ease(clamp((p - it.birth) / it.span, 0, 1));
    if (it.retire) k *= 1 - smooth(clamp((p - it.retire[0]) / it.retire[1], 0, 1));
    it.node.visible = k > 0.001;
    const s = Math.max(k, 0.001);
    it.node.scale.copy(it.base).multiplyScalar(s);
    // 挂点在别处的部件:缩放的同时把位置从挂点插到终点,等价于「轴心在挂点上」
    if (it.anchor) it.node.position.lerpVectors(it.anchor, it.home, s);
  }
}

function buildIsland(mat, scale) {
  const g = new THREE.Group();
  g.add(part(GEO.soil, mat.soil, [0, -0.36, 0], [1, 1, 1]));
  g.add(part(GEO.grass, mat.grass, [0, 0.02, 0], [1, 1, 1]));
  // 少量石头装饰，位置固定，不参与动画
  g.add(part(GEO.rock, mat.seed, [1.62, 0.06, 0.72], [0.17, 0.12, 0.15], [0.4, 0.8, 0.2]));
  g.add(part(GEO.rock, mat.seed, [-1.42, 0.05, -1.04], [0.12, 0.09, 0.11], [0.2, 0.3, 0.5]));
  g.add(part(GEO.rock, mat.grass, [-1.72, 0.06, 0.86], [0.2, 0.1, 0.18], [0, 0.6, 0]));
  g.scale.setScalar(scale);
  return g;
}

/** 庆祝脉冲用的回弹(0 处不归零,脉冲从 86% 起跳正合适)。 */
const backOut = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
/** 标准 easeOutBack:0 处归零,生长脚本的「鼓出」用它。 */
const backOut01 = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const smooth = (x) => x * x * (3 - 2 * x);

export function createScene(canvas, { motion = true } = {}) {
  // 透明画布：天空由 CSS 的 --sky 提供，深浅色与「离开页面变暗」都归样式表管，不在这里再存一份颜色
  // MSAA 一律打开:这点面数在手机上也不构成负担,关掉的锯齿感远比开销显眼
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6f8f5f, LIGHT.hemi);
  const sun = new THREE.DirectionalLight(0xfff2da, LIGHT.sun);
  sun.position.set(3.4, 6.2, 3.8);
  scene.add(hemi, sun);

  const camera = new THREE.PerspectiveCamera(CAM.plant.fov, 1, 0.1, 120);

  // 活株用独立材质副本：放弃时的淡出只能改自己的 opacity,不能牵连森林
  const activeMat = makeMaterials();
  const baseMat = makeMaterials();

  const plantView = new THREE.Group();
  const plant = buildPlant(activeMat);
  plantView.add(buildIsland(activeMat, 0.66), plant.root);
  scene.add(plantView);

  const forestView = new THREE.Group();
  forestView.visible = false;
  forestView.add(buildIsland(baseMat, 2.6));
  scene.add(forestView);

  // 森林里的植株：clone 共享几何体与材质，只改变换
  // ponytail: clone 每株（≤30 株）;真要放开上限再换 InstancedMesh
  const forestTemplate = buildPlant(baseMat);
  const forestPlants = [];
  let forestRecords = [];

  const particles = makeParticles();
  scene.add(particles.points);

  let mode = 'plant';
  let orbit = { azimuth: 0, polar: CAM.plant.polar };
  let zoom = 1;
  let quality = 'auto';
  let paused = false;
  let dimTarget = 0;
  let dim = 0;
  let fade = 1;
  let drop = 0;
  let clock = 0;
  let goal = 1; // buildPlant 出厂即 p=1,shown/goal 与之一致
  let shown = 1;
  let span = null; // 专注中的时间区间:非空则每帧自算目标进度
  let tween = 0;
  let onPick = null;

  /** 环境动画开关：低性能或 reduced-motion 下彻底关掉。 */
  const ambient = () => motion && quality !== 'low';

  const holds = new Set();
  let raf = 0;
  let last = 0;
  let acc = 0;
  let busy = false;
  let frames = 0;
  let slowFrames = 0;

  const target = new THREE.Vector3();
  const spherical = new THREE.Vector3();

  /**
   * 活株的生长：部件排期 + 木质化。
   * 木质化只改活株那份材质副本（森林里的树定格在成品，一直是木色）。
   */
  function grow(p) {
    applyGrowth(plant.parts, p);
    const k = smooth(clamp((p - WOOD.from) / WOOD.span, 0, 1));
    activeMat.bark.color.lerpColors(SPROUT_GREEN, BARK_BROWN, k);
  }
  grow(shown);

  function updateCamera() {
    const conf = CAM[mode];
    target.set(...conf.target);
    const on = ambient();
    const azimuth = orbit.azimuth + (on ? Math.sin(clock * DRIFT.azSpeed) * DRIFT.azAmp : 0);
    const polar = clamp(
      orbit.polar + (on ? Math.sin(clock * DRIFT.polarSpeed + 1.7) * DRIFT.polarAmp : 0),
      POLAR_MIN,
      POLAR_MAX
    );
    const sinP = Math.sin(polar);
    spherical.set(Math.sin(azimuth) * sinP, Math.cos(polar), Math.cos(azimuth) * sinP);
    // 竖屏可视宽度不够:植物模式往后退一点即可;森林按宽高比精确退到整座岛进画,
    // 否则手机上默认机位只装得下岛中央一小块
    let radius = conf.radius;
    if (mode === 'forest') {
      const halfW = Math.tan((camera.fov * Math.PI) / 360) * Math.max(camera.aspect, 0.01);
      radius = Math.max(radius, FOREST_FIT / halfW);
    } else if (camera.aspect < 1) {
      radius *= 1.25;
    }
    camera.position.copy(target).addScaledVector(spherical, radius * zoom);
    camera.lookAt(target);
  }

  function render() {
    updateCamera();
    renderer.render(scene, camera);
  }

  /** 轻风：绕 z / x 微幅摆动,phase 让每株错开;不动 rotation.y(森林靠它做朝向)。 */
  function breeze(group, phase) {
    group.rotation.z = Math.sin(clock * BREEZE.rollSpeed + phase) * BREEZE.rollAmp;
    group.rotation.x = Math.sin(clock * BREEZE.pitchSpeed + phase * 1.7) * BREEZE.pitchAmp;
  }

  function tick(dt) {
    clock += dt;
    let alive = false;

    if (tween > 0) {
      // 庆祝脉冲:整株从 86% 回弹到 100%,略过冲
      tween = Math.max(0, tween - dt / 0.42);
      plant.root.scale.setScalar(0.82 + 0.18 * backOut(1 - tween));
      alive = true;
    }

    // 专注中的目标进度每帧按真实时间重算:上层秒级刷新只管数字,生长不再走台阶
    if (span) {
      const total = span.endsAt - span.startedAt;
      goal = total > 0 ? clamp((Date.now() - span.startedAt) / total, 0, 1) : 1;
      alive = true;
    }

    if (shown !== goal) {
      const gap = goal - shown;
      shown = motion ? shown + gap * (1 - Math.exp(-dt / GROW_TAU)) : goal;
      if (Math.abs(goal - shown) < 0.0004) shown = goal; // 收尾,免得无限逼近
      grow(shown);
      alive = true;
    }

    if (drop > 0) {
      drop = Math.max(0, drop - dt / 0.45);
      const k = 1 - drop; // 加速下落,落到 y=0
      plant.root.position.y = 0.9 * (1 - k * k);
      alive = true;
    }

    if (ambient()) {
      if (mode === 'plant') breeze(plant.root, 0);
      else for (const g of forestPlants) breeze(g, g.userData.phase);
      alive = true;
    }

    if (dim !== dimTarget) {
      const step = dt / 0.5;
      dim = dim < dimTarget ? Math.min(dimTarget, dim + step) : Math.max(dimTarget, dim - step);
      hemi.intensity = LIGHT.hemi * (1 - dim * 0.62);
      sun.intensity = LIGHT.sun * (1 - dim * 0.7);
      alive = true;
    }

    if (fade < 1) {
      fade = Math.max(0, fade - dt / 0.8);
      for (const m of Object.values(activeMat)) {
        m.transparent = true;
        m.opacity = fade;
      }
      alive = alive || fade > 0;
    }

    if (particles.update(dt)) alive = true;

    return alive;
  }

  function frame(now) {
    raf = 0;
    if (paused) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    const step = quality === 'low' ? 1 / 30 : 0;
    if (acc >= step) {
      sampleQuality(dt);
      busy = tick(acc);
      render();
      acc = 0;
    }
    if (busy || holds.size) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || paused) return;
    busy = true;
    last = performance.now();
    acc = quality === 'low' ? 1 / 30 : 0;
    raf = requestAnimationFrame(frame);
  }

  /**
   * 低性能自动降档：跳过启动期(加载 / 编译着色器的卡顿不算数)再采样 120 帧,
   * 过半慢于 34ms(跌破 30fps)才降画质。原来从第一帧就采、24ms 就算慢,
   * 手机启动抖动几乎必然被误判成低画质,然后整段会话都顶着 DPR=1 的马赛克。
   * ponytail: 只看帧耗时的粗启发式；误判的代价仅是画质更低,不影响功能
   */
  const WARMUP = 30;
  const SAMPLE = 120;
  function sampleQuality(dt) {
    if (quality !== 'auto' || frames >= WARMUP + SAMPLE) return;
    frames++;
    if (frames <= WARMUP) return;
    if (dt > 0.034) slowFrames++;
    if (frames >= WARMUP + SAMPLE && slowFrames > SAMPLE / 2) setQuality('low');
  }

  function setQuality(next) {
    const was = quality;
    quality = next;
    // 3x 屏上 1.5 倍渲染的插值放大是锯齿感的另一半来源,上限提到 2;低画质档才压到 1
    renderer.setPixelRatio(next === 'low' ? 1 : Math.min(devicePixelRatio || 1, 2));
    if (next === 'low') {
      particles.clear();
      // 环境动画停在中位,别把树留在歪着的姿态上
      plant.root.rotation.set(0, 0, 0);
      for (const g of forestPlants) g.rotation.set(0, g.rotation.y, 0);
      // 低画质换更简单的森林植株(PRD:远处/大量植株用简化模型)
      if (was !== next && forestRecords.length) showForest(forestRecords, onPick);
    }
    resize();
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function requestRender() {
    if (!raf && !paused) render();
  }

  /** 静态进度：钉在某个值上（首页预览 / 完成 / 放弃后复位），并退出跟随模式。 */
  function setProgress(p, { animate = true } = {}) {
    span = null;
    goal = clamp(Number(p) || 0, 0, 1);
    if (!animate || !motion || quality === 'low') {
      if (shown !== goal) {
        shown = goal;
        grow(shown);
      }
      requestRender();
      return;
    }
    if (shown !== goal) start();
  }

  /**
   * 跟随模式：把整段专注的起止时间交给场景，进度由渲染循环每帧按真实时间插值。
   * 后台回来、刷新、时钟漂移都自动对齐 —— 目标始终从时间戳算，不靠累加。
   */
  function trackProgress(startedAt, endsAt) {
    span = { startedAt, endsAt };
    start();
  }

  function setDim(on) {
    dimTarget = on ? 1 : 0;
    if (!motion) {
      dim = dimTarget;
      hemi.intensity = LIGHT.hemi * (1 - dim * 0.62);
      sun.intensity = LIGHT.sun * (1 - dim * 0.7);
      requestRender();
      return;
    }
    start();
  }

  function resetPlant() {
    fade = 1;
    drop = 0;
    for (const m of Object.values(activeMat)) {
      m.transparent = false;
      m.opacity = 1;
    }
    plant.root.visible = true;
    plant.root.position.set(0, 0, 0);
    plant.root.rotation.set(0, 0, 0);
    plant.root.scale.setScalar(1);
    particles.clear();
    tween = 0;
  }

  /** 开始专注：种子从空中落进土里。 */
  function dropSeed() {
    if (!motion) {
      plant.root.position.y = 0;
      requestRender();
      return;
    }
    drop = 1;
    plant.root.position.y = 0.9;
    start();
  }

  /** 放弃：停止生长并淡出，不留下植株。 */
  function fadeOutPlant() {
    if (!motion) {
      plant.root.visible = false;
      requestRender();
      return;
    }
    fade = 0.999;
    start();
  }

  /** 完成：进度钉到 1,整株回弹一下 + 少量粒子。 */
  function celebrate() {
    setProgress(1, { animate: false });
    if (motion && quality !== 'low') {
      tween = 1;
      particles.burst();
      start();
    }
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    orbit = { azimuth: 0, polar: CAM[next].polar };
    zoom = 1;
    camera.fov = CAM[next].fov;
    camera.updateProjectionMatrix();
    plantView.visible = next === 'plant';
    forestView.visible = next === 'forest';
    if (ambient()) start();
    else requestRender();
  }

  /** 渲染一页森林（≤30 株）:同株型 clone,共享几何体与材质。 */
  function showForest(records, pick) {
    onPick = pick || null;
    forestRecords = records;
    for (const g of forestPlants) forestView.remove(g);
    forestPlants.length = 0;

    // 低画质把模板定格在 0.66(相当于旧「成长期」株型),可见部件少约三分之一
    applyGrowth(forestTemplate.parts, quality === 'low' ? 0.66 : 1);
    const list = records.slice(-FOREST_LIMIT);
    list.forEach((record, i) => {
      const g = forestTemplate.root.clone();
      const seed = hash01(record.id);
      const [x, z] = forestSpot(i);
      g.visible = true;
      g.position.set(x, 0.05, z);
      g.rotation.set(0, seed * Math.PI * 2, 0);
      // 时长越长的树略高一点，肉眼能看出差别但不夸张
      g.scale.setScalar(0.62 + Math.min(0.45, record.minutes / 150) + seed * 0.12);
      g.userData.record = record;
      g.userData.phase = seed * Math.PI * 2;
      forestView.add(g);
      forestPlants.push(g);
    });
    if (ambient()) start();
    else requestRender();
  }

  // ---- 单指拖动旋转 + 双指捏合缩放（森林限定;不支持平移 / 自由移动） ----
  const drag = { id: null, x: 0, y: 0, moved: 0 };
  const touches = new Map(); // pointerId → [x, y],同时按下的所有指针
  let pinch = null; // 双指落定瞬间的基准 { dist, zoom }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const touchDist = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
  };

  canvas.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有活动指针,忽略 */
    }
    if (touches.size === 2) {
      // 第二根手指落下:拖转手势转为捏合,本次不再算「点了一下」
      pinch = { dist: touchDist(), zoom };
      drag.id = null;
    } else if (touches.size === 1) {
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved = 0;
    }
    holds.add('drag');
    start();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && touches.size >= 2) {
      // 触屏没有滚轮,捏合承担森林缩放;与滚轮同一套 zoom 与上下限
      if (mode === 'forest') {
        zoom = clamp((pinch.zoom * pinch.dist) / touchDist(), ZOOM_MIN, ZOOM_MAX);
      }
      return;
    }
    if (e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    orbit.azimuth -= dx * 0.006; // 水平不夹紧,可以一直转
    orbit.polar = clamp(orbit.polar - dy * 0.005, POLAR_MIN, POLAR_MAX);
  });

  /**
   * 滚轮 / 触控板缩放:只在森林里生效,改的是机位距离的倍率。
   * deltaMode 各设备不一样(像素 / 行 / 页),先归一化再夹紧,免得一格就冲到底。
   */
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (mode !== 'forest') return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const delta = clamp(e.deltaY * unit, -120, 120);
      const next = clamp(zoom * (1 + delta * 0.0018), ZOOM_MIN, ZOOM_MAX);
      if (next === zoom) return;
      zoom = next;
      if (ambient()) start();
      else requestRender();
    },
    { passive: false }
  );

  function endDrag(e) {
    if (!touches.delete(e.pointerId)) return;
    if (touches.size < 2) pinch = null;
    if (!touches.size) holds.delete('drag');
    if (e.pointerId === drag.id) {
      drag.id = null;
      if (drag.moved < 8) pickAt(e);
    }
    requestRender();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function pickAt(e) {
    if (mode !== 'forest' || !onPick || !forestPlants.length) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(forestPlants, true)[0];
    if (!hit) return onPick(null);
    let node = hit.object;
    while (node && !node.userData.record) node = node.parent;
    if (node) onPick(node.userData.record);
  }

  new ResizeObserver(resize).observe(canvas);
  setQuality('auto');
  // 后台标签页里 rAF 不会回调,别在那时候排帧(排了也只会留个假 id)
  if (ambient() && !document.hidden) start();

  return {
    resize,
    requestRender,
    setProgress,
    trackProgress,
    setDim,
    setMode,
    showForest,
    celebrate,
    fadeOutPlant,
    resetPlant,
    drop: dropSeed,
    get quality() {
      return quality;
    },
    pause() {
      paused = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    resume() {
      paused = false;
      // 后台加载的页面会留下一个永远不会回调的 rAF id,不清掉的话
      // start() / requestRender() 的 `if (raf)` 守卫会把动画和重绘一起挡死
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ambient() || span || holds.size || busy) start();
      else requestRender();
    },
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** 完成时的一小把粒子：单个 Points,48 个点，1.6 秒内落幕。 */
function makeParticles() {
  const COUNT = 48;
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xfff0b8,
    size: 0.11,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  let life = 0;

  return {
    points,
    burst() {
      for (let i = 0; i < COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.15 + Math.random() * 0.5;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = 1.2 + Math.random() * 0.9;
        positions[i * 3 + 2] = Math.sin(a) * r;
        velocities[i * 3] = Math.cos(a) * 0.6;
        velocities[i * 3 + 1] = 0.9 + Math.random() * 1.1;
        velocities[i * 3 + 2] = Math.sin(a) * 0.6;
      }
      life = 1;
      points.visible = true;
      material.opacity = 1;
      geometry.attributes.position.needsUpdate = true;
    },
    clear() {
      life = 0;
      points.visible = false;
    },
    update(dt) {
      if (life <= 0) return false;
      life = Math.max(0, life - dt / 1.6);
      for (let i = 0; i < COUNT; i++) {
        velocities[i * 3 + 1] -= dt * 1.9;
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = life;
      if (life === 0) points.visible = false;
      return true;
    },
  };
}
