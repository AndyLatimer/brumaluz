// Scoped deployment. Read-only by default; never modifies character rows or world instances.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import pg from 'pg';
import {recipeTrainingPatch} from '../tools/build-recipe-training-patch.mjs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured.');
const local=JSON.parse(readFileSync('src/data/generated/rpg-catalog.json','utf8')),out='art/recipe-training-review',clean=s=>s.replace(/\r\n/g,'\n').trim();mkdirSync(out,{recursive:true});
const parse=sql=>[...sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?as (\$[a-z_]*\$)([\s\S]*?)\2;/gi)].map(m=>({name:m[1],body:clean(m[3])}));
const target=parse(recipeTrainingPatch()),names=target.map(f=>f.name);if(names.length!==4||new Set(names).size!==4)throw Error('Unexpected patch shape.');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:45000});let transaction=false;
async function inspect(){
 const functions=(await db.query("select p.proname,p.prosrc,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=any($1::text[]) order by p.proname",[names])).rows;
 if(functions.length!==4)throw Error('Missing or overloaded server functions.');
 const live=(await db.query('select public.game_rpg_catalog() catalog')).rows[0].catalog,catalog=structuredClone(live);
 for(const key of ['nodes','stations'])if(!equal(live[key],local[key]))throw Error('Live placements differ: '+key);
 for(const [id,recipe]of Object.entries(local.recipes)){
  const current=live.recipes[id];if(!current)throw Error('Missing deployed recipe: '+id);
  for(const key of ['job','tier','output','ingredients','seconds','processing'])if(!equal(current[key],recipe[key]))throw Error('Recipe rules diverged: '+id+'/'+key);
  catalog.recipes[id]={...current,source:recipe.source,price:recipe.price};
 }
 for(const [id,item]of Object.entries(local.items))if(item.recipe){catalog.items[id]=catalog.items[id]?{...catalog.items[id],description:item.description}:item;}
 catalog.teachers=local.teachers;catalog.rareRecipeDrop=local.rareRecipeDrop;
 const patch=recipeTrainingPatch(catalog),expected=parse(patch),changed=expected.filter(f=>f.name==='game_rpg_catalog'?!equal(live,catalog):clean(functions.find(row=>row.proname===f.name).prosrc)!==f.body).map(f=>f.name);
 return{functions,live,catalog,patch,expected,changed};
}
try{
 await db.connect();const first=await inspect();
 if(!process.argv.includes('--apply')){
  if(process.argv.includes('--verify')&&(first.changed.length||first.functions.some(row=>row.anon||row.public_execute||row.authenticated!==['rpg_action','expedition_action'].includes(row.proname))))throw Error('Installed recipe rules or permissions differ.');
  writeFileSync(`${out}/server-patch.sql`,first.patch);console.log(JSON.stringify({mode:'read-only',ready:true,changed:first.changed,recipes:Object.keys(first.catalog.recipes).length,teachers:Object.keys(first.catalog.teachers).length,rareDrop:first.catalog.rareRecipeDrop,verified:process.argv.includes('--verify')}));
 }else{
  await db.query('begin');transaction=true;await db.query("set local lock_timeout='2s';set local statement_timeout='30s';select pg_catalog.pg_advisory_xact_lock(731029,3);select pg_catalog.pg_advisory_xact_lock(731029,4)");
  const current=await inspect();if(!equal(first.functions,current.functions)||!equal(first.live,current.live))throw Error('Server changed during preflight.');
  const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-'),prefix=`${out}/backup-${stamp}`;
  writeFileSync(`${prefix}.json`,JSON.stringify({functions:current.functions},null,2));
  const grants=current.functions.map(row=>`revoke all on function ${row.signature} from public,anon,authenticated;\n${[row.public_execute?'public':null,row.anon?'anon':null,row.authenticated?'authenticated':null].filter(Boolean).map(role=>`grant execute on function ${row.signature} to ${role};`).join('\n')}`).join('\n');
  writeFileSync(`${prefix}-rollback.sql`,`begin;\nset local lock_timeout='2s';\nselect pg_catalog.pg_advisory_xact_lock(731029,3);\nselect pg_catalog.pg_advisory_xact_lock(731029,4);\n${current.functions.map(row=>row.definition).join('\n\n')}\n${grants}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await db.query(current.patch.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,''));
  const after=await inspect();if(after.changed.length||after.functions.some(row=>row.anon||row.public_execute||row.authenticated!==['rpg_action','expedition_action'].includes(row.proname)))throw Error('Post-deployment verification failed.');
  await db.query('commit');transaction=false;
  const result={applied:true,verified:true,functions:4,recipes:Object.keys(after.catalog.recipes).length,teachers:Object.keys(after.catalog.teachers).length,rareRecipes:Object.values(after.catalog.recipes).filter(r=>r.source==='drop').length,rareDrop:after.catalog.rareRecipeDrop,characterDataChanged:false,worldInstancesChanged:false,backup:`${prefix}.json`,rollback:`${prefix}-rollback.sql`,clientPublished:false};
  writeFileSync(`${out}/deployment.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}catch(error){if(transaction)await db.query('rollback').catch(()=>{});console.error(error.message);process.exitCode=1;}finally{await db.end();}
