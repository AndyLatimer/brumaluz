// Pruebas del mundo en el navegador: Amigos, menús, gráficos, mochila y chat.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, fixture, backend, leave, chatReady, revealChat, social, socialRequest } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('friend requests notify outside Social, mark both menu levels and announce acceptance; Group offers invitations', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    assert.equal(await first.page.locator('#game-menu-toggle .menu-key').textContent(),'Esc');
    assert.equal(await first.page.locator('#player-menu-toggle .menu-key').textContent(),'Tab');
    await social(first.page);
    await socialRequest(first.page,'Elara');
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor();
    await first.page.locator('#window-close').click();
    await second.page.locator('.friend-notification').filter({hasText:'~Alric te ha enviado una solicitud de amistad.'}).waitFor({timeout:15000});
    await second.page.locator('.friend-request-badge').waitFor({state:'visible'});
    assert.equal(await second.page.locator('[data-window="social"]').getAttribute('class').then(value=>value.includes('has-friend-requests')),true);
    assert.equal(await second.page.locator('#window-backdrop').isVisible(),false);
    await social(second.page);
    assert.equal(await second.page.locator('[data-social="incoming"] .class-icon').count(),0);
    assert.equal(await second.page.locator('[data-social="incoming"] .social-avatar').textContent(),'');
    assert.deepEqual(await second.page.locator('.social-stat strong').allTextContents(),['0','1']);
    await second.page.getByRole('tab',{name:'Grupo',exact:true}).click();
    await second.page.getByText('Comienza una aventura en grupo',{exact:true}).waitFor();
    assert.equal(await second.page.locator('#social-friends-panel').isVisible(),false);
    await second.page.keyboard.press('ArrowLeft');
    assert.equal(await second.page.getByRole('tab',{name:'Amigos',exact:true}).getAttribute('aria-selected'),'true');
    await second.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await second.page.locator('[data-social="friend"] .social-row').waitFor();
    await second.page.locator('.friend-request-badge').waitFor({state:'hidden'});
    assert.equal(await second.page.locator('[data-window="social"]').getAttribute('class').then(value=>value.includes('has-friend-requests')),false);
    await first.page.locator('.friend-notification').filter({hasText:'~Elara ha aceptado tu solicitud de amistad.'}).waitFor({timeout:15000});
    await first.page.locator('.chat-log').getByText('~Elara ha aceptado tu solicitud de amistad.',{exact:true}).waitFor();
    const notices = await first.page.locator('.chat-log').getByText('~Elara ha aceptado tu solicitud de amistad.',{exact:true}).count();
    await first.page.waitForTimeout(5500);
    assert.equal(await first.page.locator('.chat-log').getByText('~Elara ha aceptado tu solicitud de amistad.',{exact:true}).count(),notices);
    await leave(first.page);
    assert.equal(await first.page.locator('.friend-notification').count(),0);
    assert.equal(await first.page.locator('.friend-request-badge').count(),0);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('periodic Social refresh preserves controls, focused input and unchanged friend cards without flickering', {timeout:120000}, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  world.friends.set([a.user.id,b.user.id].sort().join(':'),{from:a.user.id,to:b.user.id,accepted:true});
  try {
    await first.enter(); await second.enter();
    await social(first.page);
    await first.page.locator('.social-online').waitFor();
    await first.page.locator('#social-username').fill('DraftName');
    await first.page.locator('#social-username').focus();
    world.rpcDelay.set('friends_list',600);
    await first.page.evaluate(()=>{
      const row=document.querySelector('.social-row');
      row.dataset.retained='true';
      const root=document.querySelector('.social-window');
      root.dataset.disableChanges='0';
      new MutationObserver(records=>{
        const count=records.filter(record=>record.attributeName==='disabled').length;
        root.dataset.disableChanges=String(Number(root.dataset.disableChanges)+count);
      }).observe(root,{subtree:true,attributes:true,attributeFilter:['disabled']});
    });
    await first.page.waitForTimeout(6200);
    assert.equal(await first.page.locator('.social-row').getAttribute('data-retained'),'true');
    assert.equal(await first.page.locator('.social-window').getAttribute('data-disable-changes'),'0');
    assert.equal(await first.page.locator('#social-username').inputValue(),'DraftName');
    assert.equal(await first.page.locator('#social-username').evaluate(el=>el===document.activeElement),true);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('menus hide the action bar except Inventory and chat can be revealed by hover without restoring old history', {timeout:120000}, async () => {
  const world = backend(), a = fixture('Alric','humano',100);
  world.history=[{id:1,channel:'general',zone:null,sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',sender_title:'recien_llegado',recipient_user:null,recipient_name:null,created_at:new Date().toISOString(),body:'Old server history'}];
  const player=await openPlayer(world,a);
  let historyRequests=0;
  player.page.on('request',request=>{if(new URL(request.url()).pathname==='/rest/v1/chat_messages')historyRequests++;});
  try {
    await player.enter();
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...world.history[0],id:2,body:'First connection message'});
    await player.page.locator('.chat-log').getByText('First connection message',{exact:true}).waitFor();
    assert.doesNotMatch(await player.page.locator('.chat-log').textContent(),/Old server history/);
    for(const menu of ['#game-menu-toggle','#player-menu-toggle']){
      await player.page.locator(menu).click();
      assert.equal(await player.page.locator('#action-bar').isVisible(),false);
      assert.equal(await player.page.locator('#minimap').isVisible(),false);
      assert.equal(await player.page.locator('#chat').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
      await player.page.locator(menu).click();
    }
    await social(player.page);
    assert.equal(await player.page.locator('#action-bar').isVisible(),false);
    const chatBox=await player.page.locator('#chat').boundingBox();
    await player.page.mouse.move(chatBox.x+chatBox.width-10,chatBox.y+10);
    assert.equal(await player.page.locator('#chat').evaluate(el=>el.classList.contains('hover-revealed')),false);
    await revealChat(player.page);
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='1');
    assert.equal(await player.page.locator('#chat').evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
    await player.page.mouse.move(5,5);
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='0');
    await player.page.locator('#window-close').click();
    await player.page.keyboard.press('KeyI');
    assert.equal(await player.page.locator('#action-bar').isVisible(),true);
    await player.page.keyboard.press('Escape');
    await player.page.keyboard.press('KeyC');
    assert.equal(await player.page.locator('#action-bar').isVisible(),false);
    await player.page.keyboard.press('Escape');
    await player.page.keyboard.press('KeyO');
    assert.equal(await player.page.locator('#action-bar').isVisible(),false);
    await player.page.keyboard.press('Escape');
    assert.equal(await player.page.locator('#action-bar').isVisible(),true);
    await player.page.locator('#chat').evaluate(el=>el.classList.add('faded'));
    await revealChat(player.page);
    await player.page.waitForFunction(()=>!document.querySelector('#chat').classList.contains('faded'));
    const scrollbar=await player.page.locator('.chat-log').evaluate(el=>getComputedStyle(el).scrollbarColor);
    assert.equal(scrollbar,'rgb(185, 148, 90) rgb(40, 26, 16)');
    await player.page.mouse.move(5,5);
    await leave(player.page);
    assert.doesNotMatch(await player.page.locator('.chat-log').textContent(),/First connection message/);
    world.history.unshift({...world.history[0],id:3,body:'Message while disconnected'});
    await player.enter();
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...world.history[0],id:4,body:'Second connection message'});
    await player.page.locator('.chat-log').getByText('Second connection message',{exact:true}).waitFor();
    assert.doesNotMatch(await player.page.locator('.chat-log').textContent(),/Old server history|First connection message|Message while disconnected/);
    assert.equal(historyRequests,0);
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('video graphics selector shares access mode and reloads in both directions', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await player.enter();
    await page.keyboard.press('KeyO');
    const button = page.locator('#opt-graphics-mode');
    assert.equal(await button.textContent(), 'Gráficos: compatible');
    assert.equal(await button.textContent(), await page.locator('#graphics-mode').textContent());
    await page.locator('#options-backdrop [data-language="en"]').click();
    assert.equal(await button.textContent(), 'Graphics: compatibility');
    assert.match(await page.locator('[data-pane="video"] .options-hint').textContent(), /reloads the game/);
    await Promise.all([page.waitForURL(url => !url.searchParams.has('graphics')), button.click()]);
    await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#graphics-mode').textContent(), 'Gráficos: normal');
    await player.enter();
    await page.keyboard.press('KeyO');
    assert.equal(await button.textContent(), 'Gráficos: normal');
    await Promise.all([page.waitForURL(url => url.searchParams.get('graphics') === 'compatible'), button.click()]);
    await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#graphics-mode').textContent(), 'Gráficos: compatible');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory drag moves and swaps complete stacks persistently without using or merging items', {timeout:120000},async()=>{
  const world=backend(),a=fixture('Alric','humano',100);
  a.character.data.inventory=[{id:'pan_duro',count:4,bound:true},{id:'pan_duro',count:7},{id:'pocion_vida_minuscula',count:3}];
  const player=await openPlayer(world,a),page=player.page;
  let requests=0,failMove=false;
  await page.route('**/rest/v1/rpc/move_inventory_item',async route=>{
    const args=route.request().postDataJSON(),inv=a.character.data.inventory;
    assert.equal(args.p_character_id,a.character.id);
    assert.deepEqual(args.p_expected_from,inv[args.p_from]);
    assert.deepEqual(args.p_expected_to,inv[args.p_to]??null);
    if(failMove) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'INVENTORY_CHANGED'})});
    [inv[args.p_from],inv[args.p_to]]=[inv[args.p_to]??null,inv[args.p_from]];
    requests++;
    await route.fulfill({contentType:'application/json',body:JSON.stringify(a.character.data)});
  });
  try {
    await player.enter();await page.keyboard.press('KeyI');
    const slot=i=>page.locator(`.inv-grid [data-index="${i}"]`);
    await slot(0).dragTo(page.locator('.ab-slot').first());
    assert.equal(await page.locator('.ab-slot').first().getAttribute('data-item-id'),'pan_duro');
    await slot(0).dragTo(slot(10));
    await page.waitForFunction(()=>document.querySelector('.inv-grid [data-index="10"]')?.dataset.itemId==='pan_duro');
    assert.equal(await slot(0).getAttribute('data-item-id'),null);
    assert.equal(await slot(10).getAttribute('data-item-bound'),'true');
    await slot(10).dragTo(slot(1));
    await page.waitForFunction(()=>document.querySelector('.inv-grid [data-index="1"]')?.dataset.itemBound==='true');
    assert.equal(await slot(1).locator('i').textContent(),'4');
    assert.equal(await slot(10).locator('i').textContent(),'7');
    await slot(2).dragTo(slot(1));
    await page.waitForFunction(()=>document.querySelector('.inv-grid [data-index="1"]')?.dataset.itemId==='pocion_vida_minuscula');
    assert.equal(await slot(2).getAttribute('data-item-bound'),'true');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'inventory-reordered.png')});
    assert.equal(requests,3);
    assert.equal(a.character.data.inventory.filter(Boolean).reduce((n,s)=>n+s.count,0),14);
    failMove=true;
    await slot(1).dragTo(slot(3));
    await page.locator('#toast').filter({hasText:'Tu mochila ha cambiado. Vuelve a mover el objeto.'}).waitFor({state:'visible'});
    assert.equal(await slot(1).getAttribute('data-item-id'),'pocion_vida_minuscula');
    assert.equal(await slot(3).getAttribute('data-item-id'),null);
    await page.reload();
    await page.locator('.character-card .btn.gold').first().waitFor();await player.enter();
    await page.keyboard.press('KeyI');
    assert.equal(await slot(1).getAttribute('data-item-id'),'pocion_vida_minuscula');
    assert.equal(await slot(10).locator('i').textContent(),'7');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('default chat width follows the action bar while manual size persists', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await page.evaluate(()=>localStorage.setItem('brumaluz-chat-size',JSON.stringify({w:354,h:210})));
    await page.reload();
    await page.locator('.character-card .btn.gold').first().waitFor();
    await player.enter();
    for (const width of [1200, 1280, 1490, 1920, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const bar = document.querySelector('#action-bar').getBoundingClientRect();
        const chat = document.querySelector('#chat').getBoundingClientRect();
        return Math.abs(chat.left - bar.right - 12) <= 1 && Math.abs(chat.right - innerWidth + 12) <= 1
          && Math.abs(chat.bottom - bar.bottom) <= 1;
      });
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('brumaluz-chat-size')).w),354,'Legacy width does not prevent automatic layout');
      if(width===1490 && process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'chat-default-1490.png')});
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const chat = document.querySelector('#chat').getBoundingClientRect();
      return chat.left >= 0 && chat.right <= innerWidth && chat.width >= 250;
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    const handle = await page.locator('.chat-resize').boundingBox();
    await page.mouse.move(handle.x + 7, handle.y + 7);
    await page.mouse.down();
    await page.mouse.move(handle.x - 73, handle.y - 33, { steps: 5 });
    await page.mouse.up();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('brumaluz-chat-size')));
    assert.equal(stored.version,2);
    assert.ok(stored.w > 300);
    await page.setViewportSize({ width: 1920, height: 900 });
    assert.equal(Math.round((await page.locator('#chat').boundingBox()).width), Math.round(stored.w));
    await page.reload();
    await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 30000 });
    await player.enter();
    assert.equal(Math.round((await page.locator('#chat').boundingBox()).width), Math.round(stored.w));
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('chat corner button waits until opacity finishes fading, and hides again on new messages', {timeout:120000},async()=>{
  const world=backend(),a=fixture('Alric','humano',100),player=await openPlayer(world,a),page=player.page;
  try {
    await player.enter();await chatReady(world,a);
    await page.mouse.move(0,0);
    await page.waitForTimeout(200);
    await page.locator('#chat').evaluate(el=>el.classList.add('faded'));
    await page.waitForTimeout(1500);
    const opacity=await page.locator('#chat').evaluate(el=>Number(getComputedStyle(el).opacity));
    assert.ok(opacity>0 && opacity<.82,'Chat is still fading');
    assert.equal(await page.locator('.chat-peek').isVisible(),false,'Button does not precede the end of the fade');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'chat-fading-no-button.png')});
    await page.locator('.chat-peek').waitFor({state:'visible'});
    assert.equal(await page.locator('#chat').evaluate(el=>Number(getComputedStyle(el).opacity)),0);
    world.chatSockets.get(a.user.id)({id:9991,channel:'general',sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',sender_title:'recien_llegado',created_at:new Date().toISOString(),body:'Wake the chat'});
    await page.locator('.chat-log').getByText('Wake the chat',{exact:true}).waitFor();
    await page.locator('.chat-peek').waitFor({state:'hidden'});
    await page.locator('#game-menu-toggle').click();
    await page.locator('.chat-peek').waitFor({state:'visible'});
    assert.equal(await page.locator('#chat').evaluate(el=>Number(getComputedStyle(el).opacity)),0);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('chat minimizes into a bottom tab, restores size, and corner preview stays temporary', {timeout:120000}, async()=>{
  const world=backend(), a=fixture('Alric','humano',100), player=await openPlayer(world,a);
  try {
    await player.enter();
    const expanded=await player.page.locator('#chat').boundingBox();
    await player.page.getByRole('button',{name:'Minimizar chat',exact:true}).click();
    const minimized=await player.page.locator('#chat').boundingBox();
    const iconCentered=await player.page.locator('.chat-collapse').evaluate(button=>{
      const bounds=button.getBoundingClientRect(), icon=button.querySelector('i').getBoundingClientRect();
      return Math.abs(bounds.left+bounds.right-icon.left-icon.right)<1 && Math.abs(bounds.top+bounds.bottom-icon.top-icon.bottom)<1;
    });
    assert.equal(iconCentered,true,'Restore icon must be centered in its button');
    assert.ok(minimized.height<=40 && minimized.width<=120);
    assert.equal(Math.round(minimized.y+minimized.height),788);
    assert.equal(await player.page.locator('.chat-log').isVisible(),false);
    await player.page.getByRole('button',{name:'Abrir chat',exact:true}).click();
    assert.equal((await player.page.locator('#chat').boundingBox()).height,expanded.height);
    await player.page.getByRole('button',{name:'Minimizar chat',exact:true}).click();
    await social(player.page);
    await revealChat(player.page);
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='1');
    assert.equal(await player.page.locator('.chat-log').isVisible(),true);
    const revealed=await player.page.locator('#chat').boundingBox();
    assert.equal(Math.round(revealed.y+revealed.height),788,'Chat revealed over an open window keeps its normal bottom position');
    await player.page.locator('.chat-input').fill('Draft');
    await player.page.mouse.move(5,5);
    assert.equal(await player.page.locator('#chat').evaluate(el=>getComputedStyle(el).opacity),'1');
    await player.page.locator('.chat-input').press('Escape');
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='0');
    await player.page.locator('#window-close').click();
    assert.equal((await player.page.locator('#chat').boundingBox()).height,minimized.height);
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});
