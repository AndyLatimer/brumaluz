import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { mapEditorPlugin } from './map-editor-plugin.mjs';

// Brumaluz como una sola ciudad amurallada: el casco antiguo (las casillas hexagonales) queda intacto
// y el antiguo foso se convierte en tierra firme. Alrededor crecen dos anillos de barrios con calles
// radiales que parten de las seis puertas viejas, plazas, colinas, un estanque, edificios hechos con
// piezas modulares y una muralla circular con las puertas al continente.
//
//   node tools/build-brumaluz.mjs --out mapa.json   genera sin guardar (para revisarlo)
//   node tools/build-brumaluz.mjs --apply           guarda el borrador del editor y lo publica

export const PREFIX = 'urbe_';
const OLD_PREFIX = 'ensanche_';
const DEG = Math.PI / 180;
export const RING = { inner: 100, middle: 160, ronda: 214, wall: 226 };
/** Puertas de la muralla exterior, en la prolongación de las del casco antiguo (`null`: cerrada, la del castillo). */
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
/** Manzanas especiales. `band` 1: entre el anillo interior y el central; 2: entre el central y la ronda. */
const SPECIAL = [
  { id: 'telares', band: 1, from: 0, to: 30, kind: 'hall' },
  { id: 'huertas', band: 2, from: 60, to: 90, kind: 'farm' },
  { id: 'molino', band: 2, from: 90, to: 120, kind: 'hill' },
  { id: 'estanque', band: 1, from: 150, to: 180, kind: 'pond' },
  { id: 'aserradero', band: 2, from: 150, to: 180, kind: 'yard' },
  { id: 'canteros', band: 1, from: 180, to: 210, kind: 'hall' },
  { id: 'cantera', band: 2, from: 210, to: 240, kind: 'hill' },
  { id: 'mirador', band: 1, from: 240, to: 270, kind: 'hill' },
  { id: 'cuartel', band: 2, from: 240, to: 270, kind: 'yard' },
  { id: 'lonja', band: 1, from: 300, to: 330, kind: 'hall' },
  { id: 'archivo', band: 1, from: 330, to: 360, kind: 'hall' },
];
/** Montes dentro de la muralla: centro (radio, ángulo), altura y radio aproximado. */
const HILLS = {
  molino: { r: 187, a: 105, height: 12, radius: 25 },
  cantera: { r: 188, a: 225, height: 13, radius: 25 },
  mirador: { r: 130, a: 255, height: 9, radius: 19 },
};
const POND = { r: 130, a: 165, radius: 11 };

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const rounded = value => Math.round(value * 1000) / 1000;
export const polar = (r, degrees) => [r * Math.cos(degrees * DEG), r * Math.sin(degrees * DEG)];
const angleOf = (x, z) => ((Math.atan2(z, x) / DEG) % 360 + 360) % 360;
/** Giro que hace que la fachada (+Z local de las piezas KayKit) mire en la dirección (dx, dz). */
const facing = (dx, dz) => Math.atan2(dx, dz);
const bandRange = band => band === 1 ? [RING.inner, RING.middle] : [RING.middle, RING.ronda];

export function roads() {
  const list = [];
  for (const gate of GATES) {
    list.push({ type: 'radial', angle: gate.angle, r0: 82, r1: gate.id ? 240 : RING.ronda, width: 7, material: 'cobble', main: true });
  }
  list.push(
    { type: 'ring', radius: RING.inner, width: 7, material: 'cobble' },
    { type: 'ring', radius: RING.middle, width: 6, material: 'cobble' },
    { type: 'ring', radius: RING.ronda, width: 5, material: 'path' },
  );
  for (let k = 0; k < 6; k++) list.push({ type: 'radial', angle: 30 + 60 * k, r0: RING.inner, r1: RING.ronda, width: 5, material: 'cobble' });
  for (let k = 0; k < 12; k++) for (const band of [1, 2]) {
    const angle = 15 + 30 * k;
    if (SPECIAL.some(block => block.band === band && block.kind !== 'farm' && block.from < angle && block.to > angle)) continue;
    const [r0, r1] = bandRange(band);
    list.push({ type: 'radial', angle, r0, r1, width: 3.4, material: 'path', lane: true });
  }
  // Callejas a media manzana (arcos), salvo en las manzanas especiales.
  for (let k = 0; k < 12; k++) for (const band of [1, 2]) {
    const from = 30 * k, to = from + 30;
    if (SPECIAL.some(block => block.band === band && block.from < to && block.to > from)) continue;
    list.push({ type: 'ring', radius: band === 1 ? 130 : 187, from, to, width: 3.4, material: 'path', lane: true });
  }
  return list;
}

export function roadDistance(road, x, z) {
  if (road.type === 'ring') {
    if (road.from === undefined) return Math.abs(Math.hypot(x, z) - road.radius);
    const a = angleOf(x, z);
    if (a >= road.from && a <= road.to) return Math.abs(Math.hypot(x, z) - road.radius);
    return Math.min(...[road.from, road.to].map(angle => { const [ex, ez] = polar(road.radius, angle); return Math.hypot(x - ex, z - ez); }));
  }
  const c = Math.cos(road.angle * DEG), s = Math.sin(road.angle * DEG);
  const t = x * c + z * s, n = -x * s + z * c;
  if (t < road.r0) return Math.hypot(t - road.r0, n);
  if (t > road.r1) return Math.hypot(t - road.r1, n);
  return Math.abs(n);
}

function inBlock(block, x, z, margin = 0) {
  const r = Math.hypot(x, z), [r0, r1] = bandRange(block.band);
  if (r < r0 + margin || r > r1 - margin) return false;
  const a = angleOf(x, z), to = block.to === 360 ? 360 : block.to;
  return a >= block.from && a < to;
}

/** Lomas y arboledas del borde del casco que, con el foso relleno, taparían la salida de una puerta vieja. */
function blocksGateExit(object) {
  if (object.layer !== 'naturaleza') return false;
  const [x, , z] = object.position;
  return GATES.some(gate => {
    const c = Math.cos(gate.angle * DEG), s = Math.sin(gate.angle * DEG);
    return x * c + z * s > 78 && Math.abs(-x * s + z * c) < 2.5;
  });
}

export function buildBrumaluz(source, maps) {
  assert.equal(source.id, 'brumaluz');
  assert.deepEqual([source.terrain.columns, source.terrain.rows, source.terrain.cell, source.terrain.origin], [481, 481, 1, [-240, -240]]);
  const map = structuredClone(source);
  const generated = id => id.startsWith(PREFIX) || id.startsWith(OLD_PREFIX);
  // Fuera: el foso (casillas de agua), las afueras anteriores y los transbordadores que las unían.
  map.objects = map.objects.filter(object => !generated(object.id) && object.asset !== 'city/hex_water'
    && !(/^city\/water(lily|plant)/.test(object.asset) && Math.hypot(object.position[0], object.position[2]) > 80)
    && !blocksGateExit(object));
  map.markers = map.markers.filter(marker => !generated(marker.id));
  map.layers = map.layers.filter(layer => !generated(layer.id));
  const keptObjects = map.objects.length;

  const N = 481, OFFSET = 240;
  const index = (x, z) => (z + OFFSET) * N + x + OFFSET;
  const old = maps.decodeTerrain(source.terrain);
  const terrain = maps.createTerrain(480, 480, 1, 0, 0, 0);
  const mat = id => { const i = maps.GROUND_MATERIALS.findIndex(material => material.id === id); assert.ok(i >= 0, id); return i; };

  // Casco antiguo: celdas bajo una casilla hexagonal de tierra (no se tocan).
  const land = map.objects.filter(object => object.asset.startsWith('city/hex_')).map(object => [object.position[0], object.position[2]]);
  const island = new Uint8Array(N * N);
  for (const [hx, hz] of land) {
    for (let z = Math.floor(hz - 5); z <= Math.ceil(hz + 5); z++) for (let x = Math.floor(hx - 5); x <= Math.ceil(hx + 5); x++) {
      if (Math.hypot(x - hx, z - hz) <= 4.75 && old.heights[index(x, z)] > -0.8) island[index(x, z)] = 1;
    }
  }
  // Distancia (aprox.) al casco y altura del borde más cercano, para fundir el terreno nuevo con él.
  const distance = new Float32Array(N * N).fill(Infinity), edge = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) if (island[i]) { distance[i] = 0; edge[i] = old.heights[i]; }
  for (let pass = 0; pass < 2; pass++) {
    const order = pass ? [...Array(N * N).keys()].reverse() : [...Array(N * N).keys()];
    const steps = pass ? [[1, 0, 1], [0, 1, 1], [1, 1, 1.414], [-1, 1, 1.414]] : [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]];
    for (const i of order) {
      const x = i % N, z = (i - x) / N;
      for (const [dx, dz, cost] of steps) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const j = nz * N + nx;
        if (distance[j] + cost < distance[i]) { distance[i] = distance[j] + cost; edge[i] = edge[j]; }
      }
    }
  }

  const hillHeight = (x, z) => {
    let h = 0;
    for (const hill of Object.values(HILLS)) {
      const [cx, cz] = polar(hill.r, hill.a), d = Math.hypot(x - cx, z - cz), sigma = hill.radius / 2.3;
      // Cima allanada (para su edificio) y laderas suaves.
      h += hill.height * Math.exp(-(Math.max(0, d - 4) ** 2) / (2 * sigma * sigma));
    }
    return h;
  };
  /** Relieve de la ciudad sin explanadas: sube suavemente hacia la muralla, ondula y se eleva fuera de ella. */
  const relief = (x, z) => {
    const r = Math.hypot(x, z);
    let h = 1.3 + 2.4 * smooth((r - 92) / 130)
      + 0.85 * Math.sin(x / 37 + 1.3) * Math.cos(z / 43 - 0.7) + 0.55 * Math.sin((x + 2 * z) / 71);
    h += hillHeight(x, z);
    // La muralla se asienta en una franja casi llana.
    const wallBand = 1 - smooth((Math.abs(r - RING.wall) - 6) / 6);
    if (wallBand > 0) {
      const [wx, wz] = [x / r * RING.wall, z / r * RING.wall];
      const flat = 1.3 + 2.4 * smooth((RING.wall - 92) / 130) + 0.85 * Math.sin(wx / 37 + 1.3) * Math.cos(wz / 43 - 0.7) + 0.55 * Math.sin((wx + 2 * wz) / 71);
      h += (flat - h) * wallBand;
    }
    // Fuera de la muralla: lomas boscosas y montes en las esquinas, salvo frente a las puertas.
    if (r > RING.wall + 6) {
      let corridor = 0;
      for (const gate of GATES) {
        if (!gate.id) continue;
        const c = Math.cos(gate.angle * DEG), s = Math.sin(gate.angle * DEG);
        if (x * c + z * s > 0) corridor = Math.max(corridor, 1 - smooth((Math.abs(-x * s + z * c) - 9) / 10));
      }
      const outside = smooth((r - RING.wall - 6) / 14) * (1 - corridor);
      const corners = Math.max(...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) =>
        Math.exp(-((x - sx * 236) ** 2 + (z - sz * 236) ** 2) / (2 * 34 ** 2))));
      h += outside * (2.5 + (r - RING.wall) * 0.12 + 16 * corners + 1.4 * Math.sin(x / 11) * Math.cos(z / 13));
    }
    // Estanque del Olmo.
    const [px, pz] = polar(POND.r, POND.a), pd = Math.hypot(x - px, z - pz);
    if (pd < POND.radius + 8) h = Math.min(h, -2.2 + Math.max(0, pd - POND.radius + 3) * 0.55);
    return h;
  };

  for (let z = -OFFSET; z <= OFFSET; z++) for (let x = -OFFSET; x <= OFFSET; x++) {
    const i = index(x, z);
    if (island[i]) { terrain.heights[i] = old.heights[i]; terrain.paint[i] = old.paint[i]; terrain.grass[i] = old.grass[i]; continue; }
    const blend = smooth(distance[i] / 16);
    terrain.heights[i] = edge[i] * (1 - blend) + relief(x, z) * blend;
  }

  // Calles: pavimento y explanación (se suavizan los baches a lo largo de ellas).
  const network = roads();
  const roadInfo = new Float32Array(N * N).fill(Infinity), roadMaterial = new Uint8Array(N * N);
  for (let z = -OFFSET; z <= OFFSET; z++) for (let x = -OFFSET; x <= OFFSET; x++) {
    const i = index(x, z);
    if (island[i]) continue;
    for (const road of network) {
      const d = roadDistance(road, x, z) - road.width / 2;
      if (d < roadInfo[i]) { roadInfo[i] = d; roadMaterial[i] = mat(road.material); }
    }
  }
  for (let pass = 0; pass < 6; pass++) {
    const next = terrain.heights.slice();
    for (let z = -OFFSET + 2; z <= OFFSET - 2; z++) for (let x = -OFFSET + 2; x <= OFFSET - 2; x++) {
      const i = index(x, z);
      if (island[i] || roadInfo[i] > 1.5) continue;
      let sum = 0, count = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { sum += terrain.heights[index(x + dx, z + dz)]; count++; }
      next[i] = sum / count;
    }
    terrain.heights.set(next);
  }
  const height = (x, z) => maps.sampleHeight(terrain, x + OFFSET, z + OFFSET);

  // Ocupación del suelo (1 m): 1 calle, 2 edificio u objeto, 3 reservado.
  const FREE = 0, ROAD = 1, USED = 2, RESERVED = 3;
  const occupancy = new Uint8Array(N * N);
  for (let z = -OFFSET; z <= OFFSET; z++) for (let x = -OFFSET; x <= OFFSET; x++) {
    const i = index(x, z), r = Math.hypot(x, z);
    if (island[i] || distance[i] < 3 || r < RING.inner - 4 || r > RING.wall - 5) occupancy[i] = RESERVED;
    else if (roadInfo[i] < 1) occupancy[i] = ROAD;
  }
  for (const block of SPECIAL) {
    if (block.kind === 'hall') continue;
    for (let z = -OFFSET; z <= OFFSET; z++) for (let x = -OFFSET; x <= OFFSET; x++) {
      const i = index(x, z);
      if (occupancy[i] === FREE && inBlock(block, x, z)) occupancy[i] = RESERVED;
    }
  }
  const rectCells = (cx, cz, hw, hd, yaw, margin, visit) => {
    const c = Math.cos(yaw), s = Math.sin(yaw), reach = Math.hypot(hw, hd) + margin + 1;
    for (let z = Math.floor(cz - reach); z <= Math.ceil(cz + reach); z++) for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      if (Math.abs(x) > OFFSET || Math.abs(z) > OFFSET) { if (visit(-1) === false) return false; continue; }
      const dx = x - cx, dz = z - cz;
      // Inversa del giro Y de three.js: local x = dx·cos − dz·sin, local z = dx·sin + dz·cos.
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= hw + margin && Math.abs(lz) <= hd + margin && visit(index(x, z)) === false) return false;
    }
    return true;
  };
  const fits = (cx, cz, hw, hd, yaw, margin = 0.8) => rectCells(cx, cz, hw, hd, yaw, margin, i => i >= 0 && occupancy[i] === FREE);
  const occupy = (cx, cz, hw, hd, yaw, margin = 0.8, value = USED) => rectCells(cx, cz, hw, hd, yaw, margin, i => { if (i >= 0 && occupancy[i] !== ROAD) occupancy[i] = value; });

  // Explanadas para los edificios (se aplican antes de fijar alturas definitivas).
  const pads = [];
  const pad = (x, z, radius, y = height(x, z), falloff = 3) => { pads.push({ x, z, radius, y, falloff }); return y; };
  const paints = [];
  const paint = (x, z, radius, material, grass = 0, force = false) => paints.push({ x, z, radius, material: mat(material), grass, force });

  map.layers.push(
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

  /** Conjunto de piezas en coordenadas locales: +Z local es la fachada. */
  const frame = (cx, cz, yaw, y0, layer, name) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return (asset, lx, lz, ly = 0, localYaw = 0, scale = 1, extra = {}) => add(asset,
      cx + lx * c + lz * s, cz - lx * s + lz * c, scale, yaw + localYaw, layer, { y: rounded(y0 + ly), name, ...extra });
  };
  /**
   * Edificio hecho a mano con piezas de mazmorra (módulos de 4 m): suelo, muros con puerta y ventanas,
   * pilares en las esquinas, cubierta de madera, estandartes y bandera. `open` deja solo pilares (lonja).
   */
  const hall = ({ cx, cz, yaw, cols, rows, floors = 1, s = 1, open = false, name, banner = 'red', roof = 'floor_wood_large_dark', layer = 'civico' }) => {
    const W = cols * 4 * s, D = rows * 4 * s;
    const y0 = pad(cx, cz, Math.hypot(W, D) / 2 + 1, height(cx, cz), 3);
    paint(cx, cz, Math.hypot(W, D) / 2 + 1.5, 'stone');
    const piece = frame(cx, cz, yaw, y0, layer, name);
    const d = asset => `dungeon/objects/${asset}`;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      piece(d('floor_tile_large'), -W / 2 + (2 + 4 * i) * s, -D / 2 + (2 + 4 * j) * s, -0.04, 0, s, { collision: 'none' });
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
    occupy(cx, cz, W / 2, D / 2, yaw, 1.5);
    return { y0, piece, W, D };
  };

  // --- Muralla exterior y puertas -------------------------------------------------------------
  const wallY = (x, z) => height(x, z) - 0.25;
  const L = 8; // largo de un tramo de muralla (city/wall_straight a escala 4)
  const gateHalf = 4 / RING.wall / DEG; // medio ancho angular de la puerta
  const openGates = GATES.filter(gate => gate.id);
  const cuts = openGates.map(gate => gate.angle).sort((a, b) => a - b);
  for (let k = 0; k < cuts.length; k++) {
    const from = cuts[k] + gateHalf, to = (k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + 360) - gateHalf;
    const span = (to - from) * DEG, count = Math.ceil(span * RING.wall / L), step = span / count;
    const chord = 2 * RING.wall * Math.sin(step / 2);
    for (let n = 0; n < count; n++) {
      const a = from * DEG + (n + 0.5) * step, x = Math.cos(a) * RING.wall, z = Math.sin(a) * RING.wall;
      add('city/wall_straight', x, z, [chord / 2 + 0.02, 4, 4], -a - Math.PI / 2, 'muralla', { y: rounded(wallY(x, z)), name: 'Muralla exterior' });
    }
  }
  for (const gate of GATES) {
    const a = gate.angle * DEG, [x, z] = polar(RING.wall, gate.angle);
    const tangent = [-Math.sin(a), Math.cos(a)];
    if (gate.id) {
      add('city/wall_straight_gate', x, z, 4, -a - Math.PI / 2, 'muralla', { y: rounded(wallY(x, z)), name: gate.name });
      for (const side of [-1, 1]) {
        const tx = x + tangent[0] * side * 7.2, tz = z + tangent[1] * side * 7.2;
        add('city/tower_A', tx, tz, 5.2, -a, 'muralla', { y: rounded(wallY(tx, tz)), name: `${gate.name} · torreón` });
        add('city/flag_red', tx, tz, 7, -a, 'muralla', { y: rounded(wallY(tx, tz) + 2.19 * 5.2), collision: 'none' });
      }
      // Plazuela interior de la puerta.
      const [sx, sz] = polar(RING.ronda, gate.angle);
      paint(sx, sz, 9, 'cobble', 0, true);
      for (const side of [-1, 1]) {
        const [lx, lz] = polar(RING.ronda + 6, gate.angle + side * 3.2);
        add('builtin/lamppost', lx, lz, 1, 0, 'atrezo', { name: `${gate.name} · farol` });
      }
    } else {
      add('city/tower_B', x, z, 6.5, -a, 'muralla', { y: rounded(wallY(x, z)), name: gate.name });
      add('city/flag_yellow', x, z, 8, -a, 'muralla', { y: rounded(wallY(x, z) + 2.49 * 6.5), collision: 'none' });
    }
  }
  for (let k = 0; k < 6; k++) for (const offset of [20, 40]) {
    const angle = 60 * k + offset, [x, z] = polar(RING.wall, angle);
    add('city/tower_B', x, z, 4.4, -angle * DEG, 'muralla', { y: rounded(wallY(x, z)), name: 'Torre de la muralla' });
  }

  // --- Plazas mayores (calle mayor × anillo central) ------------------------------------------
  for (let k = 0; k < 6; k++) {
    const angle = 60 * k, [cx, cz] = polar(RING.middle, angle), radius = 15.5;
    for (let z = Math.floor(cz - radius - 3); z <= cz + radius + 3; z++) for (let x = Math.floor(cx - radius - 3); x <= cx + radius + 3; x++) {
      if (Math.hypot(x - cx, z - cz) <= radius + 2.5 && occupancy[index(x, z)] !== ROAD) occupancy[index(x, z)] = RESERVED;
    }
    const y = pad(cx, cz, radius, height(cx, cz), 5);
    paint(cx, cz, radius, 'stone', 0, true);
    // Centro de la plaza: pozo, columna conmemorativa o tablado.
    if (k % 3 === 0) add(k % 2 ? 'city/well' : 'medieval-builder/objects/well', cx, cz, k % 2 ? 4.6 : 3.4, angle * DEG, 'atrezo', { y, name: `${PLAZAS[k]} · pozo` });
    else if (k % 3 === 1) {
      add('dungeon/objects/floor_tile_large_rocks', cx, cz, [1.1, 0.6, 1.1], angle * DEG, 'atrezo', { y, collision: 'none' });
      add('dungeon/objects/pillar_decorated', cx, cz, [0.9, 1.3, 0.9], angle * DEG, 'atrezo', { y: rounded(y + 0.2), name: `${PLAZAS[k]} · columna` });
      add('city/flag_yellow', cx, cz, 6, angle * DEG, 'atrezo', { y: rounded(y + 5.4), collision: 'none' });
    } else {
      add('city/stage_A', cx, cz, 5.5, facing(-cx, -cz), 'atrezo', { y, name: `${PLAZAS[k]} · tablado` });
      for (const side of [-1, 1]) add('dungeon/objects/banner_thin_' + pick(['red', 'yellow', 'blue']), cx + side * 2.2, cz, 0.8, facing(-cx, -cz), 'atrezo', { y, collision: 'none' });
    }
    for (let q = 0; q < 4; q++) {
      const [fx, fz] = polar(3.6, angle + 90 * q);
      add('forest/objects/Bush_4_A_Color1', cx + fx, cz + fz, 2.2, random() * 6, 'verde', { y });
    }
    for (let q = 0; q < 4; q++) {
      const diagonal = angle + 45 + 90 * q, [bx, bz] = polar(1, diagonal);
      const at = distanceFromCenter => [cx + bx * distanceFromCenter, cz + bz * distanceFromCenter];
      const [sx, sz] = at(13.6);
      const stall = (k + q) % 3;
      if (stall === 0) add('city/market', sx, sz, 3.2, facing(cx - sx, cz - sz), 'civico', { name: `${PLAZAS[k]} · puesto` });
      else if (stall === 1) add('medieval-builder/objects/market', sx, sz, 2.8, facing(cx - sx, cz - sz), 'civico', { name: `${PLAZAS[k]} · puesto` });
      else {
        add('mixed-bag/objects/umbrella_' + pick(['yellow', 'blue', 'green', 'pink']), sx, sz, 2.2, random() * 6, 'atrezo', { collision: 'none' });
        add('dungeon/objects/table_medium_tablecloth_decorated_B', sx, sz, 0.8, facing(cx - sx, cz - sz), 'atrezo');
        const [cx2, cz2] = at(15.8);
        add(`restaurant/objects/crate_${pick(['carrots', 'tomatoes', 'potatoes', 'cheese', 'onions', 'lettuce'])}`, cx2, cz2, 0.55, random() * 6, 'atrezo');
      }
      const [px, pz] = at(7.5);
      add('builtin/bench', px, pz, 1, facing(cx - px, cz - pz), 'atrezo', { name: 'Banco de la plaza' });
      const [lx, lz] = at(9.5);
      add('builtin/lamppost', lx, lz, 1, 0, 'atrezo', { name: `${PLAZAS[k]} · farol` });
      const [tx, tz] = at(17.6);
      add(pick(['city/tree_single_A', 'city/tree_single_B']), tx, tz, 4, random() * 6, 'verde');
      const side = polar(1, diagonal + 20), [ox, oz] = [cx + side[0] * 13.6, cz + side[1] * 13.6];
      const [prop, scale] = pick([['city/wheelbarrow', 4], ['city/crate_long_A', 4], ['dungeon/objects/barrel_small_stack', 0.8], ['city/sack', 4]]);
      add(prop, ox, oz, scale, random() * 6, 'atrezo');
    }
    marker(`plaza_${k}`, 'zone', PLAZAS[k], cx, cz, { radius, text: `Plaza mayor del ${DISTRICTS[k].toLowerCase()} y del ${DISTRICTS[(k + 5) % 6].toLowerCase()}.`, color: '#e0a84a' });
  }
  // Plazuelas a la salida de cada puerta del casco antiguo.
  for (let k = 0; k < 6; k++) {
    const [cx, cz] = polar(RING.inner, 60 * k);
    paint(cx, cz, 9, 'stone', 0, true);
    for (const side of [-1, 1]) {
      const [lx, lz] = polar(RING.inner + 6, 60 * k + side * 3.5);
      add('builtin/lamppost', lx, lz, 1, 0, 'atrezo', { name: 'Farol de la puerta vieja' });
    }
  }

  // --- Manzanas especiales -------------------------------------------------------------------
  const blockCenter = (block, r) => polar(r ?? (bandRange(block.band)[0] + bandRange(block.band)[1]) / 2, (block.from + block.to) / 2);
  const special = Object.fromEntries(SPECIAL.map(block => [block.id, block]));
  const towardCenter = (x, z) => facing(-x, -z);

  // Casas gremiales (frente al anillo interior) hechas a mano.
  const halls = [
    { id: 'telares', name: 'Casa de los Telares', cols: 4, rows: 3, floors: 1, banner: 'blue' },
    { id: 'canteros', name: 'Casa de los Canteros', cols: 3, rows: 3, floors: 2, banner: 'white' },
    { id: 'lonja', name: 'Lonja de los Mercaderes', cols: 5, rows: 3, open: true, roof: 'floor_wood_large' },
    { id: 'archivo', name: 'Archivo de la Capital', cols: 4, rows: 3, floors: 2, banner: 'yellow' },
  ];
  for (const spec of halls) {
    const block = special[spec.id], D = spec.rows * 4;
    const [cx, cz] = blockCenter(block, RING.inner + 3.5 + 4 + D / 2);
    const built = hall({ ...spec, cx, cz, yaw: towardCenter(cx, cz) });
    marker(`edificio_${spec.id}`, 'note', spec.name, cx, cz, { radius: Math.max(built.W, built.D) / 2, text: 'Edificio compuesto con piezas modulares; se puede retocar pieza a pieza en el editor.' });
    const [yx, yz] = blockCenter(block, RING.inner + 3.5 + 4 + D + 9);
    const yardYaw = towardCenter(yx, yz), yard = frame(yx, yz, yardYaw, pad(yx, yz, 6), 'civico', spec.name);
    occupy(yx, yz, 7, 4, yardYaw, 1);
    if (spec.id === 'telares') {
      for (const [lx, asset] of [[-5, 'Textiles_Stack_Large_Colored'], [-1.5, 'Textiles_Stack_Large'], [2, 'Textiles_Stack_Large_Colored'], [5.5, 'Pallet_Wood_Covered_A']]) {
        yard(`resources/objects/${asset}`, lx, 0, 0, random() * 0.4, 1.6);
      }
      paint(yx, yz, 7, 'path');
    } else if (spec.id === 'canteros') {
      for (const [lx, asset] of [[-5, 'Stone_Bricks_Stack_Large'], [-1.5, 'Stone_Bricks_Stack_Medium'], [2, 'Stone_Chunks_Large'], [5.5, 'Stone_Bricks_Stack_Large']]) {
        yard(`resources/objects/${asset}`, lx, 0, 0, random() * 0.4, 1.7);
      }
      yard('city/wheelbarrow', 0, 3, 0, 0.6, 4);
      paint(yx, yz, 7, 'dirt');
    } else if (spec.id === 'lonja') {
      const { piece } = built;
      for (const lx of [-6, 0, 6]) for (const lz of [-3, 3]) {
        piece('dungeon/objects/table_long_tablecloth_decorated_A', lx, lz, 0, Math.PI / 2, 0.8);
      }
      for (const [lx, lz] of [[-9, 0], [9, 0], [-3, 0], [3, 0]]) {
        piece(`restaurant/objects/crate_${pick(['carrots', 'tomatoes', 'potatoes', 'cheese', 'onions'])}`, lx, lz, 0, random() * 6, 0.55);
      }
      for (const lx of [-4, 4]) yard('city/tent', lx, 0, 0, 0, 4);
      paint(yx, yz, 7, 'cobble');
    } else {
      for (const lx of [-5, 5]) yard('city/trees_A_small', lx, 0, 0, random() * 6, 3);
      yard('builtin/bench', 0, 1.5, 0, Math.PI, 1);
      yard('builtin/bench', 0, -1.5, 0, 0, 1);
      paint(yx, yz, 7, 'meadow', 40);
    }
  }

  // Colinas.
  const [mx, mz] = polar(HILLS.molino.r, HILLS.molino.a);
  {
    const top = pad(mx, mz, 6, height(mx, mz), 2);
    add('city/windmill', mx, mz, 6, towardCenter(mx, mz), 'civico', { y: top, name: 'Molino de la colina' });
    for (let n = 0; n < 14; n++) {
      if (n === 3) continue; // entrada
      const a = n / 14 * Math.PI * 2, x = mx + Math.cos(a) * 9, z = mz + Math.sin(a) * 9;
      add('city/fence_wood_straight', x, z, 4.2, -a, 'verde');
    }
    for (const [dx, dz, asset] of [[3, 4, 'city/sack'], [3.8, 3.2, 'city/sack'], [-4, 3, 'city/wheelbarrow'], [4, -3.5, 'city/crate_A_big']]) {
      add(asset, mx + dx, mz + dz, 4, random() * 6, 'atrezo');
    }
    for (let n = 0; n < 16; n++) {
      const a = n / 16 * Math.PI * 2 + 0.2, d = 15 + (n % 2) * 3, x = mx + Math.cos(a) * d, z = mz + Math.sin(a) * d;
      if (!inBlock(special.molino, x, z, 5)) continue;
      add('medieval-builder/objects/farm_plot', x, z, 2.6, -a, 'verde', { collision: 'none', name: 'Bancal de la colina' });
      paint(x, z, 2.6, 'farmland', 0);
    }
    marker('colina_molino', 'note', 'Colina del Molino', mx, mz, { radius: HILLS.molino.radius, text: 'Mirador sobre las Huertas del Alba.' });
  }
  const [qx, qz] = polar(HILLS.cantera.r, HILLS.cantera.a);
  {
    paint(qx, qz, 15, 'stone');
    paint(qx, qz, 6, 'dirt');
    const top = pad(qx, qz, 5, height(qx, qz), 2);
    add('city/resource_stone', qx, qz, 5, 0.4, 'civico', { y: top, name: 'Cantera · bloques' });
    add('resources/objects/Stone_Bricks_Stack_Large', qx + 3.5, qz - 2, 1.8, 0.3, 'civico', { y: top });
    for (let n = 0; n < 22; n++) {
      const a = random() * Math.PI * 2, d = 7 + random() * 10, x = qx + Math.cos(a) * d, z = qz + Math.sin(a) * d;
      if (!inBlock(special.cantera, x, z, 4)) continue;
      add(`forest/objects/Rock_${pick(['1_A', '1_C', '2_A', '2_D', '3_A', '3_D'])}_Color1`, x, z, 0.9 + random() * 1.2, random() * 6, 'verde', { lift: -0.15 });
    }
    for (const [dx, dz] of [[-4, 3], [3, 4], [-2, -4]]) add('resources/objects/Stone_Chunks_Large', qx + dx, qz + dz, 1.6, random() * 6, 'atrezo');
    add('rpg-tools/objects/pickaxe', qx - 1, qz + 2, 1.6, 0.8, 'atrezo', { collision: 'none', lift: 0.1 });
    const [ex, ez] = polar(HILLS.cantera.r - 15, HILLS.cantera.a - 9);
    add('medieval-builder/objects/mine', ex, ez, 4, towardCenter(ex, ez), 'civico', { y: pad(ex, ez, 4.5), name: 'Mina de los canteros' });
    for (const offset of [-5, 5]) {
      const [rx, rz] = polar(HILLS.cantera.r - 15, HILLS.cantera.a + offset);
      add('resources/objects/Stone_Bricks_Stack_Large', rx, rz, 1.6, random() * 6, 'atrezo', { y: pad(rx, rz, 1.8) });
    }
    marker('colina_cantera', 'note', 'Cantera de los Canteros', qx, qz, { radius: HILLS.cantera.radius, text: 'Colina rocosa de la que sale la piedra de la ciudad.' });
  }
  const [wx0, wz0] = polar(HILLS.mirador.r, HILLS.mirador.a);
  {
    const top = pad(wx0, wz0, 6, height(wx0, wz0), 2);
    add('medieval-builder/objects/watchtower', wx0, wz0, 4.4, towardCenter(wx0, wz0), 'civico', { y: top, name: 'Torre del Mirador' });
    for (let n = 0; n < 4; n++) {
      const a = n * Math.PI / 2 + Math.PI / 4, x = wx0 + Math.cos(a) * 6.5, z = wz0 + Math.sin(a) * 6.5;
      add('builtin/bench', x, z, 1, facing(Math.cos(a), Math.sin(a)), 'atrezo', { name: 'Banco del mirador' });
    }
    for (let n = 0; n < 18; n++) {
      const a = random() * Math.PI * 2, d = 9 + random() * 9, x = wx0 + Math.cos(a) * d, z = wz0 + Math.sin(a) * d;
      if (!inBlock(special.mirador, x, z, 5)) continue;
      add(pick(['city/trees_A_medium', 'city/trees_B_medium', 'city/tree_single_A', 'forest/objects/Tree_1_A_Color1']), x, z, 3 + random(), random() * 6, 'verde');
    }
    marker('colina_mirador', 'note', 'Mirador de la Guardia', wx0, wz0, { radius: HILLS.mirador.radius, text: 'Atalaya sobre el casco antiguo.' });
  }
  // Estanque del Olmo y su molino de agua.
  const [px0, pz0] = polar(POND.r, POND.a);
  {
    paint(px0, pz0, POND.radius + 3.5, 'sand');
    const [mwx, mwz] = [px0 + Math.cos(POND.a * DEG) * (POND.radius + 1.5), pz0 + Math.sin(POND.a * DEG) * (POND.radius + 1.5)];
    add('city/watermill', mwx, mwz, 4, facing(px0 - mwx, pz0 - mwz), 'civico', { lift: 0.1, name: 'Molino del estanque' });
    for (let n = 0; n < 9; n++) {
      const a = random() * Math.PI * 2, d = random() * (POND.radius - 4);
      add(n % 3 ? 'city/waterlily_A' : 'city/waterplant_A', px0 + Math.cos(a) * d, pz0 + Math.sin(a) * d, 4 + random(), random() * 6, 'verde', { y: -0.85 });
    }
    for (let n = 0; n < 14; n++) {
      const a = n / 14 * Math.PI * 2 + 0.1, x = px0 + Math.cos(a) * (POND.radius + 7), z = pz0 + Math.sin(a) * (POND.radius + 7);
      if (Math.abs(((a / DEG - POND.a) % 360 + 540) % 360 - 180) < 35) continue; // el molino
      if (n % 3 === 0) add('builtin/bench', x, z, 1, facing(px0 - x, pz0 - z), 'atrezo', { name: 'Banco del estanque' });
      else add(pick(['city/trees_A_large', 'city/trees_B_large', 'forest/objects/Tree_2_A_Color1']), x + Math.cos(a) * 4, z + Math.sin(a) * 4, 3.4, random() * 6, 'verde');
    }
    marker('estanque', 'note', 'Estanque del Olmo', px0, pz0, { radius: POND.radius, text: 'Parque con estanque y molino de agua.' });
  }
  // Huertas del Alba.
  for (let z = -OFFSET; z <= OFFSET; z += 7) for (let x = -OFFSET; x <= OFFSET; x += 7) {
    if (!inBlock(special.huertas, x, z, 5.5)) continue;
    const r = Math.hypot(x, z), a = angleOf(x, z);
    if (Math.abs(a - 75) * DEG * r < 4.5) continue; // camino entre parcelas
    const yaw = -a * DEG;
    add('medieval-builder/objects/farm_plot', x, z, 3.4, yaw, 'verde', { collision: 'none', name: 'Huerta del Alba' });
    if ((x + z) % 2 === 0) add('medieval-builder/objects/farm_wheat', x + 1, z, 2.4, yaw, 'verde', { collision: 'none' });
    paint(x, z, 3.6, 'farmland', 0);
  }
  // Aserradero del Olmo.
  {
    const block = special.aserradero;
    const [ax, az] = blockCenter(block, 180), yaw = towardCenter(ax, az);
    add('medieval-builder/objects/lumbermill', ax, az, 4, yaw, 'civico', { y: pad(ax, az, 5), name: 'Aserradero del Olmo' });
    const [bx, bz] = polar(195, 168);
    add('city/lumbermill', bx, bz, 4, towardCenter(bx, bz), 'civico', { y: pad(bx, bz, 4), name: 'Taller de carpintería' });
    for (let n = 0; n < 9; n++) {
      const [lx, lz] = polar(170 + (n % 3) * 6, 153 + Math.floor(n / 3) * 3);
      add(n % 2 ? 'resources/objects/Wood_Log_Stack' : 'resources/objects/Wood_Planks_Stack_Large', lx, lz, 1.5, random() * 6, 'atrezo');
    }
    for (let n = 0; n < 10; n++) {
      const [tx, tz] = polar(203 + random() * 5, 152 + n * 2.6);
      add(pick(['city/tree_single_A', 'city/tree_single_B']), tx, tz, 3.6, random() * 6, 'verde');
    }
    paint(ax, az, 11, 'dirt', 10);
    paint(...polar(173, 156), 8, 'dirt', 10);
    for (let n = 0; n < 6; n++) {
      const [lx, lz] = polar(171 + (n % 2) * 4, 168 + Math.floor(n / 2) * 3.5);
      add(n % 3 ? 'resources/objects/Wood_Log_A' : 'resources/objects/Wood_Plank_A', lx, lz, 2.2, random() * 6, 'atrezo');
    }
    add('rpg-tools/objects/saw', ...polar(176, 160), 2, 0.5, 'atrezo', { collision: 'none' });
    add('city/wheelbarrow', ...polar(167, 162), 4, 1.2, 'atrezo');
  }
  // Cuartel de la Guardia.
  {
    const [bx, bz] = polar(182, 250);
    add('city/barracks', bx, bz, 4.6, towardCenter(bx, bz), 'civico', { y: pad(bx, bz, 5), name: 'Cuartel de la Guardia' });
    const [cx, cz] = polar(182, 262);
    add('medieval-builder/objects/barracks', cx, cz, 4, towardCenter(cx, cz), 'civico', { y: pad(cx, cz, 5), name: 'Cuartel de la Guardia · dormitorios' });
    const [rx, rz] = polar(200, 256);
    add('city/archeryrange', rx, rz, 4.4, towardCenter(rx, rz), 'civico', { y: pad(rx, rz, 5), name: 'Campo de tiro' });
    paint(...polar(178, 256), 10, 'dirt', 0);
    for (let n = 0; n < 6; n++) add('city/target', ...polar(186, 250 + n * 2.4), 4, towardCenter(...polar(186, 250 + n * 2.4)), 'atrezo');
    for (const a of [251, 261]) for (const dr of [0, 2.5]) add('city/barrel', ...polar(190 + dr, a), 4, random() * 6, 'atrezo');
    for (const a of [244, 268]) add('city/flag_red', ...polar(176, a), 6, 0, 'atrezo', { collision: 'none' });
    for (let n = 0; n < 17; n++) {
      const a = 247 + n * 1.25, gap = n === 7 || n === 8;
      if (!gap) add('city/fence_wood_straight', ...polar(165.5, a), 4.2, -a * DEG, 'atrezo');
    }
    for (let n = 0; n < 3; n++) add('city/weaponrack', ...polar(176, 252 + n * 3), 4, towardCenter(...polar(176, 252 + n * 3)), 'atrezo');
    add('dungeon/objects/banner_patternB_blue', ...polar(186, 256), 1, towardCenter(...polar(186, 256)), 'atrezo', { collision: 'none' });
    for (let n = 0; n < 4; n++) {
      const [tx, tz] = polar(170, 250 + n * 4);
      add('city/target', tx, tz, 4, towardCenter(tx, tz) + Math.PI, 'atrezo');
    }
    for (const a of [247, 265]) {
      const [tx, tz] = polar(168, a);
      add('city/weaponrack', tx, tz, 4, towardCenter(tx, tz), 'atrezo');
      add('city/tent', ...polar(194, a), 4, random() * 6, 'atrezo');
    }
  }
  // Ermita (frente a la Plaza de la Lonja).
  {
    const [cx, cz] = polar(RING.middle + 3 + 4 + 5, 352);
    add('city/church', cx, cz, 5, towardCenter(cx, cz), 'civico', { y: pad(cx, cz, 5.5), name: 'Ermita de los Mercaderes' });
    occupy(cx, cz, 4, 4.5, towardCenter(cx, cz), 2);
  }

  // --- Viviendas a lo largo de las calles ----------------------------------------------------
  const HOUSES = {
    home_A: { asset: 'city/home_A', scale: 5.4, w: 4.3, d: 4.6 },
    home_B: { asset: 'city/home_B', scale: 5, w: 4.4, d: 5.5 },
    house: { asset: 'medieval-builder/objects/house', scale: 3.8, w: 6.4, d: 6.3 },
    tavern: { asset: 'city/tavern', scale: 4.4, w: 5.2, d: 5.9 },
    smith: { asset: 'city/blacksmith', scale: 4.2, w: 5.4, d: 5.3 },
    shop: { asset: 'city/market', scale: 3.4, w: 6.1, d: 4.5 },
    tower: { asset: 'stone', scale: 0.85, w: 6.8, d: 6.8 },
  };
  const choose = road => {
    const roll = random();
    if (!road.lane && roll < (road.main ? 0.22 : 0.14)) return HOUSES.tower;
    if (road.main && roll < 0.24) return pick([HOUSES.tavern, HOUSES.shop, HOUSES.smith]);
    if (!road.lane && roll < 0.08) return pick([HOUSES.shop, HOUSES.smith]);
    if (roll < 0.42) return HOUSES.home_A;
    if (roll < 0.74) return HOUSES.home_B;
    return HOUSES.house;
  };
  const districtOf = (x, z) => DISTRICTS[Math.floor(angleOf(x, z) / 60) % 6];
  const houseCount = {};
  const placeHouse = (type, x, z, yaw, road) => {
    const name = `${districtOf(x, z)} · casa ${(houseCount[districtOf(x, z)] = (houseCount[districtOf(x, z)] ?? 0) + 1)}`;
    if (type.asset === 'stone') {
      hall({ cx: x, cz: z, yaw, cols: 2, rows: 2, floors: 2, s: type.scale, name: name.replace('casa', 'casa torre'), banner: pick(['red', 'blue', 'green', 'yellow']), layer: 'casas' });
      return;
    }
    occupy(x, z, type.w / 2, type.d / 2, yaw, 0.6);
    const y = pad(x, z, Math.max(type.w, type.d) / 2 + 0.6, height(x, z), 2.5);
    add(type.asset, x, z, type.scale, yaw, 'casas', { y, name });
    paint(x, z, Math.max(type.w, type.d) / 2 + 1.4, road.main ? 'path' : 'dirt', 0);
    // Un detalle junto a la casa (si cabe).
    const side = random() < 0.5 ? -1 : 1, c = Math.cos(yaw), s = Math.sin(yaw);
    const lx = side * (type.w / 2 + 1.1), lz = type.d / 2 - 0.6;
    const dx = x + lx * c + lz * s, dz = z - lx * s + lz * c;
    if (random() < 0.7 && fits(dx, dz, 0.5, 0.5, yaw, 0.2)) {
      const prop = pick([
        ['city/barrel', 4], ['city/crate_A_big', 4], ['city/crate_long_A', 4], ['city/sack', 4], ['city/bucket_water', 4],
        ['dungeon/objects/barrel_small_stack', 0.8], ['resources/objects/Wood_Log_Stack', 0.9], ['city/wheelbarrow', 4], ['forest/objects/Bush_2_A_Color1', 2.4],
      ]);
      add(prop[0], dx, dz, prop[1], yaw + random() * 0.6 - 0.3, 'atrezo');
      occupy(dx, dz, 0.5, 0.5, yaw, 0.2);
    }
  };
  const frontage = (road, sideList = [-1, 1]) => {
    for (const side of sideList) {
      if (road.type === 'radial') {
        const c = Math.cos(road.angle * DEG), s = Math.sin(road.angle * DEG);
        let t = road.r0 + 6;
        while (t < Math.min(road.r1, RING.ronda) - 4) {
          const nx = -s * side, nz = c * side, yaw = facing(-nx, -nz);
          const spot = type => { const offset = road.width / 2 + 1.8 + type.d / 2; return [t * c + nx * offset, t * s + nz * offset]; };
          const type = [choose(road), HOUSES.home_A].find(item => fits(...spot(item), item.w / 2, item.d / 2, yaw, 0.6));
          if (type) { placeHouse(type, ...spot(type), yaw, road); t += type.w + 0.9 + random() * 1.6; }
          else t += 1.5;
        }
      } else {
        const radius = road.radius + side * (road.width / 2 + 1.8);
        const start = (road.from ?? 0) * DEG, end = (road.to ?? 360) * DEG;
        let arc = road.from === undefined ? random() * 5 : 0;
        while (arc < (end - start) * radius - 4) {
          const angle = start + arc / radius, yaw = facing(-side * Math.cos(angle), -side * Math.sin(angle));
          const spot = type => [Math.cos(angle) * (radius + side * type.d / 2), Math.sin(angle) * (radius + side * type.d / 2)];
          const type = [choose(road), HOUSES.home_A].find(item => fits(...spot(item), item.w / 2, item.d / 2, yaw, 0.6));
          if (type) { placeHouse(type, ...spot(type), yaw, road); arc += type.w + 0.9 + random() * 1.6; }
          else arc += 1.5;
        }
      }
    }
  };
  const ordered = [
    ...network.filter(road => road.main),
    ...network.filter(road => road.type === 'ring' && road.radius === RING.middle),
    ...network.filter(road => road.type === 'radial' && !road.main && !road.lane),
    ...network.filter(road => road.lane && road.type === 'radial'),
    ...network.filter(road => road.lane && road.type === 'ring'),
  ];
  for (const road of ordered) frontage(road);
  frontage(network.find(road => road.type === 'ring' && road.radius === RING.inner), [1]);
  frontage(network.find(road => road.type === 'ring' && road.radius === RING.ronda), [-1]);

  // --- Arbolado de calles, faroles y patios ---------------------------------------------------
  for (const road of network.filter(item => item.main && item.r1 > RING.ronda)) {
    for (let t = road.r0 + 14; t < RING.ronda - 8; t += 22) {
      if (Math.abs(t - RING.middle) < 22) continue;
      for (const side of [-1, 1]) {
        const c = Math.cos(road.angle * DEG), s = Math.sin(road.angle * DEG), offset = road.width / 2 + 0.5;
        add('builtin/lamppost', t * c - s * side * offset, t * s + c * side * offset, 1, 0, 'atrezo', { name: 'Farol de la calle mayor' });
      }
    }
  }
  for (let n = 0; n < 160; n++) {
    const angle = n / 160 * 360, [x, z] = polar(RING.inner + 3.5 + 1.6, angle);
    if (fits(x, z, 0.6, 0.6, 0, 0.3)) { add(n % 2 ? 'city/tree_single_A' : 'city/tree_single_B', x, z, 3.4, random() * 6, 'verde'); occupy(x, z, 0.6, 0.6, 0, 0.3); }
  }
  // Patios y huertos traseros: lo que queda libre dentro de las manzanas.
  for (let z = -RING.ronda; z <= RING.ronda; z += 5) for (let x = -RING.ronda; x <= RING.ronda; x += 5) {
    const jx = x + random() * 3 - 1.5, jz = z + random() * 3 - 1.5;
    if (!fits(jx, jz, 1.4, 1.4, 0, 0.4)) continue;
    const roll = random();
    if (roll < 0.2) add(pick(['city/tree_single_A', 'city/tree_single_B']), jx, jz, 3.2 + random() * 0.8, random() * 6, 'verde');
    else if (roll < 0.3) add(pick(['forest/objects/Tree_1_A_Color1', 'forest/objects/Tree_2_A_Color1', 'forest/objects/Tree_4_A_Color1', 'forest/objects/Tree_3_A_Color1']), jx, jz, 1.1 + random() * 0.4, random() * 6, 'verde');
    else if (roll < 0.42) add(pick(['city/trees_A_small', 'city/trees_A_medium']), jx, jz, 2.6, random() * 6, 'verde');
    else if (roll < 0.56) add(pick(['forest/objects/Bush_1_A_Color1', 'forest/objects/Bush_2_A_Color1', 'forest/objects/Bush_4_A_Color1']), jx, jz, 1.8 + random(), random() * 6, 'verde');
    else if (roll < 0.64) {
      add('medieval-builder/objects/farm_plot', jx, jz, 2.2, random() * 6, 'verde', { collision: 'none', name: 'Huerto' });
      paint(jx, jz, 2, 'farmland', 0);
    } else if (roll < 0.68) add('mixed-bag/objects/flax_flower_' + pick(['A', 'B']), jx, jz, 2, random() * 6, 'verde', { collision: 'none' });
    else if (roll < 0.7) add('medieval-builder/objects/well', jx, jz, 1.8, random() * 6, 'atrezo');
    else continue;
    occupy(jx, jz, 1.4, 1.4, 0, 0.4);
  }

  // --- Jardines de la muralla vieja y bosques de fuera ---------------------------------------
  for (let n = 0; n < 900; n++) {
    const angle = random() * 360, r = 80 + random() * 18, [x, z] = polar(r, angle);
    const i = index(Math.round(x), Math.round(z));
    if (island[i] || distance[i] < 3 || roadInfo[i] < 2 || Math.hypot(x, z) > RING.inner - 5) continue;
    const near = map.objects.some(object => object.layer === `${PREFIX}verde` && Math.hypot(object.position[0] - x, object.position[2] - z) < 4.5);
    if (near) continue;
    add(pick(['city/trees_A_medium', 'city/trees_B_medium', 'city/tree_single_A', 'forest/objects/Bush_1_A_Color1']), x, z, random() < 0.75 ? 3 : 1.8, random() * 6, 'verde');
  }
  for (let n = 0; n < 1400; n++) {
    const x = -OFFSET + 4 + random() * (2 * OFFSET - 8), z = -OFFSET + 4 + random() * (2 * OFFSET - 8), r = Math.hypot(x, z);
    if (r < RING.wall + 7) continue;
    let corridor = false;
    for (const gate of openGates) {
      const c = Math.cos(gate.angle * DEG), s = Math.sin(gate.angle * DEG);
      if (x * c + z * s > 0 && Math.abs(-x * s + z * c) < 11) corridor = true;
    }
    if (corridor) continue;
    const roll = random();
    if (roll < 0.05) add(`forest/objects/Rock_1_${pick(['A', 'C', 'F', 'J', 'M'])}_Color1`, x, z, 2.5 + random() * 2.5, random() * 6, 'verde', { lift: -0.4 });
    else if (roll < 0.4) add(pick(['city/trees_A_large', 'city/trees_B_large', 'city/trees_A_medium', 'city/trees_B_medium']), x, z, 4 + random() * 1.5, random() * 6, 'verde', { lift: -0.2 });
    else if (roll < 0.6) add(pick(['forest/objects/Tree_1_A_Color1', 'forest/objects/Tree_2_A_Color1', 'forest/objects/Tree_4_A_Color1', 'forest/objects/Tree_3_B_Color1']), x, z, 1.5 + random() * 0.8, random() * 6, 'verde');
    else if (roll < 0.66) add(pick(['forest/objects/Bush_1_A_Color1', 'forest/objects/Bush_4_A_Color1']), x, z, 2.5 + random(), random() * 6, 'verde');
  }

  // --- Suelo: calles, pintura y explanadas ----------------------------------------------------
  for (let z = -OFFSET; z <= OFFSET; z++) for (let x = -OFFSET; x <= OFFSET; x++) {
    const i = index(x, z);
    if (island[i]) continue;
    const r = Math.hypot(x, z);
    if (r > RING.wall + 3) {
      terrain.paint[i] = mat(r > 262 ? 'forest' : 'meadow'); terrain.grass[i] = r > 262 ? 150 : 110;
    } else if (r > RING.wall - 3) { terrain.paint[i] = mat('dirt'); terrain.grass[i] = 20; }
    else { terrain.paint[i] = mat(distance[i] < 18 ? 'meadow' : 'grass'); terrain.grass[i] = distance[i] < 18 ? 90 : 60; }
    if (roadInfo[i] < 0) { terrain.paint[i] = roadMaterial[i]; terrain.grass[i] = 0; }
    else if (roadInfo[i] < 0.9) { terrain.paint[i] = mat('path'); terrain.grass[i] = 10; }
  }
  for (const item of paints) {
    for (let z = Math.ceil(item.z - item.radius); z <= item.z + item.radius; z++) for (let x = Math.ceil(item.x - item.radius); x <= item.x + item.radius; x++) {
      if (Math.abs(x) > OFFSET || Math.abs(z) > OFFSET || Math.hypot(x - item.x, z - item.z) > item.radius) continue;
      const i = index(x, z);
      if (island[i] || (roadInfo[i] < 0 && !item.force)) continue;
      terrain.paint[i] = item.material; terrain.grass[i] = item.grass;
    }
  }
  for (const item of pads) {
    const reach = item.radius + item.falloff;
    for (let z = Math.floor(item.z - reach); z <= Math.ceil(item.z + reach); z++) for (let x = Math.floor(item.x - reach); x <= Math.ceil(item.x + reach); x++) {
      if (Math.abs(x) > OFFSET || Math.abs(z) > OFFSET) continue;
      const i = index(x, z);
      if (island[i]) continue;
      const amount = 1 - smooth((Math.hypot(x - item.x, z - item.z) - item.radius) / item.falloff);
      terrain.heights[i] += (item.y - terrain.heights[i]) * amount;
    }
  }
  map.terrain = maps.encodeTerrain(terrain);
  for (const object of map.objects.slice(keptObjects)) {
    const { absolute } = object;
    delete object.absolute;
    if (!absolute) object.position[1] = rounded(height(object.position[0], object.position[2]) + object.position[1]);
  }

  // --- Lógica: barrios y puertas al continente -----------------------------------------------
  for (let k = 0; k < 6; k++) {
    const [x, z] = polar(187, 60 * k + 30);
    marker(`barrio_${k}`, 'zone', DISTRICTS[k], x, z, { radius: 62, text: DISTRICTS[k], color: '#7fb4e0' });
  }
  for (const gate of openGates) {
    const portal = map.markers.find(item => item.id === `salida_${gate.id}`);
    const arrival = map.markers.find(item => item.id === `llegada_${gate.id}`);
    assert.ok(portal && arrival, `Puerta ${gate.id}`);
    const [px, pz] = polar(RING.wall + 3.5, gate.angle), [ax, az] = polar(RING.ronda - 6, gate.angle);
    portal.position = [rounded(px), rounded(height(px, pz)), rounded(pz)];
    portal.radius = 3.6;
    portal.name = `${gate.name}: salida a Pompelín`;
    arrival.position = [rounded(ax), rounded(height(ax, az)), rounded(az)];
    arrival.rotationY = rounded(Math.atan2(ax, az));
  }
  for (const item of map.markers) if (item.id.startsWith(PREFIX)) item.position[1] = rounded(height(item.position[0], item.position[2]));
  map.description = 'Brumaluz, capital de Pompelín · 480 × 480 m. El casco antiguo, rodeado de jardines, es el corazón de una ciudad amurallada de seis barrios unidos por calles mayores, plazas, colinas, un estanque y casas gremiales; las puertas de la muralla exterior llevan al continente.';
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
    const count = asset => built.objects.filter(object => object.asset === asset).length;
    console.log(JSON.stringify({
      objects: built.objects.length, generated: built.objects.filter(object => object.id.startsWith(PREFIX)).length,
      markers: built.markers.length, houses: built.objects.filter(object => / · casa \d/.test(object.name ?? '')).length,
      towers: built.objects.filter(object => / · casa torre/.test(object.name ?? '')).length / 1, walls: count('city/wall_straight'),
    }, null, 2));
  } finally { await server.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
