// Pruebas del mundo en el navegador: Grupos e interacción entre jugadores cercanos.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fixture, backend, remote, leave, chatReady, social, groupTab, groupInvite, nearbyInteractions } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('party rejection notifies the inviter once and removes the solo group without losing other invitations', {timeout:120000}, async()=>{
  const world=backend(),accounts=[fixture('Alric','humano',-6.4),fixture('Elara','elfo',-5.4),fixture('Borin','humano',-3.4)];
  const players=[];
  try {
    for(const account of accounts){const player=await openPlayer(world,account);players.push(player);await player.enter();}
    const [first,second,third]=players;
    await groupTab(first.page);
    await groupInvite(first.page,'Elara');
    await groupInvite(first.page,'Borin');
    await groupTab(second.page);
    await second.page.locator('.party-invitation').getByRole('button',{name:'Rechazar',exact:true}).click();
    const message=first.page.locator('.chat-log').getByText('~Elara ha rechazado tu invitación de grupo.',{exact:true});
    await message.waitFor({state:'attached'});
    assert.equal(await first.page.locator('.party-pending').count(),1,'The other invitation remains available');
    await groupTab(third.page);
    await third.page.locator('.party-invitation').getByRole('button',{name:'Rechazar',exact:true}).click();
    await first.page.locator('.chat-log').getByText('~Borin ha rechazado tu invitación de grupo.',{exact:true}).waitFor({state:'attached'});
    await first.page.waitForFunction(()=>document.querySelector('#hud-party-leader').hidden);
    assert.equal(await first.page.locator('.party-panel-content .party-member').count(),0);
    assert.equal(await first.page.locator('.party-vacant').count(),1);
    await first.page.waitForTimeout(2400);
    assert.equal(await message.count(),1,'Polling does not repeat a response notification');
    assert.deepEqual(players.flatMap(player=>player.errors),[]);
  } finally {for(const player of players)await player.context.close();}
});

test('parties invite through interactions, default Social to Group, show leader HUD and map, chat privately and transfer leadership', {timeout:240000}, async()=>{
  const world=backend(),accounts=[fixture('Alric','humano',-6.4),fixture('Elara','elfo',-5.4),fixture('Borin','humano',-3.4),fixture('Daria','humano',-.4)];
  accounts[0].character.data.level=8;accounts[0].character.data.attributePoints.corpulencia=2;
  accounts[1].username='moon_account';accounts[1].character.data.cls='mago';
  const players=[];
  try {
    for(const account of accounts){const player=await openPlayer(world,account);players.push(player);await player.enter();}
    const [first,second,third,fourth]=players;
    await remote(first.page,accounts[1].character.id);
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Invitar a grupo',exact:true}).click();
    await second.page.waitForFunction(()=>document.querySelector('#player-menu-toggle').classList.contains('has-party-invite'));
    await first.page.keyboard.press('Escape');
    await groupTab(second.page);
    assert.equal(await second.page.locator('.party-vacant').count(),1);
    assert.deepEqual(await second.page.locator('.party-bonus-seal strong').allTextContents(),['—','—']);
    assert.equal(await second.page.locator('.party-invite-field > span').textContent(),'~');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await second.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'party-invitation.png')});
    await second.page.setViewportSize({width:320,height:844});
    assert.ok(await second.page.locator('#social-group-panel').evaluate(el=>el.scrollWidth<=el.clientWidth && [...el.querySelectorAll('input,button')].every(control=>{const r=control.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})),'Invitation, response buttons and account field fit a 320px screen');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await second.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'party-invitation-320.png')});
    await second.page.setViewportSize({width:1280,height:800});
    await second.page.locator('.party-invitation').getByRole('button',{name:'Aceptar',exact:true}).click();
    await second.page.locator('.party-member').nth(1).waitFor();
    await second.page.locator('#window-close').click();
    await first.page.locator('#party-hud .party-member').waitFor();
    await first.page.locator('.chat-log').getByText('~moon_account ha aceptado tu invitación y se ha unido al grupo.',{exact:true}).waitFor({state:'attached'});
    assert.equal(await first.page.locator('#party-hud .party-member-name strong').textContent(),'Elara');
    assert.equal(await first.page.locator('#hud-party-leader').isVisible(),true);
    assert.equal(await second.page.locator('#party-hud .party-leader').count(),1);
    assert.equal(await first.page.locator('#hud-health-text').textContent(),'203 / 203','200 + 1.5% is exactly 203, without floating-point under-rounding');
    await first.page.locator('#player-menu-toggle').click();await first.page.locator('[data-window="social"]').click();
    assert.equal(await first.page.locator('#social-tab-1').getAttribute('aria-selected'),'true');
    assert.equal(await first.page.locator('.party-panel-content .party-member').count(),2);
    assert.equal(await first.page.locator('.party-roster .party-vacant').count(),1);
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'party-social-two.png')});
    const invitationField=first.page.locator('.party-invite-input');
    await invitationField.fill('draft_account');await invitationField.focus();
    await first.page.waitForTimeout(2300);
    assert.equal(await invitationField.inputValue(),'draft_account','Group polling preserves the invitation draft');
    assert.equal(await invitationField.evaluate(el=>el===document.activeElement),true,'Group polling preserves focus');
    assert.equal(await first.page.locator('.party-bonus').getAttribute('aria-label'),'Bonificación: +2% experiencia · +1.5% vida y recurso máximos');
    assert.deepEqual(await first.page.locator('.party-bonus-seal strong').allTextContents(),['+2%','+1.5%']);
    for(const [player,account] of [[third,accounts[2]],[fourth,accounts[3]]]){
      await groupInvite(first.page,account.character.name);
      await player.page.waitForFunction(()=>document.querySelector('#player-menu-toggle').classList.contains('has-party-invite'));
      await groupTab(player.page);
      await player.page.locator('.party-invitation').getByRole('button',{name:'Aceptar',exact:true}).click();
      await player.page.locator('#window-close').click();
    }
    await first.page.waitForFunction(()=>document.querySelectorAll('.party-panel-content .party-member').length===4);
    assert.equal(await first.page.locator('.party-invite-input').count(),0);
    assert.equal(await first.page.locator('.party-bonus').getAttribute('aria-label'),'Bonificación: +2% experiencia · +4.5% vida y recurso máximos');
    assert.deepEqual(await first.page.locator('.party-bonus-seal strong').allTextContents(),['+2%','+4.5%']);
    assert.equal(await first.page.locator('.party-seats .filled').count(),4);
    assert.equal(await first.page.locator('.party-roster .party-member-role').count(),4);
    assert.equal(await first.page.locator('.party-roster .is-leader').count(),1);
    assert.equal(await first.page.locator('#hud-health-text').textContent(),'209 / 209');
    for(const width of [320,390,1280]){
      await first.page.setViewportSize({width,height:844});
      assert.ok(await first.page.locator('#social-group-panel').evaluate(el=>el.scrollWidth<=el.clientWidth && [...el.querySelectorAll('input,button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
      const columns=await first.page.locator('.party-roster').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width>600?2:1,'Roster uses paired cards on desktop, stacked on mobile');
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`party-social-${width}.png`)});
    }
    await first.page.setViewportSize({width:1280,height:800});await first.page.locator('#window-close').click();
    assert.equal(await first.page.locator('#party-hud .party-member').count(),3);
    for(const width of [320,1280]){
      await first.page.setViewportSize({width,height:844});
      assert.ok(await first.page.locator('#party-hud').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth;}));
      for(const card of await first.page.locator('#party-hud .party-member').all()) {
        const box=await card.boundingBox();
        assert.ok(box.width<=(width===320?150:174) && box.height<=44,'Party HUD cards remain significantly smaller than the player HUD');
        assert.equal(await card.getByRole('meter').count(),2,'Compact cards retain both live vitals');
      }
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`party-hud-${width}.png`)});
    }
    const pixels=await first.page.locator('.minimap-canvas').evaluate(canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let found=0;for(let i=0;i<data.length;i+=4)if(data[i]===121&&data[i+1]===215&&data[i+2]===250)found++;return found;
    });
    assert.ok(pixels>0,'Party member markers are rendered cyan on the actual minimap');
    const outsiderMessages=[];world.chatSockets.set('outsider',row=>outsiderMessages.push(row));
    await chatReady(world,accounts[0]);await chatReady(world,accounts[1]);
    await first.page.keyboard.press('Enter');await first.page.locator('.chat-input').fill('/p Adventure together');await first.page.locator('.chat-input').press('Enter');
    await second.page.locator('.chat-log .k-party').filter({hasText:'Adventure together'}).waitFor();
    assert.equal(outsiderMessages.length,0);
    assert.equal(await second.page.locator('.speech-bubble').filter({hasText:'Adventure together'}).count(),0);
    await first.page.locator('.chat-filter[data-kind="party"]').click();
    assert.equal(await first.page.locator('.chat-log .k-party').count(),0);
    await first.page.locator('.chat-filter[data-kind="party"]').click();
    assert.equal(await first.page.locator('.chat-channel').textContent(),'Grupo');
    await first.page.locator('.chat-input').fill('Group tab works');
    await first.page.locator('.chat-input').press('Enter');
    await second.page.locator('.chat-log .k-party').filter({hasText:'Group tab works'}).waitFor();
    assert.equal(outsiderMessages.length,0);
    await second.page.locator('#player-menu-toggle').click();
    await second.page.locator('[data-window="sheet"]').click();
    await second.page.waitForFunction(()=>document.querySelector('.sheet-bars .sheet-bar .track span')?.textContent==='104 / 104');
    assert.equal(await second.page.locator('.sheet-bars .sheet-bar').first().locator('.track span').textContent(),'104 / 104');
    await first.page.locator('.chat-input').blur();
    await groupTab(first.page);await first.page.getByRole('button',{name:'Salir del grupo',exact:true}).click();
    await first.page.waitForFunction(()=>document.querySelectorAll('#party-hud .party-member').length===0);
    await second.page.waitForFunction(()=>!document.querySelector('#hud-party-leader').hidden);
    await second.page.waitForFunction(()=>document.querySelector('.sheet-bars .sheet-bar .track span')?.textContent==='103 / 103');
    await second.page.locator('#window-close').click();
    await groupTab(second.page);
    assert.equal(await second.page.locator('.party-panel-content .party-member').first().getAttribute('data-user-id'),accounts[1].user.id);
    assert.equal(await second.page.locator('.party-invite-input').count(),1,'New leader can invite');
    await second.page.locator('#window-close').click();
    await leave(second.page);
    await third.page.waitForFunction(()=>!document.querySelector('#hud-party-leader').hidden);
    await first.page.keyboard.press('Enter');await first.page.locator('.chat-input').fill('/p Cannot send after leaving');await first.page.locator('.chat-input').press('Enter');
    await first.page.locator('.chat-line.error').filter({hasText:'No perteneces a un grupo.'}).waitFor();
    for(const player of players)assert.deepEqual(player.errors,[]);
  }finally{for(const player of players)await player.context.close();}
});

test('closing Social during a delayed refresh cannot populate a different window', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4);
  const player = await openPlayer(world,a);
  try {
    await player.enter();
    world.rpcDelay.set('friends_list',1500);
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="social"]').click();
    await player.page.locator('#window-close').click();
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="sheet"]').click();
    await player.page.waitForTimeout(1800);
    assert.equal(await player.page.locator('.social-window').count(),0);
    assert.equal(await player.page.locator('.sheet-name-row strong').textContent(),'Alric');
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('nearby player carousel supports keyboard friend actions, reversible mute and account whispers', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  b.username = 'ElaraAccount';
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await nearbyInteractions(first.page,'Elara');
    assert.equal(await first.page.locator('.player-interaction-header').textContent(),'Elara');
    for (const width of [320,390]) {
      await first.page.setViewportSize({width,height:844});
      const box = await first.page.locator('#player-interactions').boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width,'Player interaction fits a narrow viewport');
      for (const button of await first.page.locator('#player-interactions button').all()) {
        const bounds = await button.boundingBox();
        assert.ok(bounds && bounds.x >= box.x && bounds.x + bounds.width <= box.x + box.width,'Each interaction button fits inside its panel');
      }
    }
    assert.equal(await first.page.locator('.player-interaction-medallion svg[viewBox="0 0 48 48"]').count(),5);
    assert.equal(await first.page.locator('.player-interaction-label').textContent(),'Añadir amigo');
    assert.equal(await first.page.locator('#player-interactions').getAttribute('aria-busy'),'false');
    assert.equal(await first.page.locator('#player-interaction-name').textContent(),'Elara');
    assert.equal(await first.page.locator('#player-interactions .player-interaction-action').count(),5);
    assert.equal(await first.page.getByRole('button',{name:'Invitar a grupo',exact:true}).count(),1);
    await first.page.keyboard.press('ArrowLeft');
    await first.page.keyboard.press('ArrowLeft');
    await first.page.keyboard.press('ArrowLeft');
    assert.equal(await first.page.locator('.player-interaction-label').textContent(),'Silenciar chat');
    assert.equal(await first.page.locator('.player-interaction-action[aria-pressed="true"]').getAttribute('aria-label'),'Silenciar chat');
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Reactivar chat',exact:true}).waitFor();
    assert.deepEqual(await first.page.evaluate(()=>JSON.parse(localStorage.getItem('brumaluz-chat-ignored'))),['elaraaccount']);
    await first.page.keyboard.press('Enter');
    await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).waitFor();
    assert.deepEqual(await first.page.evaluate(()=>JSON.parse(localStorage.getItem('brumaluz-chat-ignored'))),[]);
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Cancelar solicitud',exact:true}).waitFor();
    assert.equal(world.friends.size,1);
    await nearbyInteractions(second.page,'Alric');
    await second.page.getByRole('button',{name:'Aceptar solicitud',exact:true}).click();
    await second.page.getByRole('button',{name:'Eliminar amigo',exact:true}).waitFor();
    assert.equal(await second.page.getByRole('button',{name:'Silenciar chat',exact:true}).count(),0);
    await first.page.getByRole('button',{name:'Cancelar solicitud',exact:true}).click();
    await first.page.getByRole('button',{name:'Eliminar amigo',exact:true}).waitFor();
    assert.equal(world.friends.size,1,'A stale cancel action must not remove a newly accepted friend');
    assert.equal(await first.page.locator('.player-interaction-action').count(),4);
    first.page.once('dialog',dialog=>dialog.accept());
    await first.page.getByRole('button',{name:'Eliminar amigo',exact:true}).click();
    await first.page.getByRole('button',{name:'Añadir amigo',exact:true}).waitFor();
    assert.equal(await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).count(),1);
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('KeyE');
    assert.equal(await first.page.locator('#player-interactions').isVisible(),false);
    assert.equal(await first.page.locator('.chat-input').inputValue(),'/w ~ElaraAccount ');
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('player interaction closes when its target leaves range and ignores late account lookups', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await nearbyInteractions(first.page,'Elara');
    await second.page.evaluate(()=>window.brumaluz.move(110,-11.085));
    await first.page.locator('#player-interactions').waitFor({state:'hidden'});
    await second.page.evaluate(()=>window.brumaluz.move(101,-11.085));
    await first.page.locator('#interact-label').filter({hasText:/^Interactuar$/}).waitFor();
    world.rpcDelay.set('friends_list',1500);
    await first.page.keyboard.press('KeyE');
    await first.page.locator('#player-interactions').waitFor({state:'visible'});
    await first.page.keyboard.press('Escape');
    await first.page.waitForTimeout(1800);
    assert.equal(await first.page.locator('#player-interactions').isVisible(),false);
    assert.equal(await first.page.locator('.player-interaction-action').count(),0);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('nearby player mute persists after reload and filters public messages, whispers and speech bubbles', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).click();
    await first.page.getByRole('button',{name:'Reactivar chat',exact:true}).waitFor();
    await leave(first.page);
    const message = {zone:null,sender_user:b.user.id,sender_name:'Elara',sender_account:'Elara',sender_title:'recien_llegado',recipient_user:null,recipient_name:null,created_at:new Date().toISOString()};
    world.history = [
      {...message,id:3,channel:'general',sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',body:'History loaded'},
      {...message,id:2,channel:'whisper',recipient_user:a.user.id,recipient_name:'Alric',body:'Muted whisper'},
      {...message,id:1,channel:'general',body:'Muted public message'},
    ];
    await first.page.reload();
    await first.enter();
    await first.page.waitForFunction(() => document.body.classList.contains('playing'));
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...message,id:4,channel:'general',body:'Muted public message'});
    world.chatSockets.get(a.user.id)({...message,id:5,channel:'whisper',recipient_user:a.user.id,recipient_name:'Alric',body:'Muted whisper'});
    world.chatSockets.get(a.user.id)({...message,id:6,channel:'general',sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',body:'Live message loaded'});
    await first.page.locator('.chat-log').getByText('Live message loaded',{exact:true}).waitFor();
    assert.doesNotMatch(await first.page.locator('.chat-log').textContent(),/History loaded/);
    assert.doesNotMatch(await first.page.locator('.chat-log').textContent(),/Muted whisper|Muted public message/);
    assert.equal(await first.page.locator('.speech-bubble').filter({hasText:'Muted public message'}).count(),0);
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Reactivar chat',exact:true}).click();
    await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).waitFor();
    await leave(first.page);
    await first.enter();
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...message,id:7,channel:'general',body:'Muted public message'});
    world.chatSockets.get(a.user.id)({...message,id:8,channel:'whisper',recipient_user:a.user.id,recipient_name:'Alric',body:'Muted whisper'});
    await first.page.locator('.chat-log').getByText('Muted public message',{exact:true}).waitFor();
    await first.page.locator('.chat-log').getByText('Muted whisper',{exact:true}).waitFor();
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});
