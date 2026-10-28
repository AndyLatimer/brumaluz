import * as THREE from 'three';
import { fabricSurface } from './tailoredDetails';
import { V } from './geometry';

/** A crescent with actual inner and outer contours, pointed horns and bevelled edges. */
export function crescentGeometry(radius: number, depth: number) {
  const offset = radius * .43, inner = radius * .84;
  const x = (radius * radius - inner * inner + offset * offset) / (2 * offset);
  const outerAngle = Math.acos(x / radius), innerAngle = Math.acos((x - offset) / inner);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, outerAngle, Math.PI * 2 - outerAngle, false);
  shape.absarc(offset, 0, inner, -innerAngle, innerAngle, true); shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, curveSegments: 28, bevelEnabled: true,
    bevelThickness: depth * .2, bevelSize: radius * .025, bevelSegments: 2 }).translate(0, 0, -depth / 2);
}

export function leafSprig(color: string) {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color, roughness: .58, metalness: .18 });
  const detail = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#fff1bf'), .32), roughness: .5, metalness: .25 });
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Group(), angle = i % 2 ? -.55 : .5;
    const surface = (u: number, v: number) => V(v * .023 * Math.sin(Math.PI * THREE.MathUtils.clamp(u, .0001, .9999)) ** .85,
      u * .095, .005 + .012 * Math.sin(Math.PI * u) * (1 - v * v) + .004 * v * v);
    leaf.add(new THREE.Mesh(fabricSurface(surface, 24, 12, .003), material));
    const vein = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 14 }, (_, k) => surface(.06 + k / 13 * .85, 0).add(V(0, 0, .0018)))), 24, .0013, 5), detail);
    leaf.add(vein); leaf.position.set((i - 1) * .032, (i - 1) * .027 - .035, 0); leaf.rotation.z = angle; group.add(leaf);
  }
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-.04, -.062, 0), V(0, -.02, .002), V(.04, .03, .001)]), 24, .0028, 6), detail);
  group.add(stem); return group;
}
