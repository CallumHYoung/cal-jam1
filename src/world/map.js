import * as THREE from 'three';

const WALL_H = 3.0;

// 100x100 axis-aligned map. North (-z) = defender, south (+z) = attacker.
// Mid divider at z=0 with five openings (A-lane, A-short, mid, B-short, B-lane)
// so there are multiple rotations and flanks every round.
export const WALLS = [
  // --- outer boundary (100x100) ---
  { x: 0, z: -50, w: 100, d: 0.6 },
  { x: 0, z: 50, w: 100, d: 0.6 },
  { x: -50, z: 0, w: 0.6, d: 100 },
  { x: 50, z: 0, w: 0.6, d: 100 },

  // --- defender spawn bunker (north) ---
  // bunker: z=-48..-36, x=-16..+16, exit opening at z=-36 centered
  { x: -16, z: -42, w: 0.6, d: 12 },
  { x:  16, z: -42, w: 0.6, d: 12 },
  { x: -28, z: -36, w: 24, d: 0.6 }, // x=-40..-16
  { x:  28, z: -36, w: 24, d: 0.6 }, // x=+16..+40

  // --- attacker spawn bunker (south) ---
  { x: -16, z: 42, w: 0.6, d: 12 },
  { x:  16, z: 42, w: 0.6, d: 12 },
  { x: -28, z: 36, w: 24, d: 0.6 },
  { x:  28, z: 36, w: 24, d: 0.6 },

  // --- mid divider (z=0) with 5 openings ---
  // openings: x=-46..-42 (A long), x=-32..-28 (A short), x=-4..+4 (mid),
  //           x=+28..+32 (B short), x=+42..+46 (B long)
  { x: -48, z: 0, w: 4,  d: 0.6 },  // -50..-46
  { x: -37, z: 0, w: 10, d: 0.6 },  // -42..-32
  { x: -16, z: 0, w: 24, d: 0.6 },  // -28..-4
  { x:  16, z: 0, w: 24, d: 0.6 },  // +4..+28
  { x:  37, z: 0, w: 10, d: 0.6 },  // +32..+42
  { x:  48, z: 0, w: 4,  d: 0.6 },  // +46..+50

  // --- A-site (west) — room around x=-40, z=0 with entrances ---
  { x: -42, z: -10, w: 16, d: 0.6 }, // top wall x=-50..-34
  { x: -42, z:  10, w: 16, d: 0.6 }, // bottom wall
  { x: -34, z:  -6, w: 0.6, d: 3 },  // side doorframe
  { x: -34, z:   6, w: 0.6, d: 3 },

  // --- B-site (east) — mirror ---
  { x:  42, z: -10, w: 16, d: 0.6 },
  { x:  42, z:  10, w: 16, d: 0.6 },
  { x:  34, z:  -6, w: 0.6, d: 3 },
  { x:  34, z:   6, w: 0.6, d: 3 },

  // --- A-long corner pieces (west lane x=-45..-42 running z=-35..+35) ---
  { x: -42, z: -22, w: 0.6, d: 6 },
  { x: -42, z:  22, w: 0.6, d: 6 },
  { x: -38, z: -28, w: 4, d: 0.6 },
  { x: -38, z:  28, w: 4, d: 0.6 },

  // --- B-long corner pieces (mirror) ---
  { x:  42, z: -22, w: 0.6, d: 6 },
  { x:  42, z:  22, w: 0.6, d: 6 },
  { x:  38, z: -28, w: 4, d: 0.6 },
  { x:  38, z:  28, w: 4, d: 0.6 },

  // --- A-short connector walls (between mid and A-site) ---
  { x: -22, z: -10, w: 0.6, d: 6 },
  { x: -22, z:  10, w: 0.6, d: 6 },
  // --- B-short connector (mirror) ---
  { x:  22, z: -10, w: 0.6, d: 6 },
  { x:  22, z:  10, w: 0.6, d: 6 },

  // --- mid room cover ---
  { x:  0, z: -10, w: 4, d: 0.6 },
  { x:  0, z:  10, w: 4, d: 0.6 },
  { x: -6, z: -5, w: 2, d: 2, h: 1.4 },
  { x:  6, z:  5, w: 2, d: 2, h: 1.4 },

  // --- A-site cover ---
  { x: -38, z: -2, w: 2,   d: 2,   h: 1.3 },
  { x: -38, z:  2, w: 2,   d: 2,   h: 1.3 },
  { x: -45, z:  0, w: 2,   d: 2,   h: 1.3 },
  { x: -36, z: -6, w: 1.4, d: 1.4, h: 1.2 },
  { x: -36, z:  6, w: 1.4, d: 1.4, h: 1.2 },

  // --- B-site cover (mirror) ---
  { x:  38, z: -2, w: 2,   d: 2,   h: 1.3 },
  { x:  38, z:  2, w: 2,   d: 2,   h: 1.3 },
  { x:  45, z:  0, w: 2,   d: 2,   h: 1.3 },
  { x:  36, z: -6, w: 1.4, d: 1.4, h: 1.2 },
  { x:  36, z:  6, w: 1.4, d: 1.4, h: 1.2 },

  // --- hallway cover (A-long) ---
  { x: -44, z: -15, w: 1.5, d: 1.5, h: 1.4 },
  { x: -44, z:  15, w: 1.5, d: 1.5, h: 1.4 },
  { x: -44, z: -30, w: 1.5, d: 1.5, h: 1.4 },
  { x: -44, z:  30, w: 1.5, d: 1.5, h: 1.4 },

  // --- hallway cover (B-long) ---
  { x:  44, z: -15, w: 1.5, d: 1.5, h: 1.4 },
  { x:  44, z:  15, w: 1.5, d: 1.5, h: 1.4 },
  { x:  44, z: -30, w: 1.5, d: 1.5, h: 1.4 },
  { x:  44, z:  30, w: 1.5, d: 1.5, h: 1.4 },

  // --- spawn exit cover (both sides) ---
  { x: -8, z: -32, w: 2, d: 2, h: 1.4 },
  { x:  8, z: -32, w: 2, d: 2, h: 1.4 },
  { x: -8, z:  32, w: 2, d: 2, h: 1.4 },
  { x:  8, z:  32, w: 2, d: 2, h: 1.4 },

  // --- mid corridor short cover (forces sharper peeks) ---
  { x: -18, z: -14, w: 2, d: 2, h: 1.4 },
  { x:  18, z: -14, w: 2, d: 2, h: 1.4 },
  { x: -18, z:  14, w: 2, d: 2, h: 1.4 },
  { x:  18, z:  14, w: 2, d: 2, h: 1.4 },

  // --- extra corner posts (defender side) ---
  { x: -28, z: -22, w: 0.6, d: 0.6, h: WALL_H },
  { x:  28, z: -22, w: 0.6, d: 0.6, h: WALL_H },
  { x: -28, z:  22, w: 0.6, d: 0.6, h: WALL_H },
  { x:  28, z:  22, w: 0.6, d: 0.6, h: WALL_H },
];

// Full-width barrier across the attacker side — blocks anyone trying to leave
// during buy/agent-select, even around the bunker edges.
export const ATTACKER_BARRIERS = [
  { x: 0, z: 30, w: 100, d: 0.6, h: 3 },
];

export const SPAWNS = {
  teamA: [ // north, defenders
    { x: -6, z: -44 }, { x: -3, z: -44 }, { x: 0, z: -44 }, { x: 3, z: -44 }, { x: 6, z: -44 },
  ],
  teamB: [ // south, attackers
    { x: -6, z: 44 }, { x: -3, z: 44 }, { x: 0, z: 44 }, { x: 3, z: 44 }, { x: 6, z: 44 },
  ],
};

export const LOBBY_SPAWN = { x: 0, z: -20 };

export const TEAM_PADS = [
  { team: 'A', x: -12, z: -20, r: 3.5, color: 0x4aa3ff, label: 'ALPHA (defend)' },
  { team: 'B', x:  12, z: -20, r: 3.5, color: 0xff4d6a, label: 'BRAVO (attack)' },
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

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1c1226, roughness: 0.85, metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(220, 110, 0x4a2d78, 0x2a1646);
  grid.position.y = 0.01;
  scene.add(grid);

  // team-side accent flooring
  const accentA = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 3),
    new THREE.MeshBasicMaterial({ color: 0x2b6cff, transparent: true, opacity: 0.28 })
  );
  accentA.rotation.x = -Math.PI / 2;
  accentA.position.set(0, 0.02, -47);
  scene.add(accentA);
  const accentB = accentA.clone();
  accentB.material = accentA.material.clone();
  accentB.material.color.setHex(0xff4d6a);
  accentB.position.z = 47;
  scene.add(accentB);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2e1f48, roughness: 0.6, metalness: 0.3,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x4a3566, roughness: 0.75, metalness: 0.2,
  });
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x6a4d90, roughness: 0.6, metalness: 0.4,
  });

  for (const w of WALLS) {
    const h = w.h ?? WALL_H;
    const geo = new THREE.BoxGeometry(w.w, h, w.d);
    const isCrate = (w.w <= 2.5 && w.d <= 2.5 && h < WALL_H);
    const isPost = (w.w <= 1 && w.d <= 1);
    const mesh = new THREE.Mesh(geo, isCrate ? crateMat : (isPost ? postMat : wallMat));
    mesh.position.set(w.x, h / 2, w.z);
    scene.add(mesh);

    PERMANENT_AABBS.push({
      minX: w.x - w.w / 2, maxX: w.x + w.w / 2,
      minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2,
      minY: 0, maxY: h,
    });
  }

  // team pads
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

  // attacker barriers — translucent forcefield
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
  const siteA = new THREE.Mesh(new THREE.CircleGeometry(4, 32), siteMat);
  siteA.rotation.x = -Math.PI / 2;
  siteA.position.set(-40, 0.03, 0);
  scene.add(siteA);
  const siteB = siteA.clone();
  siteB.position.set(40, 0.03, 0);
  scene.add(siteB);

  rebuildAABBs();
  return { siteA, siteB };
}

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

export function raycastWorld(origin, dir, maxDist = 400) {
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
