import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from './load';
import coinBagUrl from '../assets/models/props/coin-bag.glb?url';
import woodenBridgeUrl from '../assets/models/props/wooden-bridge.glb?url';
import medievalBridgeUrl from '../assets/models/props/medieval-bridge.glb?url';
import medievalRoofedBridgeUrl from '../assets/models/props/medieval-bridge_roofed.glb?url';
import textilesUrl from '../assets/library/resources/objects/Textiles_Stack_Small.glb?url';
import ironUrl from '../assets/library/resources/objects/Iron_Bars.glb?url';
import logsUrl from '../assets/library/resources/objects/Wood_Log_Stack.glb?url';
import planksUrl from '../assets/library/resources/objects/Wood_Planks_Stack_Small.glb?url';
import tableUrl from '../assets/library/dungeon/objects/table_small_decorated_A.glb?url';
import barrelsUrl from '../assets/library/dungeon/objects/barrel_small_stack.glb?url';
import bushUrl from '../assets/library/forest/objects/Bush_1_A_Color1.glb?url';
import rockUrl from '../assets/library/forest/objects/Rock_1_A_Color1.glb?url';

export const PROP_URLS = {
  'coin-bag': coinBagUrl, textiles: textilesUrl, iron: ironUrl, logs: logsUrl, planks: planksUrl,
  'tavern-table': tableUrl, barrels: barrelsUrl, bush: bushUrl, rock: rockUrl,
  'wooden-bridge': woodenBridgeUrl,
  'medieval-bridge': medievalBridgeUrl,
  'medieval-bridge-roofed': medievalRoofedBridgeUrl,
} as const;
export type PropId = keyof typeof PROP_URLS;
const assets = new Map<PropId, Promise<GLTF>>();

/** Devuelve una copia lista para colocar; las mallas y materiales se comparten entre copias. */
export async function loadProp(id: PropId): Promise<THREE.Object3D> {
  let asset = assets.get(id);
  if (!asset) {
    asset = loadGLB(PROP_URLS[id]).catch(error => { assets.delete(id); throw error; });
    assets.set(id, asset);
  }
  const copy = (await asset).scene.clone(true);
  copy.name = id;
  copy.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  return copy;
}
