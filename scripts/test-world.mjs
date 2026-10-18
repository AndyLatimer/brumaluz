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
  return { players: new Map(), fail: new Set(), delay: new Map(), rpcDelay: new Map(), logoutFails: false, counts: new Map(), maximum: new Map(), active: new Map() };
}
async function openPlayer(world, account, compatible = true) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.routeWebSocket(/supabase\.co/, (socket) => socket.close());
  await context.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/v1/logout' && world.logoutFails) return fulfill({ msg: 'Logout temporarily unavailable' }, 500);
    if (path.startsWith('/auth/v1/')) return fulfill(account.user);
    if (path === '/rest/v1/profiles') return fulfill({ username: account.character.name });
    if (path === '/rest/v1/characters') return fulfill(account.characters || [account.character]);
    if (path === '/rest/v1/chat_messages') return fulfill([]);
    const fn = path.split('/').at(-1);
    const args = request.postDataJSON();
    const character = (account.characters || [account.character]).find((c) => c.id === args.p_character_id) || account.character;
    const data = { ...character.data };
    if (world.rpcDelay.has(fn)) await new Promise((resolve) => setTimeout(resolve, world.rpcDelay.get(fn)));
    if (fn === 'character_enter') return fulfill(data);
    if (fn === 'create_character') return fulfill(randomUUID());
    if (fn === 'set_character_title') return fulfill({ ...data, title: args.p_title });
    if (fn === 'my_titles') return fulfill([]);
    const key = account.user.id;
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
