import * as THREE from 'three';
import type { HeadOptions } from './types';
import { V } from './geometry';

export interface EarAttachment {
  kind: 'human' | 'elf' | 'pelso' | 'fin' | 'none';
  root: THREE.Vector3;
  lobe: THREE.Vector3;
  temple: THREE.Vector3;
  tip: THREE.Vector3;
  normal: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: number;
  length: number;
  radius: number;
  flat: number;
  visible: boolean;
}
export interface LineageAttachment {
  kind: 'ear' | 'fin' | 'horn' | 'crest';
  root: THREE.Vector3; tip: THREE.Vector3; direction: THREE.Vector3;
  length: number; radius: number; flat: number; xScale: number;
}
export interface HeadAnatomy { ear: (side: number) => EarAttachment; protrusions: () => LineageAttachment[] }
type Surface = (direction: THREE.Vector3, out?: number) => THREE.Vector3;

/** Shared bind-space anatomy: geometry and jewellery use the same landmarks. */
export function createHeadAnatomy(o: HeadOptions, skull: Surface): HeadAnatomy {
  const trait = o.trait ?? 0, race = o.race ?? 'humano';
  const ear = (side: number): EarAttachment => {
    const s = side < 0 ? -1 : 1, closed = o.coveredEars || o.hat === 'helmet' || o.hat === 'bear';
    const temple = skull(V(s, -.06, -.1), .012);
    if (race === 'humano') {
      const root = skull(V(s, -.12, -.06), -.006), rotation = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), s * .12);
      const lobe = root.clone().add(V(s * .02, -.075, .024).applyQuaternion(rotation));
      return { kind: 'human', root, lobe, temple: root.clone().add(V(s * .018, .04, .035).applyQuaternion(rotation)),
        tip: root.clone().add(V(0, .1, 0).applyQuaternion(rotation)), normal: V(s * .02 / .035 ** 2, -.075 / .1 ** 2, .024 / .07 ** 2).normalize().applyQuaternion(rotation),
        rotation, scale: 1, length: .2, radius: .035, flat: .07, visible: !closed };
    }
    if (race === 'pelso') {
      const root = skull(V(s * .76, 1, .28), -.032);
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(trait === 2 ? .7 : 0, 0, -s * .3));
      const scale = trait === 4 ? .68 : 1;
      const localLobe = trait === 1 ? V(s * .085, .115, .075 * Math.sqrt(1 - (.085 / .145) ** 2 - (.07 / .155) ** 2))
        : V(s * .06, .1, (.19 / Math.sqrt(2) * .6) * (.34 - .1) / .46);
      const normal = trait === 1 ? V(localLobe.x / .145 ** 2, (localLobe.y - .045) / .155 ** 2, localLobe.z / .075 ** 2).normalize()
        : V(0, .19 / Math.sqrt(2) * .6 / .46, 1).normalize();
      return { kind: 'pelso', root, rotation, scale, length: trait === 1 ? .31 : .46, radius: trait === 1 ? .145 : .19, flat: trait === 1 ? .075 : .6,
        lobe: localLobe.multiplyScalar(scale).applyQuaternion(rotation).add(root), temple,
        tip: V(0, trait === 1 ? .2 : trait === 3 ? .46 : .34, 0).multiplyScalar(scale).applyQuaternion(rotation).add(root),
        normal: normal.applyQuaternion(rotation), visible: o.hat === 'none' };
    }
    const fin = race === 'lagto' && trait === 2;
    if (race === 'elfo' || fin) {
      const direction = fin ? V(s * .8, .16, -.68).normalize()
        : (trait === 2 ? V(s, -.25, -.35) : trait === 4 ? V(s, .05, -.15) : V(s, .5, -.3)).normalize();
      const length = fin ? .5 : [ .5, .3, .42, .36, .44 ][trait] ?? .5;
      const radius = fin ? .2 : trait === 3 ? .135 : .1, flat = fin ? .22 : .4;
      const root = skull(V(s, -.18, -.03), fin ? -.07 : -.035);
      const rotation = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), direction);
      const section = (fraction: number, up: number) => {
        const local = V(0, up, .8).applyQuaternion(rotation.clone().invert()); local.y = 0; local.normalize();
        return V(local.x * radius * (1 - fraction), length * fraction, local.z * radius * flat * (1 - fraction));
      };
      const lobeLocal = section(.18, -.8), normal = V(lobeLocal.x / radius ** 2, radius / length, lobeLocal.z / (radius * flat) ** 2).normalize().applyQuaternion(rotation);
      return { kind: fin ? 'fin' : 'elf', root, rotation, scale: 1, length, radius, flat,
        lobe: lobeLocal.applyQuaternion(rotation).add(root), temple: section(.22, .8).applyQuaternion(rotation).add(root),
        tip: direction.clone().multiplyScalar(length).add(root), normal, visible: !closed };
    }
    const root = skull(V(s, -.15, -.04), 0);
    return { kind: 'none', root, lobe: skull(V(s, -.21, .04), .014), temple, tip: root.clone(), normal: V(s, -.12, .3).normalize(),
      rotation: new THREE.Quaternion(), scale: 1, length: 0, radius: .03, flat: 1, visible: !closed };
  };
  const protrusions = (): LineageAttachment[] => {
    const result: LineageAttachment[] = [];
    const add = (kind: LineageAttachment['kind'], direction: THREE.Vector3, length: number, radius: number, xScale = 1) => {
      const n = direction.clone().normalize(), root = skull(n, -.025);
      const axis = kind === 'horn' ? n.clone().multiplyScalar(.7).add(V(0, .15, -.55)).normalize() : n;
      result.push({ kind, root, direction: axis, tip: root.clone().addScaledVector(axis, length), length, radius, flat: 1, xScale });
    };
    if (race === 'lagto' && o.hat === 'none') {
      if (trait === 1 || trait === 4) for (const s of [-1, 1]) add('horn', V(s * .6, .75, -.25), trait === 4 ? .2 : .4, .075);
      if (trait === 0 || trait === 5) for (let k = 0; k < 6; k++) {
        const angle = .45 - k * .36, direction = V(0, Math.cos(angle), Math.sin(angle));
        const length = [.16, .22, .24, .22, .18, .13][k] * (trait === 5 ? .7 : 1);
        add('crest', direction, length, .09, .35);
        if (trait === 5) for (const side of [-1, 1]) add('crest', direction.clone().add(V(side * .45, 0, 0)), length * .65, .045);
      }
    }
    for (const side of [-1, 1]) {
      const fit = ear(side); if (!fit.visible || fit.kind === 'none') continue;
      const direction = fit.tip.clone().sub(fit.root), length = direction.length(); direction.normalize();
      result.push({ kind: fit.kind === 'fin' ? 'fin' : 'ear', root: fit.root, tip: fit.tip, direction, length, radius: fit.radius * fit.scale, flat: fit.flat, xScale: 1 });
    }
    return result;
  };
  return { ear, protrusions };
}
