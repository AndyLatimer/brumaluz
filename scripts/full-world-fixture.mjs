// Entire repository SQL in an isolated PostgreSQL/WASM world. Never reads credentials.
import {readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

export async function fullWorldFixture(){
 const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 const uid=randomUUID(),session=randomUUID();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create table public.test_clock(stamp timestamptz);insert into public.test_clock values('2026-10-27T12:00:00Z');
 create function public.test_now() returns timestamptz language sql stable as $$select stamp from public.test_clock$$;
 create function auth.uid() returns uuid language sql stable as $$select '${uid}'::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select '{"email":"route-test@example.invalid"}'::jsonb$$;
 `);
 const clock=sql=>sql.replace(/\bclock_timestamp\(\)/g,'public.test_now()').replace(/\bnow\(\)/g,'public.test_now()');
 const apply=async(path,label)=>{try{await db.exec(clock(await readFile(path,'utf8')));}catch(error){await db.close();throw Error(`Isolated schema ${label}: ${error.message}`);}};
 await apply(new URL('../supabase/schema.sql',import.meta.url),'schema');
 for(const file of (await readdir(new URL('../supabase/server/',import.meta.url))).filter(file=>file.endsWith('.sql')).sort())await apply(new URL(`../supabase/server/${file}`,import.meta.url),file);
 await apply(new URL('../supabase/world.sql',import.meta.url),'published maps');
 // Materialize the immutable catalogs once: PostgreSQL/WASM otherwise spends
 // most review time reparsing their large literals. Values remain identical;
 // this fixture does not benchmark database performance.
 await db.exec(`create table public.test_catalogs as select public.game_rpg_catalog() rpg,public.game_wilderness_catalog() wilderness;
 create or replace function public.game_rpg_catalog() returns jsonb language sql stable set search_path='' as $$select rpg from public.test_catalogs$$;
 create or replace function public.game_wilderness_catalog() returns jsonb language sql stable set search_path='' as $$select wilderness from public.test_catalogs$$;`);
 await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[uid,'route-test@example.invalid',{username:'RouteTester'}]);
 let queue=Promise.resolve();
 const serial=task=>{const result=queue.then(task);queue=result.catch(()=>{});return result;};
 return{db,uid,session,
  rpc(name,args={}){return serial(async()=>{
   if(!/^[a-z][a-z0-9_]*$/.test(name)||Object.keys(args).some(key=>!/^p_[a-z0-9_]+$/.test(key)))throw Error('Invalid fixture RPC');
   const keys=Object.keys(args),values=keys.map(key=>typeof args[key]==='object'&&args[key]!==null?JSON.stringify(args[key]):args[key]);
   const sql=`select public.${name}(${keys.map((key,i)=>`${key}=>$${i+1}`).join(',')}) result`;
   return(await db.query(sql,values)).rows[0].result;
  });},
  step(seconds){return serial(()=>db.query("update public.test_clock set stamp=stamp+$1*interval '1 second'",[seconds]));},
  async stamp(){await queue;return Number((await db.query('select extract(epoch from public.test_now()) stamp')).rows[0].stamp);},
  async character(id){await queue;return(await db.query('select data from public.characters where id=$1',[id])).rows[0].data;},
  async close(){await queue;await db.close();},
 };
}
