import * as THREE from '../vendor/three.module.min.js';
import { merge, blob, tube } from './geo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const TAU = Math.PI * 2;

const SRGB_FN = `
vec3 toSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(vec3(0.0031308), c));
}
`;

function makeGlowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.14, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMoonTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(96, 88, 8, 128, 128, 128);
  g.addColorStop(0, '#fff6e2');
  g.addColorStop(0.55, '#f6e5c6');
  g.addColorStop(0.86, '#dcc7a6');
  g.addColorStop(1, '#b6a184');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, TAU);
  ctx.fill();
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 34; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 4 + rand() * 22;
    const d = Math.hypot(x - 128, y - 128);
    if (d + r > 122) continue;
    const cg = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
    cg.addColorStop(0, `rgba(120,104,86,${0.05 + rand() * 0.12})`);
    cg.addColorStop(0.7, `rgba(150,132,108,${0.04 + rand() * 0.08})`);
    cg.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // 环形山的亮边
  for (let i = 0; i < 10; i++) {
    const x = 30 + rand() * 196;
    const y = 30 + rand() * 196;
    if (Math.hypot(x - 128, y - 128) > 100) continue;
    ctx.strokeStyle = 'rgba(255,248,232,0.18)';
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 3 + rand() * 8, 0, TAU);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PALETTES = {
  night: {
    skyTop: 0x050813,
    skyMid: 0x0d1730,
    skyHorizon: 0x4d5f86,
    moonGlow: 0xffd7a2,
    moonTint: 0xfff0d6,
    moonPos: V(-60, 21, -152),
    fog: 0x2a354f,
    salt: 0x33415c,
    saltDark: 0x111a2b,
    starFade: 1,
    mesas: [0x111828, 0x182136, 0x0c1220],
    horizonGlow: 0.55,
    light: 0xbcd2ff,
    lightIntensity: 2.15,
    hemiSky: 0x7c93c9,
    hemiGround: 0x1a2233,
    hemiIntensity: 0.62,
    rim: 0xffa877,
    rimIntensity: 0.62,
  },
  dawn: {
    skyTop: 0x232a58,
    skyMid: 0x7e5c82,
    skyHorizon: 0xffb489,
    moonGlow: 0xffc08e,
    moonTint: 0xffe2bd,
    moonPos: V(-62, 8, -150),
    fog: 0x9b7a80,
    salt: 0x8b7581,
    saltDark: 0x453a4d,
    starFade: 0.12,
    mesas: [0x3a2c42, 0x4d3a4a, 0x2a2134],
    horizonGlow: 1.1,
    light: 0xffc7a0,
    lightIntensity: 2.4,
    hemiSky: 0xffb9a0,
    hemiGround: 0x3a3348,
    hemiIntensity: 0.78,
    rim: 0xff9a6a,
    rimIntensity: 0.5,
  },
};

function buildSky() {
  const geo = new THREE.SphereGeometry(300, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x050813) },
      uMid: { value: new THREE.Color(0x0d1730) },
      uHorizon: { value: new THREE.Color(0x4d5f86) },
      uGlow: { value: new THREE.Color(0xffd7a2) },
      uMoonDir: { value: V(-0.26, 0.2, -0.94).normalize() },
      uDawn: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop, uMid, uHorizon, uGlow, uMoonDir;
      uniform float uDawn;
      varying vec3 vDir;
      ${SRGB_FN}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.26, h));
        col = mix(col, uTop, smoothstep(0.16, 0.82, h));
        float m = max(dot(d, uMoonDir), 0.0);
        col += uGlow * (pow(m, 140.0) * 0.6 + pow(m, 20.0) * 0.12 + pow(m, 4.0) * 0.028) * (1.0 - uDawn * 0.3);
        // 银河带
        float band = exp(-pow(dot(d, normalize(vec3(0.18, 0.42, 0.72))) * 4.2, 2.0));
        float dust = noise(d.xz * 7.0 + d.y * 3.0) * 0.65 + noise(d.xz * 19.0) * 0.35;
        col += vec3(0.09, 0.1, 0.16) * band * dust * (1.0 - uDawn);
        // 地平线盐雾
        float haze = exp(-abs(h) * 16.0);
        col += uHorizon * haze * 0.18;
        // 拂晓时天边的暖带
        col += uGlow * smoothstep(0.24, 0.0, abs(h - 0.04)) * uDawn * 0.16 * (0.35 + m * 0.9);
        gl_FragColor = vec4(toSRGB(col), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

function buildStars() {
  const COUNT = 1500;
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  const tint = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const theta = u * TAU;
    const phi = Math.acos(0.04 + Math.random() * 0.96);
    const r = 190;
    const y = Math.cos(phi);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * y;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    size[i] = 0.7 + Math.pow(Math.random(), 3) * 3.2;
    phase[i] = Math.random();
    const warm = Math.random();
    tint[i * 3] = 0.8 + warm * 0.2;
    tint[i * 3 + 1] = 0.84 + warm * 0.1;
    tint[i * 3 + 2] = 1.0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aTint;
      uniform float uTime, uFade;
      varying float vAlpha;
      varying vec3 vTint;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.72 + 0.28 * sin(uTime * 1.6 + aPhase * 6.283);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * tw * 1.25;
        float horizon = smoothstep(-0.03, 0.2, normalize(position).y);
        vAlpha = tw * uFade * horizon * 0.9;
        vTint = aTint;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(vTint * a * vAlpha, 1.0);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -9;
  return points;
}

function buildMoon(glowTex) {
  const group = new THREE.Group();
  const tex = makeMoonTexture();
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false,
  }));
  disc.scale.setScalar(17);
  group.add(disc);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffd7a2, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.4, toneMapped: false, fog: false,
  }));
  halo.scale.setScalar(58);
  group.add(halo);
  return { group, disc, halo };
}

function buildMesas(materials) {
  const group = new THREE.Group();
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const buckets = [[], [], []];
  for (let i = 0; i < 13; i++) {
    const far = i > 8;
    const h = far ? 5 + rand() * 8 : 3.8 + rand() * 7;
    const rb = far ? 4 + rand() * 9 : 2.2 + rand() * 5.5;
    const side = rand() > 0.5 ? 1 : -1;
    const x = side * (17 + rand() * 100);
    const z = -84 - rand() * (far ? 100 : 55);
    const rot = rand() * TAU;
    const bucket = buckets[far ? 1 : i % 3 === 0 ? 2 : 0];
    const layers = [
      { rTop: rb * 0.84, rBot: rb, hh: h * 0.34, y: h * 0.17 },
      { rTop: rb * 0.62, rBot: rb * 0.8, hh: h * 0.42, y: h * 0.34 + h * 0.21 },
      { rTop: rb * 0.52, rBot: rb * 0.6, hh: h * 0.24, y: h * 0.76 + h * 0.12 },
    ];
    for (const l of layers) {
      const geo = new THREE.CylinderGeometry(l.rTop, l.rBot, l.hh, 5 + Math.floor(rand() * 3), 1);
      const m = new THREE.Matrix4();
      m.compose(
        V(x + (rand() - 0.5) * rb * 0.12, l.y - 2.3, z + (rand() - 0.5) * rb * 0.16),
        new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rot),
        V(1 + rand() * 0.2, 1, 0.8 + rand() * 0.25)
      );
      geo.applyMatrix4(m);
      bucket.push(geo);
    }
    if (i % 4 === 0) {
      const spireH = 7 + rand() * 8;
      const spire = new THREE.CylinderGeometry(rb * 0.09, rb * 0.24, spireH, 5, 1);
      const m = new THREE.Matrix4();
      m.compose(
        V(x + side * rb * 0.5, spireH / 2 - 2.2, z - 2),
        new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rot),
        V(1, 1, 1)
      );
      spire.applyMatrix4(m);
      bucket.push(spire);
    }
  }
  buckets.forEach((list, i) => {
    if (!list.length) return;
    group.add(new THREE.Mesh(merge(list), materials[i]));
  });
  return { group, items: [] };
}


function buildCrystals() {
  const COUNT = 28;
  const geo = new THREE.OctahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdde9f6,
    roughness: 0.2,
    metalness: 0.15,
    emissive: 0x122233,
    emissiveIntensity: 1.1,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  const items = [];
  let seed = 29;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < COUNT; i++) {
    items.push({
      x: (i % 2 ? 1 : -1) * (2.1 + rand() * 5.4),
      z: -i * 2.3 + rand() * 1.6,
      h: 0.2 + rand() * 0.5,
      w: 0.04 + rand() * 0.07,
      rot: rand() * TAU,
      tilt: (rand() - 0.5) * 0.5,
    });
  }
  const dummy = new THREE.Object3D();
  function update(dt, speed) {
    for (let i = 0; i < COUNT; i++) {
      const c = items[i];
      c.z += speed * dt;
      if (c.z > 6.5) c.z -= COUNT * 2.3;
      dummy.position.set(c.x, c.h * 0.5, c.z);
      dummy.rotation.set(c.tilt, c.rot, c.tilt * 0.5);
      dummy.scale.set(c.w, c.h * 0.5, c.w);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update, items };
}

function buildGround(refRT) {
  const uniforms = {
    uReflect: { value: refRT.texture },
    uTime: { value: 0 },
    uTextureMatrix: { value: new THREE.Matrix4() },
    uMoonX: { value: -12 },
    uReflectStrength: { value: 1 },
    uDawn: { value: 0 },
    uSalt: { value: new THREE.Color(0x33415c) },
    uSaltDark: { value: new THREE.Color(0x111a2b) },
    uFog: { value: new THREE.Color(0x2a354f) },
    uMoonColor: { value: new THREE.Color(0xffd7a2) },
    uCamXZ: { value: new THREE.Vector2() },
  };
  const geo = new THREE.PlaneGeometry(420, 420, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform mat4 uTextureMatrix;
      varying vec3 vWorld;
      varying vec4 vReflect;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vReflect = uTextureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D uReflect;
      uniform float uTime, uReflectStrength, uDawn, uMoonX;
      uniform vec3 uSalt, uSaltDark, uFog, uMoonColor;
      uniform vec2 uCamXZ;
      varying vec3 vWorld;
      varying vec4 vReflect;
      ${SRGB_FN}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        return noise(p) * 0.56 + noise(p * 2.13 + 7.0) * 0.28 + noise(p * 4.7 + 19.0) * 0.16;
      }
      void main() {
        vec2 p = vWorld.xz;
        float dist = distance(p, uCamXZ);
        float n = fbm(p * 0.85);
        vec3 base = mix(uSaltDark, uSalt, smoothstep(0.16, 0.86, n));
        // 盐壳裂纹
        float crack = smoothstep(0.045, 0.0, abs(noise(p * 3.4 + 11.0) - 0.5));
        base *= 1.0 - crack * 0.22;
        base += 0.035 * (noise(p * 46.0) - 0.5);
        // 湿盐面的细波纹
        vec2 uv = clamp(vReflect.xy / max(vReflect.w, 0.0001), 0.0015, 0.9985);
        float rip = sin(p.y * 5.4 + uTime * 2.3 + sin(p.x * 1.7 + uTime * 0.6)) * 0.0017;
        rip += sin(p.y * 13.0 - uTime * 3.0 + p.x * 0.7) * 0.0009;
        rip += (noise(p * 6.0 + uTime * 0.4) - 0.5) * 0.0016;
        rip *= smoothstep(0.3, 4.5, dist);
        vec3 refl = texture2D(uReflect, uv + vec2(rip, rip * 0.35)).rgb;
        float grazing = smoothstep(0.4, 26.0, dist);
        float amount = (0.24 + 0.64 * grazing) * uReflectStrength;
        vec3 col = mix(base, refl, amount);
        // 月光碎银
        float column = exp(-pow((p.x - uMoonX) / (2.4 + dist * 0.035), 2.0));
        float glitter = pow(noise(p * 30.0 + vec2(uTime * 1.2, -uTime * 2.0)), 10.0) * 16.0;
        col += uMoonColor * column * glitter * 0.045 * smoothstep(0.8, 9.0, dist);
        col += uMoonColor * pow(noise(p * 9.0 - uTime * 0.35), 6.0) * 0.05 * (1.0 - uDawn * 0.4);
        float fog = smoothstep(22.0, 100.0, dist);
        col = mix(col, uFog, fog);
        gl_FragColor = vec4(toSRGB(col), 1.0);
      }
    `,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.position.y = 0;
  ground.renderOrder = -1;
  return { ground, uniforms };
}

function buildMarkers() {
  const COUNT = 20;
  const posts = [];
  const postGeo = new THREE.CylinderGeometry(0.012, 0.022, 1.2, 5);
  postGeo.translate(0, 0.6, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xd9c6a2, roughness: 0.85 });
  const postMesh = new THREE.InstancedMesh(postGeo, postMat, COUNT);
  postMesh.frustumCulled = false;

  const bannerGeo = new THREE.PlaneGeometry(0.2, 0.11);
  bannerGeo.translate(0.1, 0, 0);
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xe6b177, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x3a1608, emissiveIntensity: 0.35,
  });
  const bannerMesh = new THREE.InstancedMesh(bannerGeo, bannerMat, COUNT);
  bannerMesh.frustumCulled = false;

  const orbGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0xffc178 });
  const orbCount = 7;
  const orbMesh = new THREE.InstancedMesh(orbGeo, orbMat, orbCount);
  orbMesh.frustumCulled = false;

  let seed = 3;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < COUNT; i++) {
    posts.push({
      x: (i % 2 ? 1 : -1) * (6.4 + rand() * 6.5),
      z: -i * 9.2 + rand() * 3,
      h: 0.9 + rand() * 0.55,
      phase: rand() * TAU,
    });
  }
  return {
    postMesh, bannerMesh, orbMesh, posts, orbCount,
    update(time, speed, dt) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < COUNT; i++) {
        const p = posts[i];
        p.z += speed * dt;
        if (p.z > 12) p.z -= COUNT * 9.2;
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, p.h, 1);
        dummy.updateMatrix();
        postMesh.setMatrixAt(i, dummy.matrix);
        dummy.position.set(p.x, p.h * 1.2 - 0.06, p.z);
        dummy.rotation.set(0, Math.sin(time * 2.2 + p.phase) * 0.35 + (p.x > 0 ? 0 : Math.PI), Math.sin(time * 3.1 + p.phase) * 0.06);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bannerMesh.setMatrixAt(i, dummy.matrix);
        if (i % 3 === 0) {
          const k = i / 3;
          if (k < orbCount) {
            dummy.position.set(p.x, p.h * 1.2 + 0.04, p.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(0.8 + Math.sin(time * 2 + p.phase) * 0.15);
            dummy.updateMatrix();
            orbMesh.setMatrixAt(k, dummy.matrix);
          }
        }
      }
      postMesh.instanceMatrix.needsUpdate = true;
      bannerMesh.instanceMatrix.needsUpdate = true;
      orbMesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildRipples() {
  const COUNT = 14;
  const ringGeo = new THREE.RingGeometry(0.055, 0.075, 26);
  ringGeo.rotateX(-Math.PI / 2);
  const list = [];
  for (let i = 0; i < COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdceeff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.set(0, 0.012, 0);
    m.visible = false;
    m.renderOrder = 3;
    list.push({ mesh: m, life: 0, max: 1, growth: 1, drift: 0 });
  }
  return {
    list,
    spawn(x, z, time, opts = {}) {
      const slot = list.find((r) => !r.mesh.visible) || list[0];
      slot.mesh.visible = true;
      slot.mesh.position.set(x, 0.012, z);
      slot.mesh.scale.setScalar(opts.scale || 0.55);
      slot.life = 0;
      slot.max = opts.max || 1.6;
      slot.growth = opts.growth || 2.6;
      slot.drift = opts.drift || 0;
      slot.mesh.material.opacity = opts.opacity || 0.32;
      return slot;
    },
    update(dt, speed) {
      for (const r of list) {
        if (!r.mesh.visible) continue;
        r.life += dt;
        const t = r.life / r.max;
        if (t >= 1) {
          r.mesh.visible = false;
          r.mesh.material.opacity = 0;
          continue;
        }
        r.mesh.scale.setScalar(0.55 + t * r.growth * 2.4);
        r.mesh.position.z += (speed * 0.55 + r.drift) * dt;
        r.mesh.material.opacity = (1 - t) * (1 - t) * 0.45;
      }
    },
  };
}

function buildParticles(glowTex) {
  const COUNT = 260;
  const pos = new Float32Array(COUNT * 3);
  const alpha = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);
  const vel = new Float32Array(COUNT * 3);
  const life = new Float32Array(COUNT);
  const maxLife = new Float32Array(COUNT);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: glowTex }, uColor: { value: new THREE.Color(0xbfe2ff) } },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      varying float vA;
      void main() {
        vA = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(aSize * (260.0 / max(-mv.z, 1.2)), 26.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vA;
      ${SRGB_FN}
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(toSRGB(uColor) * t.a * vA, 1.0);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let cursor = 0;
  return {
    points,
    spawn(x, y, z, vx, vy, vz, sz, lf) {
      const i = cursor;
      cursor = (cursor + 1) % COUNT;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      size[i] = sz;
      life[i] = lf;
      maxLife[i] = lf;
      alpha[i] = 1;
    },
    update(dt, drag) {
      for (let i = 0; i < COUNT; i++) {
        if (life[i] <= 0) {
          if (alpha[i] !== 0) alpha[i] = 0;
          continue;
        }
        life[i] -= dt;
        const t = clamp(life[i] / maxLife[i], 0, 1);
        vel[i * 3 + 1] -= 6.2 * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.02) {
          pos[i * 3 + 1] = 0.02;
          vel[i * 3 + 1] *= -0.18;
          vel[i * 3] *= 0.7;
          vel[i * 3 + 2] *= 0.7;
        }
        alpha[i] = t * t * 0.9;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

function buildFireflies(glowTex) {
  const COUNT = 30;
  const pos = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);
  const color = new Float32Array(COUNT * 3);
  const base = [];
  const cWarm = new THREE.Color(0xffc884);
  const cCool = new THREE.Color(0x8df0e4);
  for (let i = 0; i < COUNT; i++) {
    const x = (Math.random() - 0.5) * 17;
    const y = 0.4 + Math.random() * 2.4;
    const z = -13 + Math.random() * 17;
    base.push({ x, y, z });
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    phase[i] = Math.random() * TAU;
    size[i] = 0.16 + Math.random() * 0.16;
    const c = Math.random() > 0.72 ? cCool : cWarm;
    color[i * 3] = c.r;
    color[i * 3 + 1] = c.g;
    color[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: glowTex }, uTime: { value: 0 } },
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uTime;
      varying vec3 vColor;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(aSize * (300.0 / max(-mv.z, 1.2)) * (0.8 + 0.2 * sin(uTime * 1.8 + aPhase)), 22.0);
        gl_Position = projectionMatrix * mv;
        vColor = aColor;
        vA = 0.55 + 0.45 * sin(uTime * 2.3 + aPhase * 1.7);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vA;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vColor * t.a * max(vA, 0.0) * 0.8, 1.0);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(time, speed, dt) {
      for (let i = 0; i < COUNT; i++) {
        const b = base[i];
        pos[i * 3] = b.x + Math.sin(time * 0.6 + phase[i]) * 0.9 + Math.sin(time * 1.7 + phase[i] * 2.0) * 0.16;
        pos[i * 3 + 1] = b.y + Math.sin(time * 0.9 + phase[i] * 1.3) * 0.3;
        pos[i * 3 + 2] = ((b.z + time * speed * 0.35 + 18) % 18) - 16;
      }
      geo.attributes.position.needsUpdate = true;
      mat.uniforms.uTime.value = time;
    },
  };
}

function buildFish(glowTex) {
  const COUNT = 12;
  const bodyGeo = merge([
    blob(0, 0, 0, 0.075, 0.115, 0.28, 14),
    blob(0, 0.03, 0.12, 0.04, 0.07, 0.11, 10),
    (() => {
      const tail = new THREE.ConeGeometry(0.07, 0.16, 4);
      tail.rotateX(Math.PI / 2);
      tail.rotateZ(Math.PI / 4);
      tail.translate(0, 0.01, -0.3);
      return tail;
    })(),
    (() => {
      const fin = new THREE.ConeGeometry(0.03, 0.09, 3);
      fin.rotateX(-0.5);
      fin.translate(0, 0.1, -0.02);
      return fin;
    })(),
  ]);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xa8f7e8, roughness: 0.35, metalness: 0.05,
    emissive: 0x4fd8c4, emissiveIntensity: 1.35, fog: false,
  });
  const eyeGeo = merge([
    blob(-0.052, 0.028, 0.22, 0.012, 0.014, 0.012, 8),
    blob(0.052, 0.028, 0.22, 0.012, 0.014, 0.012, 8),
  ]);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x06201d, fog: false });
  const list = [];
  for (let i = 0; i < COUNT; i++) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(bodyGeo, bodyMat));
    group.add(new THREE.Mesh(eyeGeo, eyeMat));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x77f0dd, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.26, toneMapped: false, fog: false,
    }));
    glow.scale.setScalar(0.62);
    group.add(glow);
    group.visible = false;
    const item = {
      group, glow, mode: 'idle', t: 0, start: V(), phase: Math.random() * TAU,
      baseX: 0, baseY: 1.2, z: -50, vx: 0, vy: 0,
    };
    list.push(item);
  }

  function respawn(f, rigX, ahead = true) {
    f.mode = 'idle';
    f.t = 0;
    f.group.visible = true;
    f.group.scale.setScalar(1);
    const lane = [1.2, -1.2, 2.2, -2.2, 3.2, -3.2][Math.floor(Math.random() * 6)];
    f.baseX = clamp(rigX + lane + (Math.random() - 0.5) * 0.4, -5.6, 5.6);
    f.baseY = 1.5 + Math.random() * 0.65;
    f.z = ahead ? -16 - Math.random() * 22 : -16;
    f.phase = Math.random() * TAU;
    f.group.position.set(f.baseX, f.baseY, f.z);
    f.glow.material.opacity = 0.26;
  }

  return {
    list,
    reset(rigX) {
      for (const f of list) respawn(f, rigX);
    },
    update(dt, time, speed, rigX, pouch) {
      let collected = 0;
      for (const f of list) {
        if (f.mode === 'suck') {
          f.t += dt / 0.38;
          const t = clamp(f.t, 0, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          f.group.position.lerpVectors(f.start, pouch, ease);
          f.group.scale.setScalar(1 - t * 0.85);
          f.group.rotation.z += dt * 9;
          if (t >= 1) {
            f.group.visible = false;
            f.mode = 'gone';
            f.t = 0;
          }
          continue;
        }
        if (f.mode === 'gone') {
          f.t += dt;
          if (f.t > 0.6) respawn(f, rigX);
          continue;
        }
        if (f.mode === 'idle') {
          f.z += (speed + 1.1) * dt;
          const wob = Math.sin(time * 1.7 + f.phase);
          const dive = clamp((-f.z - 2) / 8, 0, 1);
          const y = f.baseY + Math.sin(time * 2.3 + f.phase) * 0.16;
          f.group.position.set(f.baseX + wob * 0.32, y + (1.55 - y) * dive * 0.75, f.z);
          f.group.rotation.set(Math.sin(time * 2 + f.phase) * 0.16, Math.sin(time * 1.2 + f.phase) * 0.35, 0);
          f.glow.material.opacity = 0.2 + Math.sin(time * 3 + f.phase) * 0.08;
          const dx = f.group.position.x - pouch.x;
          const dy = f.group.position.y - pouch.y;
          const dz = f.group.position.z - pouch.z;
          if (f.z > -16 && dx * dx + dy * dy + dz * dz < 0.38) {
            f.mode = 'suck';
            f.t = 0;
            f.start.copy(f.group.position);
            collected++;
          } else if (f.z > 0.4) {
            respawn(f, rigX);
          }
        }
      }
      return collected;
    },
  };
}

const COLOR_CACHE = new Map();
function C(hex) {
  let c = COLOR_CACHE.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    COLOR_CACHE.set(hex, c);
  }
  return c;
}

export function createWorld(scene, renderer, opts = {}) {
  const glowTex = makeGlowTexture();
  const refRT = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });

  scene.fog = new THREE.FogExp2(0x2a354f, 0.0078);

  // 天空 / 星 / 月
  const sky = buildSky();
  const skyU = sky.material.uniforms;
  scene.add(sky);
  const stars = buildStars();
  scene.add(stars);
  const moon = buildMoon(glowTex);
  moon.group.position.copy(PALETTES.night.moonPos);
  scene.add(moon.group);

  // 光
  const keyLight = new THREE.DirectionalLight(0xbcd2ff, 2.15);
  keyLight.position.set(-8, 12, -9);
  scene.add(keyLight);
  scene.add(keyLight.target);
  const rimLight = new THREE.DirectionalLight(0xffa877, 0.62);
  rimLight.position.set(7, 4, 8);
  scene.add(rimLight);
  scene.add(rimLight.target);
  const hemi = new THREE.HemisphereLight(0x7c93c9, 0x1a2233, 0.62);
  scene.add(hemi);
  const fillLight = new THREE.DirectionalLight(0xa8c0ff, 1.35);
  fillLight.position.set(6, 6, 8);
  scene.add(fillLight);
  scene.add(fillLight.target);

  // 地面
  const { ground, uniforms: groundU } = buildGround(refRT);
  scene.add(ground);

  // 远山
  const mesaMats = PALETTES.night.mesas.map((c) => new THREE.MeshBasicMaterial({ color: c, fog: true }));
  const mesas = buildMesas(mesaMats);
  scene.add(mesas.group);

  // 路标
  const markers = buildMarkers();
  scene.add(markers.postMesh, markers.bannerMesh, markers.orbMesh);

  // 水面涟漪 / 粒子 / 萤火 / 鱼
  const crystals = buildCrystals();
  scene.add(crystals.mesh);
  const ripples = buildRipples();
  ripples.list.forEach((r) => scene.add(r.mesh));
  const particles = buildParticles(glowTex);
  scene.add(particles.points);
  const fireflies = buildFireflies(glowTex);
  scene.add(fireflies.points);
  const fish = buildFish(glowTex);
  fish.list.forEach((f) => scene.add(f.group));
  fish.reset(0);

  // 镜像相机
  const mirrorCam = new THREE.PerspectiveCamera();
  const textureMatrix = new THREE.Matrix4();
  const _camPos = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _view = new THREE.Vector3();
  const _target = new THREE.Vector3();
  const _normal = new THREE.Vector3(0, 1, 0);
  const _origin = new THREE.Vector3(0, 0, 0);
  const _up = new THREE.Vector3();
  const _bias = new THREE.Matrix4().set(
    0.5, 0, 0, 0.5,
    0, 0.5, 0, 0.5,
    0, 0, 0.5, 0.5,
    0, 0, 0, 1
  );

  let dawn = 0;
  let dawnTarget = 0;

  function applyPalette(t) {
    const night = PALETTES.night;
    const day = PALETTES.dawn;
    const mix = (target, a, b) => target.copy(C(a)).lerp(C(b), t);
    mix(skyU.uTop.value, night.skyTop, day.skyTop);
    mix(skyU.uMid.value, night.skyMid, day.skyMid);
    mix(skyU.uHorizon.value, night.skyHorizon, day.skyHorizon);
    mix(skyU.uGlow.value, night.moonGlow, day.moonGlow);
    skyU.uDawn.value = t;
    mix(groundU.uSalt.value, night.salt, day.salt);
    mix(groundU.uSaltDark.value, night.saltDark, day.saltDark);
    mix(groundU.uFog.value, night.fog, day.fog);
    mix(groundU.uMoonColor.value, night.moonGlow, day.moonGlow);
    groundU.uDawn.value = t;
    stars.material.uniforms.uFade.value = night.starFade + (day.starFade - night.starFade) * t;
    mix(keyLight.color, night.light, day.light);
    keyLight.intensity = night.lightIntensity + (day.lightIntensity - night.lightIntensity) * t;
    mix(hemi.color, night.hemiSky, day.hemiSky);
    mix(hemi.groundColor, night.hemiGround, day.hemiGround);
    hemi.intensity = night.hemiIntensity + (day.hemiIntensity - night.hemiIntensity) * t;
    mix(rimLight.color, night.rim, day.rim);
    rimLight.intensity = night.rimIntensity + (day.rimIntensity - night.rimIntensity) * t;
    mix(scene.fog.color, night.fog, day.fog);
    moon.group.position.copy(night.moonPos).lerp(day.moonPos, t);
    _moonDir.copy(moon.group.position).normalize();
    skyU.uMoonDir.value.copy(_moonDir);
    mix(moon.disc.material.color, 0xffffff, day.moonTint);
    moon.disc.material.color.lerp(C(0xffffff), 1 - t * 0.7);
    mix(moon.halo.material.color, night.moonGlow, day.moonGlow);
    moon.halo.material.opacity = 0.5 + t * 0.2;
    mesaMats.forEach((mat, i) => {
      mix(mat.color, night.mesas[i % 3], day.mesas[i % 3]);
    });
    groundU.uMoonX.value = -8 - t * 8;
  }

  const _moonDir = new THREE.Vector3();
  applyPalette(0);


  return {
    glowTex,
    refRT,
    ground,
    fish,
    ripples,
    particles,
    fireflies,
    moon,
    setDawn(on) { dawnTarget = on ? 1 : 0; },
    get dawn() { return dawnTarget; },
    reset(rigX = 0) {
      fish.reset(rigX);
      particles.update(0, 0);
      for (const r of ripples.list) {
        r.mesh.visible = false;
        r.life = 0;
      }
    },
    updateEnvironment(dt, time, state, rigX, pouchWorld) {
      dawn += (dawnTarget - dawn) * Math.min(1, dt * 1.6);
      applyPalette(dawn);
      stars.material.uniforms.uTime.value = time;
      groundU.uTime.value = time;
      groundU.uCamXZ.value.set(state.cameraX, state.cameraZ);
      markers.update(time, state.speed, dt);
      crystals.update(dt, state.speed);
      ripples.update(dt, state.speed);
      particles.update(dt);
      fireflies.update(time, state.speed, dt);
      const collected = fish.update(dt, time, state.speed, rigX, pouchWorld);
      return collected;
    },
    renderReflection(renderer, camera, hideList = []) {
      const prevTarget = renderer.getRenderTarget();
      ground.visible = false;
      for (const o of hideList) if (o) o.visible = false;

      camera.getWorldPosition(_camPos);
      camera.getWorldDirection(_dir);
      _look.copy(_camPos).add(_dir);
      _view.copy(_origin).sub(_camPos).reflect(_normal).negate().add(_origin);
      _target.copy(_origin).sub(_look).reflect(_normal).negate().add(_origin);
      mirrorCam.position.copy(_view);
      _up.set(0, 1, 0).applyQuaternion(camera.quaternion).reflect(_normal);
      mirrorCam.up.copy(_up);
      mirrorCam.lookAt(_target);
      mirrorCam.near = camera.near;
      mirrorCam.far = camera.far;
      mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
      mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      mirrorCam.updateMatrixWorld();

      textureMatrix.copy(_bias)
        .multiply(mirrorCam.projectionMatrix)
        .multiply(mirrorCam.matrixWorldInverse)
        .multiply(ground.matrixWorld);
      groundU.uTextureMatrix.value.copy(textureMatrix);

      renderer.setRenderTarget(refRT);
      renderer.clear();
      renderer.render(scene, mirrorCam);
      renderer.setRenderTarget(prevTarget);

      ground.visible = true;
      for (const o of hideList) if (o) o.visible = true;
    },
    resize(w, h, scale = 0.5) {
      const rw = Math.max(64, Math.floor(w * scale));
      const rh = Math.max(64, Math.floor(h * scale));
      refRT.setSize(rw, rh);
    },
    spawnSplash(x, y, z, count = 6, power = 1) {
      for (let i = 0; i < count; i++) {
        particles.spawn(
          x + (Math.random() - 0.5) * 0.18,
          y + Math.random() * 0.05,
          z + (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.9 * power,
          (0.7 + Math.random() * 1.4) * power,
          (0.6 + Math.random() * 1.4) * power,
          0.9 + Math.random() * 0.9,
          0.45 + Math.random() * 0.6
        );
      }
    },
    burst(x, y, z, color = 'gold', count = 26) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const r = 0.6 + Math.random() * 2.2;
        particles.spawn(
          x, y, z,
          Math.cos(a) * r, 0.6 + Math.random() * 2.4, Math.sin(a) * r,
          1.2 + Math.random() * 1.4,
          0.7 + Math.random() * 0.9
        );
      }
      ripples.spawn(x, z, 0, { scale: 0.8, max: 2.2, growth: 3.4, opacity: 0.4 });
      return color;
    },
    wake(x, z, time) {
      ripples.spawn(x, z, time, { scale: 0.4, max: 1.8, growth: 2.4, opacity: 0.26 });
    },
  };
}
