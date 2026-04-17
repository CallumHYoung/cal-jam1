import * as THREE from 'three';

// Visual for the spike when dropped on the ground or planted on a site.
// Host-authoritative state lives on state.bomb; this just reflects it.
let bombGroup = null;
let planted = false;
let pulseT = 0;
let light = null;
let core = null;
let beam = null;

function buildBomb() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0x8a5a00, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.35 }),
  );
  body.position.y = 0.28;
  g.add(body);
  core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff4a4a }),
  );
  core.position.y = 0.6;
  g.add(core);

  light = new THREE.PointLight(0xff3030, 1.6, 10, 2);
  light.position.y = 0.7;
  g.add(light);

  beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 6, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  beam.position.y = 3;
  g.add(beam);
  return g;
}

export function updateBombMesh(scene, bomb, dt) {
  const want = bomb && (bomb.dropped || bomb.planted);
  if (want) {
    if (!bombGroup) {
      bombGroup = buildBomb();
      scene.add(bombGroup);
    }
    bombGroup.position.set(bomb.pos[0], 0, bomb.pos[1]);
    planted = !!bomb.planted;
    pulseT += dt;
    const speed = planted ? 6.0 : 2.0;
    const lum = 0.5 + 0.5 * Math.abs(Math.sin(pulseT * speed));
    if (light) light.intensity = planted ? 0.8 + lum * 2.2 : 0.6 + lum * 0.8;
    if (core) core.material.color.setHex(planted ? 0xff1818 : 0xffa040);
    if (beam) {
      beam.material.opacity = planted ? 0.45 + lum * 0.35 : 0.25 + lum * 0.2;
      beam.material.color.setHex(planted ? 0xff2020 : 0xffaa44);
    }
  } else if (bombGroup) {
    scene.remove(bombGroup);
    bombGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
    bombGroup = null;
    light = null; core = null; beam = null;
  }
}
