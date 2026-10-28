// El cráneo: superficie lisa de la cabeza y las herramientas para apoyar en ella el resto de piezas.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HeadKit, HeadOptions } from './types';
import type { Analysis } from './analysis';
import { EYE, BROW } from './eyes';
import { V, HEAD_C, paintCell, C_SKIN, PI } from './geometry';
import { GeometryTemplates } from './geometryCache';
const skullTemplates = new GeometryTemplates(20 * 1024 * 1024, 16);
type HeadHit = { point: THREE.Vector3; normal: THREE.Vector3 };
// Projection depends only on skull shape and coordinates, never on colour or expression.
const faceProjections = new Map<string, HeadHit>();

export const HEAD_SHAPES: Record<HeadKit, { rx: number; ryDown: number; nLow: number }> = {
  Rogue: { rx: 0.485, ryDown: 0.43, nLow: 2.45 }, // dulce: redonda y mofletuda
  Mage: { rx: 0.47, ryDown: 0.44, nLow: 2.7 }, // serio
  Knight: { rx: 0.462, ryDown: 0.46, nLow: 2.9 }, // noble: barbilla algo más larga
  Barbarian: { rx: 0.49, ryDown: 0.465, nLow: 3.7 }, // cuadrada: mandíbula marcada
};
/** Cabeza de la cabeza (parte de buildHead). */
export function buildSkull({ o, A, material }: { o: HeadOptions; A: Analysis; material: (kit: HeadKit) => THREE.Material }) {
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
    const templateKey = JSON.stringify([o.face, o.hat === 'helmet']);
    const cached = skullTemplates.get(templateKey); if (cached) return cached[0];
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
    skullTemplates.set(templateKey, [flat]);
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
  const rayHead = (origin: THREE.Vector3, d: THREE.Vector3): HeadHit | null => {
    const frontKey = origin.z === 2 && d.x === 0 && d.y === 0 && d.z === -1 ? `${o.face}:${origin.x},${origin.y}` : '';
    const cached = frontKey ? faceProjections.get(frontKey) : undefined;
    if (cached) {
      faceProjections.delete(frontKey); faceProjections.set(frontKey, cached);
      return { point: cached.point.clone(), normal: cached.normal.clone() };
    }
    // entrada en la esfera que envuelve la cabeza
    const ox = origin.x - HEAD_C.x, oy = origin.y - HEAD_C.y, oz = origin.z - HEAD_C.z;
    const bq = ox * d.x + oy * d.y + oz * d.z, cq = ox * ox + oy * oy + oz * oz - 0.56 * 0.56, disc = bq * bq - cq;
    if (disc < 0) return null;
    let t = Math.max(0, -bq - Math.sqrt(disc));
    const tEnd = -bq + Math.sqrt(disc);
    let prev = t, hit = false;
    for (; t <= tEnd; t += 0.006) {
      if (insideHead(origin.x + d.x * t, origin.y + d.y * t, origin.z + d.z * t)) { hit = true; break; }
      prev = t;
    }
    if (!hit) return null;
    let a = prev, b = t;
    for (let i = 0; i < 18; i++) { const m = (a + b) / 2; if (insideHead(origin.x + d.x * m, origin.y + d.y * m, origin.z + d.z * m)) b = m; else a = m; }
    const point = V(origin.x + d.x * b, origin.y + d.y * b, origin.z + d.z * b);
    // normal: gradiente numérico de la superficie
    const F = (x: number, y: number, z: number) => { const vx = x - HEAD_C.x, vy = y - HEAD_C.y, vz = z - HEAD_C.z, L = Math.hypot(vx, vy, vz); return L - headR(_dir.set(vx / L, vy / L, vz / L)); };
    const e = 0.002;
    const normal = V(
      F(point.x + e, point.y, point.z) - F(point.x - e, point.y, point.z),
      F(point.x, point.y + e, point.z) - F(point.x, point.y - e, point.z),
      F(point.x, point.y, point.z + e) - F(point.x, point.y, point.z - e),
    ).normalize();
    if (frontKey) {
      faceProjections.set(frontKey, { point: point.clone(), normal: normal.clone() });
      if (faceProjections.size > 4096) faceProjections.delete(faceProjections.keys().next().value!);
    }
    return { point, normal };
  };
  const skinParts: THREE.BufferGeometry[] = [];
  const frontZ = (x: number, y: number) => rayHead(V(x, y, 2), V(0, 0, -1))?.point.z ?? 0.44;
  if (!beast) {
    // nariz: una pieza lisa, pequeña y medio hundida
    const NS: [number, number, number, number][] = [ // ancho, alto, fondo, giro
      [0.042, 0.036, 0.034, 0], [0.062, 0.055, 0.05, 0], [0.045, 0.04, 0.038, -0.45],
      [0.07, 0.04, 0.04, 0], [0.042, 0.058, 0.05, 0.35], [0.05, 0.048, 0.045, 0],
      [0.035, 0.055, 0.035, 0], [0.057, 0.043, 0.048, -0.12], [0.029, 0.033, 0.028, -0.2],
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
  return { headR, fitHairShell, settle, pushOut, headAt, rayHead, nose, E, beast, E0, B, extras, headRay, skinParts, frontZ, headMesh };
}
