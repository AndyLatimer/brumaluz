import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';

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
  acc?: number;
  makeup?: number;
  accColor?: string;
}

export interface HeadResult {
  group: THREE.Group;
  /** Puntos de anclaje en el espacio de la malla original (pasar por toBone). */
  anchors: { ear: (s: number) => THREE.Vector3; top: (s: number) => THREE.Vector3; crest: { p: THREE.Vector3; n: THREE.Vector3 }[] };
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

export const HAIR_STYLES = ['Rapado', 'Corto con flequillo', 'Despeinado', 'Media melena', 'Coleta', 'Moño', 'Dos coletas', 'Cresta', 'Melena larga', 'Trenza', 'Moños dobles', 'Rizos', 'Coleta de lado'];
export const BEARDS = ['Ninguna', 'Barba completa', 'Barba corta', 'Perilla', 'Bigote', 'Patillas'];
export const EYE_SHAPES = ['Normales', 'Grandes', 'Pequeños', 'Rasgados', 'Dulces', 'Soñolientos', 'Redondos'];
export const BROWS = ['Naturales', 'Finas', 'Gruesas', 'Altas', 'Enfadadas', 'Preocupadas'];
export const NOSES = ['Pequeña', 'Grande', 'Respingona', 'Ancha', 'Aguileña', 'Botón'];
export const MOUTHS = ['Sonrisa', 'Sonrisa abierta', 'Seria', 'Sorpresa', 'Pícara', 'Colmillo'];
export const DETAILS = ['Ninguno', 'Rubor', 'Pecas', 'Cicatriz', 'Pintura de guerra', 'Lunar'];
export const FACE_LABELS: Record<HeadKit, string> = { Mage: 'Serio', Knight: 'Noble', Rogue: 'Dulce', Barbarian: 'Rudo' };
export const FACE_KITS: HeadKit[] = ['Rogue', 'Mage', 'Knight'];

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
function moveToCell(uv: Float32Array, i: number, cell: number) {
  const fu = uv[i * 2] * 8 - Math.floor(uv[i * 2] * 8), fv = uv[i * 2 + 1] * 8 - Math.floor(uv[i * 2 + 1] * 8);
  uv[i * 2] = ((cell % 8) + Math.min(Math.max(fu, 0.05), 0.95)) / 8;
  uv[i * 2 + 1] = (Math.floor(cell / 8) + Math.min(Math.max(fv, 0.05), 0.95)) / 8;
}
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
];
/** Cejas: grosor, largo, altura extra, giro (+ = enfadada), curva. */
const BROW = [
  { t: 0.022, l: 0.15, dy: 0, rot: 0.05, arc: 0.2 }, { t: 0.012, l: 0.14, dy: 0.008, rot: 0.04, arc: 0.3 }, { t: 0.034, l: 0.17, dy: -0.004, rot: 0, arc: 0.1 },
  { t: 0.02, l: 0.14, dy: 0.04, rot: 0.02, arc: 0.45 }, { t: 0.026, l: 0.16, dy: -0.01, rot: 0.38, arc: 0 }, { t: 0.022, l: 0.15, dy: 0.015, rot: -0.32, arc: 0.1 },
];

export function buildHead(sources: Record<HeadKit, HeadSource>, o: HeadOptions, material: (kit: HeadKit) => THREE.Material, extraMat: (c: string) => THREE.Material): HeadResult {
  const A = analyse(sources[o.face]);
  const group = new THREE.Group();
  const toBone = A.src.toBone;

  // ---------- Cara ----------
  const F: Tris = { pos: A.face.pos.slice(), uv: A.face.uv.slice(), nrm: A.face.nrm.slice(), count: A.face.count };
  const cellAt = (i: number) => cellOfUV(A.face.uv[i * 2], A.face.uv[i * 2 + 1]);
  const nV = F.count * 3;
  const E0 = EYE[o.eyeShape] ?? EYE[0];
  const E = { ...E0, rx: E0.rx * 1.18, ry: E0.ry * 1.18 }, B = BROW[o.brows] ?? BROW[0];
  const beast = o.race === 'pelso' || o.race === 'lagto';
  const nose = A.noseTip, noseBase = V(0, nose.y + 0.01, nose.z - 0.095);
  for (let i = 0; i < nV; i++) {
    if (!isSkin(cellAt(i))) continue;
    const x = F.pos[i * 3], y = F.pos[i * 3 + 1], z = F.pos[i * 3 + 2], s = x < 0 ? -1 : 1;
    const p = V(x, y, z);
    // nariz
    if (Math.abs(x) < 0.2 && Math.abs(y - nose.y) < 0.12 && z > noseBase.z) {
      const w = THREE.MathUtils.smoothstep(z, noseBase.z, noseBase.z + 0.05);
      const d = p.clone().sub(noseBase);
      const q = d.clone();
      // narices finas: la de KayKit es una patata; se reduce y se le da forma
      switch (o.nose) {
        case 0: q.multiplyScalar(0.4); q.x *= 0.85; break;
        case 1: q.multiplyScalar(0.8); break;
        case 2: q.multiplyScalar(0.5); q.y += Math.max(0, d.z) * 0.35; q.x *= 0.8; break;
        case 3: q.multiplyScalar(0.55); q.x *= 1.45; break;
        case 4: q.multiplyScalar(0.62); q.z *= 1.2; q.x *= 0.75; q.y -= Math.max(0, d.z) * 0.25; break;
        case 5: q.multiplyScalar(0.48); q.x *= 1.15; break;
      }
      if (beast) q.multiplyScalar(0.35);
      p.lerp(noseBase.clone().add(q), w);
    }
    // orejas humanas: se meten en el cráneo
    if (o.flattenEars && Math.abs(x) > 0.44 && y > 1.28 && y < 1.72 && Math.abs(z) < 0.24) {
      p.x = s * (0.44 + (Math.abs(x) - 0.44) * 0.05);
    }
    F.pos[i * 3] = p.x; F.pos[i * 3 + 1] = p.y; F.pos[i * 3 + 2] = p.z;
  }
  const faceGeo = toGeometry(F);
  const faceMesh = new THREE.Mesh(faceGeo, material(o.face));
  const faceRay = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const capRay = new THREE.Mesh(new THREE.BufferGeometry(), faceRay.material);

  // ---------- Cráneo (debajo del pelo) ----------
  const extras: { geo: THREE.BufferGeometry; kit: HeadKit }[] = [];
  {
    // cráneo liso: cubre frente alta, coronilla y nuca bajo el pelo
    const sk = new THREE.IcosahedronGeometry(1, 4).toNonIndexed();
    const R3 = V(0.465, 0.52, 0.465), C3 = V(0, 1.67, -0.04);
    // la frente del cráneo se ajusta a la de la cara para que no haya escalón
    const hitF = new THREE.Raycaster(V(0, 1.6, 2), V(0, 0, -1)).intersectObject(faceRay)[0];
    const zf = hitF ? hitF.point.z : 0.44;
    const rzFront = (zf + 0.004 - C3.z) / Math.sqrt(1 - ((1.6 - C3.y) / R3.y) ** 2);
    sk.scale(R3.x, R3.y, 1);
    const sp = sk.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, sp.getZ(i) * (sp.getZ(i) > 0 ? rzFront : R3.z));
    sk.translate(C3.x, C3.y, C3.z);
    // nuca y coronilla un poco hacia dentro: el pelo siempre queda por encima (sin manchas)
    if (o.hair !== 0 && o.hair !== 7) for (let i = 0; i < sp.count; i++) {
      const z = sp.getZ(i), k = THREE.MathUtils.lerp(0.965, 1, THREE.MathUtils.smoothstep(z, 0.0, 0.14));
      sp.setXYZ(i, C3.x + (sp.getX(i) - C3.x) * k, C3.y + (sp.getY(i) - C3.y) * k, C3.z + (z - C3.z) * k);
    }
    const T = toTris(sk.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sk.attributes.position.count * 2), 2)));
    const keep = subset(T, (t) => { const c = triCentroid(T, t); return c.y > 1.3 && (c.z < 0.24 || c.y > 1.6); });
    const g = toGeometry(keep);
    paintCell(g, C_SKIN, 0.2, 0.7);
    // con pelo, la coronilla y la nuca del cráneo van del color del pelo (tapa huecos del peinado)
    if (o.hair !== 0 && o.hair !== 7) {
      const uv = g.attributes.uv as THREE.BufferAttribute, gp0 = g.attributes.position;
      for (let t = 0; t < gp0.count / 3; t++) {
        let cy = 0, cz = 0;
        for (let k = 0; k < 3; k++) { cy += gp0.getY(t * 3 + k) / 3; cz += gp0.getZ(t * 3 + k) / 3; }
        if (cz < 0.12 || cy > 1.98) for (let k = 0; k < 3; k++) uv.setXY(t * 3 + k, ((C_HAIR % 8) + 0.5) / 8, (Math.floor(C_HAIR / 8) + 0.5) / 8);
      }
    }
    // normales suaves de elipsoide
    const gp = g.attributes.position, gn = g.attributes.normal;
    for (let i = 0; i < gp.count; i++) {
      const rz = gp.getZ(i) > C3.z ? rzFront : R3.z;
      const n = V((gp.getX(i) - C3.x) / (R3.x * R3.x), (gp.getY(i) - C3.y) / (R3.y * R3.y), (gp.getZ(i) - C3.z) / (rz * rz)).normalize();
      gn.setXYZ(i, n.x, n.y, n.z);
    }
    extras.push({ geo: g, kit: o.face });
    capRay.geometry = g;
  }

  // ---------- Pelo ----------
  const hatShrink = o.hat === 'helmet' ? 0.9 : o.hat === 'bear' ? 0.92 : o.hat === 'wizard' ? 0.94 : 1;
  const hairPieces: { geo: THREE.BufferGeometry; kit: HeadKit }[] = [];
  const kitHair = (kit: HeadKit) => {
    const h = analyse(sources[kit]).hair;
    if (!h || kit === 'Barbarian') return;
    const T: Tris = { pos: h.pos.slice(), uv: h.uv.slice(), nrm: h.nrm.slice(), count: h.count };
    if (hatShrink < 1) for (let i = 0; i < T.count * 3; i++) {
      const y = T.pos[i * 3 + 1];
      if (y < 1.45) continue;
      const k = THREE.MathUtils.lerp(1, hatShrink, THREE.MathUtils.smoothstep(y, 1.45, 1.75));
      const p = V(T.pos[i * 3], y, T.pos[i * 3 + 2]).sub(CENTER).multiplyScalar(k).add(CENTER);
      T.pos.set([p.x, p.y, p.z], i * 3);
    }
    hairPieces.push({ geo: toGeometry(T, hatShrink < 1), kit });
  };
  const hairCell = C_HAIR;
  const blob = (r: number, p: THREE.Vector3, s: THREE.Vector3, rot = new THREE.Euler(), detail = 1) =>
    piece(new THREE.IcosahedronGeometry(r, detail), hairCell, compose(p, rot, s));
  const hasHat = o.hat !== 'none';
  switch (o.hair) {
    case 1: kitHair('Mage'); break;
    case 2: kitHair('Knight'); break;
    case 3: kitHair('Rogue'); break;
    case 4: // coleta
      kitHair('Rogue');
      // pegada a la nuca: nudo hundido en el pelo y cola que cae solapada
      hairPieces.push({ geo: blob(0.11, V(0, 1.8, -0.46), V(1, 1, 1), new THREE.Euler(), 2), kit: o.face });
      for (let k = 0; k < 4; k++) hairPieces.push({ geo: blob(0.12 - k * 0.016, V(0, 1.68 - k * 0.14, -0.53 - Math.sin(k * 0.6) * 0.04), V(1, 1.35, 1), new THREE.Euler(), 2), kit: o.face });
      break;
    case 5: // moño
      kitHair('Mage');
      if (!hasHat) hairPieces.push({ geo: blob(0.19, V(0, 2.1, -0.24), V(1, 0.9, 1), new THREE.Euler(), 2), kit: o.face });
      break;
    case 6: // dos coletas
      kitHair('Rogue');
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) hairPieces.push({ geo: blob(0.11 - k * 0.015, V(s * (0.5 + k * 0.03), 1.78 - k * 0.14, -0.18 - k * 0.03), V(1, 1.3, 1)), kit: o.face });
      break;
    case 7: // cresta: franja de pelo de la frente a la nuca
      if (!hasHat) for (let k = 0; k < 12; k++) {
        const a = 0.8 - k * 0.2;
        const p = V(0, CENTER.y + Math.cos(a) * 0.5, CENTER.z + Math.sin(a) * 0.5);
        hairPieces.push({ geo: blob(0.12, p, V(0.42, 1.2 - Math.abs(k - 4) * 0.035, 1.1), new THREE.Euler(a, 0, 0), 2), kit: o.face });
      }
      break;
    case 8: // melena larga
      kitHair('Rogue');
      {
        // una sola masa redondeada a la espalda y dos mechones junto a la cara
        const back = new THREE.SphereGeometry(1, 22, 16);
        const bp = back.attributes.position;
        for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - Math.max(0, -y) * 0.22)); bp.setZ(i, bp.getZ(i) * (1 - Math.max(0, -y) * 0.3)); }
        hairPieces.push({ geo: piece(back, hairCell, compose(V(0, 1.24, -0.27), new THREE.Euler(-0.08, 0, 0), V(0.5, 0.56, 0.32))), kit: o.face });
        for (const sx of [-1, 1]) hairPieces.push({ geo: piece(new THREE.SphereGeometry(1, 14, 12), hairCell, compose(V(sx * 0.42, 1.24, 0.06), new THREE.Euler(0.1, 0, sx * 0.1), V(0.085, 0.3, 0.11))), kit: o.face });
      }
      break;
    case 9: // trenza
      kitHair('Mage');
      for (let k = 0; k < 6; k++) hairPieces.push({ geo: blob(0.1 - k * 0.008, V((k % 2 ? 0.035 : -0.035), 1.72 - k * 0.13, -0.45 - k * 0.025), V(1, 1.15, 0.95), new THREE.Euler(), 2), kit: o.face });
      hairPieces.push({ geo: piece(new THREE.ConeGeometry(0.07, 0.16, 6).rotateX(PI), hairCell, compose(V(0, 0.95, -0.6), new THREE.Euler(), V(1, 1, 1))), kit: o.face });
      break;
    case 10: // moños dobles
      kitHair('Rogue');
      if (!hasHat) for (const sx of [-1, 1]) hairPieces.push({ geo: blob(0.15, V(sx * 0.33, 2.08, -0.12), V(1, 0.92, 1), new THREE.Euler(), 2), kit: o.face });
      break;
    case 11: // rizos: media melena con bucles alrededor
      kitHair('Rogue');
      // bucles grandes y solapados pegados al borde de la melena
      for (let k = 0; k < 13; k++) {
        const a = -PI * 0.6 + (k / 12) * PI * 1.2;
        hairPieces.push({ geo: blob(0.125, V(Math.sin(a) * 0.43, 1.36 - (k % 2) * 0.05, -Math.cos(a) * 0.36 - 0.06), V(1, 1.15, 0.9), new THREE.Euler(), 2), kit: o.face });
      }
      break;
    case 12: // coleta de lado
      kitHair('Mage');
      hairPieces.push({ geo: blob(0.085, V(0.43, 1.8, -0.2), V(1, 1, 1)), kit: o.face });
      for (let k = 0; k < 4; k++) hairPieces.push({ geo: blob(0.115 - k * 0.016, V(0.52 + k * 0.025, 1.66 - k * 0.15, -0.22 - k * 0.02), V(1, 1.35, 1), new THREE.Euler(), 2), kit: o.face });
      break;
  }

  // ---------- Boca ----------
  const surface = (x: number, y: number) => {
    const rc = new THREE.Raycaster(V(x, y, 2), V(0, 0, -1));
    const hit = rc.intersectObjects([faceRay, capRay])[0];
    return hit ? { p: hit.point, n: hit.face!.normal.clone() } : { p: V(x, y, 0.45), n: V(0, 0, 1) };
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
  // Copia de la propia cara en la zona de la barba, engordada hacia fuera: tan lisa
  // como la cara y envuelve la barbilla. La zona es una distancia al borde (sd > 0
  // dentro); en el borde la copia se hunde bajo la piel y el contorno sale limpio.
  if (o.beard > 0) {
    const my = mouthY;
    const shell = (sd: (x: number, y: number, z: number) => number, T: number, fall: number) => {
      // la cara subdividida dos veces: triángulos finos para un contorno suave
      const src = LoopSubdivision.modify(faceGeo.clone(), 2, { split: false, uvSmooth: false, preserveEdges: true });
      smoothNormals(src, 85);
      const p = src.attributes.position, n = src.attributes.normal;
      // normales promediadas por posición: sin grietas entre triángulos
      const acc = new Map<string, THREE.Vector3>(), key = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
      for (let i = 0; i < p.count; i++) { const k = key(i); (acc.get(k) ?? acc.set(k, V(0, 0, 0)).get(k)!).add(V(n.getX(i), n.getY(i), n.getZ(i))); }
      const out: number[] = [];
      for (let t = 0; t < p.count / 3; t++) {
        const ds = [0, 1, 2].map((k) => sd(p.getX(t * 3 + k), p.getY(t * 3 + k), p.getZ(t * 3 + k)));
        if (Math.max(...ds) < -0.025) continue;
        for (let k = 0; k < 3; k++) {
          const i = t * 3 + k, d = acc.get(key(i))!.clone().normalize();
          const th = -0.012 + (T + 0.012) * THREE.MathUtils.smoothstep(ds[k], -0.012, fall);
          out.push(p.getX(i) + d.x * th, p.getY(i) + d.y * th, p.getZ(i) + d.z * th);
        }
      }
      src.dispose();
      if (!out.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((out.length / 3) * 2).fill(0), 2));
      g.computeVertexNormals();
      paintCell(g, hairCell, 0.45, 0.55);
      smoothNormals(g, 60);
      beardGeos.push(g);
    };
    const sm = THREE.MathUtils.smoothstep;
    const front = (z: number) => z > -0.05; // sólo la parte delantera (no la nuca)
    const mouthHole = (x: number, y: number) => Math.hypot(x / 1.35, (y - my - 0.005) * 1.1) - 0.06;
    const jaw = (x: number, y: number, z: number) => {
      if (!front(z)) return -1;
      const top = my - 0.05 + 0.11 * sm(Math.abs(x), 0.1, 0.36);
      return Math.min(top - y, mouthHole(x, y), 0.47 - Math.abs(x));
    };
    const stache = (x: number, y: number, z: number) => {
      if (z < 0.2) return -1;
      const yc = my + 0.048 - x * x * 1.3, hh = 0.024 * (1 - sm(Math.abs(x), 0.08, 0.2)) + 0.004;
      return Math.min(hh - Math.abs(y - yc), 0.2 - Math.abs(x));
    };
    switch (o.beard) {
      case 1: shell((x, y, z) => Math.max(jaw(x, y, z), stache(x, y, z)), 0.045, 0.05); break;
      case 2: shell(jaw, 0.02, 0.03); break;
      case 3: shell((x, y, z) => (z < 0.1 ? -1 : 0.085 - Math.hypot(x, (y - (my - 0.12)) * 0.85)), 0.035, 0.035); break;
      case 4: shell(stache, 0.024, 0.016); break;
      case 5: shell((x, y, z) => (z < -0.02 ? -1 : Math.min(Math.abs(x) - 0.31, y - (my - 0.03), A.eyeY - 0.04 - y)), 0.022, 0.02); break;
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
    const rc = new THREE.Raycaster(), memo = new Map<string, number>();
    const depth = (lx: number, ly: number) => {
      const k = `${Math.round(lx * 400)},${Math.round(ly * 400)}`;
      let dz = memo.get(k);
      if (dz === undefined) {
        const b = V(lx, ly, 0).applyMatrix4(grp.matrix);
        rc.set(b.clone().addScaledVector(N, 0.25), N.clone().negate());
        const hit = rc.intersectObject(faceRay)[0];
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
    const hl1 = disc(E.rx * 0.3, E.ry * 0.27, 0.012, white);
    hl1.position.set(-s * E.rx * 0.32, E.ry * 0.38, 0.012);
    const hl2 = disc(E.rx * 0.14, E.ry * 0.12, 0.012, white);
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
      const bg = new THREE.CapsuleGeometry(B.t * 0.8, B.l, 3, 8).rotateZ(PI / 2);
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
    const m = new THREE.Mesh(geo, extraMat(color));
    const r = facing(x, y);
    m.position.copy(onFace(x, y, out));
    m.rotation.set(r.x, r.y, rz);
    m.scale.copy(sc);
    decals.push(m);
  };
  const cheekY = nose.y - 0.04;
  const blushMat = new THREE.MeshBasicMaterial({ map: softBlushTexture(), color: '#ff6f7a', transparent: true, opacity: o.detail === 1 ? 0.85 : o.race === 'lagto' ? 0.16 : 0.42, depthWrite: false });
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
    case 4: for (const s of [-1, 1]) for (let k = 0; k < 2; k++) decal(new THREE.BoxGeometry(0.17, 0.028, 0.01), '#3a6ab8', s * 0.3, cheekY + 0.02 - k * 0.055, s * -0.2); break;
    case 5: decal(new THREE.CircleGeometry(0.016, 10), '#3a2420', 0.2, mouthY + 0.01, 0, V(1, 1, 1), 0.006); break;
  }

  // ---------- Rasgos del linaje en la cara ----------
  if (o.race === 'pelso') {
    // naricilla rosa de gato y bigotes
    decal(new THREE.CircleGeometry(0.036, 3).rotateZ(-PI / 2), '#e8828e', 0, nose.y - 0.015, 0, V(1.35, 0.9, 1), 0.012);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++)
      decal(new THREE.CapsuleGeometry(0.0045, 0.1, 2, 4).rotateZ(PI / 2), '#5a3a30', sx * 0.3, cheekY - 0.01 - k * 0.028, sx * (0.12 - k * 0.12), V(1, 1, 0.5), 0.008);
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
  for (const [kit, gs] of byKit) { const g = mergeGeoms(gs); if (g) finalHair.push({ geo: subdiv(g, 55, 0.014), kit }); }
  const hairGeos = [...finalHair, ...extras].map((h) => h.geo);
  const topRay = new THREE.Group();
  for (const g of hairGeos) topRay.add(new THREE.Mesh(g, faceRay.material));
  const topAt = (x: number, z: number) => {
    const rc = new THREE.Raycaster(V(x, 3, z), V(0, -1, 0));
    const hit = rc.intersectObject(topRay, true)[0] ?? rc.intersectObject(faceRay)[0];
    return hit ? hit.point : V(x, 2.1, z);
  };
  const crest: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (let k = 0; k < 6; k++) {
    const a = 0.45 - k * 0.36, dir = V(0, Math.cos(a), Math.sin(a));
    const rc = new THREE.Raycaster(CENTER.clone().add(dir.clone().multiplyScalar(2)), dir.clone().negate());
    const hit = rc.intersectObjects([topRay, faceRay], true)[0];
    crest.push({ p: hit ? hit.point : CENTER.clone().add(dir.clone().multiplyScalar(0.52)), n: dir });
  }

  // ---------- Complementos ----------
  const accCol = o.accColor ?? '#e8b84a';
  const accMat = extraMat(accCol);
  /** Punto del pelo (o de la cabeza) en una dirección desde el centro, un poco por fuera. */
  const onHair = (dir: THREE.Vector3, out = 0.01) => {
    const d = dir.clone().normalize();
    const hit = new THREE.Raycaster(CENTER.clone().addScaledVector(d, 2), d.clone().negate()).intersectObjects([topRay, faceRay], true)[0];
    return (hit ? hit.point : CENTER.clone().addScaledVector(d, 0.55)).addScaledVector(d, out);
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
    case 1: { const d = V(0.6, 0.6, 0.55); place(flower(0.06, accCol), onHair(d, 0.012), d); break; }
    case 2: {
      const d = V(0.5, 0.8, 0.3), g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 12).rotateZ(sx * PI / 2).translate(sx * 0.08, 0, 0), accMat);
        w.scale.set(1, 1, 0.45);
        g.add(w);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.1, 2, 6), accMat);
        tail.position.set(sx * 0.03, -0.08, 0); tail.rotation.z = sx * 0.35; tail.scale.z = 0.4;
        g.add(tail);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), accMat);
      g.add(knot);
      place(g, onHair(d, 0.02), d, -0.4);
      break;
    }
    case 3: { const d = V(-0.65, 0.6, 0.5); place(new THREE.Mesh(star(0.06, 0.018), accMat), onHair(d, 0.012), d, 0.2); break; }
    case 4: {
      const N = 9;
      for (let k = 0; k < N; k++) {
        const a = -PI * 0.5 + (k / (N - 1)) * PI;
        const d = V(Math.sin(a) * 0.8, 0.6, Math.cos(a) * 0.55 + 0.05);
        place(flower(0.038, k % 2 ? accCol : '#fff4f8', k % 2 ? '#ffd65a' : '#ffb0c8'), onHair(d, 0.01), d, k);
      }
      break;
    }
    case 5: {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) { const a = PI * (0.12 + (k / 12) * 0.76); pts.push(onHair(V(Math.cos(a), Math.sin(a) * 1.05, 0.22), 0.008)); }
      ring(pts, 0.022, accMat);
      break;
    }
    case 6: {
      const d = V(0.7, 0.7, 0.3), g = new THREE.Group();
      const vane = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), accMat);
      vane.scale.set(0.014, 0.19, 0.06); vane.position.y = 0.16;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 4), extraMat('#f4f0e6'));
      shaft.position.y = 0.12;
      g.add(vane, shaft);
      const holder = place(new THREE.Group(), onHair(d, 0), d);
      g.rotation.set(0.7, 0, -0.45);
      holder.add(g);
      break;
    }
  }
  const glassZ = Math.max(onFace(A.eyeX, A.eyeY, 0).z, onFace(-A.eyeX, A.eyeY, 0).z) + 0.03;
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
      g.position.set(x, y, glassZ);
      g.rotation.set(0, s * 0.18, 0);
      decals.push(g);
    }
    return metal;
  };
  const acc = o.acc ?? 0;
  if (acc === 1 || acc === 6) {
    const metal = glasses([-1, 1]);
    const bp = V(0, A.eyeY + 0.005, glassZ + 0.01);
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
    const shadow = new THREE.MeshBasicMaterial({ map: blushMat.map, color: accCol, transparent: true, opacity: 0.75, depthWrite: false });
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
  faceMesh.geometry = subdiv(faceGeo, 70);
  finish(faceMesh);
  for (const h of extras) finish(new THREE.Mesh(h.geo, material(h.kit)));
  for (const h of finalHair) finish(new THREE.Mesh(h.geo, material(h.kit)));
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
  if (mg) finish(new THREE.Mesh(mg, lips ? extraMat('#d4486a') : material(o.face)));
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
    toBone,
    eyes,
    happy,
    anchors: { ear: (s) => V(s * 0.455, 1.47, -0.02), top: (s) => tops[s < 0 ? -1 : 1].clone(), crest },
  };
}

