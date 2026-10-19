import * as THREE from 'three';
import { Character, loadKits } from '../character/character';
import { defaultChar } from '../data/data';
import { loadProp, type PropId } from '../world/props';
import './wardrobePreview.css';

if (!import.meta.env.DEV) throw new Error('El taller solo está disponible en desarrollo.');
const canvas = document.querySelector('canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const prop = document.querySelector<HTMLSelectElement>('#prop')!;
const showMannequin = document.querySelector<HTMLInputElement>('#mannequin')!;
const turn = document.querySelector<HTMLInputElement>('#turn')!;
const elevation = document.querySelector<HTMLInputElement>('#elevation')!;
const zoom = document.querySelector<HTMLInputElement>('#zoom')!;
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
key.shadow.normalBias = .01;
scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#c3cdc6', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.y = -.008;
scene.add(floor);
const holder = new THREE.Group();
scene.add(holder);
let character: Character | null = null;
let bounds = new THREE.Box3();
function updateCamera() {
  const angle = Number(elevation.value) * Math.PI / 180;
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const fit = THREE.MathUtils.lerp(showMannequin.checked ? 8 : 5, 2.2, Number(zoom.value) / 100) * Math.max(size.x, size.y, size.z);
  camera.position.set(center.x, center.y + Math.sin(angle) * fit, center.z + Math.cos(angle) * fit);
  camera.lookAt(center);
}
async function rebuild() {
  holder.clear();
  holder.add(await loadProp(prop.value as PropId));
  holder.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
  bounds = new THREE.Box3().setFromObject(holder);
  const size = bounds.getSize(new THREE.Vector3());
  status.textContent = `Listo. ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m.`;
  updateCamera();
}
function resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
try {
  await loadKits();
  character = new Character(defaultChar(), { outfit: true });
  character.root.position.set(-.7, 0, -.3);
  scene.add(character.root);
  await rebuild(); resize();
  prop.addEventListener('change', () => void rebuild());
  showMannequin.addEventListener('change', () => { character!.root.visible = showMannequin.checked; updateCamera(); });
  turn.addEventListener('input', () => { holder.rotation.y = Number(turn.value) * Math.PI / 180; });
  holder.rotation.y = Number(turn.value) * Math.PI / 180;
  elevation.addEventListener('input', updateCamera);
  zoom.addEventListener('input', updateCamera);
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(time => {
    character!.update(time / 1000);
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
