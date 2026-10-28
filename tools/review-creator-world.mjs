import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Review the actual published city, using local test access without account writes.
const hair = Number(process.argv[2] ?? 22);
const expressions = process.argv.includes('--expressions');
if (!Number.isInteger(hair) || hair < 0 || hair > 27) throw new Error('Invalid hairstyle');
const server = await createServer({ server: { host: '127.0.0.1', port: 4208, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off'); localStorage.setItem('brumaluz-language', 'es');
  });
  await page.goto('http://127.0.0.1:4208/?test&welcome&graphics=compatible', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.locator('#loading.hide').waitFor({ state: 'attached', timeout: 180000 });
  await page.evaluate(async ({ hair, expressions }) => {
    const { withAccessoryLayer } = await import('/src/character/head/accessoryLayers.ts');
    let acc = withAccessoryLayer(0, 'eyewear', 11); acc = withAccessoryLayer(acc, 'neckwear', 12); acc = withAccessoryLayer(acc, 'earrings', 13);
    window.brumaluz.set({ name: 'Miel', race: 'elfo', detail: 179, hair, hairColor: 2,
      ...(expressions ? { eyeShape: 8, brows: 6, mouth: 8 } : {}),
      acc, accColor: 1, clothA: 14, clothB: 7, introSeen: true, welcome: { origin: 0, stage: 'completed' } });
    window.brumaluz.play();
    const state = await import('/src/game/state.ts'); state.story.introArmed = false;
    (await import('/src/data/worldClock.ts')).syncWorldClock({ hour: 12, secondsPerHour: 600 });
    window.brumaluz.move(165, 0);
    window.brumaluz.spin(0); window.brumaluz.view(0, .15, expressions ? 2.2 : 4.5);
  }, { hair, expressions });
  await page.waitForFunction(() => document.body.classList.contains('playing') && window.brumaluz.char().d.detail === 179);
  await page.waitForTimeout(2500);
  const report = await page.evaluate(async () => {
    const { creatorStage } = await import('/src/game/stage.ts');
    return { detail: window.brumaluz.char().d.detail, hair: window.brumaluz.char().d.hair, acc: window.brumaluz.char().d.acc, race: window.brumaluz.char().d.race,
      city: window.brumaluz.city().locationId, studioVisible: creatorStage.visible,
      worldY: window.brumaluz.char().root.getWorldPosition(window.brumaluz.char().root.position.clone()).y };
  });
  assert.equal(report.detail, 179); assert.equal(report.race, 'elfo');
  assert.equal(report.hair, hair); assert.ok(report.acc > 13);
  assert.equal(report.city, 'brumaluz'); assert.equal(report.studioVisible, false); assert.ok(report.worldY < 100);
  assert.deepEqual(errors, []);
  await mkdir('art/creator-studio-review', { recursive: true });
  await page.screenshot({ path: `art/creator-studio-review/${expressions ? 'published-expressions' : process.argv[2] ? `published-hair-${hair}` : 'published-city'}.png` });
  if (process.argv[2]) {
    await page.evaluate(() => window.brumaluz.spin(Math.PI));
    await page.screenshot({ path: `art/creator-studio-review/${expressions ? 'published-expressions' : `published-hair-${hair}`}-back.png` });
    const editor = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    editor.on('pageerror', error => errors.push(error.message));
    await editor.goto('http://127.0.0.1:4208/npcs.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await editor.waitForFunction(() => !document.getElementById('editor-controls').disabled, null, { timeout: 90000 });
    await editor.locator('#appearance-hair').selectOption(String(hair));
    if (expressions) {
      await editor.locator('#appearance-eyeShape').selectOption('5');
      await editor.locator('#appearance-brows').selectOption('4');
      await editor.locator('#appearance-mouth').selectOption('4');
    }
    await editor.getByRole('button', { name: 'Encuadrar', exact: true }).click();
    await editor.screenshot({ path: `art/creator-studio-review/${expressions ? 'editor-expressions' : `editor-hair-${hair}`}.png` });
    const canvas = await editor.locator('#scene').boundingBox();
    const x = canvas.x + canvas.width * .25, y = canvas.y + canvas.height * .4;
    await editor.mouse.move(x, y); await editor.mouse.down();
    await editor.mouse.move(x + canvas.height / 2, y, { steps: 16 }); await editor.mouse.up();
    await editor.waitForTimeout(500);
    await editor.screenshot({ path: `art/creator-studio-review/${expressions ? 'editor-expressions' : `editor-hair-${hair}`}-back.png` });
    await editor.close(); assert.deepEqual(errors, []);
  }
  console.log(JSON.stringify(report));
} finally { await browser?.close(); await server.close(); }
