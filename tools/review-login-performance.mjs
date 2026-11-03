import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  server: { host: '127.0.0.1', port: 4224, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
let browser;
const report = [];
try {
  await server.listen();
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
  });
  for (const mode of ['normal', 'compatible']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('brumaluz-menu-music', 'off');
      localStorage.setItem('brumaluz-ambient', 'off');
      localStorage.setItem('brumaluz-language', 'es');
    });
    // La ruta normal reproduce el login real y sus efectos gráficos, sin ?test.
    await page.goto(`http://127.0.0.1:4224/?graphics=${mode}`);
    await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
    await page.locator('#loading.hide').waitFor({ state: 'attached' });
    await page.evaluate(async () => (await import('/src/ui/accountScreens.ts')).showAuthScreen());
    const snapshot = () => page.evaluate(() => ({
      frame: window.brumaluz.debug().renderer.info.render.frame,
      animationTime: window.brumaluz.char().lastT,
    }));
    const assertPaused = async label => {
      // Deja terminar el cambio de visibilidad y cualquier retrato solicitado.
      await page.waitForTimeout(100);
      const before = await snapshot();
      await page.waitForTimeout(400);
      assert.deepEqual(await snapshot(), before, `${mode}: ${label} suspende render y animación 3D`);
    };
    await assertPaused('login');
    const client = await context.newCDPSession(page);
    await client.send('Performance.enable');
    const metricsBefore = await client.send('Performance.getMetrics');
    const framesBefore = await snapshot();
    const started = performance.now();
    await page.locator('#auth-email').pressSequentially('viajero.brumaluz@example.com', { delay: 15 });
    const typingMs = performance.now() - started;
    assert.equal(await page.locator('#auth-email').inputValue(), 'viajero.brumaluz@example.com');
    await page.waitForTimeout(2500);
    const metricsAfter = await client.send('Performance.getMetrics');
    const scriptSeconds = metricsAfter.metrics.find(m => m.name === 'ScriptDuration').value
      - metricsBefore.metrics.find(m => m.name === 'ScriptDuration').value;
    assert.deepEqual(await snapshot(), framesBefore, `${mode}: escribir no activa el mundo 3D`);
    await page.locator('[data-auth-mode="register"]').click();
    await assertPaused('registro');
    await page.locator('[data-auth-mode="login"]').click();
    await page.locator('#forgot-password').click();
    await assertPaused('recuperación');
    await page.evaluate(async () => {
      const select = await import('/src/ui/characterSelect.ts');
      select.showCharacterScreen(); select.displayCharacters([]);
    });
    await assertPaused('selección de personajes');
    await page.evaluate(async () => (await import('/src/ui/characterSelect.ts')).showEditor());
    await page.waitForFunction(frame => window.brumaluz.debug().renderer.info.render.frame > frame, framesBefore.frame);
    const creator = await snapshot();
    await page.waitForTimeout(300);
    assert.ok((await snapshot()).frame > creator.frame, `${mode}: el creador vuelve a renderizar`);
    await page.evaluate(async () => (await import('/src/ui/accountScreens.ts')).showAuthScreen());
    await assertPaused('regreso al login');
    await page.evaluate(async () => {
      (await import('/src/ui/characterSelect.ts')).showEditor();
      window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 } });
      window.brumaluz.play();
    });
    const game = await snapshot();
    await page.waitForTimeout(400);
    assert.ok((await snapshot()).frame > game.frame, `${mode}: la partida vuelve a renderizar`);
    assert.deepEqual(errors, []);
    report.push({ mode, typingMs: Math.round(typingMs), scriptMs: Math.round(scriptSeconds * 1000),
      hidden3dRenders: 0, accountScreens: 'paused', creatorAndGame: 'resumed', errors });
    await context.close();
  }
  await mkdir('art/login-review', { recursive: true });
  await writeFile('art/login-review/performance.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server.close();
}
