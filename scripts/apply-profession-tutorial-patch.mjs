// Scoped optional quest migration. Read-only without --apply.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import pg from 'pg';
import {professionTutorialPatch,tutorialBranch,tutorialHook,TUTORIAL_START,TUTORIAL_END,cleanTutorialSql as clean,stripTutorialIntegration} from '../tools/build-profession-tutorial-patch.mjs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured');
const defs=JSON.parse(readFileSync('src/data/professionTutorial.json','utf8')),local=JSON.parse(readFileSync('src/data/generated/rpg-catalog.json','utf8')),out='art/profession-tutorial-review';mkdirSync(out,{recursive:true});
const helperSource=readFileSync('supabase/server/19a-profession-tutorial.sql','utf8');
const helpers=[...helperSource.matchAll(/create or replace function public\.(\w+)\([\s\S]*?as \$\$([\s\S]*?)\$\$;/g)].map(m=>({name:m[1],body:clean(m[2])}));if(helpers.length!==2)throw Error('Unexpected helper patch');
const names=['game_rpg_catalog','rpg_action',...helpers.map(h=>h.name)];
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:30000});let transaction=false;
async function inspect(){
 const rows=(await db.query("select proname,prosrc,oid::regprocedure::text signature,pg_get_functiondef(oid) definition,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) order by proname",[names])).rows;
 if(new Set(rows.map(r=>r.proname)).size!==rows.length||!rows.some(r=>r.proname==='rpg_action')||!rows.some(r=>r.proname==='game_rpg_catalog'))throw Error('Missing or overloaded functions');
 const live=(await db.query('select public.game_rpg_catalog() c')).rows[0].c,catalog={...live,professionTutorial:defs},action=rows.find(r=>r.proname==='rpg_action');
 for(const[job,cfg]of Object.entries(defs.jobs)){
  if(!equal(live.teachers[job],local.teachers[job]))throw Error('Teacher differs: '+job);
  if(cfg.recipe&&!equal(live.recipes[cfg.recipe],local.recipes[cfg.recipe]))throw Error('Recipe differs: '+cfg.recipe);
  if(!equal(live.dailyOrders.orders[cfg.order],local.dailyOrders.orders[cfg.order]))throw Error('Order differs: '+cfg.order);
 }
 const a=action.prosrc.indexOf(TUTORIAL_START),b=action.prosrc.indexOf(TUTORIAL_END,a);
 if(a>=0&&clean(action.prosrc.slice(a,b))!==clean(tutorialBranch))throw Error('Installed tutorial branch differs');
 for(const h of helpers){const current=rows.find(r=>r.proname===h.name);if(current&&clean(current.prosrc)!==h.body)throw Error('Installed tutorial helper differs: '+h.name);}
 const changed=!equal(live.professionTutorial,defs)||a<0||!action.prosrc.includes(tutorialHook)||helpers.some(h=>!rows.some(r=>r.proname===h.name));
 return{rows,live,catalog,changed,patch:professionTutorialPatch(catalog,action.definition)};
}
const terminate=s=>s.trimEnd()+(s.trimEnd().endsWith(';')?'':';');
try{
 await db.connect();const first=await inspect();writeFileSync(`${out}/server-patch.sql`,first.patch);
 if(!process.argv.includes('--apply')){
  if(process.argv.includes('--verify')&&(first.changed||first.rows.some(r=>r.anon||r.public_execute||r.authenticated!==(r.proname==='rpg_action'))))throw Error('Tutorial or permissions not installed');
  console.log(JSON.stringify({readOnly:true,changed:first.changed,professions:Object.keys(defs.jobs).length,verified:process.argv.includes('--verify')}));
 }else if(first.changed){
  await db.query('begin');transaction=true;await db.query("set local lock_timeout='2s';set local statement_timeout='25s';select pg_catalog.pg_advisory_xact_lock(731029,3)");const current=await inspect();if(!equal(first.rows,current.rows)||!equal(first.live,current.live))throw Error('Server changed during preflight');
  const prefix=`${out}/backup-${new Date().toISOString().replace(/[:.]/g,'-')}`;writeFileSync(`${prefix}.json`,JSON.stringify({functions:current.rows},null,2));
  const grants=current.rows.map(r=>`revoke all on function ${r.signature} from public,anon,authenticated;\n${[r.public_execute?'public':null,r.anon?'anon':null,r.authenticated?'authenticated':null].filter(Boolean).map(role=>`grant execute on function ${r.signature} to ${role};`).join('\n')}`).join('\n');
  const drops=helpers.filter(h=>!current.rows.some(r=>r.proname===h.name)).map(h=>`drop function public.${h.name}(${h.name.endsWith('_event')?'jsonb,text,jsonb,jsonb':'jsonb,text,jsonb,jsonb,numeric'});`).join('\n');
  writeFileSync(`${prefix}-rollback.sql`,`begin;\nselect pg_catalog.pg_advisory_xact_lock(731029,3);\n${current.rows.map(r=>terminate(r.definition)).join('\n')}\n${grants}\n${drops}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await db.query(current.patch.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,''));const after=await inspect();
  if(after.changed||!equal(after.live,current.catalog)||after.rows.some(r=>r.anon||r.public_execute||r.authenticated!==(r.proname==='rpg_action')))throw Error('Post-apply verification failed');
  if(clean(stripTutorialIntegration(after.rows.find(r=>r.proname==='rpg_action').prosrc))!==clean(stripTutorialIntegration(current.rows.find(r=>r.proname==='rpg_action').prosrc)))throw Error('Unrelated action branches changed');
  await db.query('commit');transaction=false;
  const result={applied:true,verified:true,functions:4,professions:12,characterRowsChanged:false,worldRowsChanged:false,rollback:`${prefix}-rollback.sql`,clientPublished:false};writeFileSync(`${out}/deployment.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }else console.log(JSON.stringify({alreadyInstalled:true}));
}catch(e){if(transaction)await db.query('rollback').catch(()=>{});console.error(e.message);process.exitCode=1;}finally{await db.end();}
