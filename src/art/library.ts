import importedCatalog from '../assets/library/catalog.json';
import hamletCatalog from '../assets/library/brumaluz-hamlet/catalog.json';
import arboledaCatalog from '../assets/library/brumaluz-arboleda/catalog.json';
import worldPropsCatalog from '../assets/library/pompelin-world-props/catalog.json';
import homeCatalog from '../assets/library/brumaluz-home/catalog.json';
import lagtoCatalog from '../assets/library/brumaluz-lagto/catalog.json';
import { loadGLB } from '../world/load';
import { mapVariantUrl } from './mapVariants';

export type LibraryAsset = typeof importedCatalog.assets[number] & { label?: string; category?: string };
// La biblioteca importada conserva su inventario y licencia; el arte original tiene su propio catálogo.
export const catalog = {
  version: importedCatalog.version,
  packs: [...importedCatalog.packs, ...hamletCatalog.packs, ...arboledaCatalog.packs, ...worldPropsCatalog.packs, ...homeCatalog.packs, ...lagtoCatalog.packs],
  assets: [...importedCatalog.assets, ...hamletCatalog.assets, ...arboledaCatalog.assets, ...worldPropsCatalog.assets, ...homeCatalog.assets, ...lagtoCatalog.assets] as LibraryAsset[],
};

const assetById = new Map<string, LibraryAsset>(catalog.assets.map(entry => [entry.id, entry]));
const animationsByRig = new Map<string, LibraryAsset[]>();
for (const entry of catalog.assets) {
  if (entry.kind !== 'animations' || !entry.rig) continue;
  const list = animationsByRig.get(entry.rig);
  if (list) list.push(entry);
  else animationsByRig.set(entry.rig, [entry]);
}

export function animationLibrariesFor(asset: LibraryAsset) {
  if (asset.kind !== 'characters' || !asset.rig) return [];
  const libraries = animationsByRig.get(asset.rig) ?? [];
  const full = libraries.filter(value => value.pack === 'character-animations');
  return full.length ? full : libraries.filter(value => value.pack === asset.pack);
}
const urls = import.meta.glob<string>('../assets/library/**/*.glb', { query: '?url', import: 'default' });
const resolvedUrls = new Map<string, string>();

/** Carga el recurso solicitado; los puentes usan el acabado del juego, con los mismos IDs. */
export async function loadLibraryAsset(id: string) {
  const asset = assetById.get(id);
  if (!asset) throw new Error(`Recurso desconocido: ${id}`);
  const key = `../assets/library/${asset.path}`;
  const resolve = urls[key];
  if (!resolve) throw new Error(`Falta el GLB: ${asset.path}`);
  let url = mapVariantUrl(id) ?? resolvedUrls.get(key);
  if (!url) {
    url = import.meta.env.DEV ? new URL(key, import.meta.url).href : await resolve();
    resolvedUrls.set(key, url);
  }
  return { asset, url, gltf: await loadGLB(url) };
}
