import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { characterKit, recolor, charm, CLOTH_CELLS, type BuildOpts } from './character';
import { wardrobeSource, mountCharacterPiece } from './wardrobe';
import { CLOTH } from '../data/data';
import { clothingPiece, type ClothingSource, type NpcClothing } from '../data/npcClothing';
import { loadGLB } from '../world/load';
import rangerUrl from '../assets/library/adventurers/characters/Ranger.glb?url';
import rogueHoodedUrl from '../assets/library/adventurers/characters/Rogue_Hooded.glb?url';

const additional = {
  Ranger: import.meta.env.DEV || import.meta.env.NPC_RANGER ? rangerUrl : undefined,
  Rogue_Hooded: import.meta.env.DEV || import.meta.env.NPC_ROGUE_HOODED ? rogueHoodedUrl : undefined,
};
const loaded = new Map<ClothingSource, GLTF>(), pending = new Map<ClothingSource, Promise<void>>();
export async function loadNpcClothing(clothing: NpcClothing) {
  await Promise.all([...new Set(Object.values(clothing).filter(item => item.piece).map(item => clothingPiece(item.piece).source))].map(async source => {
    if (source !== 'Ranger' && source !== 'Rogue_Hooded') return;
    if (!pending.has(source)) {
      const load = additional[source];
      if (!load) throw new Error(`La ropa de ${source} no se incluyó en esta compilación. Registra la ficha y vuelve a compilar.`);
      pending.set(source, loadGLB(load)
        .then(gltf => { loaded.set(source, gltf); }).catch(error => { pending.delete(source); throw error; }));
    }
    await pending.get(source);
  }));
}
function sourceAsset(source: ClothingSource) {
  if (source === 'helpers' || source === 'medieval') return wardrobeSource(source);
  if (source === 'Ranger' || source === 'Rogue_Hooded') {
    const asset = loaded.get(source);
    if (!asset) throw new Error(`Primero debe cargarse la ropa de ${source}.`);
    return asset;
  }
  return characterKit(source);
}
const palette: Record<Exclude<ClothingSource, 'helpers' | 'medieval'>, { primary: number[]; secondary: number[] }> = {
  ...CLOTH_CELLS,
  Rogue_Hooded: { primary: CLOTH_CELLS.Rogue.primary, secondary: [5, 6, 13, 14, 35, 43] },
  Ranger: { primary: [16, 24], secondary: [5, 6, 13, 14, 17, 25, 35, 43] },
};
export function npcClothingRenderer(clothing: NpcClothing): NonNullable<BuildOpts['clothing']> {
  return {
    hairFit: clothing.head.piece ? clothingPiece(clothing.head.piece).hairFit ?? 'none' : 'none',
    mount(model, bones, skin, own) {
      const materials = new Map<string, THREE.Material>();
      for (const selection of Object.values(clothing)) {
        if (!selection.piece) continue;
        const piece = clothingPiece(selection.piece), asset = sourceAsset(piece.source);
        const material = (source: THREE.Material) => {
          const key = `${source.uuid}:${selection.primary}:${selection.secondary}`;
          let result = materials.get(key);
          if (result) return result;
          result = source.clone();
          if (!(result instanceof THREE.MeshStandardMaterial)) throw new Error(`Material no compatible en ${piece.id}.`);
          const primary = CLOTH[selection.primary], secondary = CLOTH[selection.secondary];
          if (piece.source === 'helpers' || piece.source === 'medieval') {
            if (source.name === 'skin') result.color.set(skin);
            else if (source.name === 'neckSkin') result.color.set(skin).convertLinearToSRGB();
            else if (selection.primary >= 0 && ['linen', 'blue', 'red', 'leather', 'tunic', 'trousers'].includes(source.name)) result.color.set(primary);
            else if (selection.secondary >= 0 && ['trim', 'redTrim', 'sole', 'tunicTrim', 'darkLeather'].includes(source.name)) result.color.set(secondary);
          } else {
            if (!result.map) throw new Error(`Falta la paleta de ${piece.id}.`);
            const cells = palette[piece.source];
            const paints: [number[], string][] = [[[0, 8, 39, 47], skin]];
            if (selection.primary >= 0) paints.push([cells.primary, primary]);
            if (selection.secondary >= 0) paints.push([cells.secondary, secondary]);
            result.map = recolor(result.map, `npc:${piece.source}`, paints);
            result.roughness = .7; result.metalness = 0; charm(result);
          }
          if (piece.slot === 'head' || piece.slot === 'cape') result.side = THREE.DoubleSide;
          materials.set(key, result); own(result); return result;
        };
        for (const name of piece.nodes) {
          const source = asset.scene.getObjectByName(name);
          if (!source) throw new Error(`Falta la malla ${name} de ${piece.id}.`);
          const copy = mountCharacterPiece(source, model, bones, material, own);
          if (piece.slot === 'head' && piece.source !== 'helpers' && piece.source !== 'medieval') copy.scale.multiplyScalar(1.06);
        }
      }
    },
  };
}
