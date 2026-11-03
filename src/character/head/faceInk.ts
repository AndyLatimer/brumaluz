import * as THREE from 'three';
import { V, mergeGeoms } from './geometry';

type Hit = { point: THREE.Vector3; normal: THREE.Vector3 } | null;
/** Fine ink lives on the skin, including the interior of every triangle on a curved cheek. */
export function faceInk(rayHead: (p: THREE.Vector3, d: THREE.Vector3) => Hit) {
  const batches = new Map<string, THREE.BufferGeometry[]>();
  const project = (geometry: THREE.BufferGeometry, color: string, lift = .003) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = flat.attributes.position, positions: number[] = [];
    const emit = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, depth = 0) => {
      if (depth < 5 && Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)) > .012) {
        const ab = a.clone().lerp(b, .5), bc = b.clone().lerp(c, .5), ca = c.clone().lerp(a, .5);
        emit(a, ab, ca, depth + 1); emit(ab, b, bc, depth + 1); emit(ca, bc, c, depth + 1); emit(ab, bc, ca, depth + 1); return;
      }
      for (const point of [a, b, c]) {
        const hit = rayHead(V(point.x, point.y, 2), V(0, 0, -1));
        if (!hit) throw new Error('Facial ink extends beyond the skin');
        const fitted = hit.point.addScaledVector(hit.normal, lift); positions.push(fitted.x, fitted.y, fitted.z);
      }
    };
    for (let i = 0; i < p.count; i += 3) emit(V(0, 0, 0).fromBufferAttribute(p, i), V(0, 0, 0).fromBufferAttribute(p, i + 1), V(0, 0, 0).fromBufferAttribute(p, i + 2));
    if (flat !== geometry) flat.dispose(); geometry.dispose();
    const fitted = new THREE.BufferGeometry(); fitted.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); fitted.computeVertexNormals();
    // mergeGeoms also serves palette geometry; ink only uses a solid material.
    fitted.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
    const list = batches.get(color) ?? []; list.push(fitted); batches.set(color, list);
  };
  const dot = (x: number, y: number, radius: number, color: string, aspect = 1) => project(new THREE.CircleGeometry(radius, 12).scale(1, aspect, 1).translate(x, y, 0), color);
  const stroke = (points: [number, number][], width: number, color: string, lift = .003) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => V(x, y, 0))), positions: number[] = [], indices: number[] = [], steps = Math.max(16, points.length * 8);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, p = curve.getPoint(t), tangent = curve.getTangent(t), radius = width * (.18 + .82 * Math.sin(Math.PI * t) ** .35);
      for (const side of [-1, 1]) positions.push(p.x - tangent.y * radius * side, p.y + tangent.x * radius * side, 0);
      if (i) { const a = (i - 1) * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); project(geo, color, lift);
  };
  const leaf = (x: number, y: number, angle: number, color: string) => {
    const shape = new THREE.Shape(); shape.moveTo(0, -.052); shape.bezierCurveTo(-.035, -.018, -.028, .02, 0, .058); shape.bezierCurveTo(.028, .02, .035, -.018, 0, -.052);
    project(new THREE.ShapeGeometry(shape, 12).rotateZ(angle).translate(x, y, 0), color);
    const at = (a: number, b: number): [number, number] => [x + a * Math.cos(angle) - b * Math.sin(angle), y + a * Math.sin(angle) + b * Math.cos(angle)];
    stroke([at(0, -.044), at(.001, 0), at(0, .045)], .0018, '#c5c495', .004);
    for (const side of [-1, 1]) for (const k of [-1, 1]) stroke([at(0, k * .013), at(side * .012, k * .013 + .014)], .001, '#b1ba88', .004);
  };
  const finish = (material: (color: string) => THREE.Material) => [...batches].map(([color, pieces]) => {
    const geometry = mergeGeoms(pieces)!; pieces.forEach(piece => piece.dispose());
    const mesh = new THREE.Mesh(geometry, material(color)); mesh.name = 'character-face-mark'; return mesh;
  });
  return { dot, stroke, leaf, finish };
}
