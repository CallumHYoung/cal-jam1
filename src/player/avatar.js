import * as THREE from 'three';

// A simple humanoid avatar used for OTHER players (third-person).
// Hitboxes are exposed for raycast damage detection.
// head ~1.55-1.8y, body ~0.8-1.55y, legs ~0-0.8y
export function makeAvatar({ teamColor = '#6a8bff', accentColor = '#c64bff' } = {}) {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8c098, roughness: 0.9 });
  const clothMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.7 });
  const pantMat = new THREE.MeshStandardMaterial({ color: 0x1c1a22, roughness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColor),
    emissive: new THREE.Color(accentColor).multiplyScalar(0.35),
    emissiveIntensity: 0.5,
    roughness: 0.6,
  });

  // legs
  const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.3);
  const legL = new THREE.Mesh(legGeo, pantMat); legL.position.set(-0.15, 0.4, 0); group.add(legL);
  const legR = new THREE.Mesh(legGeo, pantMat); legR.position.set( 0.15, 0.4, 0); group.add(legR);

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.42), clothMat);
  torso.position.y = 1.17;
  group.add(torso);

  // accent band (armband / chest stripe for team readability)
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.44), accentMat);
  band.position.y = 1.0;
  group.add(band);

  // shoulders / arms
  const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.22);
  const armL = new THREE.Mesh(armGeo, clothMat); armL.position.set(-0.43, 1.2, 0); group.add(armL);
  const armR = new THREE.Mesh(armGeo, clothMat); armR.position.set( 0.43, 1.2, 0); group.add(armR);

  // head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
  head.position.y = 1.73;
  group.add(head);

  // helmet accent (visor strip)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.1), accentMat);
  visor.position.set(0, 1.78, 0.2);
  group.add(visor);

  // simple gun silhouette in hands
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1a1320, metalness: 0.6, roughness: 0.5 })
  );
  gun.position.set(0.3, 1.1, -0.4);
  group.add(gun);

  // glow ring (brightens during ability) — small disc under feet
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.55, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(accentColor), transparent: true, opacity: 0 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  group.add(glow);

  // nameplate (sprite-style DOM label positioned by caller)
  const nameplate = document.createElement('div');
  nameplate.className = 'nameplate';
  nameplate.textContent = '';
  document.body.appendChild(nameplate);

  // Hitboxes (AABBs relative to group.position)
  // body yaw-aligned; we treat as axis-aligned for simplicity — shooters only hit from ~horizontal anyway.
  function getHitboxes(pos) {
    return [
      { kind: 'head', minY: 1.54, maxY: 1.92, rx: 0.22, rz: 0.22 },
      { kind: 'body', minY: 0.78, maxY: 1.54, rx: 0.40, rz: 0.28 },
      { kind: 'legs', minY: 0.00, maxY: 0.78, rx: 0.32, rz: 0.22 },
    ].map(h => ({
      kind: h.kind,
      minX: pos.x - h.rx, maxX: pos.x + h.rx,
      minZ: pos.z - h.rz, maxZ: pos.z + h.rz,
      minY: h.minY, maxY: h.maxY,
    }));
  }

  function setAbilityGlow(on) {
    glow.material.opacity = on ? 0.9 : 0;
    band.material.emissiveIntensity = on ? 1.5 : 0.5;
    visor.material.emissiveIntensity = on ? 1.5 : 0.5;
  }

  function setDead(on) {
    // Fully hide dead players — they're in fly-cam spectator mode from their
    // own view and shouldn't be visible in the world.
    for (const child of group.children) child.visible = !on;
    group.rotation.x = 0;
    group.position.y = 0;
    nameplate.style.display = on ? 'none' : '';
  }

  function setSpectator(on) {
    for (const child of group.children) {
      if (!child.material) continue;
      child.material.transparent = true;
      child.material.opacity = on ? 0.3 : 1;
    }
    nameplate.style.opacity = on ? '0.5' : '1';
    nameplate.style.fontStyle = on ? 'italic' : 'normal';
  }

  function setName(name, teamIsEnemy) {
    nameplate.textContent = name || '';
    nameplate.classList.toggle('enemy', !!teamIsEnemy);
  }

  function dispose() {
    nameplate.remove();
  }

  return { group, getHitboxes, setAbilityGlow, setDead, setSpectator, setName, nameplate, dispose };
}

// Project a world-space point to a screen CSS position; place nameplate.
export function placeNameplate(avatar, camera, renderer) {
  const v = new THREE.Vector3(avatar.group.position.x, avatar.group.position.y + 2.1, avatar.group.position.z);
  v.project(camera);
  const onScreen = v.z < 1 && v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1;
  if (!onScreen) {
    avatar.nameplate.style.display = 'none';
    return;
  }
  avatar.nameplate.style.display = 'block';
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  avatar.nameplate.style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
  avatar.nameplate.style.top  = ((1 - (v.y * 0.5 + 0.5)) * h) + 'px';
}
