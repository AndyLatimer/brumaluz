// Comportamiento de los avisos con las conversaciones reales, sin conexión al servidor.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stripVTControlCharacters } from 'node:util';
import { join } from 'node:path';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4188';
let server, browser;
before(async () => {
  // A long dialogue check must not reset to the creator if another development task saves a file.
  server = spawn(process.execPath, ['--input-type=module', '-e', `
    const { createServer } = await import('vite');
    const server = await createServer({ cacheDir: 'node_modules/.vite-story-notices', server: { host: '127.0.0.1', port: 4188, strictPort: true, hmr: false, watch: null } });
    await server.listen(); server.printUrls();
  `]);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Story preview did not start')), 15000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Story preview exited: ${code}`)));
    server.stdout.on('data', data => {
      if (stripVTControlCharacters(String(data)).includes(url)) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', data => process.stderr.write(data));
  });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
});

test('notice deduplication also protects chat, preserves severity and counts translated reading time', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  try {
    await page.route(`${url}/__notice-test`, route => route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="toast" aria-hidden="true"></div><div id="chat"><div class="chat-log"></div></div>' }));
    await page.goto(`${url}/__notice-test`);
    await page.clock.install();
    await page.evaluate(async () => {
      await import('/src/styles/style.css');
      window.notices = await import('/src/ui/toast.ts');
      notices.clearToasts();
      notices.toast('Aviso', '{a} {b}', false, { a: 'Texto', b: 'repetido' });
      notices.toast('Aviso', '{a} {b}', false, { b: 'repetido', a: 'Texto' });
    });
    assert.equal(await page.locator('#chat .chat-line').count(), 1, 'Object property order does not duplicate history');
    await page.evaluate(() => notices.toast('Aviso', '{a} {b}', true, { a: 'Texto', b: 'repetido' }));
    await page.clock.runFor(150);
    assert.equal(await page.locator('#toast').getAttribute('role'), 'alert', 'A matching error still takes priority over an ordinary notice');
    assert.equal(await page.locator('#chat .chat-line').count(), 2);
    await page.locator('.toast-dismiss').click();
    assert.equal(await page.locator('#toast').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('#toast').evaluate(el => el.inert), true, 'A hidden close button cannot remain in the tab order');
    await page.mouse.move(0, 0);
    await page.clock.runFor(400);
    assert.equal(await page.locator('#toast').getAttribute('role'), 'status', 'The interrupted ordinary notice resumes');
    await page.locator('.toast-dismiss').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#toast').getAttribute('aria-hidden'), 'true', 'The dismiss action is usable by keyboard');

    await page.evaluate(() => {
      notices.clearToasts();
      notices.toast('Aviso', '{long}', false, { long: 'Una explicación que necesita tiempo. '.repeat(15) });
    });
    await page.clock.runFor(4000);
    assert.equal(await page.locator('#toast.show').count(), 1, 'Placeholders use the visible text length, not the short source key');
    for (const [width, height] of [[320, 360], [390, 800], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.locator('#toast').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
          && el.scrollWidth <= el.clientWidth;
      }), `A long notice fits the ${width} × ${height} viewport`);
    }
    const beforePause = await page.locator('#toast').evaluate(el => Number(el.style.getPropertyValue('--toast-progress')));
    await page.locator('#toast').hover();
    await page.clock.runFor(5000);
    const duringPause = await page.locator('#toast').evaluate(el => Number(el.style.getPropertyValue('--toast-progress')));
    assert.ok(Math.abs(beforePause - duringPause) < .02, 'Hovering pauses the reading clock');
    await page.mouse.move(0, 0);
    await page.clock.fastForward(60_000);
    assert.equal(await page.locator('#toast.show').count(), 1, 'A suspended browser timer does not consume an unseen minute');
    await page.evaluate(() => notices.clearToasts());
    await page.clock.runFor(1000);
    assert.equal(await page.locator('#toast').textContent(), '');
  } finally { await page.close(); }
});

test('notices wait for dialogue, prioritise errors, preserve reading time and drain without duplicates', { timeout: 90000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      localStorage.setItem('brumaluz-language', 'es');
      localStorage.setItem('brumaluz-ambient', 'off');
      localStorage.setItem('brumaluz-menu-music', 'off');
    });
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 60000 });
    await page.bringToFront();
    await page.evaluate(() => window.brumaluz.play());
    await page.evaluate(async () => {
      const { toast, clearToasts } = await import('/src/ui/toast.ts');
      const { openConversation } = await import('/src/ui/dialog.ts');
      clearToasts();
      openConversation({ speaker: 'Gnomi', emblem: 'guild', start: 'intro', nodes: { intro: { text: 'Una conversación pendiente.' } } });
      toast('Primer encargo', 'Gnomi va contigo.', false, {}, 'quest');
      toast('Primer encargo', 'Gnomi va contigo.', false, {}, 'quest');
      toast('Una recompensa', 'El viaje continúa.', false, {}, 'reward');
    });
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#toast.show').isVisible(), false, 'Ordinary notices wait for the dialogue');
    await page.evaluate(async () => (await import('/src/ui/toast.ts')).toast('No se pudo completar la acción', 'Puedes reintentarlo.', true));
    await page.locator('#toast.show.error').waitFor();
    assert.equal(await page.locator('#toast').getAttribute('role'), 'alert', 'Action errors are announced immediately');
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      assert.ok(await page.locator('#toast').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && el.scrollWidth <= el.clientWidth;
      }), `The notice fits ${width}px`);
    }
    await page.evaluate(async () => (await import('/src/ui/dialog.ts')).closeDialog());
    await page.locator('#toast.show h2').filter({ hasText: 'Primer encargo' }).waitFor();
    if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, 'notice-quest.png') });
    await page.evaluate(async () => (await import('/src/ui/dialog.ts')).openConversation({
      speaker: 'Gnomi', start: 'intro', nodes: { intro: { text: 'Vamos a terminar de hablar.' } },
    }));
    await page.waitForTimeout(4000);
    assert.equal(await page.locator('#toast').isVisible(), false, 'An active notice gets out of the conversation shot');
    assert.ok(await page.locator('#toast').evaluate(el => Number(el.style.getPropertyValue('--toast-progress')) > .7), 'Its reading time pauses during dialogue');
    await page.evaluate(async () => (await import('/src/ui/dialog.ts')).closeDialog());
    await page.locator('#toast.show h2').filter({ hasText: 'Primer encargo' }).waitFor();
    await page.locator('#toast.show h2').filter({ hasText: 'Una recompensa' }).waitFor();
    assert.equal(await page.locator('#toast').getAttribute('data-kind'), 'reward');
    if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, 'notice-reward.png') });
    await page.evaluate(async () => (await import('/src/ui/i18n.ts')).setLanguage('en'));
    assert.equal(await page.locator('.toast-body > small').textContent(), 'Quest complete');
    await page.locator('#toast.show').waitFor({ state: 'hidden' });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#toast.show').count(), 0, 'Duplicates never add another notice');
    await page.evaluate(async () => {
      const { toast, clearToasts } = await import('/src/ui/toast.ts');
      toast('Aviso anterior', 'Ya no pertenece a esta partida.');
      toast('Otro aviso anterior', 'Tampoco.');
      clearToasts();
    });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#toast').textContent(), '', 'Changing session clears active and pending notices');
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error(await page.evaluate(() => ({ body: document.body.className, hidden: document.hidden,
      toast: document.querySelector('#toast').outerHTML, dialog: document.querySelector('#dialog').hidden })));
    throw error;
  } finally { await context.close(); }
});
