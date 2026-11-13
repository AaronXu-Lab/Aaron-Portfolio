import * as THREE from '../vendor/three.min.js';

const CHUNK_LEN = 12;
const CHUNK_COUNT = 9;
const PIER_HALF_W = 2.25;
const SEA_Y = -0.88;

export const TIME_MODES = ['noon', 'sunset', 'night'];

const PRESETS = {
  noon: {
    skyTop: new THREE.Color(0x3a98e6),
    skyHorizon: new THREE.Color(0xc7eeff),
    sunColor: new THREE.Color(0xfff4d6),
    sunDir: new THREE.Vector3(0.48, 0.72, -0.5).normalize(),
    fogColor: new THREE.Color(0xbce8fc),
    fogDensity: 0.0068,
    hemiSky: new THREE.Color(0xcff0ff),
    hemiGround: new THREE.Color(0x4cb8c4),
    hemiIntensity: 1.05,
    sunIntensity: 2.05,
    oceanDeep: new THREE.Color(0x0b7b9c),
    oceanShallow: new THREE.Color(0x45d1cf),
    starAlpha: 0.0,
    lanternGlow: 0.0,
    headlight: 0.0,
  },
  sunset: {
    skyTop: new THREE.Color(0x45447f),
    skyHorizon: new THREE.Color(0xff9a62),
    sunColor: new THREE.Color(0xffb470),
    sunDir: new THREE.Vector3(0.55, 0.22, -0.8).normalize(),
    fogColor: new THREE.Color(0xf4a87e),
    fogDensity: 0.0085,
    hemiSky: new THREE.Color(0xffcaa0),
    hemiGround: new THREE.Color(0x3b486b),
    hemiIntensity: 0.92,
    sunIntensity: 2.15,
    oceanDeep: new THREE.Color(0x1d3f6b),
    oceanShallow: new THREE.Color(0xc9736b),
    starAlpha: 0.18,
    lanternGlow: 1.4,
    headlight: 2.4,
  },
  night: {
    skyTop: new THREE.Color(0x081129),
    skyHorizon: new THREE.Color(0x1e3f6e),
    sunColor: new THREE.Color(0xc9dcff),
    sunDir: new THREE.Vector3(-0.38, 0.45, -0.8).normalize(),
    fogColor: new THREE.Color(0x162d52),
    fogDensity: 0.011,
    hemiSky: new THREE.Color(0x496ea8),
    hemiGround: new THREE.Color(0x132238),
    hemiIntensity: 0.65,
    sunIntensity: 0.95,
    oceanDeep: new THREE.Color(0x071a33),
    oceanShallow: new THREE.Color(0x194e75),
    starAlpha: 1.0,
    lanternGlow: 2.4,
    headlight: 5.5,
  },
};

export class CoastalWorld {
  constructor(scene) {
    this.scene = scene;
    this.modeIndex = 0;
    this.scrollZ = 0;

    // Live interpolated environment state
    this.cur = {
      skyTop: PRESETS.noon.skyTop.clone(),
      skyHorizon: PRESETS.noon.skyHorizon.clone(),
      sunColor: PRESETS.noon.sunColor.clone(),
      sunDir: PRESETS.noon.sunDir.clone(),
      fogColor: PRESETS.noon.fogColor.clone(),
      fogDensity: PRESETS.noon.fogDensity,
      hemiSky: PRESETS.noon.hemiSky.clone(),
      hemiGround: PRESETS.noon.hemiGround.clone(),
      hemiIntensity: PRESETS.noon.hemiIntensity,
      sunIntensity: PRESETS.noon.sunIntensity,
      oceanDeep: PRESETS.noon.oceanDeep.clone(),
      oceanShallow: PRESETS.noon.oceanShallow.clone(),
      starAlpha: PRESETS.noon.starAlpha,
      lanternGlow: PRESETS.noon.lanternGlow,
      headlight: PRESETS.noon.headlight,
    };

    this._initLights();
    this._initSky();
    this._initOcean();
    this._initMaterials();
    this._initPierChunks();
    this._initScenicProps();
    this._initFishPickups();
    this._initSeagulls();
    this._initParticles();
  }

  _initLights() {
    this.scene.fog = new THREE.FogExp2(this.cur.fogColor.getHex(), this.cur.fogDensity);

    this.hemiLight = new THREE.HemisphereLight(
      this.cur.hemiSky,
      this.cur.hemiGround,
      this.cur.hemiIntensity
    );
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(this.cur.sunColor, this.cur.sunIntensity);
    this.sunLight.position.copy(this.cur.sunDir).multiplyScalar(28);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 4;
    this.sunLight.shadow.camera.far = 62;
    const d = 9;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0007;
    this.scene.add(this.sunLight);
  }

  _initSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: this.cur.skyTop },
        uHorizon: { value: this.cur.skyHorizon },
        uSunDir: { value: this.cur.sunDir },
        uSunColor: { value: this.cur.sunColor },
        uStarAlpha: { value: this.cur.starAlpha },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uStarAlpha;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y * 1.15, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.65));

          // Sun / Moon disc and atmospheric halo
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sunDot, 12.0) * 0.36;
          col += uSunColor * smoothstep(0.9965, 0.9992, sunDot) * 1.35;

          // Subtle twinkling stars at night
          if (uStarAlpha > 0.01 && dir.y > 0.05) {
            vec3 cell = floor(dir * 190.0);
            float rnd = hash(cell);
            if (rnd > 0.992) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + rnd * 120.0);
              col += vec3(0.92, 0.96, 1.0) * uStarAlpha * twinkle * smoothstep(0.05, 0.3, dir.y);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20), this.skyMat);
    this.scene.add(skyDome);

    // Stylized puffy coastal clouds drifting in background
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88,
    });
    this.cloudMat = cloudMat;
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2.2 + (p === 1 ? 0.9 : 0), 10, 8), cloudMat);
        s.scale.set(1.4, 0.72, 1.0);
        s.position.set((p - 1) * 2.4, p === 1 ? 0.7 : 0, (p % 2) * 0.5);
        c.add(s);
      }
      const angle = (i / 10) * Math.PI * 2;
      const rad = 56 + (i % 3) * 18;
      c.position.set(Math.cos(angle) * rad, 18 + (i % 4) * 4, Math.sin(angle) * rad - 25);
      c.userData.baseAngle = angle;
      c.userData.rad = rad;
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);
  }

  _initOcean() {
    const oceanGeo = new THREE.PlaneGeometry(260, 260, 72, 72);
    oceanGeo.rotateX(-Math.PI / 2);

    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScrollZ: { value: 0 },
        uDeep: { value: this.cur.oceanDeep },
        uShallow: { value: this.cur.oceanShallow },
        uSkyHorizon: { value: this.cur.skyHorizon },
        uSunDir: { value: this.cur.sunDir },
        uSunColor: { value: this.cur.sunColor },
        uFogColor: { value: this.cur.fogColor },
        uFogDensity: { value: this.cur.fogDensity },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uScrollZ;
        varying vec3 vWorldPos;
        varying float vWaveH;

        void main() {
          vec3 pos = position;
          float wz = pos.z - uScrollZ;
          float w1 = sin(pos.x * 0.28 + uTime * 1.7) * cos(wz * 0.22 + uTime * 1.2) * 0.14;
          float w2 = sin((pos.x * 0.6 - wz * 0.5) + uTime * 2.4) * 0.06;
          pos.y += w1 + w2;
          vWaveH = w1 + w2;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uScrollZ;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSkyHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec3 vWorldPos;
        varying float vWaveH;

        void main() {
          float wz = vWorldPos.z - uScrollZ;
          // Procedural ripple normal
          float nx = cos(vWorldPos.x * 0.9 + uTime * 2.1) * 0.12 + cos(wz * 1.4 - uTime * 1.8) * 0.08;
          float nz = sin(wz * 0.8 + uTime * 1.9) * 0.12 + sin(vWorldPos.x * 1.3 + uTime * 2.2) * 0.08;
          vec3 N = normalize(vec3(nx, 1.0, nz));
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunDir);

          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          float crest = smoothstep(-0.12, 0.18, vWaveH);
          vec3 waterCol = mix(uDeep, uShallow, crest * 0.72);

          // Pier shadow/foam band near x in [-2.6, 2.6]
          float pierDist = abs(vWorldPos.x);
          float foamBand = smoothstep(3.4, 2.2, pierDist);
          float foamWave = sin(wz * 1.6 + uTime * 3.0 + vWorldPos.x * 2.0);
          float foam = foamBand * smoothstep(0.35, 0.9, foamWave) * 0.45;

          vec3 col = mix(waterCol, uSkyHorizon, fresnel * 0.55);
          col = mix(col, vec3(0.94, 0.98, 1.0), foam);

          // Sun specular sparkle
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), 96.0);
          col += uSunColor * spec * 1.35;

          // Exponential squared fog
          float dist = length(cameraPosition - vWorldPos);
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const ocean = new THREE.Mesh(oceanGeo, this.oceanMat);
    ocean.position.set(0, SEA_Y, -25);
    this.scene.add(ocean);
  }

  _initMaterials() {
    this.mats = {
      woodDeck: new THREE.MeshStandardMaterial({ color: 0xd9a873, roughness: 0.88 }),
      woodPlankAlt: new THREE.MeshStandardMaterial({ color: 0xc8935c, roughness: 0.9 }),
      woodDark: new THREE.MeshStandardMaterial({ color: 0x7c5534, roughness: 0.92 }),
      rope: new THREE.MeshStandardMaterial({ color: 0xe6d3ad, roughness: 0.92 }),
      rampPaint: new THREE.MeshStandardMaterial({ color: 0xf4b942, roughness: 0.7 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.5, metalness: 0.65 }),
      lanternGlass: new THREE.MeshStandardMaterial({
        color: 0xfff0b8,
        emissive: 0xffb84d,
        emissiveIntensity: 0.0,
        roughness: 0.25,
      }),
      sail: new THREE.MeshStandardMaterial({ color: 0xfaf4e6, roughness: 0.8, side: THREE.DoubleSide }),
      hullRed: new THREE.MeshStandardMaterial({ color: 0xd9563f, roughness: 0.65 }),
      hullBlue: new THREE.MeshStandardMaterial({ color: 0x2f6fa3, roughness: 0.65 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x7d848a, roughness: 0.95 }),
      lighthouseWhite: new THREE.MeshStandardMaterial({ color: 0xfaf7f0, roughness: 0.72 }),
      lighthouseRed: new THREE.MeshStandardMaterial({ color: 0xd9483b, roughness: 0.68 }),
      foliage: new THREE.MeshStandardMaterial({ color: 0x4ca662, roughness: 0.85 }),
      sand: new THREE.MeshStandardMaterial({ color: 0xedd5a5, roughness: 0.92 }),
      gullWhite: new THREE.MeshStandardMaterial({ color: 0xfaf8f4, roughness: 0.75 }),
      gullTip: new THREE.MeshStandardMaterial({ color: 0x5c6d7e, roughness: 0.75 }),
      fishBody: new THREE.MeshStandardMaterial({ color: 0x99def5, roughness: 0.2, metalness: 0.55 }),
      fishGoldRing: new THREE.MeshBasicMaterial({
        color: 0xffe07d,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    };
  }

  _initPierChunks() {
    this.chunks = [];
    const plankCount = 12;
    const plankLen = CHUNK_LEN / plankCount;

    for (let c = 0; c < CHUNK_COUNT; c++) {
      const g = new THREE.Group();

      // Main deck surface
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(PIER_HALF_W * 2, 0.16, CHUNK_LEN),
        this.mats.woodDeck
      );
      deck.position.set(0, -0.08, 0);
      deck.receiveShadow = true;
      g.add(deck);

      // Transverse wood plank grooves / alternating tones
      for (let p = 0; p < plankCount; p++) {
        const z = -CHUNK_LEN / 2 + (p + 0.5) * plankLen;
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(PIER_HALF_W * 2 - 0.04, 0.015, plankLen * 0.86),
          p % 2 === 0 ? this.mats.woodDeck : this.mats.woodPlankAlt
        );
        slat.position.set(0, 0.002, z);
        slat.receiveShadow = true;
        g.add(slat);
      }

      // Edge curb beams & pilings down into the ocean
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.09, CHUNK_LEN),
          this.mats.woodDark
        );
        curb.position.set(side * (PIER_HALF_W - 0.07), 0.045, 0);
        curb.castShadow = true;
        curb.receiveShadow = true;
        g.add(curb);

        for (const pz of [-CHUNK_LEN * 0.25, CHUNK_LEN * 0.25]) {
          const piling = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.135, 1.8, 10),
            this.mats.woodDark
          );
          piling.position.set(side * (PIER_HALF_W - 0.05), -0.68, pz);
          piling.castShadow = true;
          g.add(piling);
        }

        // Bollard post + rope sag
        const bollard = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.095, 0.68, 10),
          this.mats.woodDark
        );
        bollard.position.set(side * (PIER_HALF_W - 0.08), 0.34, 0);
        bollard.castShadow = true;
        g.add(bollard);

        const bollardCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 10, 8),
          this.mats.woodPlankAlt
        );
        bollardCap.position.set(side * (PIER_HALF_W - 0.08), 0.68, 0);
        g.add(bollardCap);

        // Draped rope between chunks
        const ropeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * (PIER_HALF_W - 0.08), 0.52, -CHUNK_LEN / 2),
          new THREE.Vector3(side * (PIER_HALF_W - 0.08), 0.35, -CHUNK_LEN / 4),
          new THREE.Vector3(side * (PIER_HALF_W - 0.08), 0.52, 0),
          new THREE.Vector3(side * (PIER_HALF_W - 0.08), 0.35, CHUNK_LEN / 4),
          new THREE.Vector3(side * (PIER_HALF_W - 0.08), 0.52, CHUNK_LEN / 2),
        ]);
        const rope = new THREE.Mesh(
          new THREE.TubeGeometry(ropeCurve, 20, 0.018, 6, false),
          this.mats.rope
        );
        rope.castShadow = true;
        g.add(rope);
      }

      // Harbor Lantern Post every 2nd chunk (alternating sides)
      let lanternLight = null;
      if (c % 2 === 0) {
        const lSide = c % 4 === 0 ? -1 : 1;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.055, 2.35, 8),
          this.mats.iron
        );
        post.position.set(lSide * (PIER_HALF_W + 0.02), 1.15, -2.5);
        post.castShadow = true;
        g.add(post);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.045, 0.045), this.mats.iron);
        arm.position.set(lSide * (PIER_HALF_W - 0.18), 2.3, -2.5);
        g.add(arm);

        const globe = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 10, 8),
          this.mats.lanternGlass
        );
        globe.position.set(lSide * (PIER_HALF_W - 0.35), 2.18, -2.5);
        g.add(globe);

        lanternLight = new THREE.PointLight(0xffbb55, 0, 7.5, 1.8);
        lanternLight.position.copy(globe.position);
        g.add(lanternLight);
      }

      // Optional launch ramp (placed on chunks 3 and 7)
      let ramp = null;
      if (c === 3 || c === 7) {
        const rampGroup = new THREE.Group();
        const rampX = c === 3 ? -0.92 : 0.92;
        rampGroup.position.set(rampX, 0, 0);

        const rampW = 1.15;
        const rampLen = 2.1;
        const rampH = 0.36;
        const rampShape = new THREE.Shape();
        rampShape.moveTo(0, 0);
        rampShape.lineTo(rampLen, 0);
        rampShape.lineTo(rampLen, rampH);
        rampShape.closePath();

        const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
          depth: rampW,
          bevelEnabled: false,
        });
        rampGeo.rotateY(Math.PI / 2);
        rampGeo.translate(-rampW / 2, 0, rampLen / 2);

        const rampMesh = new THREE.Mesh(rampGeo, this.mats.woodPlankAlt);
        rampMesh.castShadow = true;
        rampMesh.receiveShadow = true;
        rampGroup.add(rampMesh);

        // Bright chevron stripe on top of ramp
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(rampW * 0.72, 0.02, 0.22),
          this.mats.rampPaint
        );
        stripe.position.set(0, rampH * 0.85, -rampLen * 0.32);
        stripe.rotation.x = Math.atan2(rampH, rampLen);
        rampGroup.add(stripe);

        g.add(rampGroup);
        ramp = { x: rampX, halfW: rampW * 0.56, len: rampLen, height: rampH };
      }

      const z = 18 - c * CHUNK_LEN;
      g.position.z = z;
      this.scene.add(g);
      this.chunks.push({ group: g, z, lanternLight, ramp });
    }
  }

  _buildSailboat(hullMat) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.2, 7), hullMat);
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.0, 1.0, 0.55);
    hull.castShadow = true;
    boat.add(hull);

    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.65, 2.3, 8),
      this.mats.woodDeck
    );
    deck.rotation.x = Math.PI / 2;
    deck.scale.set(1.0, 1.0, 0.25);
    deck.position.y = 0.22;
    boat.add(deck);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 3.2, 8), this.mats.woodDark);
    mast.position.set(0, 1.7, 0);
    boat.add(mast);

    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 2.55);
    sailShape.lineTo(1.45, 0.2);
    sailShape.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), this.mats.sail);
    sail.rotation.y = Math.PI / 2;
    sail.position.set(0.05, 0.5, -0.05);
    sail.castShadow = true;
    boat.add(sail);
    return boat;
  }

  _buildLighthouseIsland() {
    const g = new THREE.Group();

    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), this.mats.rock);
    rock.scale.set(1.45, 0.58, 1.35);
    rock.position.y = -0.35;
    rock.receiveShadow = true;
    g.add(rock);

    const sand = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 0.4, 12), this.mats.sand);
    sand.position.y = 0.65;
    g.add(sand);

    // Striped tower
    const towerSegs = 5;
    for (let i = 0; i < towerSegs; i++) {
      const rBot = 1.05 - i * 0.11;
      const rTop = 1.05 - (i + 1) * 0.11;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, 1.25, 14),
        i % 2 === 0 ? this.mats.lighthouseWhite : this.mats.lighthouseRed
      );
      seg.position.y = 1.4 + i * 1.25;
      seg.castShadow = true;
      g.add(seg);
    }

    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.6, 0.25, 14), this.mats.iron);
    gallery.position.y = 7.15;
    g.add(gallery);

    this.lighthouseLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.72, 12),
      this.mats.lanternGlass
    );
    this.lighthouseLantern.position.y = 7.6;
    g.add(this.lighthouseLantern);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.65, 12), this.mats.lighthouseRed);
    cap.position.y = 8.25;
    g.add(cap);

    // Coastal pine trees on island
    for (const [px, pz, s] of [
      [-1.7, 1.1, 1.0],
      [1.8, -0.9, 0.85],
    ]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.1, 7), this.mats.woodDark);
      trunk.position.set(px, 1.3, pz);
      g.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.75 * s, 1.6 * s, 8), this.mats.foliage);
      crown.position.set(px, 2.2, pz);
      crown.castShadow = true;
      g.add(crown);
    }

    return g;
  }

  _initScenicProps() {
    this.scenicProps = [];

    const specs = [
      { kind: 'boat', x: -8.5, z: -18, mat: this.mats.hullRed, rotY: 0.25 },
      { kind: 'boat', x: 10.5, z: -48, mat: this.mats.hullBlue, rotY: -0.35 },
      { kind: 'lighthouse', x: -16, z: -64 },
      { kind: 'buoy', x: 5.5, z: -12 },
      { kind: 'buoy', x: -5.8, z: -42 },
      { kind: 'island', x: 18, z: -32 },
    ];

    for (const sp of specs) {
      let mesh;
      if (sp.kind === 'boat') {
        mesh = this._buildSailboat(sp.mat);
        mesh.rotation.y = sp.rotY;
        mesh.position.set(sp.x, SEA_Y + 0.12, sp.z);
      } else if (sp.kind === 'lighthouse') {
        mesh = this._buildLighthouseIsland();
        mesh.position.set(sp.x, SEA_Y + 0.1, sp.z);
      } else if (sp.kind === 'buoy') {
        mesh = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.5, 10), this.mats.lighthouseRed);
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 10), this.mats.lighthouseWhite);
        top.position.y = 0.55;
        mesh.add(base, top);
        mesh.position.set(sp.x, SEA_Y + 0.15, sp.z);
      } else {
        mesh = new THREE.Group();
        const sand = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 5.4, 1.1, 12), this.mats.sand);
        mesh.add(sand);
        for (let t = 0; t < 3; t++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 8), this.mats.foliage);
          cone.position.set((t - 1) * 1.4, 1.4, (t % 2) * 0.9);
          mesh.add(cone);
        }
        mesh.position.set(sp.x, SEA_Y + 0.25, sp.z);
      }
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.kind = sp.kind;
      mesh.userData.phase = Math.random() * Math.PI * 2;
      this.scene.add(mesh);
      this.scenicProps.push(mesh);
    }
  }

  _initFishPickups() {
    this.fishPickups = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), this.mats.fishBody);
      body.scale.set(0.5, 0.75, 1.85);
      body.castShadow = true;
      g.add(body);

      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 4), this.mats.fishBody);
      tail.rotation.x = -Math.PI / 2;
      tail.scale.set(0.35, 1, 1);
      tail.position.z = 0.24;
      g.add(tail);

      const halo = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 20), this.mats.fishGoldRing);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = -0.18;
      g.add(halo);

      g.position.set((i % 2 === 0 ? -1 : 1) * 0.85, 0.75, -20 - i * 21);
      g.userData = {
        laneX: g.position.x,
        baseY: i === 2 ? 1.35 : 0.68,
        phase: i * 1.7,
        cooldown: 0,
      };
      this.scene.add(g);
      this.fishPickups.push(g);
    }
  }

  _initSeagulls() {
    this.gulls = [];
    for (let i = 0; i < 5; i++) {
      const gull = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), this.mats.gullWhite);
      body.rotation.x = Math.PI / 2;
      gull.add(body);

      const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14), this.mats.gullWhite);
      leftWing.position.set(-0.22, 0.02, 0);
      const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14), this.mats.gullWhite);
      rightWing.position.set(0.22, 0.02, 0);

      const lwPivot = new THREE.Group();
      lwPivot.add(leftWing);
      const rwPivot = new THREE.Group();
      rwPivot.add(rightWing);
      gull.add(lwPivot, rwPivot);

      gull.position.set((i - 2) * 5.2, 4.8 + (i % 3) * 1.5, -18 - i * 11);
      gull.userData = {
        lwPivot,
        rwPivot,
        phase: i * 1.3,
        baseY: gull.position.y,
        baseX: gull.position.x,
        scatterBoost: 0,
      };
      this.scene.add(gull);
      this.gulls.push(gull);
    }
  }

  _initParticles() {
    this.particles = [];
    const geo = new THREE.SphereGeometry(0.055, 6, 5);
    for (let i = 0; i < 56; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        gravity: 5,
      });
    }
  }

  spawnBurst(origin, count, colorHex, speedScale = 1, gravity = 6) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.life <= 0) {
        p.life = 0.45 + Math.random() * 0.35;
        p.maxLife = p.life;
        p.gravity = gravity;
        p.mesh.material.color.setHex(colorHex);
        p.mesh.position.copy(origin);
        p.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
        p.mesh.visible = true;
        p.vel.set(
          (Math.random() - 0.5) * 3.4 * speedScale,
          (1.2 + Math.random() * 2.8) * speedScale,
          (Math.random() - 0.5) * 2.8 * speedScale
        );
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  scatterSeagulls() {
    for (const g of this.gulls) {
      g.userData.scatterBoost = 1.8;
    }
  }

  cycleTimeMode() {
    this.modeIndex = (this.modeIndex + 1) % TIME_MODES.length;
    return TIME_MODES[this.modeIndex];
  }

  getCurrentMode() {
    return TIME_MODES[this.modeIndex];
  }

  update(dt, time, forwardDist, bikePos, isPaused, pelicanBike) {
    // 1. Smoothly blend Time-of-Day atmosphere
    const target = PRESETS[TIME_MODES[this.modeIndex]];
    const blend = Math.min(1, dt * 2.8);

    this.cur.skyTop.lerp(target.skyTop, blend);
    this.cur.skyHorizon.lerp(target.skyHorizon, blend);
    this.cur.sunColor.lerp(target.sunColor, blend);
    this.cur.sunDir.lerp(target.sunDir, blend).normalize();
    this.cur.fogColor.lerp(target.fogColor, blend);
    this.cur.fogDensity = THREE.MathUtils.lerp(this.cur.fogDensity, target.fogDensity, blend);
    this.cur.hemiSky.lerp(target.hemiSky, blend);
    this.cur.hemiGround.lerp(target.hemiGround, blend);
    this.cur.hemiIntensity = THREE.MathUtils.lerp(this.cur.hemiIntensity, target.hemiIntensity, blend);
    this.cur.sunIntensity = THREE.MathUtils.lerp(this.cur.sunIntensity, target.sunIntensity, blend);
    this.cur.oceanDeep.lerp(target.oceanDeep, blend);
    this.cur.oceanShallow.lerp(target.oceanShallow, blend);
    this.cur.starAlpha = THREE.MathUtils.lerp(this.cur.starAlpha, target.starAlpha, blend);
    this.cur.lanternGlow = THREE.MathUtils.lerp(this.cur.lanternGlow, target.lanternGlow, blend);
    this.cur.headlight = THREE.MathUtils.lerp(this.cur.headlight, target.headlight, blend);

    this.scene.fog.color.copy(this.cur.fogColor);
    this.scene.fog.density = this.cur.fogDensity;
    this.hemiLight.color.copy(this.cur.hemiSky);
    this.hemiLight.groundColor.copy(this.cur.hemiGround);
    this.hemiLight.intensity = this.cur.hemiIntensity;
    this.sunLight.color.copy(this.cur.sunColor);
    this.sunLight.intensity = this.cur.sunIntensity;
    this.sunLight.position.copy(this.cur.sunDir).multiplyScalar(28);

    this.skyMat.uniforms.uTime.value = time;
    this.oceanMat.uniforms.uTime.value = time;
    this.oceanMat.uniforms.uFogDensity.value = this.cur.fogDensity;

    this.mats.lanternGlass.emissiveIntensity = this.cur.lanternGlow;
    pelicanBike.setHeadlightIntensity(this.cur.headlight);

    this.cloudMat.color.copy(this.cur.skyHorizon).lerp(new THREE.Color(0xffffff), 0.72);
    this.cloudMat.opacity = this.modeIndex === 2 ? 0.25 : 0.86;

    // 2. Scroll world forward (chunks move toward +Z as bike rides toward -Z)
    const stepZ = isPaused ? 0 : forwardDist;
    this.scrollZ += stepZ;
    this.oceanMat.uniforms.uScrollZ.value = this.scrollZ;

    const totalLoop = CHUNK_COUNT * CHUNK_LEN;
    let activeRampHeight = 0;
    let hitRampLaunch = false;

    for (const ch of this.chunks) {
      ch.z += stepZ;
      if (ch.z > 24) {
        ch.z -= totalLoop;
      }
      ch.group.position.z = ch.z;

      if (ch.lanternLight) {
        ch.lanternLight.intensity = this.cur.lanternGlow * 1.15;
      }

      // Ramp height check under bike
      if (ch.ramp) {
        const dz = ch.z - bikePos.z; // relative z of ramp center
        const halfLen = ch.ramp.len * 0.5;
        if (Math.abs(bikePos.x - ch.ramp.x) < ch.ramp.halfW && dz > -halfLen && dz < halfLen) {
          // Bike rides toward -Z, so entering ramp at +halfLen (t=0) up to -halfLen (t=1)
          const t = (halfLen - dz) / ch.ramp.len;
          activeRampHeight = Math.max(activeRampHeight, t * ch.ramp.height);
          if (t > 0.88 && bikePos.y <= ch.ramp.height + 0.08) {
            hitRampLaunch = true;
          }
        }
      }
    }

    // 3. Scenic boats, buoys, islands
    for (const prop of this.scenicProps) {
      prop.position.z += stepZ * 0.85;
      if (prop.position.z > 28) {
        prop.position.z -= 115;
      }
      if (prop.userData.kind === 'boat' || prop.userData.kind === 'buoy') {
        const ph = prop.userData.phase;
        prop.position.y = prop.userData.baseY + Math.sin(time * 1.9 + ph) * 0.14;
        prop.rotation.z = Math.sin(time * 1.4 + ph) * 0.06;
        prop.rotation.x = Math.cos(time * 1.2 + ph) * 0.04;
      }
    }

    // Drift clouds gently
    for (const c of this.clouds.children) {
      c.userData.baseAngle += dt * 0.012;
      c.position.x = Math.cos(c.userData.baseAngle) * c.userData.rad;
    }

    // 4. Seagulls gliding & scattering
    for (const g of this.gulls) {
      g.userData.scatterBoost = Math.max(0, g.userData.scatterBoost - dt * 1.4);
      const flapSpeed = 5.5 + g.userData.scatterBoost * 7;
      const flap = Math.sin(time * flapSpeed + g.userData.phase) * (0.38 + g.userData.scatterBoost * 0.25);
      g.userData.lwPivot.rotation.z = flap;
      g.userData.rwPivot.rotation.z = -flap;
      g.position.x = g.userData.baseX + Math.sin(time * 0.65 + g.userData.phase) * 3.5;
      g.position.y =
        g.userData.baseY +
        Math.cos(time * 1.1 + g.userData.phase) * 0.45 +
        g.userData.scatterBoost * 1.2;
      g.position.z += stepZ * 0.5;
      if (g.position.z > 20) g.position.z -= 85;
    }

    // 5. Leaping fish pickups & catch detection
    let caughtFish = false;
    for (const f of this.fishPickups) {
      f.position.z += stepZ;
      if (f.position.z > 14) {
        f.position.z -= 86;
        f.userData.laneX = (Math.random() - 0.5) * 2.5;
        f.userData.baseY = Math.random() > 0.68 ? 1.35 : 0.68;
        f.position.x = f.userData.laneX;
        f.visible = true;
      }

      if (f.visible) {
        const arc = Math.sin(time * 2.8 + f.userData.phase) * 0.22;
        f.position.y = f.userData.baseY + arc;
        f.rotation.y = time * 1.8 + f.userData.phase;
        f.rotation.x = Math.cos(time * 2.8 + f.userData.phase) * 0.35;

        // Check catch near pelican's beak / front basket
        const dx = Math.abs(f.position.x - bikePos.x);
        const dz = Math.abs(f.position.z - (bikePos.z - 0.42));
        const dy = Math.abs(f.position.y - (bikePos.y + 0.95));
        if (dx < 0.82 && dz < 0.92 && dy < 0.95) {
          f.visible = false;
          caughtFish = true;
          this.spawnBurst(f.position.clone(), 12, 0xffe07d, 1.1, 4.5);
        }
      }
    }

    // 6. Update particles
    for (const p of this.particles) {
      if (p.life > 0) {
        p.life -= dt;
        p.vel.y -= p.gravity * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.position.z += stepZ * 0.9;
        const ratio = Math.max(0, p.life / p.maxLife);
        p.mesh.material.opacity = ratio;
        p.mesh.scale.setScalar(ratio * 0.95);
        if (p.life <= 0) {
          p.mesh.visible = false;
        }
      }
    }

    return { activeRampHeight, hitRampLaunch, caughtFish };
  }
}
