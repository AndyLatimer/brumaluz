import * as THREE from 'three';
import type { City } from './city';
import type { CrowdBody } from './crowdMovement';
import { storyPathSteps } from './storyPath';

type WalkableCity = Pick<City, 'collide' | 'groundY' | 'waterAt'>;
const distance = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

/** Give pedestrian paths breathing room around scenery, without changing player/story collisions. */
export class PopulationNavigation {
  private clearance = new Map<string, boolean>();
  constructor(private city: WalkableCity) {}

  walkable(point: THREE.Vector3) {
    const key = `${point.x.toFixed(3)}:${point.z.toFixed(3)}`;
    const cached = this.clearance.get(key);
    if (cached !== undefined) return cached;
    const free = !this.city.waterAt?.(point.x, point.z) && [[0, 0], [.12, 0], [-.12, 0], [0, .12], [0, -.12]].every(([dx, dz]) => {
      const p = new THREE.Vector3(point.x + dx, this.city.groundY(point.x + dx, point.z + dz), point.z + dz);
      return distance(p, this.city.collide(p, p.clone())) < .002;
    });
    if (this.clearance.size >= 8192) this.clearance.clear();
    this.clearance.set(key, free);
    return free;
  }

  path(start: THREE.Vector3, goal: THREE.Vector3, blockers: readonly CrowdBody[] = []) {
    const steps = this.pathSteps(start, goal, blockers);
    let result = steps.next();
    while (!result.done) result = steps.next();
    return result.value;
  }

  *pathSteps(start: THREE.Vector3, goal: THREE.Vector3, blockers: readonly CrowdBody[] = []): Generator<void, THREE.Vector3[], void> {
    if (!this.walkable(goal)) return [];
    if (blockers.some(body => Math.abs(body.position.y - goal.y) < 1.6 && distance(goal, body.position) < body.radius + .62
      && distance(goal, body.position) < distance(start, body.position))) return [];
    return yield* storyPathSteps({ groundY: this.city.groundY, collide: (from, to) => {
      if (!this.walkable(to) || distance(to, this.city.collide(from, to.clone())) > .002) return from.clone();
      for (const body of blockers) {
        if (Math.abs(body.position.y - to.y) >= 1.6) continue;
        const minimum = body.radius + .62;
        if (distance(to, body.position) < minimum && distance(to, body.position) < distance(from, body.position) + 1e-5) return from.clone();
      }
      return to;
    } }, start, goal, { maxVisits: 900 });
  }

  dispose() { this.clearance.clear(); }
}
