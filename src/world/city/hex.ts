// Rejilla hexagonal de la Brumaluz procedural: coordenadas, calles y semillas.
import * as THREE from 'three';

/** Escala de la maqueta: una casa pasa a medir ~3,7 m. */
export const S = 4;
export const SQ3 = Math.sqrt(3);
export const PI = Math.PI;
// Direcciones de los 6 bordes (ángulo k·60° en el plano XZ) en coordenadas axiales
export const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
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
export const key = (q: number, r: number) => q + ',' + r;
export const hexDist = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
// Bordes con calle de cada pieza (bit k = borde a k·60°)
export const ROADS: Record<string, string> = {
  hex_road_A: 'RGGRGG', hex_road_B: 'GGGRGR', hex_road_C: 'GGGRRG', hex_road_D: 'GRGRGR', hex_road_E: 'RGGRGR',
  hex_road_F: 'RRGRGG', hex_road_G: 'GGRRRG', hex_road_H: 'RGRRRG', hex_road_I: 'GRRGRR', hex_road_J: 'RRRRGG',
  hex_road_K: 'GRRRRR', hex_road_L: 'RRRRRR', hex_road_M: 'GGGRGG',
};
export const mask = (s: string) => s.split('').reduce((m, c, i) => m | (c === 'R' ? 1 << i : 0), 0);
export const rot = (m: number, k: number) => ((m << k) | (m >> (6 - k))) & 63;
/** Pieza y giro (en pasos de 60°) que conectan exactamente estos bordes. */
export function roadFor(m: number): [string, number] {
  for (const [name, s] of Object.entries(ROADS)) for (let k = 0; k < 6; k++) if (rot(mask(s), k) === m) return [name, k];
  return ['hex_road_L', 0];
}
/** Radio de colisión (en metros) de cada pieza que bloquea el paso. */
export const BLOCK: Record<string, number> = {
  home_A: 2.0, home_B: 2.0, tavern: 2.8, market: 2.8, blacksmith: 2.6, church: 2.8, castle: 5.2, well: 1.5,
  windmill: 2.6, watermill: 2.6, tower_A: 2.0, tower_B: 2.0, lumbermill: 2.8, barracks: 2.8, archeryrange: 2.8,
  wall_straight: 4.0,
  tree_single_A: 0.8, tree_single_B: 0.8, trees_A_large: 3.6, trees_A_medium: 3.2, trees_A_small: 2.6, trees_B_large: 3.6, trees_B_medium: 3.2,
  hills_A_trees: 4, hills_B_trees: 4, hills_C_trees: 4, hill_single_A: 2.4, hill_single_B: 2.4,
  mountain_A_grass_trees: 4, mountain_B_grass_trees: 4, mountain_C_grass: 4,
  rock_single_A: 0.6, rock_single_B: 0.6, barrel: 0.5, crate_A_big: 0.7, crate_long_A: 0.8, tent: 2, weaponrack: 0.8, wheelbarrow: 0.8, stage_A: 2.6,
};
export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
