// Read-only by default. Preserves all live catalog entries and unrelated action branches.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import pg from 'pg';
import {dailyOrdersPatch,dailyOrderBranch,DAILY_BRANCH_START,DAILY_BRANCH_END} from '../tools/build-daily-orders-patch.mjs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured');
const daily=JSON.parse(readFileSync('src/data/dailyOrders.json','utf8')),local=JSON.parse(readFileSync('src/data/generated/rpg-catalog.json','utf8')),out='art/daily-orders-review';mkdirSync(out,{recursive:true});
const clean=s=>s.replace(/\r\n/g,'\n').trim(),names=['game_rpg_catalog','rpg_action'];
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:30000});let transaction=false;
async function inspect(){
 const rows=(await db.query("select proname,prosrc,oid::regprocedure::text signature,pg_get_functiondef(oid) definition,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) order by proname",[names])).rows;
 if(rows.length!==2)throw Error('Missing or overloaded functions');
 const live=(await db.query('select public.game_rpg_catalog() catalog')).rows[0].catalog;
 for(const order of Object.values(daily.orders)){
  if(!equal(live.teachers[order.job],local.teachers[order.job]))throw Error('Teacher differs: '+order.job);
  for(const id of Object.keys(order.ingredients))if(!equal(live.items[id],local.items[id]))throw Error('Requested item differs: '+id);
 }
 const action=rows.find(row=>row.proname==='rpg_action'),begin=action.prosrc.indexOf(DAILY_BRANCH_START),end=action.prosrc.indexOf(DAILY_BRANCH_END,begin);
 const branch=begin>=0?action.prosrc.slice(begin,end):'';
 if(begin>=0&&clean(branch)!==clean(dailyOrderBranch))throw Error('An installed daily branch has other changes; refusing replacement');
 const catalog={...live,dailyOrders:daily},patch=dailyOrdersPatch(catalog,action.definition);
 return{rows,live,catalog,patch,changed:!equal(live.dailyOrders,daily)||begin<0};
}
try{
 await db.connect();const initial=await inspect();writeFileSync(`${out}/server-patch.sql`,initial.patch);
 if(!process.argv.includes('--apply')){
  if(process.argv.includes('--verify')&&(initial.changed||initial.rows.some(r=>r.anon||r.public_execute||r.authenticated!==(r.proname==='rpg_action'))))throw Error('Daily orders or permissions are not installed');
  console.log(JSON.stringify({readOnly:true,changed:initial.changed,orders:Object.keys(daily.orders).length,dailyLimit:daily.limit,verified:process.argv.includes('--verify')}));
 }else if(initial.changed){
  await db.query('begin');transaction=true;await db.query("set local lock_timeout='2s';set local statement_timeout='25s';select pg_catalog.pg_advisory_xact_lock(731029,3)");
  const current=await inspect();if(!equal(current.rows,initial.rows)||!equal(current.live,initial.live))throw Error('Server changed during preflight');
  const prefix=`${out}/backup-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  writeFileSync(`${prefix}.json`,JSON.stringify({functions:current.rows},null,2));
  const grants=current.rows.map(row=>`revoke all on function ${row.signature} from public,anon,authenticated;\n${[row.public_execute?'public':null,row.anon?'anon':null,row.authenticated?'authenticated':null].filter(Boolean).map(role=>`grant execute on function ${row.signature} to ${role};`).join('\n')}`).join('\n');
  writeFileSync(`${prefix}-rollback.sql`,`begin;\nset local lock_timeout='2s';\nselect pg_catalog.pg_advisory_xact_lock(731029,3);\n${current.rows.map(r=>r.definition).join('\n')}\n${grants}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  await db.query(current.patch.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,''));
  const after=await inspect();if(after.changed||after.rows.some(r=>r.anon||r.public_execute||r.authenticated!==(r.proname==='rpg_action')))throw Error('Post-apply verification failed');
  const beforeAction=current.rows.find(r=>r.proname==='rpg_action').prosrc,afterAction=after.rows.find(r=>r.proname==='rpg_action').prosrc;
  if(clean(afterAction.replace(dailyOrderBranch,''))!==clean(beforeAction))throw Error('Unrelated action branches changed');
  const {dailyOrders:ignored,...afterOther}=after.live,{dailyOrders:oldIgnored,...beforeOther}=current.live;if(!equal(afterOther,beforeOther))throw Error('Unrelated catalog changed');
  await db.query('commit');transaction=false;
  const result={applied:true,verified:true,functions:2,orders:Object.keys(daily.orders).length,dailyLimit:daily.limit,reset:'00:00 UTC',characterRowsChanged:false,worldRowsChanged:false,rollback:`${prefix}-rollback.sql`,clientPublished:false};writeFileSync(`${out}/deployment.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }else console.log(JSON.stringify({alreadyInstalled:true,changed:false}));
}catch(error){if(transaction)await db.query('rollback').catch(()=>{});console.error(error.message);process.exitCode=1;}finally{await db.end();}
