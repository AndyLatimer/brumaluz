// Only the twelve workshops, their 24 links and profession stations. Other deployed content is preserved.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import pg from 'pg';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
 const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(match&&!(match[1] in process.env))process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured.');
const {workshops}=read('src/data/workshops.json'),ids=workshops.map(w=>w.mapId),catalog=read('src/data/generated/rpg-catalog.json');
const maps=new Map(['brumaluz',...ids].map(id=>[id,read(`src/data/world/maps/${id}.json`)]));
const sqlText=value=>`'${String(value).replaceAll("'","''")}'`,sqlJson=value=>`${sqlText(JSON.stringify(value))}::jsonb`,r=value=>Math.round(value*100)/100;
const at=marker=>({x:r(marker.position[0]),z:r(marker.position[2]),yaw:r(marker.rotationY)});
const mapRows=workshops.map(w=>{
 const map=maps.get(w.mapId),spawn=map.markers.find(m=>m.type==='spawn'),t=map.terrain;
 return {id:map.id,name:map.name,spawn:at(spawn),bounds:{minX:t.origin[0],minZ:t.origin[1],maxX:t.origin[0]+(t.columns-1)*t.cell,maxZ:t.origin[1]+(t.rows-1)*t.cell}};
});
const portalRows=[];
for(const map of maps.values())for(const marker of map.markers.filter(m=>m.type==='portal'&&(map.id!=='brumaluz'||ids.includes(m.target?.map)))){
 const target=maps.get(marker.target?.map);if(!target)throw Error(`Unexpected workshop target: ${marker.id}`);
 const arrival=target.markers.find(m=>m.type==='arrival'&&m.id===marker.target.arrival);if(!arrival)throw Error(`Missing arrival: ${marker.id}`);
 portalRows.push({map:map.id,id:marker.id,x:r(marker.position[0]),z:r(marker.position[2]),radius:marker.radius,target_map:target.id,target:at(arrival)});
}
if(mapRows.length!==12||portalRows.length!==24)throw Error('Expected twelve rooms and twenty-four reciprocal portals.');
const upsertMaps=rows=>rows.map(m=>`insert into public.world_maps(id,name,spawn,bounds) values(${sqlText(m.id)},${sqlText(m.name)},${sqlJson(m.spawn)},${sqlJson(m.bounds)}) on conflict(id) do update set name=excluded.name,spawn=excluded.spawn,bounds=excluded.bounds;`).join('\n');
const upsertPortals=rows=>rows.map(p=>`insert into public.world_portals(map,id,x,z,radius,target_map,target) values(${sqlText(p.map)},${sqlText(p.id)},${p.x},${p.z},${p.radius},${sqlText(p.target_map)},${sqlJson(p.target)}) on conflict(map,id) do update set x=excluded.x,z=excluded.z,radius=excluded.radius,target_map=excluded.target_map,target=excluded.target;`).join('\n');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:5000});let transaction=false;
try{
 await db.connect();await db.query('begin');transaction=true;await db.query("set local lock_timeout='2s';set local statement_timeout='20s'");
 await db.query('select pg_advisory_xact_lock(731029,2)');await db.query('select pg_advisory_xact_lock(731029,3)');
 const {rows:[previous]}=await db.query("select prosrc,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where oid='public.game_rpg_catalog()'::regprocedure");
 const {rows:[live]}=await db.query('select public.game_rpg_catalog() catalog');
 const next={...live.catalog,stations:catalog.stations},body=` select ${sqlJson(next)} `;
 if(body.includes('$function$'))throw Error('Unexpected function delimiter in catalog');
 const definition=previous.definition.replace(previous.prosrc,()=>body).replace(/;\s*$/,'').trimEnd()+';';
 const oldMaps=(await db.query('select * from public.world_maps where id=any($1::text[])',[ids])).rows;
 const keys=portalRows.map(p=>`${p.map}/${p.id}`),oldPortals=(await db.query("select * from public.world_portals where map||'/'||id=any($1::text[])",[keys])).rows;
 const patch=`-- Workshop locations and station catalog only.\nbegin;\nset local lock_timeout='2s';\nset local statement_timeout='20s';\n${upsertMaps(mapRows)}\n${upsertPortals(portalRows)}\n${definition}\nnotify pgrst, 'reload schema';\ncommit;\n`;
 mkdirSync('art/workshops-review',{recursive:true});writeFileSync('art/workshops-review/server-patch.sql',patch);
 if(!process.argv.includes('--apply')){
  await db.query('rollback');transaction=false;console.log(JSON.stringify({mode:'read-only',maps:12,portals:24,stations:Object.keys(catalog.stations).length,otherCatalogContentPreserved:true,patch:'art/workshops-review/server-patch.sql'}));
 }else{
  const backup=`art/workshops-review/server-rollback-${Date.now()}.sql`;
  const missing=ids.filter(id=>!oldMaps.some(m=>m.id===id));
  writeFileSync(backup,`begin;\ndelete from public.world_portals where map||'/'||id in (${keys.map(sqlText).join(',')});\n${missing.length?`delete from public.world_maps where id in (${missing.map(sqlText).join(',')});`:''}\n${upsertMaps(oldMaps)}\n${upsertPortals(oldPortals)}\n${previous.definition};\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await db.query(upsertMaps(mapRows));await db.query(upsertPortals(portalRows));await db.query(definition);
  const {rows:[verified]}=await db.query("select public.game_rpg_catalog() catalog,(select proacl::text from pg_proc where oid='public.game_rpg_catalog()'::regprocedure) acl");
  if(verified.acl!==previous.acl||JSON.stringify({...verified.catalog,stations:null})!==JSON.stringify({...live.catalog,stations:null}))throw Error('Catalog or grants verification failed');
  await db.query("notify pgrst, 'reload schema'");await db.query('commit');transaction=false;
  console.log(JSON.stringify({applied:true,maps:12,portals:24,stations:13,playerDataChanged:false,otherCatalogContentPreserved:true,backup}));
 }
}catch(error){if(transaction)await db.query('rollback');console.error(error.message);process.exitCode=1;}finally{await db.end();}
