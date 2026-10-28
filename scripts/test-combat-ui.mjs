import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'vite';
import {chromium} from 'playwright';

let server,browser;
const url='http://127.0.0.1:4197';
before(async()=>{
  server=await createServer({cacheDir:'node_modules/.vite-combat-ui',server:{host:'127.0.0.1',port:4197,strictPort:true,hmr:false,watch:null}});await server.listen();
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
});
after(async()=>{await browser?.close();await server?.close();});
async function uiPage(){
 const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),page=await context.newPage();
 await page.route(`${url}/__combat-ui`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body class="playing"><canvas id="scene"></canvas><div id="action-bar" class="action-bar"></div>'}));
 await page.goto(`${url}/__combat-ui`);
 await page.evaluate(async()=>{await import('/src/styles/style.css');await import('/src/styles/game/15-rpg.css');await import('/src/styles/game/17-wilderness.css');await import('/src/styles/game/18-combat-polish.css');});
 return {context,page};
}

test('target meters stay finite and changing health/casts preserve the target emblem',async()=>{
 const {context,page}=await uiPage();try{
  const result=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js');const {createTargetFrame}=await import('/src/ui/targetFrame.ts');
   let clock=100;Object.defineProperty(performance,'now',{value:()=>clock,configurable:true});
   const camera=new THREE.PerspectiveCamera(),root=new THREE.Group();root.position.z=-5;
   const frame=createTargetFrame(document.querySelector('canvas'),camera,new THREE.Group(),()=>true);
   const target={id:'test',root,name:'Sombra',level:1,height:1,identity:{kind:'npc',type:'hostile',title:'Criatura'},vitals:{health:0,maxHealth:0,overheal:0,resource:0,maxResource:0,resourceKind:'mana'}};
   frame.update([target],true,new THREE.Vector3(),'test');
   const emblem=document.querySelector('.target-emblem svg');
   const meter=document.querySelector('.target-health');const finite=Number.isFinite(Number(meter.getAttribute('aria-valuenow')))&&meter.querySelector('i').style.width==='0%';
   const hidden=document.querySelector('.target-resource').hidden;
   for(let i=0;i<12;i++){
    clock+=101;target.vitals.health=70-i;target.vitals.maxHealth=100;
    target.cast={label:'Descarga',duration:1.4,remaining:Math.max(0,1.4-i*.1)};
    frame.update([target],true,new THREE.Vector3(),'test');
   }
   const stable=emblem===document.querySelector('.target-emblem svg');const castHidden=document.querySelector('.target-resource').hidden;
   clock+=101;target.cast={label:'Descarga',duration:.65,remaining:0};frame.update([target],true,new THREE.Vector3(),'test');
   frame.dispose();return {finite,hidden,stable,castHidden,removed:!document.querySelector('#target-frame')};
  });
  assert.equal(result.finite,true);assert.equal(result.hidden,true);assert.equal(result.stable,true);assert.equal(result.castHidden,true);assert.equal(result.removed,true);
 }finally{await context.close();}
});

test('quickbar preserves keyboard focus and prevents repeated potion requests during recast',async()=>{
 const {context,page}=await uiPage();try{
  await page.evaluate(async()=>{
   const {ITEMS}=await import('/src/data/items.ts');const {starterEquipment}=await import('/src/data/combat.ts');const bar=await import('/src/ui/actionBar.ts');
   const potion=Object.values(ITEMS).find(i=>i.restore?.kind==='health').id;
   localStorage.setItem('ui-bar',JSON.stringify([['skill:heavy_strike',potion]]));
   window.uiBar={bar,potion,count:3,cooldown:0,uses:0,skills:0,state:'idle'};
   window.uiBar.skill={id:'skill:heavy_strike',cls:'guerrero',rank:1,equipment:starterEquipment('guerrero'),icon:'<svg></svg>',cooldown:0,duration:6,available:true};
   bar.initActionBar({storageKey:()=> 'ui-bar',count:()=>uiBar.count,bound:()=>false,use:()=>uiBar.uses++,skill:()=>uiBar.skill,useSkill:()=>uiBar.skills++,itemCooldown:()=>uiBar.cooldown,feedback:()=>({state:uiBar.state,remaining:.3,duration:.6,interruptible:uiBar.interruptible})});
  });
  await page.locator('.ab-slot[data-item-id]').focus();
  await page.evaluate(()=>{uiBar.count=2;uiBar.bar.renderActionBar(true);});
  assert.equal(await page.locator('.ab-slot[data-item-id]').evaluate(el=>el===document.activeElement),true);
  await page.evaluate(()=>{uiBar.cooldown=8;uiBar.bar.renderActionBar();uiBar.bar.useActionBarSlot(1);uiBar.bar.useActionBarSlot(1);});
  assert.equal(await page.evaluate(()=>uiBar.uses),0);assert.equal(await page.locator('.ab-slot[data-item-id]').getAttribute('aria-disabled'),'true');
  assert.equal(await page.locator('.ab-slot[data-item-id] .ab-cooldown-time').textContent(),'8');
  assert.equal(await page.locator('.ab-feedback').count(),0);
  await page.evaluate(()=>{uiBar.cooldown=0;uiBar.bar.renderActionBar();uiBar.bar.useActionBarSlot(1);uiBar.state='casting';uiBar.bar.renderActionBar();});
  assert.equal(await page.evaluate(()=>uiBar.uses),1);assert.equal(await page.locator('.ab-feedback').count(),0);
  await page.evaluate(()=>{uiBar.state='idle';uiBar.skill.cooldown=.2;uiBar.bar.useActionBarSlot(0);uiBar.bar.useActionBarSlot(0);});
  assert.equal(await page.evaluate(()=>uiBar.skills),0,'Even the final fraction of a recast rejects input instead of queuing it');
  await page.evaluate(()=>{uiBar.skill.cooldown=0;uiBar.bar.renderActionBar();});
  assert.equal(await page.evaluate(()=>uiBar.skills),0,'Becoming ready never replays rejected presses');
  await page.evaluate(()=>{uiBar.state='casting';uiBar.bar.useActionBarSlot(0);uiBar.bar.renderActionBar(true);});
  assert.equal(await page.evaluate(()=>uiBar.skills),0,'The current skill cannot start twice during preparation');
  assert.equal(await page.locator('.ab-slot[data-skill-id]').getAttribute('aria-disabled'),'true');
  await page.evaluate(()=>{uiBar.state='recovering';uiBar.interruptible=true;uiBar.bar.useActionBarSlot(0);});
  assert.equal(await page.evaluate(()=>uiBar.skills),1,'A skill can interrupt an automatic attack recovery');
  await page.evaluate(()=>{uiBar.state='casting';uiBar.bar.renderActionBar();});
  for(const width of [320,390,760,1280]){
   await page.setViewportSize({width,height:800});
   assert.equal(await page.locator('#action-bar').evaluate(bar=>{const r=bar.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&bar.scrollWidth<=bar.clientWidth;}),true,`Quickbar fits ${width}px`);
   assert.equal(await page.locator('.ab-feedback').count(),0,'Combat feedback stays on its action slot');
  }
  await page.evaluate(()=>{uiBar.skill.available=false;uiBar.skill.unavailableReason='dead';uiBar.state='idle';uiBar.bar.renderActionBar();uiBar.bar.useActionBarSlot(1);});
  assert.equal(await page.evaluate(()=>uiBar.uses),1,'Dead characters cannot send item requests');
  assert.match(await page.locator('.ab-slot[data-item-id]').getAttribute('aria-description'),/volver a la vida/);
  await page.evaluate(()=>document.body.classList.add('conversation-open'));
  assert.equal(await page.locator('.combat-controls').count(),0,'Combat buttons are absent');
  await page.evaluate(()=>{document.body.classList.remove('conversation-open');document.body.classList.add('cinematic-open');});
  assert.equal(await page.locator('.combat-controls').count(),0,'Combat buttons are absent during cinematics too');
 }finally{await context.close();}
});

test('leaving play cancels prepared attacks and clears particles and floating combat text',{timeout:90000},async()=>{
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
  await page.goto(`${url}/?test&graphics=compatible`);await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:60000});
  const result=await page.evaluate(async()=>{
   const {starterEquipment}=await import('/src/data/combat.ts');const {fight,play,story,talk}=await import('/src/game/state.ts');
   const combat=await import('/src/game/combat.ts');const effects=await import('/src/game/combatFeedback.ts');const {holder,scene}=await import('/src/game/stage.ts');
   window.brumaluz.set({cls:'mago',introSeen:true,welcome:{origin:0,stage:'completed'},shadowQuest:null,health:-1,resource:-1,equipment:starterEquipment('mago')});window.brumaluz.play();story.introArmed=false;talk.pendingIsbertoIntroduction=false;
   await combat.beginIsbertoEncounter();window.brumaluz.move(fight.combatEncounter.x-3,fight.combatEncounter.z);combat.lockCombatTarget(true);fight.combatAuto=false;
   const encounter=fight.combatEncounter,health=encounter.health,action=combat.performWorldCombatAction('skill');effects.combatFloat(3,holder.position);effects.combatImpact(holder.position);
   (await import('/src/game/playSession.ts')).exitPlay();await action;await new Promise(r=>setTimeout(r,300));
   return {mode:play.mode,locked:fight.lockedEnemy,busy:fight.combatBusy,healthUnchanged:health===encounter.health,floats:document.querySelectorAll('.combat-float').length,effects:scene.children.filter(mesh=>['combat-projectile','combat-charge','combat-slash'].includes(mesh.name)).length,state:combat.getCombatActionFeedback().state};
  });
  assert.deepEqual(result,{mode:'create',locked:false,busy:false,healthUnchanged:true,floats:0,effects:0,state:'idle'});assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
