// Applies only the reviewed combat function bodies; default mode is read-only.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import pg from 'pg';
import {combatPatch,wildernessAiHelpers} from '../tools/build-combat-patch.mjs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
 const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
 if(match&&!(match[1] in process.env))process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
}
if(!process.env.SUPABASE_DB_URL)throw new Error('SUPABASE_DB_URL is not configured.');
const patch=combatPatch(),names=[...patch.matchAll(/create or replace function public\.(\w+)\(/g)].map(match=>match[1]);
const bodies=new Map([...patch.matchAll(/create or replace function public\.(\w+)\([\s\S]*?as \$\$([\s\S]*?)\$\$;/g)].map(match=>[match[1],match[2].replace(/\r\n/g,'\n').trim()]));
const client=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:5000});
let transaction=false;
try{
 await client.connect();
 const current=await client.query("select proname,prosrc,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) order by proname",[names]);
 const missing=names.filter(name=>!current.rows.some(row=>row.proname===name));
 const optional=new Set(['game_shadow_combat_config','game_strength_power','game_expertise_power','game_intellect_efficiency','game_agility_tempo',...Object.keys(wildernessAiHelpers)]);
 if(current.rows.length+missing.length!==names.length||missing.some(name=>!optional.has(name)))throw new Error('The configured server has incompatible combat function signatures.');
 const dependencies=[...new Set([...patch.matchAll(/public\.(game_\w+)\(/g)].map(match=>match[1]))].filter(name=>!names.includes(name));
 const available=await client.query("select distinct proname from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[])",[dependencies]);
 const unavailable=dependencies.filter(name=>!available.rows.some(row=>row.proname===name));
 if(unavailable.length)throw new Error(`Server dependencies are missing: ${unavailable.join(', ')}`);
 const changed=names.filter(name=>current.rows.find(row=>row.proname===name)?.prosrc.replace(/\r\n/g,'\n').trim()!==bodies.get(name));
 const ordering=await client.query("select proname,position('serverRevision' in prosrc)>0 revisioned from pg_proc where pronamespace='public'::regnamespace and proname in ('game_store','game_public_vitals')");
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'read-only',functions:names,changed,snapshotOrdering:ordering.rows,ready:true}));}
 else{
  await client.query('begin');transaction=true;
  await client.query("set local lock_timeout='2s';set local statement_timeout='20s'");
  await client.query('select pg_advisory_xact_lock(731029,2)');
  const rollback=existsSync('art/combat-review/server-rollback.sql')?`art/combat-review/server-rollback-${Date.now()}.sql`:'art/combat-review/server-rollback.sql';
  writeFileSync(rollback,`-- Previous deployed combat functions.\nbegin;\n${current.rows.map(row=>row.definition).join('\n\n')}\n${missing.reverse().map(name=>`drop function public.${name}(${wildernessAiHelpers[name]??(name==='game_shadow_combat_config'?'':'jsonb')});`).join('\n')}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await client.query(patch);await client.query("notify pgrst, 'reload schema'");
  await client.query('commit');transaction=false;
  console.log(JSON.stringify({applied:true,functions:changed,playerDataChanged:false,rollback}));
 }
}catch(error){if(transaction)await client.query('rollback');console.error(error.message);process.exitCode=1;}
finally{await client.end();}
