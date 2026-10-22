// Pruebas del mundo en el navegador: Gnomi, Isberto y el combate contra la criatura.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, browser, fixture, backend } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('Gnomi locomotion advances the rig continuously and rests during dialogue without sliding', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  try{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({welcome:{origin:0,stage:'active'},position:{x:153.5,z:0,yaw:0}});
      window.brumaluz.play();
    });
    await page.waitForFunction(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      return g.visible&&g.position.x>154;
    }); // Colocación inicial del acompañante; no es un paso de su animación.
    const samples=await page.evaluate(async()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      const poses=[],gaits=[],idleSteps=[];
      let previous=g.position.clone(),moved=0;
      for(let i=0;i<100;i++){
        window.brumaluz.move(153.5+i*.1,0);
        await new Promise(requestAnimationFrame);
        if(Math.hypot(g.position.x-previous.x,g.position.z-previous.z)>.0032){
          moved++;gaits.push(g.userData.gait);
          if(g.userData.gait==='idle')idleSteps.push({i,from:previous.toArray(),to:g.position.toArray()});
          const pose=[];g.traverse(object=>{if(object.isBone)pose.push(...object.quaternion.toArray().map(v=>v.toFixed(3)));});
          poses.push(pose.join(','));
        }
        previous.copy(g.position);
      }
      return {moved,uniquePoses:new Set(poses).size,idleWhileMoving:gaits.filter(gait=>gait==='idle').length,idleSteps};
    });
    assert.ok(samples.moved>20,`Gnomi follows the player: ${JSON.stringify(samples)}`);
    assert.ok(samples.uniquePoses>10,'The rig changes pose while following');
    assert.equal(samples.idleWhileMoving,0,'Reached waypoints do not reset locomotion between trail segments: '+JSON.stringify(samples.idleSteps));
    await page.evaluate(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      window.brumaluz.move(g.position.x,g.position.z);
    });
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#dialog').waitFor({state:'visible'});
    const idle=await page.evaluate(async()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal'),before=g.position.clone();
      await new Promise(resolve=>setTimeout(resolve,300));
      return {gait:g.userData.gait,distance:g.position.distanceTo(before)};
    });
    assert.equal(idle.gait,'idle');assert.equal(idle.distance,0);
  }finally{await context.close();}
});

test('Gnomi unlocks Isberto, whose accepted quest leaves a lootable corpse and exactly one mysterious essence', {timeout:120000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({welcome:{origin:null,stage:'available'},introSeen:true,position:{x:153.5,z:0,yaw:Math.PI/2},cls:'guerrero',equipment:{weapon:{id:'espada_inicial',count:1,bound:true}}});
      window.brumaluz.play();
    });
    await page.waitForFunction(()=>document.body.classList.contains('playing'));
    await page.evaluate(()=>{
      const isberto=window.brumaluz.city().npcSites.find(value=>value.id==='isberto');
      if(!isberto)throw new Error('Isberto is missing from the city');
      window.brumaluz.move(isberto.position.x,isberto.position.z);
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible),false,'Isberto stays hidden until Gnomi’s welcome is complete');
    assert.equal(await page.locator('#interact-label').filter({hasText:'Hablar'}).count(),0,'Locked Isberto cannot be interacted with');
    await page.evaluate(()=>window.brumaluz.move(153.5,0));
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#dialog').waitFor({state:'visible'});
    await page.getByRole('button',{name:'He venido a probar suerte.'}).click();
    await page.getByRole('button',{name:'Aceptar misión'}).waitFor();
    await page.getByRole('button',{name:'Aceptar misión'}).click();
    await page.locator('#dialog').waitFor({state:'hidden'});
    await page.evaluate(()=>window.brumaluz.move(138.6,-2.6));
    await page.locator('#interact-label').filter({hasText:'Recoger distintivo'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>document.querySelector('#quest-tracker').textContent.includes('devuélvele'));
    await page.evaluate(()=>{
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      window.brumaluz.move(gnomi.position.x,gnomi.position.z);
    });
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Completar misión'}).click();
    await page.locator('.dialog-text').filter({hasText:'bien sujeto'}).waitFor();
    assert.equal(await page.locator('#story-arrival').isVisible(),false,'Gnomi finishes thanking the player before the arrival');
    await page.keyboard.press('KeyE');
    await page.locator('#story-arrival').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.locator('#cinematic').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await page.waitForFunction(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible);
    assert.equal(await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible),true,'Isberto appears after returning Gnomi’s badge');
    assert.ok(await page.evaluate(()=>{
      const actor=window.brumaluz.city().root.parent.getObjectByName('npc:isberto');
      return actor.position.distanceTo(window.brumaluz.char().root.parent.position)<4;
    }),'Isberto appears beside the player instead of requiring a trip to the farm');
    await page.locator('.dialog-quest-card').filter({hasText:'Una sombra entre el ganado'}).waitFor();
    await page.locator('.dialog-choice').first().click();
    await page.waitForFunction(()=>!document.querySelector('#combat-controls').hidden);
    await page.evaluate(()=>{
      const site=window.brumaluz.city().npcSites.find(value=>value.id==='isberto');
      if(!site)throw new Error('Isberto is missing from the city');
      window.brumaluz.move(site.position.x+5,site.position.z);
      window.brumaluz.view(-Math.PI/2,.55,12);
    });
    await page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.targetId==='enemy:shadowling');
    await page.keyboard.press('KeyF');
    await page.keyboard.press('Digit1');
    await page.locator('.chat-log').getByText('Golpeas a la criatura extraña por 18.',{exact:true}).waitFor();
    assert.equal(await page.locator('#combat-controls').isVisible(),true);
    assert.equal(await page.locator('#combat-flee').count(),0,'There is no retreat button');
    const slot=page.locator('.ab-slot[data-skill-id="heavy_strike"]');
    await slot.locator('.ab-cooldown-time').filter({hasText:/[1-6]/}).waitFor();
    await slot.evaluate(el=>el.dataset.testIdentity='preserved');
    await page.waitForTimeout(300);
    assert.equal(await slot.getAttribute('data-test-identity'),'preserved','Cooldown updates preserve slot DOM and tooltips');
    await page.waitForFunction(()=>document.querySelector('#combat-controls').hidden);
    await page.waitForFunction(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse'));
    await page.evaluate(()=>{
      const corpse=window.brumaluz.city().root.parent.getObjectByName('combat-corpse');
      window.brumaluz.move(corpse.position.x,corpse.position.z+1);
    });
    await page.locator('#interact-label').filter({hasText:'Registrar cuerpo'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.loot-item').filter({hasText:'Esencia sombría'}).waitFor();
    await page.locator('.loot-item').hover();
    await page.locator('#game-tooltip').filter({hasText:'No sabes qué es ni para qué sirve.'}).waitFor();
    await page.getByRole('button',{name:'Recoger todo',exact:true}).click();
    await page.locator('#window-backdrop').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse')),false);
    await page.locator('.quest-tracker-objective').filter({hasText:'Habla con Isberto'}).waitFor();
    await page.locator('#story-arrival').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    for(let i=0;i<4;i++)await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Seguir a Isberto',exact:true}).click();
    await page.locator('#dialog').waitFor({state:'hidden'});
    await page.locator('.quest-tracker-objective').filter({hasText:'Sigue a Isberto'}).waitFor();
    await page.evaluate(()=>window.brumaluz.move(23,-48.5));
    await page.locator('#interact-label').filter({hasText:/^Casa de Isberto$/}).waitFor();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>window.brumaluz.city().locationId==='casa_de_isberto_interior');
    await page.locator('#cinematic').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Gracias, Isberto.',exact:true}).click();
    await page.locator('.dialog-text').filter({hasText:'Descansa'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    await page.keyboard.press('KeyI');
    await page.locator('.inv-bag [data-item-id="esencia_sombria"]').waitFor();
    assert.equal(await page.locator('.inv-bag [data-item-id="esencia_sombria"]').count(),1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyJ');
    await page.getByRole('button',{name:'Completadas',exact:true}).click();
    assert.equal(await page.locator('.quest-entry').count(),2,'Both Gnomi and Isberto remain in the completed journal');
    assert.equal(await page.locator('.quest-completed[open]').count(),0,'Completed quests start collapsed');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'collapsed-quests.png')});
    await page.locator('.quest-completed summary').first().click();
    assert.equal(await page.locator('.quest-completed[open]').count(),1);
    await page.locator('.quest-completed summary').first().click();
    assert.equal(await page.locator('.quest-completed[open]').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('online Isberto combat uses mocked RPC state for start, enemy damage, skill and target release without retreat', {timeout:120000}, async()=>{
  const world=backend(),account=fixture('Alric','humano',-3);
  world.combatSimulationEnabled=true;
  account.character.data.welcome={origin:0,stage:'completed'};
  account.character.data.equipment={weapon:{id:'espada_inicial',count:1,bound:true}};
  account.character.data.position={x:-3,z:-62.35,yaw:0};
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    await player.page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#dialog').waitFor({state:'visible'});
    await player.page.locator('.dialog-choice').first().click();
    await player.page.waitForFunction(()=>!document.querySelector('#combat-controls').hidden);
    assert.equal(world.combatCalls.some(call=>call.fn==='combat_start'),true,'The encounter starts through the online RPC');
    assert.equal(await player.page.locator('#combat-auto').getAttribute('aria-pressed'),'false');
    await player.page.evaluate(()=>{
      const site=window.brumaluz.city().npcSites.find(value=>value.id==='isberto');
      if(!site)throw new Error('Isberto is missing from the city');
      window.brumaluz.move(site.position.x+5,site.position.z);
      window.brumaluz.view(-Math.PI/2,.55,12);
    });

    await player.page.waitForFunction(()=>document.querySelector('#hud-health-text').textContent==='92 / 100',{timeout:15000});
    assert.equal(world.players.get(account.user.id).vitals.health,92,'The world sync snapshot applies the enemy hit to the local HUD');
    await player.page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.targetId==='enemy:shadowling');
    await player.page.keyboard.press('KeyF');
    await player.page.keyboard.press('Digit1');
    await player.page.locator('.chat-log').getByText('Golpeas a la criatura extraña por 18.',{exact:true}).waitFor();
    assert.equal(world.combatCalls.some(call=>call.fn==='combat_action'&&call.action==='heavy_strike'),true,'The named class skill uses the online action RPC');
    assert.equal(world.players.get(account.user.id).vitals.resource,65,'The server response updates the player resource');
    assert.equal(await player.page.locator('#hud-resource-text').textContent(),'65 / 80');
    await player.page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.locked==='true');
    await player.page.evaluate(()=>window.brumaluz.view(Math.PI/2,.55,12));
    await player.page.waitForTimeout(400);
    assert.equal(await player.page.locator('#target-frame').getAttribute('data-target-id'),'enemy:shadowling','Locked enemy remains selected when the camera turns away');
    await player.page.keyboard.down('KeyW');
    await player.page.waitForTimeout(150);
    await player.page.keyboard.up('KeyW');
    assert.equal(await player.page.locator('#target-frame').getAttribute('data-locked'),'true','Manual movement does not release the target lock');
    assert.equal(await player.page.locator('#combat-auto').getAttribute('aria-pressed'),'true','Manual movement preserves automatic attacks while in range');
    await player.page.keyboard.press('Escape');
    await player.page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.locked==='false');
    assert.equal(world.players.get(account.user.id).encounter.status,'active','Escape releases the target without pretending to retreat from the encounter');
    assert.equal(await player.page.locator('#game-menu-panel').isVisible(),false);
    assert.equal(await player.page.locator('#combat-flee').count(),0);
    assert.equal(world.combatCalls.some(call=>call.fn==='combat_stop'),false,'Releasing a target never sends a retreat RPC');
    assert.equal(world.players.get(account.user.id).encounter.status,'active');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});
