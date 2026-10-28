// Shared isolated PostgreSQL/WASM fixture. Never reads database credentials.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
const catalog=JSON.parse(await readFile(new URL('../src/data/generated/rpg-catalog.json',import.meta.url),'utf8'));
const definition=(source,name)=>{const start=source.indexOf('create or replace function public.'+name+'(');assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);};
export async function fixture(){
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 const uid=randomUUID(),id=randomUUID(),files={};
 for(const file of ['18-rpg-catalog.sql','19-rpg-foundation.sql','19a-profession-tutorial.sql','20-professions.sql','26-wilderness-generated.sql','27-wilderness.sql','03-formulas.sql','05-items-vendors.sql'])files[file]=await readFile(new URL(`../supabase/server/${file}`,import.meta.url),'utf8');
 await db.exec(`create schema auth;create role anon;create role authenticated;
  create table test_clock(stamp timestamptz);insert into test_clock values(now());
  create function public.test_now() returns timestamptz language sql as $$select stamp from public.test_clock$$;
  create table characters(id uuid primary key,user_id uuid,data jsonb);
  create table world_players(character_id uuid,user_id uuid,position jsonb,seen_at timestamptz);
  create table player_trades(a uuid,b uuid,status text,revision int,accepted_a boolean,accepted_b boolean,offer_a jsonb,offer_b jsonb);
  create table wilderness_mobs(spawn text primary key,state jsonb);
  create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
  create function game_lock_character(cid uuid) returns characters language sql as $$select * from public.characters where id=cid and user_id=auth.uid() for update$$;
  create function game_store(cid uuid,d jsonb) returns jsonb language plpgsql as $$begin update public.characters set data=d where id=cid;return d;end$$;
  create function game_health(d jsonb) returns int language sql as $$select (d->>'health')::int$$;
  create function game_inventory(d jsonb) returns jsonb language sql as $$select d->'inventory'$$;
  create function game_wilderness_fresh(site jsonb) returns jsonb language sql as $$select site||'{"health":100,"instanceId":"fresh"}'::jsonb$$;
 `);
 for(const file of ['18-rpg-catalog.sql','26-wilderness-generated.sql'])await db.exec(files[file].slice(0,files[file].indexOf('revoke all')));
 await db.exec(`create function game_item(id text) returns jsonb language sql as $$select coalesce(public.game_rpg_catalog()->'items'->id,jsonb_build_object('stack',1))$$;
 create function game_equipment_item(id text) returns jsonb language sql as $$select public.game_rpg_catalog()->'equipment'->id$$;`);
 for(const name of ['game_level','game_xp_needed'])await db.exec(definition(files['03-formulas.sql'],name));
 for(const name of ['game_pelines','game_set_pelines'])await db.exec(definition(files['05-items-vendors.sql'],name));
 for(const name of ['game_rpg_new_item','game_stack_into','game_rpg_give','game_rpg_consume','game_rpg_rank','game_rpg_xp','game_rpg_craft_xp','game_rpg_recipe_xp','game_rpg_settle'])await db.exec(definition(files['19-rpg-foundation.sql'],name));
 await db.exec(files['19a-profession-tutorial.sql']);
 for(const name of ['game_rpg_near','rpg_action'])await db.exec(definition(files['20-professions.sql'],name).replaceAll('clock_timestamp()','public.test_now()'));
 for(const name of ['game_wilderness_loot','game_wilderness_reward'])await db.exec(definition(files['27-wilderness.sql'],name));
 return {db,id,uid,
  async seed(data){await db.query('insert into characters values($1,$2,$3) on conflict(id) do update set data=excluded.data',[id,uid,{race:'humano',cls:'picaro',level:1,experience:0,health:66,wallet:{pelines:5},equipment:{},inventory:Array(25).fill(null),...data}]);},
  async move(site){await db.query("update characters set data=data||jsonb_build_object('location',$2::text) where id=$1",[id,site.location]);await db.exec('delete from world_players');await db.query('insert into world_players values($1,$2,$3,now())',[id,uid,{x:site.x,z:site.z}]);},
  async data(){return (await db.query('select data from characters where id=$1',[id])).rows[0].data;},
  async action(action,args={},request=randomUUID(),revision){const data=await this.data();return (await db.query('select rpg_action($1,$2,$3,$4,$5) result',[id,action,args,request,revision??data.rpg?.revision??0])).rows[0].result;},
  async purchase(id){
   const recipe=catalog.recipes[id];let d=await this.data();
   if(!d.inventory.some(item=>item?.id===`receta_${id}`)&&recipe.source!=='drop')d=await this.action('buy_recipe',{id,master:catalog.teachers[recipe.job].id,price:recipe.price});
   const slot=d.inventory.findIndex(item=>item?.id===`receta_${id}`);
   if(slot<0)throw Error('Faltan materiales: pergamino de receta');
   if(!d.inventory[slot].instanceId)d=await this.action('state');
   return this.action('use_recipe',{slot,id:d.inventory[slot].id,instanceId:d.inventory[slot].instanceId});
  },
  async step(seconds){await db.query("update test_clock set stamp=stamp+$1*interval '1 second'",[seconds]);},
 };
}
