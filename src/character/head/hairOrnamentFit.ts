import * as THREE from 'three';
import type { HeadAnatomy, LineageAttachment } from './anatomy';
import { V } from './geometry';

type HairContact = (direction: THREE.Vector3, lift: number) => { point: THREE.Vector3; normal: THREE.Vector3 };

function penetration(point: THREE.Vector3, part: LineageAttachment, padding: number) {
  const local = point.clone().sub(part.root).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), part.direction).invert());
  if (local.y < -.05 || local.y > part.length + padding) return 0;
  const t = THREE.MathUtils.clamp(local.y / part.length, 0, 1);
  const radius = part.radius * (part.kind === 'ear' ? Math.sqrt(Math.max(0, 1 - (t * .98) ** 2)) : 1 - t) + padding;
  const flat = part.kind === 'ear' ? Math.max(.55, part.flat) : part.flat;
  const distance = Math.hypot(local.x / (radius * part.xScale), local.z / (radius * flat));
  return Math.max(0, 1 - distance) * radius;
}

/** Keep a seated ornament clear of ears, horns and crests without changing the chosen accessory. */
export function fitHairOrnament(obj: THREE.Object3D, direction: THREE.Vector3, roll: number, anatomy: HeadAnatomy, contact: HairContact) {
  obj.updateMatrixWorld(true);
  const samples: THREE.Vector3[] = [], bounds = new THREE.Box3().setFromObject(obj);
  obj.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const p = node.geometry.attributes.position, stride = Math.max(1, Math.floor(p.count / 64));
    for (let i = 0; i < p.count; i += stride) samples.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld));
  });
  const lift = Math.max(.007, .005 - bounds.min.z), parts = anatomy.protrusions();
  const side = direction.x < 0 ? -1 : 1;
  const candidates = [direction, direction.clone().add(V(0, 0, .16)), direction.clone().add(V(-side * .12, -.08, .3)),
    direction.clone().add(V(side * .18, .08, .2)), direction.clone().add(V(-side * .2, .12, .2))];
  let best: { point: THREE.Vector3; rotation: THREE.Quaternion; score: number } | undefined;
  for (const candidate of candidates) {
    const { point, normal } = contact(candidate, lift);
    const rotation = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), normal)
      .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), roll));
    let score = 0;
    for (const sample of samples) {
      const p = sample.clone().applyQuaternion(rotation).add(point);
      for (const part of parts) score = Math.max(score, penetration(p, part, .012));
    }
    if (!best || score < best.score) best = { point, rotation, score };
    if (score === 0) break;
  }
  obj.position.copy(best!.point); obj.quaternion.copy(best!.rotation);
}

/** A circlet follows one coherent route in front of the ear roots, rather than detouring bead by bead. */
export function hairCirclet(anatomy: HeadAnatomy, contact: HairContact) {
  const parts = anatomy.protrusions();
  let best: { points: THREE.Vector3[]; score: number } | undefined;
  for (const advance of [0, .15, .3, .45]) {
    const points: THREE.Vector3[] = []; let score = 0;
    for (let k = 0; k <= 32; k++) {
      const angle = -1.5 + k / 32 * 3;
      const { point } = contact(V(Math.sin(angle), .55, Math.cos(angle) + advance), .01);
      points.push(point);
      for (const part of parts) score = Math.max(score, penetration(point, part, .028));
    }
    if (!best || score < best.score) best = { points, score };
    if (score === 0) break;
  }
  return best!.points;
}
