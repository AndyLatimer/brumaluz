import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {fixture} from './obtainability-fixture.mjs';
import {recipeScrollPatch,scrollBranch,legacyRecipeBranch,withoutRecipeBranch,cleanRecipeSql} from '../tools/build-recipe-scroll-patch.mjs';
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
const bundle=await build({stdin:{contents:"export {defaultChar} from './src/data/data';export {professionAction,professionState} from './src/data/professions';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const client=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const buy=(f,id,request)=>f.action('buy_recipe',{id,master:catalog.teachers[catalog.recipes[id].job].id,price:catalog.recipes[id].price},request);
const use=async(f,slot,request)=>{const d=await f.action('state'),item=d.inventory[slot];return f.action('use_recipe',{slot,id:item?.id,instanceId:item?.instanceId},request);};

test('every recipe has a usable single-slot consumable, including Aprendiz and leather processing',()=>{
 for(const r of Object.values(catalog.recipes)){
  const item=catalog.items[`receta_${r.id}`];assert.ok(item,r.id);assert.equal(item.recipe,r.id);assert.equal(item.stack,1);assert.equal(item.usable,true);
  assert.equal(r.source,r.tier===5?'drop':'trainer');
 }
});

test('buying gives a scroll; using it elsewhere consumes only that copy and teaches once',{timeout:60000},async()=>{
 const f=await fixture();try{
  const id='componente_herreria_0';await f.seed({wallet:{pelines:100}});await f.move(catalog.teachers.herreria);
  const request=randomUUID(),bought=await buy(f,id,request);assert.equal(bought.wallet.pelines,50);assert.ok(!bought.rpg.learned.includes(id));assert.equal(bought.inventory[0].id,`receta_${id}`);
  const retry=await f.action('buy_recipe',{id,master:'isberto',price:50},request,0);assert.equal(retry.wallet.pelines,50);assert.equal(retry.inventory.filter(Boolean).length,1);
  await f.move({location:'pompelin',x:50,z:50});const req=randomUUID(),learned=await use(f,0,req);assert.ok(learned.rpg.learned.includes(id));assert.equal(learned.inventory[0],null);assert.equal(learned.wallet.pelines,50);
  const replay=await f.action('use_recipe',{slot:0,id:`receta_${id}`},req,0);assert.equal(replay.rpg.learned.filter(x=>x===id).length,1);
 }finally{await f.db.close();}
});

test('full bags, failed payments and exceptional purchases never charge or grant knowledge',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.seed({wallet:{pelines:1000},inventory:Array.from({length:25},()=>({id:'cuero_0',count:99}))});await f.move(catalog.teachers.herreria);
  let before=await f.data();await assert.rejects(()=>buy(f,'componente_herreria_0'),/mochila/);assert.deepEqual(await f.data(),before);
  await f.seed({wallet:{pelines:49}});await f.move(catalog.teachers.herreria);before=await f.data();await assert.rejects(()=>buy(f,'componente_herreria_0'),/NOT_ENOUGH/);assert.deepEqual(await f.data(),before);
  await f.seed({wallet:{pelines:999999},rpg:{xp:{peleteria:10000},mastery:{peleteria:3}}});await f.move(catalog.teachers.peleteria);before=await f.data();await assert.rejects(()=>buy(f,'curtir_cuero_5'),/no est.*venta/);assert.deepEqual(await f.data(),before);
 }finally{await f.db.close();}
});

test('rank, known recipes and stale slots retain the consumable; selected duplicate is respected',{timeout:60000},async()=>{
 const f=await fixture();try{
  const id='curtir_cuero_1',token=`receta_${id}`;
  await f.seed({inventory:[{id:token,count:1},{id:token,count:1},...Array(23).fill(null)]});await f.move({location:'pompelin',x:20,z:20});await f.action('state');
  let before=await f.data();await assert.rejects(()=>use(f,0),/dominio/);assert.deepEqual(await f.data(),before);
  await f.seed({...before,rpg:{...before.rpg,xp:{peleteria:100}}});before=await f.data();
  await assert.rejects(()=>f.action('use_recipe',{slot:0,id:'receta_componente_herreria_0'}),/casilla/);assert.deepEqual(await f.data(),before);
  await assert.rejects(()=>f.action('use_recipe',{slot:0,id:token,instanceId:randomUUID()}),/casilla/);assert.deepEqual(await f.data(),before);
  const done=await use(f,1);assert.equal(done.inventory[1],null);assert.equal(done.inventory[0].id,token);assert.ok(done.rpg.learned.includes(id));
  before=await f.data();await assert.rejects(()=>use(f,0),/Ya conoces/);assert.deepEqual(await f.data(),before);
 }finally{await f.db.close();}
});

test('exceptional loot scrolls are learned from the bag without returning to the master',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.seed({rpg:{xp:{peleteria:10000},mastery:{peleteria:3}},inventory:[{id:'receta_curtir_cuero_5',count:1},...Array(24).fill(null)]});await f.move({location:'pompelin',x:100,z:-500});
  const d=await use(f,0);assert.equal(d.inventory[0],null);assert.ok(d.rpg.learned.includes('curtir_cuero_5'));assert.equal(d.wallet.pelines,5);
 }finally{await f.db.close();}
});

test('development mirrors purchase and consumption, preserving failed actions',{timeout:60000},async()=>{
 const f=await fixture();try{
  const id='componente_herreria_0',teacher=catalog.teachers.herreria,now=Date.now()/1000;
  const d={...client.defaultChar(),health:66,wallet:{pelines:100},location:teacher.location,position:{x:teacher.x,z:teacher.z,yaw:0},rpg:client.professionState(undefined,now)};
  client.professionAction(d,'buy_recipe',{id,master:teacher.id,price:50},now);assert.equal(d.inventory[0].id,`receta_${id}`);assert.ok(!d.rpg.learned.includes(id));
  const item=d.inventory[0];client.professionAction(d,'use_recipe',{slot:0,id:item.id,instanceId:item.instanceId},now);assert.equal(d.inventory[0],null);assert.ok(d.rpg.learned.includes(id));assert.equal(d.wallet.pelines,50);
  const before=structuredClone(d);assert.throws(()=>client.professionAction(d,'use_recipe',{slot:0,id:item.id},now),/casilla/);assert.deepEqual(d,before);
 }finally{await f.db.close();}
});

test('the migration preserves player knowledge, daily orders and unrelated server branches',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.seed({rpg:{learned:['componente_herreria_0'],dailyOrders:{day:'2026-10-27',completed:2},mastery:{herreria:1}}});const before=await f.data();
  const row=(await f.db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where proname='rpg_action'")).rows[0],legacy=row.definition.replace(scrollBranch,legacyRecipeBranch),extended={...catalog,unrelated:{preserved:true}};
  await f.db.exec(recipeScrollPatch(extended,legacy));
  const installed=(await f.db.query("select pg_get_functiondef(oid) definition from pg_proc where proname='rpg_action'")).rows[0].definition;
  await f.db.exec(recipeScrollPatch(extended,installed));assert.deepEqual(await f.data(),before);
  const after=(await f.db.query("select prosrc from pg_proc where proname='rpg_action'")).rows[0].prosrc;
  assert.equal(cleanRecipeSql(withoutRecipeBranch(after)),cleanRecipeSql(withoutRecipeBranch(row.prosrc)));assert.ok(after.includes("elsif p_action='daily_order' then"));
  assert.deepEqual((await f.db.query('select game_rpg_catalog() c')).rows[0].c,extended);
  assert.equal((await f.db.query("select has_function_privilege('anon','public.rpg_action(uuid,text,jsonb,uuid,bigint)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await f.db.close();}
});
