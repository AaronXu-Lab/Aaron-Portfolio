import { T, TAU, vec } from './geometry.js';
import { makeIsland, stops } from './island.js';
import { makeRider } from './rider.js';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const getSpeed = (paused, pedaling) => paused ? 0 : pedaling ? 6.1 : 2.1;

function start() {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2('#b0d9be', .0058);
  const camera = new T.PerspectiveCamera(41, 1, .09, 400);

  scene.add(new T.HemisphereLight('#fff1d0', '#87936d', 2.25));
  const sun = new T.DirectionalLight('#fff2d5', 2.30);
  sun.position.set(-18, 24, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.camera.far = 62;
  sun.shadow.normalBias = .038;
  sun.shadow.bias = -.00025;
  scene.add(sun);
  const bounce = new T.DirectionalLight('#82baba', .48);
  bounce.position.set(6, 4, -5);
  scene.add(bounce);

  const island = makeIsland(scene);
  const rider = makeRider(scene);
  const width = () => canvas.clientWidth;
  const height = () => canvas.clientHeight;
  let reduced = reducedMotion.matches;
  let paused = reduced;
  const brakeIcon = $('brake-icon').querySelector('path');
  let speed = paused ? 0 : getSpeed(false, false);
  let distance = 0;
  let time = 0;
  let ringTime = -10;
  let timeBefore = 0;
  let raf = 0;
  let yaw = 0;
  let tilt = 0;
  let overview = false;
  let displayedSpeed = -1;
  let delivered = new Set();
  let lap = 0;
  let audio;
  let noticeTimer;
  let drag;

  const pedalKeys = new Set();
  let pedalPointer = null;
  let pedalButtonKey = null;
  const cameraPosition = vec(0, 0, 0);
  const cameraGoal = vec(0, 0, 0);
  const target = vec(0, 0, 0);
  const targetGoal = vec(0, 0, 0);
  const direction = vec(1, 0, 0);
  const laterDirection = vec(1, 0, 0);
  const point = vec(0, 0, 0);
  const orbit = new T.Vector3();
  const controls = [...document.querySelectorAll('button')];

  function resize() {
    if (!width() || !height()) return;
    camera.aspect = width() / height();
    const lens = 41 + Math.max(0, .63 - camera.aspect) * 28;
    camera.fov = lens;
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height(), false);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function show(message) {
    const notice = $('notice');
    notice.textContent = message;
    notice.dataset.visible = '';
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      delete notice.dataset.visible;
      notice.textContent = '';
    }, 2100);
  }

  function playNotes(notes) {
    if (!audio || audio.state !== 'running') return;
    const startTime = audio.currentTime;
    for (const [offset, pitch, volume, length] of notes) {
      const start = startTime + offset;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = pitch;
      gain.gain.setValueAtTime(.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .013);
      gain.gain.exponentialRampToValueAtTime(.0001, start + length);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + length + .02);
    }
  }

  async function bell() {
    ringTime = time;
    show('叮铃！');
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      audio ??= new Audio();
      await audio.resume();
      playNotes([
        [0, 1640, .085, .38], [0, 2462, .057, .27], [0, 3282, .021, .19],
        [.104, 1640, .059, .36], [.104, 2462, .037, .27],
      ]);
    } catch { /* The bell still has visible feedback when audio is unavailable. */ }
  }

  function setPaused(value) {
    paused = value;
    $('brake').setAttribute('aria-pressed', String(paused));
    $('brake-label').textContent = paused ? '继续' : '刹停';
    brakeIcon.setAttribute('d', paused ? 'm8 5 12 7-12 7V5Z' : 'M9 5H6v14h3zm9 0h-3v14h3z');
  }

  function pedaling() {
    return pedalPointer !== null || pedalKeys.size > 0 || pedalButtonKey !== null;
  }

  function syncPedal() {
    $('pedal').classList.toggle('is-down', pedaling());
  }

  function toggleView() {
    overview = !overview;
    $('view').setAttribute('aria-pressed', String(overview));
    $('view-label').textContent = overview ? '跟骑' : '俯瞰';
    resetView();
  }

  function changeOrbit(dx, dy) {
    yaw = (yaw + dx) % TAU;
    tilt = T.MathUtils.clamp(tilt + dy, -.21, .42);
    $('reset').hidden = Math.abs(yaw) < .03 && Math.abs(tilt) < .03;
  }

  function resetView() {
    yaw = 0;
    tilt = 0;
    $('reset').hidden = true;
  }

  function updateDeliveries(fraction) {
    for (const [index, stop] of stops.entries()) {
      if (delivered.has(index) || fraction < stop.at) continue;
      delivered.add(index);
      $('stop-' + (index + 1)).dataset.delivered = '';
      $('stop-' + (index + 1)).setAttribute('aria-label', stop.name + '已送达');
      $('delivery').textContent = delivered.size + ' / 3 封';
      $('location').textContent = stop.name;
      show(stop.name + ' · 邮件送达');
      playNotes([[0, 523.25, .052, .28], [.10, 659.25, .048, .33], [.20, 783.99, .048, .41]]);
    }
  }

  function newLap(now) {
    const count = delivered.size;
    lap = now;
    delivered = new Set();
    $('delivery').textContent = '0 / 3 封';
    for (let i = 1; i <= stops.length; i++) {
      const stop = $('stop-' + i);
      delete stop.dataset.delivered;
      stop.removeAttribute('aria-label');
    }
    $('location').textContent = '灯塔湾';
    if (count === 3) show('一圈送完 · 继续巡游');
  }

  function updateCamera(dt, initial) {
    const out = vec(-direction.z, 0, direction.x);
    const aspect = camera.aspect;
    if (overview) {
      const angle = .35 + yaw;
      const elevation = .86 + tilt * .7;
      const dist = Math.max(43, 44 / aspect);
      orbit.set(Math.sin(angle) * Math.cos(elevation), Math.sin(elevation), Math.cos(angle) * Math.cos(elevation));
      targetGoal.set(0, -.08, 0);
      cameraGoal.copy(targetGoal).addScaledVector(orbit, dist);
    } else {
      const angle = 1.17 + yaw;
      const tiltAngle = .205 + tilt;
      const dist = 7.75 + Math.max(0, .65 - aspect) * 4.6;
      orbit.copy(direction).multiplyScalar(Math.cos(angle)).addScaledVector(out, Math.sin(angle)).multiplyScalar(Math.cos(tiltAngle) * dist);
      orbit.y = Math.sin(tiltAngle) * dist;
      targetGoal.copy(point).addScaledVector(direction, .2);
      targetGoal.y += 1.44;
      cameraGoal.copy(targetGoal).add(orbit);
      cameraGoal.y = Math.max(1.14, cameraGoal.y);
    }
    const ease = initial || reduced ? 1 : 1 - Math.exp(-dt * 5.9);
    cameraPosition.lerp(cameraGoal, ease);
    target.lerp(targetGoal, ease);
    camera.position.copy(cameraPosition);
    camera.lookAt(target);
  }

  function frame(now, initial = false) {
    const dt = timeBefore ? T.MathUtils.clamp((now - timeBefore) / 1000, 0, .05) : 0;
    timeBefore = now;
    time += dt;
    const wanted = getSpeed(paused, pedaling());
    speed = T.MathUtils.damp(speed, wanted, paused ? 7.5 : wanted > speed ? 2.15 : 1.35, dt);
    if (paused && speed < .025) speed = 0;
    distance += speed * dt;
    const lapProgress = distance / island.length;
    const fraction = lapProgress % 1;
    if (Math.floor(lapProgress) > lap) newLap(Math.floor(lapProgress));
    updateDeliveries(fraction);
    $('progress').style.transform = 'scaleX(' + fraction.toFixed(4) + ')';
    const kph = Math.round(speed * 3.6);
    if (kph !== displayedSpeed) {
      displayedSpeed = kph;
      $('speed').value = String(kph);
    }

    island.route.getPointAt(fraction, point);
    island.route.getTangentAt(fraction, direction);
    island.route.getTangentAt((fraction + .014) % 1, laterDirection);
    const turn = direction.x * laterDirection.z - direction.z * laterDirection.x;
    const lean = T.MathUtils.clamp(-turn * speed * .18, -.2, .2);
    rider.root.position.copy(point);
    rider.root.position.y = .018;
    rider.root.rotation.y = Math.atan2(-direction.z, direction.x);
    rider.update({ distance, speed, lean, time, reduced, ringTime });
    island.animate(time, reduced, delivered);
    updateCamera(dt, initial);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const pedal = $('pedal');
  pedal.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pedalPointer !== null) return;
    pedalPointer = event.pointerId;
    pedal.setPointerCapture(event.pointerId);
    setPaused(false);
    syncPedal();
  });
  const releasePedal = event => {
    if (event.pointerId !== pedalPointer) return;
    pedalPointer = null;
    syncPedal();
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) pedal.addEventListener(event, releasePedal);
  pedal.addEventListener('click', event => {
    if (event.detail === 0) setPaused(false);
  });
  pedal.addEventListener('contextmenu', event => event.preventDefault());

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    if (event.pointerType === 'mouse') canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    changeOrbit((drag.x - event.clientX) * .011, (event.clientY - drag.y) * .006);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  const releaseOrbit = event => {
    if (drag?.id === event.pointerId) drag = null;
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, releaseOrbit);
  canvas.addEventListener('dblclick', resetView);

  $('brake').addEventListener('click', () => setPaused(!paused));
  $('bell').addEventListener('click', bell);
  $('view').addEventListener('click', toggleView);
  $('reset').addEventListener('click', resetView);

  const accelerate = new Set(['ArrowUp', 'KeyW']);
  window.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const { code, repeat } = event;
    const pedalActivation = event.target === pedal && ['Space', 'Enter'].includes(code);
    if (accelerate.has(code) || pedalActivation) {
      event.preventDefault();
      if (!repeat) {
        if (pedalActivation) pedalButtonKey = code;
        else pedalKeys.add(code);
        setPaused(false);
        syncPedal();
      }
      return;
    }
    if (['ArrowLeft', 'ArrowRight'].includes(code)) {
      event.preventDefault();
      changeOrbit(code === 'ArrowLeft' ? .17 : -.17, 0);
      return;
    }
    if (code === 'Space' && !event.target.closest?.('button')) {
      event.preventDefault();
      if (!repeat) setPaused(!paused);
    }
    if (repeat) return;
    if (code === 'KeyB') bell();
    if (code === 'KeyV') toggleView();
    if (code === 'KeyR') resetView();
  });
  window.addEventListener('keyup', ({ code }) => {
    if (pedalButtonKey === code) pedalButtonKey = null;
    pedalKeys.delete(code);
    syncPedal();
  });
  window.addEventListener('blur', () => {
    pedalKeys.clear();
    pedalButtonKey = null;
    pedalPointer = null;
    drag = null;
    syncPedal();
  });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    timeBefore = 0;
    if (!document.hidden) raf = requestAnimationFrame(frame);
  });
  reducedMotion.addEventListener('change', event => {
    reduced = event.matches;
    if (reduced) setPaused(true);
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    $('fallback').textContent = '3D 场景暂时中断，正在恢复…';
    $('fallback').hidden = false;
    for (const button of controls) button.disabled = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    $('fallback').hidden = true;
    for (const button of controls) button.disabled = false;
    timeBefore = 0;
    renderer.shadowMap.needsUpdate = true;
    if (!document.hidden) raf = requestAnimationFrame(frame);
  });

  setPaused(paused);
  frame(performance.now(), true);
  $('fallback').hidden = true;
}

try {
  start();
} catch (error) {
  $('fallback').textContent = '当前浏览器无法启动 3D 场景。请启用 WebGL 2 后重试。';
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  console.error(error);
}
