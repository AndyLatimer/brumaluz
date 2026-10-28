import * as THREE from 'three';
import type { HeadOptions } from './types';
import { HEAD_C, V } from './geometry';

const fronts = new Map<string, number>(), radii = new Map<string, number>();
const remember = (cache: Map<string, number>, key: string, value: number) => {
  cache.set(key, value);
  if (cache.size > 4096) cache.delete(cache.keys().next().value!);
  return value;
};

/** Read-only bind-space probes shared by face accessories; colours never invalidate their shape. */
export function accessorySurfaces(o: HeadOptions, hair: THREE.Object3D, head: THREE.Mesh, skin: THREE.BufferGeometry[], frontZ: (x: number, y: number) => number) {
  const ray = new THREE.Raycaster();
  const features = skin.map(geometry => new THREE.Mesh(geometry, head.material));
  const baseKey = `${o.face}/${o.race}/${o.nose}/${o.hat}/${!!o.coveredEars}`;
  const keyFor = (includeHair: boolean) => includeHair ? `${baseKey}/${o.hair}` : baseKey;
  const front = (x: number, y: number, includeHair = false) => {
    const key = `${keyFor(includeHair)}/${Math.round(x * 1e5)},${Math.round(y * 1e5)}`;
    const cached = fronts.get(key); if (cached !== undefined) return cached;
    ray.set(V(x, y, 2), V(0, 0, -1));
    const hit = ray.intersectObjects(includeHair ? [...features, hair] : features, true)[0];
    return remember(fronts, key, Math.max(frontZ(x, y), hit?.point.z ?? -Infinity));
  };
  const radius = (angle: number, y: number, includeHair = true) => {
    const key = `${keyFor(includeHair)}/${Math.round(angle * 1e5)},${Math.round(y * 1e5)}`;
    const cached = radii.get(key); if (cached !== undefined) return cached;
    const direction = V(Math.sin(angle), 0, Math.cos(angle)), center = V(HEAD_C.x, y, HEAD_C.z);
    ray.set(center.clone().addScaledVector(direction, 2), direction.clone().negate());
    const hit = ray.intersectObjects(includeHair ? [head, ...features, hair] : [head, ...features], true)[0];
    return remember(radii, key, hit ? Math.hypot(hit.point.x - center.x, hit.point.z - center.z) : 0);
  };
  return { front, radius };
}
export type AccessorySurfaces = ReturnType<typeof accessorySurfaces>;
