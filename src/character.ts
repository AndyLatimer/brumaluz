import * as THREE from 'three';
import { paint, softDot, irisTex, Kind } from './paint';
import { Prim, Shape, surfaceNet, skinAndTint, surfaceZ, evalShape, V3 } from './sdf';
import { CharData, RACES, CLASSES, CLOTH, EYES, HAIR_COLORS } from './data';

/** Formas de ojo: tamaño, inclinación (rasgado) y apertura del párpado. */
const EYE_SHAPE = [
  { size: 1, tilt: 0, open: -0.3 },
  { size: 0.95, tilt: 0.12, open: -0.17 },
  { size: 0.9, tilt: 0.26, open: -0.07 },
  { size: 1, tilt: -0.14, open: -0.2 },
  { size: 1.14, tilt: 0.04, open: -0.28 },
  { size: 0.94, tilt: 0, open: -0.02 },
];
/** Cejas: grosor, curvatura, inclinación (+ = cola alta) y altura. */
const BROW = [
  { t: 1, curve: 0.008, tilt: 0.002, dy: 0 },
  { t: 0.6, curve: 0.009, tilt: 0.004, dy: 0.003 },
  { t: 1.6, curve: 0.005, tilt: -0.002, dy: -0.002 },
  { t: 0.9, curve: 0.016, tilt: 0.004, dy: 0.004 },
  { t: 1.1, curve: 0.001, tilt: 0, dy: 0 },
  { t: 1.2, curve: 0.004, tilt: 0.02, dy: -0.005 },
  { t: 1, curve: 0.006, tilt: -0.018, dy: 0.004 },
];
const SNOUT = [
  { z: 0.15, r: 0.04 }, { z: 0.12, r: 0.042 }, { z: 0.18, r: 0.036 }, { z: 0.15, r: 0.052 }, { z: 0.15, r: 0.04 },
];

const PI = Math.PI;
const E = Prim.ell;
const C = Prim.cone;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.cached = true;
    geoCache.set(key, g);
  }
  return g;
}

/** Malla una forma y la convierte en geometría (con pesos de hueso si se piden). */
function sculpt(shape: Shape, cell: number, weightPrims: Prim[] | null, skin: boolean, occluders: Shape[] = []) {
  const m = surfaceNet(shape, cell, occluders);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
  g.setAttribute('ao', new THREE.BufferAttribute(m.ao, 1));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  if (weightPrims) {
    const w = skinAndTint(m.pos, weightPrims, 0.012, skin);
    g.setAttribute('tint', new THREE.BufferAttribute(w.tint, 3));
    if (skin) {
      g.setAttribute('skinIndex', new THREE.BufferAttribute(w.skinIndex, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(w.skinWeight, 4));
    }
  } else {
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(m.pos.length), 3));
  }
  g.computeBoundingSphere();
  return g;
}

type Rot = [number, number, number];
function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: V3 = [0, 0, 0], r: Rot = [0, 0, 0], s: number | V3 = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  m.rotation.set(...r);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  parent.add(m);
  return m;
}
function group(parent: THREE.Object3D, p: V3 = [0, 0, 0], r: Rot = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...p);
  g.rotation.set(...r);
  parent.add(g);
  return g;
}
const sphere = (r: number, w = 22, h = 16, ps = 0, pl = PI * 2, ts = 0, tl = PI) => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl);
const cyl = (rt: number, rb: number, h: number, seg = 18, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const torus = (r: number, t: number, arc = PI * 2, seg = 32) => new THREE.TorusGeometry(r, t, 8, seg, arc);
const spike = (r: number, h: number, seg = 12) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
/** Varilla entre dos puntos. */
function rod(parent: THREE.Object3D, a: V3, b: V3, r: number, mat: THREE.Material) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  parent.add(m);
  return m;
}
/** Superficie a lo largo de -Z (espalda). */
function surfaceBackZ(s: Shape, x: number, y: number) {
  for (let z = -0.35; z < 0.05; z += 0.0008) if (evalShape(s, x, y, z) < 0) return z;
  return 0;
}
/** Orienta un objeto (cuyo eje es +Y) hacia una dirección. */
function aim(o: THREE.Object3D, dir: V3) {
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  return o;
}
const v = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
function mixHex(a: string, b: string, t: number) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

// ---------------------------------------------------------------------------
// Esqueleto
// ---------------------------------------------------------------------------

const BONES = ['hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
  'tail1', 'tail2', 'tail3', 'tail4'] as const;
type BoneName = typeof BONES[number];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i])) as Record<BoneName, number>;
const PARENT: Partial<Record<BoneName, BoneName>> = {
  spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  upperArmL: 'chest', forearmL: 'upperArmL', handL: 'forearmL',
  upperArmR: 'chest', forearmR: 'upperArmR', handR: 'forearmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL',
  thighR: 'hips', shinR: 'thighR', footR: 'shinR',
  tail1: 'hips', tail2: 'tail1', tail3: 'tail2', tail4: 'tail3',
};
const side = (s: number) => (s < 0 ? 'L' : 'R');

interface Rig {
  J: Record<BoneName, V3>;
  W: number; fem: boolean; hs: number; a: number;
  pelvisY: number; spineY: number; chestY: number; shoulderY: number; headY: number;
  hipJY: number; kneeY: number; shoulderX: number; hipX: number; beltY: number;
  arm: Record<'L' | 'R', { sh: V3; el: V3; wr: V3; d: V3 }>;
  leg: Record<'L' | 'R', { hip: V3; knee: V3; ankle: V3; toe: V3 }>;
  tail: V3[];
  pelvisR: V3; ribR: V3; neckR: number;
}

function makeRig(d: CharData): Rig {
  const R = RACES[d.race];
  const fem = d.sex === 1;
  const W = (0.88 + d.build * 0.3) * R.slim;
  const legF = R.leg;
  const hs = R.head * (fem ? 0.97 : 1);
  const ankleY = 0.085;
  const hipJY = 0.86 * legF;
  const kneeY = ankleY + (hipJY - ankleY) * 0.5 + 0.01;
  const pelvisY = hipJY + 0.05;
  const spineY = pelvisY + 0.15;
  const chestY = pelvisY + 0.33;
  const shoulderY = pelvisY + 0.46;
  const headY = pelvisY + 0.615 + (d.race === 'lagto' ? 0.02 : 0);
  const shoulderX = (fem ? 0.158 : 0.185) * W;
  const hipX = (fem ? 0.092 : 0.088) * W;
  const a = 0.68;
  const ak = (d.race === 'elfo' ? 1.03 : 1) * (fem ? 0.95 : 1);
  const Lu = 0.27 * ak, Lf = 0.245 * ak;
  const arm = {} as Rig['arm'];
  const leg = {} as Rig['leg'];
  for (const s of [-1, 1]) {
    const dir: V3 = [s * Math.sin(a), -Math.cos(a), 0];
    const sh: V3 = [s * shoulderX, shoulderY - 0.025, -0.01];
    const el = v(sh, dir, Lu), wr = v(el, dir, Lf);
    arm[side(s)] = { sh, el, wr, d: dir };
    const hip: V3 = [s * hipX, hipJY, 0];
    const knee: V3 = [s * hipX * 0.92, kneeY, 0.005];
    const ankle: V3 = [s * hipX * 0.85, ankleY, -0.01];
    leg[side(s)] = { hip, knee, ankle, toe: v(ankle, [0, -0.05, 0.14]) };
  }
  let tail: V3[] = [];
  if (R.tail === 1) {
    const t1: V3 = [0, pelvisY - 0.06, -0.095];
    const t2 = v(t1, [0, -0.13, -0.11]), t3 = v(t2, [0, -0.05, -0.16]), t4 = v(t3, [0, 0.07, -0.13]);
    tail = [t1, t2, t3, t4, v(t4, [0, 0.12, -0.05])];
  } else if (R.tail === 2) {
    const t1: V3 = [0, pelvisY - 0.07, -0.1];
    const t2 = v(t1, [0, -0.17, -0.13]), t3 = v(t2, [0, -0.2, -0.15]), t4 = v(t3, [0, -0.17, -0.15]);
    tail = [t1, t2, t3, t4, v(t4, [0, -0.1, -0.2])];
  }
  const J = {
    hips: [0, pelvisY, 0], spine: [0, spineY, 0], chest: [0, chestY, 0], neck: [0, shoulderY, -0.01], head: [0, headY, 0],
    upperArmL: arm.L.sh, forearmL: arm.L.el, handL: arm.L.wr, upperArmR: arm.R.sh, forearmR: arm.R.el, handR: arm.R.wr,
    thighL: leg.L.hip, shinL: leg.L.knee, footL: leg.L.ankle, thighR: leg.R.hip, shinR: leg.R.knee, footR: leg.R.ankle,
    tail1: tail[0] ?? [0, pelvisY, -0.08], tail2: tail[1] ?? [0, pelvisY, -0.08], tail3: tail[2] ?? [0, pelvisY, -0.08], tail4: tail[3] ?? [0, pelvisY, -0.08],
  } as Record<BoneName, V3>;
  const lag = d.race === 'lagto' ? 1.08 : 1;
  return {
    J, W, fem, hs, a, pelvisY, spineY, chestY, shoulderY, headY, hipJY, kneeY, shoulderX, hipX,
    beltY: pelvisY + 0.075, arm, leg, tail,
    pelvisR: [(fem ? 0.162 : 0.142) * W, 0.1, (fem ? 0.108 : 0.098) * W * lag],
    ribR: [(fem ? 0.132 : 0.16) * W * lag, 0.15, (fem ? 0.094 : 0.108) * W * lag],
    neckR: (fem ? 0.042 : 0.052) * (d.race === 'lagto' ? 1.2 : 1),
  };
}

// ---------------------------------------------------------------------------
// Cuerpo esculpido
// ---------------------------------------------------------------------------

interface Body { shape: Shape; parts: Record<string, Prim>; group: Record<string, string>; tintPrims: Prim[] }

function bodyShape(rig: Rig, d: CharData): Body {
  const { W, fem } = rig;
  const parts: Record<string, Prim> = {};
  const group: Record<string, string> = {};
  const P = (name: string, p: Prim, bone: BoneName, g = 'torso') => { p.bone = BI[bone]; parts[name] = p; group[name] = g; return p; };
  const lag = d.race === 'lagto' ? 1.08 : 1;

  P('pelvis', E([0, rig.pelvisY, 0], rig.pelvisR), 'hips');
  P('abdomen', E([0, rig.spineY, 0.008], [(fem ? 0.112 : 0.128) * W * lag, 0.12, (fem ? 0.085 : 0.094) * W * lag]), 'spine');
  P('ribcage', E([0, rig.chestY, 0], rig.ribR), 'chest');
  P('neck', C([0, rig.shoulderY - 0.03, -0.012], [0, rig.headY + 0.045, 0], rig.neckR, rig.neckR * 0.9), 'neck');
  for (const s of [-1, 1]) {
    const S = side(s);
    P('glute' + S, E([s * 0.062 * W, rig.pelvisY - 0.035, -0.04 * W], [0.078 * W, 0.085, 0.075 * W * (fem ? 1.12 : 1)]), 'hips');
    if (fem) P('bust' + S, E([s * 0.06 * W, rig.chestY + 0.015, 0.068 * W], [0.058 * W, 0.056, 0.05]), 'chest');
    else P('pec' + S, E([s * 0.07 * W, rig.chestY + 0.04, 0.06 * W * lag], [0.078 * W, 0.056, 0.05]), 'chest');
    P('trap' + S, C([s * 0.03, rig.shoulderY + 0.03, -0.02], [s * (rig.shoulderX - 0.045), rig.shoulderY - 0.018, -0.012], fem ? 0.032 : 0.044, fem ? 0.03 : 0.04), 'chest');

    const A = rig.arm[S], aw = W * (fem ? 0.86 : 1) * lag;
    const ag = 'arm' + S;
    const mus = fem ? 1 : 1.1;
    P('delt' + S, E(v(A.sh, [s * 0.008, 0, 0]), [0.052 * aw * mus, 0.054 * aw * mus, 0.055 * aw * mus]), `upperArm${S}`, ag);
    P('uarm' + S, C(v(A.sh, A.d, 0.02), A.el, 0.047 * aw * mus, 0.038 * aw), `upperArm${S}`, ag);
    P('farm' + S, C(v(A.el, A.d, 0.02), A.wr, 0.04 * aw * mus, 0.027 * aw), `forearm${S}`, ag);
    if (!fem) P('bicep' + S, E(v(v(A.sh, A.d, 0.14), [0, 0, 0.012]), [0.04 * aw, 0.045 * aw, 0.04 * aw]), `upperArm${S}`, ag);

    const L = rig.leg[S], lw = W * (fem ? 1.04 : 1);
    const lg = 'leg' + S;
    P('thigh' + S, C(v(L.hip, [0, 0.03, 0]), L.knee, 0.086 * lw, 0.054 * lw), `thigh${S}`, lg);
    P('knee' + S, E(v(L.knee, [0, 0, 0.012]), [0.044 * lw, 0.048, 0.044 * lw]), `shin${S}`, lg);
    P('calf' + S, C(L.knee, L.ankle, 0.052 * lw, 0.032 * lw), `shin${S}`, lg);
    P('calfM' + S, E(v(L.knee, [0, -0.13, -0.022]), [0.047 * lw, 0.1, 0.048 * lw]), `shin${S}`, lg);
    const paw = d.race === 'pelso';
    P('foot' + S, C(v(L.ankle, [0, -0.035, -0.005]), paw ? v(L.toe, [0, 0.005, -0.02]) : L.toe, paw ? 0.044 : 0.04, paw ? 0.042 : d.race === 'lagto' ? 0.04 : 0.034), `foot${S}`, lg);
    P('heel' + S, E(v(L.ankle, [0, -0.045, -0.03]), [0.033, 0.035, 0.04]), `foot${S}`, lg);
  }
  if (rig.tail.length) {
    const cat = RACES[d.race].tail === 1;
    const rr = cat ? [0.034, 0.032, 0.031, 0.03, 0.022] : [0.075, 0.058, 0.043, 0.028, 0.008];
    for (let i = 0; i < 4; i++) P('tail' + i, C(rig.tail[i], rig.tail[i + 1], rr[i], rr[i + 1]), `tail${i + 1}` as BoneName, 'tail');
  }

  // Zonas de color (sólo tiñen, no cambian la forma)
  const tintPrims: Prim[] = [];
  const T = (p: Prim, bone: BoneName, t: V3) => { p.bone = BI[bone]; p.tint = t; tintPrims.push(p); };
  if (d.race === 'lagto') {
    T(E([0, rig.spineY + 0.04, 0.07 * W], [0.075 * W, 0.22, 0.03]), 'spine', [0.9, 0, 0]);
    for (const s of [-1, 1]) T(E(v(rig.leg[side(s)].knee, [0, 0.12, 0.06]), [0.035, 0.12, 0.03]), `thigh${side(s)}` as BoneName, [0.6, 0, 0]);
  }
  if (d.race === 'pelso' && d.detail === 2) {
    T(E([0, rig.chestY + 0.06, 0.09 * W], [0.07, 0.11, 0.03]), 'chest', [1, 0, 0]);
    for (const s of [-1, 1]) T(E(v(rig.leg[side(s)].toe, [0, 0, -0.04]), [0.06, 0.05, 0.1]), `foot${side(s)}` as BoneName, [1, 0, 0]);
  }

  // rubor pintado en rodillas, codos y hombros (piel desnuda)
  if (RACES[d.race].skinKind === 'skin') for (const s of [-1, 1]) {
    const S = side(s);
    T(E(v(rig.leg[S].knee, [0, 0, 0.04]), [0.04, 0.045, 0.03]), `shin${S}` as BoneName, [0, 0, 0.45]);
    T(E(v(rig.arm[S].el, [0, 0, -0.03]), [0.03, 0.035, 0.03]), `forearm${S}` as BoneName, [0, 0, 0.35]);
    T(E(v(rig.arm[S].sh, [s * 0.02, 0.035, 0]), [0.045, 0.03, 0.05]), `upperArm${S}` as BoneName, [0, 0, 0.25]);
  }

  const torso: Prim[] = [], limbs: Record<string, Prim[]> = {};
  for (const [k, p] of Object.entries(parts)) {
    if (group[k] === 'torso') torso.push(p);
    else (limbs[group[k]] ??= []).push(p);
  }
  const shape: Shape = { torso, limbs: Object.values(limbs), kT: 0.07, kL: 0.03, kJ: 0.05 };

  // Detalles anatómicos sobre la forma base
  const detail: Prim[] = [];
  const D = (name: string, p: Prim, bone: BoneName) => { p.bone = BI[bone]; detail.push(p); parts[name] = p; group[name] = 'detail'; return p; };
  const fz = (x: number, y: number) => surfaceZ(shape, x, y, 0.4);
  const bz = (x: number, y: number) => surfaceBackZ(shape, x, y);
  for (const s of [-1, 1]) {
    const S = side(s);
    // clavículas
    const ya = rig.shoulderY - 0.035, yb = rig.shoulderY - 0.014;
    const xa = s * 0.02, xb = s * (rig.shoulderX - 0.035);
    D('clav' + S, C([xa, ya, fz(xa, ya) - 0.006], [xb, yb, fz(xb, yb) - 0.007], 0.0085, 0.0075), 'chest');
    // omóplatos
    const yo = rig.chestY + 0.07, xo = s * 0.065;
    D('blade' + S, E([xo, yo, bz(xo, yo) + 0.01], [0.045, 0.055, 0.016]), 'chest');
    // codo y tobillos
    const A = rig.arm[S];
    D('elbow' + S, E(v(A.el, [0, 0, -0.03]), [0.016, 0.018, 0.016]), `forearm${S}` as BoneName);
    const L = rig.leg[S];
    for (const o of [-1, 1]) D(`ankle${S}${o}`, E(v(L.ankle, [o * 0.026, 0.006, -0.004]), [0.011, 0.013, 0.012]), `foot${S}` as BoneName);
    // dedos de los pies
    if (d.race === 'humano' || d.race === 'elfo') {
      for (let i = 0; i < 5; i++) {
        const big = i === 0;
        const x = L.toe[0] - s * 0.024 + s * i * 0.0115;
        D(`toe${S}${i}`, E([x, 0.024 - i * 0.0015, L.toe[2] + 0.028 - i * 0.007], big ? [0.0125, 0.012, 0.016] : [0.0095 - i * 0.0006, 0.0095, 0.012]), `foot${S}` as BoneName);
      }
    } else if (d.race === 'pelso') {
      for (let i = 0; i < 4; i++) {
        const x = L.toe[0] + s * (-0.027 + i * 0.018);
        D(`toe${S}${i}`, E([x, 0.03, L.toe[2] + 0.008 - Math.abs(i - 1.5) * 0.006], [0.013, 0.013, 0.015]), `foot${S}` as BoneName);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = L.toe[0] + s * (-0.022 + i * 0.022);
        D(`toe${S}${i}`, C([x, 0.03, L.toe[2] - 0.01], [x * 1.0 + s * (i - 1) * 0.008, 0.014, L.toe[2] + 0.045 - Math.abs(i - 1) * 0.012], 0.014, 0.009), `foot${S}` as BoneName);
      }
    }
  }
  // abdominales sutiles (más marcados con más complexión)
  if (!fem && d.build > 0.2) for (let r = 0; r < 3; r++) for (const s of [-1, 1]) {
    const x = s * 0.026 * W, y = rig.spineY + 0.075 - r * 0.052;
    D(`abs${r}${s}`, E([x, y, fz(x, y) - 0.0115], [0.026 * W, 0.024, 0.0125]), 'spine');
  }
  shape.detail = detail;
  shape.kD = 0.012;
  // ombligo
  const ny = rig.spineY - 0.04;
  shape.sub = [E([0, ny, fz(0, ny) - 0.001], [0.0055, 0.008, 0.008])];
  shape.kS = 0.006;
  return { shape, parts, group, tintPrims };
}

/** Prenda ajustada: copia engordada de piezas del cuerpo, recortada con planos. */
type Plane = [V3, V3]; // normal, punto (se conserva el lado n·(x-p) <= 0)
const keepAbove = (y: number): Plane => [[0, -1, 0], [0, y, 0]];
const keepBelow = (y: number): Plane => [[0, 1, 0], [0, y, 0]];

function garment(body: Body, keys: string[], t: number, planes: Plane[], perPart: (k: string) => Plane[] = () => [], extra: { torso?: Prim[]; limbs?: Record<string, Prim[]> } = {}): Shape {
  const torso: Prim[] = [], limbs: Record<string, Prim[]> = {};
  const cutAll = (p: Prim, k: string | null) => {
    for (const [n, q] of [...planes, ...(k ? perPart(k) : [])]) p.cut(n[0], n[1], n[2], q[0], q[1], q[2]);
    return p;
  };
  for (const k of keys) {
    const src = body.parts[k];
    if (!src) continue;
    const p = cutAll(src.inflate(t), k);
    if (body.group[k] === 'torso') torso.push(p);
    else (limbs[body.group[k]] ??= []).push(p);
  }
  for (const p of extra.torso ?? []) torso.push(cutAll(p, null));
  for (const [g, ps] of Object.entries(extra.limbs ?? {})) for (const p of ps) (limbs[g] ??= []).push(cutAll(p, null));
  return { torso, limbs: Object.values(limbs), kT: 0.07, kL: 0.03, kJ: 0.05 };
}

const TORSO_KEYS = ['pelvis', 'abdomen', 'ribcage', 'pecL', 'pecR', 'bustL', 'bustR', 'trapL', 'trapR', 'gluteL', 'gluteR'];
const ARM_KEYS = ['deltL', 'deltR', 'uarmL', 'uarmR', 'bicepL', 'bicepR', 'farmL', 'farmR'];
const LEG_KEYS = ['thighL', 'thighR', 'kneeL', 'kneeR', 'calfL', 'calfR', 'calfML', 'calfMR'];
const FOOT_KEYS = ['footL', 'footR', 'heelL', 'heelR'];

// ---------------------------------------------------------------------------
// Cabeza, pelo, barba y manos (mallas rígidas de alta resolución)
// ---------------------------------------------------------------------------

interface HeadInfo { cy: number; eye: (s: number) => V3; eyeR: number; eyeYaw: number }

function headInfo(rig: Rig, d: CharData): HeadInfo {
  const hs = rig.hs, cy = 0.105 * hs;
  const P = (x: number, y: number, z: number): V3 => [x * hs, cy + y * hs, z * hs];
  const k = EYE_SHAPE[d.eyeShape]?.size ?? 1;
  if (d.race === 'pelso') return { cy, eye: (s) => P(s * 0.042, 0.003, 0.074), eyeR: 0.025 * hs * k, eyeYaw: 0.15 };
  if (d.race === 'lagto') return { cy, eye: (s) => P(s * 0.054, 0.012, 0.047), eyeR: 0.02 * hs * k, eyeYaw: 0.55 };
  return { cy, eye: (s) => P(s * 0.04, 0, 0.079), eyeR: (rig.fem ? 0.0235 : 0.022) * hs * k, eyeYaw: 0.12 };
}

function headShape(rig: Rig, d: CharData): { shape: Shape; tints: Prim[] } {
  const hs = rig.hs, cy = 0.105 * hs, fem = rig.fem;
  const P = (x: number, y: number, z: number): V3 => [x * hs, cy + y * hs, z * hs];
  const r3 = (a: number, b: number, c: number): V3 => [a * hs, b * hs, c * hs];
  const torso: Prim[] = [], limbs: Prim[][] = [], sub: Prim[] = [], tints: Prim[] = [];
  const tint = (p: Prim, t: V3) => { p.tint = t; return p; };
  const blush: V3 = [0, 0, fem ? 0.75 : 0.4];
  const ek = EYE_SHAPE[d.eyeShape]?.size ?? 1;

  if (d.race === 'pelso') {
    torso.push(E(P(0, 0.005, -0.005), r3(0.1, 0.1, 0.098)));
    torso.push(E(P(0, 0.025, 0.072), r3(0.065, 0.02, 0.02)));
    for (const s of [-1, 1]) {
      torso.push(tint(E(P(s * 0.058, -0.045, 0.025), r3(0.052, 0.045, 0.055)), [0, 0, 0.3]));
      torso.push(E(P(s * 0.017, -0.047, 0.083), r3(0.025, 0.021, 0.022)));
      limbs.push([C(P(s * 0.052, 0.07, -0.005), P(s * 0.08, 0.168, -0.015), 0.04 * hs, 0.007 * hs)]);
      sub.push(E(P(s * 0.042, 0.003, 0.088), r3(0.03 * ek, 0.025 * ek, 0.022)));
      if (d.detail === 3) tints.push(tint(E(P(s * 0.045, 0.01, 0.07), r3(0.045, 0.035, 0.04)), [0, 0.9, 0]));
    }
    torso.push(E(P(0, -0.072, 0.07), r3(0.02, 0.016, 0.018)));
    if (d.detail === 2) tints.push(tint(E(P(0, -0.065, 0.075), r3(0.055, 0.04, 0.04)), [1, 0, 0]));
    return { shape: { torso, limbs, sub, kT: 0.04, kL: 0.01, kJ: 0.03, kS: 0.012 }, tints };
  }

  if (d.race === 'lagto') {
    torso.push(E(P(0, 0.015, -0.02), r3(0.082, 0.083, 0.092)));
    const sn = SNOUT[d.nose] ?? SNOUT[0];
    torso.push(C(P(0, -0.015, 0.03), P(0, -0.04, sn.z), 0.062 * hs, sn.r * hs));
    torso.push(tint(E(P(0, -0.06, 0.055), r3(0.06, 0.035, 0.085)), [0.8, 0, 0]));
    torso.push(tint(E(P(0, -0.085, 0), r3(0.05, 0.04, 0.05)), [0.8, 0, 0]));
    for (const s of [-1, 1]) {
      torso.push(E(P(s * 0.045, 0.035, 0.055), r3(0.034, 0.016, 0.03)));
      torso.push(E(P(s * 0.055, -0.03, 0.03), r3(0.035, 0.03, 0.04)));
      sub.push(E(P(s * 0.052, 0.012, 0.058), r3(0.024 * ek, 0.02 * ek, 0.022)));
      sub.push(E(P(s * (0.016 + (sn.r - 0.04) * 0.6), -0.028, sn.z + 0.033 + (sn.r - 0.04) * 0.4), r3(0.006, 0.005, 0.008)));
    }
    return { shape: { torso, limbs, sub, kT: 0.04, kL: 0.01, kJ: 0.02, kS: 0.01 }, tints };
  }

  // humano / elfo
  torso.push(E(P(0, 0, -0.005), fem ? r3(0.093, 0.108, 0.104) : r3(0.097, 0.112, 0.107)));
  torso.push(E(P(0, -0.046, 0.025), fem ? r3(0.068, 0.064, 0.078) : r3(0.076, 0.07, 0.082)));
  torso.push(E(P(0, -0.092, 0.062), fem ? r3(0.026, 0.022, 0.022) : r3(0.036, 0.027, 0.027)));
  torso.push(E(P(0, 0.03, 0.083), r3(0.07, 0.02, 0.022)));
  for (const s of [-1, 1]) {
    if (!fem) torso.push(E(P(s * 0.058, -0.072, 0.018), r3(0.03, 0.028, 0.034)));
    torso.push(tint(E(P(s * 0.05, -0.035, 0.062), r3(0.032, 0.028, 0.028)), blush));
    sub.push(E(P(s * 0.04, 0, 0.092), r3(0.027 * ek, 0.021 * ek, 0.02)));
    if (d.race === 'elfo') limbs.push([C(P(s * 0.088, -0.01, -0.005), P(s * 0.168, 0.058, -0.048), 0.017 * hs, 0.003 * hs)]);
    else limbs.push([E(P(s * 0.094, -0.01, -0.005), r3(0.013, 0.03, 0.02))]);
  }
  const n = (fem ? 0.85 : 1) * (d.nose === 4 ? 0.72 : 1);
  const zt = (z: number) => z - (1 - n) * 0.01;
  if (d.nose === 1) limbs.push([
    C(P(0, -0.004, 0.094), P(0, -0.024, zt(0.11)), 0.006 * hs * n, 0.01 * hs * n),
    E(P(0, -0.027, zt(0.108)), r3(0.014 * n, 0.011 * n, 0.012 * n)),
  ]);
  else if (d.nose === 2) limbs.push([
    C(P(0, 0, 0.094), P(0, -0.03, zt(0.11)), 0.009 * hs * n, 0.013 * hs * n),
    E(P(0, -0.035, zt(0.106)), r3(0.02 * n, 0.012 * n, 0.012 * n)),
    E(P(-0.015, -0.037, zt(0.099)), r3(0.009 * n, 0.008 * n, 0.008 * n)),
    E(P(0.015, -0.037, zt(0.099)), r3(0.009 * n, 0.008 * n, 0.008 * n)),
  ]);
  else if (d.nose === 3) limbs.push([
    C(P(0, 0.004, 0.095), P(0, -0.033, zt(0.117)), 0.008 * hs * n, 0.011 * hs * n),
    E(P(0, -0.013, zt(0.111)), r3(0.007 * n, 0.01 * n, 0.008 * n)),
    E(P(0, -0.039, zt(0.11)), r3(0.011 * n, 0.012 * n, 0.011 * n)),
  ]);
  else limbs.push([
    C(P(0, 0, 0.094), P(0, -0.03, zt(0.113)), 0.008 * hs * n, 0.012 * hs * n),
    E(P(0, -0.034, zt(0.108)), r3(0.014 * n, 0.011 * n, 0.011 * n)),
  ]);
  const shape: Shape = { torso, limbs, sub, kT: 0.04, kL: 0.01, kJ: 0.016, kS: 0.012 };
  // labios esculpidos sobre la cara, con color
  const lip = fem ? 1 : 0.55;
  const yU = -0.058, yL = -0.0705;
  const rU = fem ? r3(0.0175, 0.0058, 0.008) : r3(0.018, 0.005, 0.007);
  const rL = fem ? r3(0.0158, 0.0078, 0.0088) : r3(0.016, 0.0065, 0.0075);
  const zU = surfaceZ(shape, 0, cy + yU * hs) - rU[2] * 0.5;
  const zL = surfaceZ(shape, 0, cy + yL * hs) - rL[2] * 0.45;
  shape.detail = [tint(E([0, cy + yU * hs, zU], rU), [0, 0, lip]), tint(E([0, cy + yL * hs, zL], rL), [0, 0, lip])];
  shape.kD = 0.006;
  return { shape, tints };
}

function hairShape(rig: Rig, d: CharData): Shape | null {
  const hs = rig.hs, cy = 0.105 * hs, fem = rig.fem;
  const P = (x: number, y: number, z: number): V3 => [x * hs, cy + y * hs, z * hs];
  const r3 = (a: number, b: number, c: number): V3 => [a * hs, b * hs, c * hs];
  const style = d.hair;
  const torso: Prim[] = [], limbs: Prim[][] = [];

  if (d.race === 'lagto') {
    if (style === 0) return null;
    if (style === 1) for (let i = 0; i < 7; i++) {
      const f = 0.9 - i * 0.42, base = P(0, Math.sin(f) * 0.08 + 0.015, Math.cos(f) * 0.09 - 0.02);
      limbs.push([C(base, v(base, [0, Math.sin(f) * 0.06 * hs, Math.cos(f) * 0.06 * hs], 1 - i * 0.07), 0.018 * hs, 0.003 * hs)]);
    }
    if (style === 2) {
      torso.push(E(P(0, -0.005, -0.075), r3(0.15, 0.12, 0.012)));
      for (let i = 0; i < 7; i++) {
        const a = -PI * 0.1 + (i / 6) * PI * 1.2;
        limbs.push([C(P(0, 0, -0.07), P(Math.cos(a) * 0.15, Math.sin(a) * 0.12 - 0.005, -0.08), 0.01 * hs, 0.004 * hs)]);
      }
    }
    if (style === 3) for (const s of [-1, 1]) limbs.push([
      C(P(s * 0.04, 0.075, 0), P(s * 0.065, 0.11, -0.07), 0.022 * hs, 0.015 * hs),
      C(P(s * 0.065, 0.11, -0.07), P(s * 0.06, 0.1, -0.16), 0.015 * hs, 0.003 * hs),
    ]);
    if (style === 4) {
      torso.push(E(P(0, 0.075, -0.05), r3(0.008, 0.06, 0.1)));
      for (let i = 0; i < 4; i++) limbs.push([C(P(0, 0.07, 0.02 - i * 0.045), P(0, 0.15 - i * 0.012, -0.01 - i * 0.05), 0.008 * hs, 0.003 * hs)]);
    }
    if (style === 5) for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      const base = P(Math.cos(a) * 0.06, 0.07, Math.sin(a) * 0.06 - 0.02);
      limbs.push([C(base, v(base, [Math.cos(a) * 0.025 * hs, 0.05 * hs, Math.sin(a) * 0.025 * hs]), 0.013 * hs, 0.002 * hs)]);
    }
    if (style === 6) for (const s of [-1, 1]) limbs.push([
      C(P(s * 0.035, 0.075, 0.01), P(s * 0.06, 0.13, -0.06), 0.024 * hs, 0.017 * hs),
      C(P(s * 0.06, 0.13, -0.06), P(s * 0.07, 0.15, -0.17), 0.017 * hs, 0.01 * hs),
      C(P(s * 0.07, 0.15, -0.17), P(s * 0.06, 0.12, -0.25), 0.01 * hs, 0.002 * hs),
    ]);
    return { torso, limbs, kT: 0.03, kL: 0.01, kJ: 0.02 };
  }

  if (style === 0) return null;
  const pel = d.race === 'pelso';
  const capR = pel ? r3(0.11, 0.112, 0.11) : fem ? r3(0.105, 0.12, 0.116) : r3(0.107, 0.122, 0.117);
  const cap = E(P(0, 0.012, -0.008), style === 7 ? r3(0.1, 0.115, 0.11) : capR);
  // nuca: más baja por detrás que por los lados
  const nape = P(0, -0.03, 0);
  cap.cut(0, -1, 0.6, nape[0], nape[1], nape[2]);
  torso.push(cap);
  const fringe = () => {
    for (let i = -2; i <= 2; i++) {
      const x = i * 0.026;
      limbs.push([C(P(x, 0.085, 0.055), P(x * 1.15 + 0.008, 0.052 - Math.abs(i) * 0.006, 0.108), 0.024 * hs, 0.011 * hs)]);
    }
  };
  if (style === 1) {
    torso.push(E(P(0, 0.07, 0.01), r3(0.09, 0.065, 0.1)));
    fringe();
    if (!fem) for (const s of [-1, 1]) limbs.push([C(P(s * 0.09, 0, 0.02), P(s * 0.088, -0.04, 0.03), 0.012 * hs, 0.008 * hs)]);
  }
  if (style === 2) {
    const back = C(P(0, 0, -0.055), P(0, -0.25, -0.075), 0.1 * hs, 0.088 * hs);
    const lo = P(0, -0.27, 0); back.above(lo[1]);
    torso.push(back);
    torso.push(E(P(0, 0.07, 0.01), r3(0.09, 0.06, 0.1)));
    torso.push(E(P(0.025, 0.065, 0.075), r3(0.07, 0.032, 0.04)));
    for (const s of [-1, 1]) {
      const c = C(P(s * 0.078, 0.02, 0.035), P(s * 0.095, -0.22, 0.005), 0.032 * hs, 0.026 * hs);
      c.above(lo[1] + 0.02 * hs);
      limbs.push([c]);
    }
  }
  if (style === 3) {
    fringe();
    torso.push(E(P(0, 0.07, -0.115), r3(0.028, 0.028, 0.028)));
    limbs.push([
      C(P(0, 0.07, -0.125), P(0, -0.02, -0.172), 0.04 * hs, 0.036 * hs),
      C(P(0, -0.02, -0.172), P(0, -0.16, -0.16), 0.036 * hs, 0.024 * hs),
      C(P(0, -0.16, -0.16), P(0, -0.26, -0.13), 0.024 * hs, 0.006 * hs),
    ]);
  }
  if (style === 4) {
    torso.push(E(P(0, 0.115, -0.055), r3(0.055, 0.05, 0.055)));
    for (const s of [-1, 1]) limbs.push([C(P(s * 0.075, 0.04, 0.065), P(s * 0.085, -0.075, 0.06), 0.013 * hs, 0.006 * hs)]);
  }
  if (style === 5) {
    const bob = E(P(0, -0.03, -0.015), r3(0.122, 0.115, 0.122));
    const lo = P(0, -0.1, 0);
    bob.above(lo[1]);
    torso.push(bob);
    torso.push(E(P(0, 0.06, 0.085), r3(0.085, 0.03, 0.035)));
  }
  if (style === 6) {
    fringe();
    for (const s of [-1, 1]) {
      const braid: Prim[] = [];
      for (let k = 0; k < 8; k++) {
        const f = k / 7;
        braid.push(E(P(s * (0.088 + f * 0.012 + (k % 2 ? 0.006 : -0.006)), -0.03 - f * 0.27, 0.015 + f * 0.06), r3(0.022 - k * 0.0015, 0.024, 0.022 - k * 0.0015)));
      }
      limbs.push(braid);
    }
  }
  if (style === 7) {
    for (let i = 0; i < 7; i++) {
      const f = 1.25 - i * 0.36;
      const base = P(0, Math.sin(f) * 0.115 + 0.012, Math.cos(f) * 0.11 - 0.01);
      limbs.push([C(base, v(base, [0, Math.sin(f) * 0.085 * hs, Math.cos(f) * 0.085 * hs]), 0.03 * hs, 0.006 * hs)]);
    }
  }
  const fib = (n: number, f: (x: number, y: number, z: number) => void) => {
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      f(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  };
  if (style === 8) {
    torso.push(E(P(0, 0.07, 0), r3(0.092, 0.065, 0.1)));
    fib(26, (x, y, z) => {
      if (y < 0.15 || (z > 0.6 && y < 0.55)) return;
      const base = P(x * 0.095, 0.02 + y * 0.1, z * 0.1);
      limbs.push([C(base, v(base, [x * 0.07 * hs, y * 0.05 * hs + 0.012 * hs, z * 0.07 * hs]), 0.028 * hs, 0.006 * hs)]);
    });
    fringe();
  }
  if (style === 9) {
    fib(70, (x, y, z) => {
      if (y < -0.4 || (z > 0.55 && y < 0.5)) return;
      limbs.push([E(P(x * 0.115, 0.014 + y * 0.128, z * 0.12 - 0.008), r3(0.027, 0.027, 0.027))]);
    });
  }
  if (style === 10) {
    fringe();
    for (const s of [-1, 1]) {
      torso.push(E(P(s * 0.1, 0.045, -0.045), r3(0.024, 0.024, 0.024)));
      limbs.push([
        C(P(s * 0.11, 0.045, -0.05), P(s * 0.16, -0.05, -0.06), 0.036 * hs, 0.03 * hs),
        C(P(s * 0.16, -0.05, -0.06), P(s * 0.17, -0.2, -0.04), 0.03 * hs, 0.008 * hs),
      ]);
    }
  }
  if (style === 11) {
    torso.push(E(P(-0.02, 0.075, 0.02), r3(0.1, 0.055, 0.1)));
    torso.push(E(P(0.035, 0.06, 0.08), r3(0.07, 0.03, 0.04)));
    limbs.push([C(P(0.075, 0.05, 0.07), P(0.095, -0.04, 0.055), 0.022 * hs, 0.012 * hs)]);
    limbs.push([C(P(-0.09, 0, 0.02), P(-0.088, -0.035, 0.03), 0.011 * hs, 0.007 * hs)]);
  }
  if (style === 12) {
    const ball = E(P(0, 0.06, -0.015), r3(0.165, 0.16, 0.16));
    ball.above(P(0, -0.06, 0)[1]);
    torso.push(ball);
    fib(36, (x, y, z) => {
      if (y < -0.5 || (z > 0.5 && y < 0.3)) return;
      limbs.push([E(P(x * 0.16, 0.06 + y * 0.155, z * 0.155 - 0.015), r3(0.035, 0.035, 0.035))]);
    });
  }
  if (style === 13) {
    torso.push(E(P(0, 0.11, -0.03), r3(0.032, 0.02, 0.032)));
    torso.push(E(P(0, 0.148, -0.03), r3(0.034, 0.045, 0.034)));
  }
  if (style === 14) {
    torso.push(E(P(0, 0.07, 0.01), r3(0.09, 0.06, 0.1)));
    torso.push(E(P(0.025, 0.065, 0.075), r3(0.07, 0.032, 0.04)));
    for (let k = 0; k < 8; k++) {
      const w = k % 2 ? 0.02 : -0.02;
      const p = E(P(w, -0.02 - k * 0.05, -0.07 - (k % 2 ? 0.012 : 0)), r3(0.105 - k * 0.004, 0.045, 0.06));
      torso.push(p);
    }
    for (const s of [-1, 1]) {
      const lock: Prim[] = [];
      for (let k = 0; k < 6; k++) lock.push(E(P(s * (0.085 + (k % 2 ? 0.014 : 0)), -k * 0.05, 0.03 - k * 0.004), r3(0.028, 0.04, 0.028)));
      limbs.push(lock);
    }
  }
  // recorte de la cara (frente y mejillas despejadas)
  const sub = [E(P(0, -0.06, 0.14), r3(0.105, 0.115, 0.1))];
  return { torso, limbs, sub, kT: 0.03, kL: 0.018, kJ: 0.025, kS: 0.02 };
}

function beardShape(rig: Rig, d: CharData): Shape | null {
  if (rig.fem || d.detail === 0 || d.race === 'pelso' || d.race === 'lagto') return null;
  const hs = rig.hs, cy = 0.105 * hs;
  const P = (x: number, y: number, z: number): V3 => [x * hs, cy + y * hs, z * hs];
  const r3 = (a: number, b: number, c: number): V3 => [a * hs, b * hs, c * hs];
  const torso: Prim[] = [], limbs: Prim[][] = [], sub: Prim[] = [];
  for (const s of [-1, 1]) limbs.push([C(P(s * 0.004, -0.046, 0.108), P(s * 0.036, -0.062, 0.098), 0.0095 * hs, 0.0055 * hs)]);
  const st = d.detail;
  if (st === 2) torso.push(E(P(0, -0.106, 0.07), r3(0.02, 0.03, 0.018)));
  if (st >= 3) {
    const shell = E(P(0, -0.055, 0.03), st === 3 ? r3(0.087, 0.078, 0.087) : r3(0.092, 0.088, 0.093));
    const top = P(0, -0.022, 0), back = P(0, 0, -0.035);
    shell.below(top[1]);
    shell.cut(0, 0, -1, 0, 0, back[2]);
    torso.push(shell);
    if (st >= 4) torso.push(E(P(0, -0.115, 0.058), r3(0.045, 0.04, 0.036)));
    if (st === 5) torso.push(C(P(0, -0.1, 0.06), P(0, -0.24, 0.075), 0.05 * hs, 0.016 * hs));
    sub.push(E(P(0, -0.064, 0.1), r3(0.022, 0.0095, 0.03)));
  }
  return { torso, limbs, sub, kT: 0.03, kL: 0.01, kJ: 0.02, kS: 0.006 };
}

/** Cejas esculpidas: se afinan hacia la cola y siguen la curva de la frente. */
function browShape(rig: Rig, d: CharData, head: Shape): Shape | null {
  if (d.race === 'lagto') return null;
  const hs = rig.hs, cy = 0.105 * hs;
  const b = BROW[d.brows] ?? BROW[0];
  const ey = (d.race === 'pelso' ? 0.003 : 0) + 0.042 + b.dy;
  const limbs: Prim[][] = [];
  for (const s of [-1, 1]) {
    const pts: V3[] = [], rs: number[] = [];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = s * (0.017 + 0.053 * u) * hs;
      const y = cy + (ey + b.curve * Math.sin(PI * (0.12 + 0.8 * u)) + b.tilt * u - 0.004 * u * u) * hs;
      pts.push([x, y, surfaceZ(head, x, y) - 0.0006]);
      rs.push((rig.fem ? 0.0026 : 0.0042) * b.t * (1 - 0.6 * u) * hs + 0.0006);
    }
    const chain: Prim[] = [];
    for (let i = 0; i < N - 1; i++) chain.push(C(pts[i], pts[i + 1], rs[i], rs[i + 1]));
    limbs.push(chain);
  }
  return { torso: [], limbs, kT: 0.002, kL: 0.003, kJ: 0.002 };
}

/** Mano en un marco canónico: muñeca en el origen, dedos hacia -Y, palma hacia -s·X. */
function handShape(d: CharData, s: number): { shape: Shape; tips: { tip: V3; dir: V3 }[] } {
  const k = (d.sex === 1 ? 0.9 : 1) * (d.race === 'lagto' ? 1.05 : 1);
  const p = (x: number, y: number, z: number): V3 => [x * k, y * k, z * k];
  const paw = d.race === 'pelso';
  const torso = [
    E(p(0, -0.045, 0), p(0.017, 0.042, 0.036)),
    C(p(0, 0.02, 0), p(0, -0.015, 0), 0.025 * k, 0.024 * k),
    E(p(-s * 0.004, -0.035, 0.024), p(0.014, 0.022, 0.016)),
  ];
  const limbs: Prim[][] = [];
  const tips: { tip: V3; dir: V3 }[] = [];
  const zs = [0.025, 0.008, -0.009, -0.025], Ls = [0.048, 0.054, 0.05, 0.04];
  for (let i = 0; i < 4; i++) {
    const L = Ls[i] * (paw ? 0.75 : 1), rr = paw ? 0.002 : 0;
    const base = p(0, -0.082, zs[i]);
    const mid = v(base, p(-s * 0.005, -L * 0.55, 0)), tip = v(mid, p(-s * 0.012, -L * 0.45, 0));
    limbs.push([C(base, mid, (0.0095 + rr) * k, (0.0088 + rr) * k), C(mid, tip, (0.0088 + rr) * k, (0.0078 + rr) * k)]);
    tips.push({ tip, dir: [tip[0] - mid[0], tip[1] - mid[1], tip[2] - mid[2]] });
  }
  limbs.push([C(p(-s * 0.006, -0.03, 0.03), p(-s * 0.014, -0.058, 0.05), 0.012 * k, 0.01 * k), C(p(-s * 0.014, -0.058, 0.05), p(-s * 0.024, -0.08, 0.052), 0.01 * k, 0.0085 * k)]);
  tips.push({ tip: p(-s * 0.024, -0.08, 0.052), dir: p(-s * 0.01, -0.022, 0.002) });
  // nudillos
  const detail = zs.map((z) => E(p(s * 0.012, -0.084, z), p(0.007, 0.007, 0.007)));
  return { shape: { torso, limbs, detail, kT: 0.02, kL: 0.006, kJ: 0.012, kD: 0.006 }, tips };
}

// ---------------------------------------------------------------------------
// Personaje
// ---------------------------------------------------------------------------

export interface BuildOpts { outfit: boolean }

export class Character {
  root = new THREE.Group();
  private body = new THREE.Group();
  private bones = {} as Record<BoneName, THREE.Bone>;
  private headTop!: THREE.Group;
  private lids: THREE.Object3D[] = [];
  private lidOpen = -0.23;
  private upright: THREE.Object3D[] = [];
  private rest = new Map<THREE.Object3D, THREE.Euler>();
  private restPose: [BoneName, number, number, number][] = [];
  private glow?: THREE.Sprite;
  private cat: 0 | 1 | 2 = 0;
  private waveStart = -1;
  private waveSide = 1;
  private hopStart = -1;
  private blinkStart = -1;
  private nextBlink = 1.5;
  private time = 0;
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  constructor(public d: CharData, public opts: BuildOpts) {
    this.root.add(this.body);
    this.build();
  }

  private build() {
    const d = this.d, R = RACES[d.race];
    const rig = makeRig(d);
    const { J, W, fem } = rig;
    this.cat = R.tail;
    this.root.scale.setScalar(R.height * (fem ? 0.95 : 1) * (0.92 + d.height * 0.16));

    // ---------- Huesos ----------
    for (const name of BONES) {
      const b = new THREE.Bone();
      b.name = name;
      this.bones[name] = b;
    }
    for (const name of BONES) {
      const b = this.bones[name], par = PARENT[name];
      const p = J[name], pp = par ? J[par] : [0, 0, 0];
      b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
      (par ? this.bones[par] : this.body).add(b);
    }
    this.root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(BONES.map((n) => this.bones[n]));
    const at = (bone: BoneName, p: V3, r: Rot = [0, 0, 0]) => group(this.bones[bone], [p[0] - J[bone][0], p[1] - J[bone][1], p[2] - J[bone][2]], r);

    // ---------- Materiales ----------
    const skinC = R.skins[d.skin % R.skins.length];
    const hairC = HAIR_COLORS[d.hairColor];
    const P = CLOTH[d.primary], S = CLOTH[d.secondary];
    const dark = R.skinKind === 'skin' ? skinC : mixHex(skinC, '#120c0a', R.skinKind === 'fur' ? 0.62 : 0.5);
    const pattern = d.race === 'pelso' && d.detail === 1 ? 'stripes' : d.race === 'lagto' && d.detail > 0 ? (d.detail === 1 ? 'stripes' : 'spots') : undefined;
    const sdfSkin = paint(skinC, R.skinKind as Kind, {
      sdf: true, rim: 0.42, sss: R.skinKind === 'skin' ? 0.6 : 0.3, light: R.light ?? skinC, dark,
      blush: mixHex(skinC, '#e0606a', 0.6), pattern, patternAmt: 0.7,
      triScale: R.skinKind === 'scales' ? 14 : R.skinKind === 'fur' ? 7 : 4, texAmt: R.skinKind === 'skin' ? 0.6 : 1,
    });
    const flatSkin = paint(skinC, 'skin', { rim: 0.3, texAmt: 0.4 });
    const cloth = (c: string, k: Kind = 'cloth', o = {}) => paint(c, k, { sdf: true, triScale: k === 'metal' ? 2 : 4, rim: 0.3, ...o });
    const m = {
      hair: paint(hairC, 'hair', { sdf: true, hair: true, rim: 0.5, spec: 0.05, triScale: 5 }),
      P: cloth(P), S: cloth(S),
      Pleather: cloth(P, 'leather'),
      leather: cloth('#6e4a2c', 'leather'), dleather: cloth('#46301f', 'leather'),
      metal: cloth('#9aa3b0', 'metal', { spec: 0.3, rim: 0.35 }),
      chain: cloth('#7c828c', 'metal', { spec: 0.2, triScale: 14 }),
      gold: cloth('#d6a540', 'metal', { spec: 0.7, rim: 0.5 }),
      under: cloth('#ece2cf', 'silk'),
      rogue: cloth('#34303a'),
      // piezas rígidas
      rP: paint(P, 'cloth'), rS: paint(S, 'cloth'), rGold: paint('#d6a540', 'metal', { spec: 0.7, rim: 0.5 }),
      rMetal: paint('#a2aab5', 'metal', { spec: 0.55, rim: 0.4 }), rLeather: paint('#6e4a2c', 'leather'), rDleather: paint('#46301f', 'leather'),
      wood: paint('#7a5230', 'wood', { rim: 0.3 }), ivory: paint('#efe4c8', 'plain', { rim: 0.4 }),
      white: paint('#f4f1ea', 'plain', { texAmt: 0, rim: 0 }), fur: paint('#cdb38c', 'fur', { rim: 0.6 }),
      rHair: paint(hairC, 'hair', { rim: 0.5 }),
    };

    // ---------- Cuerpo ----------
    const body = bodyShape(rig, d);
    const bodyPrims = Object.values(body.parts);
    const bkey = [d.race, d.sex, Math.round(d.build * 50), d.race === 'pelso' ? d.detail : 0].join('|');
    const skinned = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const sm = new THREE.SkinnedMesh(geo, mat);
      this.body.add(sm);
      sm.bind(skeleton, new THREE.Matrix4());
      sm.frustumCulled = false;
      return sm;
    };
    skinned(cached('body|' + bkey, () => sculpt(body.shape, 0.0095, [...bodyPrims, ...body.tintPrims], true)), sdfSkin);
    const wear = (name: string, mat: THREE.Material, make: () => Shape, cell = 0.01) =>
      skinned(cached(`g|${bkey}|${name}`, () => sculpt(make(), cell, bodyPrims, true)), mat);

    // ---------- Cabeza ----------
    const head = this.bones.head;
    const hi = headInfo(rig, d);
    const hshape = headShape(rig, d);
    const hgear = this.opts.outfit ? CLASSES[d.cls].headgear : 0;
    const showHair = hgear !== 1 && hgear !== 2;
    const hsh = showHair ? hairShape(rig, d) : null;
    const bsh = beardShape(rig, d);
    const hkey = [d.race, d.sex, d.detail, d.eyeShape, d.race === 'pelso' ? 0 : d.nose, hsh ? d.hair : -1].join('|');
    const occ = [hsh, bsh].filter((x): x is Shape => !!x);
    const headPrims = [...hshape.shape.torso, ...hshape.shape.limbs.flat(), ...(hshape.shape.detail ?? []), ...hshape.tints];
    add(head, cached('head|' + hkey, () => sculpt(hshape.shape, 0.0042, headPrims, false, occ)), sdfSkin);
    this.headTop = group(head, [0, hi.cy, 0]);
    if (hsh) add(head, cached(`hair|${d.race}|${d.sex}|${d.hair}`, () => sculpt(hsh, 0.0045, null, false)), m.hair);
    if (bsh) add(head, cached(`beard|${d.race}|${d.detail}`, () => sculpt(bsh, 0.004, null, false)), m.hair);
    const brs = browShape(rig, d, hshape.shape);
    if (brs) add(head, cached(`brow|${hkey}|${d.brows}`, () => sculpt(brs, 0.001, null, false)), m.hair);
    this.buildFace(head, rig, d, hi, flatSkin, m.rHair, hshape.shape);

    // ---------- Manos ----------
    const gloves = this.opts.outfit && (d.cls === 'guerrero' || d.cls === 'picaro');
    const handMat = gloves ? (d.cls === 'guerrero' ? m.leather : m.dleather) : sdfSkin;
    const nailMat = paint(mixHex(skinC, '#fff2ee', 0.45), 'plain', { rim: 0.3, spec: 0.5, texAmt: 0 });
    const clawMat = paint('#e8dcc0', 'plain', { rim: 0.4, spec: 0.3 });
    for (const s of [-1, 1]) {
      const hs0 = handShape(d, s);
      const hg = cached(`hand|${d.race}|${d.sex}|${s}`, () => sculpt(hs0.shape, 0.0032, null, false));
      const hgrp = group(this.bones[`hand${side(s)}` as BoneName], [0, 0, 0], [0, 0, s * rig.a]);
      add(hgrp, hg, handMat);
      if (!gloves && d.race !== 'pelso') for (const { tip, dir } of hs0.tips) {
        if (d.race === 'lagto') {
          aim(add(hgrp, spike(0.004, 0.012, 6), clawMat, v(tip, dir, 0.25)), dir);
        } else {
          // uña en el dorso de la yema
          const l = Math.hypot(dir[0], dir[1]) || 1;
          const dn: V3 = [dir[0] / l, dir[1] / l, 0], back: V3 = [s * -dn[1], s * dn[0], 0];
          const n = add(hgrp, sphere(1, 12, 8), nailMat, v(v(tip, back, 0.0068), dn, -0.004), [0, 0, 0], [0.0022, 0.0075, 0.0062]);
          n.rotation.z = Math.atan2(-dn[0], dn[1]);
        }
      }
    }
    // garras de los pies (Lagto')
    if (d.race === 'lagto' && !this.opts.outfit) for (const s of [-1, 1]) {
      const L = rig.leg[side(s)];
      for (let i = 0; i < 3; i++) {
        const x = L.toe[0] + s * (-0.022 + i * 0.022) + s * (i - 1) * 0.008;
        add(at(`foot${side(s)}` as BoneName, [x, 0.014, L.toe[2] + 0.05 - Math.abs(i - 1) * 0.012], [1.35, 0, 0]), spike(0.006, 0.02, 6), clawMat);
      }
    }

    // ---------- Ropa ----------
    const { pelvisY, shoulderY, chestY, hipJY, kneeY, beltY } = rig;
    const wrist = (k: string, back = 0.01): Plane[] => {
      if (!k.startsWith('farm')) return [];
      const A = rig.arm[k.endsWith('L') ? 'L' : 'R'];
      return [[A.d, v(A.wr, A.d, -back)]];
    };
    const sleeve = (k: string, len: number): Plane[] => {
      if (!k.startsWith('uarm') && !k.startsWith('delt')) return [];
      const A = rig.arm[k.endsWith('L') ? 'L' : 'R'];
      return [[A.d, v(A.sh, A.d, len)]];
    };
    const forearmBand = (k: string, from: number, toWrist: number): Plane[] => {
      const A = rig.arm[k.endsWith('L') ? 'L' : 'R'];
      return [[[-A.d[0], -A.d[1], -A.d[2]], v(A.el, A.d, from)], [A.d, v(A.wr, A.d, -toWrist)]];
    };
    const bootTop = kneeY - 0.07;

    const origin = (bone: BoneName) => at(bone, [0, 0, 0]);
    const trimC = cloth('#c9a46a', 'silk');
    if (!this.opts.outfit) {
      wear('under-shorts', m.under, () => garment(body, ['pelvis', 'gluteL', 'gluteR', 'thighL', 'thighR'], 0.008, [keepAbove(hipJY - 0.1), keepBelow(pelvisY + 0.055)]));
      wear('under-band', trimC, () => garment(body, ['pelvis', 'gluteL', 'gluteR'], 0.0115, [keepAbove(pelvisY + 0.038), keepBelow(pelvisY + 0.056)]), 0.007);
      wear('under-hem', trimC, () => garment(body, ['thighL', 'thighR'], 0.011, [keepAbove(hipJY - 0.1), keepBelow(hipJY - 0.088)]), 0.007);
      if (fem) {
        wear('under-top', m.under, () => garment(body, ['ribcage', 'bustL', 'bustR'], 0.008, [keepAbove(chestY - 0.045), keepBelow(chestY + 0.07)]));
        wear('under-top-band', trimC, () => garment(body, ['ribcage', 'bustL', 'bustR'], 0.011, [keepAbove(chestY - 0.045), keepBelow(chestY - 0.033)]), 0.007);
      }
    } else {
      const toeKeys = Object.keys(body.parts).filter((k) => k.startsWith('toe') || k.startsWith('ankle'));
      const shirtKeys = [...TORSO_KEYS, ...ARM_KEYS];
      const pants = () => garment(body, ['pelvis', 'gluteL', 'gluteR', ...LEG_KEYS], 0.009, [keepBelow(beltY + 0.012), keepAbove(bootTop - 0.03)]);
      const boots = (mat: THREE.Material) => {
        wear('boots', mat, () => garment(body, ['calfL', 'calfR', 'calfML', 'calfMR', ...FOOT_KEYS, ...toeKeys], 0.016, [keepBelow(bootTop)]));
        wear('cuff', mat, () => garment(body, ['calfL', 'calfR', 'calfML', 'calfMR'], 0.028, [keepAbove(bootTop - 0.045), keepBelow(bootTop)]));
        wear('soles', cloth('#2c1f17', 'leather'), () => garment(body, [...FOOT_KEYS, ...toeKeys], 0.021, [keepBelow(0.02)]), 0.008);
      };
      const belt = (mat: THREE.Material, t = 0.02) => {
        wear('belt' + t, mat, () => garment(body, ['pelvis', 'abdomen', 'gluteL', 'gluteR'], t, [keepAbove(beltY - 0.022), keepBelow(beltY + 0.022)]));
        add(at('hips', [0, beltY, rig.pelvisR[2] + t + 0.012]), box(0.055, 0.05, 0.016), m.rGold);
      };
      const longShirt = (mat: THREE.Material, name: string, t = 0.008) =>
        wear(name, mat, () => garment(body, shirtKeys, t, [keepAbove(pelvisY - 0.02), keepBelow(shoulderY + 0.045)], (k) => wrist(k)));
      const skirt = (top: number, bottom: number, r0: number, r1: number) => {
        const p = C([0, top, 0], [0, bottom, 0], r0, r1);
        p.bone = BI.hips;
        return p;
      };
      const bell = (Sd: 'L' | 'R', t = 0) => {
        const A = rig.arm[Sd];
        const b = C(v(A.el, A.d, 0.02), v(A.wr, A.d, 0.02), 0.05 + t, 0.085 + t);
        b.bone = BI[`forearm${Sd}`];
        return b;
      };
      const robeShape = (t: number, planes: Plane[], arms = true) => garment(body, arms ? shirtKeys : TORSO_KEYS, t, [keepAbove(0.06), keepBelow(shoulderY + 0.045), ...planes], (k) => wrist(k, -0.01), {
        torso: [skirt(pelvisY + 0.12, 0.06, 0.14 * W + (t - 0.012), 0.3 * W + (t - 0.012))],
        limbs: arms ? { armL: [bell('L')], armR: [bell('R')] } : {},
      });
      const robe = (mat: THREE.Material, trim: THREE.Material) => {
        wear('robe', mat, () => robeShape(0.012, []), 0.011);
        wear('robe-hem', trim, () => garment(body, [], 0, [keepAbove(0.06), keepBelow(0.085)], undefined, { torso: [skirt(pelvisY + 0.12, 0.06, 0.14 * W + 0.006, 0.3 * W + 0.006)] }), 0.008);
        // ribete frontal y puños de las mangas
        wear('robe-front', trim, () => robeShape(0.017, [[[1, 0, 0], [0.02, 0, 0]], [[-1, 0, 0], [-0.02, 0, 0]], [[0, 0, -1], [0, 0, 0]], keepBelow(chestY + 0.02)], false), 0.007);
        wear('robe-cuffs', trim, () => ({
          torso: [], kT: 0.07, kL: 0.03, kJ: 0.05,
          limbs: (['L', 'R'] as const).map((Sd) => {
            const A = rig.arm[Sd], b = bell(Sd, 0.006);
            b.cut(-A.d[0], -A.d[1], -A.d[2], ...v(A.wr, A.d, -0.005));
            b.cut(A.d[0], A.d[1], A.d[2], ...v(A.wr, A.d, 0.02));
            return [b];
          }),
        }), 0.007);
      };
      const mantle = (mat: THREE.Material, trim: THREE.Material) => {
        const keys = ['trapL', 'trapR', 'deltL', 'deltR', 'pecL', 'pecR', 'bustL', 'bustR'];
        const lo = shoulderY - 0.13;
        const cape = () => { const p = E([0, shoulderY - 0.06, -0.008], [rig.shoulderX + 0.055, 0.075, rig.ribR[2] + 0.025]); p.bone = BI.chest; return p; };
        const ms = garment(body, keys, 0.02, [keepAbove(lo)], undefined, { torso: [cape()] });
        wear('mantle', mat, () => ms);
        // broche
        const cy0 = shoulderY - 0.075, cz = surfaceZ(ms, 0, cy0);
        const br = origin('chest');
        add(br, cyl(0.022, 0.022, 0.008, 20), m.rGold, [0, cy0, cz + 0.002], [PI / 2, 0, 0]);
        add(br, sphere(0.011, 14, 10), paint(CLOTH[d.primary], 'plain', { spec: 1, rim: 0.5, texAmt: 0 }), [0, cy0, cz + 0.008], [0, 0, 0], [1, 1, 0.6]);
        wear('mantle-trim', trim, () => garment(body, keys, 0.025, [keepAbove(lo), keepBelow(lo + 0.02)], undefined, { torso: [cape().inflate(0.005)] }), 0.008);
      };
      const cls = d.cls;

      if (cls === 'guerrero') {
        longShirt(m.chain, 'chain');
        wear('pants', m.S, pants);
        boots(m.dleather);
        wear('plate', m.metal, () => garment(body, TORSO_KEYS.filter((k) => !k.startsWith('glute') && k !== 'pelvis'), 0.03, [keepAbove(pelvisY + 0.04), keepBelow(shoulderY + 0.05)]));
        const trimShape = garment(body, ['abdomen', 'ribcage'], 0.037, [keepAbove(pelvisY + 0.04), keepBelow(pelvisY + 0.064)]);
        wear('plate-trim', m.gold, () => trimShape, 0.008);
        const plateShape = garment(body, TORSO_KEYS.filter((k) => !k.startsWith('glute') && k !== 'pelvis'), 0.03, [keepAbove(pelvisY + 0.04), keepBelow(shoulderY + 0.05)]);
        const rv = origin('spine');
        for (let i = -3; i <= 3; i++) {
          const x = i * 0.028, y = pelvisY + 0.052;
          add(rv, sphere(0.0055, 10, 8), m.rGold, [x, y, surfaceZ(trimShape, x, y) - 0.001]);
        }
        const ey = chestY + 0.035, emb = origin('chest');
        const ez = surfaceZ(plateShape, 0, ey);
        add(emb, cyl(0.032, 0.032, 0.008, 24), m.rGold, [0, ey, ez + 0.001], [PI / 2, 0, 0]);
        add(emb, sphere(0.012, 14, 10), paint(CLOTH[d.primary], 'plain', { spec: 1, rim: 0.5, texAmt: 0 }), [0, ey, ez + 0.007], [0, 0, 0], [1, 1, 0.6]);
        for (let i = 0; i < 4; i++) add(emb, spike(0.008, 0.022, 4), m.rGold, [Math.cos(i * PI / 2) * 0.034, ey + Math.sin(i * PI / 2) * 0.034, ez + 0.002], [0, 0, i * PI / 2 - PI / 2], [1, 1, 0.4]);
        wear('bracers', m.metal, () => garment(body, ['farmL', 'farmR'], 0.017, [], (k) => forearmBand(k, 0.08, 0.004)));
        belt(m.dleather);
        const hz = rig.pelvisR[2] + 0.03;
        for (const z of [hz, -hz - 0.03]) add(at('hips', [0, beltY - 0.2, z], [z > 0 ? -0.05 : 0.05, 0, 0]), box(0.2 * W, 0.34, 0.012), m.rP);
        add(at('hips', [0, beltY - 0.07, hz + 0.008]), cyl(0.035, 0.035, 0.008, 20), m.rGold, [0, 0, 0], [PI / 2, 0, 0]);
        for (const s of [-1, 1]) {
          const Sd = side(s);
          const pg = at(`upperArm${Sd}` as BoneName, v(rig.arm[Sd].sh, [s * 0.012, 0.035, 0]), [0, 0, s * 0.9]);
          const pr = 0.085 * Math.sqrt(W);
          const top = add(pg, sphere(pr, 22, 10, 0, PI * 2, 0, PI / 2), m.rMetal, [0, 0, 0], [0, 0, 0], [1.15, 0.85, 1.05]);
          add(top, torus(pr, 0.008), m.rGold, [0, 0.002, 0], [PI / 2, 0, 0]);
          add(pg, sphere(pr * 0.92, 22, 10, 0, PI * 2, 0, PI / 2), m.rMetal, [s * 0.015, -0.045, 0], [0, 0, s * 0.25], [1.1, 0.7, 1]);
        }
        const sw = at('hips', [-(rig.pelvisR[0] + 0.06), beltY - 0.02, 0.04], [0.25, 0, -0.18]);
        add(sw, box(0.045, 0.6, 0.025), m.rDleather, [0, -0.28, 0]);
        add(sw, box(0.05, 0.05, 0.03), m.rGold, [0, -0.58, 0]);
        add(sw, box(0.18, 0.028, 0.035), m.rGold, [0, 0.03, 0]);
        add(sw, cyl(0.013, 0.013, 0.11, 8), m.rLeather, [0, 0.1, 0]);
        add(sw, sphere(0.024, 12, 8), m.rGold, [0, 0.17, 0]);
        const sg = at('chest', [0, chestY + 0.02, -(rig.ribR[2] + 0.07)], [0.1, 0, 0]);
        add(sg, cyl(0.26, 0.26, 0.035, 30), paint(P, 'wood'), [0, 0, 0], [PI / 2, 0, 0]);
        add(sg, torus(0.26, 0.022), m.rMetal);
        add(sg, sphere(0.06, 16, 10, 0, PI * 2, 0, PI / 2), m.rMetal, [0, 0, -0.018], [-PI / 2, 0, 0]);
        add(sg, box(0.045, 0.36, 0.02), m.rGold, [0, 0, -0.022]);
        add(sg, box(0.36, 0.045, 0.02), m.rGold, [0, 0, -0.022]);
      }

      if (cls === 'mago') {
        robe(m.P, m.gold);
        mantle(m.S, m.gold);
        boots(m.leather);
        belt(m.S, 0.022);
        this.restPose.push(['forearmR', -0.5, 0, 0]);
        const st = group(this.bones.handR, [0, -0.05, 0.02]);
        add(st, cyl(0.018, 0.022, 1.6, 10), m.wood, [0, 0.15, 0]);
        add(st, torus(0.03, 0.01), m.rGold, [0, 0.9, 0], [PI / 2, 0, 0]);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * PI * 2;
          add(st, spike(0.015, 0.15, 6), m.rGold, [Math.cos(a) * 0.03, 0.92, Math.sin(a) * 0.03], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]);
        }
        add(st, sphere(0.065), paint('#8feaff', 'plain', { emissive: 0.85, texAmt: 0 }), [0, 1.03, 0]);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(150,235,255,0.9)', 'rgba(80,180,255,0)'), blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.position.set(0, 1.03, 0);
        st.add(glow);
        this.glow = glow;
        this.upright.push(st);
      }

      if (cls === 'picaro') {
        longShirt(m.rogue, 'rogue-shirt');
        wear('rogue-pants', m.rogue, pants);
        boots(m.dleather);
        const vs = garment(body, ['abdomen', 'ribcage', 'pecL', 'pecR', 'bustL', 'bustR', 'pelvis', 'trapL', 'trapR'], 0.022, [keepAbove(pelvisY - 0.04), keepBelow(shoulderY + 0.02)]);
        wear('vest', m.Pleather, () => vs);
        const bt = origin('spine');
        for (let i = 0; i < 5; i++) {
          const y = pelvisY + 0.02 + i * ((chestY + 0.03 - pelvisY) / 4);
          add(bt, sphere(0.0065, 12, 8), m.rGold, [0, y, surfaceZ(vs, 0, y) + 0.001], [0, 0, 0], [1, 1, 0.6]);
        }
        wear('gcuff', m.dleather, () => garment(body, ['farmL', 'farmR'], 0.014, [], (k) => forearmBand(k, 0.12, -0.01)));
        belt(m.dleather);
        add(at('neck', [0, shoulderY + 0.005, -0.005]), torus(rig.neckR + 0.028, 0.026), m.rS, [0, 0, 0], [PI / 2, 0, 0], [1, 0.9, 1]);
        add(at('chest', [0.05, shoulderY - 0.08, rig.ribR[2] + 0.04]), box(0.06, 0.18, 0.02), m.rS, [0, 0, 0], [-0.2, 0, -0.25]);
        for (const s of [-1, 1]) {
          add(at('hips', [s * rig.pelvisR[0] * 0.85, beltY - 0.045, rig.pelvisR[2] * 0.55]), box(0.07, 0.08, 0.045), m.rLeather, [0, 0, 0], [0, s * 0.6, 0]);
          const dg = at('hips', [s * 0.08, beltY + 0.02, -(rig.pelvisR[2] + 0.045)], [0, 0, s * 0.75]);
          add(dg, box(0.04, 0.22, 0.022), m.rDleather, [0, -0.09, 0]);
          add(dg, box(0.1, 0.022, 0.026), m.rGold, [0, 0.03, 0]);
          add(dg, cyl(0.011, 0.011, 0.08, 8), m.rLeather, [0, 0.075, 0]);
          add(dg, sphere(0.017, 10, 8), m.rGold, [0, 0.12, 0]);
        }
      }

      if (cls === 'clerigo') {
        robe(m.P, m.gold);
        mantle(m.S, m.gold);
        boots(m.leather);
        belt(m.S, 0.022);
        const hz = rig.pelvisR[2] + 0.06;
        const tb = at('hips', [0, beltY - 0.27, hz], [-0.12, 0, 0]);
        add(tb, box(0.17 * W, 0.5, 0.012), m.rS);
        const sun = group(tb, [0, 0.17, 0.01]);
        add(sun, cyl(0.04, 0.04, 0.01, 20), m.rGold, [0, 0, 0], [PI / 2, 0, 0]);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI * 2;
          add(sun, spike(0.015, 0.04, 4), m.rGold, [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0], [0, 0, a - PI / 2], [1, 1, 0.3]);
        }
        const mc = at('hips', [rig.pelvisR[0] + 0.07, beltY, 0.03], [0.1, 0, 0.18]);
        add(mc, cyl(0.014, 0.014, 0.36, 8), m.wood, [0, -0.08, 0]);
        add(mc, sphere(0.045, 14, 10), m.rMetal, [0, -0.27, 0]);
        for (let i = 0; i < 4; i++) add(mc, box(0.016, 0.07, 0.11), m.rMetal, [0, -0.27, 0], [0, (i * PI) / 4, 0]);
        const bk = at('hips', [-(rig.pelvisR[0] + 0.06), beltY - 0.05, 0.02], [0, 0, -0.1]);
        add(bk, box(0.045, 0.15, 0.11), m.rDleather);
        add(bk, box(0.036, 0.135, 0.1), m.ivory, [0.007, 0, 0.003]);
      }

      if (cls === 'explorador') {
        wear('tunic', m.P, () => garment(body, TORSO_KEYS.concat(['deltL', 'deltR', 'uarmL', 'uarmR']), 0.01, [keepAbove(hipJY - 0.2), keepBelow(shoulderY + 0.045)], (k) => sleeve(k, 0.16), {
          torso: [skirt(pelvisY + 0.08, hipJY - 0.22, 0.14 * W, 0.2 * W)],
        }));
        wear('ranger-pants', m.leather, pants);
        boots(m.dleather);
        const js = garment(body, ['abdomen', 'ribcage', 'pecL', 'pecR', 'bustL', 'bustR', 'pelvis', 'trapL', 'trapR'], 0.024, [keepAbove(pelvisY - 0.02), keepBelow(shoulderY + 0.01)]);
        wear('jerkin', m.dleather, () => js);
        // cordones cruzados
        const lc = origin('spine'), lace = paint('#e8d8b0', 'plain', { rim: 0.2 });
        const jz = (x: number, y: number) => surfaceZ(js, x, y) + 0.0015;
        for (let i = 0; i < 5; i++) {
          const y0 = pelvisY + 0.02 + i * 0.045, y1 = y0 + 0.04;
          rod(lc, [-0.016, y0, jz(-0.016, y0)], [0.016, y1, jz(0.016, y1)], 0.0032, lace);
          rod(lc, [0.016, y0, jz(0.016, y0)], [-0.016, y1, jz(-0.016, y1)], 0.0032, lace);
        }
        wear('tunic-hem', m.dleather, () => garment(body, TORSO_KEYS, 0.014, [keepAbove(hipJY - 0.2), keepBelow(hipJY - 0.18)], undefined, {
          torso: [skirt(pelvisY + 0.08, hipJY - 0.22, 0.14 * W + 0.004, 0.2 * W + 0.004)],
        }), 0.007);
        wear('sleeve-hem', m.dleather, () => garment(body, ['deltL', 'deltR', 'uarmL', 'uarmR', 'bicepL', 'bicepR'], 0.014, [], (k) => {
          const A = rig.arm[k.endsWith('L') ? 'L' : 'R'];
          return [[A.d, v(A.sh, A.d, 0.16)], [[-A.d[0], -A.d[1], -A.d[2]], v(A.sh, A.d, 0.14)]];
        }), 0.007);
        wear('bracers-l', m.leather, () => garment(body, ['farmL', 'farmR'], 0.015, [], (k) => forearmBand(k, 0.06, 0.004)));
        belt(m.leather);
        add(at('chest', [0, shoulderY - 0.005, -0.012]), torus(0.085 * W + rig.neckR * 0.5, 0.04), m.fur, [0, 0, 0], [PI / 2, 0, 0], [1.1, 0.85, 1]);
        const ch = shoulderY - 0.22;
        const cg = new THREE.PlaneGeometry(0.42 * W, ch, 8, 14).translate(0, -ch / 2, 0);
        const pos = cg.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getX(i) ** 2 * 1.8);
        cg.computeVertexNormals();
        add(at('chest', [0, shoulderY - 0.02, -(rig.ribR[2] + 0.04)]), cg, paint(S, 'cloth', { side: THREE.DoubleSide, wave: 0.04 }), [0, 0, 0], [0.12, 0, 0]);
        const qv = at('chest', [0.07, chestY + 0.02, -(rig.ribR[2] + 0.11)], [0.15, 0, -0.45]);
        add(qv, cyl(0.055, 0.045, 0.4, 14), m.rDleather);
        add(qv, torus(0.055, 0.01), m.rGold, [0, 0.2, 0], [PI / 2, 0, 0]);
        for (let i = 0; i < 5; i++) {
          const ax = (i % 3 - 1) * 0.02, az = (i < 3 ? -1 : 1) * 0.015;
          add(qv, cyl(0.005, 0.005, 0.18, 5), m.wood, [ax, 0.27, az]);
          add(qv, box(0.004, 0.06, 0.026), i % 2 ? m.white : paint('#b8402f'), [ax, 0.34, az]);
        }
        const bw = group(this.bones.handL, [0, -0.055, 0]);
        const br = 0.45, arc = 1.9;
        add(bw, torus(br, 0.016, arc).rotateZ(-arc / 2), m.wood, [0, 0, -br], [0, -PI / 2, 0]);
        add(bw, cyl(0.0025, 0.0025, 2 * br * Math.sin(arc / 2), 4), m.white, [0, 0, br * Math.cos(arc / 2) - br]);
        add(bw, cyl(0.02, 0.02, 0.08, 8), m.rDleather);
        this.upright.push(bw);
      }

      this.buildHeadgear(this.headTop, 0.108 * rig.hs, hgear, m, d.race);
    }

    // ---------- Pose de reposo ----------
    for (const s of [-1, 1]) {
      this.restPose.unshift([`upperArm${side(s)}` as BoneName, 0, 0, -s * (rig.a - 0.13)]);
      if (!this.restPose.some((r) => r[0] === `forearm${side(s)}`)) this.restPose.push([`forearm${side(s)}` as BoneName, -0.12, 0, 0]);
    }
    for (const [b, x, y, z] of this.restPose) this.bones[b].rotation.set(x, y, z);
    for (const name of BONES) this.rest.set(this.bones[name], this.bones[name].rotation.clone());

    // Sombra de contacto
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: softDot('rgba(40,20,30,0.5)', 'rgba(40,20,30,0)'), transparent: true, depthWrite: false }),
    );
    sh.rotation.x = -PI / 2;
    sh.position.y = 0.005;
    sh.scale.set(0.75 * W, 0.6 * W, 1);
    this.root.add(sh);
  }

  private buildFace(head: THREE.Object3D, rig: Rig, d: CharData, hi: HeadInfo, skin: THREE.Material, hairMat: THREE.Material, shape: Shape) {
    const hs = rig.hs, cy = hi.cy, fem = rig.fem;
    const P = (x: number, y: number, z: number): V3 => [x * hs, cy + y * hs, z * hs];
    /** Punto sobre la piel (x, y en unidades de cabeza), adelantado `out` metros. */
    const S = (x: number, y: number, out = 0): V3 => { const p = P(x, y, 0); return [p[0], p[1], surfaceZ(shape, p[0], p[1]) + out]; };
    const R = RACES[d.race];
    const eyeCol = EYES[d.eyes];
    const sclera = d.race === 'lagto' ? mixHex(eyeCol, '#f0e0a0', 0.55) : '#fbf6ee';
    const eyeMat = paint('#ffffff', 'plain', { map: irisTex(eyeCol, R.slit, sclera), rim: 0.1, spec: 0.5 });
    const lashMat = paint('#24161a', 'plain', { texAmt: 0, rim: 0 });
    const shine = paint('#ffffff', 'plain', { texAmt: 0, emissive: 1 });
    const r = hi.eyeR;
    const es = EYE_SHAPE[d.eyeShape] ?? EYE_SHAPE[0];
    this.lidOpen = es.open;
    for (const s of [-1, 1]) {
      const eg = group(head, hi.eye(s), [0, s * hi.eyeYaw, s * es.tilt]);
      add(eg, sphere(r, 32, 20), eyeMat, [0, 0, 0], [0, -s * hi.eyeYaw * 0.6, 0]);
      add(eg, sphere(r * 0.2, 8, 6), shine, [r * 0.32, r * 0.38, r * 0.9]);
      add(eg, sphere(r * 0.1, 6, 5), shine, [-r * 0.2, -r * 0.3, r * 0.95]);
      const lid = group(eg, [0, 0, 0], [this.lidOpen, 0, 0]);
      add(lid, sphere(r * 1.1, 24, 12, 0, PI * 2, 0, 1.3), skin);
      if (d.race !== 'lagto') {
        const lr = r * 1.1 * Math.sin(1.3), ly = r * 1.1 * Math.cos(1.3);
        const arc = 1.7;
        add(lid, torus(lr, fem ? 0.0026 : 0.0016, arc, 20).rotateZ(PI / 2 - arc / 2).rotateX(PI / 2), lashMat, [0, ly, 0]);
        // pestañas en abanico, más largas hacia el rabillo
        const nL = fem ? 7 : 4;
        for (let k = 0; k < nL; k++) {
          const f = k / (nL - 1);
          const ph = -0.35 + f * 1.15;
          const pos: V3 = [s * lr * Math.sin(ph), ly, lr * Math.cos(ph)];
          const len = (fem ? 0.0045 + f * 0.005 : 0.003 + f * 0.0015) * rig.hs;
          aim(add(lid, spike(fem ? 0.0011 : 0.0008, len, 4), lashMat, pos), [s * Math.sin(ph) * 0.55 + s * f * 0.25, 0.75, Math.cos(ph) * 0.65]);
        }
      }
      this.lids.push(lid);
    }

    const white = paint('#fbf6ee', 'plain', { texAmt: 0, rim: 0 });
    const inner = paint('#4a1c22', 'plain', { texAmt: 0, rim: 0 });
    if (d.race === 'humano' || d.race === 'elfo') {
      const mouthMat = paint('#8a4448', 'plain', { texAmt: 0, rim: 0 });
      const M = S(0, -0.0638, 0.0005);
      const mo = d.mouth;
      if (mo === 0) add(head, torus(0.016 * hs, 0.0024, 1.2, 16).rotateZ(-PI / 2 - 0.6), mouthMat, v(M, [0, 0.016 * hs, 0]), [-0.3, 0, 0]);
      if (mo === 1) rod(head, S(-0.014, -0.064, 0), S(0.014, -0.064, 0), 0.0022, mouthMat);
      if (mo === 2) add(head, torus(0.014 * hs, 0.0024, 0.9, 16).rotateZ(-PI / 2 - 0.45), mouthMat, v(S(0.006, -0.062, 0.001), [0, 0.014 * hs, 0]), [-0.3, 0, 0.35]);
      if (mo === 3) {
        add(head, sphere(1, 18, 10, 0, PI * 2, PI / 2, PI / 2), inner, v(M, [0, 0.004 * hs, -0.002]), [-0.25, 0, 0], [0.016 * hs, 0.012 * hs, 0.007 * hs]);
        add(head, box(0.022 * hs, 0.0035 * hs, 0.003), white, v(M, [0, 0.0025 * hs, 0.001]));
        add(head, sphere(1, 10, 8), paint('#d0606a', 'plain', { rim: 0 }), v(M, [0, -0.004 * hs, -0.001]), [0, 0, 0], [0.009 * hs, 0.004 * hs, 0.004 * hs]);
      }
      if (mo === 4) add(head, sphere(1, 14, 10), inner, M, [0, 0, 0], [0.007 * hs, 0.009 * hs, 0.004 * hs]);
      if (mo === 5) add(head, torus(0.02 * hs, 0.0024, 0.8, 16).rotateZ(PI / 2 - 0.4), mouthMat, v(M, [0, -0.018 * hs, 0]), [0.25, 0, 0]);
    }
    if (d.race === 'pelso') {
      const noseCol = ['#d98c94', '#2a2224', '#e07f8e', '#a0624a'][d.nose] ?? '#d98c94';
      const nm = paint(noseCol, 'plain', { rim: 0.3 });
      const N = S(0, -0.026, -0.002);
      if (d.nose === 2) {
        for (const s of [-1, 1]) add(head, sphere(1, 12, 10), nm, v(N, [s * 0.005 * hs, 0.002 * hs, 0]), [0, 0, 0], [0.008 * hs, 0.008 * hs, 0.007 * hs]);
        add(head, spike(0.009 * hs, 0.012 * hs, 10), nm, v(N, [0, -0.002 * hs, 0]), [PI, 0, 0], [1, 1, 0.7]);
      } else add(head, sphere(1, 14, 10), nm, N, [0, 0, 0], [0.013 * hs, 0.008 * hs, 0.008 * hs]);
      const whisk = paint('#f4efe6', 'plain', { texAmt: 0 });
      const mo = d.mouth;
      if (mo === 1) add(head, torus(0.016, 0.0018, 1.6, 14).rotateZ(-PI / 2 - 0.8), lashMat, v(S(0, -0.062, 0), [0, 0.014, 0]));
      if (mo === 2) add(head, spike(0.003, 0.009, 6), white, v(S(0.012, -0.062, -0.001), [0, -0.002, 0]), [PI, 0, 0]);
      if (mo === 3) add(head, sphere(1, 14, 10, 0, PI * 2, PI / 2, PI / 2), inner, v(S(0, -0.062, -0.002), [0, 0.002, 0]), [-0.2, 0, 0], [0.012 * hs, 0.012 * hs, 0.006 * hs]);
      for (const s of [-1, 1]) {
        if (mo !== 1) add(head, torus(0.01, 0.0018, PI * 0.9, 10).rotateZ(-PI / 2 - PI * 0.45), lashMat, v(S(s * 0.01, -0.06, 0), [0, 0.01, 0]));
        for (let k = 0; k < 3; k++) { const a = S(s * 0.03, -0.045 - k * 0.006, -0.003); rod(head, a, v(a, [s * 0.07 * hs, (0.01 - k * 0.012) * hs, -0.015 * hs]), 0.0009, whisk); }
        const ear = group(head, P(s * 0.064, 0.112, 0.012), [0, 0, -s * 0.29]);
        add(ear, spike(0.022 * hs, 0.07 * hs, 10), paint('#e8a0a8', 'skin', { rim: 0.2 }), [0, -0.03 * hs, 0], [0, 0, 0], [1, 1, 0.35]);
      }
    }
    if (d.race === 'lagto') {
      const mo = d.mouth;
      for (const s of [-1, 1]) {
        const front = v(P(s * 0.034, -0.063, 0), [0, 0, surfaceZ(shape, s * 0.034 * hs, cy - 0.063 * hs) - 0.012]);
        rod(head, front, P(s * 0.064, mo === 1 ? -0.045 : -0.058, 0.045), 0.002, lashMat);
        if (mo === 2) add(head, spike(0.0035, 0.011, 6), white, v(front, [0, -0.002, -0.012]), [PI, 0, 0]);
      }
      if (d.nose === 4) {
        const sn = SNOUT[4];
        add(head, spike(0.012 * hs, 0.04 * hs, 10), paint('#efe4c8', 'plain', { rim: 0.4 }), P(0, -0.006, sn.z - 0.015), [0.35, 0, 0]);
      }
    }
  }

  private buildHeadgear(top: THREE.Group, hr: number, hg: number, m: Record<string, THREE.Material>, race: string) {
    if (hg === 1) {
      const S = (m.rS as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color;
      const outer = paint(S, 'cloth', { side: THREE.DoubleSide });
      const inner = paint(S.clone().lerp(new THREE.Color('#120c10'), 0.65), 'cloth', { side: THREE.BackSide, rim: 0 });
      const ps = PI / 2 + 0.72, pl = PI * 2 - 1.44;
      const z = race === 'lagto' ? -0.02 : 0;
      add(top, sphere(hr * 1.3, 30, 18, ps, pl, 0, PI * 0.74), outer, [0, hr * 0.12, -hr * 0.12 + z], [-0.12, 0, 0], [1, 1.1, 1.08]);
      add(top, sphere(hr * 1.24, 30, 18, ps, pl, 0, PI * 0.74), inner, [0, hr * 0.12, -hr * 0.12 + z], [-0.12, 0, 0], [1, 1.1, 1.08]);
      add(top, torus(hr * 0.85, hr * 0.26), outer, [0, -hr * 1.1, -hr * 0.12], [PI / 2 + 0.15, 0, 0], [1.05, 1, 1]);
      add(top, spike(hr * 0.5, hr * 0.7, 12), outer, [0, hr * 0.9, -hr * 0.9], [-1.9, 0, 0], [1, 1, 0.6]);
    }
    if (hg === 2) {
      const cap = add(top, sphere(hr * 1.16, 30, 16, 0, PI * 2, 0, PI * 0.56), m.rMetal, [0, hr * 0.1, -hr * 0.04], [-0.4, 0, 0], [0.98, 1.08, 1.02]);
      const y = Math.cos(PI * 0.56) * hr * 1.16, rr = Math.sin(PI * 0.56) * hr * 1.16;
      add(cap, torus(rr, hr * 0.06), m.rGold, [0, y, 0], [PI / 2, 0, 0]);
      add(cap, box(hr * 0.11, hr * 0.4, hr * 0.09), m.rMetal, [0, y - hr * 0.12, rr + hr * 0.02], [0.3, 0, 0]);
      for (let i = 0; i < 6; i++) {
        const f = 0.3 - i * 0.4;
        add(top, sphere(hr * 0.2, 12, 10), m.rP, [0, Math.cos(f) * hr * 1.24 + hr * 0.1, Math.sin(f) * hr * 1.24], [f, 0, 0], [0.35, 1.3 - i * 0.08, 0.9]);
      }
    }
    if (hg === 3) {
      const hat = group(top, [0, hr * 0.62, -hr * 0.05], [-0.12, 0, 0.05]);
      add(hat, cyl(hr * 2.0, hr * 2.0, 0.016, 36), m.rP);
      add(hat, cyl(hr * 0.72, hr * 1.08, hr * 1.0, 24), m.rP, [0, hr * 0.5, 0]);
      add(hat, torus(hr * 1.05, hr * 0.09), m.rS, [0, hr * 0.08, 0], [PI / 2, 0, 0]);
      add(hat, new THREE.OctahedronGeometry(hr * 0.13), m.rGold, [0, hr * 0.1, hr * 1.12], [0, 0, 0], [1, 1.2, 0.5]);
      const g1 = group(hat, [0, hr * 1.0, 0], [-0.4, 0, 0]);
      add(g1, cyl(hr * 0.42, hr * 0.72, hr * 0.9, 20), m.rP, [0, hr * 0.45, 0]);
      const g2 = group(g1, [0, hr * 0.9, 0], [-0.55, 0, 0]);
      add(g2, spike(hr * 0.42, hr * 1.0, 20), m.rP);
      add(g2, sphere(hr * 0.09, 10, 8), m.rGold, [0, hr * 1.0, 0]);
    }
    if (hg === 4) {
      const hat = group(top, [0, hr * 0.6, -hr * 0.02], [-0.12, 0, 0.12]);
      add(hat, cyl(hr * 1.8, hr * 1.8, 0.016, 36), m.rLeather, [0, 0, 0], [0, 0, 0], [1, 1, 0.85]);
      add(hat, cyl(hr * 0.95, hr * 1.06, hr * 0.7, 24), m.rLeather, [0, hr * 0.35, 0]);
      add(hat, torus(hr * 1.03, hr * 0.07), m.rP, [0, hr * 0.08, 0], [PI / 2, 0, 0]);
      add(hat, sphere(hr * 0.12, 10, 8), m.rGold, [hr * 0.95, hr * 0.12, hr * 0.3]);
      add(hat, sphere(1, 16, 12), paint('#f2ecdf', 'hair', { rim: 0.6 }), [hr * 0.95, hr * 0.7, -hr * 0.45], [-1.0, 0, -0.35], [hr * 0.08, hr * 0.85, hr * 0.22]);
      add(hat, sphere(1, 12, 10), paint('#b8402f', 'hair', { rim: 0.6 }), [hr * 0.88, hr * 0.55, -hr * 0.25], [-0.8, 0, -0.5], [hr * 0.06, hr * 0.5, hr * 0.16]);
    }
    if (hg === 5) {
      add(top, torus(hr * 1.1, hr * 0.03), m.rGold, [0, hr * 0.25, -hr * 0.02], [PI / 2 - 0.3, 0, 0], [0.97, 1, 1]);
      add(top, new THREE.OctahedronGeometry(hr * 0.1), paint('#4fd6e8', 'plain', { emissive: 0.6, spec: 1, texAmt: 0 }), [0, hr * 0.57, hr * 1.04], [0, 0, 0], [0.8, 1.2, 0.5]);
    }
  }

  // ---------------- Animación ----------------
  wave() { this.waveStart = this.time; this.waveSide = this.d.cls === 'mago' && this.opts.outfit ? -1 : 1; }
  hop() { this.hopStart = this.time; }

  headWorld(target = new THREE.Vector3()) { return this.headTop.getWorldPosition(target); }

  update(t: number) {
    this.time = t;
    const B = this.bones;
    const rest = (b: BoneName) => this.rest.get(B[b])!;
    for (const name of BONES) B[name].rotation.copy(rest(name));
    const b = Math.sin(t * 1.9);
    B.spine.rotation.x += b * 0.012;
    B.chest.rotation.x += b * 0.012;
    B.head.rotation.y = Math.sin(t * 0.45) * 0.18 + Math.sin(t * 1.3) * 0.03;
    B.head.rotation.x = rest('head').x + Math.sin(t * 0.7) * 0.035;
    B.head.rotation.z = Math.sin(t * 0.33) * 0.03;
    B.neck.rotation.y = B.head.rotation.y * 0.3;
    for (const s of [-1, 1]) {
      const ua = B[`upperArm${side(s)}` as BoneName];
      ua.rotation.z += s * b * 0.018;
      ua.rotation.x += Math.sin(t * 1.9 + 1) * 0.025;
    }
    if (this.cat) {
      const amp = this.cat === 1 ? 1 : 0.4;
      B.tail1.rotation.y = Math.sin(t * 1.2) * 0.25 * amp;
      B.tail2.rotation.y = Math.sin(t * 1.2 - 0.7) * 0.3 * amp;
      B.tail3.rotation.y = Math.sin(t * 1.2 - 1.4) * 0.35 * amp;
      B.tail4.rotation.y = Math.sin(t * 1.2 - 2.1) * 0.4 * amp;
      if (this.cat === 1) B.tail3.rotation.x = Math.sin(t * 0.9) * 0.15;
    }

    // parpadeo
    if (t > this.nextBlink) { this.blinkStart = t; this.nextBlink = t + 2.2 + Math.random() * 3.5; }
    const bp = (t - this.blinkStart) / 0.16;
    const close = bp >= 0 && bp <= 1 ? 1 - Math.abs(bp * 2 - 1) : 0;
    this.lids.forEach((l) => (l.rotation.x = THREE.MathUtils.lerp(this.lidOpen, 0.62, close)));

    // saludo
    if (this.waveStart >= 0) {
      const p = (t - this.waveStart) / 2.6;
      if (p > 1) this.waveStart = -1;
      else {
        const w = smooth(0, 0.15, p) * (1 - smooth(0.8, 1, p));
        const s = this.waveSide, Sd = side(s);
        const ua = B[`upperArm${Sd}` as BoneName], fa = B[`forearm${Sd}` as BoneName];
        ua.rotation.z = THREE.MathUtils.lerp(ua.rotation.z, s * 1.85, w);
        ua.rotation.x = THREE.MathUtils.lerp(ua.rotation.x, -0.15, w);
        fa.rotation.x = THREE.MathUtils.lerp(fa.rotation.x, 0, w);
        fa.rotation.z = s * w * (0.55 + Math.sin(t * 10) * 0.4);
        B.head.rotation.z += -s * w * 0.1;
      }
    }

    // saltito
    if (this.hopStart >= 0) {
      const p = (t - this.hopStart) / 0.5;
      if (p > 1) { this.hopStart = -1; this.body.position.y = 0; this.body.scale.set(1, 1, 1); }
      else {
        this.body.position.y = Math.sin(PI * p) * 0.1;
        const sq = Math.sin(PI * 2 * p) * 0.04;
        this.body.scale.set(1 + sq, 1 - sq, 1 + sq);
      }
    }

    // armas en vertical, pase lo que pase con el brazo
    if (this.upright.length) {
      this.root.updateMatrixWorld(true);
      this.root.getWorldQuaternion(this.q2);
      for (const o of this.upright) {
        o.parent!.getWorldQuaternion(this.q);
        o.quaternion.copy(this.q.invert().multiply(this.q2));
      }
    }
    if (this.glow) this.glow.scale.setScalar(0.45 + Math.sin(t * 3) * 0.05 + Math.sin(t * 7.3) * 0.03);
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        if (!o.geometry.userData.cached) o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
