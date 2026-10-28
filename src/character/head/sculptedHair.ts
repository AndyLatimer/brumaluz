import * as THREE from 'three';
import type { HeadOptions, HeadKit } from './types';
import { HEAD_C, C_HAIR, V, paintCell, smoothNormals } from './geometry';

type Surface = (direction: THREE.Vector3, out?: number) => THREE.Vector3;
type HairPiece = { geo: THREE.BufferGeometry; kit: HeadKit };
const TAU = Math.PI * 2;
const smooth = THREE.MathUtils.smoothstep;
export const hasSculptedHair = (id: number) => id > 0 && ![7, 12, 13, 14, 15].includes(id);
// Silhouette and comb direction belong to each haircut, not just its attached tail.
const PROFILES: Record<number, { fringe: number; nape: number; part: number; locks: number; sweep?: number }> = {
  1: { fringe: 1.24, nape: 1.88, part: .015, locks: 18 },
  2: { fringe: 1.18, nape: 1.98, part: -.035, locks: 15 },
  3: { fringe: 1.12, nape: 2.12, part: .11, locks: 22 },
  4: { fringe: 1.03, nape: 2.06, part: -.04, locks: 24 },
  5: { fringe: 1.01, nape: 1.98, part: .035, locks: 28 },
  6: { fringe: 1.19, nape: 1.98, part: .075, locks: 20 },
  9: { fringe: 1.06, nape: 2.08, part: .055, locks: 24 },
  10: { fringe: 1.16, nape: 1.95, part: .07, locks: 22 },
  16: { fringe: 1.13, nape: 2.08, part: .12, locks: 23, sweep: .08 },
  17: { fringe: 1.15, nape: 2.05, part: .07, locks: 26 },
  18: { fringe: 1.2, nape: 1.97, part: -.04, locks: 20, sweep: -.075 },
  19: { fringe: 1.22, nape: 2.02, part: .045, locks: 21, sweep: .18 },
  20: { fringe: 1.13, nape: 2.14, part: -.065, locks: 17 },
  21: { fringe: 1.08, nape: 2.04, part: .025, locks: 30 },
  22: { fringe: 1.02, nape: 2.02, part: .05, locks: 27 },
  23: { fringe: 1.09, nape: 2.02, part: .105, locks: 26 },
  24: { fringe: 1.2, nape: 2.12, part: .07, locks: 19, sweep: .23 },
  25: { fringe: 1.12, nape: 1.9, part: .01, locks: 22 },
  26: { fringe: 1.06, nape: 2.03, part: .085, locks: 28 },
  27: { fringe: 1.18, nape: 1.98, part: .08, locks: 24 },
};

/** Finished surfaces: flow, hairline and silhouette are modelled together, before attachments. */
export function sculptedHair(o: HeadOptions, headAt: Surface): HairPiece[] | null {
  if (o.hat === 'helmet') return [];
  if (!hasSculptedHair(o.hair)) return null;
  const pieces: HairPiece[] = [];
  const add = (geo: THREE.BufferGeometry, cell = C_HAIR) => {
    geo.userData.surfaceReady = true;
    pieces.push({ geo: paintCell(geo, cell, .17, .8), kit: o.face });
  };
  const gathered = [4, 5, 6, 9, 10, 16, 17, 18, 19, 21, 22, 23, 26, 27].includes(o.hair);
  const curly = o.hair === 11 || o.hair === 25;
  const long = o.hair === 8;
  const bob = [3, 11, 20, 24].includes(o.hair);
  const profile = PROFILES[o.hair] ?? { fringe: 1.1, nape: 2.12, part: .11, locks: 22 };
  const twinRoots = [6, 10, 17, 27].includes(o.hair);
  const rootDirection = V(0, o.hair === 22 ? .65 : .25, -1).normalize();
  const leftRoot = V(-.7, .6, -1).normalize(), rightRoot = V(.7, .6, -1).normalize();
  const boundaryAt = (phi: number) => {
    const front = Math.max(0, Math.cos(phi)), back = Math.max(0, -Math.cos(phi));
    const side = Math.abs(Math.sin(phi));
    const parted = profile.part * Math.sin(phi * 2) * front + .025 * Math.sin(phi * 5 + .4) * front;
    const scallop = curly ? (o.hair === 25 ? .024 : .038) * Math.sin(phi * 18 + .4) : .009 * Math.sin(phi * 12);
    return 1.94 - (1.94 - profile.fringe) * front ** 1.4 + (profile.nape - 1.94) * back - .22 * side ** 12
      + parted + scallop + (profile.sweep ?? 0) * Math.sin(phi) * front;
  };
  // Roots and braids use the finished surface, including its relief and volume.
  const at = (phi: number, t: number, inner = false) => {
    const front = Math.max(0, Math.cos(phi)), back = Math.max(0, -Math.cos(phi));
    const theta = t * boundaryAt(phi);
    const dir = V(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
    const gather = gathered ? Math.max(0, twinRoots ? Math.max(dir.dot(leftRoot), dir.dot(rightRoot)) : dir.dot(rootDirection)) ** 5 : 0;
    const flow = phi + (gathered ? .33 : .14) * Math.sin(theta) * Math.sin(phi) + (profile.sweep ?? 0) * Math.sin(theta);
    const volume = .028 + .035 * Math.sin(t * Math.PI) ** 2 + gather * .025;
    // Broad locks and incised secondary channels, tapered at the crown and hairline.
    const relief = (.008 * Math.cos(flow * profile.locks + theta * 2) + .0025 * Math.cos(flow * profile.locks * 3 + theta * 5))
      * Math.sin(Math.PI * Math.min(1, t * 1.3)) ** .6;
    const curl = curly ? (.011 * Math.sin(flow * 23 + Math.sin(theta * 9)) * Math.sin(theta * 27 + Math.cos(phi * 11))
      + .012 * Math.cos(flow * 12 - theta * 15) ** 2) * smooth(t, 0, .12) : 0;
    const messy = o.hair === 2 ? .025 * Math.sin(phi * 7 + theta * 6) ** 2 * Math.sin(Math.PI * t) : 0;
    const finished = volume + relief + curl + messy;
    const lift = (o.hat === 'none' ? finished : .015 + finished * .18) - (inner ? (o.hat === 'none' ? .018 : .009) : 0);
    const p = headAt(dir, lift);
    const fall = smooth(t, .55, 1) * (1 - front ** 3);
    const length = long ? .46 : bob ? .2 : 0;
    const asymmetry = o.hair === 24 ? .12 * Math.sin(phi) : 0;
    if (length) {
      p.y -= fall * (length + asymmetry);
      p.x += Math.sin(phi) * fall * (.035 + (curly ? .025 * Math.cos(phi * 9 + t * 8) : 0));
      p.z -= back * fall * .045;
      const wave = o.hair === 20 || o.hair === 24 || curly ? .014 * Math.sin(t * 11 + phi * 7) * fall : 0;
      p.x += Math.sin(phi) * wave; p.z += Math.cos(phi) * wave;
    }
    return p;
  };
  const hairAt = (direction: THREE.Vector3, out = 0) => {
    const dir = direction.clone().normalize(), phi = Math.atan2(dir.x, dir.z);
    const t = THREE.MathUtils.clamp(Math.acos(dir.y) / boundaryAt(phi), 0, 1);
    return at(phi, t).addScaledVector(dir, out);
  };
  const segments = curly ? 144 : 128, rows = curly ? 48 : 36;
  const positions: number[] = [], indices: number[] = [];
  // One continuous closed shell, including an inner surface and rolled hairline.
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= segments; col++) {
    const p = at(col / segments * TAU, row / rows, layer === 1); positions.push(p.x, p.y, p.z);
  }
  const layerSize = (rows + 1) * (segments + 1);
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row < rows; row++) for (let col = 0; col < segments; col++) {
    const a = layer * layerSize + row * (segments + 1) + col, b = a + 1, c = a + segments + 1, d = c + 1;
    if (!layer) { if (row) indices.push(a, c, b); indices.push(b, c, d); }
    else { if (row) indices.push(a, b, c); indices.push(b, d, c); }
  }
  for (let col = 0; col < segments; col++) {
    const a = rows * (segments + 1) + col, b = a + 1;
    indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
  }
  const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); shell.setIndex(indices);
  shell.computeVertexNormals(); add(smoothNormals(shell, 75));

  // Closed, grooved lock with a broad embedded root and a pointed end.
  const lock = (points: THREE.Vector3[], radius: number, end: number, steps = 64, flat = .8, cell = C_HAIR, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal'), frames = curve.computeFrenetFrames(steps, closed);
    const sides = 12, rings = closed ? steps : steps + 1, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i < rings; i++) {
      const t = i / steps, center = curve.getPointAt(t);
      const taper = closed ? 1 : Math.sqrt(Math.max(.0001, 1 - smooth(t, .8, 1)));
      const r = THREE.MathUtils.lerp(radius, end, t) * taper;
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * TAU, groove = 1 + .075 * Math.cos(angle * 5 + t * (closed ? TAU * 3 : 3));
        const p = center.clone().addScaledVector(frames.normals[i], Math.cos(angle) * r * groove)
          .addScaledVector(frames.binormals[i], Math.sin(angle) * r * flat * groove);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
      const next = (i + 1) % rings * sides, a = i * sides + j, b = i * sides + (j + 1) % sides;
      idx.push(a, b, next + j, b, next + (j + 1) % sides, next + j);
    }
    if (!closed) for (let j = 1; j < sides - 1; j++) { idx.push(0, j + 1, j); const tip = steps * sides; idx.push(tip, tip + j, tip + j + 1); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geometry.setIndex(idx); geometry.computeVertexNormals(); add(geometry, cell);
  };
  const braid = (points: THREE.Vector3[], radius: number, turns: number, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal'), steps = Math.max(64, turns * 12);
    for (let strand = 0; strand < 3; strand++) {
      const path: THREE.Vector3[] = [];
      for (let k = 0; k < (closed ? steps : steps + 1); k++) {
        const t = k / steps, center = curve.getPointAt(t), tangent = curve.getTangentAt(t);
        const outward = center.clone().sub(HEAD_C).normalize();
        const across = new THREE.Vector3().crossVectors(tangent, outward).normalize();
        if (across.lengthSq() < .01) across.set(1, 0, 0);
        const depth = new THREE.Vector3().crossVectors(across, tangent).normalize();
        const angle = t * TAU * turns + strand * TAU / 3, width = radius * (closed ? 1 : 1 - t * .55);
        // Flattened over/under crossing, rather than three helices around a rope.
        path.push(center.addScaledVector(across, Math.sin(angle) * width * .64)
          .addScaledVector(depth, Math.cos(angle * 2) * width * .22));
      }
      lock(path, radius * .4, radius * (closed ? .4 : .16), steps, .7, C_HAIR, closed);
    }
  };
  const bun = (direction: THREE.Vector3, size: number, turns: number) => {
    const normal = direction.clone().normalize(), root = hairAt(normal, .015);
    const right = new THREE.Vector3().crossVectors(V(0, 1, 0), normal).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const pos: number[] = [], idx: number[] = [], u = 96, v = 32;
    // A single sculpted coil volume: the seam and spiral are part of its surface.
    for (let row = 0; row <= v; row++) for (let col = 0; col <= u; col++) {
      const theta = row / v * Math.PI, phi = col / u * TAU;
      const fold = .008 * Math.cos(phi * turns + theta * 11) * Math.sin(theta);
      const radial = size * Math.sin(theta) * (1 + .05 * Math.cos(phi * 3)) + fold;
      const p = root.clone().addScaledVector(right, radial * Math.cos(phi)).addScaledVector(up, radial * Math.sin(phi) * .9)
        .addScaledVector(normal, Math.cos(theta) * size * .58 + .025 * Math.sin(theta) ** 2);
      pos.push(p.x, p.y, p.z);
    }
    for (let row = 0; row < v; row++) for (let col = 0; col < u; col++) {
      const a = row * (u + 1) + col, b = a + 1, c = a + u + 1;
      if (row) idx.push(a, c, b); if (row < v - 1) idx.push(b, c, c + 1);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geometry.setIndex(idx); geometry.computeVertexNormals(); add(smoothNormals(geometry, 75));
  };
  const tail = (side: number, high = false, plait = false) => {
    const root = hairAt(V(side * .78, high ? .7 : .1, -1), -.035);
    const points = [root, root.clone().add(V(side * .025, -.09, -.09)), root.clone().add(V(side * .055, -.34, -.14)), root.clone().add(V(side * .045, plait ? -.72 : -.62, -.12))];
    if (plait) braid(points, .088, 6); else lock(points, .105, .035, 64, .85);
  };
  if ([4, 19].includes(o.hair)) tail(0, o.hair === 19);
  if (o.hair === 6) for (const side of [-1, 1]) tail(side);
  if (o.hair === 9 || o.hair === 22) tail(0, o.hair === 22, true);
  if (o.hair === 16 || o.hair === 17) for (const side of o.hair === 16 ? [1] : [-1, 1]) tail(side, false, true);
  if (o.hat === 'none') {
    if ([5, 18, 23].includes(o.hair)) bun(V(0, o.hair === 5 ? 1.5 : .4, -1), o.hair === 23 ? .18 : .16, o.hair === 23 ? 12 : 8);
    if (o.hair === 10 || o.hair === 27) for (const side of [-1, 1]) bun(V(side * .7, .9, -.55), .14, o.hair === 27 ? 12 : 7);
    if (o.hair === 21 || o.hair === 26) {
      const closed = o.hair === 21;
      const points: THREE.Vector3[] = [];
      for (let k = 0; k < (closed ? 96 : 65); k++) {
        const t = k / (closed ? 96 : 64), phi = closed ? t * TAU : 1.35 + t * (TAU - 2.7);
        const inset = closed ? .018 : .018 - .04 * (1 - smooth(t, 0, .08)) - .035 * smooth(t, .92, 1);
        points.push(hairAt(V(Math.sin(phi), closed ? .8 : .1, Math.cos(phi)), inset));
      }
      braid(points, .052, closed ? 18 : 12, closed);
    }
  }
  return pieces;
}
