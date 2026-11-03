import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {test} from 'node:test';
import {fixture} from './obtainability-fixture.mjs';

const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
const tutorial=JSON.parse(await readFile('src/data/professionTutorial.json','utf8'));
const pack=await build({stdin:{contents:"export {defaultChar} from './src/data/data';export {professionAction,professionState,RPG_CATALOG} from './src/data/professions';export {currentQuest,createQuestTracking} from './src/ui/questTracking';export {addWorkshopMission} from './src/data/workshopMissions';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const client=await import(`data:text/javascript;base64,${Buffer.from(pack.outputFiles[0].contents).toString('base64')}`);
const jobs=Object.keys(tutorial.jobs);
const recipes=Object.fromEntries(jobs.filter(job=>tutorial.jobs[job].recipe).map(job=>[job,catalog.recipes[tutorial.jobs[job].recipe]]));
const ingredients={};
for(const recipe of Object.values(recipes))for(const[id,count]of Object.entries(recipe.ingredients))ingredients[id]=(ingredients[id]??0)+count*2;
const inventory=Object.entries(ingredients).map(([id,count])=>({id,count}));
const tools=Object.fromEntries(['minero','lenador','recolector'].map(job=>[job,{id:`herramienta_${job}_0`,count:1,durability:100,maxDurability:100,originalDurability:100}]));

test('each workshop offers an optional one-time practice after the tutorial',async()=>{
 const state=client.defaultChar();state.rpg=client.professionState({tutorial:{job:'herreria',status:'active'}});
 const nodes={intro:{text:'Preguntas',choices:[]}},choice=client.addWorkshopMission(nodes,'herreria','Herrería',{getState:()=>state,act:async()=>true,master:'isberto'});
 nodes.intro.choices.push(choice);assert.equal(choice.when(),false);
 state.rpg.tutorial.status='completed';assert.equal(choice.when(),true);
 assert.equal(Object.keys(tutorial.jobs).length,12);
 assert.equal(nodes.workshop_mission.quest.experience,10);
});

test('normal profession actions advance only their matching active mission and grant 10 XP once',{timeout:120000},async()=>{
 const f=await fixture();try{
  await f.seed({welcome:{stage:'completed',origin:0},shadowQuest:'returned',inventory,level:1,experience:0,rpg:{tutorial:{job:'herreria',status:'completed'},learned:Object.values(recipes).map(recipe=>recipe.id),tools}});
  await f.move(catalog.teachers.herreria);await assert.rejects(()=>f.action('workshop_mission_accept',{job:'herreria',master:'maestro_peleteria'}),/maestro/);
  for(const job of jobs){await f.move(catalog.teachers[job]);await f.action('workshop_mission_accept',{job,master:catalog.teachers[job].id});}
  let d=await f.data();assert.equal(Object.keys(d.rpg.workshopMissions).length,12);assert.equal(client.currentQuest(d),'workshop-herreria');
  const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  const tracking=client.createQuestTracking(()=> 'workshop-test');
  assert.equal(tracking.current(d),'workshop-herreria');tracking.toggle('workshop-herreria');assert.equal(tracking.current(d),'workshop-peleteria');

  for(const job of jobs){
   const before=await f.data(),mission=before.rpg.workshopMissions[job];assert.equal(mission.progress,false);
   if(tutorial.jobs[job].recipe===null){
    const [nodeId,node]=Object.entries(catalog.nodes).find(([,candidate])=>candidate.job===job&&candidate.tier===0);
    await f.move(node);await f.action('gather_start',{id:nodeId});assert.equal((await f.data()).rpg.workshopMissions[job].progress,false);
    await f.step(node.seconds+1);await f.move(node);d=await f.action('gather_finish',{id:nodeId});
   }else{
    const recipe=recipes[job],station=catalog.stations[job];await f.move(station);d=await f.action('craft',{id:recipe.id});
    if(recipe.seconds===0)assert.equal(d.rpg.workshopMissions[job].progress,true);
    else{
     const jobId=d.rpg.workshopMissions[job].jobIds[0];assert.ok(jobId);assert.equal(d.rpg.workshopMissions[job].progress,false);
     await f.step(recipe.seconds+1);await f.move(station);d=await f.action('collect',{id:jobId});
    }
   }
   assert.equal(d.rpg.workshopMissions[job].progress,true,job);
   for(const other of jobs.filter(value=>value!==job))if(d.rpg.workshopMissions[other].status==='active')assert.equal(d.rpg.workshopMissions[other].progress,false,`${job} must not advance ${other}`);
   await f.move(catalog.teachers[job]);const request=randomUUID(),revision=d.rpg.revision,beforeInventory=structuredClone(d.inventory),beforePelines=d.wallet.pelines;
   d=await f.action('workshop_mission_complete',{job,master:catalog.teachers[job].id},request,revision);
   assert.equal(d.rpg.workshopMissions[job].status,'completed');assert.deepEqual(d.inventory,beforeInventory);assert.equal(d.wallet.pelines,beforePelines);
   assert.deepEqual((await f.action('workshop_mission_complete',{job,master:catalog.teachers[job].id},request,revision)).rpg.workshopMissions[job],d.rpg.workshopMissions[job]);
   await assert.rejects(()=>f.action('workshop_mission_complete',{job,master:catalog.teachers[job].id}),/pendiente/);
  }
  d=await f.data();assert.equal(d.level,2);assert.equal(d.experience,20);assert.equal(client.currentQuest(d),null);
 }finally{await f.db.close();}
});

test('pre-acceptance and cancelled jobs do not satisfy a timed workshop practice',{timeout:60000},async()=>{
 const f=await fixture();try{
  const job='herreria',recipe=recipes[job],station=catalog.stations[job],teacher=catalog.teachers[job];
  const materials=Object.entries(recipe.ingredients).map(([id,count])=>({id,count:count*3}));
  await f.seed({inventory:materials,level:1,experience:0,rpg:{tutorial:{job,status:'completed'},learned:[recipe.id]}});await f.move(station);
  let d=await f.action('craft',{id:recipe.id}),oldId=d.rpg.jobs.find(task=>task.recipe===recipe.id).id;
  await f.move(teacher);await f.action('workshop_mission_accept',{job,master:teacher.id});
  await f.step(recipe.seconds+1);await f.move(station);d=await f.action('collect',{id:oldId});assert.equal(d.rpg.workshopMissions[job].progress,false);
  d=await f.action('craft',{id:recipe.id});let id=d.rpg.workshopMissions[job].jobIds.at(-1);assert.ok(id);
  d=await f.action('cancel',{id});assert.equal(d.rpg.workshopMissions[job].progress,false);assert.deepEqual(d.rpg.workshopMissions[job].jobIds,[]);
  d=await f.action('craft',{id:recipe.id});id=d.rpg.workshopMissions[job].jobIds.at(-1);await f.step(recipe.seconds+1);await f.move(station);d=await f.action('collect',{id});
  assert.equal(d.rpg.workshopMissions[job].progress,true);
 }finally{await f.db.close();}
});

test('the development resolver shares the server action and reward rules',()=>{
 const job='cocina',recipe=Object.values(catalog.recipes).find(item=>item.job===job&&item.seconds===0),teacher=catalog.teachers[job],station=catalog.stations[job],data=client.defaultChar();
 data.location=teacher.location;data.position={x:teacher.x,z:teacher.z,yaw:0};data.inventory=Array(25).fill(null);
 data.inventory=Object.entries(recipe.ingredients).map(([id,count])=>({id,count})).concat(Array(25-Object.keys(recipe.ingredients).length).fill(null));
 data.rpg=client.professionState({tutorial:{job,status:'completed'},learned:[recipe.id]});
 client.professionAction(data,'workshop_mission_accept',{job,master:teacher.id},100);
 data.location=station.location;data.position={x:station.x,z:station.z,yaw:0};
 client.professionAction(data,'craft',{id:recipe.id},101);
 assert.equal(data.rpg.workshopMissions[job].progress,true);
 data.location=teacher.location;data.position={x:teacher.x,z:teacher.z,yaw:0};
 client.professionAction(data,'workshop_mission_complete',{job,master:teacher.id},102);
 assert.equal(data.rpg.workshopMissions[job].status,'completed');assert.equal(data.experience,10);

 const timedJob='herreria',timedRecipe=recipes[timedJob],timedTeacher=catalog.teachers[timedJob],timedStation=catalog.stations[timedJob],timedData=client.defaultChar();
 timedData.location=timedTeacher.location;timedData.position={x:timedTeacher.x,z:timedTeacher.z,yaw:0};
 timedData.inventory=Object.entries(timedRecipe.ingredients).map(([id,count])=>({id,count})).concat(Array(25-Object.keys(timedRecipe.ingredients).length).fill(null));
 timedData.rpg=client.professionState({tutorial:{job:timedJob,status:'completed'},learned:[timedRecipe.id]});
 client.professionAction(timedData,'workshop_mission_accept',{job:timedJob,master:timedTeacher.id},200);
 timedData.location=timedStation.location;timedData.position={x:timedStation.x,z:timedStation.z,yaw:0};
 client.professionAction(timedData,'craft',{id:timedRecipe.id},201);
 let timedMission=timedData.rpg.workshopMissions[timedJob],timedId=timedMission.jobIds[0];
 assert.ok(timedId);assert.equal(timedMission.progress,false);
 client.professionAction(timedData,'cancel',{id:timedId},202);
 assert.equal(timedData.rpg.workshopMissions[timedJob].progress,false);assert.deepEqual(timedData.rpg.workshopMissions[timedJob].jobIds,[]);
 timedData.inventory=Object.entries(timedRecipe.ingredients).map(([id,count])=>({id,count})).concat(Array(25-Object.keys(timedRecipe.ingredients).length).fill(null));
 client.professionAction(timedData,'craft',{id:timedRecipe.id},203);
 timedId=timedData.rpg.workshopMissions[timedJob].jobIds[0];
 client.professionAction(timedData,'state',{},218);client.professionAction(timedData,'state',{},233);
 timedData.location=timedStation.location;timedData.position={x:timedStation.x,z:timedStation.z,yaw:0};
 client.professionAction(timedData,'collect',{id:timedId},234);
 assert.equal(timedData.rpg.workshopMissions[timedJob].progress,true);
 timedData.location=timedTeacher.location;timedData.position={x:timedTeacher.x,z:timedTeacher.z,yaw:0};
 client.professionAction(timedData,'workshop_mission_complete',{job:timedJob,master:timedTeacher.id},235);
 assert.equal(timedData.rpg.workshopMissions[timedJob].status,'completed');assert.equal(timedData.experience,10);
});
