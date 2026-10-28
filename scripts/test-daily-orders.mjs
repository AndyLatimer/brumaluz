import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {fixture} from './obtainability-fixture.mjs';
import {dailyOrdersPatch,dailyOrderBranch} from '../tools/build-daily-orders-patch.mjs';
const json=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const catalog=await json('src/data/generated/rpg-catalog.json'),daily=await json('src/data/dailyOrders.json'),orders=Object.values(daily.orders);
const pack=await build({stdin:{contents:"export {defaultChar} from './src/data/data';export {professionAction,professionState} from './src/data/professions';export {dailyOrderStatus} from './src/data/dailyOrders';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const client=await import(`data:text/javascript;base64,${Buffer.from(pack.outputFiles[0].contents).toString('base64')}`);
const inventory=(order,multiplier=1)=>[...Object.entries(order.ingredients).map(([id,n])=>({id,count:n*multiplier})),...Array(25-Object.keys(order.ingredients).length).fill(null)];
const deliver=(f,order,args={},req,rev)=>f.action('daily_order',{id:order.id,master:catalog.teachers[order.job].id,reward:order.reward,...args},req,rev);

test('daily supply orders cover twelve masters with basic items and stay separate from mastery',()=>{
 assert.deepEqual(catalog.dailyOrders,daily);assert.equal(daily.limit,3);assert.equal(daily.reset,'UTC');assert.equal(orders.length,12);
 assert.equal(new Set(orders.map(o=>o.job)).size,12);
 for(const order of orders){
  assert.ok(catalog.teachers[order.job]);assert.ok(order.reward>0);
  for(const[id,n]of Object.entries(order.ingredients)){assert.equal(catalog.items[id].tier,0);assert.ok(n>0&&n<=6);assert.ok(!catalog.equipment[id]);}
  if(['minero','lenador','recolector'].includes(order.job)){assert.equal(Object.values(order.ingredients).reduce((a,b)=>a+b),6);assert.equal(order.reward,50);}
  else{assert.deepEqual(order.ingredients,{[`componente_${order.job}_0`]:2});assert.equal(order.reward,75);}
 }
});

test('all twelve deliveries consume inventory, pay once and leave recipes, XP, practice and mastery untouched',{timeout:60000},async()=>{
 const f=await fixture();try{
  for(const order of orders){
   const progress={xp:{[order.job]:10000},crafts:{[order.job]:200},mastery:{[order.job]:2},projects:{preserved:1},learned:['componente_herreria_0']};
   await f.seed({inventory:inventory(order),rpg:progress});await f.move(catalog.teachers[order.job]);
   const request=randomUUID(),done=await deliver(f,order,{},request,0);
   assert.equal(done.wallet.pelines,5+order.reward);assert.ok(done.inventory.every(item=>item===null));assert.equal(done.rpg.dailyOrders.completed,1);
   for(const[key,value]of Object.entries(progress))assert.deepEqual(done.rpg[key],value,key);
   assert.deepEqual((await deliver(f,order,{},request,0)).wallet,done.wallet,'retry cannot duplicate reward');
  }
 }finally{await f.db.close();}
});

test('three deliveries are shared across masters; UTC midnight renews and old requests never pay again',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.db.exec("update test_clock set stamp='2026-10-27T23:59:59.5Z'");
  const a=daily.orders.suministro_lenador,b=daily.orders.piezas_herreria;
  await f.seed({inventory:[{id:'material_lenador_0',count:24},{id:'componente_herreria_0',count:4},...Array(23).fill(null)]});
  await f.move(catalog.teachers[a.job]);const request=randomUUID();await deliver(f,a,{},request,0);
  await f.move(catalog.teachers[b.job]);await deliver(f,b);await f.move(catalog.teachers[a.job]);let done=await deliver(f,a);
  assert.equal(done.rpg.dailyOrders.completed,3);assert.equal(done.wallet.pelines,180);
  const before=await f.data();await assert.rejects(()=>deliver(f,a),/tres encargos diarios/);assert.deepEqual(await f.data(),before);
  await f.step(.5);await f.move(catalog.teachers[b.job]);done=await deliver(f,b);
  assert.deepEqual(done.rpg.dailyOrders,{day:'2026-10-28',completed:1});assert.equal(done.wallet.pelines,255);
  const replay=await deliver(f,a,{},request,0);assert.equal(replay.wallet.pelines,255);assert.equal(replay.rpg.dailyOrders.completed,1);
 }finally{await f.db.close();}
});

test('delivery rejects wrong teacher, location, quote, missing and bound items atomically',{timeout:60000},async()=>{
 const f=await fixture();try{
  const order=daily.orders.suministro_minero,teacher=catalog.teachers[order.job];
  await f.seed({inventory:inventory(order)});await f.move(teacher);
  for(const args of [{master:'isberto'},{reward:999999},{id:'made_up'}]){
   const before=await f.data();await assert.rejects(()=>deliver(f,order,args));assert.deepEqual(await f.data(),before);
  }
  await f.move({...teacher,x:teacher.x+3.1});await assert.rejects(()=>deliver(f,order),/maestro/);
  await f.move({...teacher,location:'casa_de_isberto_interior'});await assert.rejects(()=>deliver(f,order),/maestro/);
  await f.move(teacher);await f.seed({inventory:[{id:'material_minero_0',count:4},{id:'gema_0',count:2,bound:true},...Array(23).fill(null)]});
  await f.move(teacher);const before=await f.data();await assert.rejects(()=>deliver(f,order),/Faltan/);assert.deepEqual(await f.data(),before,'partial consumption must roll back');
  await f.seed({inventory:[{id:'material_minero_0',count:4,bound:true},{id:'material_minero_0',count:2},{id:'material_minero_0',count:2},{id:'gema_0',count:2},...Array(21).fill(null)]});
  await f.move(teacher);const done=await deliver(f,order);assert.deepEqual(done.inventory[0],{id:'material_minero_0',count:4,bound:true});assert.equal(done.wallet.pelines,55);
  await f.seed({health:0,inventory:inventory(order)});await assert.rejects(()=>deliver(f,order),/vivo/);
  await f.seed({inventory:inventory(order),combatEncounter:{status:'active',engaged:true}});await f.move(teacher);await assert.rejects(()=>deliver(f,order),/combate/);
 }finally{await f.db.close();}
});

test('parallel attempts cannot exceed the shared daily allowance',{timeout:60000},async()=>{
 const f=await fixture();try{
  const order=daily.orders.suministro_lenador;await f.seed({inventory:inventory(order,10)});await f.move(catalog.teachers[order.job]);
  const results=await Promise.allSettled(Array.from({length:5},()=>deliver(f,order)));
  assert.ok(results.filter(r=>r.status==='fulfilled').length<=3);
  // Stale revisions may reject a racing request sooner; retrying can fill but never exceed three.
  while((await f.data()).rpg?.dailyOrders?.completed<3)await deliver(f,order);
  await assert.rejects(()=>deliver(f,order),/tres encargos diarios/);
  const done=await f.data();assert.equal(done.wallet.pelines,155);assert.equal(done.inventory[0].count,42);
 }finally{await f.db.close();}
});

test('development and SQL agree on all deliveries and reset at UTC rather than local midnight',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.db.exec("update test_clock set stamp='2026-10-27T23:59:59Z'");const now=Date.parse('2026-10-27T23:59:59Z')/1000;
  for(const order of orders){
   const teacher=catalog.teachers[order.job],data={...client.defaultChar(),health:66,inventory:inventory(order),wallet:{pelines:5},location:teacher.location,position:{x:teacher.x,z:teacher.z,yaw:0},rpg:client.professionState(undefined,now)};
   await f.seed(data);await f.move(teacher);const sql=await deliver(f,order);
   client.professionAction(data,'daily_order',{id:order.id,master:teacher.id,reward:order.reward},now);
   assert.deepEqual(data.inventory,sql.inventory);assert.deepEqual(data.wallet,sql.wallet);assert.deepEqual(data.rpg.dailyOrders,sql.rpg.dailyOrders);
  }
  const state={dailyOrders:{day:'2026-10-27',completed:3}};assert.equal(client.dailyOrderStatus(state,now).remaining,0);assert.equal(client.dailyOrderStatus(state,now+1).remaining,3);
 }finally{await f.db.close();}
});

test('the migration preserves other catalog entries, action branches, player data and permissions',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.seed({name:'Preserved',rpg:{projects:{existing:2},mastery:{herreria:1}}});const before=await f.data();
  const row=(await f.db.query("select pg_get_functiondef(oid) definition from pg_proc where proname='rpg_action'")).rows[0];
  const legacy=row.definition.replace(dailyOrderBranch,'');assert.ok(!legacy.includes("elsif p_action='daily_order' then"));
  const extended={...catalog,unrelated:{keep:'unchanged'}};
  await f.db.exec(dailyOrdersPatch(extended,legacy));await f.db.exec(dailyOrdersPatch(extended));
  assert.deepEqual(await f.data(),before);assert.deepEqual((await f.db.query('select game_rpg_catalog() c')).rows[0].c,extended);
  const prosrc=(await f.db.query("select prosrc from pg_proc where proname='rpg_action'")).rows[0].prosrc;
  assert.ok(prosrc.includes(dailyOrderBranch));assert.ok(prosrc.includes("elsif p_action='mastery' then"));assert.ok(prosrc.includes("elsif p_action='buy_recipe' then"));
  for(const name of ['game_rpg_catalog()','rpg_action(uuid,text,jsonb,uuid,bigint)'])assert.equal((await f.db.query("select has_function_privilege('anon',$1,'EXECUTE') allowed",['public.'+name])).rows[0].allowed,false);
  assert.equal((await f.db.query("select has_function_privilege('authenticated','public.rpg_action(uuid,text,jsonb,uuid,bigint)','EXECUTE') allowed")).rows[0].allowed,true);
 }finally{await f.db.close();}
});
