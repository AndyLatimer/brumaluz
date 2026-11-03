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
  const inspiration = page.locator('#creator-inspiration');
  assert.equal(await page.locator('#pages #creator-inspiration').count(), 0);
  const camera = await page.locator('.studio-camera').boundingBox(), inspirationHeader = await inspiration.locator('summary').boundingBox();
  assert.ok(inspirationHeader.y > camera.y + camera.height, 'Inspiration sits below the camera and lighting');
  await inspiration.locator('summary').click();
  await inspiration.locator('.studio-preset canvas').first().waitFor({ state: 'attached' });
  await shot('inspiration-desktop');
  const pagesScroll = await page.locator('#pages').evaluate(element => element.scrollTop);
  await inspiration.locator('.studio-preset').last().scrollIntoViewIfNeeded();
  await inspiration.locator('.studio-preset').last().locator('canvas').waitFor({ state: 'attached' });
  assert.equal(await page.locator('#pages').evaluate(element => element.scrollTop), pagesScroll);
  await inspiration.locator('summary').click();
  await page.locator('#tabs [data-tab="rostro"]').click(); await shot('parchment-face');
  await page.locator('#tabs [data-tab="cabello"]').click();
  await shot('simplified-hair');
  const select = page.locator('.stepper[data-key="hair"] [role="combobox"]');
  await select.click();
  assert.equal(await page.getByRole('listbox').isVisible(), true);
  await shot('styled-select');
  await page.getByRole('option', { name: 'Rapado', exact: true }).click();
  assert.equal(await page.locator('.stepper[data-key="hair"] select').inputValue(), '0');
  for (const stepper of await page.locator('[data-page="cabello"] .stepper').all()) {
    const controls = await stepper.locator('button').all();
    const boxes = await Promise.all(controls.map(control => control.boundingBox()));
    assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1 && Math.abs(box.height - boxes[0].height) < 1), 'Arrows and selector align');
  }
  await page.locator('#tabs [data-tab="clase"]').click();
  assert.equal(await page.locator('[data-page="clase"] .swatches').count(), 0);
  await shot('simplified-class');
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 760, height: 600 }]) {
    await page.setViewportSize(viewport); await page.locator('#tabs [data-tab="cabello"]').click();
    await page.evaluate(() => document.getElementById('pages').scrollTop = 0);
    await shot(`parchment-mobile-${viewport.width}`);
    const card = await page.locator('#panel').boundingBox(), footer = await page.locator('#bottom').boundingBox();
    assert.ok(card.y + card.height < footer.y, 'Card and footer have separate space');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(footer.y + footer.height <= viewport.height);
    await inspiration.locator('summary').click();
    await inspiration.locator('.studio-inspiration-content').evaluate(element => element.scrollTop = 0);
    const inspirationBox = await inspiration.locator('.studio-inspiration-content').boundingBox();
    assert.ok(inspirationBox.x >= 0 && inspirationBox.y >= 0 && inspirationBox.x + inspirationBox.width <= viewport.width && inspirationBox.y + inspirationBox.height <= viewport.height);
    assert.ok(await page.evaluate(box => [box.y + 20, box.y + box.height - 10].every(y => document.elementFromPoint(box.x + box.width - 30, y)?.closest('#creator-inspiration')), inspirationBox), 'The open window appears above settings and the footer');
    await shot(`inspiration-mobile-${viewport.width}`);
    await inspiration.locator('summary').click();
    await select.click();
    const menu = await page.getByRole('listbox').boundingBox();
    assert.ok(menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= viewport.width && menu.y + menu.height <= viewport.height);
    await shot(`styled-select-mobile-${viewport.width}`);
    await page.keyboard.press('Escape');
  }
  assert.equal(await page.locator('.studio-toolbar, #creator-comparison, #creator-save-look, .studio-lock, .studio-subnav, .studio-catalog').count(), 0);
  assert.deepEqual(errors, []); console.log('Simplified fields, aligned arrows, styled selectors and class controls reviewed on desktop and three mobile layouts.');
} finally { await browser?.close(); await server.close(); }
