import * as THREE from 'three';
import { resolveMovement } from '../world/map.js';

// First-person controller. Owns: local player transform, camera, input.
export class FPSController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.eye = 1.6;
    this.crouchEye = 1.15;
    this.crouching = false;
    this.onGround = true;

    this.speed = 6;        // run
    this.crouchSpeed = 3.2;
    this.adsSpeed = 4;
    this.speedMul = 1;     // set by ability buffs
    this.canMove = true;
    this.canLook = true;

    this.keys = {};
    this.locked = false;
    this.mouseSens = 0.0022;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Escape') this.releasePointer();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    this.canvas.addEventListener('click', () => this.requestPointer());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.canLook) return;
      this.yaw   -= e.movementX * this.mouseSens;
      this.pitch -= e.movementY * this.mouseSens;
      const lim = Math.PI / 2 - 0.05;
      if (this.pitch >  lim) this.pitch =  lim;
      if (this.pitch < -lim) this.pitch = -lim;
    });
  }

  requestPointer() {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }
  releasePointer() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
  }

  teleport(x, z, yaw = 0) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
  }

  getForwardVec() {
    // full 3D direction considering pitch (for bullet)
    const v = new THREE.Vector3(0, 0, -1);
    v.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return v;
  }
  getMoveForward() {
    // flat forward for movement
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  getMoveRight() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  update(dt) {
    if (this.canMove) {
      const wish = new THREE.Vector3();
      if (this.keys['KeyW']) wish.add(this.getMoveForward());
      if (this.keys['KeyS']) wish.sub(this.getMoveForward());
      if (this.keys['KeyD']) wish.add(this.getMoveRight());
      if (this.keys['KeyA']) wish.sub(this.getMoveRight());
      if (wish.lengthSq() > 0) wish.normalize();

      this.crouching = !!this.keys['ControlLeft'];
      const base = this.crouching ? this.crouchSpeed : this.speed;
      const target = wish.multiplyScalar(base * this.speedMul);

      // horizontal velocity — snappy
      this.vel.x += (target.x - this.vel.x) * Math.min(1, dt * 18);
      this.vel.z += (target.z - this.vel.z) * Math.min(1, dt * 18);

      // jump + gravity
      this.vel.y -= 22 * dt;
      if (this.onGround && this.keys['Space']) {
        this.vel.y = 7.2;
        this.onGround = false;
      }

      const newX = this.pos.x + this.vel.x * dt;
      const newZ = this.pos.z + this.vel.z * dt;
      const r = resolveMovement(this.pos.x, this.pos.z, newX, newZ, 0.35);
      this.pos.x = r.x;
      this.pos.z = r.z;

      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    }

    // update camera
    const eyeH = this.crouching ? this.crouchEye : this.eye;
    this.camera.position.set(this.pos.x, this.pos.y + eyeH, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }
}
