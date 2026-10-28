// Apply only the reviewed enemy AI migration. Read-only unless --apply is explicit.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
 const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
 if(match&&!(match[1] in process.env))process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
}
if(!process.env.SUPABASE_DB_URL)throw new Error('SUPABASE_DB_URL is not configured.');
const patch=readFileSync('art/combat-review/enemy-ai-server-patch.sql','utf8');
const catalog=JSON.parse(readFileSync('src/data/generated/wilderness.json','utf8'));
const target=new Map(catalog.spawns.map(site=>[site.id,site]));
const functions=[...patch.matchAll(/create or replace function public\.(\w+)\([\s\S]*?as (\$[a-z_]*\$)([\s\S]*?)\2;/gi)].map(m=>({name:m[1],body:m[3].replace(/\r\n/g,'\n').trim()}));
if(functions.length!==10||!functions.some(f=>f.name==='game_wilderness_catalog'))throw new Error('Unexpected AI patch shape.');
const names=functions.map(f=>f.name),optional=new Set(['game_wilderness_clear','game_wilderness_route','game_wilderness_move','game_wilderness_ambient']);
const signatures={game_wilderness_clear:'jsonb,numeric,numeric,numeric,numeric',game_wilderness_route:'jsonb,numeric,numeric',game_wilderness_move:'jsonb,numeric,numeric,numeric,numeric,numeric',game_wilderness_ambient:'jsonb,jsonb,jsonb,numeric,numeric'};
const client=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:45000});
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
let transaction=false;
try{
 await client.connect();
 const definitions=()=>client.query("select p.proname,p.prosrc,pg_get_functiondef(p.oid) definition,p.oid::regprocedure::text signature,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=any($1::text[]) order by p.proname",[names]);
 const baseline=await definitions(),missing=names.filter(name=>!baseline.rows.some(row=>row.proname===name));
 if(baseline.rows.length+missing.length!==names.length||missing.some(name=>!optional.has(name)))throw new Error('The configured server has incompatible AI function signatures.');
 const dependencies=[...new Set([...patch.matchAll(/public\.(game_\w+)\(/g)].map(m=>m[1]))].filter(name=>!names.includes(name));
 const available=await client.query("select distinct proname from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[])",[dependencies]);
 const unavailable=dependencies.filter(name=>!available.rows.some(row=>row.proname===name));if(unavailable.length)throw new Error('Missing server dependencies: '+unavailable.join(', '));
 const remote=(await client.query('select public.game_wilderness_catalog() catalog')).rows[0].catalog;
 if(remote.spawns.some(site=>!target.has(site.id)))throw new Error('The server has additional enemy placements; applying this catalog would hide them.');
 const mobs=(await client.query('select spawn,state,revision from public.wilderness_mobs order by spawn')).rows;
 for(const row of mobs){if(!target.has(row.spawn)||target.get(row.spawn).enemy!==row.state.enemy)throw new Error('Incompatible existing enemy placement: '+row.spawn);}
 const flags=(await client.query("select key,value from public.server_config where key='combat_enabled'")).rows;
 const changed=functions.filter(f=>baseline.rows.find(row=>row.proname===f.name)?.prosrc.replace(/\r\n/g,'\n').trim()!==f.body).map(f=>f.name);
 const expectedNew=catalog.spawns.filter(site=>!mobs.some(row=>row.spawn===site.id)).map(site=>site.id);
 if(!process.argv.includes('--apply')){
  let navigationVerified=false;
  if(process.argv.includes('--verify')){
   if(missing.length||changed.length||expectedNew.length)throw new Error('The deployed AI differs from the reviewed patch.');
   const navigation=await client.query("select spawn,public.game_wilderness_clear(public.game_wilderness_catalog()->'habitats'->(state->>'habitat'),(state->>'homeX')::numeric,(state->>'homeZ')::numeric,(state->>'homeX')::numeric,(state->>'homeZ')::numeric) home_clear,jsonb_array_length(public.game_wilderness_route(state,(state->>'homeX')::numeric,(state->>'homeZ')::numeric)) route_nodes from public.wilderness_mobs order by spawn");
   if(navigation.rows.length!==target.size||navigation.rows.some(row=>!row.home_clear||row.route_nodes<1))throw new Error('Deployed navigation failed a home/return-route check: '+JSON.stringify(navigation.rows));
   navigationVerified=true;
  }
  console.log(JSON.stringify({mode:'read-only',ready:true,changed,existingEnemies:mobs.length,newEnemies:expectedNew.length,targetEnemies:target.size,flags,navigationVerified}));
 }else{
  await client.query('begin');transaction=true;await client.query("set local lock_timeout='2s';set local statement_timeout='30s'");
  await client.query('select pg_catalog.pg_advisory_xact_lock(731029,4)');
  const previous=await definitions(),before=(await client.query('select spawn,state,revision from public.wilderness_mobs order by spawn for update')).rows;
  // Recheck under the world lock, so the backup and preservation checks share a boundary.
  for(const row of before)if(!target.has(row.spawn)||target.get(row.spawn).enemy!==row.state.enemy)throw new Error('Enemy population changed during preflight.');
  if(previous.rows.some(row=>baseline.rows.find(old=>old.proname===row.proname)?.definition!==row.definition))throw new Error('Server functions changed during preflight.');
  const added=catalog.spawns.filter(site=>!before.some(row=>row.spawn===site.id)).map(site=>site.id);
  const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-'),prefix=`art/combat-review/enemy-ai-backup-${stamp}`;
  mkdirSync('art/combat-review',{recursive:true});
  writeFileSync(prefix+'.json',JSON.stringify({functions:previous.rows,mobs:before,introduced:added,patchSha256:createHash('sha256').update(patch).digest('hex')},null,2));
  const grants=previous.rows.map(row=>`revoke all on function ${row.signature} from public,anon,authenticated;\n${[row.public_execute?'public':null,row.anon?'anon':null,row.authenticated?'authenticated':null].filter(Boolean).map(role=>`grant execute on function ${row.signature} to ${role};`).join('\n')}`).join('\n');
  const restoreHomes=before.map(row=>`update public.wilderness_mobs set state=state||${quote(JSON.stringify({homeX:row.state.homeX,homeZ:row.state.homeZ}))}::jsonb,revision=revision+1 where spawn=${quote(row.spawn)};`).join('\n');
  writeFileSync(prefix+'-rollback.sql',`-- Restores prior functions/catalog and home coordinates; keeps current health, loot and generations.\nbegin;\nset local lock_timeout='2s';\nselect pg_catalog.pg_advisory_xact_lock(731029,4);\n${added.length?`do $$begin if exists(select 1 from public.wilderness_mobs where spawn in (${added.map(quote).join(',')}) and state->>'status'='active') then raise exception 'New companions are fighting; retry rollback when they have returned.';end if;end$$;\ndelete from public.wilderness_mobs where spawn in (${added.map(quote).join(',')});`:''}\n${previous.rows.map(row=>row.definition).join('\n\n')}\n${grants}\n${[...missing].reverse().map(name=>`drop function public.${name}(${signatures[name]});`).join('\n')}\n${restoreHomes}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await client.query(patch.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,''));
  const after=(await client.query('select spawn,state,revision from public.wilderness_mobs order by spawn')).rows;
  if(after.length!==target.size||after.some(row=>!target.has(row.spawn)))throw new Error('Unexpected population after migration.');
  for(const old of before){const next=after.find(row=>row.spawn===old.spawn);for(const key of ['instanceId','health','status','members','attackSeq'])if(JSON.stringify(old.state[key])!==JSON.stringify(next.state[key]))throw new Error('An existing encounter changed unexpectedly: '+old.spawn+'/'+key);}
  const installed=await definitions();
  for(const f of functions){const row=installed.rows.find(row=>row.proname===f.name);if(!row||row.prosrc.replace(/\r\n/g,'\n').trim()!==f.body||row.anon||row.authenticated||row.public_execute)throw new Error('AI function verification failed: '+f.name);}
  const installedCatalog=(await client.query('select public.game_wilderness_catalog() catalog')).rows[0].catalog;
  if(JSON.stringify(installedCatalog.spawns)!==JSON.stringify(remote.spawns)&&installedCatalog.spawns.length!==target.size)throw new Error('Catalog verification failed.');
  for(const site of catalog.spawns){const actual=installedCatalog.spawns.find(s=>s.id===site.id);if(!actual||actual.enemy!==site.enemy||actual.group!==site.group||actual.habitat!==site.habitat)throw new Error('Installed placement mismatch: '+site.id);}
  await client.query('commit');transaction=false;
  const result={applied:true,verified:true,functions:installed.rows.length,enemies:after.length,addedEnemies:added.length,preservedEncounters:before.length,activeEncountersPreserved:before.filter(row=>row.state.status==='active').length,playerDataChanged:false,backup:prefix+'.json',rollback:prefix+'-rollback.sql',combatEnabled:flags.find(row=>row.key==='combat_enabled')?.value===true};
  if(existsSync('art/combat-review/enemy-ai-deployment.json')){const prior=JSON.parse(readFileSync('art/combat-review/enemy-ai-deployment.json','utf8'));result.previousApplications=[...(prior.previousApplications??[]),{backup:prior.backup,rollback:prior.rollback,addedEnemies:prior.addedEnemies}];}
  writeFileSync('art/combat-review/enemy-ai-deployment.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}catch(error){if(transaction)await client.query('rollback').catch(()=>{});console.error(error.message);process.exitCode=1;}
finally{await client.end();}
