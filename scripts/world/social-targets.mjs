// Pruebas del mundo en el navegador: Gráficos, social, títulos y marco del objetivo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, backend, remote, leave, social, socialRequest, hoverActor } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('graphics controls stay clear of account information and map population fits desktop and small screens', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await player.page.setViewportSize({ width, height });
      const layout = await player.page.evaluate(() => {
        const button = document.getElementById('graphics-mode').getBoundingClientRect();
        const account = document.getElementById('account-details').getBoundingClientRect();
        return {
          separated: button.right <= account.left || button.left >= account.right || button.bottom <= account.top || button.top >= account.bottom,
          inCorner: button.right <= innerWidth && button.bottom <= innerHeight && button.left > innerWidth / 2 && button.top > innerHeight / 2,
        };
      });
      assert.deepEqual(layout, { separated: true, inCorner: true });
    }
    await player.enter();
    for (const [width, height] of [[1280, 800], [390, 844], [320, 844]]) {
      await player.page.setViewportSize({ width, height });
      await player.page.locator('.minimap-player-count').waitFor({ state: 'visible' });
      assert.equal(await player.page.locator('.minimap-player-count').textContent(), '1');
      const fits = await player.page.locator('.minimap-plate').evaluate((plate) => {
        const badge = plate.querySelector('.minimap-players').getBoundingClientRect();
        const bounds = plate.getBoundingClientRect();
        const clock = plate.querySelector('.minimap-clock').getBoundingClientRect();
        const zone = plate.querySelector('.minimap-zone').getBoundingClientRect();
        return plate.scrollWidth <= plate.clientWidth && badge.left >= bounds.left && badge.right <= bounds.right && bounds.right <= innerWidth
          && clock.top >= Math.max(zone.bottom,badge.bottom) && bounds.left>=0
          && /^\d\d:\d\d$/.test(plate.querySelector('.minimap-time').textContent)
          && plate.querySelector('.minimap-location-icon') !== null && bounds.width <= 140 && bounds.height <= 42;
      });
      assert.equal(fits, true);
    }
    await player.page.locator('#game-menu-toggle').click();
    await player.page.locator('#game-menu-options').click();
    await player.page.locator('#options-backdrop [data-language="en"]').click();
    assert.equal(await player.page.locator('.minimap-players').getAttribute('aria-label'), '1 player in this map');
    assert.equal(await player.page.locator('#multiplayer-status').count(), 0);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('Social supports requests, acceptance, online presence, whisper, cancellation and removal across accounts', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), b = fixture('Elara', 'elfo', -5.4);
  b.character.data.cls = 'mago';
  const first = await openPlayer(world, a), second = await openPlayer(world, b);
  try {
    await first.enter(); await second.enter();
    await social(first.page); await social(second.page);
    await socialRequest(first.page, 'Nobody');
    await first.page.locator('.social-window .account-message.error').waitFor();
    assert.match(await first.page.locator('.social-friends-panel .account-message').textContent(), /No existe/);
    await socialRequest(first.page, '~Elara');
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor();
    await second.page.locator('[data-social="incoming"] .social-row').waitFor({timeout:15000});
    await second.page.getByRole('button', {name:'Rechazar',exact:true}).click();
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor({state:'detached',timeout:15000});
    await socialRequest(first.page, 'Elara');
    await first.page.getByRole('button', {name:'Cancelar solicitud',exact:true}).click();
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor({state:'detached'});
    await socialRequest(first.page, 'Elara');
    await second.page.getByRole('button', {name:'Aceptar',exact:true}).click({timeout:15000});
    await first.page.locator('[data-social="friend"] .social-row').waitFor({timeout:15000});
    assert.equal(await first.page.locator('.social-online').textContent(),'Conectado');
    assert.equal(await first.page.locator('.social-details dt').allTextContents().then(labels=>labels.join(',')),'Personaje,Ubicación');
    assert.deepEqual(await first.page.locator('.social-details dd').allTextContents(),['Elara Nivel 1','Brumaluz']);
    assert.equal(await first.page.locator('.social-friend-level').textContent(),'Nivel 1');
    assert.deepEqual(await first.page.locator('.social-stat strong').allTextContents(),['1','0']);
    assert.equal(await first.page.locator('.social-connected-total').textContent(),'(1 conectados)');
    assert.equal(await first.page.locator('.social-introduction').count(),0);
    assert.equal(await first.page.locator('.social-account-prefix').textContent(),'~');
    assert.equal(await first.page.locator('[data-social="friend"] .social-count').textContent(),'1');
    assert.equal(await first.page.locator('.social-avatar .class-icon').count(),1);
    assert.equal(await first.page.locator('.social-avatar').getAttribute('aria-label'),'Mago');
    assert.equal(await first.page.locator('#social-username').getAttribute('aria-describedby'),'social-invitation-help');
    const stats=await first.page.locator('.social-stat').evaluateAll(cards=>cards.map(card=>{
      const bounds=card.getBoundingClientRect();
      const value=card.querySelector('.social-stat-value').getBoundingClientRect();
      const label=card.querySelector('span').getBoundingClientRect();
      return {centered:Math.abs((bounds.left+bounds.right-value.left-value.right)/2)<1 && Math.abs((bounds.left+bounds.right-label.left-label.right)/2)<1,valueY:value.top};
    }));
    assert.ok(stats.every(stat=>stat.centered),'Statistic values and labels must be centered');
    assert.ok(Math.abs(stats[0].valueY-stats[1].valueY)<1,'Both totals share the same baseline');
    assert.equal(await first.page.locator('.social-details dt svg').count(),2);
    const detailGap=await first.page.locator('.social-details').evaluate(dl=>{
      const first=dl.querySelector('dd').getBoundingClientRect();
      const second=dl.querySelectorAll('dt')[1].getBoundingClientRect();
      return second.left-first.right;
    });
    assert.ok(detailGap>=0 && detailGap<=22,'Character and location must remain grouped');
    world.players.get(b.user.id).data.level = 12;
    await first.page.waitForFunction(()=>document.querySelector('.social-friend-level')?.textContent==='Nivel 12');
    for (const width of [320,390,1280]) {
      await first.page.setViewportSize({width,height:844});
      const badges=await first.page.locator('.social-count').evaluateAll(elements=>elements.map(el=>{
        const box=el.getBoundingClientRect(),head=el.parentElement.getBoundingClientRect();
        const css=getComputedStyle(el);
        return {right:head.right-box.right,center:Math.abs((box.top+box.bottom-head.top-head.bottom)/2),spacing:css.letterSpacing};
      }));
      assert.ok(badges.every(b=>Math.abs(b.right-13)<1&&b.center<1&&['0px','normal'].includes(b.spacing)),`Section counts align at the right edge and are vertically centered without inherited letter spacing: ${width} ${JSON.stringify(badges)}`);
      const fits = await first.page.locator('.social-window').evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && el.scrollWidth <= el.clientWidth
          && [...el.querySelectorAll('button,input')].every(control => {
            if (!control.getClientRects().length) return true;
            const box = control.getBoundingClientRect();
            return box.left >= bounds.left && box.right <= bounds.right;
          });
      });
      assert.equal(fits,true,`Populated Social and controls fit ${width}px`);
    }
    await first.page.getByRole('button', {name:'Susurrar',exact:true}).click();
    assert.equal(await first.page.locator('.chat-input').inputValue(), '/w ~Elara ');
    assert.equal(await first.page.locator('#window-backdrop').isVisible(), false);
    await second.page.locator('#window-close').click();
    await leave(second.page);
    await first.page.locator('.chat-input').blur();
    await social(first.page);
    assert.equal(await first.page.locator('.social-offline').textContent(), 'Desconectado');
    assert.equal(await first.page.getByRole('button',{name:'Susurrar',exact:true}).isDisabled(),true);
    assert.equal(await first.page.locator('.social-avatar .class-icon').count(),0);
    assert.equal(await first.page.locator('.social-friend-level').count(),0);
    first.page.once('dialog', dialog => dialog.accept());
    await first.page.getByRole('button', {name:'Eliminar amigo',exact:true}).click();
    await first.page.locator('[data-social="friend"] .social-row').waitFor({state:'detached'});
    assert.equal(world.friends.size,0);
    await first.page.setViewportSize({width:390,height:844});
    const fits = await first.page.locator('.social-window').evaluate(el => el.getBoundingClientRect().right <= innerWidth && el.scrollWidth <= el.clientWidth);
    assert.equal(fits,true);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close(); await second.context.close();}
});

test('queen title uses the same reserved phoenix styling in the picker and remote nameplate', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4), b = fixture('Elara','elfo',-5.4);
  b.titles = ['reina_de_pompelin'];
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await second.page.locator('#player-menu-toggle').click();
    await second.page.locator('[data-window="sheet"]').click();
    await second.page.locator('.title-button').click();
    const queen = second.page.locator('.title-option').filter({hasText:'Reina de Pompelín'});
    assert.equal(await queen.locator('.phoenix').count(),1);
    assert.equal(await second.page.locator('.title-option').filter({hasText:'Rey de Pompelín'}).count(),0);
    await queen.click();
    await second.page.locator('.title-button.staff-title .phoenix').waitFor();
    await first.page.locator(`[data-player-id="${b.character.id}"] .staff-title`).filter({hasText:'Reina de Pompelín'}).waitFor();
    assert.equal(await first.page.locator(`[data-player-id="${b.character.id}"] .phoenix`).count(),1);
    await hoverActor(first.page,first.page.locator(`[data-player-id="${b.character.id}"]`));
    await first.page.locator('#target-frame .target-kind.staff-title').waitFor();
    assert.equal(await first.page.locator('#target-frame .target-kind').textContent(),'Reina de Pompelín');
    assert.equal(await first.page.locator('#target-frame .target-kind .phoenix').count(),1);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close(); await second.context.close();}
});

test('target frame shows hovered players and NPC types, live vitals, camera aim and menu cleanup', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4), b = fixture('Elara','elfo',-5.4);
  b.username = 'moon_account';
  b.character.data.cls = 'mago';
  b.character.data.level = 12;
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await remote(first.page,b.character.id);
    await first.page.waitForTimeout(1500);
    await hoverActor(first.page, first.page.locator(`[data-player-id="${b.character.id}"]`));
    const frame = first.page.locator('#target-frame');
    await frame.waitFor({state:'visible'});
    assert.equal(await frame.getAttribute('data-target-id'),b.character.id);
    assert.equal(await frame.locator('.target-name').textContent(),'Elara');
    assert.equal(await frame.locator('.target-username').textContent(),'~moon_account');
    assert.equal(await frame.locator('.target-kind').textContent(),'Recién llegado');
    assert.equal(await frame.locator('.target-emblem').getAttribute('aria-label'),'Mago');
    assert.equal(await frame.locator('.target-level').textContent(),'Nivel 12');
    assert.equal(await frame.locator('.class-icon').count(),1);
    assert.equal(await frame.getByRole('meter',{name:'Vida',exact:true}).getAttribute('aria-valuenow'),'80');
    assert.equal(await frame.getByRole('meter',{name:'Maná',exact:true}).getAttribute('aria-valuemax'),'70');
    world.players.get(b.user.id).vitals = { health: 17, maxHealth: 196, overheal: 0, resource: 9, maxResource: 129, resourceKind:'mana' };
    await first.page.waitForFunction(()=>document.querySelector('.target-health').getAttribute('aria-valuenow')==='17');
    assert.equal(await frame.locator('.target-resource span').textContent(),'9 / 129');
    assert.equal(await frame.locator('.target-health span').textContent(),'17 / 196');
    const hudStyle = await frame.evaluate(el => {
      const style = selector => getComputedStyle(document.querySelector(selector));
      const bounds = el.getBoundingClientRect();
      return {
        font: style('.target-heading').fontFamily === style('.hud-name-row').fontFamily
          && style('.target-meter span').fontFamily === style('.hud-bar span').fontFamily,
        level: style('.target-level').color === style('.hud-name-row span').color
          && style('.target-level').backgroundColor === 'rgba(0, 0, 0, 0)'
          && style('.target-level').borderTopWidth === '0px',
        compact: bounds.width <= 310 && bounds.height < 90 && document.querySelector('.target-emblem').getBoundingClientRect().width <= 38,
      };
    });
    assert.deepEqual(hudStyle,{font:true,level:true,compact:true});
    world.players.get(b.user.id).data.title = 'none';
    await first.page.waitForFunction(()=>document.querySelector('.target-kind').hidden);
    assert.equal(await frame.locator('.target-username').textContent(),'~moon_account','No title does not hide the player account');
    await first.page.mouse.move(1278,798);
    await frame.waitFor({state:'hidden'});
    await first.page.evaluate(()=>{
      const target=window.brumaluz.players()[0].root.position;
      window.brumaluz.move(target.x,target.z+.6);
      window.brumaluz.view(0,.55,12);
    });
    await first.page.waitForTimeout(2500);
    await frame.waitFor({state:'visible'});
    assert.equal(await frame.getAttribute('data-target-id'),b.character.id,'Camera center selects without pointer hovering the actor');
    await first.page.evaluate(()=>window.brumaluz.move(180,180));
    await frame.waitFor({state:'hidden'});
    await first.page.locator('#player-menu-toggle').click();
    await frame.waitFor({state:'hidden'});
    await first.page.locator('#player-menu-toggle').click();
    const npcPosition = await first.page.evaluate(()=>{
      const p=window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x,p.z+3);
      return {x:p.x,z:p.z};
    });
    await first.page.waitForTimeout(2000);
    await hoverActor(first.page,first.page.locator('.nameplate.npc:not(.welcome-nameplate)').first());
    await first.page.waitForFunction(()=>!document.querySelector('#target-frame').hidden && document.querySelector('#target-frame').dataset.targetId==='npc:testiculos');
    assert.equal(await frame.locator('.target-kind').textContent(),'Depuración');
    assert.equal(await frame.locator('.target-name').textContent(),'Testículos, the Debugger');
    assert.equal(await frame.locator('.class-icon').count(),0,'NPC has a type icon, not a character class');
    assert.equal(await frame.locator('.target-emblem svg').count(),1);
    assert.equal(await frame.locator('.target-username').textContent(),'');
    assert.equal(await frame.locator('.target-username').isVisible(),false);
    for (const width of [320,390,1280]) {
      await first.page.setViewportSize({width,height:844});
      await first.page.evaluate(({x,z})=>{
        window.brumaluz.move(x,z+.6);
        window.brumaluz.view(0,.55,12);
      },npcPosition);
      await first.page.mouse.move(width-2,842);
      await first.page.waitForTimeout(1800);
      await frame.waitFor({state:'visible'});
      const fits=await frame.evaluate(el=>{
        const box=el.getBoundingClientRect();
        const hud=document.querySelector('#player-hud').getBoundingClientRect();
        return box.left>=0 && box.right<=innerWidth && el.scrollWidth<=el.clientWidth
          && (box.left>=hud.right || box.top>=hud.bottom);
      });
      assert.equal(fits,true,`Target frame fits ${width}px without overlapping player HUD`);
    }
    await leave(first.page);
    await frame.waitFor({state:'hidden'});
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally { await first.context.close(); await second.context.close(); }
});

test('target aim tolerates camera pitch, zoom and character heights but not walls or turning away', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4), b = fixture('Elara','elfo',-5.4);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await remote(first.page,b.character.id);
    const frame = first.page.locator('#target-frame');
    for (const height of [0,1]) {
      world.players.get(b.user.id).data.height = height;
      await first.page.waitForFunction(height=>window.brumaluz.players()[0].height===height,height);
      for (const [pitch, zoom] of [[.15,6],[.55,12],[1.05,20]]) {
        await first.page.evaluate(({pitch,zoom})=>{
          const p=window.brumaluz.players()[0].root.position;
          window.brumaluz.move(p.x,p.z+3);
          window.brumaluz.view(0,pitch,zoom);
        },{pitch,zoom});
        await first.page.mouse.move(1278,798);
        await first.page.waitForTimeout(1000);
        assert.equal(await frame.isVisible(),true,`Camera aim works at height=${height}, pitch=${pitch}, zoom=${zoom}`);
        assert.equal(await frame.getAttribute('data-target-id'),b.character.id);
      }
    }
    await first.page.evaluate(()=>{
      const p=window.brumaluz.players()[0].root.position;
      window.brumaluz.move(p.x-3,p.z);
      window.brumaluz.view(0,.55,12);
    });
    await first.page.waitForTimeout(1200);
    await frame.waitFor({state:'hidden'});
    const plate=first.page.locator(`[data-player-id="${b.character.id}"]`);
    const box=await plate.boundingBox();
    assert.ok(box);
    await first.page.mouse.move(box.x+box.width/2,box.y+box.height+15);
    await frame.waitFor({state:'visible'});
    assert.equal(await frame.getAttribute('data-target-id'),b.character.id,'Hover can select around the head instead of hitting its exact triangles');
    await first.page.mouse.move(box.x+box.width/2+5,box.y+box.height+40);
    await first.page.waitForTimeout(350);
    assert.equal(await frame.isVisible(),true,'Small cursor movements keep the same target');
    await first.page.mouse.move(1278,798);
    await frame.waitFor({state:'hidden'});
    await first.page.evaluate(()=>{
      const target=window.brumaluz.players()[0].root;
      const city=window.brumaluz.city().root;
      let source;
      city.traverse(object=>{
        if(!source && object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh && !Array.isArray(object.material)) source=object;
      });
      const wall=source.clone(false);
      wall.geometry=source.geometry.clone();
      for(const key of Object.keys(wall.geometry.attributes)) wall.geometry.deleteAttribute(key);
      wall.geometry.setIndex(null);
      wall.geometry.clearGroups();
      wall.geometry.boundingBox=null;
      wall.geometry.boundingSphere=null;
      wall.geometry.setFromPoints([
        {x:-100,y:-20,z:0},{x:100,y:-20,z:0},{x:100,y:80,z:0},
        {x:-100,y:-20,z:0},{x:100,y:80,z:0},{x:-100,y:80,z:0},
      ]);
      wall.geometry.computeVertexNormals();
      wall.material=source.material.clone();
      wall.material.side=2;
      wall.material.vertexColors=false;
      wall.position.copy(target.position);
      wall.position.z+=1.5;
      wall.rotation.set(0,0,0);wall.scale.set(1,1,1);
      wall.name='target-occlusion-test';
      city.add(wall);
      window.brumaluz.move(target.position.x,target.position.z+3);
      window.brumaluz.view(0,.55,12);
    });
    await first.page.waitForTimeout(1200);
    assert.equal(await frame.isVisible(),false,'Relaxed camera aim cannot see through a wall');
    await first.page.evaluate(()=>{
      const wall=window.brumaluz.city().root.getObjectByName('target-occlusion-test');
      wall.removeFromParent();wall.geometry.dispose();wall.material.dispose();
    });
    await first.page.waitForTimeout(1200);
    assert.equal(await frame.isVisible(),true,'Target is reacquired after removing the wall');
    await first.page.evaluate(()=>window.brumaluz.view(Math.PI,.55,12));
    await first.page.waitForTimeout(1200);
    await frame.waitFor({state:'hidden'});
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('target details enforce the 10 metre player-distance limit for camera and cursor', { timeout: 120000 }, async () => {
  const world=backend(), a=fixture('Alric','humano',-6.4), b=fixture('Elara','elfo',-5.4);
  const first=await openPlayer(world,a), second=await openPlayer(world,b);
  try {
    await first.enter();await second.enter();await remote(first.page,b.character.id);
    const frame=first.page.locator('#target-frame');
    for (const method of ['camera','cursor']) {
      for (const distance of [9.99,10.01,25,9.99]) {
        await first.page.evaluate(({distance,method})=>{
          const p=window.brumaluz.players()[0].root.position;
          window.brumaluz.move(p.x+(method==='cursor'?distance:0),p.z+(method==='camera'?distance:0));
          window.brumaluz.view(0,.55,30);
        },{distance,method});
        await first.page.mouse.move(1278,798);
        await first.page.waitForTimeout(1500);
        if(method==='cursor') {
          const plate=first.page.locator(`[data-player-id="${b.character.id}"]`);
          await hoverActor(first.page,plate);
          await first.page.waitForTimeout(250);
        }
        const actual=await first.page.evaluate(()=>{
          const p=window.brumaluz.players()[0].root.position, me=window.brumaluz.char().root.parent.position;
          return p.distanceTo(me);
        });
        const showingPlayer=await frame.isVisible()&&await frame.locator('.target-name').textContent()==='Elara';
        assert.equal(showingPlayer,distance<10,`${method}: actual distance ${actual.toFixed(3)}m must respect the 10m boundary`);
      }
    }
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});
