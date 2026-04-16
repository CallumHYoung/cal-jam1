import * as THREE from 'three';

const WALL_H = 2.8;

// Axis-aligned boxes: {x, z, w, d, h=WALL_H} where (x,z) is center.
// Layout is roughly symmetric across z=0. North (-z) is defender side,
// south (+z) is attacker side. Mid divider at z=0 has three openings:
// a left lane (x≈-22), mid (x≈0), and a right lane (x≈+22).
export const WALLS = [
  // --- outer boundary (70x70) ---
  { x:  0, z:-35, w: 70, d: 0.5 },
  { x:  0, z: 35, w: 70, d: 0.5 },
  { x:-35, z:  0, w: 0.5, d: 70 },
  { x: 35, z:  0, w: 0.5, d: 70 },

  // --- defender spawn bunker (north) ---
  { x:-12, z:-30, w: 0.5, d: 9 },
  { x: 12, z:-30, w: 0.5, d: 9 },
  { x:-18.25, z:-26, w: 12.5, d: 0.5 }, // front wall left (x=-24.5..-12)
  { x: 18.25, z:-26, w: 12.5, d: 0.5 }, // front wall right (x=12..24.5)
  // opening: x=-12..+12

  // --- attacker spawn bunker (south) ---
  { x:-12, z: 30, w: 0.5, d: 9 },
  { x: 12, z: 30, w: 0.5, d: 9 },
  { x:-18.25, z: 26, w: 12.5, d: 0.5 },
  { x: 18.25, z: 26, w: 12.5, d: 0.5 },

  // --- mid divider (z=0) with 3 openings ---
  // openings: left lane x=-24..-20, mid x=-6..+6, right lane x=+20..+24
  { x:-29.5, z: 0, w: 11, d: 0.5 }, // -35..-24
  { x:-13,   z: 0, w: 14, d: 0.5 }, // -20..-6
  { x: 13,   z: 0, w: 14, d: 0.5 }, // 6..20
  { x: 29.5, z: 0, w: 11, d: 0.5 }, // 24..35

  // --- A-site walls (west, x≈-22) ---
  { x:-26, z:-10, w: 6, d: 0.5 },
  { x:-26, z: 10, w: 6, d: 0.5 },

  // --- B-site walls (east, x≈+22) ---
  { x: 26, z:-10, w: 6, d: 0.5 },
  { x: 26, z: 10, w: 6, d: 0.5 },

  // --- cover crates ---
  { x:-22, z:-4, w: 1.8, d: 1.8, h: 1.3 },
  { x:-22, z: 4, w: 1.8, d: 1.8, h: 1.3 },
  { x: 22, z:-4, w: 1.8, d: 1.8, h: 1.3 },
  { x: 22, z: 4, w: 1.8, d: 1.8, h: 1.3 },
  { x:  0, z:-8, w: 2.2, d: 2.2, h: 1.4 },
  { x:  0, z: 8, w: 2.2, d: 2.2, h: 1.4 },
  { x: -4, z:-2, w: 1.6, d: 1.6, h: 1.4 },
  { x:  4, z: 2, w: 1.6, d: 1.6, h: 1.4 },
  { x:-14, z:-14, w: 2, d: 2, h: 1.4 },
  { x: 14, z: 14, w: 2, d: 2, h: 1.4 },
  { x: 14, z:-14, w: 2, d: 2, h: 1.4 },
  { x:-14, z: 14, w: 2, d: 2, h: 1.4 },
  { x:-6, z:-22, w: 2, d: 2, h: 1.4 },
  { x: 6, z:-22, w: 2, d: 2, h: 1.4 },
  { x:-6, z: 22, w: 2, d: 2, h: 1.4 },
  { x: 6, z: 22, w: 2, d: 2, h: 1.4 },

  // deep corner cover inside sites
  { x:-30, z: 0, w: 2, d: 2, h: 1.4 },
  { x: 30, z: 0, w: 2, d: 2, h: 1.4 },
];

// Attacker-only barriers (active only during BUY phase).
// Sits across the attacker bunker exit at z≈23.
export const ATTACKER_BARRIERS = [
  { x: 0, z: 23, w: 30, d: 0.5, h: 3 },
];

export const SPAWNS = {
  teamA: [ // north, defenders
    { x:-4, z:-30 }, { x:-2, z:-30 }, { x: 0, z:-30 }, { x: 2, z:-30 }, { x: 4, z:-30 },
  ],
  teamB: [ // south, attackers
    { x:-4, z: 30 }, { x:-2, z: 30 }, { x: 0, z: 30 }, { x: 2, z: 30 }, { x: 4, z: 30 },
  ],
};

// Lobby spawn point — neutral middle-south area
export const LOBBY_SPAWN = { x: 0, z: -18 };

// Team-selection pads on the lobby floor
export const TEAM_PADS = [
  { team: 'A', x: -10, z: -18, r: 3, color: 0x4aa3ff, label: 'ALPHA (defend)' },
  { team: 'B', x:  10, z: -18, r: 3, color: 0xff4d6a, label: 'BRAVO (attack)' },
];

export function getTeamPadAt(x, z) {
  for (const pad of TEAM_PADS) {
    const dx = x - pad.x, dz = z - pad.z;
    if (dx * dx + dz * dz <= pad.r * pad.r) return pad.team;
  }
  return null;
}

// Combined AABB list (permanents + active barriers). Rebuilt when barriers toggle.
export const WORLD_AABBS = [];
const PERMANENT_AABBS = [];
const BARRIER_AABBS = [];
let barriersActive = false;
let barrierMeshes = [];

function rebuildAABBs() {
  WORLD_AABBS.length = 0;
  WORLD_AABBS.push(...PERMANENT_AABBS);
  if (barriersActive) WORLD_AABBS.push(...BARRIER_AABBS);
}

export function setBarriersActive(active) {
  barriersActive = !!active;
  for (const m of barrierMeshes) m.visible = barriersActive;
  rebuildAABBs();
}

export function buildMap(scene) {
  PERMANENT_AABBS.length = 0;
  BARRIER_AABBS.length = 0;
  barrierMeshes = [];

  // floor — much bigger textured grid
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1c1226, roughness: 0.85, metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(160, 80, 0x4a2d78, 0x2a1646);
  grid.position.y = 0.01;
  scene.add(grid);

  // team-side accent flooring
  const accentA = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 2.2),
    new THREE.MeshBasicMaterial({ color: 0x2b6cff, transparent: true, opacity: 0.28 })
  );
  accentA.rotation.x = -Math.PI / 2;
  accentA.position.set(0, 0.02, -33);
  scene.add(accentA);
  const accentB = accentA.clone();
  accentB.material = accentA.material.clone();
  accentB.material.color.setHex(0xff4d6a);
  accentB.position.z = 33;
  scene.add(accentB);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2e1f48, roughness: 0.6, metalness: 0.3,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x4a3566, roughness: 0.75, metalness: 0.2,
  });

  for (const w of WALLS) {
    const h = w.h ?? WALL_H;
    const geo = new THREE.BoxGeometry(w.w, h, w.d);
    const isCrate = (w.w <= 2.5 && w.d <= 2.5);
    const mesh = new THREE.Mesh(geo, isCrate ? crateMat : wallMat);
    mesh.position.set(w.x, h / 2, w.z);
    scene.add(mesh);

    PERMANENT_AABBS.push({
      minX: w.x - w.w / 2, maxX: w.x + w.w / 2,
      minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2,
      minY: 0, maxY: h,
    });
  }

  // team pads (lobby team-pick)
  for (const pad of TEAM_PADS) {
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(pad.r, 40),
      new THREE.MeshBasicMaterial({ color: pad.color, transparent: true, opacity: 0.28 })
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.set(pad.x, 0.04, pad.z);
    scene.add(disk);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(pad.r - 0.08, pad.r, 48),
      new THREE.MeshBasicMaterial({ color: pad.color, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pad.x, 0.05, pad.z);
    scene.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 4, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: pad.color, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    beam.position.set(pad.x, 2, pad.z);
    scene.add(beam);
  }

  // attacker barriers — visible only during BUY phase
  const barrierMat = new THREE.MeshBasicMaterial({
    color: 0xffb24a,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  for (const b of ATTACKER_BARRIERS) {
    const h = b.h ?? 3;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(b.w, h), barrierMat);
    plane.position.set(b.x, h / 2, b.z);
    plane.visible = false;
    scene.add(plane);
    // glowing horizontal stripes
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(b.w, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      );
      stripe.position.set(b.x, 0.5 + i * 0.9, b.z + 0.01);
      stripe.visible = false;
      scene.add(stripe);
      barrierMeshes.push(stripe);
    }
    barrierMeshes.push(plane);

    BARRIER_AABBS.push({
      minX: b.x - b.w / 2, maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2,
      minY: 0, maxY: h,
    });
  }

  // site markers
  const siteMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.18 });
  const siteA = new THREE.Mesh(new THREE.CircleGeometry(3, 24), siteMat);
  siteA.rotation.x = -Math.PI / 2;
  siteA.position.set(-22, 0.03, 0);
  scene.add(siteA);
  const siteB = siteA.clone();
  siteB.position.set(22, 0.03, 0);
  scene.add(siteB);

  rebuildAABBs();
  return { siteA, siteB };
}

// Collision: resolve circle-vs-box against active AABBs.
export function resolveMovement(prevX, prevZ, newX, newZ, radius = 0.35) {
  let x = newX, z = newZ;
  for (const a of WORLD_AABBS) {
    const cx = Math.max(a.minX, Math.min(x, a.maxX));
    const cz = Math.max(a.minZ, Math.min(z, a.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx*dx + dz*dz;
    if (d2 < radius * radius) {
      if (Math.abs(dx) > Math.abs(dz)) {
        x = dx < 0 ? a.minX - radius : a.maxX + radius;
      } else {
        z = dz < 0 ? a.minZ - radius : a.maxZ + radius;
      }
    }
  }
  return { x, z };
}

export function raycastWorld(origin, dir, maxDist = 300) {
  let best = maxDist;
  for (const a of WORLD_AABBS) {
    const t = rayAABB(origin, dir, a, best);
    if (t !== null && t < best) best = t;
  }
  return best;
}

function rayAABB(o, d, a, maxT) {
  let tmin = 0, tmax = maxT;
  for (const axis of ['x', 'y', 'z']) {
    const oA = o[axis], dA = d[axis];
    const min = a['min' + axis.toUpperCase()];
    const max = a['max' + axis.toUpperCase()];
    if (Math.abs(dA) < 1e-8) {
      if (oA < min || oA > max) return null;
      continue;
    }
    let t1 = (min - oA) / dA;
    let t2 = (max - oA) / dA;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin > 0 ? tmin : null;
}
