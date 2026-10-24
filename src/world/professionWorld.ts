import * as THREE from 'three';
import type { City, Interactable } from './city';
import { RPG_CATALOG, professionState, professionRank, gatherEnergy } from '../data/professions';
import { ITEM_RARITIES, rarityForTier } from '../data/itemRarity';
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
 for(const node of Object.values(RPG_CATALOG.nodes).filter(n=>n.location===city.locationId)){
  const group=new THREE.Group();group.name=`resource:${node.id}`;group.position.set(node.x,city.groundY(node.x,node.z),node.z);
  const color=ITEM_RARITIES[rarityForTier(node.tier!)].color;
  const material=new THREE.MeshStandardMaterial({color,roughness:.85});
  if(node.job==='minero')for(let i=0;i<4;i++){const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.22+i*.045,0),material);rock.position.set(Math.sin(i*2.4)*.28,.2,Math.cos(i*2.4)*.28);rock.scale.y=1.2;rock.rotation.set(i,.4*i,.2);group.add(rock);}
  else if(node.job==='lenador'){
   const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.32,.65,8),new THREE.MeshStandardMaterial({color:'#805d3e',roughness:1}));trunk.position.y=.32;group.add(trunk);
   const rings=new THREE.Mesh(new THREE.TorusGeometry(.16,.015,4,16),material);rings.rotation.x=-Math.PI/2;rings.position.y=.655;group.add(rings);
   for(let i=0;i<3;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.8,6),trunk.material);log.rotation.z=Math.PI/2;log.position.set(0,.14,i*.2-.2);group.add(log);}
  }else for(let i=0;i<5;i++){
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.015,.025,.35+i*.025,4),new THREE.MeshStandardMaterial({color:'#477547'}));stem.position.set(Math.sin(i*2.4)*.3,.18,Math.cos(i*2.4)*.3);group.add(stem);
   const fruit=new THREE.Mesh(new THREE.IcosahedronGeometry(.09,1),material);fruit.position.copy(stem.position).y+=.19;group.add(fruit);
  }
  group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});root.add(group);
 }
 // Los talleres públicos recibirán sus modelos al integrarse en sus ubicaciones definitivas.
 city.root.add(root);
 // Batch repeated resource shapes so adding professions does not add hundreds of draw calls.
 root.updateMatrixWorld(true);const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
 const groups=new Map<string,{geometry:THREE.BufferGeometry;material:THREE.Material;instances:{node:string;matrix:THREE.Matrix4}[]}>();
 for(const resource of root.children.filter(o=>o.name.startsWith('resource:')))resource.traverse(part=>{
  if(!(part instanceof THREE.Mesh)||Array.isArray(part.material))return;
  const m=part.material as THREE.MeshStandardMaterial,key=`${part.geometry.type}:${JSON.stringify((part.geometry as THREE.BufferGeometry&{parameters?:unknown}).parameters)}:${m.color.getHexString()}`;
  let batch=groups.get(key);if(!batch){batch={geometry:part.geometry.clone(),material:m.clone(),instances:[]};groups.set(key,batch);}
  batch.instances.push({node:resource.name.slice(9),matrix:new THREE.Matrix4().multiplyMatrices(inverse,part.matrixWorld)});
 });
 const entries:{node:string;mesh:THREE.InstancedMesh;index:number;matrix:THREE.Matrix4}[]=[];
 for(const batch of groups.values()){const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.instances.length);mesh.name='resource-batch';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;batch.instances.forEach((entry,index)=>{mesh.setMatrixAt(index,entry.matrix);entries.push({...entry,index,mesh});});root.add(mesh);}
 for(const resource of root.children.filter(o=>o.name.startsWith('resource:'))){resource.traverse(part=>{if(part instanceof THREE.Mesh){part.geometry.dispose();for(const m of Array.isArray(part.material)?part.material:[part.material])m.dispose();}});resource.clear();}
 root.userData.resourceInstances=entries;
}
export function professionInteractions(city:City,state?:RpgState):Interactable[]{
 const now=Date.now()/1000;
 const progress=state??professionState(undefined);
 return [
  ...Object.values(RPG_CATALOG.nodes).filter(n=>n.location===city.locationId&&(state?.nodes[n.id]??0)<=now).map(n=>({id:`resource:${n.id}`,label:`Recolectar ${n.label} · ${gatherEnergy(professionRank(progress,n.job),n.tier!)} energía · ${n.seconds} s`,position:new THREE.Vector3(n.x,city.groundY(n.x,n.z),n.z),radius:2.8})),
  ...(state?.furniture??[]).filter(f=>f.location===city.locationId&&(f as unknown as {job?:string}).job).map(f=>({id:`station:${(f as unknown as {job:string}).job}`,label:'Usar estación de casa',position:new THREE.Vector3(f.x,city.groundY(f.x,f.z),f.z),radius:4})),
 ];
}
export function makeFurniture(kind:string){
 const group=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:'#987044',roughness:.85}),dark=new THREE.MeshStandardMaterial({color:'#543d2c',roughness:1});
 group.userData.furnitureKind=kind;
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat=wood)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);};
 const w=kind==='taburete'?.65:1.6,h=kind==='biblioteca'?1.8:.85,d=kind==='taburete'?.65:.8;
 if(kind==='biblioteca'){box(0,h/2,0,w,h,.08,dark);for(const x of [-w/2,w/2])box(x,h/2,0,.09,h,d);for(let i=0;i<4;i++)box(0,.08+i*.55,0,w,.08,d);for(let i=0;i<10;i++)box(-.65+i*.14,.35+(i%3)*.55,-.05,.1,.3,.4,new THREE.MeshStandardMaterial({color:['#717a54','#6a5b81','#9d6652'][i%3],roughness:1}));}
 else {box(0,h,0,w,.13,d);for(const x of [-w*.4,w*.4])for(const z of [-d*.35,d*.35])box(x,h/2,z,.1,h,.1,dark);if(kind==='estacion'){box(0,h+.14,0,.65,.15,.4,dark);box(.4,h+.22,-.1,.12,.3,.12);}}
 return group;
}
export function refreshProfessionWorld(city:City,state?:RpgState){
 const root=city.root.getObjectByName('profession-resources-and-stations');if(!root)return;
 const now=Date.now()/1000;for(const child of root.children)if(child.name.startsWith('resource:'))child.visible=(state?.nodes[child.name.slice(9)]??0)<=now;
 const hidden=new THREE.Matrix4().makeScale(0,0,0);for(const entry of root.userData.resourceInstances??[]){entry.mesh.setMatrixAt(entry.index,(state?.nodes[entry.node]??0)>now?hidden:entry.matrix);entry.mesh.instanceMatrix.needsUpdate=true;}
 const signature=JSON.stringify(state?.furniture??[]);if(root.userData.furniture===signature)return;root.userData.furniture=signature;
 for(const child of [...root.children])if(child.name.startsWith('furniture:')){child.removeFromParent();child.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m.dispose();}});}
 for(const f of state?.furniture??[])if(f.location===city.locationId){const item=RPG_CATALOG.items[f.item.id],model=makeFurniture(item?.furniture??'mesa');model.name=`furniture:${f.id}`;model.position.set(f.x,city.groundY(f.x,f.z),f.z);model.rotation.y=f.yaw;root.add(model);}
}
