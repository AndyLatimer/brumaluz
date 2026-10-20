import * as THREE from 'three';
import { Character, loadKits } from '../character/character';
import { defaultChar, type CharData } from '../data/data';
import './wardrobePreview.css';

if (!import.meta.env.DEV) throw new Error('El taller solo está disponible en desarrollo.');
const canvas = document.querySelector('canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const mannequin = document.querySelector<HTMLSelectElement>('#mannequin')!;
const wardrobe = document.querySelector<HTMLSelectElement>('#wardrobe')!;
const animation = document.querySelector<HTMLSelectElement>('#animation')!;
const turn = document.querySelector<HTMLInputElement>('#turn')!;
const elevation = document.querySelector<HTMLInputElement>('#elevation')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9dfdc');
const camera = new THREE.PerspectiveCamera(30, 1, .01, 50);
scene.add(new THREE.HemisphereLight('#fff5e5', '#8e9caa', 2.4));
const key = new THREE.DirectionalLight('#fff0d5', 3);
key.position.set(-3, 6, 4); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#c3cdc6', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.y = -.008;
scene.add(floor);
const holder = new THREE.Group();
scene.add(holder);
let character: Character;
let previewHeight = .78;
function updateCamera() {
  const angle = Number(elevation.value) * Math.PI / 180;
  const target = previewHeight * .55, distance = previewHeight * 3;
  camera.position.set(0, target + Math.sin(angle)*distance, Math.cos(angle)*distance);
  camera.lookAt(0, target, 0);
  floor.visible = angle >= 0;
}
function rebuild() {
  character?.dispose();
  const isGnomi = mannequin.value === 'gnomi';
  const races: Record<string, CharData['race']> = { human: 'humano', elf: 'elfo', pelso: 'pelso', lagto: 'lagto' };
  character = new Character({
    ...defaultChar(), race: races[mannequin.value] ?? 'humano',
    ...(isGnomi ? { face: 0, hair: 0, hairColor: 6, beard: 1, eyeShape: 4, eyeColor: 2, nose: 5, detail: 1, height: .25, build: .7 } : {}),
  }, {
    outfit: false,
    wardrobe: wardrobe.value === 'helpers' ? 'helpers' : undefined,
    proportions: isGnomi ? { width: 1.06, height: .92 } : undefined,
  });
  holder.scale.setScalar(isGnomi ? .48 : 1);
  holder.add(character.root);
  previewHeight = isGnomi ? .78 : 1.9;
  updateCamera();
  gait();
  status.textContent = 'Listo. Revisa frente, espalda y deformaciones en movimiento.';
}
function gait() {
  const value = animation.value;
  if (value !== 'idle' && value !== 'walk' && value !== 'run') throw new Error('Animación no válida.');
  character.setGait(value);
}
function resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
try {
  await loadKits();
  rebuild(); resize();
  mannequin.addEventListener('change', rebuild);
  wardrobe.addEventListener('change', rebuild);
  animation.addEventListener('change', gait);
  turn.addEventListener('input', () => { holder.rotation.y = Number(turn.value) * Math.PI / 180; });
  elevation.addEventListener('input', updateCamera);
  document.querySelector('#wave')!.addEventListener('click', () => character.wave());
  document.querySelector('#interact')!.addEventListener('click', () => character.hop());
  document.querySelector('#pickup')!.addEventListener('click', () => character.pickUp());
  document.querySelector('#consume')!.addEventListener('click', () => character.useItem());
  document.querySelector('#hit')!.addEventListener('click', () => character.hit());
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(time => {
    character.update(time / 1000);
    renderer.render(scene, camera);
  });
} catch (error) {
  status.textContent = `No se pudo abrir el taller: ${error instanceof Error ? error.message : String(error)}`;
  throw error;
}
window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  character?.dispose();
  floor.geometry.dispose();
  floor.material.dispose();
  renderer.dispose();
});
