import type { PopulationPoint } from '../data/cityPopulation';

export interface PopulationPatrol {
  points: readonly PopulationPoint[];
  loop: boolean;
}

/** Prepare once per district: straight streets are walked end to end, genuine circuits keep their authored order. */
export function populationPatrol(route: readonly PopulationPoint[]): PopulationPatrol {
  if (route.length < 2) return { points: route, loop: false };
  let first = 0, last = 1, longestSquared = 0;
  for (let a = 0; a < route.length; a++) for (let b = a + 1; b < route.length; b++) {
    const squared = (route[b][0] - route[a][0]) ** 2 + (route[b][1] - route[a][1]) ** 2;
    if (squared > longestSquared) { first = a; last = b; longestSquared = squared; }
  }
  if (longestSquared === 0) return { points: route, loop: false };
  const origin = route[first], dx = route[last][0] - origin[0], dz = route[last][1] - origin[1];
  const length = Math.sqrt(longestSquared);
  if (route.some(point => Math.abs((point[0] - origin[0]) * dz - (point[1] - origin[1]) * dx) / length > .2))
    return { points: route, loop: true };
  const points = route.map((point, index) => ({ point, index, projection: (point[0] - origin[0]) * dx + (point[1] - origin[1]) * dz }))
    .sort((a, b) => a.projection - b.projection || a.index - b.index).map(entry => entry.point);
  return { points, loop: false };
}

/** Empty patrols have no stop; callers receive -1 rather than an invalid distance or modulo result. */
export function closestPatrolStop(patrol: PopulationPatrol, x: number, z: number): number {
  let closest = -1, distance = Infinity;
  for (let index = 0; index < patrol.points.length; index++) {
    const point = patrol.points[index], squared = (point[0] - x) ** 2 + (point[1] - z) ** 2;
    if (closest === -1 || squared < distance) { closest = index; distance = squared; }
  }
  return closest;
}

export function nextPatrolStop(patrol: PopulationPatrol, index: number, direction: 1 | -1): { index: number; direction: 1 | -1 } {
  const count = patrol.points.length;
  if (count < 2) return { index: count ? 0 : -1, direction };
  const current = Math.max(0, Math.min(count - 1, Number.isFinite(index) ? Math.trunc(index) : 0));
  if (patrol.loop) return { index: (current + direction + count) % count, direction };
  const step = current + direction < 0 || current + direction >= count ? direction === 1 ? -1 : 1 : direction;
  return { index: current + step, direction: step };
}
