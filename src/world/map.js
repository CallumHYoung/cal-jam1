import * as THREE from 'three';

const WALL_H = 3.2;
// Walkable top height — boxes up to this are stand-on-able / jump-on-able.
// Anything taller is a full wall.
const WALKABLE_TOP = 2.9;

// ============================================================================
// 140x140 tactical map with two bomb sites (A west, B east).
// North (-z) = defenders. South (+z) = attackers.
// Designed for: big corners, long sightlines broken by chokepoints, two-tier
// verticality (low crates 1.2m + tall "heaven" boxes 2.4m beside stair crates).
// ============================================================================
export const WALLS = [
  // -------- outer boundary (140x140) --------
  { x: 0,   z: -70, w: 140, d: 0.6 },
  { x: 0,   z:  70, w: 140, d: 0.6 },
  { x: -70, z: 0,   w: 0.6, d: 140 },
  { x:  70, z: 0,   w: 0.6, d: 140 },

  // -------- defender spawn bunker (north: z=-68..-52, x=-22..+22) --------
  { x: -22, z: -60, w: 0.6, d: 16 },
  { x:  22, z: -60, w: 0.6, d: 16 },
  { x: -14, z: -52, w: 16,  d: 0.6 }, // x=-22..-6
  { x:  14, z: -52, w: 16,  d: 0.6 }, // x=+6..+22

  // -------- attacker spawn bunker (south) --------
  { x: -22, z:  60, w: 0.6, d: 16 },
  { x:  22, z:  60, w: 0.6, d: 16 },
  { x: -14, z:  52, w: 16,  d: 0.6 },
  { x:  14, z:  52, w: 16,  d: 0.6 },

  // ========== A-SITE (west) — room x=-70..-42, z=-16..+6 ==========
  // East wall with TWO entries: A-main (z=-10..-6) and A-cross (z=0..+4)
  { x: -42, z: -13,  w: 0.6, d: 6 },   // z=-16..-10
  { x: -42, z: -3,   w: 0.6, d: 6 },   // z=-6..0
  { x: -42, z:  5,   w: 0.6, d: 2 },   // z=+4..+6
  // North wall of A-site (z=-16, x=-70..-42)
  { x: -56, z: -16, w: 28, d: 0.6 },
  // South wall of A-site (z=+6)
  { x: -56, z:   6, w: 28, d: 0.6 },

  // A-site cover (plant zones + heaven)
  { x: -54, z: -6, w: 3.5, d: 3.5, h: 1.5 },   // central crate stack base
  { x: -58, z: -6, w: 2,   d: 2,   h: 2.6 },   // heaven box behind (step up from base)
  { x: -48, z: -10, w: 2, d: 2, h: 1.2 },      // plant-corner NE
  { x: -48, z:  0,  w: 2, d: 2, h: 1.2 },      // plant-corner SE
  { x: -62, z:  1,  w: 2, d: 2, h: 1.4 },      // deep corner cover
  { x: -50, z: -13, w: 1.5, d: 1.5, h: 1.4 },  // default-ish spot
  { x: -65, z: -10, w: 2, d: 2, h: 1.5 },      // back-site elevated

  // ========== B-SITE (east) — mirror ==========
  { x:  42, z: -13,  w: 0.6, d: 6 },
  { x:  42, z: -3,   w: 0.6, d: 6 },
  { x:  42, z:  5,   w: 0.6, d: 2 },
  { x:  56, z: -16, w: 28, d: 0.6 },
  { x:  56, z:   6, w: 28, d: 0.6 },
  { x:  54, z: -6, w: 3.5, d: 3.5, h: 1.5 },
  { x:  58, z: -6, w: 2,   d: 2,   h: 2.6 },
  { x:  48, z: -10, w: 2, d: 2, h: 1.2 },
  { x:  48, z:  0,  w: 2, d: 2, h: 1.2 },
  { x:  62, z:  1,  w: 2, d: 2, h: 1.4 },
  { x:  50, z: -13, w: 1.5, d: 1.5, h: 1.4 },
  { x:  65, z: -10, w: 2, d: 2, h: 1.5 },

  // ========== MID — big central obstacle + chokepoint walls ==========
  // Mid chokepoint walls north side (z=-20) — open gap x=-4..+4
  { x: -15, z: -20, w: 22, d: 0.6 },   // x=-26..-4
  { x:  15, z: -20, w: 22, d: 0.6 },   // x=+4..+26
  // Mid chokepoint walls south side (z=+20) — open gap x=-4..+4
  { x: -15, z:  20, w: 22, d: 0.6 },
  { x:  15, z:  20, w: 22, d: 0.6 },

  // Central mega-obstacle — big cube you must route around (blocks direct sightline)
  { x: 0, z: 0, w: 8, d: 8, h: 3.2 },    // solid mid tower
  // Step boxes letting someone hop up onto adjacent cover (not the tower itself)
  { x: -7, z: -7, w: 2, d: 2, h: 1.3 },
  { x:  7, z:  7, w: 2, d: 2, h: 1.3 },
  { x: -7, z:  7, w: 2, d: 2, h: 1.3 },
  { x:  7, z: -7, w: 2, d: 2, h: 1.3 },
  // Mid close-cover pieces
  { x: -12, z:  0, w: 1.5, d: 4, h: 1.4 },
  { x:  12, z:  0, w: 1.5, d: 4, h: 1.4 },

  // ========== A-SHORT lane (cuts from mid to A-site entrance at x=-42,z=-8) ==========
  // Wall running north (z=-36..-24) at x=-30 blocks defender rotation
  { x: -30, z: -30, w: 0.6, d: 12 },
  // Southern half
  { x: -30, z:  30, w: 0.6, d: 12 },
  // Stubs
  { x: -30, z: -18, w: 0.6, d: 4 },    // z=-20..-16
  { x: -30, z:  18, w: 0.6, d: 4 },

  // A-short cover (forces peek & counter-peek)
  { x: -36, z: -12, w: 2, d: 2, h: 1.5 },   // corner on A-main entry
  { x: -36, z:   2, w: 2, d: 2, h: 1.5 },
  { x: -26, z: -10, w: 2, d: 2, h: 1.4 },
  { x: -26, z:   8, w: 2, d: 2, h: 1.4 },

  // ========== B-SHORT (mirror) ==========
  { x:  30, z: -30, w: 0.6, d: 12 },
  { x:  30, z:  30, w: 0.6, d: 12 },
  { x:  30, z: -18, w: 0.6, d: 4 },
  { x:  30, z:  18, w: 0.6, d: 4 },
  { x:  36, z: -12, w: 2, d: 2, h: 1.5 },
  { x:  36, z:   2, w: 2, d: 2, h: 1.5 },
  { x:  26, z: -10, w: 2, d: 2, h: 1.4 },
  { x:  26, z:   8, w: 2, d: 2, h: 1.4 },

  // ========== A-LONG lane (west corridor, x=-65..-42, running z=-45..+45) ==========
  // Big L-corner walls create a snake route for attackers
  // Attacker side (south) wall
  { x: -55, z:  34, w: 10,  d: 0.6 },   // x=-60..-50, z=+34
  { x: -50, z:  28, w: 0.6, d: 12 },    // z=+22..+34  (L corner)
  // Defender side (north) wall (forces peekable angles into site)
  { x: -55, z: -28, w: 10,  d: 0.6 },
  { x: -50, z: -22, w: 0.6, d: 12 },

  // A-long cover (verticality — stair + heaven)
  { x: -62, z:  42, w: 3,   d: 3, h: 1.4 },    // stair box
  { x: -58, z:  42, w: 2,   d: 2, h: 2.6 },    // heaven
  { x: -48, z:  42, w: 2.5, d: 2.5, h: 1.4 },
  { x: -60, z:  15, w: 3,   d: 3, h: 1.5 },    // mid-lane cover
  { x: -48, z:  18, w: 2,   d: 2, h: 1.3 },

  { x: -62, z: -42, w: 3,   d: 3, h: 1.4 },
  { x: -58, z: -42, w: 2,   d: 2, h: 2.6 },
  { x: -48, z: -42, w: 2.5, d: 2.5, h: 1.4 },
  { x: -60, z: -15, w: 3,   d: 3, h: 1.5 },

  // ========== B-LONG (mirror) ==========
  { x:  55, z:  34, w: 10,  d: 0.6 },
  { x:  50, z:  28, w: 0.6, d: 12 },
  { x:  55, z: -28, w: 10,  d: 0.6 },
  { x:  50, z: -22, w: 0.6, d: 12 },
  { x:  62, z:  42, w: 3,   d: 3, h: 1.4 },
  { x:  58, z:  42, w: 2,   d: 2, h: 2.6 },
  { x:  48, z:  42, w: 2.5, d: 2.5, h: 1.4 },
  { x:  60, z:  15, w: 3,   d: 3, h: 1.5 },
  { x:  48, z:  18, w: 2,   d: 2, h: 1.3 },
  { x:  62, z: -42, w: 3,   d: 3, h: 1.4 },
  { x:  58, z: -42, w: 2,   d: 2, h: 2.6 },
  { x:  48, z: -42, w: 2.5, d: 2.5, h: 1.4 },
  { x:  60, z: -15, w: 3,   d: 3, h: 1.5 },

  // ========== Spawn exit cover (stops pre-aim from bunker door) ==========
  { x: -12, z: -46, w: 3, d: 2, h: 1.6 },
  { x:  12, z: -46, w: 3, d: 2, h: 1.6 },
  { x: -12, z:  46, w: 3, d: 2, h: 1.6 },
  { x:  12, z:  46, w: 3, d: 2, h: 1.6 },

  // ========== Extra big corner pieces near chokepoint gaps (tall — sniper can't see over) ==========
  { x: -4, z: -24, w: 1.6, d: 3, h: WALL_H },
  { x:  4, z: -24, w: 1.6, d: 3, h: WALL_H },
  { x: -4, z:  24, w: 1.6, d: 3, h: WALL_H },
  { x:  4, z:  24, w: 1.6, d: 3, h: WALL_H },

  // Posts near mid-lane to break line-of-sight
  { x: -20, z: -28, w: 0.8, d: 0.8, h: WALL_H },
  { x:  20, z: -28, w: 0.8, d: 0.8, h: WALL_H },
  { x: -20, z:  28, w: 0.8, d: 0.8, h: WALL_H },
  { x:  20, z:  28, w: 0.8, d: 0.8, h: WALL_H },

  // ========== SIGHTLINE BREAKERS (sniper nerf) ==========
  // Tall 2x2 pillars that chop long north-south corridors into short segments.
  // Players can strafe around them; snipers can't pre-hold end-to-end.

  // --- A-long lane zig-zag ---
  { x: -56, z:  14, w: 2, d: 2, h: WALL_H },
  { x: -63, z:   6, w: 2, d: 2, h: WALL_H },
  { x: -52, z:  -2, w: 2, d: 2, h: WALL_H },
  { x: -63, z: -10, w: 2, d: 2, h: WALL_H },
  { x: -56, z: -18, w: 2, d: 2, h: WALL_H },
  // --- B-long lane zig-zag (mirror) ---
  { x:  56, z:  14, w: 2, d: 2, h: WALL_H },
  { x:  63, z:   6, w: 2, d: 2, h: WALL_H },
  { x:  52, z:  -2, w: 2, d: 2, h: WALL_H },
  { x:  63, z: -10, w: 2, d: 2, h: WALL_H },
  { x:  56, z: -18, w: 2, d: 2, h: WALL_H },

  // --- Attacker-side mid lane (z=+22..+50) ---
  { x: -16, z:  30, w: 2, d: 2, h: WALL_H },
  { x:  16, z:  30, w: 2, d: 2, h: WALL_H },
  { x:   0, z:  36, w: 2, d: 2, h: WALL_H },
  { x: -26, z:  42, w: 2, d: 2, h: WALL_H },
  { x:  26, z:  42, w: 2, d: 2, h: WALL_H },
  // --- Defender-side mid lane (z=-22..-50, mirror) ---
  { x: -16, z: -30, w: 2, d: 2, h: WALL_H },
  { x:  16, z: -30, w: 2, d: 2, h: WALL_H },
  { x:   0, z: -36, w: 2, d: 2, h: WALL_H },
  { x: -26, z: -42, w: 2, d: 2, h: WALL_H },
  { x:  26, z: -42, w: 2, d: 2, h: WALL_H },

  // --- Short partial walls flanking mid tower (force tight corners) ---
  { x: -10, z:  -9, w: 0.6, d: 4, h: WALL_H },  // vertical wall x=-10, z=-11..-7
  { x:  10, z:  -9, w: 0.6, d: 4, h: WALL_H },
  { x: -10, z:   9, w: 0.6, d: 4, h: WALL_H },
  { x:  10, z:   9, w: 0.6, d: 4, h: WALL_H },
  // Small pillars on the tower flanks to short-circuit flanking sightlines
  { x: -20, z:  -4, w: 2, d: 2, h: WALL_H },
  { x:  20, z:  -4, w: 2, d: 2, h: WALL_H },
  { x: -20, z:   4, w: 2, d: 2, h: WALL_H },
  { x:  20, z:   4, w: 2, d: 2, h: WALL_H },

  // --- A/B short lane extra corner peeks ---
  { x: -34, z:  20, w: 2, d: 2, h: WALL_H },  // tight corner at A-short + mid joint
  { x:  34, z:  20, w: 2, d: 2, h: WALL_H },
  { x: -34, z: -20, w: 2, d: 2, h: WALL_H },
  { x:  34, z: -20, w: 2, d: 2, h: WALL_H },
];

// Full-width barrier across the attacker side — blocks them leaving spawn
// during buy/agent-select.
export const ATTACKER_BARRIERS = [
  { x: 0, z: 50, w: 140, d: 0.6, h: 3 },
];

// Bomb sites — circular zones. The spike can be planted anywhere inside.
export const BOMB_SITES = [
  { id: 'A', x: -55, z: -5, r: 6.5 },
  { id: 'B', x:  55, z: -5, r: 6.5 },
];

export function getBombSiteAt(x, z) {
  for (const s of BOMB_SITES) {
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz <= s.r * s.r) return s.id;
  }
  return null;
}

export const SPAWNS = {
  teamA: [ // north, defenders
    { x: -8, z: -62 }, { x: -4, z: -62 }, { x: 0, z: -62 }, { x: 4, z: -62 }, { x: 8, z: -62 },
  ],
  teamB: [ // south, attackers
    { x: -8, z: 62 }, { x: -4, z: 62 }, { x: 0, z: 62 }, { x: 4, z: 62 }, { x: 8, z: 62 },
  ],
};

export const LOBBY_SPAWN = { x: 0, z: -35 };

export const TEAM_PADS = [
  { team: 'A', x: -14, z: -35, r: 3.5, color: 0x4aa3ff, label: 'ALPHA (defend)' },
  { team: 'B', x:  14, z: -35, r: 3.5, color: 0xff4d6a, label: 'BRAVO (attack)' },
];

export function getTeamPadAt(x, z) {
  for (const pad of TEAM_PADS) {
    const dx = x - pad.x, dz = z - pad.z;
    if (dx * dx + dz * dz <= pad.r * pad.r) return pad.team;
  }
  return null;
}

// Combined AABB list (permanents + active barriers + dynamic). Rebuilt on change.
export const WORLD_AABBS = [];
const PERMANENT_AABBS = [];
const BARRIER_AABBS = [];
const DYNAMIC_AABBS = new Map(); // id → aabb (from abilities like the Sentinel wall)
let nextDynId = 1;
let barriersActive = false;
let barrierMeshes = [];

function rebuildAABBs() {
  WORLD_AABBS.length = 0;
  WORLD_AABBS.push(...PERMANENT_AABBS);
  if (barriersActive) WORLD_AABBS.push(...BARRIER_AABBS);
  for (const a of DYNAMIC_AABBS.values()) WORLD_AABBS.push(a);
}

export function setBarriersActive(active) {
  barriersActive = !!active;
  for (const m of barrierMeshes) m.visible = barriersActive;
  rebuildAABBs();
}

export function addDynamicAABB(aabb) {
  const id = nextDynId++;
  DYNAMIC_AABBS.set(id, aabb);
  rebuildAABBs();
  return id;
}

export function removeDynamicAABB(id) {
  if (DYNAMIC_AABBS.delete(id)) rebuildAABBs();
}

export function buildMap(scene) {
  PERMANENT_AABBS.length = 0;
  BARRIER_AABBS.length = 0;
  barrierMeshes = [];

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1c1226, roughness: 0.85, metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(300, 150, 0x4a2d78, 0x2a1646);
  grid.position.y = 0.01;
  scene.add(grid);

  // team-side accent flooring
  const accentA = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 4),
    new THREE.MeshBasicMaterial({ color: 0x2b6cff, transparent: true, opacity: 0.28 })
  );
  accentA.rotation.x = -Math.PI / 2;
  accentA.position.set(0, 0.02, -64);
  scene.add(accentA);
  const accentB = accentA.clone();
  accentB.material = accentA.material.clone();
  accentB.material.color.setHex(0xff4d6a);
  accentB.position.z = 64;
  scene.add(accentB);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2e1f48, roughness: 0.6, metalness: 0.3,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x4a3566, roughness: 0.75, metalness: 0.2,
  });
  const heavenMat = new THREE.MeshStandardMaterial({
    color: 0x6b4aa0, roughness: 0.55, metalness: 0.35,
    emissive: 0x2a1448, emissiveIntensity: 0.25,
  });
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x6a4d90, roughness: 0.6, metalness: 0.4,
  });

  for (const w of WALLS) {
    const h = w.h ?? WALL_H;
    const geo = new THREE.BoxGeometry(w.w, h, w.d);
    const isCrate = (w.w <= 3.5 && w.d <= 3.5 && h <= 1.8);
    const isHeaven = (w.w <= 3.5 && w.d <= 3.5 && h > 1.8 && h <= WALKABLE_TOP);
    const isPost = (w.w <= 1 && w.d <= 1 && h > WALKABLE_TOP);
    const mat = isCrate ? crateMat : (isHeaven ? heavenMat : (isPost ? postMat : wallMat));
    const mesh = new THREE.Mesh(geo, mat);
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

  // site markers (visual only — BOMB_SITES is authoritative)
  const siteMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.18 });
  const siteRingMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.7 });
  const siteMeshes = {};
  for (const s of BOMB_SITES) {
    const disk = new THREE.Mesh(new THREE.CircleGeometry(s.r, 48), siteMat);
    disk.rotation.x = -Math.PI / 2;
    disk.position.set(s.x, 0.03, s.z);
    scene.add(disk);

    const ring = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.1, s.r, 64), siteRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.04, s.z);
    scene.add(ring);

    // letter marker floating above the site
    const letterCanvas = document.createElement('canvas');
    letterCanvas.width = 128; letterCanvas.height = 128;
    const lctx = letterCanvas.getContext('2d');
    lctx.fillStyle = 'rgba(0,0,0,0)';
    lctx.fillRect(0, 0, 128, 128);
    lctx.fillStyle = '#ffcc33';
    lctx.font = 'bold 110px sans-serif';
    lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
    lctx.fillText(s.id, 64, 72);
    const tex = new THREE.CanvasTexture(letterCanvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.position.set(s.x, 3.5, s.z);
    spr.scale.set(3, 3, 1);
    scene.add(spr);
    siteMeshes[s.id] = { disk, ring, letter: spr };
  }

  rebuildAABBs();
  return { sites: siteMeshes };
}

// ---- collision & raycast ----------------------------------------------------

// Resolve a 2D XZ move, considering only AABBs that are NOT already below the
// player's feet (so we can walk across the top of low boxes without getting
// pushed sideways by them).
export function resolveMovement(prevX, prevZ, newX, newZ, radius = 0.35, feetY = 0) {
  let x = newX, z = newZ;
  for (const a of WORLD_AABBS) {
    // Skip boxes we're standing on/above.
    if (feetY >= a.maxY - 0.05) continue;
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

// Return the height of the highest walkable AABB at (x, z) whose top is at
// or below feetY + tolerance. Always 0 when standing on the world floor.
export function groundHeightAt(x, z, feetY, radius = 0.3) {
  let g = 0;
  for (const a of WORLD_AABBS) {
    if (a.maxY > WALKABLE_TOP) continue;        // ignore full walls
    if (a.maxY > feetY + 0.25) continue;        // surface is above us — can't stand on yet
    if (x < a.minX - radius || x > a.maxX + radius) continue;
    if (z < a.minZ - radius || z > a.maxZ + radius) continue;
    if (a.maxY > g) g = a.maxY;
  }
  return g;
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
