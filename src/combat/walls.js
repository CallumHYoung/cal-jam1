import * as THREE from 'three';
import { addDynamicAABB, removeDynamicAABB } from '../world/map.js';

// Temporary solid walls deployed by Sentinel's Barrier Wall ability.
// Each wall has a mesh + AABB that participates in collision and raycasts
// until its timer expires.

const walls = []; // {mesh, aabbId, t, life, baseOpacity}

export function spawnBarrierWall(scene, { cx, cz, axis = 'x', width = 6, height = 2.6, duration = 20, color = 0x9cffb4 }) {
  const w = axis === 'x' ? width : 0.55;
  const d = axis === 'x' ? 0.55 : width;

  const geo = new THREE.BoxGeometry(w, height, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.4),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0,
    roughness: 0.35,
    metalness: 0.15,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, height / 2, cz);
  scene.add(mesh);

  // edge-glow: thin bright strips on the top and bottom edges
  const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
  const topEdge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), edgeMat);
  topEdge.position.set(cx, height - 0.02, cz);
  scene.add(topEdge);
  const botEdge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), edgeMat);
  botEdge.position.set(cx, 0.04, cz);
  scene.add(botEdge);

  const aabb = {
    minX: cx - w / 2, maxX: cx + w / 2,
    minZ: cz - d / 2, maxZ: cz + d / 2,
    minY: 0, maxY: height,
  };
  const aabbId = addDynamicAABB(aabb);

  walls.push({
    mesh, edges: [topEdge, botEdge],
    aabbId, t: 0, life: duration,
    baseOpacity: 0.55, edgeOpacity: 0.9,
  });
}

export function updateBarrierWalls(dt, scene) {
  for (let i = walls.length - 1; i >= 0; i--) {
    const w = walls[i];
    w.t += dt;
    const fadeIn = Math.min(1, w.t / 0.4);
    const fadeOut = Math.min(1, (w.life - w.t) / 1.5);
    const alpha = Math.min(fadeIn, fadeOut);
    w.mesh.material.opacity = alpha * w.baseOpacity;
    for (const e of w.edges) e.material.opacity = alpha * w.edgeOpacity;

    if (w.t >= w.life) {
      scene.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
      for (const e of w.edges) {
        scene.remove(e);
        e.geometry.dispose();
        e.material.dispose();
      }
      removeDynamicAABB(w.aabbId);
      walls.splice(i, 1);
    }
  }
}

export function clearAllBarrierWalls(scene) {
  for (const w of walls) {
    scene.remove(w.mesh);
    w.mesh.geometry.dispose();
    w.mesh.material.dispose();
    for (const e of w.edges) {
      scene.remove(e);
      e.geometry.dispose();
      e.material.dispose();
    }
    removeDynamicAABB(w.aabbId);
  }
  walls.length = 0;
}
