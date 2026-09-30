import * as THREE from './vendor/three.module.min.js';

const canvas = document.querySelector('#scene');
const ui = {
  fish: document.querySelector('#fishCount'), distance: document.querySelector('#distance'),
  combo: document.querySelector('#combo'), energy: document.querySelector('#energyFill'),
  status: document.querySelector('#statusBanner'), pause: document.querySelector('#pauseCard'),
  pauseButton: document.querySelector('#pauseButton'), soundButton: document.querySelector('#soundButton'),
  left: document.querySelector('#leftButton'), right: document.querySelector('#rightButton'),
  jump: document.querySelector('#jumpButton'), boost: document.querySelector('#boostButton'),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd6e9dc, .026);
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const hemisphere = new THREE.HemisphereLight(0xe7f7ff, 0x719c8e, 2.45); scene.add(hemisphere);
const sunlight = new THREE.DirectionalLight(0xffe6ac, 3.4);
sunlight.position.set(-7, 12, -9); sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024);
sunlight.shadow.camera.left = -9; sunlight.shadow.camera.right = 9;
sunlight.shadow.camera.top = 11; sunlight.shadow.camera.bottom = -11;
sunlight.shadow.camera.near = 1; sunlight.shadow.camera.far = 36;
sunlight.shadow.bias = -.0003; scene.add(sunlight);

const material = (hex, roughness = .83, metalness = 0) => new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
const mat = {
  ivory: material(0xfff5d9), white: material(0xfffdf2), feather: material(0xe4e9da),
  featherShadow: material(0xc5d1c8), coral: material(0xef7747), orange: material(0xf7a148),
  pouch: material(0xefac5c), ink: material(0x244c52), pupil: material(0x122e34),
  teal: material(0x218b91, .42, .24), darkTeal: material(0x245c62, .45, .22),
  cream: material(0xffe6b1), tan: material(0xc99b69), sand: material(0xf8d598),
  plank: [material(0xdbab77), material(0xe4b884), material(0xcfa06e)],
  sea: material(0x60b9bb, .35, .06), seaLight: material(0xa5d8ce, .42),
  grass: material(0x7ba991), rock: material(0x95a9a0), red: material(0xe76f50),
  rope: material(0xd6b687), glass: material(0x9fe0df, .15, .28),
};
const sphereGeo = new THREE.SphereGeometry(1, 18, 12);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function mesh(geo, m, parent, x = 0, y = 0, z = 0, shadow = true) {
  const object = new THREE.Mesh(geo, m); object.position.set(x, y, z);
  object.castShadow = shadow; object.receiveShadow = true; parent.add(object); return object;
}
function ball(parent, m, pos, scale) {
  const o = mesh(sphereGeo, m, parent, ...pos); o.scale.set(...scale); return o;
}
function box(parent, m, pos, scale) {
  const o = mesh(boxGeo, m, parent, ...pos); o.scale.set(...scale); return o;
}
const va = new THREE.Vector3(), vb = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function rod(parent, m, a, b, radius, sides = 9) {
  const geo = sides === 10 ? cylinderGeo : new THREE.CylinderGeometry(radius, radius, 1, sides);
  const o = mesh(geo, m, parent); setRod(o, a, b, radius, sides === 10); return o;
}
function setRod(o, a, b, radius, unitGeometry = false) {
  va.set(...a); vb.set(...b); const delta = vb.clone().sub(va);
  o.position.copy(va).add(vb).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(up, delta.clone().normalize());
  o.scale.set(unitGeometry ? radius : 1, delta.length(), unitGeometry ? radius : 1);
}
function curved(parent, m, points, radius) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, 16, radius, 7, false), m, parent);
}

// The rider and bicycle are built as actual meshes, with wheel, pedal and limb pivots animated each frame.
const rider = new THREE.Group(); scene.add(rider);
const bike = new THREE.Group(); rider.add(bike);
function wheel(z) {
  const group = new THREE.Group(); group.position.set(0, .62, z); bike.add(group);
  const tire = mesh(new THREE.TorusGeometry(.57, .075, 9, 36), mat.ink, group); tire.rotation.y = Math.PI / 2;
  const stripe = mesh(new THREE.TorusGeometry(.565, .014, 5, 36), mat.cream, group); stripe.rotation.y = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(.46, .022, 6, 32), mat.teal, group); rim.rotation.y = Math.PI / 2;
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 10;
    rod(group, mat.featherShadow, [0, Math.cos(angle) * .45, Math.sin(angle) * .45], [0, -Math.cos(angle) * .45, -Math.sin(angle) * .45], .012, 6);
  }
  const hub = mesh(new THREE.CylinderGeometry(.11, .11, .27, 12), mat.orange, group); hub.rotation.z = Math.PI / 2;
  return group;
}
const rearWheel = wheel(.89), frontWheel = wheel(-.91);
const R = [0, .62, .89], F = [0, .62, -.91], C = [0, .73, -.07], S = [0, 1.45, .37], H = [0, 1.48, -.68];
[[R, S], [S, C], [C, R], [S, H], [H, C], [H, F]].forEach(([a, b]) => rod(bike, mat.teal, a, b, .065));
rod(bike, mat.darkTeal, [0, 1.37, -.64], [0, 1.55, -.72], .09);
rod(bike, mat.darkTeal, [-.4, 1.56, -.73], [.4, 1.56, -.73], .042);
ball(bike, mat.ink, [0, 1.49, .41], [.32, .07, .21]);
rod(bike, mat.darkTeal, [0, 1.26, .38], [0, 1.5, .38], .04);
const crank = ball(bike, mat.orange, [0, .73, -.07], [.14, .14, .14]);
ball(bike, mat.cream, [.18, .73, -.07], [.045, .1, .1]);
const basket = new THREE.Group(); basket.position.set(0, 1.47, -1.11); bike.add(basket);
box(basket, mat.tan, [0, -.12, -.12], [.68, .31, .5]);
for (let i = 0; i < 5; i++) rod(basket, mat.cream, [-.3 + i * .15, -.25, -.35], [-.3 + i * .15, -.25, .1], .012, 6);
for (let i = 0; i < 3; i++) rod(basket, mat.cream, [-.35, -.26 + i * .1, -.36], [.35, -.26 + i * .1, -.36], .013, 6);
rod(bike, mat.darkTeal, [0, 1.49, -.73], [0, 1.53, -1.04], .025);
const bell = ball(bike, mat.orange, [-.32, 1.61, -.75], [.1, .075, .1]);
ball(bell, mat.white, [0, .08, 0], [.23, .1, .23]);

const bird = new THREE.Group(); rider.add(bird);
const body = ball(bird, mat.white, [0, 1.93, .27], [.47, .61, .65]); body.rotation.x = -.18;
ball(bird, mat.feather, [0, 1.67, .71], [.36, .29, .28]);
curved(bird, mat.white, [[0, 2.05, -.1], [0, 2.44, -.25], [0, 2.68, -.43], [0, 2.77, -.63]], .21);
const head = ball(bird, mat.white, [0, 2.78, -.66], [.33, .34, .36]);
ball(bird, mat.white, [0, 2.92, -.61], [.31, .25, .29]);
// A long bill and a curved lower pouch make the bird readable even on small screens.
const beak = mesh(new THREE.CylinderGeometry(.15, .035, .94, 10), mat.orange, bird, 0, 2.69, -1.19); beak.rotation.x = Math.PI / 2;
const beakTip = ball(bird, mat.orange, [0, 2.67, -1.68], [.045, .055, .08]);
const pouch = ball(bird, mat.pouch, [0, 2.53, -1.18], [.19, .17, .48]); pouch.rotation.x = -.09;
curved(bird, mat.coral, [[0, 2.66, -.78], [0, 2.51, -1.11], [0, 2.49, -1.48]], .022);
for (const side of [-1, 1]) {
  ball(bird, mat.ivory, [side * .293, 2.82, -.76], [.072, .083, .068]);
  ball(bird, mat.pupil, [side * .348, 2.82, -.79], [.033, .047, .035]);
  ball(bird, mat.white, [side * .375, 2.837, -.801], [.012, .014, .012]);
  ball(bird, mat.orange, [side * .105, 2.96, -.92], [.018, .025, .018]);
}
const wings = [];
for (const side of [-1, 1]) {
  const wing = new THREE.Group(); wing.position.set(side * .39, 2.12, .18); bird.add(wing); wings.push({ wing, side });
  const shell = ball(wing, mat.feather, [side * .1, -.1, .15], [.18, .29, .38]); shell.rotation.x = -.28;
  for (let i = 0; i < 4; i++) {
    const feather = ball(wing, i % 2 ? mat.featherShadow : mat.feather, [side * .11, -.24 - i * .025, .22 + i * .11], [.11, .17, .19]);
    feather.rotation.x = -.35;
  }
}
const tail = [];
for (let i = -1; i <= 1; i++) { const f = ball(bird, mat.feather, [i * .13, 1.83, .85], [.11, .12, .32]); f.rotation.x = -.3; tail.push(f); }
const scarf = new THREE.Group(); scarf.position.set(0, 2.37, -.25); bird.add(scarf);
const scarfWrap = mesh(new THREE.TorusGeometry(.22, .07, 7, 20), mat.coral, scarf); scarfWrap.rotation.x = Math.PI / 2;
const scarfTail = ball(scarf, mat.coral, [.17, -.12, .29], [.09, .08, .3]); scarfTail.rotation.x = -.32;
const legs = [];
for (const side of [-1, 1]) {
  const upper = rod(rider, mat.orange, [side * .23, 1.65, .34], [side * .24, 1.09, .3], .065);
  const lower = rod(rider, mat.orange, [side * .24, 1.09, .3], [side * .23, .75, -.04], .049);
  const foot = ball(rider, mat.orange, [side * .23, .69, -.04], [.12, .07, .19]);
  legs.push({ side, upper, lower, foot });
}

// Endless boardwalk and coast details scroll toward the camera.
const water = mesh(new THREE.PlaneGeometry(160, 160), mat.sea, scene, 0, -.36, -15, false);
water.rotation.x = -Math.PI / 2; water.receiveShadow = true;
const pathBase = box(scene, mat.sand, [0, -.25, -12], [4.85, .15, 100]); pathBase.castShadow = false;
const segments = [];
for (let s = 0; s < 12; s++) {
  const group = new THREE.Group(); group.position.z = -34 + s * 4; scene.add(group); segments.push(group);
  for (let i = 0; i < 6; i++) {
    const z = -1.65 + i * .66;
    box(group, mat.plank[(i + s) % 3], [0, -.11, z], [4.55, .16, .61]);
    for (const side of [-1, 1]) {
      const peg = box(group, mat.ink, [side * 2.17, -.025, z], [.05, .015, .12]); peg.castShadow = false;
    }
  }
  for (const side of [-1, 1]) {
    rod(group, mat.tan, [side * 2.34, -.16, -1.95], [side * 2.34, -.16, 1.95], .08);
    for (const z of [-1.65, .99]) {
      const post = rod(group, mat.tan, [side * 2.35, -.2, z], [side * 2.35, .82, z], .08);
      ball(group, mat.cream, [side * 2.35, .86, z], [.11, .1, .11]);
      const rope = rod(group, mat.rope, [side * 2.35, .47, z], [side * 2.35, .47, z + 2.64], .028, 7);
      rope.castShadow = false;
    }
  }
  for (const side of [-1, 1]) {
    const x = side * (3.6 + ((s * 13) % 5) * .31), z = ((s * 17) % 3) - 1;
    ball(group, s % 3 ? mat.rock : mat.sand, [x, -.16, z], [.7 + (s % 3) * .15, .25, .62]);
    if (s % 2 === 0) {
      for (let i = 0; i < 3; i++) {
        const blade = mesh(new THREE.ConeGeometry(.1, .42 + i * .08, 5), mat.grass, group, x + i * .14 - .1, .17, z + .15);
        blade.rotation.z = (i - 1) * .24;
      }
    }
    if (s % 3 === 0) {
      const foam = mesh(new THREE.TorusGeometry(.35, .025, 4, 20), mat.seaLight, group, x + side * .92, -.16, z - .3, false);
      foam.rotation.x = Math.PI / 2;
    }
  }
}
const sun = ball(scene, new THREE.MeshBasicMaterial({ color: 0xffedbd, fog: false }), [-10, 10, -49], [3.25, 3.25, 3.25]); sun.castShadow = false;
const clouds = [];
for (let i = 0; i < 7; i++) {
  const group = new THREE.Group(); group.position.set((i - 3) * 6, 6 + i % 3, -27 - i * 4); scene.add(group);
  for (let j = 0; j < 3; j++) ball(group, mat.white, [(j - 1) * .8, (j % 2) * .18, 0], [.85, .33 + (j % 2) * .15, .43]);
  clouds.push(group);
}
const gulls = [];
for (let i = 0; i < 4; i++) {
  const group = new THREE.Group(); group.position.set(-5 + i * 3.5, 4.9 + i * .57, -13 - i * 5); scene.add(group);
  rod(group, mat.ink, [-.28, .1, 0], [0, 0, 0], .018, 5);
  rod(group, mat.ink, [0, 0, 0], [.28, .1, 0], .018, 5);
  gulls.push(group);
}

const objects = [];
function makeFish() {
  const group = new THREE.Group();
  ball(group, mat.orange, [0, 0, 0], [.2, .15, .33]);
  const tailFin = mesh(new THREE.ConeGeometry(.19, .27, 3), mat.coral, group, 0, 0, .36); tailFin.rotation.x = Math.PI / 2;
  ball(group, mat.white, [.17, .045, -.2], [.035, .035, .035]);
  ball(group, mat.pupil, [.197, .045, -.205], [.016, .016, .016]);
  ball(group, mat.cream, [0, .13, -.08], [.045, .025, .17]);
  return group;
}
function makeBuoy() {
  const group = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(.34, .42, .13, 12), mat.ink, group, 0, .12, 0);
  const shell = mesh(new THREE.CylinderGeometry(.22, .3, .67, 12), mat.red, group, 0, .49, 0);
  mesh(new THREE.CylinderGeometry(.235, .25, .18, 12), mat.white, group, 0, .55, 0);
  const cap = mesh(new THREE.ConeGeometry(.21, .28, 12), mat.red, group, 0, .96, 0);
  const loop = mesh(new THREE.TorusGeometry(.09, .035, 5, 14), mat.ink, group, 0, 1.12, 0); loop.rotation.x = Math.PI / 2;
  return group;
}
function spawn(type, lane, z = -27) {
  const group = type === 'fish' ? makeFish() : makeBuoy();
  group.position.set(lane * 1.37, type === 'fish' ? 1.24 : -.04, z);
  scene.add(group); objects.push({ group, type, lane, hit: false, phase: Math.random() * Math.PI * 2 });
}

const state = { time: 0, x: 0, targetX: 0, y: 0, vy: 0, fish: 0, distance: 0, combo: 0, energy: 1, paused: false, mute: true, boost: false, keys: new Set(), spawnTime: .9, speed: 5.6, last: 0 };
let audioContext;
function sound(frequency, duration = .11, type = 'sine', volume = .035) {
  if (state.mute) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, audioContext.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is an optional enhancement. */ }
}
let messageTimer;
function announce(message, delay = 2200) {
  ui.status.textContent = message; ui.status.classList.add('visible');
  clearTimeout(messageTimer); messageTimer = setTimeout(() => ui.status.classList.remove('visible'), delay);
}
function jump() {
  if (state.paused || state.y > .01) return;
  state.vy = 5.1; sound(360, .13, 'triangle', .04); ui.jump.classList.add('pressed');
  setTimeout(() => ui.jump.classList.remove('pressed'), 150);
}
function pause(force) {
  state.paused = typeof force === 'boolean' ? force : !state.paused;
  ui.pause.hidden = !state.paused; ui.pauseButton.textContent = state.paused ? '▶' : 'Ⅱ';
  ui.pauseButton.setAttribute('aria-label', state.paused ? '继续' : '暂停');
  state.last = performance.now();
}
function pickup() {
  state.fish++; state.combo++; state.energy = Math.min(1, state.energy + .1);
  ui.fish.textContent = String(state.fish).padStart(2, '0');
  if (state.combo >= 2) { ui.combo.textContent = `${state.combo} 连续收集 ✦`; ui.combo.classList.add('visible'); }
  announce(state.combo > 2 ? '海上快递，越骑越顺！' : '好鱼！继续向前');
  sound(520 + Math.min(state.combo, 8) * 45, .14, 'sine', .045);
}
function crash() {
  state.combo = 0; ui.combo.classList.remove('visible'); state.energy = Math.max(0, state.energy - .25);
  state.speed = 3.2; announce('哎呀，跃过红色浮标！'); sound(190, .24, 'sawtooth', .025);
  rider.rotation.z = -.12;
}
function setHeld(button, key) {
  const down = event => { event.preventDefault(); state.keys.add(key); button.classList.add('pressed'); button.setPointerCapture?.(event.pointerId); };
  const up = event => { event.preventDefault(); state.keys.delete(key); button.classList.remove('pressed'); };
  button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up);
}
setHeld(ui.left, 'left'); setHeld(ui.right, 'right'); setHeld(ui.boost, 'boost');
ui.jump.addEventListener('pointerdown', event => { event.preventDefault(); jump(); });
ui.pauseButton.addEventListener('click', () => pause());
document.querySelector('#resumeButton').addEventListener('click', () => pause(false));
ui.soundButton.addEventListener('click', () => {
  state.mute = !state.mute; ui.soundButton.textContent = state.mute ? '♪' : '♫';
  ui.soundButton.setAttribute('aria-label', state.mute ? '开启声音' : '关闭声音');
  if (!state.mute) sound(640, .13);
});
const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'boost', KeyW: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost' };
window.addEventListener('keydown', event => {
  if (keyMap[event.code]) { event.preventDefault(); state.keys.add(keyMap[event.code]); }
  if ((event.code === 'Space' || event.code === 'KeyJ') && !event.repeat) { event.preventDefault(); jump(); }
  if (event.code === 'KeyP' && !event.repeat) pause();
  if (event.code === 'KeyM' && !event.repeat) ui.soundButton.click();
});
window.addEventListener('keyup', event => { if (keyMap[event.code]) { event.preventDefault(); state.keys.delete(keyMap[event.code]); } });
window.addEventListener('blur', () => { state.keys.clear(); if (!state.paused) pause(true); });
let drag;
canvas.addEventListener('pointerdown', event => { drag = { id: event.pointerId, x: event.clientX, start: state.targetX }; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  state.targetX = THREE.MathUtils.clamp(drag.start + (event.clientX - drag.x) / 65, -1.38, 1.38);
});
canvas.addEventListener('pointerup', event => { if (drag?.id === event.pointerId) { if (Math.abs(event.clientX - drag.x) < 14) jump(); drag = null; } });
canvas.addEventListener('pointercancel', () => { drag = null; });

function resize() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const view = aspect < .65 ? 8.6 : aspect < 1.1 ? 8.2 : 8.1;
  camera.left = -view * aspect / 2; camera.right = view * aspect / 2;
  camera.top = view / 2; camera.bottom = -view / 2; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
camera.position.set(7.2, 4.8, 5.5);
camera.lookAt(0, 1.08, -.7);
for (const [lane, z] of [[0, -9], [-1, -15], [1, -22]]) spawn('fish', lane, z);
announce('左右滑动转向，轻点跳跃！', 3600);

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (state.last || now)) / 1000, .045); state.last = now;
  if (state.paused) { renderer.render(scene, camera); return; }
  state.time += dt;
  const left = state.keys.has('left'), right = state.keys.has('right');
  if (left !== right) state.targetX = THREE.MathUtils.clamp(state.targetX + (right ? 1 : -1) * dt * 2.5, -1.38, 1.38);
  state.x = THREE.MathUtils.damp(state.x, state.targetX, 8, dt);
  state.boost = state.keys.has('boost') && state.energy > .015;
  state.energy = THREE.MathUtils.clamp(state.energy + (state.boost ? -.19 : .075) * dt, 0, 1);
  const wantedSpeed = state.boost ? 10.2 : 5.6;
  state.speed = THREE.MathUtils.damp(state.speed, wantedSpeed, 2.7, dt);
  const travel = state.speed * dt;
  state.distance += travel * 2.3;
  ui.distance.textContent = String(Math.floor(state.distance)).padStart(3, '0');
  ui.energy.style.width = `${Math.round(state.energy * 100)}%`;

  state.vy -= 14 * dt; state.y = Math.max(0, state.y + state.vy * dt);
  if (state.y === 0) state.vy = 0;
  rider.position.set(state.x, state.y + Math.sin(state.time * state.speed * 1.5) * (reducedMotion ? .008 : .025), 0);
  rider.rotation.z = THREE.MathUtils.damp(rider.rotation.z, -(state.targetX - state.x) * .17, 5, dt);
  bird.rotation.x = Math.sin(state.time * state.speed * 1.25) * (reducedMotion ? .004 : .016);
  head.rotation.z = Math.sin(state.time * 2) * .024;
  for (const { wing, side } of wings) wing.rotation.z = side * (state.y > .12 ? .18 : .035 + Math.sin(state.time * 3) * .03);
  scarfTail.rotation.x = -.32 + Math.sin(state.time * 5) * .12 - (state.boost ? .25 : 0);
  tail.forEach((f, i) => { f.rotation.z = Math.sin(state.time * 3 + i) * .045; });
  const pedalAngle = state.time * state.speed * 1.6;
  rearWheel.rotation.x -= travel / .57; frontWheel.rotation.x -= travel / .57;
  crank.rotation.x = pedalAngle;
  for (const leg of legs) {
    const phase = pedalAngle + (leg.side === 1 ? 0 : Math.PI);
    const hip = [leg.side * .23, 1.62, .32], pedal = [leg.side * .25, .76 + Math.sin(phase) * .19, -.07 + Math.cos(phase) * .22];
    const knee = [leg.side * .25, 1.13 + Math.sin(phase) * .1, .02 + Math.cos(phase) * .2];
    setRod(leg.upper, hip, knee, .065); setRod(leg.lower, knee, pedal, .049);
    leg.foot.position.set(pedal[0], pedal[1] - .055, pedal[2] - .06);
    leg.foot.rotation.x = Math.sin(phase) * .14;
  }
  for (const segment of segments) { segment.position.z += travel; if (segment.position.z > 12) segment.position.z -= 48; }
  for (const cloud of clouds) { cloud.position.z += travel * .09; if (cloud.position.z > 5) cloud.position.z -= 48; }
  for (const [i, gull] of gulls.entries()) { gull.position.x += Math.sin(state.time * .45 + i) * dt * .25; gull.position.z += travel * .2; if (gull.position.z > 9) gull.position.z -= 39; }
  state.spawnTime -= dt;
  if (state.spawnTime <= 0) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const hazard = Math.random() < .24 && state.distance > 20;
    spawn(hazard ? 'buoy' : 'fish', lane);
    if (hazard && Math.random() < .65) spawn('fish', lane === 1 ? -1 : lane + 1, -30);
    state.spawnTime = (hazard ? 2 : 1.45) + Math.random() * .48;
  }
  for (let i = objects.length - 1; i >= 0; i--) {
    const item = objects[i]; item.group.position.z += travel;
    if (item.type === 'fish') { item.group.position.y = 1.28 + Math.sin(state.time * 3 + item.phase) * .14; item.group.rotation.y += dt * 1.9; }
    if (!item.hit && item.group.position.z >= -.38 && item.group.position.z < .38) {
      item.hit = true;
      if (Math.abs(state.x - item.lane * 1.37) < .72) {
        if (item.type === 'fish' && state.y < 1.4) { pickup(); scene.remove(item.group); objects.splice(i, 1); continue; }
        if (item.type === 'buoy' && state.y < .52) crash();
      }
    }
    if (item.group.position.z > 7) { scene.remove(item.group); objects.splice(i, 1); }
  }
  const focus = new THREE.Vector3(state.x * .3, 1.08, -.7);
  camera.position.lerp(new THREE.Vector3(7.2 + state.x * .18, 4.8 + state.y * .12, 5.5), 1 - Math.exp(-2 * dt));
  camera.lookAt(focus);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
