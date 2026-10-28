import * as THREE from 'three';
import type { HeadKit } from './types';
import { C_HAIR, V, paintCell } from './geometry';
import { GeometryTemplates } from './geometryCache';

const templates = new GeometryTemplates(2 * 1024 * 1024, 8);

/** Thin closed backing for the authored cuts, underneath their original locks. */
export function hairLining(face: HeadKit, headAt: (direction: THREE.Vector3, out?: number) => THREE.Vector3) {
  const cached = templates.get(face); if (cached) return cached[0];
  const segments = 96, rows = 36, positions: number[] = [], indices: number[] = [];
  for (let layer = 0; layer < 2; layer++) {
    const pole = headAt(V(0, 1, 0), layer ? -.004 : .003); positions.push(pole.x, pole.y, pole.z);
    for (let row = 1; row <= rows; row++) for (let col = 0; col < segments; col++) {
      const phi = col / segments * Math.PI * 2;
      const boundary = 1.72 - .75 * Math.max(0, Math.cos(phi)) + .78 * Math.max(0, -Math.cos(phi));
      const theta = row / rows * boundary, direction = V(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
      const p = headAt(direction, layer ? -.004 : .003); positions.push(p.x, p.y, p.z);
    }
  }
  const size = 1 + rows * segments;
  for (let layer = 0; layer < 2; layer++) {
    const start = layer * size;
    const tri = (a: number, b: number, c: number) => layer ? indices.push(a, c, b) : indices.push(a, b, c);
    for (let col = 0; col < segments; col++) tri(start, start + 1 + col, start + 1 + (col + 1) % segments);
    for (let row = 0; row < rows - 1; row++) for (let col = 0; col < segments; col++) {
      const a = start + 1 + row * segments + col, b = start + 1 + row * segments + (col + 1) % segments;
      tri(a, a + segments, b); tri(b, a + segments, b + segments);
    }
  }
  const last = 1 + (rows - 1) * segments;
  for (let col = 0; col < segments; col++) {
    const a = last + col, b = last + (col + 1) % segments;
    indices.push(a, a + size, b, b, a + size, b + size);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  geometry.computeVertexNormals(); paintCell(geometry, C_HAIR, .17, .8); geometry.userData.surfaceReady = true;
  templates.set(face, [geometry]); return geometry;
}
