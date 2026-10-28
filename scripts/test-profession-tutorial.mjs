import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {fixture} from './obtainability-fixture.mjs';
import {professionTutorialPatch,stripTutorialIntegration,cleanTutorialSql} from '../tools/build-profession-tutorial-patch.mjs';
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8')),defs=JSON.parse(await readFile('src/data/professionTutorial.json','utf8')),wild=JSON.parse(await readFile('src/data/generated/wilderness.json','utf8'));
const pack=await build({stdin:{contents:"export {defaultChar} from './src/data/data';export {professionAction,professionState} from './src/data/professions';export * from './src/data/professionTutorial';export {currentQuest} from './src/ui/questTracking';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const client=await import(`data:text/javascript;base64,${Buffer.from(pack.outputFiles[0].contents).toString('base64')}`);
const count=(d,id)=>d.inventory.reduce((n,item)=>n+(item?.id===id?item.count:0),0);
async function start(f,job,extra={}){
 await f.seed({wallet:{pelines:70},welcome:{stage:'completed',origin:0},shadowQuest:'returned',...extra});await f.move(defs.mentor);
 return f.action('tutorial_accept',{job,master:'gnomi'});
}
async function visit(f,job){await f.move(catalog.teachers[job]);return f.action('tutorial_visit',{master:catalog.teachers[job].id});}
async function equip(f,job){await f.move(catalog.teachers.herreria);let d=await f.action('buy_tool',{job});const slot=d.inventory.findIndex(i=>i?.id===`herramienta_${job}_0`);return f.action('tool',{slot});}
async function gather(f,id,amount){
 for(let i=0;i<amount;i++){
  const d=await f.data(),now=Number((await f.db.query('select extract(epoch from test_now()) s')).rows[0].s);
  let node=Object.values(catalog.nodes).find(n=>n.item===id&&(d.rpg.nodes[n.id]??0)<=now);
  if(!node){node=Object.values(catalog.nodes).find(n=>n.item===id);await f.step(Math.max(0,d.rpg.nodes[node.id]-now)+1);}
  await f.move(node);await f.action('gather_start',{id:node.id});await f.step(node.seconds+1);await f.action('gather_finish',{id:node.id});
 }
}
async function lootMaterial(f,id,n){
 const enemy=Object.entries(wild.enemies).find(([,e])=>e.loot[id]);assert.ok(enemy,`Missing source for ${id}`);
 while(count(await f.data(),id)<n){let d=await f.data();const loot=(await f.db.query('select game_wilderness_loot($1,$2) loot',[d,{enemy:enemy[0]}])).rows[0].loot;for(const item of loot)d=(await f.db.query('select game_rpg_give($1,$2,false) d',[d,item])).rows[0].d;await f.seed(d);}
}

test('the chosen profession runs its real loop for every master, without free recipes or waived daily limits',{timeout:120000},async()=>{
 const f=await fixture();try{
  for(const[job,cfg]of Object.entries(defs.jobs)){
   let d=await start(f,job,{experience:90});assert.equal(client.currentQuest(d),'profession');await visit(f,job);await equip(f,cfg.gatherJob);
   if(cfg.recipe){await f.move(catalog.teachers[job]);await f.purchase(cfg.recipe);}
   const needs=cfg.recipe?Object.fromEntries(Object.entries(catalog.recipes[cfg.recipe].ingredients).map(([id,n])=>[id,n*2])):catalog.dailyOrders.orders[cfg.order].ingredients;
   for(const[id,n]of Object.entries(needs)){
    const node=Object.values(catalog.nodes).find(n=>n.item===id&&n.job===cfg.gatherJob);
    if(node)await gather(f,id,Math.max(0,n-count(await f.data(),id)));else await lootMaterial(f,id,n);
   }
   d=await f.data();assert.ok(d.rpg.tutorial.gathered>=1);assert.equal(client.tutorialStep(d),cfg.recipe?'craft':'deliver');
   if(cfg.recipe){
    await f.move(catalog.teachers[job]);d=await f.action('craft',{id:cfg.recipe,count:2});
    if(catalog.recipes[cfg.recipe].seconds){
     assert.equal(d.rpg.tutorial.collected,0);await assert.rejects(()=>f.action('tutorial_complete',{master:catalog.teachers[job].id}),/pasos normales/);
     await f.step(catalog.recipes[cfg.recipe].seconds*2+1);
     for(const id of d.rpg.tutorial.jobIds)await f.action('collect',{id});
    }
    d=await f.data();assert.equal(d.rpg.tutorial.collected,2);assert.equal(client.tutorialStep(d),'deliver');
   }
   await f.move(catalog.teachers[job]);d=await f.action('daily_order',{id:cfg.order,master:catalog.teachers[job].id,reward:catalog.dailyOrders.orders[cfg.order].reward});
   assert.equal(d.rpg.dailyOrders.completed,1);assert.equal(d.rpg.tutorial.delivered,true);assert.equal(client.tutorialStep(d),'report');const before=d.wallet.pelines;
   const req=randomUUID(),rev=d.rpg.revision;d=await f.action('tutorial_complete',{master:catalog.teachers[job].id},req,rev);
   assert.equal(d.rpg.tutorial.status,'completed');assert.equal(d.wallet.pelines,before);assert.equal(d.level,2);assert.equal(d.experience,30);assert.equal(client.currentQuest(d),null);
   assert.deepEqual((await f.action('tutorial_complete',{master:catalog.teachers[job].id},req,rev)).rpg.tutorial,d.rpg.tutorial);
   await assert.rejects(()=>f.action('tutorial_complete',{master:catalog.teachers[job].id}),/pendiente/);
  }
 }finally{await f.db.close();}
});

test('the offer enforces Gnomi, the previous story and a single persisted choice',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.seed({welcome:{stage:'active',origin:0},shadowQuest:null});await f.move(defs.mentor);await assert.rejects(()=>f.action('tutorial_accept',{job:'herreria',master:'gnomi'}),/bienvenida/);
  await f.seed({welcome:{stage:'completed',origin:0},shadowQuest:'returned'});await f.move({...defs.mentor,x:defs.mentor.x+5});await assert.rejects(()=>f.action('tutorial_accept',{job:'herreria',master:'gnomi'}),/Acércate/);
  await f.move(defs.mentor);await assert.rejects(()=>f.action('tutorial_accept',{job:'inventado',master:'gnomi'}),/válido/);
  let d=await f.action('tutorial_accept',{job:'herreria',master:'gnomi'});assert.equal(d.rpg.tutorial.job,'herreria');
  await assert.rejects(()=>f.action('tutorial_accept',{job:'cocina',master:'gnomi'}),/elegida/);
  await f.move(catalog.teachers.cocina);await assert.rejects(()=>f.action('tutorial_visit',{master:catalog.teachers.cocina.id}),/elegido/);
  const snapshot=await f.data();await f.action('state');d=await f.data();assert.deepEqual(d.rpg.tutorial,snapshot.rpg.tutorial,'reconnection/state does not reset the choice');
 }finally{await f.db.close();}
});

test('cancelled or earlier jobs cannot provide fake tutorial completion, and cancellation returns to crafting',{timeout:60000},async()=>{
 const f=await fixture();try{
  await start(f,'herreria');await visit(f,'herreria');await equip(f,'minero');await f.move(catalog.teachers.herreria);await f.purchase('componente_herreria_0');await gather(f,'material_minero_0',6);
  await f.move(catalog.teachers.herreria);let d=await f.action('craft',{id:'componente_herreria_0',count:2});const ids=d.rpg.tutorial.jobIds;
  for(const id of ids)await f.action('cancel',{id});d=await f.data();assert.equal(d.rpg.tutorial.collected,0);assert.equal(d.rpg.tutorial.crafted,0);assert.deepEqual(d.rpg.tutorial.jobIds,[]);
  await assert.rejects(()=>f.action('tutorial_complete',{master:'isberto'}),/pasos normales/);
  assert.ok(!d.rpg.tutorial.delivered);
 }finally{await f.db.close();}
});

test('normal daily exhaustion blocks the delivery without consuming the lesson or bypassing the cap',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.db.exec("update test_clock set stamp='2026-10-27T23:58:00Z'");await start(f,'lenador',{rpg:{dailyOrders:{day:'2026-10-27',completed:3}}});await visit(f,'lenador');await equip(f,'lenador');await gather(f,'material_lenador_0',6);await f.move(catalog.teachers.lenador);
  const before=await f.data();await assert.rejects(()=>f.action('daily_order',{id:'suministro_lenador',master:'maestro_lenador',reward:50}),/tres encargos/);assert.deepEqual(await f.data(),before);assert.equal(before.rpg.tutorial.delivered,false);
  await f.step(130);const d=await f.action('daily_order',{id:'suministro_lenador',master:'maestro_lenador',reward:50});assert.equal(d.rpg.dailyOrders.completed,1);assert.ok(d.rpg.tutorial.delivered);
 }finally{await f.db.close();}
});

test('existing knowledge/tools are recognized but old inventory does not replace gathering and personal production',{timeout:60000},async()=>{
 const f=await fixture();try{
  const d=await start(f,'herreria',{rpg:{learned:['componente_herreria_0'],tools:{minero:{id:'herramienta_minero_0',count:1,durability:100}}},inventory:[{id:'componente_herreria_0',count:2},...Array(24).fill(null)]});
  assert.ok(d.rpg.tutorial.equipped);assert.equal(d.rpg.tutorial.collected,0);await visit(f,'herreria');const visited=await f.data();assert.equal(client.tutorialStep(visited),'gather');
  await f.move(catalog.teachers.herreria);await f.action('daily_order',{id:'piezas_herreria',master:'isberto',reward:75});assert.equal((await f.data()).rpg.tutorial.delivered,false);
 }finally{await f.db.close();}
});

test('development and SQL track the same queued and instant profession lessons',{timeout:90000},async()=>{
 const f=await fixture();try{
  for(const job of ['herreria','alquimia']){
   let now=Math.floor(Date.now()/1000);await f.db.query('update test_clock set stamp=to_timestamp($1)',[now]);
   const cfg=defs.jobs[job],d={...client.defaultChar(),welcome:{stage:'completed',origin:0},shadowQuest:'returned',health:66,wallet:{pelines:70},rpg:client.professionState(undefined,now)};
   await f.seed(d);
   const move=async p=>{await f.move(p);d.location=p.location;d.position={x:p.x,z:p.z,yaw:0};};
   const action=async(name,args={},localArgs=args)=>{
    const result=await f.action(name,args);client.professionAction(d,name,localArgs,now);
    for(const key of ['job','status','visited','equipped','gathered','crafted','collected','delivered'])assert.equal(d.rpg.tutorial?.[key],result.rpg.tutorial?.[key],`${job}/${name}/${key}`);
    assert.equal(d.rpg.tutorial?.jobIds.length,result.rpg.tutorial?.jobIds.length);assert.equal(d.wallet.pelines,result.wallet.pelines);return result;
   };
   await move(defs.mentor);await action('tutorial_accept',{job,master:'gnomi'});await move(catalog.teachers[job]);await action('tutorial_visit',{master:catalog.teachers[job].id});
   await move(catalog.teachers.herreria);let result=await action('buy_tool',{job:cfg.gatherJob});let slot=result.inventory.findIndex(i=>i?.id===`herramienta_${cfg.gatherJob}_0`);await action('tool',{slot});
   await move(catalog.teachers[job]);result=await action('buy_recipe',{id:cfg.recipe,master:catalog.teachers[job].id,price:50});slot=result.inventory.findIndex(i=>i?.id===`receta_${cfg.recipe}`);await action('use_recipe',{slot,id:`receta_${cfg.recipe}`});
   for(let i=0;i<6;i++){
    const id=Object.keys(catalog.recipes[cfg.recipe].ingredients)[0],node=Object.values(catalog.nodes).find(n=>n.item===id);
    await move(node);await action('gather_start',{id:node.id});await f.step(node.seconds+1);now+=node.seconds+1;await action('gather_finish',{id:node.id});await f.step(node.respawn+1);now+=node.respawn+1;
   }
   await move(catalog.teachers[job]);result=await action('craft',{id:cfg.recipe,count:2});
   if(catalog.recipes[cfg.recipe].seconds){
    await f.step(61);now+=61;const sqlIds=[...result.rpg.tutorial.jobIds],localIds=[...d.rpg.tutorial.jobIds];
    for(let i=0;i<2;i++)await action('collect',{id:sqlIds[i]},{id:localIds[i]});
   }
   await action('daily_order',{id:cfg.order,master:catalog.teachers[job].id,reward:75});await action('tutorial_complete',{master:catalog.teachers[job].id});assert.equal(d.experience,40);
  }
 }finally{await f.db.close();}
});

test('the migration adds only the optional lesson and keeps existing server branches and characters',{timeout:60000},async()=>{
 const f=await fixture();try{
  await f.seed({rpg:{learned:['componente_herreria_0'],dailyOrders:{day:'2026-10-27',completed:2}}});const before=await f.data();
  const original=(await f.db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where proname='rpg_action'")).rows[0];
  const legacy=stripTutorialIntegration(original.definition),extended={...catalog,unrelated:{preserved:true}};
  await f.db.exec(professionTutorialPatch(extended,legacy));let current=(await f.db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where proname='rpg_action'")).rows[0];
  assert.equal(cleanTutorialSql(stripTutorialIntegration(current.prosrc)),cleanTutorialSql(stripTutorialIntegration(original.prosrc)));
  await f.db.exec(professionTutorialPatch(extended,current.definition));assert.deepEqual(await f.data(),before);assert.deepEqual((await f.db.query('select game_rpg_catalog() c')).rows[0].c,extended);
  for(const signature of ['game_profession_tutorial_action(jsonb,text,jsonb,jsonb,numeric)','game_profession_tutorial_event(jsonb,text,jsonb,jsonb)']){
   for(const role of ['anon','authenticated'])assert.equal((await f.db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,'public.'+signature])).rows[0].allowed,false);
  }
 }finally{await f.db.close();}
});
