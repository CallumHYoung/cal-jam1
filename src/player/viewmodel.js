import * as THREE from 'three';

// The held weapon + hand, attached to the camera.
export class Viewmodel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.group.position.set(0.28, -0.28, -0.55);

    this.handMat = new THREE.MeshStandardMaterial({ color: 0xefc7a0, roughness: 0.9 });
    this.gunMat = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.5, metalness: 0.6 });
    this.barrelMat = new THREE.MeshStandardMaterial({ color: 0x0d0b12, roughness: 0.4, metalness: 0.8 });
    this.accentMat = new THREE.MeshStandardMaterial({ color: 0xc64bff, emissive: 0x4a1d66, emissiveIntensity: 0.6, roughness: 0.5 });

    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0 })
    );
    this.group.add(this.muzzle);
    this.muzzle.position.set(0, 0.02, -0.85);

    this.gunGroup = new THREE.Group();
    this.group.add(this.gunGroup);
    this._buildGun('classic');

    this.recoilKick = 0;
    this.swayT = 0;
  }

  _clearGun() {
    while (this.gunGroup.children.length) {
      const c = this.gunGroup.children[0];
      this.gunGroup.remove(c);
      c.geometry?.dispose?.();
    }
  }

  _buildGun(weaponId) {
    this._clearGun();
    // basic profiles, good-enough silhouettes
    const profiles = {
      classic:  { body:[0.10, 0.12, 0.42], barrel:[0.04, 0.04, 0.28], barrelZ:-0.35, grip:[0.08, 0.18, 0.08], gripZ:0.08 },
      sheriff:  { body:[0.11, 0.14, 0.50], barrel:[0.045, 0.045, 0.32], barrelZ:-0.41, grip:[0.09, 0.2, 0.08], gripZ:0.1 },
      spectre:  { body:[0.12, 0.14, 0.62], barrel:[0.04, 0.04, 0.36], barrelZ:-0.49, grip:[0.09, 0.2, 0.1], gripZ:0.1 },
      vandal:   { body:[0.12, 0.14, 0.80], barrel:[0.045, 0.045, 0.45], barrelZ:-0.62, grip:[0.1, 0.22, 0.12], gripZ:0.14 },
      operator: { body:[0.14, 0.16, 0.95], barrel:[0.05, 0.05, 0.6], barrelZ:-0.75, grip:[0.1, 0.22, 0.14], gripZ:0.16 },
    };
    const p = profiles[weaponId] || profiles.classic;

    const body = new THREE.Mesh(new THREE.BoxGeometry(...p.body), this.gunMat);
    this.gunGroup.add(body);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(p.barrel[0], p.barrel[1], p.barrel[2], 12),
      this.barrelMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = p.barrelZ;
    this.gunGroup.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(...p.grip), this.gunMat);
    grip.position.set(0, -0.12, p.gripZ);
    grip.rotation.x = 0.18;
    this.gunGroup.add(grip);

    // accent
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(p.body[0] * 0.9, 0.02, p.body[2] * 0.7),
      this.accentMat
    );
    accent.position.y = p.body[1] / 2 + 0.012;
    this.gunGroup.add(accent);

    // hand
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), this.handMat);
    hand.position.set(0.02, -0.12, p.gripZ + 0.02);
    this.gunGroup.add(hand);

    this.muzzle.position.set(0, 0.02, p.barrelZ - p.barrel[2] / 2);
  }

  setWeapon(weaponId) {
    this._buildGun(weaponId || 'classic');
  }

  fireKick(amount = 1) {
    this.recoilKick += 0.08 * amount;
  }

  flashMuzzle() {
    this.muzzle.material.opacity = 1.0;
    setTimeout(() => { if (this.muzzle) this.muzzle.material.opacity = 0; }, 35);
  }

  update(dt, moving, crouching) {
    this.swayT += dt * (moving ? 9 : 3);
    const sway = Math.sin(this.swayT) * (moving ? 0.012 : 0.004);
    const bob = Math.abs(Math.sin(this.swayT * 0.5)) * (moving ? 0.01 : 0.003);
    this.group.position.set(
      0.28 + sway,
      (crouching ? -0.18 : -0.28) + bob,
      -0.55
    );
    // decay recoil
    this.recoilKick *= Math.max(0, 1 - dt * 9);
    this.gunGroup.position.z = this.recoilKick * 0.08;
    this.gunGroup.rotation.x = -this.recoilKick * 0.6;
  }
}
