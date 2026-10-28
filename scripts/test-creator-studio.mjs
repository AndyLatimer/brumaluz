import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;
const errors = [];
before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 4199, strictPort: true, hmr: false }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  });
  await page.goto('http://127.0.0.1:4199/?test&graphics=compatible');
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'));
  await page.evaluate(async () => (await import('/src/ui/characterSelect.ts')).showEditor());
  await mkdir('art/creator-studio-review', { recursive: true });
}, { timeout: 240000 });
after(async () => { await browser?.close(); await server?.close(); });

async function portrait(catalog, value) {
  const option = catalog.locator(`.studio-option-grid button[data-value="${value}"]`);
  await option.scrollIntoViewIfNeeded();
  await option.locator('canvas').waitFor({ state: 'attached' });
  return option.locator('canvas');
}
async function historyKey(key) {
  await page.locator('#tabs [aria-selected="true"]').focus();
  await page.keyboard.press(key);
}

test('all sections omit the removed toolbar, saved looks, editing tools and comparison', async () => {
  for (const tab of ['raza', 'rostro', 'cabello', 'ropa', 'clase']) {
    await page.locator(`#tabs [data-tab="${tab}"]`).click();
    assert.equal(await page.locator('.studio-toolbar, .studio-heading, #creator-vary, #creator-save-look, #creator-comparison, .studio-slots').count(), 0);
    const text = await page.locator('#pages').textContent();
    assert.doesNotMatch(text, /Tus apariencias|Herramientas de edición|Comparar diseños|Variar sección/);
  }
});

test('variations preserve progression, name, assigned points and locked choices', async () => {
  const failures = await page.evaluate(async () => {
    const { defaultChar, sanitize, RACES } = await import('/src/data/data.ts');
    const { varyLook, captureLook, applyLook, CreatorHistory } = await import('/src/data/creatorStudio.ts');
    const data = sanitize({ ...defaultChar(), race: 'pelso', name: 'Miel', level: 9, experience: 12,
      attributePoints: { agilidad: 2 }, skin: 9, hair: 21, detail: 17 });
    const failures = [];
    for (let i = 0; i < 100; i++) {
      const next = varyLook(data, 'all', new Set(['race', 'skin', 'hair', 'detail']));
      for (const key of ['race', 'skin', 'hair', 'detail', 'name', 'level', 'experience', 'attributePoints', 'equipment', 'welcome'])
        if (JSON.stringify(next[key]) !== JSON.stringify(data[key])) failures.push(`lost ${key}`);
      if (next.trait >= RACES.pelso.traits.length) failures.push('invalid trait');
      const face = varyLook(data, 'rostro', new Set());
      if (face.hair !== data.hair || face.race !== data.race || face.cls !== data.cls) failures.push('section leaked');
    }
    const malicious = applyLook(data, { ...captureLook(defaultChar()), level: 50, name: 'Other', wallet: { gold: 999 } });
    if (malicious.level !== 9 || malicious.name !== 'Miel') failures.push('look changed identity/progression');
    const history = new CreatorHistory(); history.reset(data);
    history.record({ ...data, hair: 3 }); history.record({ ...data, hair: 4 });
    let current = history.move(data, -1);
    if (current.hair !== 3) failures.push('undo');
    current = history.move(current, 1); if (current.hair !== 4) failures.push('redo');
    history.move(current, -1); history.record({ ...data, hair: 5 });
    if (history.canRedo) failures.push('branch retained');
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('all 180 layered combinations round trip through character and NPC validation without changing legacy IDs', async () => {
  const failures = await page.evaluate(async () => {
    const { DETAIL_LAYERS, detailSelection, detailParts, withDetailLayer, DETAILS } = await import('/src/character/head/detailLayers.ts');
    const { defaultChar, sanitize } = await import('/src/data/data.ts');
    const { newNpc, npcAppearance, validateNpc } = await import('/src/data/npcs.ts');
    const errors = [], seen = new Set();
    for (const a of [0, 2, 6]) for (const b of [0, 3, 9]) for (const c of [0, 7, 8, 10, 4]) for (const d of [0, 5]) for (const e of [0, 1]) {
      const expected = { freckles: a, scar: b, mark: c, mole: d, blush: e };
      let id = 0;
      for (const layer of DETAIL_LAYERS) id = withDetailLayer(id, layer.key, expected[layer.key]);
      seen.add(id);
      if (JSON.stringify(detailSelection(id)) !== JSON.stringify(expected)) errors.push(`layers ${id}`);
      if (sanitize({ ...defaultChar(), detail: id }).detail !== id) errors.push(`sanitize ${id}`);
      const npc = newNpc('layers_test'); npc.appearance = npcAppearance({ ...defaultChar(), detail: id }); validateNpc(npc);
      if (npc.appearance.detail !== id) errors.push(`npc ${id}`);
    }
    if (seen.size !== 180 || DETAILS.length !== 180) errors.push(`coverage ${seen.size}/${DETAILS.length}`);
    for (const [id, parts] of [[11, [2, 1]], [12, [2, 9]], [13, [7, 5]], [16, [10, 3]], [17, [2, 5]]])
      if (JSON.stringify(detailParts(id)) !== JSON.stringify(parts)) errors.push(`legacy ${id}`);
    // Adding freckles to an old constellation + mole must keep both marks.
    const legacy = withDetailLayer(13, 'freckles', 6);
    if (![5, 6, 7].every(part => detailParts(legacy).includes(part))) errors.push('legacy composition lost');
    return errors;
  });
  assert.deepEqual(failures, []);
});

test('200 accessory combinations preserve each independent choice and all original appearance IDs', async () => {
  const failures = await page.evaluate(async () => {
    const { ACCESSORY_LAYERS, ACCESSORIES, accessorySelection, accessoryParts, withAccessoryLayer, hasTravelerMask } = await import('/src/character/head/accessoryLayers.ts');
    const { defaultChar, sanitize } = await import('/src/data/data.ts');
    const { newNpc, npcAppearance, validateNpc } = await import('/src/data/npcs.ts');
    const failures = [], seen = new Set();
    for (const eyewear of [0, 1, 5, 10, 11]) for (const neckwear of [0, 2, 3, 12]) for (const earrings of [0, 4, 8, 9, 13]) for (const mask of [0, 7]) {
      const expected = { eyewear, neckwear, earrings, mask }; let id = 0;
      for (const layer of ACCESSORY_LAYERS) id = withAccessoryLayer(id, layer.key, expected[layer.key]);
      seen.add(id);
      if (JSON.stringify(accessorySelection(id)) !== JSON.stringify(expected)) failures.push(`selection ${id}`);
      if (hasTravelerMask(id) !== !!mask) failures.push(`mask ${id}`);
      const character = sanitize({ ...defaultChar(), acc: id });
      if (character.acc !== id) failures.push(`sanitizer ${id}`);
      const npc = newNpc('accessory_test'); npc.appearance = npcAppearance(character); validateNpc(npc);
      if (npc.appearance.acc !== id) failures.push(`NPC ${id}`);
    }
    if (seen.size !== 200 || ACCESSORIES.length !== 200) failures.push(`coverage ${seen.size}/${ACCESSORIES.length}`);
    if (JSON.stringify(accessoryParts(6)) !== '[1,2]' || JSON.stringify(accessoryParts(7)) !== '[7]') failures.push('legacy IDs');
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('feature previews reveal a hidden feature without changing the character or other accessory layers', async () => {
  const failures = await page.evaluate(async () => {
    const { creatorOptionPreview } = await import('/src/data/creatorStudio.ts');
    const { defaultChar } = await import('/src/data/data.ts');
    const { accessorySelection } = await import('/src/character/head/accessoryLayers.ts');
    const failures = [];
    for (let acc = 0; acc < 200; acc++) for (const key of ['mouth', 'beard', 'makeup', 'detail']) {
      const data = { ...defaultChar(), acc, beard: 8, mouth: 7 }, before = JSON.stringify(data);
      const preview = creatorOptionPreview(data, key), original = accessorySelection(acc), shown = accessorySelection(preview.acc);
      if (shown.mask || shown.eyewear !== original.eyewear || shown.earrings !== original.earrings || shown.neckwear !== original.neckwear) failures.push(`${acc}/${key}: wrong preview layers`);
      if (preview.beard !== 8 || preview.mouth !== 7 || JSON.stringify(data) !== before) failures.push(`${acc}/${key}: mutated appearance`);
    }
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('hidden-feature guidance, makeup portraits and inspiration previews stay accurate after edits and locks', { timeout: 180000 }, async () => {
  await page.evaluate(() => window.brumaluz.set({ race: 'humano', face: 1, nose: 0, hair: 25, acc: 7, beard: 2 }));
  await page.locator('#tabs [data-tab="rostro"]').click();
  assert.equal(await page.locator('[data-for-option="beard"]').isVisible(), false);
  const beard = page.locator('.stepper[data-key="beard"] ~ .studio-catalog').first();
  await beard.locator('summary').click();
  await page.waitForFunction(() => !document.querySelector('[data-for-option="beard"]').hidden);
  await portrait(beard, 2);
  assert.equal(await page.evaluate(async () => (await import('/src/game/state.ts')).session.state.acc), 7);
  await beard.locator('summary').click();
  const makeup = page.locator('.stepper[data-key="makeup"] ~ .studio-catalog').first();
  await makeup.locator('summary').click();
  await portrait(makeup, 1);
  await makeup.locator('summary').click();
  await page.evaluate(() => window.brumaluz.set({ acc: 0 }));
  assert.equal(await page.locator('[data-for-option="beard"]').isVisible(), false);
  const workshop = page.locator('.studio-disclosure').first();
  await workshop.locator('summary').click();
  await workshop.locator('.studio-preset').first().scrollIntoViewIfNeeded();
  await workshop.locator('.studio-preset canvas').first().waitFor({ state: 'attached' });
  const initial = await page.locator('.studio-preset canvas').first().evaluate(canvas => canvas.toDataURL());
  await page.locator('.stepper[data-key="nose"] select').selectOption('8');
  await workshop.locator('.studio-preset').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(before => document.querySelector('.studio-preset canvas').toDataURL() !== before, initial);
  await page.locator('#tabs [data-tab="cabello"]').click();
  await page.locator('.stepper[data-key="hair"] + .studio-lock').click();
  const preset = page.getByRole('button', { name: 'Lino y avellana', exact: true });
  await preset.click();
  assert.equal(await page.locator('.stepper[data-key="hair"] select').inputValue(), '25');
  await page.locator('.stepper[data-key="hair"] + .studio-lock').click();
  await workshop.locator('summary').click();
  assert.deepEqual(errors, []);
});

test('hair categories, search, layered accessories and undo work together', { timeout: 180000 }, async () => {
  await page.locator('#tabs [data-tab="cabello"]').click();
  const catalog = page.locator('.stepper[data-key="hair"] ~ .studio-catalog').first();
  await catalog.locator('summary').click();
  await catalog.getByRole('button', { name: 'Trenzados', exact: true }).click();
  assert.equal(await catalog.locator('.studio-option-grid button:visible').count(), 8);
  await catalog.locator('.studio-option-grid button:visible').first().focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.value), '16');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.value), '22');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.stepper[data-key="hair"] select').inputValue(), '22');
  await catalog.getByRole('searchbox').fill('monos');
  assert.equal(await catalog.locator('.studio-option-grid button:visible').count(), 1);
  await catalog.locator('.studio-option-grid button:visible').click();
  assert.equal(await page.locator('.stepper[data-key="hair"] select').inputValue(), '27');
  await catalog.getByRole('searchbox').fill('');
  await catalog.getByRole('button', { name: 'Todos', exact: true }).click();
  assert.equal(await catalog.locator('.studio-option-grid button:visible').count(), 28);
  await portrait(catalog, 0);
  assert.ok(await catalog.locator('canvas').count() < 28, 'offscreen portraits wait until scrolled into view');
  await portrait(catalog, 27);
  await catalog.getByRole('combobox', { name: 'Vista del catálogo', exact: true }).selectOption(String(Math.PI));
  await portrait(catalog, 27);
  await page.screenshot({ path: 'art/creator-studio-review/hair-gallery.png' });
  await catalog.locator('summary').click();
  await page.locator('#tabs [data-tab="ropa"]').click();
  await page.locator('.stepper[data-key="acc"] select').selectOption('0');
  for (const [key, value] of [['eyewear', 11], ['neckwear', 12], ['earrings', 13], ['mask', 7]])
    await page.locator(`#creator-accessory-layers [data-layer="${key}"][data-value="${value}"]`).click();
  const acc = await page.evaluate(async () => (await import('/src/game/state.ts')).session.state.acc);
  assert.ok(acc > 13);
  assert.match(await page.locator('.stepper[data-key="acc"] .val').textContent(), /Combinación personal/);
  assert.equal(await page.locator('#creator-accessory-layers [aria-pressed="true"]').count(), 4);
  await page.waitForFunction(value => window.brumaluz.char().d.acc === value, acc);
  assert.equal(await page.evaluate(() => window.brumaluz.char().root.getObjectByName('character-mouth-rig').visible), false);
  await page.locator('#creator-accessory-layers [data-layer="mask"][data-value="0"]').click();
  await page.waitForFunction(() => window.brumaluz.char().root.getObjectByName('character-mouth-rig').visible);
  await historyKey('Control+z');
  await page.waitForFunction(value => window.brumaluz.char().d.acc === value, acc);
  await page.screenshot({ path: 'art/creator-studio-review/accessory-layers.png' });
  await page.locator('#creator-accessory-layers [data-layer="mask"][data-value="0"]').click();
});

test('rapid hair and eye edits queue one rebuild with the latest choices and defer portraits', async () => {
  await page.locator('#tabs [data-tab="cabello"]').click();
  const catalog = page.locator('.stepper[data-key="hair"] ~ .studio-catalog').first();
  await catalog.locator('summary').click();
  await portrait(catalog, 0);
  const result = await page.evaluate(async () => {
    const { set } = await import('/src/ui/creator.ts');
    const { play } = await import('/src/game/state.ts');
    const actor = play.char;
    for (const value of [23, 25, 1, 27]) { set('hair', value); set('eyeShape', value % 13); set('eyeColor', value % 10); }
    return { queued: play.rebuildQueued, sameActor: play.char === actor,
      portraits: document.querySelector('.stepper[data-key="hair"]').nextElementSibling.nextElementSibling.querySelectorAll('canvas').length };
  });
  assert.deepEqual(result, { queued: true, sameActor: true, portraits: 0 });
  await page.waitForFunction(() => window.brumaluz.char().d.hair === 27 && window.brumaluz.char().d.eyeShape === 1 && window.brumaluz.char().d.eyeColor === 7);
  await portrait(catalog, 27);
  await catalog.locator('summary').click();
  assert.deepEqual(errors, []);
});

test('catalogue, locks, keyboard history, palettes, inspiration and attributes work in the real creator', { timeout: 180000 }, async () => {
  await page.locator('#tabs [data-tab="cabello"]').click();
  await page.locator('.stepper[data-key="hair"] select').selectOption('21');
  await page.locator('.stepper[data-key="hair"] + .studio-lock').click();
  await page.locator('#random').click();
  assert.equal(await page.locator('.stepper[data-key="hair"] select').inputValue(), '21');
  const after = await page.evaluate(async () => (await import('/src/game/state.ts')).session.state.hairColor);
  await historyKey('Control+z'); await historyKey('Control+Shift+z');
  assert.equal(await page.evaluate(async () => (await import('/src/game/state.ts')).session.state.hairColor), after);
  await page.locator('#tabs [data-tab="rostro"]').click();
  await page.locator('.stepper[data-key="detail"] select').selectOption('17');
  const catalogue = page.locator('.stepper[data-key="detail"] ~ .studio-catalog').first();
  await catalogue.locator('summary').click();
  assert.equal(await catalogue.evaluate(el => el.open), true);
  assert.equal(await catalogue.locator('button').count(), 18);
  await catalogue.getByRole('button', { name: 'Pecas y cicatriz de ceja', exact: true }).click();
  assert.equal(await page.locator('.stepper[data-key="detail"] select').inputValue(), '12');
  await page.locator('#tabs [data-tab="ropa"]').click();
  await page.getByRole('button', { name: 'Bosque y arena', exact: true }).click();
  await page.waitForFunction(() => window.brumaluz.char().d.clothA === 2 && window.brumaluz.char().d.clothB === 16);
  assert.deepEqual(await page.evaluate(() => [window.brumaluz.char().d.clothA, window.brumaluz.char().d.clothB]), [2, 16]);
  const workshop = page.locator('.studio-disclosure').first();
  await workshop.locator('summary').click();
  await workshop.locator('.studio-preset').first().scrollIntoViewIfNeeded();
  await workshop.locator('.studio-preset canvas').first().waitFor({ state: 'attached' });
  await page.locator('#name').fill('Miel');
  await page.getByRole('button', { name: 'Lino y avellana', exact: true }).click();
  assert.equal(await page.locator('.stepper[data-key="hair"] select').inputValue(), '21', 'preset respects hair lock');
  await historyKey('Control+z');
  await page.waitForFunction(() => window.brumaluz.char().d.clothA === 2 && window.brumaluz.char().d.clothB === 16);
  assert.deepEqual(await page.evaluate(() => [window.brumaluz.char().d.clothA, window.brumaluz.char().d.clothB]), [2, 16]);
  await workshop.locator('summary').click();
  await page.locator('#tabs [data-tab="raza"]').click();
  await page.getByRole('button', { name: 'Potenciar mi clase', exact: true }).click();
  await page.waitForFunction(() => Object.values(window.brumaluz.char().d.attributePoints).reduce((a, b) => a + b, 0) === 2);
  assert.equal(await page.evaluate(() => Object.values(window.brumaluz.char().d.attributePoints).reduce((a, b) => a + b, 0)), 2);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'art/creator-studio-review/desktop.png' });
  await page.locator('#tabs [data-tab="clase"]').click();
  assert.match(await page.locator('#creator-kit').textContent(), /Tu equipo inicial/);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'art/creator-studio-review/class.png' });
  await page.locator('#tabs [data-tab="rostro"]').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'art/creator-studio-review/face.png' });
  await workshop.locator('summary').click();
  await page.screenshot({ path: 'art/creator-studio-review/presets.png' });
  await workshop.locator('summary').click();
  assert.deepEqual(errors, []);
});

test('visual catalogues, independent layers and preview lighting work', { timeout: 180000 }, async () => {
  await page.locator('.studio-disclosure').first().evaluate(el => el.open = false);
  await page.locator('#tabs [data-tab="rostro"]').click();
  await page.locator('.stepper[data-key="detail"] select').selectOption('0');
  for (const [layer, value] of [['freckles', 6], ['scar', 9], ['mark', 7], ['mole', 5], ['blush', 1]])
    await page.locator(`#creator-detail-layers button[data-layer="${layer}"][data-value="${value}"]`).click();
  const detail = await page.evaluate(async () => (await import('/src/game/state.ts')).session.state.detail);
  await page.waitForFunction(value => window.brumaluz.char().d.detail === value, detail);
  assert.ok(detail >= 18);
  assert.equal(await page.locator('#creator-detail-layers button[aria-pressed="true"]').count(), 5);
  assert.match(await page.locator('.stepper[data-key="detail"] .val').textContent(), /Combinación personal/);
  await historyKey('Control+z');
  assert.equal(await page.locator('[data-layer="blush"][data-value="0"]').getAttribute('aria-pressed'), 'true');
  await historyKey('Control+Shift+z');
  const faceCatalog = page.locator('.stepper[data-key="face"] ~ .studio-catalog').first();
  await faceCatalog.locator('summary').click();
  await portrait(faceCatalog, 1);
  await faceCatalog.locator('button[data-value="1"]').click();
  assert.equal(await page.locator('.stepper[data-key="face"] select').inputValue(), '1');
  await page.screenshot({ path: 'art/creator-studio-review/visual-catalogue.png' });
  await faceCatalog.locator('summary').click();
  await page.screenshot({ path: 'art/creator-studio-review/layered-face.png' });
  await page.getByRole('button', { name: 'Luz de farol', exact: true }).click();
  const light = await page.evaluate(async () => (await import('/src/game/stage.ts')).creatorStage.getObjectByName('studio-key').color.getHexString());
  assert.equal(light, 'ffc78a');
  await page.getByRole('button', { name: 'Luz de taller', exact: true }).click();
  await page.locator('#creator-focus-preview').click();
  assert.equal(await page.locator('#creator-focus-preview').textContent(), 'Ver rostro');
  await page.locator('#creator-focus-preview').click();
  assert.equal(await page.locator('#creator-focus-preview').textContent(), 'Ver cuerpo');
  assert.deepEqual(errors, []);
});

test('mobile controls remain visible and panels never overlap the footer', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 760, height: 600 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#tabs [data-tab="ropa"]').click();
    await page.evaluate(() => document.getElementById('pages').scrollTop = 0);
    await page.waitForTimeout(1200);
    const panel = await page.locator('#panel').boundingBox(), footer = await page.locator('#bottom').boundingBox();
    assert.ok(panel.y + panel.height < footer.y, `${viewport.width}: panel overlaps footer`);
    assert.ok(footer.y + footer.height <= viewport.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `art/creator-studio-review/mobile-${viewport.width}.png` });
  }
  await page.getByRole('button', { name: 'Vista amplia', exact: true }).click();
  assert.equal(await page.locator('#pages').isVisible(), false);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'art/creator-studio-review/mobile-full-preview.png' });
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  assert.equal(await page.locator('#pages').isVisible(), true);
});

test('keyboard tabs and English labels work without changing the character', async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#tabs [data-tab="rostro"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tabs [data-tab="cabello"]').getAttribute('aria-selected'), 'true');
  await page.evaluate(async () => (await import('/src/ui/i18n.ts')).setLanguage('en'));
  assert.equal(await page.locator('.studio-disclosure > summary').textContent(), 'Inspiration');
  assert.equal(await page.getByRole('button', { name: 'Studio light', exact: true }).textContent(), 'Studio light');
  const label = await page.evaluate(async () => {
    const { DETAILS } = await import('/src/character/head/detailLayers.ts');
    const { t } = await import('/src/ui/i18n.ts'); return t(DETAILS[179]);
  });
  assert.match(label, /Sun freckles/); assert.doesNotMatch(label, /Pecas|Cicatriz|Rubor/);
  await page.evaluate(async () => (await import('/src/ui/i18n.ts')).setLanguage('es'));
  assert.deepEqual(errors, []);
});

test('composite details survive all lineages, skulls and the shared NPC editor', { timeout: 240000 }, async () => {
  const result = await page.evaluate(async () => {
    const { Character } = await import('/src/character/character.ts');
    const { defaultChar, sanitize } = await import('/src/data/data.ts');
    const { newNpc, npcAppearance, validateNpc } = await import('/src/data/npcs.ts');
    const failures = [];
    for (const race of ['humano', 'elfo', 'lagto', 'pelso']) for (let face = 0; face < 4; face++) for (const detail of [11, 12, 13, 14, 15, 16, 17, 18, 90, 179]) {
      const data = sanitize({ ...defaultChar(), race, face, detail });
      const npc = newNpc('studio_test'); npc.appearance = npcAppearance(data); validateNpc(npc);
      const actor = new Character(data, { outfit: false });
      try {
        actor.play('Running_A'); actor.update(.3);
        actor.root.traverse(node => { if (node.isMesh && !node.geometry.attributes.position.array.every(Number.isFinite)) failures.push(`${race}/${face}/${detail}`); });
        if (data.detail !== detail || npc.appearance.detail !== detail) failures.push('lost detail');
      } finally { actor.dispose(); }
    }
    return failures;
  });
  assert.deepEqual(result, []); assert.deepEqual(errors, []);
});

test('editor navigation starts clean while keeping the character and existing local data', async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#tabs [data-tab="cabello"]').click();
  const catalog = page.locator('.stepper[data-key="hair"] ~ .studio-catalog').first();
  await catalog.evaluate(el => el.open = true);
  await catalog.getByRole('button', { name: 'Rizados', exact: true }).click();
  await catalog.getByRole('searchbox').fill('cortos');
  const snapshot = await page.evaluate(async () => ({ state: JSON.stringify((await import('/src/game/state.ts')).session.state), looks: localStorage.getItem('brumaluz-looks-v1:local') }));
  await page.evaluate(async () => (await import('/src/ui/characterSelect.ts')).showEditor());
  assert.equal(await page.locator('#tabs [data-tab="raza"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.getElementById('pages').scrollTop), 0);
  assert.equal(await page.locator('.studio-catalog[open], .studio-disclosure[open]').count(), 0);
  assert.deepEqual(await page.evaluate(async () => ({ state: JSON.stringify((await import('/src/game/state.ts')).session.state), looks: localStorage.getItem('brumaluz-looks-v1:local') })), snapshot);
  await page.locator('#tabs [data-tab="cabello"]').click();
  await catalog.locator('summary').click();
  assert.equal(await catalog.getByRole('searchbox').inputValue(), '');
  assert.equal(await catalog.locator('.studio-option-grid button:visible').count(), 28);
  assert.equal(await catalog.getByRole('button', { name: 'Todos', exact: true }).getAttribute('aria-pressed'), 'true');
  await catalog.locator('summary').click();
  assert.deepEqual(errors, []);
});

test('appearance reaches the running game and the NPC editor exposes the new catalogue', { timeout: 180000 }, async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { window.brumaluz.set({ detail: 179, hair: 21 }); window.brumaluz.play(); });
  await page.waitForFunction(() => document.body.classList.contains('playing') && window.brumaluz.char().root.getWorldPosition(new (window.brumaluz.char().root.position.constructor)()).y < 100);
  assert.equal(await page.evaluate(() => window.brumaluz.char().d.detail), 179);
  await page.screenshot({ path: 'art/creator-studio-review/in-game.png' });
  const editor = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  editor.on('pageerror', e => errors.push(e.message));
  await editor.goto('http://127.0.0.1:4199/npcs.html');
  await editor.waitForFunction(() => !document.getElementById('editor-controls').disabled, null, { timeout: 90000 });
  assert.equal(await editor.locator('#appearance-detail option').count(), 180);
  await editor.locator('#appearance-detail').selectOption('179');
  assert.equal(await editor.locator('#appearance-hair option').count(), 28);
  assert.equal(await editor.locator('#appearance-acc option').count(), 200);
  await editor.locator('#appearance-hair').selectOption('27');
  await editor.locator('#appearance-acc').selectOption('198');
  await editor.getByRole('button', { name: 'Encuadrar', exact: true }).click();
  assert.notEqual(await editor.locator('#status').getAttribute('data-error'), 'true');
  await editor.screenshot({ path: 'art/creator-studio-review/npc-editor.png' });
  await editor.close(); assert.deepEqual(errors, []);
});
