import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';

const url = 'http://127.0.0.1:4198';
let server, browser;
before(async () => {
  server = await createServer({ cacheDir: 'node_modules/.vite-mobile-hud', server: { host: '127.0.0.1', port: 4198, strictPort: true, hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function openMobile(saved) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(saved => {
    localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-settings', JSON.stringify({ musicEnabled: false }));
    if (saved !== undefined) localStorage.setItem('brumaluz-chat-collapsed', JSON.stringify(saved));
  }, saved);
  await page.goto(`${url}/?test&graphics=compatible`);
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 60000 });
  await page.locator('#loading.hide').waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    const { starterEquipment } = await import('/src/data/combat.ts');
    window.brumaluz.set({ cls: 'guerrero', name: 'Daran', welcome: { origin: 0, stage: 'completed' }, introSeen: true, shadowQuest: null, health: -1, resource: -1, equipment: starterEquipment('guerrero') });
    window.brumaluz.play();
    const { story, talk } = await import('/src/game/state.ts'); story.introArmed = false; talk.pendingIsbertoIntroduction = false;
    await (await import('/src/game/combat.ts')).beginIsbertoEncounter();
    const { fight } = await import('/src/game/state.ts');
    window.brumaluz.move(fight.combatEncounter.x - 5, fight.combatEncounter.z);
    window.brumaluz.view(-Math.PI / 2, .55, 12);
  });
  assert.equal(await page.locator('#combat-controls, #combat-tutorial, .ab-feedback').count(),0);
  return { context, page, errors };
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const failures = [], bar = rect('#action-bar');
    const hud = rect('#player-hud');
    for (const menu of ['#game-menu', '#player-menu', '#world-menu']) if (overlap(hud, rect(menu))) failures.push(`HUD overlaps ${menu}`);
    for (const support of ['#chat', '#minimap']) {
      const box = rect(support);
      if (box.left < 0 || box.right > innerWidth + 1 || box.top < 0 || box.bottom > innerHeight + 1) failures.push(`${support} outside viewport`);
      if (overlap(box, bar)) failures.push(`${support} overlaps action bar`);
    }
    if (overlap(rect('#chat'), rect('#minimap'))) failures.push('Chat overlaps map');
    const prompt = document.querySelector('#interact-prompt');
    if (!prompt.hidden && (overlap(rect('#interact-prompt'), rect('#chat')) || overlap(rect('#interact-prompt'), rect('#minimap')))) failures.push('World interaction prompt overlaps support panels');
    return failures;
  });
}

test('mobile HUD keeps menus, map, chat and two-row combat controls separate', { timeout: 90000 }, async () => {
  const { context, page, errors } = await openMobile();
  try {
    assert.equal(await page.locator('#chat').evaluate(el => el.classList.contains('collapsed')), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-chat-collapsed')), null, 'A responsive default never writes a player preference');
    await mkdir('art/polish-review', { recursive: true });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.deepEqual(await inspectLayout(page), []);
      await page.screenshot({ path: `art/polish-review/hud-mobile-${width}-collapsed.png` });
      await page.locator('#chat .chat-collapse').click();
      assert.deepEqual(await inspectLayout(page), []);
      await page.screenshot({ path: `art/polish-review/hud-mobile-${width}-chat.png` });
      await page.locator('#chat .chat-collapse').click();
    }
    await page.locator('.minimap-canvas').click();
    assert.equal(await page.evaluate(async () => (await import('/src/game/state.ts')).ui.openWindow), 'map', 'The compact map still opens the full map');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('an explicit expanded-chat preference survives mobile startup and reload', { timeout: 90000 }, async () => {
  const { context, page, errors } = await openMobile(false);
  try {
    assert.equal(await page.locator('#chat').evaluate(el => el.classList.contains('collapsed')), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-chat-collapsed')), 'false');
    await page.reload();
    await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 60000 });
    assert.equal(await page.locator('#chat').evaluate(el => el.classList.contains('collapsed')), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-chat-collapsed')), 'false');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
