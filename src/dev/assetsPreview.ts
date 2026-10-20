import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { catalog, loadLibraryAsset, animationLibrariesFor } from '../art/library';
import { attachAnimationHelpers } from '../art/animationBindings';
import './wardrobePreview.css';

if (!import.meta.env.DEV) throw new Error('La biblioteca solo está disponible en desarrollo.');
function element<T extends HTMLElement>(selector: string) {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Falta el control ${selector}`);
  return value;
}
const canvas = element<HTMLCanvasElement>('canvas');
const pack = element<HTMLSelectElement>('#pack');
const kind = element<HTMLSelectElement>('#kind');
const search = element<HTMLInputElement>('#search');
const select = element<HTMLSelectElement>('#asset');
const animation = element<HTMLSelectElement>('#animation');
const playing = element<HTMLInputElement>('#playing');
const status = element<HTMLParagraphElement>('#status');
const download = element<HTMLAnchorElement>('#download');
const previous = element<HTMLButtonElement>('#previous');
const next = element<HTMLButtonElement>('#next');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9dfdc');
scene.add(new THREE.HemisphereLight('#fff5e5', '#8e9caa', 2.4));
const key = new THREE.DirectionalLight('#fff0d5', 3);
key.position.set(-3, 6, 4);
scene.add(key);
const camera = new THREE.PerspectiveCamera(35, 1, .01, 1000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const grid = new THREE.GridHelper(20, 20, '#91a398', '#b7c3b9');
scene.add(grid);
let current: THREE.Group | null = null;
let mixer: THREE.AnimationMixer | null = null;
let clips: THREE.AnimationClip[] = [];
let request = 0;
let closed = false;
const clock = new THREE.Clock();

function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  for (const value of geometries) value.dispose();
  for (const value of materials) value.dispose();
  for (const value of textures) value.dispose();
}
function clear() {
  if (!current) return;
  mixer?.stopAllAction();
  mixer?.uncacheRoot(current);
  scene.remove(current);
  dispose(current);
  current = null;
  mixer = null;
}
function play() {
  mixer?.stopAllAction();
  if (current) current.traverse(object => {
    if (object instanceof THREE.SkinnedMesh) object.pose();
  });
  const clip = animation.value === '' ? undefined : clips[Number(animation.value)];
  if (clip && mixer) mixer.clipAction(clip).reset().play();
}
async function rebuild() {
  const version = ++request;
  clear();
  clips = [];
  animation.replaceChildren(new Option('Pose original', ''));
  download.hidden = true;
  element('#details').textContent = '';
  if (!select.value) { status.textContent = 'No hay recursos con estos filtros.'; return; }
  status.textContent = 'Cargando recurso…';
  let pending: THREE.Group | null = null;
  try {
    const { asset, url, gltf } = await loadLibraryAsset(select.value);
    pending = gltf.scene;
    if (closed || version !== request) { dispose(pending); return; }
    const available = [...gltf.animations];
    if (asset.kind === 'characters') {
      for (const library of animationLibrariesFor(asset)) {
        const loaded = await loadLibraryAsset(library.id);
        try {
          attachAnimationHelpers(pending, loaded.gltf.scene, loaded.gltf.animations);
          available.push(...loaded.gltf.animations);
        } finally { dispose(loaded.gltf.scene); }
      }
    }
    if (closed || version !== request) { dispose(pending); return; }
    current = pending;
    pending = null;
    scene.add(current);
    mixer = new THREE.AnimationMixer(current);
    clips = available;
    clips.forEach((clip, index) => animation.add(new Option(clip.name, String(index))));
    const bounds = new THREE.Box3().setFromObject(current);
    if (bounds.isEmpty()) throw new Error('El recurso no contiene geometría visible.');
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, .05);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.2;
    camera.near = Math.max(radius / 1000, .001);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    camera.position.copy(center).add(new THREE.Vector3(.8, .55, 1).normalize().multiplyScalar(distance));
    controls.target.copy(center);
    controls.maxDistance = distance * 10;
    controls.update();
    grid.position.y = bounds.min.y - .005;
    grid.scale.setScalar(Math.max(1, Math.ceil(Math.max(size.x, size.z) / 10)));
    download.href = url;
    download.download = `${asset.name}.glb`;
    download.hidden = false;
    status.textContent = `Listo. ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m.`;
    const author = catalog.packs.find(pack => pack.id === asset.pack)!.author;
    element('#details').textContent = `${asset.name} · ${author} · ${asset.meshes} mallas · ${asset.skins} rigs${asset.rig ? ` (${asset.rig})` : ''} · ${clips.length} animaciones · ${(asset.bytes / 1024).toFixed(1)} KB. Origen: ${asset.source}`;
  } catch (error) {
    if (pending) dispose(pending);
    if (!closed && version === request) {
      clear();
      status.textContent = `No se pudo cargar: ${error instanceof Error ? error.message : String(error)}`;
    }
    console.error('Biblioteca KayKit:', error);
  }
}
function filter() {
  const selected = select.value;
  const query = search.value.trim().toLowerCase();
  const matches = catalog.assets.filter(asset =>
    (!pack.value || asset.pack === pack.value) && (!kind.value || asset.kind === kind.value)
    && asset.name.toLowerCase().includes(query));
  select.replaceChildren(...matches.map(asset => new Option(`${asset.pack} / ${asset.name}`, asset.id)));
  if (matches.some(asset => asset.id === selected)) select.value = selected;
  element('#count').textContent = `${matches.length} de ${catalog.assets.length} recursos`;
  select.disabled = previous.disabled = next.disabled = matches.length === 0;
  void rebuild();
}
for (const value of catalog.packs) pack.add(new Option(value.label, value.id));
element('#summary').textContent = `${catalog.assets.length} recursos de ${catalog.packs.length} paquetes`;
pack.addEventListener('change', filter);
kind.addEventListener('change', filter);
search.addEventListener('input', filter);
select.addEventListener('change', () => void rebuild());
for (const [button, direction] of [[previous, -1], [next, 1]] as const) {
  button.addEventListener('click', () => {
    select.selectedIndex = (select.selectedIndex + direction + select.length) % select.length;
    void rebuild();
  });
}
animation.addEventListener('change', play);
function resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
filter();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  if (playing.checked) mixer?.update(Math.min(delta, .1));
  controls.update();
  renderer.render(scene, camera);
});
window.addEventListener('pagehide', () => {
  closed = true;
  request++;
  renderer.setAnimationLoop(null);
  clear();
  controls.dispose();
  grid.geometry.dispose();
  for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose();
  renderer.dispose();
  window.removeEventListener('resize', resize);
});
