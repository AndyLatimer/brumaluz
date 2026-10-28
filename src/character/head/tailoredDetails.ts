import * as THREE from 'three';
import { V } from './geometry';
import { torsoRadii, torsoSurface } from '../equipmentFit';

/** Closed cloth with a reverse side and a sewn edge, sampled from a draped surface. */
export function fabricSurface(sample: (u: number, v: number) => THREE.Vector3, rows: number, cols: number, thickness: number, wrapRows = false) {
  const rowCount = wrapRows ? rows : rows + 1, pos: number[] = [], idx: number[] = [], size = rowCount * (cols + 1);
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row < rowCount; row++) for (let col = 0; col <= cols; col++) {
    const u = row / rows, v = col / cols * 2 - 1, p = sample(u, v);
    const du = sample(u + .0001, v).sub(sample(u - .0001, v)), dv = sample(u, v + .0001).sub(sample(u, v - .0001));
    p.addScaledVector(du.cross(dv).normalize(), layer ? -thickness / 2 : thickness / 2); pos.push(p.x, p.y, p.z);
  }
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const a = layer * size + row * (cols + 1) + col, b = a + 1, c = layer * size + ((row + 1) % rowCount) * (cols + 1) + col;
    if (!layer) idx.push(a, c, b, b, c, c + 1); else idx.push(a, b, c, b, c + 1, c);
  }
  const border: number[] = [];
  if (wrapRows) for (let row = 0; row < rows; row++) {
    const a = row * (cols + 1), b = ((row + 1) % rows) * (cols + 1);
    idx.push(b, a, a + size, b, a + size, b + size);
    const c = a + cols, d = b + cols;
    idx.push(c, d, c + size, d, d + size, c + size);
  }
  else {
    for (let col = 0; col <= cols; col++) border.push(col);
    for (let row = 1; row <= rows; row++) border.push(row * (cols + 1) + cols);
    for (let col = cols - 1; col >= 0; col--) border.push(rows * (cols + 1) + col);
    for (let row = rows - 1; row > 0; row--) border.push(row * (cols + 1));
    for (let i = 0; i < border.length; i++) { const a = border[i], b = border[(i + 1) % border.length]; idx.push(a, b, a + size, b, b + size, a + size); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const thread = (points: THREE.Vector3[], radius: number, material: THREE.Material) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, radius, 5, false), material);
const cloth = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .96 });

export function tailoredBow(color: string) {
  const group = new THREE.Group(), material = cloth(color);
  for (const side of [-1, 1]) {
    const loop = (u: number, v: number) => { const a = u * Math.PI * 2; return V(side * (.018 + .068 * (1 - Math.cos(a))), Math.sin(a) * .038 + v * .023 * (.6 + .4 * Math.sin(u * Math.PI)), .018 * Math.sin(u * Math.PI) + .012 * Math.sin(a) + .008 * v * v * Math.sin(u * Math.PI)); };
    group.add(new THREE.Mesh(fabricSurface(loop, 40, 10, .0035), material));
    const tail = (u: number, v: number) => V(side * (.023 + .024 * u) + v * .021 * (1 - .15 * u), -.018 - .14 * u + .024 * (1 - v * v) * THREE.MathUtils.smoothstep(u, .85, 1), .008 + .018 * Math.sin(u * Math.PI) + .004 * Math.cos(v * Math.PI * 2) * u);
    group.add(new THREE.Mesh(fabricSurface(tail, 24, 10, .0035), material));
  }
  const knot = (u: number, v: number) => { const a = u * Math.PI * 2; return V(.024 * Math.cos(a), v * .025, .017 * Math.sin(a) + .004 * Math.cos(v * Math.PI)); };
  group.add(new THREE.Mesh(fabricSurface(knot, 32, 8, .004), material)); return group;
}

export function sculptedFlower(radius: number, color: string, centerColor = '#ffd65a', petals = 5) {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color, roughness: .85 });
  const veinMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#fff9ed'), .22), roughness: .9 });
  for (let i = 0; i < petals; i++) {
    const angle = i / petals * Math.PI * 2;
    const petal = (u: number, v: number) => {
      const length = radius * (.15 + u * 1.65), width = radius * .65 * Math.sin(Math.PI * THREE.MathUtils.clamp(u, .0001, .9999)) ** .7;
      return V(Math.cos(angle) * length - Math.sin(angle) * width * v, Math.sin(angle) * length + Math.cos(angle) * width * v, radius * (.1 + .3 * Math.sin(u * Math.PI) + .12 * v * v - .13 * u));
    };
    group.add(new THREE.Mesh(fabricSurface(petal, 18, 10, radius * .035), material));
    group.add(thread(Array.from({ length: 12 }, (_, k) => petal(.12 + k / 11 * .76, 0).add(V(0, 0, radius * .025))), radius * .013, veinMaterial));
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(radius * .36, 14, 8), new THREE.MeshStandardMaterial({ color: centerColor, roughness: .9 }));
  center.scale.z = .5; center.position.z = radius * .22; group.add(center); return group;
}

export function tailoredScarf(color: string) {
  const group = new THREE.Group(), material = cloth(color);
  const seamMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#fff1d1'), .2), roughness: 1 });
  const collar = (u: number, v: number) => {
    const a = u * Math.PI * 2, y = 1.135 + v * .047 + Math.cos(a) * .006 + .004 * Math.sin(a * 3 + v);
    const { rx, rz } = torsoRadii(y), fold = .022 + .004 * Math.cos(a * 6 + v * 2) + .003 * Math.sin(v * Math.PI);
    return V(Math.sin(a) * (rx + fold), y, Math.cos(a) * (rz + fold));
  };
  group.add(new THREE.Mesh(fabricSurface(collar, 80, 14, .014, true), material));
  const tail = (u: number, v: number) => {
    const x = .12 + .018 * Math.sin(u * Math.PI) + v * (.052 - u * .008), y = 1.12 - u * .28 + .004 * Math.cos(v * Math.PI * 2) * u;
    return V(x, y, torsoSurface(x, y) + .018 + .006 * Math.sin(u * Math.PI) + .003 * Math.cos(v * Math.PI * 3) * Math.sin(u * Math.PI));
  };
  group.add(new THREE.Mesh(fabricSurface(tail, 36, 16, .009), material));
  for (const edge of [-.88, .88]) {
    group.add(thread(Array.from({ length: 25 }, (_, k) => tail(k / 24, edge).add(V(0, 0, .006))), .0018, seamMaterial));
    group.add(thread(Array.from({ length: 49 }, (_, k) => collar(k / 48, edge).add(V(Math.sin(k / 48 * Math.PI * 2) * .008, 0, Math.cos(k / 48 * Math.PI * 2) * .008))), .0018, seamMaterial));
  }
  for (let i = 0; i < 9; i++) { const root = tail(1, (i - 4) / 4.5); group.add(thread([root, root.clone().add(V(.002 * Math.sin(i), -.018, .005)), root.clone().add(V(.003 * Math.sin(i), -.033, .003))], .0023, material)); }
  for (const part of group.children) part.name = 'character-neck-accessory';
  return group.children.slice();
}
