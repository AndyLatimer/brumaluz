// ---------------------------------------------------------------------------
// Escultor por campos de distancia (SDF) + mallado con Surface Nets.
// Los personajes se "esculpen" fundiendo formas suaves (elipsoides y conos
// redondeados) y se convierten en una única malla continua, sin juntas.
// ---------------------------------------------------------------------------

export type V3 = [number, number, number];

export class Prim {
  min: V3 = [0, 0, 0];
  max: V3 = [0, 0, 0];
  cuts: number[] = []; // planos (nx, ny, nz, d): se conserva donde n·p - d <= 0
  bone = 0;
  tint: V3 = [0, 0, 0]; // (claro, oscuro, rubor)
  // parámetros
  private kind: 0 | 1 | 2;
  private c: V3; private r: V3;
  private a: V3 = [0, 0, 0]; private ba: V3 = [0, 0, 0];
  private r1 = 0; private r2 = 0; private l2 = 0; private rr = 0; private a2 = 0; private il2 = 0;

  static ell(c: V3, r: V3) { return new Prim(0, c, r); }
  static cone(a: V3, b: V3, r1: number, r2: number) { const p = new Prim(1, a, [0, 0, 0]); p.setCone(a, b, r1, r2); return p; }
  /** Toro de eje Y (radio mayor R, menor t), con escala elíptica en X/Z. */
  static torus(c: V3, R: number, t: number, sx = 1, sz = 1) { return new Prim(2, c, [R, t, 0], sx, sz); }

  private sx = 1; private sz = 1;
  private constructor(kind: 0 | 1 | 2, c: V3, r: V3, sx = 1, sz = 1) {
    this.kind = kind; this.c = c; this.r = r; this.sx = sx; this.sz = sz;
    if (kind === 0) { this.min = [c[0] - r[0], c[1] - r[1], c[2] - r[2]]; this.max = [c[0] + r[0], c[1] + r[1], c[2] + r[2]]; }
    if (kind === 2) {
      const ex = (r[0] + r[1]) * sx, ez = (r[0] + r[1]) * sz;
      this.min = [c[0] - ex, c[1] - r[1], c[2] - ez]; this.max = [c[0] + ex, c[1] + r[1], c[2] + ez];
    }
  }

  private setCone(a: V3, b: V3, r1: number, r2: number) {
    this.a = a; this.r1 = r1; this.r2 = r2;
    this.ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    this.l2 = Math.max(this.ba[0] ** 2 + this.ba[1] ** 2 + this.ba[2] ** 2, 1e-8);
    this.rr = r1 - r2; this.a2 = this.l2 - this.rr * this.rr; this.il2 = 1 / this.l2;
    const m = Math.max(r1, r2);
    this.min = [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.min(a[2], b[2]) - m];
    this.max = [Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, Math.max(a[2], b[2]) + m];
    this.c = b;
  }

  /** Copia engordada t (para ropa que se ajusta al cuerpo). */
  inflate(t: number): Prim {
    let p: Prim;
    if (this.kind === 0) p = Prim.ell(this.c, [this.r[0] + t, this.r[1] + t, this.r[2] + t]);
    else if (this.kind === 1) p = Prim.cone(this.a, [this.a[0] + this.ba[0], this.a[1] + this.ba[1], this.a[2] + this.ba[2]], this.r1 + t, this.r2 + t);
    else p = Prim.torus(this.c, this.r[0], this.r[1] + t, this.sx, this.sz);
    p.cuts = this.cuts.slice(); p.bone = this.bone; p.tint = this.tint;
    return p;
  }

  cut(nx: number, ny: number, nz: number, px: number, py: number, pz: number) {
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    this.cuts.push(nx, ny, nz, nx * px + ny * py + nz * pz);
    return this;
  }
  /** Conserva sólo y >= y0 */
  above(y0: number) { return this.cut(0, -1, 0, 0, y0, 0); }
  /** Conserva sólo y <= y1 */
  below(y1: number) { return this.cut(0, 1, 0, 0, y1, 0); }

  dist(x: number, y: number, z: number): number {
    let d: number;
    if (this.kind === 0) {
      const px = x - this.c[0], py = y - this.c[1], pz = z - this.c[2];
      const rx = this.r[0], ry = this.r[1], rz = this.r[2];
      const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
      const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
      d = k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    } else if (this.kind === 1) {
      const pax = x - this.a[0], pay = y - this.a[1], paz = z - this.a[2];
      const bax = this.ba[0], bay = this.ba[1], baz = this.ba[2];
      const l2 = this.l2;
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yy * yy * l2, z2 = zz * zz * l2;
      const k = Math.sign(this.rr) * this.rr * this.rr * x2;
      if (Math.sign(zz) * this.a2 * z2 > k) d = Math.sqrt(x2 + z2) * this.il2 - this.r2;
      else if (Math.sign(yy) * this.a2 * y2 < k) d = Math.sqrt(x2 + y2) * this.il2 - this.r1;
      else d = (Math.sqrt(x2 * this.a2 * this.il2) + yy * this.rr) * this.il2 - this.r1;
    } else {
      const px = (x - this.c[0]) / this.sx, pz = (z - this.c[2]) / this.sz, py = y - this.c[1];
      const q = Math.hypot(px, pz) - this.r[0];
      d = Math.hypot(q, py) - this.r[1];
    }
    const cs = this.cuts;
    for (let i = 0; i < cs.length; i += 4) {
      const v = cs[i] * x + cs[i + 1] * y + cs[i + 2] * z - cs[i + 3];
      if (v > d) d = v;
    }
    return d;
  }
}

export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * Forma: un "tronco" (todas sus piezas se funden con kT) y "miembros"
 * (cada uno funde sus piezas con kL y se une al tronco con kJ, pero los
 * miembros NO se funden entre sí: los brazos no se pegan a la cadera).
 * `sub` resta volumen (cuencas de los ojos, fosas nasales…).
 */
export interface Shape {
  torso: Prim[];
  limbs: Prim[][];
  sub?: Prim[];
  kT: number; kL: number; kJ: number; kS?: number;
}

function sminList(list: Prim[], x: number, y: number, z: number, k: number) {
  let d = 1e9;
  for (let i = 0; i < list.length; i++) d = smin(d, list[i].dist(x, y, z), k);
  return d;
}

export function evalShape(s: Shape, x: number, y: number, z: number) {
  const t = s.torso.length ? sminList(s.torso, x, y, z, s.kT) : 1e9;
  let d = t;
  for (let i = 0; i < s.limbs.length; i++) {
    const l = sminList(s.limbs[i], x, y, z, s.kL);
    const j = smin(t, l, s.kJ);
    if (j < d) d = j;
  }
  if (s.sub) for (let i = 0; i < s.sub.length; i++) d = -smin(-d, s.sub[i].dist(x, y, z), s.kS ?? 0.01);
  return d;
}

/** Busca la superficie a lo largo de +Z (para colocar rasgos de la cara). */
export function surfaceZ(s: Shape, x: number, y: number, zMax = 0.3) {
  for (let z = zMax; z > -0.05; z -= 0.0005) if (evalShape(s, x, y, z) < 0) return z;
  return 0;
}

export function allPrims(s: Shape) { return [...s.torso, ...s.limbs.flat()]; }

function bounds(s: Shape, pad: number) {
  const mn: V3 = [1e9, 1e9, 1e9], mx: V3 = [-1e9, -1e9, -1e9];
  for (const p of allPrims(s)) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.min[i]); mx[i] = Math.max(mx[i], p.max[i]); }
  return { mn: mn.map((v) => v - pad) as V3, mx: mx.map((v) => v + pad) as V3 };
}

function cull(s: Shape, lo: V3, hi: V3, m: number): Shape {
  const hit = (p: Prim) => p.max[0] >= lo[0] - m && p.min[0] <= hi[0] + m && p.max[1] >= lo[1] - m && p.min[1] <= hi[1] + m && p.max[2] >= lo[2] - m && p.min[2] <= hi[2] + m;
  const limbs: Prim[][] = [];
  for (const l of s.limbs) { const f = l.filter(hit); if (f.length) limbs.push(f); }
  return { torso: s.torso.filter(hit), limbs, sub: s.sub?.filter(hit), kT: s.kT, kL: s.kL, kJ: s.kJ, kS: s.kS };
}

export interface MeshData {
  pos: Float32Array;
  nrm: Float32Array;
  idx: Uint32Array;
}

/** Malla una forma con Surface Nets en una rejilla de tamaño `cell`. */
export function surfaceNet(shape: Shape, cell: number): MeshData {
  const kMax = Math.max(shape.kT, shape.kL, shape.kJ, shape.kS ?? 0);
  const { mn, mx } = bounds(shape, cell * 2 + kMax * 0.25);
  const nx = Math.ceil((mx[0] - mn[0]) / cell) + 1;
  const ny = Math.ceil((mx[1] - mn[1]) / cell) + 1;
  const nz = Math.ceil((mx[2] - mn[2]) / cell) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  // Evaluación por bloques con descarte de piezas lejanas.
  const B = 8;
  const bnx = Math.ceil(nx / B), bny = Math.ceil(ny / B), bnz = Math.ceil(nz / B);
  const blockShape: Shape[] = new Array(bnx * bny * bnz);
  const margin = kMax + cell * 2;
  for (let bk = 0; bk < bnz; bk++) for (let bj = 0; bj < bny; bj++) for (let bi = 0; bi < bnx; bi++) {
    const i0 = bi * B, j0 = bj * B, k0 = bk * B;
    const i1 = Math.min(i0 + B, nx) - 1, j1 = Math.min(j0 + B, ny) - 1, k1 = Math.min(k0 + B, nz) - 1;
    const lo: V3 = [mn[0] + i0 * cell, mn[1] + j0 * cell, mn[2] + k0 * cell];
    const hi: V3 = [mn[0] + i1 * cell, mn[1] + j1 * cell, mn[2] + k1 * cell];
    const cs = cull(shape, lo, hi, margin);
    blockShape[bi + bnx * (bj + bny * bk)] = cs;
    let fill: number | null = null;
    if (!cs.torso.length && !cs.limbs.length) fill = 1;
    else {
      const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2;
      const half = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
      const dc = evalShape(cs, cx, cy, cz);
      if (Math.abs(dc) > half * 3 + cell * 4) fill = dc;
    }
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      val[id(i, j, k)] = fill ?? evalShape(cs, mn[0] + i * cell, mn[1] + j * cell, mn[2] + k * cell);
    }
  }

  // Un vértice por celda que cruza la superficie.
  const cellId = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const vcell: number[] = [];
  const corner = new Float32Array(8);
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = val[id(i + CO[c][0], j + CO[c][1], k + CO[c][2])];
      corner[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = corner[a], vb = corner[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t;
      sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t;
      sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t;
      n++;
    }
    cellId[cid(i, j, k)] = pos.length / 3;
    pos.push(mn[0] + (i + sx / n) * cell, mn[1] + (j + sy / n) * cell, mn[2] + (k + sz / n) * cell);
    vcell.push(Math.floor(i / B) + bnx * (Math.floor(j / B) + bny * Math.floor(k / B)));
  }

  // Caras: un quad por cada arista de la rejilla que cruza la superficie.
  const idx: number[] = [];
  // El orden de las 4 celdas alrededor de la arista es antihorario visto desde +eje,
  // así que la orientación sólo depende de qué lado está dentro.
  const d2 = (p: number, q: number) => (pos[p * 3] - pos[q * 3]) ** 2 + (pos[p * 3 + 1] - pos[q * 3 + 1]) ** 2 + (pos[p * 3 + 2] - pos[q * 3 + 2]) ** 2;
  const quad = (a: number, b: number, c: number, d: number, _axis: number, inside: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (!inside) { const t = b; b = d; d = t; }
    // partir por la diagonal más corta
    if (d2(a, c) <= d2(b, d)) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = val[id(i, j, k)];
    const in0 = v0 < 0;
    if (j > 0 && k > 0 && (val[id(i + 1, j, k)] < 0) !== in0)
      quad(cellId[cid(i, j, k)], cellId[cid(i, j - 1, k)], cellId[cid(i, j - 1, k - 1)], cellId[cid(i, j, k - 1)], 0, in0);
    if (i > 0 && k > 0 && (val[id(i, j + 1, k)] < 0) !== in0)
      quad(cellId[cid(i, j, k)], cellId[cid(i, j, k - 1)], cellId[cid(i - 1, j, k - 1)], cellId[cid(i - 1, j, k)], 1, in0);
    if (i > 0 && j > 0 && (val[id(i, j, k + 1)] < 0) !== in0)
      quad(cellId[cid(i, j, k)], cellId[cid(i - 1, j, k)], cellId[cid(i - 1, j - 1, k)], cellId[cid(i, j - 1, k)], 2, in0);
  }

  // Normales analíticas desde el campo (muy suaves).
  const nv = pos.length / 3;
  const nrm = new Float32Array(nv * 3);
  const h = cell * 0.5;
  for (let v = 0; v < nv; v++) {
    const s = blockShape[vcell[v]];
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const gx = evalShape(s, x + h, y, z) - evalShape(s, x - h, y, z);
    const gy = evalShape(s, x, y + h, z) - evalShape(s, x, y - h, z);
    const gz = evalShape(s, x, y, z + h) - evalShape(s, x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l; nrm[v * 3 + 1] = gy / l; nrm[v * 3 + 2] = gz / l;
  }
  return { pos: new Float32Array(pos), nrm, idx: new Uint32Array(idx) };
}

/**
 * Pesos de piel: cada vértice se ata a los huesos de las piezas más cercanas,
 * con transición suave en las articulaciones. También mezcla los tintes.
 */
export function skinAndTint(pos: Float32Array, prims: Prim[], sigma = 0.012, withSkin = true) {
  const n = pos.length / 3;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const tint = new Float32Array(n * 3);
  const d = new Float32Array(prims.length);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let dmin = 1e9;
    for (let i = 0; i < prims.length; i++) { d[i] = Math.max(prims[i].dist(x, y, z), 0); if (d[i] < dmin) dmin = d[i]; }
    const bw = new Map<number, number>();
    let tw = 0, t0 = 0, t1 = 0, t2 = 0;
    for (let i = 0; i < prims.length; i++) {
      const w = Math.exp(-(d[i] - dmin) / sigma);
      if (w < 0.01) continue;
      const b = prims[i].bone;
      bw.set(b, Math.max(bw.get(b) ?? 0, w));
      const tw2 = Math.exp(-(d[i] - dmin) / (sigma * 0.6));
      tw += tw2; t0 += prims[i].tint[0] * tw2; t1 += prims[i].tint[1] * tw2; t2 += prims[i].tint[2] * tw2;
    }
    tint[v * 3] = t0 / tw; tint[v * 3 + 1] = t1 / tw; tint[v * 3 + 2] = t2 / tw;
    if (!withSkin) continue;
    const top = [...bw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0);
    top.forEach(([b, w], k) => { skinIndex[v * 4 + k] = b; skinWeight[v * 4 + k] = w / sum; });
  }
  return { skinIndex, skinWeight, tint };
}
