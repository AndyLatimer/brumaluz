// One-function correction. Read-only unless --apply; never updates world rows.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import pg from 'pg';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured');
const source=readFileSync('supabase/server/28-shared-wilderness.sql','utf8'),start=source.indexOf('create or replace function public.game_wilderness_finish('),definition=source.slice(start,source.indexOf('$$;',start)+3),body=definition.split('as $$')[1].split('$$;')[0].trim(),clean=s=>s.replace(/\r\n/g,'\n').trim();
const fixed="'respawnAt',stamp+coalesce((select (site->>'respawn')::numeric from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') site where site->>'id'=m->>'spawn'),90)";
if(!body.includes(fixed))throw Error('Unexpected local fix');
const out='art/recipe-training-review';mkdirSync(out,{recursive:true});
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:30000});let transaction=false;
const inspect=async()=>{
 const rows=(await db.query("select prosrc,pg_get_functiondef(oid) definition,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc where pronamespace='public'::regnamespace and proname='game_wilderness_finish'")).rows;
 if(rows.length!==1)throw Error('Missing or overloaded function');
 const row=rows[0];
 if(!row.prosrc.includes(fixed)&&(row.prosrc.match(/'respawnAt',stamp\+90/g)??[]).length!==1)throw Error('Unexpected live timer; refusing replacement');
 if(row.anon||row.authenticated||row.public_execute)throw Error('Unexpected helper permissions');return row;
};
try{
 await db.connect();let row=await inspect();
 const changed=!row.prosrc.includes(fixed);
 if(process.argv.includes('--apply')&&changed){
  await db.query('begin');transaction=true;await db.query("set local lock_timeout='2s';select pg_catalog.pg_advisory_xact_lock(731029,3)");row=await inspect();
  const prefix=`${out}/respawn-backup-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  writeFileSync(`${prefix}.sql`,`begin;\n${row.definition}\nrevoke all on function public.game_wilderness_finish(jsonb) from public,anon,authenticated;\ncommit;\n`);
  const expected=row.prosrc.replace("'respawnAt',stamp+90",fixed);
  await db.query(row.definition.replace("'respawnAt',stamp+90",fixed));await db.query('revoke all on function public.game_wilderness_finish(jsonb) from public,anon,authenticated');
  if(clean((await inspect()).prosrc)!==clean(expected))throw Error('Post-apply mismatch');
  await db.query('commit');transaction=false;
  const result={applied:true,verified:true,functions:1,characterRowsChanged:false,worldRowsChanged:false,rollback:`${prefix}.sql`};writeFileSync(`${out}/respawn-deployment.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }else{if(process.argv.includes('--verify')&&changed)throw Error('Fix not installed');console.log(JSON.stringify({readOnly:true,changed,verified:!changed}));}
}catch(error){if(transaction)await db.query('rollback');console.error(error.message);process.exitCode=1;}finally{await db.end();}
