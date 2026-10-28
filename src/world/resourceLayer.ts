import * as THREE from 'three';
import { RPG_CATALOG } from '../data/professions';
import { resourceFamily } from '../data/resourceAppearance';
import { resourceGeometry, resourceMaterial } from './resourceModels';

/** The editor and the game render the same authoritative node positions and models. */
export class ResourceLayer {
 readonly root=new THREE.Group();
 private entries:{id:string;index:number;ready:THREE.InstancedMesh;spent:THREE.InstancedMesh;matrix:THREE.Matrix4;available:boolean}[]=[];
 private hidden=new THREE.Matrix4().makeScale(0,0,0);
 constructor(location:string,groundY:(x:number,z:number)=>number){
  this.root.name='resource-models';
  const batches=new Map<string,typeof RPG_CATALOG.nodes[string][]>();
  for(const node of Object.values(RPG_CATALOG.nodes).filter(n=>n.location===location)){
   const family=resourceFamily(node.item??'');if(!family)continue;
   const key=`${family}:${node.tier??0}`;const nodes=batches.get(key)??[];nodes.push(node);batches.set(key,nodes);
  }
  if(!batches.size)return;
  const material=resourceMaterial();
  for(const nodes of batches.values()){
   const first=nodes[0],family=resourceFamily(first.item!)!;
   const ready=new THREE.InstancedMesh(resourceGeometry(family,first.tier??0),material,nodes.length);
   const spent=new THREE.InstancedMesh(resourceGeometry(family,first.tier??0,true),material,nodes.length);
   ready.name=`resource-${family}-${first.tier}`;spent.name=`resource-depleted-${family}-${first.tier}`;
   ready.castShadow=spent.castShadow=true;ready.receiveShadow=spent.receiveShadow=true;
   nodes.forEach((node,index)=>{
    const seed=[...node.id].reduce((v,c)=>v*31+c.charCodeAt(0),7)>>>0;
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(node.x,groundY(node.x,node.z)+.015,node.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(seed%628)/100),new THREE.Vector3(1,1,1));
    ready.setMatrixAt(index,matrix);spent.setMatrixAt(index,this.hidden);
    this.entries.push({id:node.id,index,ready,spent,matrix,available:true});
   });
   ready.computeBoundingSphere();spent.boundingSphere=ready.boundingSphere!.clone();
   this.root.add(ready,spent);
  }
  this.root.userData.nodeCount=this.entries.length;
 }
 refresh(nodes:Record<string,number>={},now=Date.now()/1000){
  for(const entry of this.entries){const available=(nodes[entry.id]??0)<=now;if(available===entry.available)continue;
   entry.available=available;entry.ready.setMatrixAt(entry.index,available?entry.matrix:this.hidden);entry.spent.setMatrixAt(entry.index,available?this.hidden:entry.matrix);
   entry.ready.instanceMatrix.needsUpdate=entry.spent.instanceMatrix.needsUpdate=true;
  }
 }
 fitTerrain(groundY:(x:number,z:number)=>number){
  const changed=new Set<THREE.InstancedMesh>();
  for(const entry of this.entries){const matrix=entry.matrix,y=groundY(matrix.elements[12],matrix.elements[14])+.015;
   if(Math.abs(matrix.elements[13]-y)<.001)continue;matrix.elements[13]=y;
   const mesh=entry.available?entry.ready:entry.spent;mesh.setMatrixAt(entry.index,matrix);mesh.instanceMatrix.needsUpdate=true;changed.add(mesh);
  }
  for(const mesh of changed)mesh.computeBoundingSphere();
 }
 dispose(){
  const materials=new Set<THREE.Material>();
  this.root.traverse(part=>{if(part instanceof THREE.Mesh){part.geometry.dispose();for(const material of Array.isArray(part.material)?part.material:[part.material])materials.add(material);}});
  for(const material of materials)material.dispose();this.root.removeFromParent();this.entries=[];
 }
}
