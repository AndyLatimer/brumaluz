// Peinados: piezas de pelo de KayKit y las propias, asentadas sobre el cráneo.
import * as THREE from 'three';
import type { HeadOptions, HeadKit, HeadSource, CreatorParts } from './types';
import { type Tris, V, HEAD_C, CENTER, toGeometry, toTris, subset, C_HAIR, piece, compose, PI, smoothNormals, paintCell } from './geometry';
import { analyse, smallFrontIslands } from './analysis';

/** Pelo de la cabeza (parte de buildHead). */
export function buildHair({ o, headR, fitHairShell, settle, pushOut, sources, parts, headAt }: { o: HeadOptions; headR: (d: THREE.Vector3) => number; fitHairShell: (g: THREE.BufferGeometry) => THREE.BufferGeometry<THREE.NormalBufferAttributes>; settle: (g: THREE.BufferGeometry, margin: number) => THREE.BufferGeometry<THREE.NormalBufferAttributes>; pushOut: (g: THREE.BufferGeometry, margin: number) => THREE.BufferGeometry<THREE.NormalBufferAttributes>; sources: Record<HeadKit, HeadSource>; parts: CreatorParts; headAt: (dir: THREE.Vector3, out?: number) => THREE.Vector3 }) {
  const hatShrink = o.hat === 'helmet' ? 0.9 : o.hat === 'bear' ? 0.92 : o.hat === 'wizard' ? 0.94 : o.hat === 'cap' ? 0.96 : 1;
  const hairPieces: { geo: THREE.BufferGeometry; kit: HeadKit }[] = [];
  const addHair = (h: Tris, kit: HeadKit, closeFit = 1, fit: 'shell' | 'authored' | 'cropped' = 'shell') => {
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
    const geometry = toGeometry(T, true);
    if (fit === 'cropped') {
      const p = geometry.attributes.position;
      const direction = V(0, 0, 0);
      for (let i = 0; i < p.count; i++) {
        direction.set(p.getX(i) - HEAD_C.x, p.getY(i) - HEAD_C.y, p.getZ(i) - HEAD_C.z);
        const length = direction.length();
        direction.normalize();
        const radius = headR(direction) + .012 + Math.min(.045, Math.max(0, length - headR(direction)) * .3);
        p.setXYZ(i, HEAD_C.x + direction.x * radius, HEAD_C.y + direction.y * radius, HEAD_C.z + direction.z * radius);
      }
      geometry.computeVertexNormals();
    }
    const fitted = fit === 'shell' ? fitHairShell(geometry) : fit === 'authored' ? settle(geometry, .018) : geometry;
    hairPieces.push({ geo: pushOut(fitted, 0.014), kit });
  };
  const kitHair = (kit: HeadKit, closeFit = 1) => {
    const h = analyse(sources[kit]).hair;
    if (h && kit !== 'Barbarian') addHair(h, kit, closeFit);
  };
  const importedHair = (id: 'ranger-hair' | 'rogue-fringe', cropped = false) => {
    const triangles = toTris(parts[id]);
    const brows = smallFrontIslands(triangles, () => true, true);
    const hair = subset(triangles, triangle => !brows.has(triangle));
    addHair(hair, o.face, 1, cropped ? 'cropped' : 'authored');
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
  const braid = (points: THREE.Vector3[], radius: number, turns: number) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const frames = curve.computeFrenetFrames(64, false);
    for (let lock = 0; lock < 3; lock++) {
      const path: THREE.Vector3[] = [];
      for (let k = 0; k <= 64; k++) {
        const t = k / 64, angle = t * PI * 2 * turns + lock * PI * 2 / 3;
        const width = radius * 0.5 * (1 - t * 0.55);
        path.push(curve.getPointAt(t).addScaledVector(frames.normals[k], Math.sin(angle) * width)
          .addScaledVector(frames.binormals[k], Math.cos(angle) * width * 0.65));
      }
      hairPieces.push({ geo: pushOut(strand(path, radius * 0.49, radius * 0.18), 0.014), kit: o.face });
    }
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
        const positions: number[] = [], indices: number[] = [];
        for (let k = 0; k <= 40; k++) {
          const t = k / 40, a = 1.05 - t * 2.5, dir = V(0, Math.cos(a), Math.sin(a));
          const height = 0.025 + Math.sin(t * PI) * 0.16;
          for (const [x, out] of [[-0.052, -0.025], [-0.025, height], [0.025, height], [0.052, -0.025]]) {
            const point = headAt(dir, out); positions.push(x, point.y, point.z);
          }
          if (k) for (let j = 0; j < 4; j++) {
            const a = (k - 1) * 4 + j, b = (k - 1) * 4 + (j + 1) % 4;
            indices.push(a, a + 4, b, b, a + 4, b + 4);
          }
        }
        const crest = new THREE.BufferGeometry();
        crest.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); crest.setIndex(indices); crest.computeVertexNormals();
        hairPieces.push({ geo: paintCell(crest, hairCell, 0.2, 0.8), kit: o.face });
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
      braid([headAt(V(0, 0.22, -1), -0.025), V(0, 1.6, -0.52), V(0, 1.36, -0.57), V(0, 1.12, -0.55), V(0, 0.99, -0.5)], 0.09, 5);
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
    case 12: {
      kitHair('Mage', .97);
      importedHair('rogue-fringe');
      break;
    }
    case 13:
      importedHair('ranger-hair', true);
      break;
    case 14:
      importedHair('ranger-hair');
      break;
    case 15: {
      kitHair('Rogue', .97);
      importedHair('rogue-fringe');
      break;
    }
    case 16:
    case 17: { // Trenzas con la raíz hundida en la cubierta, fuera del cuello.
      kitHair('Rogue');
      for (const side of o.hair === 16 ? [1] : [-1, 1]) {
        const root = headAt(V(side * 0.85, -0.12, -0.5), -0.025);
        const points = [root, root.clone().add(V(side * 0.065, -0.12, -0.03)),
          V(side * 0.49, 1.21, -0.24), V(side * 0.45, 1.04, -0.16)];
        braid(points, 0.077, 4);
      }
      break;
    }
    case 18: {
      kitHair('Mage');
      if (!hasHat) {
        const root = headAt(V(0, 0.48, -0.88), 0.045);
        hairPieces.push({ geo: blob(0.16, root, V(1, 0.85, 0.8), new THREE.Euler(), 3), kit: o.face });
      }
      break;
    }
    case 19:
      importedHair('rogue-fringe');
      kitHair('Mage');
      ponytail(V(0, 0.22, -1), [V(0, -0.09, -0.08), V(0.05, -0.28, -0.1), V(0.12, -0.48, -0.06)], 0.095);
      break;
    case 20:
      kitHair('Rogue');
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const root = headAt(V(side * 0.92, 0.05, -0.12 - k * 0.3), -0.015);
        hairPieces.push({ geo: pushOut(strand([root, root.clone().add(V(side * 0.025, -0.12, 0)),
          root.clone().add(V(side * 0.045, -0.28, 0.03)), root.clone().add(V(-side * 0.025, -0.4, 0.05))], 0.065, 0.025, { taperStart: true }), 0.014), kit: o.face });
      }
      break;
    case 21: {
      kitHair('Mage');
      if (!hasHat) {
        const points: THREE.Vector3[] = [];
        for (let k = 0; k <= 32; k++) {
          const a = k / 32 * PI * 2;
          points.push(headAt(V(Math.sin(a), 0.82, Math.cos(a)), 0.025));
        }
        braid(points, 0.055, 16);
      }
      break;
    }
  }
  return { hairCell, hairPieces };
}
