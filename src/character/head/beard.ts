// Barbas y bigotes, ajustados a la cara.
import * as THREE from 'three';
import type { HeadOptions } from './types';
import { V, HEAD_C, paintCell } from './geometry';

/** Barba de la cabeza (parte de buildHead). */
export function buildBeard({ o, mouthY, rayHead, headR, hairCell }: { o: HeadOptions; mouthY: number; rayHead: (o: THREE.Vector3, d: THREE.Vector3) => { point: THREE.Vector3; normal: THREE.Vector3; } | null; headR: (d: THREE.Vector3) => number; hairCell: number }) {
  const beardGeos: THREE.BufferGeometry[] = [];
  if (o.beard > 0 && o.acc !== 7) {
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
  return { conform, beardGeos };
}
