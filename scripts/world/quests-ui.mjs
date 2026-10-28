// Pruebas del mundo en el navegador: NPC, rastreador de misiones, portales y banco.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, npcDefinitions, browser, fixture, backend, hoverActor } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('NPC interaction still opens its conversation with E', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4);
  const player = await openPlayer(world,a);
  try {
    a.character.data.position = await player.page.evaluate(() => {
      const npc = window.brumaluz.city().npcSites[0];
      return {x:npc.position.x + 1,z:npc.position.z,yaw:0};
    });
    await player.page.reload();
    await player.enter();
    assert.equal(await player.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('gnomi-personal').visible),true,'Gnomi remains present when no welcome progress exists');
    assert.equal(await player.page.locator('[data-window="quests"]').isVisible(),false);
    // Gnomi espera junto a la Puerta del Este: el servidor simulado acepta el salto.
    const teleport=async(x,z)=>{Object.assign(world.players.get(a.user.id).position,{x,z});await player.page.evaluate(({x,z})=>window.brumaluz.move(x,z),{x,z});};
    await teleport(153.5,1.7);
    await player.page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await player.page.locator('.dialog-subtitle').textContent(),npcDefinitions.find(npc=>npc.id==='gnomi').subtitle);
    assert.match(await player.page.locator('.dialog-text').textContent(),/Soy Gnomi/);
    assert.equal(await player.page.locator('.dialog-quest-card').count(),0,'Meeting Gnomi does not activate the welcome quest');
    await player.page.keyboard.press('Escape');
    const npc=await player.page.evaluate(()=>window.brumaluz.city().npcSites[0].position.toArray());
    await teleport(npc[0]+1,npc[2]);
    await player.page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await player.page.locator('.dialog-subtitle').textContent(),'Depuración');
    assert.equal(await player.page.locator('.dialog-quest-card').count(),0);
    await player.page.setViewportSize({width:320,height:568});
    await player.page.locator('.dialog-choice').first().hover();
    await player.page.mouse.move(0,0);
    await player.page.keyboard.press('ArrowUp');
    assert.equal(await player.page.locator('.dialog-choice.selected').evaluate(el=>el.classList.contains('exit')),true);
    assert.ok(await player.page.locator('.dialog-choice.selected').evaluate(el=>{
      const box=el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
    }),'Keyboard navigation reveals offscreen conversation choices');
    await player.page.keyboard.press('Escape');
    await player.page.waitForFunction(()=>!window.brumaluz.camera().view?.enabled);
    assert.equal(await player.page.locator('body').evaluate(el=>el.classList.contains('conversation-open')),false);
    assert.equal(await player.page.locator('#player-interactions').isVisible(),false);
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('quest tracker minimizes in place and offscreen objectives point toward the target across camera directions', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const prepare=async()=>{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({welcome:{origin:0,stage:'active'}});
      window.brumaluz.play();
      // Mismo desplazamiento que antes respecto al distintivo, ahora junto al mercado de la plaza del Levante.
      window.brumaluz.move(122.8,3.1);
      window.brumaluz.view(Math.atan2(-15.8,5.7),.55,12);
    });
    await page.locator('#quest-tracker').waitFor();
  };
  try{
    await prepare();
    const marker=page.locator('#quest-objective-marker');
    await page.waitForFunction(()=>!document.querySelector('#quest-objective-marker').classList.contains('offscreen'));
    assert.equal(await marker.locator('.quest-marker-symbol').textContent(),'!');
    assert.doesNotMatch(await marker.textContent(),/◆/);
    assert.match(await marker.locator('.quest-marker-distance').textContent(),/^\d+ m$/);
    for(const menu of ['player','world']){
      await page.locator(`#${menu}-menu-toggle`).click();
      const buttons=page.locator(`#${menu}-menu-panel > button`);
      assert.equal(await buttons.locator('svg.menu-option-icon[aria-hidden="true"]').count(),await buttons.count());
      const positions=await buttons.evaluateAll(buttons=>buttons.filter(b=>!b.hidden).map(b=>{
        const rect=b.getBoundingClientRect(),icon=b.querySelector('svg').getBoundingClientRect();
        return icon.right<=rect.right&&icon.left>rect.left+rect.width/2;
      }));
      assert.ok(positions.every(Boolean),'Menu icons stay at the right edge');
      await page.locator(`#${menu}-menu-toggle`).click();
    }
    assert.equal(await page.locator('#game-menu-panel .menu-option-icon').count(),0);
    assert.equal(await page.locator('#world-menu-map').textContent(),'Mapa');
    assert.equal(await page.locator('#world-menu-map kbd').count(),0);
    await page.keyboard.press('m');
    await page.locator('.zone-map-chart').waitFor();
    await page.keyboard.press('m');
    await page.locator('#window-backdrop').waitFor({state:'hidden'});
    await page.evaluate(()=>window.brumaluz.set({coinBags:['plaza_pozo']}));
    await page.locator('#world-menu-toggle').click();
    await page.locator('#world-menu-collections').click();
    const realms=page.locator('.collections-realm-tile');
    assert.equal(await realms.count(),5);
    assert.equal(await realms.locator('svg[viewBox="0 0 64 64"] .realm-emblem-art').count(),5);
    assert.ok(await realms.filter({hasText:'Isla de Lunargenta'}).isVisible());
    assert.doesNotMatch(await page.locator('.collections-realm-grid').textContent(),/Luna Argéntea/);
    assert.match(await realms.first().textContent(),/25%/);
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.locator('.collections-realm-grid').evaluate(grid=>grid.scrollWidth<=grid.clientWidth));
      const iconsFit=await realms.evaluateAll(tiles=>tiles.every(tile=>{
        const icon=tile.querySelector('.collections-realm-icon').getBoundingClientRect(),rect=tile.getBoundingClientRect();
        return icon.left>=rect.left&&icon.right<=rect.right;
      }));
      assert.ok(iconsFit,'Custom region emblems fit narrow tiles');
    }
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.ok(await page.getByRole('button',{name:'Lunargenta Isle, coming soon',exact:true}).isVisible());
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1280,height:800});
    await page.locator('#quest-tracker').waitFor();
    assert.match(await page.locator('.quest-tracker-progress').textContent(),/Paso 2 de 3/);
    const initial=await page.locator('#quest-tracker').boundingBox();
    await page.getByRole('button',{name:'Minimizar misiones',exact:true}).click();
    assert.equal(await page.locator('.quest-tracker-detail').isVisible(),false);
    const minimized=await page.locator('#quest-tracker').boundingBox();
    assert.equal(minimized.x,initial.x);assert.equal(minimized.y,initial.y);
    assert.equal(minimized.width,initial.width);assert.ok(minimized.height<initial.height);
    assert.equal(await page.getByRole('button',{name:'Expandir misiones',exact:true}).getAttribute('aria-expanded'),'false');
    assert.equal(await marker.isVisible(),true,'Minimizing the tracker does not disable world guidance');
    await prepare();
    assert.equal(await page.locator('.quest-tracker-detail').isVisible(),false,'Minimization persists after reload');
    await page.getByRole('button',{name:'Expandir misiones',exact:true}).click();
    await page.locator('.quest-tracker-detail').click();
    await page.locator('.quest-entry').waitFor();
    assert.equal(await marker.isVisible(),false,'Objective guidance hides in menus');
    await page.keyboard.press('Escape');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      for(const [offset,side] of [[-Math.PI/2,'left'],[Math.PI/2,'right'],[Math.PI,'behind']]){
        await page.evaluate(offset=>window.brumaluz.view(Math.atan2(-15.8,5.7)+offset,.55,12),offset);
        await page.waitForTimeout(400);
        await page.waitForFunction(()=>document.querySelector('#quest-objective-marker').classList.contains('offscreen'));
        const bounds=await marker.boundingBox();
        assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0&&bounds.y+bounds.height<=844,`Arrow fits ${width}px facing ${side}`);
        if(side==='left')assert.ok(bounds.x<width/2);
        if(side==='right')assert.ok(bounds.x>width/2);
        assert.equal(await marker.locator('.quest-direction-arrow').isVisible(),true);
        assert.equal(await marker.locator('.quest-marker-symbol').isVisible(),false,'offscreen guidance has no exclamation');
        assert.match(await marker.locator('.quest-direction-arrow').getAttribute('style'),/rotate\([^N]*rad\)/);
      }
      await page.evaluate(()=>window.brumaluz.view(Math.atan2(-15.8,5.7),.55,12));
      await page.waitForFunction(()=>!document.querySelector('#quest-objective-marker').classList.contains('offscreen'));
      assert.equal(await marker.locator('.quest-direction-arrow').isVisible(),false);
      assert.equal(await marker.locator('.quest-marker-symbol').isVisible(),true);
      assert.ok(await page.locator('#quest-tracker').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth));
    }
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await page.getByRole('button',{name:'Minimize quests',exact:true}).waitFor();
    assert.match(await page.locator('.quest-tracker-progress').textContent(),/Step 2 of 3/);
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'completed'}}));
    await page.locator('.quest-tracker-objective').filter({hasText:'Isberto'}).waitFor();
    await page.evaluate(()=>window.brumaluz.set({shadowQuest:'returned'}));
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    assert.equal(await marker.isVisible(),false);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('NPC names and target badges share the same ten metre visibility limit', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  try{
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>window.brumaluz.play());
    const plate=page.locator('.nameplate.npc:not(.welcome-nameplate)').first();
    for(const [distance,visible] of [[9.9,true],[10.1,false],[9.9,true]]){
      await page.evaluate(distance=>{
        const site=window.brumaluz.city().npcSites.find(npc=>npc.id==='testiculos');
        window.brumaluz.move(site.position.x,site.position.z+distance);
        window.brumaluz.view(0,.55,12);
      },distance);
      await plate.waitFor({state:visible?'visible':'hidden'});
      if(visible){
        await page.mouse.move(1278,798);
        await page.evaluate(()=>window.brumaluz.view(.5,.55,12));
        await page.locator('#target-frame').waitFor({state:'hidden'});
        assert.equal(await plate.isVisible(),true,'Nearby NPC names remain visible without aiming or hovering');
        await page.evaluate(()=>window.brumaluz.view(0,.55,12));
        await page.waitForTimeout(300);
        await hoverActor(page,plate);
        await page.waitForFunction(()=>!document.querySelector('#target-frame').hidden&&document.querySelector('#target-frame').dataset.targetId==='npc:testiculos');
      }else await page.locator('#target-frame').waitFor({state:'hidden'});
    }
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'available'},shadowQuest:null}));
    for(const [distance,visible] of [[9.9,true],[10.1,false]]){
      await page.evaluate(distance=>{
        window.brumaluz.move(153.5,distance);
        window.brumaluz.view(0,.55,12);
      },distance);
      await page.locator('.welcome-nameplate').waitFor({state:visible?'visible':'hidden'});
    }
  }finally{await context.close();}
});

test('online portals distinguish a pending mission encounter from engaged combat', {timeout:180000}, async()=>{
  const world=backend(),account=fixture('Viajero','humano',24.5);
  world.combatSimulationEnabled=true;
  // Sin la historia de bienvenida (personaje anterior a ella), la casa de Isberto está abierta.
  Object.assign(account.character.data,{
    position:{x:24.5,z:-48.5,yaw:0},shadowQuest:'active',
    combatEncounter:{id:'shadowling',instanceId:randomUUID(),status:'active',engaged:true,health:100,maxHealth:100,
      x:3.5,z:-62.35,enemyAttackAt:Date.now()/1000+100,loot:[],looted:false},
  });
  const maps=Object.fromEntries(['brumaluz','casa_de_isberto_interior','pompelin'].map(id=>[
    id,JSON.parse(readFileSync(join(process.cwd(),'src','data','world','maps',`${id}.json`),'utf8')),
  ]));
  const player=await openPlayer(world,account),calls=[];
  await player.context.route(/\/rest\/v1\/rpc\/world_travel$/,async route=>{
    const {p_portal}=route.request().postDataJSON();
    const current=world.players.get(account.user.id);
    const map=current.data.location??'brumaluz',portal=maps[map].markers.find(marker=>marker.id===p_portal);
    assert.ok(portal,`Portal ${p_portal} exists in ${map}`);
    assert.ok(current.encounter?.status!=='active'||!current.encounter.engaged,'Only engaged combat blocks the travel RPC');
    assert.ok(Math.hypot(current.position.x-portal.position[0],current.position.z-portal.position[2])<=portal.radius+.5);
    const arrival=maps[portal.target.map].markers.find(marker=>marker.id===portal.target.arrival);
    const position={x:arrival.position[0],z:arrival.position[2],yaw:arrival.rotationY};
    calls.push({from:map,to:portal.target.map});
    current.position=position;
    current.data.location=portal.target.map;
    current.data.position=position;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'ok',location:portal.target.map,position,players:[],encounter:current.encounter,vitals:current.vitals,
    })});
  });
  const move=async(x,z)=>{
    world.players.get(account.user.id).position={x,z,yaw:0};
    await player.page.evaluate(({x,z})=>window.brumaluz.move(x,z),{x,z});
  };
  try{
    await player.enter();
    await player.page.waitForTimeout(800);
    assert.deepEqual(player.errors,[]);
    assert.equal(await player.page.evaluate(()=>window.brumaluz.city().locationId),'brumaluz');
    await player.page.locator('#interact-label').filter({hasText:/Casa de Isberto/i}).waitFor();
    assert.match(await player.page.locator('#interact-label').textContent(),/Bloqueado: combate activo/);
    await player.page.keyboard.press('e');
    await player.page.locator('#toast.error.show').filter({hasText:'Termina el combate activo'}).waitFor();
    assert.equal(await player.page.evaluate(()=>window.brumaluz.city().locationId),'brumaluz');
    assert.equal(calls.length,0);
    const current=world.players.get(account.user.id);
    current.encounter={...current.encounter,status:'active',engaged:false,health:100};
    await player.page.waitForFunction(()=>!document.querySelector('#interact-label').textContent.includes('Bloqueado'));
    await player.page.keyboard.press('e');
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='casa_de_isberto_interior');
    assert.equal(current.encounter.status,'active','Travelling with a pending quest does not complete or discard its enemy');
    assert.equal(current.encounter.engaged,false);
    await player.page.waitForFunction(()=>!document.querySelector('.map-transition'));
    await player.page.locator('#interact-label').filter({hasText:'Salir a Brumaluz'}).waitFor();
    await player.page.keyboard.press('e');
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz');
    await player.page.waitForFunction(()=>!document.querySelector('.map-transition'));
    current.encounter={...current.encounter,status:'active',engaged:true,health:100};
    await player.page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));
    await move(160,0);
    await player.page.waitForTimeout(600);
    await move(175.2,0);
    await player.page.locator('#toast.error.show').filter({hasText:'Termina el combate activo'}).waitFor();
    assert.equal(calls.length,2,'An automatic exit also refuses combat with a visible explanation');
    current.encounter={...current.encounter,status:'active',engaged:false,health:100};
    await move(160,0);
    await player.page.waitForTimeout(600);
    await move(175.2,0);
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='pompelin');
    await player.page.waitForFunction(()=>!document.querySelector('.map-transition'));
    await move(-70,-90);
    await player.page.locator('#interact-label').filter({hasText:'Brumaluz'}).waitFor();
    await player.page.keyboard.press('e');
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz');
    assert.deepEqual(calls,[
      {from:'brumaluz',to:'casa_de_isberto_interior'},{from:'casa_de_isberto_interior',to:'brumaluz'},
      {from:'brumaluz',to:'pompelin'},{from:'pompelin',to:'brumaluz'},
    ]);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('the account bank opens at Isberto\'s chest, stores whole stacks and pelines, drags between slots and blocks bound items', {timeout:120000}, async()=>{
  const world=backend(),account=fixture('Banquero','humano',24.5);
  world.bankCalls=[];
  Object.assign(account.character.data,{
    position:{x:24.5,z:-48.5,yaw:0},welcome:{origin:0,stage:'completed'},shadowQuest:'returned',wallet:{pelines:40},
    inventory:[{id:'pan_duro',count:12},{id:'esencia_sombria',count:2,bound:true},{id:'pocion_vida_minuscula',count:3}],
  });
  const maps=Object.fromEntries(['brumaluz','casa_de_isberto_interior'].map(id=>[
    id,JSON.parse(readFileSync(join(process.cwd(),'src','data','world','maps',`${id}.json`),'utf8')),
  ]));
  const player=await openPlayer(world,account),page=player.page;
  await player.context.route(/\/rest\/v1\/rpc\/world_travel$/,async route=>{
    const {p_portal}=route.request().postDataJSON();
    const current=world.players.get(account.user.id);
    const map=current.data.location??'brumaluz',portal=maps[map].markers.find(marker=>marker.id===p_portal);
    const arrival=maps[portal.target.map].markers.find(marker=>marker.id===portal.target.arrival);
    const position={x:arrival.position[0],z:arrival.position[2],yaw:arrival.rotationY};
    Object.assign(current,{position});
    Object.assign(current.data,{location:portal.target.map,position});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'ok',location:portal.target.map,position,players:[],encounter:current.encounter,vitals:current.vitals,
    })});
  });
  const bankSlot=i=>page.locator('.bank-panel.vault .bank-slot').nth(i);
  const bagSlot=i=>page.locator('.bank-panel.bag .bank-slot').nth(i);
  const vaultUsed=()=>page.locator('.bank-panel.vault .bank-meter b').textContent();
  try{
    await player.enter();
    await page.locator('#interact-label').filter({hasText:/Casa de Isberto/i}).waitFor();
    await page.keyboard.press('e');
    await page.waitForFunction(()=>window.brumaluz.city().locationId==='casa_de_isberto_interior');
    await page.waitForFunction(()=>!document.querySelector('.map-transition'));
    await page.evaluate(()=>window.brumaluz.move(2.25,2.3));
    await page.locator('#interact-label').filter({hasText:'Abrir el banco'}).waitFor();
    await page.keyboard.press('e');
    await bankSlot(0).waitFor();
    assert.equal(await page.locator('#window-title').textContent(),'Banco');
    assert.equal(await page.locator('.bank-panel.vault .bank-slot').count(),50);
    assert.equal(await vaultUsed(),'0 / 50');
    assert.equal(await bagSlot(1).evaluate(node=>node.tagName),'DIV','Bound items cannot be clicked into the bank');
    assert.ok(await bagSlot(1).evaluate(node=>node.classList.contains('bank-blocked')));
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'bank.png')});

    await bagSlot(0).click();
    await page.waitForFunction(()=>document.querySelector('.bank-panel.vault .bank-meter b')?.textContent==='1 / 50');
    assert.deepEqual(account.character.data.inventory[0],null);
    assert.equal(await bankSlot(0).locator('i').textContent(),'12');

    await page.locator('.bank-ledger input').fill('25');
    await page.locator('.bank-move.deposit').click();
    await page.locator('.bank-balance.stored b').filter({hasText:'25'}).waitFor();
    assert.equal(account.character.data.wallet.pelines,15);

    await bankSlot(0).click();
    await page.waitForFunction(()=>document.querySelector('.bank-panel.vault .bank-meter b')?.textContent==='0 / 50');
    assert.deepEqual(account.character.data.inventory[0],{id:'pan_duro',count:12,bound:false});
    await page.locator('.bank-balance.stored').click();
    await page.locator('.bank-move.withdraw').click();
    await page.locator('.bank-balance.stored b').filter({hasText:/^0$/}).waitFor();
    assert.equal(account.character.data.wallet.pelines,40);

    // Arrastrar: de la mochila a un hueco concreto del baúl, dentro del baúl y de vuelta a un hueco de la mochila.
    await bagSlot(0).dragTo(bankSlot(7));
    await page.waitForFunction(()=>document.querySelectorAll('.bank-panel.vault .bank-slot')[7]?.classList.contains('filled'));
    await bankSlot(7).dragTo(bankSlot(3));
    await page.waitForFunction(()=>document.querySelectorAll('.bank-panel.vault .bank-slot')[3]?.classList.contains('filled'));
    await bankSlot(3).dragTo(bagSlot(4));
    await page.waitForFunction(()=>document.querySelectorAll('.bank-panel.bag .bank-slot')[4]?.classList.contains('filled'));
    assert.deepEqual(account.character.data.inventory[4],{id:'pan_duro',count:12,bound:false});
    // Lo ligado no se suelta en el baúl.
    await bagSlot(1).dragTo(bankSlot(0));
    await page.waitForTimeout(200);
    assert.deepEqual(world.bankCalls.map(call=>[call.action,call.target]),[
      ['open',null],['deposit',null],['deposit_pelines',null],['withdraw',null],['withdraw_pelines',null],
      ['deposit',7],['move',3],['withdraw',4],
    ]);

    await page.keyboard.press('Escape');
    await page.locator('#window-backdrop').waitFor({state:'hidden'});
    await page.evaluate(()=>window.brumaluz.move(0,-1));
    await page.keyboard.press('e');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#window-backdrop').isHidden(),true,'The chest cannot be used from across the room');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});
