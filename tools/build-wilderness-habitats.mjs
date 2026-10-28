// Bake small, connected navigation habitats from the same collision/water used by the game.
// Does not regenerate resources, scenery, equipment or other maps.
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';
import {assetBoxes} from './asset-bounds.mjs';

const bundle=await build({stdin:{contents:"export * from './src/data/maps';export * from './src/world/map/terrain';export * from './src/world/map/collision';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const code=Buffer.from(bundle.outputFiles[0].contents).toString().replaceAll('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const map=JSON.parse(await fs.readFile('src/data/world/maps/pompelin.json','utf8'));
const data=JSON.parse(await fs.readFile('src/data/wilderness.json','utf8'));
const layers=new Set(map.layers.filter(l=>l.visible).map(l=>l.id));
const boxes=await assetBoxes({footprint:true,only:new Set(map.objects.filter(o=>!o.hidden&&layers.has(o.layer)&&o.collision!=='none').map(o=>o.asset))});
const field=new api.TerrainField(api.decodeTerrain(map.terrain)),collision=api.buildCollision(map,field,boxes);
const entrances=map.markers.filter(m=>['spawn','portal','arrival'].includes(m.type));
const settlements=map.markers.filter(m=>m.type==='zone'&&map.objects.some(o=>!o.hidden&&layers.has(o.layer)&&/^city\/(castle|home_[AB]|tavern|church|market|blacksmith|windmill)$/.test(o.asset)&&Math.hypot(o.position[0]-m.position[0],o.position[2]-m.position[2])<60));
const reserved=map.markers.filter(m=>m.id==='reserva_ciudad_arboleda');
const from=new THREE.Vector3(),to=new THREE.Vector3(),probe=new THREE.Vector3();
function pointClear(x,z){
 if(!field.contains(x,z,2)||collision.waterAt(x,z)!==null)return false;
 if(entrances.some(m=>Math.hypot(x-m.position[0],z-m.position[2])<Math.max(14,m.radius+5)))return false;
 if(settlements.some(m=>Math.hypot(x-m.position[0],z-m.position[2])<Math.max(25,m.radius)+8))return false;
 if(reserved.some(m=>Math.hypot(x-m.position[0],z-m.position[2])<m.radius+5))return false;
 probe.set(x,collision.groundY(x,z),z);const out=collision.collide(probe,probe);
 return Math.hypot(out.x-x,out.z-z)<.015;
}
function segmentClear(a,b){
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.35));
 from.set(a.x,collision.groundY(a.x,a.z),a.z);
 for(let i=1;i<=n;i++){
  const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;
  if(!pointClear(x,z))return false;
  to.set(x,collision.groundY(x,z),z);const out=collision.collide(from,to);
  if(Math.hypot(out.x-x,out.z-z)>.015||Math.abs(to.y-from.y)>.35)return false;
  from.copy(to);
 }return true;
}
const habitats={},report=[];
for(const [id,source] of Object.entries(data.habitats)){
 const cell=source.cell,width=Math.round(source.radius*2/cell)+1,origin=[source.x-source.radius,source.z-source.radius];
 const points=new Map();
 for(let j=0;j<width;j++)for(let i=0;i<width;i++){
  const x=origin[0]+i*cell,z=origin[1]+j*cell;
  if(Math.hypot(x-source.x,z-source.z)>source.radius-1.5)continue;
  // Entire cells must be dry and clear, including the space between grid nodes.
  const samples=[];for(const dz of [-1.04,0,1.04])for(const dx of [-1.04,0,1.04])samples.push({x:x+dx,z:z+dz});
  if(!samples.every(p=>pointClear(p.x,p.z)))continue;
  const heights=samples.map(p=>collision.groundY(p.x,p.z));
  if(Math.max(...heights)-Math.min(...heights)>.65)continue;
  if(!samples.every(p=>segmentClear({x,z},p)))continue;
  points.set(j*width+i,{x,z});
 }
 if(points.size<20)throw new Error(`No usable habitat ${id}: ${points.size} cells`);
 const cells={};
 for(const [n,p] of points){
  const i=n%width,j=Math.floor(n/width),links=[];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const next=(j+dz)*width+i+dx,q=points.get(next);
   if(!q||i+dx<0||i+dx>=width||!points.has(j*width+i+dx)||!points.has((j+dz)*width+i))continue;
   if(segmentClear(p,q))links.push(next);
  }cells[n]=links;
 }
 const nearest=(x,z,allowed=points)=>[...allowed].sort((a,b)=>Math.hypot(a[1].x-x,a[1].z-z)-Math.hypot(b[1].x-x,b[1].z-z)||a[0]-b[0])[0];
 const [seed]=nearest(source.x,source.z),seen=new Set([seed]),queue=[seed];
 for(let i=0;i<queue.length;i++)for(const next of cells[queue[i]])if(!seen.has(next)){seen.add(next);queue.push(next);}
 for(const key of Object.keys(cells))if(!seen.has(Number(key))){delete cells[key];points.delete(Number(key));}
 for(const links of Object.values(cells))for(let i=links.length-1;i>=0;i--)if(!seen.has(links[i]))links.splice(i,1);
 const sites=data.spawns.filter(s=>s.habitat===id),occupied=[];
 for(const site of sites){
  const preferred={x:site.x,z:site.z};
  const candidates=new Map([...points].filter(([,p])=>occupied.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>2.5)));
  const [,home]=nearest(preferred.x,preferred.z,candidates);if(Math.hypot(home.x-preferred.x,home.z-preferred.z)>8)throw new Error(`Unsafe authored home ${site.id}`);
  Object.assign(site,home);occupied.push(home);
  const roam=data.enemies[site.enemy].ai.roam;
  site.patrol=[];
  for(let i=0;i<4;i++){
   const angle=i*Math.PI*.5+(site.variant??0)*.6;
   const [,p]=nearest(site.x+Math.cos(angle)*roam,site.z+Math.sin(angle)*roam);
   if(!site.patrol.some(q=>q.x===p.x&&q.z===p.z))site.patrol.push(p);
  }
 }
 habitats[id]={origin,cell,width,cells};report.push({id,cells:points.size,sites:sites.map(s=>s.id)});
}
const generated={...data,habitats};
await fs.writeFile('src/data/generated/wilderness.json',JSON.stringify(generated));
await fs.mkdir('art/combat-review',{recursive:true});
await fs.writeFile('art/combat-review/enemy-habitats.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({habitats:report,spawns:data.spawns.length}));
