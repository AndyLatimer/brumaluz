import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coatMark } from '../data/data';

// ---------------------------------------------------------------------------
// Cabezas modulares a partir de las cuatro cabezas de KayKit Adventurers.
// Cada cabeza se separa por las celdas de su paleta en cara, pelo y barba; así
// cualquier cara se combina con cualquier peinado o barba. Ojos, cejas, nariz y
// orejas se deforman vértice a vértice, y las piezas añadidas (coletas, moños,
// bocas, orejas de elfo o gato, crestas) se pintan con la misma paleta.
// Todo se calcula en el espacio de la malla original y al final se pasa al
// espacio del hueso "head", del que cuelga como malla rígida.
// ---------------------------------------------------------------------------

export type HeadKit = 'Mage' | 'Knight' | 'Rogue' | 'Barbarian';

export interface HeadSource { kit: HeadKit; geometry: THREE.BufferGeometry; toBone: THREE.Matrix4 }

export interface HeadOptions {
  face: HeadKit;
  hair: number;
  beard: number;
  eyeShape: number;
  brows: number;
  nose: number;
  mouth: number;
  detail: number;
  eyeColor: string;
  /** Aplanar las orejas humanas (elfos, Pelso, Lagto'). */
  flattenEars: boolean;
  hat: 'none' | 'helmet' | 'wizard' | 'bear';
  /** Linaje: cambia nariz, pupilas y marcas de la cara. */
  race?: 'humano' | 'elfo' | 'lagto' | 'pelso';
  skin?: string;
  /** Complementos: adorno del pelo, gafas/bufanda/joyas, maquillaje y su color. */
  hairAcc?: number;
  hairAccColor?: string;
  acc?: number;
  makeup?: number;
  makeupColor?: string;
  accColor?: string;
}

export interface HeadResult {
  group: THREE.Group;
  ownedMaterials: THREE.Material[];
  /** Puntos de anclaje en el espacio de la malla original (pasar por toBone). */
  anchors: { ear: (s: number) => THREE.Vector3; top: (s: number) => THREE.Vector3; crest: { p: THREE.Vector3; n: THREE.Vector3 }[]; surf: (dir: THREE.Vector3, sink?: number) => { p: THREE.Vector3; n: THREE.Vector3 } };
  toBone: THREE.Matrix4;
  /** Grupos de los ojos (para parpadear escalando en Y). */
  eyes: THREE.Object3D[];
  /** Ojos cerrados de alegría (^ ^), ocultos hasta que el personaje saluda. */
  happy: THREE.Object3D[];
}

// Celdas de la paleta
const PI = Math.PI;
const C_SKIN = 0, C_SKIN2 = 8, C_HAIR = 1, C_HAIR2 = 9, C_EYE = 10, C_DARK = 2, C_WHITE = 32;
const isSkin = (c: number) => c === C_SKIN || c === C_SKIN2;
const isHairCell = (c: number) => c === C_HAIR || c === C_HAIR2;

const CENTER = new THREE.Vector3(0, 1.62, -0.02);
/** Centro de la cabeza lisa y su forma según la «cara» elegida. */
const HEAD_C = new THREE.Vector3(0, 1.66, -0.01);
const HEAD_SHAPES: Record<HeadKit, { rx: number; ryDown: number; nLow: number }> = {
  Rogue: { rx: 0.485, ryDown: 0.43, nLow: 2.45 }, // dulce: redonda y mofletuda
  Mage: { rx: 0.47, ryDown: 0.44, nLow: 2.7 }, // serio
  Knight: { rx: 0.462, ryDown: 0.46, nLow: 2.9 }, // noble: barbilla algo más larga
  Barbarian: { rx: 0.49, ryDown: 0.465, nLow: 3.7 }, // cuadrada: mandíbula marcada
};

export const HAIR_STYLES = ['Rapado', 'Corto con flequillo', 'Despeinado', 'Media melena', 'Coleta', 'Moño', 'Dos coletas', 'Cresta', 'Melena larga', 'Trenza', 'Moños dobles', 'Rizos', 'Corte asimétrico', 'Corto pegado'];
export const BEARDS = ['Ninguna', 'Barba recortada', 'Barba completa', 'Perilla y bigote', 'Bigote', 'Perilla'];
export const EYE_SHAPES = ['Normales', 'Grandes', 'Pequeños', 'Rasgados', 'Dulces', 'Soñolientos', 'Redondos', 'Varoniles', 'Afilados'];
export const BROWS = ['Naturales', 'Finas', 'Gruesas', 'Altas', 'Preocupadas', 'Enfadadas'];
export const NOSES = ['Pequeña', 'Grande', 'Respingona', 'Ancha', 'Aguileña', 'Botón'];
export const MOUTHS = ['Sonrisa', 'Sonrisa abierta', 'Seria', 'Sorpresa', 'Pícara', 'Colmillo'];
export const DETAILS = ['Ninguno', 'Rubor', 'Pecas', 'Cicatriz', 'Pintura de guerra', 'Lunar'];
export const FACE_LABELS: Record<HeadKit, string> = { Mage: 'Serio', Knight: 'Noble', Rogue: 'Dulce', Barbarian: 'Cuadrada' };
export const FACE_KITS: HeadKit[] = ['Rogue', 'Mage', 'Knight', 'Barbarian'];

// ---------------------------------------------------------------------------
// Utilidades de geometría
// ---------------------------------------------------------------------------

interface Tris { pos: Float32Array; uv: Float32Array; nrm: Float32Array; count: number }

function toTris(g: THREE.BufferGeometry): Tris {
  const ni = g.index ? g.toNonIndexed() : g;
  return {
    pos: Float32Array.from(ni.attributes.position.array as ArrayLike<number>),
    uv: Float32Array.from(ni.attributes.uv.array as ArrayLike<number>),
    nrm: Float32Array.from(ni.attributes.normal.array as ArrayLike<number>),
    count: ni.attributes.position.count / 3,
  };
}
const cellOfUV = (u: number, v: number) => Math.min(7, Math.max(0, Math.floor(v * 8))) * 8 + Math.min(7, Math.max(0, Math.floor(u * 8)));
/** Celda mayoritaria del triángulo t. */
function triCell(T: Tris, t: number) {
  const cs = [0, 1, 2].map((k) => cellOfUV(T.uv[(t * 3 + k) * 2], T.uv[(t * 3 + k) * 2 + 1]));
  return cs[0] === cs[1] || cs[0] === cs[2] ? cs[0] : cs[1];
}
function triCentroid(T: Tris, t: number) {
  const o = t * 9;
  return new THREE.Vector3((T.pos[o] + T.pos[o + 3] + T.pos[o + 6]) / 3, (T.pos[o + 1] + T.pos[o + 4] + T.pos[o + 7]) / 3, (T.pos[o + 2] + T.pos[o + 5] + T.pos[o + 8]) / 3);
}
function subset(T: Tris, keep: (t: number) => boolean): Tris {
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
function toGeometry(T: Tris, recomputeNormals = false) {
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

let blushTex: THREE.Texture | null = null;
function softBlushTexture() {
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
function piece(g: THREE.BufferGeometry, cell: number, m: THREE.Matrix4, t0 = 0.1, t1 = 0.9) {
  const out = (g.index ? g.toNonIndexed() : g).clone();
  out.applyMatrix4(m);
  paintCell(out, cell, t0, t1);
  out.computeVertexNormals();
  return out;
}
function mergeGeoms(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
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
const M = () => new THREE.Matrix4();
const compose = (p: THREE.Vector3, r: THREE.Euler, s: THREE.Vector3) => M().compose(p, new THREE.Quaternion().setFromEuler(r), s);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Análisis de las cabezas originales (una vez por modelo)
// ---------------------------------------------------------------------------

interface Analysis {
  src: HeadSource;
  face: Tris;
  hair: Tris | null; // pelo (o barba en el bárbaro)
  noseTip: THREE.Vector3;
  eyeY: number;
  eyeX: number;
}
const cache = new Map<HeadKit, Analysis>();

/** Triángulo de ceja original (pelo delante de la frente). */
function isBrow(T: Tris, t: number) {
  const c = triCentroid(T, t);
  return triCell(T, t) === C_HAIR2 && c.z > 0.3 && c.y > 1.64 && c.y < 1.78 && Math.abs(c.x) > 0.04 && Math.abs(c.x) < 0.44;
}

/**
 * Islas de triángulos conectados (por posición de vértice). Las cejas originales
 * del modelo son islas pequeñas delante de la frente: se quitan del pelo.
 */
function smallFrontIslands(T: Tris, keep: (t: number) => boolean) {
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
    if (g.length > 80) continue;
    const c = V(0, 0, 0);
    for (const t of g) c.add(triCentroid(T, t));
    c.multiplyScalar(1 / g.length);
    if (c.z > 0.25 && c.y > 1.55 && c.y < 1.85 && Math.abs(c.x) > 0.04) for (const t of g) drop.add(t);
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

function analyse(src: HeadSource): Analysis {
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

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

/** Ojos: radio horizontal y vertical, inclinación, párpado (0 = ninguno). */
const EYE = [
  { rx: 0.05, ry: 0.065, tilt: 0, lid: 0 }, { rx: 0.062, ry: 0.08, tilt: 0, lid: 0 }, { rx: 0.038, ry: 0.048, tilt: 0, lid: 0 },
  { rx: 0.058, ry: 0.042, tilt: 0.3, lid: 0 }, { rx: 0.055, ry: 0.06, tilt: -0.25, lid: 0 }, { rx: 0.056, ry: 0.06, tilt: 0, lid: 0.55 },
  { rx: 0.06, ry: 0.06, tilt: 0, lid: 0 },
  // masculinos: más pequeños, párpado recto y brillos discretos
  { rx: 0.047, ry: 0.054, tilt: 0.06, lid: 0.12, hl: 0.7 }, { rx: 0.053, ry: 0.044, tilt: 0.2, lid: 0.16, hl: 0.65 },
] as { rx: number; ry: number; tilt: number; lid: number; hl?: number }[];
/** Cejas: grosor, largo, altura extra, giro (+ = preocupada), curva. */
const BROW = [
  { t: 0.022, l: 0.15, dy: 0, rot: 0.05, arc: 0.2 }, { t: 0.012, l: 0.14, dy: 0.008, rot: 0.04, arc: 0.3 }, { t: 0.034, l: 0.17, dy: -0.004, rot: 0, arc: 0.1 },
  { t: 0.02, l: 0.14, dy: 0.04, rot: 0.02, arc: 0.45 }, { t: 0.026, l: 0.16, dy: -0.01, rot: 0.38, arc: 0 }, { t: 0.022, l: 0.15, dy: 0.015, rot: -0.32, arc: 0.1 },
];

export function buildHead(sources: Record<HeadKit, HeadSource>, o: HeadOptions, material: (kit: HeadKit) => THREE.Material, extraMat: (c: string) => THREE.Material): HeadResult {
  const A = analyse(sources[o.face === 'Barbarian' ? 'Mage' : o.face]);
  const group = new THREE.Group();
  const ownedMaterials: THREE.Material[] = [];
  const toBone = A.src.toBone;

  // ---------- Cabeza ----------
  // Una sola superficie lisa y cerrada (superelipsoide con mofletes), con las
  // medidas de la cabeza de KayKit para que sus peinados encajen. No hay recortes
  // ni parches: no puede tener huecos ni bultos. Todo lo demás se apoya en ella.
  const E0 = EYE[o.eyeShape] ?? EYE[0];
  const E = { ...E0, rx: E0.rx * 1.18, ry: E0.ry * 1.18 }, B = BROW[o.brows] ?? BROW[0];
  const beast = o.race === 'pelso' || o.race === 'lagto';
  const nose = A.noseTip;
  const SH = HEAD_SHAPES[o.face] ?? HEAD_SHAPES.Mage;
  const headR = (d: THREE.Vector3) => {
    const low = 1 - THREE.MathUtils.smoothstep(d.y, -0.55, 0.1);
    const n = THREE.MathUtils.lerp(2.15, SH.nLow, low);
    const rx = SH.rx, ry = d.y > 0 ? 0.48 : SH.ryDown, rz = d.z > 0 ? 0.45 : 0.47;
    return Math.pow(Math.abs(d.x / rx) ** n + Math.abs(d.y / ry) ** n + Math.abs(d.z / rz) ** n, -1 / n);
  };
  const headGeo = (() => {
    let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 96, 72);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVertices(g);
    const p = g.attributes.position, d = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const r = headR(d);
      p.setXYZ(i, HEAD_C.x + d.x * r, HEAD_C.y + d.y * r, HEAD_C.z + d.z * r);
    }
    g.computeVertexNormals();
    const flat = g.toNonIndexed();
    g.dispose();
    paintCell(flat, C_SKIN, 0.2, 0.7);
    if (o.hair !== 0 && o.hair !== 7 && o.hat !== 'helmet') {
      const uv = flat.attributes.uv as THREE.BufferAttribute, fp = flat.attributes.position;
      const hairlineY = o.hair === 8 ? 1.02 : 1.3;
      for (let t = 0; t < fp.count / 3; t++) {
        let cy = 0, cz = 0;
        for (let k = 0; k < 3; k++) { cy += fp.getY(t * 3 + k) / 3; cz += fp.getZ(t * 3 + k) / 3; }
        if (cy > hairlineY && (cz < 0.08 || cy > 1.98)) for (let k = 0; k < 3; k++) {
          const i = t * 3 + k;
          uv.setXY(i, ((C_HAIR % 8) + 0.5) / 8, (Math.floor(C_HAIR / 8) + 1) / 8);
        }
      }
    }
    if (o.hat === 'helmet') {
      // En vez de borrar la parte trasera (dejaba huecos visibles), se encoge hacia dentro del casco y la cabeza sigue cerrada.
      const fp = flat.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const w = 1 - THREE.MathUtils.smoothstep(fp.getZ(i), 0.12, 0.4);
        if (w <= 0) continue;
        const k = 1 - 0.22 * w;
        fp.setXYZ(i, HEAD_C.x + (fp.getX(i) - HEAD_C.x) * k, HEAD_C.y + (fp.getY(i) - HEAD_C.y) * k, HEAD_C.z + (fp.getZ(i) - HEAD_C.z) * k);
      }
      flat.computeVertexNormals();
    }
    return flat;
  })();
  const headMesh = new THREE.Mesh(headGeo, material(o.face));
  const headRay = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  /** Punto de la superficie en la dirección dada desde el centro (más un margen). */
  const headAt = (dir: THREE.Vector3, out = 0) => { const d = dir.clone().normalize(); return HEAD_C.clone().addScaledVector(d, headR(d) + out); };
  /**
   * Asienta el pelo sobre el cráneo: mide, por direcciones, el hueco entre la cara
   * interior del pelo y la cabeza, y baja toda la columna de pelo ese hueco (sin
   * adelgazarlo). Así ningún peinado flota.
   */
  const settle = (g: THREE.BufferGeometry, margin: number) => {
    const NU = 36, NV = 18, gap = new Float32Array(NU * NV).fill(99);
    const p = g.attributes.position, v = V(0, 0, 0);
    const bin = (d: THREE.Vector3) => {
      const u = (Math.atan2(d.x, d.z) / (2 * PI) + 0.5) * NU, w = (Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) / PI) * NV;
      return [u, w] as const;
    };
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - HEAD_C.x, p.getY(i) - HEAD_C.y, p.getZ(i) - HEAD_C.z);
      const L = v.length(); v.multiplyScalar(1 / L);
      const [u, w] = bin(v), k = (Math.floor(w) % NV) * NU + (Math.floor(u) % NU);
      gap[k] = Math.min(gap[k], L - headR(v) - margin);
    }
    // huecos vacíos = 0, y suavizado con los vecinos (sin escalones)
    const g0 = Array.from(gap, (x) => (x > 50 ? 0 : Math.max(0, x)));
    // suavizado amplio (dos pasadas) para que el pelo baje de forma uniforme, sin arrugas
    const blur = (src: number[]) => src.map((_, k) => {
      const r = Math.floor(k / NU), c = k % NU;
      let acc = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr; if (rr < 0 || rr >= NV) continue;
        acc += src[rr * NU + ((c + dc + NU) % NU)]; n++;
      }
      return acc / n;
    });
    const sm = blur(blur(g0)).map((x, k) => Math.min(x, g0[k] + 0.01));
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - HEAD_C.x, p.getY(i) - HEAD_C.y, p.getZ(i) - HEAD_C.z);
      const L = v.length(); v.multiplyScalar(1 / L);
      if (v.y < -0.45) continue; // mechones largos que cuelgan: se dejan
      const [u, w] = bin(v);
      // interpolación bilineal entre celdas
      const u0 = Math.floor(u - 0.5), w0 = THREE.MathUtils.clamp(Math.floor(w - 0.5), 0, NV - 2), fu = u - 0.5 - u0, fw = THREE.MathUtils.clamp(w - 0.5 - w0, 0, 1);
      const at = (r: number, c: number) => sm[r * NU + ((c % NU) + NU) % NU];
      const gp = (at(w0, u0) * (1 - fu) + at(w0, u0 + 1) * fu) * (1 - fw) + (at(w0 + 1, u0) * (1 - fu) + at(w0 + 1, u0 + 1) * fu) * fw;
      const down = Math.min(gp, 0.11) * (1 - THREE.MathUtils.smoothstep(-v.y, 0.25, 0.45));
      p.setXYZ(i, HEAD_C.x + v.x * (L - down), HEAD_C.y + v.y * (L - down), HEAD_C.z + v.z * (L - down));
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };
  const fitHairShell = (g: THREE.BufferGeometry) => {
    const p = g.attributes.position, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - HEAD_C.x, p.getY(i) - HEAD_C.y, p.getZ(i) - HEAD_C.z);
      const L = v.length();
      if (L < 1e-6) continue;
      v.multiplyScalar(1 / L);
      if (v.y < -0.45) continue;
      const clearance = L - headR(v);
      const crownAllowance = THREE.MathUtils.smoothstep(v.y, 0.55, 0.9);
      const targetClearance = THREE.MathUtils.lerp(0.003, 0.012, crownAllowance);
      const down = Math.min(Math.max(0, clearance - targetClearance), 0.2);
      p.setXYZ(i, HEAD_C.x + v.x * (L - down), HEAD_C.y + v.y * (L - down), HEAD_C.z + v.z * (L - down));
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };
  /** Saca un punto fuera de la cabeza si ha quedado dentro. */
  const pushOut = (g: THREE.BufferGeometry, margin: number) => {
    const p = g.attributes.position, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - HEAD_C.x, p.getY(i) - HEAD_C.y, p.getZ(i) - HEAD_C.z);
      const L = v.length();
      if (L < 1e-6) continue;
      v.multiplyScalar(1 / L);
      const R = headR(v) + margin;
      if (L < R) p.setXYZ(i, HEAD_C.x + v.x * R, HEAD_C.y + v.y * R, HEAD_C.z + v.z * R);
    }
    p.needsUpdate = true;
    return g;
  };
  /**
   * Rayo contra la cabeza resuelto con su fórmula (sin recorrer triángulos):
   * avanza hasta entrar y afina por bisección. Mil veces más rápido que el raycast.
   */
  const insideHead = (x: number, y: number, z: number) => {
    const vx = x - HEAD_C.x, vy = y - HEAD_C.y, vz = z - HEAD_C.z, L = Math.hypot(vx, vy, vz);
    return L < 1e-6 || L < headR(_dir.set(vx / L, vy / L, vz / L));
  };
  const _dir = V(0, 0, 0);
  const rayHead = (o: THREE.Vector3, d: THREE.Vector3): { point: THREE.Vector3; normal: THREE.Vector3 } | null => {
    // entrada en la esfera que envuelve la cabeza
    const ox = o.x - HEAD_C.x, oy = o.y - HEAD_C.y, oz = o.z - HEAD_C.z;
    const bq = ox * d.x + oy * d.y + oz * d.z, cq = ox * ox + oy * oy + oz * oz - 0.56 * 0.56, disc = bq * bq - cq;
    if (disc < 0) return null;
    let t = Math.max(0, -bq - Math.sqrt(disc));
    const tEnd = -bq + Math.sqrt(disc);
    let prev = t, hit = false;
    for (; t <= tEnd; t += 0.006) {
      if (insideHead(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)) { hit = true; break; }
      prev = t;
    }
    if (!hit) return null;
    let a = prev, b = t;
    for (let i = 0; i < 18; i++) { const m = (a + b) / 2; if (insideHead(o.x + d.x * m, o.y + d.y * m, o.z + d.z * m)) b = m; else a = m; }
    const point = V(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
    // normal: gradiente numérico de la superficie
    const F = (x: number, y: number, z: number) => { const vx = x - HEAD_C.x, vy = y - HEAD_C.y, vz = z - HEAD_C.z, L = Math.hypot(vx, vy, vz); return L - headR(_dir.set(vx / L, vy / L, vz / L)); };
    const e = 0.002;
    const normal = V(
      F(point.x + e, point.y, point.z) - F(point.x - e, point.y, point.z),
      F(point.x, point.y + e, point.z) - F(point.x, point.y - e, point.z),
      F(point.x, point.y, point.z + e) - F(point.x, point.y, point.z - e),
    ).normalize();
    return { point, normal };
  };
  const skinParts: THREE.BufferGeometry[] = [];
  const frontZ = (x: number, y: number) => rayHead(V(x, y, 2), V(0, 0, -1))?.point.z ?? 0.44;
  if (!beast) {
    // nariz: una pieza lisa, pequeña y medio hundida
    const NS: [number, number, number, number][] = [ // ancho, alto, fondo, giro
      [0.042, 0.036, 0.034, 0], [0.062, 0.055, 0.05, 0], [0.045, 0.04, 0.038, -0.45],
      [0.07, 0.04, 0.04, 0], [0.042, 0.058, 0.05, 0.35], [0.05, 0.048, 0.045, 0],
    ];
    const [nw, nh, nd, nr] = NS[o.nose] ?? NS[0];
    const g = new THREE.SphereGeometry(1, 20, 14);
    g.scale(nw, nh, nd);
    g.rotateX(nr);
    const zf = frontZ(0, nose.y);
    g.translate(0, nose.y + (nr < 0 ? 0.008 : 0), zf + nd * 0.35);
    skinParts.push(paintCell(g, C_SKIN, 0.35, 0.55));
  }
  const extras: { geo: THREE.BufferGeometry; kit: HeadKit }[] = [];

  // ---------- Pelo ----------
  const hatShrink = o.hat === 'helmet' ? 0.9 : o.hat === 'bear' ? 0.92 : o.hat === 'wizard' ? 0.94 : 1;
  const hairPieces: { geo: THREE.BufferGeometry; kit: HeadKit }[] = [];
  const kitHair = (kit: HeadKit, closeFit = 1) => {
    const h = analyse(sources[kit]).hair;
    if (!h || kit === 'Barbarian') return;
    const T: Tris = { pos: h.pos.slice(), uv: h.uv.slice(), nrm: h.nrm.slice(), count: h.count };
    if (closeFit < 1) for (let i = 0; i < T.count * 3; i++) {
      const p = V(T.pos[i * 3], T.pos[i * 3 + 1], T.pos[i * 3 + 2]).sub(HEAD_C).multiplyScalar(closeFit).add(HEAD_C);
      T.pos.set([p.x, p.y, p.z], i * 3);
    }
    if (hatShrink < 1) for (let i = 0; i < T.count * 3; i++) {
      const y = T.pos[i * 3 + 1];
      if (y < 1.45) continue;
      const k = THREE.MathUtils.lerp(1, hatShrink, THREE.MathUtils.smoothstep(y, 1.45, 1.75));
      const p = V(T.pos[i * 3], y, T.pos[i * 3 + 2]).sub(CENTER).multiplyScalar(k).add(CENTER);
      T.pos.set([p.x, p.y, p.z], i * 3);
    }
    hairPieces.push({ geo: pushOut(fitHairShell(toGeometry(T, true)), 0.014), kit });
  };
  const hairCell = C_HAIR;
  const blob = (r: number, p: THREE.Vector3, s: THREE.Vector3, rot = new THREE.Euler(), detail = 1) =>
    pushOut(settle(piece(new THREE.IcosahedronGeometry(r, detail), hairCell, compose(p, rot, s)), 0.02), 0.014);
  const ponytail = (direction: THREE.Vector3, offsets: THREE.Vector3[], radius: number) => {
    const outward = direction.normalize();
    const root = headAt(outward, radius * 0.35);
    hairPieces.push({ geo: blob(radius * 1.15, root, V(1, 0.92, 0.9), new THREE.Euler(), 3), kit: o.face });
    const start = root.clone().addScaledVector(outward, -radius * 0.8);
    const points = [start, root, ...offsets.map((offset) => root.clone().add(offset))];
    hairPieces.push({ geo: strand(points, radius, radius * 0.48), kit: o.face });
  };
  /**
   * Mechón liso: un tubo que sigue una curva y se estrecha hasta una punta redonda.
   * braid: ondas de trenzado; flat: aplastado de lado (cresta); taperStart: afina también el inicio.
   */
  const strand = (pts: THREE.Vector3[], r0: number, r1: number, opt: { braid?: number; flat?: number; taperStart?: boolean } = {}) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const N = 56, M = 18, fr = curve.computeFrenetFrames(N, false);
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, c = curve.getPointAt(t);
      let r = THREE.MathUtils.lerp(r0, r1, t);
      if (t > 0.82) r *= Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.18) ** 2)); // punta redonda
      if (opt.taperStart && t < 0.15) r *= Math.sqrt(Math.max(0, 1 - ((0.15 - t) / 0.15) ** 2));
      if (opt.braid) r *= 0.82 + 0.3 * Math.abs(Math.sin(PI * opt.braid * t));
      const off = opt.braid ? Math.sin(PI * opt.braid * t) * r * 0.25 : 0;
      for (let j = 0; j < M; j++) {
        const a = (j / M) * PI * 2, cx = Math.cos(a) * r * (opt.flat ?? 1) + off, cy = Math.sin(a) * r;
        pos.push(c.x + fr.normals[i].x * cy + fr.binormals[i].x * cx, c.y + fr.normals[i].y * cy + fr.binormals[i].y * cx, c.z + fr.normals[i].z * cy + fr.binormals[i].z * cx);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M), c2 = a + M, d = b + M;
      idx.push(a, c2, b, b, c2, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const flat = g.toNonIndexed();
    g.dispose();
    smoothNormals(flat, 80);
    return paintCell(flat, hairCell, 0.2, 0.8);
  };
  const hasHat = o.hat !== 'none';
  switch (o.hat === 'helmet' ? -1 : o.hair) {
    case 1: kitHair('Mage'); break;
    case 2: kitHair('Knight'); break;
    case 3: kitHair('Rogue'); break;
    case 4: // coleta: nudo en la nuca y una cola lisa que cae
      kitHair('Rogue');
      ponytail(
        V(0, -0.18, -0.98),
        [V(0, -0.06, -0.13), V(0, -0.24, -0.18), V(0, -0.45, -0.15), V(0.02, -0.62, -0.1)],
        0.105,
      );
      break;
    case 5: // moño
      kitHair('Mage');
      if (!hasHat) hairPieces.push({ geo: blob(0.19, V(0, 2.1, -0.24), V(1, 0.9, 1), new THREE.Euler(), 3), kit: o.face });
      break;
    case 6: // dos coletas
      kitHair('Rogue');
      for (const sx of [-1, 1]) {
        ponytail(
          V(sx * 0.72, 0.34, -0.6),
          [V(sx * 0.1, -0.06, -0.025), V(sx * 0.19, -0.22, -0.04), V(sx * 0.2, -0.4, -0.02), V(sx * 0.15, -0.54, 0.02)],
          0.085,
        );
      }
      break;
    case 7: // cresta: una franja continua de la frente a la nuca
      if (!hasHat) {
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 10; k++) { const a = 0.85 - k * 0.22; pts.push(V(0, HEAD_C.y + Math.cos(a) * 0.5, HEAD_C.z + Math.sin(a) * 0.5)); }
        hairPieces.push({ geo: strand(pts, 0.12, 0.07, { flat: 0.42, taperStart: true }), kit: o.face });
      }
      break;
    case 8: { // melena larga: una sola cubierta continua prolongada por la nuca
      const segments = 192, rings = 48;
      const pos: number[] = [HEAD_C.x, HEAD_C.y + headR(V(0, 1, 0)) + 0.012, HEAD_C.z];
      const idx: number[] = [];
      const limit = (phi: number) => {
        const z = Math.sin(phi);
        const front = THREE.MathUtils.smoothstep(z, 0, 1);
        const rear = THREE.MathUtils.smoothstep(-z, 0, 1);
        const side = THREE.MathUtils.smoothstep(Math.abs(Math.cos(phi)), 0.3, 0.9);
        return 1.5 - 0.48 * front + 0.9 * rear
          + 0.28 * side * rear
          + 0.025 * Math.cos(phi) * front;
      };
      for (let ring = 1; ring <= rings; ring++) {
        const thetaScale = ring / rings;
        for (let segment = 0; segment < segments; segment++) {
          const phi = (segment / segments) * 2 * PI;
          const theta = thetaScale * limit(phi);
          const d = V(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
          const fall = THREE.MathUtils.smoothstep(theta, 1.25, limit(phi));
          const r = headR(d) + 0.018 + Math.cos(phi * 8 + theta * 0.3) * 0.015 * fall;
          const back = THREE.MathUtils.smoothstep(-Math.sin(phi), -0.15, 0.8);
          const side = THREE.MathUtils.smoothstep(Math.abs(Math.cos(phi)), 0.25, 0.8);
          const drape = fall * THREE.MathUtils.clamp(back * 0.9 + side * 0.8, 0, 1);
          const x = HEAD_C.x + d.x * r + Math.sign(Math.cos(phi)) * side * drape * 0.035;
          const y = HEAD_C.y + d.y * r - drape * (0.34 + back * 0.16 + side * 0.1);
          const z = HEAD_C.z + d.z * r - drape * (back * 0.08 + side * 0.025);
          pos.push(x, y, z);
        }
      }
      for (let segment = 0; segment < segments; segment++) {
        const next = (segment + 1) % segments;
        idx.push(0, 1 + next, 1 + segment);
      }
      for (let ring = 0; ring < rings - 1; ring++) {
        const inner = 1 + ring * segments, outer = inner + segments;
        for (let segment = 0; segment < segments; segment++) {
          const next = (segment + 1) % segments;
          idx.push(inner + segment, outer + next, outer + segment);
          idx.push(inner + segment, inner + next, outer + next);
        }
      }
      const mane = new THREE.BufferGeometry();
      mane.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      mane.setIndex(idx);
      pushOut(mane, 0.018);
      mane.computeVertexNormals();
      hairPieces.push({ geo: paintCell(mane, hairCell, 0.2, 0.8), kit: o.face });
      break;
    }
    case 9: // trenza: un mechón con ondas de trenzado
      kitHair('Mage');
      hairPieces.push({ geo: strand([V(0, 1.78, -0.44), V(0, 1.6, -0.56), V(0, 1.36, -0.61), V(0, 1.12, -0.6), V(0, 0.96, -0.57)], 0.09, 0.045, { braid: 7 }), kit: o.face });
      break;
    case 10: // moños dobles
      kitHair('Rogue');
      if (!hasHat) for (const sx of [-1, 1])
        hairPieces.push({ geo: blob(0.15, V(sx * 0.33, 2.08, -0.3), V(1, 0.92, 1), new THREE.Euler(), 3), kit: o.face });
      break;
    case 11: // rizos: media melena con bucles alrededor
      kitHair('Rogue');
      // bucles redondos y solapados en el borde de la melena (cada uno, un rizo)
      for (let k = 0; k < 13; k++) {
        const a = -PI * 0.6 + (k / 12) * PI * 1.2;
        hairPieces.push({ geo: blob(0.115, V(Math.sin(a) * 0.43, 1.37 - (k % 2) * 0.045, -Math.cos(a) * 0.36 - 0.06), V(1, 1.1, 0.85), new THREE.Euler(), 3), kit: o.face });
      }
      break;
    case 12: { // corte corto asimétrico con línea frontal ladeada
      const segments = 128, rings = 32;
      const pos: number[] = [HEAD_C.x, HEAD_C.y + headR(V(0, 1, 0)) + 0.01, HEAD_C.z];
      const idx: number[] = [];
      const limit = (phi: number) => {
        const z = Math.sin(phi), x = Math.cos(phi);
        const front = THREE.MathUtils.smoothstep(z, 0, 1);
        const back = THREE.MathUtils.smoothstep(-z, 0, 1);
        return 1.62 - 0.32 * front + 0.42 * back + 0.3 * front * x;
      };
      for (let ring = 1; ring <= rings; ring++) {
        const thetaScale = ring / rings;
        for (let segment = 0; segment < segments; segment++) {
          const phi = (segment / segments) * 2 * PI;
          const theta = thetaScale * limit(phi);
          const d = V(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
          const r = headR(d) + 0.01;
          pos.push(HEAD_C.x + d.x * r, HEAD_C.y + d.y * r, HEAD_C.z + d.z * r);
        }
      }
      for (let segment = 0; segment < segments; segment++) {
        const next = (segment + 1) % segments;
        idx.push(0, 1 + next, 1 + segment);
      }
      for (let ring = 0; ring < rings - 1; ring++) {
        const inner = 1 + ring * segments, outer = inner + segments;
        for (let segment = 0; segment < segments; segment++) {
          const next = (segment + 1) % segments;
          idx.push(inner + segment, outer + next, outer + segment);
          idx.push(inner + segment, inner + next, outer + next);
        }
      }
      const cap = new THREE.BufferGeometry();
      cap.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      cap.setIndex(idx);
      cap.computeVertexNormals();
      hairPieces.push({ geo: paintCell(cap, hairCell, 0.2, 0.8), kit: o.face });
      break;
    }
    case 13: { // corte corto pegado al cráneo
      const segments = 128, rings = 32;
      const pos: number[] = [HEAD_C.x, HEAD_C.y + headR(V(0, 1, 0)) + 0.008, HEAD_C.z];
      const idx: number[] = [];
      const limit = (phi: number) => {
        const z = Math.sin(phi);
        return 1.55 - 0.32 * THREE.MathUtils.smoothstep(z, 0, 1) + 0.47 * THREE.MathUtils.smoothstep(-z, 0, 1);
      };
      for (let ring = 1; ring <= rings; ring++) {
        const t = ring / rings;
        for (let segment = 0; segment < segments; segment++) {
          const phi = (segment / segments) * 2 * PI;
          const theta = t * limit(phi);
          const d = V(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
          const r = headR(d) + 0.008;
          pos.push(HEAD_C.x + d.x * r, HEAD_C.y + d.y * r, HEAD_C.z + d.z * r);
        }
      }
      for (let segment = 0; segment < segments; segment++) {
        const next = (segment + 1) % segments;
        idx.push(0, 1 + next, 1 + segment);
      }
      for (let ring = 0; ring < rings - 1; ring++) {
        const inner = 1 + ring * segments, outer = inner + segments;
        for (let segment = 0; segment < segments; segment++) {
          const next = (segment + 1) % segments;
          idx.push(inner + segment, outer + next, outer + segment);
          idx.push(inner + segment, inner + next, outer + next);
        }
      }
      const cap = new THREE.BufferGeometry();
      cap.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      cap.setIndex(idx);
      cap.computeVertexNormals();
      hairPieces.push({ geo: paintCell(cap, hairCell, 0.2, 0.8), kit: o.face });
      break;
    }
  }

  // ---------- Boca ----------
  const surface = (x: number, y: number) => {
    const hit = rayHead(V(x, y, 2), V(0, 0, -1));
    return hit ? { p: hit.point, n: hit.normal } : { p: V(x, y, 0.45), n: V(0, 0, 1) };
  };
  const onFace = (x: number, y: number, out = 0.004) => { const s = surface(x, y); return s.p.add(s.n.clone().multiplyScalar(out)); };
  const facing = (x: number, y: number) => { const n = surface(x, y).n; return new THREE.Euler(-Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)), Math.atan2(n.x, n.z), 0); };
  const mouthY = nose.y - 0.105;
  const mouth: THREE.BufferGeometry[] = [];
  const teeth: THREE.BufferGeometry[] = [];
  const arc = (r: number, t: number, a0: number, a1: number) => new THREE.TorusGeometry(r, t, 5, 14, a1 - a0).rotateZ(a0);
  const mp = onFace(0, mouthY, 0.012), mr = facing(0, mouthY);
  const mouthZ = mp.z - 0.012;
  switch (o.mouth) {
    case 0:
      if (o.race === 'pelso') for (const sx of [-1, 1]) mouth.push(piece(arc(0.03, 0.011, PI * 1.05, PI * 1.95), C_DARK, compose(mp.clone().add(V(sx * 0.03, 0.022, 0)), mr, V(1, 1, 0.4))));
      else mouth.push(piece(arc(0.06, 0.014, PI * 1.2, PI * 1.8), C_DARK, compose(mp.clone().add(V(0, 0.05, 0)), mr, V(1, 0.85, 0.4))));
      break;
    case 1: mouth.push(piece(new THREE.CircleGeometry(0.075, 14, PI, PI), C_DARK, compose(mp.clone().add(V(0, 0.012, 0.004)), mr, V(1, 0.85, 1)))); break;
    case 2: mouth.push(piece(new THREE.CapsuleGeometry(0.011, 0.08, 3, 6).rotateZ(PI / 2), C_DARK, compose(mp, mr, V(1, 1, 0.5)))); break;
    case 3: mouth.push(piece(new THREE.TorusGeometry(0.034, 0.012, 5, 14), C_DARK, compose(mp, mr, V(0.85, 1.05, 0.5)))); break;
    case 4: mouth.push(piece(arc(0.06, 0.012, PI * 1.25, PI * 1.85), C_DARK, compose(mp.clone().add(V(0.02, 0.05, 0)), new THREE.Euler(mr.x, mr.y, 0.22), V(1, 0.8, 0.4)))); break;
    case 5:
      mouth.push(piece(arc(0.06, 0.014, PI * 1.2, PI * 1.8), C_DARK, compose(mp.clone().add(V(0, 0.05, 0)), mr, V(1, 0.85, 0.4))));
      teeth.push(piece(new THREE.ConeGeometry(0.018, 0.04, 4).rotateX(PI), C_WHITE, compose(onFace(0.04, mouthY - 0.012, 0.012), mr, V(1, 1, 0.6)), 0.1, 0.1));
      break;
  }

  // ---------- Barba ----------
  const beardGeos: THREE.BufferGeometry[] = [];
  if (o.beard > 0) {
    const my = mouthY;
    const beardPatch = (distance: (x: number, y: number) => number, wrapSides = false) => {
      const xMin = -0.48, xMax = 0.48, yMin = 1.02, yMax = 1.68, nx = 120, ny = 110;
      const dx = (xMax - xMin) / nx, dy = (yMax - yMin) / ny;
      type Sample = { x: number; y: number; d: number };
      const grid: Sample[] = [];
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const x = xMin + i * dx, y = yMin + j * dy;
        const d = distance(x, y);
        grid.push({ x, y, d: d > -0.02 && !wrapSides && !rayHead(V(x, y, 2), V(0, 0, -1)) ? -0.02 : d });
      }
      const positions: number[] = [], indices: number[] = [];
      const vertexIds = new Map<string, number>();
      const vertex = (x: number, y: number) => {
        const key = `${x.toFixed(5)},${y.toFixed(5)}`;
        const existing = vertexIds.get(key);
        if (existing !== undefined) return existing;
        let point: THREE.Vector3;
        if (wrapSides) {
          const longitude = THREE.MathUtils.clamp(x / 0.48, -1, 1) * 1.35;
          const latitude = Math.asin(THREE.MathUtils.clamp((y - HEAD_C.y) / 0.48, -0.99, 0.99));
          const direction = V(Math.sin(longitude) * Math.cos(latitude), Math.sin(latitude), Math.cos(longitude) * Math.cos(latitude)).normalize();
          point = HEAD_C.clone().addScaledVector(direction, headR(direction) + 0.009);
        } else {
          const hit = rayHead(V(x, y, 2), V(0, 0, -1));
          if (!hit) return null;
          point = hit.point.addScaledVector(hit.normal, 0.009);
        }
        const id = positions.length / 3;
        positions.push(point.x, point.y, point.z);
        vertexIds.set(key, id);
        return id;
      };
      const addTriangle = (a: Sample, b: Sample, c: Sample) => {
        const input = [a, b, c], polygon: Sample[] = [];
        for (let i = 0; i < input.length; i++) {
          const current = input[i], previous = input[(i + input.length - 1) % input.length];
          const currentInside = current.d >= 0, previousInside = previous.d >= 0;
          if (currentInside !== previousInside) {
            const t = previous.d / (previous.d - current.d);
            polygon.push({
              x: THREE.MathUtils.lerp(previous.x, current.x, t),
              y: THREE.MathUtils.lerp(previous.y, current.y, t),
              d: 0,
            });
          }
          if (currentInside) polygon.push(current);
        }
        for (let i = 1; i < polygon.length - 1; i++) {
          const triangle = [
            vertex(polygon[0].x, polygon[0].y),
            vertex(polygon[i].x, polygon[i].y),
            vertex(polygon[i + 1].x, polygon[i + 1].y),
          ];
          if (triangle.every((id) => id !== null)) indices.push(...triangle as number[]);
        }
      };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = grid[j * (nx + 1) + i], b = grid[j * (nx + 1) + i + 1];
        const c = grid[(j + 1) * (nx + 1) + i + 1], d = grid[(j + 1) * (nx + 1) + i];
        if (Math.max(a.d, b.d, c.d, d.d) < 0) continue;
        addTriangle(a, b, c);
        addTriangle(a, c, d);
      }
      if (!indices.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      paintCell(g, hairCell, 0.35, 0.7);
      beardGeos.push(g);
    };
    const sm = THREE.MathUtils.smoothstep;
    const smoothMin = (a: number, b: number, k: number) => {
      const h = Math.max(k - Math.abs(a - b), 0) / k;
      return Math.min(a, b) - h * h * k * 0.25;
    };
    const mouthHole = (x: number, y: number) => Math.hypot(x / 1.25, (y - my) * 1.1) - 0.065;
    const jaw = (x: number, y: number, height: number, width: number) => {
      const ax = Math.abs(x);
      const top = my - height - 0.015 * Math.pow(Math.min(ax / width, 1), 2);
      return smoothMin(smoothMin(top - y, width - ax, 0.045), mouthHole(x, y), 0.02);
    };
    const stache = (x: number, y: number) => {
      const ax = Math.abs(x);
      const yc = my + 0.04 - x * x * 0.8;
      const thickness = 0.026 * (1 - sm(ax, 0.055, 0.16)) + 0.003;
      return Math.min(thickness - Math.abs(y - yc), 0.175 - ax);
    };
    const goatee = (x: number, y: number) => {
      const centerY = my - 0.17;
      const vertical = (y - centerY) / 0.105, horizontal = x / 0.075;
      return (1 - horizontal * horizontal - vertical * vertical) * 0.055;
    };
    switch (o.beard) {
      case 1:
        beardPatch((x, y) => Math.max(jaw(x, y, 0.05, 0.23), stache(x, y)));
        break;
      case 2:
        beardPatch((x, y) => {
          const ax = Math.abs(x), width = 0.46;
          const top = my - 0.05 + 0.08 * Math.pow(Math.min(ax / width, 1), 1.5);
          const outline = smoothMin(top - y, width - ax, 0.045);
          const mouthOpening = Math.hypot(x / 1.15, (y - my) * 1.2) - 0.06;
          const cheekAndChin = smoothMin(outline, mouthOpening, 0.02);
          return Math.max(cheekAndChin, stache(x, y));
        }, true);
        break;
      case 3:
        beardPatch((x, y) => Math.max(stache(x, y), goatee(x, y)));
        break;
      case 4:
        beardPatch(stache);
        break;
      case 5:
        beardPatch(goatee);
        break;
    }
  }

  /**
   * Adapta una pieza plana (ojo, ceja) a la curva de la cara: cada vértice se
   * desplaza en profundidad hasta la superficie, conservando su capa (z local).
   * Así no sobresalen de perfil.
   */
  const conform = (grp: THREE.Object3D, lift: number, clampY?: number) => {
    grp.updateMatrix();
    const N = V(0, 0, 1).applyQuaternion(grp.quaternion), inv = grp.matrix.clone().invert();
    const memo = new Map<string, number>();
    const depth = (lx: number, ly: number) => {
      const k = `${Math.round(lx * 400)},${Math.round(ly * 400)}`;
      let dz = memo.get(k);
      if (dz === undefined) {
        const b = V(lx, ly, 0).applyMatrix4(grp.matrix);
        const hit = rayHead(b.clone().addScaledVector(N, 0.25), N.clone().negate());
        dz = hit ? hit.point.applyMatrix4(inv).z : 0;
        memo.set(k, dz);
      }
      return dz;
    };
    for (const c of [...grp.children]) {
      const m = c as THREE.Mesh;
      if (!m.isMesh) continue;
      m.updateMatrix();
      const g = m.geometry.clone().applyMatrix4(m.matrix);
      m.geometry.dispose();
      const p = g.attributes.position;
      if (clampY !== undefined) for (let i = 0; i < p.count; i++) if (p.getY(i) > clampY) p.setY(i, clampY);
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + depth(p.getX(i), p.getY(i)) + lift);
      g.computeVertexNormals();
      m.geometry = g;
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    }
  };

  // ---------- Ojos y cejas ----------
  const decals: THREE.Object3D[] = [];
  const eyes: THREE.Object3D[] = [];
  const happy: THREE.Object3D[] = [];
  const pupil = extraMat('#16101a'), white = extraMat('#ffffff');
  for (const s of [-1, 1]) {
    const x = s * A.eyeX * 0.96, y = A.eyeY - 0.012;
    const r = facing(x, y);
    const eye = new THREE.Group();
    eye.position.copy(onFace(x, y, 0.014));
    eye.rotation.set(r.x, r.y, s * E.tilt);
    // ojo estilo cozy: contorno oscuro, iris con degradado, pupila grande y dos brillos
    const disc = (rx: number, ry: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mat);
      m.scale.set(rx, ry, 0.012);
      m.position.z = z;
      eye.add(m);
      return m;
    };
    const iris = new THREE.Color(o.eyeColor);
    disc(E.rx * 1.08, E.ry * 1.08, 0, pupil);
    disc(E.rx, E.ry, 0.003, extraMat('#' + iris.clone().multiplyScalar(0.62).getHexString()));
    const low = disc(E.rx * 0.78, E.ry * 0.62, 0.005, extraMat('#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.28).getHexString()));
    low.position.y = -E.ry * 0.3;
    // pupila: rasgada en gatos y lagartos
    if (beast) disc(E.rx * 0.16, E.ry * 0.78, 0.008, pupil);
    else disc(E.rx * 0.5, E.ry * 0.55, 0.008, pupil).position.y = E.ry * 0.05;
    const hlk = E0.hl ?? 1;
    const hl1 = disc(E.rx * 0.3 * hlk, E.ry * 0.27 * hlk, 0.012, white);
    hl1.position.set(-s * E.rx * 0.32, E.ry * 0.38, 0.012);
    const hl2 = disc(E.rx * 0.14 * hlk, E.ry * 0.12 * hlk, 0.012, white);
    hl2.position.set(s * E.rx * 0.34, -E.ry * 0.42, 0.012);
    // línea del párpado superior y pestañas
    const lidLine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 5, 24, PI * 0.86).rotateZ(PI * 0.07), pupil);
    lidLine.scale.set(E.rx * 1.1, E.ry * 1.1, 0.3);
    lidLine.position.z = 0.012;
    eye.add(lidLine);
    // rabillo del delineado hacia fuera
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 4).translate(0, 0.025, 0), pupil);
    wing.position.set(s * E.rx * 1.02, E.ry * 0.28, 0.012);
    // con pestañas, el rabillo es más largo y sube (el ojo «dulce» de antes)
    const lashes = (o.makeup ?? 0) > 0;
    wing.rotation.z = -s * (lashes ? 1.05 : 1.35);
    wing.scale.set(o.makeup === 6 ? 1.3 : 1, o.makeup === 6 ? 2 : lashes ? 1.1 : 0.7, 0.3);
    eye.add(wing);
    // brillo inferior suave del iris
    const shine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 4, 16, PI * 0.6).rotateZ(PI * 1.2), extraMat('#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.6).getHexString()));
    shine.scale.set(E.rx * 0.82, E.ry * 0.82, 0.3);
    shine.position.z = 0.009;
    eye.add(shine);
    if (lashes) for (const k of [0, 1]) {
      const lash = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 4).translate(0, 0.025, 0), pupil);
      lash.position.set(s * E.rx * (0.82 + k * 0.05), E.ry * (0.62 - k * 0.32), 0.012);
      lash.rotation.z = -s * (0.9 + k * 0.5);
      lash.scale.set(1, o.makeup === 6 ? 1.4 : 1, 0.3);
      eye.add(lash);
    }
    // ojos soñolientos: el párpado corta el ojo por arriba en recto
    conform(eye, 0.007, E.lid ? E.ry * (1 - E.lid * 1.4) : undefined);
    decals.push(eye);
    // ojos de alegría: arco cerrado
    const hap = new THREE.Group();
    hap.position.copy(eye.position); hap.rotation.copy(eye.rotation);
    const arcM = new THREE.Mesh(new THREE.TorusGeometry(E.rx * 0.95, 0.016, 5, 18, PI * 0.9).rotateZ(PI * 0.05), pupil);
    arcM.position.y = -E.ry * 0.25; arcM.scale.set(1, 0.85, 0.4);
    hap.add(arcM);
    conform(hap, 0.009);
    hap.visible = false;
    decals.push(hap);
    happy.push(hap);
    eyes.push(eye);
    // ceja
    if (B.t > 0) {
      const by = y + E.ry + 0.055 + B.dy, bx = x + s * 0.01;
      const bg = new THREE.CapsuleGeometry(B.t * 0.95, B.l, 3, 8).rotateZ(PI / 2);
      // afilada hacia fuera y con un leve arco
      const bp = bg.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const u = THREE.MathUtils.clamp(bp.getX(i) / (B.l * 0.5 + B.t), -1, 1), out = (u * s + 1) / 2;
        bp.setY(i, bp.getY(i) * (1 - out * 0.45) - u * u * B.l * B.arc * 0.25);
      }
      bg.computeVertexNormals();
      // los Lagto' no tienen pelo en las cejas: arco de escamas algo más oscuro
      const brow = o.race === 'lagto'
        ? new THREE.Mesh(bg, extraMat('#' + new THREE.Color(o.skin ?? '#7cc06a').multiplyScalar(0.7).getHexString()))
        : new THREE.Mesh(piece(bg, C_HAIR, M(), 0.3, 0.6), material(o.face));
      const br = facing(bx, by);
      const bg2 = new THREE.Group();
      bg2.position.copy(onFace(bx, by, 0.01));
      bg2.rotation.set(br.x, br.y, 0);
      brow.rotation.z = s * -B.rot;
      brow.scale.set(1, 1, 0.55);
      bg2.add(brow);
      conform(bg2, B.t * 0.45);
      decals.push(bg2);
    }
  }

  // ---------- Detalles de la cara ----------
  const decal = (geo: THREE.BufferGeometry, color: string, x: number, y: number, rz = 0, sc = V(1, 1, 1), out = 0.005) => {
    // pegado a la curva de la cara (en las mejillas no se despega)
    const m = new THREE.Mesh(geo, extraMat(color));
    m.rotation.z = rz;
    m.scale.copy(sc);
    const g = new THREE.Group(), r = facing(x, y);
    g.position.copy(onFace(x, y, 0.01));
    g.rotation.set(r.x, r.y, 0);
    g.add(m);
    conform(g, out);
    decals.push(g);
  };
  const warPaintStripe = (x: number, y: number, angle: number) => {
    const width = 0.15, height = 0.03, round = height / 2, across = 24, rows = 6;
    const positions: number[] = [], indices: number[] = [];
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let row = 0; row <= rows; row++) {
      const v = row / rows, localY = (v - 0.5) * height;
      const endInset = round * (1 - Math.sqrt(Math.max(0, 1 - ((v - 0.5) * 2) ** 2)));
      for (let col = 0; col <= across; col++) {
        const u = col / across;
        const localX = THREE.MathUtils.lerp(-width / 2 + endInset, width / 2 - endInset, u);
        const px = x + localX * cos - localY * sin;
        const py = y + localX * sin + localY * cos;
        const hit = rayHead(V(px, py, 2), V(0, 0, -1));
        if (!hit) throw new Error(`Unable to project war paint onto face at (${px.toFixed(3)}, ${py.toFixed(3)})`);
        const point = hit.point.addScaledVector(hit.normal, 0.007);
        positions.push(point.x, point.y, point.z);
      }
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < across; col++) {
      const a = row * (across + 1) + col, b = a + 1, c = a + across + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    decals.push(new THREE.Mesh(geometry, extraMat('#3a6ab8')));
  };
  const cheekY = nose.y - 0.04;
  const blushMat = new THREE.MeshBasicMaterial({ map: softBlushTexture(), color: '#ff6f7a', transparent: true, opacity: o.detail === 1 ? 0.85 : o.race === 'lagto' ? 0.16 : (o.makeup ?? 0) > 0 ? 0.42 : 0.24, depthWrite: false });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), blushMat);
    const r = facing(s * 0.27, cheekY);
    m.position.copy(onFace(s * 0.27, cheekY, 0.008));
    m.rotation.set(r.x, r.y, 0);
    m.renderOrder = 2;
    decals.push(m);
  }
  switch (o.detail) {
    case 1: break;
    case 2: for (const s of [-1, 1]) for (let k = 0; k < 5; k++) decal(new THREE.CircleGeometry(0.011, 6), '#a0603a', s * (0.2 + (k % 3) * 0.045), cheekY + (k % 2 ? 0.03 : -0.01) - (k > 2 ? 0.035 : 0), 0, V(1, 1, 1), 0.006); break;
    case 3: // cicatriz en la mejilla, con puntadas
      decal(new THREE.CapsuleGeometry(0.008, 0.11, 2, 6), '#c47a70', 0.27, cheekY + 0.01, 0.5, V(1, 1, 0.4), 0.008);
      for (const k of [-1, 0, 1]) decal(new THREE.CapsuleGeometry(0.004, 0.04, 2, 4), '#a8605a', 0.27 - k * 0.03 * Math.sin(0.5), cheekY + 0.01 + k * 0.03 * Math.cos(0.5), 0.5 + PI / 2, V(1, 1, 0.4), 0.01);
      break;
    case 4: for (const s of [-1, 1]) for (let k = 0; k < 2; k++) warPaintStripe(s * 0.3, cheekY + 0.02 - k * 0.055, s * -0.2); break;
    case 5: decal(new THREE.CircleGeometry(0.016, 10), '#3a2420', 0.2, mouthY + 0.01, 0, V(1, 1, 1), 0.006); break;
  }

  // ---------- Rasgos del linaje en la cara ----------
  if (o.race === 'pelso') {
    // pelaje: nariz, bigotes y marcas propias de cada color
    const blob = (r: number) => new THREE.RingGeometry(0.0001, r, 40, 4);
    const coat = coatMark(o.skin ?? '');
    decal(new THREE.CircleGeometry(0.036, 3).rotateZ(-PI / 2), coat?.nose ?? '#e8828e', 0, nose.y - 0.015, 0, V(1.35, 0.9, 1), 0.012);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++)
      decal(new THREE.CapsuleGeometry(0.0045, 0.1, 6, 16).rotateZ(PI / 2), coat?.whisker ?? '#5a3a30', sx * 0.3, cheekY - 0.01 - k * 0.028, sx * (0.12 - k * 0.12), V(1, 1, 0.5), 0.008);
    if (coat && coat.mark !== 'plain') {
      const mc = coat.markColor, kind = coat.mark;
      const stripe = (x: number, y: number, len: number, w: number, rz: number) => decal(new THREE.CapsuleGeometry(w, len, 6, 16), mc, x, y, rz, V(1, 1, 0.4), 0.006);
      if (kind === 'tabby') {
        // "M" de la frente: la raya central es la más larga y las laterales se abren
        stripe(0, 1.85, 0.11, 0.017, 0);
        for (const sx of [-1, 1]) {
          stripe(sx * 0.075, 1.838, 0.085, 0.015, -sx * 0.22);
          stripe(sx * 0.15, 1.805, 0.06, 0.012, -sx * 0.5);
          // rayas de mejilla en diagonal, bajo el ojo y fuera de los bigotes
          stripe(sx * 0.36, cheekY + 0.11, 0.07, 0.012, sx * 0.9);
          stripe(sx * 0.37, cheekY + 0.065, 0.06, 0.011, sx * 1.2);
        }
      } else if (kind === 'spots') {
        const pts: [number, number, number, number][] = [[-0.09, 1.85, 0.02, 1.2], [0.05, 1.87, 0.015, 1], [0.11, 1.81, 0.019, 0.8], [-0.03, 1.79, 0.013, 1], [-0.35, cheekY + 0.07, 0.019, 1.3], [0.36, cheekY + 0.045, 0.022, 0.9], [-0.31, cheekY - 0.005, 0.013, 1], [0.32, cheekY - 0.022, 0.016, 1.2]];
        for (const [sx, sy, r, st] of pts) decal(blob(r), mc, sx, sy, 0.4, V(1, st, 1), 0.006);
      } else if (kind === 'mask') {
        // antifaz siamés: hocico y arco sobre los ojos
        decal(blob(0.095), mc, 0, nose.y - 0.025, 0, V(1.35, 1, 1), 0.007);
        for (const sx of [-1, 1]) decal(blob(0.055), mc, sx * 0.17, nose.y + 0.075, 0, V(1.3, 0.7, 1), 0.007);
      } else {
        // parches de bicolor / carey
        decal(blob(0.1), mc, -0.2, 1.83, 0.3, V(1.1, 1.3, 1), 0.007);
        decal(blob(0.045), mc, 0.4, cheekY + 0.14, 0, V(1, 1.3, 1), 0.007);
        decal(blob(0.03), mc, 0.1, 1.9, 0, V(1.2, 1, 1), 0.007);
      }
    }
  }
  if (o.race === 'lagto') {
    for (const sx of [-1, 1]) decal(new THREE.CircleGeometry(0.011, 8), '#1e2a20', sx * 0.032, nose.y - 0.01, 0, V(1.4, 0.8, 1), 0.01);
    // escamas: lunares algo más oscuros en frente y mejillas
    const sc = new THREE.Color(o.skin ?? '#7cc06a').multiplyScalar(0.72).getHexString();
    const spots: [number, number, number][] = [[0, 1.86, 0.03], [-0.09, 1.82, 0.022], [0.09, 1.82, 0.022], [0, 1.76, 0.018], [-0.36, cheekY + 0.05, 0.02], [-0.33, cheekY - 0.01, 0.015], [0.36, cheekY + 0.05, 0.02], [0.33, cheekY - 0.01, 0.015]];
    for (const [sx, sy, r] of spots) decal(new THREE.CircleGeometry(r, 6), '#' + sc, sx, sy, 0.3, V(1, 1, 1), 0.006);
  }

  // ---------- Anclajes para rasgos del linaje ----------
  // subdivisión: cara y pelo redondeados en vez de facetados
  // (Loop encoge un poco las formas convexas: se infla lo mismo para no abrir huecos)
  const subdiv = (g: THREE.BufferGeometry, deg: number, inflate = 0) => {
    const out = LoopSubdivision.modify(g, 1, { split: false, uvSmooth: false, preserveEdges: true });
    if (out !== g) g.dispose();
    smoothNormals(out, deg);
    if (inflate) {
      // dirección promediada por posición: los vértices repetidos se mueven juntos (sin grietas)
      const p = out.attributes.position, n = out.attributes.normal, acc = new Map<string, THREE.Vector3>();
      const key = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
      const keys: string[] = [];
      for (let i = 0; i < p.count; i++) { const k = key(i); keys.push(k); (acc.get(k) ?? acc.set(k, V(0, 0, 0)).get(k)!).add(V(n.getX(i), n.getY(i), n.getZ(i))); }
      for (const v of acc.values()) v.normalize().multiplyScalar(inflate);
      for (let i = 0; i < p.count; i++) { const d = acc.get(keys[i])!; p.setXYZ(i, p.getX(i) + d.x, p.getY(i) + d.y, p.getZ(i) + d.z); }
    }
    return out;
  };
  // pelo final (ya redondeado): los adornos y rasgos se apoyan sobre él
  const byKit = new Map<HeadKit, THREE.BufferGeometry[]>();
  for (const h of hairPieces) (byKit.get(h.kit) ?? byKit.set(h.kit, []).get(h.kit)!).push(h.geo);
  const finalHair: { geo: THREE.BufferGeometry; kit: HeadKit }[] = [];
  for (const [kit, gs] of byKit) {
    const g = mergeGeoms(gs);
    if (g) finalHair.push({ geo: smoothNormals(pushOut(subdiv(g, 70, 0.003), 0.012), 70), kit });
  }
  const hairGeos = [...finalHair, ...extras].map((h) => h.geo);
  const topRay = new THREE.Group();
  for (const g of hairGeos) topRay.add(new THREE.Mesh(g, headRay.material));
  // orejas humanas: medio disco suave a cada lado, sólo si el peinado no las tapa
  if (o.race === 'humano') for (const s of [-1, 1]) {
    const dir = V(s, -0.12, -0.06).normalize(), c = headAt(dir);
    // si el pelo pasa por cualquier punto de la zona de la oreja, la tapa
    let covered = false;
    for (const [dy, dz] of [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12], [0.08, 0.08], [-0.08, -0.08]]) {
      const d2 = V(s, -0.12 + dy, -0.06 + dz).normalize(), c2 = headAt(d2);
      const h2 = new THREE.Raycaster(HEAD_C.clone().addScaledVector(d2, 2), d2.clone().negate()).intersectObject(topRay, true)[0];
      if (h2 && h2.point.distanceTo(HEAD_C) > c2.distanceTo(HEAD_C) + 0.005) { covered = true; break; }
    }
    if (o.hat === 'helmet' || (covered && o.hat === 'none')) continue;
    const e = new THREE.SphereGeometry(1, 16, 12);
    e.scale(0.035, 0.1, 0.07);
    e.rotateZ(s * 0.12);
    e.translate(c.x, c.y, c.z);
    skinParts.push(paintCell(e, C_SKIN, 0.3, 0.6));
  }
  const topAt = (x: number, z: number) => {
    const rc = new THREE.Raycaster(V(x, 3, z), V(0, -1, 0));
    const hit = rc.intersectObject(topRay, true)[0] ?? rc.intersectObject(headRay)[0];
    return hit ? hit.point : V(x, 2.1, z);
  };
  const crest: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (let k = 0; k < 6; k++) {
    const a = 0.45 - k * 0.36, dir = V(0, Math.cos(a), Math.sin(a));
    const rc = new THREE.Raycaster(CENTER.clone().add(dir.clone().multiplyScalar(2)), dir.clone().negate());
    const hit = rc.intersectObjects([topRay, headRay], true)[0];
    crest.push({ p: hit ? hit.point : CENTER.clone().add(dir.clone().multiplyScalar(0.52)), n: dir });
  }

  // ---------- Complementos ----------
  const accCol = o.accColor ?? '#e8b84a';
  const accMat = extraMat(accCol);
  const hairAccMat = extraMat(o.hairAccColor ?? '#e8b84a');
  const makeupCol = o.makeupColor ?? '#f08aa8';
  /** Punto del pelo (o de la cabeza) en una dirección desde el centro, un poco por fuera. */
  const onHair = (dir: THREE.Vector3, out = 0.01) => {
    const d = dir.clone().normalize();
    const hit = new THREE.Raycaster(CENTER.clone().addScaledVector(d, 2), d.clone().negate()).intersectObjects([topRay, headRay], true)[0];
    return (hit ? hit.point : CENTER.clone().addScaledVector(d, 0.55)).addScaledVector(d, out);
  };
  const onHairSurface = (dir: THREE.Vector3, out: number) => {
    const d = dir.clone().normalize();
    const hit = new THREE.Raycaster(CENTER.clone().addScaledVector(d, 2), d.clone().negate()).intersectObjects([topRay, headRay], true)[0];
    if (!hit) return { point: CENTER.clone().addScaledVector(d, 0.55).addScaledVector(d, out), normal: d };
    const normal = hit.face!.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    return { point: hit.point.clone().addScaledVector(normal, out), normal };
  };
  /** Objeto mirando hacia fuera según una dirección. */
  const place = (obj: THREE.Object3D, p: THREE.Vector3, n: THREE.Vector3, roll = 0) => {
    obj.position.copy(p);
    obj.quaternion.setFromUnitVectors(V(0, 0, 1), n.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), roll));
    decals.push(obj);
    return obj;
  };
  const flower = (r: number, petal: string, heart = '#ffd65a', n = 5) => {
    const g = new THREE.Group();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), extraMat(petal));
      m.scale.set(1, 0.72, 0.38);
      m.position.set(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, 0);
      m.rotation.z = a;
      g.add(m);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 6), extraMat(heart));
    c.scale.z = 0.6; c.position.z = r * 0.2;
    g.add(c);
    return g;
  };
  const star = (r: number, depth: number) => {
    const sh = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const a = PI / 2 + (k / 10) * PI * 2, rr = k % 2 ? r * 0.45 : r; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: r * 0.12, bevelSegments: 2 }).translate(0, 0, -depth / 2);
  };
  const ring = (pts: THREE.Vector3[], r: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 6), mat);
    decals.push(m);
    return m;
  };
  if (o.hat === 'none') switch (o.hairAcc ?? 0) {
    case 1: { const d = V(0.6, 0.6, 0.55); place(flower(0.06, o.hairAccColor ?? '#e8b84a'), onHair(d, 0.012), d); break; }
    case 2: {
      const d = V(0.5, 0.8, 0.3), g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 12).rotateZ(sx * PI / 2).translate(sx * 0.08, 0, 0), hairAccMat);
        w.scale.set(1, 1, 0.45);
        g.add(w);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.1, 2, 6), hairAccMat);
        tail.position.set(sx * 0.03, -0.08, 0); tail.rotation.z = sx * 0.35; tail.scale.z = 0.4;
        g.add(tail);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), hairAccMat);
      g.add(knot);
      place(g, onHair(d, 0.02), d, -0.4);
      break;
    }
    case 3: { const d = V(-0.65, 0.6, 0.5); place(new THREE.Mesh(star(0.06, 0.018), hairAccMat), onHair(d, 0.012), d, 0.2); break; }
    case 4: {
      const N = 9;
      for (let k = 0; k < N; k++) {
        const a = -PI * 0.5 + (k / (N - 1)) * PI;
        const d = V(Math.sin(a) * 0.8, 0.6, Math.cos(a) * 0.55 + 0.05);
        place(flower(0.038, k % 2 ? o.hairAccColor ?? '#e8b84a' : '#fff4f8', k % 2 ? '#ffd65a' : '#ffb0c8'), onHair(d, 0.01), d, k);
      }
      break;
    }
    case 7: {
      const d = V(-0.68, 0.48, 0.72), pin = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.14, 3, 8), hairAccMat);
      bar.rotation.z = -0.58;
      bar.scale.z = 0.45;
      pin.add(bar);
      for (const x of [-0.06, 0.06]) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), extraMat('#f2dfb0'));
        rivet.position.set(x, x * -0.68, 0.004);
        pin.add(rivet);
      }
      place(pin, onHair(d, 0.012), d, -0.35);
      break;
    }
    case 8: {
      const d = V(0.62, 0.72, 0.38), brooch = new THREE.Group();
      const anchor = onHairSurface(d, 0.035);
      const badgeShape = new THREE.Shape();
      badgeShape.moveTo(0, 0.075);
      badgeShape.lineTo(0.052, 0.035);
      badgeShape.lineTo(0.042, -0.035);
      badgeShape.lineTo(0, -0.075);
      badgeShape.lineTo(-0.042, -0.035);
      badgeShape.lineTo(-0.052, 0.035);
      badgeShape.closePath();
      const badge = new THREE.Mesh(new THREE.ExtrudeGeometry(badgeShape, {
        depth: 0.018, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2,
      }).translate(0, 0, -0.009), hairAccMat);
      brooch.add(badge);
      const emblem = new THREE.Shape();
      for (let k = 0; k < 8; k++) {
        const angle = PI / 2 + k * PI / 4;
        const radius = k % 2 === 0 ? 0.034 : 0.012;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (k === 0) emblem.moveTo(x, y);
        else emblem.lineTo(x, y);
      }
      emblem.closePath();
      const emblemGeometry = new THREE.ExtrudeGeometry(emblem, { depth: 0.004, bevelEnabled: false }).translate(0, 0, 0.011);
      brooch.add(new THREE.Mesh(emblemGeometry, extraMat('#382b1c')));
      place(brooch, anchor.point, anchor.normal, 0.12);
      break;
    }
  }
  const glasses = (sides: number[]) => {
    const metal = extraMat(accCol), lens = new THREE.MeshStandardMaterial({ color: '#dff2ff', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
    for (const s of sides) {
      const x = s * A.eyeX * 0.96, y = A.eyeY - 0.012, r = Math.max(E.rx, E.ry) * 1.55;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 6, 28), metal));
      const l = new THREE.Mesh(new THREE.CircleGeometry(r, 24), lens);
      l.renderOrder = 3;
      g.add(l);
      // las dos lentes en un mismo plano delante de la cara (como unas gafas de verdad)
      g.position.set(x, y, frontZ(x, y) + 0.035);
      g.rotation.set(0, s * 0.3, 0);
      decals.push(g);
    }
    return metal;
  };
  const acc = o.acc ?? 0;
  if (acc === 1 || acc === 6) {
    const metal = glasses([-1, 1]);
    const bp = V(0, A.eyeY + 0.005, frontZ(0, A.eyeY) + 0.04);
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 10, PI).translate(0, -0.01, 0), metal);
    bridge.position.copy(bp);
    bridge.scale.y = 0.6;
    decals.push(bridge);
  }
  if (acc === 5) {
    glasses([1]);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 4), accMat);
    chain.position.copy(onFace(A.eyeX + 0.06, A.eyeY - 0.2, 0.03)); chain.rotation.z = 0.25;
    decals.push(chain);
  }
  if (acc === 2 || acc === 6) {
    // bufanda de lana: rosca al cuello y una punta que cuelga
    const wool = extraMat(accCol);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.075, 10, 28).rotateX(PI / 2), wool);
    sc.position.set(0, 1.15, 0.0); sc.scale.set(1, 1, 0.92); sc.rotation.x = 0.12;
    decals.push(sc);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 8), wool);
    tail.position.set(0.17, 0.98, 0.3); tail.rotation.set(0.25, 0, 0.18); tail.scale.z = 0.55;
    decals.push(tail);
  }
  if (acc === 3) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) { const a = -PI * 0.85 + (k / 16) * PI * 1.7; pts.push(V(Math.sin(a) * 0.3, 1.13 - Math.cos(a) * 0.1 - (1 + Math.cos(a)) * 0.0, Math.cos(a) * 0.3 + 0.02)); }
    ring(pts, 0.008, extraMat('#e8b84a'));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), new THREE.MeshStandardMaterial({ color: accCol, roughness: 0.15, metalness: 0.2, emissive: accCol, emissiveIntensity: 0.25 }));
    gem.scale.set(0.9, 1.25, 0.6);
    gem.position.copy(pts[8]).add(V(0, -0.04, 0.01));
    decals.push(gem);
  }
  if (acc === 4) for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), extraMat('#e8b84a')));
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: accCol, roughness: 0.15, emissive: accCol, emissiveIntensity: 0.2 }));
    drop.scale.y = 1.3; drop.position.y = -0.055;
    g.add(drop);
    g.position.set(s * 0.465, 1.36, 0.0);
    decals.push(g);
  }
  // maquillaje
  const mk = o.makeup ?? 0;
  if (mk === 2 || mk === 4) {
    const shadow = new THREE.MeshBasicMaterial({ map: blushMat.map, color: makeupCol, transparent: true, opacity: 0.75, depthWrite: false });
    for (const s of [-1, 1]) {
      const x = s * A.eyeX * 0.96, y = A.eyeY - 0.012 + E.ry * 0.95;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(E.rx * 3.6, E.ry * 1.6), shadow);
      const r = facing(x, y);
      m.position.copy(onFace(x, y, 0.009)); m.rotation.set(r.x, r.y, 0); m.renderOrder = 2;
      decals.push(m);
    }
  }
  if (mk === 5) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = s * (A.eyeX + 0.06 + k * 0.035), y = A.eyeY - 0.1 - (k % 2) * 0.04;
    const m = new THREE.Mesh(star(0.014 + (k === 1 ? 0.006 : 0), 0.002), new THREE.MeshBasicMaterial({ color: '#fffbe8' }));
    const r = facing(x, y);
    m.position.copy(onFace(x, y, 0.008)); m.rotation.set(r.x, r.y, k);
    decals.push(m);
  }

  const tops = { [-1]: topAt(-0.27, -0.04), [1]: topAt(0.27, -0.04) } as Record<number, THREE.Vector3>;

  // ---------- Montaje en el espacio del hueso ----------
  const finish = (m: THREE.Mesh) => { m.geometry.applyMatrix4(toBone); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  finish(headMesh);
  for (const g of skinParts) finish(new THREE.Mesh(smoothNormals(g, 80), material(o.face)));
  for (const h of extras) finish(new THREE.Mesh(h.geo, material(h.kit)));
  for (const h of finalHair) {
    const hairMaterial = material(h.kit);
    const doubleSided = hairMaterial.clone();
    doubleSided.side = THREE.DoubleSide;
    ownedMaterials.push(doubleSided);
    finish(new THREE.Mesh(h.geo, doubleSided));
  }
  for (const g of beardGeos) finish(new THREE.Mesh(g, material(o.face)));
  // la boca sigue la curva de la cara (en la cara "Dulce" los labios abultan y la tapaban)
  const hugFace = (g: THREE.BufferGeometry | null) => {
    if (!g) return g;
    const p = g.attributes.position, memo = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), k = `${Math.round(x * 300)},${Math.round(y * 300)}`;
      let sz = memo.get(k);
      if (sz === undefined) { sz = surface(x, y).p.z; memo.set(k, sz); }
      p.setZ(i, sz + 0.004 + Math.min(0.004, Math.max(0, p.getZ(i) - mouthZ) * 0.25));
    }
    g.computeVertexNormals();
    return g;
  };
  const mg = hugFace(mergeGeoms(mouth));
  const lips = o.makeup === 3 || o.makeup === 4;
  if (mg) finish(new THREE.Mesh(mg, lips ? extraMat(makeupCol) : material(o.face)));
  const tg = hugFace(mergeGeoms(teeth));
  if (tg) finish(new THREE.Mesh(tg, material(o.face)));
  for (const d of decals) {
    d.updateMatrix();
    d.applyMatrix4(toBone);
    d.castShadow = false;
    group.add(d);
  }
  return {
    group,
    ownedMaterials,
    toBone,
    eyes,
    happy,
    anchors: {
      ear: (s) => headAt(V(s, -0.2, -0.05), -0.01), top: (s) => tops[s < 0 ? -1 : 1].clone(), crest,
      // punto real de la superficie (pelo o cabeza) en una dirección, hundido hacia dentro
      surf: (dir, sink = 0.05) => { const n = dir.clone().normalize(); return { p: onHair(n, -sink), n }; },
    },
  };
}
