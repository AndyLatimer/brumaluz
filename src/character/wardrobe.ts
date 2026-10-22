import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../world/load';
import helpersUrl from '../assets/models/wardrobe/helpers.glb?url';
import medievalUrl from '../assets/models/wardrobe/medieval.glb?url';
import type { HeadOptions } from './head';
import { OUTFITS, equippedArmor, ARMOR_SLOTS } from '../data/outfits';
import type { ClassId } from '../data/data';
import type { Equipment } from '../data/inventory';
import { ACCESSORIES } from '../data/accessories';
import { weaponModel } from './weaponModels';
import modularNodes from '../assets/models/wardrobe/classes/modular/nodes.json';

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

export type WardrobeId = 'helpers' | 'medieval' | `traje_${string}`;
export const WARDROBES: Record<WardrobeId, WardrobeSet> = {
  ...Object.fromEntries(Object.keys(OUTFITS).map(id => [id, {
    hairFit: 'none', pieces: [
      { node: 'medieval-tunic', replaces: ['torso'] },
      { node: 'suit-foundation' },
      { node: 'suit-leg-detail-l' }, { node: 'suit-leg-detail-r' },
      { node: 'suit-arm-detail-l' }, { node: 'suit-arm-detail-r' },
      { node: 'medieval-sleeve-l', replaces: ['arms'] }, { node: 'medieval-sleeve-r' },
      { node: 'anatomy-hand-left' }, { node: 'anatomy-hand-right' },
      { node: 'medieval-leg-l', replaces: ['legs'] }, { node: 'medieval-leg-r' },
    ],
  }])),
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
  // Sin sombrero: se ve el pelo. Las piernas llevan ya las botas.
  medieval: {
    hairFit: 'none',
    pieces: [
      { node: 'medieval-tunic', replaces: ['torso'] },
      { node: 'medieval-sleeve-l', replaces: ['arms'] },
      { node: 'medieval-sleeve-r' },
      { node: 'anatomy-hand-left' },
      { node: 'anatomy-hand-right' },
      { node: 'medieval-leg-l', replaces: ['legs'] },
      { node: 'medieval-leg-r' },
    ],
  },
};
const assets = new Map<WardrobeId, GLTF>();

export function wardrobeSource(id: WardrobeId = 'helpers') {
  const asset = assets.get(id);
  if (!asset) throw new Error(`El vestuario «${id}» debe cargarse antes de crear personajes.`);
  return asset;
}

export async function loadWardrobe() {
  const files = import.meta.glob<string>('../assets/models/wardrobe/classes/*.glb', { eager: true, query: '?url', import: 'default' });
  const [helpers, medieval] = await Promise.all([
    loadGLB(helpersUrl),
    loadGLB(medievalUrl),
  ]);
  assets.set('helpers', helpers);
  assets.set('medieval', medieval);
  await Promise.all(Object.entries(files).map(async ([file, url]) => {
    assets.set(file.split('/').at(-1)!.replace('.glb', '') as WardrobeId, await loadGLB(url));
  }));
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
  colors?: { primary: string; secondary: string },
) {
  const asset = assets.get(id);
  if (!asset) throw new Error(`El vestuario «${id}» debe cargarse antes de crear personajes.`);
  const set: WardrobeSet = WARDROBES[id];
  const materials = new Map<THREE.Material, THREE.Material>();
  const material = (source: THREE.Material) => {
    let result = materials.get(source);
    if (!result) {
      result = source.clone();
      if (result instanceof THREE.MeshStandardMaterial) {
        if (source.name === 'skin') result.color.set(skinColor);
        else if (colors && source.name === 'tunic') result.color.set(colors.primary);
        else if (colors && ['tunicTrim', 'trousers'].includes(source.name)) result.color.set(colors.secondary);
      }
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

export function modularHairFit(cls:ClassId,equipment:Equipment):HeadOptions['hat'] {
  return equippedArmor(cls,equipment,'head') ? cls==='mago'?'wizard':cls==='clerigo'?'none':cls==='guerrero'?'helmet':'cap' : 'none';
}

/** Each slot mounts only its own patterns. Empty slots use complete neutral underclothes. */
export function mountModularWardrobe(
  cls:ClassId,equipment:Equipment,model:THREE.Object3D,bones:ReadonlyMap<string,THREE.Bone>,
  skin:string,colors:{primary:string;secondary:string},own:(resource:{dispose():void})=>void,
  hat=true,
) {
  const fallback=wardrobeSource('traje_guerrero_artesano');
  function mount(asset:GLTF,names:readonly string[],base=false){
    const cache=new Map<THREE.Material,THREE.Material>();
    const material=(source:THREE.Material)=>{
      let result=cache.get(source);if(result)return result;
      result=source.clone();cache.set(source,result);own(result);
      if(result instanceof THREE.MeshStandardMaterial){
        if(source.name==='skin')result.color.set(skin);
        if(base&&source.name==='tunic')result.color.set(colors.primary);
        if(base&&['tunicTrim','trousers'].includes(source.name))result.color.set(colors.secondary);
      }
      return result;
    };
    for(const name of names){const node=asset.scene.getObjectByName(name);if(!node)throw new Error(`Falta pieza modular: ${name}`);mountCharacterPiece(node,model,bones,material,own)}
  }
  for(const slot of ARMOR_SLOTS){
    if(slot==='head'&&!hat)continue;
    const item=equippedArmor(cls,equipment,slot);
    if(item){mount(wardrobeSource(item.setId as WardrobeId),modularNodes[slot]);continue}
    if(slot==='chest')mount(wardrobeSource('medieval'),['medieval-tunic','medieval-sleeve-l','medieval-sleeve-r'],true);
    else if(slot==='hands')mount(wardrobeSource('medieval'),['anatomy-hand-left','anatomy-hand-right']);
    else if(slot==='legs')mount(fallback,modularNodes.legs,true);
    else if(slot==='feet')mount(fallback,modularNodes.feet,true);
  }
}

export function mountEquippedAccessories(equipment:Equipment,model:THREE.Object3D,bones:ReadonlyMap<string,THREE.Bone>,own:(resource:{dispose():void})=>void){
  for(const slot of ['pendant','ring','trinket'] as const){
    const stack=equipment[slot],item=stack&&ACCESSORIES[stack.id];
    if(!item||stack?.count!==1||item.slot!==slot)continue;
    const node=weaponModel(item.id)?.getObjectByName(item.id);
    if(node)mountCharacterPiece(node,model,bones,source=>{const copy=source.clone();own(copy);return copy},own);
  }
}
