// Isolated PostgreSQL/WASM. Only its clock is replaced to step time deterministically.
// No credentials, configured database or real player data are read.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
export const PLAYER='00000000-0000-4000-8000-000000000011';
export const SECOND='00000000-0000-4000-8000-000000000012';
export async function aiFixture(catalog){
 const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 const source=await readFile(new URL('../supabase/server/28-shared-wilderness.sql',import.meta.url),'utf8');
 const fn=name=>{const start=source.indexOf(`create or replace function public.${name}(`);if(start<0)throw new Error(name);return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3).replaceAll('clock_timestamp()','public.test_now()');};
 await db.exec(`
 create table test_clock(stamp timestamptz);insert into test_clock values('2026-10-26T12:00:00Z');
 create function public.test_now() returns timestamptz language sql stable as $$select stamp from public.test_clock$$;
 create table public.characters(id uuid primary key,data jsonb);
 create table public.world_players(character_id uuid,position jsonb,seen_at timestamptz,dead boolean default false);
 create table public.wilderness_mobs(spawn text primary key,state jsonb,revision int default 1);
 create table public.wilderness_events(character_id uuid,instance_id text,kind text,payload jsonb,created_at timestamptz default public.test_now());
 create unique index reward_once on public.wilderness_events(character_id,instance_id,kind) where kind='reward';
 create table public.wilderness_claims(character_id uuid,expires_at numeric,encounter jsonb);
 create table public.server_config(key text,value jsonb);insert into public.server_config values('combat_enabled','true');
 create table public.test_sight(enabled boolean);insert into test_sight values(true);
 create function public.game_health(d jsonb) returns int language sql as $$select coalesce((d->>'health')::int,66)$$;
 create function public.game_rpg_sight(loc text,x1 numeric,z1 numeric,x2 numeric,z2 numeric) returns boolean language sql as $$select enabled from public.test_sight$$;
 create function public.game_guard_multiplier(d jsonb) returns numeric language sql as $$select 1::numeric$$;
 create function public.game_wilderness_catalog() returns jsonb language sql immutable as $catalog$select '${JSON.stringify(catalog).replaceAll("'","''")}'::jsonb$catalog$;
 insert into characters values('${PLAYER}','{"location":"pompelin","health":66}'),('${SECOND}','{"location":"pompelin","health":66}');
 insert into world_players values('${PLAYER}','{"x":55,"z":0}',public.test_now(),false),('${SECOND}','{"x":55,"z":3}',public.test_now(),false);
 `);
 for(const name of ['game_wilderness_in_combat','game_wilderness_fresh','game_wilderness_join','game_wilderness_finish','game_wilderness_clear','game_wilderness_route','game_wilderness_move','game_wilderness_ambient','game_wilderness_world_tick'])await db.exec(fn(name));
 await db.exec("insert into wilderness_mobs(spawn,state) select site->>'id',public.game_wilderness_fresh(site) from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') site");
 return {
  db,async step(seconds=.25){await db.query("update test_clock set stamp=stamp+$1*interval '1 second'",[seconds]);await db.exec('update world_players set seen_at=public.test_now();select public.game_wilderness_world_tick()');},
  async rows(){return (await db.query('select spawn,state,revision from wilderness_mobs order by spawn')).rows;},
  async mob(id){return (await db.query('select state from wilderness_mobs where spawn=$1',[id])).rows[0].state;},
  async set(id,patch){await db.query('update wilderness_mobs set state=state||$2::jsonb where spawn=$1',[id,patch]);},
  async player(x,z,id=PLAYER){await db.query('update world_players set position=$2 where character_id=$1',[id,{x,z}]);},
  async engage(id,player=PLAYER,damage=1){await db.query('update wilderness_mobs set state=public.game_wilderness_join(state,$2,$3) where spawn=$1',[id,player,damage]);},
  async close(){await db.close();}
 };
}
