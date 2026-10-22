// Arnés de las pruebas del mundo: servidor de vista previa, navegador y utilidades compartidas.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { after, before } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

export const port = Number(process.env.TEST_WORLD_PORT || 4175);
export const url = `http://127.0.0.1:${port}`;
export const npcDefinitions = JSON.parse(readFileSync(new URL('../../src/data/npcs.json', import.meta.url), 'utf8')).npcs;
export const project = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
let server;
export let browser;
before(async () => {
  assert.ok(project, 'Build with the public Supabase configuration before running browser tests');
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
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

export function fixture(name, race, x) {
  const userId = randomUUID(), characterId = randomUUID();
  const user = { id: userId, email: `${name}@example.test`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const data = { name, race, cls: 'guerrero', title: 'recien_llegado', level: 1, health: -1, position: { x, z: -11.085, yaw: 0 }, attributePoints: { fuerza: 2 } };
  return { user, character: { id: characterId, user_id: userId, name, data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } };
}

export function backend() {
  return { players: new Map(), accounts: new Map(), friends: new Map(), parties:new Map(), partyInvites:new Map(), partyResponses:[], history: [], chatSockets: new Map(), fail: new Set(), delay: new Map(), rpcDelay: new Map(), logoutFails: false, counts: new Map(), maximum: new Map(), active: new Map(), combatCalls:[],combatSimulationEnabled:false };
}

export function partyOf(world,userId){return [...world.parties.values()].find(party=>party.members.includes(userId));}

export function cleanupParties(world){
  for(const [id,party] of world.parties){party.members=party.members.filter(user=>world.players.has(user));if(!party.members.length)world.parties.delete(id);}
  for(const [id,invite] of world.partyInvites)if(!world.parties.has(invite.partyId)||!world.players.has(invite.target)||partyOf(world,invite.target))world.partyInvites.delete(id);
}

export function partyMember(world,userId){
  const p=world.players.get(userId),account=world.accounts.get(userId),peers=partyOf(world,userId).members.length-1;
  const boosted=value=>Math.floor(value*(1000+peers*15)/1000);
  const maxHealth=boosted(100+(p.data.level-1)*12+(p.data.attributePoints?.corpulencia??0)*8);
  const mana=['mago','clerigo'].includes(p.data.cls),maxResource=boosted((mana?65+(p.data.race==='elfo'?14:0):80)+(p.data.level-1)*6+(mana?0:(p.data.attributePoints?.corpulencia??0)*3));
  return {userId,characterId:p.id,username:account.username||p.data.name,data:p.data,position:p.position,location:'brumaluz',
    vitals:{health:p.data.health<0?maxHealth:Math.min(p.data.health,maxHealth),maxHealth,overheal:0,resource:maxResource,maxResource,resourceKind:mana?'mana':'stamina'}};
}

export async function remote(page, id) {
  await page.waitForFunction((id) => window.brumaluz.players().some((p) => p.id === id), id);
}

export async function leave(page) {
  await page.locator('#game-menu-toggle').click();
  await page.locator('#game-menu-characters').click();
  await page.waitForFunction(() => !document.body.classList.contains('playing'));
  await page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
}

export async function chatReady(world, player) {
  for (let attempt = 0; attempt < 100 && !world.chatSockets.has(player.user.id); attempt++) await new Promise(resolve=>setTimeout(resolve,50));
  assert.ok(world.chatSockets.has(player.user.id),'Mock live chat subscription must be ready');
}

export async function revealChat(page) {
  await page.locator('.chat-peek').waitFor({state:'visible'});
  const box=await page.locator('.chat-peek').boundingBox();
  assert.ok(box,'Chat corner handle must be available');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
}

export async function social(page) {
  await page.locator('#player-menu-toggle').click();
  await page.locator('[data-window="social"]').click();
  await page.locator('.social-add button').waitFor();
  await page.waitForFunction(() => !document.querySelector('.social-add button').disabled);
}

export async function socialRequest(page, username) {
  await page.locator('.social-add input').fill(username);
  await page.locator('.social-add button').click();
}

export async function hoverActor(page, plate) {
  const bounds = await plate.boundingBox();
  assert.ok(bounds, `Target nameplate is visible: ${JSON.stringify(await plate.evaluate(el=>({hidden:el.hidden,style:getComputedStyle(el).display,transform:el.style.transform,text:el.textContent})))}`);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height + 55);
}

export async function groupTab(page) {
  if(!await page.locator('#window-backdrop').isVisible()){
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="social"]').click();
  }
  await page.locator('#social-tab-1').click();
}

export async function groupInvite(page,username){
  await page.locator('.party-invite-input').fill(username);
  await page.locator('.party-invite-form button').click();
}

export async function nearbyInteractions(page, name) {
  await page.locator('#interact-label').filter({hasText:/^Interactuar$/}).waitFor();
  await page.keyboard.press('KeyE');
  await page.locator('#player-interactions').waitFor({state:'visible'});
  await page.waitForFunction(() => {
    const button = document.querySelector('.player-interaction-action');
    return button && !button.disabled;
  });
}
