import * as THREE from 'three';

const smokes = []; // {group, pos, radius, t, life, meshes}

export function spawnSmoke(scene, pos, radius = 4.5, duration = 10) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.position.y = Math.max(pos.y, radius * 0.7);

  const meshes = [];
  // layered spheres for a "fluffy" cloud
  const shades = [
    { r: radius,        color: 0xc4c0d0, opacity: 0.85, offX: 0, offY: 0, offZ: 0 },
    { r: radius * 0.85, color: 0xd8d4e4, opacity: 0.9,  offX: radius * 0.25, offY: -radius * 0.15, offZ: radius * 0.2 },
    { r: radius * 0.72, color: 0xe8e4f0, opacity: 0.9,  offX: -radius * 0.22, offY: radius * 0.1, offZ: -radius * 0.15 },
  ];
  for (const s of shades) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(s.r, 22, 16),
      new THREE.MeshStandardMaterial({
        color: s.color,
        transparent: true,
        opacity: 0,
        roughness: 1,
        depthWrite: false,
      })
    );
    mesh.position.set(s.offX, s.offY, s.offZ);
    mesh._baseOpacity = s.opacity;
    group.add(mesh);
    meshes.push(mesh);
  }

  // ground ring flash on deploy (fades)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.6, radius, 32),
    new THREE.MeshBasicMaterial({ color: 0x4ff0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -group.position.y + 0.05;
  group.add(ring);
  ring._isRing = true;

  scene.add(group);
  smokes.push({ group, pos: pos.clone(), radius, t: 0, life: duration, meshes, ring });
}

export function updateSmokes(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.t += dt;

    const fadeIn = Math.min(1, s.t / 0.6);
    const fadeOut = Math.min(1, (s.life - s.t) / 2);
    const alpha = Math.min(fadeIn, fadeOut);

    for (const m of s.meshes) {
      m.material.opacity = alpha * (m._baseOpacity ?? 0.85);
    }
    // fade out deploy ring over first 0.8s
    if (s.ring) {
      s.ring.material.opacity = Math.max(0, 0.8 - s.t * 1.0);
    }
    // slow rotation for life
    s.group.rotation.y += dt * 0.15;

    if (s.t >= s.life) {
      s.group.parent?.remove(s.group);
      for (const m of s.meshes) { m.geometry.dispose(); m.material.dispose(); }
      if (s.ring) { s.ring.geometry.dispose(); s.ring.material.dispose(); }
      smokes.splice(i, 1);
    }
  }
}

// A line from a→b is "blocked by smoke" if the segment passes through any smoke sphere.
// Used for bullet/vision occlusion. Returns distance at which the ray enters a smoke, or Infinity.
export function raycastSmoke(origin, dir, maxDist = 300) {
  let best = maxDist;
  for (const s of smokes) {
    // don't block in the first 0.6s (deployment) and last 0.5s (dissipating)
    if (s.t < 0.6 || s.t > s.life - 0.5) continue;
    const t = raySphere(origin, dir, s.group.position, s.radius, best);
    if (t !== null && t < best) best = t;
  }
  return best;
}

function raySphere(o, d, c, r, maxT) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cVal = ox*ox + oy*oy + oz*oz - r*r;
  const disc = b*b - cVal;
  if (disc < 0) return null;
  const sd = Math.sqrt(disc);
  const t1 = -b - sd;
  const t2 = -b + sd;
  if (t2 < 0) return null;
  const t = t1 > 0 ? t1 : 0;
  return t <= maxT ? t : null;
}

export function clearAllSmokes() {
  for (const s of smokes) {
    s.group.parent?.remove(s.group);
    for (const m of s.meshes) { m.geometry.dispose(); m.material.dispose(); }
    if (s.ring) { s.ring.geometry.dispose(); s.ring.material.dispose(); }
  }
  smokes.length = 0;
}
