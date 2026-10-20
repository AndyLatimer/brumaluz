import catalog from '../assets/library/catalog.json';
import { loadGLB } from '../world/load';

export { catalog };
export type LibraryAsset = typeof catalog.assets[number];
export function animationLibrariesFor(asset: LibraryAsset) {
  if (asset.kind !== 'characters' || !asset.rig) return [];
  const libraries = catalog.assets.filter(value => value.kind === 'animations' && value.rig === asset.rig);
  const full = libraries.filter(value => value.pack === 'character-animations');
  return full.length ? full : libraries.filter(value => value.pack === asset.pack);
}
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
