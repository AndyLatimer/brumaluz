import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import {build} from 'esbuild';
import {auditObtainability} from '../tools/audit-obtainability.mjs';
import {obtainabilityPatch} from '../tools/build-obtainability-patch.mjs';
import {fixture} from './obtainability-fixture.mjs';
import {recipeTrainingPatch} from '../tools/build-recipe-training-patch.mjs';

const json=async file=>JSON.parse(await readFile(new URL(`../${file}`,import.meta.url),'utf8'));
const catalog=await json('src/data/generated/rpg-catalog.json'),wild=await json('src/data/generated/wilderness.json');
const bundle=await build({stdin:{contents:"export {defaultChar} from './src/data/data';export {transferEquipment} from './src/data/equipment';export {starterEquipment,basicAttackDamage} from './src/data/combat';export {recipeExperience} from './src/data/professions';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const client=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const definition=(source,name)=>{const start=source.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);};
const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let sqlAvailable=true;try{await access(modulePath);}catch{sqlAvailable=false;}

test('all recipe materials have an active source, and hides have independent hunting and processing routes',()=>{
 const report=auditObtainability(catalog,wild);assert.deepEqual(report.missingIngredients,[]);assert.deepEqual(report.blockedRecipes,[]);
 const huntingOnly={...catalog,recipes:Object.fromEntries(Object.entries(catalog.recipes).filter(([,r])=>!r.processing))};
 assert.deepEqual(auditObtainability(huntingOnly,wild).missingIngredients,[]);
 const basicHidesOnly=structuredClone(wild);for(const enemy of Object.values(basicHidesOnly.enemies))for(let tier=1;tier<6;tier++)delete enemy.loot[`cuero_${tier}`];
 assert.deepEqual(auditObtainability(catalog,basicHidesOnly).missingIngredients,[],'processing alone can supply advanced hides from basic combat loot');
 assert.deepEqual(auditObtainability(huntingOnly,basicHidesOnly).missingIngredients,['cuero_1','cuero_2','cuero_3','cuero_4','cuero_5'],'audit detects missing sources rather than counting ingredients as obtainable');
 let previousLevel=1,previousHealth=85,previousDamage=7;
 for(let tier=1;tier<6;tier++){
  const recipe=catalog.recipes[`curtir_cuero_${tier}`],enemy=wild.enemies[`jabali_cuero_${tier}`];
  assert.equal(recipe.source,tier===5?'drop':'trainer');assert.equal(recipe.output,`cuero_${tier}`);assert.equal(recipe.ingredients[`cuero_${tier-1}`],4);assert.equal(recipe.ingredients[`material_recolector_${tier}`],2);
  assert.ok(enemy.level>previousLevel&&enemy.health>previousHealth&&enemy.damage>previousDamage);assert.equal(enemy.loot[`cuero_${tier}`],2);
  [previousLevel,previousHealth,previousDamage]=[enemy.level,enemy.health,enemy.damage];
 }
});

test('SQL teaches processing at its rank and preserves consumption, timer, XP, refunds and idempotency',{skip:!sqlAvailable,timeout:60000},async()=>{
 const f=await fixture();try{
  for(let tier=1;tier<6;tier++){
   const r=catalog.recipes[`curtir_cuero_${tier}`],xp=[0,100,500,1500,4000,10000][tier];
   const inventory=Array(25).fill(null);inventory[0]={id:`cuero_${tier-1}`,count:4};inventory[1]={id:`material_recolector_${tier}`,count:2};if(tier===5)inventory[2]={id:`receta_${r.id}`,count:1};
   await f.seed({wallet:{pelines:r.price+5},rpg:{xp:{peleteria:xp},mastery:{peleteria:Math.max(0,tier-2)}},inventory});await f.move(catalog.teachers.peleteria);
   const learned=await f.purchase(r.id);assert.ok(learned.rpg.learned.includes(r.id));assert.equal(learned.wallet.pelines,5,'teacher charges the catalog price; exceptional scrolls are consumed instead');
   const req=randomUUID(),before=learned.rpg.revision,queued=await f.action('craft',{id:r.id},req,before);
   assert.equal(queued.inventory.filter(Boolean).length,0);assert.equal(queued.rpg.jobs.length,1);assert.equal(queued.rpg.jobs[0].xp,10,'processing does not grant multiplied equipment XP');assert.equal(queued.rpg.jobs[0].xp,client.recipeExperience(tier,r),'client displays the server XP');
   assert.deepEqual((await f.action('craft',{id:r.id},req,before)).inventory,queued.inventory);
   await assert.rejects(()=>f.action('collect',{id:queued.rpg.jobs[0].id}),/no ha terminado/);
   await f.step(r.seconds+1);const settled=await f.action('state');assert.equal(settled.rpg.xp.peleteria,xp+10);
   assert.equal((await f.action('state')).rpg.xp.peleteria,xp+10,'completion XP is granted once');
   const received=await f.action('collect',{id:queued.rpg.jobs[0].id});assert.equal(received.inventory.find(item=>item?.id===r.output)?.count,1);
  }
  await f.seed({rpg:{xp:{peleteria:0}}});await f.move(catalog.teachers.peleteria);await assert.rejects(()=>f.purchase('curtir_cuero_1'),/dominio/);
  await f.seed({rpg:{xp:{peleteria:100}}});await f.move({...catalog.teachers.peleteria,x:catalog.teachers.peleteria.x+20});await assert.rejects(()=>f.purchase('curtir_cuero_1'),/maestro/);
  await f.seed({rpg:{xp:{peleteria:100},learned:['curtir_cuero_1']},inventory:[{id:'cuero_0',count:3},{id:'material_recolector_1',count:2},...Array(23).fill(null)]});await f.move(catalog.stations.peleteria);
  const before=await f.data();await assert.rejects(()=>f.action('craft',{id:'curtir_cuero_1'}),/materiales/);assert.deepEqual(await f.data(),before,'failed conversion is atomic');
  await f.seed({rpg:{xp:{peleteria:100},learned:['curtir_cuero_1']},inventory:[{id:'cuero_0',count:4},{id:'material_recolector_1',count:2},...Array(23).fill(null)]});await f.move(catalog.stations.peleteria);
  const queued=await f.action('craft',{id:'curtir_cuero_1'}),request=randomUUID();
  const cancelled=await f.action('cancel',{id:queued.rpg.jobs[0].id},request);
  assert.deepEqual(Object.fromEntries(cancelled.rpg.deliveries.map(item=>[item.id,item.count])),{cuero_0:4,material_recolector_1:2});
  assert.equal(cancelled.rpg.jobs.length,0);assert.equal(cancelled.rpg.xp.peleteria,100);
  assert.deepEqual((await f.action('cancel',{id:queued.rpg.jobs[0].id},request,queued.rpg.revision)).rpg.deliveries,cancelled.rpg.deliveries,'cancel retry cannot duplicate materials');
 }finally{await f.db.close();}
});

test('each class can earn the purchase price, buy its first weapon recipe from the master and craft an upgrade',{skip:!sqlAvailable,timeout:60000},async()=>{
 const f=await fixture();try{
  for(const cls of ['guerrero','mago','picaro','clerigo','explorador']){
   await f.seed({cls});
   // Earn the increased prices through real outdoor rewards; recipes are no longer basic loot.
   for(let kill=0;kill<64;kill++){
    const d=await f.data(),e={enemy:'salteador',spawn:'camino_2'};
    const loot=(await f.db.query('select game_wilderness_loot($1,$2) loot',[d,e])).rows[0].loot;
    assert.equal(loot.some(item=>item.id.startsWith('receta_')),false,'low-level enemies never bypass the teacher');
    let earned=(await f.db.query('select game_wilderness_reward($1,$2) d',[d,e])).rows[0].d;
    earned=(await f.db.query('select game_rpg_settle($1,extract(epoch from test_now())) d',[earned])).rows[0].d;
    for(const item of loot)earned=(await f.db.query('select game_rpg_give($1,$2,true) d',[earned,item])).rows[0].d;
    await f.seed(earned);
   }
   let d=await f.data();const r=Object.values(catalog.recipes).find(r=>r.tier===1&&catalog.equipment[r.output]?.cls===cls&&catalog.equipment[r.output]?.slot==='weapon'),job=r.job,gatherJob=job==='herreria'?'minero':'lenador';
   await f.move(catalog.stations.herreria);await f.action('buy_tool',{job:gatherJob});d=await f.data();await f.action('tool',{slot:d.inventory.findIndex(item=>item?.id===`herramienta_${gatherJob}_0`)});
   const gather=async(item,n)=>{for(let i=0;i<n;i++){const node=Object.values(catalog.nodes).find(node=>node.item===item);await f.move(node);await f.action('gather_start',{id:node.id});await f.step(node.seconds+1);await f.action('gather_finish',{id:node.id});await f.step(node.respawn+1);}};
   const component=catalog.recipes[`componente_${job}_0`];
   // Ten basic components earn Iniciado. Materials come exclusively from live loot/gathering definitions.
   const needed={...r.ingredients};delete needed[component.id];for(const [id,n]of Object.entries(component.ingredients))needed[id]=(needed[id]??0)+n*10;
   for(const[id,n]of Object.entries(needed)){
    d=await f.data();const have=d.inventory.reduce((sum,item)=>sum+(item?.id===id?item.count:0),0);await gather(id,Math.max(0,n-have));
   }
   await f.move(catalog.teachers[job]);await f.purchase(component.id);
   for(let batch=0;batch<2;batch++){const q=await f.action('craft',{id:component.id,count:5});await f.step(160);await f.action('state');for(const task of q.rpg.jobs.filter(task=>!task.done))await f.action('collect',{id:task.id});}
   d=await f.data();assert.ok(d.rpg.xp[job]>=100);await f.purchase(r.id);const q=await f.action('craft',{id:r.id});const task=q.rpg.jobs.find(task=>task.recipe===r.id);await f.step(r.seconds+1);const done=await f.action('collect',{id:task.id});
   assert.ok(done.inventory.some(item=>item?.id===r.output&&item.instanceId),'crafted weapon has a persistent instance');assert.ok(done.wallet.pelines>=0);
   const char={...client.defaultChar(),...done,equipment:client.starterEquipment(cls)},oldDamage=client.basicAttackDamage(cls,char.level,char.equipment,char),slot=char.inventory.findIndex(item=>item?.id===r.output);
   client.transferEquipment(char,'weapon',slot,char.inventory[slot]);assert.equal(char.equipment.weapon.id,r.output);assert.equal(char.equipment.weapon.bound,true);assert.ok(client.basicAttackDamage(cls,char.level,char.equipment,char)>oldDamage,'the obtained weapon is an actual usable upgrade');
  }
 }finally{await f.db.close();}
});

test('the narrow patch is repeatable and does not reset existing creatures or player progress',{skip:!sqlAvailable,timeout:60000},async()=>{
 const f=await fixture();try{
  await f.seed({name:'Preserved'});const original=await f.data();
  await f.db.query('insert into wilderness_mobs values($1,$2)',['camino_1',{health:17,instanceId:'active-generation',status:'active',members:{[f.id]:{damage:4}}}]);
  const old=(await f.db.query('select * from wilderness_mobs')).rows;
  await f.db.exec(obtainabilityPatch());await f.db.exec(obtainabilityPatch());
  assert.deepEqual(await f.data(),original);assert.deepEqual((await f.db.query("select * from wilderness_mobs where spawn='camino_1'")).rows,old);
  assert.equal((await f.db.query('select count(*)::int n from wilderness_mobs')).rows[0].n,6);
  assert.equal((await f.db.query("select has_function_privilege('anon','public.game_rpg_recipe_xp(jsonb,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await f.db.close();}
});

test('teacher purchase enforces identity, location, actual price and balance; rare recipes require their scroll',{skip:!sqlAvailable,timeout:60000},async()=>{
 const f=await fixture();try{
  const r=catalog.recipes.curtir_cuero_1,teacher=catalog.teachers.peleteria;
  await f.seed({wallet:{pelines:1000},rpg:{xp:{peleteria:100}}});await f.move(teacher);
  await assert.rejects(()=>f.action('learn',{id:r.id}),/maestro/);
  await assert.rejects(()=>f.action('buy_recipe',{id:r.id,master:'isberto',price:r.price}),/maestro/);
  await assert.rejects(()=>f.action('buy_recipe',{id:r.id,master:teacher.id,price:1}),/precio/);
  await f.move({...teacher,x:teacher.x+3.1});await assert.rejects(()=>f.purchase(r.id),/maestro/);
  await f.move({...teacher,location:'casa_de_isberto_interior'});await assert.rejects(()=>f.purchase(r.id),/maestro/);
  await f.seed({wallet:{pelines:r.price-1},rpg:{xp:{peleteria:100}}});await f.move(teacher);const before=await f.data();
  await assert.rejects(()=>f.purchase(r.id),/NOT_ENOUGH_PELINES/);assert.deepEqual(await f.data(),before);
  await f.seed({wallet:{pelines:1000},rpg:{xp:{peleteria:100},learned:['componente_peleteria_0']}});await f.move(teacher);
  const request=randomUUID(),args={id:r.id,master:teacher.id,price:r.price};const bought=await f.action('buy_recipe',args,request,0);
  assert.equal(bought.wallet.pelines,750);assert.ok(bought.rpg.learned.includes('componente_peleteria_0'));
  assert.equal((await f.action('buy_recipe',args,request,0)).wallet.pelines,750);
  assert.ok(!bought.rpg.learned.includes(r.id),'purchase delivers a scroll, not knowledge');await f.purchase(r.id);await assert.rejects(()=>f.purchase(r.id),/Ya conoces/);
  const exceptional=catalog.recipes.curtir_cuero_5;
  await f.seed({wallet:{pelines:1000000},rpg:{xp:{peleteria:10000},mastery:{peleteria:3}}});await f.move(teacher);
  await assert.rejects(()=>f.purchase(exceptional.id),/materiales/,'currency alone cannot buy an exceptional recipe');
  const d=await f.data();d.inventory[0]={id:`receta_${exceptional.id}`,count:1};await f.seed(d);const learned=await f.purchase(exceptional.id);
  assert.equal(learned.wallet.pelines,1000000);assert.equal(learned.inventory[0],null);assert.ok(learned.rpg.learned.includes(exceptional.id));
 }finally{await f.db.close();}
});

test('exceptional scrolls are rare high-level loot, never ordinary recipes or guaranteed first-victory rewards',{skip:!sqlAvailable,timeout:60000},async()=>{
 const f=await fixture();try{
  await f.db.exec('create table test_roll(value double precision);insert into test_roll values(0);create function public.test_roll() returns double precision language sql as $$select value from public.test_roll$$;');
  const source=await readFile(new URL('../supabase/server/27-wilderness.sql',import.meta.url),'utf8');
  await f.db.exec(definition(source,'game_wilderness_loot').replaceAll('random()','public.test_roll()'));
  const loot=async enemy=>(await f.db.query('select game_wilderness_loot($1,$2) loot',[{cls:'guerrero'},{enemy}])).rows[0].loot;
  assert.equal((await loot('salteador')).some(item=>item.id.startsWith('receta_')),false);
  await f.db.exec('update test_roll set value=.004');const rare=(await loot('jabali_cuero_5')).find(item=>item.id.startsWith('receta_'));
  assert.ok(rare);assert.equal(catalog.recipes[rare.id.slice(7)].source,'drop');assert.equal(catalog.recipes[rare.id.slice(7)].tier,5);
  await f.db.exec('update test_roll set value=.005');assert.equal((await loot('jabali_cuero_5')).some(item=>item.id.startsWith('receta_')),false);
 }finally{await f.db.close();}
});

test('teacher migration is repeatable, preserves learned recipes and does not expose private loot helpers',{skip:!sqlAvailable,timeout:60000},async()=>{
 const f=await fixture();try{
  await f.db.exec('create table public.rpg_expeditions(id uuid,party_id uuid,leader uuid,state jsonb,updated_at timestamptz);');
  await f.seed({rpg:{learned:['componente_herreria_0','espada_cobre_t1']}});const before=await f.data();
  await f.db.exec(recipeTrainingPatch());await f.db.exec(recipeTrainingPatch());assert.deepEqual(await f.data(),before);
  const permissions=(await f.db.query("select proname,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated from pg_proc where pronamespace='public'::regnamespace and proname in ('rpg_action','expedition_action','game_wilderness_loot','game_rpg_catalog')")).rows;
  assert.ok(permissions.every(row=>!row.anon));assert.ok(permissions.every(row=>row.authenticated===['rpg_action','expedition_action'].includes(row.proname)));
 }finally{await f.db.close();}
});
