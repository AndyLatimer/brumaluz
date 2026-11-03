import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Catálogo de consumo: el inventario KayKit permanece separado del arte original de Brumaluz. */
export async function readLibraryCatalog(directory) {
  const [imported, hamlet, arboleda, worldProps, home, lagto] = await Promise.all([
    readFile(join(directory, 'catalog.json'), 'utf8').then(JSON.parse),
    readFile(join(directory, 'brumaluz-hamlet', 'catalog.json'), 'utf8').then(JSON.parse),
    readFile(join(directory, 'brumaluz-arboleda', 'catalog.json'), 'utf8').then(JSON.parse),
    readFile(join(directory, 'pompelin-world-props', 'catalog.json'), 'utf8').then(JSON.parse),
    readFile(join(directory, 'brumaluz-home', 'catalog.json'), 'utf8').then(JSON.parse),
    readFile(join(directory, 'brumaluz-lagto', 'catalog.json'), 'utf8').then(JSON.parse),
  ]);
  const catalog = {
    version: imported.version,
    packs: [...imported.packs, ...hamlet.packs, ...arboleda.packs, ...worldProps.packs, ...home.packs, ...lagto.packs],
    assets: [...imported.assets, ...hamlet.assets, ...arboleda.assets, ...worldProps.assets, ...home.assets, ...lagto.assets],
  };
  for (const key of ['packs', 'assets']) {
    const ids = catalog[key].map(entry => entry.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate library ${key} IDs`);
  }
  return catalog;
}
