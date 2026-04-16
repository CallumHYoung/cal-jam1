import * as THREE from 'three';

// First-person weapon viewmodel. Each weapon id has its own builder
// producing a distinct silhouette.
export class Viewmodel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.group.position.set(0.28, -0.28, -0.55);

    this.gunGroup = new THREE.Group();
    this.group.add(this.gunGroup);

    this.handMat    = new THREE.MeshStandardMaterial({ color: 0xefc7a0, roughness: 0.9 });
    this.frameMat   = new THREE.MeshStandardMaterial({ color: 0x24202c, roughness: 0.5, metalness: 0.65 });
    this.steelMat   = new THREE.MeshStandardMaterial({ color: 0x1a1820, roughness: 0.35, metalness: 0.9 });
    this.brightMat  = new THREE.MeshStandardMaterial({ color: 0xc9c6d3, roughness: 0.3, metalness: 0.95 });
    this.woodMat    = new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 0.85, metalness: 0.05 });
    this.polyMat    = new THREE.MeshStandardMaterial({ color: 0x1d1a24, roughness: 0.9, metalness: 0.1 });
    this.glassMat   = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.05, metalness: 1.0, emissive: 0x051020, emissiveIntensity: 0.3 });
    this.accentMat  = new THREE.MeshStandardMaterial({ color: 0xc64bff, emissive: 0x4a1d66, emissiveIntensity: 0.6, roughness: 0.5 });

    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0 })
    );
    this.group.add(this.muzzle);

    this.recoilKick = 0;
    this.swayT = 0;
    this.setWeapon('classic');
  }

  _clearGun() {
    while (this.gunGroup.children.length) {
      const c = this.gunGroup.children[0];
      this.gunGroup.remove(c);
      c.geometry?.dispose?.();
    }
  }

  /** Add a mesh to the gun group with position + optional rotation. */
  _add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    this.gunGroup.add(m);
    return m;
  }

  setWeapon(weaponId) {
    this._clearGun();
    this._muzzleZ = -0.5; // default, overwritten per weapon
    const builder = {
      classic: this._buildClassic,
      sheriff: this._buildSheriff,
      spectre: this._buildSpectre,
      vandal:  this._buildVandal,
      operator: this._buildOperator,
    }[weaponId] || this._buildClassic;
    builder.call(this);
    this.muzzle.position.set(0, 0.02, this._muzzleZ);
    this._currentWeapon = weaponId;
  }

  // ------------------------- weapons ------------------------------
  _buildClassic() {
    // compact pistol
    this._add(new THREE.BoxGeometry(0.08, 0.11, 0.38), this.frameMat, 0, 0, 0);
    this._add(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 12), this.steelMat,
              0, 0.01, -0.30, Math.PI / 2, 0, 0);
    this._add(new THREE.BoxGeometry(0.07, 0.16, 0.08), this.polyMat, 0, -0.13, 0.09, 0.22, 0, 0);
    this._add(new THREE.BoxGeometry(0.07, 0.02, 0.20), this.accentMat, 0, 0.067, -0.05);
    // hand
    this._add(new THREE.BoxGeometry(0.10, 0.12, 0.12), this.handMat, 0.01, -0.14, 0.10);
    // iron sight
    this._add(new THREE.BoxGeometry(0.018, 0.02, 0.018), this.steelMat, 0, 0.075, -0.18);
    this._add(new THREE.BoxGeometry(0.025, 0.024, 0.018), this.steelMat, 0, 0.077, 0.13);
    this._muzzleZ = -0.42;
  }

  _buildSheriff() {
    // revolver: shorter top, clear cylinder, wood grip
    this._add(new THREE.BoxGeometry(0.10, 0.14, 0.32), this.frameMat, 0, 0, -0.05);
    // cylinder
    this._add(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 14), this.brightMat,
              0, -0.02, 0.02, 0, 0, Math.PI / 2);
    // barrel (thicker, longer)
    this._add(new THREE.CylinderGeometry(0.032, 0.032, 0.38, 14), this.steelMat,
              0, 0.01, -0.36, Math.PI / 2, 0, 0);
    // barrel rib
    this._add(new THREE.BoxGeometry(0.02, 0.025, 0.36), this.brightMat, 0, 0.05, -0.36);
    // wooden grip
    this._add(new THREE.BoxGeometry(0.08, 0.20, 0.09), this.woodMat, 0, -0.15, 0.10, 0.25, 0, 0);
    // hand
    this._add(new THREE.BoxGeometry(0.10, 0.12, 0.12), this.handMat, 0.01, -0.16, 0.11);
    // gold accent
    this._add(new THREE.BoxGeometry(0.015, 0.12, 0.015), this.accentMat, 0.055, -0.12, 0.09);
    this._muzzleZ = -0.55;
  }

  _buildSpectre() {
    // SMG: compact, stubby, forward handguard, folding stock
    this._add(new THREE.BoxGeometry(0.10, 0.13, 0.6), this.frameMat, 0, 0, -0.05);
    // suppressor-style barrel
    this._add(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 14), this.steelMat,
              0, 0.01, -0.48, Math.PI / 2, 0, 0);
    this._add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), this.polyMat,
              0, 0.01, -0.62, Math.PI / 2, 0, 0);
    // angled magazine
    this._add(new THREE.BoxGeometry(0.06, 0.16, 0.1), this.polyMat, 0, -0.13, 0.12);
    // stock
    this._add(new THREE.BoxGeometry(0.045, 0.05, 0.22), this.polyMat, 0, 0.02, 0.28);
    this._add(new THREE.BoxGeometry(0.08, 0.12, 0.04), this.polyMat, 0, 0.04, 0.38);
    // grip
    this._add(new THREE.BoxGeometry(0.07, 0.16, 0.07), this.polyMat, 0, -0.12, 0.08, 0.2, 0, 0);
    // hand
    this._add(new THREE.BoxGeometry(0.10, 0.12, 0.12), this.handMat, 0.01, -0.13, 0.09);
    // accent stripe
    this._add(new THREE.BoxGeometry(0.09, 0.015, 0.5), this.accentMat, 0, 0.065, -0.05);
    this._muzzleZ = -0.70;
  }

  _buildVandal() {
    // assault rifle: long handguard, mag, stock, top sight
    this._add(new THREE.BoxGeometry(0.10, 0.13, 0.85), this.frameMat, 0, 0, -0.02);
    // barrel
    this._add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 14), this.steelMat,
              0, 0.01, -0.58, Math.PI / 2, 0, 0);
    // handguard
    this._add(new THREE.BoxGeometry(0.11, 0.09, 0.32), this.polyMat, 0, 0, -0.36);
    // flash hider
    this._add(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 14), this.polyMat,
              0, 0.01, -0.82, Math.PI / 2, 0, 0);
    // magazine (curved: approximated by rectangle)
    this._add(new THREE.BoxGeometry(0.06, 0.22, 0.12), this.polyMat, 0, -0.16, 0.06, 0.2, 0, 0);
    // stock
    this._add(new THREE.BoxGeometry(0.06, 0.14, 0.26), this.polyMat, 0, 0.005, 0.35);
    this._add(new THREE.BoxGeometry(0.08, 0.15, 0.04), this.polyMat, 0, 0.005, 0.48);
    // grip
    this._add(new THREE.BoxGeometry(0.07, 0.17, 0.08), this.polyMat, 0, -0.12, 0.14, 0.22, 0, 0);
    // hand
    this._add(new THREE.BoxGeometry(0.10, 0.12, 0.12), this.handMat, 0.01, -0.13, 0.15);
    // top rail + sight
    this._add(new THREE.BoxGeometry(0.04, 0.025, 0.65), this.steelMat, 0, 0.075, -0.10);
    this._add(new THREE.BoxGeometry(0.05, 0.05, 0.06), this.accentMat, 0, 0.11, -0.20);
    this._muzzleZ = -0.86;
  }

  _buildOperator() {
    // sniper rifle: long, heavy scope, bipod, angled mag
    this._add(new THREE.BoxGeometry(0.11, 0.14, 1.0), this.frameMat, 0, 0, -0.05);
    // barrel
    this._add(new THREE.CylinderGeometry(0.038, 0.038, 0.62, 14), this.steelMat,
              0, 0.0, -0.72, Math.PI / 2, 0, 0);
    // barrel muzzle brake
    this._add(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 14), this.polyMat,
              0, 0.0, -1.0, Math.PI / 2, 0, 0);
    // scope body (big cylinder on top)
    this._add(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 18), this.steelMat,
              0, 0.14, -0.18, Math.PI / 2, 0, 0);
    // scope bells
    this._add(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 18), this.steelMat,
              0, 0.14, -0.36, Math.PI / 2, 0, 0);
    this._add(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 18), this.steelMat,
              0, 0.14, 0.02, Math.PI / 2, 0, 0);
    // scope lens (dark glass)
    this._add(new THREE.CylinderGeometry(0.072, 0.072, 0.02, 18), this.glassMat,
              0, 0.14, 0.05, Math.PI / 2, 0, 0);
    // scope mounts
    this._add(new THREE.BoxGeometry(0.04, 0.08, 0.04), this.steelMat, 0, 0.09, -0.32);
    this._add(new THREE.BoxGeometry(0.04, 0.08, 0.04), this.steelMat, 0, 0.09, -0.04);
    // magazine
    this._add(new THREE.BoxGeometry(0.07, 0.14, 0.1), this.polyMat, 0, -0.12, 0.04);
    // stock
    this._add(new THREE.BoxGeometry(0.07, 0.16, 0.3), this.polyMat, 0, 0.0, 0.4);
    this._add(new THREE.BoxGeometry(0.09, 0.19, 0.04), this.polyMat, 0, 0.0, 0.55);
    // grip
    this._add(new THREE.BoxGeometry(0.07, 0.18, 0.09), this.polyMat, 0, -0.13, 0.14, 0.22, 0, 0);
    // hand
    this._add(new THREE.BoxGeometry(0.10, 0.12, 0.12), this.handMat, 0.01, -0.14, 0.15);
    // bipod (two angled legs under the front barrel)
    this._add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), this.steelMat,
              -0.05, -0.12, -0.65, 0, 0, -0.35);
    this._add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), this.steelMat,
              0.05, -0.12, -0.65, 0, 0, 0.35);
    // cyan accent on scope
    this._add(new THREE.BoxGeometry(0.15, 0.01, 0.3), this.accentMat, 0, 0.225, -0.18);
    this._muzzleZ = -1.04;
  }

  setScoped(on) {
    // Hide the whole viewmodel when scoped — scope overlay takes over.
    this.group.visible = !on;
  }

  fireKick(amount = 1) { this.recoilKick += 0.08 * amount; }

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
    this.recoilKick *= Math.max(0, 1 - dt * 9);
    this.gunGroup.position.z = this.recoilKick * 0.08;
    this.gunGroup.rotation.x = -this.recoilKick * 0.6;
  }
}
