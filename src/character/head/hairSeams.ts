import * as THREE from 'three';

/** Bridge the rear notch left when the Mage model's original bun is detached. */
export function repairHairNape(geometry: THREE.BufferGeometry) {
  const p = geometry.attributes.position;
  const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(n => Math.round(n * 1e5)).join(',');
  const edges = new Map<string, { a: number; b: number; count: number }>();
  let rimY = Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(p.getX(i));
    if (x > .17 && x < .3 && p.getZ(i) < -.25 && p.getY(i) < 1.5) rimY = Math.min(rimY, p.getY(i));
  }
  if (!Number.isFinite(rimY)) return geometry;
  for (let i = 0; i < p.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = i + j, b = i + (j + 1) % 3, ka = key(a), kb = key(b); if (ka === kb) continue;
    const id = ka < kb ? ka + '/' + kb : kb + '/' + ka, edge = edges.get(id);
    if (edge) edge.count++; else edges.set(id, { a, b, count: 1 });
  }
  const bridge: number[] = [];
  const bottom = (v: THREE.Vector3) => {
    const y = Math.min(v.y, rimY + .02 * (1 - THREE.MathUtils.smoothstep(Math.abs(v.x), 0, .22)));
    return new THREE.Vector3(v.x, y, v.z + (v.y - y) * .5);
  };
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    const a = new THREE.Vector3().fromBufferAttribute(p, edge.a), b = new THREE.Vector3().fromBufferAttribute(p, edge.b);
    if (Math.max(Math.abs(a.x), Math.abs(b.x)) > .23 || Math.max(a.z, b.z) > -.3
      || Math.max(a.y, b.y) > 1.6 || Math.max(a.y, b.y) < rimY + .04) continue;
    const c = bottom(a), d = bottom(b);
    for (const tri of [[b, a, c], [b, c, d]]) {
      const area = tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).lengthSq();
      if (area > 1e-16) for (const v of tri) bridge.push(v.x, v.y, v.z);
    }
  }
  if (bridge.length) {
    const positions = new Float32Array(p.array.length + bridge.length); positions.set(p.array); positions.set(bridge, p.array.length);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.deleteAttribute('normal'); geometry.computeVertexNormals();
  }
  return geometry;
}
