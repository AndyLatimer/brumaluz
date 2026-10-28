import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import * as THREE from 'three';

const bundle=await build({stdin:{contents:"export * from './src/world/map/objects';export * from './src/world/map/materials';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const code=Buffer.from(bundle.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const {ObjectLayer,MaterialVariants,WORLD_TREE_OCCLUDER}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const eye=new THREE.Vector3(0,6,12),targets=[new THREE.Vector3(0,1,0)];
const object=(id,asset,x,z,extra={})=>({id,asset,layer:'world',position:[x,0,z],rotation:[0,0,0],scale:[1,1,1],collision:'auto',...extra});
async function fixture(){
 const sourceMaterial=new THREE.MeshStandardMaterial({color:'#6b9553'}),geometry=new THREE.BoxGeometry(4,8,4).translate(0,4,0);
 const template=new THREE.Group();template.add(new THREE.Mesh(geometry,sourceMaterial));
 const provider={template:async()=>template,collisionBox:async()=>new THREE.Box3()};
 const layer=new ObjectLayer(provider,new MaterialVariants());
 layer.sync([
  object('canopy','brumaluz-arboleda/objects/tree_ancient_oak',0,4),
  object('behind','city/tree_single_A',0,-6),
  object('side','city/trees_A_large',10,4),
  object('wall','city/wall_straight',0,7),
  object('mountain','city/mountain_A_grass_trees',0,7),
  object('hidden','brumaluz-arboleda/objects/tree_weeping_willow',0,5,{hidden:true}),
 ],[{id:'world',name:'World',visible:true,locked:false}]);
 await layer.ready();layer.batch();
 return{layer,sourceMaterial,view:id=>layer.views.get(id).container,mesh:id=>layer.views.get(id).container.children[0].children[0]};
}

test('world canopy rule includes actual tree assets and excludes walls, mountains and oak furniture',()=>{
 for(const asset of['city/tree_single_A','city/trees_A_large','brumaluz-arboleda/objects/tree_ancient_oak','forest/objects/Tree_1_A_Color1'])assert.ok(WORLD_TREE_OCCLUDER.test(asset),asset);
 for(const asset of['city/wall_straight','city/wall_straight_gate','city/mountain_A_grass_trees','brumaluz-hamlet/objects/fence_oak_panel','brumaluz-hamlet/objects/chair_oak_carved'])assert.ok(!WORLD_TREE_OCCLUDER.test(asset),asset);
});

test('a batched canopy between the camera and player fades alone and restores its original material and batch',async()=>{
 const{layer,sourceMaterial,view,mesh}=await fixture();
 const originalMaterial=mesh('canopy').material;
 for(let i=0;i<12;i++)layer.fadeOccluders(eye,targets,.05,WORLD_TREE_OCCLUDER);
 assert.ok(mesh('canopy').material.opacity<.25,'The player can be seen through the near canopy');
 assert.equal(mesh('canopy').material.transparent,true);assert.equal(sourceMaterial.opacity,1,'Shared source material remains opaque');
 assert.notEqual(mesh('canopy').material,originalMaterial);assert.equal(view('canopy').visible,true);
 for(const[batch,index]of view('canopy').userData.batched)assert.equal(batch.getVisibleAt(index),false,'The opaque batched copy does not cover the faded tree');
 for(const id of['behind','side','wall','mountain','hidden'])assert.equal(mesh(id).material.opacity,1,`${id} is not a near canopy occluder`);
 for(let i=0;i<15;i++)layer.fadeOccluders(eye,[],.05,WORLD_TREE_OCCLUDER);
 assert.equal(mesh('canopy').material,originalMaterial);assert.equal(view('canopy').parent,null);
 for(const[batch,index]of view('canopy').userData.batched)assert.equal(batch.getVisibleAt(index),true,'The original batch is restored after the view clears');
});

test('culling a faded tree cannot resurrect its opaque batch, and ray work remains throttled',async()=>{
 const{layer,view,mesh}=await fixture();let rays=0;
 const canopy=mesh('canopy'),raycast=canopy.raycast;canopy.raycast=function(...args){rays++;return raycast.apply(this,args);};
 layer.fadeOccluders(eye,targets,.05,WORLD_TREE_OCCLUDER);const first=rays;assert.ok(first>0);
 layer.fadeOccluders(eye,targets,.01,WORLD_TREE_OCCLUDER);layer.fadeOccluders(eye,targets,.01,WORLD_TREE_OCCLUDER);
 assert.equal(rays,first,'The same scene is not raycast every animation frame');
 layer.cull(new THREE.Vector3(500,0,500),1,1);
 for(let i=0;i<15;i++)layer.fadeOccluders(eye,targets,.05,WORLD_TREE_OCCLUDER);
 assert.equal(rays,first,'Hidden chunks are excluded from candidate ray work');
 for(const[batch,index]of view('canopy').userData.batched)assert.equal(batch.getVisibleAt(index),false,'Restoring a faded tree in a culled chunk keeps it hidden');
 assert.equal(view('canopy').parent,null);
 layer.cull(new THREE.Vector3(),40,40);
 for(const[batch,index]of view('canopy').userData.batched)assert.equal(batch.getVisibleAt(index),true,'Returning to the chunk restores the normal opaque tree');
});
