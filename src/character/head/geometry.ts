// Utilidades de geometría de las cabezas: triángulos por celdas de la paleta, normales, pintura y medidas.
import * as THREE from 'three';

// Celdas de la paleta
export const PI = Math.PI;
export const C_SKIN = 0, C_SKIN2 = 8, C_HAIR = 1, C_HAIR2 = 9, C_EYE = 10, C_DARK = 2, C_WHITE = 32;
export const isSkin = (c: number) => c === C_SKIN || c === C_SKIN2;
export const isHairCell = (c: number) => c === C_HAIR || c === C_HAIR2;
export const CENTER = new THREE.Vector3(0, 1.62, -0.02);
/** Centro de la cabeza lisa y su forma según la «cara» elegida. */
export const HEAD_C = new THREE.Vector3(0, 1.66, -0.01);
// ---------------------------------------------------------------------------
// Utilidades de geometría
// ---------------------------------------------------------------------------

export interface Tris { pos: Float32Array; uv: Float32Array; nrm: Float32Array; count: number }
export function toTris(g: THREE.BufferGeometry): Tris {
  const ni = g.index ? g.toNonIndexed() : g;
  const read = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: 2 | 3) => {
    const values = new Float32Array(attribute.count * size);
    for (let i = 0; i < attribute.count; i++) {
      values[i * size] = attribute.getX(i);
      values[i * size + 1] = attribute.getY(i);
      if (size === 3) values[i * size + 2] = attribute.getZ(i);
    }
    return values;
  };
  const triangles = {
    pos: read(ni.attributes.position, 3),
    uv: read(ni.attributes.uv, 2),
    nrm: read(ni.attributes.normal, 3),
    count: ni.attributes.position.count / 3,
  };
  if (ni !== g) ni.dispose();
  return triangles;
}
export const cellOfUV = (u: number, v: number) => Math.min(7, Math.max(0, Math.floor(v * 8))) * 8 + Math.min(7, Math.max(0, Math.floor(u * 8)));
/** Celda mayoritaria del triángulo t. */
export function triCell(T: Tris, t: number) {
  const cs = [0, 1, 2].map((k) => cellOfUV(T.uv[(t * 3 + k) * 2], T.uv[(t * 3 + k) * 2 + 1]));
  return cs[0] === cs[1] || cs[0] === cs[2] ? cs[0] : cs[1];
}
export function triCentroid(T: Tris, t: number) {
  const o = t * 9;
  return new THREE.Vector3((T.pos[o] + T.pos[o + 3] + T.pos[o + 6]) / 3, (T.pos[o + 1] + T.pos[o + 4] + T.pos[o + 7]) / 3, (T.pos[o + 2] + T.pos[o + 5] + T.pos[o + 8]) / 3);
}
export function subset(T: Tris, keep: (t: number) => boolean): Tris {
  const ids: number[] = [];
  for (let t = 0; t < T.count; t++) if (keep(t)) ids.push(t);
  const out: Tris = { pos: new Float32Array(ids.length * 9), uv: new Float32Array(ids.length * 6), nrm: new Float32Array(ids.length * 9), count: ids.length };
  ids.forEach((t, i) => {
    out.pos.set(T.pos.subarray(t * 9, t * 9 + 9), i * 9);
    out.nrm.set(T.nrm.subarray(t * 9, t * 9 + 9), i * 9);
    out.uv.set(T.uv.subarray(t * 6, t * 6 + 6), i * 6);
  });
  return out;
}
export function toGeometry(T: Tris, recomputeNormals = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(T.pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(T.uv, 2));
  g.setAttribute('normal', new THREE.BufferAttribute(T.nrm, 3));
  if (recomputeNormals) g.computeVertexNormals();
  return g;
}
/** Lleva la UV de un vértice a otra celda, conservando su posición dentro de la celda. */
/** Asigna a una geometría procedural UVs de una celda con degradado vertical (arriba más claro). */
/**
 * Sombreado suave: promedia las normales de los vértices que comparten posición
 * cuando el ángulo entre caras es menor que `maxDeg` (las aristas marcadas se conservan).
 */
export function smoothNormals(g: THREE.BufferGeometry, maxDeg = 60) {
  const pos = g.attributes.position, n = pos.count;
  const idx = g.index;
  const get = (i: number) => (idx ? idx.getX(i) : i);
  const triCount = (idx ? idx.count : n) / 3;
  const fn: THREE.Vector3[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const groups = new Map<string, { f: number; v: number }[]>();
  for (let t = 0; t < triCount; t++) {
    const i0 = get(t * 3), i1 = get(t * 3 + 1), i2 = get(t * 3 + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const nn = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    const area = nn.length();
    fn.push(area > 1e-12 ? nn.divideScalar(area).multiplyScalar(Math.sqrt(area)) : nn);
    for (const v of [i0, i1, i2]) { const k = key(v); (groups.get(k) ?? groups.set(k, []).get(k)!).push({ f: t, v }); }
  }
  const cos = Math.cos((maxDeg * Math.PI) / 180);
  const out = new Float32Array(n * 3);
  for (const list of groups.values()) for (const { f, v } of list) {
    const base = fn[f].clone().normalize();
    const sum = new THREE.Vector3();
    for (const o of list) { const on = fn[o.f]; if (base.dot(on.clone().normalize()) >= cos) sum.add(on); }
    if (sum.lengthSq() < 1e-20) sum.copy(base);
    sum.normalize();
    out[v * 3] = sum.x; out[v * 3 + 1] = sum.y; out[v * 3 + 2] = sum.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}
export let blushTex: THREE.Texture | null = null;
export function softBlushTexture() {
  if (blushTex) return blushTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 64);
  blushTex = new THREE.CanvasTexture(c);
  blushTex.colorSpace = THREE.SRGBColorSpace;
  return blushTex;
}
export function paintCell(g: THREE.BufferGeometry, cell: number, t0 = 0.1, t1 = 0.9) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const h = bb.max.y - bb.min.y > 1e-6 ? (bb.max.y - p.getY(i)) / (bb.max.y - bb.min.y) : 0.5;
    uv[i * 2] = ((cell % 8) + 0.5) / 8;
    uv[i * 2 + 1] = (Math.floor(cell / 8) + t0 + (t1 - t0) * h) / 8;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
/** Malla procedural colocada con matriz, ya con UV de la celda dada. */
export function piece(g: THREE.BufferGeometry, cell: number, m: THREE.Matrix4, t0 = 0.1, t1 = 0.9) {
  const out = (g.index ? g.toNonIndexed() : g).clone();
  out.applyMatrix4(m);
  paintCell(out, cell, t0, t1);
  out.computeVertexNormals();
  return out;
}
export function mergeGeoms(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const gs = list.filter((g) => g.attributes.position.count > 0).map((g) => (g.index ? g.toNonIndexed() : g));
  if (!gs.length) return null;
  let n = 0;
  for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array as ArrayLike<number>, o * 3);
    nrm.set(g.attributes.normal.array as ArrayLike<number>, o * 3);
    uv.set(g.attributes.uv.array as ArrayLike<number>, o * 2);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
export const M = () => new THREE.Matrix4();
export const compose = (p: THREE.Vector3, r: THREE.Euler, s: THREE.Vector3) => M().compose(p, new THREE.Quaternion().setFromEuler(r), s);
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
