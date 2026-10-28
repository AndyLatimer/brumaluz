// Scripted, accelerated session: real movement/collision in Chromium, entire SQL
// world in PostgreSQL/WASM. No credentials, production connection or player data.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {fullWorldFixture} from '../scripts/full-world-fixture.mjs';
const out='art/recipe-training-review';await mkdir(out,{recursive:true});
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
const bundle=await build({stdin:{contents:"export {defaultChar} from './src/data/data';export {basicAttackDamage} from './src/data/combat';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const game=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const f=await fullWorldFixture(),server=await createServer({cacheDir:'node_modules/.vite-profession-session',server:{host:'127.0.0.1',port:4257,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser,id,world,position,data,elapsed=0,phase='setup';
const report={scope:'Accelerated scripted solo warrior route, not a human playtest. Entire SQL world, enemy AI, rewards, regeneration, travel and crafting; actual client collision/movement. No latency, competition, dialogue reading or clicking time. Combat uses 0.25 s steps, movement 0.5 s and safe stationary waits 5 s presence heartbeats; idle patrols are not benchmarked.',initialState:'Minimal test checkpoint: human warrior, level 1, XP 0, two unspent creation points, rank-one skill, starter equipment, empty bags, 5 Pelines, welcome marked completed and returned from Isberto. The 40 welcome XP are deliberately omitted; this is a conservative control, not a replay of the tutorial. Only this checkpoint is seeded; subsequent progress uses RPCs.',liveWrites:false,times:{},distance:0,kills:0,events:[],errors:[]};
const rpc=(name,args={})=>f.rpc(name,{p_character_id:id,...args});
const refresh=async()=>data=await f.character(id);
const mark=async label=>{await refresh();report.events.push({label,seconds:elapsed,pelines:data.wallet.pelines,level:data.level,health:world.vitals.health,professionXP:data.rpg?.xp});console.log(JSON.stringify(report.events.at(-1)));};
async function tick(seconds=.5,next=position){
 await f.step(seconds);elapsed+=seconds;report.times[phase]=(report.times[phase]??0)+seconds;
 world=await rpc('world_sync',{p_session_id:f.session,p_state:{...next,yaw:0,facing:0,jump:0,wave:0}});
 assert.equal(world.status,'ok','server must accept every actual movement');position=world.position;
 if(world.vitals.health<=0)throw Error(`Route died during ${phase} at ${JSON.stringify(position)}`);
}
async function walk(target,radius=1.2){
 console.log(JSON.stringify({walk:phase,to:{x:target.x,z:target.z},at:elapsed}));
 await refresh();await page.evaluate(async({data,position})=>(await import('/tools/profession-route-client.mjs')).place(data,position),{data,position});
 const route=await page.evaluate(async({target,radius})=>(await import('/tools/profession-route-client.mjs')).route(target,radius),{target,radius});
 for(const frame of route.frames)await tick(frame.seconds,frame);
 report.distance+=route.distance;
}
async function travel(portal){
 phase='travel';const row=(await f.db.query('select x,z,radius from world_portals where map=$1 and id=$2',[data.location,portal])).rows[0];assert.ok(row,portal);
 await walk({x:row.x,z:row.z},Math.max(.5,row.radius-.3));
 world=await rpc('world_travel',{p_session_id:f.session,p_portal:portal});position=world.position;await refresh();
 await page.evaluate(async({data,position})=>(await import('/tools/profession-route-client.mjs')).place(data,position),{data,position});
}
async function action(name,args={}){
 await refresh();data=await rpc('rpg_action',{p_action:name,p_args:args,p_request:randomUUID(),p_revision:data.rpg?.revision??0});return data;
}
async function wait(seconds,label){
 const previous=phase;phase=label;
 // Safe stationary waits use a valid five-second presence heartbeat. Combat
 // and movement still use 0.25 / 0.5 s. This is not an idle-patrol benchmark.
 for(let n=0;n<seconds;n+=5)await tick(Math.min(5,seconds-n));phase=previous;
}
let page;
try{
 await f.db.exec("update server_config set value='true' where key in ('welcome_enabled','combat_enabled')");
 id=await f.rpc('create_character',{p_data:{...game.defaultChar(),name:'Route Tester',cls:'guerrero',race:'humano'}});
 await f.db.query('update characters set data=data||$2::jsonb where id=$1',[id,{welcome:{stage:'completed',origin:0},introSeen:true,shadowQuest:'returned',wallet:{pelines:5},location:'casa_de_isberto_interior',position:{x:0,z:2.25,yaw:0}}]);
 world=await rpc('world_join',{p_session_id:f.session});position=world.position;await refresh();
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-language','es');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.goto('http://127.0.0.1:4257/?test&welcome&graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(data=>{window.brumaluz.set(data);window.brumaluz.play();},data);
 await page.waitForFunction(async()=>{const {play}=await import('/src/game/state.ts');return play.mode==='play'&&!!play.char;});
 await page.evaluate(async({data,position})=>(await import('/tools/profession-route-client.mjs')).place(data,position),{data,position});
 await travel('link_70713897');await travel('salida_este');await mark('Outside Brumaluz');
 const totalNeeded=320,keepCopper=36;
 for(let attempt=0;attempt<70;attempt++){
  phase='approach';let mob=(await f.db.query("select state from wilderness_mobs where spawn='camino_2'")).rows[0].state;
  if(mob.status==='defeated'){
   await wait(Math.max(0,Number(mob.respawnAt)-(await f.stamp()))+.5,'respawn/recovery');
   mob=(await f.db.query("select state from wilderness_mobs where spawn='camino_2'")).rows[0].state;
  }
  await walk({x:mob.x+1,z:mob.z});
  let result=await rpc('wilderness_action',{p_action:'start',p_spawn:'camino_2'}),guard=0;
  phase='combat';
  while(guard++<1200){
   mob=(await f.db.query("select state from wilderness_mobs where spawn='camino_2'")).rows[0].state;
   if(mob.status==='defeated')break;
   if(Math.hypot(mob.x-position.x,mob.z-position.z)>1.5){phase='combat movement';await walk({x:mob.x+.8,z:mob.z});phase='combat';}
   for(const kind of ['attack','skill'])if(Number(kind==='attack'?result.attackCooldown:result.skillCooldown)<=0){
    try{result=await rpc('wilderness_action',{p_action:kind,p_spawn:mob.instanceId});}
    catch(error){if(!/COOLDOWN|alcance|estamina|recurso|RESOURCE/i.test(error.message))throw error;}
    if(result.encounter?.status==='defeated')break;
   }
   await tick(.25);result={...result,attackCooldown:Math.max(0,Number(result.attackCooldown??0)-.25),skillCooldown:Math.max(0,Number(result.skillCooldown??0)-.25)};
  }
  if(guard>=1200)throw Error('Combat did not resolve');
  phase='loot';await walk({x:mob.x,z:mob.z});await rpc('wilderness_action',{p_action:'loot',p_spawn:mob.instanceId});report.kills++;
  await refresh();const copper=data.inventory.reduce((n,item)=>n+(item?.id==='material_minero_0'?item.count:0),0),leather=data.inventory.reduce((n,item)=>n+(item?.id==='cuero_0'?item.count:0),0);
  // Leather sells for one Peline per unit. Keep all copper for crafting.
  const projected=data.wallet.pelines+leather;
  if(report.kills%5===0)await mark(`Kills ${report.kills}, projected funds ${projected}`);
  if(projected>=totalNeeded){await mark('Enough funds including surplus loot');break;}
 }
 if(process.argv.includes('--combat-only')){report.complete=false;report.stop='Requested combat-only benchmark';}
 else{
  await travel('entrada_brumaluz_este');await refresh();
  // Published NPC markers are the source for vendor placement.
  const doc=JSON.parse(await readFile('src/data/world/maps/brumaluz.json','utf8'));
  const npc=doc.markers.find(m=>m.type==='npc'&&(m.npcId==='testiculos'||m.npc==='testiculos'||m.id==='testiculos'));
  if(!npc)throw Error('Find published vendor marker: '+JSON.stringify(doc.markers.filter(m=>JSON.stringify(m).includes('testiculos'))));
  phase='travel';await walk({x:npc.position[0],z:npc.position[2]+1});phase='selling';
  await refresh();for(let slot=0;slot<data.inventory.length;slot++){
   const item=data.inventory[slot];if(!item||item.id!=='cuero_0'&&item.id!=='material_minero_0')continue;
   if(item.id==='material_minero_0')continue; // Keep copper; sell leather first.
   while(data.inventory[slot]?.id==='cuero_0')data=await rpc('vendor_sell',{p_vendor:'testiculos',p_slot:slot});
  }
  await mark('Loot sold');
  await travel('taller_herreria');phase='teacher';await walk({...catalog.teachers.herreria,z:catalog.teachers.herreria.z+1.3});
  await action('buy_tool',{job:'minero'});await action('tool',{slot:data.inventory.findIndex(item=>item?.id==='herramienta_minero_0')});
  const purchase=async id=>{const recipe=catalog.recipes[id];await action('buy_recipe',{id,master:catalog.teachers.herreria.id,price:recipe.price});const slot=data.inventory.findIndex(item=>item?.id===`receta_${id}`),item=data.inventory[slot];await action('use_recipe',{slot,id:item.id,instanceId:item.instanceId});};
  await purchase('componente_herreria_0');await mark('Basic recipe and mining tool purchased');
  // Surplus combat copper supplies the ten components and the weapon.
  assert.ok(data.inventory.reduce((n,item)=>n+(item?.id==='material_minero_0'?item.count:0),0)>=keepCopper);
  phase='crafting';await action('craft',{id:'componente_herreria_0',count:5});
  // Work continues during the iron trip. Rank-zero mining may gather iron at
  // the existing increased energy cost; no rank or material is granted here.
  await travel('salida_taller_herreria');await travel('salida_este');
  for(let i=0;i<5;i++){
   await refresh();const stamp=await f.stamp();
   const node=Object.values(catalog.nodes).filter(n=>n.item==='material_minero_1'&&Number(data.rpg.nodes[n.id]??0)<=stamp).sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0];
   phase='gathering travel';await walk(node);phase='gathering';await action('gather_start',{id:node.id});await wait(node.seconds+.5,'gathering wait');await action('gather_finish',{id:node.id});
  }
  await mark('Five iron gathered while components run');
  await travel('entrada_brumaluz_este');await travel('taller_herreria');phase='crafting';await walk({...catalog.teachers.herreria,z:catalog.teachers.herreria.z+1.3});
  for(let batch=0;batch<2;batch++){
   if(batch)await action('craft',{id:'componente_herreria_0',count:5});
   for(const job of data.rpg.jobs.filter(job=>!job.done)){
    await wait(Math.max(0,Number(job.end)-(await f.stamp()))+.5,'crafting wait');await action('collect',{id:job.id});
   }
  }
  phase='teacher';await purchase('espada_cobre_t1');await action('craft',{id:'espada_cobre_t1'});
  const job=data.rpg.jobs.find(job=>job.recipe==='espada_cobre_t1');await wait(Math.max(0,Number(job.end)-(await f.stamp()))+.5,'crafting wait');await action('collect',{id:job.id});
  const slot=data.inventory.findIndex(item=>item?.id==='espada_cobre_t1');assert.ok(slot>=0);const before=game.basicAttackDamage(data.cls,data.level,data.equipment,data);
  data=await rpc('change_equipment',{p_slot:'weapon',p_bag:slot,p_expected:data.inventory[slot]});
  const after=game.basicAttackDamage(data.cls,data.level,data.equipment,data);assert.ok(after>before);report.upgrade={item:data.equipment.weapon,before,after};report.complete=true;await mark('First crafted upgrade equipped');
  await page.evaluate(async({data,position})=>(await import('/tools/profession-route-client.mjs')).place(data,position),{data,position});
 }
}catch(error){report.complete=false;report.failure={phase,message:error.message};console.error(error.stack);process.exitCode=1;}
finally{
 report.seconds=elapsed;report.distance=Math.round(report.distance);if(id){await refresh();report.final={level:data.level,pelines:data.wallet.pelines,inventory:data.inventory,profession:data.rpg};}
 await writeFile(`${out}/session-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({complete:report.complete,seconds:elapsed,times:report.times,kills:report.kills,failure:report.failure}));
 await browser?.close();await server.close();await f.close();
}
