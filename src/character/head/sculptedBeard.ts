import * as THREE from 'three';
import type { HeadOptions } from './types';
import { HEAD_C, V, paintCell, C_HAIR, smoothNormals } from './geometry';
import { GeometryTemplates } from './geometryCache';

type Hit = { point: THREE.Vector3; normal: THREE.Vector3 } | null;
const templates = new GeometryTemplates(8 * 1024 * 1024, 48);
const smooth = THREE.MathUtils.smoothstep;

/** Closed facial hair: roots enter the skin, while the outer surface carries the combed relief. */
export function sculptedBeard(o: HeadOptions, mouthY: number, headR: (d: THREE.Vector3) => number, rayHead: (p: THREE.Vector3, d: THREE.Vector3) => Hit) {
  const key = `${o.face}/${o.beard}/${mouthY}`;
  const cached = templates.get(key);
  if (cached) return cached;
  const pieces: THREE.BufferGeometry[] = [];
  const patch = (sample: (u: number, v: number, inner: boolean) => THREE.Vector3, cols: number, rows: number) => {
    const positions: number[] = [], indices: number[] = [], size = (cols + 1) * (rows + 1);
    for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
      const p = sample(col / cols, row / rows, !!layer); positions.push(p.x, p.y, p.z);
    }
    for (let layer = 0; layer < 2; layer++) for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const a = layer * size + row * (cols + 1) + col, b = a + 1, c = a + cols + 1;
      if (!layer) indices.push(a, b, c, b, c + 1, c); else indices.push(a, c, b, b, c, c + 1);
    }
    const border: number[] = [];
    for (let col = 0; col <= cols; col++) border.push(col);
    for (let row = 1; row <= rows; row++) border.push(row * (cols + 1) + cols);
    for (let col = cols - 1; col >= 0; col--) border.push(rows * (cols + 1) + col);
    for (let row = rows - 1; row > 0; row--) border.push(row * (cols + 1));
    for (let i = 0; i < border.length; i++) { const a = border[i], b = border[(i + 1) % border.length]; indices.push(a, a + size, b, b, a + size, b + size); }
    // Both halves of the moustache use the same sampler; orient the closed solid outwards.
    let volume = 0;
    const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0);
    for (let i = 0; i < indices.length; i += 3) {
      a.fromArray(positions, indices[i] * 3).sub(HEAD_C); b.fromArray(positions, indices[i + 1] * 3).sub(HEAD_C); c.fromArray(positions, indices[i + 2] * 3).sub(HEAD_C);
      volume += a.dot(b.cross(c));
    }
    if (volume < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices);
    geo.computeVertexNormals(); geo.userData.surfaceReady = true;
    pieces.push(paintCell(smoothNormals(geo, 75), C_HAIR, .2, .8));
  };
  const at = (lon: number, lat: number, out = 0) => {
    const d = V(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
    return HEAD_C.clone().addScaledVector(d, headR(d) + out);
  };
  const latitude = (lon: number, y: number) => {
    let low = -1.56, high = .4;
    for (let i = 0; i < 20; i++) { const mid = (low + high) / 2; if (at(lon, mid).y < y) low = mid; else high = mid; }
    return (low + high) / 2;
  };
  const collar = (full: boolean, goatee = false) => {
    const extent = goatee ? .22 : full ? 1.57 : 1.26;
    patch((u, v, inner) => {
      const lon = (u * 2 - 1) * extent, side = Math.abs(u * 2 - 1);
      const top = mouthY - (goatee ? .095 : full ? .065 : .088) + (goatee ? .015 : full ? .29 : .18) * side ** 1.7;
      const upper = latitude(lon, top), lower = -1.47 + (goatee ? .04 : .56) * side ** 2;
      const lat = THREE.MathUtils.lerp(upper, lower, v);
      const edge = Math.sin(Math.PI * v) ** .5 * Math.sin(Math.PI * u) ** .35;
      const grooves = .004 * Math.cos(lon * (goatee ? 66 : 48) + lat * 6) + .0015 * Math.cos(lon * 105 - lat * 13);
      const lift = inner ? -.001 : .002 + edge * ((full ? .052 : goatee ? .031 : .023) + grooves);
      const p = at(lon, lat, lift);
      if (!inner && full) p.y -= .042 * smooth(v, .35, 1) * (1 - side ** 2) * Math.sin(Math.PI * u) ** .5;
      return p;
    }, goatee ? 40 : 96, 32);
  };
  const moustache = (artisan = false) => {
    for (const side of [-1, 1]) patch((u, v, inner) => {
      const x = side * (.005 + u * (artisan ? .214 : .17));
      const center = mouthY + .038 - .027 * Math.sin(u * Math.PI * .85) + (artisan ? .064 * smooth(u, .55, 1) : -.009 * u);
      const width = .003 + (artisan ? .026 : .024) * Math.sin(Math.PI * u) ** .6;
      const y = center + (v * 2 - 1) * width;
      const hit = rayHead(V(x, y, 2), V(0, 0, -1))!;
      const roll = Math.sin(Math.PI * v) * Math.sin(Math.PI * u) ** .4;
      const relief = .024 + .003 * Math.cos(u * 36 + v * 5);
      return hit.point.addScaledVector(hit.normal, inner ? -.001 : .002 + roll * relief);
    }, 48, 12);
  };
  if (o.beard === 1 || o.beard === 2) { collar(o.beard === 2); moustache(); }
  if (o.beard === 3 || o.beard === 5) { collar(false, true); if (o.beard === 3) moustache(); }
  if (o.beard === 4 || o.beard === 8) moustache(o.beard === 8);
  if (o.beard === 6) for (const side of [-1, 1]) patch((u, v, inner) => {
    const width = .115 * (1 - .6 * smooth(v, .55, 1));
    const lon = side * (1.34 + (u * 2 - 1) * width), upper = latitude(lon, mouthY + .28), lower = latitude(lon, mouthY - .055);
    const lat = THREE.MathUtils.lerp(upper, lower, v), edge = Math.sin(Math.PI * u) ** .5 * Math.sin(Math.PI * v) ** .4;
    return at(lon, lat, inner ? -.001 : .002 + edge * (.019 + .003 * Math.cos(u * 23 + v * 7)));
  }, 16, 32);
  templates.set(key, pieces);
  return pieces;
}
