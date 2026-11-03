// Publishes supabase/server/ + supabase/world.sql in one transaction. Dry run (default) applies, verifies and rolls back.
// --apply saves a full backup (functions, grants and public table data) outside the repository before committing.
// Usage: node scripts/apply-server-release.mjs [--apply] [--backup-dir=<dir>]
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import pg from 'pg';
import {serverSql} from './server-sql.mjs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
if(!process.env.SUPABASE_DB_URL)throw Error('SUPABASE_DB_URL is not configured');
const apply=process.argv.includes('--apply'),backupDir=process.argv.find(a=>a.startsWith('--backup-dir='))?.slice(13);
if(apply&&!backupDir)throw Error('--apply requires --backup-dir outside the repository (backups contain player data)');
const server=serverSql(),world=readFileSync('supabase/world.sql','utf8');
const norm=s=>s.replace(/public\.test_now\(\)|clock_timestamp\(\)|now\(\)/g,'__clock__').replace(/\s+/g,' ').trim();
// world.sql runs last and regenerates some map-derived functions, so its definitions win.
const local=new Map(),release=server+'\n'+world;
for(const m of release.matchAll(/create or replace function public\.(\w+)\(/g)){const as=release.indexOf('as $',m.index),tag=release.slice(as+3,release.indexOf('$',as+4)+1),start=as+3+tag.length;local.set(m[1],norm(release.slice(start,release.indexOf(tag,start))));}
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const functions=async()=>(await db.query(`select oid::regprocedure::text signature,proname,prosrc,pg_get_functiondef(oid) definition,proacl::text acl,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated from pg_proc where pronamespace='public'::regnamespace and prokind='f' order by 1`)).rows;
const tables=async()=>(await db.query(`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1`)).rows.map(r=>r.relname);
const characters=async()=>new Map((await db.query('select id,name,md5(data::text) hash,data from public.characters')).rows.map(r=>[r.id,r]));
let transaction=false;
try{
 await db.connect();
 await db.query('begin');transaction=true;
 await db.query("set local lock_timeout='5s'");
 const beforeFns=await functions(),beforeTables=await tables(),beforeChars=await characters();
 if(apply){
  mkdirSync(backupDir,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-'),prefix=join(backupDir,`server-backup-${stamp}`);
  const data={};for(const t of beforeTables)data[t]=(await db.query(`select * from public.${t}`)).rows;
  writeFileSync(`${prefix}-data.json`,JSON.stringify(data));
  writeFileSync(`${prefix}-functions.json`,JSON.stringify(beforeFns,null,1));
  const grants=beforeFns.map(f=>`revoke all on function ${f.signature} from public,anon,authenticated;\n${[f.acl===null||/(^|[{,])=X/.test(f.acl??'')?'public':null,f.anon?'anon':null,f.authenticated?'authenticated':null].filter(Boolean).map(r=>`grant execute on function ${f.signature} to ${r};`).join('\n')}`).join('\n');
  writeFileSync(`${prefix}-functions-rollback.sql`,`-- Restores function bodies and grants. Table data is in the -data.json file.\nbegin;\n${beforeFns.map(f=>f.definition+';').join('\n')}\n${grants}\nnotify pgrst, 'reload schema';\ncommit;\n`);
  console.log('backup',prefix);
 }
 await db.query(server);await db.query(world);
 const afterFns=await functions(),afterChars=await characters();
 // Legacy overloads may share a name with the current definition; one of them must match.
 const mismatched=[...local].filter(([n,b])=>!afterFns.some(f=>f.proname===n&&norm(f.prosrc)===b)).map(([n])=>n);
 if(mismatched.length)throw Error('Installed functions differ from local SQL: '+mismatched.join(', '));
 const before=new Map(beforeFns.map(f=>[f.signature,f]));
 const newlyExposed=afterFns.filter(f=>f.anon&&!before.get(f.signature)?.anon).map(f=>f.signature);
 const newAuthenticated=afterFns.filter(f=>f.authenticated&&!before.has(f.signature)).map(f=>f.signature);
 const changedChars=[];for(const[id,b]of beforeChars){const a=afterChars.get(id);if(!a){changedChars.push({name:b.name,deleted:true});continue;}if(a.hash!==b.hash){const keys=[...new Set([...Object.keys(a.data),...Object.keys(b.data)])].filter(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k]));changedChars.push({name:b.name,keys});}}
 const counts={};for(const t of await tables())counts[t]=(await db.query(`select count(*)::int n from public.${t}`)).rows[0].n;
 const report={mode:apply?'apply':'dry-run',localFunctions:local.size,newFunctions:afterFns.length-beforeFns.length,newTables:(await tables()).filter(t=>!beforeTables.includes(t)),newlyExposedToAnon:newlyExposed,newForAuthenticated:newAuthenticated,charactersChanged:changedChars,characters:afterChars.size,rowCounts:counts};
 if(newlyExposed.length)throw Error('Functions newly executable by anon: '+newlyExposed.join(', '));
 if(afterChars.size<beforeChars.size)throw Error('Characters would be deleted');
 if(apply){await db.query("notify pgrst, 'reload schema'");await db.query('commit');transaction=false;}
 else{await db.query('rollback');transaction=false;}
 console.log(JSON.stringify(report,null,1));
}catch(error){if(transaction)await db.query('rollback').catch(()=>{});console.error('FAILED (rolled back):',error.message);if(error.where)console.error(error.where);process.exitCode=1;}
finally{await db.end();}
