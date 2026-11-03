import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const output = 'art/creator-craft-review';
const server = await createServer({ server: { host: '127.0.0.1', port: 4229, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off'); localStorage.setItem('brumaluz-language', 'es');
  });
  await page.goto('http://127.0.0.1:4229/?test&welcome&graphics=compatible', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.locator('#loading.hide').waitFor({ state: 'attached', timeout: 180000 });
  await mkdir(output, { recursive: true });
  await page.evaluate(async () => {
    window.brumaluz.set({ name: 'Miel', race: 'humano', face: 2, height: .5, build: .5, hair: 31, hairColor: 2, beard: 2, detail: 6, eyeShape: 9, brows: 8, acc: 0, hairAcc: 0, makeup: 0, clothA: 12, clothB: 7, introSeen: true, welcome: { origin: 0, stage: 'completed' } });
    (await import('/src/ui/characterSelect.ts')).showEditor();
    window.brumaluz.tab('cabello');
  });
  await page.waitForTimeout(700);
  const focus = page.locator('#creator-focus-preview');
  if ((await focus.textContent()).includes('rostro')) await focus.click();
  for (const hair of [28, 29, 30, 31]) {
    const combo = page.locator('.stepper[data-key="hair"] [role="combobox"]'); await combo.click();
    await page.locator(`.creator-select-menu:visible [role="option"][data-value="${hair}"]`).click();
    await page.waitForFunction(hair => window.brumaluz.char().d.hair === hair, hair);
    for (const direction of ['Frente', 'Perfil', 'Espalda']) {
      await page.getByRole('button', { name: direction, exact: true }).click(); await page.waitForTimeout(350);
      await page.screenshot({ path: `${output}/creator-${hair}-${direction.toLowerCase()}.png` });
    }
    checks.push({ creatorHair: hair, preservedBeard: await page.evaluate(() => window.brumaluz.char().d.beard) });
  }
  await page.getByRole('button', { name: 'Frente', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}/creator-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => {
    window.brumaluz.play();
    (await import('/src/game/state.ts')).story.introArmed = false;
    (await import('/src/data/worldClock.ts')).syncWorldClock({ hour: 12, secondsPerHour: 600 });
    window.brumaluz.move(165, 0); window.brumaluz.spin(0); window.brumaluz.view(0, .12, 2.4);
  });
  await page.waitForFunction(() => document.body.classList.contains('playing') && window.brumaluz.char().root.getWorldPosition(window.brumaluz.char().root.position.clone()).y < 100);
  await page.waitForTimeout(2500);
  for (const [label, angle] of [['front', 0], ['profile', Math.PI / 2], ['back', Math.PI]]) {
    await page.evaluate(angle => window.brumaluz.spin(angle), angle); await page.waitForTimeout(600);
    await page.screenshot({ path: `${output}/game-${label}.png` });
  }
  const world = await page.evaluate(async () => ({ hair: window.brumaluz.char().d.hair, beard: window.brumaluz.char().d.beard, detail: window.brumaluz.char().d.detail,
    city: window.brumaluz.city().locationId, publishedMap: !!window.brumaluz.city().mapBounds,
    studioVisible: (await import('/src/game/stage.ts')).creatorStage.visible }));
  assert.equal(world.hair, 31); assert.equal(world.beard, 2); assert.equal(world.detail, 6); assert.equal(world.city, 'brumaluz'); assert.equal(world.publishedMap, true); assert.equal(world.studioVisible, false);
  const editor = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); editor.on('pageerror', error => errors.push(error.message));
  await editor.goto('http://127.0.0.1:4229/npcs.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await editor.waitForFunction(() => !document.getElementById('editor-controls').disabled, null, { timeout: 90000 });
  assert.equal(await editor.locator('#appearance-hair option').count(), 32);
  for (const [key, value] of Object.entries({ hair: 31, beard: 2, detail: 6 })) await editor.locator(`#appearance-${key}`).selectOption(String(value));
  await editor.getByRole('button', { name: 'Encuadrar', exact: true }).click(); await editor.waitForTimeout(700);
  await editor.screenshot({ path: `${output}/npc-editor.png` });
  assert.notEqual(await editor.locator('#status').getAttribute('data-error'), 'true');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/live.json`, JSON.stringify({ checks, world, errors }, null, 2));
  console.log(JSON.stringify({ checks, world, errors }));
} finally { await browser?.close(); await server.close(); }
