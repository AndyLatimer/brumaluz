import * as THREE from 'three';
import type { City, Interactable } from './city';
import { RPG_CATALOG, professionState, professionRank, gatherEnergy } from '../data/professions';
import { ResourceLayer } from './resourceLayer';
import { furnitureGeometry } from './homeFurniture';
import { furnitureMaterial } from './homeFurnitureMaterial';
import { resourceFamily, RESOURCE_FAMILIES } from '../data/resourceAppearance';
import type { RpgState } from '../data/professions';
import type { ProfessionSite } from '../data/professions';
import {HOME_FURNISHINGS,visibleFurniture} from '../data/homes';

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
   const def=HOME_FURNISHINGS[piece.userData.furnitureKind];if(def?.passable)continue;
   const hx=(def?.width??1.7)/2+.28,hz=(def?.depth??.9)/2+.28;
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
const resourceIndexes=new WeakMap<City,Map<string,ProfessionSite[]>>();
const resourcePositions=new WeakMap<City,Map<string,THREE.Vector3>>();
const RESOURCE_CELL=8;
function nearbyResources(city:City,near?:{x:number;z:number}){
 let cells=resourceIndexes.get(city);
 if(!cells){
  cells=new Map();
  for(const node of Object.values(RPG_CATALOG.nodes))if(node.location===city.locationId){
   const key=`${Math.floor(node.x/RESOURCE_CELL)}:${Math.floor(node.z/RESOURCE_CELL)}`;
   const bucket=cells.get(key)??[];bucket.push(node);cells.set(key,bucket);
  }
  resourceIndexes.set(city,cells);
 }
 if(!near)return [...cells.values()].flat();
 const nodes:ProfessionSite[]=[];
 for(let x=Math.floor((near.x-2.8)/RESOURCE_CELL);x<=Math.floor((near.x+2.8)/RESOURCE_CELL);x++)
  for(let z=Math.floor((near.z-2.8)/RESOURCE_CELL);z<=Math.floor((near.z+2.8)/RESOURCE_CELL);z++)
   for(const node of cells.get(`${x}:${z}`)??[])if((node.x-near.x)**2+(node.z-near.z)**2<=2.8**2)nodes.push(node);
 return nodes;
}
export function professionInteractions(city:City,state?:RpgState,near?:{x:number;z:number}):Interactable[]{
 const now=Date.now()/1000;
 const progress=state??professionState(undefined);
 let positions=resourcePositions.get(city);if(!positions){positions=new Map();resourcePositions.set(city,positions);}
 const position=(node:ProfessionSite)=>{let p=positions.get(node.id);if(!p){p=new THREE.Vector3(node.x,city.groundY(node.x,node.z),node.z);positions.set(node.id,p);}return p;};
 return [
  ...nearbyResources(city,near).filter(n=>(state?.nodes[n.id]??0)<=now).map(n=>({id:`resource:${n.id}`,label:`${RESOURCE_FAMILIES[resourceFamily(n.item??'')??'herb'].verb} ${n.label} · ${gatherEnergy(professionRank(progress,n.job),n.tier!)} energía · ${n.seconds} s`,position:position(n),radius:2.8})),
  ...(state?.homes?.visit?[]:state?.furniture??[]).filter(f=>f.location===city.locationId&&f.job&&(!near||(f.x-near.x)**2+(f.z-near.z)**2<=16)).map(f=>({id:`station:${f.job}`,label:'Usar estación de casa',position:new THREE.Vector3(f.x,city.groundY(f.x,f.z),f.z),radius:4})),
 ];
}
export function makeFurniture(kind:string,tier=0,job?:string,lit=true){
 const group=new THREE.Group(),mesh=new THREE.Mesh(furnitureGeometry(kind,tier,job),furnitureMaterial(lit));
 group.userData.furnitureKind=kind;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return group;
}
export function refreshProfessionWorld(city:City,state?:RpgState){
 const root=city.root.getObjectByName('profession-resources-and-stations');if(!root)return;
 (root.userData.resourceLayer as ResourceLayer).refresh(state?.nodes);
 const furniture=visibleFurniture(state,city.locationId);
 const signature=JSON.stringify(furniture);if(root.userData.furniture===signature)return;root.userData.furniture=signature;
 const existing=new Map(root.children.filter(child=>child.name.startsWith('furniture:')).map(child=>[child.name,child]));
 const retained=new Set(furniture.filter(f=>f.location===city.locationId).map(f=>`furniture:${f.id}`));
 for(const [name,child] of existing)if(!retained.has(name)){child.removeFromParent();disposeFurniture(child);existing.delete(name);}
 city.seats=city.seats.filter(seat=>!seat.id.startsWith('home:'));
 let lights=0;
 for(const f of furniture)if(f.location===city.locationId){
  const item=RPG_CATALOG.items[f.item.id],kind=item?.furniture??'mesa',def=HOME_FURNISHINGS[kind],name=`furniture:${f.id}`,appearance=JSON.stringify([kind,item?.tier??0,f.job]);
  let model=existing.get(name);
  if(model&&model.userData.appearance!==appearance){model.removeFromParent();disposeFurniture(model);model=undefined;}
  if(!model){model=makeFurniture(kind,item?.tier??0,f.job,f.lit!==false);model.name=name;model.userData.appearance=appearance;root.add(model);}
  model.position.set(f.x,city.groundY(f.x,f.z),f.z);model.rotation.y=f.yaw;
  model.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.MeshStandardMaterial).emissiveIntensity=f.lit!==false?.8:0;});
  for(const light of [...model.children])if(light instanceof THREE.PointLight)light.removeFromParent();
  if(def?.seat)city.seats.push({id:`home:${f.id}`,position:model.position.clone(),yaw:f.yaw,seatHeight:model.position.y+def.seat});
  if(def?.light&&f.lit!==false&&lights++<4){const light=new THREE.PointLight('#ffd396',1.8,3,2);light.position.set(0,.35,0);model.add(light);}
 }
}

function disposeFurniture(root:THREE.Object3D){
 root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});
}
export function clearFurniturePreview(city?:City){
 const preview=city?.root.getObjectByName('home-furniture-preview');if(!preview)return;
 const hidden=preview.userData.hiddenOriginal as THREE.Object3D|undefined;if(hidden)hidden.visible=true;
 preview.removeFromParent();disposeFurniture(preview);
}
export function setFurniturePreview(city:City,kind:string,tier:number,x:number,z:number,yaw:number,valid:boolean,job?:string,movingId?:string){
 const key=JSON.stringify([kind,tier,job,movingId]);let model=city.root.getObjectByName('home-furniture-preview');
 if(model?.userData.previewKey!==key){clearFurniturePreview(city);model=undefined;}
 if(!model){model=makeFurniture(kind,tier,job);model.name='home-furniture-preview';model.userData.previewKey=key;city.root.add(model);}
 const original=movingId?city.root.getObjectByName(`furniture:${movingId}`):undefined;
 if(original){original.visible=false;model.userData.hiddenOriginal=original;}
 model.position.set(x,city.groundY(x,z),z);model.rotation.y=yaw;
 // An opaque tinted preview keeps a stable depth surface, including at its old position.
 model.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshStandardMaterial;m.color.set(valid?'#c8e3aa':'#df8c7f');o.castShadow=false;}});
}
