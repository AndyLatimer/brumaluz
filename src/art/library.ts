import importedCatalog from '../assets/library/catalog.json';
import hamletCatalog from '../assets/library/brumaluz-hamlet/catalog.json';
import { loadGLB } from '../world/load';
import { mapVariantUrl } from './mapVariants';

export type LibraryAsset = typeof importedCatalog.assets[number] & { label?: string; category?: string };
// La biblioteca importada conserva su inventario y licencia; el arte original tiene su propio catálogo.
export const catalog = {
  version: importedCatalog.version,
  packs: [...importedCatalog.packs, ...hamletCatalog.packs],
  assets: [...importedCatalog.assets, ...hamletCatalog.assets] as LibraryAsset[],
};
export function animationLibrariesFor(asset: LibraryAsset) {
  if (asset.kind !== 'characters' || !asset.rig) return [];
  const libraries = catalog.assets.filter(value => value.kind === 'animations' && value.rig === asset.rig);
  const full = libraries.filter(value => value.pack === 'character-animations');
  return full.length ? full : libraries.filter(value => value.pack === asset.pack);
}
const urls = import.meta.glob<string>('../assets/library/**/*.glb', { query: '?url', import: 'default' });

/** Carga el recurso solicitado; los puentes usan el acabado del juego, con los mismos IDs. */
export async function loadLibraryAsset(id: string) {
  const asset = catalog.assets.find(entry => entry.id === id);
  if (!asset) throw new Error(`Recurso desconocido: ${id}`);
  const resolve = urls[`../assets/library/${asset.path}`];
  if (!resolve) throw new Error(`Falta el GLB: ${asset.path}`);
  const url = mapVariantUrl(id) ?? await resolve();
  return { asset, url, gltf: await loadGLB(url) };
}
