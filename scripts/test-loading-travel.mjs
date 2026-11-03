import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browser, url } from './world/harness.mjs';

test('published world uses contextual engravings when entering and leaving a real workshop', { timeout: 180000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  });
  try {
    await page.goto(`${url}/?test&welcome&graphics=compatible`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 90000 });
    assert.equal(await page.locator('#loading .crest').textContent(), '✦');
    assert.equal(await page.locator('#loading img').count(), 0);
    await page.locator('#loading').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      window.loadingTravelScreens = [];
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.matches('.map-transition')) {
            window.loadingTravelScreens.push({
              art: node.dataset.art,
              title: node.querySelector('.loading-title').textContent,
              image: node.querySelector('.loading-illustration').getAttribute('src'),
              sourceLocation: window.brumaluz.city().locationId,
            });
          }
        }
      }).observe(document.body, { childList: true });
      window.brumaluz.set({ introSeen: true, welcome: { origin: 0, stage: 'completed' } });
      window.brumaluz.play();
    });
    await page.locator('body.playing').waitFor();
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const portal = window.brumaluz.city().portals.find(portal => portal.target?.map === 'taller_herreria_interior');
      if (!portal) throw new Error('Published capital has no smithy portal');
      window.brumaluz.move(portal.position.x, portal.position.z);
    });
    await page.locator('#interact-prompt').waitFor({ state: 'visible' });
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.brumaluz.city().locationId === 'taller_herreria_interior', null, { timeout: 45000 });
    await page.waitForFunction(() => !document.querySelector('.map-transition'));
    const entered = await page.evaluate(() => window.loadingTravelScreens[0]);
    assert.equal(entered.art, 'forge');
    assert.match(entered.image, /^(?:data:image\/svg\+xml|.*\/forge-[^/]+\.svg$)/);
    assert.equal(entered.sourceLocation, 'brumaluz', 'The illustration is visible before switching worlds');
    assert.match(entered.title, /Forja/);
    await page.evaluate(() => {
      const portal = window.brumaluz.city().portals.find(portal => portal.target?.map === 'brumaluz');
      if (!portal) throw new Error('Published smithy has no exit');
      window.brumaluz.move(portal.position.x, portal.position.z);
    });
    await page.locator('#interact-prompt').waitFor({ state: 'visible' });
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.brumaluz.city().locationId === 'brumaluz', null, { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('.map-transition'));
    const screens = await page.evaluate(() => window.loadingTravelScreens);
    assert.equal(screens.length, 2);
    assert.equal(screens[1].art, 'city');
    assert.match(screens[1].image, /^(?:data:image\/svg\+xml|.*\/city-[^/]+\.svg$)/);
    assert.equal(screens[1].sourceLocation, 'taller_herreria_interior');
    assert.equal(screens[1].title, 'Brumaluz');
    assert.equal(await page.locator('#toast.error.show').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
