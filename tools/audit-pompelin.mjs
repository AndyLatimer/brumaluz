// Audit the published continent against its authored geography and real collision shapes.
// This deliberately uses the game collision implementation, rather than a distance-to-object proxy.
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';
import {assetBoxes} from './asset-bounds.mjs';

const compiled=await build({stdin:{contents:"export * from './src/data/maps';export * from './src/world/map/terrain';export * from './src/world/map/collision';export {overworldTemplate} from './src/dev/mapEditor/overworld';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const code=Buffer.from(compiled.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const map=JSON.parse(await fs.readFile('src/data/world/maps/pompelin.json','utf8'));
const original=api.overworldTemplate();
const field=new api.TerrainField(api.decodeTerrain(map.terrain)),base=api.decodeTerrain(original.terrain);
const errors=[],warn=[],checks={};
const fail=(message)=>errors.push(message);
api.validateMap(map);
const visibleLayers=new Set(map.layers.filter(layer=>layer.visible).map(layer=>layer.id));
const objects=map.objects.filter(object=>!object.hidden&&visibleLayers.has(object.layer));
const boxes=await assetBoxes({footprint:true,only:new Set(objects.filter(object=>object.collision!=='none').map(object=>object.asset))});
const collision=api.buildCollision(map,field,boxes);
const originalMountains=original.objects.filter(object=>/^city\/mountain_/.test(object.asset));
let maxMountainSlope=0,maxMountainRaise=0;
for(const originalObject of originalMountains){
 const object=objects.find(object=>object.id===originalObject.id);
 if(!object){fail(`Missing original mountain ${originalObject.id}`);continue;}
 if(object.asset!==originalObject.asset||object.rotation.some((v,i)=>Math.abs(v-originalObject.rotation[i])>.001)||object.scale.some((v,i)=>Math.abs(v-originalObject.scale[i])>.001)||Math.hypot(object.position[0]-originalObject.position[0],object.position[2]-originalObject.position[2])>.001)fail(`Original mountain moved or rescaled: ${object.id}`);
 const box=boxes.get(object.asset),heights=[];
 const c=Math.cos(object.rotation[1]),s=Math.sin(object.rotation[1]);
 for(let j=0;j<=4;j++)for(let i=0;i<=4;i++){
  const lx=(box.min.x+(box.max.x-box.min.x)*i/4)*object.scale[0],lz=(box.min.z+(box.max.z-box.min.z)*j/4)*object.scale[2];
  heights.push(field.heightAt(object.position[0]+lx*c+lz*s,object.position[2]-lx*s+lz*c));
 }
 const slope=Math.max(...heights)-Math.min(...heights);maxMountainSlope=Math.max(maxMountainSlope,slope);
 maxMountainRaise=Math.max(maxMountainRaise,Math.abs(object.position[1]-originalObject.position[1]));
 if(slope>.8)fail(`${object.id} has ${slope.toFixed(2)} m of substrate variation under its rigid mountain mesh`);
 const ground=field.heightAt(object.position[0],object.position[2]);
 if(Math.abs(object.position[1]-ground)>.15)fail(`${object.id} is detached from terrain by ${(object.position[1]-ground).toFixed(2)} m`);
}
checks.originalMountains={count:originalMountains.length,maxFootprintRise:+maxMountainSlope.toFixed(3),maxRaiseFromOriginal:+maxMountainRaise.toFixed(3)};
let waterVertices=0,dryOriginalWater=0,raisedOriginalBanks=0,maxOriginalBankRaise=0;
if(base.columns!==field.columns||base.rows!==field.rows||base.cell!==field.cell)fail('Continent terrain dimensions changed');
else for(let i=0;i<base.heights.length;i++)if(base.heights[i]<=-1){
 waterVertices++;
 if(field.data.heights[i]>=map.settings.water.level-.02)dryOriginalWater++;
}else{
 const x=i%base.columns,z=Math.floor(i/base.columns);
 const neighbors=[x>0?i-1:-1,x<base.columns-1?i+1:-1,z>0?i-base.columns:-1,z<base.rows-1?i+base.columns:-1];
 if(neighbors.some(index=>index>=0&&base.heights[index]<=-1)){
  const rise=field.data.heights[i]-base.heights[i];maxOriginalBankRaise=Math.max(maxOriginalBankRaise,rise);
  if(rise>1.5)raisedOriginalBanks++;
 }
}
if(dryOriginalWater)fail(`${dryOriginalWater} original sea/river vertices became dry land`);
if(raisedOriginalBanks)fail(`${raisedOriginalBanks} immediate coastline/river-bank vertices raised over 1.5 m, creating abrupt water edges`);
checks.originalSeaAndRiver={vertices:waterVertices,filled:dryOriginalWater,raisedBanks:raisedOriginalBanks,maxBankRaise:+maxOriginalBankRaise.toFixed(3)};
for(const marker of original.markers.filter(marker=>['rusty_hearth','lunargenta','arboleda','cumbres_cobre','gremio'].includes(marker.id))){
 const next=map.markers.find(next=>next.id===marker.id);
 if(!next||Math.hypot(next.position[0]-marker.position[0],next.position[2]-marker.position[2])>.001)fail(`Authored region moved: ${marker.id}`);
}
const villageObjects=original.objects.filter(object=>/^detail_(rusty_hearth|lunargenta)_/.test(object.id)||(/^world_/.test(object.id)&&object.layer==='edificios'&&Math.hypot(object.position[0]+120,object.position[2]+90)>145));
for(const previous of villageObjects){
 const object=objects.find(object=>object.id===previous.id);
 if(!object||object.asset!==previous.asset||Math.hypot(object.position[0]-previous.position[0],object.position[2]-previous.position[2])>.001||object.scale.some((v,i)=>Math.abs(v-previous.scale[i])>.001))fail(`Authored settlement object changed: ${previous.id}`);
}
checks.preservedSettlementObjects=villageObjects.length;
const catalog=JSON.parse(await fs.readFile('src/data/generated/rpg-catalog.json','utf8'));
const wilderness=JSON.parse(await fs.readFile('src/data/generated/wilderness.json','utf8'));
const sites=[...Object.values(catalog.nodes).filter(site=>site.location==='pompelin').map(site=>({...site,kind:'resource'})),...wilderness.spawns.filter(site=>site.location==='pompelin').map(site=>({...site,kind:'enemy'}))];
for(const site of sites){
 const point=new THREE.Vector3(site.x,collision.groundY(site.x,site.z),site.z),out=collision.collide(point,point);
 if(collision.waterAt(site.x,site.z))fail(`${site.kind} ${site.id} is in water`);
 if(Math.hypot(out.x-point.x,out.z-point.z)>.06)fail(`${site.kind} ${site.id} overlaps solid scenery (${point.distanceTo(out).toFixed(2)} m displacement)`);
 if(!field.contains(site.x,site.z,1))fail(`${site.kind} ${site.id} lies outside the playable terrain`);
}
checks.gameplaySites={resources:sites.filter(site=>site.kind==='resource').length,enemies:sites.filter(site=>site.kind==='enemy').length};
const gateReport=[];
for(const gate of map.markers.filter(marker=>marker.id.startsWith('entrada_brumaluz_'))){
 const arrival=map.markers.find(marker=>marker.id===gate.id.replace('entrada_','desde_'));
 if(!arrival){fail(`Missing outside arrival for ${gate.id}`);continue;}
 if(gate.trigger!=='walk')fail(`${gate.id} still requires manual activation`);
 const start=new THREE.Vector3(arrival.position[0],collision.groundY(arrival.position[0],arrival.position[2]),arrival.position[2]);
 if(collision.waterAt(start.x,start.z))fail(`${arrival.id} is underwater`);
 const center=new THREE.Vector3(gate.position[0],0,gate.position[2]),delta=center.clone().sub(start).setY(0),distance=delta.length();delta.normalize();
 let point=start.clone(),maxDeflection=0;
 // A proximity trigger should be reachable from the arrival along the visible entrance path.
 const steps=Math.ceil(Math.max(0,distance-gate.radius+.1)/.2);
 for(let i=1;i<=steps;i++){
  const desired=start.clone().addScaledVector(delta,Math.min(i*.2,distance));desired.y=collision.groundY(desired.x,desired.z);
  const next=collision.collide(point,desired);maxDeflection=Math.max(maxDeflection,Math.hypot(next.x-desired.x,next.z-desired.z));next.y=collision.groundY(next.x,next.z);point=next;
 }
 const remaining=Math.hypot(point.x-center.x,point.z-center.z);
 if(remaining>gate.radius+.2||maxDeflection>.2)fail(`${gate.id} approach blocked: ${remaining.toFixed(2)} m remaining, ${maxDeflection.toFixed(2)} m deviation`);
 gateReport.push({id:gate.id,distance:+distance.toFixed(2),remaining:+remaining.toFixed(2),maxDeflection:+maxDeflection.toFixed(3)});
}
if(gateReport.length!==5)fail(`Expected five capital entrance routes, found ${gateReport.length}`);
checks.capitalEntrances=gateReport;
checks.bridges=[];
const bridgeRails=new Set();
for(const bridge of objects.filter(o=>o.asset==='medieval-builder/objects/bridge'&&o.walkable===true)){
 const c=Math.cos(bridge.rotation[1]),s=Math.sin(bridge.rotation[1]),length=bridge.scale[0],point=(along)=>new THREE.Vector3(bridge.position[0]+along*c,0,bridge.position[2]-along*s);
 let maxDeflection=0,wetSteps=0;
 for(const direction of[-1,1]){
  let from=point((-length-5)*direction);from.y=collision.groundY(from.x,from.z);
  for(let along=-length-4.8;along<=length+5;along+=.2){
   const desired=point(along*direction);desired.y=from.y;const next=collision.collide(from,desired);
   maxDeflection=Math.max(maxDeflection,Math.hypot(next.x-desired.x,next.z-desired.z));
   if(collision.waterAt(next.x,next.z))wetSteps++;
   next.y=collision.platformY(next.x,next.z)??collision.groundY(next.x,next.z);from=next;
  }
 }
 if(maxDeflection>.06||wetSteps)fail(`Bridge ${bridge.id} has blocked/wet crossing: ${maxDeflection.toFixed(3)} m, ${wetSteps} wet steps`);
 const middle=point(0);middle.y=collision.platformY(middle.x,middle.z)+.3;
 let maxSideTravel=0;
 for(const direction of[-1,1]){const target=middle.clone();target.x+=s*direction*4;target.z+=c*direction*4;const out=collision.collide(middle,target);maxSideTravel=Math.max(maxSideTravel,Math.abs((out.x-middle.x)*s+(out.z-middle.z)*c));}
 if(maxSideTravel>1.5)fail(`Bridge ${bridge.id} has a railing that can be crossed below its visible top`);
 checks.bridges.push({id:bridge.id,maxDeflection:+maxDeflection.toFixed(3),wetSteps,maxSideTravel:+maxSideTravel.toFixed(3)});
 for(const rail of objects.filter(o=>o.name==='Puente del camino · barandilla')){
  const dx=rail.position[0]-bridge.position[0],dz=rail.position[2]-bridge.position[2],along=dx*c-dz*s,side=dx*s+dz*c;
  const center=point(along),deck=collision.platformY(center.x,center.z);
  if(deck===null||Math.abs(rail.position[1]-(deck+.12))>.025||Math.abs(Math.abs(side)-1.95)>.01)fail(`Bridge railing ${rail.id} is not anchored to the visible curb`);
  else bridgeRails.add(rail.id);
 }
}
let detached=0;
for(const object of objects.filter(object=>!object.conform&&/^paisaje_/.test(object.id)&&object.layer!=='paisaje_capital'&&!/wall|tower|gate/i.test(object.asset)&&!bridgeRails.has(object.id)&&!(object.walkable===true&&object.asset==='medieval-builder/objects/bridge'))){
 const delta=object.position[1]-field.heightAt(object.position[0],object.position[2]);
 if(Math.abs(delta)>.15){detached++;if(detached<12)fail(`Landscape prop ${object.id} is detached from ground by ${delta.toFixed(2)} m`);}
}
checks.detachedLandscapeProps=detached;
if(detached>=12)fail(`${detached} landscape props have incorrect ground anchoring`);
const report={map:'pompelin',objects:objects.length,checks,errors,warnings:warn};
await fs.mkdir('art/pompelin-review',{recursive:true});
await fs.writeFile('art/pompelin-review/geography-collision-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
