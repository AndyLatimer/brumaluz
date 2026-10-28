// Refresh only the continent's authoritative sight obstacles, preserving all sites and other maps.
import fs from 'node:fs/promises';
import {assetBoxes} from './asset-bounds.mjs';
import {mapBlockers} from './rpg-map-blockers.mjs';
const map=JSON.parse(await fs.readFile('src/data/world/maps/pompelin.json','utf8'));
const visible=new Set(map.layers.filter(l=>l.visible).map(l=>l.id));
const objects=map.objects.filter(o=>!o.hidden&&visible.has(o.layer)&&o.collision==='auto'&&!o.asset.startsWith('city/hex_'));
const boxes=await assetBoxes({footprint:true,only:new Set(objects.map(o=>o.asset))});
const rows=[],round=v=>Math.round(v*10000)/10000;
for(const b of mapBlockers(map,boxes))rows.push(`('pompelin',${[b.x,b.z,b.yaw,b.minX,b.maxX,b.minZ,b.maxZ].map(round).join(',')})`);
const path='supabase/server/18a-rpg-geometry.sql',source=await fs.readFile(path,'utf8');
const result=source.replace(/(insert into public\.rpg_blockers values\s*)([\s\S]*?)(;\s*create or replace function)/,(_all,start,values,end)=>{
 const retained=values.trim().split(/,\s*\n/).filter(row=>!row.startsWith("('pompelin',"));return start+[...retained,...rows].join(',\n')+end;
});
if(result===source&&rows.length===0)throw Error('No continent geometry produced');
await fs.writeFile(path,result);console.log(`Pompelin server sight: ${rows.length} terrain-relative obstacles; resource sites and combat spawns preserved.`);
