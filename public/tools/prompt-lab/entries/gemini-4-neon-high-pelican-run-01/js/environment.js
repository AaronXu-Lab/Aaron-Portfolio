import * as THREE from '../vendor/three.min.js';

export const TIME_PRESETS = [
  {
    id: 'morning',
    label: '晴午',
    icon: 'sun',
    skyZenith: new THREE.Color('#2276c8'),
    skyMid: new THREE.Color('#6dbef0'),
    skyHorizon: new THREE.Color('#e4f3f6'),
    sunColor: new THREE.Color('#fff4d6'),
    sunPos: new THREE.Vector3(58, 42, -95),
    sunLightColor: new THREE.Color('#fff5e0'),
    sunIntensity: 2.35,
    hemiSky: new THREE.Color('#9cd7ff'),
    hemiGround: new THREE.Color('#c89c6d'),
    hemiIntensity: 1.05,
    rimColor: new THREE.Color('#84e2e6'),
    rimIntensity: 0.45,
    fogColor: new THREE.Color('#d8eef2'),
    fogDensity: 0.0052,
    waterShallow: new THREE.Color('#38c5c4'),
    waterDeep: new THREE.Color('#0c5e91'),
    waterSpec: new THREE.Color('#fff9e4'),
    starAlpha: 0.0,
    lampGlow: 0.05,
  },
  {
    id: 'sunset',
    label: '落日',
    icon: 'sunset',
    skyZenith: new THREE.Color('#2f356a'),
    skyMid: new THREE.Color('#c9686b'),
    skyHorizon: new THREE.Color('#ffbd76'),
    sunColor: new THREE.Color('#ffd380'),
    sunPos: new THREE.Vector3(64, 15, -108),
    sunLightColor: new THREE.Color('#ffad6b'),
    sunIntensity: 2.45,
    hemiSky: new THREE.Color('#ff9d78'),
    hemiGround: new THREE.Color('#6b484e'),
    hemiIntensity: 0.92,
    rimColor: new THREE.Color('#ffce8a'),
    rimIntensity: 0.65,
    fogColor: new THREE.Color('#e8a378'),
    fogDensity: 0.0062,
    waterShallow: new THREE.Color('#338a99'),
    waterDeep: new THREE.Color('#1d3561'),
    waterSpec: new THREE.Color('#ffd08a'),
    starAlpha: 0.12,
    lampGlow: 0.85,
  },
  {
    id: 'dusk',
    label: '星夜',
    icon: 'moon',
    skyZenith: new THREE.Color('#0b132b'),
    skyMid: new THREE.Color('#1a2b52'),
    skyHorizon: new THREE.Color('#35537a'),
    sunColor: new THREE.Color('#e3f0ff'),
    sunPos: new THREE.Vector3(52, 34, -102),
    sunLightColor: new THREE.Color('#9ec4ff'),
    sunIntensity: 1.15,
    hemiSky: new THREE.Color('#47699c'),
    hemiGround: new THREE.Color('#22283d'),
    hemiIntensity: 0.78,
    rimColor: new THREE.Color('#6ec9e8'),
    rimIntensity: 0.52,
    fogColor: new THREE.Color('#263d5e'),
    fogDensity: 0.0068,
    waterShallow: new THREE.Color('#165a72'),
    waterDeep: new THREE.Color('#091c38'),
    waterSpec: new THREE.Color('#c8e4ff'),
    starAlpha: 0.95,
    lampGlow: 1.5,
  },
];

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uStarAlpha;
  uniform float uTime;
  varying vec3 vWorldDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, -0.15, 1.0);
    float t1 = smoothstep(-0.06, 0.24, h);
    float t2 = smoothstep(0.18, 0.78, h);

    vec3 col = mix(uHorizon, uMid, t1);
    col = mix(col, uZenith, t2);

    // Sun / moon glow & crisp disk
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float mie = pow(sunDot, 10.0) * 0.36 + pow(sunDot, 64.0) * 0.45;
    float disk = smoothstep(0.9965, 0.9986, sunDot);
    col += uSunColor * (mie + disk * 1.35);

    // Horizon warm/cool mist band
    float band = exp(-abs(h - 0.01) * 14.0);
    col = mix(col, uHorizon * 1.06, band * 0.28);

    // Crisp circular twinkling stars in Dusk mode
    if (uStarAlpha > 0.01 && dir.y > 0.05) {
      vec3 sp = dir * 135.0;
      vec3 cell = floor(sp);
      vec3 local = fract(sp) - 0.5;
      float rnd = hash(cell);
      if (rnd > 0.968) {
        vec3 jitter = vec3(hash(cell + 1.3) - 0.5, hash(cell + 2.7) - 0.5, hash(cell + 4.1) - 0.5) * 0.45;
        float distStar = length(local - jitter);
        float core = smoothstep(0.18, 0.02, distStar);
        float twinkle = 0.58 + 0.42 * sin(uTime * (2.0 + rnd * 4.5) + rnd * 60.0);
        float elev = smoothstep(0.05, 0.25, dir.y);
        col += vec3(0.95, 0.98, 1.0) * core * twinkle * elev * uStarAlpha * 1.45;
      }
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

const OCEAN_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying vec3 vWorldPos;
  varying float vWaveH;
  varying float vShoreDist;

  void main() {
    vec3 pos = position;
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    float wz = wp.z - uScroll;
    float wx = wp.x;

    float w1 = sin(wx * 0.22 + wz * 0.19 + uTime * 1.35) * 0.18;
    float w2 = cos(wx * 0.43 - wz * 0.31 + uTime * 1.95) * 0.09;
    float w3 = sin((wx + wz) * 0.72 + uTime * 2.5) * 0.045;
    float h = w1 + w2 + w3;

    wp.y += h;
    vWorldPos = wp.xyz;
    vWaveH = h;
    // Shore is around x = 3.2 (right side of road)
    vShoreDist = max(0.0, wp.x - 3.2);

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const OCEAN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSpecColor;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec3 vWorldPos;
  varying float vWaveH;
  varying float vShoreDist;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float wz = vWorldPos.z - uScroll;
    float wx = vWorldPos.x;

    // Procedural ripple normal for crisp sunlit ocean sparkles
    float nx = cos(wx * 0.42 + wz * 0.26 + uTime * 1.6) * 0.13
             + cos(wx * 1.15 - wz * 0.95 + uTime * 2.6) * 0.07;
    float nz = sin(wx * 0.31 - wz * 0.48 + uTime * 1.8) * 0.13
             + sin(wx * 0.95 + wz * 1.25 - uTime * 2.2) * 0.07;
    vec3 N = normalize(vec3(nx, 1.0, nz));

    // Depth & fresnel color blend
    float depthT = smoothstep(0.0, 38.0, vShoreDist);
    vec3 baseCol = mix(uShallow, uDeep, depthT);

    float fresnel = pow(1.0 - max(dot(N, viewDir), 0.0), 3.4);
    baseCol = mix(baseCol, mix(uFogColor, uSpecColor, 0.35), fresnel * 0.58);

    // Sun specular path & sparkling glints
    vec3 L = normalize(uSunDir);
    vec3 H = normalize(L + viewDir);
    float specWide = pow(max(dot(N, H), 0.0), 42.0) * 0.45;
    float specSharp = pow(max(dot(N, H), 0.0), 260.0) * 1.35;

    // Fine dancing water sparkles
    float glintNoise = sin(wx * 2.7 + uTime * 3.1) * cos(wz * 2.9 - uTime * 2.7);
    float glint = smoothstep(0.76, 0.98, glintNoise) * pow(max(dot(N, H), 0.0), 18.0) * 0.85;

    vec3 col = baseCol + uSpecColor * (specWide + specSharp + glint);

    // Coastal seafoam ribbon near the stone seawall
    float foamWave = sin(wz * 0.55 + uTime * 2.1) * 0.45 + sin(wz * 1.4 - uTime * 1.7) * 0.2;
    float shoreFoam = smoothstep(2.9 + foamWave, 0.4, vShoreDist);
    float crestFoam = smoothstep(0.22, 0.31, vWaveH) * 0.28;
    float foam = clamp(shoreFoam * 0.72 + crestFoam, 0.0, 0.92);
    col = mix(col, mix(vec3(0.95, 0.98, 1.0), uSpecColor, 0.22), foam);

    // Exponential distance fog matching scene fog
    float dist = length(cameraPosition - vWorldPos);
    float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createProceduralEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();

  const geo = new THREE.SphereGeometry(12, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vP;
      void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      varying vec3 vP;
      void main() {
        float y = vP.y;
        vec3 col = mix(vec3(0.28, 0.44, 0.52), vec3(0.96, 0.95, 0.90), smoothstep(-0.2, 0.12, y));
        col = mix(col, vec3(0.32, 0.66, 0.96), smoothstep(0.1, 0.85, y));
        float sun = pow(max(dot(vP, normalize(vec3(0.5, 0.45, -0.7))), 0.0), 18.0);
        col += vec3(1.0, 0.95, 0.82) * sun * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(geo, mat));

  const rt = pmrem.fromScene(envScene, 0.04);
  geo.dispose();
  mat.dispose();
  pmrem.dispose();
  return rt.texture;
}

export class CoastalEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.presetIndex = 0;
    this.targetPreset = TIME_PRESETS[0];

    // Working interpolated values
    this.cur = {
      skyZenith: TIME_PRESETS[0].skyZenith.clone(),
      skyMid: TIME_PRESETS[0].skyMid.clone(),
      skyHorizon: TIME_PRESETS[0].skyHorizon.clone(),
      sunColor: TIME_PRESETS[0].sunColor.clone(),
      sunPos: TIME_PRESETS[0].sunPos.clone(),
      sunLightColor: TIME_PRESETS[0].sunLightColor.clone(),
      sunIntensity: TIME_PRESETS[0].sunIntensity,
      hemiSky: TIME_PRESETS[0].hemiSky.clone(),
      hemiGround: TIME_PRESETS[0].hemiGround.clone(),
      hemiIntensity: TIME_PRESETS[0].hemiIntensity,
      rimColor: TIME_PRESETS[0].rimColor.clone(),
      rimIntensity: TIME_PRESETS[0].rimIntensity,
      fogColor: TIME_PRESETS[0].fogColor.clone(),
      fogDensity: TIME_PRESETS[0].fogDensity,
      waterShallow: TIME_PRESETS[0].waterShallow.clone(),
      waterDeep: TIME_PRESETS[0].waterDeep.clone(),
      waterSpec: TIME_PRESETS[0].waterSpec.clone(),
      starAlpha: TIME_PRESETS[0].starAlpha,
      lampGlow: TIME_PRESETS[0].lampGlow,
    };

    // Scene fog
    this.fog = new THREE.FogExp2(this.cur.fogColor, this.cur.fogDensity);
    scene.fog = this.fog;

    // Lighting rig
    this.hemiLight = new THREE.HemisphereLight(
      this.cur.hemiSky,
      this.cur.hemiGround,
      this.cur.hemiIntensity
    );
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(this.cur.sunLightColor, this.cur.sunIntensity);
    this.sunLight.position.set(16, 22, -14);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 65;
    this.sunLight.shadow.camera.left = -12;
    this.sunLight.shadow.camera.right = 12;
    this.sunLight.shadow.camera.top = 12;
    this.sunLight.shadow.camera.bottom = -12;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Subtle seaside bounce/rim light from ocean side
    this.rimLight = new THREE.DirectionalLight(this.cur.rimColor, this.cur.rimIntensity);
    this.rimLight.position.set(14, 6, 10);
    scene.add(this.rimLight);

    // Atmospheric Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: this.cur.skyZenith },
        uMid: { value: this.cur.skyMid },
        uHorizon: { value: this.cur.skyHorizon },
        uSunDir: { value: this.cur.sunPos.clone().normalize() },
        uSunColor: { value: this.cur.sunColor },
        uStarAlpha: { value: this.cur.starAlpha },
        uTime: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 20), this.skyMat);
    scene.add(this.skyDome);

    // Animated Mediterranean Ocean
    const oceanGeo = new THREE.PlaneGeometry(440, 380, 84, 84);
    oceanGeo.rotateX(-Math.PI / 2);
    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uShallow: { value: this.cur.waterShallow },
        uDeep: { value: this.cur.waterDeep },
        uSpecColor: { value: this.cur.waterSpec },
        uSunDir: { value: this.cur.sunPos.clone().normalize() },
        uFogColor: { value: this.cur.fogColor },
        uFogDensity: { value: this.cur.fogDensity },
      },
      vertexShader: OCEAN_VERT,
      fragmentShader: OCEAN_FRAG,
    });
    this.ocean = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.ocean.position.set(142, -2.2, -55);
    scene.add(this.ocean);
  }

  setPreset(index) {
    this.presetIndex = ((index % TIME_PRESETS.length) + TIME_PRESETS.length) % TIME_PRESETS.length;
    this.targetPreset = TIME_PRESETS[this.presetIndex];
    return this.targetPreset;
  }

  cyclePreset() {
    return this.setPreset(this.presetIndex + 1);
  }

  update(dt, elapsed, dist, oceanY, focusX = 0) {
    const k = Math.min(1, dt * 2.6);
    const t = this.targetPreset;
    const c = this.cur;

    c.skyZenith.lerp(t.skyZenith, k);
    c.skyMid.lerp(t.skyMid, k);
    c.skyHorizon.lerp(t.skyHorizon, k);
    c.sunColor.lerp(t.sunColor, k);
    c.sunPos.lerp(t.sunPos, k);
    c.sunLightColor.lerp(t.sunLightColor, k);
    c.sunIntensity += (t.sunIntensity - c.sunIntensity) * k;
    c.hemiSky.lerp(t.hemiSky, k);
    c.hemiGround.lerp(t.hemiGround, k);
    c.hemiIntensity += (t.hemiIntensity - c.hemiIntensity) * k;
    c.rimColor.lerp(t.rimColor, k);
    c.rimIntensity += (t.rimIntensity - c.rimIntensity) * k;
    c.fogColor.lerp(t.fogColor, k);
    c.fogDensity += (t.fogDensity - c.fogDensity) * k;
    c.waterShallow.lerp(t.waterShallow, k);
    c.waterDeep.lerp(t.waterDeep, k);
    c.waterSpec.lerp(t.waterSpec, k);
    c.starAlpha += (t.starAlpha - c.starAlpha) * k;
    c.lampGlow += (t.lampGlow - c.lampGlow) * k;

    // Apply to Three.js lights & fog
    this.fog.color.copy(c.fogColor);
    this.fog.density = c.fogDensity;

    this.hemiLight.color.copy(c.hemiSky);
    this.hemiLight.groundColor.copy(c.hemiGround);
    this.hemiLight.intensity = c.hemiIntensity;

    const sunDir = c.sunPos.clone().normalize();
    this.sunLight.color.copy(c.sunLightColor);
    this.sunLight.intensity = c.sunIntensity;
    this.sunLight.position.set(focusX + sunDir.x * 26, Math.max(8, sunDir.y * 28), sunDir.z * 26);
    this.sunLight.target.position.set(focusX, 0.8, 0);

    this.rimLight.color.copy(c.rimColor);
    this.rimLight.intensity = c.rimIntensity;

    // Update sky shader
    this.skyMat.uniforms.uSunDir.value.copy(sunDir);
    this.skyMat.uniforms.uStarAlpha.value = c.starAlpha;
    this.skyMat.uniforms.uTime.value = elapsed;

    // Update ocean shader & elevation
    this.ocean.position.y = oceanY;
    this.oceanMat.uniforms.uTime.value = elapsed;
    this.oceanMat.uniforms.uScroll.value = dist;
    this.oceanMat.uniforms.uSunDir.value.copy(sunDir);
    this.oceanMat.uniforms.uFogDensity.value = c.fogDensity;
  }
}
