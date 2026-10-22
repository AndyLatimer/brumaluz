// Pruebas del mundo en el navegador: Pociones, tooltips de objetos, canales del chat y sobrecuración.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, fixture, backend, chatReady } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('potion shop fits desktop and mobile and local resource potions enforce class and caps', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz);
    await page.evaluate(() => {
      window.brumaluz.set({ cls: 'mago', resource: 10, health: -1, wallet: { pelines: 100 }, inventory: [] });
      window.brumaluz.play();
    });
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    const shop = async () => {
      await page.evaluate(() => { const p = window.brumaluz.city().npcSites[0].position; window.brumaluz.move(p.x, p.z + 0.6); });
      await page.keyboard.press('KeyE');
      await page.locator('.dialog-choice').filter({ hasText: 'Comerciar' }).click();
    };
    await shop();
    assert.equal(await page.locator('.vendor-col').first().locator('.vendor-row').count(), 4);
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.locator('#window-body').evaluate(el => el.scrollWidth <= el.clientWidth), `Commerce fits ${width}px`);
      const row = page.locator('.vendor-col').first().locator('[data-item-id="pocion_mana_minuscula"]');
      await row.scrollIntoViewIfNeeded();
      await row.hover();
      await page.locator('#game-tooltip').waitFor({ state: 'visible' });
      assert.match(await page.locator('#game-tooltip').textContent(), /5 % de tu maná máximo/);
      if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, `commerce-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    const stock = id => page.locator('.vendor-col').first().locator(`[data-item-id="${id}"] button`);
    await stock('pocion_mana_minuscula').click();
    await stock('pocion_estamina_minuscula').click();
    assert.equal(await page.locator('.vendor-banner .currency b').textContent(), '80');
    await page.locator('#window-close').click();
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_mana_minuscula"]').click();
    assert.equal(await page.locator('#hud-resource-text').textContent(), '14 / 65');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.match(await page.locator('#toast').textContent(), /no corresponde/);
    assert.match(await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').getAttribute('aria-label'), /1 unidades/);
    await page.locator('#window-close').click();
    await page.evaluate(() => window.brumaluz.set({ cls: 'guerrero', resource: 79 }));
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 80');
    await page.locator('#window-close').click();
    await shop();
    await stock('pocion_estamina_minuscula').click();
    await page.locator('#window-close').click();
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.match(await page.locator('#toast').textContent(), /recurso completo/);
    assert.match(await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').getAttribute('aria-label'), /1 unidades/);
    await page.locator('#window-close').click();
    await shop();
    const purse = page.locator('.vendor-banner .currency b');
    const beforeSale = Number(await purse.textContent());
    await page.locator('.vendor-col').nth(1).locator('[data-item-id="pocion_estamina_minuscula"] button').click();
    assert.equal(Number(await purse.textContent()), beforeSale + 5);
    assert.equal(await page.locator('.vendor-empty').isVisible(), true);
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.equal(await page.locator('.vendor-banner strong').textContent(), 'Provisions for the road');
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.locator('#window-close').click();
    await page.evaluate(() => window.brumaluz.set({ wallet: { pelines: 0 } }));
    await shop();
    assert.equal(await page.locator('.vendor-col').first().locator('button:disabled').count(), 4);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory item cards share tooltips with equipment, action bar and vendor without changing use or drag', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, {
    health: 60, wallet: { pelines: 100, lagrimas: 0 },
    inventory: [{ id: 'pocion_vida_minuscula', count: 3 }],
    equipment: { head: { id: 'pocion_vida_minuscula', count: 1 } },
  });
  const player = await openPlayer(backend(), account);
  const page = player.page;
  let used = 0;
  await page.route('**/rest/v1/rpc/use_item', route => {
    assert.equal(route.request().postDataJSON().p_slot, 0);
    used++;
    account.character.data.health += 5;
    account.character.data.inventory[0].count--;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  const tooltip = page.locator('#game-tooltip');
  async function inspect(target) {
    await page.mouse.move(0, 0);
    await target.hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.locator('.item-tip-name').textContent(), 'Poción de vida minúscula');
    assert.equal(await tooltip.locator('.item-tip-category').textContent(), 'Consumible');
    assert.equal(await tooltip.locator('.item-tip-effects li').textContent(), 'Restaura un 5 % de tu vida máxima.');
    assert.match(await tooltip.locator('.item-tip-description').textContent(), /pequeño frasco/);
    assert.equal(await tooltip.locator('.item-tip-sale b').textContent(), '5 Pelines');
    assert.equal(await tooltip.locator('.item-tip-sale small').count(), 0);
    assert.doesNotMatch(await tooltip.textContent(), /Apilable|por unidad/);
    assert.equal(await tooltip.locator('.item-tip-stats').count(), 0, 'Do not invent equipment stats for a potion');
    assert.equal(await target.getAttribute('title'), null);
    assert.equal(await target.getAttribute('aria-describedby'), 'game-tooltip');
    await page.waitForTimeout(180);
    const anchor = await target.boundingBox(), card = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    if (anchor.x + anchor.width + 10 + card.width <= viewport.width - 6) {
      assert.ok(Math.abs(card.x - anchor.x - anchor.width - 10) <= 1, 'Item tooltip anchors to the right with a small gap');
    } else if (anchor.x - 10 - card.width >= 6) {
      assert.ok(Math.abs(card.x + card.width + 10 - anchor.x) <= 1, 'Item tooltip flips to the left near the right edge');
    }
    assert.ok(card.x + card.width <= anchor.x || card.x >= anchor.x + anchor.width
      || card.y + card.height <= anchor.y || card.y >= anchor.y + anchor.height, 'Tooltip must not cover its item');
    return tooltip.textContent();
  }
  try {
    await player.enter();
    await page.keyboard.press('KeyI');
    const item = page.locator('.inv-grid [data-item-id]').first();
    assert.equal(await page.locator('.inv-grid .inv-slot:not(.locked)').count(), 25);
    assert.equal(await page.locator('.inv-capacity').textContent(), '1 / 25');
    assert.equal(await page.locator('.inv-purse .currency').count(), 2);
    assert.ok((await page.locator('.inv-purse').boundingBox()).height <= 42, 'Desktop purse stays compact');
    assert.equal(await page.locator('.equip-art').count(), 9);
    assert.equal(await item.locator('b').count(), 0, 'Keep slot contents uncluttered');
    const expected = await inspect(item);
    const coinStyle = icon => icon.evaluate(svg => {
      const properties = ['fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'filter'];
      return [svg, ...svg.children].map(part => Object.fromEntries(properties.map(key => [key, getComputedStyle(part)[key]])));
    });
    assert.deepEqual(await coinStyle(tooltip.locator('.currency-icon-pelines')),
      await coinStyle(page.locator('.inv-purse .currency-icon-pelines')),
      'Tooltip and purse must use identical coin artwork styling');
    assert.equal(await inspect(page.locator('.inv-slot.equip.filled')), expected);
    const portrait = page.locator('.doll-portrait');
    const before = await portrait.evaluate(canvas => canvas.toDataURL());
    const stage = await page.locator('.doll-stage').boundingBox();
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width / 2 + 45, stage.y + stage.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(previous => document.querySelector('.doll-portrait').toDataURL() !== previous, before);
    await item.dragTo(page.locator('.ab-slot').first());
    assert.equal(used, 0, 'Dragging must not consume a potion');
    assert.equal(await inspect(page.locator('.ab-slot.filled')), expected);
    await item.click();
    await page.waitForFunction(() => document.querySelector('.inv-grid [data-item-id] i')?.textContent === '2');
    await tooltip.waitFor({ state: 'hidden' });
    assert.equal(used, 1);
    assert.equal(await page.locator('#hud-health-text').textContent(), '65 / 100');
    assert.equal(await page.locator('.ab-slot.filled i').textContent(), '2');
    await page.locator('.currency.pelines').hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.evaluate(el => el.classList.contains('item-tooltip')), false, 'Generic tooltips keep their short format');
    assert.equal(await tooltip.locator('strong').textContent(), 'Pelines');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-choice').filter({ hasText: 'Comerciar' }).click();
    const stock = page.locator('.vendor-col').first().locator('.vendor-row').first();
    const owned = page.locator('.vendor-col').nth(1).locator('.vendor-row');
    assert.equal(await inspect(stock), expected);
    assert.equal(await stock.locator('.vendor-price b').textContent(), '10', 'Buy price remains unchanged');
    assert.equal(await inspect(owned), expected);
    assert.equal(await owned.locator('.vendor-price b').textContent(), '5');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory and item tooltips fit narrow viewports, support focus and translate content', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  account.character.data.inventory = [{ id: 'pocion_vida_minuscula', count: 99 }];
  const player = await openPlayer(backend(), account);
  const page = player.page;
  try {
    await player.enter();
    await page.keyboard.press('KeyI');
    const item = page.locator('.inv-grid [data-item-id]');
    const tooltip = page.locator('#game-tooltip');
    for (const size of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      await item.scrollIntoViewIfNeeded();
      const layout = await page.locator('.inv').evaluate(el => ({
        width: el.clientWidth, content: el.scrollWidth,
        gridWidth: el.querySelector('.inv-grid').clientWidth, gridContent: el.querySelector('.inv-grid').scrollWidth,
        slots: [...el.querySelectorAll('.inv-grid .inv-slot:not(.locked)')].map(slot => slot.getBoundingClientRect().width),
      }));
      assert.ok(layout.content <= layout.width + 1, JSON.stringify({ size, layout }));
      assert.ok(layout.gridContent <= layout.gridWidth + 1, JSON.stringify({ size, layout }));
      assert.ok(layout.slots.every(width => width >= 30), JSON.stringify({ size, layout }));
      await page.mouse.move(0, 0);
      await item.evaluate(el => el.blur());
      await item.focus();
      await tooltip.waitFor({ state: 'visible' });
      const box = await tooltip.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height, JSON.stringify({ size, box }));
      assert.equal(await item.getAttribute('aria-describedby'), 'game-tooltip');
    }
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await tooltip.waitFor({ state: 'hidden' });
    await page.mouse.move(0, 0);
    await item.hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.locator('.item-tip-name').textContent(), 'Minuscule health potion');
    assert.equal(await tooltip.locator('.item-tip-category').textContent(), 'Consumable');
    assert.equal(await tooltip.locator('.item-tip-effects li').textContent(), 'Restores 5% of your maximum health.');
    assert.match(await tooltip.locator('.item-tip-description').textContent(), /little glass bottle/);
    assert.match(await tooltip.locator('.item-tip-sale').textContent(), /Sell value5 Pelines/);
    assert.doesNotMatch(await tooltip.textContent(), /Stackable|per unit/);
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    assert.equal(await item.getAttribute('aria-describedby'), null);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('party and zone chat use distinct colors across messages, tags, filters and channel selector', { timeout: 120000 }, async () => {
  const world = backend(), account = fixture('Alric', 'humano', 100);
  const player = await openPlayer(world, account);
  const page = player.page;
  try {
    await player.enter();
    await chatReady(world, account);
    for (const [index, channel] of ['zone', 'party'].entries()) {
      world.chatSockets.get(account.user.id)({
        id: index + 1, channel, zone: 'brumaluz', sender_user: account.user.id,
        sender_name: 'Alric', sender_account: 'Alric', sender_title: 'recien_llegado',
        created_at: new Date().toISOString(), body: `${channel} color check`,
      });
    }
    await page.locator('.chat-log .k-party').waitFor({ state: 'attached' });
    const colors = await page.evaluate(() => {
      const color = selector => getComputedStyle(document.querySelector(selector)).color;
      return {
        party: color('.chat-line.k-party'), partyTag: color('.chat-line.k-party .chat-tag'),
        zone: color('.chat-line.k-zone'), zoneTag: color('.chat-line.k-zone .chat-tag'),
        partyFilter: color('.chat-filter[data-kind="party"]'),
      };
    });
    assert.equal(colors.party, 'rgb(242, 183, 129)');
    assert.equal(colors.partyTag, colors.party);
    assert.equal(colors.partyFilter, colors.party);
    assert.equal(colors.zone, 'rgb(207, 234, 255)');
    assert.equal(colors.zoneTag, 'rgb(159, 216, 255)');
    await page.keyboard.press('Enter');
    await page.locator('.chat-channel').click();
    await page.waitForFunction(() => document.querySelector('.chat-channel').dataset.channel === 'zone');
    await page.locator('.chat-channel').click();
    assert.equal(await page.locator('.chat-channel').getAttribute('data-channel'), 'party');
    assert.equal(await page.locator('.chat-channel').evaluate(el => getComputedStyle(el).color), colors.party);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('NPC interactions stay out of chat while spontaneous nearby barks remain', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date(2026, 9, 18, 12));
  const page = player.page;
  try {
    await player.enter();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-choice').filter({ hasText: /^\s*1\.\s*Hola$/ }).click();
    await page.locator('.dialog-text').filter({ hasText: '¡Hola! Si estás leyendo esto' }).waitFor();
    const log = page.locator('.chat-log');
    assert.doesNotMatch(await log.textContent(), /¡Saludos, viajero!|¡Hola! Si estás leyendo esto|Hola/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.clock.fastForward(84_000);
    assert.match(await log.textContent(), /¿Alguien ha visto mi documentación|Psst, viajero|Un día más depurando/);
    assert.match(await log.textContent(), /Testículos, the Debugger/);
    assert.doesNotMatch(await log.textContent(), /¡Saludos, viajero!|¡Hola! Si estás leyendo esto/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('damage absorbed by overheal preserves full-health sentinel and only zero health kills', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  account.character.data.overheal = 25;
  const player = await openPlayer(backend(), account);
  const page = player.page;
  const results = [
    { health: -1, overheal: 15 },
    { health: -1, overheal: 0 },
    { health: 94, overheal: 0 },
    { health: 0, overheal: 0 },
  ];
  let calls = 0;
  await page.route('**/rest/v1/rpc/debug_damage', route => {
    Object.assign(account.character.data, results[calls++]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  try {
    await player.enter();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    const damage = page.locator('.dialog-choice').filter({ hasText: 'Recibir 10 puntos de daño' });
    await damage.waitFor({ state: 'visible' });
    for (let i = 0; i < results.length; i++) {
      await damage.click();
      await page.waitForFunction(expected => document.querySelector('#hud-health-text').textContent.startsWith(expected), `${results[i].health < 0 ? 100 : results[i].health} / 100`);
      assert.equal(await page.locator('#death-screen').isVisible(), i === 3, `Damage result ${i} must only kill at zero health`);
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dead')), i === 3);
    }
    assert.equal(calls, 4);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});
