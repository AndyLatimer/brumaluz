// Applies only the reviewed performance functions. No story/data migrations.
import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import {runtimePerformanceSql,runtimeMetadataIds} from './runtime-performance-sql.mjs';

for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
 if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
}
if(!process.env.SUPABASE_DB_URL)throw Error('Falta SUPABASE_DB_URL.');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const ids=runtimeMetadataIds();
const metadata=async()=>(await db.query('select id,public.game_equipment_item(id) equipment,public.game_item(id) item from unnest($1::text[]) id order by id',[ids])).rows;
try{
 await db.connect();await db.query('begin');
 await db.query("set local lock_timeout='2s';set local statement_timeout='15s'");
 await db.query('select pg_advisory_xact_lock(731029,30)');
 const before=await metadata();
 const names=['game_equipment_item(text)','game_item(text)','game_set_bonuses(jsonb)','game_rpg_food_bonus(jsonb,text)','game_public_vitals(jsonb)','game_rpg_settle(jsonb,numeric)','game_regen_data(uuid,jsonb)','game_food_data(uuid,jsonb)'];
 const rollback=(await db.query('select pg_get_functiondef(to_regprocedure(name)) body from unnest($1::text[]) name',[names.map(n=>'public.'+n)])).rows.map(r=>r.body).join('\n');
 await db.query(runtimePerformanceSql());
 assert.deepEqual(await metadata(),before,'El parche no debe cambiar los objetos ni sus estadísticas');
 fs.mkdirSync('art/performance-review',{recursive:true});
 fs.writeFileSync('art/performance-review/server-rollback.sql','-- Restores previous implementations; compact private helpers may remain unused.\nbegin;\n'+rollback+"\nnotify pgrst, 'reload schema';\ncommit;\n");
 await db.query("notify pgrst, 'reload schema'");await db.query('commit');
 console.log(`Performance functions applied; ${before.length} item/equipment definitions preserved. Rollback saved in art/performance-review/server-rollback.sql.`);
}catch(error){await db.query('rollback').catch(()=>{});console.error(error.message);process.exitCode=1;}
finally{await db.end();}
