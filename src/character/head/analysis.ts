// Análisis de las cabezas originales de KayKit (una vez por modelo): cara, pelo, barba, cejas y nariz.
import type * as THREE from 'three';
import type { HeadSource, HeadKit } from './types';
import { type Tris, triCentroid, triCell, C_HAIR2, V, toTris, isHairCell, C_DARK, C_EYE, isSkin, subset, cellOfUV } from './geometry';

// ---------------------------------------------------------------------------
// Análisis de las cabezas originales (una vez por modelo)
// ---------------------------------------------------------------------------

export interface Analysis {
  src: HeadSource;
  face: Tris;
  hair: Tris | null; // pelo (o barba en el bárbaro)
  noseTip: THREE.Vector3;
  eyeY: number;
  eyeX: number;
}
export const cache = new Map<HeadKit, Analysis>();
/** Triángulo de ceja original (pelo delante de la frente). */
export function isBrow(T: Tris, t: number) {
  const c = triCentroid(T, t);
  return triCell(T, t) === C_HAIR2 && c.z > 0.3 && c.y > 1.64 && c.y < 1.78 && Math.abs(c.x) > 0.04 && Math.abs(c.x) < 0.44;
}
/**
 * Islas de triángulos conectados (por posición de vértice). Las cejas originales
 * del modelo son islas pequeñas delante de la frente: se quitan del pelo.
 */
export function smallFrontIslands(T: Tris, keep: (t: number) => boolean, includeFacialHair = false) {
  const key = (i: number) => `${T.pos[i * 3].toFixed(4)},${T.pos[i * 3 + 1].toFixed(4)},${T.pos[i * 3 + 2].toFixed(4)}`;
  const parent: number[] = [];
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const owner = new Map<string, number>();
  for (let t = 0; t < T.count; t++) {
    parent[t] = t;
    if (!keep(t)) continue;
    for (let k = 0; k < 3; k++) {
      const kk = key(t * 3 + k), o = owner.get(kk);
      if (o === undefined) owner.set(kk, t); else parent[find(t)] = find(o);
    }
  }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < T.count; t++) if (keep(t)) { const r = find(t); (groups.get(r) ?? groups.set(r, []).get(r)!).push(t); }
  const drop = new Set<number>();
  for (const g of groups.values()) {
    if (g.length > (includeFacialHair ? 120 : 80)) continue;
    const c = V(0, 0, 0);
    for (const t of g) c.add(triCentroid(T, t));
    c.multiplyScalar(1 / g.length);
    const brow = c.y > 1.55 && c.y < 1.85 && Math.abs(c.x) > 0.04;
    if (c.z > 0.25 && (brow || includeFacialHair && c.y < 1.55)) for (const t of g) drop.add(t);
  }
  // moño bajo suelto detrás del cuello (queda flotando al combinarlo con otras caras)
  for (const g of groups.values()) {
    if (g.length > 400) continue;
    const c = V(0, 0, 0);
    for (const t of g) c.add(triCentroid(T, t));
    c.multiplyScalar(1 / g.length);
    if (c.z < -0.3 && c.y < 1.45) for (const t of g) drop.add(t);
  }
  return drop;
}
export function analyse(src: HeadSource): Analysis {
  let a = cache.get(src.kit);
  if (a) return a;
  const T = toTris(src.geometry);
  const hairT = (t: number) => isHairCell(triCell(T, t));
  // fuera ojos (celdas 2 y 10) y cejas originales: se dibujan aparte
  const eyeT = (t: number) => { const c = triCell(T, t); return (c === C_DARK || c === C_EYE) && triCentroid(T, t).z > 0.25; };
  // bordes de piel ocultos bajo el pelo original (frente y sienes): los cubre el cráneo
  const hiddenT = (t: number) => { const c = triCentroid(T, t); return src.kit !== 'Barbarian' && (c.y > 1.64 || (Math.abs(c.x) > 0.38 && c.z < 0.1 && c.y > 1.3)); };
  // fuera también los restos oscuros de la nuca (salían como una mancha morada)
  const darkT = (t: number) => { const c = triCell(T, t); return c === C_DARK || c === C_EYE; };
  // y lo que no es piel en la nuca (la goma del moño bajo del modelo de mago)
  const backT = (t: number) => !isSkin(triCell(T, t)) && triCentroid(T, t).z < 0;
  const face = subset(T, (t) => !hairT(t) && !darkT(t) && !hiddenT(t) && !backT(t));
  const browIslands = smallFrontIslands(T, hairT);
  const hair = subset(T, (t) => hairT(t) && !isBrow(T, t) && !browIslands.has(t));
  let noseTip = V(0, 1.5, 0);
  for (let i = 0; i < face.count * 3; i++) {
    const c = cellOfUV(face.uv[i * 2], face.uv[i * 2 + 1]);
    if (!isSkin(c) || Math.abs(face.pos[i * 3]) > 0.2 || face.pos[i * 3 + 1] > 1.6) continue;
    if (face.pos[i * 3 + 2] > noseTip.z) noseTip = V(face.pos[i * 3], face.pos[i * 3 + 1], face.pos[i * 3 + 2]);
  }
  noseTip.x = 0;
  // centro de los ojos originales (lado derecho)
  const ec = V(0, 0, 0); let ne = 0;
  for (let t = 0; t < T.count; t++) if (eyeT(t)) { const c = triCentroid(T, t); if (c.x > 0 && c.y < 1.63) { ec.add(c); ne++; } }
  if (ne) ec.multiplyScalar(1 / ne); else ec.set(0.2, 1.58, 0.45);
  a = { src, face, hair: hair.count ? hair : null, noseTip, eyeY: ec.y, eyeX: ec.x };
  cache.set(src.kit, a);
  return a;
}
