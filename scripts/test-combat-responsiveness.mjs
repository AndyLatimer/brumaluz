import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const url='http://127.0.0.1:4201';let server,browser;
before(async()=>{
 server=await createServer({cacheDir:'node_modules/.vite-combat-response',server:{host:'127.0.0.1',port:4201,strictPort:true,hmr:false,watch:null}});await server.listen();
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
});
after(async()=>{await browser?.close();await server?.close();});
async function openFight(){
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
 await page.goto(`${url}/?test&graphics=compatible`);await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:60000});
 await page.locator('#loading.hide').waitFor({state:'attached'});
 await page.evaluate(async()=>{
  const state=await import('/src/game/state.ts'),combat=await import('/src/game/combat.ts'),stage=await import('/src/game/stage.ts');
  const {starterEquipment}=await import('/src/data/combat.ts');
  window.brumaluz.set({cls:'guerrero',introSeen:true,welcome:{origin:0,stage:'completed'},shadowQuest:null,health:-1,resource:-1,equipment:starterEquipment('guerrero')});
  window.brumaluz.play();state.story.introArmed=false;state.talk.pendingIsbertoIntroduction=false;
  await combat.beginIsbertoEncounter();window.brumaluz.move(state.fight.combatEncounter.x-1,state.fight.combatEncounter.z);
  state.fight.nextLocalEnemyAttack=performance.now()/1000+100;combat.lockCombatTarget(true);state.fight.combatAuto=false;
  state.session.activeCharacterId=crypto.randomUUID();
  const attacks=[],original=state.play.char.attack.bind(state.play.char);state.play.char.attack=skill=>{attacks.push({skill:!!skill,at:performance.now()});original(skill);};
  window.responseTest={state,combat,stage,attacks};
 });
 return {context,page,errors};
}
async function reply(page,revision,health=90){return page.evaluate(async({revision,health})=>{
 const {fight,session}=responseTest.state,{vitalsOf}=await import('/src/data/stats.ts');
 return {encounter:{...fight.combatEncounter,health,engaged:true},vitals:{...vitalsOf(session.state),serverRevision:revision},damage:10,healing:0,attackCooldown:1.5,skillCooldown:0};
},{revision,health});}

test('a delayed basic request leaves skills responsive and animations running with bounded traffic',{timeout:60000},async()=>{
 const {context,page,errors}=await openFight();let basics=0,skills=0,skillAt=0;
 try{
  const basicReply=await reply(page,2,90),skillReply={...await reply(page,3,70),skillCooldown:6};
  await page.route('**/rest/v1/rpc/combat_action',async route=>{
   const basic=route.request().postDataJSON().p_action==='attack';if(basic)basics++;else{skills++;skillAt=Date.now();}
   await new Promise(r=>setTimeout(r,basic?3000:80));
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(basic?basicReply:skillReply)}).catch(()=>{});
  });
  const requested=page.waitForRequest(r=>r.url().includes('/rpc/combat_action'));
  await page.evaluate(()=>{responseTest.basic=responseTest.combat.performWorldCombatAction('attack');});await requested;
  const pressed=Date.now();await page.keyboard.press('Digit1');
  await page.waitForFunction(()=>responseTest.attacks.some(a=>a.skill));
  for(let i=0;i<40&&!skills;i++)await page.waitForTimeout(25);
  assert.equal(skills,1,'A skill sends while the basic RPC is still pending');assert.ok(skillAt-pressed<700,`Skill request took ${skillAt-pressed} ms`);
  await page.evaluate(()=>{responseTest.state.fight.combatAuto=true;});
  await page.waitForFunction(()=>responseTest.attacks.filter(a=>!a.skill).length>=2,null,{timeout:2500});
  assert.equal(basics,1,'Visual cadence never builds a backlog of basic RPCs');assert.equal(skills,1);
  await page.waitForFunction(()=>!responseTest.state.fight.combatBusy,null,{timeout:500});
  assert.equal(await page.evaluate(()=>responseTest.state.fight.combatBusy),false,'Network waits do not hold the animation lock');
  assert.equal(await page.locator('#combat-controls, #combat-tutorial, .ab-feedback').count(),0);
  await page.evaluate(()=>{responseTest.state.fight.combatAuto=false;});await page.evaluate(()=>responseTest.basic);
  assert.equal(await page.evaluate(()=>responseTest.state.fight.combatEncounter.health),70,'An older basic reply cannot rewind the newer skill result');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('a pending reply never restores an enemy after selecting another or leaving play',{timeout:60000},async()=>{
 const {context,page,errors}=await openFight();try{
  const old=await reply(page,2,90);
  await page.route('**/rest/v1/rpc/combat_action',async route=>{await new Promise(r=>setTimeout(r,900));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(old)}).catch(()=>{});});
  const sent=page.waitForRequest(r=>r.url().includes('/rpc/combat_action'));
  await page.evaluate(()=>{responseTest.pending=responseTest.combat.performWorldCombatAction('attack');});await sent;
  const instance=await page.evaluate(()=>{const {fight}=responseTest.state;const id=crypto.randomUUID();responseTest.combat.setCombatEncounter({...fight.combatEncounter,instanceId:id,health:110},true);responseTest.combat.lockCombatTarget(true);fight.combatAuto=false;return id;});
  await page.evaluate(()=>responseTest.pending);await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(()=>responseTest.state.fight.combatEncounter.instanceId),instance);
  assert.equal(await page.evaluate(()=>responseTest.state.fight.combatEncounter.health),110);
  await page.evaluate(async()=>{responseTest.state.session.activeCharacterId=null;(await import('/src/game/playSession.ts')).exitPlay();});
  assert.equal(await page.evaluate(()=>responseTest.state.fight.combatBusy),false);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('a hung skill times out without leaving a permanent input or cooldown lock',{timeout:60000},async()=>{
 const {context,page,errors}=await openFight();let calls=0;
 try{
  const accepted={...await reply(page,2,90),skillCooldown:6};
  await page.route('**/rest/v1/rpc/combat_action',async route=>{calls++;if(calls===1)return;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(accepted)});});
  const elapsed=await page.evaluate(async()=>{const start=performance.now();await responseTest.combat.performWorldCombatAction('skill');return performance.now()-start;});
  assert.ok(elapsed>=3900&&elapsed<5200,`A hung action releases after its bounded deadline: ${elapsed} ms`);
  assert.equal(await page.evaluate(()=>responseTest.state.fight.combatBusy),false);
  assert.equal(await page.evaluate(()=>responseTest.state.vitals.skillReadyAt<=performance.now()),true,'Rejected skill prediction is released');
  await page.evaluate(()=>responseTest.combat.performWorldCombatAction('skill'));
  assert.equal(calls,2);assert.equal(await page.evaluate(()=>responseTest.state.fight.combatEncounter.health),90);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('far enemy clicks approach immediately without sending rejected start requests',{timeout:60000},async()=>{
 const {context,page,errors}=await openFight();let starts=0;
 try{
  await page.route('**/rest/v1/rpc/wilderness_action',async route=>{if(route.request().postDataJSON().p_action==='start')starts++;await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'COMBAT_OUT_OF_RANGE'})});});
  const initial=await page.evaluate(async()=>{
   const wild=await import('/src/game/wilderness.ts'),{WILDERNESS}=await import('/src/data/wilderness.ts');
   const {state,combat,stage}=responseTest;combat.setCombatEncounter(null);state.play.city.locationId='pompelin';
   const site=WILDERNESS.spawns[0],def=WILDERNESS.enemies[site.enemy],mob={id:'wild_enemy',kind:'wilderness',spawn:site.id,enemy:site.enemy,instanceId:crypto.randomUUID(),status:'idle',health:def.health,maxHealth:def.health,x:stage.holder.position.x+18,z:stage.holder.position.z,enemyAttackAt:100,revision:1,loot:[],looted:true};
   wild.receiveWilderness({wilderness:{shared:true,serverTime:Date.now()/1000,mobs:[mob],corpses:[],inCombat:false}});wild.tickWilderness(0,.016);
   const began=await wild.beginWilderness(site.id);return {began,locked:state.fight.lockedEnemy,approach:state.fight.combatApproach,from:stage.holder.position.x};
  });
  assert.equal(initial.began,true);assert.equal(initial.locked,true);assert.equal(initial.approach,true);
  await page.waitForFunction(from=>responseTest.stage.holder.position.x>from+.5,initial.from);
  assert.equal(starts,0,'A far click never asks the server to engage from outside its radius');
  assert.equal(await page.locator('#toast.show').count(),0);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('the combat HUD stays quiet and fits mobile while damage and rewards remain visible',{timeout:60000},async()=>{
 const {context,page,errors}=await openFight();try{
  await page.evaluate(async()=>{responseTest.state.session.activeCharacterId=null;responseTest.combat.useWorldCombatSkill();(await import('/src/game/combatFeedback.ts')).combatReward(18,3);});
  await page.waitForFunction(()=>document.querySelector('.ab-slot[data-skill-id]')?.classList.contains('on-cooldown'));
  assert.equal(await page.locator('#combat-controls, #combat-tutorial, .ab-feedback, .enemy-cast').count(),0);
  await mkdir('art/combat-review',{recursive:true});
  await page.screenshot({path:'art/combat-review/combat-responsive-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.locator('#quest-tracker').isVisible(),false,'The quest summary leaves the enemy health clear on mobile');
  assert.equal(await page.locator('#interact-prompt').isVisible(),false,'Nearby NPC conversations do not interrupt a fight');
  for(const selector of ['#action-bar','#combat-reward','#target-frame'])assert.equal(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true);
  await page.screenshot({path:'art/combat-review/combat-responsive-mobile.png'});assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
