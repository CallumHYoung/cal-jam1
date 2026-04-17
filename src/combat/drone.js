import * as THREE from 'three';

// Drones currently visible in the scene, keyed by owner player id. Contains
// both the local pilot's drone (same id as net.selfId) and any remote drones
// replicated from ability broadcasts.
const drones = new Map();   // ownerId -> { group, pos, yaw, lastHeard }
const explosions = [];      // {mesh, t, life}
const STALE_TIMEOUT = 1.5;  // seconds without an update before pruning

const DRONE_Y = 0.35;

function buildDroneMesh() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.30, 0.14, 18),
    new THREE.MeshStandardMaterial({ color: 0x2a3f56, roughness: 0.35, metalness: 0.75 }),
  );
  body.position.y = 0.07;
  g.add(body);

  // Blinking red light on top
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4a4a }),
  );
  beacon.position.set(0, 0.22, 0);
  g.add(beacon);

  // Point light so it casts some glow on the floor
  const pt = new THREE.PointLight(0x6afcff, 1.2, 4, 2);
  pt.position.set(0, 0.25, 0);
  g.add(pt);
  g.userData.beacon = beacon;
  g.userData.light = pt;

  // Small fins / legs so it reads as a physical object
  const finGeo = new THREE.BoxGeometry(0.08, 0.04, 0.28);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x4a5d75, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(finGeo, finMat);
    const a = i * Math.PI / 2;
    fin.position.set(Math.cos(a) * 0.25, 0.04, Math.sin(a) * 0.25);
    fin.rotation.y = a;
    g.add(fin);
  }

  // Forward indicator (so you can tell facing)
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.18, 10),
    new THREE.MeshBasicMaterial({ color: 0x6afcff }),
  );
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.12, -0.28);
  g.add(arrow);

  return g;
}

export function spawnDroneVisual(scene, ownerId, pos) {
  if (drones.has(ownerId)) {
    updateDronePose(ownerId, pos, 0);
    return;
  }
  const group = buildDroneMesh();
  group.position.set(pos[0], (pos[1] ?? DRONE_Y), pos[2]);
  scene.add(group);
  drones.set(ownerId, { group, pos: [pos[0], pos[1] ?? DRONE_Y, pos[2]], yaw: 0, lastHeard: 0 });
}

export function updateDronePose(ownerId, pos, yaw) {
  const d = drones.get(ownerId);
  if (!d) return;
  d.pos = [pos[0], pos[1] ?? DRONE_Y, pos[2]];
  d.group.position.set(d.pos[0], d.pos[1], d.pos[2]);
  if (typeof yaw === 'number') {
    d.yaw = yaw;
    d.group.rotation.y = yaw;
  }
  d.lastHeard = 0;
}

export function removeDroneVisual(scene, ownerId) {
  const d = drones.get(ownerId);
  if (!d) return;
  scene.remove(d.group);
  d.group.traverse((o) => {
    o.geometry?.dispose?.();
    o.material?.dispose?.();
  });
  drones.delete(ownerId);
}

export function spawnDroneExplosion(scene, pos, radius = 4.5) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x6afcff, transparent: true, opacity: 0.7 }),
  );
  mesh.position.set(pos[0], (pos[1] ?? DRONE_Y), pos[2]);
  scene.add(mesh);
  explosions.push({ mesh, t: 0, life: 0.55 });

  // Secondary hot core
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
  );
  core.position.copy(mesh.position);
  scene.add(core);
  explosions.push({ mesh: core, t: 0, life: 0.35 });
}

export function updateDronesVfx(dt, scene) {
  // Beacon pulse + prune stale drones whose pose stream died.
  const now = performance.now() * 0.001;
  for (const [id, d] of drones.entries()) {
    d.lastHeard += dt;
    const b = d.group.userData.beacon;
    const l = d.group.userData.light;
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(now * 10));
    if (b) b.material.color.setHSL(0.0, 1.0, 0.35 + pulse * 0.45);
    if (l) l.intensity = 0.4 + pulse * 1.0;
    if (d.lastHeard > STALE_TIMEOUT) removeDroneVisual(scene, id);
  }

  // explosion vfx
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.t += dt;
    const k = e.t / e.life;
    e.mesh.scale.setScalar(1 + k * 2.8);
    e.mesh.material.opacity = Math.max(0, e.mesh.material.opacity * (1 - k * 0.5));
    if (e.t >= e.life) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      explosions.splice(i, 1);
    }
  }
}

export function clearAllDrones(scene) {
  for (const id of [...drones.keys()]) removeDroneVisual(scene, id);
  for (const e of explosions) {
    scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
  }
  explosions.length = 0;
}

export function getDroneY() { return DRONE_Y; }
