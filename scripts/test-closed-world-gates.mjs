import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import * as THREE from 'three';

const bundle=await build({stdin:{contents:"export * from './src/data/maps';export * from './src/world/map/terrain';export * from './src/world/map/collision';export * from './src/world/map/objects';export * from './src/world/map/materials';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const code=Buffer.from(bundle.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const asset='city/wall_straight_gate';
const box=new THREE.Box3(new THREE.Vector3(-1,-.05,-.4),new THREE.Vector3(1,1.41,.5));
const gate=(id,gateClosed=false)=>({id,asset,layer:'edificios',position:[0,0,0],rotation:[0,0,0],scale:[2.5,4.35,1.5],collision:'auto',gateClosed});

test('closed gate state survives map validation and rejects malformed persisted values',()=>{
 const map=api.newMap('gates','Gates');
 map.objects=[{...gate('closed',true),layer:map.layers[0].id}];
 assert.equal(api.validateMap(map).objects[0].gateClosed,true);
 map.objects[0].gateClosed=false;assert.equal(api.validateMap(map).objects[0].gateClosed,false);
 map.objects[0].gateClosed='true';assert.throws(()=>api.validateMap(map),/gateClosed/);
});

test('closing one gate changes its leaves without modifying the shared model or adjacent open gates',async()=>{
 const template=new THREE.Group();
 for(const side of ['left','right']){
  const leaf=new THREE.Mesh(new THREE.BoxGeometry(.6,1,.1),new THREE.MeshStandardMaterial());
  leaf.name=`wall_straight_gate_door_${side}`;leaf.rotation.y=Math.PI/2;template.add(leaf);
 }
 const provider={template:async()=>template,collisionBox:async()=>box};
 const layer=new api.ObjectLayer(provider,new api.MaterialVariants()),layers=[{id:'edificios',name:'Walls',visible:true,locked:false}];
 const closed=gate('closed',true),open={...gate('open'),position:[8,0,0]};
 layer.sync([closed,open],layers);await layer.ready();
 const leaf=(id)=>layer.views.get(id).container.getObjectByName('wall_straight_gate_door_left');
 assert.equal(leaf('closed').rotation.y,0);assert.equal(leaf('open').rotation.y,Math.PI/2);
 assert.equal(template.getObjectByName('wall_straight_gate_door_left').rotation.y,Math.PI/2);
 const previous=layer.views.get('closed');
 layer.sync([{...closed,gateClosed:false},open],layers);await layer.ready();
 assert.notEqual(layer.views.get('closed'),previous,'The editor updates the model when the state is toggled');
 assert.equal(leaf('closed').rotation.y,Math.PI/2);
 layer.sync([closed,open],layers);await layer.ready();
 layer.root.updateMatrixWorld(true);const expected=leaf('closed').matrixWorld.clone();
 layer.batch();const [batch,index]=layer.views.get('closed').container.userData.batched[0],actual=new THREE.Matrix4();batch.getMatrixAt(index,actual);
 assert.ok(actual.elements.every((value,i)=>Math.abs(value-expected.elements[i])<1e-6),'Static batching preserves the closed leaf transform within GPU float precision');
});

test('closed gates block physical passage but every proximity approach reaches the trigger before the leaves',()=>{
 for(const yaw of[0,Math.PI/2,Math.PI/6])for(const closed of[false,true]){
  const map=api.newMap('gate_collision','Gate collision',{width:60,depth:60,cell:1});
  const object={...gate('gate',closed),layer:map.layers[0].id,rotation:[0,yaw,0]};map.objects=[object];
  map.markers.push({id:'entry',type:'portal',name:'Brumaluz',layer:map.layers[0].id,position:[0,0,0],rotationY:0,radius:4,trigger:'walk',target:{map:'brumaluz'}});
  const collision=api.buildCollision(map,new api.TerrainField(api.decodeTerrain(map.terrain)),new Map([[asset,box]]));
  const point=d=>new THREE.Vector3(Math.sin(yaw)*d,0,Math.cos(yaw)*d);
  let current=point(14);
  for(let d=13.8;d>=3.8;d-=.2){const desired=point(d),next=collision.collide(current,desired);assert.ok(next.distanceTo(desired)<.001,'The visible path reaches the proximity trigger without colliding');current=next;}
  assert.ok(Math.hypot(current.x,current.z)<=4.01);
  const through=collision.collide(point(14),point(-14));
  if(closed)assert.ok(through.distanceTo(point(-14))>10,'Closed leaves remain physically solid');
  else assert.ok(through.distanceTo(point(-14))<.001,'The interior gate stays open and traversable');
 }
});
