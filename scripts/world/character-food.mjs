// Pruebas del mundo en el navegador: Ficha de personaje, acceso y comida.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, fixture, backend, leave } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('character sheet details stay responsive and preserve attribute drafts, limits and confirmation', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, { level: 3, health: 90, resource: 60, experience: 40, overheal: 12 });
  const player = await openPlayer(backend(), account), page = player.page;
  let confirmed = 0;
  await page.route('**/rest/v1/rpc/spend_attribute_points', route => {
    assert.deepEqual(route.request().postDataJSON().p_points, { corpulencia: 1 });
    confirmed++;
    account.character.data.attributePoints.corpulencia = 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  const openSheet = async () => {
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="sheet"]').click();
  };
  const attr = id => page.locator(`.sheet-attr[data-attribute="${id}"]`);
  try {
    await player.enter();
    await openSheet();
    assert.equal(await page.locator('.sheet-name-row strong').textContent(), 'Alric');
    assert.equal(await page.locator('.sheet-level b').textContent(), '3');
    assert.equal(await page.locator('.sheet-attr-icon svg').count(), 7);
    assert.equal(await attr('pericia').locator('.sheet-attr-description').textContent(), 'Mejora la artesanía y la alquimia: velocidad de creación y probabilidad de obtener mejores objetos.');
    assert.equal(await page.locator('.sheet-vitals h3').textContent(), 'Estado del personaje');
    assert.doesNotMatch(await page.locator('.sheet-attributes').textContent(), /Base 5|Raza \+|Asignados/);
    assert.equal(await attr('fuerza').locator('b').textContent(), '7');
    assert.equal(await page.locator('.sheet-bar.hp [role="meter"]').getAttribute('aria-valuemax'), '124');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '90 / 124');
    assert.equal(await page.locator('.sheet-bar.stamina .track span').textContent(), '60 / 92');
    assert.equal(await page.locator('.sheet-progress-note').textContent(), '480 EXP para el nivel 4');
    assert.equal(await page.locator('.sheet-overheal').count(), 0);
    assert.doesNotMatch(await page.locator('.sheet').textContent(), /Sobrecuración/);
    await attr('corpulencia').focus();
    await attr('corpulencia').hover();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#game-tooltip').isVisible(), false);
    assert.equal(await page.locator('.sheet-attr[title], .sheet-attr[data-tip]').count(), 0);
    await page.locator('.sheet-bar.hp').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Tu salud actual y máxima/);
    await page.locator('.sheet-bar.stamina').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /energía física/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).scrollIntoViewIfNeeded();
    const beforeDraftScroll = await page.locator('#window-body').evaluate(el => el.scrollTop);
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).click();
    assert.ok(Math.abs(await page.locator('#window-body').evaluate(el => el.scrollTop) - beforeDraftScroll) <= 1, 'Editing preserves the mobile reading position');
    assert.equal(await attr('corpulencia').evaluate(el => el.contains(document.activeElement)), true, 'Editing keeps keyboard focus on the attribute');
    assert.equal(await attr('corpulencia').locator('b.pending').textContent(), '6');
    assert.equal(await attr('corpulencia').locator('.sheet-draft').textContent(), '+1 sin confirmar');
    assert.equal(await page.getByRole('button', { name: 'Añadir un punto a Fuerza', exact: true }).isDisabled(), true);
    assert.equal(confirmed, 0, 'Editing a draft does not persist it');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '90 / 124', 'Drafts do not change confirmed vitals');
    await page.getByRole('button', { name: 'Quitar un punto de Corpulencia', exact: true }).click();
    assert.equal(await attr('corpulencia').locator('.sheet-draft').count(), 0);
    assert.equal(await page.locator('#window-confirm').isVisible(), false);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).click();
    await page.locator('#window-confirm').click();
    await page.waitForFunction(() => document.querySelector('.sheet-bar.hp .track span')?.textContent === '90 / 132');
    assert.equal(confirmed, 1);
    assert.equal(await page.locator('.sheet-attr-add').count(), 0);
    assert.equal(await attr('corpulencia').locator('.sheet-attr-description').textContent(), 'Aumenta la vida máxima y la resistencia al daño.');
    await page.locator('.title-button').click();
    await page.locator('.title-option').first().waitFor({ state: 'visible' });
    await page.locator('.title-button').click();
    for (const [width, height] of [[1280, 800], [768, 1024], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.locator('.sheet-window-frame').evaluate(frame => {
        const box = frame.getBoundingClientRect(), body = frame.querySelector('#window-body');
        return { fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
          noOverflow: body.scrollWidth <= body.clientWidth };
      });
      assert.ok(layout.fits && layout.noOverflow, `Sheet fits ${width}×${height}`);
      const status = page.locator('.sheet-bar.xp');
      await status.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await page.mouse.move(0, 0);
      await status.evaluate(el => el.blur());
      await status.focus();
      await page.locator('#game-tooltip').waitFor({ state: 'visible' });
      const tip = await page.locator('#game-tooltip').boundingBox();
      assert.ok(tip.x >= 0 && tip.x + tip.width <= width && tip.y >= 0 && tip.y + tip.height <= height);
      assert.equal(await page.locator('#window-close').isVisible(), true);
      if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) {
        await page.mouse.move(0, 0);
        await page.locator('#window-close').focus();
        await page.locator('#window-body').evaluate(el => el.scrollTop = 0);
        await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, `character-sheet-${width}.png`) });
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.equal(await page.locator('.sheet-vitals h3').textContent(), 'Character status');
    assert.equal(await attr('corpulencia').locator('.sheet-attr-description').textContent(), 'Increases maximum health and damage resistance.');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('character sheet handles mana, maximum level and capped attributes without empty overheal', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, { level: 50, cls: 'mago', overheal: 0, attributePoints: { fuerza: 10 } });
  const player = await openPlayer(backend(), account), page = player.page;
  try {
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await player.enter();
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="sheet"]').click();
    assert.equal(await page.locator('.sheet-progress-note').textContent(), 'Maximum level reached');
    assert.equal(await page.locator('.sheet-overheal').count(), 0);
    assert.equal(await page.locator('.sheet-bar.mana [role="meter"]').getAttribute('aria-label'), 'Mana');
    await page.locator('.sheet-bar.mana').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /magical energy/);
    assert.equal(await page.locator('.sheet-attr[data-attribute="fuerza"] b').textContent(), '15');
    assert.equal(await page.getByRole('button', { name: 'Add one point to Strength', exact: true }).isDisabled(), true);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('login remembers only the opted-in email and forgets it when unchecked', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  const page = player.page;
  try {
    await page.addInitScript(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key);
      }
    });
    await page.reload();
    const form = page.locator('#auth-form');
    await form.waitFor({ state: 'visible' });
    const email = page.locator('#auth-email'), remember = page.locator('#auth-remember');
    assert.equal(await remember.isChecked(), false);
    await email.fill('remember@example.test');
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), null);
    await remember.check();
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), 'remember@example.test');
    await page.locator('#auth-password').fill('never-save-this-password');
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), 'remember@example.test');
    assert.equal(await remember.isChecked(), true);
    assert.equal(await page.locator('#auth-password').inputValue(), '');
    assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('never-save-this-password'))), false);
    await email.fill('updated@example.test');
    await page.locator('[data-auth-mode="register"]').click();
    assert.equal(await remember.isVisible(), false);
    await page.locator('[data-auth-mode="login"]').click();
    assert.equal(await remember.isChecked(), true);
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), 'updated@example.test');
    await remember.uncheck();
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), null);
    assert.equal(await email.inputValue(), 'updated@example.test', 'Unchecking must not erase the current input');
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), '');
    assert.equal(await remember.isChecked(), false);
    await page.locator('[data-language="en"]').first().click();
    assert.equal(await page.locator('#remember-email-field span').textContent(), 'Remember me');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('bread shows a timed food buff above the action bar without healing and renews until expiry', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date('2026-10-18T12:00:00'));
  const page = player.page;
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz);
    await page.evaluate(() => {
      window.brumaluz.set({ cls: 'guerrero', health: -1, resource: -1, attributePoints: { fuerza: 2 },
        inventory: [{ id: 'pan_duro', count: 3 }] });
      window.brumaluz.play();
    });
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    await page.keyboard.press('KeyI');
    const bread = page.locator('.inv-grid [data-item-id="pan_duro"]');
    await bread.hover();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.item-tip-category').textContent(), 'Comida');
    assert.match(await page.locator('#game-tooltip').textContent(), /15 minutos de conexión/);
    assert.equal(await page.locator('.item-tip-sale b').textContent(), '2 Pelines');
    await bread.dragTo(page.locator('.ab-slot').first());
    await bread.click();
    const fedAt = await page.evaluate(() => performance.now());
    const buff = page.locator('.food-buff');
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 105');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 83');
    assert.equal(await buff.locator('span').textContent(), '15:00');
    assert.equal(await bread.locator('i').textContent(), '2');
    await page.locator('#window-close').click();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#interact-prompt').waitFor({ state: 'visible' });
      await page.waitForTimeout(300);
      const badge = await buff.boundingBox(), bar = await page.locator('#action-bar').boundingBox();
      const prompt = await page.locator('#interact-prompt').boundingBox();
      assert.ok(badge.x >= 0 && badge.x + badge.width <= width);
      assert.ok(badge.y + badge.height <= bar.y - 6, 'Buff is above, not overlapping the quick bar');
      assert.ok(prompt.y + prompt.height <= badge.y - 8, 'Interaction prompt stays above the buff row');
    }
    await page.waitForTimeout(100);
    await page.mouse.move(0, 0);
    await buff.evaluate(el => el.blur());
    await buff.focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Origen: Pan duro/);
    assert.match(await page.locator('#game-tooltip').textContent(), /se pausa al desconectarte/);
    if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, 'bread-buff.png') });
    const elapsedSinceMeal = await page.evaluate(start => performance.now() - start, fedAt);
    await page.clock.fastForward(Math.max(0, Math.floor(60000 - elapsedSinceMeal)));
    assert.equal(await buff.locator('span').textContent(), '14:00');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Digit1');
    const renewedAt = await page.evaluate(() => performance.now());
    assert.equal(await buff.locator('span').textContent(), '15:00');
    assert.equal(await page.locator('.food-buff').count(), 1, 'Renewal does not stack buffs');
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 105');
    await page.keyboard.press('KeyC');
    assert.equal(await buff.isVisible(), false, 'Buff follows the action bar visibility');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '100 / 105');
    await page.locator('#window-close').click();
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await buff.focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Source: Stale bread/);
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    const elapsedSinceRenewal = await page.evaluate(start => performance.now() - start, renewedAt);
    await page.clock.fastForward(Math.max(0, Math.floor(899000 - elapsedSinceRenewal)));
    assert.equal(await buff.locator('span').textContent(), '0:01');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 83');
    await page.clock.fastForward(1100);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#active-buffs').evaluate(el => el.hidden), true, JSON.stringify({
      errors: player.errors, timer: await buff.locator('span').allTextContents(),
      graphicsError: await page.locator('#graphics-error').isVisible(),
      playing: await page.locator('body').evaluate(el => el.classList.contains('playing')),
    }));
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 100');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 80');
    assert.equal(await buff.count(), 0);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('food timer pauses on connection failure, restores from server and ignores stale revisions', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100), world = backend();
  Object.assign(account.character.data, { foodBuff: { itemId: 'pan_duro', remaining: 600 }, foodRevision: 2 });
  const player = await openPlayer(world, account), page = player.page;
  try {
    await player.enter();
    const buff = page.locator('.food-buff');
    await buff.waitFor({ state: 'visible' });
    world.fail.add(account.user.id);
    await page.waitForFunction(() => document.querySelector('.food-buff')?.classList.contains('paused'));
    const paused = await buff.locator('span').textContent();
    await page.waitForTimeout(2200);
    assert.equal(await buff.locator('span').textContent(), paused);
    account.character.data.foodBuff.remaining = 590;
    world.fail.delete(account.user.id);
    await page.waitForFunction(() => !document.querySelector('.food-buff')?.classList.contains('paused'));
    assert.match(await buff.locator('span').textContent(), /^9:5\d$/);
    account.character.data.foodRevision = 1;
    account.character.data.foodBuff.remaining = 100;
    await page.waitForTimeout(800);
    assert.match(await buff.locator('span').textContent(), /^9:[45]\d$/, 'An old food revision cannot replace the current buff');
    account.character.data.foodRevision = 2;
    account.character.data.foodBuff.remaining = 590;
    await leave(page);
    await page.waitForTimeout(1000);
    await player.enter();
    assert.match(await buff.locator('span').textContent(), /^9:5\d$/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});
