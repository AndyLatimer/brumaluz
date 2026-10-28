import * as THREE from 'three';
import { mergeGeoms, V } from './geometry';
import { torsoRadii, torsoSurface } from '../equipmentFit';

/** A closed necklace resting on the torso profile, with its pendant joined to the front link. */
export function neckJewelry(color: string, medallion = false) {
  const group = new THREE.Group(), points: THREE.Vector3[] = [];
  for (let i = 0; i < 128; i++) {
    const angle = i / 128 * Math.PI * 2, front = Math.max(0, Math.cos(angle));
    const y = 1.16 - front * .13, { rx, rz } = torsoRadii(y), clearance = .012 + (medallion ? 0 : .012 * front ** 4);
    points.push(V(Math.sin(angle) * (rx + .012), y, Math.cos(angle) * (rz + clearance)));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal'), links: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 112; i++) {
    const t = i / 112, position = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const rotation = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tangent)
      .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), i % 2 ? Math.PI / 2 : 0));
    links.push(new THREE.TorusGeometry(.008, .0018, 5, 12).scale(.8, 1.25, 1).applyMatrix4(new THREE.Matrix4().compose(position, rotation, V(1, 1, 1))));
  }
  const metal = new THREE.MeshStandardMaterial({ color: '#c6a269', roughness: .35, metalness: .65 });
  group.add(new THREE.Mesh(mergeGeoms(links)!, metal)); links.forEach(link => link.dispose());
  const shape = new THREE.Shape(); shape.absarc(0, 0, .037, 0, Math.PI * 2, false);
  const geometry = medallion ? new THREE.ExtrudeGeometry(shape, { depth: .009, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 3, curveSegments: 24 }).translate(0, 0, -.0045) : new THREE.OctahedronGeometry(.04, 0);
  const gem = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: medallion ? .4 : .15, metalness: medallion ? .4 : .2, emissive: medallion ? '#000000' : color, emissiveIntensity: .25 }));
  gem.scale.set(.9, 1.25, .6);
  gem.position.set(0, 1.03 - .043, torsoSurface(0, 1.03 - .043) + (medallion ? .013 : .028));
  group.add(gem);
  const bail = new THREE.Mesh(new THREE.TorusGeometry(.009, .0025, 6, 16), metal);
  bail.position.copy(gem.position).add(V(0, .046, medallion ? .001 : -.003)); group.add(bail);
  if (medallion) {
    const engraving = new THREE.Mesh(new THREE.TorusGeometry(.023, .003, 5, 24), new THREE.MeshStandardMaterial({ color: '#fff0c4', roughness: .5 }));
    engraving.position.copy(gem.position).add(V(0, 0, .01)); group.add(engraving);
  }
  for (const mesh of group.children) mesh.name = 'character-neck-accessory';
  return group.children.slice();
}
