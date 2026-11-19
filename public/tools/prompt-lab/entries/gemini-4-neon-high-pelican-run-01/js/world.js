import * as THREE from '../vendor/three.min.js';

export const ROAD_HALF_WIDTH = 3.1;
export const LANE_LIMIT = 2.35;

export function roadX(u) {
  return Math.sin(u * 0.0165) * 11.5 + Math.sin(u * 0.0063 + 0.7) * 7.5;
}

export function roadXDeriv(u) {
  return Math.cos(u * 0.0165) * 11.5 * 0.0165 + Math.cos(u * 0.0063 + 0.7) * 7.5 * 0.0063;
}

export function roadY(u) {
  return 2.2 + Math.sin(u * 0.021) * 0.9 + Math.cos(u * 0.0082) * 0.55;
}

export function roadYDeriv(u) {
  return Math.cos(u * 0.021) * 0.9 * 0.021 - Math.sin(u * 0.0082) * 0.55 * 0.0082;
}

/**
 * Projects curvilinear road coordinates (u, lat, yOff) into the camera/bike-centered
 * world frame where u = dist sits at z = 0 facing -Z.
 */
export function roadToWorld(u, dist, lat, yOff, outPos) {
  const x0 = roadX(dist);
  const y0 = roadY(dist);
  const yaw0 = Math.atan2(roadXDeriv(dist), 1);
  const yawU = Math.atan2(roadXDeriv(u), 1);

  const gx = roadX(u) - x0;
  const gz = u - dist;
  const px = gx + Math.cos(yawU) * lat;
  const pz = gz - Math.sin(yawU) * lat;

  const c0 = Math.cos(yaw0);
  const s0 = Math.sin(yaw0);
  const wx = px * c0 - pz * s0;
  const wf = px * s0 + pz * c0;

  outPos.set(wx, roadY(u) - y0 + yOff, -wf);
  return -(yawU - yaw0);
}

function createRibbonGeometry(segCount, profilePoints) {
  const cols = profilePoints.length;
  const rows = segCount + 1;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const indices = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      uvs[i * 2] = profilePoints[c].u;
      uvs[i * 2 + 1] = r / segCount;
    }
  }

  for (let r = 0; r < segCount; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createCitrusTree(mats, seed) {
  const g = new THREE.Group();
  const h = 1.9 + (seed % 3) * 0.35;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.19, h, 8), mats.trunk);
  trunk.position.y = h * 0.5;
  trunk.rotation.z = ((seed % 5) - 2) * 0.04;
  trunk.castShadow = true;
  g.add(trunk);

  const puffs = [
    [0, h + 0.55, 0, 1.05],
    [-0.55, h + 0.28, 0.25, 0.72],
    [0.58, h + 0.32, -0.2, 0.76],
    [0.12, h + 0.36, 0.52, 0.68],
  ];
  puffs.forEach(([x, y, z, r], idx) => {
    const foliage = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 1),
      idx % 2 === 0 ? mats.leafLight : mats.leafDark
    );
    foliage.position.set(x, y, z);
    foliage.scale.set(1.08, 0.86, 1.04);
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    g.add(foliage);
  });

  // Bright coastal lemons nestled in the canopy
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + seed;
    const lem = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), mats.lemon);
    lem.position.set(Math.cos(a) * 0.76, h + 0.25 + (i % 3) * 0.22, Math.sin(a) * 0.76);
    g.add(lem);
  }
  return g;
}

function createCypressTree(mats, seed) {
  const g = new THREE.Group();
  const h = 4.6 + (seed % 4) * 0.65;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 1.2, 7), mats.trunk);
  trunk.position.y = 0.6;
  g.add(trunk);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.74, h, 9), mats.cypress);
  spire.position.y = 1.0 + h * 0.5;
  spire.castShadow = true;
  spire.receiveShadow = true;
  g.add(spire);
  return g;
}

function createCoastalVilla(mats, variant) {
  const g = new THREE.Group();
  const wallMat = variant % 2 === 0 ? mats.villaCream : mats.villaPeach;
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 4.2), wallMat);
  body.position.y = 1.8;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Terracotta pitched roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.5, 4), mats.terracotta);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4.35;
  roof.castShadow = true;
  g.add(roof);

  // Cobalt shutters & warm windows facing the sea (+X)
  [-0.9, 0.9].forEach((wz) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.72), mats.windowWarm);
    win.position.set(2.19, 2.25, wz);
    g.add(win);

    [-0.48, 0.48].forEach((sz) => {
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, 0.24), mats.shutterBlue);
      shutter.position.set(2.22, 2.25, wz + sz);
      g.add(shutter);
    });
  });

  // Striped seaside awning over doorway
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 2.2), mats.awning);
  awning.position.set(2.58, 1.52, 0);
  awning.rotation.z = -0.34;
  awning.castShadow = true;
  g.add(awning);

  // Bougainvillea magenta blossom cluster climbing the side wall
  for (let i = 0; i < 4; i++) {
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + (i % 2) * 0.14, 0), mats.bougainvillea);
    bush.position.set(2.25, 0.45 + i * 0.42, -1.6 + i * 0.28);
    g.add(bush);
  }

  return g;
}

function createLighthouse(mats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.85, 2.4, 14), mats.stone);
  base.position.y = 1.2;
  base.castShadow = true;
  g.add(base);

  const bands = [
    { y: 3.4, r1: 1.28, r2: 1.44, mat: mats.villaCream },
    { y: 5.4, r1: 1.12, r2: 1.28, mat: mats.lighthouseRed },
    { y: 7.4, r1: 0.96, r2: 1.12, mat: mats.villaCream },
    { y: 9.2, r1: 0.84, r2: 0.96, mat: mats.lighthouseRed },
  ];
  bands.forEach((b) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(b.r1, b.r2, 2.0, 14), b.mat);
    m.position.y = b.y;
    m.castShadow = true;
    g.add(m);
  });

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.05, 0.25, 14), mats.railTeal);
  gallery.position.y = 10.25;
  g.add(gallery);

  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.1, 12), mats.lampGlobe);
  lantern.position.y = 10.9;
  g.add(lantern);

  const dome = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.95, 12), mats.lighthouseRed);
  dome.position.y = 11.9;
  g.add(dome);

  // Rotating subtle lighthouse light cone
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 10.9;
  const beamGeo = new THREE.ConeGeometry(2.6, 20, 16, 1, true);
  beamGeo.translate(0, -10, 0);
  beamGeo.rotateX(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, mats.lighthouseBeam);
  beamPivot.add(beam);
  g.add(beamPivot);
  g.userData.beamPivot = beamPivot;

  return g;
}

function createSailboat(mats) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 3.2), mats.villaCream);
  hull.position.y = 0.22;
  g.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.14, 3.24), mats.shutterBlue);
  stripe.position.y = 0.34;
  g.add(stripe);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.6, 6), mats.trunk);
  mast.position.set(0, 2.0, 0.1);
  g.add(mast);

  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(1.5, 0.2);
  sailShape.lineTo(0, 3.1);
  sailShape.closePath();
  const sailGeo = new THREE.ShapeGeometry(sailShape);
  sailGeo.rotateY(Math.PI / 2);
  const sail = new THREE.Mesh(sailGeo, mats.sail);
  sail.position.set(0.05, 0.65, 0.0);
  g.add(sail);

  return g;
}

function createSeagull(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mats.villaCream);
  body.scale.set(0.85, 0.78, 1.55);
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mats.villaCream);
  head.position.set(0, 0.11, -0.15);
  g.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.11, 6), mats.lemon);
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.10, -0.26);
  g.add(beak);

  const makeWing = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.10, 0.05, -0.02);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.024, 0.14), mats.villaCream);
    blade.position.x = side * 0.19;
    pivot.add(blade);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.022, 0.12), mats.gullTip);
    tip.position.x = side * 0.44;
    pivot.add(tip);
    g.add(pivot);
    return pivot;
  };

  g.userData.wingL = makeWing(-1);
  g.userData.wingR = makeWing(1);
  return g;
}

function createCollectibleFish(mats, isGolden) {
  const g = new THREE.Group();
  const mat = isGolden ? mats.fishGold : mats.fishSilver;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat);
  body.scale.set(0.42, 0.72, 1.85);
  body.castShadow = true;
  g.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.24, 5), mat);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 0.34;
  tail.scale.set(0.35, 1.0, 1.0);
  g.add(tail);

  // Subtle floating shimmer halo ring around leaping sardine
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.02, 8, 22),
    isGolden ? mats.haloGold : mats.haloTeal
  );
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

export class CoastalWorld {
  constructor(scene, textures) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.textures = textures;
    this.mats = {
      road: new THREE.MeshStandardMaterial({
        map: textures.road,
        roughness: 0.82,
        metalness: 0.02,
      }),
      stone: new THREE.MeshStandardMaterial({
        map: textures.stone,
        roughness: 0.88,
        metalness: 0.02,
      }),
      cliff: new THREE.MeshStandardMaterial({
        color: '#b7bf7a',
        roughness: 0.92,
        metalness: 0.0,
      }),
      railTeal: new THREE.MeshStandardMaterial({
        color: '#2a9d98',
        roughness: 0.42,
        metalness: 0.28,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: '#dfa848',
        roughness: 0.28,
        metalness: 0.82,
      }),
      lampGlobe: new THREE.MeshStandardMaterial({
        color: '#fff6da',
        emissive: '#ffbb5c',
        emissiveIntensity: 0.15,
        roughness: 0.2,
      }),
      trunk: new THREE.MeshStandardMaterial({ color: '#7d5b42', roughness: 0.9 }),
      leafLight: new THREE.MeshStandardMaterial({ color: '#69a85a', roughness: 0.82 }),
      leafDark: new THREE.MeshStandardMaterial({ color: '#45834b', roughness: 0.85 }),
      cypress: new THREE.MeshStandardMaterial({ color: '#2f6b4b', roughness: 0.86 }),
      lemon: new THREE.MeshStandardMaterial({ color: '#f7d13b', roughness: 0.42 }),
      bougainvillea: new THREE.MeshStandardMaterial({ color: '#df4a80', roughness: 0.72 }),
      villaCream: new THREE.MeshStandardMaterial({ color: '#faf2e4', roughness: 0.84 }),
      villaPeach: new THREE.MeshStandardMaterial({ color: '#f2cba8', roughness: 0.84 }),
      terracotta: new THREE.MeshStandardMaterial({ color: '#c86443', roughness: 0.78 }),
      shutterBlue: new THREE.MeshStandardMaterial({ color: '#2b6cb0', roughness: 0.56 }),
      windowWarm: new THREE.MeshStandardMaterial({
        color: '#344c69',
        emissive: '#ffbe66',
        emissiveIntensity: 0.06,
        roughness: 0.25,
      }),
      awning: new THREE.MeshStandardMaterial({ map: textures.scarf, roughness: 0.75 }),
      lighthouseRed: new THREE.MeshStandardMaterial({ color: '#d45142', roughness: 0.62 }),
      lighthouseBeam: new THREE.MeshBasicMaterial({
        color: '#ffe4a3',
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
      sail: new THREE.MeshStandardMaterial({
        color: '#fff9ee',
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
      gullTip: new THREE.MeshStandardMaterial({ color: '#333b45', roughness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.82 }),
      fishSilver: new THREE.MeshStandardMaterial({
        color: '#b8e0f5',
        emissive: '#388fb8',
        emissiveIntensity: 0.22,
        roughness: 0.16,
        metalness: 0.82,
      }),
      fishGold: new THREE.MeshStandardMaterial({
        color: '#ffd257',
        emissive: '#e08e1f',
        emissiveIntensity: 0.35,
        roughness: 0.18,
        metalness: 0.86,
      }),
      haloTeal: new THREE.MeshBasicMaterial({
        color: '#7ef3ef',
        transparent: true,
        opacity: 0.62,
      }),
      haloGold: new THREE.MeshBasicMaterial({
        color: '#ffe285',
        transparent: true,
        opacity: 0.78,
      }),
      cloud: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.95,
        metalness: 0.0,
      }),
    };

    // ─── 1. Continuous Dynamic Curved Ribbons (Road, Seawall, Cliffside) ───
    this.ribbonSegs = 68;
    this.ribbonStart = -18;
    this.ribbonEnd = 128;

    this.roadProfile = [
      { lat: -ROAD_HALF_WIDTH, y: 0.0, u: 0 },
      { lat: ROAD_HALF_WIDTH, y: 0.0, u: 1 },
    ];
    this.roadGeo = createRibbonGeometry(this.ribbonSegs, this.roadProfile);
    this.roadMesh = new THREE.Mesh(this.roadGeo, this.mats.road);
    this.roadMesh.receiveShadow = true;
    this.root.add(this.roadMesh);

    // Ocean-side stone seawall parapet dropping smoothly into the sea
    this.seawallProfile = [
      { lat: ROAD_HALF_WIDTH, y: 0.0, u: 0.0 },
      { lat: ROAD_HALF_WIDTH, y: 0.56, u: 0.15 },
      { lat: ROAD_HALF_WIDTH + 0.52, y: 0.56, u: 0.35 },
      { lat: ROAD_HALF_WIDTH + 0.78, y: -5.5, u: 1.0 },
    ];
    this.seawallGeo = createRibbonGeometry(this.ribbonSegs, this.seawallProfile);
    this.seawallMesh = new THREE.Mesh(this.seawallGeo, this.mats.stone);
    this.seawallMesh.receiveShadow = true;
    this.seawallMesh.castShadow = true;
    this.root.add(this.seawallMesh);

    // Cliffside limestone curb + rolling Mediterranean hillside
    this.cliffProfile = [
      { lat: -ROAD_HALF_WIDTH - 24, y: 7.5, u: 0 },
      { lat: -ROAD_HALF_WIDTH - 12, y: 3.4, u: 0.35 },
      { lat: -ROAD_HALF_WIDTH - 4.2, y: 1.15, u: 0.7 },
      { lat: -ROAD_HALF_WIDTH - 0.55, y: 0.55, u: 0.92 },
      { lat: -ROAD_HALF_WIDTH, y: 0.0, u: 1.0 },
    ];
    this.cliffGeo = createRibbonGeometry(this.ribbonSegs, this.cliffProfile);
    this.cliffMesh = new THREE.Mesh(this.cliffGeo, this.mats.cliff);
    this.cliffMesh.receiveShadow = true;
    this.root.add(this.cliffMesh);

    // ─── 2. Seawall Brass Lamps + Turquoise Balustrade Posts ───
    this.lampSpacing = 14;
    this.lamps = [];
    this.lampHalos = [];
    const haloMat = new THREE.SpriteMaterial({
      map: textures.glow,
      color: '#ffce75',
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lampHaloMat = haloMat;

    for (let i = 0; i < 11; i++) {
      const post = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 2.55, 8), this.mats.railTeal);
      pole.position.y = 1.28;
      pole.castShadow = true;
      post.add(pole);

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 8), this.mats.brass);
      collar.position.y = 0.08;
      post.add(collar);

      // Curved swan-neck lamp bracket leaning slightly over the promenade
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12, Math.PI), this.mats.railTeal);
      arm.position.set(-0.28, 2.52, 0);
      post.add(arm);

      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), this.mats.lampGlobe);
      globe.position.set(-0.56, 2.38, 0);
      post.add(globe);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 10), this.mats.brass);
      cap.position.set(-0.56, 2.55, 0);
      post.add(cap);

      const halo = new THREE.Sprite(haloMat);
      halo.position.set(-0.56, 2.38, 0);
      halo.scale.set(1.9, 1.9, 1);
      post.add(halo);

      this.root.add(post);
      this.lamps.push({ mesh: post, u: (i - 1) * this.lampSpacing });
    }

    // ─── 3. Cliffside Flora & Seaside Architecture Pool ───
    this.floraSpacing = 9.5;
    this.flora = [];
    for (let i = 0; i < 16; i++) {
      const isCypress = i % 3 === 0;
      const tree = isCypress ? createCypressTree(this.mats, i) : createCitrusTree(this.mats, i);
      this.root.add(tree);
      this.flora.push({
        mesh: tree,
        u: (i - 1) * this.floraSpacing + (i % 2) * 2.2,
        lat: -ROAD_HALF_WIDTH - 2.4 - (i % 4) * 1.45,
        yOff: 0.72 + (i % 4) * 0.35,
      });
    }

    // Coastal Villas + Cape Lighthouse
    this.landmarkSpacing = 44;
    this.landmarks = [];
    for (let i = 0; i < 4; i++) {
      const isLighthouse = i === 2;
      const mesh = isLighthouse ? createLighthouse(this.mats) : createCoastalVilla(this.mats, i);
      this.root.add(mesh);
      this.landmarks.push({
        mesh,
        isLighthouse,
        u: 18 + i * this.landmarkSpacing,
        lat: isLighthouse ? -ROAD_HALF_WIDTH - 7.8 : -ROAD_HALF_WIDTH - 6.8,
        yOff: isLighthouse ? 1.85 : 1.55,
      });
    }

    // ─── 4. Harbor Sailboats Out on the Sparkling Sea ───
    this.boats = [];
    for (let i = 0; i < 5; i++) {
      const boat = createSailboat(this.mats);
      this.root.add(boat);
      this.boats.push({
        mesh: boat,
        u: 15 + i * 32,
        lat: 16 + (i % 3) * 11,
        phase: i * 1.7,
        driftSpeed: 0.8 + (i % 3) * 0.45,
      });
    }

    // ─── 5. Interactive Coastal Seagulls (Startled by Bell or Passing Close!) ───
    this.gulls = [];
    for (let i = 0; i < 5; i++) {
      const mesh = createSeagull(this.mats);
      this.root.add(mesh);
      this.gulls.push({
        mesh,
        u: 22 + i * 27,
        lat: ROAD_HALF_WIDTH + 0.26,
        yOff: 0.72,
        flying: false,
        flyTime: 0,
        flapPhase: i * 1.3,
      });
    }

    // ─── 6. Collectible Leaping Sardines & Wooden Coastal Ramps ───
    this.fishes = [];
    for (let i = 0; i < 7; i++) {
      const isGolden = i % 3 === 2;
      const mesh = createCollectibleFish(this.mats, isGolden);
      this.root.add(mesh);
      this.fishes.push({
        mesh,
        isGolden,
        u: 26 + i * 21,
        lane: [-1.45, 0.0, 1.45, -0.75, 1.1, 0.2, -1.25][i],
        baseY: isGolden ? 1.55 : 0.92,
        collected: false,
        phase: i * 1.1,
      });
    }

    this.ramps = [];
    for (let i = 0; i < 2; i++) {
      const ramp = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(3.4, 0);
      shape.lineTo(0, 0.56);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.45, bevelEnabled: false });
      geo.rotateY(Math.PI / 2);
      geo.translate(-0.725, 0, 1.7);
      const mesh = new THREE.Mesh(geo, this.mats.wood);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      ramp.add(mesh);

      // Painted turquoise arrow stripe on ramp top
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 2.9), this.mats.railTeal);
      strip.position.set(0, 0.30, 0.0);
      strip.rotation.x = 0.163;
      ramp.add(strip);

      this.root.add(ramp);
      this.ramps.push({
        mesh: ramp,
        u: 58 + i * 76,
        lane: i === 0 ? 0.95 : -0.95,
        triggered: false,
      });
    }

    // ─── 7. Sculpted Miyazaki Cumulus Clouds ───
    this.clouds = [];
    for (let i = 0; i < 10; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const r = 2.4 + ((i + p) % 3) * 1.15;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), this.mats.cloud);
        m.position.set((p - 1.2) * 2.5, (p % 2) * 0.9, ((p * 7) % 3 - 1) * 1.1);
        m.scale.set(1.3, 0.72, 1.0);
        cloud.add(m);
      }
      cloud.position.set(
        -55 + (i % 5) * 38,
        24 + (i % 4) * 5.5,
        -45 - i * 16
      );
      this.root.add(cloud);
      this.clouds.push({ mesh: cloud, speed: 0.7 + (i % 3) * 0.4 });
    }

    // ─── 8. Sparkle & Sea-Breeze Particle Pool ───
    this.particles = [];
    const pGeo = new THREE.SphereGeometry(0.065, 6, 6);
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? '#fff5c4' : '#7ef3ef',
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.6,
      });
    }

    this._tmpPos = new THREE.Vector3();
  }

  startleGulls(dist) {
    this.gulls.forEach((g) => {
      if (!g.flying && g.u - dist > -6 && g.u - dist < 56) {
        g.flying = true;
        g.flyTime = 0;
      }
    });
  }

  spawnBurst(worldPos, count = 14, isGold = false) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.life <= 0) {
        p.life = 0.52 + Math.random() * 0.28;
        p.maxLife = p.life;
        p.mesh.visible = true;
        p.mesh.position.copy(worldPos);
        p.mat.color.set(isGold ? '#ffe066' : spawned % 2 === 0 ? '#ffffff' : '#6ef2ec');
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.6 + Math.random() * 2.8;
        p.vel.set(Math.cos(ang) * spd, 1.8 + Math.random() * 2.6, Math.sin(ang) * spd - 1.0);
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  _updateRibbon(geo, profile, dist) {
    const posAttr = geo.attributes.position;
    const cols = profile.length;
    const step = (this.ribbonEnd - this.ribbonStart) / this.ribbonSegs;

    for (let r = 0; r <= this.ribbonSegs; r++) {
      const u = dist + this.ribbonStart + r * step;
      for (let c = 0; c < cols; c++) {
        roadToWorld(u, dist, profile[c].lat, profile[c].y, this._tmpPos);
        const idx = (r * cols + c) * 3;
        posAttr.array[idx] = this._tmpPos.x;
        posAttr.array[idx + 1] = this._tmpPos.y;
        posAttr.array[idx + 2] = this._tmpPos.z;
      }
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }

  update(dt, elapsed, dist, bikeLaneX, bikeJumpY, lampGlow, onCatchFish, onHitRamp) {
    // 1. Update curved ribbons & seamlessly scroll road texture UV
    this._updateRibbon(this.roadGeo, this.roadProfile, dist);
    this._updateRibbon(this.seawallGeo, this.seawallProfile, dist);
    this._updateRibbon(this.cliffGeo, this.cliffProfile, dist);

    // Match UV repeat to physical ribbon length (146m / 14 repeats ≈ 10.43m per tile)
    this.textures.road.offset.y = (dist / 10.43) % 1;
    this.textures.stone.offset.x = (dist / 12.0) % 1;

    // 2. Lamp glow & lighthouse beam for Golden Hour / Starlit Dusk
    this.mats.lampGlobe.emissiveIntensity = 0.15 + lampGlow * 1.45;
    this.mats.windowWarm.emissiveIntensity = 0.04 + lampGlow * 0.9;
    this.lampHaloMat.opacity = Math.min(0.82, Math.max(0, (lampGlow - 0.12) * 0.6));
    this.mats.lighthouseBeam.opacity = Math.max(0, (lampGlow - 0.25) * 0.16);

    // 3. Seawall lamps
    const lampSpan = this.lamps.length * this.lampSpacing;
    this.lamps.forEach((l) => {
      while (l.u < dist - 16) l.u += lampSpan;
      const yaw = roadToWorld(l.u, dist, ROAD_HALF_WIDTH + 0.26, 0.56, l.mesh.position);
      l.mesh.rotation.y = yaw;
    });

    // 4. Cliffside flora
    const floraSpan = this.flora.length * this.floraSpacing;
    this.flora.forEach((f) => {
      while (f.u < dist - 18) f.u += floraSpan;
      const yaw = roadToWorld(f.u, dist, f.lat, f.yOff, f.mesh.position);
      f.mesh.rotation.y = yaw;
    });

    // 5. Coastal villas & lighthouse
    const lmSpan = this.landmarks.length * this.landmarkSpacing;
    this.landmarks.forEach((lm) => {
      while (lm.u < dist - 28) lm.u += lmSpan;
      const yaw = roadToWorld(lm.u, dist, lm.lat, lm.yOff, lm.mesh.position);
      lm.mesh.rotation.y = yaw;
      if (lm.isLighthouse && lm.mesh.userData.beamPivot) {
        lm.mesh.userData.beamPivot.rotation.y = elapsed * 0.55;
      }
    });

    // 6. Harbor sailboats gliding gently on ocean waves
    const oceanSurface = -roadY(dist) - 0.52;
    this.boats.forEach((b) => {
      b.u += b.driftSpeed * dt;
      while (b.u < dist - 30) b.u += 165;
      while (b.u > dist + 145) b.u -= 165;
      const yaw = roadToWorld(b.u, dist, b.lat, 0, b.mesh.position);
      b.mesh.position.y = oceanSurface + Math.sin(elapsed * 1.4 + b.phase) * 0.14;
      b.mesh.rotation.y = yaw + 0.22;
      b.mesh.rotation.z = Math.sin(elapsed * 1.6 + b.phase) * 0.08;
      b.mesh.rotation.x = Math.cos(elapsed * 1.2 + b.phase) * 0.04;
    });

    // 7. Interactive coastal seagulls
    this.gulls.forEach((g) => {
      if (g.u < dist - 18) {
        g.u += 135;
        g.flying = false;
        g.flyTime = 0;
        g.lat = ROAD_HALF_WIDTH + 0.26;
        g.yOff = 0.72;
      }
      // Startle naturally if bike gets close on the ocean side
      if (!g.flying && Math.abs(g.u - dist) < 7.5 && bikeLaneX > 0.6) {
        g.flying = true;
        g.flyTime = 0;
      }
      if (g.flying) {
        g.flyTime += dt;
        g.u += dt * 4.5;
        g.lat += dt * 2.8;
        g.yOff = 0.72 + Math.min(7.5, g.flyTime * 3.1 + Math.sin(g.flyTime * 2) * 0.3);
        const flap = Math.sin(elapsed * 15 + g.flapPhase) * 0.68;
        g.mesh.userData.wingL.rotation.z = flap;
        g.mesh.userData.wingR.rotation.z = -flap;
      } else {
        g.mesh.userData.wingL.rotation.z = -0.58;
        g.mesh.userData.wingR.rotation.z = 0.58;
      }
      const yaw = roadToWorld(g.u, dist, g.lat, g.yOff, g.mesh.position);
      g.mesh.rotation.y = yaw + (g.flying ? -0.55 : -0.8);
    });

    // 8. Collectible leaping sardines
    this.fishes.forEach((f, idx) => {
      if (f.u < dist - 10) {
        f.u += 147;
        f.collected = false;
        f.mesh.visible = true;
        f.lane = Math.sin(f.u * 0.13 + idx) * 1.65;
      }
      if (f.collected) return;

      const bob = Math.sin(elapsed * 3.2 + f.phase) * 0.24;
      const curY = f.baseY + bob;
      const yaw = roadToWorld(f.u, dist, f.lane, curY, f.mesh.position);
      f.mesh.rotation.y = yaw + elapsed * 1.8;
      f.mesh.rotation.z = Math.sin(elapsed * 3.2 + f.phase) * 0.24;
      f.mesh.userData.halo.rotation.x = elapsed * 2.2;

      // Scoop collision check near the pelican's beak / torso
      const du = Math.abs(f.u - dist);
      const dx = Math.abs(f.lane - bikeLaneX);
      const dy = Math.abs(curY - (bikeJumpY + 1.15));
      if (du < 1.35 && dx < 1.05 && dy < 1.25) {
        f.collected = true;
        f.mesh.visible = false;
        this.spawnBurst(f.mesh.position, 16, f.isGolden);
        if (onCatchFish) onCatchFish(f.isGolden);
      }
    });

    // 9. Wooden coastal ramps
    this.ramps.forEach((r, idx) => {
      if (r.u < dist - 14) {
        r.u += 152;
        r.lane = idx % 2 === 0 ? 1.0 : -1.0;
        r.triggered = false;
      }
      const yaw = roadToWorld(r.u, dist, r.lane, 0, r.mesh.position);
      r.mesh.rotation.y = yaw;

      if (!r.triggered && Math.abs(r.u - dist) < 1.5 && Math.abs(r.lane - bikeLaneX) < 0.95 && bikeJumpY < 0.35) {
        r.triggered = true;
        if (onHitRamp) onHitRamp();
      }
    });

    // 10. Drifting cumulus clouds
    this.clouds.forEach((c) => {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 120) c.mesh.position.x = -120;
    });

    // 11. Sparkle burst particles
    for (const p of this.particles) {
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.vel.y -= 6.5 * dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          const t = p.life / p.maxLife;
          p.mat.opacity = t;
          p.mesh.scale.setScalar(0.4 + t * 0.9);
        }
      }
    }
  }
}
