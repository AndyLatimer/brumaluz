// Pruebas del mundo en el navegador: Bienvenida de Gnomi: orígenes, tarjetas de misión y diario.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, npcDefinitions, browser, fixture, backend, leave } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('welcome systems save origins directly, present quest cards, await server actions and persist the journal through rewards', {timeout:180000}, async()=>{
  const world=backend(),a=fixture('Alric','humano',-6.4),b=fixture('Elara','elfo',-5.4);
  // Cerca de Gnomi, pero lejos de la puerta: sin la cinemática de llegada.
  a.character.data.position={x:148,z:1,yaw:0};
  b.character.data.position={x:148,z:-1,yaw:0};
  a.character.data.welcome={origin:null,stage:'available'};
  a.character.data.inventory=Array.from({length:25},()=>({id:'pan_duro',count:50}));
  b.character.data.welcome={origin:null,stage:'available'};
  const first=await openPlayer(world,a),second=await openPlayer(world,b);
  const approach=async(page,x,z)=>{
    await page.evaluate(({x,z})=>window.brumaluz.move(x,z),{x,z});
    await page.waitForTimeout(800);
  };
  const talk=async(page,english=false)=>{
    await page.evaluate(()=>{
      const p=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal').position;
      window.brumaluz.move(p.x,p.z+1.7);
    });
    await page.waitForFunction(label=>document.querySelector('#interact-prompt').textContent.includes(label),english?'Talk to Gnomi':'Hablar con Gnomi');
    await page.keyboard.press('KeyE');
    await page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('.dialog-speaker').textContent(),'Gnomi');
  };
  try {
    await first.enter();await second.enter();
    const gnomiModel=await first.page.evaluate(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      let skins=0,bones=0;
      g.traverse(object=>{if(object.isSkinnedMesh)skins++;if(object.isBone)bones++;});
      return {
        skins,bones,scale:g.getObjectByName('gnomi-rig').scale.y*g.getObjectByName('gnomi-rig').children[0].scale.y,
        hat:!!g.getObjectByName('helpers-soft-cap'),
        hatAnchor:g.getObjectByName('helpers-soft-cap')?.parent.name,
        bindings:(()=>{
          let compatible=true;
          g.traverse(object=>{
            if(object.isSkinnedMesh)compatible&&=object.skeleton.bones.every(bone=>g.getObjectByName(bone.name)===bone);
          });
          return compatible;
        })(),
        oldHat:!!g.getObjectByName('Mage_Hat'),
        oldBody:!!g.getObjectByName('Rogue_Body'),
        overalls:!!g.getObjectByName('helpers-overalls'),
      };
    });
    assert.ok(gnomiModel.skins>=10,'Gnomi uses independent skinned garments and exposed anatomy');
    assert.equal(gnomiModel.bones,41);
    assert.equal(gnomiModel.scale,.48,'Gnomi keeps his small size outside animation transforms');
    assert.equal(gnomiModel.hat,true);
    assert.equal(gnomiModel.hatAnchor,'head');
    assert.equal(gnomiModel.bindings,true,'Every garment follows the character skeleton rather than an unanimated copy');
    assert.equal(gnomiModel.oldHat,false,'The deformed wizard hat is no longer used');
    assert.equal(gnomiModel.oldBody,false,'The uniform replaces rather than overlaps the starting clothes');
    assert.equal(gnomiModel.overalls,true);
    const relativeHeight=await first.page.evaluate(()=>{
      const height=root=>{
        root.updateWorldMatrix(true,true);
        let bounds=null;
        root.traverse(object=>{
          if(!object.isMesh||!object.visible||object.material.transparent)return;
          if(object.isSkinnedMesh){object.skeleton.update();object.computeBoundingBox();}
          else object.geometry.computeBoundingBox();
          const box=(object.isSkinnedMesh?object.boundingBox:object.geometry.boundingBox).clone().applyMatrix4(object.matrixWorld);
          if(bounds)bounds.union(box);else bounds=box;
        });
        return bounds.max.y-bounds.min.y;
      };
      return height(window.brumaluz.city().root.parent.getObjectByName('gnomi-personal'))/height(window.brumaluz.char().root);
    });
    assert.ok(relativeHeight>.35&&relativeHeight<.6,`Gnomi including his hat reaches roughly mid-thigh: ${relativeHeight}`);
    await approach(first.page,152,1);
    await talk(first.page);
    assert.match(await first.page.locator('.dialog-text').textContent(),/bienvenida a Brumaluz.*ayudante de bienvenida/s);
    assert.equal(await first.page.locator('.dialog-subtitle').textContent(),npcDefinitions.find(npc=>npc.id==='gnomi').subtitle);
    assert.equal(await first.page.locator('.dialog-quest-card').count(),0,'Ordinary conversation has no quest panel');
    world.rpcDelay.set('welcome_action',600);
    await first.page.getByRole('button',{name:'He venido a probar suerte.'}).click();
    assert.equal(await first.page.locator('#dialog').getAttribute('aria-busy'),'true');
    assert.equal(await first.page.getByRole('button',{name:'He venido a probar suerte.'}).isDisabled(),true);
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Aceptar misión'}).waitFor();
    assert.equal(a.character.data.welcome.origin,1,'Selecting the response saves it directly with no confirmation step');
    assert.equal(await first.page.getByRole('button',{name:'Confirmar mi motivo'}).count(),0);
    assert.equal(a.character.data.welcome.stage,'available','Origin selection does not accept the quest');
    assert.equal(await first.page.locator('.dialog-quest-card h3').textContent(),'Algo pequeño, algo importante');
    assert.equal(await first.page.locator('.dialog-quest-card').getAttribute('aria-label'),'Nueva misión');
    assert.deepEqual(await first.page.locator('.dialog-quest-rewards > span').allTextContents(),['40 XP','5 pelines']);
    assert.equal(await first.page.locator('.dialog-hint').isVisible(),false,'Quest offers omit the redundant E / Choose hint');
    assert.equal(await first.page.getByRole('button',{name:'Aceptar misión'}).locator('.dialog-choice-mark').textContent(),'✓');
    assert.doesNotMatch(await first.page.locator('.dialog-text').textContent(),/Recompensa|40 XP/,'Rewards are structured UI, not dialogue prose');
    assert.match(await first.page.locator('.dialog-text').textContent(),/Gremio de Ayudantes.*¡Otra vez!.*David/s);
    for(const [width,height] of [[320,844],[390,844],[1280,844],[844,390],[320,568]]){
      await first.page.setViewportSize({width,height});
      const fits=await first.page.locator('#dialog').evaluate(el=>{
        const box=el.getBoundingClientRect();
        return box.top>=0&&box.bottom<=innerHeight&&box.left>=0&&box.right<=innerWidth&&el.scrollWidth<=el.clientWidth;
      });
      assert.ok(fits,`Quest offer fits ${width}px`);
      await first.page.waitForTimeout(1100);
      const framing=await first.page.evaluate(()=>{
        const camera=window.brumaluz.camera(),player=window.brumaluz.char().root.parent;
        const npc=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
        const top=document.querySelector('#dialog').getBoundingClientRect().top;
        return [player,npc].flatMap((actor,i)=>[.08,i===0?2.2:.95].map(height=>{
          const p=actor.position.clone();p.y+=height;p.project(camera);
          return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,z:p.z,top};
        }));
      });
      assert.ok(framing.every(p=>p.x>8&&p.x<width-8&&p.y>0&&p.y<p.top-8&&p.z>-1&&p.z<1),`Both characters remain above the dialogue at ${width}px: ${JSON.stringify(framing)}`);
      await first.page.getByRole('button',{name:'Aceptar misión'}).scrollIntoViewIfNeeded();
      assert.ok(await first.page.getByRole('button',{name:'Aceptar misión'}).evaluate(el=>{
        const box=el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
      }),`Quest acceptance is not covered by chat or minimap at ${width}px`);
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`welcome-offer-${width}.png`)});
    }
    await first.page.setViewportSize({width:1280,height:800});
    await first.page.waitForTimeout(600);
    const beforeOrbit=await first.page.evaluate(()=>({
      camera:window.brumaluz.camera().position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),
    }));
    await first.page.mouse.move(630,150);await first.page.mouse.down();
    await first.page.mouse.move(790,180,{steps:12});await first.page.mouse.up();
    await first.page.waitForTimeout(600);
    const afterOrbit=await first.page.evaluate(()=>({
      camera:window.brumaluz.camera().position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),
    }));
    assert.ok(Math.hypot(...afterOrbit.camera.map((v,i)=>v-beforeOrbit.camera[i]))>1,'Dragging orbits the conversation camera');
    assert.deepEqual(afterOrbit.player,beforeOrbit.player,'Orbiting never moves the player');
    assert.equal(await first.page.locator('#dialog').isVisible(),true,'Dragging never advances or closes the conversation');
    await first.page.locator('#scene').dispatchEvent('wheel',{deltaY:600});
    await first.page.keyboard.press('Escape');
    await first.page.waitForFunction(()=>!window.brumaluz.camera().view?.enabled);
    const restoredCamera=await first.page.evaluate(()=>{
      const position=window.brumaluz.camera().position.clone().sub(window.brumaluz.char().root.parent.position);
      return {yaw:Math.atan2(position.x,position.z),distance:Math.hypot(position.x,position.z)};
    });
    assert.ok(Math.abs(restoredCamera.yaw)<.02,'Conversation keeps the exploration camera yaw');
    assert.ok(Math.abs(restoredCamera.distance-Math.cos(.55)*12)<.05,'Wheel input during conversation does not change the exploration zoom');
    assert.equal(await first.page.locator('body').evaluate(el=>el.classList.contains('conversation-open')),false);
    assert.equal(a.character.data.welcome.stage,'available','Closing the offer does not accept or abandon it');
    await talk(first.page);
    await first.page.locator('.dialog-quest-card').waitFor();
    assert.equal(await first.page.getByRole('button',{name:'He venido a probar suerte.'}).count(),0,'Returning to Gnomi does not ask for the saved origin again');
    assert.equal(await first.page.locator('#dialog').getAttribute('aria-busy'),'false');
    world.rpcDelay.delete('welcome_action');
    world.fail.add('welcome');
    await first.page.getByRole('button',{name:'Aceptar misión'}).click();
    await first.page.waitForFunction(()=>document.querySelector('#dialog').getAttribute('aria-busy')==='false');
    assert.equal(a.character.data.welcome.stage,'available');
    assert.equal(await first.page.locator('#dialog').isVisible(),true,'Server failure leaves the conversation ready to retry');
    await first.page.locator('#toast').filter({hasText:'Temporary quest failure'}).waitFor();
    world.fail.delete('welcome');
    await first.page.getByRole('button',{name:'Aceptar misión'}).click();
    await first.page.locator('#dialog').waitFor({state:'hidden'});
    await first.page.locator('#quest-tracker').waitFor();
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'welcome-companion.png')});
    await first.page.keyboard.press('KeyJ');
    await first.page.locator('.quest-entry').waitFor();
    assert.equal(await first.page.locator('.quest-origin').count(),0,'The journal does not repeat the saved origin');
    assert.deepEqual(await first.page.locator('.quest-reward b').allTextContents(),['+40','+5']);
    assert.equal(await first.page.locator('.quest-reward.pelines .currency-icon-pelines').count(),1);
    assert.equal(await first.page.locator('.quest-reward small').count(),0,'Rewards omit redundant explanatory captions');
    assert.equal(await first.page.locator('.quest-steps li.current').textContent(),'2Encontrar el distintivo');
    assert.equal(await first.page.locator('.quest-items').count(),0,'Uncollected quest items are not owned');
    assert.equal(await first.page.locator('.quest-entry header > small,.quest-rewards-heading > small').count(),0);
    assert.equal(await first.page.getByRole('button',{name:/Abandonar/}).count(),0);
    await first.page.locator('.quest-journal').evaluate(node=>node.dataset.testIdentity='preserved');
    await first.page.waitForTimeout(1100);
    assert.equal(await first.page.locator('.quest-journal').getAttribute('data-test-identity'),'preserved','World updates preserve the journal DOM while reading it');
    for(const width of [320,390,1280]){
      await first.page.setViewportSize({width,height:844});
      assert.ok(await first.page.locator('.quest-journal').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'Journal fits the viewport');
      const close=await first.page.locator('#window-close').boundingBox();
      assert.ok(close.y>=0&&close.y+close.height<844-44,'Journal keeps the close button above the chat handle');
      await first.page.locator('.quest-rewards').scrollIntoViewIfNeeded();
      assert.ok(await first.page.locator('.quest-reward-list').evaluate(el=>el.scrollWidth<=el.clientWidth),'Reward cards fit narrow screens');
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`welcome-journal-${width}.png`)});
    }
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyI');
    await first.page.locator('.inv-grid').waitFor();
    assert.equal(await first.page.locator('.inv .quest-items').count(),0);
    const bagCapacity=await first.page.locator('.inv-capacity').textContent();
    await first.page.keyboard.press('Escape');
    const inventoryBeforeQuestItem=JSON.stringify(a.character.data.inventory);
    await first.page.setViewportSize({width:1280,height:800});
    for(const [x,z] of [[150,0],[146,0],[142,-1],[138.6,-2.6]])await approach(first.page,x,z);
    await first.page.waitForFunction(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      const p=window.brumaluz.char().root.parent.position;
      return g.position.distanceTo(p)<3;
    });
    assert.equal(b.character.data.welcome.stage,'available','The other player does not share progress or collection');
    assert.equal(await second.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('gnomi-lost-badge').visible),false);
    await first.page.waitForFunction(()=>document.querySelector('#interact-prompt').textContent.includes('Recoger distintivo'));
    await first.page.keyboard.press('KeyE');
    await first.page.waitForFunction(()=>document.querySelector('#quest-tracker').textContent.includes('devuélvele'));
    assert.equal(a.character.data.welcome.stage,'found');
    await first.page.reload();await first.page.waitForFunction(()=>!!window.brumaluz);
    await first.enter();
    await first.page.keyboard.press('KeyJ');
    await first.page.locator('.quest-key-item').waitFor();
    assert.equal(await first.page.locator('.quest-origin').count(),0);
    assert.equal(a.character.data.welcome.origin,1,'Origin stays saved without being repeated in the journal');
    assert.match(await first.page.locator('.quest-key-item').textContent(),/Distintivo del Gremio de Ayudantes/);
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyI');
    await first.page.locator('.inv .quest-key-item').waitFor();
    assert.equal(await first.page.locator('.inv-capacity').textContent(),bagCapacity);
    assert.equal(JSON.stringify(a.character.data.inventory),inventoryBeforeQuestItem,'Quest items never occupy real bag slots');
    const questItem=first.page.locator('.inv .quest-key-item');
    assert.equal(await questItem.getAttribute('draggable'),null);
    assert.equal(await questItem.locator('button').count(),0);
    assert.equal(await questItem.getAttribute('data-item-id'),null,'Quest items are not transferable bag objects');
    await questItem.scrollIntoViewIfNeeded();
    await first.page.waitForTimeout(100);
    await questItem.focus();
    await first.page.locator('#game-tooltip').filter({hasText:'No se puede vender, intercambiar ni descartar.'}).waitFor();
    for(const width of [320,390,1280]){
      await first.page.setViewportSize({width,height:844});
      await questItem.scrollIntoViewIfNeeded();
      assert.ok(await questItem.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'Quest item card fits the inventory');
      assert.ok(await questItem.evaluate(el=>{
        const box=el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
      }),'Quest item stays accessible above the action bar');
      const close=await first.page.locator('#window-close').boundingBox();
      assert.ok(close.y>=0&&close.y+close.height<800,'Inventory close button stays onscreen');
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`welcome-inventory-${width}.png`)});
    }
    await first.page.keyboard.press('Escape');
    await first.page.setViewportSize({width:1280,height:800});
    await talk(first.page);
    assert.equal(await first.page.locator('.dialog-quest-card').getAttribute('aria-label'),'Entrega de misión');
    await first.page.getByRole('button',{name:'Completar misión'}).click();
    await first.page.locator('.dialog-text').filter({hasText:'bien sujeto'}).waitFor();
    await first.page.keyboard.press('KeyE');
    await first.page.locator('#story-arrival').waitFor({state:'visible'});
    assert.equal(await first.page.locator('#dialog').isVisible(),false,'The offer does not start before Isberto arrives');
    const arrivalStart=await first.page.evaluate(()=>{
      const root=window.brumaluz.city().root.parent.getObjectByName('npc:isberto');
      return {position:root.position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),time:performance.now()};
    });
    await first.page.keyboard.down('KeyW');
    await first.page.keyboard.press('KeyI');
    await first.page.waitForTimeout(700);
    await first.page.keyboard.up('KeyW');
    const arrivalMiddle=await first.page.evaluate(()=>{
      const root=window.brumaluz.city().root.parent.getObjectByName('npc:isberto'),camera=window.brumaluz.camera();
      const screen=root.position.clone().add({x:0,y:1,z:0}).project(camera);
      return {position:root.position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),gait:root.userData.gait,screen:screen.toArray()};
    });
    assert.equal(arrivalMiddle.gait,'walk');
    assert.deepEqual(arrivalMiddle.player,arrivalStart.player,'Movement input stays blocked during the short cutscene');
    assert.ok(Math.hypot(arrivalMiddle.position[0]-arrivalStart.position[0],arrivalMiddle.position[2]-arrivalStart.position[2])>.5,'Isberto walks through the world rather than appearing at the player');
    assert.ok(Math.abs(arrivalMiddle.screen[0])<1&&Math.abs(arrivalMiddle.screen[1])<1&&Math.abs(arrivalMiddle.screen[2])<1,'The walking NPC is visible in the cinematic framing');
    assert.equal(await first.page.locator('#window-backdrop').isVisible(),false,'Inventory cannot interrupt the arrival');
    // Después de llegar, un plano de la criatura junto a la herrería antes de que Isberto pida ayuda.
    await first.page.locator('#cinematic').waitFor({state:'visible'});
    await first.page.locator('.cinematic-line').filter({hasText:'herrería'}).waitFor();
    const reveal=await first.page.evaluate(()=>{
      const monster=window.brumaluz.city().root.parent.getObjectByName('story-shadow-preview');
      const p=monster.position.clone().setY(monster.position.y+.6).project(window.brumaluz.camera());
      return {screen:p.toArray(),hud:getComputedStyle(document.querySelector('#player-hud')).visibility};
    });
    assert.ok(Math.abs(reveal.screen[0])<1&&Math.abs(reveal.screen[1])<1&&reveal.screen[2]<1,'The creature is framed by the cutscene');
    assert.equal(reveal.hud,'hidden','The cutscene hides the HUD');
    await first.page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor({timeout:30000});
    await first.page.locator('#story-arrival').waitFor({state:'hidden'});
    assert.equal(await first.page.locator('#cinematic').isVisible(),false);
    assert.equal(await first.page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('story-shadow-preview')),false,'The preview creature leaves with the cutscene');
    assert.ok(await first.page.evaluate(start=>performance.now()-start>=2000,arrivalStart.time),'The arrival is shown before starting the offer');
    await first.page.locator('.dialog-quest-card').filter({hasText:'Una sombra junto a la fragua'}).waitFor();
    assert.equal(a.character.data.shadowQuest,undefined,'Opening the automatic offer never accepts it');
    const introPosition=await first.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').position.toArray());
    assert.ok(Math.hypot(introPosition[0]-a.character.data.isbertoPosition.x,introPosition[2]-a.character.data.isbertoPosition.z)<2);
    assert.equal(await first.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('gnomi-worn-badge').visible),true);
    assert.ok(await first.page.evaluate(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      return g.position.distanceTo(window.brumaluz.char().root.parent.position)<4;
    }),'Gnomi stays beside the player through the thank-you conversation');
    assert.equal(await first.page.locator('.dialog-quest-card').count(),1,'Isberto automatically offers the next quest');
    assert.equal(await first.page.locator('.dialog-hint').isVisible(),false);
    assert.equal(a.character.data.experience,40);
    assert.equal(a.character.data.wallet.pelines,5);
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyJ');
    assert.equal(await first.page.locator('.quest-key-item').count(),0);
    assert.equal(await first.page.getByRole('button',{name:'Activas',exact:true}).getAttribute('aria-pressed'),'true','The next Isberto quest remains available after the welcome');
    await first.page.getByRole('button',{name:'Completadas',exact:true}).click();
    assert.equal(await first.page.locator('.quest-completed').getAttribute('open'),null);
    await first.page.locator('.quest-completed summary').click();
    assert.match(await first.page.locator('.quest-entry footer').textContent(),/Recompensas recibidas/);
    assert.equal(await first.page.locator('.quest-steps li.done').count(),3);
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyI');
    await first.page.locator('.inv-grid').waitFor();
    assert.equal(await first.page.locator('.inv .quest-items').count(),0,'Delivered quest items disappear from inventory');
    await first.page.keyboard.press('Escape');
    await first.page.locator('#game-menu-toggle').click();
    await first.page.locator('#game-menu-options').click();
    await first.page.locator('#options-backdrop [data-language="en"]').click();
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyJ');
    assert.equal(await first.page.locator('#window-title').textContent(),'Quest journal');
    await first.page.getByRole('button',{name:'Completed',exact:true}).click();
    await first.page.locator('.quest-completed summary').click();
    assert.match(await first.page.locator('.quest-entry footer').textContent(),/Rewards received/);
    assert.deepEqual(await first.page.locator('.quest-reward strong').allTextContents(),['Experience','Pelines']);
    await first.page.keyboard.press('Escape');
    await leave(first.page);
    await first.page.reload();await first.page.waitForFunction(()=>!!window.brumaluz);await first.enter();
    assert.equal(await first.page.locator('#story-arrival').isVisible(),false,'Reconnecting never replays the already seen arrival');
    assert.equal(await first.page.locator('#dialog').isVisible(),false,'Reconnecting does not reopen or accept the offer');
    assert.equal(a.character.data.shadowQuest,undefined);
    await approach(second.page,152,-1);
    await talk(second.page);
    await second.page.getByRole('button',{name:'Vengo de la Arboleda para aprender.'}).click();
    await second.page.getByRole('button',{name:'Aceptar misión'}).waitFor();
    await second.page.keyboard.press('Escape');
    await second.page.locator('#game-menu-toggle').click();
    await second.page.locator('#game-menu-options').click();
    await second.page.locator('#options-backdrop [data-language="en"]').click();
    await second.page.keyboard.press('Escape');
    await talk(second.page,true);
    assert.equal(await second.page.locator('.dialog-quest-card').getAttribute('aria-label'),'New quest');
    assert.match(await second.page.locator('.dialog-quest-card').textContent(),/Objective.*Accompany Gnomi.*Rewards/s);
    assert.match(await second.page.locator('.dialog-text').textContent(),/Helpers' Guild.*David/s);
    assert.equal(await second.page.locator('.dialog-subtitle').textContent(),'Welcome helper');
    assert.equal(await second.page.getByRole('button',{name:'Accept quest',exact:true}).isVisible(),true);
    assert.equal(await second.page.getByRole('button',{name:'Close',exact:true}).isVisible(),true);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('welcome systems offer three distinct origins per race in the isolated development preview', {timeout:90000},async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    const expected={
      humano:['Soy de Brumaluz y busco mi primer oficio.','He venido a probar suerte.','Quiero aprender de sus talleres.'],
      elfo:['Vengo de la Arboleda para aprender.','Quiero conocer la vida de la capital.','Vivo aquí y busco un nuevo rumbo.'],
      lagto:['He bajado de las Cumbres de Cobre para aprender un oficio.','Quiero conocer qué hay más allá de las montañas.','Vivo aquí y busco un nuevo rumbo.'],
      pelso:['He llegado desde Luna Argéntea para conocer la capital.','Busco oportunidades en tierra firme.','Vivo aquí y busco un nuevo rumbo.'],
    };
    await page.evaluate(()=>{
      window.brumaluz.set({introSeen:true,welcome:{origin:null,stage:'available'},position:{x:153.5,z:0,yaw:Math.PI/2}});
      window.brumaluz.play();
    });
    for(const [race,labels] of Object.entries(expected)){
      await page.evaluate(race=>{
        window.brumaluz.set({race,welcome:{origin:null,stage:'available'}});
        window.brumaluz.move(153.5,0);
      },race);
      await page.locator('#interact-label').filter({hasText:'Hablar con Gnomi'}).waitFor();
      await page.keyboard.press('KeyE');
      await page.locator('#dialog').waitFor();
      assert.deepEqual(await page.locator('.dialog-choice:not(.exit) > span:last-child').allTextContents(),labels);
      await page.keyboard.press('Escape');
    }
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'found'}}));
    await page.locator('#game-menu-toggle').click();
    await page.locator('#game-menu-options').click();
    await page.locator('#options-backdrop [data-language="en"]').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyI');
    await page.locator('.inv .quest-key-item').waitFor();
    assert.match(await page.locator('.inv .quest-items').textContent(),/Quest items.*Helpers' Guild badge.*Return it to Gnomi/s);
    assert.equal(await page.locator('.inv .quest-items > small').count(),0);
    await page.locator('.inv .quest-key-item').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.locator('.inv .quest-key-item').focus();
    await page.locator('#game-tooltip').filter({hasText:'Cannot be sold, traded or discarded.'}).waitFor();
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
});
