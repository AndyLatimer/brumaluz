// Trazado de la Brumaluz procedural: casillas, calles, río, edificios, naturaleza y atrezo.
import * as THREE from 'three';
import { mulberry, DIRS, key, worldToHex, hexToWorld, BLOCK, PI, hexDist, SQ3, roadFor } from './hex';
import type { Placement, CityVendorSpot } from './types';

/** Mapa de la cabeza (parte de buildCity). */
export function layoutCity() {
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
    + 1.8 * Math.exp(-(((x + 40) / 25) ** 2 + ((z - 9) / 21) ** 2))
    + 1.5 * Math.exp(-(((x - 34) / 24) ** 2 + ((z + 29) / 20) ** 2));
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
    return { id, role, position: new THREE.Vector3(x, terrainHeightAtWorld(x, z), z), yaw: angle };
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
  return { place, rnd, nearestFoundation, grassTufts, flowers, terrainHeightAtWorld, parkBenches, tileType, R_LAND, vendorSpots, roads, liesOnRoad };
}
