import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import * as THREE from 'three';

const bundle=await build({stdin:{contents:"export * from './src/data/maps';export * from './src/world/map/terrain';export * from './src/world/map/grass';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const code=Buffer.from(bundle.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const {createTerrain,TerrainField,GrassField}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('grass patches cull the distant continent while preserving every nearby tuft and atlas visibility',()=>{
 const terrain=createTerrain(800,800,8,0,0,100),field=new TerrainField(terrain),grass=new GrassField();
 grass.rebuild(field,null);
 assert.ok(grass.root.children.length>100);
 const total=grass.count,focus=new THREE.Vector3(19,0,-13),matrix=new THREE.Matrix4(),position=new THREE.Vector3();
 assert.ok(total>100000);
 grass.update(1,focus,60);
 let visibleCount=0,nearbyCount=0;
 for(const patch of grass.root.children)for(const mesh of patch.children){
  if(mesh.name!=='grass_tufts')continue;
  if(patch.visible)visibleCount+=mesh.count;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
   if(Math.hypot(position.x-focus.x,position.z-focus.z)<60){nearbyCount++;assert.ok(patch.visible,'patch culling cannot remove a tuft inside the fade distance');}
  }
 }
 assert.ok(nearbyCount>1000);
 assert.ok(visibleCount<total*.1,`${visibleCount}/${total} tufts submitted near player`);
 const visibility=grass.root.children.map(patch=>patch.visible);
 const undo=grass.root.userData.revealAll();
 assert.ok(grass.root.children.every(patch=>patch.visible));
 undo();assert.deepEqual(grass.root.children.map(patch=>patch.visible),visibility);
 grass.update(2);assert.ok(grass.root.children.every(patch=>patch.visible),'editor without focus draws every patch');
 grass.dispose();assert.equal(grass.root.children.length,0);
});

test('tufts and both flower materials share smooth distance fading, with rebuilding disposing old instances',()=>{
 const terrain=createTerrain(40,40,2,0,0,160),field=new TerrainField(terrain),grass=new GrassField();
 grass.rebuild(field,null);
 const materials=new Set(),instances=[];
 grass.root.traverse(part=>{if(part.isInstancedMesh){materials.add(part.material);instances.push(part);}});
 assert.equal(materials.size,3,'blades, flower heads and stems fade together');
 const shaders=[...materials].map(material=>{
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>'};
  material.onBeforeCompile(shader,null);
  assert.match(shader.vertexShader,/smoothstep\(grassRange.x, grassRange.y/);
  assert.match(shader.vertexShader,/transformed \*= grassVisibility/);
  return shader;
 });
 grass.update(1,new THREE.Vector3(20,0,10),50);
 for(const shader of shaders){assert.equal(shader.uniforms.grassRange.value.x,30);assert.equal(shader.uniforms.grassRange.value.y,50);assert.deepEqual(shader.uniforms.grassFocus.value.toArray(),[20,10]);}
 const undo=grass.root.userData.revealAll();assert.ok(shaders[0].uniforms.grassRange.value.x>1e6);undo();assert.equal(shaders[0].uniforms.grassRange.value.x,30);
 let disposed=0;for(const instance of instances)instance.addEventListener('dispose',()=>disposed++);
 const count=grass.count;grass.rebuild(field,null);assert.equal(disposed,instances.length);assert.equal(grass.count,count);
 grass.dispose();
});
