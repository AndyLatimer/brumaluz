import * as THREE from 'three';
import type { Analysis } from './analysis';
import type { HeadOptions } from './types';
import type { AccessorySurfaces } from './accessorySurfaces';
import { GeometryTemplates } from './geometryCache';
import { HEAD_C, V, smoothNormals } from './geometry';

type EyeSize = { rx: number; ry: number };
export interface EyewearFit { x: number; y: number; rx: number; ry: number; z: number }

export function fitEyewear(A: Analysis, E: EyeSize, eyewear: number, surfaces: AccessorySurfaces, onFace: (x: number, y: number, out?: number) => THREE.Vector3): EyewearFit {
  const x = A.eyeX * .96, y = A.eyeY - .012;
  const rx = Math.min(Math.max(E.rx, E.ry) * 1.4, x - .026);
  const ry = Math.max(rx * (eyewear === 10 ? .78 : eyewear === 11 ? .83 : 1), E.ry * 1.17 + .006);
  let z = Math.max(onFace(x, y, .014).z + .045, onFace(-x, y, .014).z + .045);
  if (!eyewear) return { x, y, rx, ry, z };
  for (const side of eyewear === 5 ? [1] : [-1, 1]) {
    for (let k = 0; k < 8; k++) {
      const angle = k / 8 * Math.PI * 2;
      z = Math.max(z, surfaces.front(side * x + Math.cos(angle) * rx, y + Math.sin(angle) * ry, true) + .018);
    }
  }
  z = Math.max(z, surfaces.front(0, y + .012) + .025);
  return { x, y, rx, ry, z };
}

/** A temple follows the actual horizontal envelope instead of cutting a chord through the head. */
export function eyewearTemple(start: THREE.Vector3, support: THREE.Vector3, side: number, surfaces: AccessorySurfaces) {
  const a0 = Math.atan2(Math.abs(start.x), start.z - HEAD_C.z);
  const a1 = Math.max(a0 + .25, Math.atan2(Math.abs(support.x), support.z - HEAD_C.z));
  const r0 = Math.hypot(start.x, start.z - HEAD_C.z), r1 = Math.hypot(support.x, support.z - HEAD_C.z);
  const points: THREE.Vector3[] = [];
  for (let k = 0; k <= 32; k++) {
    const t = k / 32, angle = THREE.MathUtils.lerp(a0, a1, t) * side, y = THREE.MathUtils.lerp(start.y, support.y, t);
    const surface = surfaces.radius(angle, y);
    const frontLift = (r0 - surfaces.radius(a0 * side, start.y) - .017) * (1 - THREE.MathUtils.smoothstep(t, 0, .25));
    const endLift = (r1 - surfaces.radius(a1 * side, support.y) - .017) * THREE.MathUtils.smoothstep(t, .85, 1);
    const radius = surface + .017 + frontLift + endLift;
    points.push(V(Math.sin(angle) * radius, y, HEAD_C.z + Math.cos(angle) * radius));
  }
  points[0].copy(start); points[points.length - 1].copy(support);
  return points;
}

const maskTemplates = new GeometryTemplates(6 * 1024 * 1024, 48);

/** Preserve the authored folds while fitting the cloth under the nose, lenses and jaw. */
export function fittedTravelerMask(source: THREE.BufferGeometry, o: HeadOptions, A: Analysis, fit: EyewearFit, eyewear: number, surfaces: AccessorySurfaces) {
  const key = JSON.stringify([o.face, o.nose, o.eyeShape, eyewear, o.race, o.hat, !!o.coveredEars]);
  const cached = maskTemplates.get(key); if (cached) return cached[0];
  const geometry = source.clone(); geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!, height = bounds.max.y - bounds.min.y;
  const bottom = 1.245;
  const noseTop = A.noseTip.y - .018;
  const topAt = (x: number) => {
    let top = noseTop;
    if (eyewear) for (const side of eyewear === 5 ? [1] : [-1, 1]) {
      const u = Math.abs((x - side * fit.x) / (fit.rx + .012));
      if (u < 1) {
        const curve = eyewear === 11 ? (1 - u ** 4) ** .25 : Math.sqrt(1 - u * u);
        top = Math.min(top, fit.y - fit.ry * curve - .023);
      }
    }
    return Math.max(bottom + .115, top);
  };
  const p = geometry.attributes.position, memo = new Map<string, THREE.Vector3>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y0 = p.getY(i), z = p.getZ(i), id = `${x},${y0},${z}`;
    let point = memo.get(id);
    if (!point) {
      const t = (y0 - bounds.min.y) / height;
      const angle = Math.atan2(x, z - HEAD_C.z), sourceRadius = Math.hypot(x, z - HEAD_C.z);
      const front = Math.max(0, Math.cos(angle));
      const fold = .012 + .009 * Math.tanh((sourceRadius - .44) * 8);
      // Leave room for the faces between source vertices, not just their sampled corners.
      const clearance = .02 + front * fold;
      let y = THREE.MathUtils.lerp(bottom, noseTop, t), radius = surfaces.radius(angle, y, false) + clearance;
      for (let pass = 0; pass < 2; pass++) {
        y = THREE.MathUtils.lerp(bottom, topAt(Math.sin(angle) * radius), t);
        radius = surfaces.radius(angle, y, false) + clearance;
      }
      point = V(Math.sin(angle) * radius, y, HEAD_C.z + Math.cos(angle) * radius); memo.set(id, point);
    }
    p.setXYZ(i, point.x, point.y, point.z);
  }
  p.needsUpdate = true; geometry.computeVertexNormals(); smoothNormals(geometry, 75); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  maskTemplates.set(key, [geometry]); return geometry;
}
