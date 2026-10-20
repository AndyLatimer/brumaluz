import catalog from '../assets/library/catalog.json';
import { loadGLB } from '../world/load';

export { catalog };
export type LibraryAsset = typeof catalog.assets[number];
const urls = import.meta.glob<string>('../assets/library/**/*.glb', { query: '?url', import: 'default' });

/** Loads only the requested resource, with its original materials, rig and clips. */
export async function loadLibraryAsset(id: string) {
  const asset = catalog.assets.find(entry => entry.id === id);
  if (!asset) throw new Error(`Recurso desconocido: ${id}`);
  const resolve = urls[`../assets/library/${asset.path}`];
  if (!resolve) throw new Error(`Falta el GLB: ${asset.path}`);
  const url = await resolve();
  return { asset, url, gltf: await loadGLB(url) };
}
