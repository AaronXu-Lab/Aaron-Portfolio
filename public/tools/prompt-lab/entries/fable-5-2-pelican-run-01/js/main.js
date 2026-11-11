// 小星球环骑：主循环、输入、镜头、昼夜与 HUD
import { THREE, V3, R, clamp, lerp, sstep, damp } from './util.js';
import { buildWorld, depthAt, roadDir, roadTangent, roadDist } from './world.js';
import { Rider } from './rider.js';
import { Sfx } from './audio.js';

const ID = 'fable-5-2-pelican-run-01';
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(`${ID}:${k}`);
      return v === null ? d : JSON.parse(v);
    } catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(`${ID}:${k}`, JSON.stringify(v)); } catch (e) { /* 隐私模式下忽略 */ }
  },
};
const $ = (id) => document.getElementById(id);
const canvas = $('c');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('nogl').hidden = false;
  throw e;
}
const coarse = matchMedia('(pointer: coarse)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#bfe6ff', 30, 150);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1800);

// ---------- 光 ----------
const hemi = new THREE.HemisphereLight('#dff1ff', '#8fae6a', 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e0', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.035;
sun.target.position.set(0, 0.6, -1);
scene.add(sun, sun.target);

// ---------- 天空 ----------
const skyU = {
  uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
  uSunDir: { value: new V3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uGlow: { value: 1 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 32, 20),
  new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop, uHor, uSunDir, uSunCol; uniform float uGlow;
      void main(){
        vec3 d = normalize(vDir);
        float t = smoothstep(-0.38, 0.7, d.y);
        vec3 col = mix(uHor, uTop, pow(t, 0.8));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunCol * (smoothstep(0.9984, 0.9991, s) * 1.6 + pow(s, 90.0) * 0.45 + pow(s, 7.0) * 0.28 * uGlow);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

const starG = new THREE.Group();
scene.add(starG);
const starMats = [];
for (const [n, size] of [[700, 1.4], [90, 2.1]]) {
  const pos = new Float32Array(n * 3);
  const v = new V3();
  for (let i = 0; i < n; i++) {
    v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(620);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: '#eef3ff', size: size * renderer.getPixelRatio(), sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  starMats.push(m);
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  starG.add(pts);
}
const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16), new THREE.MeshBasicMaterial({ color: '#f4f1de', fog: false }));
scene.add(moon);

// ---------- 世界与骑手 ----------
const world = buildWorld(scene);
const { planet, fishes, particles, obstacles } = world;
const rider = new Rider();
scene.add(rider.group);
const sfx = new Sfx(store.get('muted', false));

const XA = new V3(1, 0, 0), YA = new V3(0, 1, 0);
const qTmp = new THREE.Quaternion(), qInv = new THREE.Quaternion();
const pLocal = new V3(0, 1, 0);
const START_LON = 0.38;
const p0 = roadDir(START_LON);
const h0 = roadTangent(START_LON);
h0.addScaledVector(p0, -h0.dot(p0)).normalize();
const r0 = new V3().crossVectors(h0, p0);
const sunL = new V3().addScaledVector(p0, 0.74).addScaledVector(h0, -0.5).addScaledVector(r0, 0.44).normalize();
const sunW = new V3();
let prevK = 1;

const st = {
  speed: 0, steer: 0, yawVis: 0, y: 0, vy: 0, grounded: true, flaps: 0,
  sink: 0, wet: 0, wasWet: false, bump: 0, dist: 0,
  count: 0, round: 1, total: store.get('total', 0), combo: 0, comboT: 0,
  magnet: 0, bellCd: 0, respawn: 0, time: 0, tick: 0, dustT: 0, splashT: 0, night: 0, day: 1,
  hint: { move: false, bell: false, air: false, night: false },
};

function resetPose() {
  const m = new THREE.Matrix4().makeBasis(r0, p0, h0.clone().negate());
  planet.quaternion.setFromRotationMatrix(m).invert();
  st.speed = 0; st.y = 0; st.vy = 0; st.grounded = true; st.steer = 0;
}
resetPose();
fishes.spawn(st.round);

// ---------- 输入 ----------
const keys = new Set();
const touch = { id: null, sx: 0, sy: 0, x: 0, pedal: false, brake: false };
let jumpHeld = false, jumpPressed = false;
const stick = $('stick'), knob = stick.firstElementChild;

function unlock() { sfx.unlock(); }
canvas.addEventListener('pointerdown', (e) => {
  unlock();
  window.focus();
  closeHelp();
  if (touch.id !== null) return;
  touch.id = e.pointerId;
  touch.sx = e.clientX; touch.sy = e.clientY;
  touch.x = 0; touch.pedal = true; touch.brake = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  stick.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  knob.style.transform = 'translate(0px, 0px)';
  stick.classList.add('on');
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.sx, dy = e.clientY - touch.sy;
  touch.x = clamp(dx / 58, -1, 1);
  touch.brake = dy > 52;
  touch.pedal = !touch.brake;
  knob.style.transform = `translate(${clamp(dx, -58, 58)}px, ${clamp(dy, -20, 58)}px)`;
});
const endTouch = (e) => {
  if (e.pointerId !== touch.id) return;
  touch.id = null; touch.x = 0; touch.pedal = false; touch.brake = false;
  stick.classList.remove('on');
};
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const btnJump = $('btnJump'), btnBell = $('btnBell');
btnJump.addEventListener('pointerdown', (e) => {
  e.preventDefault(); unlock();
  jumpHeld = true; jumpPressed = true;
  try { btnJump.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btnJump.addEventListener(ev, () => { jumpHeld = false; });
btnBell.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); ringBell(); });
$('btnCam').addEventListener('click', () => { unlock(); nextCam(); });
$('btnSnd').addEventListener('click', () => { unlock(); toggleMute(); });
$('btnHelp').addEventListener('click', () => { unlock(); toggleHelp(); });
$('helpClose').addEventListener('click', closeHelp);
for (const b of document.querySelectorAll('button')) b.addEventListener('contextmenu', (e) => e.preventDefault());

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  unlock();
  const k = KEYMAP[e.code];
  if (k) { keys.add(k); e.preventDefault(); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) { jumpPressed = true; btnJump.classList.add('down'); }
    jumpHeld = true;
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); ringBell(); }
  else if (e.code === 'KeyC') nextCam();
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyR') { resetPose(); say('回到起点'); }
  else if (e.code === 'KeyH' || e.code === 'Slash') toggleHelp();
  else if (e.code === 'Escape') closeHelp();
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys.delete(k);
  if (e.code === 'Space') { jumpHeld = false; btnJump.classList.remove('down'); }
});
window.addEventListener('blur', () => { keys.clear(); jumpHeld = false; btnJump.classList.remove('down'); });

// ---------- HUD ----------
const elN = $('n'), elTotal = $('tot'), elBar = $('barFill'), elPhase = $('phase'), elToast = $('toast'), elScore = $('score');
let toastT = 0;
function say(msg, dur = 3) {
  elToast.textContent = msg;
  elToast.classList.add('on');
  toastT = dur;
}
function hud() {
  elN.textContent = String(st.count);
  elTotal.textContent = `/${fishes.total}`;
  elBar.style.width = `${(st.count / fishes.total) * 100}%`;
  $('sum').textContent = String(st.total);
}
function toggleMute() {
  const m = !sfx.muted;
  sfx.setMuted(m);
  store.set('muted', m);
  $('btnSnd').classList.toggle('off', m);
  $('btnSnd').setAttribute('aria-pressed', String(!m));
  say(m ? '声音已关闭' : '声音已开启', 1.4);
}
$('btnSnd').classList.toggle('off', sfx.muted);
const help = $('help');
function toggleHelp() { help.hidden = !help.hidden; }
function closeHelp() { help.hidden = true; }

function ringBell() {
  if (st.bellCd > 0) return;
  st.bellCd = 3.2;
  st.magnet = 2.6;
  sfx.bell();
  rider.ring();
  const b = rider.beakWorld(new V3());
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    particles.emit(b.set(0, 1.4, -0.3), new V3(Math.cos(a) * 4.2, 1.2, Math.sin(a) * 4.2), 0.55, 0.07, '#ffe9a0', 1.5);
  }
}

// ---------- 镜头 ----------
const CAMS = ['追随', '迎面', '星球'];
let camFree = null, auto = false, zoomK = 0;
let camMode = 0;
const camPos = new V3(0, 3.4, 8), camLook = new V3(0, 1.3, -2), tPos = new V3(), tLook = new V3();
let camFov = 58;
function nextCam() {
  camMode = (camMode + 1) % CAMS.length;
  say(`镜头：${CAMS[camMode]}`, 1.4);
}
function updateCamera(dt) {
  const portrait = camera.aspect < 0.8;
  let fov;
  const sk = st.steer, v = st.speed;
  if (camMode === 0) {
    tPos.set(-sk * 0.9, portrait ? 2.75 : 2.5, portrait ? 5.9 : 5.6);
    tLook.set(sk * 1.5, 1.35, -3.2);
    fov = (portrait ? 60 : 52) + (calm ? 0 : v * 0.9);
  } else if (camMode === 1) {
    const a = Math.sin(st.time * 0.3);
    tPos.set(1.5 + a * 0.9, 1.45 + a * 0.2, portrait ? -4.6 : -3.9);
    tLook.set(0, 1.15, 0);
    fov = portrait ? 56 : 40;
  } else {
    fov = 38;
    const vf = (fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const d = (R * 1.1) / Math.sin(Math.min(vf, hf) / 2);
    tPos.set(0, 0.42, 1).normalize().multiplyScalar(d).add(planet.position);
    tLook.set(0, -R + 3, 0);
  }
  if (camFree) { tPos.fromArray(camFree, 0); tLook.fromArray(camFree, 3); fov = camFree[6] || 50; }
  const k = 1 - Math.exp(-(camMode === 2 ? 2.2 : 4.5) * dt);
  camPos.lerp(tPos, k);
  camLook.lerp(tLook, k);
  camFov = lerp(camFov, fov, k);
  camera.position.copy(camPos);
  if (st.bump > 0 && !calm) {
    camera.position.x += (Math.random() - 0.5) * st.bump * 0.25;
    camera.position.y += (Math.random() - 0.5) * st.bump * 0.25;
  }
  camera.lookAt(camLook);
  if (Math.abs(camera.fov - camFov) > 0.01) {
    camera.fov = camFov;
    camera.updateProjectionMatrix();
  }
  const cd = camera.position.length();
  scene.fog.near = Math.max(30, cd + 8);
  scene.fog.far = scene.fog.near + 130;
  sky.position.copy(camera.position);
  starG.position.copy(camera.position);
}

// ---------- 昼夜 ----------
const COL = {
  dayTop: new THREE.Color('#2a86e6'), dayHor: new THREE.Color('#c4e8ff'),
  duskTop: new THREE.Color('#3d3f92'), duskHor: new THREE.Color('#ff9d62'),
  nightTop: new THREE.Color('#050a20'), nightHor: new THREE.Color('#1a2756'),
  sunWarm: new THREE.Color('#ffb070'), sunWhite: new THREE.Color('#fff4e0'), moon: new THREE.Color('#9db8ff'),
  hemiDay: new THREE.Color('#dff1ff'), hemiNight: new THREE.Color('#5b74c4'), hemiDusk: new THREE.Color('#ffc9a8'),
  gDay: new THREE.Color('#8fae6a'), gNight: new THREE.Color('#202b50'),
};
const lightDir = new V3();
function updateEnv(dt) {
  sunL.applyAxisAngle(r0, dt * ((Math.PI * 2) / 360));
  sunW.copy(sunL).applyQuaternion(planet.quaternion);
  const k = sunW.y;
  const day = sstep(-0.12, 0.32, k);
  const night = 1 - sstep(-0.34, -0.02, k);
  const dusk = Math.pow(clamp(1 - Math.abs(k - 0.03) / 0.36, 0, 1), 1.4);
  st.night = night; st.day = day;

  skyU.uTop.value.copy(COL.nightTop).lerp(COL.dayTop, day).lerp(COL.duskTop, dusk * 0.8);
  skyU.uHor.value.copy(COL.nightHor).lerp(COL.dayHor, day).lerp(COL.duskHor, dusk * 0.9);
  skyU.uSunDir.value.copy(sunW);
  skyU.uSunCol.value.copy(COL.sunWarm).lerp(COL.sunWhite, sstep(0.05, 0.5, k));
  skyU.uGlow.value = 0.5 + dusk;
  scene.fog.color.copy(skyU.uHor.value);

  hemi.color.copy(COL.hemiNight).lerp(COL.hemiDay, day).lerp(COL.hemiDusk, dusk * 0.5);
  hemi.groundColor.copy(COL.gNight).lerp(COL.gDay, day);
  hemi.intensity = lerp(1.0, 1.15, day) + dusk * 0.3;

  if (k > -0.03) {
    lightDir.copy(sunW);
    sun.color.copy(COL.sunWarm).lerp(COL.sunWhite, sstep(0.02, 0.45, k));
    sun.intensity = 3.1 * sstep(-0.05, 0.2, k);
  } else {
    lightDir.copy(sunW).negate();
    sun.color.copy(COL.moon);
    sun.intensity = 1.6 * sstep(0.03, 0.3, -k);
  }
  lightDir.y = Math.max(lightDir.y, 0.24);
  lightDir.normalize();
  sun.position.copy(lightDir).multiplyScalar(46).add(sun.target.position);

  starMats[0].opacity = night * 0.9;
  starMats[1].opacity = night;
  starG.quaternion.copy(planet.quaternion);
  moon.position.copy(sunW).multiplyScalar(-640).add(camera.position);
  world.setLight(night, day);
  rider.setNight(night);

  const rising = k > prevK;
  prevK = k;
  const name = k > 0.6 ? '正午' : k > 0.14 ? '白昼' : k > -0.14 ? (rising ? '拂晓' : '黄昏') : '夜晚';
  if (elPhase.textContent !== name) elPhase.textContent = name;
  if (night > 0.7 && !st.hint.night) { st.hint.night = true; say('骑到星球背面就是夜晚，车灯已亮'); }
}

// ---------- 抓鱼 ----------
const flyers = [];
{
  const g = fishes.geo;
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(g, fishes.mat);
    m.visible = false;
    scene.add(m);
    flyers.push({ m, t: 1, from: new V3() });
  }
}
const beak = new V3(), tmp = new V3(), tmp2 = new V3();
fishes.onCatch = (pos, kind) => {
  st.combo = st.comboT > 0 ? st.combo + 1 : 0;
  st.comboT = 2.6;
  st.count++;
  st.total++;
  store.set('total', st.total);
  sfx.pickup(st.combo + (kind ? 4 : 0));
  rider.gulp();
  rider.setLoad(Math.min(6, st.count), st.count / fishes.total);
  const f = flyers.find((x) => x.t >= 1) || flyers[0];
  f.from.copy(pos); f.t = 0; f.m.visible = true;
  for (let i = 0; i < 9; i++) {
    tmp.set((Math.random() - 0.5) * 5, 1 + Math.random() * 3.5, (Math.random() - 0.5) * 5);
    particles.emit(pos, tmp, 0.5 + Math.random() * 0.3, 0.07, kind ? '#ffb3da' : '#ffe27a', 6);
  }
  elScore.classList.remove('pop');
  void elScore.offsetWidth;
  elScore.classList.add('pop');
  hud();
  if (st.combo >= 2) say(`连叼 ×${st.combo + 1}`, 1.2);
  else if (!st.hint.bell && st.count >= 2) { st.hint.bell = true; say(coarse ? '点「铃」能把附近的鱼吸过来' : '按 E 摇铃，把附近的鱼吸过来', 3.6); }
  if (fishes.left === 0) {
    st.respawn = 2.2;
    sfx.fanfare();
    say(`第 ${st.round} 圈满载而归！`, 3);
    const cols = ['#ff6f59', '#ffd23f', '#6fd3ff', '#b79bff', '#7be08a'];
    for (let b = 0; b < 4; b++) {
      const c = new V3((Math.random() - 0.5) * 9, 4.5 + Math.random() * 3, -5 - Math.random() * 5);
      for (let i = 0; i < 26; i++) {
        tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 3);
        particles.emit(c, tmp, 0.9 + Math.random() * 0.6, 0.11, cols[(b + i) % cols.length], 3);
      }
    }
  }
};

// ---------- 主循环 ----------
function step(dt) {
  st.time += dt;
  const kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  let steerT = clamp(kx + touch.x, -1, 1);
  const brake = keys.has('down') || touch.brake;
  let pedal = (keys.has('up') || touch.pedal) && !brake;
  if (auto) {
    // 调试用：沿环路自动巡航
    const probe = (sx) => roadDist(tmp.set((sx * 1.2) / R, 1, -4 / R).normalize().applyQuaternion(qInv));
    steerT = clamp((probe(-1) - probe(1)) * 45, -1, 1);
    pedal = true;
  }

  // 速度
  const wet = st.wet > 0.5;
  const maxV = wet ? 5 : 8.4;
  if (pedal && st.grounded) st.speed += 6 * (1 - st.speed / maxV) * dt;
  else if (st.grounded) st.speed -= (0.7 + 0.13 * st.speed + (wet ? 2 : 0)) * dt;
  if (st.speed > maxV + 0.1 && st.grounded) st.speed -= 6 * dt;
  if (brake && st.grounded) st.speed -= 13 * dt;
  st.speed = Math.max(0, st.speed);

  // 转向：转的是星球，不是鹈鹕
  st.steer = damp(st.steer, steerT, 7, dt);
  const yawRate = st.steer * lerp(1.9, 1.25, st.speed / 8.4) * sstep(0, 1.3, st.speed) * (st.grounded ? 1 : 0.6);
  planet.quaternion.premultiply(qTmp.setFromAxisAngle(XA, (st.speed * dt) / R));
  planet.quaternion.premultiply(qTmp.setFromAxisAngle(YA, yawRate * dt));
  planet.quaternion.normalize();
  st.dist += st.speed * dt;
  st.yawVis = damp(st.yawVis, st.steer * 0.3 * sstep(0.4, 4, st.speed), 5, dt);
  const lean = st.steer * 0.36 * sstep(0.6, 6.5, st.speed);

  // 障碍：把星球往反方向推回去
  if (st.bump > 0) st.bump = Math.max(0, st.bump - dt * 3);
  for (const o of obstacles) {
    tmp.copy(o.dir).applyQuaternion(planet.quaternion);
    if (tmp.y < 0.985 || st.y > o.h) continue;
    const dx = tmp.x * R, dz = tmp.z * R, d = Math.hypot(dx, dz), rad = o.r + 0.5;
    if (d < rad && d > 1e-4) {
      const push = (rad - d) / R;
      planet.quaternion.premultiply(qTmp.setFromAxisAngle(tmp2.set(dz / d, 0, -dx / d), push));
      if (st.speed > 2.2 && dz < 0) {
        st.speed *= 0.3;
        st.bump = 1;
        sfx.bonk();
        for (let i = 0; i < 6; i++) {
          particles.emit(tmp2.set(0, 1.2, 0), new V3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, 1 + Math.random() * 2), 0.9, 0.06, '#ffffff', 5, 0.4 + 0.6 * st.day);
        }
      }
    }
  }

  qInv.copy(planet.quaternion).invert();
  particles.qInv.copy(qInv);
  pLocal.set(0, 1, 0).applyQuaternion(qInv);
  const depth = depthAt(pLocal);
  const onRoad = roadDist(pLocal) * R < 1.3;

  // 跳跃、扑翼、滑翔
  if (jumpPressed) {
    jumpPressed = false;
    if (st.grounded) {
      st.grounded = false; st.vy = 7.6; st.flaps = 1;
      sfx.jump(); rider.hop();
    } else if (st.flaps > 0) {
      st.flaps--; st.vy = 6.2;
      sfx.flap(); rider.hop();
    }
  }
  let glide = 0;
  if (!st.grounded) {
    // 按住时展翅：下落阶段重力变小，并把下沉速度收敛到缓降
    const gliding = jumpHeld && st.vy < 0;
    st.vy -= (gliding ? 4 : 21) * dt;
    if (gliding && st.vy < -1.1) st.vy = damp(st.vy, -1.1, 12, dt);
    st.y += st.vy * dt;
    glide = jumpHeld || st.vy > 1.5 ? 1 : 0;
    if (st.y <= 0) {
      rider.land(-st.vy);
      if (depth > 0.1) { sfx.splash(); burstSplash(14); } else { sfx.land(); burstDust(7, onRoad); }
      st.y = 0; st.vy = 0; st.grounded = true;
    }
  }
  st.wet = damp(st.wet, depth > 0.06 && st.y < 0.3 ? 1 : 0, 9, dt);
  st.sink = damp(st.sink, st.y < 0.3 ? Math.min(depth, 0.42) : 0, 7, dt);
  if (st.wet > 0.5 && !st.wasWet && st.speed > 1.5) { sfx.splash(); burstSplash(10); }
  st.wasWet = st.wet > 0.5;

  // 路上扬尘、水里溅水、滑行时棘轮声
  if (st.grounded && st.speed > 1.2) {
    if (st.wet > 0.5) {
      st.splashT -= dt * st.speed;
      if (st.splashT < 0) {
        st.splashT = 0.7;
        for (const sx of [-1, 1]) {
          particles.emit(tmp.set(sx * 0.2, 0.05, 0.3), tmp2.set(sx * (1 + Math.random()), 2 + Math.random() * 1.6, 0.6 + Math.random()), 0.6, 0.07, '#e4f8ff', 11, 0.45 + 0.55 * st.day);
        }
        if (Math.random() < 0.25) sfx.noise(0.14, 0.03, 1400, 700, 0.6);
      }
    } else if (st.speed > 3) {
      st.dustT -= dt * st.speed;
      if (st.dustT < 0) {
        st.dustT = 1.1;
        particles.emit(tmp.set((Math.random() - 0.5) * 0.15, 0.06, 0.6), tmp2.set((Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 0.7, 0.8), 0.5, 0.055, onRoad ? '#e9d3a6' : '#8fcf6a', 4, 0.4 + 0.6 * st.day);
      }
    }
    if (!pedal) {
      st.tick += st.speed * dt * 2.6;
      if (st.tick > 1) { st.tick = 0; sfx.tick(); }
    }
  }
  sfx.setWind(clamp(st.speed / 8.4, 0, 1) * (st.grounded ? 1 : 1.3));

  // 鱼
  if (st.magnet > 0) st.magnet -= dt;
  if (st.bellCd > 0) {
    st.bellCd = Math.max(0, st.bellCd - dt);
    btnBell.style.setProperty('--cd', String(st.bellCd / 3.2));
  }
  if (st.comboT > 0) st.comboT -= dt;
  fishes.update(dt, st.time, planet.quaternion, pLocal, st.y - st.sink, st.magnet > 0);
  if (st.respawn > 0) {
    st.respawn -= dt;
    if (st.respawn <= 0) {
      st.round++; st.count = 0;
      fishes.spawn(st.round);
      rider.setLoad(0, 0);
      hud();
      say(`第 ${st.round} 圈：鱼群已就位`, 2.6);
    }
  }
  if (fishes.airNear && !st.hint.air && st.dist > 14 && toastT <= 0) {
    st.hint.air = true;
    say(coarse ? '高处的粉鱼：跳起后再点一次扑翼' : '高处的粉鱼：空格跳起，空中再按一次扑翼', 4);
  }

  // 骑手
  rider.group.position.set(0, st.y - st.sink, 0);
  rider.group.rotation.y = Math.PI - st.yawVis;
  // 星球视角下把骑手放大，远看也能认出来
  zoomK = damp(zoomK, camMode === 2 ? 1 : 0, 2.5, dt);
  rider.group.scale.setScalar(1 + zoomK * 1.9);
  let look = null;
  if (fishes.hasNearest) {
    look = tmp.copy(fishes.nearest);
    rider.group.worldToLocal(look);
    if (look.z < -0.5) look = null;
  }
  rider.update(dt, { speed: st.speed, steer: st.steer, lean, pedal, air: !st.grounded, vy: st.vy, glide, look });

  // 飞向喙的鱼
  rider.beakWorld(beak);
  for (const f of flyers) {
    if (f.t >= 1) continue;
    f.t = Math.min(1, f.t + dt / 0.26);
    const e = f.t * f.t * (3 - 2 * f.t);
    f.m.position.lerpVectors(f.from, beak, e);
    f.m.position.y += Math.sin(f.t * Math.PI) * 0.35;
    f.m.scale.setScalar(lerp(1.15, 0.3, e));
    f.m.rotation.y += dt * 14;
    if (f.t >= 1) f.m.visible = false;
  }

  world.update(dt, st.time);
  updateCamera(dt);
  updateEnv(dt);

  if (toastT > 0) {
    toastT -= dt;
    if (toastT <= 0) elToast.classList.remove('on');
  }
  if (!st.hint.move && st.dist > 5) { st.hint.move = true; toastT = Math.min(toastT, 0.01); }
}

function burstDust(n, road) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28;
    particles.emit(tmp.set(0, 0.08, (Math.random() - 0.5) * 0.9), tmp2.set(Math.cos(a) * 1.8, 0.8 + Math.random(), Math.sin(a) * 1.8), 0.5, 0.06, road ? '#e9d3a6' : '#8fcf6a', 4, 0.4 + 0.6 * st.day);
  }
}
function burstSplash(n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28;
    particles.emit(tmp.set(0, 0, 0), tmp2.set(Math.cos(a) * 2.2, 2.5 + Math.random() * 2.5, Math.sin(a) * 2.2), 0.7, 0.08, '#e4f8ff', 12, 0.45 + 0.55 * st.day);
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

hud();
say(coarse ? '按住屏幕踩踏板，左右拖动转向' : 'W 踩踏板 · A / D 转向 · 空格跳跃', 60);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (document.hidden || dt <= 0) return;
  step(dt);
  renderer.render(scene, camera);
}
// 首帧同步渲染：镜头先对好，画布一出现就有画面
updateCamera(10);
step(1 / 60);
renderer.render(scene, camera);
requestAnimationFrame(frame);
document.documentElement.classList.add('ready');

if (new URLSearchParams(location.search).has('debug')) {
  window.__lab = { st, keys, rider, world, camera, sunL, step, setCam: (m) => { camMode = m; }, free: (a) => { camFree = a; }, auto: (v) => { auto = v; }, tp: (lon, off) => { const p = roadDir(lon, off), h = roadTangent(lon); h.addScaledVector(p, -h.dot(p)).normalize(); const r = new V3().crossVectors(h, p); planet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, p, h.clone().negate())).invert(); return depthAt(p); }, fishes, t0: performance.now(), sunAt: (ang) => { sunL.copy(pLocal).applyAxisAngle(r0, ang).normalize(); } };
}
