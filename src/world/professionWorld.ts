import * as THREE from 'three';
import type { City, Interactable } from './city';
import { RPG_CATALOG, professionState, professionRank, gatherEnergy } from '../data/professions';
import { ResourceLayer } from './resourceLayer';
import { furnitureGeometry, resourceMaterial } from './resourceModels';
import { resourceFamily, RESOURCE_FAMILIES } from '../data/resourceAppearance';
import type { RpgState } from '../data/professions';

const built=new WeakSet<City>();
export function buildProfessionWorld(city:City){
 if(built.has(city))return;built.add(city);
 const root=new THREE.Group();root.name='profession-resources-and-stations';
 const collide=city.collide.bind(city);
 city.collide=(from,to)=>{
  const result=collide(from,to);
  for(const piece of root.children){
   if(!piece.name.startsWith('furniture:'))continue;
   const c=Math.cos(piece.rotation.y),s=Math.sin(piece.rotation.y),dx=result.x-piece.position.x,dz=result.z-piece.position.z;
   let x=c*dx-s*dz,z=s*dx+c*dz;
   const small=piece.userData.furnitureKind==='taburete',hx=(small?.325:.85)+.3,hz=(small?.325:.45)+.3;
   if(Math.abs(x)>=hx||Math.abs(z)>=hz)continue;
   if(hx-Math.abs(x)<hz-Math.abs(z))x=(x<0?-1:1)*hx;else z=(z<0?-1:1)*hz;
   result.x=piece.position.x+c*x+s*z;result.z=piece.position.z-s*x+c*z;
  }
  return collide(from,result);
 };
 const resources=new ResourceLayer(city.locationId,city.groundY.bind(city));
 root.add(resources.root);root.userData.resourceLayer=resources;
 city.root.add(root);
}
export function professionInteractions(city:City,state?:RpgState):Interactable[]{
 const now=Date.now()/1000;
 const progress=state??professionState(undefined);
 return [
  ...Object.values(RPG_CATALOG.nodes).filter(n=>n.location===city.locationId&&(state?.nodes[n.id]??0)<=now).map(n=>({id:`resource:${n.id}`,label:`${RESOURCE_FAMILIES[resourceFamily(n.item??'')??'herb'].verb} ${n.label} · ${gatherEnergy(professionRank(progress,n.job),n.tier!)} energía · ${n.seconds} s`,position:new THREE.Vector3(n.x,city.groundY(n.x,n.z),n.z),radius:2.8})),
  ...(state?.furniture??[]).filter(f=>f.location===city.locationId&&(f as unknown as {job?:string}).job).map(f=>({id:`station:${(f as unknown as {job:string}).job}`,label:'Usar estación de casa',position:new THREE.Vector3(f.x,city.groundY(f.x,f.z),f.z),radius:4})),
 ];
}
export function makeFurniture(kind:string,tier=0,job?:string){
 const group=new THREE.Group(),mesh=new THREE.Mesh(furnitureGeometry(kind,tier,job),resourceMaterial());
 group.userData.furnitureKind=kind;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return group;
}
export function refreshProfessionWorld(city:City,state?:RpgState){
 const root=city.root.getObjectByName('profession-resources-and-stations');if(!root)return;
 (root.userData.resourceLayer as ResourceLayer).refresh(state?.nodes);
 const signature=JSON.stringify(state?.furniture??[]);if(root.userData.furniture===signature)return;root.userData.furniture=signature;
 for(const child of [...root.children])if(child.name.startsWith('furniture:')){child.removeFromParent();child.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m.dispose();}});}
 for(const f of state?.furniture??[])if(f.location===city.locationId){const item=RPG_CATALOG.items[f.item.id],model=makeFurniture(item?.furniture??'mesa',item?.tier??0,f.job);model.name=`furniture:${f.id}`;model.position.set(f.x,city.groundY(f.x,f.z),f.z);model.rotation.y=f.yaw;root.add(model);}
}
