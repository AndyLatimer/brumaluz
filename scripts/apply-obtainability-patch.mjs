// Default: read-only preflight. --apply installs only the reviewed obtainability changes.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {obtainabilityPatch} from '../tools/build-obtainability-patch.mjs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
 const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured.');
const read=file=>JSON.parse(readFileSync(file,'utf8')),localRpg=read('src/data/generated/rpg-catalog.json'),localWild=read('src/data/generated/wilderness.json');
const ids=Array.from({length:5},(_,i)=>`cuero_${i+1}`),out='art/obtainability-review';mkdirSync(out,{recursive:true});
const clean=body=>body.replace(/\r\n/g,'\n').trim(),quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const parse=sql=>[...sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?as (\$[a-z_]*\$)([\s\S]*?)\2;/gi)].map(m=>({name:m[1],body:clean(m[3])}));
const names=parse(obtainabilityPatch()).map(f=>f.name);
if(names.length!==6||new Set(names).size!==6)throw Error('Unexpected patch shape.');
const client=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:45000});let transaction=false;
async function definitions(){return(await client.query("select p.proname,p.prosrc,pg_get_functiondef(p.oid) definition,p.oid::regprocedure::text signature,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=any($1::text[]) order by p.proname",[names])).rows;}
async function prepare(){
 const previous=await definitions(),missing=names.filter(name=>!previous.some(row=>row.proname===name));
 if(previous.length+missing.length!==6||missing.some(name=>name!=='game_rpg_recipe_xp'))throw Error('Incompatible server function signatures.');
 const {rows:[live]}=await client.query('select public.game_rpg_catalog() rpg,public.game_wilderness_catalog() wild');
 for(const key of ['nodes','stations'])if(!equal(live.rpg[key],localRpg[key]))throw Error(`Live ${key} differ from the reviewed client; refusing to overwrite placements.`);
 if(live.wild.spawns.some(site=>!localWild.spawns.some(s=>s.id===site.id&&s.enemy===site.enemy)))throw Error('Server contains additional or incompatible enemy placements.');
 const rpg=structuredClone(live.rpg),wild=structuredClone(live.wild);
 for(let tier=1;tier<=5;tier++){
  const key=`curtir_cuero_${tier}`,mob=`jabali_cuero_${tier}`,site=`cuero_${tier}`;
  if(rpg.recipes[key]&&!equal(rpg.recipes[key],localRpg.recipes[key]))throw Error('Conflicting recipe: '+key);
  if(wild.enemies[mob]&&!equal(wild.enemies[mob],localWild.enemies[mob]))throw Error('Conflicting enemy: '+mob);
  if(wild.habitats[site]&&!equal(wild.habitats[site],localWild.habitats[site]))throw Error('Conflicting habitat: '+site);
  rpg.recipes[key]=localRpg.recipes[key];
  if(!rpg.items[site])throw Error('Missing existing hide item: '+site);
  rpg.items[site].description=localRpg.items[site].description;
  wild.enemies[mob]=localWild.enemies[mob];wild.habitats[site]=localWild.habitats[site];
  const spawn=localWild.spawns.find(s=>s.id===site),old=wild.spawns.find(s=>s.id===site);
  if(old&&!equal(old,spawn))throw Error('Conflicting spawn: '+site);if(!old)wild.spawns.push(spawn);
 }
 const patch=obtainabilityPatch({rpgCatalog:rpg,wildernessCatalog:wild}),functions=parse(patch);
 const dependencies=[...new Set([...patch.matchAll(/public\.(game_\w+)\(/g)].map(m=>m[1]))].filter(name=>!names.includes(name));
 const available=(await client.query("select distinct proname from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[])",[dependencies])).rows;
 const absent=dependencies.filter(name=>!available.some(row=>row.proname===name));if(absent.length)throw Error('Missing dependencies: '+absent.join(', '));
 const changed=functions.filter(f=>f.name==='game_rpg_catalog'?!equal(live.rpg,rpg):f.name==='game_wilderness_catalog'?!equal(live.wild,wild):clean(previous.find(row=>row.proname===f.name)?.prosrc??'')!==f.body).map(f=>f.name);
 const mobs=(await client.query('select spawn,state,revision from public.wilderness_mobs order by spawn')).rows;
 for(const mob of mobs)if(!wild.spawns.some(site=>site.id===mob.spawn&&site.enemy===mob.state.enemy))throw Error('Incompatible live creature: '+mob.spawn);
 return{previous,missing,patch,functions,changed,mobs,rpg,wild,live,added:ids.filter(id=>!mobs.some(m=>m.spawn===id))};
}
try{
 await client.connect();const initial=await prepare();
 if(!process.argv.includes('--apply')){
  if(process.argv.includes('--verify')&&(initial.changed.length||initial.added.length))throw Error('Server does not match the reviewed obtainability changes.');
  if(process.argv.includes('--verify')&&initial.previous.some(row=>row.anon||row.public_execute||row.authenticated!==(row.proname==='rpg_action')))throw Error('Deployed function permissions differ from the reviewed patch.');
  writeFileSync(`${out}/server-patch.sql`,initial.patch);
  console.log(JSON.stringify({mode:'read-only',ready:true,changedFunctions:initial.changed,newEnemies:initial.added.length,currentEnemies:initial.mobs.length,recipes:Object.keys(initial.rpg.recipes).length,placementsPreserved:true,verified:process.argv.includes('--verify')}));
 }else{
  await client.query('begin');transaction=true;await client.query("set local lock_timeout='2s';set local statement_timeout='30s'");
  await client.query('select pg_catalog.pg_advisory_xact_lock(731029,3)');await client.query('select pg_catalog.pg_advisory_xact_lock(731029,4)');
  const prepared=await prepare();
  if(!equal(prepared.previous,initial.previous)||!equal(prepared.live,initial.live))throw Error('Server definitions changed during preflight.');
  const before=(await client.query('select spawn,state,revision from public.wilderness_mobs order by spawn for update')).rows;
  const introduced=ids.filter(id=>!before.some(m=>m.spawn===id));
  const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-'),prefix=`${out}/backup-${stamp}`;
  writeFileSync(`${prefix}.json`,JSON.stringify({functions:prepared.previous,mobs:before,introduced,patchSha256:createHash('sha256').update(prepared.patch).digest('hex')},null,2));
  const grants=prepared.previous.map(row=>`revoke all on function ${row.signature} from public,anon,authenticated;\n${[row.public_execute?'public':null,row.anon?'anon':null,row.authenticated?'authenticated':null].filter(Boolean).map(role=>`grant execute on function ${row.signature} to ${role};`).join('\n')}`).join('\n');
  writeFileSync(`${prefix}-rollback.sql`,`-- Restores prior code/catalogs, preserving current player progress and old encounters.\nbegin;\nset local lock_timeout='2s';\nselect pg_catalog.pg_advisory_xact_lock(731029,3);\nselect pg_catalog.pg_advisory_xact_lock(731029,4);\n${introduced.length?`do $$begin if exists(select 1 from public.wilderness_mobs where spawn in (${introduced.map(quote).join(',')}) and state->>'status'='active') then raise exception 'New creatures are fighting; retry rollback after disengagement.';end if;end$$;\ndelete from public.wilderness_mobs where spawn in (${introduced.map(quote).join(',')});`:''}\n${prepared.previous.map(row=>row.definition).join('\n\n')}\n${grants}\n${prepared.missing.includes('game_rpg_recipe_xp')?'drop function public.game_rpg_recipe_xp(jsonb,jsonb);':''}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await client.query(prepared.patch.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,''));
  const installed=await definitions();for(const f of prepared.functions){const row=installed.find(r=>r.proname===f.name);if(!row||clean(row.prosrc)!==f.body||row.anon||row.public_execute||row.authenticated!==(f.name==='rpg_action'))throw Error('Function/permissions verification failed: '+f.name);}
  const after=(await client.query('select spawn,state,revision from public.wilderness_mobs order by spawn')).rows;
  for(const old of before)if(!equal(old,after.find(m=>m.spawn===old.spawn)))throw Error('Existing creature was modified: '+old.spawn);
  if(after.length!==before.length+introduced.length)throw Error('Unexpected creature count.');
  const {rows:[actual]}=await client.query('select public.game_rpg_catalog() rpg,public.game_wilderness_catalog() wild');if(!equal(actual.rpg,prepared.rpg)||!equal(actual.wild,prepared.wild))throw Error('Installed catalogs differ.');
  const homes=(await client.query("select spawn,public.game_wilderness_clear(public.game_wilderness_catalog()->'habitats'->(state->>'habitat'),(state->>'homeX')::numeric,(state->>'homeZ')::numeric,(state->>'homeX')::numeric,(state->>'homeZ')::numeric) clear from public.wilderness_mobs where spawn=any($1::text[])",[ids])).rows;
  if(homes.length!==5||homes.some(h=>!h.clear))throw Error('New creature habitat check failed.');
  await client.query('commit');transaction=false;
  const result={applied:true,verified:true,functions:installed.length,enemies:after.length,addedEnemies:introduced.length,preservedEncounters:before.length,activeEncountersPreserved:before.filter(m=>m.state.status==='active').length,playerDataChanged:false,mapsChanged:false,resourcePlacementsChanged:false,recipes:Object.keys(actual.rpg.recipes).length,backup:`${prefix}.json`,rollback:`${prefix}-rollback.sql`,clientPublished:false};
  writeFileSync(`${out}/deployment.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}catch(error){if(transaction)await client.query('rollback').catch(()=>{});console.error(error.message);process.exitCode=1;}finally{await client.end();}
