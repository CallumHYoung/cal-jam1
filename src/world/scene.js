import * as THREE from 'three';

export function createScene() {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x05050a);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05050a, 30, 80);

  const camera = new THREE.PerspectiveCamera(
    78,
    window.innerWidth / window.innerHeight,
    0.05,
    500
  );
  camera.position.set(0, 1.6, 0);

  const hemi = new THREE.HemisphereLight(0xbfa8ff, 0x2a1438, 0.55);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffeedd, 0.7);
  dir.position.set(10, 20, 6);
  scene.add(dir);
  const rim = new THREE.DirectionalLight(0x6afcff, 0.25);
  rim.position.set(-8, 10, -8);
  scene.add(rim);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  return { renderer, scene, camera };
}

export function triggerFlash(color = '#ffd36a', ms = 260) {
  const el = document.getElementById('flash');
  if (!el) return;
  el.style.background = color;
  el.style.opacity = '0.55';
  setTimeout(() => { el.style.opacity = '0'; }, ms);
}

export function triggerDamageVignette() {
  const el = document.getElementById('damageVignette');
  if (!el) return;
  el.style.opacity = '0.8';
  setTimeout(() => { el.style.opacity = '0'; }, 220);
}
