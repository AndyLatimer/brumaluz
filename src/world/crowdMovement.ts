import * as THREE from 'three';
import type { City } from './city';

export interface CrowdBody {
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  radius: number;
  priority: number;
  /** Last steering direction survives a brief stop, so two walkers do not change sides every frame. */
  heading?: THREE.Vector3;
}
type WalkableCity = Pick<City, 'collide' | 'groundY' | 'waterAt'>;
const separation = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

/** Choose a short collision-checked step, looking ahead and passing on the right. Never pushes another actor. */
export function crowdStep(city: WalkableCity, self: CrowdBody, goal: THREE.Vector3, speed: number, dt: number,
  neighbours: readonly CrowdBody[], blockedFor = 0): THREE.Vector3 {
  const from = self.position, distance = separation(from, goal);
  if (distance < .001 || dt <= 0) return from.clone();
  const forward = goal.clone().sub(from).setY(0).normalize();
  const nearby = neighbours.filter(other => Math.abs(other.position.y - from.y) < 1.6 && separation(other.position, from) < 3.5);
  const previous = self.heading ?? self.velocity;
  if (!nearby.length) {
    const next = from.clone().addScaledVector(forward, Math.min(speed * dt, distance));
    next.y = city.groundY(next.x, next.z);
    if (!city.waterAt?.(next.x, next.z)) {
      const corrected = city.collide(from, next.clone());
      if (separation(next, corrected) <= .002) {
        (self.heading ??= forward.clone()).copy(forward);
        return corrected;
      }
    }
  }
  const angles = [0, .35, -.35, .7, -.7, 1.05, -1.05, 1.4, -1.4];
  // When a narrow path prevents passing, the lower-priority walker can back away to a wider place.
  if (blockedFor > .8 && nearby.some(other => other.priority < self.priority)) angles.push(1.9, -1.9, Math.PI);
  let best = from.clone(), bestScore = Infinity;
  for (const angle of angles) {
    const direction = forward.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    const next = from.clone().addScaledVector(direction, Math.min(speed * dt, distance));
    next.y = city.groundY(next.x, next.z);
    if (city.waterAt?.(next.x, next.z)) continue;
    const corrected = city.collide(from, next.clone());
    if (separation(next, corrected) > .002) continue;
    let score = (1 - direction.dot(forward)) * .8 + (angle < 0 ? .25 : 0);
    if (previous && previous.lengthSq() > .01) score += (1 - direction.dot(previous.clone().normalize())) * .65;
    let legal = true;
    for (const other of nearby) {
      const minimum = self.radius + other.radius + .08;
      const current = separation(from, other.position), after = separation(next, other.position);
      if (after < minimum && after < current + 1e-5) { legal = false; break; }
      // Check the swept step, so long frames cannot skip through a neighbour.
      const sx = next.x - from.x, sz = next.z - from.z;
      const qx = other.position.x - from.x, qz = other.position.z - from.z;
      const fraction = THREE.MathUtils.clamp((qx * sx + qz * sz) / Math.max(1e-9, sx * sx + sz * sz), 0, 1);
      if (current >= minimum && Math.hypot(qx - sx * fraction, qz - sz * fraction) < minimum) { legal = false; break; }
      const horizon = other.priority < self.priority ? 1.4 : 1.1;
      const vx = direction.x * speed - (other.velocity?.x ?? 0), vz = direction.z * speed - (other.velocity?.z ?? 0);
      const time = THREE.MathUtils.clamp(((other.position.x - next.x) * vx + (other.position.z - next.z) * vz) / Math.max(1e-9, vx * vx + vz * vz), 0, horizon);
      const closest = Math.hypot(other.position.x - next.x - vx * time, other.position.z - next.z - vz * time);
      score += Math.max(0, minimum + .3 - closest) * 5;
      // An existing overlap can only be resolved by increasing separation.
      if (current < minimum) score -= (after - current) * 20;
    }
    if (legal && score < bestScore) { best = corrected; bestScore = score; }
  }
  if (separation(best, from) > .001) (self.heading ??= new THREE.Vector3()).copy(best).sub(from).setY(0).normalize();
  return best;
}
