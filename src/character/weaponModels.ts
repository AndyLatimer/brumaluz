import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../world/load';
const files = import.meta.glob<string>(['../assets/models/items/tier[0-5]/*.glb', '../assets/models/items/unique/**/*.glb', '../assets/models/items/collections/**/*.glb'], { eager: true, query: '?url', import: 'default' });

const urls = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').at(-1)!.replace(/\.glb$/, ''), url]));
const models = new Map<string, GLTF>();
export async function loadWeaponModels() {
  await Promise.all(Object.entries(urls).map(async ([id, url]) => models.set(id, await loadGLB(url))));
}
export const weaponModel = (id: string) => models.get(id)?.scene;
