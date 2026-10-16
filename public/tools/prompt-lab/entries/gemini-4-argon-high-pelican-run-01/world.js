// Lighthouse Bay (灯塔湾) 3D Coastal Boardwalk World, Leaping Fish, & Lighting Presets
import * as THREE from './vendor/three.module.min.js';
import { createFishMesh } from './models.js';

export const TRACK_RADIUS_X = 28.0;
export const TRACK_RADIUS_Z = 21.0;
export const TRACK_HALF_WIDTH = 2.95;

// Approximate perimeter of ellipse for distance conversion
export const TRACK_PERIMETER = 2 * Math.PI * Math.sqrt(0.5 * (TRACK_RADIUS_X ** 2 + TRACK_RADIUS_Z ** 2));

/**
 * Evaluates a point along the closed coastal boardwalk loop at angle `theta` (radians)
 * and lateral `laneOffset` (-2.4 to +2.4).
 */
export function sampleTrack(theta, laneOffset = 0) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Subtle organic coastal bay curvature
  const rMod = 1.0 + 0.06 * Math.sin(2 * theta) - 0.04 * Math.cos(3 * theta);
  const cx = TRACK_RADIUS_X * rMod * cosT;
  const cz = TRACK_RADIUS_Z * rMod * sinT;

  // Gentle coastal elevation wave (causeway bridge on one side, harbor pier on the other)
  const elevation = 0.55 * Math.sin(theta * 2.0 - 0.4) + 0.32 * Math.cos(theta) + 0.85;

  // Derivative for tangent
  const eps = 0.002;
  const rMod2 = 1.0 + 0.06 * Math.sin(2 * (theta + eps)) - 0.04 * Math.cos(3 * (theta + eps));
  const nx = TRACK_RADIUS_X * rMod2 * Math.cos(theta + eps);
  const nz = TRACK_RADIUS_Z * rMod2 * Math.sin(theta + eps);
  const ny = 0.55 * Math.sin((theta + eps) * 2.0 - 0.4) + 0.32 * Math.cos(theta + eps) + 0.85;

  const tangent = new THREE.Vector3(nx - cx, ny - elevation, nz - cz).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  // Lateral outward vector (right-hand side of travel direction)
  const lateral = new THREE.Vector3().crossVectors(tangent, up).normalize();

  const position = new THREE.Vector3(cx, elevation, cz).addScaledVector(lateral, laneOffset);
  const heading = Math.atan2(tangent.x, tangent.z);
  const slope = Math.asin(THREE.MathUtils.clamp(tangent.y, -0.35, 0.35));

  return {
    position,
    center: new THREE.Vector3(cx, elevation, cz),
    tangent,
    lateral,
    heading,
    slope
  };
}

export const LIGHTING_PRESETS = [
  {
    id: 'day',
    label: '晴昼海风',
    shortLabel: '晴昼',
    skyTop: 0x0284c7,
    skyHorizon: 0xbae6fd,
    fogColor: 0xbae6fd,
    waterColor: 0x0ea5e9,
    waterDeep: 0x0369a1,
    sunColor: 0xfffbeb,
    sunIntensity: 2.35,
    sunPos: [34, 48, 24],
    hemiSky: 0xe0f2fe,
    hemiGround: 0xfde68a,
    hemiIntensity: 1.15,
    lanternEmissive: 0.15,
    beamOpacity: 0.0,
    starsOpacity: 0.0
  },
  {
    id: 'sunset',
    label: '落日熔金',
    shortLabel: '落日',
    skyTop: 0x4c1d95,
    skyHorizon: 0xfb923c,
    fogColor: 0xfdba74,
    waterColor: 0xea580c,
    waterDeep: 0x1e1b4b,
    sunColor: 0xfef08a,
    sunIntensity: 2.1,
    sunPos: [-45, 16, -28],
    hemiSky: 0xfdba74,
    hemiGround: 0x431407,
    hemiIntensity: 0.95,
    lanternEmissive: 1.4,
    beamOpacity: 0.24,
    starsOpacity: 0.25
  },
  {
    id: 'night',
    label: '星夜灯港',
    shortLabel: '星夜',
    skyTop: 0x020617,
    skyHorizon: 0x1e293b,
    fogColor: 0x0f172a,
    waterColor: 0x0f172a,
    waterDeep: 0x020617,
    sunColor: 0x93c5fd,
    sunIntensity: 0.65,
    sunPos: [20, 38, -30],
    hemiSky: 0x38bdf8,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.55,
    lanternEmissive: 2.4,
    beamOpacity: 0.42,
    starsOpacity: 0.95
  }
];

export function buildCoastalWorld(scene) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Materials
  const plankLightMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.82 });
  const plankDarkMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
  const timberPostMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 });
  const lighthouseWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const lighthouseRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const lanternBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.2,
    roughness: 0.2
  });

  // 1. Stylized Animated Ocean Surface
  const waterGeom = new THREE.PlaneGeometry(240, 240, 48, 48);
  waterGeom.rotateX(-Math.PI * 0.5);
  const waterPosAttr = waterGeom.attributes.position;
  const waterBaseY = new Float32Array(waterPosAttr.count);
  for (let i = 0; i < waterPosAttr.count; i++) {
    waterBaseY[i] = waterPosAttr.getY(i);
  }
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.24,
    metalness: 0.35,
    flatShading: true
  });
  const waterMesh = new THREE.Mesh(waterGeom, waterMat);
  waterMesh.position.y = -0.35;
  waterMesh.receiveShadow = true;
  worldGroup.add(waterMesh);

  // 2. Central Lighthouse Island & Rocky Atoll
  const islandGroup = new THREE.Group();
  worldGroup.add(islandGroup);

  const beachMound = new THREE.Mesh(
    new THREE.CylinderGeometry(11.5, 15.5, 2.2, 24),
    sandMat
  );
  beachMound.position.set(-2.5, -0.3, -1.0);
  beachMound.receiveShadow = true;
  islandGroup.add(beachMound);

  const cliffMound = new THREE.Mesh(
    new THREE.ConeGeometry(7.2, 5.5, 11),
    stoneMat
  );
  cliffMound.position.set(-4.5, 2.2, -2.5);
  cliffMound.castShadow = true;
  cliffMound.receiveShadow = true;
  islandGroup.add(cliffMound);

  // Red & White Striped Lighthouse with Rotating Beacon
  const lighthouseGroup = new THREE.Group();
  lighthouseGroup.position.set(-4.5, 4.4, -2.5);
  islandGroup.add(lighthouseGroup);

  for (let i = 0; i < 5; i++) {
    const rBot = 1.75 - i * 0.18;
    const rTop = 1.75 - (i + 1) * 0.18;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 1.45, 16),
      i % 2 === 0 ? lighthouseRedMat : lighthouseWhiteMat
    );
    band.position.y = i * 1.45 + 0.725;
    band.castShadow = true;
    band.receiveShadow = true;
    lighthouseGroup.add(band);
  }

  const galleryDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.05, 0.28, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
  );
  galleryDeck.position.y = 5 * 1.45 + 0.14;
  lighthouseGroup.add(galleryDeck);

  const lanternRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 1.1, 14),
    lanternBulbMat
  );
  lanternRoom.position.y = 5 * 1.45 + 0.8;
  lighthouseGroup.add(lanternRoom);

  const roofCupola = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.9, 16),
    lighthouseRedMat
  );
  roofCupola.position.y = 5 * 1.45 + 1.75;
  lighthouseGroup.add(roofCupola);

  // Rotating Lighthouse Volumetric Light Beams
  const beaconPivot = new THREE.Group();
  beaconPivot.position.y = 5 * 1.45 + 0.8;
  lighthouseGroup.add(beaconPivot);

  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  for (const dir of [-1, 1]) {
    const coneGeom = new THREE.ConeGeometry(3.2, 26, 20, 1, true);
    coneGeom.translate(0, -13, 0);
    coneGeom.rotateX(dir * Math.PI * 0.48);
    const beam = new THREE.Mesh(coneGeom, beaconMat);
    beaconPivot.add(beam);
  }

  // Coastal Pine Trees & Boulders on the central island
  const treeCoords = [
    [2.5, 0.7, 2.2, 1.2],
    [4.6, 0.6, -1.5, 0.95],
    [0.8, 0.8, -5.2, 1.1],
    [-8.2, 0.6, 3.0, 1.0],
    [5.8, 0.5, 3.8, 0.85]
  ];
  for (const [tx, ty, tz, sc] of treeCoords) {
    const tree = new THREE.Group();
    tree.position.set(tx, ty, tz);
    tree.scale.setScalar(sc);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 1.8, 8),
      timberPostMat
    );
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    tree.add(trunk);

    for (let layer = 0; layer < 3; layer++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.25 - layer * 0.28, 1.5, 9),
        foliageMat
      );
      cone.position.y = 1.85 + layer * 0.85;
      cone.castShadow = true;
      tree.add(cone);
    }
    islandGroup.add(tree);
  }

  // 3. Boardwalk Deck Planks, Pilings, Rope Railings & String Lanterns
  const plankCount = 200;
  const deckWidth = TRACK_HALF_WIDTH * 2 + 0.5;
  const plankGeom = new THREE.BoxGeometry(deckWidth, 0.14, 0.78);
  const pilingGeom = new THREE.CylinderGeometry(0.14, 0.16, 2.8, 8);
  const railPostGeom = new THREE.CylinderGeometry(0.09, 0.10, 0.95, 8);

  const plankEvenInst = new THREE.InstancedMesh(plankGeom, plankLightMat, plankCount / 2);
  const plankOddInst = new THREE.InstancedMesh(plankGeom, plankDarkMat, plankCount / 2);
  plankEvenInst.receiveShadow = true;
  plankOddInst.receiveShadow = true;
  worldGroup.add(plankEvenInst, plankOddInst);

  const postEvery = 5;
  const postTotal = (plankCount / postEvery) * 2;
  const pilingInst = new THREE.InstancedMesh(pilingGeom, timberPostMat, postTotal);
  const railPostInst = new THREE.InstancedMesh(railPostGeom, timberPostMat, postTotal);
  pilingInst.castShadow = true;
  railPostInst.castShadow = true;
  worldGroup.add(pilingInst, railPostInst);

  const dummy = new THREE.Object3D();
  let evenIdx = 0;
  let oddIdx = 0;
  let postIdx = 0;

  for (let i = 0; i < plankCount; i++) {
    const theta = (i / plankCount) * Math.PI * 2;
    const sample = sampleTrack(theta, 0);

    dummy.position.copy(sample.center);
    dummy.position.y -= 0.07;
    dummy.rotation.set(0, sample.heading, 0);
    dummy.rotateX(-sample.slope);
    dummy.updateMatrix();

    if (i % 2 === 0) {
      plankEvenInst.setMatrixAt(evenIdx++, dummy.matrix);
    } else {
      plankOddInst.setMatrixAt(oddIdx++, dummy.matrix);
    }

    if (i % postEvery === 0) {
      for (const side of [-1, 1]) {
        const edgeSample = sampleTrack(theta, side * (TRACK_HALF_WIDTH + 0.18));

        // Underwater support piling
        dummy.position.copy(edgeSample.position);
        dummy.position.y -= 1.4;
        dummy.rotation.set(0, edgeSample.heading, 0);
        dummy.updateMatrix();
        pilingInst.setMatrixAt(postIdx, dummy.matrix);

        // Boardwalk railing post
        dummy.position.copy(edgeSample.position);
        dummy.position.y += 0.42;
        dummy.updateMatrix();
        railPostInst.setMatrixAt(postIdx, dummy.matrix);
        postIdx++;
      }

      // Warm harbor lantern on every second outer post
      if ((i / postEvery) % 2 === 0) {
        const lanternSample = sampleTrack(theta, TRACK_HALF_WIDTH + 0.18);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lanternBulbMat);
        bulb.position.copy(lanternSample.position);
        bulb.position.y += 0.96;
        worldGroup.add(bulb);
      }
    }
  }

  // 4. Harbor Fish Pier Delivery Station (at theta = 0)
  const pierTheta = 0;
  const pierSample = sampleTrack(pierTheta, 0);
  const pierGroup = new THREE.Group();
  pierGroup.position.copy(pierSample.center);
  pierGroup.rotation.y = pierSample.heading;
  worldGroup.add(pierGroup);

  // Festive Pier Archway
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 3.8, 10),
      timberPostMat
    );
    pillar.position.set(side * (TRACK_HALF_WIDTH + 0.2), 1.9, 0);
    pillar.castShadow = true;
    pierGroup.add(pillar);
  }

  const archBeam = new THREE.Mesh(
    new THREE.BoxGeometry((TRACK_HALF_WIDTH + 0.35) * 2, 0.42, 0.45),
    lighthouseRedMat
  );
  archBeam.position.set(0, 3.75, 0);
  archBeam.castShadow = true;
  pierGroup.add(archBeam);

  // Target Fish Basket on the right side of the Delivery Pier
  const pierBasketPosWorld = new THREE.Vector3();
  const pierBasketGroup = new THREE.Group();
  pierBasketGroup.position.set(-(TRACK_HALF_WIDTH + 0.95), 0.55, 0);
  pierGroup.add(pierBasketGroup);

  const crateMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.58, 0.95, 14),
    plankLightMat
  );
  crateMesh.castShadow = true;
  pierBasketGroup.add(crateMesh);

  const targetHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 0.98, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfde047,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    })
  );
  targetHalo.rotation.x = -Math.PI * 0.5;
  targetHalo.position.y = 0.52;
  pierBasketGroup.add(targetHalo);

  // 5. Tailwind Boost Rings & Wooden Jump Ramps along the loop
  const boostGates = [];
  const boostThetas = [Math.PI * 0.55, Math.PI * 1.35];
  for (const bTheta of boostThetas) {
    const lane = bTheta < Math.PI ? -0.9 : 0.9;
    const bSample = sampleTrack(bTheta, lane);
    const gateGroup = new THREE.Group();
    gateGroup.position.copy(bSample.position);
    gateGroup.rotation.y = bSample.heading;

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.08, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2
      })
    );
    ringMesh.position.y = 1.35;
    gateGroup.add(ringMesh);
    worldGroup.add(gateGroup);

    boostGates.push({
      theta: bTheta,
      lane,
      position: bSample.position.clone(),
      mesh: ringMesh,
      cooldown: 0
    });
  }

  const jumpRamps = [];
  const rampThetas = [Math.PI * 0.95, Math.PI * 1.72];
  for (const rTheta of rampThetas) {
    const lane = rTheta < Math.PI * 1.2 ? 1.15 : -1.15;
    const rSample = sampleTrack(rTheta, lane);
    const rampGroup = new THREE.Group();
    rampGroup.position.copy(rSample.position);
    rampGroup.rotation.y = rSample.heading;

    const wedgeGeom = new THREE.BoxGeometry(1.45, 0.36, 2.2);
    const wedge = new THREE.Mesh(wedgeGeom, lighthouseRedMat);
    wedge.rotation.x = -0.18;
    wedge.position.set(0, 0.14, 0);
    wedge.castShadow = true;
    wedge.receiveShadow = true;
    rampGroup.add(wedge);
    worldGroup.add(rampGroup);

    jumpRamps.push({
      theta: rTheta,
      lane,
      position: rSample.position.clone(),
      cooldown: 0
    });
  }

  // 6. Interactive Leaping Silver Fish Schools along the loop
  const leapingFish = [];
  const fishCount = 9;
  for (let i = 0; i < fishCount; i++) {
    const theta = ((i + 0.5) / fishCount) * Math.PI * 2;
    const lane = ((i % 3) - 1) * 1.45;
    const trackPt = sampleTrack(theta, lane);
    const mesh = createFishMesh(1.35);
    worldGroup.add(mesh);

    // Shadow/target ring on the boardwalk beneath the leaping fish
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.44, 20),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      })
    );
    marker.rotation.x = -Math.PI * 0.5;
    marker.position.copy(trackPt.position);
    marker.position.y += 0.04;
    worldGroup.add(marker);

    leapingFish.push({
      theta,
      lane,
      basePos: trackPt.position.clone(),
      heading: trackPt.heading,
      phase: i * 0.9,
      speed: 1.85 + (i % 3) * 0.25,
      mesh,
      marker,
      caughtCooldown: 0,
      worldPos: new THREE.Vector3()
    });
  }

  // 7. Starfield Dome for Sunset/Night presets
  const starCount = 260;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const phi = u * Math.PI * 2;
    const cosTheta = 0.15 + v * 0.85;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const rad = 115;
    starPositions[i * 3] = rad * sinTheta * Math.cos(phi);
    starPositions[i * 3 + 1] = rad * cosTheta;
    starPositions[i * 3 + 2] = rad * sinTheta * Math.sin(phi);
  }
  const starGeom = new THREE.BufferGeometry();
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xf8fafc,
    size: 0.85,
    transparent: true,
    opacity: 0.0
  });
  const starField = new THREE.Points(starGeom, starMat);
  worldGroup.add(starField);

  // 8. Companion Harbor Seagulls wheeling overhead
  const gulls = [];
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const gull = new THREE.Group();
    const wingL = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.03, 0.14),
      gullMat
    );
    wingL.position.x = 0.22;
    const wingR = wingL.clone();
    wingR.position.x = -0.22;
    gull.add(wingL, wingR);
    worldGroup.add(gull);
    gulls.push({ group: gull, wingL, wingR, phase: i * 1.57 });
  }

  return {
    worldGroup,
    waterMesh,
    waterBaseY,
    waterMat,
    lanternBulbMat,
    beaconPivot,
    beaconMat,
    starMat,
    pierSample,
    pierBasketGroup,
    pierBasketPosWorld,
    targetHalo,
    boostGates,
    jumpRamps,
    leapingFish,
    gulls
  };
}
