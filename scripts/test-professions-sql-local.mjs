// Isolated PostgreSQL/WASM regression; never connects to the configured database.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';

const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let available=true;try{await access(modulePath);}catch{available=false;}

test('profession RPC accepts present gatherers and rejects missing, stale or foreign presence',{skip:!available,timeout:60000},async()=>{
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 const uid=randomUUID(),id=randomUUID(),other=randomUUID();
 const [catalog,foundation,professions,tutorial]=await Promise.all(['18-rpg-catalog.sql','19-rpg-foundation.sql','20-professions.sql','19a-profession-tutorial.sql'].map(name=>readFile(new URL(`../supabase/server/${name}`,import.meta.url),'utf8')));
 const definition=(source,name)=>{
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);
 };
 try{
  await db.exec(`
   create schema auth;
   create table public.characters(id uuid primary key,user_id uuid,data jsonb);
   create table public.world_players(character_id uuid,user_id uuid,position jsonb,seen_at timestamptz);
   create table public.player_trades(a uuid,b uuid,status text,revision int,accepted_a boolean,accepted_b boolean,offer_a jsonb,offer_b jsonb);
   create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
   create function public.game_lock_character(cid uuid) returns public.characters language sql as $$select * from public.characters where id=cid and user_id=auth.uid() for update$$;
   create function public.game_store(cid uuid,d jsonb) returns jsonb language plpgsql as $$begin update public.characters set data=d where id=cid;return d;end$$;
   create function public.game_health(d jsonb) returns int language sql as $$select (d->>'health')::int$$;
   create function public.game_inventory(d jsonb) returns jsonb language sql as $$select d->'inventory'$$;
   create function public.game_equipment_item(id text) returns jsonb language sql as $$select null::jsonb$$;
  `);
  await db.exec(catalog.slice(0,catalog.indexOf('revoke all')));
  await db.exec(`create function public.game_item(id text) returns jsonb language sql as $$select public.game_rpg_catalog()->'items'->id$$;`);
  for(const name of ['game_rpg_new_item','game_stack_into','game_rpg_give','game_rpg_rank','game_rpg_xp','game_rpg_craft_xp','game_rpg_recipe_xp','game_rpg_settle'])await db.exec(definition(foundation,name));
  for(const name of ['game_profession_tutorial_action','game_profession_tutorial_event'])await db.exec(definition(tutorial,name));
  await db.exec(definition(professions,'rpg_action'));
  const call=async(action,node,revision=0,request=randomUUID())=>(await db.query('select public.rpg_action($1,$2,$3,$4,$5) result',[id,action,{id:node},request,revision])).rows[0].result;
  const nodes=(await db.query("select public.game_rpg_catalog()->'nodes' nodes")).rows[0].nodes;
  const seed=async(node,tool=true)=>{
   const data={location:node.location,health:60,inventory:Array(25).fill(null),rpg:{tools:tool?{[node.job]:{id:`herramienta_${node.job}_0`,count:1,durability:100,maxDurability:100,originalDurability:100}}:{}}};
   await db.query('insert into public.characters values($1,$2,$3) on conflict(id) do update set data=excluded.data',[id,uid,data]);
   await db.exec('delete from public.world_players');
   await db.query('insert into public.world_players values($1,$2,$3,now())',[id,uid,{x:node.x,z:node.z}]);
  };
  for(const job of ['minero','lenador','recolector']){
   const [key,node]=Object.entries(nodes).find(([,node])=>node.job===job&&node.tier===0);
   await seed(node);
   const startRequest=randomUUID(),started=await call('gather_start',key,0,startRequest);
   assert.equal(started.rpg.gathering.node,key,`${job}: start with valid presence`);
   assert.equal(started.rpg.energy,100,'Starting does not spend energy');
   assert.equal((await call('gather_start',key,0,startRequest)).rpg.revision,1,'Retry is idempotent');
   await assert.rejects(()=>call('gather_finish',key,1),/La extracción se ha interrumpido/,'Cannot finish before the server timer');
   await db.query("update public.characters set data=jsonb_set(data,'{rpg,gathering,start}',to_jsonb(extract(epoch from clock_timestamp())-$1::numeric-1)) where id=$2",[node.seconds,id]);
   const finishRequest=randomUUID(),finished=await call('gather_finish',key,1,finishRequest);
   assert.equal(finished.rpg.gathering,null);
   assert.equal(finished.rpg.energy,99);
   assert.equal(finished.rpg.tools[job].durability,99.75);
   assert.equal(finished.rpg.xp[job],10);
   assert.equal(finished.inventory.filter(item=>item?.id===node.item).reduce((sum,item)=>sum+item.count,0),1);
   assert.ok(finished.rpg.nodes[key]>Date.now()/1000);
   assert.deepEqual((await call('gather_finish',key,1,finishRequest)).inventory,finished.inventory,'A repeated finish grants no extra material');
   await assert.rejects(()=>call('gather_start',key,2),/todavía se está recuperando/);
  }
  const [key,node]=Object.entries(nodes).find(([,node])=>node.job==='minero'&&node.tier===0);
  for(const kind of ['missing','stale','foreign','different character']){
   await seed(node);
   if(kind==='missing')await db.exec('delete from public.world_players');
   if(kind==='stale')await db.exec("update public.world_players set seen_at=now()-interval '16 seconds'");
   if(kind==='foreign')await db.query('update public.world_players set user_id=$1',[other]);
   if(kind==='different character')await db.query('update public.world_players set character_id=$1',[other]);
   await assert.rejects(()=>call('gather_start',key),/Entra en el mundo para realizar esta acción/,kind);
  }
  await seed(node,false);await assert.rejects(()=>call('gather_start',key),/Equipa o repara/);
  await seed(node);await db.query('update public.world_players set position=$1',[{x:node.x+10,z:node.z}]);
  await assert.rejects(()=>call('gather_start',key),/Acércate al recurso/);
  await seed(node);await call('gather_start',key);
  const cancelled=await call('gather_cancel',key,1);
  assert.equal(cancelled.rpg.gathering,null);assert.equal(cancelled.rpg.energy,100);
 }finally{await db.close();}
});
