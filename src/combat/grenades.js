import * as THREE from 'three';
import { resolveMovement } from '../world/map.js';
import { GRENADES } from './weapons.js';
import { playExplosion } from '../world/audio.js';

const grenades = []; // {mesh, pos, vel, fuse, type, ownerId, t}
const explosions = []; // {mesh, t, life}

export function throwGrenade(scene, type, origin, dir, ownerId, powerMul = 1) {
  const g = GRENADES[type];
  if (!g) return null;
  const geo = new THREE.SphereGeometry(0.12, 12, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: type === 'frag' ? 0x1e4a1e : 0x556b80,
    roughness: 0.6, metalness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const pos = new THREE.Vector3().copy(origin);
  mesh.position.copy(pos);
  scene.add(mesh);

  const speed = 16 * powerMul;
  const vel = new THREE.Vector3().copy(dir).multiplyScalar(speed).add(new THREE.Vector3(0, 3.5, 0));

  const gr = { mesh, pos, vel, fuse: g.fuse, type, ownerId, t: 0, radius: g.radius, dmg: g.dmg };
  grenades.push(gr);
  return gr;
}

// Host callback shape: onDetonate({ pos, radius, dmg, ownerId, type }) — returns nothing.
// Client version of this same update just runs VFX; pass no handler on clients.
export function updateGrenades(dt, scene, onDetonate) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.t += dt;

    // gravity + simple floor/wall collision
    g.vel.y -= 20 * dt;
    const nx = g.pos.x + g.vel.x * dt;
    const nz = g.pos.z + g.vel.z * dt;
    const r = resolveMovement(g.pos.x, g.pos.z, nx, nz, 0.12);
    // bounce dampen on wall collision
    if (Math.abs(r.x - nx) > 0.001) g.vel.x *= -0.35;
    if (Math.abs(r.z - nz) > 0.001) g.vel.z *= -0.35;
    g.pos.x = r.x;
    g.pos.z = r.z;
    g.pos.y += g.vel.y * dt;
    if (g.pos.y < 0.12) {
      g.pos.y = 0.12;
      if (g.vel.y < -1) g.vel.y = -g.vel.y * 0.35;
      else g.vel.y = 0;
      g.vel.x *= 0.7;
      g.vel.z *= 0.7;
    }
    g.mesh.position.copy(g.pos);

    if (g.t >= g.fuse) {
      // detonate
      spawnExplosionVfx(scene, g.pos, g.radius);
      playExplosion();
      if (onDetonate) onDetonate({ pos: g.pos.clone(), radius: g.radius, dmg: g.dmg, ownerId: g.ownerId, type: g.type });
      scene.remove(g.mesh);
      g.mesh.geometry.dispose();
      g.mesh.material.dispose();
      grenades.splice(i, 1);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.t += dt;
    const k = e.t / e.life;
    e.mesh.scale.setScalar(1 + k * 2.5);
    e.mesh.material.opacity = Math.max(0, 0.6 * (1 - k));
    if (e.t >= e.life) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      explosions.splice(i, 1);
    }
  }
}

function spawnExplosionVfx(scene, pos, radius) {
  const geo = new THREE.SphereGeometry(radius * 0.4, 16, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  explosions.push({ mesh, t: 0, life: 0.6 });
}
