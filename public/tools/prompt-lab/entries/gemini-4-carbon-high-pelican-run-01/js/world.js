import * as THREE from '../vendor/three.min.js';
import { createFishMesh } from './pelican-bike.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * Procedural sunlit cedar boardwalk plank texture (zero external image files).
 */
function createBoardwalkTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#cf9a64';
  ctx.fillRect(0, 0, c.width, c.height);

  const plankCount = 16;
  const ph = c.height / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const y = i * ph;
    const shade = (Math.sin(i * 2.7) * 0.5 + 0.5) * 14 - 7;
    const r = Math.round(210 + shade);
    const g = Math.round(156 + shade * 0.8);
    const b = Math.round(102 + shade * 0.6);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y + 2, c.width, ph - 3);

    // Subtle wood grain streaks
    ctx.fillStyle = 'rgba(255, 240, 215, 0.14)';
    ctx.fillRect(14, y + 5, c.width - 28, 3);

    // Gap between planks
    ctx.fillStyle = 'rgba(78, 46, 20, 0.42)';
    ctx.fillRect(0, y, c.width, 2);

    // Brass plank nail heads near left & right curbs
    ctx.fillStyle = 'rgba(92, 58, 28, 0.55)';
    for (const nx of [18, 28, c.width - 28, c.width - 18]) {
      ctx.beginPath();
      ctx.arc(nx, y + ph * 0.5, 2.1, 0, TAU);
      ctx.fill();
    }
  }

  // Subtle painted center coastal guide dashes
  ctx.fillStyle = 'rgba(255, 249, 232, 0.42)';
  for (let y = 16; y < c.height; y += 64) {
    ctx.fillRect(c.width * 0.5 - 3, y, 6, 28);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Procedural red-and-white lighthouse stripe texture.
 */
function createLighthouseTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const bands = 6;
  const bh = c.height / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#faf4e8' : '#d83b31';
    ctx.fillRect(0, i * bh, c.width, bh + 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const ATMOSPHERE_THEMES = [
  {
    id: 'noon',
    name: '晴午海风',
    skyTop: new THREE.Color(0x2884e0),
    skyHorizon: new THREE.Color(0xc2eeff),
    fogColor: new THREE.Color(0xbcecff),
    sunColor: new THREE.Color(0xfff7e2),
    sunIntensity: 2.35,
    sunPos: new THREE.Vector3(38, 56, 28),
    hemiSky: new THREE.Color(0xa6e5ff),
    hemiGround: new THREE.Color(0xdcb07c),
    hemiIntensity: 1.08,
    waterDeep: new THREE.Color(0x1680b5),
    waterShallow: new THREE.Color(0x3be0cf),
    waterFoam: new THREE.Color(0xfaffff),
    nightFactor: 0.0,
  },
  {
    id: 'dusk',
    name: '金昏晚照',
    skyTop: new THREE.Color(0x3b3573),
    skyHorizon: new THREE.Color(0xff9e6d),
    fogColor: new THREE.Color(0xf49d78),
    sunColor: new THREE.Color(0xffaa5c),
    sunIntensity: 2.15,
    sunPos: new THREE.Vector3(-54, 21, -36),
    hemiSky: new THREE.Color(0xffb48a),
    hemiGround: new THREE.Color(0x6b4557),
    hemiIntensity: 0.92,
    waterDeep: new THREE.Color(0x1b3764),
    waterShallow: new THREE.Color(0x2d8f99),
    waterFoam: new THREE.Color(0xffe5cc),
    nightFactor: 0.42,
  },
  {
    id: 'night',
    name: '星夜萤海',
    skyTop: new THREE.Color(0x071026),
    skyHorizon: new THREE.Color(0x16315c),
    fogColor: new THREE.Color(0x12294d),
    sunColor: new THREE.Color(0x8dbdff),
    sunIntensity: 0.95,
    sunPos: new THREE.Vector3(30, 44, -40),
    hemiSky: new THREE.Color(0x3a649e),
    hemiGround: new THREE.Color(0x1a2840),
    hemiIntensity: 0.72,
    waterDeep: new THREE.Color(0x061933),
    waterShallow: new THREE.Color(0x0e5e78),
    waterFoam: new THREE.Color(0x6ef7e8),
    nightFactor: 1.0,
  },
];

export function createCoastalWorld(scene, sharedFishMaterials) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // =========================================================================
  // 1. SKY DOME, STARFIELD & DIRECTIONAL / HEMISPHERE LIGHTING
  // =========================================================================
  const skyUniforms = {
    uTopColor: { value: ATMOSPHERE_THEMES[0].skyTop.clone() },
    uHorizonColor: { value: ATMOSPHERE_THEMES[0].skyHorizon.clone() },
  };
  const skyGeo = new THREE.SphereGeometry(210, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y * 1.35 + 0.06, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.65));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  worldGroup.add(skyDome);

  // Twinkling night starfield
  const starCount = 320;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * TAU;
    const phi = Math.acos(0.12 + Math.random() * 0.88);
    const r = 195;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe8f4ff,
    size: 1.5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const starField = new THREE.Points(starGeo, starMat);
  worldGroup.add(starField);

  scene.fog = new THREE.FogExp2(ATMOSPHERE_THEMES[0].fogColor.getHex(), 0.0062);

  const hemiLight = new THREE.HemisphereLight(
    ATMOSPHERE_THEMES[0].hemiSky.getHex(),
    ATMOSPHERE_THEMES[0].hemiGround.getHex(),
    ATMOSPHERE_THEMES[0].hemiIntensity
  );
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(
    ATMOSPHERE_THEMES[0].sunColor.getHex(),
    ATMOSPHERE_THEMES[0].sunIntensity
  );
  dirLight.position.copy(ATMOSPHERE_THEMES[0].sunPos);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near = 8;
  dirLight.shadow.camera.far = 140;
  const shadowExtent = 38;
  dirLight.shadow.camera.left = -shadowExtent;
  dirLight.shadow.camera.right = shadowExtent;
  dirLight.shadow.camera.top = shadowExtent;
  dirLight.shadow.camera.bottom = -shadowExtent;
  dirLight.shadow.bias = -0.0006;
  scene.add(dirLight);

  // =========================================================================
  // 2. CLOSED SCENIC COASTAL CAUSEWAY SPLINE LOOP
  // =========================================================================
  const ROAD_HALF_WIDTH = 2.35;
  const controlPts = [
    new THREE.Vector3(26, 1.38, 0),       // u ~ 0.00: Sunlit East Pier (Start!)
    new THREE.Vector3(23, 1.45, 16),      // u ~ 0.08: Gentle bay bend
    new THREE.Vector3(12, 2.05, 26),      // u ~ 0.17: Bridge approach ramp
    new THREE.Vector3(-2, 4.15, 28),      // u ~ 0.27: Arched Stone Bridge Crest!
    new THREE.Vector3(-16, 2.15, 23),     // u ~ 0.37: Bridge descent
    new THREE.Vector3(-26, 1.52, 11),     // u ~ 0.46: West Turquoise Cove
    new THREE.Vector3(-28, 1.68, -5),     // u ~ 0.56: Windmill Pine Headland
    new THREE.Vector3(-21, 1.55, -19),    // u ~ 0.66: South Causeway
    new THREE.Vector3(-7, 1.42, -26),     // u ~ 0.76: Lighthouse Bay Curve
    new THREE.Vector3(9, 1.38, -24),      // u ~ 0.85: Harbor Fish Delivery Quay!
    new THREE.Vector3(21, 1.38, -14),     // u ~ 0.93: Harbor Exit back to East Pier
  ];
  const trackCurve = new THREE.CatmullRomCurve3(controlPts, true, 'catmullrom', 0.5);
  const trackLength = trackCurve.getLength();

  const _pt = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _left = new THREE.Vector3();

  function sampleTrack(s) {
    const u = ((s % trackLength) + trackLength) % trackLength / trackLength;
    trackCurve.getPointAt(u, _pt);
    trackCurve.getTangentAt(u, _tan);

    _fwd.set(_tan.x, 0, _tan.z);
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();

    // UP x forward = rider's LEFT (+X in bike local coordinates)
    _left.crossVectors(UP, _fwd).normalize();

    // Positive _tan.y (uphill) -> negative X rotation lifts +Z front wheel up!
    const slopePitch = -Math.asin(clamp(_tan.y, -0.55, 0.55));
    return {
      u,
      point: _pt.clone(),
      forward: _fwd.clone(),
      left: _left.clone(),
      slopePitch,
    };
  }

  // Build swept Cedar Boardwalk Deck + Side Curbs + Under-deck Beam
  const boardwalkTex = createBoardwalkTexture();
  const deckMat = new THREE.MeshStandardMaterial({
    map: boardwalkTex,
    roughness: 0.74,
    metalness: 0.04,
  });
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xa66e3c,
    roughness: 0.78,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xe6dcc8,
    roughness: 0.85,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xc2b59b,
    roughness: 0.88,
  });
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x62a856,
    roughness: 0.82,
  });
  const pineMat = new THREE.MeshStandardMaterial({
    color: 0x2f7547,
    roughness: 0.78,
  });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff3cc,
    emissive: 0xffb347,
    emissiveIntensity: 0.25,
    roughness: 0.2,
  });

  const SEGMENTS = 260;
  const deckPositions = [];
  const deckNormals = [];
  const deckUVs = [];
  const deckIndices = [];

  // Cross-section profile: outer-left bottom -> outer-left curb -> deck-left -> deck-right -> outer-right curb -> outer-right bottom
  const profX = [-(ROAD_HALF_WIDTH + 0.22), -(ROAD_HALF_WIDTH + 0.18), -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, ROAD_HALF_WIDTH + 0.18, ROAD_HALF_WIDTH + 0.22];
  const profY = [-0.24, 0.09, 0.0, 0.0, 0.09, -0.24];
  const profU = [0, 0.03, 0.06, 0.94, 0.97, 1.0];
  const profCount = profX.length;

  for (let i = 0; i <= SEGMENTS; i++) {
    const u = i / SEGMENTS;
    const sample = sampleTrack(u * trackLength);
    const vCoord = u * 48;
    for (let j = 0; j < profCount; j++) {
      const wx = sample.point.x + sample.left.x * profX[j];
      const wy = sample.point.y + profY[j];
      const wz = sample.point.z + sample.left.z * profX[j];
      deckPositions.push(wx, wy, wz);
      deckNormals.push(0, 1, 0);
      deckUVs.push(profU[j], vCoord);
    }
  }

  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < profCount - 1; j++) {
      const a = i * profCount + j;
      const b = (i + 1) * profCount + j;
      const c = (i + 1) * profCount + (j + 1);
      const d = i * profCount + (j + 1);
      // Verify CCW winding facing +Y:
      // a = (s_i, left_j), b = (s_{i+1}, left_j) [+fwd], d = (s_i, left_{j+1}) [-left = right]
      // (b - a) x (d - a) = fwd x (-left) = fwd x (fwd x UP) -> wait: UP x fwd = left => fwd x (-left) = +UP!
      deckIndices.push(a, b, c, a, c, d);
    }
  }

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPositions, 3));
  deckGeo.setAttribute('normal', new THREE.Float32BufferAttribute(deckNormals, 3));
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(deckUVs, 2));
  deckGeo.setIndex(deckIndices);
  deckGeo.computeVertexNormals();

  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.receiveShadow = true;
  deckMesh.castShadow = true;
  worldGroup.add(deckMesh);

  // Timber Pilings, Stone Bridge Arch Buttresses, Bollards & Pier String-Lanterns
  const pilingCount = 36;
  const bollardPositions = [];
  for (let i = 0; i < pilingCount; i++) {
    const u = i / pilingCount;
    const sample = sampleTrack(u * trackLength);
    const isStoneBridge = u > 0.18 && u < 0.36;

    for (const side of [-1, 1]) {
      const px = sample.point.x + sample.left.x * side * (ROAD_HALF_WIDTH - 0.15);
      const pz = sample.point.z + sample.left.z * side * (ROAD_HALF_WIDTH - 0.15);
      const h = sample.point.y + 1.4;

      const postGeo = new THREE.CylinderGeometry(
        isStoneBridge ? 0.24 : 0.13,
        isStoneBridge ? 0.30 : 0.15,
        h,
        8
      );
      const post = new THREE.Mesh(postGeo, isStoneBridge ? stoneMat : curbMat);
      post.position.set(px, sample.point.y - h * 0.5 - 0.05, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      worldGroup.add(post);

      // Outer wooden bollard every second station + warm coastal lantern every fourth
      if (i % 2 === 0) {
        const bx = sample.point.x + sample.left.x * side * (ROAD_HALF_WIDTH + 0.14);
        const bz = sample.point.z + sample.left.z * side * (ROAD_HALF_WIDTH + 0.14);
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.52, 8), curbMat);
        bollard.position.set(bx, sample.point.y + 0.26, bz);
        bollard.castShadow = true;
        worldGroup.add(bollard);

        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.088, 8, 6), stoneMat);
        cap.position.set(bx, sample.point.y + 0.52, bz);
        worldGroup.add(cap);

        if (side === -1) {
          bollardPositions.push(new THREE.Vector3(bx, sample.point.y + 0.56, bz));
        }

        if (i % 4 === 0 && side === 1) {
          // Tall shepherd-hook pier lantern post
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 1.85, 6), curbMat);
          pole.position.set(bx, sample.point.y + 0.92, bz);
          worldGroup.add(pole);

          const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lanternGlowMat);
          lantern.position.set(bx - sample.left.x * 0.12, sample.point.y + 1.78, bz - sample.left.z * 0.12);
          worldGroup.add(lantern);
        }
      }
    }
  }

  // =========================================================================
  // 3. CUSTOM ANIMATED OCEAN SHADER (Turquoise Lagoon + Foam + Night Bioluminescence)
  // =========================================================================
  const waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: ATMOSPHERE_THEMES[0].waterDeep.clone() },
    uShallowColor: { value: ATMOSPHERE_THEMES[0].waterShallow.clone() },
    uFoamColor: { value: ATMOSPHERE_THEMES[0].waterFoam.clone() },
    uHorizonColor: { value: ATMOSPHERE_THEMES[0].skyHorizon.clone() },
    uSunDir: { value: ATMOSPHERE_THEMES[0].sunPos.clone().normalize() },
    uSunColor: { value: ATMOSPHERE_THEMES[0].sunColor.clone() },
    uNightFactor: { value: 0 },
  };

  const waterGeo = new THREE.PlaneGeometry(420, 420, 96, 96);
  waterGeo.rotateX(-Math.PI * 0.5);

  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.18 + uTime * 1.45) * cos(p.z * 0.15 + uTime * 1.15);
        float w2 = sin((p.x + p.z) * 0.34 - uTime * 2.1) * 0.45;
        p.y += (w1 * 0.14 + w2 * 0.07);
        vWave = w1 + w2;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uNightFactor;
      varying vec3 vWorldPos;
      varying float vWave;

      void main() {
        float r = length(vWorldPos.xz);
        // Broad turquoise coastal shelf around the ~26m bay loop + outer sandbars + islets
        float ringDist = abs(r - 25.5);
        float outerBar = smoothstep(18.0, 3.0, abs(r - 56.0)) * 0.42;
        float centerIsle = smoothstep(18.0, 4.0, length(vWorldPos.xz - vec2(-4.0, -3.0)));
        float lighthouseIsle = smoothstep(16.0, 5.0, length(vWorldPos.xz - vec2(4.0, -34.0)));
        float windmillIsle = smoothstep(17.0, 5.5, length(vWorldPos.xz - vec2(-36.0, -6.0)));

        float shallow = clamp(smoothstep(22.0, 1.5, ringDist) * 0.82 + outerBar + centerIsle + lighthouseIsle + windmillIsle, 0.0, 1.0);
        vec3 baseCol = mix(uDeepColor, uShallowColor, shallow);

        // Shimmering caustic/ripple lines
        float ripple = sin(vWorldPos.x * 0.85 + uTime * 2.2) * sin(vWorldPos.z * 0.85 - uTime * 1.8);
        float foamBand = smoothstep(0.72, 0.95, shallow + ripple * 0.15);
        float crestFoam = smoothstep(0.88, 1.28, vWave + ripple * 0.35) * 0.36;

        // Sun / Moon specular sparkle
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 n = normalize(vec3(
          cos(vWorldPos.x * 0.55 + uTime * 1.9) * 0.14,
          1.0,
          sin(vWorldPos.z * 0.55 - uTime * 1.6) * 0.14
        ));
        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(n, halfVec), 0.0), 42.0) * 0.78;

        // Magical bioluminescent plankton sparkles at night!
        float bioPattern = sin(vWorldPos.x * 1.9 + uTime * 2.6) * cos(vWorldPos.z * 1.9 - uTime * 2.3);
        float bioGlow = smoothstep(0.76, 0.98, bioPattern) * shallow * uNightFactor * 0.85;

        vec3 col = baseCol;
        col = mix(col, uFoamColor, clamp(foamBand * 0.58 + crestFoam, 0.0, 0.85));
        col += uSunColor * spec;
        col += vec3(0.18, 0.95, 0.88) * bioGlow;

        // Seamless atmospheric horizon mist into sky horizon color!
        float distFade = smoothstep(58.0, 200.0, r);
        col = mix(col, uHorizonColor, distFade * 0.88);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0;
  worldGroup.add(waterMesh);

  // =========================================================================
  // 4. SCENIC LANDMARKS: LIGHTHOUSE, WINDMILL ISLET, HARBOR DELIVERY DOCK, CLOUDS
  // =========================================================================
  const lighthouseTex = createLighthouseTexture();
  const lighthouseMat = new THREE.MeshStandardMaterial({ map: lighthouseTex, roughness: 0.48 });
  const redAccentMat = new THREE.MeshStandardMaterial({ color: 0xd83b31, roughness: 0.42 });
  const whitePlasterMat = new THREE.MeshStandardMaterial({ color: 0xfaf4e8, roughness: 0.68 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xe6b44c, roughness: 0.25, metalness: 0.7 });

  // 4A. Central Lagoon Coral & Pine Islet (gives rich parallax while orbiting/riding!)
  const centerIsleGroup = new THREE.Group();
  centerIsleGroup.position.set(-4, 0, -3);
  worldGroup.add(centerIsleGroup);

  const cBase = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 8.2, 2.2, 14), rockMat);
  cBase.position.y = 0.6;
  cBase.receiveShadow = true;
  centerIsleGroup.add(cBase);

  const cTurf = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.5, 0.8, 14), grassMat);
  cTurf.position.y = 1.75;
  cTurf.receiveShadow = true;
  centerIsleGroup.add(cTurf);

  function addCoastalPine(parent, x, y, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.4, 7), curbMat);
    trunk.position.y = 1.2;
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    g.add(trunk);
    for (let layer = 0; layer < 3; layer++) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.45 - layer * 0.28, 1.35, 9),
        pineMat
      );
      crown.position.set(0.08 * layer, 2.2 + layer * 0.78, 0);
      crown.castShadow = true;
      g.add(crown);
    }
    parent.add(g);
  }
  addCoastalPine(centerIsleGroup, -1.2, 2.1, 0.6, 1.15);
  addCoastalPine(centerIsleGroup, 1.6, 2.0, -1.1, 0.88);

  // 4B. Red-and-White Striped Lighthouse on South Rocky Headland (near Harbor Delivery Quay!)
  const lighthouseGroup = new THREE.Group();
  lighthouseGroup.position.set(4.5, 0, -34.5);
  worldGroup.add(lighthouseGroup);

  const lhRock = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 7.8, 3.2, 12), rockMat);
  lhRock.position.y = 1.1;
  lhRock.receiveShadow = true;
  lighthouseGroup.add(lhRock);

  const lhTower = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 2.05, 10.5, 16), lighthouseMat);
  lhTower.position.y = 7.6;
  lhTower.castShadow = true;
  lighthouseGroup.add(lhTower);

  const lhGallery = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.65, 0.45, 16), whitePlasterMat);
  lhGallery.position.y = 13.0;
  lighthouseGroup.add(lhGallery);

  const lhLantern = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.65, 14), lanternGlowMat);
  lhLantern.position.y = 14.0;
  lighthouseGroup.add(lhLantern);

  const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.45, 16), redAccentMat);
  lhRoof.position.y = 15.5;
  lighthouseGroup.add(lhRoof);

  // Rotating Lighthouse Volumetric Searchlight Beam!
  const lhBeamPivot = new THREE.Group();
  lhBeamPivot.position.y = 14.0;
  lighthouseGroup.add(lhBeamPivot);

  const lhBeamGeo = new THREE.ConeGeometry(4.2, 34, 20, 1, true);
  lhBeamGeo.translate(0, -17, 0);
  lhBeamGeo.rotateX(-Math.PI * 0.5);
  const lhBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffe699,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const lhBeamMesh = new THREE.Mesh(lhBeamGeo, lhBeamMat);
  lhBeamMesh.rotation.x = 0.12;
  lhBeamPivot.add(lhBeamMesh);

  // 4C. Whitewashed Coastal Windmill on West Headland (`-36, 0, -6`)
  const windmillGroup = new THREE.Group();
  windmillGroup.position.set(-36.5, 0, -6);
  windmillGroup.rotation.y = 1.25;
  worldGroup.add(windmillGroup);

  const wmRock = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 8.4, 2.8, 12), rockMat);
  wmRock.position.y = 0.9;
  windmillGroup.add(wmRock);

  const wmTurf = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.8, 0.7, 12), grassMat);
  wmTurf.position.y = 2.4;
  windmillGroup.add(wmTurf);

  const wmBody = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 2.25, 6.8, 14), whitePlasterMat);
  wmBody.position.y = 6.0;
  wmBody.castShadow = true;
  windmillGroup.add(wmBody);

  const wmCap = new THREE.Mesh(new THREE.ConeGeometry(1.95, 1.8, 14), curbMat);
  wmCap.position.y = 10.2;
  windmillGroup.add(wmCap);

  const windmillRotor = new THREE.Group();
  windmillRotor.position.set(0, 8.8, 1.88);
  windmillGroup.add(windmillRotor);

  const sailMat = new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.65, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * TAU;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.6, 0.12), curbMat);
    spar.position.y = 2.3;
    arm.add(spar);

    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 3.5), sailMat);
    sail.position.set(0.52, 2.65, 0.04);
    sail.rotation.y = 0.14;
    arm.add(sail);
    windmillRotor.add(arm);
  }
  addCoastalPine(windmillGroup, -2.6, 2.7, -1.8, 1.0);

  // 4D. Harbor Fish Delivery Quay & Oversized Woven Harbor Basket + Floating Bell-Buoy!
  const DELIVERY_U = 0.875;
  const deliverySample = sampleTrack(DELIVERY_U * trackLength);
  const harborDockPos = deliverySample.point
    .clone()
    .addScaledVector(deliverySample.left, -(ROAD_HALF_WIDTH + 2.35));

  const harborGroup = new THREE.Group();
  harborGroup.position.copy(harborDockPos);
  // Orient dock parallel to causeway
  harborGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), deliverySample.forward);
  worldGroup.add(harborGroup);

  const dockPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.28, 6.2), curbMat);
  dockPlatform.position.y = -0.06;
  dockPlatform.receiveShadow = true;
  harborGroup.add(dockPlatform);

  // Oversized Woven Harbor Fish Basket (target where pelican tosses caught fish!)
  const harborBasket = new THREE.Group();
  harborBasket.position.set(0.15, 0.65, 0);
  harborGroup.add(harborBasket);

  const basketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.68, 1.15, 14), curbMat);
  basketBody.castShadow = true;
  harborBasket.add(basketBody);

  const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.11, 10, 20), brassMat);
  basketRim.rotation.x = Math.PI * 0.5;
  basketRim.position.y = 0.56;
  harborBasket.add(basketRim);

  // Glowing golden aura ring around harbor basket so players spot the delivery point effortlessly!
  const basketHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.22, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd45c, transparent: true, opacity: 0.75 })
  );
  basketHalo.rotation.x = Math.PI * 0.5;
  basketHalo.position.y = 0.05;
  harborBasket.add(basketHalo);

  // Festive Harbor Arch Signpost
  for (const zP of [-2.4, 2.4]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.2, 8), whitePlasterMat);
    p.position.set(-0.9, 1.5, zP);
    harborGroup.add(p);
  }
  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 5.2), redAccentMat);
  archBeam.position.set(-0.9, 3.05, 0);
  harborGroup.add(archBeam);

  // Moored wooden fishing dory + bobbing Brass Bell-Buoy beside the Harbor Quay
  const boatGroup = new THREE.Group();
  boatGroup.position.set(harborDockPos.x + 3.6, 0.16, harborDockPos.z - 2.4);
  worldGroup.add(boatGroup);
  const hullGeo = new THREE.SphereGeometry(1.1, 12, 8, 0, TAU, Math.PI * 0.5, Math.PI * 0.5);
  hullGeo.scale(0.85, 0.68, 2.2);
  const hull = new THREE.Mesh(hullGeo, whitePlasterMat);
  hull.position.y = 0.55;
  boatGroup.add(hull);
  const gunwale = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.08, 8, 20), redAccentMat);
  gunwale.rotation.x = Math.PI * 0.5;
  gunwale.scale.set(0.82, 2.15, 1);
  gunwale.position.y = 0.55;
  boatGroup.add(gunwale);

  const buoyGroup = new THREE.Group();
  buoyGroup.position.set(harborDockPos.x + 2.8, 0.1, harborDockPos.z + 3.6);
  worldGroup.add(buoyGroup);
  const buoyFloat = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 0.6, 12), redAccentMat);
  buoyFloat.position.y = 0.2;
  buoyGroup.add(buoyFloat);
  const buoyCage = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.35, 6, 1, true), brassMat);
  buoyCage.position.y = 1.15;
  buoyGroup.add(buoyCage);

  // Drifting Low-Poly Cumulus Clouds + Distant Coastal Sailboats
  const sailboats = [];
  for (let s = 0; s < 5; s++) {
    const sg = new THREE.Group();
    const sHull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 0.55, 8), s % 2 === 0 ? whitePlasterMat : redAccentMat);
    sHull.scale.set(0.75, 1, 2.5);
    sHull.position.y = 0.2;
    sg.add(sHull);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.8, 6), curbMat);
    mast.position.y = 2.5;
    sg.add(mast);

    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 4.1);
    sailShape.lineTo(2.35, 0.35);
    sailShape.closePath();
    const mainSail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), sailMat);
    mainSail.rotation.y = Math.PI * 0.5;
    mainSail.position.set(0, 0.65, 0.1);
    sg.add(mainSail);

    worldGroup.add(sg);
    sailboats.push({
      group: sg,
      angle: (s / 5) * TAU + 0.4,
      radius: 52 + (s % 3) * 14,
      speed: (s % 2 === 0 ? 1 : -1) * (0.014 + s * 0.002),
      phase: s * 1.3,
    });
  }

  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
  });
  for (let c = 0; c < 9; c++) {
    const cg = new THREE.Group();
    const angle = (c / 9) * TAU;
    const dist = 58 + (c % 3) * 18;
    const puffs = 3 + (c % 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.4 + (p % 2) * 1.1, 10, 8), cloudMat);
      puff.position.set((p - 1.2) * 2.3, (p % 2) * 0.7, (p % 3 - 1) * 0.8);
      puff.scale.set(1.3, 0.78, 1.0);
      cg.add(puff);
    }
    worldGroup.add(cg);
    clouds.push({
      group: cg,
      angle,
      dist,
      height: 22 + (c % 4) * 5.5,
      speed: 0.012 + (c % 3) * 0.004,
    });
  }

  // =========================================================================
  // 5. INTERACTIVE ENTITIES: FLYING FISH, WIND BOOST RINGS, GULLS & PARTICLES
  // =========================================================================
  // 5A. 3 Breezy Coastal Tailwind Rings (`海风加速圈`)
  const windRingDefs = [
    { u: 0.272, heightOffset: 1.48, lateral: 0.0 },   // High above the Stone Arch Bridge crest (rewards Wing-Glide!)
    { u: 0.565, heightOffset: 0.95, lateral: -0.65 }, // Windmill headland curve
    { u: 0.065, heightOffset: 0.95, lateral: 0.65 },  // East Pier sprint stretch
  ];
  const windRingMat = new THREE.MeshBasicMaterial({
    color: 0x6df7f0,
    transparent: true,
    opacity: 0.68,
  });
  const windRings = windRingDefs.map((def) => {
    const smp = sampleTrack(def.u * trackLength);
    const g = new THREE.Group();
    g.position
      .copy(smp.point)
      .addScaledVector(smp.left, def.lateral)
      .add(new THREE.Vector3(0, def.heightOffset, 0));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), smp.forward);

    const outer = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.045, 10, 28), windRingMat);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.028, 8, 24, Math.PI * 1.45),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 })
    );
    g.add(outer, inner);
    worldGroup.add(g);
    return { group: g, outer, inner, cooldown: 0 };
  });

  // 5B. Shoal of 16 Silver & Golden Flying Fish
  const fishList = [];
  const FISH_COUNT = 16;
  for (let i = 0; i < FISH_COUNT; i++) {
    const isGold = i % 5 === 4;
    const mesh = createFishMesh(sharedFishMaterials, isGold);
    mesh.scale.setScalar(isGold ? 1.42 : 1.18);
    worldGroup.add(mesh);

    // Shadow/ripple ring on deck or water directly below leaping fish for effortless 3D depth reading!
    const shadowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.26, 16),
      new THREE.MeshBasicMaterial({
        color: isGold ? 0xffd24c : 0x7be8ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    shadowRing.rotation.x = -Math.PI * 0.5;
    worldGroup.add(shadowRing);

    fishList.push({
      mesh,
      shadowRing,
      isGold,
      u: (i / FISH_COUNT + Math.random() * 0.03) % 1,
      swimSpeedU: 0.011 + Math.random() * 0.008,
      sideSign: i % 2 === 0 ? 1 : -1,
      state: 'swim', // 'swim' | 'leap' | 'cooldown'
      timer: Math.random() * 2.5,
      leapDuration: 1.65,
      leapPeakOffset: isGold ? 2.15 : 1.32,
      startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      prevPos: new THREE.Vector3(),
    });
  }

  // 5C. Parabolic Harbor Delivery Fish Projectiles (tossed from Pelican beak -> Harbor Basket!)
  const deliveryArcs = [];
  for (let i = 0; i < 8; i++) {
    const m = createFishMesh(sharedFishMaterials, i % 3 === 0);
    m.visible = false;
    worldGroup.add(m);
    deliveryArcs.push({
      mesh: m,
      active: false,
      t: 0,
      duration: 0.68,
      p0: new THREE.Vector3(),
      p1: new THREE.Vector3(),
    });
  }

  // 5D. Perched Coastal Seagulls on Pier Bollards (flutter up when bike bell rings!)
  const gulls = [];
  const gullCount = Math.min(6, bollardPositions.length);
  for (let i = 0; i < gullCount; i++) {
    const perchPos = bollardPositions[Math.floor((i * bollardPositions.length) / gullCount)];
    const gg = new THREE.Group();
    gg.position.copy(perchPos);
    gg.rotation.y = Math.random() * TAU;

    const gBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), whitePlasterMat);
    gBody.scale.set(0.8, 0.85, 1.45);
    gg.add(gBody);

    const gHead = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), whitePlasterMat);
    gHead.position.set(0, 0.1, 0.11);
    gg.add(gHead);

    const gBeak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 6), brassMat);
    gBeak.rotation.x = Math.PI * 0.5;
    gBeak.position.set(0, 0.09, 0.19);
    gg.add(gBeak);

    const wingGeo = new THREE.BoxGeometry(0.28, 0.018, 0.11);
    wingGeo.translate(0.14, 0, 0);
    const wL = new THREE.Mesh(wingGeo, whitePlasterMat);
    wL.position.set(0.04, 0.03, 0);
    const wR = new THREE.Mesh(wingGeo, whitePlasterMat);
    wR.scale.x = -1;
    wR.position.set(-0.04, 0.03, 0);
    gg.add(wL, wR);

    worldGroup.add(gg);
    gulls.push({
      group: gg,
      wL,
      wR,
      perchPos: perchPos.clone(),
      flyTimer: 0,
      phase: Math.random() * TAU,
    });
  }

  // 5E. Pooled Particle Rings & Droplets (Acoustic Bell Waves + Water Splashes + Gold Delivery Sparks)
  const waveRings = [];
  for (let i = 0; i < 8; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.44, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfff3a8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.visible = false;
    worldGroup.add(ring);
    waveRings.push({ mesh: ring, active: false, t: 0, duration: 0.85, maxScale: 8.0 });
  }

  const PARTICLE_POOL = 54;
  const dropletGeo = new THREE.SphereGeometry(0.065, 6, 6);
  const particles = [];
  for (let i = 0; i < PARTICLE_POOL; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(dropletGeo, mat);
    mesh.visible = false;
    worldGroup.add(mesh);
    particles.push({
      mesh,
      active: false,
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0.6,
      gravity: 9.5,
    });
  }

  function spawnWaveRing(pos, colorHex = 0xfff3a8, maxScale = 7.5, duration = 0.85) {
    const slot = waveRings.find((r) => !r.active) || waveRings[0];
    slot.active = true;
    slot.t = 0;
    slot.duration = duration;
    slot.maxScale = maxScale;
    slot.mesh.position.copy(pos);
    slot.mesh.material.color.setHex(colorHex);
    slot.mesh.scale.setScalar(0.2);
    slot.mesh.visible = true;
  }

  function spawnBurst(origin, count = 8, colorHex = 0xbef6ff, speed = 3.6, gravity = 9.8) {
    let spawned = 0;
    for (const p of particles) {
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.42 + Math.random() * 0.28;
      p.gravity = gravity;
      p.mesh.position.copy(origin);
      p.mesh.material.color.setHex(colorHex);
      p.mesh.material.opacity = 0.92;
      p.mesh.scale.setScalar(0.65 + Math.random() * 0.75);
      p.mesh.visible = true;
      const a = Math.random() * TAU;
      const rSpd = (0.35 + Math.random() * 0.65) * speed;
      p.vel.set(Math.cos(a) * rSpd, (0.65 + Math.random() * 0.75) * speed, Math.sin(a) * rSpd);
      if (++spawned >= count) break;
    }
  }

  function startFishLeap(f, forceImmediateNearLane = null) {
    const smp = sampleTrack(f.u * trackLength);
    const fromSide = f.sideSign;
    const startOut = ROAD_HALF_WIDTH + 2.8 + Math.random() * 1.6;
    f.startPos
      .copy(smp.point)
      .addScaledVector(smp.left, fromSide * startOut);
    f.startPos.y = -0.15;

    // Arc gracefully over the boardwalk deck (either crossing all the way or landing across the lane)
    const targetLat =
      forceImmediateNearLane !== null
        ? clamp(forceImmediateNearLane + (Math.random() - 0.5) * 0.9, -ROAD_HALF_WIDTH * 0.8, ROAD_HALF_WIDTH * 0.8)
        : -fromSide * (ROAD_HALF_WIDTH + 2.4);
    const endDist = forceImmediateNearLane !== null ? -fromSide * (ROAD_HALF_WIDTH + 2.2) : targetLat;

    f.endPos
      .copy(smp.point)
      .addScaledVector(smp.forward, 3.2)
      .addScaledVector(smp.left, endDist);
    f.endPos.y = -0.15;

    f.leapPeakOffset = smp.point.y + (f.isGold ? 2.15 : 1.15 + Math.random() * 0.45);
    f.leapDuration = f.isGold ? 1.85 : 1.6;
    f.state = 'leap';
    f.timer = 0;
    f.prevPos.copy(f.startPos);
    spawnWaveRing(new THREE.Vector3(f.startPos.x, 0.06, f.startPos.z), 0x9cf5ff, 2.4, 0.55);
  }

  /**
   * Triggered when player rings the brass handlebar bell (`B` or `铃`):
   * Emits golden acoustic wave ring, startles nearby perched gulls into flight,
   * and lures up to 4 swimming silver/golden fish ahead to leap across the boardwalk!
   */
  function triggerBellLure(bikePos, bikeLateralOffset) {
    spawnWaveRing(new THREE.Vector3(bikePos.x, bikePos.y + 0.65, bikePos.z), 0xffe47a, 9.5, 0.9);

    let lured = 0;
    for (const f of fishList) {
      if (f.state !== 'swim') continue;
      if (f.mesh.position.distanceToSquared(bikePos) < 28 * 28) {
        startFishLeap(f, bikeLateralOffset);
        if (++lured >= 4) break;
      }
    }

    for (const g of gulls) {
      if (g.flyTimer <= 0 && g.perchPos.distanceToSquared(bikePos) < 22 * 22) {
        g.flyTimer = 4.2 + Math.random() * 1.5;
      }
    }
    return lured;
  }

  function launchFishToHarbor(fromWorldPos) {
    const slot = deliveryArcs.find((a) => !a.active);
    if (!slot) return;
    slot.active = true;
    slot.t = 0;
    slot.p0.copy(fromWorldPos);
    harborBasket.getWorldPosition(slot.p1);
    slot.p1.y += 0.35;
    slot.mesh.position.copy(slot.p0);
    slot.mesh.visible = true;
  }

  // =========================================================================
  // 6. ATMOSPHERE INTERPOLATION & FRAME UPDATE
  // =========================================================================
  let currentThemeIdx = 0;
  let nightFactorSmooth = 0;
  let basketBounce = 0;
  const _targetWorldPos = new THREE.Vector3();
  const _fishNextPos = new THREE.Vector3();
  const _fishVelDir = new THREE.Vector3();

  function cycleTheme() {
    currentThemeIdx = (currentThemeIdx + 1) % ATMOSPHERE_THEMES.length;
    return ATMOSPHERE_THEMES[currentThemeIdx];
  }

  function getTheme() {
    return ATMOSPHERE_THEMES[currentThemeIdx];
  }

  function update(dt, elapsed, riderState, callbacks) {
    const theme = ATMOSPHERE_THEMES[currentThemeIdx];
    const lerpRate = 1 - Math.exp(-3.2 * dt);

    // Smoothly interpolate sky, fog, sun, hemisphere & water shader colors
    skyUniforms.uTopColor.value.lerp(theme.skyTop, lerpRate);
    skyUniforms.uHorizonColor.value.lerp(theme.skyHorizon, lerpRate);
    scene.fog.color.lerp(theme.fogColor, lerpRate);

    dirLight.color.lerp(theme.sunColor, lerpRate);
    dirLight.intensity = damp(dirLight.intensity, theme.sunIntensity, 3.2, dt);
    dirLight.position.lerp(theme.sunPos, lerpRate);

    hemiLight.color.lerp(theme.hemiSky, lerpRate);
    hemiLight.groundColor.lerp(theme.hemiGround, lerpRate);
    hemiLight.intensity = damp(hemiLight.intensity, theme.hemiIntensity, 3.2, dt);

    nightFactorSmooth = damp(nightFactorSmooth, theme.nightFactor, 3.2, dt);
    starMat.opacity = clamp((nightFactorSmooth - 0.35) / 0.65, 0, 0.92);
    lanternGlowMat.emissiveIntensity = lerp(0.2, 2.4, nightFactorSmooth);
    lhBeamMat.opacity = nightFactorSmooth * 0.22;

    waterUniforms.uTime.value = elapsed;
    waterUniforms.uDeepColor.value.lerp(theme.waterDeep, lerpRate);
    waterUniforms.uShallowColor.value.lerp(theme.waterShallow, lerpRate);
    waterUniforms.uFoamColor.value.lerp(theme.waterFoam, lerpRate);
    waterUniforms.uHorizonColor.value.lerp(theme.skyHorizon, lerpRate);
    waterUniforms.uSunDir.value.copy(dirLight.position).normalize();
    waterUniforms.uSunColor.value.copy(dirLight.color);
    waterUniforms.uNightFactor.value = nightFactorSmooth;

    for (const sb of sailboats) {
      sb.angle = (sb.angle + sb.speed * dt + TAU) % TAU;
      sb.group.position.set(
        Math.cos(sb.angle) * sb.radius,
        0.08 + Math.sin(elapsed * 1.6 + sb.phase) * 0.08,
        Math.sin(sb.angle) * sb.radius
      );
      sb.group.rotation.y = -sb.angle + (sb.speed > 0 ? 0 : Math.PI);
      sb.group.rotation.z = Math.sin(elapsed * 1.4 + sb.phase) * 0.07;
    }

    // Animate scenic landmarks (Windmill rotor, Lighthouse searchlight, Bobbing boat & buoy, Clouds)
    windmillRotor.rotation.z = -elapsed * 0.58;
    lhBeamPivot.rotation.y = elapsed * 0.62;

    boatGroup.position.y = 0.14 + Math.sin(elapsed * 1.7) * 0.08;
    boatGroup.rotation.z = Math.sin(elapsed * 1.3) * 0.055;
    boatGroup.rotation.x = Math.cos(elapsed * 1.1) * 0.04;

    buoyGroup.position.y = 0.08 + Math.cos(elapsed * 2.1) * 0.09;
    buoyGroup.rotation.z = Math.sin(elapsed * 1.9 + 0.8) * 0.11;

    basketHalo.scale.setScalar(1 + Math.sin(elapsed * 3.4) * 0.06);
    if (basketBounce > 0) {
      basketBounce = Math.max(0, basketBounce - dt * 3.5);
      const s = 1 + Math.sin(basketBounce * 18) * 0.14 * basketBounce;
      harborBasket.scale.set(s, 2 - s, s);
    } else {
      harborBasket.scale.set(1, 1, 1);
    }

    for (const c of clouds) {
      c.angle = (c.angle + c.speed * dt) % TAU;
      c.group.position.set(Math.cos(c.angle) * c.dist, c.height, Math.sin(c.angle) * c.dist);
      c.group.rotation.y = -c.angle;
    }

    // Update Tailwind Boost Rings & check rider pass-through
    for (const ring of windRings) {
      ring.outer.rotation.z = elapsed * 1.8;
      ring.inner.rotation.z = -elapsed * 2.9;
      if (ring.cooldown > 0) ring.cooldown = Math.max(0, ring.cooldown - dt);

      if (ring.cooldown <= 0 && riderState.worldPos.distanceToSquared(ring.group.position) < 2.05 * 2.05) {
        ring.cooldown = 3.0;
        spawnBurst(ring.group.position, 12, 0x7efcf4, 4.6, 3.0);
        if (callbacks?.onWindBoost) callbacks.onWindBoost();
      }
    }

    // Update Seagulls (idle head-bob on bollard vs soaring circle when startled by bell)
    for (const g of gulls) {
      if (g.flyTimer > 0) {
        g.flyTimer = Math.max(0, g.flyTimer - dt);
        const p = 1 - g.flyTimer / 5.0;
        const lift = Math.sin(clamp(p, 0, 1) * Math.PI) * 4.2;
        const orbitA = elapsed * 2.2 + g.phase;
        const rad = Math.sin(clamp(p, 0, 1) * Math.PI) * 3.4;
        g.group.position.set(
          g.perchPos.x + Math.cos(orbitA) * rad,
          g.perchPos.y + lift,
          g.perchPos.z + Math.sin(orbitA) * rad
        );
        g.group.rotation.y = -orbitA + Math.PI;
        const flap = Math.sin(elapsed * 16 + g.phase) * 0.55;
        g.wL.rotation.z = flap;
        g.wR.rotation.z = -flap;
      } else {
        g.group.position.copy(g.perchPos);
        g.wL.rotation.z = 0.08;
        g.wR.rotation.z = -0.08;
        g.group.rotation.x = Math.sin(elapsed * 2.4 + g.phase) * 0.06;
      }
    }

    // Update Flying Fish (swim, spontaneous & bell-lured parabolic leaps, beak catch check!)
    let nearestLeapFishYaw = 0;
    let nearestFishDistSq = 11 * 11;

    for (const f of fishList) {
      f.mesh.userData.tail.rotation.y = Math.PI * 0.5 + Math.sin(elapsed * 22 + f.u * 30) * 0.38;

      if (f.state === 'swim') {
        f.u = (f.u + f.swimSpeedU * dt) % 1;
        const smp = sampleTrack(f.u * trackLength);
        const swimOut = ROAD_HALF_WIDTH + 2.6 + Math.sin(elapsed * 1.6 + f.u * 25) * 1.1;
        f.mesh.position
          .copy(smp.point)
          .addScaledVector(smp.left, f.sideSign * swimOut);
        f.mesh.position.y = -0.22 + Math.sin(elapsed * 3.1 + f.u * 19) * 0.06;
        f.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), smp.forward);
        f.shadowRing.material.opacity = 0;

        f.timer -= dt;
        // Spontaneous leaps ahead of the pelican so the world feels effortlessly alive!
        const distToRiderSq = f.mesh.position.distanceToSquared(riderState.worldPos);
        if (f.timer <= 0 && distToRiderSq < 34 * 34 && distToRiderSq > 6 * 6) {
          startFishLeap(f, null);
        } else if (f.timer <= 0) {
          f.timer = 1.4 + Math.random() * 2.4;
        }
      } else if (f.state === 'leap') {
        f.timer += dt;
        const p = f.timer / f.leapDuration;
        if (p >= 1) {
          spawnWaveRing(new THREE.Vector3(f.endPos.x, 0.06, f.endPos.z), 0x9cf5ff, 2.2, 0.5);
          f.sideSign *= -1;
          f.state = 'swim';
          f.timer = 2.0 + Math.random() * 2.8;
        } else {
          _fishNextPos.lerpVectors(f.startPos, f.endPos, p);
          // Smooth parabolic arc peaking at f.leapPeakOffset
          _fishNextPos.y = lerp(f.startPos.y, f.endPos.y, p) + 4 * p * (1 - p) * (f.leapPeakOffset + 0.15);

          _fishVelDir.subVectors(_fishNextPos, f.prevPos);
          if (_fishVelDir.lengthSq() > 1e-6) {
            f.mesh.position.copy(_fishNextPos);
            f.mesh.lookAt(_fishNextPos.clone().add(_fishVelDir));
          }
          f.prevPos.copy(_fishNextPos);

          // Project subtle target ring onto deck/water below leaping fish
          const smp = sampleTrack(f.u * trackLength);
          f.shadowRing.position.set(_fishNextPos.x, Math.max(0.05, smp.point.y + 0.03), _fishNextPos.z);
          f.shadowRing.material.opacity = Math.sin(p * Math.PI) * 0.55;

          // Curious pelican head-tracking toward nearest airborne fish
          const dSqToBeak = _fishNextPos.distanceToSquared(riderState.mouthPos);
          if (dSqToBeak < nearestFishDistSq) {
            nearestFishDistSq = dSqToBeak;
            const toFish = _fishNextPos.clone().sub(riderState.worldPos);
            const sideDot = toFish.dot(riderState.leftDir);
            nearestLeapFishYaw = clamp(sideDot * 0.22, -0.55, 0.55);
          }

          // Generous, joyful catch radius around Pelican's giant open bill & head!
          const catchRadius = riderState.bellActive ? 1.55 : 1.22;
          if (dSqToBeak < catchRadius * catchRadius) {
            spawnBurst(_fishNextPos, 10, f.isGold ? 0xffd859 : 0xbbf4ff, 3.8, 9.2);
            f.shadowRing.material.opacity = 0;
            f.state = 'swim';
            f.u = (f.u + 0.28 + Math.random() * 0.25) % 1;
            f.timer = 2.2 + Math.random() * 2.2;
            if (callbacks?.onCatchFish) callbacks.onCatchFish(f.isGold);
          }
        }
      }
    }

    // Check Harbor Delivery Quay proximity (`DELIVERY_U`)
    let uDiff = Math.abs(riderState.u - DELIVERY_U);
    if (uDiff > 0.5) uDiff = 1 - uDiff;
    if (uDiff < 0.042 && riderState.carryingFish > 0 && callbacks?.onHarborZone) {
      callbacks.onHarborZone(launchFishToHarbor);
    }

    // Animate parabolic fish delivery arcs into the Harbor Basket
    for (const arc of deliveryArcs) {
      if (!arc.active) continue;
      arc.t += dt;
      const p = arc.t / arc.duration;
      if (p >= 1) {
        arc.active = false;
        arc.mesh.visible = false;
        basketBounce = 1.0;
        harborBasket.getWorldPosition(_targetWorldPos);
        _targetWorldPos.y += 0.45;
        spawnBurst(_targetWorldPos, 12, 0xffd95c, 4.4, 8.5);
        spawnWaveRing(new THREE.Vector3(_targetWorldPos.x, _targetWorldPos.y, _targetWorldPos.z), 0xffe26a, 3.2, 0.6);
      } else {
        arc.mesh.position.lerpVectors(arc.p0, arc.p1, p);
        arc.mesh.position.y += 4 * p * (1 - p) * 2.6;
        arc.mesh.rotation.x += dt * 9.5;
        arc.mesh.rotation.y += dt * 4.2;
      }
    }

    // Update Wave Rings & Droplet Particles
    for (const r of waveRings) {
      if (!r.active) continue;
      r.t += dt;
      const p = r.t / r.duration;
      if (p >= 1) {
        r.active = false;
        r.mesh.visible = false;
      } else {
        const ease = 1 - Math.pow(1 - p, 2.4);
        r.mesh.scale.setScalar(0.25 + ease * r.maxScale);
        r.mesh.material.opacity = (1 - p) * 0.72;
      }
    }

    for (const pt of particles) {
      if (!pt.active) continue;
      pt.life += dt;
      const p = pt.life / pt.maxLife;
      if (p >= 1) {
        pt.active = false;
        pt.mesh.visible = false;
      } else {
        pt.vel.y -= pt.gravity * dt;
        pt.mesh.position.addScaledVector(pt.vel, dt);
        pt.mesh.material.opacity = (1 - p) * 0.9;
      }
    }

    return {
      nightFactor: nightFactorSmooth,
      lookOffsetYaw: nearestLeapFishYaw,
    };
  }

  return {
    trackLength,
    roadHalfWidth: ROAD_HALF_WIDTH,
    sampleTrack,
    triggerBellLure,
    spawnBurst,
    cycleTheme,
    getTheme,
    update,
  };
}
