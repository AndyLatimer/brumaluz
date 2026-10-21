import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { mapEditorPlugin } from './map-editor-plugin.mjs';

// Brumaluz agrandada sin perder su forma: el casco antiguo sigue en el centro, sin foso ni muralla propia,
// y la ciudad crece a su alrededor hasta una muralla hexagonal con las mismas puertas y salidas al continente.
// Todo el suelo son las casillas hexagonales del juego (la misma rejilla de 8 m que el casco): hierba, calles
// encajadas según sus vecinas (como en `src/world/city.ts`), agua y, fuera, lomas y arboledas. Cada casa ocupa
// su casilla y mira a la calle; las casas gremiales y casas torre están hechas a mano con piezas modulares.
//
//   node tools/build-brumaluz.mjs --out mapa.json   genera sin guardar (para revisarlo)
//   node tools/build-brumaluz.mjs --apply           guarda el borrador del editor y lo publica

export const PREFIX = 'urbe_';
const OLD_PREFIX = 'ensanche_';
const DEG = Math.PI / 180;
const COS30 = Math.cos(30 * DEG);
/** Mitad del lado del terreno (m). */
export const HALF = 196;

// Rejilla hexagonal del juego (src/world/city.ts): casillas de 8 m, bordes a k·60°.
const S = 4, SQ3 = Math.sqrt(3);
export const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
export const hexToWorld = (q, r) => [(2 * q + r) * S, r * SQ3 * S];
export const hexDist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
export function worldToHex(x, z) {
  const r = z / (SQ3 * S), q = (x / S - r) / 2;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - (-q - r));
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}
const cellKey = (q, r) => `${q},${r}`;
/** Gira una casilla 60°·k alrededor del centro. */
const rotate = ([q, r], k) => { for (let i = 0; i < ((k % 6) + 6) % 6; i++) [q, r] = [-r, q + r]; return [q, r]; };
const step = ([q, r], dir, n = 1) => [q + DIRS[dir % 6][0] * n, r + DIRS[dir % 6][1] * n];
// Bordes con calle de cada pieza (bit k = borde a k·60°), igual que en city.ts.
const ROADS = {
  hex_road_A: 'RGGRGG', hex_road_B: 'GGGRGR', hex_road_C: 'GGGRRG', hex_road_D: 'GRGRGR', hex_road_E: 'RGGRGR',
  hex_road_F: 'RRGRGG', hex_road_G: 'GGRRRG', hex_road_H: 'RGRRRG', hex_road_I: 'GRRGRR', hex_road_J: 'RRRRGG',
  hex_road_K: 'GRRRRR', hex_road_L: 'RRRRRR', hex_road_M: 'GGGRGG',
};
const mask = s => s.split('').reduce((m, c, i) => m | (c === 'R' ? 1 << i : 0), 0);
const rotMask = (m, k) => ((m << k) | (m >> (6 - k))) & 63;
/** Bordes con calle (bits k = borde a k·60°) de una casilla colocada: pieza y giro. */
export function tileRoadMask(asset, yaw) {
  const pattern = ROADS[asset.replace(/^city\//, '')];
  if (!pattern) return 0;
  return rotMask(mask(pattern), ((Math.round(-yaw / (Math.PI / 3)) % 6) + 6) % 6);
}
/** Pieza y giro (en pasos de 60°) que conectan exactamente estos bordes. */
function roadFor(m) {
  for (const [name, s] of Object.entries(ROADS)) for (let k = 0; k < 6; k++) if (rotMask(mask(s), k) === m) return [name, k];
  return ['hex_road_L', 0];
}

/** Anillos de casillas (distancia hexagonal al centro). El casco antiguo llega a la 11. */
export const RINGS = { island: 11, inner: 13, middle: 17, ronda: 20, wall: 21.5 };
/** Radio (m) de la muralla hasta sus vértices, donde están las puertas. */
export const WALL_RADIUS = RINGS.wall * 8;
/** Puertas de la muralla, en la prolongación de las del casco antiguo (`null`: cerrada, la del castillo). */
export const GATES = [
  { angle: 0, id: 'este', name: 'Puerta del Este' },
  { angle: 60, id: 'sureste', name: 'Puerta del Sureste' },
  { angle: 120, id: 'suroeste', name: 'Puerta del Suroeste' },
  { angle: 180, id: 'oeste', name: 'Puerta del Oeste' },
  { angle: 240, id: null, name: 'Torre del Noroeste' },
  { angle: 300, id: 'noreste', name: 'Puerta del Noreste' },
];
/** Un barrio por cada sector de 60° entre calles mayores (sector k: de 60k° a 60k+60°). */
export const DISTRICTS = [
  'Barrio de los Telares', 'Huertas del Alba', 'Barrio del Olmo',
  'Barrio de los Canteros', 'Barrio de la Guardia', 'Barrio de los Mercaderes',
];
const PLAZAS = ['Plaza del Levante', 'Plaza de la Fuente', 'Plaza del Olmo', 'Plaza del Poniente', 'Plaza de Armas', 'Plaza de la Lonja'];
/**
 * Manzanas especiales: sector (0–5), mitad (0: la que da a la calle mayor de 60k°, 1: la otra) y banda
 * (1: anillos 14–16, entre el interior y el central; 2: anillos 18–19, entre el central y la ronda).
 */
const SPECIAL = [
  { id: 'telares', sector: 0, half: 0, band: 1, kind: 'hall' },
  { id: 'huertas', sector: 1, half: 0, band: 2, kind: 'farm' },
  { id: 'molino', sector: 1, half: 1, band: 2, kind: 'hill' },
  { id: 'aserradero', sector: 2, half: 1, band: 2, kind: 'yard' },
  { id: 'canteros', sector: 3, half: 0, band: 1, kind: 'hall' },
  { id: 'cantera', sector: 3, half: 1, band: 2, kind: 'hill' },
  { id: 'mirador', sector: 4, half: 0, band: 1, kind: 'hill' },
  { id: 'cuartel', sector: 4, half: 0, band: 2, kind: 'yard' },
  { id: 'lonja', sector: 5, half: 0, band: 1, kind: 'hall' },
  { id: 'archivo', sector: 5, half: 1, band: 1, kind: 'hall' },
];
const HILL_HEIGHT = { molino: 7, cantera: 8, mirador: 7 };
/** Calle secundaria de cada sector: sale del centro del lado del anillo interior hacia la ronda. */
const STREET_Q = 6;

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const rounded = value => Math.round(value * 1000) / 1000;
export const polar = (r, degrees) => [r * Math.cos(degrees * DEG), r * Math.sin(degrees * DEG)];
/** «Radio» hexagonal en metros: igual en todo el contorno de un hexágono con vértices a 0°, 60°… */
export const hexRadius = (x, z) => Math.max(...[30, 90, 150].map(a => Math.abs(x * Math.cos(a * DEG) + z * Math.sin(a * DEG)))) / COS30;
/** Giro que hace que la fachada (+Z local de las piezas KayKit) mire en la dirección (dx, dz). */
const facing = (dx, dz) => Math.atan2(dx, dz);
const dirAngle = dir => 60 * (dir % 6);

/** Sector (0–5) y mitad (0, 1, o -1 en la calle de barrio) de una casilla. */
export function sectorOf(q, r) {
  for (let k = 0; k < 6; k++) {
    const [a, b] = rotate([q, r], -k);
    if (a > 0 && b >= 0) return { sector: k, half: a > STREET_Q ? 0 : a < STREET_Q ? 1 : -1 };
  }
  return { sector: 0, half: -1 };
}
const bandOf = d => d >= 14 && d <= 16 ? 1 : d >= 18 && d <= 19 ? 2 : 0;

/** Casillas de calle de la ciudad nueva, con su importancia: `main`, `ring`, `street` o `plaza`. */
export function streetCells() {
  const cells = new Map();
  const set = (cell, kind) => { const k = cellKey(...cell); if (!cells.has(k) || kind === 'main') cells.set(k, kind); };
  for (let d = RINGS.inner; d <= RINGS.ronda; d++) {
    if (![RINGS.inner, RINGS.middle, RINGS.ronda].includes(d)) continue;
    for (let k = 0; k < 6; k++) for (let j = 0; j < d; j++) set(step(step([0, 0], k, d), k + 2, j), 'ring');
  }
  for (let k = 0; k < 6; k++) {
    const gate = GATES[k];
    for (let n = 10; n <= (gate.id ? 30 : RINGS.ronda); n++) set(step([0, 0], k, n), 'main');
    for (let r = RINGS.inner - STREET_Q; r <= RINGS.ronda - STREET_Q; r++) set(rotate([STREET_Q, r], k), 'street');
    const vertex = step([0, 0], k, RINGS.middle);
    for (const side of [1, 5]) set(step(vertex, k + side), 'plaza');
  }
  return cells;
}

/** Restos del recinto viejo que, al desaparecer foso y muralla, separarían el centro del resto de la ciudad. */
function oldEnclosure(object) {
  if (object.layer === 'edificios' && /^city\/wall_straight(_gate)?$/.test(object.asset)) return true;
  if (object.layer !== 'naturaleza') return false;
  const [x, , z] = object.position, r = Math.hypot(x, z);
  if (/^city\/(hills?_|mountain_)/.test(object.asset) && r > 66) return true;
  // El cinturón de árboles del borde se aclara (queda uno de cada tres) para que el centro se abra a la ciudad.
  if (/^city\/trees?_/.test(object.asset) && r > 68 && [...object.id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) % 3 !== 0) return true;
  return GATES.some(gate => {
    const c = Math.cos(gate.angle * DEG), s = Math.sin(gate.angle * DEG);
    return x * c + z * s > 74 && Math.abs(-x * s + z * c) < 2.5;
  });
}

export function buildBrumaluz(source, maps) {
  assert.equal(source.id, 'brumaluz');
  const map = structuredClone(source);
  const generated = id => id.startsWith(PREFIX) || id.startsWith(OLD_PREFIX);
  map.objects = map.objects.filter(object => !generated(object.id) && object.asset !== 'city/hex_water'
    && !(/^city\/water(lily|plant)/.test(object.asset) && Math.hypot(object.position[0], object.position[2]) > 80)
    && !oldEnclosure(object));
  map.markers = map.markers.filter(marker => !generated(marker.id));
  map.layers = map.layers.filter(layer => !generated(layer.id));
  const keptObjects = map.objects.length;

  // --- Casillas ------------------------------------------------------------------------------
  const islandTiles = new Map();
  for (const object of map.objects) {
    if (!object.asset.startsWith('city/hex_')) continue;
    const cell = worldToHex(object.position[0], object.position[2]);
    islandTiles.set(cellKey(...cell), object);
  }
  assert.ok(islandTiles.size >= 390, 'Casillas del casco antiguo');
  const streets = streetCells();
  // Las calles mayores atraviesan el borde del casco (casillas 10 y 11) para unir sus puertas con la ciudad.
  const retile = new Set([...streets.keys()].filter(k => islandTiles.has(k)));
  const isNewRoad = k => streets.has(k) && (!islandTiles.has(k) || retile.has(k));
  const islandRoadMask = object => tileRoadMask(object.asset, object.rotation[1]);
  /** Dos lagunas donde el río del casco desembocaba en el foso. */
  const water = new Set();
  for (const object of map.objects) {
    if (!/^city\/hex_river/.test(object.asset)) continue;
    const [q, r] = worldToHex(object.position[0], object.position[2]);
    if (hexDist(q, r) !== RINGS.island) continue;
    for (const dir of [0, 3]) {
      const mouth = step([q, r], dir);
      if (islandTiles.has(cellKey(...mouth)) || hexDist(...mouth) !== RINGS.island + 1) continue;
      water.add(cellKey(...mouth));
      for (let d = 0; d < 6; d++) {
        const next = step(mouth, d);
        if (hexDist(...next) === RINGS.island + 1 && !streets.has(cellKey(...next))) water.add(cellKey(...next));
      }
    }
  }
  const cells = [];
  for (let q = -40; q <= 40; q++) for (let r = -40; r <= 40; r++) {
    const [x, z] = hexToWorld(q, r);
    if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
    const k = cellKey(q, r);
    if (islandTiles.has(k) && !retile.has(k)) continue;
    cells.push({ q, r, k, x, z, d: hexDist(q, r), ...sectorOf(q, r) });
  }
  const cellAt = new Map(cells.map(cell => [cell.k, cell]));
  const roadKind = k => isNewRoad(k) ? streets.get(k) : null;

  // --- Terreno -------------------------------------------------------------------------------
  const N = HALF * 2 + 1;
  const index = (x, z) => (z + HALF) * N + x + HALF;
  const old = maps.decodeTerrain(source.terrain);
  const oldIndex = (x, z) => {
    const i = Math.round((x - old.origin[0]) / old.cell), j = Math.round((z - old.origin[1]) / old.cell);
    return i >= 0 && j >= 0 && i < old.columns && j < old.rows ? j * old.columns + i : -1;
  };
  const terrain = maps.createTerrain(HALF * 2, HALF * 2, 1, 0, 0, 0);
  const mat = id => { const i = maps.GROUND_MATERIALS.findIndex(material => material.id === id); assert.ok(i >= 0, id); return i; };
  const keptIsland = (x, z) => { const k = cellKey(...worldToHex(x, z)); return islandTiles.has(k) && !retile.has(k); };
  const specialCells = id => {
    const block = SPECIAL.find(item => item.id === id);
    return cells.filter(cell => cell.sector === block.sector && cell.half === block.half && bandOf(cell.d) === block.band && !roadKind(cell.k));
  };
  const centroid = list => [list.reduce((s, c) => s + c.x, 0) / list.length, list.reduce((s, c) => s + c.z, 0) / list.length];
  const hills = Object.entries(HILL_HEIGHT).map(([id, height]) => {
    const [x, z] = centroid(specialCells(id));
    return { id, x, z, height };
  });
  const base = (x, z) => 0.6 + 1.6 * smooth((hexRadius(x, z) - 92) / 70)
    + 0.6 * Math.sin(x / 37 + 1.3) * Math.cos(z / 43 - 0.7) + 0.4 * Math.sin((x + 2 * z) / 71);
  const relief = (x, z) => {
    const r = hexRadius(x, z);
    let h = base(x, z);
    for (const hill of hills) h += hill.height * Math.exp(-(Math.max(0, Math.hypot(x - hill.x, z - hill.z) - 3) ** 2) / (2 * 5 ** 2));
    // La muralla se asienta en una franja casi llana; fuera, lomas suaves (las casillas se adaptan a ellas).
    const wallBand = 1 - smooth((Math.abs(r - WALL_RADIUS) * COS30 - 5) / 5);
    if (wallBand > 0) { const scale = WALL_RADIUS / r; h += (base(x * scale, z * scale) - h) * wallBand; }
    if (r > WALL_RADIUS + 8) {
      const corridor = Math.max(0, ...GATES.filter(gate => gate.id).map(gate => {
        const c = Math.cos(gate.angle * DEG), s = Math.sin(gate.angle * DEG);
        return x * c + z * s > 0 ? 1 - smooth((Math.abs(-x * s + z * c) - 6) / 8) : 0;
      }));
      const corners = Math.max(...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) =>
        Math.exp(-((x - sx * 200) ** 2 + (z - sz * 200) ** 2) / (2 * 30 ** 2))));
      h += smooth((r - WALL_RADIUS - 8) / 16) * (1 - corridor) * (1.5 + 6 * corners + 0.8 * Math.sin(x / 13) * Math.cos(z / 11));
    }
    return h;
  };
  // Altura del borde del casco más cercano, para fundir el terreno nuevo con él.
  const distance = new Float32Array(N * N).fill(Infinity), edge = new Float32Array(N * N);
  for (let z = -HALF; z <= HALF; z++) for (let x = -HALF; x <= HALF; x++) {
    const i = index(x, z), o = oldIndex(x, z);
    if (keptIsland(x, z) && o >= 0) { distance[i] = 0; edge[i] = old.heights[o]; }
  }
  for (let pass = 0; pass < 2; pass++) {
    const steps = pass ? [[1, 0, 1], [0, 1, 1], [1, 1, 1.414], [-1, 1, 1.414]] : [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]];
    for (let n = 0; n < N * N; n++) {
      const i = pass ? N * N - 1 - n : n, x = i % N, z = (i - x) / N;
      for (const [dx, dz, cost] of steps) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const j = nz * N + nx;
        if (distance[j] + cost < distance[i]) { distance[i] = distance[j] + cost; edge[i] = edge[j]; }
      }
    }
  }
  const roadAt = (x, z) => !!roadKind(cellKey(...worldToHex(x, z)));
  for (let z = -HALF; z <= HALF; z++) for (let x = -HALF; x <= HALF; x++) {
    const i = index(x, z), o = oldIndex(x, z);
    if (distance[i] === 0) { terrain.heights[i] = old.heights[o]; terrain.paint[i] = old.paint[o]; terrain.grass[i] = old.grass[o]; continue; }
    const blend = smooth(distance[i] / 12);
    terrain.heights[i] = edge[i] * (1 - blend) + relief(x, z) * blend;
  }
  // Las calles se explanan (sin baches bajo las casillas de calle).
  for (let pass = 0; pass < 5; pass++) {
    const next = terrain.heights.slice();
    for (let z = -HALF + 2; z <= HALF - 2; z++) for (let x = -HALF + 2; x <= HALF - 2; x++) {
      const i = index(x, z);
      if (distance[i] === 0 || !roadAt(x, z)) continue;
      let sum = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) sum += terrain.heights[index(x + dx, z + dz)];
      next[i] = sum / 25;
    }
    terrain.heights.set(next);
  }
  const height = (x, z) => maps.sampleHeight(terrain, x + HALF, z + HALF);
  const waterLevel = Math.max(...[...water].map(k => height(...hexToWorld(...k.split(',').map(Number)))), 0);

  // Explanadas (se aplican al final, antes de fijar alturas definitivas).
  const pads = [];
  const pad = (x, z, radius, y = height(x, z), falloff = 2.5) => { pads.push({ x, z, radius, y, falloff }); return y; };

  map.layers.push(
    { id: `${PREFIX}suelo`, name: 'Ciudad · casillas', visible: true, locked: false },
    { id: `${PREFIX}muralla`, name: 'Ciudad · muralla y puertas', visible: true, locked: false },
    { id: `${PREFIX}casas`, name: 'Ciudad · viviendas', visible: true, locked: false },
    { id: `${PREFIX}civico`, name: 'Ciudad · edificios compuestos y oficios', visible: true, locked: false },
    { id: `${PREFIX}verde`, name: 'Ciudad · parques, colinas y huertas', visible: true, locked: false },
    { id: `${PREFIX}atrezo`, name: 'Ciudad · atrezo de calles', visible: true, locked: false },
    { id: `${PREFIX}logica`, name: 'Ciudad · barrios y plazas', visible: true, locked: false },
  );
  let serial = 0;
  /** `y` absoluta o `lift` sobre el suelo definitivo (se calcula al final). */
  const add = (asset, x, z, scale = 1, yaw = 0, layer = 'casas', options = {}) => {
    const { y, lift = 0, ...rest } = options;
    const object = {
      id: `${PREFIX}${(serial++).toString(36).padStart(4, '0')}`, asset, layer: `${PREFIX}${layer}`,
      position: [rounded(x), y ?? lift, rounded(z)], rotation: [0, rounded(yaw), 0],
      scale: (Array.isArray(scale) ? scale : [scale, scale, scale]).map(rounded), collision: 'auto', ...rest,
    };
    object.absolute = y !== undefined;
    map.objects.push(object);
    return object;
  };
  const marker = (id, type, name, x, z, extra = {}) => {
    const value = { id: `${PREFIX}${id}`, type, name, layer: `${PREFIX}logica`, position: [rounded(x), 0, rounded(z)], radius: 1, rotationY: 0, ...extra };
    map.markers.push(value);
    return value;
  };
  let seed = 90217;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = list => list[Math.floor(random() * list.length)];
  const towardCenter = (x, z) => facing(-x, -z);
  /** Casillas ya ocupadas por un edificio, una colina, agua… */
  const used = new Set(water);

  // --- Suelo de casillas ----------------------------------------------------------------------
  const tile = (asset, cell, steps = 0) => {
    const yaw = rounded(-(steps * Math.PI) / 3);
    const existing = islandTiles.get(cell.k);
    if (existing) { existing.asset = `city/${asset}`; existing.rotation = [0, yaw, 0]; return; }
    add(`city/${asset}`, cell.x, cell.z, [S, S * 0.28, S], yaw, 'suelo', { conform: true });
  };
  for (const cell of cells) {
    if (water.has(cell.k)) {
      add('city/hex_water', cell.x, cell.z, [S, S * 0.28, S], 0, 'suelo', { y: rounded(waterLevel) });
      continue;
    }
    if (!roadKind(cell.k)) { tile('hex_grass', cell); continue; }
    let m = 0;
    for (let i = 0; i < 6; i++) {
      const [nq, nr] = step([cell.q, cell.r], i), nk = cellKey(nq, nr), neighbor = islandTiles.get(nk);
      if (roadKind(nk) || (neighbor && !retile.has(nk) && islandRoadMask(neighbor) & (1 << ((i + 3) % 6)))) m |= 1 << i;
    }
    const [name, steps] = roadFor(m || 1);
    tile(name, cell, steps);
  }

  // --- Constructor de edificios hechos a mano -------------------------------------------------
  const frame = (cx, cz, yaw, y0, layer, name) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return (asset, lx, lz, ly = 0, localYaw = 0, scale = 1, extra = {}) => add(asset,
      cx + lx * c + lz * s, cz - lx * s + lz * c, scale, yaw + localYaw, layer, { y: rounded(y0 + ly), name, ...extra });
  };
  /**
   * Edificio hecho con piezas de mazmorra (módulos de 4 m): suelo, muros con puerta y ventanas, pilares en las
   * esquinas, cubierta de madera, estandartes y bandera. `open` deja solo pilares (lonja).
   */
  const hall = ({ cx, cz, yaw, cols, rows, floors = 1, s = 1, open = false, name, banner = 'red', roof = 'floor_wood_large_dark', layer = 'civico' }) => {
    const W = cols * 4 * s, D = rows * 4 * s;
    const y0 = pad(cx, cz, Math.hypot(W, D) / 2 + 0.5, height(cx, cz), 3);
    const piece = frame(cx, cz, yaw, y0, layer, name);
    const d = asset => `dungeon/objects/${asset}`;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      piece(d('floor_tile_large'), -W / 2 + (2 + 4 * i) * s, -D / 2 + (2 + 4 * j) * s, 0.02, 0, s, { collision: 'none' });
    }
    const top = (open ? 4.4 : 4 * floors) * s;
    if (open) {
      for (let i = 0; i <= cols; i++) for (const lz of [-D / 2, D / 2]) piece(d('pillar'), -W / 2 + 4 * i * s, lz, 0, 0, [0.5 * s, 1.1 * s, 0.5 * s]);
      for (let j = 1; j < rows; j++) for (const lx of [-W / 2, W / 2]) piece(d('pillar'), lx, -D / 2 + 4 * j * s, 0, 0, [0.5 * s, 1.1 * s, 0.5 * s]);
    } else {
      const middle = Math.floor(cols / 2);
      for (let f = 0; f < floors; f++) {
        const ly = 4 * f * s;
        for (let i = 0; i < cols; i++) {
          const lx = -W / 2 + (2 + 4 * i) * s;
          const front = f === 0 && i === middle ? 'wall_doorway' : f === 0 ? 'wall_window_closed' : 'wall_window_open';
          piece(d(front), lx, D / 2, ly, 0, s);
          if (f === 0 && i === middle) piece(d('wall_doorway_door'), lx, D / 2, ly, 0, s);
          piece(d(i % 2 ? 'wall_window_closed' : 'wall'), lx, -D / 2, ly, Math.PI, s);
        }
        for (let j = 0; j < rows; j++) {
          const lz = -D / 2 + (2 + 4 * j) * s, window = (j + f) % 2 ? 'wall_window_open' : 'wall_window_closed';
          piece(d(window), W / 2, lz, ly, Math.PI / 2, s);
          piece(d(window), -W / 2, lz, ly, -Math.PI / 2, s);
        }
        for (const [lx, lz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) piece(d('pillar'), lx, lz, ly, 0, [0.7 * s, s, 0.7 * s]);
      }
      for (let i = 0; i < cols; i++) if (i !== middle) piece(d(`banner_patternA_${banner}`), -W / 2 + (2 + 4 * i) * s, D / 2, 0.3 * s, 0, s, { collision: 'none' });
    }
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      piece(d(roof), -W / 2 + (2 + 4 * i) * s, -D / 2 + (2 + 4 * j) * s, top, 0, [1.02 * s, s, 1.02 * s], { collision: open ? 'none' : 'auto', walkable: false });
    }
    piece('city/flag_red', 0, 0, top, 0, 6 * s, { collision: 'none' });
    // Las casillas bajo el edificio quedan ocupadas.
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (const cell of cells) {
      const dx = cell.x - cx, dz = cell.z - cz, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      if (Math.abs(lx) < W / 2 + 3 && Math.abs(lz) < D / 2 + 3) used.add(cell.k);
    }
    return { y0, piece, W, D };
  };

  // --- Muralla hexagonal y puertas -------------------------------------------------------------
  const WALL_SCALE = 3, GATE_SCALE = 4;
  const wallY = (x, z) => height(x, z) - 0.25;
  const vertex = k => polar(WALL_RADIUS, 60 * k);
  const openAt = k => !!GATES[k % 6].id;
  for (let k = 0; k < 6; k++) {
    const [ax, az] = vertex(k), [bx, bz] = vertex(k + 1);
    const length = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / length, tz = (bz - az) / length;
    const start = openAt(k) ? GATE_SCALE : 0, end = length - (openAt(k + 1) ? GATE_SCALE : 0);
    const count = Math.ceil((end - start) / (2 * WALL_SCALE)), piece = (end - start) / count;
    const yaw = Math.atan2(-tz, tx); // el eje X local del tramo sigue el lado
    for (let n = 0; n < count; n++) {
      const along = start + (n + 0.5) * piece, x = ax + tx * along, z = az + tz * along;
      add('city/wall_straight', x, z, [piece / 2 + 0.03, WALL_SCALE, WALL_SCALE], yaw, 'muralla', { y: rounded(wallY(x, z)), name: 'Muralla' });
    }
    const [mx, mz] = [(ax + bx) / 2, (az + bz) / 2];
    add('city/tower_B', mx, mz, 3.4, yaw, 'muralla', { y: rounded(wallY(mx, mz)), name: 'Torre de la muralla' });
    for (const [along, k2] of [[6.6, k], [length - 6.6, k + 1]]) {
      if (!openAt(k2)) continue;
      const x = ax + tx * along, z = az + tz * along;
      add('city/tower_A', x, z, 3.4, yaw, 'muralla', { y: rounded(wallY(x, z)), name: `${GATES[k2 % 6].name} · torreón` });
      add('city/flag_red', x, z, 5, yaw, 'muralla', { y: rounded(wallY(x, z) + 2.19 * 3.4), collision: 'none' });
    }
  }
  for (const gate of GATES) {
    const a = gate.angle * DEG, [x, z] = polar(WALL_RADIUS, gate.angle);
    if (gate.id) {
      add('city/wall_straight_gate', x, z, GATE_SCALE, -a - Math.PI / 2, 'muralla', { y: rounded(wallY(x, z)), name: gate.name });
      for (const side of [-1, 1]) add('builtin/lamppost', ...polar(RINGS.ronda * 8 + 4, gate.angle + side * 1.6), 1, 0, 'atrezo', { name: `${gate.name} · farol` });
    } else {
      add('city/tower_B', x, z, 4.6, -a, 'muralla', { y: rounded(wallY(x, z)), name: gate.name });
      add('city/flag_yellow', x, z, 6, -a, 'muralla', { y: rounded(wallY(x, z) + 2.49 * 4.6), collision: 'none' });
    }
  }

  // --- Plazas mayores (en los vértices del anillo central) -------------------------------------
  for (let k = 0; k < 6; k++) {
    const vertexCell = cellAt.get(cellKey(...step([0, 0], k, RINGS.middle)));
    const [monument, stalls] = [1, 5].map(side => cellAt.get(cellKey(...step([vertexCell.q, vertexCell.r], k + side))));
    used.add(monument.k); used.add(stalls.k);
    const y = pad(monument.x, monument.z, 3, height(monument.x, monument.z), 2);
    const outward = facing(...polar(1, 60 * k));
    if (k % 3 === 0) add(k % 2 ? 'city/well' : 'medieval-builder/objects/well', monument.x, monument.z, k % 2 ? 4 : 3, outward, 'atrezo', { y, name: `${PLAZAS[k]} · pozo` });
    else if (k % 3 === 1) {
      add('dungeon/objects/pillar_decorated', monument.x, monument.z, [0.8, 1.1, 0.8], outward, 'atrezo', { y, name: `${PLAZAS[k]} · columna` });
      add('city/flag_yellow', monument.x, monument.z, 6, outward, 'atrezo', { y: rounded(y + 4.4), collision: 'none' });
    } else add('city/stage_A', monument.x, monument.z, 4.4, towardCenter(monument.x, monument.z), 'atrezo', { y, name: `${PLAZAS[k]} · tablado` });
    for (let q = 0; q < 3; q++) {
      const [bx, bz] = polar(3.2, 60 * k + 120 * q + 60);
      add('forest/objects/Bush_4_A_Color1', monument.x + bx, monument.z + bz, 1.8, random() * 6, 'verde');
    }
    const sy = pad(stalls.x, stalls.z, 3, height(stalls.x, stalls.z), 2);
    add(k % 2 ? 'city/market' : 'medieval-builder/objects/market', stalls.x, stalls.z, k % 2 ? 2.6 : 2.4, towardCenter(stalls.x, stalls.z), 'civico', { y: sy, name: `${PLAZAS[k]} · puesto` });
    for (const side of [-1, 1]) {
      const [ox, oz] = polar(3.4, 60 * k + 90 * side);
      add(`restaurant/objects/crate_${pick(['carrots', 'tomatoes', 'potatoes', 'cheese', 'onions'])}`, stalls.x + ox, stalls.z + oz, 0.55, random() * 6, 'atrezo');
    }
    for (const side of [2, 4]) {
      const [lx, lz] = polar(3.6, 60 * k + 60 * side);
      add('builtin/lamppost', vertexCell.x + lx, vertexCell.z + lz, 1, 0, 'atrezo', { name: `${PLAZAS[k]} · farol` });
    }
    marker(`plaza_${k}`, 'zone', PLAZAS[k], vertexCell.x, vertexCell.z, { radius: 10, text: `Plaza mayor del ${DISTRICTS[k].toLowerCase()} y del ${DISTRICTS[(k + 5) % 6].toLowerCase()}.`, color: '#e0a84a' });
  }

  // --- Manzanas especiales -------------------------------------------------------------------
  const normalOf = sector => polar(1, 30 + 60 * sector);
  const halls = [
    { id: 'telares', name: 'Casa de los Telares', cols: 4, rows: 3, floors: 1, banner: 'blue' },
    { id: 'canteros', name: 'Casa de los Canteros', cols: 3, rows: 3, floors: 2, banner: 'white' },
    { id: 'lonja', name: 'Lonja de los Mercaderes', cols: 5, rows: 3, open: true, roof: 'floor_wood_large' },
    { id: 'archivo', name: 'Archivo de la Capital', cols: 4, rows: 3, floors: 2, banner: 'yellow' },
  ];
  for (const spec of halls) {
    const block = SPECIAL.find(item => item.id === spec.id), list = specialCells(spec.id);
    const [nx, nz] = normalOf(block.sector), [mx, mz] = centroid(list);
    // Pegado al anillo interior y mirando a él.
    const perp = mx * nx + mz * nz, target = RINGS.inner * 8 * COS30 + 4 + spec.rows * 2 + 1;
    const cx = mx + nx * (target - perp), cz = mz + nz * (target - perp);
    const built = hall({ ...spec, cx, cz, yaw: facing(-nx, -nz) });
    marker(`edificio_${spec.id}`, 'note', spec.name, cx, cz, { radius: Math.max(built.W, built.D) / 2, text: 'Edificio compuesto con piezas modulares; se puede retocar pieza a pieza en el editor.' });
    const { piece } = built;
    if (spec.id === 'lonja') {
      for (const lx of [-6, 0, 6]) for (const lz of [-3, 3]) piece('dungeon/objects/table_long_tablecloth_decorated_A', lx, lz, 0, Math.PI / 2, 0.8);
      for (const [lx, lz] of [[-9, 0], [9, 0], [-3, 0], [3, 0]]) piece(`restaurant/objects/crate_${pick(['carrots', 'tomatoes', 'potatoes', 'cheese', 'onions'])}`, lx, lz, 0, random() * 6, 0.55);
    } else {
      const props = { telares: ['resources/objects/Textiles_Stack_Large_Colored', 1.3], canteros: ['resources/objects/Stone_Bricks_Stack_Large', 1.4], archivo: ['forest/objects/Bush_2_A_Color1', 2.2] }[spec.id];
      for (const lx of [-built.W / 2 - 1.6, built.W / 2 + 1.6]) piece(props[0], lx, built.D / 2 - 1.5, 0, random() * 0.4, props[1]);
    }
  }
  // Colinas: las casillas de la manzana se levantan con el terreno.
  const hill = id => hills.find(item => item.id === id);
  {
    const { x, z } = hill('molino');
    for (const cell of specialCells('molino')) used.add(cell.k);
    const top = pad(x, z, 4, height(x, z), 2);
    add('city/windmill', x, z, 4.6, towardCenter(x, z), 'civico', { y: top, name: 'Molino de la colina' });
    for (let n = 0; n < 10; n++) {
      if (n === 2) continue;
      const a = n / 10 * Math.PI * 2;
      add('city/fence_wood_straight', x + Math.cos(a) * 5.6, z + Math.sin(a) * 5.6, 3.2, -a, 'verde');
    }
    for (const [dx, dz, asset] of [[2.2, 2.8, 'city/sack'], [2.8, 2.2, 'city/sack'], [-2.8, 2.2, 'city/wheelbarrow']]) add(asset, x + dx, z + dz, 4, random() * 6, 'atrezo');
    marker('colina_molino', 'note', 'Colina del Molino', x, z, { radius: 10, text: 'Mirador sobre las Huertas del Alba.' });
  }
  {
    const { x, z } = hill('cantera');
    for (const cell of specialCells('cantera')) {
      used.add(cell.k);
      if (Math.hypot(cell.x - x, cell.z - z) > 3) add(`forest/objects/Rock_${pick(['1_A', '1_C', '2_A', '3_A', '3_D'])}_Color1`, cell.x + random() * 3 - 1.5, cell.z + random() * 3 - 1.5, 1 + random(), random() * 6, 'verde', { lift: -0.15 });
    }
    const top = pad(x, z, 3.5, height(x, z), 2);
    add('city/resource_stone', x, z, 4.2, 0.4, 'civico', { y: top, name: 'Cantera · bloques' });
    add('resources/objects/Stone_Bricks_Stack_Large', x + 2.8, z - 1.6, 1.5, 0.3, 'civico', { y: top });
    add('rpg-tools/objects/pickaxe', x - 1, z + 2, 1.6, 0.8, 'atrezo', { collision: 'none', lift: 0.1 });
    marker('colina_cantera', 'note', 'Cantera de los Canteros', x, z, { radius: 10, text: 'Colina rocosa de la que sale la piedra de la ciudad.' });
  }
  {
    const { x, z } = hill('mirador');
    const list = specialCells('mirador');
    for (const cell of list) {
      used.add(cell.k);
      if (Math.hypot(cell.x - x, cell.z - z) > 6) add(pick(['city/trees_A_small', 'city/trees_A_medium', 'city/trees_B_medium']), cell.x, cell.z, 4, random() * 6, 'verde');
    }
    const top = pad(x, z, 4, height(x, z), 2);
    add('medieval-builder/objects/watchtower', x, z, 3.6, towardCenter(x, z), 'civico', { y: top, name: 'Torre del Mirador' });
    for (let n = 0; n < 4; n++) {
      const a = n * Math.PI / 2 + Math.PI / 4;
      add('builtin/bench', x + Math.cos(a) * 4.6, z + Math.sin(a) * 4.6, 1, facing(Math.cos(a), Math.sin(a)), 'atrezo', { name: 'Banco del mirador' });
    }
    marker('colina_mirador', 'note', 'Mirador de la Guardia', x, z, { radius: 10, text: 'Atalaya sobre el casco antiguo.' });
  }
  // Huertas del Alba: cada casilla, un bancal.
  for (const cell of specialCells('huertas')) {
    used.add(cell.k);
    add('medieval-builder/objects/farm_plot', cell.x, cell.z, 3.6, 0, 'verde', { collision: 'none', name: 'Huerta del Alba' });
    if (random() < 0.4) add('medieval-builder/objects/farm_wheat', cell.x + 1, cell.z, 2.4, 0, 'verde', { collision: 'none' });
  }
  // Aserradero y cuartel: un edificio de oficio por casilla, con su atrezo.
  const yard = (id, buildings, props) => {
    const list = specialCells(id).sort((a, b) => a.d - b.d || a.q - b.q);
    list.forEach((cell, n) => {
      used.add(cell.k);
      const facingRoad = roadNeighbor(cell);
      if (n < buildings.length && facingRoad !== null) {
        const [asset, scale, name] = buildings[n];
        add(asset, cell.x, cell.z, scale, facing(...polar(1, dirAngle(facingRoad))), 'civico', { y: pad(cell.x, cell.z, 3.6), name });
      } else {
        for (let j = 0; j < 2; j++) {
          const [asset, scale] = pick(props);
          add(asset, cell.x + random() * 4 - 2, cell.z + random() * 4 - 2, scale, random() * 6, 'atrezo');
        }
      }
    });
  };
  const ROAD_RANK = { main: 4, plaza: 3, ring: 3, street: 2 };
  /** Dirección (0–5) de la casilla de calle vecina más importante, o null. */
  function roadNeighbor(cell) {
    let best = null, rank = 0;
    for (let i = 0; i < 6; i++) {
      const kind = roadKind(cellKey(...step([cell.q, cell.r], i)));
      if (kind && ROAD_RANK[kind] > rank) { rank = ROAD_RANK[kind]; best = i; }
    }
    return best;
  }
  yard('aserradero',
    [['medieval-builder/objects/lumbermill', 3.4, 'Aserradero del Olmo'], ['city/lumbermill', 3.6, 'Taller de carpintería']],
    [['resources/objects/Wood_Planks_Stack_Large', 1.4], ['city/resource_lumber', 3.4], ['resources/objects/Wood_Log_A', 2.2]]);
  yard('cuartel',
    [['city/barracks', 3.8, 'Cuartel de la Guardia'], ['city/archeryrange', 3.6, 'Campo de tiro'], ['medieval-builder/objects/barracks', 3.2, 'Cuartel · dormitorios']],
    [['city/target', 4], ['city/weaponrack', 4], ['city/tent', 4], ['city/barrel', 4]]);
  // Lagunas del río: molino de agua y orilla con árboles.
  {
    const lakes = [...water].map(k => cellAt.get(k)).filter(Boolean);
    const west = lakes.filter(cell => cell.x < 0), east = lakes.filter(cell => cell.x > 0);
    for (const [group, name] of [[west, 'Laguna del Olmo'], [east, 'Laguna de los Telares']]) {
      if (!group.length) continue;
      const [lx, lz] = centroid(group);
      for (let n = 0; n < 5; n++) {
        const cell = pick(group);
        add(n % 2 ? 'city/waterlily_A' : 'city/waterplant_A', cell.x + random() * 4 - 2, cell.z + random() * 4 - 2, 4, random() * 6, 'verde', { y: rounded(waterLevel - 0.2) });
      }
      marker(`laguna_${group === west ? 'oeste' : 'este'}`, 'note', name, lx, lz, { radius: 8, text: 'Donde el río del casco antiguo desemboca.' });
    }
    // El molino de agua, en la orilla de la laguna oeste (una casilla de hierba vecina).
    const shore = west.flatMap(cell => DIRS.map((_, i) => cellAt.get(cellKey(...step([cell.q, cell.r], i)))))
      .find(cell => cell && !water.has(cell.k) && !roadKind(cell.k) && !keptIsland(cell.x, cell.z) && cell.d === RINGS.island + 1);
    if (shore) {
      used.add(shore.k);
      const [lx, lz] = centroid(west);
      add('city/watermill', shore.x, shore.z, 3.4, facing(lx - shore.x, lz - shore.z), 'civico', { lift: 0.05, name: 'Molino de la laguna' });
    }
  }

  // --- Viviendas: una por casilla, mirando a su calle -----------------------------------------
  const HOUSES = {
    home_A: { asset: 'city/home_A', scale: 4.4 },
    home_B: { asset: 'city/home_B', scale: 4.2 },
    house: { asset: 'medieval-builder/objects/house', scale: 3.2 },
    tavern: { asset: 'city/tavern', scale: 4 },
    smith: { asset: 'city/blacksmith', scale: 4 },
    shop: { asset: 'city/market', scale: 3.2 },
    tower: { asset: 'stone' },
  };
  const choose = kind => {
    const roll = random();
    if (kind !== 'street' && roll < (kind === 'main' ? 0.1 : 0.05)) return HOUSES.tower;
    if (kind === 'main' && roll < 0.24) return pick([HOUSES.tavern, HOUSES.shop, HOUSES.smith]);
    if (roll < 0.06) return pick([HOUSES.shop, HOUSES.smith]);
    if (roll < 0.42) return HOUSES.home_A;
    if (roll < 0.74) return HOUSES.home_B;
    return HOUSES.house;
  };
  const districtOf = cell => DISTRICTS[cell.sector];
  const houseCount = {};
  const PROPS = [
    ['city/barrel', 4], ['city/crate_A_big', 4], ['city/crate_long_A', 4], ['city/sack', 4], ['city/bucket_water', 4],
    ['dungeon/objects/barrel_small_stack', 0.8], ['city/resource_lumber', 3], ['city/wheelbarrow', 4], ['forest/objects/Bush_2_A_Color1', 2.2],
  ];
  for (const cell of cells) {
    if (used.has(cell.k) || roadKind(cell.k) || water.has(cell.k) || !bandOf(cell.d)) continue;
    const dir = roadNeighbor(cell);
    if (dir === null) continue;
    used.add(cell.k);
    const kind = roadKind(cellKey(...step([cell.q, cell.r], dir))), type = choose(kind);
    const district = districtOf(cell), name = `${district} · casa ${(houseCount[district] = (houseCount[district] ?? 0) + 1)}`;
    const yaw = facing(...polar(1, dirAngle(dir)));
    if (type.asset === 'stone') {
      hall({ cx: cell.x, cz: cell.z, yaw, cols: 2, rows: 2, floors: 2, s: 0.7, name: name.replace('casa', 'casa torre'), banner: pick(['red', 'blue', 'green', 'yellow']), layer: 'casas' });
      continue;
    }
    add(type.asset, cell.x, cell.z, type.scale, yaw, 'casas', { y: pad(cell.x, cell.z, 3.2), name });
    // Un detalle en una esquina trasera de la casilla.
    if (random() < 0.75) {
      const [prop, scale] = pick(PROPS), [ox, oz] = polar(3, dirAngle(dir) + 180 + (random() < 0.5 ? -50 : 50));
      add(prop, cell.x + ox, cell.z + oz, scale, random() * 6, 'atrezo');
    }
  }
  // Casillas interiores de las manzanas: patios, huertos y arboledas.
  for (const cell of cells) {
    if (used.has(cell.k) || roadKind(cell.k) || water.has(cell.k) || !bandOf(cell.d)) continue;
    used.add(cell.k);
    const roll = random();
    if (roll < 0.35) add(pick(['city/trees_A_small', 'city/trees_A_medium', 'city/trees_B_medium']), cell.x, cell.z, 4, random() * 6, 'verde');
    else if (roll < 0.6) {
      add('medieval-builder/objects/farm_plot', cell.x, cell.z, 3, random() * 6, 'verde', { collision: 'none', name: 'Huerto' });
      add(pick(['city/tree_single_A', 'city/tree_single_B']), cell.x + 3, cell.z, 3.6, random() * 6, 'verde');
    } else if (roll < 0.8) {
      add('medieval-builder/objects/well', cell.x, cell.z, 1.8, random() * 6, 'atrezo');
      for (let n = 0; n < 3; n++) {
        const [ox, oz] = polar(3, n * 120 + 30);
        add(pick(['forest/objects/Bush_1_A_Color1', 'mixed-bag/objects/flax_flower_A', 'city/tree_single_A']), cell.x + ox, cell.z + oz, n === 2 ? 3.4 : 2, random() * 6, 'verde', n === 1 ? { collision: 'none' } : {});
      }
    } else add(pick(['city/hills_A_trees', 'city/hills_B_trees']), cell.x, cell.z, 4, random() * 6, 'verde');
  }
  // --- Jardines junto al casco, franja tras la ronda y afueras ---------------------------------
  for (const cell of cells) {
    if (used.has(cell.k) || roadKind(cell.k) || water.has(cell.k)) continue;
    if (cell.d === RINGS.island + 1) {
      const roll = random();
      if (roll < 0.3) add(pick(['city/trees_A_small', 'city/trees_B_medium']), cell.x, cell.z, 4, random() * 6, 'verde');
      else if (roll < 0.45) add('builtin/bench', cell.x, cell.z, 1, towardCenter(cell.x, cell.z), 'atrezo', { name: 'Banco del jardín' });
      else if (roll < 0.6) add('mixed-bag/objects/flax_flower_' + pick(['A', 'B']), cell.x, cell.z, 2.2, random() * 6, 'verde', { collision: 'none' });
    } else if (cell.d === RINGS.ronda + 1) {
      if (random() < 0.3) add(pick(['city/tree_single_A', 'city/tree_single_B']), cell.x, cell.z, 3.8, random() * 6, 'verde');
    } else if (cell.d > RINGS.ronda + 1 && hexRadius(cell.x, cell.z) > WALL_RADIUS + 5) {
      const corridor = GATES.some(gate => gate.id && Math.abs(((Math.atan2(cell.z, cell.x) / DEG - gate.angle + 540) % 360) - 180) < 4);
      if (corridor) continue;
      const roll = random(), far = hexRadius(cell.x, cell.z) > WALL_RADIUS + 40;
      if (roll < (far ? 0.25 : 0.12)) add(pick(['city/hills_A_trees', 'city/hills_B_trees', 'city/hills_C_trees', ...(far ? ['city/mountain_A_grass_trees', 'city/mountain_B_grass_trees'] : [])]), cell.x, cell.z, 4, dirAngle(Math.floor(random() * 6)) * DEG, 'verde');
      else if (roll < 0.45) add(pick(['city/trees_A_large', 'city/trees_B_large', 'city/trees_A_medium', 'city/trees_B_medium']), cell.x, cell.z, 4, dirAngle(Math.floor(random() * 6)) * DEG, 'verde');
      else if (roll < 0.5) add(pick(['city/hill_single_A', 'city/hill_single_B']), cell.x, cell.z, 4, random() * 6, 'verde');
    }
  }
  // Faroles en las calles mayores.
  for (let k = 0; k < 6; k++) for (let n = RINGS.inner + 1; n < RINGS.ronda; n++) {
    if (n === RINGS.middle || n % 2) continue;
    const [x, z] = hexToWorld(...step([0, 0], k, n)), [ox, oz] = polar(3.6, 60 * k + (n % 4 ? 90 : -90));
    add('builtin/lamppost', x + ox, z + oz, 1, 0, 'atrezo', { name: 'Farol de la calle mayor' });
  }

  // --- Terreno definitivo: explanadas, agua y pintura bajo las casillas ------------------------
  for (const item of pads) {
    const reach = item.radius + item.falloff;
    for (let z = Math.floor(item.z - reach); z <= Math.ceil(item.z + reach); z++) for (let x = Math.floor(item.x - reach); x <= Math.ceil(item.x + reach); x++) {
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      const i = index(x, z);
      if (distance[i] === 0) continue;
      const amount = 1 - smooth((Math.hypot(x - item.x, z - item.z) - item.radius) / item.falloff);
      terrain.heights[i] += (item.y - terrain.heights[i]) * amount;
    }
  }
  for (let z = -HALF; z <= HALF; z++) for (let x = -HALF; x <= HALF; x++) {
    const i = index(x, z);
    if (distance[i] === 0) continue;
    const k = cellKey(...worldToHex(x, z));
    if (water.has(k)) terrain.heights[i] = Math.min(terrain.heights[i], waterLevel - 1.4);
    // La pintura apenas asoma bajo las casillas; la hierba suelta sí se ve sobre las de hierba.
    const road = !!roadKind(k);
    terrain.paint[i] = mat(road ? 'cobble' : 'grass');
    terrain.grass[i] = road || water.has(k) || used.has(k) ? 0 : hexRadius(x, z) > WALL_RADIUS + 5 ? 70 : 40;
  }
  map.terrain = maps.encodeTerrain(terrain);
  for (const object of map.objects.slice(keptObjects)) {
    const { absolute } = object;
    delete object.absolute;
    if (!absolute && !object.conform) object.position[1] = rounded(height(object.position[0], object.position[2]) + object.position[1]);
  }

  // --- Lógica: barrios y puertas al continente -----------------------------------------------
  for (let k = 0; k < 6; k++) {
    const [x, z] = polar(15 * 8, 60 * k + 30);
    marker(`barrio_${k}`, 'zone', DISTRICTS[k], x, z, { radius: 45, text: DISTRICTS[k], color: '#7fb4e0' });
  }
  for (const gate of GATES.filter(item => item.id)) {
    const portal = map.markers.find(item => item.id === `salida_${gate.id}`);
    const arrival = map.markers.find(item => item.id === `llegada_${gate.id}`);
    assert.ok(portal && arrival, `Puerta ${gate.id}`);
    const [px, pz] = polar(WALL_RADIUS + 3.2, gate.angle), [ax, az] = polar(RINGS.ronda * 8 - 4, gate.angle);
    portal.position = [rounded(px), rounded(height(px, pz)), rounded(pz)];
    portal.radius = 3.6;
    portal.name = `${gate.name}: salida a Pompelín`;
    arrival.position = [rounded(ax), rounded(height(ax, az)), rounded(az)];
    arrival.rotationY = rounded(Math.atan2(ax, az));
  }
  for (const item of map.markers) if (item.id.startsWith(PREFIX)) item.position[1] = rounded(height(item.position[0], item.position[2]));
  map.description = `Brumaluz, capital de Pompelín · ${HALF * 2} × ${HALF * 2} m. El casco antiguo, ya sin foso ni muralla propia, es el corazón de una ciudad hexagonal de casillas con seis barrios, calles mayores, plazas, colinas, lagunas y casas gremiales; las puertas de su muralla llevan al continente.`;
  delete map.preview;
  return maps.validateMap(map);
}

function api(port, path, method = 'GET', value, headers = {}) {
  const body = value === undefined ? undefined : JSON.stringify(value);
  return fetch(`http://localhost:${port}/__dev/maps/${path}`, {
    method, body, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
  }).then(async response => {
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status}: ${text}`);
    return { value: JSON.parse(text), etag: response.headers.get('etag') };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const apply = args.includes('--apply');
  if (!out && !apply) throw new Error('Usa --out <archivo.json> para revisar o --apply para guardar y publicar.');
  const port = Number(process.env.MAP_BUILD_PORT || 4191);
  const server = await createServer({
    configFile: false, logLevel: 'error', plugins: [mapEditorPlugin()], assetsInclude: ['**/*.glb'],
    server: { host: 'localhost', port, strictPort: true },
  });
  await server.listen();
  try {
    const maps = await server.ssrLoadModule('/src/data/maps.ts');
    const before = await api(port, 'brumaluz');
    const built = buildBrumaluz(before.value, maps);
    if (out) await writeFile(out, JSON.stringify(built));
    if (apply) {
      assert.ok(before.etag, 'Sin revisión no se guarda (protección frente a cambios simultáneos).');
      await api(port, 'brumaluz', 'PUT', built, { 'If-Match': before.etag });
      const publication = await api(port, '__published', 'POST', { id: 'brumaluz' });
      console.log(JSON.stringify(publication.value.published?.warnings ?? [], null, 2));
    }
    console.log(JSON.stringify({
      objects: built.objects.length, tiles: built.objects.filter(object => object.asset.startsWith('city/hex_')).length,
      houses: built.objects.filter(object => / · casa \d/.test(object.name ?? '')).length,
      towerHouses: new Set(built.objects.filter(object => / · casa torre \d/.test(object.name ?? '')).map(object => object.name)).size,
    }, null, 2));
  } finally { await server.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
