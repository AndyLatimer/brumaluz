// Read-only unless --apply. Changes only recipe items and purchase/use branches.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import pg from 'pg';
import {recipeScrollPatch,recipeBranch,scrollBranch,legacyRecipeBranch,cleanRecipeSql as clean,withoutRecipeBranch} from '../tools/build-recipe-scroll-patch.mjs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured');
const local=JSON.parse(readFileSync('src/data/generated/rpg-catalog.json','utf8')),out='art/recipe-scroll-review';mkdirSync(out,{recursive:true});
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:30000});let transaction=false;
async function inspect(){
 const rows=(await db.query("select proname,prosrc,oid::regprocedure::text signature,pg_get_functiondef(oid) definition,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) order by proname",[['game_rpg_catalog','rpg_action']])).rows;
 if(rows.length!==2)throw Error('Missing or overloaded functions');
 const live=(await db.query('select public.game_rpg_catalog() c')).rows[0].c,catalog=structuredClone(live),action=rows.find(r=>r.proname==='rpg_action');
 if(![clean(scrollBranch),clean(legacyRecipeBranch)].includes(clean(recipeBranch(action.prosrc))))throw Error('Live purchase branch has other changes; refusing replacement');
 for(const recipe of Object.values(local.recipes)){
  if(!equal(live.recipes[recipe.id],recipe))throw Error('Recipe differs: '+recipe.id);
  const id=`receta_${recipe.id}`,item=local.items[id],old=live.items[id];
  if(old&&old.recipe!==recipe.id)throw Error('Item identity differs: '+id);
  catalog.items[id]=old?{...old,description:item.description,usable:true}:item;
 }
 const changed=!equal(live,catalog)||clean(recipeBranch(action.prosrc))!==clean(scrollBranch);
 return{rows,live,catalog,changed,patch:recipeScrollPatch(catalog,action.definition)};
}
const terminate=sql=>sql.trimEnd()+(sql.trimEnd().endsWith(';')?'':';');
try{
 await db.connect();const first=await inspect();writeFileSync(`${out}/server-patch.sql`,first.patch);
 if(!process.argv.includes('--apply')){
  if(process.argv.includes('--verify')&&(first.changed||first.rows.some(r=>r.anon||r.public_execute||r.authenticated!==(r.proname==='rpg_action'))))throw Error('Recipe scrolls or permissions are not installed');
  console.log(JSON.stringify({readOnly:true,changed:first.changed,consumableRecipes:Object.keys(local.recipes).length,verified:process.argv.includes('--verify')}));
 }else if(first.changed){
  await db.query('begin');transaction=true;await db.query("set local lock_timeout='2s';set local statement_timeout='25s';select pg_catalog.pg_advisory_xact_lock(731029,3)");
  const current=await inspect();if(!equal(first.rows,current.rows)||!equal(first.live,current.live))throw Error('Server changed during preflight');
  const prefix=`${out}/backup-${new Date().toISOString().replace(/[:.]/g,'-')}`;writeFileSync(`${prefix}.json`,JSON.stringify({functions:current.rows},null,2));
  const grants=current.rows.map(r=>`revoke all on function ${r.signature} from public,anon,authenticated;\n${[r.public_execute?'public':null,r.anon?'anon':null,r.authenticated?'authenticated':null].filter(Boolean).map(role=>`grant execute on function ${r.signature} to ${role};`).join('\n')}`).join('\n');
  writeFileSync(`${prefix}-rollback.sql`,`begin;\nselect pg_catalog.pg_advisory_xact_lock(731029,3);\n${current.rows.map(r=>terminate(r.definition)).join('\n')}\n${grants}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await db.query(current.patch.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,''));const after=await inspect();
  if(after.changed||!equal(after.live,current.catalog)||after.rows.some(r=>r.anon||r.public_execute||r.authenticated!==(r.proname==='rpg_action')))throw Error('Post-apply content or permissions differ');
  if(clean(withoutRecipeBranch(current.rows.find(r=>r.proname==='rpg_action').prosrc))!==clean(withoutRecipeBranch(after.rows.find(r=>r.proname==='rpg_action').prosrc)))throw Error('Unrelated action branches changed');
  await db.query('commit');transaction=false;
  const result={applied:true,verified:true,functions:2,consumableRecipes:Object.keys(local.recipes).length,characterRowsChanged:false,worldRowsChanged:false,rollback:`${prefix}-rollback.sql`,clientPublished:false};writeFileSync(`${out}/deployment.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }else console.log(JSON.stringify({alreadyInstalled:true}));
}catch(error){if(transaction)await db.query('rollback').catch(()=>{});console.error(error.message);process.exitCode=1;}finally{await db.end();}
