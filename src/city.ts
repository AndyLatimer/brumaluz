import * as THREE from 'three';
import { loadGLB } from './load';
import cityUrl from './assets/models/city.glb?url';
import type { LocationId } from './data';

// ---------------------------------------------------------------------------
// Brumaluz: ciudad de casillas hexagonales con el pack "KayKit Medieval
// Hexagon" (Kay Lousberg, CC0). Cada pieza se instancia (una llamada de dibujo
// por tipo) y las calles se eligen y giran según qué vecinos son calle.
// ---------------------------------------------------------------------------

/** Escala de la maqueta: una casa pasa a medir ~3,7 m. */
export const S = 4;
const SQ3 = Math.sqrt(3);
const PI = Math.PI;

// Direcciones de los 6 bordes (ángulo k·60° en el plano XZ) en coordenadas axiales
const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
export function hexToWorld(q: number, r: number): THREE.Vector2 {
  return new THREE.Vector2((2 * q + r) * S, r * SQ3 * S);
}
export function worldToHex(x: number, z: number): [number, number] {
  const r = z / (SQ3 * S), q = (x / S - r) / 2;
  // redondeo cúbico
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - (-q - r));
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}
const key = (q: number, r: number) => q + ',' + r;
const hexDist = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

// Bordes con calle de cada pieza (bit k = borde a k·60°)
const ROADS: Record<string, string> = {
  hex_road_A: 'RGGRGG', hex_road_B: 'GGGRGR', hex_road_C: 'GGGRRG', hex_road_D: 'GRGRGR', hex_road_E: 'RGGRGR',
  hex_road_F: 'RRGRGG', hex_road_G: 'GGRRRG', hex_road_H: 'RGRRRG', hex_road_I: 'GRRGRR', hex_road_J: 'RRRRGG',
  hex_road_K: 'GRRRRR', hex_road_L: 'RRRRRR', hex_road_M: 'GGGRGG',
};
const mask = (s: string) => s.split('').reduce((m, c, i) => m | (c === 'R' ? 1 << i : 0), 0);
const rot = (m: number, k: number) => ((m << k) | (m >> (6 - k))) & 63;
/** Pieza y giro (en pasos de 60°) que conectan exactamente estos bordes. */
function roadFor(m: number): [string, number] {
  for (const [name, s] of Object.entries(ROADS)) for (let k = 0; k < 6; k++) if (rot(mask(s), k) === m) return [name, k];
  return ['hex_road_L', 0];
}

/** Radio de colisión (en metros) de cada pieza que bloquea el paso. */
const BLOCK: Record<string, number> = {
  home_A: 2.0, home_B: 2.0, tavern: 2.8, market: 2.8, blacksmith: 2.6, church: 2.8, castle: 5.2, well: 1.5,
  windmill: 2.6, watermill: 2.6, tower_A: 2.0, tower_B: 2.0, lumbermill: 2.8, barracks: 2.8, archeryrange: 2.8,
  wall_straight: 4.0,
  tree_single_A: 0.8, tree_single_B: 0.8, trees_A_large: 3.6, trees_A_medium: 3.2, trees_A_small: 2.6, trees_B_large: 3.6, trees_B_medium: 3.2,
  hills_A_trees: 4, hills_B_trees: 4, hills_C_trees: 4, hill_single_A: 2.4, hill_single_B: 2.4,
  mountain_A_grass_trees: 4, mountain_B_grass_trees: 4, mountain_C_grass: 4,
  rock_single_A: 0.6, rock_single_B: 0.6, barrel: 0.5, crate_A_big: 0.7, crate_long_A: 0.8, tent: 2, weaponrack: 0.8, wheelbarrow: 0.8, stage_A: 2.6,
};

interface Placement { model: string; x: number; z: number; ry: number; s?: number; y?: number }
interface Collider { x: number; z: number; r: number }
export interface CityVendorSpot {
  id: string;
  role: 'merchant' | 'innkeeper' | 'healer' | 'smith' | 'miller' | 'lumber';
  position: THREE.Vector3;
}

export interface City {
  root: THREE.Group;
  locationId: LocationId;
  /** Puntos despejados delante de los servicios, listos para alojar NPCs. */
  vendorSpots: CityVendorSpot[];
  /** Corrige un movimiento para no atravesar edificios ni agua. */
  collide(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3;
  groundY(x: number, z: number): number;
  spawn: THREE.Vector3;
  /** Ángulo desde el que la cámara del creador mira al personaje (el castillo queda de fondo). */
  spawnYaw: number;
  update(t: number, playerPosition?: THREE.Vector3): void;
}

export async function buildCity(): Promise<City> {
  const gltf = await loadGLB(cityUrl);
  const models = new Map<string, THREE.Object3D>();
  for (const c of gltf.scene.children) models.set(c.name, c);
  models.get('wall_straight_gate')?.traverse((part) => {
    if (part.name === 'wall_straight_gate_door_left' || part.name === 'wall_straight_gate_door_right') {
      part.rotation.y = PI / 2;
    }
  });

  // ---------- Mapa ----------
  const R_LAND = 11, R_WATER = 14;
  const rnd = mulberry(42);
  const roads = new Set<string>();
  const used = new Set<string>();
  const structureTiles = new Set<string>();
  const place: Placement[] = [];
  const tileType = new Map<string, string>();
  const foundations: { x: number; z: number; y: number; radius: number }[] = [];
  const roadMaskAt = (q: number, r: number) => {
    let roadMask = 0;
    for (let i = 0; i < DIRS.length; i++) {
      const next = key(q + DIRS[i][0], r + DIRS[i][1]);
      if (roads.has(next) || tileType.get(next) === 'river_cross') roadMask |= 1 << i;
    }
    return q === 0 && r === 0 ? 63 : roadMask;
  };
  const rawTerrainHeightAtWorld = (x: number, z: number) =>
    0.35 * Math.sin(x * 0.035) * Math.cos(z * 0.04)
    + 0.2 * Math.sin((x + z * 0.65) * 0.045)
    + 8 * Math.exp(-(((x + 40) / 25) ** 2 + ((z - 9) / 21) ** 2))
    + 6.8 * Math.exp(-(((x - 34) / 24) ** 2 + ((z + 29) / 20) ** 2));
  const nearestFoundation = (x: number, z: number) => {
    let nearest: typeof foundations[number] | undefined;
    let distance = Infinity;
    for (const foundation of foundations) {
      const d = Math.hypot(foundation.x - x, foundation.z - z);
      if (d < distance) { nearest = foundation; distance = d; }
    }
    return nearest;
  };
  const terrainHeightAtWorld = (x: number, z: number) => {
    const raw = rawTerrainHeightAtWorld(x, z);
    const [q, r] = worldToHex(x, z);
    const tileCenter = hexToWorld(q, r);
    const foundation = nearestFoundation(tileCenter.x, tileCenter.y);
    if (!foundation) return raw;
    const distance = Math.hypot(foundation.x - x, foundation.z - z);
    const t = THREE.MathUtils.clamp((distance - foundation.radius) / 1.5, 0, 1);
    const blend = t * t * (3 - 2 * t);
    return THREE.MathUtils.lerp(foundation.y, raw, blend);
  };
  const addFoundation = (model: string, q: number, r: number) => {
    const world = hexToWorld(q, r);
    const radius = Math.max(3.8, (BLOCK[model] ?? 2.4) + 1.2);
    foundations.push({ x: world.x, z: world.y, y: rawTerrainHeightAtWorld(world.x, world.y), radius });
    structureTiles.add(key(q, r));
  };
  const terrainHeightAt = (q: number, r: number) => {
    const world = hexToWorld(q, r);
    return terrainHeightAtWorld(world.x, world.y);
  };

  // Avenidas hasta las puertas exteriores y calles que conectan los barrios.
  for (const [dq, dr] of DIRS) for (let i = 0; i <= 10; i++) roads.add(key(dq * i, dr * i));
  for (const radius of [3, 4, 6, 8]) for (let k = 0; k < 6; k++) {
    const [aq, ar] = DIRS[k], [bq, br] = DIRS[(k + 2) % 6];
    for (let i = 0; i < radius; i++) roads.add(key(aq * radius + bq * i, ar * radius + br * i));
  }
  // El río cruza al sur (fila r = 6); la avenida lo salva con un vado/puente
  const riverR = 6;

  const P = (model: string, q: number, r: number, ry = 0, ox = 0, oz = 0, s = 1, y = terrainHeightAt(q, r)) => {
    const w = hexToWorld(q, r);
    place.push({ model, x: w.x + ox, y, z: w.y + oz, ry, s });
  };
  /** Gira una pieza para que su frente (+Z local) mire hacia el borde k. */
  const face = (k: number) => PI / 2 - (k * PI) / 3;
  /** Borde (0..5) que lleva a la calle más cercana. */
  const towardRoad = (q: number, r: number) => {
    for (let k = 0; k < 6; k++) if (roads.has(key(q + DIRS[k][0], r + DIRS[k][1]))) return k;
    const a = Math.atan2(-hexToWorld(q, r).y, -hexToWorld(q, r).x);
    return ((Math.round(a / (PI / 3)) % 6) + 6) % 6;
  };
  const building = (model: string, q: number, r: number, s = 1) => {
    if (used.has(key(q, r)) || roads.has(key(q, r))) return;
    used.add(key(q, r));
    addFoundation(model, q, r);
    P(model, q, r, face(towardRoad(q, r)), 0, 0, s);
  };

  // Plaza: fuente en el centro, puestos y faroles alrededor
  addFoundation('well', 0, 0);
  P('well', 0, 0, 0);
  used.add(key(0, 0));

  // Edificios principales en el anillo 2 (entre avenidas)
  const ring = (n: number) => {
    const out: [number, number][] = [];
    let q = DIRS[4][0] * n, r = DIRS[4][1] * n;
    for (let k = 0; k < 6; k++) for (let i = 0; i < n; i++) { out.push([q, r]); q += DIRS[k][0]; r += DIRS[k][1]; }
    return out;
  };
  const ring2 = ring(2).filter(([q, r]) => !roads.has(key(q, r)));
  ['tavern', 'market', 'church', 'blacksmith', 'home_A', 'home_B'].forEach((b, i) => building(b, ...ring2[i]));
  const castleCells: [number, number][] = [[0, -8], [1, -8], [-1, -7], [0, -7], [1, -9], [0, -9], [-1, -8]];
  for (const [q, r] of castleCells) {
    used.add(key(q, r));
    structureTiles.add(key(q, r));
  }
  // Barrios residenciales y pequeños servicios dentro del futuro recinto.
  for (const n of [3, 4, 5, 6, 7, 8]) for (const [q, r] of ring(n)) {
    if (roads.has(key(q, r)) || r >= riverR - 1 && r <= riverR) continue;
    const pick = rnd();
    if (n === 3) building(pick < 0.5 ? 'home_A' : 'home_B', q, r);
    else if (pick < 0.72) building(pick < 0.36 ? 'home_A' : 'home_B', q, r);
    else if (pick < 0.84) building(pick < 0.78 ? 'tower_A' : 'tower_B', q, r);
    else if (pick < 0.9) building(pick < 0.87 ? 'market' : 'blacksmith', q, r);
  }
  // Castillo al norte, al final de la avenida
  addFoundation('castle', 0, -8);
  P('castle', 0, -8, face(1), 0, 0, 1.15);
  roads.add(key(0, -7)); used.delete(key(0, -7));
  // Granja con molino al este
  building('windmill', 6, -1);
  for (const [q, r] of [[5, -2], [6, -2], [5, -1], [4, -2], [6, 0]] as [number, number][]) if (!used.has(key(q, r))) { used.add(key(q, r)); P('grain', q, r, 0); }
  building('lumbermill', -6, 1);
  building('barracks', -5, -3);
  building('archeryrange', -6, 0);

  // Río
  for (let q = -R_LAND - 6; q <= R_LAND + 6; q++) {
    const r = riverR;
    if (hexDist(q, r) > R_LAND) continue;
    const k = key(q, r);
    used.add(k);
    tileType.set(k, roads.has(k) ? 'river_cross' : 'river');
  }
  building('watermill', 1, riverR - 1);
  for (const q of [-5, -3, -2, 2, 3, 5]) {
    P(q % 2 ? 'waterlily_A' : 'waterplant_A', q, riverR, rnd() * PI * 2, (rnd() - 0.5) * 2.4, (rnd() - 0.5) * 2.4, 0.8 + rnd() * 0.4, 0);
  }

  const vendorSites: { id: string; role: CityVendorSpot['role']; model: string; cell: [number, number] }[] = [
    { id: 'market-merchant', role: 'merchant', model: 'market', cell: ring2[1] },
    { id: 'tavern-innkeeper', role: 'innkeeper', model: 'tavern', cell: ring2[0] },
    { id: 'church-healer', role: 'healer', model: 'church', cell: ring2[2] },
    { id: 'forge-smith', role: 'smith', model: 'blacksmith', cell: ring2[3] },
    { id: 'mill-miller', role: 'miller', model: 'windmill', cell: [6, -1] },
    { id: 'sawmill-lumber', role: 'lumber', model: 'lumbermill', cell: [-6, 1] },
  ];
  const vendorSpots = vendorSites.map(({ id, role, model, cell }) => {
    const [q, r] = cell;
    const center = hexToWorld(q, r);
    const angle = face(towardRoad(q, r));
    const distance = (BLOCK[model] ?? 2.8) + 1;
    const x = center.x + Math.sin(angle) * distance;
    const z = center.y + Math.cos(angle) * distance;
    return { id, role, position: new THREE.Vector3(x, terrainHeightAtWorld(x, z), z) };
  });

  // Muralla modular siguiendo cada borde exterior del anillo de casillas 9.
  // Las seis avenidas atraviesan el perímetro por una puerta abierta.
  const wallRadius = 9;
  const wallScale = 1 / SQ3;
  for (let q = -wallRadius; q <= wallRadius; q++) for (let r = -wallRadius; r <= wallRadius; r++) {
    if (hexDist(q, r) !== wallRadius) continue;
    const inside = hexToWorld(q, r);
    for (let k = 0; k < DIRS.length; k++) {
      const [dq, dr] = DIRS[k];
      if (hexDist(q + dq, r + dr) !== wallRadius + 1) continue;
      const [gq, gr] = DIRS[k];
      const gate = q === gq * wallRadius && r === gr * wallRadius;
      const outside = hexToWorld(q + dq, r + dr);
      const dx = outside.x - inside.x, dz = outside.y - inside.y;
      const angle = Math.atan2(-dx, -dz);
      P(gate ? 'wall_straight_gate' : 'wall_straight',
        q, r, angle, dx / 2, dz / 2, wallScale);
    }
    used.add(key(q, r));
    structureTiles.add(key(q, r));
  }

  // Naturaleza fuera de la ciudad
  for (let q = -R_WATER; q <= R_WATER; q++) for (let r = -R_WATER; r <= R_WATER; r++) {
    const d = hexDist(q, r);
    if (d > R_WATER) continue;
    const k = key(q, r);
    if (d > R_LAND) { tileType.set(k, 'water'); continue; }
    if (used.has(k) || roads.has(k)) continue;
    if (d >= 10) {
      const p = rnd();
      used.add(k);
      if (d >= 11 && p < 0.55) P(['mountain_A_grass_trees', 'mountain_B_grass_trees', 'hills_A_trees', 'hills_B_trees'][Math.floor(rnd() * 4)], q, r, Math.floor(rnd() * 6) * PI / 3);
      else if (p < 0.8) P(['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'][Math.floor(rnd() * 4)], q, r, Math.floor(rnd() * 6) * PI / 3);
      else P(['hill_single_A', 'hill_single_B', 'hills_C_trees'][Math.floor(rnd() * 3)], q, r, rnd() * 6);
    } else if (d >= 7 && rnd() < 0.45) {
      used.add(k);
      P(['trees_A_small', 'trees_A_medium', 'trees_B_medium'][Math.floor(rnd() * 3)], q, r, Math.floor(rnd() * 6) * PI / 3);
    } else if (rnd() < 0.18) {
      P(['rock_single_A', 'rock_single_B', 'tree_single_A', 'tree_single_B'][Math.floor(rnd() * 4)], q, r, rnd() * 6, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3);
    }
  }

  // Hierba poligonal por parcelas, incluidos los islotes verdes de las calles.
  const grassTufts: { x: number; y: number; z: number; ry: number; s: number }[] = [];
  const flowers: { x: number; y: number; z: number; hue: number }[] = [];
  const parkBenches: { x: number; y: number; z: number; ry: number }[] = [];
  const grassObstacles = place.filter((p) => BLOCK[p.model] !== undefined);
  const liesOnRoad = (x: number, z: number, q: number, r: number) => {
    const dx = x - hexToWorld(q, r).x, dz = z - hexToWorld(q, r).y;
    const roadMask = roadMaskAt(q, r);
    for (let i = 0; i < DIRS.length; i++) {
      if (!(roadMask & (1 << i))) continue;
      const edge = hexToWorld(DIRS[i][0], DIRS[i][1]);
      const edgeLengthSq = edge.lengthSq();
      const along = THREE.MathUtils.clamp((dx * edge.x + dz * edge.y) / edgeLengthSq, 0, 1);
      const distance = Math.hypot(dx - edge.x * along, dz - edge.y * along);
      if (distance < 2) return true;
    }
    return false;
  };
  for (let q = -R_LAND; q <= R_LAND; q++) for (let r = -R_LAND; r <= R_LAND; r++) {
    const k = key(q, r);
    const isRoad = roads.has(k);
    if (hexDist(q, r) > R_LAND || tileType.has(k) || !isRoad && used.has(k) && !structureTiles.has(k)) continue;
    const center = hexToWorld(q, r);
    if (!isRoad && hexDist(q, r) >= 3 && hexDist(q, r) <= 8 && parkBenches.length < 10
      && rnd() < 0.12
      && grassObstacles.every((obstacle) => Math.hypot(obstacle.x - center.x, obstacle.z - center.y) > BLOCK[obstacle.model] + 2)
      && parkBenches.every((bench) => Math.hypot(bench.x - center.x, bench.z - center.y) > 15)) {
      parkBenches.push({ x: center.x, y: terrainHeightAtWorld(center.x, center.y) + 0.08, z: center.y, ry: rnd() * PI });
    }
    const count = isRoad ? 52 + Math.floor(rnd() * 19) : structureTiles.has(k) ? 96 : 180 + Math.floor(rnd() * 61);
    let placed = 0;
    for (let attempt = 0; attempt < count * 5 && placed < count; attempt++) {
      let oq = (rnd() - 0.5) * 1.86, or = (rnd() - 0.5) * 1.86;
      if (Math.abs(oq) > 0.9 || Math.abs(or) > 0.9 || Math.abs(oq + or) > 0.9) continue;
      const offset = hexToWorld(oq, or);
      const x = center.x + offset.x, z = center.y + offset.y;
      const [candidateQ, candidateR] = worldToHex(x, z);
      const candidateKey = key(candidateQ, candidateR);
      if (hexDist(candidateQ, candidateR) > R_LAND || tileType.has(candidateKey)
        || (isRoad ? !roads.has(candidateKey) || liesOnRoad(x, z, q, r) : roads.has(candidateKey))) continue;
      if (grassObstacles.some((obstacle) =>
        Math.hypot(obstacle.x - x, obstacle.z - z) < BLOCK[obstacle.model] + 1.3)) continue;
      if (parkBenches.some((bench) => Math.hypot(bench.x - x, bench.z - z) < 1.4)) continue;
      const y = terrainHeightAtWorld(x, z);
      grassTufts.push({ x, y: y + 0.18, z, ry: rnd() * PI, s: 0.9 + rnd() * 0.5 });
      if (rnd() < (isRoad ? 0.06 : 0.05)) flowers.push({ x, y: y + 0.18, z, hue: rnd() });
      placed++;
    }
  }

  // Suelo: calles según vecinos, río, agua y hierba
  for (let q = -R_WATER; q <= R_WATER; q++) for (let r = -R_WATER; r <= R_WATER; r++) {
    if (hexDist(q, r) > R_WATER) continue;
    const k = key(q, r);
    const t = tileType.get(k);
    if (t === 'water') { P('hex_water', q, r, 0, 0, 0, 1, -0.55); continue; }
    if (t === 'river') { P('hex_river_A', q, r, 0, 0, 0, 1, 0); continue; }
    if (t === 'river_cross') {
      // el vado tiene el agua en los bordes 0/3 y el camino en 1/4
      P('hex_river_crossing_A', q, r, 0, 0, 0, 1, 0);
      continue;
    }
    if (roads.has(k)) {
      let m = 0;
      for (let i = 0; i < 6; i++) {
        const nk = key(q + DIRS[i][0], r + DIRS[i][1]);
        if (roads.has(nk) || tileType.get(nk) === 'river_cross') m |= 1 << i;
      }
      if (k === key(0, 0)) m = 63;
      const [name, steps] = roadFor(m || 1);
      P(name, q, r, -(steps * PI) / 3, 0, 0, 1, 0);
      continue;
    }
    P('hex_grass', q, r, 0, 0, 0, 1, 0);
  }

  // Atrezo en la plaza y junto a los edificios
  const props: [string, number, number, number][] = [
    ['barrel', 5.5, 3.2, 0], ['barrel', 6.2, 2.4, 1], ['crate_A_big', -5.8, 3, 0.4], ['crate_A_small', -6.6, 2.2, 0.9], ['sack', -5, 4, 0],
    ['wheelbarrow', 3.5, -6.2, 2.2], ['flag_blue', -3.2, -6, 0], ['flag_red', 3.2, 6.4, 0], ['bucket_water', 1.8, -1.8, 0],
    ['tent', 13, 9, 2.5], ['crate_long_A', 12, 2, 1.2], ['resource_lumber', -16, 4.8, 0.3], ['target', -15, 1, 1.6],
    ['stage_A', -3.6, 21.5, 0],
  ];
  for (const [m, x, z, ry] of props) place.push({ model: m, x, y: terrainHeightAtWorld(x, z), z, ry });
  const shopfrontCargo: [number, string, number][] = [
    [0, 'crate_A_big', -2], [0, 'barrel', 2], [0, 'flag_yellow', -3.1],
    [1, 'barrel', -2], [1, 'sack', 2], [1, 'flag_red', 3.1],
    [2, 'flag_blue', -2.8],
    [3, 'resource_stone', -2], [3, 'barrel', 2],
    [4, 'crate_long_A', -2], [4, 'sack', 2],
    [5, 'resource_lumber', -2], [5, 'crate_A_small', 2],
  ];
  for (const [siteIndex, model, lateralOffset] of shopfrontCargo) {
    const site = vendorSites[siteIndex];
    const spot = vendorSpots[siteIndex].position;
    const center = hexToWorld(site.cell[0], site.cell[1]);
    const forward = new THREE.Vector2(spot.x - center.x, spot.z - center.y).normalize();
    const x = spot.x - forward.y * lateralOffset;
    const z = spot.z + forward.x * lateralOffset;
    place.push({ model, x, y: terrainHeightAtWorld(x, z), z, ry: face(towardRoad(...site.cell)) });
  }

  // ---------- Instanciado ----------
  const root = new THREE.Group();
  const groups = new Map<string, Placement[]>();
  for (const p of place) {
    if (!models.has(p.model)) continue;
    (groups.get(p.model) ?? groups.set(p.model, []).get(p.model)!).push(p);
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
  const material = (gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh).material as THREE.MeshStandardMaterial;
  material.roughness = 0.85;
  const windmillFans: THREE.Object3D[] = [];
  const wavingFlags: { object: THREE.Object3D; yaw: number; phase: number }[] = [];
  const grassWindTime = { value: 0 };
  const terrainMaterial = (source: THREE.Material, greenGround = false): THREE.Material => {
    const terrain = source.clone();
    if (greenGround && terrain instanceof THREE.MeshStandardMaterial) terrain.color.set('#8aca78');
    terrain.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (diffuseColor.r > 0.18 && diffuseColor.g > diffuseColor.r * 0.72 && diffuseColor.b < diffuseColor.r * 0.52) {
          diffuseColor.rgb *= vec3(0.78, 1.08, 0.75);
        }`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        #ifdef USE_INSTANCING
          attribute vec4 cityFoundation;
        #endif
        float brumaluzTerrainHeight(vec2 p) {
          return 0.35 * sin(p.x * 0.035) * cos(p.y * 0.04)
            + 0.2 * sin((p.x + p.y * 0.65) * 0.045)
            + 8.0 * exp(-pow((p.x + 40.0) / 25.0, 2.0) - pow((p.y - 9.0) / 21.0, 2.0))
            + 6.8 * exp(-pow((p.x - 34.0) / 24.0, 2.0) - pow((p.y + 29.0) / 20.0, 2.0));
        }`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          mat4 cityWorldMatrix = modelMatrix * instanceMatrix;
          vec4 cityWorldPosition = cityWorldMatrix * vec4(transformed, 1.0);
          float cityHeight = brumaluzTerrainHeight(cityWorldPosition.xz);
          if (cityFoundation.w >= 0.0) {
            float foundationDistance = distance(cityWorldPosition.xz, cityFoundation.xy);
            float foundationBlend = 1.0 - smoothstep(cityFoundation.w, cityFoundation.w + 1.5, foundationDistance);
            cityHeight = mix(cityHeight, cityFoundation.z, foundationBlend);
          }
          transformed.y += cityHeight / cityWorldMatrix[1][1];
        #endif`,
      );
    };
    terrain.customProgramCacheKey = () => 'brumaluz-terrain-height-v2';
    return terrain;
  };
  for (const [name, ps] of groups) {
    const model = models.get(name)!;
    if (name === 'windmill' || name.startsWith('flag_')) {
      for (const p of ps) {
        const prop = model.clone(true);
        prop.position.set(p.x, p.y ?? 0, p.z);
        prop.rotation.y = p.ry;
        prop.scale.setScalar(S * (p.s ?? 1));
        prop.traverse((part) => {
          if ((part as THREE.Mesh).isMesh) {
            (part as THREE.Mesh).castShadow = true;
            (part as THREE.Mesh).receiveShadow = true;
          }
        });
        if (name === 'windmill') {
          const fan = prop.getObjectByName('building_windmill_top_fan_blue');
          if (fan) windmillFans.push(fan);
        } else {
          wavingFlags.push({ object: prop, yaw: p.ry, phase: rnd() * PI * 2 });
        }
        root.add(prop);
      }
      continue;
    }
    const isTile = name.startsWith('hex_');
    const raisedTerrain = isTile && name !== 'hex_water';
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const local = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
      const geometry = raisedTerrain ? mesh.geometry.clone() : mesh.geometry;
      if (raisedTerrain) {
        const foundationData = new Float32Array(ps.length * 4);
        ps.forEach((p, i) => {
          const foundation = nearestFoundation(p.x, p.z);
          if (foundation) {
            foundationData.set([foundation.x, foundation.z, foundation.y, foundation.radius], i * 4);
          } else {
            foundationData.set([0, 0, 0, -1], i * 4);
          }
        });
        geometry.setAttribute('cityFoundation', new THREE.InstancedBufferAttribute(foundationData, 4));
      }
      const tileMaterial = (source: THREE.Material | THREE.Material[]) => {
        if (!raisedTerrain) return source;
        return Array.isArray(source)
          ? source.map((item) => terrainMaterial(item, name === 'hex_grass'))
          : terrainMaterial(source, name === 'hex_grass');
      };
      const im = new THREE.InstancedMesh(geometry, tileMaterial(mesh.material), ps.length);
      ps.forEach((p, i) => {
        q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
        if (isTile) s4.set(S, S * 0.28, S);
        else s4.setScalar(S * (p.s ?? 1));
        p4.set(p.x, p.y ?? 0, p.z);
        m4.compose(p4, q4, s4).multiply(local);
        im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere();
      im.receiveShadow = true;
      im.castShadow = !isTile;
      im.name = name;
      root.add(im);
    });
  }

  let grassMesh: THREE.InstancedMesh | undefined;
  if (grassTufts.length) {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const blades = [
      { angle: 0, width: 0.09, height: 0.78, color: new THREE.Color('#547f35') },
      { angle: PI / 3, width: 0.08, height: 1.02, color: new THREE.Color('#78a943') },
      { angle: (PI * 2) / 3, width: 0.09, height: 0.68, color: new THREE.Color('#68983c') },
      { angle: PI / 6, width: 0.075, height: 0.9, color: new THREE.Color('#8ab94d') },
      { angle: (PI * 5) / 6, width: 0.08, height: 0.72, color: new THREE.Color('#5f8e37') },
      { angle: PI, width: 0.08, height: 0.86, color: new THREE.Color('#6b9e3e') },
    ];
    for (const [i, blade] of blades.entries()) {
      const sideX = Math.cos(blade.angle) * blade.width / 2;
      const sideZ = Math.sin(blade.angle) * blade.width / 2;
      const leanX = Math.cos(blade.angle + PI / 2) * blade.width * 0.4;
      const leanZ = Math.sin(blade.angle + PI / 2) * blade.width * 0.4;
      const rootX = Math.cos(blade.angle) * 0.07;
      const rootZ = Math.sin(blade.angle) * 0.07;
      const vertex = i * 5;
      positions.push(
        rootX - sideX, 0, rootZ - sideZ,
        rootX + sideX, 0, rootZ + sideZ,
        rootX - sideX * 0.62 + leanX, blade.height * 0.55, rootZ - sideZ * 0.62 + leanZ,
        rootX + sideX * 0.62 + leanX, blade.height * 0.55, rootZ + sideZ * 0.62 + leanZ,
        rootX + leanX * 2, blade.height, rootZ + leanZ * 2,
      );
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3, vertex + 2, vertex + 4, vertex + 3);
      for (let j = 0; j < 5; j++) colors.push(blade.color.r, blade.color.g, blade.color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const grassMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    });
    grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.cityWindTime = grassWindTime;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float cityWindTime;`,
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float cityBladePhase = cityWindTime * 1.3 + instanceMatrix[3].x * 0.27 + instanceMatrix[3].z * 0.31;
          float cityBladeHeight = clamp(transformed.y, 0.0, 1.0);
          transformed.x += sin(cityBladePhase + cityBladeHeight * 1.4) * 0.045 * cityBladeHeight;
          transformed.z += cos(cityBladePhase + cityBladeHeight * 1.1) * 0.025 * cityBladeHeight;
        #endif`,
      );
    };
    grassMaterial.customProgramCacheKey = () => 'brumaluz-grass-wind-v1';
    grassMesh = new THREE.InstancedMesh(geometry, grassMaterial, grassTufts.length);
    grassTufts.forEach((tuft, i) => {
      q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tuft.ry);
      s4.setScalar(tuft.s);
      p4.set(tuft.x, tuft.y, tuft.z);
      grassMesh!.setMatrixAt(i, m4.compose(p4, q4, s4));
    });
    grassMesh.receiveShadow = true;
    grassMesh.name = 'grass_tufts';
    root.add(grassMesh);
  }
  const grassUp = new THREE.Vector3(0, 1, 0);
  const blooms = flowers.flatMap((flower) =>
    [[-0.14, 0.02], [0.13, 0.08], [0.02, -0.16]].map(([dx, dz]) => {
      const x = flower.x + dx, z = flower.z + dz;
      return { x, y: terrainHeightAtWorld(x, z) + 0.18, z, hue: flower.hue };
    }));
  if (blooms.length) {
    const stemGeometry = new THREE.CylinderGeometry(0.018, 0.035, 0.3, 5);
    const petalGeometry = new THREE.SphereGeometry(1, 6, 4);
    const centerGeometry = new THREE.SphereGeometry(0.055, 6, 4);
    const stems = new THREE.InstancedMesh(stemGeometry, new THREE.MeshStandardMaterial({ color: '#64843d', roughness: 1 }), blooms.length);
    const petals = new THREE.InstancedMesh(petalGeometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), blooms.length * 5);
    const centers = new THREE.InstancedMesh(centerGeometry, new THREE.MeshStandardMaterial({ color: '#806548', roughness: 0.85 }), blooms.length);
    const flowerMatrix = new THREE.Matrix4();
    const flowerPosition = new THREE.Vector3();
    const flowerRotation = new THREE.Quaternion();
    const flowerScale = new THREE.Vector3(1, 1, 1);
    const palette = ['#d3a0a0', '#9c8bb2', '#e3ddd1', '#91a8a2'].map((color) => new THREE.Color(color));
    blooms.forEach((flower, i) => {
      flowerRotation.identity();
      flowerPosition.set(flower.x, flower.y + 0.15, flower.z);
      stems.setMatrixAt(i, flowerMatrix.compose(flowerPosition, flowerRotation, flowerScale));
      const petalColor = palette[Math.min(palette.length - 1, Math.floor(flower.hue * palette.length))];
      for (let j = 0; j < 5; j++) {
        const angle = j * PI * 2 / 5;
        flowerPosition.set(flower.x + Math.cos(angle) * 0.065, flower.y + 0.3, flower.z + Math.sin(angle) * 0.065);
        flowerRotation.setFromAxisAngle(grassUp, angle);
        flowerScale.set(0.075, 0.04, 0.052);
        petals.setMatrixAt(i * 5 + j, flowerMatrix.compose(flowerPosition, flowerRotation, flowerScale));
        petals.setColorAt(i * 5 + j, petalColor);
      }
      flowerPosition.set(flower.x, flower.y + 0.3, flower.z);
      flowerRotation.identity();
      flowerScale.set(1, 1, 1);
      centers.setMatrixAt(i, flowerMatrix.compose(flowerPosition, flowerRotation, flowerScale));
    });
    stems.name = 'wildflower_stems';
    petals.name = 'wildflower_petals';
    centers.name = 'wildflower_centers';
    for (const mesh of [stems, petals, centers]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  }
  if (parkBenches.length) {
    const benchParts = [
      { geometry: new THREE.BoxGeometry(1.45, 0.12, 0.42), offsets: [{ x: 0, y: 0.58, z: 0 }], color: '#795338' },
      { geometry: new THREE.BoxGeometry(1.45, 0.42, 0.1), offsets: [{ x: 0, y: 0.88, z: -0.16 }], color: '#8a6040' },
      { geometry: new THREE.BoxGeometry(0.1, 0.48, 0.1), offsets: [-0.58, 0.58].flatMap((x) => [-0.14, 0.14].map((z) => ({ x, y: 0.27, z }))), color: '#55402f' },
    ];
    for (const [partIndex, part] of benchParts.entries()) {
      const mesh = new THREE.InstancedMesh(
        part.geometry,
        new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.95 }),
        parkBenches.length * part.offsets.length,
      );
      parkBenches.forEach((bench, i) => {
        const rotation = new THREE.Quaternion().setFromAxisAngle(grassUp, bench.ry);
        for (const [offsetIndex, offset] of part.offsets.entries()) {
          const local = new THREE.Vector3(offset.x, 0, offset.z).applyAxisAngle(grassUp, bench.ry);
          const position = new THREE.Vector3(bench.x + local.x, bench.y + offset.y, bench.z + local.z);
          mesh.setMatrixAt(i * part.offsets.length + offsetIndex, new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1)));
        }
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `park_bench_${partIndex}`;
      root.add(mesh);
    }
  }
  const grassBucketSize = 4;
  const grassBucketKey = (x: number, z: number) => `${Math.floor(x / grassBucketSize)},${Math.floor(z / grassBucketSize)}`;
  const grassBuckets = new Map<string, number[]>();
  grassTufts.forEach((tuft, i) => {
    const bucket = grassBucketKey(tuft.x, tuft.z);
    (grassBuckets.get(bucket) ?? grassBuckets.set(bucket, []).get(bucket)!).push(i);
  });
  let bentGrassIndices = new Set<number>();
  const grassDirection = new THREE.Vector3();
  const grassTilt = new THREE.Quaternion();
  const grassYaw = new THREE.Quaternion();
  const grassPosition = new THREE.Vector3();
  const grassScale = new THREE.Vector3();
  const grassMatrix = new THREE.Matrix4();

  // ---------- Colisiones ----------
  const colliders: Collider[] = [];
  for (const p of place) {
    const r = BLOCK[p.model];
    if (r) colliders.push({ x: p.x, z: p.z, r: r * (p.s ?? 1) });
  }
  for (const bench of parkBenches) colliders.push({ x: bench.x, z: bench.z, r: 0.9 });
  const blockedTile = (x: number, z: number) => {
    const [q, r] = worldToHex(x, z);
    const t = tileType.get(key(q, r));
    return hexDist(q, r) > R_LAND || t === 'water' || t === 'river';
  };
  const ME = 0.45; // radio del personaje
  const collide = (from: THREE.Vector3, to: THREE.Vector3) => {
    const out = to.clone();
    for (let it = 0; it < 2; it++) for (const c of colliders) {
      const dx = out.x - c.x, dz = out.z - c.z, d = Math.hypot(dx, dz), min = c.r + ME;
      if (d < min && d > 1e-4) { out.x = c.x + (dx / d) * min; out.z = c.z + (dz / d) * min; }
    }
    const steepStep = Math.abs(terrainHeightAtWorld(out.x, out.z) - terrainHeightAtWorld(from.x, from.z)) > 0.55;
    if (blockedTile(out.x, out.z) || steepStep) {
      // deslizar por el eje que sí está libre
      if (!blockedTile(out.x, from.z) && Math.abs(terrainHeightAtWorld(out.x, from.z) - terrainHeightAtWorld(from.x, from.z)) <= 0.55) out.z = from.z;
      else {
        if (!blockedTile(from.x, out.z) && Math.abs(terrainHeightAtWorld(from.x, out.z) - terrainHeightAtWorld(from.x, from.z)) <= 0.55) out.x = from.x;
        else { out.x = from.x; out.z = from.z; }
      }
    }
    return out;
  };
  const groundY = (x: number, z: number) => {
    return terrainHeightAtWorld(x, z);
  };

  // Nubes a la deriva
  const clouds: THREE.Object3D[] = [];
  const cloudModel = models.get('cloud_big');
  if (cloudModel) for (let i = 0; i < 10; i++) {
    const c = cloudModel.clone(true);
    const a = rnd() * PI * 2, d = 60 + rnd() * 80;
    c.position.set(Math.cos(a) * d, 28 + rnd() * 18, Math.sin(a) * d);
    c.scale.setScalar(S * (2 + rnd() * 2));
    c.rotation.y = rnd() * 6;
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: '#fff4ea', roughness: 1, emissive: '#ffd8c0', emissiveIntensity: 0.25 }); });
    root.add(c);
    clouds.push(c);
  }

  return {
    root,
    locationId: 'brumaluz',
    vendorSpots,
    collide,
    groundY,
    spawn: (() => { const w = hexToWorld(0, -1.6); return new THREE.Vector3(w.x, groundY(w.x, w.y), w.y); })(),
    spawnYaw: Math.atan2(0.5, SQ3 / 2),
    update(t: number, playerPosition?: THREE.Vector3) {
      clouds.forEach((c, i) => { c.position.x += Math.sin(i) * 0.004; c.rotation.y = t * 0.003 + i; });
      windmillFans.forEach((fan, i) => { fan.rotation.z = t * 0.8 + i; });
      wavingFlags.forEach((flag) => { flag.object.rotation.y = flag.yaw + Math.sin(t * 1.4 + flag.phase) * 0.05; });
      grassWindTime.value = t;
      if (grassMesh) {
        let updatedGrass = false;
        const candidates = new Set(bentGrassIndices);
        if (playerPosition) {
          const bx = Math.floor(playerPosition.x / grassBucketSize), bz = Math.floor(playerPosition.z / grassBucketSize);
          for (let x = bx - 1; x <= bx + 1; x++) for (let z = bz - 1; z <= bz + 1; z++) {
            for (const i of grassBuckets.get(`${x},${z}`) ?? []) candidates.add(i);
          }
        }
        const newlyBent = new Set<number>();
        for (const i of candidates) {
          const tuft = grassTufts[i];
          const dx = playerPosition ? tuft.x - playerPosition.x : 0;
          const dz = playerPosition ? tuft.z - playerPosition.z : 0;
          const distance = Math.hypot(dx, dz);
          const bend = playerPosition ? Math.max(0, 1 - distance / 3.4) * 1.25 : 0;
          if (bend === 0 && !bentGrassIndices.has(i)) continue;
          grassYaw.setFromAxisAngle(grassUp, tuft.ry);
          if (bend > 0) {
            const localAngle = Math.atan2(dz, dx) - tuft.ry;
            grassDirection.set(Math.cos(localAngle) * Math.sin(bend), Math.cos(bend), Math.sin(localAngle) * Math.sin(bend));
            grassTilt.setFromUnitVectors(grassUp, grassDirection);
            grassYaw.multiply(grassTilt);
          }
          grassPosition.set(tuft.x, tuft.y, tuft.z);
          grassScale.setScalar(tuft.s);
          grassMesh.setMatrixAt(i, grassMatrix.compose(grassPosition, grassYaw, grassScale));
          if (bend > 0) newlyBent.add(i);
          updatedGrass = true;
        }
        bentGrassIndices = newlyBent;
        if (updatedGrass) grassMesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
