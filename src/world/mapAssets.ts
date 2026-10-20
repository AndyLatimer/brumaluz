import * as THREE from 'three';
import { catalog, loadLibraryAsset } from '../art/library';
import { BUILTIN_BOUNDS, boxOf, createMapAssetProvider, loadCityModels } from './mapAssetsCore';
import type { Vec3 } from '../data/maps';

// Recursos disponibles para los mapas: piezas de Pompelín (city.glb), toda la
// biblioteca KayKit importada y unas pocas piezas procedurales del juego.

export interface MapAssetInfo {
  id: string;
  name: string;
  group: string;
  groupLabel: string;
  category: string;
  bounds: { min: Vec3; max: Vec3 };
  /** Casilla de suelo encajable: se deforma con el terreno y su cara superior queda a ras. */
  tile: boolean;
  hex: boolean;
}

const CITY_CATEGORIES: [RegExp, string][] = [
  [/^hex_/, 'Casillas hexagonales'],
  [/^(home|tavern|market|blacksmith|church|castle|well|windmill|watermill|tower|lumbermill|barracks|archeryrange|stage|bridge|grain)/, 'Edificios'],
  [/^(wall|fence)/, 'Murallas y vallas'],
  [/^(tree|trees|hill|hills|mountain|rock|waterlily|waterplant)/, 'Naturaleza'],
  [/^cloud/, 'Cielo'],
];
const vec = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

let index: Promise<MapAssetInfo[]> | undefined;
/** Índice completo de recursos colocables (carga solo city.glb para medir sus piezas). */
export function loadMapAssetIndex() {
  index ??= (async () => {
    const models = await loadCityModels();
    const result: MapAssetInfo[] = [];
    for (const [name, model] of models) {
      const box = boxOf(model);
      if (box.isEmpty()) continue;
      result.push({
        id: `city/${name}`, name, group: 'city', groupLabel: 'Pompelín (Medieval Hexagon)',
        category: CITY_CATEGORIES.find(([pattern]) => pattern.test(name))?.[1] ?? 'Atrezo',
        bounds: { min: vec(box.min), max: vec(box.max) }, tile: name.startsWith('hex_'), hex: name.startsWith('hex_'),
      });
    }
    for (const [name, value] of Object.entries(BUILTIN_BOUNDS)) {
      result.push({ id: `builtin/${name}`, name: value.label, group: 'builtin', groupLabel: 'Piezas del juego', category: 'Mobiliario urbano', bounds: { min: value.min, max: value.max }, tile: false, hex: false });
    }
    const packs = new Map(catalog.packs.map(pack => [pack.id, pack.label]));
    for (const asset of catalog.assets) {
      if (asset.kind !== 'objects') continue;
      const hex = /^hex_/.test(asset.name) || asset.pack === 'kenney-hexagon' && Math.abs(asset.bounds.max[2] - asset.bounds.min[2] - 1.155) < 0.02;
      const tile = asset.pack === 'medieval-builder' && /^(hex|square)_/.test(asset.name);
      result.push({
        id: asset.id, name: asset.name, group: asset.pack, groupLabel: packs.get(asset.pack) ?? asset.pack,
        category: tile || hex ? 'Casillas' : guessCategory(asset.name),
        bounds: { min: asset.bounds.min as Vec3, max: asset.bounds.max as Vec3 }, tile, hex,
      });
    }
    return result;
  })().catch(error => { index = undefined; throw error; });
  return index;
}

function guessCategory(name: string) {
  const n = name.toLowerCase();
  if (/tree|bush|grass|flower|rock|plant|mushroom|log|stump|leaf|hill|mountain|cliff/.test(n)) return 'Naturaleza';
  if (/wall|floor|door|window|stair|roof|pillar|column|arch|fence|gate|tower|house|building|bridge|mill|castle|tile/.test(n)) return 'Construcción';
  if (/chair|table|bed|shelf|cabinet|couch|sofa|lamp|rug|bench|stool|desk|drawer|bookcase|armchair|fireplace/.test(n)) return 'Mobiliario';
  if (/sword|axe|bow|shield|staff|dagger|hammer|spear|arrow|weapon|wand|crossbow/.test(n)) return 'Armas y herramientas';
  if (/barrel|crate|box|chest|sack|bag|bucket|basket|pot|bottle|jar|mug|plate|bowl|food|bread|cheese|apple|fish|meat/.test(n)) return 'Contenedores y comida';
  if (/coin|gold|gem|key|book|scroll|potion|candle|torch|lantern|banner|flag/.test(n)) return 'Objetos';
  return 'Varios';
}

/** Escala inicial para que cada pack encaje con la rejilla hexagonal de Pompelín (casilla de 8 m). */
export function defaultScale(info: MapAssetInfo): Vec3 {
  if (info.group === 'city') return info.tile ? [4, 1.12, 4] : [4, 4, 4];
  if (info.group === 'builtin') return [1, 1, 1];
  if (info.group === 'medieval-builder') return info.tile ? [4, 1.12, 4] : [4, 4, 4];
  if (info.group === 'kenney-hexagon') return [8, 8, 8];
  return [0.65, 0.65, 0.65];
}

const provider = createMapAssetProvider(async id => (await loadLibraryAsset(id)).gltf.scene);
/** Plantilla compartida de un recurso; usa `instantiateMapAsset` para obtener copias. */
export const loadMapAssetTemplate = provider.template;
export const instantiateMapAsset = provider.instantiate;
/** Caja de colisión local (sin aspas de molino ni rueda de agua). */
export const collisionBox = provider.collisionBox;
