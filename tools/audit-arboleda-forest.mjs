// Read-only world audit: La Arboleda is a forest surrounding a future, separate city map.
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';
import {assetBoxes} from './asset-bounds.mjs';

const compiled=await build({stdin:{contents:"export * from './src/data/maps';export * from './src/world/map/terrain';export * from './src/world/map/collision';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const code=Buffer.from(compiled.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const map=api.validateMap(JSON.parse(await fs.readFile('src/data/world/maps/pompelin.json','utf8')));
const region={x:660,z:-225,rx:235,rz:185},arrival={x:625,z:-195,radius:15};
const inside=(x,z)=>((x-region.x)/region.rx)**2+((z-region.z)/region.rz)**2<=1;
const visible=new Set(map.layers.filter(layer=>layer.visible).map(layer=>layer.id));
const objects=map.objects.filter(object=>!object.hidden&&visible.has(object.layer));
const trees=objects.filter(object=>/(?:^|_)trees?(?:_|$)|^(?:pine|birch|oak)(?:_|$)/i.test(object.asset.split('/').at(-1)));
const forestTrees=trees.filter(object=>inside(object.position[0],object.position[2]));
const broadleaf=forestTrees.filter(object=>object.asset.startsWith('brumaluz-arboleda/objects/tree_')||/^forest\/objects\/Tree_[123]_/.test(object.asset));
const boxes=await assetBoxes({footprint:true,only:new Set(objects.filter(object=>object.collision!=='none').map(object=>object.asset))});
// Crown sizes use the full mesh extent, independent of the footprint used for solid collisions.
const crowns=await assetBoxes();
const canopy=trees.map(object=>{
 const box=crowns.get(object.asset);if(!box||box.isEmpty())return null;
 return{x:object.position[0],z:object.position[2],radius:Math.min(box.max.x-box.min.x,box.max.z-box.min.z)*Math.max(object.scale[0],object.scale[2])*.45};
}).filter(Boolean);
const field=new api.TerrainField(api.decodeTerrain(map.terrain)),collision=api.buildCollision(map,field,boxes);
const errors=[],checks={};
const fail=message=>errors.push(message);
const marker=map.markers.find(marker=>marker.id==='arboleda');
if(!marker||Math.hypot(marker.position[0]-region.x,marker.position[2]-region.z)>.001)fail('The authored Arboleda region has moved');
if(map.markers.some(marker=>marker.type==='portal'&&inside(marker.position[0],marker.position[2])))fail('A future city connection must remain a note or zone, not an active placeholder portal');
const buildings=objects.filter(object=>inside(object.position[0],object.position[2])&&/^city\/(?:castle|home_|tavern|church|market|blacksmith|barracks|windmill)|^brumaluz-arboleda\/objects\/(?:house_|laboratory_|pavilion_|tower_|greenhouse_)/.test(object.asset));
if(buildings.length)fail(`The future city belongs in its own map; ${buildings.length} building models appeared in the forest exterior`);
checks.composition={trees:forestTrees.length,broadleaf:broadleaf.length,broadleafShare:+(broadleaf.length/Math.max(1,forestTrees.length)).toFixed(3),cityBuildings:buildings.length};
if(broadleaf.length<=forestTrees.length*.5)fail('The elven forest canopy must be predominantly broadleaf trees');
let sampled=0,covered=0,reserveBlocked=0;
for(let z=region.z-region.rz;z<=region.z+region.rz;z+=5)for(let x=region.x-region.rx;x<=region.x+region.rx;x+=5){
 if(!inside(x,z)||collision.waterAt(x,z)||Math.hypot(x-arrival.x,z-arrival.z)<arrival.radius)continue;
 const i=Math.round(field.gridX(x)),j=Math.round(field.gridZ(z));
 if(field.data.paint[j*field.columns+i]===4)continue; // the existing walking corridors remain open
 sampled++;if(canopy.some(crown=>Math.hypot(x-crown.x,z-crown.z)<=crown.radius))covered++;
}
const coverage=covered/Math.max(1,sampled);checks.canopy={spacing:5,dryForestArea:sampled*25,coveredArea:covered*25,coverage:+coverage.toFixed(3)};
if(coverage<.6)fail(`The forest canopy covers only ${(coverage*100).toFixed(1)}% of usable forest ground; expected at least 60%`);
for(let dz=-arrival.radius;dz<=arrival.radius;dz+=1.5)for(let dx=-arrival.radius;dx<=arrival.radius;dx+=1.5){
 if(Math.hypot(dx,dz)>arrival.radius)continue;
 const x=arrival.x+dx,z=arrival.z+dz,p=new THREE.Vector3(x,collision.groundY(x,z),z),out=collision.collide(p,p.clone());
 if(collision.waterAt(x,z)||Math.hypot(out.x-x,out.z-z)>.06)reserveBlocked++;
}
checks.futureArrival={...arrival,blockedSamples:reserveBlocked};
if(reserveBlocked)fail(`The reserved future arrival glade has ${reserveBlocked} obstructed or wet ground samples`);
let from=new THREE.Vector3(600,collision.groundY(600,-195),-195),pathDeflection=0;
for(let x=600.2;x<=arrival.x+.001;x+=.2){const target=new THREE.Vector3(x,from.y,-195),next=collision.collide(from,target);pathDeflection=Math.max(pathDeflection,Math.hypot(next.x-x,next.z+195));next.y=collision.groundY(next.x,next.z);from=next;}
checks.entrancePath={from:[600,-195],to:[arrival.x,arrival.z],maxDeflection:+pathDeflection.toFixed(3)};
if(pathDeflection>.1)fail('The existing road does not have a clear walking approach to the future arrival glade');
const catalog=JSON.parse(await fs.readFile('src/data/generated/rpg-catalog.json','utf8'));
const wilderness=JSON.parse(await fs.readFile('src/data/generated/wilderness.json','utf8'));
const sites=[...Object.values(catalog.nodes).filter(site=>site.location==='pompelin'&&inside(site.x,site.z)).map(site=>({...site,kind:'resource'})),...wilderness.spawns.filter(site=>site.location==='pompelin'&&inside(site.x,site.z)).map(site=>({...site,kind:'enemy'}))];
for(const site of sites){const p=new THREE.Vector3(site.x,collision.groundY(site.x,site.z),site.z),out=collision.collide(p,p.clone());if(collision.waterAt(site.x,site.z)||Math.hypot(out.x-site.x,out.z-site.z)>.06)fail(`${site.kind} ${site.id} is obstructed by the forest or water`);}
checks.gameplaySites={resources:sites.filter(site=>site.kind==='resource').length,enemies:sites.filter(site=>site.kind==='enemy').length};
const report={region,checks,errors};
await fs.mkdir('art/pompelin-review',{recursive:true});await fs.writeFile('art/pompelin-review/arboleda-forest-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
