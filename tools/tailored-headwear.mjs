import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {THREE} from './garment-studio.mjs';

// Blender-authored cages. The evaluated cache allows GLB builds without Blender.
const source=JSON.parse(gunzipSync(fs.readFileSync(new URL('../art/equipment/headwear.meshes.json.gz',import.meta.url))).toString('utf8'));
export function tailoredHeadwear(S,C){
 const prototype=source.models[`${C.cls}_${C.tier}`];
 if(!prototype)throw new Error(`Missing authored headwear: ${C.cls}/${C.tier}`);
 const parts=prototype.map(part=>{
  const geometry=new THREE.BufferGeometry();
  for(const [name,size] of [['position',3],['normal',3],['uv',2]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(part[name],size));
  return S.piece(geometry,part.material,()=>[['head',1]],part.role);
 });
 S.mesh('suit-head',parts,{fitVersion:4,fitCenter:[0,1.66,-.01],fitRadii:[.48,.48,.46],hood:C.cut===2,authoredIn:'Blender',source:'art/equipment/brumaluz-headwear.blend'});
}
