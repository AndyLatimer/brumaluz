import fs from 'node:fs';
import * as THREE from 'three';
import { assetBoxes } from './asset-bounds.mjs';
const files=fs.readdirSync('src/data/world/maps').filter(f=>f.endsWith('.json'));
const maps=files.map(f=>JSON.parse(fs.readFileSync(`src/data/world/maps/${f}`,'utf8')));
const assets=new Set(maps.flatMap(m=>m.objects.filter(o=>o.collision==='auto').map(o=>o.asset)));
const boxes=await assetBoxes({footprint:true,only:assets});const blockers=[];
for(const map of maps){
 const layers=new Set(map.layers.filter(l=>l.visible).map(l=>l.id));
 for(const o of map.objects){
  if(o.collision!=='auto'||!layers.has(o.layer))continue;const b=boxes.get(o.asset);if(!b||b.isEmpty())continue;
  const minY=o.position[1]+b.min.y*o.scale[1],maxY=o.position[1]+b.max.y*o.scale[1];if(maxY<.65||minY>1.5)continue;
  blockers.push({map:map.id,x:o.position[0],z:o.position[2],yaw:o.rotation[1],minX:b.min.x*o.scale[0],maxX:b.max.x*o.scale[0],minZ:b.min.z*o.scale[2],maxZ:b.max.z*o.scale[2]});
 }
 for(const c of map.colliders??[])if(layers.has(c.layer))blockers.push({map:map.id,x:c.position[0],z:c.position[2],yaw:c.rotationY??0,minX:-c.size[0]/2,maxX:c.size[0]/2,minZ:-c.size[2]/2,maxZ:c.size[2]/2});
}
function blocked(x,z,map='brumaluz',margin=.8){return blockers.some(b=>{if(b.map!==map)return false;const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw),s=Math.sin(b.yaw),lx=c*dx-s*dz,lz=s*dx+c*dz;return lx>b.minX-margin&&lx<b.maxX+margin&&lz>b.minZ-margin&&lz<b.maxZ+margin;});}
const occupied=[];
const continent=maps.find(map=>map.id==='pompelin');
if(!continent||continent.settings.kind!=='world')throw new Error('Gathering requires the published Pompelín world map.');
const terrain=continent.terrain,heights=Buffer.from(terrain.heights,'base64'),water=terrain.water?Buffer.from(terrain.water,'base64'):null;
const activeLayers=new Set(continent.layers.filter(layer=>layer.visible).map(layer=>layer.id));
const buildings=continent.objects.filter(object=>!object.hidden&&activeLayers.has(object.layer)&&/^city\/(castle|home_[AB]|tavern|church|market|blacksmith|windmill)$/.test(object.asset));
const settlements=continent.markers.filter(marker=>marker.type==='zone'&&activeLayers.has(marker.layer)&&buildings.some(object=>Math.hypot(object.position[0]-marker.position[0],object.position[2]-marker.position[2])<60));
const entrances=continent.markers.filter(marker=>['spawn','portal','arrival'].includes(marker.type)&&activeLayers.has(marker.layer));
function groundAndWater(x,z){
 const fx=(x-terrain.origin[0])/terrain.cell,fz=(z-terrain.origin[1])/terrain.cell;
 if(fx<1||fz<1||fx>terrain.columns-2||fz>terrain.rows-2)return null;
 const i=Math.floor(fx),j=Math.floor(fz),tx=fx-i,tz=fz-j;
 const corners=[[j*terrain.columns+i,(1-tx)*(1-tz)],[j*terrain.columns+i+1,tx*(1-tz)],[(j+1)*terrain.columns+i,(1-tx)*tz],[(j+1)*terrain.columns+i+1,tx*tz]];
 const height=corners.reduce((sum,[index,weight])=>sum+heights.readInt16LE(index*2)/100*weight,0);
 let level=continent.settings.water.enabled?continent.settings.water.level:-Infinity;
 if(water){const wet=corners.filter(([index])=>water.readInt16LE(index*2)!==-32768),weight=wet.reduce((sum,[,w])=>sum+w,0);if(weight>=.5)level=Math.max(level,...wet.map(([index])=>water.readInt16LE(index*2)/100));}
 return {height,level};
}
function gatheringGround(x,z,margin){
 if(margin>1&&entrances.some(marker=>Math.hypot(x-marker.position[0],z-marker.position[2])<20))return false;
 if(settlements.some(marker=>Math.hypot(x-marker.position[0],z-marker.position[2])<Math.max(25,marker.radius)+15))return false;
 if(entrances.some(marker=>Math.hypot(x-marker.position[0],z-marker.position[2])<Math.max(8,marker.radius??0)+margin))return false;
 if(buildings.some(object=>Math.hypot(x-object.position[0],z-object.position[2])<12+Math.max(...object.scale)))return false;
 const center=groundAndWater(x,z);if(!center||center.height<=center.level+.08)return false;
 return [[margin+1,0],[-margin-1,0],[0,margin+1],[0,-margin-1]].every(([dx,dz])=>{const sample=groundAndWater(x+dx,z+dz);return sample&&sample.height>sample.level+.08&&Math.abs(sample.height-center.height)<.5;});
}
function free(x,z,margin,map='brumaluz',gathering=false){
 const clear=(nx,nz)=>!blocked(nx,nz,map,margin)&&occupied.every(p=>p.map!==map||Math.hypot(p.x-nx,p.z-nz)>p.margin+margin)&&(!gathering||gatheringGround(nx,nz,margin));
 const reserve=(nx,nz)=>{occupied.push({x:nx,z:nz,margin,map});return{x:nx,z:nz};};
 if(clear(x,z))return reserve(x,z);
 for(let r=1;r<(gathering?120:35);r++)for(let a=0;a<24;a++){const nx=x+Math.sin(a*Math.PI/12)*r,nz=z+Math.cos(a*Math.PI/12)*r;if(clear(nx,nz))return reserve(nx,nz);}
 throw new Error(`No free site in ${map} near ${x}, ${z}`);
}
const catalog=JSON.parse(fs.readFileSync('src/data/generated/rpg-catalog.json','utf8'));
catalog.camp={...free(88,-18,5),id:'expedition',label:'Tablón de expediciones',location:'brumaluz',job:'expedition',radius:4};
for(const s of Object.values(catalog.stations))Object.assign(s,free(s.x,s.z,1.6));
for(const s of Object.values(catalog.nodes)){
 if(s.location!=='pompelin')throw new Error(`Resource ${s.id} must be outside cities, in Pompelín.`);
 Object.assign(s,free(s.x,s.z,.65,s.location,true));
}
const wilderness=JSON.parse(fs.readFileSync('src/data/wilderness.json','utf8'));
wilderness.spawns=['saqueador','salteador','vigia','jabali','brote'].map((enemy,index)=>{
 const reference=catalog.nodes[`minero_0_${index%3*3}`];
 return{id:`camino_${index+1}`,enemy,location:'pompelin',respawn:90,...free(reference.x+8+(index>2?16:0),reference.z+8+(index>2?16:0),1.2,'pompelin',true)};
});
fs.writeFileSync('src/data/generated/wilderness.json',JSON.stringify(wilderness));
fs.writeFileSync('src/data/generated/rpg-catalog.json',JSON.stringify(catalog));
const literal=JSON.stringify(catalog).replaceAll("'","''");fs.writeFileSync('supabase/server/18-rpg-catalog.sql',`-- Generated RPG catalog and placement.\ncreate or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select '${literal}'::jsonb $catalog$;\nrevoke all on function public.game_rpg_catalog() from public,anon,authenticated;\n`);
fs.writeFileSync('supabase/server/18a-rpg-geometry.sql',`-- Generated from published maps and their asset collision footprints.\ncreate table if not exists public.rpg_blockers(map text not null,x double precision not null,z double precision not null,yaw double precision not null,min_x double precision not null,max_x double precision not null,min_z double precision not null,max_z double precision not null);\nalter table public.rpg_blockers enable row level security;\nrevoke all on table public.rpg_blockers from public,anon,authenticated;\ntruncate public.rpg_blockers;\ninsert into public.rpg_blockers values\n${blockers.map(b=>`('${b.map}',${b.x},${b.z},${b.yaw},${b.minX},${b.maxX},${b.minZ},${b.maxZ})`).join(',\n')};\ncreate or replace function public.game_rpg_sight(loc text,x1 numeric,z1 numeric,x2 numeric,z2 numeric) returns boolean language plpgsql stable set search_path='' as $$\ndeclare b record; ax double precision;az double precision;bx double precision;bz double precision;dx double precision;dz double precision;lo double precision;hi double precision;t1 double precision;t2 double precision;tmp double precision;\nbegin\n for b in select * from public.rpg_blockers where map=loc loop\n ax:=cos(b.yaw)*(x1-b.x)-sin(b.yaw)*(z1-b.z);az:=sin(b.yaw)*(x1-b.x)+cos(b.yaw)*(z1-b.z);bx:=cos(b.yaw)*(x2-b.x)-sin(b.yaw)*(z2-b.z);bz:=sin(b.yaw)*(x2-b.x)+cos(b.yaw)*(z2-b.z);dx:=bx-ax;dz:=bz-az;lo:=0.001;hi:=0.999;\n if abs(dx)<0.000001 then if ax<b.min_x or ax>b.max_x then continue;end if;else t1:=(b.min_x-ax)/dx;t2:=(b.max_x-ax)/dx;if t1>t2 then tmp:=t1;t1:=t2;t2:=tmp;end if;lo:=greatest(lo,t1);hi:=least(hi,t2);end if;\n if abs(dz)<0.000001 then if az<b.min_z or az>b.max_z then continue;end if;else t1:=(b.min_z-az)/dz;t2:=(b.max_z-az)/dz;if t1>t2 then tmp:=t1;t1:=t2;t2:=tmp;end if;lo:=greatest(lo,t1);hi:=least(hi,t2);end if;\n if lo<=hi then return false;end if;\n end loop;return true;end $$;\nrevoke all on function public.game_rpg_sight(text,numeric,numeric,numeric,numeric) from public,anon,authenticated;\n`);
console.log(`Published RPG geometry: ${blockers.length} obstacles; ${Object.keys(catalog.nodes).length} resources; expedition camp ${catalog.camp.x.toFixed(1)}, ${catalog.camp.z.toFixed(1)}.`);
