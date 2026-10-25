import type * as THREE from 'three';
import type { HeadOptions } from './types';
import { V } from './geometry';

/** Misma base que las orejas de linaje; la joya nace del lóbulo. */
export function earringAnchor(o: HeadOptions, side: number, topAt: (x: number, z: number) => THREE.Vector3,
  onHair: (dir: THREE.Vector3, out?: number) => THREE.Vector3) {
  if (o.race === 'pelso') return topAt(side * 0.27, -0.04).add(V(side * 0.105, -0.025, 0.085));
  return onHair(V(side, -0.2, -0.05), 0.008).add(V(side * (o.race === 'elfo' ? 0.035 : 0.008), -0.035, 0.045));
}
