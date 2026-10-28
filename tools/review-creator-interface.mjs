import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 4210, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off'); localStorage.setItem('brumaluz-language', 'es'); });
  await page.goto('http://127.0.0.1:4210/?test&graphics=compatible');
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.locator('#loading.hide').waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    window.brumaluz.set({ name: 'Miel', race: 'humano', face: 2, hair: 23, hairColor: 2, beard: 0, detail: 2,
      eyeShape: 10, eyeColor: 9, acc: 9, accColor: 1, clothA: 12, clothB: 7, hairAcc: 0, makeup: 0, height: .5, build: .5 });
    (await import('/src/ui/characterSelect.ts')).showEditor();
  });
  await mkdir('art/creator-studio-review', { recursive: true });
  const shot = async name => { await page.waitForTimeout(1000); await page.screenshot({ path: `art/creator-studio-review/${name}.png` }); };
  await shot('parchment-desktop');
  const tabs = await page.locator('#tabs').boundingBox(), panel = await page.locator('#panel').boundingBox();
  assert.ok(tabs.y - panel.y < 8, 'Original card starts directly with its tabs');
  await page.locator('#tabs [data-tab="rostro"]').click(); await shot('parchment-face');
  await page.locator('#tabs [data-tab="cabello"]').click();
  const catalog = page.locator('.stepper[data-key="hair"] ~ .studio-catalog').first();
  await catalog.locator('summary').click();
  await catalog.locator('button[data-value="0"]').scrollIntoViewIfNeeded();
  await catalog.locator('button[data-value="0"] canvas').waitFor({ state: 'attached' });
  await shot('parchment-catalogue'); await catalog.locator('summary').click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 760, height: 600 }]) {
    await page.setViewportSize(viewport); await page.locator('#tabs [data-tab="raza"]').click();
    await page.evaluate(() => document.getElementById('pages').scrollTop = 0);
    await shot(`parchment-mobile-${viewport.width}`);
    const card = await page.locator('#panel').boundingBox(), footer = await page.locator('#bottom').boundingBox();
    assert.ok(card.y + card.height < footer.y, 'Card and footer have separate space');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(footer.y + footer.height <= viewport.height);
  }
  assert.equal(await page.locator('.studio-toolbar, #creator-comparison, #creator-save-look').count(), 0);
  assert.deepEqual(errors, []); console.log('Simplified original card; desktop, face, catalogue and three mobile layouts reviewed.');
} finally { await browser?.close(); await server.close(); }
