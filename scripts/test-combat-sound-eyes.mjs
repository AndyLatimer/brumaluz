import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const url='http://127.0.0.1:4221';
let server,browser,page;
const errors=[];
before(async()=>{
 server=await createServer({cacheDir:'node_modules/.vite-combat-sound-eyes',server:{host:'127.0.0.1',port:4221,strictPort:true,hmr:false,watch:null},logLevel:'error'});
 await server.listen();
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 page=await browser.newPage({viewport:{width:1440,height:820}});page.on('pageerror',error=>errors.push(error.message));
 await page.route(url+'/__combat-sound',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Combate: sonido y párpados</title><link rel="icon" href="data:,"><button>Activar sonido</button><canvas></canvas>'}));
 await page.goto(url+'/__combat-sound');
},{timeout:120000});
after(async()=>{await browser?.close();await server?.close();});

test('real audio has distinct weapon, magic, warning and death envelopes without clipping or a sustained tail',async()=>{
 const result=await page.evaluate(async()=>{
  const {combatNoise,scheduleCombatSound}=await import('/src/world/combatAudio.ts');
  const cases=[...['guerrero','picaro','explorador','mago','clerigo','beast','magic','shadow'].flatMap(voice=>[['swing',voice],['impact',voice],['death',voice]]),['skill','guerrero'],['skill','mago'],['warning','shadow'],['healing','clerigo'],['incoming','guerrero']];
  const rate=24000,ctx=new OfflineAudioContext(2,Math.ceil(cases.length*.8*rate),rate),noise=combatNoise(ctx);
  cases.forEach(([cue,voice],i)=>scheduleCombatSound(ctx,ctx.destination,noise,cue,voice,true,i*.8));
  const audio=await ctx.startRendering(),samples=audio.getChannelData(0);
  const stats=cases.map(([cue,voice],i)=>{
   let sum=0,peak=0,tail=0;
   for(let j=0;j<rate*.8;j++){const v=samples[Math.round(i*.8*rate)+j];sum+=v*v;peak=Math.max(peak,Math.abs(v));if(j>rate*.65)tail=Math.max(tail,Math.abs(v));}
   return {cue,voice,rms:Math.sqrt(sum/(rate*.8)),peak,tail};
  });
  return {stats,rate,pcm:Array.from(samples)};
 });
 for(const stat of result.stats){assert.ok(stat.rms>.004,JSON.stringify(stat));assert.ok(stat.peak<.8,JSON.stringify(stat));assert.ok(stat.tail<.00001,JSON.stringify(stat));}
 const impacts=result.stats.filter(s=>s.cue==='impact');assert.ok(new Set(impacts.map(s=>s.rms.toFixed(4))).size>=5);
 await mkdir('art/combat-review',{recursive:true});
 const data=Buffer.alloc(result.pcm.length*2);result.pcm.forEach((v,i)=>data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),i*2));
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(result.rate,24);header.writeUInt32LE(result.rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 await writeFile('art/combat-review/combat-sounds.wav',Buffer.concat([header,data]));
 await writeFile('art/combat-review/combat-sounds.json',JSON.stringify(result.stats,null,2));
});

test('effects require a gesture, obey mute/hidden tabs and release their bounded audio graphs',async()=>{
 await page.evaluate(async()=>{const {CombatAudio}=await import('/src/world/combatAudio.ts');window.testAudio=new CombatAudio();testAudio.play('impact');});
 assert.equal(await page.evaluate(()=>testAudio.context),null);
 await page.getByRole('button').click();
 await page.waitForFunction(()=>testAudio.context?.state==='running');
 const result=await page.evaluate(async()=>{
  const a=testAudio;
  for(let i=0;i<100;i++)a.play('impact','mob'+i);
  const limited=a.voices.length===24&&a.outputs.size===24;
  a.setLevel(0);a.play('death');const muted=a.outputs.size===0;
  a.setLevel(1);a.play('death');const sounded=a.outputs.size===1;
  Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));a.play('impact');const hidden=a.outputs.size===0;
  Object.defineProperty(document,'hidden',{configurable:true,value:false});a.play('healing');
  const began=a.context.currentTime;
  // Headless audio can start slowly while another renderer is busy. Observe
  // graph cleanup instead of assuming its audio clock matches one wall second.
  for(let i=0;i<60&&a.outputs.size;i++)await new Promise(resolve=>setTimeout(resolve,100));
  const released=a.outputs.size===0;
  if(!released)throw new Error(JSON.stringify({began,end:a.context.currentTime,state:a.context.state,outputs:a.outputs.size}));
  await a.dispose();return {limited,muted,sounded,hidden,released,closed:a.context===null};
 });
 assert.deepEqual(result,{limited:true,muted:true,sounded:true,hidden:true,released:true,closed:true});
});

test('humanoids and forest enemies keep resting eyelids through death and restore them on respawn; shadow glow extinguishes',async()=>{
 const result=await page.evaluate(async()=>{
  const {Character,loadKits}=await import('/src/character/character.ts');const {defaultChar}=await import('/src/data/data.ts');
  const {forestEnemy}=await import('/src/world/forestEnemy.ts');const shadow=await import('/src/world/shadowEnemy.ts');
  await loadKits();window.reviewActors=[];
  const results=[];
  for(const face of [0,1,2,3]){
   const a=new Character({...defaultChar(),face},{outfit:false});a.update(0);a.heal();a.wave();a.die();
   const immediate=a.eyes.every(e=>!e.o.visible)&&a.closedEyes.every(o=>o.visible)&&a.happy.every(o=>!o.visible);
   for(let t=.1;t<8;t+=.1){a.die();a.update(t);}
   const asleep=a.eyes.every(e=>!e.o.visible)&&a.closedEyes.every(o=>o.visible)&&a.happy.every(o=>!o.visible);
   a.revive();const restored=a.eyes.every(e=>e.o.visible)&&a.closedEyes.every(o=>!o.visible);
   results.push({kind:'face'+face,immediate,asleep,restored});
   if(face===0)reviewActors.push(a);else a.dispose();
  }
  for(const kind of ['beast','magic']){
   const a=forestEnemy(kind);a.update(0);a.attack();a.die();
   const eyelids=[];a.root.traverse(o=>{if(o.name==='closed-eyelid')eyelids.push(o);});
   const immediate=eyelids.length===2&&eyelids.every(o=>o.visible);
   for(let t=.1;t<8;t+=.1){a.die();a.attack();a.hit();a.update(t);}
   const eyes=[];a.root.traverse(o=>{if(o.name==='open-eye')eyes.push(o);});
   const asleep=eyes.every(o=>!o.visible)&&eyelids.every(o=>o.visible);
   a.revive();const restored=eyes.every(o=>o.visible)&&eyelids.every(o=>!o.visible);results.push({kind,immediate,asleep,restored});reviewActors.push(a);
  }
  const root=shadow.buildShadowEnemy(0,0,0),rig=root.userData.shadowEnemyRig,target=root.position.clone();
  shadow.playShadowEnemyAction(root,'death',0);shadow.updateShadowEnemy(root,.3,.016,target,false);
  const extinguished=rig.eyes.every(o=>!o.visible)&&rig.eyeGlows.every(o=>!o.visible)&&rig.eyeMaterials.every(o=>o.emissiveIntensity===0);
  shadow.updateShadowEnemy(root,12,.016,target,false);const remainsClosed=rig.eyes.every(o=>!o.visible);
  shadow.resetShadowEnemy(root,12);const restored=rig.eyes.every(o=>o.visible)&&rig.eyeGlows.every(o=>o.visible)&&rig.eyeMaterials.every(o=>o.emissiveIntensity>0);
  window.reviewShadow={root,rig,shadow};
  return {results,extinguished,remainsClosed,restored};
 });
 for(const entry of result.results)assert.deepEqual(entry,{kind:entry.kind,immediate:true,asleep:true,restored:true});
 assert.ok(result.extinguished&&result.remainsClosed&&result.restored);
 assert.deepEqual(errors,[]);
});

test('visual review of resting eyelids on the same production meshes',async()=>{
 await page.evaluate(async()=>{
  // Character already imports this optimized Three instance; use it for the review too.
  const source=await (await fetch('/src/character/character.ts')).text(),threePath=source.match(/from\s+["']([^"']*three[^"']*)["']/)[1];
  const THREE=await import(threePath);
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});renderer.setSize(1400,680);renderer.setPixelRatio(1);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c8d6cd');scene.add(new THREE.HemisphereLight('#fff4dd','#657568',3));
  const light=new THREE.DirectionalLight('#fff3de',3);light.position.set(2,6,5);scene.add(light);
  const camera=new THREE.PerspectiveCamera(30,1400/680,.01,100);camera.position.set(0,2.1,7.6);camera.lookAt(0,1,0);
  const actors=reviewActors;actors.forEach((a,i)=>{a.root.position.x=(i-1)*1.8;scene.add(a.root);a.update(8);});
  renderer.render(scene,camera);window.reviewRender={renderer,scene,camera};
  document.body.style.cssText='margin:16px;background:#c8d6cd;font:20px Georgia;color:#273c32';document.querySelector('button').textContent='Vivos: bandido · jabalí · brote';
 });
 await page.screenshot({path:'art/combat-review/enemy-eyes-alive.png'});
 await page.evaluate(()=>{
  for(const a of reviewActors){a.die();a.update(8.01);}
  const {renderer,scene,camera}=reviewRender;renderer.render(scene,camera);document.querySelector('button').textContent='Cadáveres: párpados cerrados, sin iris ni brillos';
 });
 await page.screenshot({path:'art/combat-review/enemy-eyes-dead.png'});
});

test('real game sounds melee contact once despite a delayed acknowledgement, and ranged impacts wait for arrival', {timeout:90000},async()=>{
 const game=await browser.newPage({viewport:{width:1280,height:800}}),gameErrors=[];
 game.on('pageerror',error=>gameErrors.push(error.message));
 try{
  await game.goto(url+'/?test&graphics=compatible');
  await game.waitForFunction(()=>!!window.brumaluz);await game.locator('#loading.hide').waitFor({state:'attached'});
  const contact=await game.evaluate(async()=>{
   const {starterEquipment}=await import('/src/data/combat.ts');
   window.brumaluz.set({cls:'guerrero',welcome:{origin:0,stage:'completed'},introSeen:true,shadowQuest:null,health:100,resource:-1,equipment:starterEquipment('guerrero')});
   window.brumaluz.play();const state=await import('/src/game/state.ts');window.soundState=state;
   state.story.introArmed=false;state.talk.pendingIsbertoIntroduction=false;
   const combat=await import('/src/game/combat.ts');await combat.beginIsbertoEncounter();
   const {fight,session}=state;window.brumaluz.move(fight.combatEncounter.x-1,fight.combatEncounter.z);
   combat.lockCombatTarget(true);fight.combatAuto=false;fight.nextLocalEnemyAttack=performance.now()/1000+100;
   session.activeCharacterId=crypto.randomUUID();
   const {combatAudio}=await import('/src/game/audio.ts'),original=combatAudio.play.bind(combatAudio);
   window.soundEvents=[];combatAudio.play=(cue,voice,options)=>{soundEvents.push({cue,voice,time:performance.now(),options});original(cue,voice,options);};
   return {encounter:{...fight.combatEncounter,engaged:true,health:95},vitals:{...(await import('/src/data/stats.ts')).vitalsOf(session.state),serverRevision:100},damage:15,healing:0,action:'attack',attackCooldown:1.5};
  });
  await game.route('**/rest/v1/rpc/combat_action',async route=>{await new Promise(r=>setTimeout(r,700));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(contact)});});
  await game.evaluate(async()=>{window.pendingContact=(await import('/src/game/combat.ts')).performWorldCombatAction('attack');});
  await game.waitForFunction(()=>soundEvents.some(e=>e.cue==='impact'));
  assert.equal(await game.evaluate(()=>soundState.fight.combatEncounter.health),110);
  await game.evaluate(()=>pendingContact);
  assert.equal(await game.evaluate(()=>soundState.fight.combatEncounter.health),95);
  assert.equal(await game.evaluate(()=>soundEvents.filter(e=>e.cue==='impact'&&e.voice==='guerrero').length),1);
  const before=await game.evaluate(async()=>{
   const combat=await import('/src/game/combat.ts');combat.releaseCombatTarget();soundState.session.activeCharacterId=null;soundState.fight.nextLocalEnemyAttack=performance.now()/1000+100;
   const feedback=await import('/src/game/combatFeedback.ts'),{holder}=await import('/src/game/stage.ts');feedback.clearCombatFeedback();soundEvents.length=0;
   feedback.combatProjectile(holder.position,soundState.fight.combatTargetRoot.position,'mago',.3);
   return soundEvents.length;
  });
  assert.equal(before,0);
  await game.waitForFunction(()=>soundEvents.some(e=>e.cue==='impact'&&e.voice==='mago'));
  assert.equal(await game.evaluate(()=>soundEvents.filter(e=>e.cue==='impact'&&e.voice==='mago').length),1);
  const attenuation=await game.evaluate(async()=>{
   const {combatSoundAt}=await import('/src/game/combatSound.ts'),{holder}=await import('/src/game/stage.ts');soundEvents.length=0;
   combatSoundAt('enemy','beast',{x:holder.position.x+14,z:holder.position.z});
   combatSoundAt('enemy','beast',{x:holder.position.x+30,z:holder.position.z});return soundEvents;
  });
  assert.equal(attenuation.length,1);assert.equal(attenuation[0].options.gain,.25);
  await game.screenshot({path:'art/combat-review/sound-combat-gameplay.png'});
  await game.evaluate(async()=>{
   const {fight}=soundState;(await import('/src/game/combat.ts')).setCombatEncounter({...fight.combatEncounter,status:'defeated',health:0,looted:false});
  });
  await game.waitForTimeout(400);
  assert.equal(await game.evaluate(()=>soundState.fight.combatTargetRoot.userData.shadowEnemyRig.eyes.every(o=>!o.visible)),true);
  await game.screenshot({path:'art/combat-review/shadow-eyes-dead-gameplay.png'});
  const world=await game.evaluate(async()=>{
   const {WILDERNESS}=await import('/src/data/wilderness.ts'),wild=await import('/src/game/wilderness.ts');
   const {holder}=await import('/src/game/stage.ts'),{serverNow}=await import('/src/data/worldClock.ts');
   (await import('/src/game/combat.ts')).setCombatEncounter(null);soundState.play.city.locationId='pompelin';soundEvents.length=0;
   const mobs=WILDERNESS.spawns.map((site,i)=>({id:'wild_enemy',kind:'wilderness',shared:true,spawn:site.id,enemy:site.enemy,instanceId:crypto.randomUUID(),status:'defeated',health:0,maxHealth:WILDERNESS.enemies[site.enemy].health,x:holder.position.x+i+1,z:holder.position.z,enemyAttackAt:serverNow()+100,revision:1,loot:[],looted:false}));
   const packet=()=>({wilderness:{shared:true,serverTime:serverNow(),mobs,corpses:[],inCombat:false}});
   wild.receiveWilderness(packet());wild.tickWilderness(0,.016);const quietArrival=soundEvents.length===0;
   for(const m of mobs){m.status='idle';m.health=m.maxHealth;m.instanceId=crypto.randomUUID();m.revision=2;}
   wild.receiveWilderness(packet());wild.tickWilderness(.1,.016);
   for(const m of mobs){m.status='defeated';m.health=0;m.revision=3;}
   wild.receiveWilderness(packet());wild.tickWilderness(.2,.016);wild.receiveWilderness(packet());wild.tickWilderness(.3,.016);
   const deaths=soundEvents.filter(e=>e.cue==='death').length;
   const lids=()=>mobs.map(m=>{const root=wild.wildernessRoot(m),list=[];root.traverse(o=>{if(o.name==='closed-eyelid')list.push(o.visible);});return list;});
   const closed=lids().every(list=>list.length===2&&list.every(Boolean));
   for(const m of mobs){m.status='idle';m.health=m.maxHealth;m.instanceId=crypto.randomUUID();m.revision=4;}
   wild.receiveWilderness(packet());wild.tickWilderness(.4,.016);const restored=lids().every(list=>list.length===2&&list.every(v=>!v));
   return {quietArrival,deaths,expected:mobs.length,closed,restored};
  });
  assert.deepEqual(world,{quietArrival:true,deaths:world.expected,expected:world.expected,closed:true,restored:true});
  assert.deepEqual(gameErrors,[]);
 }finally{await game.close();}
});
