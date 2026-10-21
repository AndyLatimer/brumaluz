import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../world/load';
import helpersUrl from '../assets/models/wardrobe/helpers.glb?url';
import medievalUrl from '../assets/models/wardrobe/medieval.glb?url';
import type { HeadOptions } from './head';

type BodyRegion = 'torso' | 'arms' | 'legs';
type Attachment = 'head' | 'chest' | 'handslot.l' | 'handslot.r';
interface WardrobePiece {
  node: string;
  attachment?: Attachment;
  replaces?: readonly BodyRegion[];
}
interface WardrobeSet {
  pieces: readonly WardrobePiece[];
  hairFit: HeadOptions['hat'];
}

export const WARDROBES = {
  helpers: {
    hairFit: 'cap',
    pieces: [
      { node: 'helpers-shirt', replaces: ['torso'] },
      { node: 'helpers-sleeve-l', replaces: ['arms'] },
      { node: 'helpers-sleeve-r' },
      { node: 'anatomy-hand-left' },
      { node: 'anatomy-hand-right' },
      { node: 'helpers-overalls' },
      { node: 'helpers-trouser-l', replaces: ['legs'] },
      { node: 'helpers-trouser-r' },
      { node: 'helpers-boot-l' },
      { node: 'helpers-boot-r' },
      { node: 'helpers-soft-cap', attachment: 'head' },
    ],
  },
  medieval: {
    hairFit: 'cap',
    pieces: [
      { node: 'medieval-tunic', replaces: ['torso'] },
      { node: 'medieval-sleeve-l', replaces: ['arms'] },
      { node: 'medieval-sleeve-r' },
      { node: 'anatomy-hand-left' },
      { node: 'anatomy-hand-right' },
      { node: 'medieval-trouser-l', replaces: ['legs'] },
      { node: 'medieval-trouser-r' },
      { node: 'medieval-boot-l' },
      { node: 'medieval-boot-r' },
      { node: 'medieval-hat', attachment: 'head' },
    ],
  },
} as const satisfies Record<string, WardrobeSet>;
export type WardrobeId = keyof typeof WARDROBES;
const assets = new Map<WardrobeId, GLTF>();

export function wardrobeSource(id: WardrobeId = 'helpers') {
  const asset = assets.get(id);
  if (!asset) throw new Error(`El vestuario «${id}» debe cargarse antes de crear personajes.`);
  return asset;
}

export async function loadWardrobe() {
  const [helpers, medieval] = await Promise.all([
    loadGLB(helpersUrl),
    loadGLB(medievalUrl),
  ]);
  assets.set('helpers', helpers);
  assets.set('medieval', medieval);
}

export function wardrobeRegions(id: WardrobeId): ReadonlySet<BodyRegion> {
  const set: WardrobeSet = WARDROBES[id];
  return new Set(set.pieces.flatMap(piece => piece.replaces ?? []));
}

export function mountCharacterPiece(
  source: THREE.Object3D, model: THREE.Object3D, bones: ReadonlyMap<string, THREE.Bone>,
  material: (source: THREE.Material) => THREE.Material, own: (resource: { dispose(): void }) => void,
  attachment?: string,
) {
  const copy = source.clone(true);
  copy.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material) ? object.material.map(material) : material(object.material);
    object.castShadow = true;
    if (object instanceof THREE.SkinnedMesh) {
      const mapped = object.skeleton.bones.map(bone => {
        const target = bones.get(bone.name);
        if (!target) throw new Error(`Hueso incompatible en ${source.name}: ${bone.name}`);
        return target;
      });
      const skeleton = new THREE.Skeleton(mapped, object.skeleton.boneInverses);
      object.bind(skeleton, object.bindMatrix);
      object.frustumCulled = false;
      own(skeleton);
    }
  });
  const anchor = attachment ?? (source.parent instanceof THREE.Bone ? source.parent.name : undefined);
  if (anchor) {
    const bone = bones.get(anchor);
    if (!bone) throw new Error(`Anclaje inexistente: ${anchor}`);
    bone.add(copy);
  } else model.add(copy);
  return copy;
}

/** Shared geometry stays cached; each wearer owns its materials and skeleton bindings. */
export function mountWardrobe(
  id: WardrobeId, model: THREE.Object3D, bones: ReadonlyMap<string, THREE.Bone>,
  skinColor: string, own: (resource: { dispose(): void }) => void,
  hat = true,
) {
  const asset = assets.get(id);
  if (!asset) throw new Error(`El vestuario «${id}» debe cargarse antes de crear personajes.`);
  const set: WardrobeSet = WARDROBES[id];
  const materials = new Map<THREE.Material, THREE.Material>();
  const material = (source: THREE.Material) => {
    let result = materials.get(source);
    if (!result) {
      result = source.clone();
      if (result instanceof THREE.MeshStandardMaterial && source.name === 'skin') result.color.set(skinColor);
      materials.set(source, result);
      own(result);
    }
    return result;
  };
  for (const piece of set.pieces) {
    if (!hat && 'attachment' in piece && piece.attachment === 'head') continue;
    const source = asset.scene.getObjectByName(piece.node);
    if (!source) throw new Error(`Falta la pieza de vestuario: ${piece.node}`);
    mountCharacterPiece(source, model, bones, material, own, piece.attachment);
  }
}
