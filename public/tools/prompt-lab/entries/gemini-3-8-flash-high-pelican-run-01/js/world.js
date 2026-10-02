import * as THREE from '../vendor/three.module.min.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.roadSegments = [];
    this.numSegments = 16;
    this.segmentLength = 12; // Total track length ~192m
    this.roadWidth = 5.6;

    this.collectibles = []; // Flying fish
    this.obstacles = [];    // Crabs & driftwood
    this.seagulls = [];     // Flying flock
    this.sceneryProps = []; // Palms, lanterns, benches
    this.particles = [];

    this.timeOfDay = 'sunset'; // 'day', 'sunset', 'night'
    this.oceanTime = 0;

    this.setupMaterials();
    this.setupLighting();
    this.buildOcean();
    this.buildRoadTrack();
    this.buildLighthouse();
    this.buildSeagulls();
    this.applyTimeOfDay(this.timeOfDay, 1.0);
  }

  setupMaterials() {
    // Ocean material
    this.matOcean = new THREE.MeshStandardMaterial({
      color: 0x1a8c9a,
      roughness: 0.15,
      metalness: 0.25,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });

    // Boardwalk Wood Planks
    this.matWoodPlank = new THREE.MeshStandardMaterial({
      color: 0xa87b51, // Sun-bleached cedar
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true
    });

    this.matWoodDark = new THREE.MeshStandardMaterial({
      color: 0x734d2f,
      roughness: 0.85,
      metalness: 0.05
    });

    // Paved bike path center strip
    this.matAsphalt = new THREE.MeshStandardMaterial({
      color: 0x3d444c,
      roughness: 0.9,
      metalness: 0.05
    });

    // Painted bike lane line
    this.matLaneStripe = new THREE.MeshStandardMaterial({
      color: 0xffd152, // Warm yellow bike lane stripe
      roughness: 0.6,
      metalness: 0.1
    });

    // Beach sand
    this.matSand = new THREE.MeshStandardMaterial({
      color: 0xecd09f,
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true
    });

    // Palm tree materials
    this.matPalmTrunk = new THREE.MeshStandardMaterial({
      color: 0x7a5230,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });

    this.matPalmLeaves = new THREE.MeshStandardMaterial({
      color: 0x2e8b57, // Lush tropical green
      roughness: 0.7,
      metalness: 0.05,
      flatShading: true
    });

    // Flying fish material
    this.matFishGold = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.7
    });

    // Crab material
    this.matCrab = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      roughness: 0.5,
      metalness: 0.1
    });

    // Lantern warm emissive
    this.matLanternGlow = new THREE.MeshStandardMaterial({
      color: 0xffe89e,
      emissive: 0xffd15c,
      emissiveIntensity: 0.2,
      roughness: 0.2
    });
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sunLight.position.set(25, 35, 20);
    this.sunLight.castShadow = true;

    // Shadow camera tuning
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 80;
    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);

    // Hemisphere light for natural sky/ground bounce
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    this.scene.add(this.hemiLight);

    // Fog
    this.scene.fog = new THREE.FogExp2(0xffeedd, 0.012);
  }

  buildOcean() {
    // Large low-poly ocean plane with animated wave vertices
    const oceanGeom = new THREE.PlaneGeometry(160, 220, 48, 54);
    oceanGeom.rotateX(-Math.PI / 2);

    this.oceanMesh = new THREE.Mesh(oceanGeom, this.matOcean);
    this.oceanMesh.position.set(-30, -0.6, 40);
    this.oceanMesh.receiveShadow = true;
    this.scene.add(this.oceanMesh);

    // Store base vertex positions for wave equation
    const pos = oceanGeom.attributes.position;
    this.oceanBaseY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this.oceanBaseY[i] = pos.getY(i);
    }
  }

  buildRoadTrack() {
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

    // Create segments
    for (let i = 0; i < this.numSegments; i++) {
      const z = -20 + i * this.segmentLength;
      const seg = this.createSegment(z);
      this.trackGroup.add(seg.group);
      this.roadSegments.push(seg);
    }
  }

  createSegment(zPos) {
    const group = new THREE.Group();
    group.position.z = zPos;

    // 1. Sandy Beach base on the right side
    const beachGeom = new THREE.BoxGeometry(24, 0.8, this.segmentLength);
    const beach = new THREE.Mesh(beachGeom, this.matSand);
    beach.position.set(13, -0.4, 0);
    beach.receiveShadow = true;
    group.add(beach);

    // 2. Pier wooden support pilings
    for (let x of [-this.roadWidth / 2 + 0.3, this.roadWidth / 2 - 0.3]) {
      const piling = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 2.0, 6),
        this.matWoodDark
      );
      piling.position.set(x, -1.0, 0);
      piling.castShadow = true;
      group.add(piling);
    }

    // 3. Central Asphalt Bike Path
    const pathMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.roadWidth - 0.8, 0.12, this.segmentLength),
      this.matAsphalt
    );
    pathMesh.position.set(0, 0, 0);
    pathMesh.receiveShadow = true;
    group.add(pathMesh);

    // Dashed center yellow line
    for (let z = -this.segmentLength / 2 + 1; z < this.segmentLength / 2; z += 2.5) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 1.2),
        this.matLaneStripe
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.065, z);
      group.add(stripe);
    }

    // 4. Boardwalk Timber Margins on Left & Right
    for (let side of [-1, 1]) {
      const margin = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.14, this.segmentLength),
        this.matWoodPlank
      );
      margin.position.set(side * (this.roadWidth / 2 - 0.2), 0.01, 0);
      margin.receiveShadow = true;
      group.add(margin);

      // Low wooden safety railing on ocean side (left side)
      if (side === -1) {
        const railTop = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, this.segmentLength),
          this.matWoodDark
        );
        railTop.position.set(side * (this.roadWidth / 2), 0.55, 0);
        railTop.castShadow = true;
        group.add(railTop);

        for (let rz = -this.segmentLength / 2 + 1.5; rz < this.segmentLength / 2; rz += 3.0) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.6, 0.08),
            this.matWoodDark
          );
          post.position.set(side * (this.roadWidth / 2), 0.28, rz);
          post.castShadow = true;
          group.add(post);
        }
      }
    }

    // 5. Scenery props on sides (Lanterns, Palm Trees, Benches)
    const hasLantern = Math.random() < 0.45;
    if (hasLantern) {
      const lantern = this.createLantern();
      lantern.position.set(this.roadWidth / 2 + 0.4, 0.05, 0);
      group.add(lantern);
    }

    const hasPalm = Math.random() < 0.65;
    if (hasPalm) {
      const palm = this.createPalmTree();
      palm.position.set(this.roadWidth / 2 + 2.5 + Math.random() * 3.5, 0, (Math.random() - 0.5) * 6);
      group.add(palm);
    }

    // Return segment object
    return { group, z: zPos };
  }

  createLantern() {
    const lanternGroup = new THREE.Group();

    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 2.8, 8),
      this.matWoodDark
    );
    pole.position.y = 1.4;
    pole.castShadow = true;
    lanternGroup.add(pole);

    // Lamp cage
    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.09, 0.26, 6),
      this.matLanternGlow
    );
    cage.position.set(0, 2.7, 0);
    lanternGroup.add(cage);

    // Small warm point light for night mode
    const pLight = new THREE.PointLight(0xffb74d, 0, 8);
    pLight.position.set(0, 2.7, 0);
    lanternGroup.add(pLight);
    lanternGroup.pointLight = pLight;

    return lanternGroup;
  }

  createPalmTree() {
    const palm = new THREE.Group();

    // Curved trunk with segment rings
    const trunkHeight = 4.5 + Math.random() * 1.5;
    const trunkCurve = (Math.random() - 0.5) * 0.8;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, trunkHeight, 7),
      this.matPalmTrunk
    );
    trunk.position.y = trunkHeight / 2;
    trunk.rotation.z = trunkCurve * 0.15;
    trunk.castShadow = true;
    palm.add(trunk);

    // Lush Palm Crown (5-7 leaves)
    const crown = new THREE.Group();
    crown.position.set(trunkCurve * 0.6, trunkHeight, 0);

    const numFronds = 6;
    for (let i = 0; i < numFronds; i++) {
      const frond = new THREE.Group();
      frond.rotation.y = (i * Math.PI * 2) / numFronds;

      const leafGeom = new THREE.ConeGeometry(0.35, 2.2, 4);
      leafGeom.rotateX(Math.PI / 2.6);
      leafGeom.scale(1.0, 0.1, 1.0);
      const leaf = new THREE.Mesh(leafGeom, this.matPalmLeaves);
      leaf.position.set(0, -0.3, 0.9);
      leaf.castShadow = true;
      frond.add(leaf);

      crown.add(frond);
    }
    palm.add(crown);
    palm.crown = crown;

    return palm;
  }

  buildLighthouse() {
    this.lighthouse = new THREE.Group();
    this.lighthouse.position.set(-38, 2.0, 75);

    // Rocky island base
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(8, 1),
      this.matSand
    );
    rock.scale.set(1.4, 0.4, 1.4);
    this.lighthouse.add(rock);

    // White & Red striped tower
    const towerGeom = new THREE.CylinderGeometry(1.6, 2.6, 16, 12);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5
    });
    const tower = new THREE.Mesh(towerGeom, towerMat);
    tower.position.y = 8;
    this.lighthouse.add(tower);

    // Red bands
    for (let y of [4.5, 9.5]) {
      const redBand = new THREE.Mesh(
        new THREE.CylinderGeometry(1.9 - y * 0.05, 2.0 - y * 0.05, 2.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xdb3a34, roughness: 0.5 })
      );
      redBand.position.y = y;
      this.lighthouse.add(redBand);
    }

    // Glass lantern room
    const lanternRoom = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 2.2, 10),
      this.matLanternGlow
    );
    lanternRoom.position.y = 16.5;
    this.lighthouse.add(lanternRoom);

    // Rotating beacon beam
    this.beaconLight = new THREE.SpotLight(0xfffaed, 3.5, 90, Math.PI / 6, 0.3);
    this.beaconLight.position.set(0, 16.5, 0);
    this.beaconTarget = new THREE.Object3D();
    this.beaconTarget.position.set(20, 10, 0);
    this.lighthouse.add(this.beaconTarget);
    this.beaconLight.target = this.beaconTarget;
    this.lighthouse.add(this.beaconLight);

    this.scene.add(this.lighthouse);
  }

  buildSeagulls() {
    const numGulls = 5;
    for (let i = 0; i < numGulls; i++) {
      const gull = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.35, 5),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
      );
      body.rotation.x = Math.PI / 2;
      gull.add(body);

      // Flapping wings
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x9eabb5, roughness: 0.7 });
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.015, 0.12), wingMat);
      wingL.position.set(-0.25, 0, 0);
      gull.add(wingL);

      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.015, 0.12), wingMat);
      wingR.position.set(0.25, 0, 0);
      gull.add(wingR);

      gull.position.set(-4 + i * 2.2, 3.5 + Math.random() * 2, 8 + i * 4);
      gull.wingL = wingL;
      gull.wingR = wingR;
      gull.basePos = gull.position.clone();
      gull.flapOffset = i * 1.3;
      gull.isRoll = false;
      gull.rollTimer = 0;

      this.scene.add(gull);
      this.seagulls.push(gull);
    }
  }

  spawnFlyingFish(zAhead) {
    const fishGroup = new THREE.Group();

    // Low-poly flying fish
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 6), this.matFishGold);
    body.rotation.x = Math.PI / 2;
    fishGroup.add(body);

    // Large iridescent fins
    const finMat = new THREE.MeshStandardMaterial({
      color: 0xffea75,
      transparent: true,
      opacity: 0.85,
      roughness: 0.2
    });
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.14), finMat);
    finL.position.set(-0.16, 0.02, 0.04);
    fishGroup.add(finL);

    const finR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.14), finMat);
    finR.position.set(0.16, 0.02, 0.04);
    fishGroup.add(finR);

    // Parabolic trajectory jumping from ocean (left: x = -6) across path to beach (x = 3.5)
    const startX = -5.5;
    const endX = (Math.random() - 0.5) * 4.0;
    const peakY = 1.2 + Math.random() * 1.5;

    fishGroup.position.set(startX, -0.4, zAhead);
    fishGroup.progress = 0;
    fishGroup.startX = startX;
    fishGroup.endX = endX;
    fishGroup.peakY = peakY;
    fishGroup.speed = 0.8 + Math.random() * 0.4;
    fishGroup.isCollected = false;

    this.scene.add(fishGroup);
    this.collectibles.push(fishGroup);
  }

  spawnCrab(zAhead) {
    const crabGroup = new THREE.Group();

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.matCrab);
    body.scale.set(1.2, 0.5, 0.9);
    crabGroup.add(body);

    // Pincers / Claws
    for (let sx of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.14), this.matCrab);
      claw.position.set(sx * 0.18, 0.04, 0.1);
      crabGroup.add(claw);
    }

    // Walking across lane
    const side = Math.random() < 0.5 ? -1 : 1;
    crabGroup.position.set(side * 2.2, 0.08, zAhead);
    crabGroup.targetX = -side * 2.2;
    crabGroup.speedX = -side * (0.8 + Math.random() * 0.6);
    crabGroup.isStartled = false;

    this.scene.add(crabGroup);
    this.obstacles.push(crabGroup);
  }

  triggerBellReactions() {
    // Startle nearby crabs and make seagulls do a celebratory loop!
    this.obstacles.forEach(crab => {
      crab.isStartled = true;
      crab.speedX *= 2.5; // Scuttle fast!
    });

    this.seagulls.forEach(gull => {
      gull.isRoll = true;
      gull.rollTimer = 0;
    });
  }

  applyTimeOfDay(mode, transitionSpeed = 1.0) {
    this.timeOfDay = mode;

    if (mode === 'day') {
      this.scene.background = new THREE.Color(0x6ec6ff);
      this.scene.fog.color.setHex(0xb3e5fc);
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.7;
      this.sunLight.color.setHex(0xfffaed);
      this.sunLight.intensity = 1.5;
      this.sunLight.position.set(20, 35, 15);
      this.matOcean.color.setHex(0x1a9ba8);
      this.matLanternGlow.emissiveIntensity = 0.05;
      this.beaconLight.intensity = 0.5;
    } else if (mode === 'sunset') {
      this.scene.background = new THREE.Color(0xfd7e48);
      this.scene.fog.color.setHex(0xffab76);
      this.ambientLight.color.setHex(0xffccaa);
      this.ambientLight.intensity = 0.55;
      this.sunLight.color.setHex(0xff7733);
      this.sunLight.intensity = 1.8;
      this.sunLight.position.set(35, 12, 10);
      this.matOcean.color.setHex(0xb8544b);
      this.matLanternGlow.emissiveIntensity = 0.45;
      this.beaconLight.intensity = 2.0;
    } else if (mode === 'night') {
      this.scene.background = new THREE.Color(0x0a1226);
      this.scene.fog.color.setHex(0x0e1a38);
      this.ambientLight.color.setHex(0x405580);
      this.ambientLight.intensity = 0.4;
      this.sunLight.color.setHex(0x8da4d0);
      this.sunLight.intensity = 0.5;
      this.sunLight.position.set(15, 25, -15);
      this.matOcean.color.setHex(0x092147);
      this.matLanternGlow.emissiveIntensity = 1.2;
      this.beaconLight.intensity = 4.5;
    }

    // Toggle lantern point lights
    const isNight = mode === 'night';
    this.trackGroup.traverse(child => {
      if (child.pointLight) {
        child.pointLight.intensity = isNight ? 1.8 : (mode === 'sunset' ? 0.6 : 0);
      }
    });
  }

  cycleTimeOfDay() {
    if (this.timeOfDay === 'day') this.applyTimeOfDay('sunset');
    else if (this.timeOfDay === 'sunset') this.applyTimeOfDay('night');
    else this.applyTimeOfDay('day');
    return this.timeOfDay;
  }

  update(dt, playerSpeed, playerZ, onCollectFish) {
    this.oceanTime += dt;

    // 1. Endless Rolling Track: Recycle passed segments to front
    const frontThreshold = playerZ - 18;
    this.roadSegments.forEach(seg => {
      if (seg.group.position.z < frontThreshold) {
        // Find furthest segment
        let maxZ = playerZ;
        this.roadSegments.forEach(s => {
          if (s.group.position.z > maxZ) maxZ = s.group.position.z;
        });
        seg.group.position.z = maxZ + this.segmentLength;

        // Occasional spawn on recycled track
        if (Math.random() < 0.6) {
          this.spawnFlyingFish(seg.group.position.z + (Math.random() - 0.5) * 6);
        }
        if (Math.random() < 0.35) {
          this.spawnCrab(seg.group.position.z + (Math.random() - 0.5) * 6);
        }
      }
    });

    // 2. Animated Low-Poly Ocean Waves
    const oceanGeom = this.oceanMesh.geometry;
    const pos = oceanGeom.attributes.position;
    const time = this.oceanTime;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const wave = Math.sin(x * 0.12 + time * 1.8) * 0.45 +
                   Math.cos(z * 0.08 + time * 1.2) * 0.35 +
                   Math.sin((x + z) * 0.05 + time * 2.5) * 0.2;
      pos.setY(i, this.oceanBaseY[i] + wave);
    }
    pos.needsUpdate = true;
    oceanGeom.computeVertexNormals();

    // 3. Lighthouse Sweeping Beacon
    if (this.lighthouse) {
      const beaconAngle = this.oceanTime * 0.8;
      this.beaconTarget.position.x = Math.cos(beaconAngle) * 35;
      this.beaconTarget.position.z = Math.sin(beaconAngle) * 35;
    }

    // 4. Update Seagulls Flock
    this.seagulls.forEach((gull, idx) => {
      // Bob and follow near player
      gull.flapOffset += dt * 8;
      const flap = Math.sin(gull.flapOffset) * 0.4;
      gull.wingL.rotation.z = flap;
      gull.wingR.rotation.z = -flap;

      // Keep pace with player with gentle circling
      const targetZ = playerZ + 6 + idx * 3 + Math.sin(time + idx) * 3;
      gull.position.z += (targetZ - gull.position.z) * dt * 2;
      gull.position.y = 3.6 + Math.sin(time * 1.5 + idx) * 0.8;
      gull.position.x = -3.5 + Math.cos(time * 0.8 + idx) * 1.8;

      if (gull.isRoll) {
        gull.rollTimer += dt * 6;
        gull.rotation.z = gull.rollTimer;
        if (gull.rollTimer > Math.PI * 2) {
          gull.isRoll = false;
          gull.rotation.z = 0;
        }
      }
    });

    // 5. Update Flying Fish Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const fish = this.collectibles[i];
      fish.progress += dt * fish.speed;

      // Parabolic jump curve
      const p = fish.progress;
      if (p <= 1.0) {
        fish.position.x = THREE.MathUtils.lerp(fish.startX, fish.endX, p);
        fish.position.y = Math.sin(p * Math.PI) * fish.peakY;
        fish.rotation.z = -Math.sin(p * Math.PI) * 0.8;
        fish.rotation.y = (fish.endX > fish.startX ? 1 : -1) * 0.4;
      } else {
        // Plunge back into water
        fish.position.y -= dt * 2;
        if (fish.position.y < -1.0) {
          this.scene.remove(fish);
          this.collectibles.splice(i, 1);
          continue;
        }
      }

      // Despawn behind player
      if (fish.position.z < playerZ - 10) {
        this.scene.remove(fish);
        this.collectibles.splice(i, 1);
      }
    }

    // 6. Update Crabs
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const crab = this.obstacles[i];
      crab.position.x += crab.speedX * dt;

      // Waving claws
      crab.rotation.y = Math.sin(time * 10) * 0.2 + (crab.speedX > 0 ? 0 : Math.PI);

      if (Math.abs(crab.position.x) > 3.6 || crab.position.z < playerZ - 10) {
        this.scene.remove(crab);
        this.obstacles.splice(i, 1);
      }
    }
  }
}
