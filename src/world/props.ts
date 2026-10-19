import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from './load';
import coinBagUrl from '../assets/models/props/coin-bag.glb?url';

// Objetos sueltos del mundo, generados por scripts/build-props.mjs (npm run art:props).
const PROP_URLS = { 'coin-bag': coinBagUrl } as const;
export type PropId = keyof typeof PROP_URLS;
const assets = new Map<PropId, Promise<GLTF>>();

/** Devuelve una copia lista para colocar; las mallas y materiales se comparten entre copias. */
export async function loadProp(id: PropId): Promise<THREE.Object3D> {
  let asset = assets.get(id);
  if (!asset) { asset = loadGLB(PROP_URLS[id]); assets.set(id, asset); }
  const copy = (await asset).scene.clone(true);
  copy.name = id;
  copy.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  return copy;
}
