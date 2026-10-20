import { buildCity, worldToHex, S, COMBAT_SITE } from '../../world/city';
import { catalog } from '../../art/library';
import { COIN_BAGS } from '../../data/coinBags';
import { WELCOME_START, WELCOME_BADGE, SHADOW_RETURN } from '../../data/quests';
import { brumaluzGateMarkers } from '../../data/pompelin';
import {
  GROUND_MATERIALS, createTerrain, encodeTerrain, newMap,
  type MapDocument, type MapMarker, type MapObject, type Vec3,
} from '../../data/maps';

// Convierte el Pompelín procedural del juego en un mapa editable. El juego no cambia:
// solo se leen los datos de construcción (`city.layout`).

const DETAIL_ASSETS: Record<string, string> = {
  textiles: 'resources/objects/Textiles_Stack_Small',
  iron: 'resources/objects/Iron_Bars',
  logs: 'resources/objects/Wood_Log_Stack',
  planks: 'resources/objects/Wood_Planks_Stack_Small',
  'tavern-table': 'dungeon/objects/table_small_decorated_A',
  barrels: 'dungeon/objects/barrel_small_stack',
  bush: 'forest/objects/Bush_1_A_Color1',
  rock: 'forest/objects/Rock_1_A_Color1',
};
const BUILDING = /^(home|tavern|market|blacksmith|church|castle|well|windmill|watermill|tower|lumbermill|barracks|archeryrange|stage|bridge|grain|wall|fence)/;
const NATURE = /^(tree|trees|hill|hills|mountain|rock|waterlily|waterplant)/;
const r3 = (value: number) => Math.round(value * 1000) / 1000;
const v3 = (x: number, y: number, z: number): Vec3 => [r3(x), r3(y), r3(z)];
const material = (id: string) => GROUND_MATERIALS.findIndex(entry => entry.id === id);

export async function pompelinTemplate(id = 'brumaluz', name = 'Brumaluz'): Promise<MapDocument> {
  const city = await buildCity();
  const layout = city.layout;
  if (!layout) throw new Error('Esta versión de Pompelín no expone su diseño.');
  const map = newMap(id, name);
  map.description = 'Brumaluz, capital de Pompelín. Copia editable de la ciudad del juego con puertas al continente.';

  // Terreno de 240 × 240 m con celdas de 1 m.
  const terrain = createTerrain(240, 240, 1, 0, material('grass'), 0);
  const water = new Set<string>(), tiles = new Set<string>();
  for (const placement of layout.placements) {
    if (!placement.model.startsWith('hex_')) continue;
    const [q, r] = worldToHex(placement.x, placement.z);
    tiles.add(`${q},${r}`);
    if (placement.model === 'hex_water') water.add(`${q},${r}`);
  }
  const isWater = (x: number, z: number) => {
    const [q, r] = worldToHex(x, z);
    return water.has(`${q},${r}`) || !tiles.has(`${q},${r}`);
  };
  const { columns, rows, cell, origin } = terrain;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = origin[0] + i * cell, z = origin[1] + j * cell, index = j * columns + i;
    if (!isWater(x, z)) { terrain.heights[index] = layout.heightAt(x, z); continue; }
    let deep = true;
    for (let k = 0; k < 6 && deep; k++) deep = isWater(x + Math.cos(k * Math.PI / 3) * 1.2, z + Math.sin(k * Math.PI / 3) * 1.2);
    terrain.heights[index] = deep ? -2 : -0.9;
    terrain.paint[index] = material('sand');
  }
  // Densidad de hierba a partir de las matas originales.
  const counts = new Uint16Array(columns * rows);
  for (const tuft of layout.grassTufts) {
    const i = Math.round((tuft.x - origin[0]) / cell), j = Math.round((tuft.z - origin[1]) / cell);
    if (i >= 0 && j >= 0 && i < columns && j < rows) counts[j * columns + i]++;
  }
  for (let index = 0; index < counts.length; index++) terrain.grass[index] = Math.min(255, Math.round(counts[index] / 4 * 255));
  map.terrain = encodeTerrain(terrain);

  // Objetos.
  const objects: MapObject[] = [];
  let next = 0;
  const add = (object: Omit<MapObject, 'id' | 'collision'> & Partial<Pick<MapObject, 'collision'>>) => {
    objects.push({ id: `o${(next++).toString(36)}`, collision: 'auto', ...object });
  };
  // city.ts menciona piezas que city.glb no tiene (el juego las omite); aquí usamos su equivalente real.
  const ALIASES: Record<string, string> = { flag_blue: 'flag' };
  for (const placement of layout.placements) {
    const p = { ...placement, model: ALIASES[placement.model] ?? placement.model };
    const s = p.s ?? 1;
    if (p.model.startsWith('hex_')) {
      add({ asset: `city/${p.model}`, layer: 'suelo', position: v3(p.x, p.y ?? 0, p.z), rotation: [0, r3(p.ry), 0], scale: v3(S * s, S * 0.28 * s, S * s), conform: p.model !== 'hex_water' });
      continue;
    }
    add({
      asset: `city/${p.model}`, layer: BUILDING.test(p.model) ? 'edificios' : NATURE.test(p.model) ? 'naturaleza' : 'atrezo',
      position: v3(p.x, p.y ?? 0, p.z), rotation: [0, r3(p.ry), 0], scale: v3(S * s, S * s, S * s),
    });
  }
  for (const bench of layout.benches) add({ asset: 'builtin/bench', name: 'Banco', layer: 'atrezo', position: v3(bench.x, bench.y, bench.z), rotation: [0, r3(bench.ry), 0], scale: [1, 1, 1] });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6, x = Math.cos(angle) * 6.2, z = Math.sin(angle) * 6.2;
    add({ asset: 'builtin/lamppost', name: `Farol ${i + 1}`, layer: 'atrezo', position: v3(x, layout.heightAt(x, z), z), rotation: [0, 0, 0], scale: [1, 1, 1], collision: 'circle' });
  }
  for (const detail of layout.details) {
    const asset = DETAIL_ASSETS[detail.prop];
    const entry = asset && catalog.assets.find(item => item.id === asset);
    if (!asset || !entry) continue;
    const s = detail.scale, cx = (entry.bounds.min[0] + entry.bounds.max[0]) / 2, cz = (entry.bounds.min[2] + entry.bounds.max[2]) / 2;
    const ox = -cx * s, oz = -cz * s, cos = Math.cos(detail.yaw), sin = Math.sin(detail.yaw);
    add({
      asset, layer: detail.prop === 'bush' || detail.prop === 'rock' ? 'naturaleza' : 'atrezo',
      position: v3(detail.x + ox * cos + oz * sin, detail.y - entry.bounds.min[1] * s, detail.z - ox * sin + oz * cos),
      rotation: [0, r3(detail.yaw), 0], scale: v3(s, s, s),
    });
  }
  map.objects = objects;

  // Marcadores de lógica: aparición, NPCs, comercios, misiones, bolsas y faroles.
  const markers: MapMarker[] = [];
  const marker = (value: Omit<MapMarker, 'layer' | 'rotationY' | 'radius'> & Partial<Pick<MapMarker, 'rotationY' | 'radius'>>) => {
    markers.push({ layer: 'logica', rotationY: 0, radius: 1, ...value, position: v3(...value.position) });
  };
  const ground = (x: number, z: number) => layout.heightAt(x, z);
  marker({ id: 'spawn', type: 'spawn', name: 'Aparición', position: [city.spawn.x, city.spawn.y, city.spawn.z], rotationY: r3(city.spawnYaw) });
  for (const site of city.npcSites) marker({ id: `npc_${site.id}`, type: 'npc', name: site.id, npcId: site.id, position: [site.position.x, site.position.y, site.position.z], rotationY: r3(site.yaw) });
  marker({ id: 'npc_gnomi', type: 'npc', name: 'gnomi', npcId: 'gnomi', position: [WELCOME_START.x, ground(WELCOME_START.x, WELCOME_START.z), WELCOME_START.z], text: 'Inicio de la misión de bienvenida; Gnomi se mueve durante ella.' });
  for (const spot of city.vendorSpots) marker({ id: `vendor_${spot.id}`, type: 'interaction', name: `Comercio: ${spot.id}`, text: spot.role, position: [spot.position.x, spot.position.y, spot.position.z], radius: 2.2, color: '#e0a84a' });
  for (const item of city.interactables) marker({ id: `interact_${item.id}`, type: 'interaction', name: item.label, text: item.id, position: [item.position.x, item.position.y, item.position.z], radius: item.radius, color: '#6fb7e0' });
  const quests: [string, string, { x: number; z: number }, number][] = [
    ['quest_welcome_start', 'Bienvenida: inicio', WELCOME_START, 2],
    ['quest_welcome_badge', 'Bienvenida: insignia', WELCOME_BADGE, 2],
    ['quest_shadow_return', 'Sombra: regreso', SHADOW_RETURN, 2],
    ['quest_combat_site', 'Zona de combate', COMBAT_SITE, 6],
  ];
  for (const [markerId, label, point, radius] of quests) marker({ id: markerId, type: 'zone', name: label, position: [point.x, ground(point.x, point.z), point.z], radius, color: '#c77dd8' });
  for (const bag of COIN_BAGS) marker({ id: `coins_${bag.id}`, type: 'interaction', name: `Bolsa de pelines: ${bag.id}`, text: 'coin-bag', position: [bag.x, ground(bag.x, bag.z), bag.z], rotationY: bag.yaw, radius: 2.2, color: '#f2d36b' });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6, x = Math.cos(angle) * 6.2, z = Math.sin(angle) * 6.2;
    marker({ id: `light_farol_${i + 1}`, type: 'light', name: `Luz del farol ${i + 1}`, position: [x, ground(x, z) + 2.75, z], radius: 7, color: '#ffb24a' });
  }
  map.markers = [...markers, ...brumaluzGateMarkers(ground)];
  map.settings = { kind: 'city', region: 'Pompelín central', loadingTip: 'Brumaluz es la capital de Pompelín.', sky: 'sunset', fog: 0.3, water: { enabled: true, level: -0.85, color: '#4f8fb0', opacity: 0.85 }, clouds: true, bounded: true };
  return map;
}
