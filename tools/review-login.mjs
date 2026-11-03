import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  server: { host: '127.0.0.1', port: 4223, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Madrid', reducedMotion: 'reduce',
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  });
  await page.clock.install({ time: new Date('2026-10-28T10:00:00+01:00') });
  await page.goto('http://127.0.0.1:4223/?test&welcome&graphics=compatible');
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.locator('#loading.hide').waitFor({ state: 'attached' });
  await page.evaluate(async () => (await import('/src/ui/accountScreens.ts')).showAuthScreen());
  await page.evaluate(() => document.fonts.ready);
  await mkdir('art/login-review', { recursive: true });

  const setTime = async (time, sync = true) => {
    await page.clock.setSystemTime(new Date(`2026-10-28T${time}+01:00`));
    if (sync) await page.evaluate(async () => (await import('/src/ui/characterSelect.ts')).syncBackdropTime());
  };
  const phase = () => page.evaluate(() => document.body.classList.contains('daytime') ? 'day'
    : document.body.classList.contains('sunset') ? 'sunset' : 'night');
  const boundaries = [
    ['00:00:00', 'night'], ['06:59:59', 'night'], ['07:00:00', 'day'], ['15:59:59', 'day'],
    ['16:00:00', 'sunset'], ['19:59:59', 'sunset'], ['20:00:00', 'night'], ['23:59:59', 'night'],
  ];
  await page.locator('#auth-email').fill('viajero@example.com');
  for (const [time, expected] of boundaries) {
    await setTime(time);
    assert.equal(await phase(), expected, time);
    assert.equal(await page.locator('#auth-email').inputValue(), 'viajero@example.com');
    const visual = await page.evaluate(() => ({
      stars: getComputedStyle(document.querySelector('.account-stars')).opacity,
      day: getComputedStyle(document.querySelector('.auth-scene-day')).opacity,
      sunset: getComputedStyle(document.querySelector('.auth-scene-sunset')).opacity,
      night: getComputedStyle(document.querySelector('.auth-scene-night')).opacity,
      both: document.body.matches('.daytime.sunset'),
    }));
    assert.equal(visual.both, false);
    assert.equal(visual.stars, expected === 'night' ? '0.9' : '0');
    assert.equal(visual.day, expected === 'day' ? '1' : '0');
    assert.equal(visual.sunset, expected === 'sunset' ? '1' : '0');
    assert.equal(visual.night, expected === 'night' ? '1' : '0');
  }
  for (const [time, expected] of [['06:59:59', 'day'], ['15:59:59', 'sunset'], ['19:59:59', 'night']]) {
    await setTime(time);
    await page.clock.fastForward(60_000);
    assert.equal(await phase(), expected, `Cambio automático después de ${time}`);
  }
  const ornaments = await page.evaluate(() => ['::before', '::after'].map(pseudo => {
    const style = getComputedStyle(document.querySelector('#auth-screen'), pseudo);
    return { content: style.content, border: style.borderWidth, background: style.backgroundImage };
  }));
  for (const ornament of ornaments) {
    assert.equal(ornament.content, '"❖"');
    assert.equal(ornament.border, '0px');
    assert.equal(ornament.background, 'none');
  }
  const emblem = await page.locator('#auth-screen .account-logo-emblem').evaluate(async img => {
    await img.decode();
    const svg = new DOMParser().parseFromString(await (await fetch(img.src)).text(), 'image/svg+xml');
    return { loaded: img.naturalWidth > 0, errors: !!svg.querySelector('parsererror') };
  });
  assert.deepEqual(emblem, { loaded: true, errors: false });
  await page.locator('#auth-email').fill('');

  const shot = async name => {
    await page.screenshot({ path: `art/login-review/${name}.png`, animations: 'disabled' });
  };
  for (const [name, time] of [['day', '10:00:00'], ['sunset', '17:00:00'], ['night', '22:00:00']]) {
    await setTime(time);
    await shot(`${name}-desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(`${name}-mobile`);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await setTime('17:00:00');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1100, height: 600 }]) {
    await page.setViewportSize(viewport);
    const geometry = () => page.locator('.auth-scene-frame').evaluate(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    await page.evaluate(async () => (await import('/src/ui/accountScreens.ts')).showAuthScreen());
    const before = await geometry();
    await page.locator('[data-auth-mode="register"]').click();
    assert.deepEqual(await geometry(), before, 'Registro mantiene el encuadre de la ilustración');
    await page.locator('[data-auth-mode="login"]').click();
    await page.locator('#forgot-password').click();
    assert.deepEqual(await geometry(), before, 'Recuperación mantiene el encuadre de la ilustración');
    await page.locator('.auth-story-panel').hover();
    assert.equal(await page.locator('.auth-scene-sunset').evaluate(element => getComputedStyle(element).transform), 'none');
    await shot(`static-illustration-${viewport.width}`);
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 760, height: 600 }, { width: 1100, height: 600 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['login', 'register', 'recovery']) {
      await page.evaluate(async () => (await import('/src/ui/accountScreens.ts')).showAuthScreen());
      if (mode === 'register') await page.locator('[data-auth-mode="register"]').click();
      if (mode === 'recovery') await page.locator('#forgot-password').click();
      const submit = page.locator(mode === 'recovery' ? '#recovery-request-submit' : '#auth-submit');
      await submit.scrollIntoViewIfNeeded();
      const box = await submit.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= viewport.height, `${mode}, ${viewport.width}: submit reachable`);
      await submit.click({ trial: true });
      const layout = await page.evaluate(() => {
        const card = document.querySelector('#auth-screen').getBoundingClientRect();
        const logo = document.querySelector('#auth-screen .auth-brand').getBoundingClientRect();
        return { pageOverflow: document.documentElement.scrollWidth > innerWidth,
          logoOverflow: logo.left < card.left || logo.right > card.right };
      });
      assert.equal(layout.pageOverflow, false, `${mode}, ${viewport.width}: horizontal overflow`);
      assert.equal(layout.logoOverflow, false, `${mode}, ${viewport.width}: logo overflow`);
      await shot(`${mode}-${viewport.width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => {
    const select = await import('/src/ui/characterSelect.ts');
    select.showCharacterScreen(); select.displayCharacters([]);
  });
  assert.equal(await phase(), 'sunset');
  assert.equal(await page.locator('#account-backdrop').isVisible(), true);
  await shot('characters-sunset');
  await page.evaluate(async () => (await import('/src/ui/characterSelect.ts')).showEditor());
  assert.equal(await page.locator('#account-backdrop').isVisible(), false);
  await shot('creator');
  await page.evaluate(async () => {
    window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 },
      position: { x: 138, z: 4, yaw: 0 } });
    const { cityPopulation } = await import('/src/game/cities.ts');
    if (!cityPopulation) throw new Error('La revisión debe cargar la ciudad real');
    window.brumaluz.play();
  });
  await page.waitForFunction(() => document.body.classList.contains('playing'));
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#account-backdrop').isVisible(), false);
  await shot('game');
  assert.deepEqual(errors, []);
  const report = { boundaries: boundaries.length, automaticTransitions: 3, ornaments: 'original',
    logo: 'valid SVG', responsiveForms: 12, editorAndGame: 'passed', errors, screenshots: 'art/login-review' };
  await writeFile('art/login-review/review.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server.close();
}
