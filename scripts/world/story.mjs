// Pruebas del mundo en el navegador: Diario, botín de la criatura, bolsas de pelines y la historia de inicio.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, browser, fixture, backend, leave } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('quest journal tracking persists without changing progress, completed entries or personal waypoints', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const prepare=async()=>{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({welcome:{origin:0,stage:'active'},shadowQuest:null});
      window.brumaluz.play();
      // Mismo desplazamiento que antes respecto al distintivo, ahora junto al mercado de la plaza del Levante.
      window.brumaluz.move(122.8,3.1);
      window.brumaluz.view(Math.atan2(-15.8,5.7),.55,12);
    });
    await page.locator('.minimap-canvas').waitFor();
  };
  const journal=async()=>{
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="quests"]').click();
    await page.locator('.quest-journal').waitFor();
  };
  try{
    await prepare();
    await page.locator('#quest-tracker').waitFor();
    await journal();
    const untrack=page.getByRole('button',{name:'Dejar de seguir misión',exact:true});
    assert.equal(await untrack.getAttribute('aria-pressed'),'true');
    await untrack.click();
    const track=page.getByRole('button',{name:'Seguir misión',exact:true});
    assert.equal(await track.getAttribute('aria-pressed'),'false');
    assert.equal(await track.evaluate(el=>el===document.activeElement),true,'Tracking does not destroy keyboard focus');
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'active'}}));
    assert.equal(await track.getAttribute('aria-pressed'),'false','A refreshed character snapshot does not reactivate tracking');
    assert.equal(await track.evaluate(el=>el===document.activeElement),true,'Snapshots preserve journal focus');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.locator('.quest-journal').evaluate(el=>el.scrollWidth<=el.clientWidth),'Journal fits narrow windows');
      assert.ok(await track.evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return rect.left>=0&&rect.right<=innerWidth&&el.scrollWidth<=el.clientWidth;
      }),'Tracking control stays readable');
    }
    await page.setViewportSize({width:1280,height:800});
    await page.keyboard.press('Escape');
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    assert.equal(await page.locator('#quest-objective-marker').isVisible(),false);
    await page.keyboard.press('m');
    await page.locator('.zone-map-chart').waitFor();
    assert.equal(await page.locator('.zone-map-poi-quest').count(),0);
    await page.locator('.zone-map-chart').click({position:{x:90,y:90}});
    await page.locator('.zone-map-waypoint').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#waypoint-objective-marker').waitFor();
    await journal();
    await track.click();
    await page.keyboard.press('Escape');
    await page.locator('#quest-tracker').waitFor();
    await page.locator('#quest-objective-marker').waitFor();
    assert.equal(await page.locator('#waypoint-objective-marker').isVisible(),true,'Quest guidance does not replace personal destinations');
    await page.keyboard.press('m');
    await page.locator('.zone-map-poi-quest').waitFor();
    assert.equal(await page.locator('.zone-map-waypoint').isVisible(),true);
    const objectivePosition=await page.locator('.zone-map-poi-quest').evaluate(el=>({x:el.style.left,z:el.style.top}));
    await page.locator('.zone-map-poi-quest').click();
    await page.waitForFunction(expected=>{
      const pin=document.querySelector('.zone-map-waypoint');
      return pin.style.left===expected.x&&pin.style.top===expected.z;
    },objectivePosition);
    await page.keyboard.press('Escape');
    await journal();
    await untrack.click();
    await prepare();
    await journal();
    assert.equal(await track.getAttribute('aria-pressed'),'false','Tracking preference survives a reload');
    assert.equal(await page.locator('[data-quest="welcome"] .quest-objective p').textContent(),'Recoge el distintivo junto al mercado de la plaza del Levante.');
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'completed'},shadowQuest:null}));
    assert.equal(await page.locator('.quest-journal-content [data-quest="shadow"]').count(),1,'The next conversation is not an empty active journal');
    assert.equal(await untrack.count(),1,'New quests are tracked by default');
    await page.getByRole('button',{name:'Completadas',exact:true}).click();
    await page.locator('.quest-completed summary').click();
    assert.equal(await page.locator('.quest-track-button').count(),0,'Completed quests cannot be tracked');
    await page.evaluate(()=>window.brumaluz.set({health:80}));
    assert.equal(await page.getByRole('button',{name:'Completadas',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.quest-completed').getAttribute('open'),'','Snapshots preserve expanded completed entries');
    await page.getByRole('button',{name:'Activas',exact:true}).click();
    await untrack.click();
    await page.keyboard.press('Escape');
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    await journal();
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await page.getByRole('button',{name:'Track quest',exact:true}).waitFor();
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.evaluate(()=>window.brumaluz.set({shadowQuest:'returned'}));
    await page.getByRole('button',{name:'Completadas',exact:true}).click();
    assert.equal(await page.locator('.quest-completed').count(),2);
    assert.equal(await page.locator('.quest-track-button').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('online compact corpse loot retries after a full-bag rejection and removes the body permanently after collecting', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Saqueador','humano',4.5);
  world.combatSimulationEnabled=true;
  Object.assign(account.character.data,{
    position:{x:4.5,z:-62.35,yaw:0},welcome:{origin:0,stage:'completed'},shadowQuest:'defeated',
    combatEncounter:{id:'shadowling',instanceId:randomUUID(),status:'defeated',health:0,maxHealth:100,
      x:3.5,z:-62.35,enemyAttackAt:0,loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false},
  });
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    await player.page.locator('#interact-label').filter({hasText:'Registrar cuerpo'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('.loot-item').waitFor();
    assert.equal(await player.page.locator('.loot-window-frame').getAttribute('aria-modal'),'false');
    assert.equal(await player.page.locator('#action-bar').isVisible(),true,'Looting does not hide the game HUD');
    assert.equal(await player.page.locator('.loot-overlay').evaluate(el=>getComputedStyle(el).backdropFilter),'none');
    for(const width of [320,390,1280]){
      await player.page.setViewportSize({width,height:844});await player.page.waitForTimeout(100);
      const bounds=await player.page.locator('.loot-window-frame').evaluate(el=>{
        const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:el.scrollWidth,client:el.clientWidth};
      });
      assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height&&bounds.scroll<=bounds.client,`Compact loot fits the viewport: ${JSON.stringify(bounds)}`);
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await player.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`compact-loot-${width}.png`)});
    }
    await player.page.evaluate(()=>window.brumaluz.move(9,-62.35));
    await player.page.locator('#window-backdrop').waitFor({state:'hidden'});
    assert.equal(account.character.data.combatEncounter.looted,false,'Walking away closes the panel without collecting anything');
    await player.page.evaluate(()=>window.brumaluz.move(4.5,-62.35));
    await player.page.locator('#interact-label').filter({hasText:'Registrar cuerpo'}).waitFor();
    await player.page.keyboard.press('KeyE');await player.page.locator('.loot-item').waitFor();
    world.fail.add('loot');
    await player.page.getByRole('button',{name:'Recoger todo',exact:true}).click();
    await player.page.locator('.loot-status').filter({hasText:'Vuelve a intentarlo'}).waitFor();
    assert.equal(account.character.data.combatEncounter.looted,false);
    world.fail.delete('loot');
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#window-backdrop').waitFor({state:'hidden'});
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse')),false);
    assert.equal(account.character.data.shadowQuest,'defeated','Looting never skips the closing conversation');
    await leave(player.page);await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await player.page.waitForTimeout(300);
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse')),false);
    assert.equal(account.character.data.inventory.filter(item=>item?.id==='esencia_sombria').length,1);
    await player.page.keyboard.press('KeyI');
    await player.page.locator('[data-item-id="esencia_sombria"]').waitFor();
    await player.page.locator('[data-item-id="esencia_sombria"]').hover();
    await player.page.locator('#game-tooltip').filter({hasText:'No sabes qué es ni para qué sirve.'}).waitFor();
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('a pelín pouch near the well is collected once, keeps state on failure and stays gone after re-entry', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Buscador','humano',5);
  Object.assign(account.character.data,{position:{x:5,z:-4.4,yaw:0},wallet:{pelines:3}});
  const player=await openPlayer(world,account);
  const bag=()=>player.page.evaluate(()=>{
    const root=window.brumaluz.city().root.parent.getObjectByName('coin-bag:plaza_pozo');
    return root ? {visible:root.visible,model:!!root.getObjectByName('coin-bag-sack')} : null;
  });
  try{
    await player.enter();
    await player.page.waitForFunction(()=>!!window.brumaluz.city().root.parent.getObjectByName('coin-bag-sack'));
    assert.deepEqual(await bag(),{visible:true,model:true});
    await player.page.locator('#interact-label').filter({hasText:'Recoger bolsa de pelines'}).waitFor();
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR){
      await player.page.evaluate(()=>window.brumaluz.view(Math.PI*.8,.35,5));await player.page.waitForTimeout(300);
      await player.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'coin-bag.png')});
    }
    world.fail.add('coinbag');
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#toast').filter({hasText:'Acércate a la bolsa para recogerla.'}).waitFor();
    assert.equal(account.character.data.wallet.pelines,3,'A rejected pickup gives nothing');
    assert.equal((await bag()).visible,true,'A rejected pickup leaves the pouch in place');
    world.fail.delete('coinbag');
    await player.page.keyboard.press('KeyE');
    await player.page.locator('.chat-log').getByText('Has encontrado 17 pelines.',{exact:true}).waitFor({state:'attached'});
    assert.equal(account.character.data.wallet.pelines,20);
    await player.page.waitForFunction(()=>!window.brumaluz.city().root.parent.getObjectByName('coin-bag:plaza_pozo').visible);
    assert.notEqual(await player.page.locator('#interact-label').textContent(),'Recoger bolsa de pelines');
    await leave(player.page);await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await player.page.waitForTimeout(300);
    assert.equal((await bag()).visible,false,'Collected pouches stay gone for this character');
    assert.deepEqual(account.character.data.coinBags,['plaza_pozo']);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('a new character enters through the East Gate, tours the city and meets a worried Gnomi', {timeout:120000}, async()=>{
  const world=backend(),account=fixture('Llegada','humano',164);
  Object.assign(account.character.data,{position:{x:177,z:0,yaw:Math.PI/2},welcome:{origin:null,stage:'available'}});
  const player=await openPlayer(world,account),page=player.page;
  try{
    await player.enter();
    await page.locator('#cinematic').waitFor({state:'visible'});
    await page.locator('.cinematic-line.title').filter({hasText:'La Puerta del Este'}).waitFor();
    await page.waitForTimeout(700);
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'intro-gate.png')});
    await page.locator('.cinematic-line.title').filter({hasText:'Capital de Pompelín'}).waitFor();
    await page.waitForTimeout(1500);
    const flight=await page.evaluate(()=>({
      camera:window.brumaluz.camera().position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),
      hud:getComputedStyle(document.querySelector('#player-hud')).visibility,
      minimap:getComputedStyle(document.querySelector('.minimap')).visibility,
    }));
    assert.ok(flight.camera[1]-flight.player[1]>30,`The opening flies high over the city: ${flight.camera}`);
    assert.ok(Math.hypot(flight.camera[0],flight.camera[2])<130,'The flight starts over the city centre, not at the gate');
    assert.deepEqual([flight.hud,flight.minimap],['hidden','hidden']);
    await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');
    const afterInput=await page.evaluate(()=>window.brumaluz.char().root.parent.position.toArray());
    assert.ok(Math.abs(afterInput[2])<.05 && afterInput[0]<=flight.player[0],'Only the scripted entry moves the player during the cutscene');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'intro-flight.png')});
    await page.locator('.cinematic-line').filter({hasText:'Solo falta el distintivo'}).waitFor({timeout:30000});
    await page.waitForTimeout(1200);
    const meeting=await page.evaluate(()=>{
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal'),me=window.brumaluz.char().root.parent;
      return {player:me.position.toArray(),gnomi:gnomi.position.toArray(),facing:me.rotation.y,gait:gnomi.userData.gait};
    });
    assert.ok(meeting.player[0]<158,`The character walked in through the gate: ${meeting.player}`);
    assert.ok(Math.abs(Math.sin(meeting.facing)+1)<.05,'The character faces into the city');
    assert.ok(meeting.gnomi[0]<153.5&&meeting.gnomi[0]>143,'Gnomi walks toward the gate from the square: '+JSON.stringify(meeting));
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'intro-gnomi.png')});
    await page.locator('#dialog').waitFor({state:'visible',timeout:30000});
    assert.equal(await page.locator('.dialog-speaker').textContent(),'Gnomi');
    assert.match(await page.locator('.dialog-text').textContent(),/bienvenida a Brumaluz.*Gremio de Ayudantes/s);
    assert.equal(await page.locator('#cinematic').isVisible(),false);
    await page.getByRole('button',{name:'He venido a probar suerte.'}).click();
    await page.getByRole('button',{name:'Aceptar misión'}).waitFor();
    assert.equal(account.character.data.welcome.origin,1,'Gnomi is close enough after the cutscene for the server checks');
    assert.match(await page.locator('.dialog-text').textContent(),/plaza del Levante/);
    await page.keyboard.press('Escape');
    await leave(page);await page.reload();await page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#cinematic').isVisible(),false,'The opening plays only once');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('the opening can be skipped and leaves the player speaking to Gnomi', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Prisa','elfo',164);
  Object.assign(account.character.data,{position:{x:164,z:0,yaw:Math.PI/2},welcome:{origin:null,stage:'available'}});
  const player=await openPlayer(world,account),page=player.page;
  try{
    await player.enter();
    await page.locator('#cinematic').waitFor({state:'visible'});
    await page.locator('.cinematic-skip').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#cinematic').waitFor({state:'hidden'});
    await page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('body').evaluate(body=>body.classList.contains('cinematic-open')),false);
    const state=await page.evaluate(()=>({
      gnomi:window.brumaluz.city().root.parent.getObjectByName('gnomi-personal').position.toArray(),
      hud:getComputedStyle(document.querySelector('#player-hud')).visibility,
    }));
    assert.ok(Math.hypot(state.gnomi[0]-153.5,state.gnomi[2])<.2,'Gnomi waits at his meeting point');
    assert.equal(state.hud,'hidden','The automatic conversation keeps the HUD out of the shot');
    assert.equal(account.character.data.introSeen,true,'Skipping persists the completed arrival on the server');
    assert.equal(await page.evaluate(()=>window.brumaluz.char().root.parent.position.x),156.5,'Skipping leaves the player within talking range');
    await page.keyboard.press('Escape');
    await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');
    assert.ok(await page.evaluate(()=>window.brumaluz.char().root.parent.position.x<163.5),'Control returns after skipping');
    await leave(page);await page.reload();await page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#cinematic').isVisible(),false,'Arrival stays complete even before choosing an origin');
    assert.equal(account.character.data.welcome.origin,null);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('after looting, Isberto comes back, leads the player home and shows the bed and the chest', {timeout:120000}, async()=>{
  const world=backend(),account=fixture('DeVuelta','humano',-1.7);
  Object.assign(account.character.data,{
    position:{x:-1.7,z:-62.35,yaw:0},welcome:{origin:0,stage:'completed'},shadowQuest:'defeated',health:30,wallet:{pelines:12},
    combatEncounter:{id:'shadowling',instanceId:randomUUID(),status:'defeated',health:0,maxHealth:100,
      x:3.5,z:-62.35,enemyAttackAt:0,loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false},
  });
  const maps=Object.fromEntries(['brumaluz','casa_de_isberto_interior'].map(id=>[
    id,JSON.parse(readFileSync(join(process.cwd(),'src','data','world','maps',`${id}.json`),'utf8')),
  ]));
  const player=await openPlayer(world,account),page=player.page,travels=[];
  await player.context.route(/\/rest\/v1\/rpc\/world_travel$/,async route=>{
    const {p_portal}=route.request().postDataJSON();
    const current=world.players.get(account.user.id);
    const map=current.data.location??'brumaluz',portal=maps[map].markers.find(marker=>marker.id===p_portal);
    if(portal.target.map==='casa_de_isberto_interior'&&!['returning','returned'].includes(current.data.shadowQuest))
      return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'PORTAL_LOCKED'})});
    const arrival=maps[portal.target.map].markers.find(marker=>marker.id===portal.target.arrival);
    const position={x:arrival.position[0],z:arrival.position[2],yaw:arrival.rotationY};
    travels.push(portal.target.map);
    Object.assign(current,{position});
    Object.assign(current.data,{location:portal.target.map,position});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'ok',location:portal.target.map,position,players:[],encounter:current.encounter,vitals:current.vitals,
    })});
  });
  const teleport=async(x,z)=>{
    Object.assign(world.players.get(account.user.id).position,{x,z});
    await page.evaluate(({x,z})=>window.brumaluz.move(x,z),{x,z});
  };
  const facing=name=>page.waitForFunction(name=>{
    const actor=window.brumaluz.city().root.parent.getObjectByName(name),player=window.brumaluz.char().root.parent;
    const angle=Math.atan2(actor.position.x-player.position.x,actor.position.z-player.position.z);
    return Math.abs(Math.atan2(Math.sin(angle-player.rotation.y),Math.cos(angle-player.rotation.y)))<.05;
  },name);
  try{
    await player.enter();
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('#story-arrival').isVisible(),false,'Isberto waits until all loot is collected');
    await page.locator('.quest-tracker-objective').filter({hasText:'Registra los restos'}).waitFor();
    await teleport(1.2,-62.35);
    await page.locator('#interact-label').filter({hasText:'Registrar cuerpo'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Recoger todo',exact:true}).click();
    await page.locator('#window-backdrop').waitFor({state:'hidden'});
    assert.equal(account.character.data.combatEncounter.looted,true);
    // Isberto vuelve solo, andando, en cuanto los restos están registrados.
    await page.locator('#story-arrival').waitFor({state:'visible'});
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await facing('npc:isberto');
    assert.match(await page.locator('.dialog-text').textContent(),/Has mantenido el tipo/);
    const beforeSpeakerChange=await page.evaluate(()=>({
      position:window.brumaluz.char().root.parent.position.toArray(),facing:window.brumaluz.char().root.parent.rotation.y,
    }));
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Gnomi'}).waitFor();
    await facing('gnomi-personal');
    const afterSpeakerChange=await page.evaluate(()=>({
      position:window.brumaluz.char().root.parent.position.toArray(),facing:window.brumaluz.char().root.parent.rotation.y,
    }));
    assert.deepEqual(afterSpeakerChange.position,beforeSpeakerChange.position,'Changing speaker rotates the player without moving them');
    assert.ok(Math.abs(Math.atan2(Math.sin(afterSpeakerChange.facing-beforeSpeakerChange.facing),Math.cos(afterSpeakerChange.facing-beforeSpeakerChange.facing)))>.2,'The player turns toward Gnomi instead of staring at Isberto');
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-text').filter({hasText:'Te has ganado un techo'}).waitFor();
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'isberto-invitation.png')});
    await page.keyboard.press('Escape');
    assert.equal(account.character.data.shadowQuest,'defeated','Exiting partway through the scene never advances the story');
    // Hasta la invitación, la puerta de Isberto sigue cerrada.
    const meet=await page.evaluate(()=>window.brumaluz.char().root.parent.position.toArray());
    await teleport(24.5,-48.5);
    await page.locator('#interact-label').filter({hasText:'Casa de Isberto · Cerrada'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#toast').filter({hasText:'cerrada con llave'}).waitFor();
    assert.deepEqual(travels,[]);
    // Junto a Isberto (más cerca que Gnomi, que vuelve a su lado tras el salto).
    const isbertoAt=await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').position.toArray());
    await teleport(isbertoAt[0]+(meet[0]>isbertoAt[0]?1:-1),isbertoAt[2]);
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    for(let i=0;i<4;i++)await page.keyboard.press('KeyE');
    const follow=page.getByRole('button',{name:'Seguir a Isberto',exact:true});
    await follow.waitFor();
    assert.equal(await page.locator('.dialog-speaker').textContent(),'Gnomi','Gnomi says goodbye before the player follows Isberto');
    world.fail.add('shadow');
    await follow.click();
    await follow.waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#dialog').getAttribute('aria-busy')==='false');
    assert.equal(account.character.data.shadowQuest,'defeated','A failed RPC keeps the conversation retryable');
    world.fail.delete('shadow');
    await follow.click();
    await page.locator('#dialog').waitFor({state:'hidden'});
    assert.equal(account.character.data.shadowQuest,'returning');
    await page.locator('.quest-tracker-objective').filter({hasText:'Sigue a Isberto'}).waitFor();
    // Isberto echa a andar hacia su casa mientras el jugador le sigue de cerca.
    const start=await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').position.toArray());
    await page.waitForFunction(()=>['walk','run'].includes(window.brumaluz.city().root.parent.getObjectByName('npc:isberto').userData.gait));
    await page.waitForTimeout(1500);
    const walked=await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').position.toArray());
    assert.ok(Math.hypot(walked[0]-start[0],walked[2]-start[2])>1,'Isberto leads the way home');
    assert.ok(Math.hypot(walked[0]-24.5,walked[2]+48.5)<Math.hypot(start[0]-24.5,start[2]+48.5),'Isberto walks toward his door');
    assert.equal(await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible),true);
    const walk=await page.evaluate(async()=>{
      const npc=window.brumaluz.city().root.parent.getObjectByName('npc:isberto');
      let previous=npc.position.clone(),largestStep=0;const since=performance.now();
      while(performance.now()-since<25000){
        window.brumaluz.move(npc.position.x+1,npc.position.z+1.5);
        await new Promise(requestAnimationFrame);
        largestStep=Math.max(largestStep,npc.position.distanceTo(previous));previous.copy(npc.position);
        if(Math.hypot(npc.position.x-25.6,npc.position.z+49.9)<.4)return {arrived:true,largestStep};
      }
      return {arrived:false,largestStep,position:npc.position.toArray()};
    });
    assert.equal(walk.arrived,true,'Isberto reaches the house along the actual city collisions: '+JSON.stringify(walk));
    assert.ok(walk.largestStep<.5,'The escort never jumps over blocked scenery');
    // Al reconectar, Isberto espera en su puerta y Gnomi ya está en la plaza del pozo.
    await leave(page);await page.reload();await page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await page.locator('.quest-tracker-objective').filter({hasText:'Sigue a Isberto'}).waitFor();
    await page.waitForFunction(()=>{
      const isberto=window.brumaluz.city().root.parent.getObjectByName('npc:isberto');
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      return isberto.visible&&Math.hypot(isberto.position.x-25.6,isberto.position.z+49.9)<.3
        &&gnomi.visible&&Math.hypot(gnomi.position.x+3.5,gnomi.position.z)<.1&&gnomi.userData.gait==='idle';
    });
    await teleport(24.5,-48.5);
    await page.locator('#interact-label').filter({hasText:/^Casa de Isberto$/}).waitFor();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>window.brumaluz.city().locationId==='casa_de_isberto_interior');
    // Dentro, Isberto enseña la cama y el cofre.
    await page.locator('#cinematic').waitFor({state:'visible'});
    await page.locator('.cinematic-line').filter({hasText:'cama'}).waitFor();
    await page.waitForTimeout(1300);
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'isberto-house-bed.png')});
    await page.locator('.cinematic-line').filter({hasText:'cofre de la esquina'}).waitFor();
    await page.waitForTimeout(1400);
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'isberto-house-chest.png')});
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor({timeout:20000});
    assert.equal(await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible),true,'Isberto is home');
    await page.getByRole('button',{name:'Gracias, Isberto.',exact:true}).click();
    await page.locator('.dialog-text').filter({hasText:'Descansa'}).waitFor();
    assert.equal(account.character.data.shadowQuest,'returned');
    await page.keyboard.press('KeyE');
    await page.locator('#toast.show').filter({hasText:'Misión completada'}).waitFor();
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    // La cama recupera la vida.
    await teleport(-.3,-1.4);
    await page.locator('#interact-label').filter({hasText:'Descansar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#rest-fade').waitFor({state:'visible'});
    await page.locator('#toast').filter({hasText:'Has descansado'}).waitFor();
    await page.locator('#rest-fade').waitFor({state:'hidden'});
    assert.equal(world.rests,1);
    assert.equal(account.character.data.health,-1,'Resting restores full health');
    // Y el cofre de la esquina abre el banco.
    await teleport(2.25,2.3);
    await page.locator('#interact-label').filter({hasText:'Abrir el banco'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.bank-ledger input').fill('5');
    await page.locator('.bank-move.deposit').click();
    await page.locator('.bank-balance.stored b').filter({hasText:/^5$/}).waitFor();
    assert.equal(account.character.data.wallet.pelines,7,'The house chest uses the existing account bank');
    await page.keyboard.press('Escape');
    await leave(page);await page.reload();await page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#cinematic').isVisible(),false,'The house tour is not replayed');
    assert.equal(await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible),true);
    assert.equal(account.character.data.inventory?.filter(item=>item?.id==='esencia_sombria').length??0,1,'The epilogue preserves the collected essence without duplicating it');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});
