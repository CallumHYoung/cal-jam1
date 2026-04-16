import * as THREE from 'three';
import { raycastWorld } from '../world/map.js';

// Visual tracers + hit decals. Hit detection happens in game/host logic; this module
// only draws the results and the locally-fired tracer for immediate feedback.

const tracers = []; // {mesh, t, life}
const decals = [];  // {mesh, t, life}

export function fireTracer(scene, origin, end, color = 0xfff2a0) {
  const dir = new THREE.Vector3().subVectors(end, origin);
  const len = dir.length();
  if (len < 0.01) return;
  const geo = new THREE.CylinderGeometry(0.015, 0.015, len, 6);
  geo.translate(0, len / 2, 0);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  mesh.lookAt(end);
  scene.add(mesh);
  tracers.push({ mesh, t: 0, life: 0.09 });
}

export function spawnImpactDecal(scene, point, normal, color = 0xc64bff) {
  const geo = new THREE.CircleGeometry(0.14, 10);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(point);
  if (normal) {
    const look = new THREE.Vector3().copy(point).add(normal);
    mesh.lookAt(look);
  }
  scene.add(mesh);
  decals.push({ mesh, t: 0, life: 5 });
}

export function updateBulletsVfx(dt, scene) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t += dt;
    const k = 1 - tr.t / tr.life;
    tr.mesh.material.opacity = Math.max(0, k * 0.85);
    if (tr.t >= tr.life) {
      scene.remove(tr.mesh);
      tr.mesh.geometry.dispose();
      tr.mesh.material.dispose();
      tracers.splice(i, 1);
    }
  }
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    d.t += dt;
    const k = 1 - d.t / d.life;
    d.mesh.material.opacity = Math.max(0, k * 0.8);
    if (d.t >= d.life) {
      scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
      decals.splice(i, 1);
    }
  }
}

// Hit test: ray vs list of hitboxes (each has minX,maxX,minZ,maxZ,minY,maxY,kind + ownerId).
// Returns nearest hit or null. Walls are tested via raycastWorld first so bullets can't go through them.
export function raycastHit(origin, dir, hitboxes, maxDist = 200) {
  const wallT = raycastWorld(origin, dir, maxDist);
  let best = null;
  for (const hb of hitboxes) {
    const t = rayAABB(origin, dir, hb, Math.min(wallT, maxDist));
    if (t !== null && (!best || t < best.t)) {
      best = { t, kind: hb.kind, ownerId: hb.ownerId };
    }
  }
  return best
    ? { ...best, point: new THREE.Vector3().copy(origin).add(new THREE.Vector3().copy(dir).multiplyScalar(best.t)) }
    : { wallT };
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
