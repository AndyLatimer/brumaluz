import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const {workshops}=await json('src/data/workshops.json');
const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let available=true;try{await access(modulePath);}catch{available=false;}

test('all twelve editable workshops have a master, station and reciprocal capital doors',async()=>{
 const capital=await json('src/data/maps/brumaluz.json'),npcs=(await json('src/data/npcs.json')).npcs,catalog=await json('src/data/generated/rpg-catalog.json');
 assert.equal(workshops.length,12);assert.equal(new Set(workshops.map(w=>w.masterId)).size,12);
 assert.equal(workshops.find(w=>w.job==='herreria').masterId,'isberto');
 assert.equal(npcs.some(n=>n.id==='maestro_herreria'),false,'Isberto is the blacksmith, with no duplicate master');
 const district=capital.markers.find(m=>m.id==='urbe_barrio_3');assert.equal(district.name,'Barrio de los Artesanos');
 assert.deepEqual([capital.terrain.columns,capital.terrain.rows,capital.terrain.origin,capital.terrain.cell],[393,393,[-196,-196],1],'The city keeps its existing map extent');
 assert.equal(new Set(workshops.map(w=>w.entrance.buildingId)).size,12);
 for(const w of workshops){
  const draft=await json(`src/data/maps/${w.mapId}.json`),published=await json(`src/data/world/maps/${w.mapId}.json`);
  assert.deepEqual(published,draft,w.mapId);assert.equal(draft.settings.kind,'interior');
  assert.equal(draft.objects.some(o=>/^(brumaluz-hamlet|brumaluz-arboleda)\//.test(o.asset)),false,`${w.mapId}: city collections stay in their respective cities`);
  assert.equal(draft.markers.filter(m=>m.type==='npc'&&m.npcId===w.masterId).length,1);assert.ok(npcs.some(n=>n.id===w.masterId));
  const station=draft.markers.find(m=>m.text===`profession:${w.job}`);assert.ok(station);
  assert.equal(catalog.stations[w.job].location,w.mapId);assert.equal(catalog.stations[w.job].x,station.position[0]);assert.equal(catalog.stations[w.job].z,station.position[2]);
  const entrance=capital.markers.find(m=>m.id===`taller_${w.job}`),exit=draft.markers.find(m=>m.id===w.exit.id);
  assert.ok(Math.hypot(entrance.position[0]-district.position[0],entrance.position[2]-district.position[2])<=district.radius,`${w.job}: entrance is inside the artisan district`);
  assert.ok(capital.objects.find(o=>o.id===w.entrance.buildingId)?.name.startsWith('Barrio de los Artesanos'));
  assert.equal(entrance.trigger,'interact');assert.equal(exit.trigger,'interact');assert.equal(entrance.target.map,w.mapId);assert.equal(exit.target.map,'brumaluz');
  assert.ok(draft.markers.some(m=>m.type==='arrival'&&m.id===entrance.target.arrival));assert.ok(capital.markers.some(m=>m.type==='arrival'&&m.id===exit.target.arrival));
 }
});

test('narrow workshop SQL registers doors and validates each public station without replacing existing maps',{skip:!available,timeout:60000},async()=>{
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 try{
  await db.exec(`create table public.world_maps(id text primary key,name text,spawn jsonb,bounds jsonb);create table public.world_portals(map text references public.world_maps(id),id text,x double precision,z double precision,radius double precision,target_map text references public.world_maps(id),target jsonb,primary key(map,id));
   insert into public.world_maps values('brumaluz','Brumaluz','{"x":0,"z":0}',null),('existing','Existing','{"x":1,"z":2}',null);
   insert into public.world_portals values('existing','leave',1,2,2,'brumaluz','{"x":0,"z":0}');`);
  await db.exec(await readFile('art/workshops-review/server-patch.sql','utf8'));
  assert.equal((await db.query("select count(*)::int n from public.world_maps where id like 'taller_%'")).rows[0].n,12);
  assert.equal((await db.query('select count(*)::int n from public.world_portals')).rows[0].n,25);
  assert.equal((await db.query("select name from public.world_maps where id='existing'")).rows[0].name,'Existing');
  const source=await readFile('supabase/server/20-professions.sql','utf8'),a=source.indexOf('create or replace function public.game_rpg_near('),b=source.indexOf('$$;',a)+3;await db.exec(source.slice(a,b));
  const near=async(job,location,x,z,furniture=[])=>(await db.query('select public.game_rpg_near($1,$2,$3) value',[{location,rpg:{furniture}},job,{x,z}])).rows[0].value;
  for(const w of workshops){
   assert.equal(await near(w.job,w.mapId,w.station.x,w.station.z),true,w.job);
   assert.equal(await near(w.job,w.mapId,w.station.x+20,w.station.z),false,`${w.job}: distance`);
   assert.equal(await near(w.job,'brumaluz',w.station.x,w.station.z),false,`${w.job}: old street station removed`);
  }
  assert.equal(await near('herreria','casa_de_isberto_interior',1,1,[{job:'herreria',location:'casa_de_isberto_interior',x:1,z:1}]),true,'Private home stations remain usable');
 }finally{await db.close();}
});
