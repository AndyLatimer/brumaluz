import * as THREE from 'three';
import { loadGLB } from './load';
import cityUrl from './assets/models/city.glb?url';

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
  tree_single_A: 0.8, tree_single_B: 0.8, trees_A_large: 3.6, trees_A_medium: 3.2, trees_A_small: 2.6, trees_B_large: 3.6, trees_B_medium: 3.2,
  hills_A_trees: 4, hills_B_trees: 4, hills_C_trees: 4, hill_single_A: 2.4, hill_single_B: 2.4,
  mountain_A_grass_trees: 4, mountain_B_grass_trees: 4, mountain_C_grass: 4,
  rock_single_A: 0.6, rock_single_B: 0.6, barrel: 0.5, crate_A_big: 0.7, crate_long_A: 0.8, tent: 2, weaponrack: 0.8, wheelbarrow: 0.8, stage_A: 2.6,
};

interface Placement { model: string; x: number; z: number; ry: number; s?: number; y?: number }
interface Collider { x: number; z: number; r: number }

export interface City {
  root: THREE.Group;
  /** Corrige un movimiento para no atravesar edificios ni agua. */
  collide(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3;
  groundY(x: number, z: number): number;
  spawn: THREE.Vector3;
  /** Ángulo desde el que la cámara del creador mira al personaje (el castillo queda de fondo). */
  spawnYaw: number;
  update(t: number): void;
}

export async function buildCity(): Promise<City> {
  const gltf = await loadGLB(cityUrl);
  const models = new Map<string, THREE.Object3D>();
  for (const c of gltf.scene.children) models.set(c.name, c);

  // ---------- Mapa ----------
  const R_LAND = 11, R_WATER = 14;
  const rnd = mulberry(42);
  const roads = new Set<string>();
  const used = new Set<string>();
  const place: Placement[] = [];
  const tileType = new Map<string, string>();

  // Avenidas en las 3 direcciones principales, más un anillo de calles
  for (const [dq, dr] of DIRS) for (let i = 0; i <= 6; i++) roads.add(key(dq * i, dr * i));
  for (let k = 0; k < 6; k++) {
    const [aq, ar] = DIRS[k], [bq, br] = DIRS[(k + 2) % 6];
    for (let i = 0; i < 3; i++) roads.add(key(aq * 3 + bq * i, ar * 3 + br * i));
  }
  // El río cruza al sur (fila r = 6); la avenida lo salva con un vado/puente
  const riverR = 6;

  const P = (model: string, q: number, r: number, ry = 0, ox = 0, oz = 0, s = 1) => {
    const w = hexToWorld(q, r);
    place.push({ model, x: w.x + ox, z: w.y + oz, ry, s });
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
    P(model, q, r, face(towardRoad(q, r)), 0, 0, s);
  };

  // Plaza: fuente en el centro, puestos y faroles alrededor
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
  // Barrio de casas en los anillos 3-5
  for (const n of [3, 4, 5]) for (const [q, r] of ring(n)) {
    if (roads.has(key(q, r)) || r >= riverR - 1 && r <= riverR) continue;
    const pick = rnd();
    if (n === 3) building(pick < 0.5 ? 'home_A' : 'home_B', q, r);
    else if (pick < 0.55) building(pick < 0.28 ? 'home_A' : 'home_B', q, r);
    else if (pick < 0.65) building('tower_A', q, r);
    else if (pick < 0.75) { used.add(key(q, r)); P('tree_single_A', q, r, rnd() * 6, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3); P('tree_single_B', q, r, rnd() * 6, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3); }
  }
  // Castillo al norte, al final de la avenida
  for (const [q, r] of [[0, -8], [1, -8], [-1, -7], [0, -7], [1, -9], [0, -9], [-1, -8]] as [number, number][]) used.add(key(q, r));
  P('castle', 0, -8, face(1), 0, 0, 1.15);
  roads.add(key(0, -7)); used.delete(key(0, -7));
  // Granja con molino al este
  building('windmill', 7, -2);
  for (const [q, r] of [[8, -3], [8, -2], [7, -1], [6, -3], [9, -3]] as [number, number][]) if (!used.has(key(q, r))) { used.add(key(q, r)); P('grain', q, r, 0); }
  building('lumbermill', -7, 2);
  building('barracks', -5, -3);
  building('archeryrange', -7, 0);

  // Río
  for (let q = -R_LAND - 6; q <= R_LAND + 6; q++) {
    const r = riverR;
    if (hexDist(q, r) > R_LAND) continue;
    const k = key(q, r);
    used.add(k);
    tileType.set(k, roads.has(k) ? 'river_cross' : 'river');
  }
  building('watermill', 2, riverR - 1);

  // Naturaleza fuera de la ciudad
  for (let q = -R_WATER; q <= R_WATER; q++) for (let r = -R_WATER; r <= R_WATER; r++) {
    const d = hexDist(q, r);
    if (d > R_WATER) continue;
    const k = key(q, r);
    if (d > R_LAND) { tileType.set(k, 'water'); continue; }
    if (used.has(k) || roads.has(k)) continue;
    if (d >= 9) {
      const p = rnd();
      used.add(k);
      if (d >= 10 && p < 0.55) P(['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass', 'hills_A_trees', 'hills_B_trees'][Math.floor(rnd() * 5)], q, r, Math.floor(rnd() * 6) * PI / 3);
      else if (p < 0.8) P(['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'][Math.floor(rnd() * 4)], q, r, Math.floor(rnd() * 6) * PI / 3);
      else P(['hill_single_A', 'hill_single_B', 'hills_C_trees'][Math.floor(rnd() * 3)], q, r, rnd() * 6);
    } else if (d >= 7 && rnd() < 0.45) {
      used.add(k);
      P(['trees_A_small', 'trees_A_medium', 'trees_B_medium'][Math.floor(rnd() * 3)], q, r, Math.floor(rnd() * 6) * PI / 3);
    } else if (rnd() < 0.18) {
      P(['rock_single_A', 'rock_single_B', 'tree_single_A', 'tree_single_B'][Math.floor(rnd() * 4)], q, r, rnd() * 6, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3);
    }
  }

  // Suelo: calles según vecinos, río, agua y hierba
  for (let q = -R_WATER; q <= R_WATER; q++) for (let r = -R_WATER; r <= R_WATER; r++) {
    if (hexDist(q, r) > R_WATER) continue;
    const k = key(q, r);
    const t = tileType.get(k);
    if (t === 'water') { P('hex_water', q, r, 0); continue; }
    if (t === 'river') { P('hex_river_A', q, r, 0); continue; }
    if (t === 'river_cross') {
      // el vado tiene el agua en los bordes 0/3 y el camino en 1/4
      P('hex_river_crossing_A', q, r, 0);
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
      P(name, q, r, -(steps * PI) / 3);
      continue;
    }
    P('hex_grass', q, r, 0);
  }

  // Atrezo en la plaza y junto a los edificios
  const props: [string, number, number, number][] = [
    ['barrel', 5.5, 3.2, 0], ['barrel', 6.2, 2.4, 1], ['crate_A_big', -5.8, 3, 0.4], ['crate_A_small', -6.6, 2.2, 0.9], ['sack', -5, 4, 0],
    ['wheelbarrow', 3.5, -6.2, 2.2], ['flag_blue', -3.2, -6, 0], ['flag_red', 3.2, 6.4, 0], ['bucket_water', 1.8, -1.8, 0],
    ['tent', 13, 9, 2.5], ['crate_long_A', 12, 2, 1.2], ['resource_lumber', -16, 4.8, 0.3], ['target', -15, 1, 1.6],
    ['stage_A', -3.6, 21.5, 0],
  ];
  for (const [m, x, z, ry] of props) place.push({ model: m, x, z, ry });

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
  for (const [name, ps] of groups) {
    const model = models.get(name)!;
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const local = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, ps.length);
      ps.forEach((p, i) => {
        q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
        s4.setScalar(S * (p.s ?? 1));
        p4.set(p.x, p.y ?? 0, p.z);
        m4.compose(p4, q4, s4).multiply(local);
        im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere();
      const isTile = name.startsWith('hex_');
      im.receiveShadow = true;
      im.castShadow = !isTile;
      im.name = name;
      root.add(im);
    });
  }

  // ---------- Colisiones ----------
  const colliders: Collider[] = [];
  for (const p of place) {
    const r = BLOCK[p.model];
    if (r) colliders.push({ x: p.x, z: p.z, r: r * (p.s ?? 1) });
  }
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
    if (blockedTile(out.x, out.z)) {
      // deslizar por el eje que sí está libre
      if (!blockedTile(out.x, from.z)) out.z = from.z;
      else if (!blockedTile(from.x, out.z)) out.x = from.x;
      else { out.x = from.x; out.z = from.z; }
    }
    return out;
  };
  const groundY = (x: number, z: number) => {
    const [q, r] = worldToHex(x, z);
    const k = key(q, r);
    return roads.has(k) || tileType.get(k) === 'river_cross' ? -0.04 * S : 0;
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
    collide,
    groundY,
    spawn: (() => { const w = hexToWorld(0, -1.6); return new THREE.Vector3(w.x, groundY(w.x, w.y), w.y); })(),
    spawnYaw: Math.atan2(0.5, SQ3 / 2),
    update(t: number) {
      clouds.forEach((c, i) => { c.position.x += Math.sin(i) * 0.004; c.rotation.y = t * 0.003 + i; });
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
