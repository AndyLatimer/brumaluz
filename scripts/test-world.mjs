import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4175';
const project = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
let server, browser;
before(async () => {
  assert.ok(project, 'Build with the public Supabase configuration before running browser tests');
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort']);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview server did not start')), 15000);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Preview server exited: ${code}`)));
    server.stdout.on('data', (data) => {
      if (stripVTControlCharacters(data.toString()).includes(url)) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', (data) => process.stderr.write(data));
  });
  assert.equal((await fetch(url)).status, 200);
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
});

function fixture(name, race, x) {
  const userId = randomUUID(), characterId = randomUUID();
  const user = { id: userId, email: `${name}@example.test`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const data = { name, race, cls: 'guerrero', title: 'recien_llegado', level: 1, health: -1, position: { x, z: -11.085, yaw: 0 }, attributePoints: { fuerza: 2 } };
  return { user, character: { id: characterId, user_id: userId, name, data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } };
}
function backend() {
  return { players: new Map(), accounts: new Map(), friends: new Map(), history: [], chatSockets: new Map(), fail: new Set(), delay: new Map(), rpcDelay: new Map(), logoutFails: false, counts: new Map(), maximum: new Map(), active: new Map() };
}
async function openPlayer(world, account, compatible = true) {
  world.accounts.set(account.user.id, account);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.routeWebSocket(/supabase\.co/, (socket) => {
    socket.onMessage((raw) => {
      const frame = JSON.parse(raw.toString());
      const array = Array.isArray(frame);
      const [joinRef, ref, topic, event, payload] = array ? frame : [frame.join_ref,frame.ref,frame.topic,frame.event,frame.payload];
      const send = (event, payload) => socket.send(JSON.stringify(array ? [joinRef,ref,topic,event,payload] : {join_ref:joinRef,ref,topic,event,payload}));
      if (event === 'phx_join') {
        send('phx_reply',{status:'ok',response:{postgres_changes:(payload.config?.postgres_changes || []).map((filter)=>({...filter,id:1}))}});
        world.chatSockets.set(account.user.id,(row) => send('postgres_changes',{ids:[1],data:{schema:'public',table:'chat_messages',type:'INSERT',commit_timestamp:row.created_at,columns:[],record:row,errors:null}}));
      } else if (event === 'phx_leave') {
        world.chatSockets.delete(account.user.id);
        send('phx_reply',{status:'ok',response:{}});
      } else if (event === 'heartbeat') send('phx_reply',{status:'ok',response:{}});
    });
    socket.onClose(() => world.chatSockets.delete(account.user.id));
  });
  await context.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/v1/logout' && world.logoutFails) return fulfill({ msg: 'Logout temporarily unavailable' }, 500);
    if (path.startsWith('/auth/v1/')) return fulfill(account.user);
    if (path === '/rest/v1/profiles') {
      const userId = new URL(request.url()).searchParams.get('user_id')?.replace(/^eq\./,'');
      const target = userId ? world.accounts.get(userId) : account;
      return fulfill(target ? { username: target.username || target.character.name } : null);
    }
    if (path === '/rest/v1/characters') return fulfill(account.characters || [account.character]);
    if (path === '/rest/v1/chat_messages') return fulfill(world.history);
    const fn = path.split('/').at(-1);
    const args = request.postDataJSON() || {};
    const character = (account.characters || [account.character]).find((c) => c.id === args.p_character_id) || account.character;
    const data = { ...character.data };
    if (world.rpcDelay.has(fn)) await new Promise((resolve) => setTimeout(resolve, world.rpcDelay.get(fn)));
    if (fn === 'character_enter') return fulfill(data);
    if (fn === 'create_character') return fulfill(randomUUID());
    if (fn === 'set_character_title') { character.data.title = args.p_title; return fulfill({ ...data, title: args.p_title }); }
    if (fn === 'my_titles') return fulfill(account.titles || []);
    const key = account.user.id;
    if (fn === 'friends_list') {
      const entries = [];
      for (const relation of world.friends.values()) {
        if (![relation.from, relation.to].includes(key)) continue;
        const target = world.accounts.get(relation.from === key ? relation.to : relation.from);
        const player = relation.accepted ? world.players.get(target.user.id) : null;
        entries.push({ userId: target.user.id, username: target.username || target.character.name, status: relation.accepted ? 'friend' : relation.from === key ? 'outgoing' : 'incoming', online: !!player, characterName: player?.data.name || null, characterClass: player?.data.cls || null, location: player ? 'brumaluz' : null });
      }
      return fulfill(entries);
    }
    if (fn === 'friend_request') {
      const target = [...world.accounts.values()].find((a) => (a.username || a.character.name).toLowerCase() === args.p_username.toLowerCase());
      if (!target) return fulfill({message:'PLAYER_NOT_FOUND'},400);
      if (target.user.id === key) return fulfill({message:'FRIEND_SELF'},400);
      const pair = [key,target.user.id].sort().join(':');
      if (world.friends.has(pair)) return fulfill({message:'FRIEND_ALREADY_EXISTS'},400);
      world.friends.set(pair,{from:key,to:target.user.id,accepted:false});
      return route.fulfill({status:204});
    }
    if (fn === 'friend_update') {
      const pair = [key,args.p_user_id].sort().join(':');
      if (args.p_action === 'accept') world.friends.get(pair).accepted = true;
      else world.friends.delete(pair);
      return route.fulfill({status:204});
    }
    if (fn === 'world_leave') {
      if (world.players.get(key)?.session === args.p_session_id) world.players.delete(key);
      return route.fulfill({ status: 204 });
    }
    if (!['world_join', 'world_sync'].includes(fn)) return fulfill({ message: `Unexpected test RPC: ${fn}` }, 500);
    if (world.fail.has(key)) return fulfill({ message: 'Temporary connection failure' }, 503);
    let player = world.players.get(key);
    if (fn === 'world_join') {
      player = { id: character.id, userId: key, session: args.p_session_id, data: character.data, position: { ...character.data.position }, facing: Math.PI, jump: 0, wave: 0, dead: false };
      world.players.set(key, player);
    } else if (!player || player.session !== args.p_session_id) return fulfill({ message: 'WORLD_SESSION_REPLACED' }, 400);
    world.counts.set(key, (world.counts.get(key) || 0) + 1);
    world.active.set(key, (world.active.get(key) || 0) + 1);
    world.maximum.set(key, Math.max(world.maximum.get(key) || 0, world.active.get(key)));
    let status = 'ok';
    if (fn === 'world_sync') {
      const motion = args.p_state;
      if (Math.hypot(motion.x - player.position.x, motion.z - player.position.z) > 20) status = 'corrected';
      else { player.position = { x: motion.x, z: motion.z, yaw: motion.yaw }; player.facing = motion.facing; player.jump = motion.jump; player.wave = motion.wave; }
    }
    const response = { status, position: { ...player.position }, players: [...world.players.values()].filter((p) => p.userId !== key).map((p) => ({ ...p, position: { ...p.position } })) };
    if (world.delay.has(key)) await new Promise((resolve) => setTimeout(resolve, world.delay.get(key)));
    world.active.set(key, world.active.get(key) - 1);
    return fulfill(response);
  });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: account.user.id, exp })).toString('base64url')}.test-signature`;
  await page.addInitScript(({ project, jwt, exp, user }) => {
    localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }));
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  }, { project, jwt, exp, user: account.user });
  await page.goto(`${url}/${compatible ? '?graphics=compatible' : ''}`);
  await page.waitForFunction(() => !!window.brumaluz, { timeout: 90000 });
  await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 30000 });
  return { context, page, errors, async enter() {
    await page.locator('.character-card .btn.gold').first().click();
    await page.waitForFunction(() => document.body.classList.contains('playing'));
  } };
}
async function remote(page, id) {
  await page.waitForFunction((id) => window.brumaluz.players().some((p) => p.id === id), id);
}
async function leave(page) {
  await page.locator('#game-menu-toggle').click();
  await page.locator('#game-menu-characters').click();
  await page.waitForFunction(() => !document.body.classList.contains('playing'));
  await page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
}
async function chatReady(world, player) {
  for (let attempt = 0; attempt < 100 && !world.chatSockets.has(player.user.id); attempt++) await new Promise(resolve=>setTimeout(resolve,50));
  assert.ok(world.chatSockets.has(player.user.id),'Mock live chat subscription must be ready');
}

test('independent accounts see real remote models, appearance, names, movement and departure in both graphics modes', { timeout: 240000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), b = fixture('Elara', 'elfo', -5.4);
  const first = await openPlayer(world, a, false);
  const second = await openPlayer(world, b);
  try {
    await first.enter();
    await second.enter();
    await remote(first.page, b.character.id);
    await remote(second.page, a.character.id);
    assert.equal(await first.page.locator('#multiplayer-status').count(), 0);
    assert.equal(await first.page.locator('.minimap-player-count').textContent(), '2');
    assert.equal(await first.page.locator('.minimap-players').getAttribute('aria-label'), '2 jugadores en este mapa');
    assert.equal(await first.page.locator(`[data-player-id="${b.character.id}"] strong`).textContent(), 'Elara');
    assert.equal(await first.page.locator(`[data-player-id="${b.character.id}"]`).isVisible(), true);
    assert.equal(await second.page.locator(`[data-player-id="${a.character.id}"]`).isVisible(), true);
    assert.match(await second.page.locator(`[data-player-id="${a.character.id}"]`).textContent(), /Recién llegado/);
    const geometry = await first.page.evaluate(() => {
      const root = window.brumaluz.players()[0].root;
      let meshes = 0;
      root.traverse((object) => { if (object.isMesh && object.visible) meshes++; });
      return { meshes, attached: !!root.parent, visible: root.visible };
    });

    assert.ok(geometry.meshes > 2 && geometry.attached && geometry.visible, JSON.stringify(geometry));
    assert.equal(await first.page.locator('#graphics-error').isVisible(), false);
    assert.equal(await second.page.locator('#graphics-error').isVisible(), false);
    await second.page.evaluate(() => window.brumaluz.move(-3.4, -11.085));
    await first.page.waitForFunction(() => Math.abs(window.brumaluz.players()[0].root.position.x + 3.4) < 0.1);
    await second.page.evaluate(() => window.brumaluz.move(200, 200));
    await second.page.waitForFunction(() => window.brumaluz.char().root.parent.position.x < 0);
    assert.ok(world.players.get(b.user.id).position.x < 0, 'Server corrections must reach the local actor');
    await leave(second.page);
    await first.page.waitForFunction(() => window.brumaluz.players().length === 0);
    assert.equal(await first.page.locator('.minimap-player-count').textContent(), '1');
    assert.equal(await first.page.locator('.nameplate.player').count(), 0);
    assert.equal(world.players.has(b.user.id), false);
    assert.deepEqual([...first.errors, ...second.errors], []);
    assert.equal(world.maximum.get(a.user.id), 1);
    assert.equal(world.maximum.get(b.user.id), 1);
  } finally { await first.context.close(); await second.context.close(); }
});

test('a new session replaces the old one without the stale client removing the new player', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const first = await openPlayer(world, a);
  const second = await openPlayer(world, a);
  try {
    await first.enter();
    const oldSession = world.players.get(a.user.id).session;
    await second.enter();
    await first.page.waitForFunction(() => !document.body.classList.contains('playing'));
    assert.match(await first.page.locator('#toast').textContent(), /otra pestaña o equipo/);
    assert.notEqual(world.players.get(a.user.id)?.session, oldSession);
    assert.equal(await second.page.locator('body').evaluate((body) => body.classList.contains('playing')), true);
    assert.deepEqual([...first.errors, ...second.errors], []);
  } finally { await first.context.close(); await second.context.close(); }
});

test('network errors retry sequentially; delayed snapshots cannot recreate actors after leaving', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), b = fixture('Elara', 'elfo', -5.4);
  const first = await openPlayer(world, a);
  const second = await openPlayer(world, b);
  try {
    await first.enter(); await second.enter();
    await remote(first.page, b.character.id);
    world.fail.add(a.user.id);
    await first.page.waitForFunction(() => document.querySelector('.minimap-players').classList.contains('error'));
    await first.page.waitForFunction(() => window.brumaluz.players().length === 0, null, { timeout: 25000 });
    assert.equal(await first.page.locator('.minimap-player-count').textContent(), '—');
    assert.match(await first.page.locator('.minimap-players').getAttribute('aria-label'), /Reintentando/);
    world.fail.delete(a.user.id);
    await first.page.waitForFunction(() => !document.querySelector('.minimap-players').classList.contains('error'));
    await remote(first.page, b.character.id);
    world.delay.set(a.user.id, 800);
    await first.page.waitForTimeout(300);
    await leave(first.page);
    await first.page.waitForTimeout(1000);
    assert.equal(await first.page.locator('.nameplate.player').count(), 0);
    assert.equal(await first.page.evaluate(() => window.brumaluz.players().length), 0);
    assert.equal(world.players.has(a.user.id), false);
    assert.equal(world.maximum.get(a.user.id), 1);
    assert.deepEqual([...first.errors, ...second.errors], []);
  } finally { await first.context.close(); await second.context.close(); }
});

test('signing out during a delayed join cannot reopen the world or leave remote models behind', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    world.delay.set(a.user.id, 3000);
    const joining = player.page.waitForRequest((request) => request.url().endsWith('/rpc/world_join'));
    await player.page.locator('.character-card .btn.gold').first().click();
    await joining;
    await player.page.locator('#sign-out').click();
    await player.page.locator('#auth-form').waitFor({ state: 'visible' });
    await player.page.waitForTimeout(3500);
    assert.equal(await player.page.locator('body').evaluate((body) => body.classList.contains('playing')), false);
    assert.equal(await player.page.evaluate(() => window.brumaluz.players().length), 0);
    assert.equal(world.players.has(a.user.id), false);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('only one character entry can run at a time', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), other = fixture('Borin', 'elfo', -5.4);
  a.characters = [a.character, { ...other.character, user_id: a.user.id }];
  world.rpcDelay.set('character_enter', 1000);
  const player = await openPlayer(world, a);
  try {
    await player.page.locator('.character-card .btn.gold').nth(0).dispatchEvent('click');
    await player.page.locator('.character-card .btn.gold').nth(1).dispatchEvent('click');
    await player.page.waitForFunction(() => document.body.classList.contains('playing'));
    assert.equal(world.players.get(a.user.id).id, a.character.id);
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.name), 'Alric');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('a late title response cannot overwrite another character or reopen the sheet', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), other = fixture('Borin', 'elfo', -5.4);
  a.characters = [a.character, { ...other.character, user_id: a.user.id }];
  const player = await openPlayer(world, a);
  try {
    await player.enter();
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="sheet"]').click();
    world.rpcDelay.set('set_character_title', 5000);
    await player.page.locator('.title-button').click();
    const sent = player.page.waitForRequest((request) => request.url().endsWith('/rpc/set_character_title'));
    await player.page.locator('.title-option').filter({ hasText: 'Sin título' }).click();
    await sent;
    await player.page.locator('#window-close').click();
    await leave(player.page);
    await player.page.locator('.character-card .btn.gold').nth(1).click();
    await player.page.waitForFunction(() => document.body.classList.contains('playing'));
    await player.page.waitForTimeout(5200);
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.name), 'Borin');
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="sheet"]').click();
    assert.equal(await player.page.locator('.sheet-name-row strong').textContent(), 'Borin');
    assert.match(await player.page.locator('.title-button').textContent(), /Recién llegado/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('failed remote logout still closes the local world and shows a visible error', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    await player.enter();
    world.logoutFails = true;
    await player.page.locator('#game-menu-toggle').click();
    await player.page.locator('#game-menu-logout').click();
    await player.page.locator('#auth-form').waitFor({ state: 'visible' });
    await player.page.locator('#toast.error.show').waitFor();
    assert.equal(await player.page.locator('body').evaluate((body) => body.classList.contains('playing')), false);
    assert.equal(world.players.has(a.user.id), false);
    assert.match(await player.page.locator('#toast').textContent(), /Logout temporarily unavailable/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('prototype names in old character data cannot crash appearance sanitization', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  a.character.data.race = 'toString';
  a.character.data.cls = 'constructor';
  const player = await openPlayer(world, a);
  try {
    await player.enter();
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.race), 'humano');
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.cls), 'guerrero');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('a delayed character creation cannot pull the user back into the world after returning to selection', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    await player.page.locator('#new-character').click();
    await player.page.evaluate(() => window.brumaluz.set({ name: 'Borin', attributePoints: { fuerza: 2 }, creationPoints: 2 }));
    world.rpcDelay.set('create_character', 2000);
    const sent = player.page.waitForRequest((request) => request.url().endsWith('/rpc/create_character'));
    await player.page.locator('#enter').click();
    await sent;
    await player.page.locator('#account-characters').click();
    await player.page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
    await player.page.waitForTimeout(2500);
    assert.equal(await player.page.locator('body').evaluate((body) => body.classList.contains('playing')), false);
    assert.equal(world.players.has(a.user.id), false);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

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
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await player.page.setViewportSize({ width, height });
      await player.page.locator('.minimap-player-count').waitFor({ state: 'visible' });
      assert.equal(await player.page.locator('.minimap-player-count').textContent(), '1');
      const fits = await player.page.locator('.minimap-plate').evaluate((plate) => {
        const badge = plate.querySelector('.minimap-players').getBoundingClientRect();
        const bounds = plate.getBoundingClientRect();
        return plate.scrollWidth <= plate.clientWidth && badge.left >= bounds.left && badge.right <= bounds.right && bounds.right <= innerWidth;
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

async function social(page) {
  await page.locator('#player-menu-toggle').click();
  await page.locator('[data-window="social"]').click();
  await page.locator('.social-add button').waitFor();
  await page.waitForFunction(() => !document.querySelector('.social-add button').disabled);
}
async function socialRequest(page, username) {
  await page.locator('.social-add input').fill(username);
  await page.locator('.social-add button').click();
}

test('Social supports requests, acceptance, online presence, whisper, cancellation and removal across accounts', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), b = fixture('Elara', 'elfo', -5.4);
  b.character.data.cls = 'mago';
  const first = await openPlayer(world, a), second = await openPlayer(world, b);
  try {
    await first.enter(); await second.enter();
    await social(first.page); await social(second.page);
    await socialRequest(first.page, 'Nobody');
    await first.page.locator('.social-window .account-message.error').waitFor();
    assert.match(await first.page.locator('.social-window .account-message').textContent(), /No existe/);
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
    assert.deepEqual(await first.page.locator('.social-details dd').allTextContents(),['Elara','Brumaluz']);
    assert.deepEqual(await first.page.locator('.social-stat strong').allTextContents(),['1','0']);
    assert.equal(await first.page.locator('.social-connected-total').textContent(),'(1 conectados)');
    assert.equal(await first.page.locator('.social-introduction').count(),0);
    assert.equal(await first.page.locator('.social-account-prefix').textContent(),'~');
    assert.equal(await first.page.locator('[data-social="friend"] .social-count').textContent(),'1');
    assert.equal(await first.page.locator('.social-avatar .class-icon').count(),1);
    assert.equal(await first.page.locator('.social-avatar').getAttribute('aria-label'),'Mago');
    assert.equal(await first.page.locator('#social-username').getAttribute('aria-describedby'),'social-invitation-help');
    for (const width of [320,390,1280]) {
      await first.page.setViewportSize({width,height:844});
      const fits = await first.page.locator('.social-window').evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && el.scrollWidth <= el.clientWidth
          && [...el.querySelectorAll('button,input')].every(control => {
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
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close(); await second.context.close();}
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

async function nearbyInteractions(page, name) {
  await page.locator('#interact-label').filter({hasText:`Interactuar con ${name}`}).waitFor();
  await page.keyboard.press('KeyE');
  await page.locator('#player-interactions').waitFor({state:'visible'});
  await page.waitForFunction(() => {
    const button = document.querySelector('.player-interaction-action');
    return button && !button.disabled;
  });
}

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
    assert.equal(await first.page.locator('.player-interaction-medallion svg[viewBox="0 0 48 48"]').count(),3);
    assert.equal(await first.page.locator('.player-interaction-label').textContent(),'Añadir amigo');
    assert.equal(await first.page.locator('#player-interactions').getAttribute('aria-busy'),'false');
    assert.equal(await first.page.locator('#player-interaction-name').textContent(),'Elara');
    assert.equal(await first.page.locator('#player-interactions .player-interaction-action').count(),3);
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
    assert.equal(await first.page.locator('.player-interaction-action').count(),2);
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
    await first.page.locator('#interact-label').filter({hasText:'Interactuar con Elara'}).waitFor();
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
    await player.page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await player.page.locator('#player-interactions').isVisible(),false);
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('friend requests notify outside Social, mark both menu levels and announce acceptance; Group is a placeholder tab', {timeout:120000}, async () => {
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
    await second.page.getByText('Próximamente podrás formar un grupo con otros aventureros.',{exact:true}).waitFor();
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
    await player.page.mouse.move(chatBox.x+chatBox.width-10,chatBox.y+10);
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
