import type { Vector3 } from 'three';

export interface SightObstacle {
  x: number; z: number; r: number;
  hx?: number; hz?: number; cos?: number; sin?: number;
  bottomY?: number; topY?: number;
}

/** Static collision volumes, indexed once. Never raycast the city's render meshes. */
export function createLineOfSight(obstacles: readonly SightObstacle[], groundY: (x: number, z: number) => number) {
  const size = 8;
  const cells = new Map<string, SightObstacle[]>();
  for (const obstacle of obstacles) {
    const radius = obstacle.hx === undefined ? obstacle.r : Math.hypot(obstacle.hx, obstacle.hz ?? obstacle.hx);
    for (let x = Math.floor((obstacle.x - radius) / size); x <= Math.floor((obstacle.x + radius) / size); x++) {
      for (let z = Math.floor((obstacle.z - radius) / size); z <= Math.floor((obstacle.z + radius) / size); z++) {
        const key = `${x},${z}`;
        const bucket = cells.get(key) ?? [];
        if (!cells.has(key)) cells.set(key, bucket);
        bucket.push(obstacle);
      }
    }
  }
  return (from: Vector3, to: Vector3) => {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 2));
    const visited = new Set<SightObstacle>();
    let previousCell = '';
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, x = from.x + dx * t, z = from.z + dz * t;
      if (step > 0 && step < steps && from.y + dy * t < groundY(x, z) + .03) return false;
      const key = `${Math.floor(x / size)},${Math.floor(z / size)}`;
      if (key === previousCell) continue;
      previousCell = key;
      // Adjacent cells also cover diagonal crossings between samples.
      const gx = Math.floor(x / size), gz = Math.floor(z / size);
      for (let cx = gx - 1; cx <= gx + 1; cx++) for (let cz = gz - 1; cz <= gz + 1; cz++) {
        for (const obstacle of cells.get(`${cx},${cz}`) ?? []) {
          if (visited.has(obstacle)) continue;
          visited.add(obstacle);
          let enter = .002, exit = .998;
          const clip = (origin: number, delta: number, min: number, max: number) => {
            if (Math.abs(delta) < 1e-9) return origin >= min && origin <= max;
            let a = (min - origin) / delta, b = (max - origin) / delta;
            if (a > b) [a, b] = [b, a];
            enter = Math.max(enter, a); exit = Math.min(exit, b);
            return enter <= exit;
          };
          const bottom = obstacle.bottomY ?? groundY(obstacle.x, obstacle.z);
          const top = obstacle.topY ?? bottom + 3;
          if (!clip(from.y, dy, bottom, top)) continue;
          const ox = from.x - obstacle.x, oz = from.z - obstacle.z;
          if (obstacle.hx !== undefined) {
            const cos = obstacle.cos ?? 1, sin = obstacle.sin ?? 0;
            if (clip(ox * cos - oz * sin, dx * cos - dz * sin, -obstacle.hx, obstacle.hx)
              && clip(ox * sin + oz * cos, dx * sin + dz * cos, -(obstacle.hz ?? obstacle.hx), obstacle.hz ?? obstacle.hx)) return false;
          } else {
            const a = dx * dx + dz * dz, b = ox * dx + oz * dz;
            const c = ox * ox + oz * oz - obstacle.r * obstacle.r;
            if (a < 1e-9) { if (c <= 0) return false; continue; }
            const discriminant = b * b - a * c;
            if (discriminant < 0) continue;
            const root = Math.sqrt(discriminant);
            if (Math.max(enter, (-b - root) / a) <= Math.min(exit, (-b + root) / a)) return false;
          }
        }
      }
    }
    return true;
  };
}
