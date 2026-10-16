import * as THREE from 'three';

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
}

export interface HeadResult {
  group: THREE.Group;
  /** Puntos de anclaje en el espacio de la malla original (pasar por toBone). */
  anchors: { ear: (s: number) => THREE.Vector3; top: (s: number) => THREE.Vector3; crest: { p: THREE.Vector3; n: THREE.Vector3 }[] };
  toBone: THREE.Matrix4;
}

// Celdas de la paleta
const PI = Math.PI;
const C_SKIN = 0, C_SKIN2 = 8, C_HAIR = 1, C_HAIR2 = 9, C_EYE = 10, C_DARK = 2, C_WHITE = 32;
const isSkin = (c: number) => c === C_SKIN || c === C_SKIN2;
const isHairCell = (c: number) => c === C_HAIR || c === C_HAIR2;

const CENTER = new THREE.Vector3(0, 1.62, -0.02);

export const HAIR_STYLES = ['Rapado', 'Corto con flequillo', 'Despeinado', 'Media melena', 'Coleta', 'Moño', 'Dos coletas', 'Cresta', 'Melena larga', 'Trenza'];
export const BEARDS = ['Ninguna', 'Barba completa', 'Barba corta', 'Perilla', 'Bigote', 'Patillas'];
export const EYE_SHAPES = ['Normales', 'Grandes', 'Pequeños', 'Rasgados', 'Dulces', 'Soñolientos', 'Redondos'];
export const BROWS = ['Naturales', 'Finas', 'Gruesas', 'Altas', 'Enfadadas', 'Preocupadas', 'Sin cejas'];
export const NOSES = ['Original', 'Pequeña', 'Grande', 'Respingona', 'Ancha', 'Aguileña', 'Botón'];
export const MOUTHS = ['Sin boca', 'Sonrisa', 'Sonrisa abierta', 'Seria', 'Sorpresa', 'Pícara', 'Colmillo'];
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

function analyse(src: HeadSource): Analysis {
  let a = cache.get(src.kit);
  if (a) return a;
  const T = toTris(src.geometry);
  const hairT = (t: number) => isHairCell(triCell(T, t));
  // fuera ojos (celdas 2 y 10) y cejas originales: se dibujan aparte
  const eyeT = (t: number) => { const c = triCell(T, t); return (c === C_DARK || c === C_EYE) && triCentroid(T, t).z > 0.25; };
  // bordes de piel ocultos bajo el pelo original (frente y sienes): los cubre el cráneo
  const hiddenT = (t: number) => { const c = triCentroid(T, t); return src.kit !== 'Barbarian' && (c.y > 1.64 || (Math.abs(c.x) > 0.38 && c.z < 0.1 && c.y > 1.3)); };
  const face = subset(T, (t) => !hairT(t) && !eyeT(t) && !hiddenT(t));
  const hair = subset(T, (t) => hairT(t) && !isBrow(T, t));
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
  { t: 0, l: 0, dy: 0, rot: 0, arc: 0 },
];

export function buildHead(sources: Record<HeadKit, HeadSource>, o: HeadOptions, material: (kit: HeadKit) => THREE.Material, extraMat: (c: string) => THREE.Material): HeadResult {
  const A = analyse(sources[o.face]);
  const group = new THREE.Group();
  const toBone = A.src.toBone;

  // ---------- Cara ----------
  const F: Tris = { pos: A.face.pos.slice(), uv: A.face.uv.slice(), nrm: A.face.nrm.slice(), count: A.face.count };
  const cellAt = (i: number) => cellOfUV(A.face.uv[i * 2], A.face.uv[i * 2 + 1]);
  const nV = F.count * 3;
  const E = EYE[o.eyeShape] ?? EYE[0], B = BROW[o.brows] ?? BROW[0];
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
      switch (o.nose) {
        case 1: q.multiplyScalar(0.72); break;
        case 2: q.multiplyScalar(1.28); break;
        case 3: q.y += Math.max(0, d.z) * 0.6; q.z *= 0.9; break;
        case 4: q.x *= 1.5; break;
        case 5: q.z *= 1.25; q.y -= Math.max(0, d.z) * 0.35; break;
        case 6: q.multiplyScalar(0.8); q.x *= 1.25; break;
      }
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
    const T = toTris(sk.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sk.attributes.position.count * 2), 2)));
    const keep = subset(T, (t) => { const c = triCentroid(T, t); return c.y > 1.3 && (c.z < 0.12 || c.y > 1.6); });
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
  const hatShrink = o.hat === 'helmet' ? 0.84 : o.hat === 'bear' ? 0.86 : o.hat === 'wizard' ? 0.88 : 1;
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
      hairPieces.push({ geo: blob(0.09, V(0, 1.78, -0.52), V(1, 1, 1)), kit: o.face });
      for (let k = 0; k < 4; k++) hairPieces.push({ geo: blob(0.12 - k * 0.018, V(0, 1.66 - k * 0.15, -0.6 - Math.sin(k * 0.6) * 0.05), V(1, 1.35, 1)), kit: o.face });
      break;
    case 5: // moño
      kitHair('Mage');
      if (!hasHat) hairPieces.push({ geo: blob(0.2, V(0, 2.18, -0.22), V(1, 0.85, 1), new THREE.Euler(), 1), kit: o.face });
      break;
    case 6: // dos coletas
      kitHair('Rogue');
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) hairPieces.push({ geo: blob(0.11 - k * 0.015, V(s * (0.5 + k * 0.03), 1.78 - k * 0.14, -0.18 - k * 0.03), V(1, 1.3, 1)), kit: o.face });
      break;
    case 7: // cresta
      if (!hasHat) for (let k = 0; k < 6; k++) {
        const a = 0.42 - k * 0.38;
        const p = V(0, CENTER.y + Math.cos(a) * 0.52, CENTER.z + Math.sin(a) * 0.5);
        hairPieces.push({ geo: piece(new THREE.ConeGeometry(0.1, 0.32 - Math.abs(k - 2) * 0.03, 4).translate(0, 0.12, 0), hairCell, compose(p, new THREE.Euler(a, 0, 0), V(0.5, 1, 1.4))), kit: o.face });
      }
      break;
    case 8: // melena larga
      kitHair('Rogue');
      for (let k = 0; k < 7; k++) {
        const a = -PI * 0.55 + (k / 6) * PI * 1.1;
        hairPieces.push({ geo: piece(new THREE.CapsuleGeometry(0.1, 0.38, 3, 6), hairCell, compose(V(Math.sin(a) * 0.43, 1.12, -Math.cos(a) * 0.38 - 0.05), new THREE.Euler(Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.12), V(1, 1, 0.8))), kit: o.face });
      }
      break;
    case 9: // trenza
      kitHair('Mage');
      for (let k = 0; k < 6; k++) hairPieces.push({ geo: blob(0.1 - k * 0.008, V((k % 2 ? 0.035 : -0.035), 1.72 - k * 0.13, -0.5 - k * 0.02), V(1, 1.15, 0.95)), kit: o.face });
      hairPieces.push({ geo: piece(new THREE.ConeGeometry(0.07, 0.16, 6).rotateX(PI), hairCell, compose(V(0, 0.95, -0.62), new THREE.Euler(), V(1, 1, 1))), kit: o.face });
      break;
  }

  // ---------- Barba ----------
  const BB = analyse(sources.Barbarian).hair;
  if (o.beard > 0 && BB) {
    const keep = (t: number) => {
      const c = triCentroid(BB, t);
      if (c.y > 1.6 && Math.abs(c.x) < 0.36) return false; // cejas del bárbaro
      switch (o.beard) {
        case 2: return c.y > 1.25 || Math.abs(c.x) > 0.3;
        case 3: return Math.abs(c.x) < 0.17 && c.y < 1.42;
        case 4: return c.y > 1.36 && c.y < 1.48 && Math.abs(c.x) < 0.3 && c.z > 0.3;
        case 5: return Math.abs(c.x) > 0.33 && c.y > 1.3;
        default: return true;
      }
    };
    const beard = subset(BB, keep);
    if (beard.count) hairPieces.push({ geo: toGeometry(beard), kit: 'Barbarian' });
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
  const arc = (r: number, t: number, a0: number, a1: number) => new THREE.TorusGeometry(r, t, 5, 14, a1 - a0).rotateZ(a0);
  const mp = onFace(0, mouthY, 0.006), mr = facing(0, mouthY);
  switch (o.mouth) {
    case 1: mouth.push(piece(arc(0.07, 0.013, PI * 1.18, PI * 1.82), C_DARK, compose(mp.clone().add(V(0, 0.06, 0)), mr, V(1, 0.9, 0.4)))); break;
    case 2: mouth.push(piece(new THREE.CircleGeometry(0.075, 14, PI, PI), C_DARK, compose(mp.clone().add(V(0, 0.012, 0.004)), mr, V(1, 0.85, 1)))); break;
    case 3: mouth.push(piece(new THREE.CapsuleGeometry(0.011, 0.08, 3, 6).rotateZ(PI / 2), C_DARK, compose(mp, mr, V(1, 1, 0.5)))); break;
    case 4: mouth.push(piece(new THREE.TorusGeometry(0.034, 0.012, 5, 14), C_DARK, compose(mp, mr, V(0.85, 1.05, 0.5)))); break;
    case 5: mouth.push(piece(arc(0.06, 0.012, PI * 1.25, PI * 1.85), C_DARK, compose(mp.clone().add(V(0.02, 0.05, 0)), new THREE.Euler(mr.x, mr.y, 0.22), V(1, 0.8, 0.4)))); break;
    case 6:
      mouth.push(piece(arc(0.07, 0.013, PI * 1.18, PI * 1.82), C_DARK, compose(mp.clone().add(V(0, 0.06, 0)), mr, V(1, 0.9, 0.4))));
      mouth.push(piece(new THREE.ConeGeometry(0.018, 0.04, 4).rotateX(PI), C_WHITE, compose(onFace(0.04, mouthY - 0.012, 0.012), mr, V(1, 1, 0.6)), 0.1, 0.1));
      break;
  }

  // ---------- Ojos y cejas ----------
  const decals: THREE.Object3D[] = [];
  const pupil = extraMat('#16101a'), white = extraMat('#ffffff'), lidMat = material(o.face);
  for (const s of [-1, 1]) {
    const x = s * A.eyeX, y = A.eyeY;
    const r = facing(x, y);
    const eye = new THREE.Group();
    eye.position.copy(onFace(x, y, 0.014));
    eye.rotation.set(r.x, r.y, s * E.tilt);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), extraMat(o.eyeColor));
    iris.scale.set(E.rx, E.ry, 0.02);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), pupil);
    pup.scale.set(E.rx * 0.62, E.ry * 0.62, 0.02);
    pup.position.z = 0.006;
    const hl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), white);
    hl.scale.set(E.rx * 0.28, E.ry * 0.24, 0.01);
    hl.position.set(s * -E.rx * 0.3, E.ry * 0.38, 0.016);
    eye.add(iris, pup, hl);
    if (E.lid) {
      const lid = new THREE.Mesh(paintCell(new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI * 0.5), C_SKIN, 0.3, 0.6), lidMat);
      lid.scale.set(E.rx * 1.12, E.ry * 1.12, 0.03);
      lid.position.set(0, -E.ry * (1 - E.lid) * 1.1, 0.012);
      lid.scale.y = E.ry * 1.15;
      eye.add(lid);
    }
    decals.push(eye);
    // ceja
    if (B.t > 0) {
      const by = y + E.ry + 0.055 + B.dy, bx = x + s * 0.01;
      const brow = new THREE.Mesh(piece(new THREE.CapsuleGeometry(B.t, B.l, 3, 8).rotateZ(PI / 2), C_HAIR, M(), 0.3, 0.6), material(o.face));
      const br = facing(bx, by);
      brow.position.copy(onFace(bx, by, B.t * 0.4));
      brow.rotation.set(br.x, br.y, s * -B.rot);
      brow.scale.set(1, 1, 0.55);
      decals.push(brow);
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
  switch (o.detail) {
    case 1: for (const s of [-1, 1]) decal(new THREE.CircleGeometry(0.07, 16), '#f08a8a', s * 0.27, cheekY, 0, V(1, 0.65, 1), 0.006); break;
    case 2: for (const s of [-1, 1]) for (let k = 0; k < 5; k++) decal(new THREE.CircleGeometry(0.011, 6), '#a0603a', s * (0.2 + (k % 3) * 0.045), cheekY + (k % 2 ? 0.03 : -0.01) - (k > 2 ? 0.035 : 0), 0, V(1, 1, 1), 0.006); break;
    case 3: decal(new THREE.BoxGeometry(0.018, 0.2, 0.01), '#b8605a', 0.25, A.eyeY - 0.02, 0.35); break;
    case 4: for (const s of [-1, 1]) for (let k = 0; k < 2; k++) decal(new THREE.BoxGeometry(0.17, 0.028, 0.01), '#3a6ab8', s * 0.3, cheekY + 0.02 - k * 0.055, s * -0.2); break;
    case 5: decal(new THREE.CircleGeometry(0.016, 10), '#3a2420', 0.2, mouthY + 0.01, 0, V(1, 1, 1), 0.006); break;
  }

  // ---------- Anclajes para rasgos del linaje ----------
  const hairGeos = [...hairPieces, ...extras].map((h) => h.geo);
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

  // ---------- Montaje en el espacio del hueso ----------
  const finish = (m: THREE.Mesh) => { m.geometry.applyMatrix4(toBone); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  finish(faceMesh);
  for (const h of extras) finish(new THREE.Mesh(h.geo, material(h.kit)));
  const byKit = new Map<HeadKit, THREE.BufferGeometry[]>();
  for (const h of hairPieces) (byKit.get(h.kit) ?? byKit.set(h.kit, []).get(h.kit)!).push(h.geo);
  for (const [kit, gs] of byKit) { const g = mergeGeoms(gs); if (g) finish(new THREE.Mesh(g, material(kit))); }
  const mg = mergeGeoms(mouth);
  if (mg) finish(new THREE.Mesh(mg, material(o.face)));
  for (const d of decals) {
    d.updateMatrix();
    d.applyMatrix4(toBone);
    d.castShadow = false;
    group.add(d);
  }
  const tops = { [-1]: topAt(-0.27, -0.04), [1]: topAt(0.27, -0.04) } as Record<number, THREE.Vector3>;
  return {
    group,
    toBone,
    anchors: { ear: (s) => V(s * 0.455, 1.47, -0.02), top: (s) => tops[s < 0 ? -1 : 1].clone(), crest },
  };
}

