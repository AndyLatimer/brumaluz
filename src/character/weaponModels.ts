import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../world/load';
const files = import.meta.glob<string>(['../assets/models/items/tier[0-5]/*.glb', '../assets/models/items/unique/**/*.glb', '../assets/models/items/collections/**/*.glb','../assets/models/items/accessories/*.glb'], { eager: true, query: '?url', import: 'default' });

const urls = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').at(-1)!.replace(/\.glb$/, ''), url]));
const models = new Map<string, GLTF>();
const pending=new Map<string,Promise<void>>();
export function weaponModelsReady(ids:readonly string[]){return ids.every(id=>!Object.hasOwn(urls,id)||models.has(id));}
export async function loadWeaponModels(ids:readonly string[]=Object.keys(urls)) {
  await Promise.all(ids.map(id=>{
    if(models.has(id)||!Object.hasOwn(urls,id))return;
    let request=pending.get(id);
    if(!request){request=loadGLB(urls[id]).then(model=>{models.set(id,model);}).finally(()=>pending.delete(id));pending.set(id,request);}
    return request;
  }));
}
export const weaponModel = (id: string) => models.get(id)?.scene;
