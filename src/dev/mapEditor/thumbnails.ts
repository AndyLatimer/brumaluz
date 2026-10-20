import * as THREE from 'three';
import { loadMapAssetTemplate } from '../../world/mapAssets';
import { getThumb, putThumb } from './store';

// Miniaturas del catálogo: un renderer pequeño aparte, una cola perezosa y caché en IndexedDB.

const SIZE = 128;
const VERSION = 'v1';
let renderer: THREE.WebGLRenderer | undefined;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
scene.add(new THREE.HemisphereLight('#dfe8ff', '#5a4a3a', 1.6));
const sun = new THREE.DirectionalLight('#fff1d8', 2.4);
sun.position.set(-3, 5, 4);
scene.add(sun);

const urls = new Map<string, Promise<string>>();
const queue: { id: string; resolve: (url: string) => void; reject: (error: unknown) => void }[] = [];
let running = false;

async function render(id: string) {
  renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const model = (await loadMapAssetTemplate(id)).clone(true);
  model.traverse(part => { if (part instanceof THREE.Mesh) part.frustumCulled = false; });
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.01);
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
  const flat = size.y < Math.max(size.x, size.z) * 0.25;
  camera.position.copy(center).add(new THREE.Vector3(0.85, flat ? 1.6 : 0.7, 1).normalize().multiplyScalar(distance));
  camera.near = distance / 100; camera.far = distance * 4; camera.updateProjectionMatrix();
  camera.lookAt(center);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  scene.remove(model);
  const blob = await new Promise<Blob | null>(resolve => renderer!.domElement.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('No se pudo generar la miniatura.');
  return blob;
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      const blob = await render(job.id);
      void putThumb(`${VERSION}|${job.id}`, blob);
      job.resolve(URL.createObjectURL(blob));
    } catch (error) { job.reject(error); }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  running = false;
}

export function thumbnail(id: string) {
  let url = urls.get(id);
  if (!url) {
    url = getThumb(`${VERSION}|${id}`).then(blob => blob
      ? URL.createObjectURL(blob)
      : new Promise<string>((resolve, reject) => { queue.push({ id, resolve, reject }); void pump(); }));
    url.catch(() => urls.delete(id));
    urls.set(id, url);
  }
  return url;
}

/** Carga miniaturas solo cuando la tarjeta entra en pantalla. */
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const image = entry.target as HTMLImageElement;
    observer.unobserve(image);
    const id = image.dataset.asset!;
    thumbnail(id).then(url => { image.src = url; }).catch(() => { image.alt = '?'; image.classList.add('broken'); });
  }
}, { rootMargin: '200px' });

export function lazyThumb(image: HTMLImageElement, id: string) {
  image.dataset.asset = id;
  observer.observe(image);
}
