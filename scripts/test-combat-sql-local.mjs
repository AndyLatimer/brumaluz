// Runs isolated PostgreSQL/WASM checks. No configured or live database is used.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import {build} from 'esbuild';
const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let available=true;try{await access(modulePath);}catch{available=false;}
test('generated combat SQL matches client attribute formulas and resolves ranged shadow attacks',{skip:!available,timeout:90000},async()=>{
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 const bundle=await build({stdin:{contents:`export * from './src/data/data';export * from './src/data/stats';export * from './src/data/combat';export * from './src/data/weapons';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
 const game=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
 const uid='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002';
 const files={};for(const name of ['03-formulas.sql','19-rpg-foundation.sql','21-rpg-combat.sql'])files[name]=await readFile(new URL(`../supabase/server/${name}`,import.meta.url),'utf8');
 const fn=(file,name)=>{const s=files[file],start=s.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0,name);return s.slice(start,s.indexOf('$$;',s.indexOf('as $$',start))+3);};
 try{
  await db.exec(`create schema auth;create table public.characters(id uuid primary key,user_id uuid,data jsonb);create table public.world_players(user_id uuid,character_id uuid,position jsonb,seen_at timestamptz,dead boolean default false);create table public.server_config(key text,value jsonb);insert into public.server_config values('combat_enabled','true');create table public.test_sight(enabled boolean);insert into public.test_sight values(true);
   create function auth.uid() returns uuid language sql as $$ select '${uid}'::uuid $$;
   create function public.game_equipment_stat(d jsonb,stat text) returns numeric language sql immutable as $$ select coalesce((d->'_stats'->>stat)::numeric,0) $$;
   create function public.game_rpg_catalog() returns jsonb language sql immutable as $$ select '{"sets":{}}'::jsonb $$;
   create function public.game_rpg_sight(loc text,x1 numeric,z1 numeric,x2 numeric,z2 numeric) returns boolean language sql as $$ select enabled from public.test_sight $$;
   create function public.game_has_weapon(d jsonb) returns boolean language sql immutable as $$ select (d->'_stats'->>'power')::numeric>0 $$;
   create function public.game_overheal_now(d jsonb) returns int language sql immutable as $$ select 0 $$;
   create function public.game_lock_character(cid uuid) returns public.characters language sql as $$ select * from public.characters where id=cid $$;
   create function public.game_store(cid uuid,d jsonb) returns jsonb language plpgsql as $$ begin update public.characters set data=d where id=cid;return d;end $$;
   insert into public.world_players(user_id,character_id,position,seen_at)values('${uid}','${id}','{"x":1,"z":0}',now());`);
  for(const name of ['game_race_bonus','game_level','game_attr_total','game_skill_id','game_skill_rank'])await db.exec(fn('03-formulas.sql',name));
  for(const name of ['game_set_bonuses','game_power_multiplier','game_guard_multiplier','game_strength_power','game_expertise_power','game_intellect_efficiency','game_agility_tempo','game_weapon_tempo','game_rpg_food_bonus','game_max_health','game_rpg_resource_max'])await db.exec(fn('19-rpg-foundation.sql',name));
  await db.exec(fn('03-formulas.sql','game_health'));await db.exec(fn('19-rpg-foundation.sql','game_public_vitals'));
  for(const name of ['game_shadow_combat_config','game_combat_tick','combat_action'])await db.exec(fn('21-rpg-combat.sql',name));
  const seed=async d=>db.query('insert into public.characters values($1,$2,$3) on conflict(id) do update set data=excluded.data',[id,uid,d]);
  let checks=0;
  for(const cls of Object.keys(game.COMBAT_KITS))for(const attr of [null,...Object.keys(game.ATTRIBUTES)]){
   const d={...game.defaultChar(),cls,equipment:game.starterEquipment(cls),welcome:{origin:0,stage:'completed'},location:'brumaluz',health:40,resource:50};
   if(attr)d.attributePoints={...d.attributePoints,[attr]:d.attributePoints[attr]+1};
   const main=game.equippedWeapon(cls,d.equipment,'weapon'),off=game.equippedWeapon(cls,d.equipment,'offhand');
   d._stats={power:main.power,guard:off?.guard??0,healing:(main.healing??0)+(off?.healing??0)};
   d.combatEncounter={id:'shadowling',status:'active',engaged:true,health:100000,maxHealth:100000,x:0,z:0,enemyAttackAt:0,instanceId:'test'};
   const stats=(await db.query('select public.game_max_health($1) hp,public.game_rpg_resource_max($1) resource,public.game_guard_multiplier($1) guard',[d])).rows[0];
   assert.equal(stats.hp,game.maxHealthOf(d));assert.equal(stats.resource,game.maxResourceOf(d));assert.ok(Math.abs(Number(stats.guard)-game.guardedDamage(cls,d.equipment,100,d)/100)<1e-9);
   await seed(d);const attack=(await db.query('select public.combat_action($1,$2) value',[id,'attack'])).rows[0].value;
   assert.ok(Math.abs(attack.damage-game.basicAttackDamage(cls,1,d.equipment,d))<1e-8,`${cls}/${attr}: basic`);
   assert.ok(Math.abs(attack.attackCooldown-game.attackInterval(cls,d.equipment,d))<1e-8,`${cls}/${attr}: cadence`);
   await seed(d);const skill=(await db.query('select public.combat_action($1,$2) value',[id,'skill'])).rows[0].value;
   const expected=game.skillPower(cls,1,d.equipment,d)*game.COMBAT_KITS[cls].skill.hits;
   if(cls==='clerigo')assert.equal(skill.healing,Math.min(Math.floor(expected),game.maxHealthOf(d)-d.health));else assert.ok(Math.abs(skill.damage-expected)<1e-8,`${cls}/${attr}: skill`);
   const stored=(await db.query('select data from public.characters where id=$1',[id])).rows[0].data;
   assert.ok(Math.abs(50-skill.vitals.resource+(stored.resourceCostFraction??0)-game.skillCost(d))<1e-8,`${cls}/${attr}: cost`);
   checks++;
  }
  const d={...game.defaultChar(),cls:'mago',location:'brumaluz',health:66,resource:50,_stats:{},combatEncounter:{id:'shadowling',status:'active',engaged:true,health:110,maxHealth:110,x:0,z:0,enemyAttackAt:0,attackSeq:1}};
  const tick=async(data,x,z)=>(await db.query('select public.game_combat_tick($1,$2,$3,$4) value',[id,data,x,z])).rows[0].value;
  const prepared=await tick(d,8,0);assert.equal(prepared.combatEncounter.attackKind,'bolt');assert.equal(prepared.health,66);
  prepared.combatEncounter.windup=1;const hit=await tick(prepared,10,1);assert.equal(hit.health,61,'A ranged bolt follows the player beyond the original aim');
  await db.exec('update public.test_sight set enabled=false');const blocked=await tick(prepared,10,1);assert.equal(blocked.health,66,'Cover stops ranged damage');await db.exec('update public.test_sight set enabled=true');
  d.combatEncounter.attackSeq=0;const melee=await tick(d,1,0);assert.equal(melee.combatEncounter.attackKind,'melee');melee.combatEncounter.windup=1;const dodged=await tick(melee,4,0);assert.equal(dodged.health,66,'Leaving melee reach avoids contact damage');
  console.log(`SQL/client parity: ${checks} class/attribute builds; targeted bolt, cover and melee reach verified.`);
 }finally{await db.close();}
});

test('shared enemy simulation targets one opponent, skips idle worlds and never simulates outdoors for town players',{skip:!available,timeout:60000},async()=>{
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 const source=await readFile(new URL('../supabase/server/28-shared-wilderness.sql',import.meta.url),'utf8');
 const extract=name=>{const start=source.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('end $$;',start)+8);};
 const first='00000000-0000-4000-8000-000000000011',second='00000000-0000-4000-8000-000000000012';
 try{
  await db.exec(`
   create table public.characters(id uuid primary key,data jsonb);
   create table public.world_players(character_id uuid,position jsonb,seen_at timestamptz,dead boolean default false);
   create table public.wilderness_mobs(spawn text primary key,state jsonb,revision int default 1);
   create table public.wilderness_events(character_id uuid,instance_id text,kind text,payload jsonb,created_at timestamptz default now());
   create table public.wilderness_claims(character_id uuid,expires_at numeric);
   create table public.server_config(key text,value jsonb);insert into public.server_config values('combat_enabled','true');
   create table public.guard_checks(calls int);insert into public.guard_checks values(0);
   create function public.game_wilderness_catalog()returns jsonb language sql as $$ select '{"enemies":{"test":{"range":1.8,"aggro":5,"radius":9,"reach":9,"pattern":"circle","damage":6,"speed":2,"windup":1.2,"interval":2.8}},"spawns":[]}'::jsonb $$;
   create function public.game_health(d jsonb)returns int language sql as $$select 60$$;
   create function public.game_rpg_sight(loc text,x1 numeric,z1 numeric,x2 numeric,z2 numeric)returns boolean language sql as $$select true$$;
   create function public.game_guard_multiplier(d jsonb)returns numeric language plpgsql as $$begin update public.guard_checks set calls=calls+1;return 1;end$$;
   create function public.game_wilderness_join(m jsonb,pid uuid,damage numeric default 0,support numeric default 0)returns jsonb language sql as $$select m$$;
   create function public.game_wilderness_consume(pid uuid,d jsonb)returns jsonb language sql as $$select d$$;
   create function public.game_wilderness_context(pid uuid,d jsonb,x numeric,z numeric)returns jsonb language sql as $$select d$$;
   create function public.game_story_combat_tick(pid uuid,d jsonb,x double precision,z double precision)returns jsonb language sql as $$select d||'{"story":true}'::jsonb$$;
   insert into public.characters values('${first}','{"location":"pompelin"}'),('${second}','{"location":"pompelin"}');
   insert into public.world_players values('${first}','{"x":1,"z":0}',now(),false),('${second}','{"x":1,"z":0}',now(),false);
   insert into public.wilderness_mobs values('test',jsonb_build_object('spawn','test','enemy','test','instanceId','enemy-1','status','active','health',80,'maxHealth',80,'x',0,'z',0,'homeX',0,'homeZ',0,'movedAt',extract(epoch from clock_timestamp())-.2,'windup',extract(epoch from clock_timestamp())-.1,'aimX',0,'aimZ',0,'enemyAttackAt',0,'members',jsonb_build_object('${first}',jsonb_build_object('threat',10,'seenAt',extract(epoch from clock_timestamp())))),1);
  `);
  await db.exec(extract('game_wilderness_world_tick'));await db.exec(extract('game_combat_tick'));
  await db.exec('select public.game_wilderness_world_tick()');
  const events=(await db.query('select character_id,payload from public.wilderness_events')).rows;
  assert.equal(events.length,1,'A normal strike never damages the bystander standing on the same spot');assert.equal(events[0].character_id,first);
  assert.equal((await db.query('select calls from public.guard_checks')).rows[0].calls,1,'Equipment mitigation is computed only for the opponent actually struck');
  const revision=(await db.query('select revision from public.wilderness_mobs')).rows[0].revision;
  await db.exec("update public.world_players set seen_at=now()-interval '1 minute';update public.wilderness_mobs set state=jsonb_set(state,'{movedAt}',to_jsonb(extract(epoch from clock_timestamp())-1))");
  await db.exec('select public.game_wilderness_world_tick()');assert.equal((await db.query('select revision from public.wilderness_mobs')).rows[0].revision,revision,'An empty outdoor map creates no simulation writes');
  const town=(await db.query('select public.game_combat_tick($1,$2,0,0) result',[first,{location:'brumaluz'}])).rows[0].result;
  assert.equal(town.story,true);assert.equal((await db.query('select revision from public.wilderness_mobs')).rows[0].revision,revision);
 }finally{await db.close();}
});
