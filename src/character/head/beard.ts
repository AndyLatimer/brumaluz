// Barbas y bigotes, ajustados a la cara.
import * as THREE from 'three';
import type { HeadOptions } from './types';
import { V, piece, compose, mergeGeoms } from './geometry';
import { hasTravelerMask } from './accessoryLayers';
import { sculptedBeard } from './sculptedBeard';

/** Barba de la cabeza (parte de buildHead). */
export function buildBeard({ o, mouthY, rayHead, headR, hairCell }: { o: HeadOptions; mouthY: number; rayHead: (o: THREE.Vector3, d: THREE.Vector3) => { point: THREE.Vector3; normal: THREE.Vector3; } | null; headR: (d: THREE.Vector3) => number; hairCell: number }) {
  const beardGeos: THREE.BufferGeometry[] = [];
  if (o.beard > 0 && !hasTravelerMask(o.acc ?? 0)) {
    if (o.beard !== 7) beardGeos.push(...sculptedBeard(o, mouthY, headR, rayHead));
    else {
      const dots: THREE.BufferGeometry[] = [];
      // Staggered, deterministic growth: no repeated dot grid or solid painted jaw.
      for (let row = 0; row < 19; row++) for (let col = 0; col < 33; col++) {
        const seed = Math.sin(row * 127.1 + col * 311.7) * 43758.5453;
        const noise = seed - Math.floor(seed);
        const x = (col - 16) * .019 + (row % 2) * .009 + (noise - .5) * .01;
        const y = mouthY + .047 - row * .017 + Math.sin(col * 3.7 + row) * .004;
        const top = mouthY - .044 + .07 * (Math.abs(x) / .32) ** 1.6;
        const underNose = Math.abs(x) < .17 && Math.abs(y - (mouthY + .035 - x * x)) < .02;
        if ((!underNose && y > top) || Math.abs(x) > .31 || noise < .16) continue;
        const hit = rayHead(V(x, y, 2), V(0, 0, -1));
        if (!hit) continue;
        const rot = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), hit.normal));
        dots.push(piece(new THREE.CircleGeometry(.0019 + noise * .001, 5), hairCell,
          compose(hit.point.addScaledVector(hit.normal, .003), rot, V(.65, 1.25, 1)), .45, .7));
      }
      const geometry = mergeGeoms(dots);
      if (geometry) beardGeos.push(geometry);
      dots.forEach(dot => dot.dispose());
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
