import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  return { players: new Map(), accounts: new Map(), friends: new Map(), parties:new Map(), partyInvites:new Map(), history: [], chatSockets: new Map(), fail: new Set(), delay: new Map(), rpcDelay: new Map(), logoutFails: false, counts: new Map(), maximum: new Map(), active: new Map() };
}
function partyOf(world,userId){return [...world.parties.values()].find(party=>party.members.includes(userId));}
function cleanupParties(world){
  for(const [id,party] of world.parties){party.members=party.members.filter(user=>world.players.has(user));if(!party.members.length)world.parties.delete(id);}
  for(const [id,invite] of world.partyInvites)if(!world.parties.has(invite.partyId)||!world.players.has(invite.target)||partyOf(world,invite.target))world.partyInvites.delete(id);
}
function partyMember(world,userId){
  const p=world.players.get(userId),account=world.accounts.get(userId),peers=partyOf(world,userId).members.length-1;
  const boosted=value=>Math.floor(value*(1000+peers*15)/1000);
  const maxHealth=boosted(100+(p.data.level-1)*12+(p.data.attributePoints?.corpulencia??0)*8);
  const mana=['mago','clerigo'].includes(p.data.cls),maxResource=boosted((mana?65+(p.data.race==='elfo'?14:0):80)+(p.data.level-1)*6+(mana?0:(p.data.attributePoints?.corpulencia??0)*3));
  return {userId,characterId:p.id,username:account.username||p.data.name,data:p.data,position:p.position,location:'brumaluz',
    vitals:{health:p.data.health<0?maxHealth:Math.min(p.data.health,maxHealth),maxHealth,overheal:0,resource:maxResource,maxResource,resourceKind:mana?'mana':'stamina'}};
}
async function openPlayer(world, account, compatible = true, clockTime) {
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
    if(fn==='trade_action') {
      world.trades ??= new Map();
      for(const tr of world.trades.values()) {
        const a=world.players.get(tr.a),b=world.players.get(tr.b);
        if(['invited','open'].includes(tr.status) && (!a || !b || a.session!==tr.sa || b.session!==tr.sb
          || Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)>10)) {
          tr.status='cancelled';tr.reason='TRADE_UNAVAILABLE';
        }
      }
      let tr=args.p_trade_id ? world.trades.get(args.p_trade_id) : [...world.trades.values()].reverse().find(tr=>[tr.a,tr.b].includes(key));
      if(args.p_action==='invite') {
        const target=[...world.players.values()].find(player=>player.id===args.p_target_id),self=world.players.get(key);
        if(!target || !self) return fulfill({message:'TRADE_UNAVAILABLE'},400);
        tr={id:randomUUID(),a:key,b:target.userId,sa:self.session,sb:target.session,status:'invited',reason:null,revision:0,
          offer_a:{items:[],pelines:0},offer_b:{items:[],pelines:0},accepted_a:false,accepted_b:false};
        world.trades.set(tr.id,tr);
      }
      if(!tr) return fulfill({trade:null});
      if(![tr.a,tr.b].includes(key)) return fulfill({message:'TRADE_NOT_FOUND'},400);
      const isA=tr.a===key,own=isA?'a':'b',peer=isA?'b':'a';
      if(args.p_action==='join')tr.status='open';
      if(args.p_action==='cancel'){tr.status='cancelled';tr.reason='TRADE_CANCELLED';}
      if(args.p_action==='back')tr[`accepted_${own}`]=false;
      if(args.p_action==='offer') {
        if(args.p_revision!==tr.revision) return fulfill({message:'TRADE_CHANGED'},400);
        tr[`offer_${own}`]=args.p_offer;tr.revision++;tr.accepted_a=false;tr.accepted_b=false;
      }
      if(args.p_action==='accept') {
        if(args.p_revision!==tr.revision) return fulfill({message:'TRADE_CHANGED'},400);
        tr[`accepted_${own}`]=true;
        if(tr.accepted_a && tr.accepted_b) {
          const dataA=world.accounts.get(tr.a).character.data,dataB=world.accounts.get(tr.b).character.data;
          const remove=(data,offer)=>{
            for(const item of offer.items) {
              data.inventory[item.slot].count-=item.count;
              if(!data.inventory[item.slot].count)data.inventory[item.slot]=null;
            }
            data.wallet.pelines-=offer.pelines;
          };
          const add=(data,offer)=>{
            for(const item of offer.items) {
              const found=data.inventory.find(stack=>stack?.id===item.id && !stack.bound);
              if(found)found.count+=item.count;else data.inventory.push({id:item.id,count:item.count});
            }
            data.wallet.pelines+=offer.pelines;
          };
          remove(dataA,tr.offer_a);remove(dataB,tr.offer_b);add(dataA,tr.offer_b);add(dataB,tr.offer_a);
          tr.status='completed';
        }
      }
      const selfData=world.accounts.get(key).character.data;
      return fulfill({trade:{id:tr.id,status:tr.status,reason:tr.reason,revision:tr.revision,incoming:!isA,
        peerId:world.accounts.get(tr[peer]).character.id,peerName:world.accounts.get(tr[peer]).character.name,
        own:tr[`offer_${own}`],peer:tr[`offer_${peer}`],accepted:tr[`accepted_${own}`],peerAccepted:tr[`accepted_${peer}`]},
        inventory:selfData.inventory ?? [],wallet:selfData.wallet ?? {pelines:0}});
    }
    if(fn.startsWith('party_')){
      cleanupParties(world);
      const party=partyOf(world,key);
      if(fn==='party_state')return fulfill({
        id:party?.id||null,members:party?party.members.map(user=>partyMember(world,user)):[],
        incoming:[...world.partyInvites.values()].filter(i=>i.target===key).map(i=>({id:i.id,username:world.accounts.get(world.parties.get(i.partyId).members[0]).username||world.accounts.get(world.parties.get(i.partyId).members[0]).character.name})),
        outgoing:party?.members[0]===key?[...world.partyInvites.values()].filter(i=>i.partyId===party.id).map(i=>({id:i.id,username:world.accounts.get(i.target).username||world.accounts.get(i.target).character.name})):[],
      });
      if(fn==='party_invite'){
        const target=[...world.accounts.values()].find(a=>(a.username||a.character.name).toLowerCase()===args.p_username.replace(/^~/,'').toLowerCase());
        if(!target||!world.players.has(target.user.id))return fulfill({message:'PARTY_TARGET_OFFLINE'},400);
        if(party&&party.members[0]!==key)return fulfill({message:'PARTY_LEADER_ONLY'},400);
        if(party?.members.length>=4)return fulfill({message:'PARTY_FULL'},400);
        if(partyOf(world,target.user.id))return fulfill({message:'PARTY_ALREADY_JOINED'},400);
        const group=party||{id:randomUUID(),members:[key]};world.parties.set(group.id,group);
        const invite={id:randomUUID(),partyId:group.id,target:target.user.id};world.partyInvites.set(invite.id,invite);
      }else if(fn==='party_respond'){
        const invite=world.partyInvites.get(args.p_invite_id);
        if(!invite||invite.target!==key)return fulfill({message:'PARTY_INVITE_INVALID'},400);
        if(args.p_accept){const group=world.parties.get(invite.partyId);if(group.members.length===4)return fulfill({message:'PARTY_FULL'},400);group.members.push(key);}
        world.partyInvites.delete(invite.id);
      }else if(fn==='party_leave'&&party){party.members=party.members.filter(user=>user!==key);}
      return route.fulfill({status:204});
    }
    if(fn==='chat_send'){
      const party=partyOf(world,key);
      if(args.p_channel==='party'&&!party)return fulfill({message:'PARTY_NOT_JOINED'},400);
      const row={id:world.history.length+1,channel:args.p_channel,zone:'brumaluz',sender_user:key,sender_name:character.name,sender_account:account.username||character.name,sender_title:character.data.title,body:args.p_body,created_at:new Date().toISOString()};
      world.history.push(row);
      for(const [userId,send] of world.chatSockets)if(args.p_channel!=='party'||party.members.includes(userId))send(row);
      return fulfill(row);
    }
    if (fn === 'friends_list') {
      const entries = [];
      for (const relation of world.friends.values()) {
        if (![relation.from, relation.to].includes(key)) continue;
        const target = world.accounts.get(relation.from === key ? relation.to : relation.from);
        const player = relation.accepted ? world.players.get(target.user.id) : null;
        entries.push({ userId: target.user.id, username: target.username || target.character.name, status: relation.accepted ? 'friend' : relation.from === key ? 'outgoing' : 'incoming', online: !!player, characterName: player?.data.name || null, characterClass: player?.data.cls || null, characterLevel: player?.data.level || null, location: player ? 'brumaluz' : null });
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
    const response = { status, position: { ...player.position },
      food: { buff: character.data.foodBuff ?? null, revision: character.data.foodRevision ?? 0, at: Date.now() / 1000 },
      players: [...world.players.values()].filter((p) => p.userId !== key).map((p) => ({
      ...p, position: { ...p.position }, username: world.accounts.get(p.userId).username || p.data.name,
      vitals: p.vitals || { health: p.dead ? 0 : 80, maxHealth: 100, overheal: 0, resource: 35, maxResource: 70, resourceKind: ['mago','clerigo'].includes(p.data.cls) ? 'mana' : 'stamina' },
    })) };
    if (world.delay.has(key)) await new Promise((resolve) => setTimeout(resolve, world.delay.get(key)));
    world.active.set(key, world.active.get(key) - 1);
    return fulfill(response);
  });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: account.user.id, exp })).toString('base64url')}.test-signature`;
  await page.addInitScript(({ project, jwt, exp, user }) => {
    const NativeAudioContext = window.AudioContext;
    window.__audioContexts = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        window.__audioContexts.push(this);
        const createGain = this.createGain.bind(this);
        this.createGain = () => {
          const gain = createGain();
          if (!this.testMaster) this.testMaster = gain;
          return gain;
        };
      }
    };
    localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }));
    localStorage.setItem('brumaluz-ambient', 'off');
    if (localStorage.getItem('brumaluz-menu-music') === null) localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  }, { project, jwt, exp, user: account.user });
  if (clockTime) await page.clock.install({ time: clockTime });
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
async function revealChat(page) {
  const box=await page.locator('.chat-peek').boundingBox();
  assert.ok(box,'Chat corner handle must be available');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
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
    await player.page.locator('#transition-loading').waitFor({ state: 'hidden' });
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('world transitions show delayed loading, clear on success and errors, and leave controls usable', { timeout: 120000 }, async () => {
  const world = backend(), account = fixture('Alric', 'humano', 100);
  world.rpcDelay.set('character_enter', 1900);
  const player = await openPlayer(world, account), page = player.page;
  try {
    await page.locator('.character-card .btn.gold').first().click();
    const loading = page.locator('#transition-loading');
    await loading.waitFor({ state: 'visible' });
    assert.equal(await loading.textContent(), 'Entrando en Brumaluz…');
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), 'true');
    assert.equal(await loading.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await page.waitForFunction(() => document.querySelector('#transition-loading')?.classList.contains('slow'));
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    await loading.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), null);
    world.rpcDelay.set('world_leave', 700);
    await page.locator('#game-menu-toggle').click();
    await page.locator('#game-menu-characters').click();
    await loading.waitFor({ state: 'visible' });
    assert.equal(await loading.textContent(), 'Volviendo a tus personajes…');
    await page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
    await loading.waitFor({ state: 'hidden' });
    await page.route('**/rest/v1/rpc/character_enter', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Transition temporarily unavailable' }) });
    });
    await page.locator('.character-card .btn.gold').first().click();
    await loading.waitFor({ state: 'visible' });
    await loading.waitFor({ state: 'hidden' });
    assert.match(await page.locator('#toast').textContent(), /Transition temporarily unavailable/);
    assert.equal(await page.locator('.character-card .btn.gold').first().isEnabled(), true);
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
    await player.page.locator('#transition-loading').waitFor({ state: 'visible' });
    assert.equal(await player.page.locator('#transition-loading p').textContent(), 'Preparando tu aventura…');
    await player.page.locator('#account-characters').click();
    await player.page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
    await player.page.waitForTimeout(2500);
    assert.equal(await player.page.locator('body').evaluate((body) => body.classList.contains('playing')), false);
    assert.equal(world.players.has(a.user.id), false);
    await player.page.locator('#transition-loading').waitFor({ state: 'hidden' });
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
    for (const [width, height] of [[1280, 800], [390, 844], [320, 844]]) {
      await player.page.setViewportSize({ width, height });
      await player.page.locator('.minimap-player-count').waitFor({ state: 'visible' });
      assert.equal(await player.page.locator('.minimap-player-count').textContent(), '1');
      const fits = await player.page.locator('.minimap-plate').evaluate((plate) => {
        const badge = plate.querySelector('.minimap-players').getBoundingClientRect();
        const bounds = plate.getBoundingClientRect();
        const coords = plate.querySelector('.minimap-coords').getBoundingClientRect();
        const zone = plate.querySelector('.minimap-zone').getBoundingClientRect();
        return plate.scrollWidth <= plate.clientWidth && badge.left >= bounds.left && badge.right <= bounds.right && bounds.right <= innerWidth
          && coords.top >= Math.max(zone.bottom,badge.bottom) && bounds.left>=0
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

async function hoverActor(page, plate) {
  const bounds = await plate.boundingBox();
  assert.ok(bounds, 'Target nameplate is visible');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height + 55);
}

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
    await hoverActor(first.page,first.page.locator('.nameplate.npc').first());
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
        assert.equal(await frame.isVisible(),distance<10,`${method}: actual distance ${actual.toFixed(3)}m must respect the 10m boundary`);
      }
    }
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

async function groupTab(page) {
  if(!await page.locator('#window-backdrop').isVisible()){
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="social"]').click();
  }
  await page.locator('#social-tab-1').click();
}
async function groupInvite(page,username){
  await page.locator('.party-invite-input').fill(username);
  await page.locator('.party-invite-form button').click();
}
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

async function nearbyInteractions(page, name) {
  await page.locator('#interact-label').filter({hasText:/^Interactuar$/}).waitFor();
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

test('friend requests notify outside Social, mark both menu levels and announce acceptance; Group offers invitations', {timeout:120000}, async () => {
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

test('default chat width follows the action bar while manual size persists', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await player.enter();
    for (const width of [1280, 1920, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const bar = document.querySelector('#action-bar').getBoundingClientRect();
        const chat = document.querySelector('#chat').getBoundingClientRect();
        return Math.abs(chat.left - bar.right - 12) <= 1 && Math.abs(chat.right - innerWidth + 12) <= 1;
      });
      assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-chat-size')), null);
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

test('character sheet details stay responsive and preserve attribute drafts, limits and confirmation', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, { level: 3, health: 90, resource: 60, experience: 40, overheal: 12 });
  const player = await openPlayer(backend(), account), page = player.page;
  let confirmed = 0;
  await page.route('**/rest/v1/rpc/spend_attribute_points', route => {
    assert.deepEqual(route.request().postDataJSON().p_points, { corpulencia: 1 });
    confirmed++;
    account.character.data.attributePoints.corpulencia = 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  const openSheet = async () => {
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="sheet"]').click();
  };
  const attr = id => page.locator(`.sheet-attr[data-attribute="${id}"]`);
  try {
    await player.enter();
    await openSheet();
    assert.equal(await page.locator('.sheet-name-row strong').textContent(), 'Alric');
    assert.equal(await page.locator('.sheet-level b').textContent(), '3');
    assert.equal(await page.locator('.sheet-attr-icon svg').count(), 7);
    assert.equal(await attr('pericia').locator('.sheet-attr-description').textContent(), 'Mejora la artesanía y la alquimia: velocidad de creación y probabilidad de obtener mejores objetos.');
    assert.equal(await page.locator('.sheet-vitals h3').textContent(), 'Estado del personaje');
    assert.doesNotMatch(await page.locator('.sheet-attributes').textContent(), /Base 5|Raza \+|Asignados/);
    assert.equal(await attr('fuerza').locator('b').textContent(), '7');
    assert.equal(await page.locator('.sheet-bar.hp [role="meter"]').getAttribute('aria-valuemax'), '124');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '90 / 124');
    assert.equal(await page.locator('.sheet-bar.stamina .track span').textContent(), '60 / 92');
    assert.equal(await page.locator('.sheet-progress-note').textContent(), '480 EXP para el nivel 4');
    assert.equal(await page.locator('.sheet-overheal').count(), 0);
    assert.doesNotMatch(await page.locator('.sheet').textContent(), /Sobrecuración/);
    await attr('corpulencia').focus();
    await attr('corpulencia').hover();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#game-tooltip').isVisible(), false);
    assert.equal(await page.locator('.sheet-attr[title], .sheet-attr[data-tip]').count(), 0);
    await page.locator('.sheet-bar.hp').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Tu salud actual y máxima/);
    await page.locator('.sheet-bar.stamina').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /energía física/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).scrollIntoViewIfNeeded();
    const beforeDraftScroll = await page.locator('#window-body').evaluate(el => el.scrollTop);
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).click();
    assert.ok(Math.abs(await page.locator('#window-body').evaluate(el => el.scrollTop) - beforeDraftScroll) <= 1, 'Editing preserves the mobile reading position');
    assert.equal(await attr('corpulencia').evaluate(el => el.contains(document.activeElement)), true, 'Editing keeps keyboard focus on the attribute');
    assert.equal(await attr('corpulencia').locator('b.pending').textContent(), '6');
    assert.equal(await attr('corpulencia').locator('.sheet-draft').textContent(), '+1 sin confirmar');
    assert.equal(await page.getByRole('button', { name: 'Añadir un punto a Fuerza', exact: true }).isDisabled(), true);
    assert.equal(confirmed, 0, 'Editing a draft does not persist it');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '90 / 124', 'Drafts do not change confirmed vitals');
    await page.getByRole('button', { name: 'Quitar un punto de Corpulencia', exact: true }).click();
    assert.equal(await attr('corpulencia').locator('.sheet-draft').count(), 0);
    assert.equal(await page.locator('#window-confirm').isVisible(), false);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).click();
    await page.locator('#window-confirm').click();
    await page.waitForFunction(() => document.querySelector('.sheet-bar.hp .track span')?.textContent === '90 / 132');
    assert.equal(confirmed, 1);
    assert.equal(await page.locator('.sheet-attr-add').count(), 0);
    assert.equal(await attr('corpulencia').locator('.sheet-attr-description').textContent(), 'Aumenta la vida máxima y la resistencia al daño.');
    await page.locator('.title-button').click();
    await page.locator('.title-option').first().waitFor({ state: 'visible' });
    await page.locator('.title-button').click();
    for (const [width, height] of [[1280, 800], [768, 1024], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.locator('.sheet-window-frame').evaluate(frame => {
        const box = frame.getBoundingClientRect(), body = frame.querySelector('#window-body');
        return { fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
          noOverflow: body.scrollWidth <= body.clientWidth };
      });
      assert.ok(layout.fits && layout.noOverflow, `Sheet fits ${width}×${height}`);
      const status = page.locator('.sheet-bar.xp');
      await status.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await page.mouse.move(0, 0);
      await status.evaluate(el => el.blur());
      await status.focus();
      await page.locator('#game-tooltip').waitFor({ state: 'visible' });
      const tip = await page.locator('#game-tooltip').boundingBox();
      assert.ok(tip.x >= 0 && tip.x + tip.width <= width && tip.y >= 0 && tip.y + tip.height <= height);
      assert.equal(await page.locator('#window-close').isVisible(), true);
      if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) {
        await page.mouse.move(0, 0);
        await page.locator('#window-close').focus();
        await page.locator('#window-body').evaluate(el => el.scrollTop = 0);
        await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, `character-sheet-${width}.png`) });
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.equal(await page.locator('.sheet-vitals h3').textContent(), 'Character status');
    assert.equal(await attr('corpulencia').locator('.sheet-attr-description').textContent(), 'Increases maximum health and damage resistance.');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('character sheet handles mana, maximum level and capped attributes without empty overheal', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, { level: 50, cls: 'mago', overheal: 0, attributePoints: { fuerza: 10 } });
  const player = await openPlayer(backend(), account), page = player.page;
  try {
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await player.enter();
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="sheet"]').click();
    assert.equal(await page.locator('.sheet-progress-note').textContent(), 'Maximum level reached');
    assert.equal(await page.locator('.sheet-overheal').count(), 0);
    assert.equal(await page.locator('.sheet-bar.mana [role="meter"]').getAttribute('aria-label'), 'Mana');
    await page.locator('.sheet-bar.mana').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /magical energy/);
    assert.equal(await page.locator('.sheet-attr[data-attribute="fuerza"] b').textContent(), '15');
    assert.equal(await page.getByRole('button', { name: 'Add one point to Strength', exact: true }).isDisabled(), true);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('login remembers only the opted-in email and forgets it when unchecked', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  const page = player.page;
  try {
    await page.addInitScript(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key);
      }
    });
    await page.reload();
    const form = page.locator('#auth-form');
    await form.waitFor({ state: 'visible' });
    const email = page.locator('#auth-email'), remember = page.locator('#auth-remember');
    assert.equal(await remember.isChecked(), false);
    await email.fill('remember@example.test');
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), null);
    await remember.check();
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), 'remember@example.test');
    await page.locator('#auth-password').fill('never-save-this-password');
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), 'remember@example.test');
    assert.equal(await remember.isChecked(), true);
    assert.equal(await page.locator('#auth-password').inputValue(), '');
    assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('never-save-this-password'))), false);
    await email.fill('updated@example.test');
    await page.locator('[data-auth-mode="register"]').click();
    assert.equal(await remember.isVisible(), false);
    await page.locator('[data-auth-mode="login"]').click();
    assert.equal(await remember.isChecked(), true);
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), 'updated@example.test');
    await remember.uncheck();
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), null);
    assert.equal(await email.inputValue(), 'updated@example.test', 'Unchecking must not erase the current input');
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), '');
    assert.equal(await remember.isChecked(), false);
    await page.locator('[data-language="en"]').first().click();
    assert.equal(await page.locator('#remember-email-field span').textContent(), 'Remember me');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('bread shows a timed food buff above the action bar without healing and renews until expiry', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date('2026-10-18T12:00:00'));
  const page = player.page;
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz);
    await page.evaluate(() => {
      window.brumaluz.set({ cls: 'guerrero', health: -1, resource: -1, attributePoints: { fuerza: 2 },
        inventory: [{ id: 'pan_duro', count: 3 }] });
      window.brumaluz.play();
    });
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    await page.keyboard.press('KeyI');
    const bread = page.locator('.inv-grid [data-item-id="pan_duro"]');
    await bread.hover();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.item-tip-category').textContent(), 'Comida');
    assert.match(await page.locator('#game-tooltip').textContent(), /15 minutos de conexión/);
    assert.equal(await page.locator('.item-tip-sale b').textContent(), '2 Pelines');
    await bread.dragTo(page.locator('.ab-slot').first());
    await bread.click();
    const fedAt = await page.evaluate(() => performance.now());
    const buff = page.locator('.food-buff');
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 105');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 83');
    assert.equal(await buff.locator('span').textContent(), '15:00');
    assert.equal(await bread.locator('i').textContent(), '2');
    await page.locator('#window-close').click();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#interact-prompt').waitFor({ state: 'visible' });
      await page.waitForTimeout(300);
      const badge = await buff.boundingBox(), bar = await page.locator('#action-bar').boundingBox();
      const prompt = await page.locator('#interact-prompt').boundingBox();
      assert.ok(badge.x >= 0 && badge.x + badge.width <= width);
      assert.ok(badge.y + badge.height <= bar.y - 6, 'Buff is above, not overlapping the quick bar');
      assert.ok(prompt.y + prompt.height <= badge.y - 8, 'Interaction prompt stays above the buff row');
    }
    await page.waitForTimeout(100);
    await page.mouse.move(0, 0);
    await buff.evaluate(el => el.blur());
    await buff.focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Origen: Pan duro/);
    assert.match(await page.locator('#game-tooltip').textContent(), /se pausa al desconectarte/);
    if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, 'bread-buff.png') });
    const elapsedSinceMeal = await page.evaluate(start => performance.now() - start, fedAt);
    await page.clock.fastForward(Math.max(0, Math.floor(60000 - elapsedSinceMeal)));
    assert.equal(await buff.locator('span').textContent(), '14:00');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Digit1');
    const renewedAt = await page.evaluate(() => performance.now());
    assert.equal(await buff.locator('span').textContent(), '15:00');
    assert.equal(await page.locator('.food-buff').count(), 1, 'Renewal does not stack buffs');
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 105');
    await page.keyboard.press('KeyC');
    assert.equal(await buff.isVisible(), false, 'Buff follows the action bar visibility');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '100 / 105');
    await page.locator('#window-close').click();
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await buff.focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Source: Stale bread/);
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    const elapsedSinceRenewal = await page.evaluate(start => performance.now() - start, renewedAt);
    await page.clock.fastForward(Math.max(0, Math.floor(899000 - elapsedSinceRenewal)));
    assert.equal(await buff.locator('span').textContent(), '0:01');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 83');
    await page.clock.fastForward(1100);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#active-buffs').evaluate(el => el.hidden), true, JSON.stringify({
      errors: player.errors, timer: await buff.locator('span').allTextContents(),
      graphicsError: await page.locator('#graphics-error').isVisible(),
      playing: await page.locator('body').evaluate(el => el.classList.contains('playing')),
    }));
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 100');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 80');
    assert.equal(await buff.count(), 0);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('food timer pauses on connection failure, restores from server and ignores stale revisions', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100), world = backend();
  Object.assign(account.character.data, { foodBuff: { itemId: 'pan_duro', remaining: 600 }, foodRevision: 2 });
  const player = await openPlayer(world, account), page = player.page;
  try {
    await player.enter();
    const buff = page.locator('.food-buff');
    await buff.waitFor({ state: 'visible' });
    world.fail.add(account.user.id);
    await page.waitForFunction(() => document.querySelector('.food-buff')?.classList.contains('paused'));
    const paused = await buff.locator('span').textContent();
    await page.waitForTimeout(2200);
    assert.equal(await buff.locator('span').textContent(), paused);
    account.character.data.foodBuff.remaining = 590;
    world.fail.delete(account.user.id);
    await page.waitForFunction(() => !document.querySelector('.food-buff')?.classList.contains('paused'));
    assert.match(await buff.locator('span').textContent(), /^9:5\d$/);
    account.character.data.foodRevision = 1;
    account.character.data.foodBuff.remaining = 100;
    await page.waitForTimeout(800);
    assert.match(await buff.locator('span').textContent(), /^9:[45]\d$/, 'An old food revision cannot replace the current buff');
    account.character.data.foodRevision = 2;
    account.character.data.foodBuff.remaining = 590;
    await leave(page);
    await page.waitForTimeout(1000);
    await player.enter();
    assert.match(await buff.locator('span').textContent(), /^9:5\d$/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('potion shop fits desktop and mobile and local resource potions enforce class and caps', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz);
    await page.evaluate(() => {
      window.brumaluz.set({ cls: 'mago', resource: 10, health: -1, wallet: { pelines: 100 }, inventory: [] });
      window.brumaluz.play();
    });
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    const shop = async () => {
      await page.evaluate(() => { const p = window.brumaluz.city().npcSites[0].position; window.brumaluz.move(p.x, p.z + 0.6); });
      await page.keyboard.press('KeyE');
      await page.locator('.dialog-choice').filter({ hasText: 'Comerciar' }).click();
    };
    await shop();
    assert.equal(await page.locator('.vendor-col').first().locator('.vendor-row').count(), 4);
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.locator('#window-body').evaluate(el => el.scrollWidth <= el.clientWidth), `Commerce fits ${width}px`);
      const row = page.locator('.vendor-col').first().locator('[data-item-id="pocion_mana_minuscula"]');
      await row.scrollIntoViewIfNeeded();
      await row.hover();
      await page.locator('#game-tooltip').waitFor({ state: 'visible' });
      assert.match(await page.locator('#game-tooltip').textContent(), /5 % de tu maná máximo/);
      if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, `commerce-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    const stock = id => page.locator('.vendor-col').first().locator(`[data-item-id="${id}"] button`);
    await stock('pocion_mana_minuscula').click();
    await stock('pocion_estamina_minuscula').click();
    assert.equal(await page.locator('.vendor-banner .currency b').textContent(), '80');
    await page.locator('#window-close').click();
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_mana_minuscula"]').click();
    assert.equal(await page.locator('#hud-resource-text').textContent(), '14 / 65');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.match(await page.locator('#toast').textContent(), /no corresponde/);
    assert.match(await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').getAttribute('aria-label'), /1 unidades/);
    await page.locator('#window-close').click();
    await page.evaluate(() => window.brumaluz.set({ cls: 'guerrero', resource: 79 }));
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 80');
    await page.locator('#window-close').click();
    await shop();
    await stock('pocion_estamina_minuscula').click();
    await page.locator('#window-close').click();
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.match(await page.locator('#toast').textContent(), /recurso completo/);
    assert.match(await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').getAttribute('aria-label'), /1 unidades/);
    await page.locator('#window-close').click();
    await shop();
    const purse = page.locator('.vendor-banner .currency b');
    const beforeSale = Number(await purse.textContent());
    await page.locator('.vendor-col').nth(1).locator('[data-item-id="pocion_estamina_minuscula"] button').click();
    assert.equal(Number(await purse.textContent()), beforeSale + 5);
    assert.equal(await page.locator('.vendor-empty').isVisible(), true);
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.equal(await page.locator('.vendor-banner strong').textContent(), 'Provisions for the road');
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.locator('#window-close').click();
    await page.evaluate(() => window.brumaluz.set({ wallet: { pelines: 0 } }));
    await shop();
    assert.equal(await page.locator('.vendor-col').first().locator('button:disabled').count(), 4);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory item cards share tooltips with equipment, action bar and vendor without changing use or drag', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, {
    health: 60, wallet: { pelines: 100, lagrimas: 0 },
    inventory: [{ id: 'pocion_vida_minuscula', count: 3 }],
    equipment: { head: { id: 'pocion_vida_minuscula', count: 1 } },
  });
  const player = await openPlayer(backend(), account);
  const page = player.page;
  let used = 0;
  await page.route('**/rest/v1/rpc/use_item', route => {
    assert.equal(route.request().postDataJSON().p_slot, 0);
    used++;
    account.character.data.health += 5;
    account.character.data.inventory[0].count--;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  const tooltip = page.locator('#game-tooltip');
  async function inspect(target) {
    await page.mouse.move(0, 0);
    await target.hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.locator('.item-tip-name').textContent(), 'Poción de vida minúscula');
    assert.equal(await tooltip.locator('.item-tip-category').textContent(), 'Consumible');
    assert.equal(await tooltip.locator('.item-tip-effects li').textContent(), 'Restaura un 5 % de tu vida máxima.');
    assert.match(await tooltip.locator('.item-tip-description').textContent(), /pequeño frasco/);
    assert.equal(await tooltip.locator('.item-tip-sale b').textContent(), '5 Pelines');
    assert.equal(await tooltip.locator('.item-tip-sale small').count(), 0);
    assert.doesNotMatch(await tooltip.textContent(), /Apilable|por unidad/);
    assert.equal(await tooltip.locator('.item-tip-stats').count(), 0, 'Do not invent equipment stats for a potion');
    assert.equal(await target.getAttribute('title'), null);
    assert.equal(await target.getAttribute('aria-describedby'), 'game-tooltip');
    await page.waitForTimeout(180);
    const anchor = await target.boundingBox(), card = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    if (anchor.x + anchor.width + 10 + card.width <= viewport.width - 6) {
      assert.ok(Math.abs(card.x - anchor.x - anchor.width - 10) <= 1, 'Item tooltip anchors to the right with a small gap');
    } else if (anchor.x - 10 - card.width >= 6) {
      assert.ok(Math.abs(card.x + card.width + 10 - anchor.x) <= 1, 'Item tooltip flips to the left near the right edge');
    }
    assert.ok(card.x + card.width <= anchor.x || card.x >= anchor.x + anchor.width
      || card.y + card.height <= anchor.y || card.y >= anchor.y + anchor.height, 'Tooltip must not cover its item');
    return tooltip.textContent();
  }
  try {
    await player.enter();
    await page.keyboard.press('KeyI');
    const item = page.locator('.inv-grid [data-item-id]').first();
    assert.equal(await page.locator('.inv-grid .inv-slot:not(.locked)').count(), 25);
    assert.equal(await page.locator('.inv-capacity').textContent(), '1 / 25');
    assert.equal(await page.locator('.inv-purse .currency').count(), 2);
    assert.ok((await page.locator('.inv-purse').boundingBox()).height <= 42, 'Desktop purse stays compact');
    assert.equal(await page.locator('.equip-art').count(), 9);
    assert.equal(await item.locator('b').count(), 0, 'Keep slot contents uncluttered');
    const expected = await inspect(item);
    const coinStyle = icon => icon.evaluate(svg => {
      const properties = ['fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'filter'];
      return [svg, ...svg.children].map(part => Object.fromEntries(properties.map(key => [key, getComputedStyle(part)[key]])));
    });
    assert.deepEqual(await coinStyle(tooltip.locator('.currency-icon-pelines')),
      await coinStyle(page.locator('.inv-purse .currency-icon-pelines')),
      'Tooltip and purse must use identical coin artwork styling');
    assert.equal(await inspect(page.locator('.inv-slot.equip.filled')), expected);
    const portrait = page.locator('.doll-portrait');
    const before = await portrait.evaluate(canvas => canvas.toDataURL());
    const stage = await page.locator('.doll-stage').boundingBox();
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width / 2 + 45, stage.y + stage.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(previous => document.querySelector('.doll-portrait').toDataURL() !== previous, before);
    await item.dragTo(page.locator('.ab-slot').first());
    assert.equal(used, 0, 'Dragging must not consume a potion');
    assert.equal(await inspect(page.locator('.ab-slot.filled')), expected);
    await item.click();
    await page.waitForFunction(() => document.querySelector('.inv-grid [data-item-id] i')?.textContent === '2');
    await tooltip.waitFor({ state: 'hidden' });
    assert.equal(used, 1);
    assert.equal(await page.locator('#hud-health-text').textContent(), '65 / 100');
    assert.equal(await page.locator('.ab-slot.filled i').textContent(), '2');
    await page.locator('.currency.pelines').hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.evaluate(el => el.classList.contains('item-tooltip')), false, 'Generic tooltips keep their short format');
    assert.equal(await tooltip.locator('strong').textContent(), 'Pelines');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-choice').filter({ hasText: 'Comerciar' }).click();
    const stock = page.locator('.vendor-col').first().locator('.vendor-row').first();
    const owned = page.locator('.vendor-col').nth(1).locator('.vendor-row');
    assert.equal(await inspect(stock), expected);
    assert.equal(await stock.locator('.vendor-price b').textContent(), '10', 'Buy price remains unchanged');
    assert.equal(await inspect(owned), expected);
    assert.equal(await owned.locator('.vendor-price b').textContent(), '5');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory and item tooltips fit narrow viewports, support focus and translate content', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  account.character.data.inventory = [{ id: 'pocion_vida_minuscula', count: 99 }];
  const player = await openPlayer(backend(), account);
  const page = player.page;
  try {
    await player.enter();
    await page.keyboard.press('KeyI');
    const item = page.locator('.inv-grid [data-item-id]');
    const tooltip = page.locator('#game-tooltip');
    for (const size of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      await item.scrollIntoViewIfNeeded();
      const layout = await page.locator('.inv').evaluate(el => ({
        width: el.clientWidth, content: el.scrollWidth,
        gridWidth: el.querySelector('.inv-grid').clientWidth, gridContent: el.querySelector('.inv-grid').scrollWidth,
        slots: [...el.querySelectorAll('.inv-grid .inv-slot:not(.locked)')].map(slot => slot.getBoundingClientRect().width),
      }));
      assert.ok(layout.content <= layout.width + 1, JSON.stringify({ size, layout }));
      assert.ok(layout.gridContent <= layout.gridWidth + 1, JSON.stringify({ size, layout }));
      assert.ok(layout.slots.every(width => width >= 30), JSON.stringify({ size, layout }));
      await page.mouse.move(0, 0);
      await item.evaluate(el => el.blur());
      await item.focus();
      await tooltip.waitFor({ state: 'visible' });
      const box = await tooltip.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height, JSON.stringify({ size, box }));
      assert.equal(await item.getAttribute('aria-describedby'), 'game-tooltip');
    }
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await tooltip.waitFor({ state: 'hidden' });
    await page.mouse.move(0, 0);
    await item.hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.locator('.item-tip-name').textContent(), 'Minuscule health potion');
    assert.equal(await tooltip.locator('.item-tip-category').textContent(), 'Consumable');
    assert.equal(await tooltip.locator('.item-tip-effects li').textContent(), 'Restores 5% of your maximum health.');
    assert.match(await tooltip.locator('.item-tip-description').textContent(), /little glass bottle/);
    assert.match(await tooltip.locator('.item-tip-sale').textContent(), /Sell value5 Pelines/);
    assert.doesNotMatch(await tooltip.textContent(), /Stackable|per unit/);
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    assert.equal(await item.getAttribute('aria-describedby'), null);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('party and zone chat use distinct colors across messages, tags, filters and channel selector', { timeout: 120000 }, async () => {
  const world = backend(), account = fixture('Alric', 'humano', 100);
  const player = await openPlayer(world, account);
  const page = player.page;
  try {
    await player.enter();
    await chatReady(world, account);
    for (const [index, channel] of ['zone', 'party'].entries()) {
      world.chatSockets.get(account.user.id)({
        id: index + 1, channel, zone: 'brumaluz', sender_user: account.user.id,
        sender_name: 'Alric', sender_account: 'Alric', sender_title: 'recien_llegado',
        created_at: new Date().toISOString(), body: `${channel} color check`,
      });
    }
    await page.locator('.chat-log .k-party').waitFor({ state: 'attached' });
    const colors = await page.evaluate(() => {
      const color = selector => getComputedStyle(document.querySelector(selector)).color;
      return {
        party: color('.chat-line.k-party'), partyTag: color('.chat-line.k-party .chat-tag'),
        zone: color('.chat-line.k-zone'), zoneTag: color('.chat-line.k-zone .chat-tag'),
        partyFilter: color('.chat-filter[data-kind="party"]'),
      };
    });
    assert.equal(colors.party, 'rgb(242, 183, 129)');
    assert.equal(colors.partyTag, colors.party);
    assert.equal(colors.partyFilter, colors.party);
    assert.equal(colors.zone, 'rgb(207, 234, 255)');
    assert.equal(colors.zoneTag, 'rgb(159, 216, 255)');
    await page.keyboard.press('Enter');
    await page.locator('.chat-channel').click();
    await page.waitForFunction(() => document.querySelector('.chat-channel').dataset.channel === 'zone');
    await page.locator('.chat-channel').click();
    assert.equal(await page.locator('.chat-channel').getAttribute('data-channel'), 'party');
    assert.equal(await page.locator('.chat-channel').evaluate(el => getComputedStyle(el).color), colors.party);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('NPC interactions stay out of chat while spontaneous nearby barks remain', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date(2026, 9, 18, 12));
  const page = player.page;
  try {
    await player.enter();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-choice').filter({ hasText: /^\s*1\.\s*Hola$/ }).click();
    await page.locator('.dialog-text').filter({ hasText: '¡Hola! Si estás leyendo esto' }).waitFor();
    const log = page.locator('.chat-log');
    assert.doesNotMatch(await log.textContent(), /¡Saludos, viajero!|¡Hola! Si estás leyendo esto|Hola/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.clock.fastForward(84_000);
    assert.match(await log.textContent(), /¿Alguien ha visto mi documentación|Psst, viajero|Un día más depurando/);
    assert.match(await log.textContent(), /Testículos, the Debugger/);
    assert.doesNotMatch(await log.textContent(), /¡Saludos, viajero!|¡Hola! Si estás leyendo esto/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('damage absorbed by overheal preserves full-health sentinel and only zero health kills', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  account.character.data.overheal = 25;
  const player = await openPlayer(backend(), account);
  const page = player.page;
  const results = [
    { health: -1, overheal: 15 },
    { health: -1, overheal: 0 },
    { health: 94, overheal: 0 },
    { health: 0, overheal: 0 },
  ];
  let calls = 0;
  await page.route('**/rest/v1/rpc/debug_damage', route => {
    Object.assign(account.character.data, results[calls++]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  try {
    await player.enter();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    const damage = page.locator('.dialog-choice').filter({ hasText: 'Recibir 10 puntos de daño' });
    await damage.waitFor({ state: 'visible' });
    for (let i = 0; i < results.length; i++) {
      await damage.click();
      await page.waitForFunction(expected => document.querySelector('#hud-health-text').textContent.startsWith(expected), `${results[i].health < 0 ? 100 : results[i].health} / 100`);
      assert.equal(await page.locator('#death-screen').isVisible(), i === 3, `Damage result ${i} must only kill at zero health`);
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dead')), i === 3);
    }
    assert.equal(calls, 4);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('character cards keep portraits inside the inner frame and borders stable on hover', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await player.page.setViewportSize(viewport);
      const card = player.page.locator('.character-card').first();
      const before = await card.boundingBox();
      await card.hover();
      await player.page.waitForTimeout(250);
      assert.deepEqual(await card.boundingBox(), before, 'Hover must not lift the card into the scroll clip');
      const result = await card.evaluate((element) => {
        const card = element.getBoundingClientRect();
        const portrait = element.querySelector('.character-portrait').getBoundingClientRect();
        const info = element.querySelector('.character-info');
        const list = element.parentElement.getBoundingClientRect();
        return {
          left: portrait.left - card.left, top: portrait.top - card.top,
          bottom: card.bottom - portrait.bottom,
          clipped: card.top < list.top || card.bottom > list.bottom,
          overflow: getComputedStyle(info).overflow,
          radius: getComputedStyle(info).borderRadius,
          border: getComputedStyle(element, '::after').borderTopWidth,
        };
      });
      assert.ok(result.left >= 6 && result.top >= 6 && result.bottom >= 6, JSON.stringify(result));
      assert.equal(result.clipped, false);
      assert.equal(result.overflow, 'hidden');
      assert.equal(result.radius, '9px');
      assert.equal(result.border, '1px');
    }
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('menu music produces sound, persists its toggle and stops outside account screens', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  const page = player.page;
  const sample = () => page.evaluate(async () => {
    const context = window.__audioContexts[0];
    const analyser = context.createAnalyser();
    context.testMaster.connect(analyser);
    await new Promise(resolve => setTimeout(resolve, 180));
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    context.testMaster.disconnect(analyser);
    return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
  });
  try {
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0, 'Do not autoplay before interaction');
    const music = page.locator('#menu-music');
    await music.click();
    await page.waitForTimeout(1200);
    assert.ok(await sample() > 0.0001, 'Music must produce actual audio');
    assert.equal(await music.getAttribute('aria-pressed'), 'true');
    const graphics = await page.locator('#graphics-mode').boundingBox(), button = await music.boundingBox();
    assert.ok(button.x + button.width <= graphics.x && Math.abs(button.y - graphics.y) < 2);
    await page.locator('[data-language="en"]').first().click();
    assert.equal(await music.textContent(), 'Music: on');
    await page.locator('[data-language="es"]').first().click();
    await music.click();
    assert.equal(await sample(), 0, 'Mute must produce exact silence');
    await page.evaluate(() => window.__audioContexts[0].suspend());
    await music.click();
    await music.click();
    await music.click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Rapid toggles must restore music once');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await sample(), 0, 'Hidden tabs must stop music');
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Visible tabs must restore music');
    await page.locator('#new-character').click();
    assert.equal(await sample(), 0, 'Creator must stop menu music');
    await page.locator('#account-characters').click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Returning to selection must restore music');
    await player.enter();
    assert.equal(await sample(), 0, 'World must stop menu music');
    await page.keyboard.press('KeyO');
    await page.locator('[data-tab="sound"]').click();
    await page.locator('#opt-master-volume').fill('0');
    await page.keyboard.press('Escape');
    await leave(page);
    await page.waitForTimeout(1000);
    assert.ok(await sample() < 0.0001, 'Menu music must respect master volume');
    await music.click();
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('brumaluz-settings'));
      localStorage.setItem('brumaluz-settings', JSON.stringify({ ...settings, masterVolume: 80 }));
    });
    await page.reload();
    await music.waitFor({ state: 'visible' });
    assert.equal(await music.getAttribute('aria-pressed'), 'false', 'Mute preference must survive reload');
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
    await page.locator('#sign-out').click();
    await page.locator('#auth-form').waitFor({ state: 'visible' });
    assert.equal(await music.isVisible(), true, 'Music toggle must also exist on login');
    await music.click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Login must play the same music');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('menu music follows local day/night boundaries without enabling muted music', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date(2026, 9, 18, 5, 59, 30));
  const page = player.page;
  try {
    await page.evaluate(() => {
      window.__menuNotes = [];
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        const oscillator = original.call(this);
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when) => {
          window.__menuNotes.push({ pitch: Math.round(69 + 12 * Math.log2(oscillator.frequency.value / 440)), when });
          start(when);
        };
        return oscillator;
      };
    });
    await page.locator('#new-character').click();
    await page.locator('#account-characters').click();
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('daytime')), false);
    await page.locator('#menu-music').click();
    await page.waitForFunction(() => window.__menuNotes.length >= 12);
    const night = await page.evaluate(() => window.__menuNotes.slice(0, 12).map(note => note.pitch));
    assert.deepEqual(night, [48, 55, 60, 64, 72, 60, 76, 67, 79, 72, 76, 76], 'Original night arrangement must stay unchanged');

    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(60_000);
    await page.waitForFunction(() => document.body.classList.contains('daytime') && window.__menuNotes.some(note => note.pitch === 81));
    const day = await page.evaluate(() => window.__menuNotes.slice(-22));
    assert.equal(day.length, 22, 'Day arrangement has a livelier melody, accompaniment and bass');
    assert.deepEqual(day.slice(4, 10).map(note => note.pitch), [76, 60, 79, 67, 81, 72]);
    assert.ok(Math.abs(day[6].when - day[4].when - 0.34) < 0.001, 'Day melody must have a faster pulse');
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 1, 'Changing tracks must reuse the audio context');

    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(12 * 60 * 60 * 1000);
    await page.waitForFunction(() => !document.body.classList.contains('daytime') && window.__menuNotes.length >= 12);
    assert.deepEqual(await page.evaluate(() => window.__menuNotes.slice(-12).map(note => note.pitch)), night);
    await page.locator('#menu-music').click();
    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(12 * 60 * 60 * 1000);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('daytime')), true);
    assert.equal(await page.locator('#menu-music').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => window.__menuNotes.length), 0, 'Time changes must preserve mute');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('ambient sound switch changes actual output and respects volume and repeated toggles', {timeout:120000}, async()=>{
  const world=backend(), a=fixture('Alric','humano',100), player=await openPlayer(world,a);
  try {
    await player.enter();
    await player.page.keyboard.press('KeyO');
    await player.page.locator('[data-tab="sound"]').click();
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForFunction(()=>document.querySelector('#opt-ambient').getAttribute('aria-checked')==='true');
    await player.page.waitForFunction(()=>window.__audioContexts.some(context=>context.state==='running'));
    const sample=()=>player.page.evaluate(async()=>{
      const context=window.__audioContexts[0];
      const analyser=context.createAnalyser();
      context.testMaster.connect(analyser);
      await new Promise(resolve=>setTimeout(resolve,150));
      const data=new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      context.testMaster.disconnect(analyser);
      return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);
    });
    await player.page.waitForTimeout(1800);
    const enabled=await sample();
    assert.ok(enabled>0.0001,`Enabled ambient must produce sound, got RMS ${enabled}`);
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForTimeout(150);
    const disabled=await sample();
    assert.equal(disabled,0,'Disabled ambient must be exactly silent, not merely quieter');
    assert.equal(await player.page.evaluate(()=>window.__audioContexts[0].testMaster.gain.value),0);
    await player.page.locator('#opt-master-volume').fill('100');
    assert.equal(await sample(),0,'Changing volume must not reactivate disabled ambience');
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForTimeout(1800);
    assert.ok(await sample()>0.0001);
    await player.page.evaluate(()=>window.__audioContexts[0].suspend());
    await player.page.locator('#opt-ambient').click();
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForFunction(()=>window.__audioContexts[0].state==='running');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()>0.0001,'Toggle must restore suspended browser audio');
    await player.page.locator('#opt-master-volume').fill('0');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()<0.0001,'Master volume must mute ambient output');
    await player.page.locator('#opt-master-volume').fill('80');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()>0.0001,'Master volume must restore ambient output');
    assert.equal(await player.page.locator('#opt-ambient').getAttribute('aria-checked'),'true');
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('players trade through the actual interaction menu, offer quantities privately and commit both HUD inventories', {timeout:180000},async()=>{
  const world=backend(),a=fixture('Alric','humano',100),b=fixture('Elara','elfo',101);
  a.character.data.inventory=[{id:'pan_duro',count:10},{id:'pocion_vida_minuscula',count:3,bound:true}];
  b.character.data.inventory=[{id:'pocion_mana_minuscula',count:8}];
  a.character.data.wallet={pelines:100,premium:777};b.character.data.wallet={pelines:100,premium:888};
  const first=await openPlayer(world,a),second=await openPlayer(world,b);
  try {
    await first.enter();await second.enter();
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Invitar a intercambiar',exact:true}).click();
    await second.page.getByRole('dialog',{name:'Invitación de intercambio',exact:true}).waitFor();
    await second.page.getByText('¿Quieres intercambiar objetos y pelines con Alric?',{exact:true}).waitFor();
    await second.page.getByRole('button',{name:'Rechazar',exact:true}).waitFor();
    await second.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await first.page.getByText('Tu mochila intercambiable',{exact:true}).waitFor();
    assert.equal(await first.page.locator('.trade-item').count(),1);
    assert.equal(await first.page.locator('.trade-peer-offer .trade-offer-item').count(),0);
    await first.page.getByLabel('Ofrecer Pan duro (1)',{exact:true}).fill('4');
    await first.page.getByLabel('Pelines ofrecidos',{exact:true}).fill('30');
    await first.page.getByRole('button',{name:'Actualizar oferta',exact:true}).click();
    await second.page.locator('.trade-peer-offer').getByText('Pan duro ×4',{exact:true}).waitFor();
    await second.page.getByLabel('Ofrecer Poción de maná minúscula (1)',{exact:true}).fill('3');
    await second.page.getByRole('button',{name:'Actualizar oferta',exact:true}).click();
    await first.page.locator('.trade-peer-offer').getByText('Poción de maná minúscula ×3',{exact:true}).waitFor();
    for(const width of [1280,390,320]) {
      await first.page.setViewportSize({width,height:844});
      assert.equal(await first.page.locator('.trade-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true,`Trade fits ${width}px`);
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`trade-${width}.png`)});
    }
    await first.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await second.page.getByText('✓ El otro jugador ha aceptado.',{exact:true}).waitFor();
    await first.page.getByRole('button',{name:'Atrás',exact:true}).click();
    await first.page.getByText('Revisa ambas ofertas antes de aceptar.',{exact:true}).waitFor();
    await first.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await second.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await first.page.getByText('¡Intercambio completado!',{exact:true}).waitFor();
    await second.page.getByText('¡Intercambio completado!',{exact:true}).waitFor();
    assert.equal(a.character.data.wallet.pelines,70);assert.equal(b.character.data.wallet.pelines,130);
    assert.equal(a.character.data.wallet.premium,777);assert.equal(b.character.data.wallet.premium,888);
    await first.page.getByRole('button',{name:'Cerrar',exact:true}).click();
    await first.page.keyboard.press('KeyI');
    await first.page.locator('[data-item-id="pocion_mana_minuscula"]').first().waitFor();
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});
