// Applies only the reviewed sight-index patch from 18a-rpg-geometry.sql. It never
// touches blocker rows nor story/data migrations: just the bounds column, its GiST
// index and the prefiltered game_rpg_sight, verified in-transaction against the
// previous implementation before committing.
import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import {sqlFunction} from './runtime-performance-sql.mjs';

for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
 if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
}
if(!process.env.SUPABASE_DB_URL)throw Error('Falta SUPABASE_DB_URL.');
const source=fs.readFileSync(new URL('../supabase/server/18a-rpg-geometry.sql',import.meta.url),'utf8');
const column=/alter table public\.rpg_blockers add column if not exists bounds[\s\S]*?stored;/.exec(source)?.[0];
const index=/create index if not exists rpg_blockers_bounds[^;]*;/.exec(source)?.[0];
if(!column||!index)throw Error('18a-rpg-geometry.sql no contiene la columna bounds o su índice.');
const patch=[column,index,sqlFunction(source,'game_rpg_sight'),'revoke all on function public.game_rpg_sight(text,numeric,numeric,numeric,numeric) from public,anon,authenticated;'].join('\n');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
try{
 await db.connect();await db.query('begin');
 await db.query("set local lock_timeout='5s';set local statement_timeout='120s'");
 const previous=(await db.query("select pg_get_functiondef(to_regprocedure('public.game_rpg_sight(text,numeric,numeric,numeric,numeric)')) def")).rows[0].def;
 await db.query(previous.replace('public.game_rpg_sight(','public.game_rpg_sight_previous('));
 await db.query(patch);
 // Paridad sobre segmentos entre bloqueadores reales de cada mapa, que garantizan cortes y despejes.
 const parity=(await db.query(`
  with pairs as (
   select a.map,a.x+(random()*8-4) x1,a.z+(random()*8-4) z1,c.x+(random()*8-4) x2,c.z+(random()*8-4) z2
   from (select map,x,z,row_number() over (partition by map order by random()) rn from public.rpg_blockers) a
   join (select map,x,z,row_number() over (partition by map order by random()) rn from public.rpg_blockers) c using (map,rn)
   limit 3000)
  select count(*)::int total,count(*) filter (where public.game_rpg_sight(map,x1::numeric,z1::numeric,x2::numeric,z2::numeric)
   is distinct from public.game_rpg_sight_previous(map,x1::numeric,z1::numeric,x2::numeric,z2::numeric))::int mismatches
  from pairs`)).rows[0];
 assert.equal(parity.mismatches,0,'La visión optimizada debe coincidir con la anterior');
 await db.query('drop function public.game_rpg_sight_previous(text,numeric,numeric,numeric,numeric)');
 fs.mkdirSync('art/performance-review',{recursive:true});
 fs.writeFileSync('art/performance-review/sight-rollback.sql','-- Restores the previous line-of-sight implementation and removes its spatial index.\nbegin;\n'+previous+";\nalter table public.rpg_blockers drop column if exists bounds;\nnotify pgrst, 'reload schema';\ncommit;\n");
 await db.query("notify pgrst, 'reload schema'");await db.query('commit');
 console.log(`Sight patch applied; parity on ${parity.total} segments. Rollback saved in art/performance-review/sight-rollback.sql.`);
}catch(error){await db.query('rollback').catch(()=>{});console.error(error.message);process.exitCode=1;}
finally{await db.end();}
