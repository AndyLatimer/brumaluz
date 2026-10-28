import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import * as THREE from 'three';

const bundle=await build({stdin:{contents:"export * from './src/data/maps';export * from './src/world/map/terrain';export * from './src/world/map/collision';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const code=Buffer.from(bundle.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const asset='medieval-builder/objects/bridge';
const box=new THREE.Box3(new THREE.Vector3(-1,-.5,-.371916),new THREE.Vector3(1,.276889,.371916));

function crossing(yaw=0,walkable=true){
 const map=api.newMap('bridge_crossing','Bridge crossing',{width:90,depth:90,cell:.5});
 map.settings.water={enabled:true,level:-1,color:'#427f9f',opacity:.9};
 const data=api.decodeTerrain(map.terrain),cos=Math.cos(yaw),sin=Math.sin(yaw);
 for(let j=0;j<data.rows;j++)for(let i=0;i<data.columns;i++){
  const x=data.origin[0]+i*data.cell,z=data.origin[1]+j*data.cell;
  const along=Math.abs(x*cos-z*sin);
  data.heights[j*data.columns+i]=along<10?-2.2:along<12?-2.2+(along-10)/2*2.85:.65;
 }
 const bridge={id:'bridge',asset,layer:map.layers[0].id,position:[0,.8,0],rotation:[0,yaw,0],scale:[18,1.5,8],collision:'auto',walkable};
 map.objects.push(bridge);
 const field=new api.TerrainField(data),collision=api.buildCollision(map,field,new Map([[asset,box]]));
 const point=(along,side=0)=>new THREE.Vector3(along*cos+side*sin,0,-along*sin+side*cos);
 return{map,field,collision,point,bridge};
}

test('an explicitly walkable stone bridge supports both travel directions above a deep channel, including rotated placement',()=>{
 for(const yaw of [0,-1.004]){
  const{collision,point}=crossing(yaw);
  assert.equal(collision.platforms.length,5);
  assert.equal(collision.platformY(0,0),.8+.200617*1.5,'feet follow the deck, below the parapets');
  assert.equal(collision.waterAt(0,0),null,'the bridge deck stays dry instead of triggering swimming');
  const beside=point(0,5);assert.deepEqual(collision.waterAt(beside.x,beside.z),{surface:-1,deep:true},'the river remains deep beside the bridge');
  for(const direction of [-1,1]){
   let from=point(-22*direction);from.y=.65;
   for(let along=-21.8;along<=22;along+=.2){
    const target=point(along*direction);target.y=from.y;
    const next=collision.collide(from,target);
    assert.ok(Math.hypot(next.x-target.x,next.z-target.z)<1e-5,`unblocked crossing at ${along}, yaw ${yaw}`);
    const platform=collision.platformY(next.x,next.z);
    next.y=platform??collision.groundY(next.x,next.z);
    assert.ok(next.y>.64,'the character cannot fall through to the river floor');
    assert.equal(collision.waterAt(next.x,next.z),null,'the crossing never forces swimming');
    from=next;
   }
  }
 }
});

test('the visible bridge parapets stop sideways motion while the entrance is clear',()=>{
 const{collision,point}=crossing();
 const from=point(0);from.y=collision.platformY(0,0);
 const target=point(0,4);target.y=from.y;
 const result=collision.collide(from,target);
 assert.ok(result.z<1.05&&result.z>.8,`side parapet stops the body at ${result.z}`);
 assert.equal(collision.shapes.length,10,'only the two parapets along five arch segments collide');
});

test('bridge support is opt-in and does not raise the automatic platform limit for other objects',()=>{
 const{collision}=crossing(0,false);
 assert.equal(collision.platformY(0,0),null);
 assert.deepEqual(collision.waterAt(0,0),{surface:-1,deep:true});
 const{map,field,bridge}=crossing();
 map.objects=[{...bridge,asset:'test/high_crate',walkable:true}];
 const high=api.buildCollision(map,field,new Map([['test/high_crate',box]]));
 assert.equal(high.platformY(0,0),null,'a high crate does not become a bridge');
});

test('a long movement request cannot resume beyond a thin wall after an earlier substep was blocked',()=>{
 const map=api.newMap('thin_wall','Thin wall',{width:30,depth:30,cell:1});
 map.colliders.push({id:'wall',layer:map.layers[0].id,shape:'box',position:[0,0,0],rotationY:0,size:[.3,2,20],walkable:false});
 const collision=api.buildCollision(map,new api.TerrainField(api.decodeTerrain(map.terrain)),new Map());
 const straight=collision.collide(new THREE.Vector3(-4,0,0),new THREE.Vector3(4,0,0));
 assert.ok(straight.x<=-.599,`the wall remains solid at x=${straight.x}`);
 const diagonal=collision.collide(new THREE.Vector3(-4,0,-2),new THREE.Vector3(4,0,2));
 assert.ok(diagonal.x<=-.599);
 assert.ok(diagonal.z>1.9,'movement can still slide along the wall');
});

test('an oak railing keeps its full solid span instead of being mistaken for an oak tree trunk',()=>{
 const{field,bridge}=crossing();
 const fence={...bridge,asset:'brumaluz-hamlet/objects/fence_oak_panel',walkable:false,position:[0,1,0],scale:[1.5,.85,1]};
 const fenceBox=new THREE.Box3(new THREE.Vector3(-1,0,-.125),new THREE.Vector3(1,1,.125));
 const rail=api.objectCollision(fence,fenceBox,field);
 assert.equal(rail.shapes.length,1);assert.equal(rail.shapes[0].hx,1.5);assert.equal(rail.shapes[0].hz,.125);
 const tree=api.objectCollision({...fence,asset:'brumaluz-arboleda/objects/tree_ancient_oak'},fenceBox,field);
 assert.equal(tree.shapes[0].hx,undefined,'Actual trees retain their trunk collider');
});
