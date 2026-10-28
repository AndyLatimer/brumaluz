import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {build} from 'esbuild';
import * as THREE from 'three';
import {mapBlockers} from '../tools/rpg-map-blockers.mjs';
const bundle=await build({stdin:{contents:"export * from './src/data/maps';export * from './src/world/map/terrain';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
// Resolve Three from this project, including when the compiled source is a data URL.
const code=Buffer.from(bundle.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const map=JSON.parse(fs.readFileSync('src/data/world/maps/pompelin.json','utf8'));
const city=JSON.parse(fs.readFileSync('src/data/world/maps/brumaluz.json','utf8'));
const field=api.decodeTerrain(map.terrain);
test('published Pompelin has gentle relief, woodland and flowers without replacing its geography',()=>{
 api.validateMap(map);let min=Infinity,max=-Infinity,water=0;for(const h of field.heights){min=Math.min(min,h);max=Math.max(max,h);if(h<map.settings.water.level)water++;}
 assert.ok(max>8&&max<22,'Terrain stays at the scale of gentle hills, beneath the authored mountain meshes');assert.ok(min<-1);assert.ok(water>1000);
 assert.ok(!field.paint.includes(10),'No unrelated snowy peaks replace the original region');
 assert.ok(map.objects.filter(o=>o.layer==='paisaje_bosque').length>1000);
 assert.ok(map.objects.filter(o=>o.layer==='paisaje_prados').length>1000);
 assert.ok(map.objects.some(o=>o.layer==='paisaje_descanso'&&o.asset==='builtin/bench'));
 for(const object of map.objects.filter(o=>o.id.startsWith('world_')||o.id.startsWith('detail_'))){
  const [x,y,z]=object.position,h=api.sampleHeight(field,(x-field.origin[0])/field.cell,(z-field.origin[1])/field.cell);
  assert.ok(Math.abs(y-h)<.15,`${object.id} stays grounded after rebuilding the landscape`);
 }
 assert.deepEqual(map.terrain,JSON.parse(fs.readFileSync('src/data/maps/pompelin.json','utf8')).terrain,'Editor and game use the same terrain');
});
test('the exterior uses the real capital layout and every gate still matches its travel endpoint',()=>{
 const gates=map.objects.filter(o=>o.layer==='paisaje_capital'&&o.asset==='city/wall_straight_gate');assert.equal(gates.length,5);
 assert.ok(gates.every(gate=>gate.gateClosed===true),'The five exterior doors are visually and physically closed');
 const scale=50/172;
 for(const original of city.objects.filter(o=>o.asset==='city/wall_straight_gate')){
  const counterpart=gates.find(o=>o.id===`paisaje_capital_${original.id}`);assert.ok(counterpart);
  assert.ok(Math.abs(counterpart.position[0]-(-120+original.position[0]*scale))<.001);
  assert.ok(Math.abs(counterpart.position[2]-(-90+original.position[2]*scale))<.001);
  assert.ok(map.markers.some(m=>m.id.startsWith('entrada_brumaluz_')&&Math.hypot(m.position[0]-counterpart.position[0],m.position[2]-counterpart.position[2])<.01));
 }
 assert.ok(map.objects.filter(o=>o.layer==='paisaje_capital').every(o=>/city\/(wall_|tower_)/.test(o.asset)),'Only the walls, gates and towers represent Brumaluz outside');
 assert.ok(map.markers.filter(m=>m.id.startsWith('entrada_brumaluz_')).every(m=>m.trigger==='walk'),'All five gates enter by proximity');
 for(const marker of map.markers.filter(m=>m.type==='arrival'&&m.id.startsWith('desde_brumaluz_'))){
  assert.ok(api.sampleHeight(field,(marker.position[0]-field.origin[0])/field.cell,(marker.position[2]-field.origin[1])/field.cell)>0);
  assert.ok(!map.objects.some(o=>o.layer==='paisaje_bosque'&&Math.hypot(o.position[0]-marker.position[0],o.position[2]-marker.position[2])<5));
 }
});
test('terrain patches preserve all faces and visual-only edits while culling distant geometry',()=>{
 const surface=new api.TerrainSurface(new api.TerrainField(field),true);
 const patches=surface.mesh.children;assert.ok(patches.length>20&&patches.length<200);
 assert.equal(patches.reduce((n,p)=>n+p.geometry.index.count,0),surface.mesh.geometry.index.count);
 const point=surface.mesh.geometry.getAttribute('position');point.setY(0,-7.25);surface.refreshRenderedChunks();
 assert.equal(patches[0].geometry.getAttribute('position').getY(0),-7.25,'Tile sinking reaches the drawn patches');
 const camera=new THREE.PerspectiveCamera(50,16/9,.1,120);camera.position.set(-56,18,-60);camera.lookAt(-70,2,-90);camera.updateMatrixWorld();
 surface.cull(new THREE.Vector3(-56,2,-90),160);
 surface.mesh.updateMatrixWorld(true);
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const visible=patches.filter(p=>p.visible&&frustum.intersectsObject(p));
 assert.ok(patches.every(p=>p.userData.mapChunk),'Minimap captures can reveal every terrain patch');
 const triangles=visible.reduce((n,p)=>n+p.geometry.index.count/3,0),total=surface.mesh.geometry.index.count/3;
 assert.ok(visible.length>0);assert.ok(triangles<total*.15,`Nearby view submits ${triangles}/${total} triangles`);surface.dispose();
});

test('authoritative sight keeps hill obstacles and the bridge passage matches client geometry',()=>{
 const fixture=api.newMap('pompelin','Height regression',{width:20,depth:20,cell:1});
 const terrain=api.decodeTerrain(fixture.terrain);terrain.heights.fill(20);fixture.terrain=api.encodeTerrain(terrain);
 const object={id:'tree',asset:'test/tree',layer:fixture.layers[0].id,position:[0,20,0],scale:[1,1,1],rotation:[0,0,0],collision:'auto'};
 fixture.objects=[object,{...object,id:'floating',position:[3,50,0]},{...object,id:'bridge',asset:'medieval-builder/objects/bridge',walkable:true,position:[5,20,0],scale:[18,1.5,8]}];
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,4,.5));
 const rows=mapBlockers(fixture,new Map([['test/tree',box],['medieval-builder/objects/bridge',box]]));
 assert.equal(rows.filter(b=>b.x===0).length,1,'A tree on a 20 m hill still obstructs sight');
 assert.equal(rows.filter(b=>b.x===3).length,0,'An elevated object overhead does not form an invisible wall');
 const bridge=rows.filter(b=>b.x===5);assert.equal(bridge.length,2);assert.ok(bridge.every(b=>b.minZ>0||b.maxZ<0),'The bridge center remains clear on the server too');
});
