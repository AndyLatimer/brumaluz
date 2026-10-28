import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import ts from 'typescript';
import { Vector3 } from 'three';
import { chromium } from 'playwright';

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const { createLineOfSight } = await import(moduleUrl(await compile('../src/world/lineOfSight.ts')));
const point = (x, y, z) => new Vector3(x, y, z);

test('the shadow holds its telegraph through hits, strikes at impact and resets after death without adding lights', async () => {
  const source = (await compile('../src/world/shadowEnemy.ts')).replace("'three'", JSON.stringify(import.meta.resolve('three')));
  const { buildShadowEnemy, playShadowEnemyAction, updateShadowEnemy, resetShadowEnemy } = await import(moduleUrl(source));
  const root = buildShadowEnemy(0, 0, 0), rig = root.userData.shadowEnemyRig;
  let lights = 0; root.traverse(part => { if (part.isLight) lights++; });
  assert.equal(lights, 0, 'Spawning the enemy must not change the city light count or recompile its materials');
  playShadowEnemyAction(root, 'prepare', 0, 1.4);
  playShadowEnemyAction(root, 'hit', .7);
  assert.equal(rig.action, 'prepare');
  updateShadowEnemy(root, 1, .016, point(1, 0, 0), true);
  assert.equal(rig.action, 'prepare');
  updateShadowEnemy(root, 1.4, .016, point(1, 0, 0), true);
  assert.equal(rig.action, 'attack');
  playShadowEnemyAction(root, 'death', 2);
  updateShadowEnemy(root, 4, .016, point(1, 0, 0), false);
  resetShadowEnemy(root, 4);
  assert.equal(rig.action, 'idle');
  assert.equal(rig.model.scale.x, .72);
});

test('target sight blocks walls, rotated boxes, trunks and terrain, but permits shots over low cover', () => {
  const sight = createLineOfSight([
    { x: 4, z: 0, r: 0, hx: .5, hz: 2, bottomY: 0, topY: 3 },
    { x: 4, z: 8, r: 0, hx: 2, hz: .15, cos: Math.SQRT1_2, sin: Math.SQRT1_2, topY: 3 },
    { x: 4, z: 16, r: .4, topY: 3 },
    { x: 4, z: 24, r: 0, hx: 1, hz: 1, topY: .5 },
  ], () => 0);
  for (const z of [0, 8, 16]) assert.equal(sight(point(0, 1, z), point(8, 1, z)), false);
  assert.equal(sight(point(0, 1, 24), point(8, 1, 24)), true);
  assert.equal(sight(point(0, 1, 4), point(8, 1, 4)), true);
  assert.equal(sight(point(4, .1, 0), point(4, 4, 0)), false, 'vertical rays still test cover');
  const hill = createLineOfSight([], x => x > 3 && x < 5 ? 2 : 0);
  assert.equal(hill(point(0, 1, 0), point(8, 1, 0)), false);
});

test('looking at a target never scans distant obstacles after indexing', () => {
  let inspected = 0;
  const distant = Array.from({ length: 20000 }, (_, i) => ({
    x: 1000 + i * 3, z: 1000, r: .5,
    get topY() { inspected++; return 4; },
  }));
  const sight = createLineOfSight(distant, () => 0);
  inspected = 0;
  for (let i = 0; i < 1000; i++) assert.equal(sight(point(0, 2, 0), point(10, 1, 0)), true);
  assert.equal(inspected, 0, 'cost depends on nearby cells, not total city geometry');
});

let server, browser;
const url = 'http://127.0.0.1:4187';
before(async () => {
  server = spawn(process.execPath, ['--input-type=module', '-e', `
    const { createServer } = await import('vite');
    const server = await createServer({ cacheDir: 'node_modules/.vite-intro-combat', server: { host: '127.0.0.1', port: 4187, strictPort: true, hmr: false, watch: null } });
    await server.listen(); server.printUrls();
  `]);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Intro combat server did not start')), 15000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Vite exited: ${code}`)));
    server.stdout.on('data', data => { if (data.toString().includes('4187')) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
});

async function openFight(cls = 'guerrero', welcome = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/?test&graphics=compatible${welcome ? '&welcome' : ''}`);
  try { await page.waitForFunction(() => !!window.brumaluz); }
  catch (error) { console.error('Intro startup errors:', errors, await page.locator('#loading').textContent()); await context.close(); throw error; }
  await page.locator('#loading.hide').waitFor({ state: 'attached' });
  await page.evaluate(async cls => {
    const { starterEquipment } = await import('/src/data/combat.ts');
    window.brumaluz.set({ cls, welcome: { origin: 0, stage: 'completed' }, introSeen: true,
      shadowQuest: null, health: 100, resource: -1, equipment: starterEquipment(cls) });
    const {session}=await import('/src/game/state.ts');
    session.state.health=(await import('/src/data/stats.ts')).vitalsOf(session.state).health;
    window.brumaluz.play();
    const { story, talk } = await import('/src/game/state.ts');
    story.introArmed = false; talk.pendingIsbertoIntroduction = false;
    const { beginIsbertoEncounter } = await import('/src/game/combat.ts');
    await beginIsbertoEncounter();
    const { fight } = await import('/src/game/state.ts');
    // Playwright 1.48 treats an async polling predicate as truthy immediately.
    // Keep live module references so all waitForFunction checks are synchronous.
    window.combatTestState=await import('/src/game/state.ts');
    window.combatTestScene=(await import('/src/game/stage.ts')).scene;
    window.brumaluz.move(fight.combatEncounter.x - 5, fight.combatEncounter.z);
    window.brumaluz.view(-Math.PI / 2, .55, 12);
  }, cls);
  return { context, page, errors };
}

test('click targeting starts a complete fight and loot without tutorial panels or extra combat buttons', { timeout: 90000 }, async () => {
  const { context, page, errors } = await openFight();
  try {
    assert.equal(await page.locator('#combat-tutorial, #combat-controls, .ab-feedback').count(),0);
    await page.waitForFunction(() => document.querySelector('#target-frame')?.dataset.targetId === 'enemy:shadowling');
    const enemy=await page.evaluate(async()=>{
      const {fight}=await import('/src/game/state.ts');const {camera}=await import('/src/game/stage.ts');
      const p=fight.combatTargetRoot.position.clone();p.y+=.8;p.project(camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};
    });
    await page.mouse.click(enemy.x,enemy.y);
    await page.waitForFunction(()=>window.combatTestState.fight.combatEncounter.health<110);
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.combatTestState.vitals.skillReadyAt > performance.now());
    await page.waitForFunction(() => window.combatTestState.fight.combatEncounter.status === 'defeated', null, { timeout: 30000 });
    await page.evaluate(async () => {
      const { fight } = await import('/src/game/state.ts');
      window.brumaluz.move(fight.combatEncounter.x, fight.combatEncounter.z + 1);
    });
    await page.keyboard.press('KeyE');
    await page.getByRole('button', { name: 'Recoger todo', exact: true }).click();
    assert.equal(await page.locator('#combat-tutorial, #combat-controls, .ab-feedback').count(),0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('shadow attacks use ordinary reach and never create floor warnings or area phases', { timeout: 60000 }, async () => {
  const { context, page, errors } = await openFight('mago');
  try {
    await page.evaluate(async () => {
      const { fight } = await import('/src/game/state.ts');
      fight.nextLocalEnemyAttack = 0;
      window.brumaluz.move(fight.combatEncounter.x - 1, fight.combatEncounter.z);
    });
    await page.waitForFunction(()=>window.combatTestState.fight.combatEncounter.attackKind==='melee'&&!!window.combatTestState.fight.combatEncounter.windup);
    const before = await page.evaluate(async () => {
      const { fight, session } = await import('/src/game/state.ts');
      const hp = session.state.health;
      const aim = { x: fight.combatEncounter.aimX, z: fight.combatEncounter.aimZ };
      (await import('/src/game/combat.ts')).releaseCombatTarget();
      window.brumaluz.move(aim.x - 3, aim.z);
      return { hp, aim };
    });
    await page.waitForTimeout(1800);
    assert.equal(await page.evaluate(async () => (await import('/src/game/state.ts')).session.state.health), before.hp);
    await page.evaluate(()=>{const {fight}=window.combatTestState;window.brumaluz.move(fight.combatEncounter.x-1,fight.combatEncounter.z);fight.nextLocalEnemyAttack=0;});
    await page.waitForFunction(hp => window.combatTestState.session.state.health < hp, before.hp);
    assert.equal(await page.evaluate(()=>window.combatTestScene.getObjectByName('shadow-attack-warning')===undefined),true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Escape cancels a prepared skill, and every class can use its introductory skill', { timeout: 90000 }, async () => {
  const { context, page, errors } = await openFight();
  try {
    const cancelled = await page.evaluate(async () => {
      const { fight } = await import('/src/game/state.ts');
      const { lockCombatTarget, performWorldCombatAction, releaseCombatTarget } = await import('/src/game/combat.ts');
      window.brumaluz.move(fight.combatEncounter.x - 1, fight.combatEncounter.z);
      lockCombatTarget(true);
      const action = performWorldCombatAction('skill'); releaseCombatTarget(); await action;
      return fight.combatEncounter.health;
    });
    assert.equal(cancelled, 110);
    for (const cls of ['guerrero', 'picaro', 'mago', 'explorador', 'clerigo']) {
      const result = await page.evaluate(async cls => {
        const { fight, session, vitals } = await import('/src/game/state.ts');
        const { starterEquipment } = await import('/src/data/combat.ts');
        const { setCombatEncounter, lockCombatTarget, performWorldCombatAction, resetCombatActions, releaseCombatTarget } = await import('/src/game/combat.ts');
        releaseCombatTarget(); resetCombatActions();
        window.brumaluz.set({ cls, health: 60, resource: -1, equipment: starterEquipment(cls) });
        vitals.skillReadyAt = 0;
        fight.localCombatState = null;
        setCombatEncounter({ ...fight.combatEncounter, instanceId: crypto.randomUUID(), engaged: false, windup: undefined, health: 100 });
        fight.nextLocalEnemyAttack = performance.now() / 1000 + 100;
        window.brumaluz.move(fight.combatEncounter.x - 1, fight.combatEncounter.z);
        lockCombatTarget(true); await performWorldCombatAction('skill'); releaseCombatTarget();
        return { hp: session.state.health, enemy: fight.combatEncounter.health, cooldown: vitals.skillReadyAt > performance.now() };
      }, cls);
      assert.equal(result.cooldown, true, cls);
      if (cls === 'clerigo') { assert.ok(result.hp > 60); assert.equal(result.enemy, 100); }
      else assert.ok(result.enemy < 100, cls);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('targeting enemies in the full city does not raycast render meshes', { timeout: 90000 }, async () => {
  const { context, page, errors } = await openFight('guerrero', true);
  try {
    const result = await page.evaluate(async () => {
      const { updateTargetFrame } = await import('/src/game/targets.ts');
      const { holder } = await import('/src/game/stage.ts');
      const { fight, ui } = await import('/src/game/state.ts');
      let calls = 0;
      window.brumaluz.city().root.traverse(object => { if (object.isMesh) object.raycast = () => { calls++; }; });
      window.brumaluz.move(fight.combatEncounter.x - 1.5, fight.combatEncounter.z);
      const from = holder.position.clone(); from.y += 1;
      for (let i = 0; i < 100; i++) ui.targetFrame.canSee({ root: fight.combatTargetRoot, height: 1.4 }, from);
      updateTargetFrame();
      return { calls, hasSight: !!window.brumaluz.city().lineOfSight };
    });
    assert.equal(result.hasSight, true);
    assert.equal(result.calls, 0);
    await page.waitForFunction(() => document.querySelector('#target-frame')?.dataset.targetId === 'enemy:shadowling');
    await page.screenshot({ path: 'art/intro-review/combat-tutorial.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#target-frame').evaluate(element => {
      const rect=element.getBoundingClientRect(); return rect.left>=0 && rect.right<=innerWidth && element.scrollWidth<=element.clientWidth;
    }), true, 'The selected enemy fits a mobile viewport');
    assert.equal(await page.locator('#combat-tutorial, #combat-controls, .enemy-cast').count(),0);
    await page.screenshot({ path: 'art/intro-review/combat-tutorial-mobile.png' });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('normal enemies give quiet experience and loot through successive kills without interrupting another target', { timeout: 60000 }, async () => {
  const { context, page, errors } = await openFight();
  try {
    const result=await page.evaluate(async () => {
      const { fight, play, session }=await import('/src/game/state.ts');
      const { WILDERNESS }=await import('/src/data/wilderness.ts');
      const { receiveWilderness, tickWilderness, wildernessInteractions }=await import('/src/game/wilderness.ts');
      const { setCombatEncounter }=await import('/src/game/combat.ts');
      const { clearToasts }=await import('/src/ui/toast.ts');
      const { clearCombatFeedback }=await import('/src/game/combatFeedback.ts');
      const { serverNow }=await import('/src/data/worldClock.ts');
      const { holder }=await import('/src/game/stage.ts');
      setCombatEncounter(null);clearToasts();clearCombatFeedback();
      play.city.locationId='pompelin';
      const mobs=WILDERNESS.spawns.slice(0,4).map((site,index)=>({
        id:'wild_enemy',kind:'wilderness',shared:true,spawn:site.id,enemy:site.enemy,
        instanceId:crypto.randomUUID(),label:WILDERNESS.enemies[site.enemy].label,status:'active',engaged:true,
        health:WILDERNESS.enemies[site.enemy].health,maxHealth:WILDERNESS.enemies[site.enemy].health,
        x:holder.position.x+index+1,z:holder.position.z,enemyAttackAt:serverNow()+100,revision:1,attackingYou:true,loot:[],looted:false,
      }));
      const packet=(corpses,revision)=>({wilderness:{shared:true,serverTime:serverNow(),mobs,corpses,inCombat:true},vitals:{serverRevision:revision}});
      receiveWilderness(packet([],1));tickWilderness(0,.016);
      const livingInteractions=wildernessInteractions().map(item=>item.id);
      setCombatEncounter({...mobs[3],status:'active'});fight.combatAuto=false;
      const target=fight.combatEncounter.instanceId;
      const corpse=mob=>({...mob,status:'defeated',health:0,loot:[{id:Object.keys(WILDERNESS.enemies[mob.enemy].loot)[0],count:1}]});
      const bodies=mobs.slice(0,3).map(corpse);
      receiveWilderness(packet(bodies.slice(0,1),2));
      const afterFirst=document.querySelectorAll('.combat-float.experience').length;
      receiveWilderness(packet(bodies,3));
      const afterThree=document.querySelectorAll('.combat-float.experience').length;
      receiveWilderness(packet(bodies,3));
      return {
        livingInteractions,afterFirst,afterThree,afterRepeat:document.querySelectorAll('.combat-float.experience').length,
        texts:[...document.querySelectorAll('.combat-float.experience')].map(element=>element.textContent),
        expected:[WILDERNESS.enemies[mobs[0].enemy].xp,WILDERNESS.enemies[mobs[1].enemy].xp+WILDERNESS.enemies[mobs[2].enemy].xp],
        loot:wildernessInteractions().map(item=>item.id),targetRetained:target===fight.combatEncounter.instanceId,
        window:document.querySelector('#window-backdrop').hidden,toast:document.querySelector('#toast').classList.contains('show'),
      };
    });
    assert.deepEqual(result.livingInteractions,[],'Living enemies do not use an E interaction');
    assert.equal(result.afterFirst,1);assert.equal(result.afterThree,2);
    assert.equal(result.afterRepeat,2,'Snapshots never announce the same XP twice');
    assert.deepEqual(result.texts,result.expected.map(xp=>`+${xp} EXP`));
    assert.equal(result.loot.length,3);assert.ok(result.loot.every(id=>id.startsWith('wildloot:')));
    assert.equal(result.targetRetained,true,'Killing other enemies does not release the living target');
    assert.equal(result.window,true);assert.equal(result.toast,false,'Ordinary kills have no victory announcement');
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});

test('skill recasts resist pending heartbeats, stale snapshots, repeated deadlines and a skewed PC clock',async()=>{
  const source=(await compile('../src/game/skillCooldown.ts'))
    .replace(/import \{ vitals \} from ['"]\.\/state['"];?/, 'const vitals={skillReadyAt:0};export const state=vitals;')
    .replace(/import \{ serverNow \} from ['"]\.\.\/data\/worldClock['"];?/, 'let time=0;const performance={now:()=>time};const serverNow=()=>1000+time/1000;export const advance=ms=>time+=ms;');
  const cd=await import(moduleUrl(source));
  const first=cd.predictSkillCooldown(6);
  cd.syncSkillCooldown({deadline:0,serverTime:1000,revision:10});
  assert.equal(cd.state.skillReadyAt,6000,'An earlier heartbeat cannot mark a pending cast ready');
  cd.advance(400);
  cd.finishSkillCooldown(first,{deadline:1006,serverTime:1000.2,revision:11},0);
  assert.ok(Math.abs(cd.state.skillReadyAt-6000)<.001,'Round-trip time does not extend the recast');
  cd.syncSkillCooldown({deadline:0,serverTime:1000.4,revision:10});
  cd.syncSkillCooldown({deadline:0,serverTime:1000.4,revision:11});
  assert.ok(Math.abs(cd.state.skillReadyAt-6000)<.001);
  cd.advance(1000);
  cd.syncSkillCooldown({deadline:1006,serverTime:1000.2,revision:11});
  assert.ok(Math.abs(cd.state.skillReadyAt-6000)<.001,'Repeated samples never restart a countdown');
  cd.advance(5000);
  cd.syncSkillCooldown({deadline:1006,serverTime:1000.2,revision:11});
  assert.ok(cd.state.skillReadyAt<=6400,'An expired countdown stays expired');
  cd.resetSkillCooldown();
  const cancelled=cd.predictSkillCooldown(6);cd.cancelSkillCooldown(cancelled);
  assert.equal(cd.state.skillReadyAt,0,'Rejected skills do not charge a recast');
  cd.syncSkillCooldown({deadline:500006,serverTime:500000,revision:12});
  assert.equal(cd.state.skillReadyAt,12400,'The server sample works even when the PC clock is wrong');
  cd.resetSkillCooldown();
  const relative=cd.predictSkillCooldown(6);
  cd.advance(700);
  cd.finishSkillCooldown(relative,{remaining:6,revision:30},6400);
  const relativeDeadline=cd.state.skillReadyAt;
  cd.advance(1000);
  cd.syncSkillCooldown({remaining:6,revision:30});
  assert.equal(cd.state.skillReadyAt,relativeDeadline,'Replayed relative samples of one revision cannot extend the recast');
  cd.advance(6000);
  cd.syncSkillCooldown({remaining:6,revision:30});
  assert.ok(cd.state.skillReadyAt<13400,'An expired relative sample stays expired');
  cd.resetSkillCooldown();
});

test('the shadow cinematic and remapped skill binding work without adding a tutorial panel', {timeout:60000},async()=>{
  const {context,page,errors}=await openFight();
  try{
    await page.evaluate(async()=>{
      const {playMonsterReveal}=await import('/src/story/scenes.ts');playMonsterReveal();
    });
    await page.locator('#cinematic .cinematic-line strong').filter({hasText:'Isberto'}).waitFor();
    assert.match(await page.locator('#cinematic .cinematic-line span').textContent(),/carbón/);
    await page.evaluate(async()=>{(await import('/src/story/scenes.ts')).cinematic.frame(7.1);});
    await page.locator('#cinematic[data-shot="creature"]').waitFor();
    assert.match(await page.locator('#cinematic .cinematic-line span').textContent(),/madera negra/);
    await page.evaluate(async()=>{
      const {cinematic,removeMonsterPreview}=await import('/src/story/scenes.ts');cinematic.cancel();removeMonsterPreview();
      (await import('/src/game/combatTutorial.ts')).noteTutorialAction('attack',1,0);
      (await import('/src/game/combat.ts')).lockCombatTarget(true);
      const {fight}=await import('/src/game/state.ts');fight.combatAuto=false;
      const data=new DataTransfer();data.setData('application/x-brumaluz-item',JSON.stringify({id:'skill:heavy_strike',from:0,page:0}));
      document.querySelector('.ab-slot[data-index="4"]').dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true}));
    });
    assert.deepEqual(await page.evaluate(async()=>(await import('/src/ui/actionBar.ts')).actionBarSkillBinding()),{key:'5',otherPage:false});
    assert.equal(await page.locator('#combat-tutorial').count(),0);
    await page.evaluate(async()=>{(await import('/src/ui/actionBar.ts')).toggleActionBarPage();});
    assert.deepEqual(await page.evaluate(async()=>(await import('/src/ui/actionBar.ts')).actionBarSkillBinding()),{key:'5',otherPage:true});
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('a slow skill response keeps one visible recast, rejects stale heartbeats and preserves the action slot', {timeout:60000},async()=>{
  const {context,page,errors}=await openFight();
  let calls=0;
  const actions=[];
  try{
    const reply=await page.evaluate(async()=>{
      const {fight,session}=await import('/src/game/state.ts');
      const {vitalsOf}=await import('/src/data/stats.ts');
      const {setCombatEncounter,lockCombatTarget}=await import('/src/game/combat.ts');
      const {renderActionBar}=await import('/src/ui/actionBar.ts');
      session.activeCharacterId=crypto.randomUUID();
      window.brumaluz.move(fight.combatEncounter.x-1,fight.combatEncounter.z);
      // Keep this setup synchronous: engaging enables auto-attack, so yielding to
      // an import before disabling it can send a basic attack instead of the skill.
      setCombatEncounter({...fight.combatEncounter,engaged:true});
      lockCombatTarget(true);fight.combatAuto=false;
      renderActionBar(true);
      const slot=document.querySelector('.ab-slot[data-skill-id]');slot.dataset.preserved='yes';
      return {encounter:{...fight.combatEncounter,health:82,engaged:true},vitals:{...vitalsOf(session.state),resource:65,serverRevision:20},damage:18,healing:0,skillCooldown:6};
    });
    await page.route('**/rest/v1/rpc/combat_action',async route=>{
      calls++;actions.push(route.request().postDataJSON().p_action);
      await new Promise(resolve=>setTimeout(resolve,700));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reply)});
    });
    const response=page.waitForResponse(response=>response.url().includes('/rpc/combat_action')&&response.request().method()==='POST');
    await page.keyboard.press('Digit1');
    const slot=page.locator('.ab-slot[data-skill-id]');
    await page.waitForFunction(()=>document.querySelector('.ab-slot[data-skill-id]')?.classList.contains('on-cooldown'));
    const pending=await page.evaluate(async()=>{
      const {vitals}=await import('/src/game/state.ts');
      (await import('/src/game/skillCooldown.ts')).syncSkillCooldown({deadline:0,serverTime:0,revision:1});
      return (vitals.skillReadyAt-performance.now())/1000;
    });
    assert.ok(pending>5&&pending<=6,'The recast is visible before the response and cannot be cleared by an old heartbeat');
    await page.keyboard.press('Digit1');
    await response;
    await page.waitForFunction(()=>!window.combatTestState.fight.combatBusy);
    const after=await page.evaluate(async()=>{
      const {vitals}=await import('/src/game/state.ts');
      const {syncSkillCooldown}=await import('/src/game/skillCooldown.ts');
      syncSkillCooldown({deadline:0,serverTime:0,revision:1});
      return (vitals.skillReadyAt-performance.now())/1000;
    });
    assert.deepEqual(actions,['heavy_strike'],'The delayed RPC must be the skill, not a setup auto-attack');
    assert.ok(after>4&&after<5.9,`Acknowledgement does not restart a full six seconds: ${after}; calls=${calls}`);
    assert.equal(calls,1,'Repeated presses do not cast again during the cooldown');
    assert.equal(await slot.getAttribute('data-preserved'),'yes');
    assert.equal(await slot.getAttribute('aria-disabled'),'true');
    await page.waitForFunction(()=>!document.querySelector('.ab-slot[data-skill-id]')?.classList.contains('on-cooldown'),null,{timeout:10000});
    assert.equal(await slot.locator('.ab-cooldown-time').textContent(),'');
    assert.equal(await slot.getAttribute('aria-disabled'),'false');
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('ranged damage waits for projectile arrival, attacks keep their full recovery and effects reuse geometry', {timeout:60000},async()=>{
  const {context,page,errors}=await openFight('mago');
  try{
    const result=await page.evaluate(async()=>{
      const {fight}=await import('/src/game/state.ts');
      const {lockCombatTarget,performWorldCombatAction,getCombatActionFeedback,releaseCombatTarget}=await import('/src/game/combat.ts');
      const {combatImpact,clearCombatFeedback}=await import('/src/game/combatFeedback.ts');
      const {scene}=await import('/src/game/stage.ts');
      window.brumaluz.move(fight.combatEncounter.x-5,fight.combatEncounter.z);
      lockCombatTarget(true);fight.combatAuto=false;fight.nextLocalEnemyAttack=performance.now()/1000+100;
      const action=performWorldCombatAction('attack');
      await new Promise(resolve=>setTimeout(resolve,220));
      const inFlight=!!scene.getObjectByName('combat-projectile'),before=fight.combatEncounter.health;
      await action;
      const after=fight.combatEncounter.health,recovery=getCombatActionFeedback();
      clearCombatFeedback();combatImpact(fight.combatTargetRoot.position);combatImpact(fight.combatTargetRoot.position);
      const sparks=scene.children.filter(mesh=>mesh.isMesh&&mesh.geometry.type==='IcosahedronGeometry');
      const geometries=new Set(sparks.map(mesh=>mesh.geometry));clearCombatFeedback();releaseCombatTarget();
      return {inFlight,before,after,recovery,count:sparks.length,geometries:geometries.size};
    });
    assert.equal(result.inFlight,true);assert.equal(result.before,110);assert.ok(result.after<110);
    assert.equal(result.recovery.state,'recovering');assert.equal(result.recovery.duration,.55);
    assert.equal(result.count,8,'Compatible mode reduces the spark budget for repeated impacts');assert.equal(result.geometries,1,'Repeated hits share geometry instead of allocating it per spark');
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('the shadow fires a tracking bolt at a moving ranged player and melee attacks alternate authored clips', {timeout:60000},async()=>{
 const {context,page,errors}=await openFight('mago');
 try{
  await page.evaluate(async()=>{
   const {fight}=await import('/src/game/state.ts');
   (await import('/src/game/combat.ts')).setCombatEncounter({...fight.combatEncounter,engaged:true,attackSeq:1});
   (await import('/src/game/combat.ts')).releaseCombatTarget();
   window.brumaluz.move(fight.combatEncounter.x-8,fight.combatEncounter.z);fight.nextLocalEnemyAttack=0;
  });
  await page.waitForFunction(()=>{const {fight}=window.combatTestState;return fight.combatEncounter.attackKind==='bolt'&&!!fight.combatEncounter.windup;});
  const hp=await page.evaluate(async()=>{
   const {fight,session}=await import('/src/game/state.ts');const before=session.state.health;
   window.brumaluz.move(fight.combatEncounter.x-10,fight.combatEncounter.z+1);return before;
  });
  await page.waitForFunction(hp=>window.combatTestState.session.state.health<hp,hp,{timeout:6000});
  const clips=await page.evaluate(async()=>{
   const {starterEquipment}=await import('/src/data/combat.ts');
   window.brumaluz.set({cls:'guerrero',equipment:starterEquipment('guerrero')});
   const actor=window.brumaluz.char(),names=[];
   for(let i=0;i<3;i++){actor.attack();names.push(actor.oneShot.getClip().name);}
   return names;
  });
  assert.equal(new Set(clips).size,3);assert.ok(clips.includes('Combat_Thrust'));assert.ok(clips.includes('Combat_Backhand'));
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('skills interrupt automatic windup and recovery, while rejected presses never cast later', {timeout:60000},async()=>{
 const {context,page,errors}=await openFight();
 try{
  const first=await page.evaluate(async()=>{
   const {fight,play}=await import('/src/game/state.ts');const combat=await import('/src/game/combat.ts');
   const {holder}=await import('/src/game/stage.ts');
   window.brumaluz.move(fight.combatEncounter.x-1,fight.combatEncounter.z);fight.nextLocalEnemyAttack=performance.now()/1000+100;
   play.moveTarget=holder.position.clone().addScalar(10);combat.lockCombatTarget(true);fight.combatAuto=false;
   const clearedDestination=play.moveTarget===null,before=fight.combatEncounter.health;
   const basic=combat.performWorldCombatAction('attack');combat.useWorldCombatSkill();await basic;
   return {clearedDestination,before,feedback:combat.getCombatActionFeedback()};
  });
  await page.waitForFunction(()=>!window.combatTestState.fight.combatBusy);
  const after=await page.evaluate(async()=>{
   const {fight}=await import('/src/game/state.ts');return {health:fight.combatEncounter.health,nextAttack:fight.localCombatState.nextAttack,nextSkill:fight.localCombatState.nextSkill};
  });
  assert.equal(first.clearedDestination,true,'Selecting an enemy clears the previous movement destination');
  assert.ok(after.health<first.before,JSON.stringify({first,after}));assert.equal(after.nextAttack,0,'The interrupted basic swing never deals damage');assert.ok(after.nextSkill>0);
  assert.equal(await page.evaluate(async()=>(await import('/src/game/state.ts')).fight.combatAuto),false,'The first confirmed hit does not re-enable stopped automatic attacks');
  await page.waitForTimeout(1000);
  const recovery=await page.evaluate(async()=>{
   const {fight,session}=await import('/src/game/state.ts');const combat=await import('/src/game/combat.ts');
   (await import('/src/game/skillCooldown.ts')).resetSkillCooldown();fight.localCombatState.nextSkill=0;session.state.resource=-1;
   await combat.performWorldCombatAction('attack');const before=combat.getCombatActionFeedback();combat.useWorldCombatSkill();
   return {before,after:combat.getCombatActionFeedback()};
  });
  assert.equal(recovery.before.state,'recovering');assert.equal(recovery.after.state,'casting','Skills start during basic recovery');
  await page.waitForFunction(()=>!window.combatTestState.fight.combatBusy);
  await page.waitForTimeout(1000);
  const deadline=await page.evaluate(async()=>{
   const {fight,vitals}=await import('/src/game/state.ts');vitals.skillReadyAt=performance.now()+120;
   (await import('/src/ui/actionBar.ts')).useActionBarSlot(0);return fight.localCombatState.nextSkill;
  });
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(async()=>(await import('/src/game/state.ts')).fight.localCombatState.nextSkill),deadline,'Pressing just before ready does not schedule another cast');
  assert.doesNotMatch(await page.locator('#action-bar').textContent(),/cola/i);
  const blocked=await page.evaluate(async()=>{
   const {fight,play,session,vitals}=await import('/src/game/state.ts');const combat=await import('/src/game/combat.ts');
   vitals.skillReadyAt=0;const sight=play.city.lineOfSight;play.city.lineOfSight=()=>false;
   const before=session.state.resource;combat.useWorldCombatSkill();play.city.lineOfSight=sight;
   return {busy:fight.combatBusy,resource:session.state.resource,before};
  });
  assert.equal(blocked.busy,false);assert.equal(blocked.resource,blocked.before,'An obstructed skill spends no resource');
  assert.equal(await page.locator('.ab-feedback').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('contact feedback follows the swing, rewards explain progress and combat stays readable on mobile', {timeout:60000},async()=>{
 const {context,page,errors}=await openFight('guerrero',true);
 try{
  const contact=await page.evaluate(async()=>{
   const {fight,session}=await import('/src/game/state.ts');const combat=await import('/src/game/combat.ts');
   const {scene}=await import('/src/game/stage.ts');const {vitalsOf}=await import('/src/data/stats.ts');
   session.activeCharacterId=crypto.randomUUID();window.brumaluz.move(fight.combatEncounter.x-1,fight.combatEncounter.z);
   combat.lockCombatTarget(true);fight.combatAuto=false;
   return {encounter:{...fight.combatEncounter,engaged:true,health:95},vitals:{...vitalsOf(session.state),serverRevision:100},damage:15,healing:0,action:'attack',attackCooldown:1.5};
  });
  await page.route('**/rest/v1/rpc/combat_action',async route=>{
   await new Promise(r=>setTimeout(r,700));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(contact)});
  });
  await page.evaluate(async()=>{window.contactAction=(await import('/src/game/combat.ts')).performWorldCombatAction('attack');});
  await page.waitForFunction(()=>!!window.combatTestScene.getObjectByName('combat-slash'));
  assert.equal(await page.evaluate(async()=>(await import('/src/game/state.ts')).fight.combatEncounter.health),110,'Contact appears before the delayed authoritative health update');
  await page.evaluate(()=>window.contactAction);
  assert.equal(await page.evaluate(async()=>(await import('/src/game/state.ts')).fight.combatEncounter.health),95);
  await page.evaluate(async()=>{
   const {session,fight}=await import('/src/game/state.ts');const {combatReward}=await import('/src/game/combatFeedback.ts');
   const combat=await import('/src/game/combat.ts');const {vitalsOf}=await import('/src/data/stats.ts');
   combat.releaseCombatTarget();session.activeCharacterId=null;fight.nextLocalEnemyAttack=performance.now()/1000+100;
   combat.applyCombatResult({data:{...session.state,experience:42,level:2},vitals:{...vitalsOf(session.state),serverRevision:101}});
   combatReward(18,3);combatReward(12,2);
  });
  await page.locator('#combat-reward:not([hidden])').waitFor();
  assert.match(await page.locator('#combat-reward strong').textContent(),/\+30 EXP.*\+5 Pelines/);
  await page.waitForFunction(()=>document.querySelector('#combat-reward span').textContent.includes('42 / 283 EXP'));
  assert.match(await page.locator('#combat-reward span').textContent(),/faltan 241/);
  assert.equal(await page.locator('#hud-xp-text').isVisible(),true);
  assert.equal(await page.locator('#levelup-title').textContent(),'Nivel 2');
  await page.waitForTimeout(3100);
  await mkdir('art/combat-review',{recursive:true});
  await page.screenshot({path:'art/combat-review/combat-desktop.png'});
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.locator('#hud-xp-text').isVisible(),true);
   const layout=await page.evaluate(()=>{
    const reward=document.querySelector('#combat-reward').getBoundingClientRect(),target=document.querySelector('#target-frame').getBoundingClientRect();
    return {fits:reward.left>=0&&reward.right<=innerWidth,overlap:!document.querySelector('#target-frame').hidden&&reward.left<target.right&&reward.right>target.left&&reward.top<target.bottom&&reward.bottom>target.top};
   });
   assert.equal(layout.fits,true);assert.equal(layout.overlap,false);
  }
  await page.screenshot({path:'art/combat-review/combat-mobile.png'});
  await page.evaluate(async()=>{(await import('/src/game/playSession.ts')).exitPlay();});
  assert.equal(await page.locator('#combat-reward').isVisible(),false,'Leaving play clears recent rewards');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
