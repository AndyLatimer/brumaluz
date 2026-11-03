// Uses synthetic accounts in a rolled-back transaction. Never saves game progress.
import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimePerformanceSql,runtimeMetadataIds} from '../scripts/runtime-performance-sql.mjs';

if(process.argv.includes('--configured'))for(const file of ['.env.local','.env']){
 if(!fs.existsSync(file))continue;
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
 }
}
const url=process.env.SUPABASE_TEST_DB_URL??(process.argv.includes('--configured')?process.env.SUPABASE_DB_URL:null);
if(!url)throw Error('Set SUPABASE_TEST_DB_URL or pass --configured to measure the configured database.');
const db=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const uid=randomUUID(),id=randomUUID(),session=randomUUID(),position={x:156.5,z:0,yaw:0};
const catalog=JSON.parse(fs.readFileSync('src/data/generated/rpg-catalog.json','utf8'));
const motion={...position,facing:0,jump:0,wave:0};
const base={name:'Sonda',race:'humano',sex:'masculino',cls:'guerrero',level:1,health:-1,resource:-1,location:'brumaluz',position,introSeen:true,welcome:{origin:0,stage:'available'},equipment:{weapon:{id:'espada_inicial',count:1,instanceId:randomUUID()}},attributePoints:{}};
const armor=Object.fromEntries(Object.entries(catalog.equipment).filter(([,m])=>m.cls==='guerrero'&&m.tier===3&&['head','chest','hands','legs'].includes(m.slot)).map(([key,m])=>[m.slot,{id:key,count:1,instanceId:randomUUID()}]));
const variants={novice:base,equipped:{...base,level:20,equipment:{...base.equipment,...armor},foodBuff:{itemId:'comida_3',remaining:900}},full_bag:{...base,inventory:Array.from({length:25},()=>({id:'material_minero_0',count:50}))}};
async function metadata(){
 const ids=runtimeMetadataIds();
 return (await db.query('select id,public.game_equipment_item(id) equipment,public.game_item(id) item from unnest($1::text[]) id order by id',[ids])).rows;
}
async function measure(label,sql,args,prepare){
 const samples=[];
 for(let i=0;i<6;i++){
  if(prepare)await prepare();
  const result=await db.query('explain(analyze,format json,timing off) '+sql,args);
  const plan=result.rows[0]['QUERY PLAN'][0];samples.push(plan['Execution Time']+plan['Planning Time']);
 }
 const warm=samples.slice(1).sort((a,b)=>a-b);
 return {label,coldMs:samples[0],medianMs:warm[2],maxMs:Math.max(...warm)};
}
async function benchmark(){
 await db.query('savepoint fixture');
 try{
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[uid,{username:'perf_'+uid.replaceAll('-','').slice(0,12)}]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);
  await db.query('insert into public.characters(id,user_id,name,data)values($1,$2,$3,$4)',[id,uid,base.name,base]);
  await db.query('select public.world_join($1,$2)',[id,session]);
  const timings=[],values=[];
  for(const [name,d] of Object.entries(variants)){
   await db.query('update public.characters set data=$1 where id=$2',[d,id]);
   timings.push(await measure(name+':world_sync','select public.world_sync($1,$2,$3)',[id,session,motion]));
   values.push((await db.query('select public.game_public_vitals($1) vitals,public.game_set_bonuses($1) bonuses',[d])).rows[0]);
  }
  // Reset the offer before each acceptance, as in independent new-player sessions.
  timings.push(await measure('accept_quest',"select public.welcome_action($1,'accept') is not null",[id],()=>db.query('update public.characters set data=$1 where id=$2',[base,id])));
  return {timings,values};
 }finally{await db.query('rollback to savepoint fixture');await db.query('release savepoint fixture');}
}
try{
 await db.connect();await db.query('begin');
 await db.query("set local statement_timeout='15s';set local lock_timeout='2s';set local track_functions='all'");
 const before=await benchmark();
 const profileBefore=(await db.query('select funcname,calls::int,total_time,self_time from pg_stat_xact_user_functions')).rows;
 const metadataBefore=await metadata();
 await db.query(runtimePerformanceSql());
 const after=await benchmark();
 assert.deepEqual(after.values,before.values,'Optimization must preserve public vitals and bonuses');
 assert.deepEqual(await metadata(),metadataBefore,'Optimization must preserve all item/equipment metadata');
 const report={date:new Date().toISOString(),scope:'PostgreSQL execution + planning; synthetic characters; transaction rolled back; excludes HTTP/rendering',parity:true,metadataChecked:metadataBefore.length,results:before.timings.map((v,i)=>({...v,afterColdMs:after.timings[i].coldMs,afterMedianMs:after.timings[i].medianMs,afterMaxMs:after.timings[i].maxMs,speedup:Number((v.medianMs/after.timings[i].medianMs).toFixed(1))})),profileBefore:profileBefore.sort((a,b)=>b.self_time-a.self_time).slice(0,10)};
 console.log(JSON.stringify(report,null,2));
 if(process.argv.includes('--save')){fs.mkdirSync('art/performance-review',{recursive:true});fs.writeFileSync('art/performance-review/server.json',JSON.stringify(report,null,2)+'\n');}
}finally{await db.query('rollback').catch(()=>{});await db.end();}
