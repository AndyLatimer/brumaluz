// Tipos de las cabezas modulares: modelos de origen, opciones y resultado.
import type * as THREE from 'three';

export type HeadKit = 'Mage' | 'Knight' | 'Rogue' | 'Barbarian';
export interface HeadSource { kit: HeadKit; geometry: THREE.BufferGeometry; toBone: THREE.Matrix4 }
export type CreatorParts = Record<'ranger-hair' | 'rogue-fringe' | 'rogue-mask', THREE.BufferGeometry>;
export interface HeadOptions {
  face: HeadKit;
  hair: number;
  beard: number;
  eyeShape: number;
  brows: number;
  nose: number;
  mouth: number;
  detail: number;
  eyeColor: string;
  /** Aplanar las orejas humanas (elfos, Pelso, Lagto'). */
  flattenEars: boolean;
  hat: 'none' | 'helmet' | 'wizard' | 'bear' | 'cap';
  /** Linaje: cambia nariz, pupilas y marcas de la cara. */
  race?: 'humano' | 'elfo' | 'lagto' | 'pelso';
  skin?: string;
  /** Complementos: adorno del pelo, gafas/bufanda/joyas, maquillaje y su color. */
  hairAcc?: number;
  hairAccColor?: string;
  acc?: number;
  makeup?: number;
  makeupColor?: string;
  accColor?: string;
}
export interface HeadResult {
  group: THREE.Group;
  ownedMaterials: THREE.Material[];
  /** Puntos de anclaje en el espacio de la malla original (pasar por toBone). */
  anchors: { ear: (s: number) => THREE.Vector3; top: (s: number) => THREE.Vector3; crest: { p: THREE.Vector3; n: THREE.Vector3 }[]; surf: (dir: THREE.Vector3, sink?: number) => { p: THREE.Vector3; n: THREE.Vector3 } };
  toBone: THREE.Matrix4;
  /** Grupos de los ojos (para parpadear escalando en Y). */
  eyes: THREE.Object3D[];
  /** Ojos cerrados de alegría (^ ^), ocultos hasta que el personaje saluda. */
  happy: THREE.Object3D[];
  /** Boca en reposo y boca abierta (óvalo): al hablar se alternan y la abierta se abre y cierra. */
  mouth: { rest: THREE.Object3D; open: THREE.Object3D };
}
