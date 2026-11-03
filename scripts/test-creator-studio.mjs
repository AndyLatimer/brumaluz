import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;
const port = Number(process.env.CREATOR_STUDIO_PORT ?? 4199);
const errors = [];
before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true, hmr: false }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  });
  await page.goto(`http://127.0.0.1:${port}/?test&graphics=compatible`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'));
  await page.evaluate(async () => (await import('/src/ui/characterSelect.ts')).showEditor());
  await mkdir('art/creator-studio-review', { recursive: true });
}, { timeout: 240000 });
after(async () => { await browser?.close(); await server?.close(); });

async function choose(key, value) {
  await page.locator(`.stepper[data-key="${key}"] [role="combobox"]`).click();
  await page.locator(`.creator-select-menu:visible [role="option"][data-value="${value}"]`).click();
}
async function historyKey(key) {
  await page.locator('#tabs [aria-selected="true"]').focus();
  await page.keyboard.press(key);
}

test('all sections omit the removed toolbar, saved looks, editing tools and comparison', async () => {
  for (const tab of ['raza', 'rostro', 'cabello', 'ropa', 'clase']) {
    await page.locator(`#tabs [data-tab="${tab}"]`).click();
    assert.equal(await page.locator('.studio-toolbar, .studio-heading, #creator-vary, #creator-save-look, #creator-comparison, .studio-slots, .studio-lock, .studio-catalog, .studio-subnav').count(), 0);
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

test('styled selects support pointer, keyboard, cancellation, typeahead and arrow wrapping', async () => {
  await page.locator('#tabs [data-tab="cabello"]').click();
  await choose('hair', '0');
  const hair = page.locator('.stepper[data-key="hair"]');
  const trigger = hair.locator('[role="combobox"]');
  await trigger.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  assert.equal(await hair.locator('select').inputValue(), '27');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await hair.getByRole('button', { name: 'Peinado · Siguiente', exact: true }).click();
  assert.equal(await hair.locator('select').inputValue(), '0');
  await hair.getByRole('button', { name: 'Peinado · Anterior', exact: true }).click();
  assert.equal(await hair.locator('select').inputValue(), '27');
  await trigger.click(); await page.keyboard.press('Home'); await page.keyboard.press('Escape');
  assert.equal(await hair.locator('select').inputValue(), '27');
  await trigger.focus(); await page.keyboard.type('rap'); await page.keyboard.press('Enter');
  assert.equal(await hair.locator('select').inputValue(), '0');
  await trigger.click();
  assert.equal(await page.getByRole('option', { name: 'Rapado', exact: true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Tab');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await trigger.click(); await page.locator('#hairColor button').first().click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await page.setViewportSize({ width: 1440, height: 600 });
  await trigger.click(); await page.evaluate(() => document.getElementById('pages').scrollTop += 40);
  await page.waitForFunction(() => document.querySelector('.stepper[data-key="hair"] [role="combobox"]').getAttribute('aria-expanded') === 'false');
  await page.evaluate(() => document.getElementById('pages').scrollTop = 0);
  await trigger.click();
  await page.evaluate(() => window.brumaluz.tab('rostro'));
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.deepEqual(errors, []);
});

test('layered choices, custom labels, body changes and keyboard history stay consistent', async () => {
  await page.evaluate(() => window.brumaluz.set({ race: 'humano', detail: 0, acc: 0 }));
  await page.locator('#tabs [data-tab="rostro"]').click();
  await choose('makeup', '9'); assert.equal(await page.locator('#makeupColorBox').isVisible(), true);
  await page.getByText('Personalizar marcas', { exact: true }).click();
  for (const [layer, value] of [['freckles', 6], ['scar', 9], ['mark', 7], ['mole', 5], ['blush', 1]])
    await page.locator(`#creator-detail-layers [data-layer="${layer}"][data-value="${value}"]`).click();
  assert.match(await page.locator('.stepper[data-key="detail"] .val').textContent(), /Combinación personal/);
  assert.equal(await page.locator('#creator-detail-layers [aria-pressed="true"]').count(), 5);
  await historyKey('Control+z');
  assert.equal(await page.locator('[data-layer="blush"][data-value="0"]').getAttribute('aria-pressed'), 'true');
  await historyKey('Control+Shift+z');
  await page.locator('#tabs [data-tab="ropa"]').click();
  await page.getByText('Personalizar complementos', { exact: true }).click();
  for (const [layer, value] of [['eyewear', 11], ['neckwear', 12], ['earrings', 13], ['mask', 7]])
    await page.locator(`#creator-accessory-layers [data-layer="${layer}"][data-value="${value}"]`).click();
  const acc = await page.evaluate(async () => (await import('/src/game/state.ts')).session.state.acc);
  assert.ok(acc > 13);
  assert.match(await page.locator('.stepper[data-key="acc"] .val').textContent(), /Combinación personal/);
  await page.waitForFunction(() => !window.brumaluz.char().root.getObjectByName('character-mouth-rig').visible);
  await page.locator('#creator-accessory-layers [data-layer="mask"][data-value="0"]').click();
  await page.waitForFunction(() => window.brumaluz.char().root.getObjectByName('character-mouth-rig').visible);
  await page.locator('#tabs [data-tab="raza"]').click();
  await page.locator('#sex [data-v="1"]').click();
  assert.equal(await page.locator('.stepper[data-key="makeup"] select').inputValue(), '9');
});

test('rapid hair and eye edits queue one rebuild with the latest choices', async () => {
  const result = await page.evaluate(async () => {
    const { set } = await import('/src/ui/creator.ts');
    const { play } = await import('/src/game/state.ts'); const actor = play.char;
    for (const value of [23, 25, 1, 27]) { set('hair', value); set('eyeShape', value % 13); set('eyeColor', value % 10); }
    return { queued: play.rebuildQueued, sameActor: play.char === actor };
  });
  assert.deepEqual(result, { queued: true, sameActor: true });
  await page.waitForFunction(() => window.brumaluz.char().d.hair === 27 && window.brumaluz.char().d.eyeShape === 1 && window.brumaluz.char().d.eyeColor === 7);
  assert.deepEqual(errors, []);
});

test('palettes, inspiration, randomization, attributes and class kit work without locks or class color controls', { timeout: 180000 }, async () => {
  await page.locator('#tabs [data-tab="ropa"]').click();
  await page.getByText('Armonías de color', { exact: true }).click();
  await page.getByRole('button', { name: 'Bosque y arena', exact: true }).click();
  await page.waitForFunction(() => window.brumaluz.char().d.clothA === 2 && window.brumaluz.char().d.clothB === 16);
  const workshop = page.locator('#creator-inspiration');
  await workshop.locator('summary').click();
  const preset = workshop.locator('.studio-preset').first();
  await preset.scrollIntoViewIfNeeded(); await preset.locator('canvas').waitFor({ state: 'attached' });
  await page.locator('#name').fill('Miel'); await preset.click();
  assert.equal(await page.locator('.stepper[data-key="hair"] select').inputValue(), '18');
  assert.equal(await page.locator('#name').inputValue(), 'Miel');
  await historyKey('Control+z');
  await page.waitForFunction(() => window.brumaluz.char().d.clothA === 2 && window.brumaluz.char().d.clothB === 16);
  await workshop.locator('summary').click();
  await page.locator('#random').click(); assert.equal(await page.locator('#name').inputValue(), 'Miel');
  await historyKey('Control+z');
  await page.locator('#tabs [data-tab="raza"]').click();
  await page.getByRole('button', { name: 'Potenciar mi clase', exact: true }).click();
  await page.waitForFunction(() => Object.values(window.brumaluz.char().d.attributePoints).reduce((a, b) => a + b, 0) === 2);
  await page.locator('#tabs [data-tab="clase"]').click();
  assert.equal(await page.locator('[data-page="clase"] .swatches, #primary, #secondary').count(), 0);
  assert.match(await page.locator('#creator-kit').textContent(), /Tu equipo inicial/);
  await page.locator('#classes [data-k="mago"]').click();
  await page.waitForFunction(() => window.brumaluz.char().d.cls === 'mago');
  await page.screenshot({ path: 'art/creator-studio-review/simplified-class.png' });
  await page.getByRole('button', { name: 'Luz de farol', exact: true }).click();
  assert.equal(await page.evaluate(async () => (await import('/src/game/stage.ts')).creatorStage.getObjectByName('studio-key').color.getHexString()), 'ffc78a');
  await page.getByRole('button', { name: 'Luz de taller', exact: true }).click();
  assert.deepEqual(errors, []);
});

test('mobile selects fit the viewport, align their arrows and keep panels above the footer', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 760, height: 600 }]) {
    await page.setViewportSize(viewport); await page.locator('#tabs [data-tab="cabello"]').click();
    await page.evaluate(() => document.getElementById('pages').scrollTop = 0);
    const panel = await page.locator('#panel').boundingBox(), footer = await page.locator('#bottom').boundingBox();
    assert.ok(panel.y + panel.height < footer.y); assert.ok(footer.y + footer.height <= viewport.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const trigger = page.locator('.stepper[data-key="hair"] [role="combobox"]');
    await trigger.click(); const menu = await page.getByRole('listbox').boundingBox();
    assert.ok(menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= viewport.width && menu.y + menu.height <= viewport.height);
    await page.keyboard.press('Escape');
    const boxes = await page.locator('.stepper[data-key="hair"] button').evaluateAll(buttons => buttons.map(button => ({ y: button.getBoundingClientRect().y, h: button.getBoundingClientRect().height })));
    assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1 && Math.abs(box.h - boxes[0].h) < 1));
    await page.screenshot({ path: `art/creator-studio-review/simplified-mobile-${viewport.width}.png` });
  }
  await page.getByRole('button', { name: 'Vista amplia', exact: true }).click();
  assert.equal(await page.locator('#pages').isVisible(), false);
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  assert.equal(await page.locator('#pages').isVisible(), true);
});

test('keyboard tabs and English labels work without changing the character', async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#tabs [data-tab="rostro"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tabs [data-tab="cabello"]').getAttribute('aria-selected'), 'true');
  await page.evaluate(async () => (await import('/src/ui/i18n.ts')).setLanguage('en'));
  assert.equal(await page.locator('#creator-inspiration > summary').textContent(), 'Inspiration');
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

test('editor reset closes menus and optional sections while preserving character and local data', async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#tabs [data-tab="cabello"]').click();
  await page.locator('.stepper[data-key="hair"] [role="combobox"]').click();
  const snapshot = await page.evaluate(async () => ({ state: JSON.stringify((await import('/src/game/state.ts')).session.state), looks: localStorage.getItem('brumaluz-looks-v1:local') }));
  await page.evaluate(async () => (await import('/src/ui/characterSelect.ts')).showEditor());
  assert.equal(await page.locator('#tabs [data-tab="raza"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.getElementById('pages').scrollTop), 0);
  assert.equal(await page.locator('.studio-disclosure[open], .creator-select-menu:not([hidden])').count(), 0);
  assert.deepEqual(await page.evaluate(async () => ({ state: JSON.stringify((await import('/src/game/state.ts')).session.state), looks: localStorage.getItem('brumaluz-looks-v1:local') })), snapshot);
  assert.deepEqual(errors, []);
});

test('walking styles preview real clips and keep their choice through saved data, history and locomotion', { timeout: 120000 }, async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#tabs [data-tab="raza"]').click();
  for (const [value, name] of [[0, 'Walking_A'], [1, 'Walking_B'], [2, 'Walking_C']]) {
    await choose('walkStyle', String(value));
    await page.waitForFunction(name => window.brumaluz.char().gaitAction().getClip().name === name, name);
    assert.equal(await page.locator('#creator-walk-preview').getAttribute('aria-pressed'), 'true');
    const position = await page.evaluate(() => window.brumaluz.char().root.position.toArray());
    assert.equal(position[0], 0); assert.equal(position[2], 0);
  }
  await page.screenshot({ path: 'art/creator-studio-review/walk-style-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await choose('walkStyle', '2');
  await page.waitForFunction(() => window.brumaluz.char().gaitAction().getClip().name === 'Walking_C');
  await page.screenshot({ path: 'art/creator-studio-review/walk-style-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#creator-walk-preview').click();
  await page.waitForFunction(() => window.brumaluz.char().gait === 'idle');
  await historyKey('Control+z');
  assert.equal(await page.locator('.stepper[data-key="walkStyle"] select').inputValue(), '1');
  await historyKey('Control+Shift+z');
  const failures = await page.evaluate(async () => {
    const { Character } = await import('/src/character/character.ts');
    const { defaultChar, sanitize, WALK_STYLES } = await import('/src/data/data.ts');
    const errors = [];
    if (sanitize({}).walkStyle !== 0) errors.push('legacy default');
    for (const invalid of [-1, 3, .5, '2', null, {}]) if (sanitize({ walkStyle: invalid }).walkStyle !== 0) errors.push('invalid style');
    for (const race of ['humano', 'elfo', 'lagto', 'pelso']) for (const walkStyle of [0, 1, 2]) {
      const data = sanitize(JSON.parse(JSON.stringify({ ...defaultChar(), race, walkStyle })));
      if (data.walkStyle !== walkStyle) errors.push('round trip');
      const actor = new Character(data, { outfit: false });
      try {
        actor.update(0); actor.setGait('walk'); actor.update(.2);
        if (actor.gaitAction().getClip().name !== WALK_STYLES[walkStyle]) errors.push(`${race}/${walkStyle}: wrong walk`);
        actor.setGait('run'); if (actor.gaitAction().getClip().name !== 'Running_A') errors.push('changed run');
        actor.setSwimming(true); if (actor.gaitAction().getClip().name !== 'Crawling') errors.push('changed swimming');
        actor.setSwimming(false); actor.setGait('walk');
        const promise = actor.celebrate(), duration = actor.actions.get('Cheering').getClip().duration;
        let done = false; promise.then(() => { done = true; });
        actor.update(.25); await Promise.resolve();
        if (done) errors.push('celebration resolved early');
        for (let time = .3; time < duration + .7; time += .05) actor.update(time);
        if (!(await promise)) errors.push('celebration did not finish');
        if (actor.gaitAction().getClip().name !== WALK_STYLES[walkStyle]) errors.push('lost gait after celebration');
      } finally { actor.dispose(); }
    }
    const actor = new Character(defaultChar(), { outfit: false });
    const interrupted = actor.celebrate(); actor.dispose();
    if (await interrupted) errors.push('disposed celebration completed');
    return errors;
  });
  assert.deepEqual(failures, []);
  await page.locator('#tabs [data-tab="rostro"]').click();
  assert.equal(await page.locator('#creator-walk-preview').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(errors, []);
});

test('creation celebration waits for Cheering to end before starting the existing arrival cinematic', { timeout: 120000 }, async () => {
  let saved, creations = 0;
  const pattern = /https:\/\/[^/]+\.supabase\.co\//;
  await page.route(pattern, async route => {
    const fn = new URL(route.request().url()).pathname.split('/').at(-1);
    const fulfill = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (fn === 'create_character') {
      creations++;
      saved = { ...route.request().postDataJSON().p_data, welcome: { origin: null, stage: 'available' }, introSeen: false, position: { x: 177, z: 0, yaw: Math.PI / 2 } };
      return fulfill('00000000-0000-0000-0000-000000000123');
    }
    if (fn === 'character_enter') return fulfill(saved);
    return fulfill([]);
  });
  try {
    await page.evaluate(async () => {
      const { session, story } = await import('/src/game/state.ts');
      session.currentUser = { id: '00000000-0000-0000-0000-000000000001' }; session.activeCharacterId = null;
      window.brumaluz.set({ name: 'Miel', walkStyle: 2, attributePoints: { fuerza: 2 }, creationPoints: 2 });
      (await import('/src/ui/characterSelect.ts')).showEditor(); story.introArmed = false;
    });
    await page.locator('#enter').click();
    await page.waitForFunction(() => document.body.classList.contains('creator-celebrating') && window.brumaluz.char().oneShot?.getClip().name === 'Cheering');
    assert.equal(creations, 1); assert.equal(saved.walkStyle, 2);
    const during = await page.evaluate(async () => {
      const { play } = await import('/src/game/state.ts');
      const { cinematic } = await import('/src/story/scenes.ts');
      const actor = window.brumaluz.char();
      actor.mixer.addEventListener('finished', event => { if (event.action.getClip().name === 'Cheering') window.creatorCheerFinished = performance.now(); });
      return { mode: play.mode, cinematic: cinematic.active, disabled: document.getElementById('enter').disabled, inert: document.getElementById('panel').inert };
    });
    assert.deepEqual(during, { mode: 'create', cinematic: false, disabled: true, inert: true });
    await page.evaluate(() => document.getElementById('enter').click());
    await page.waitForFunction(() => window.brumaluz.char().oneShot?.time > .3);
    await page.screenshot({ path: 'art/creator-studio-review/creation-cheer.png' });
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    assert.ok(await page.evaluate(() => window.creatorCheerFinished > 0));
    await page.waitForFunction(async () => (await import('/src/story/scenes.ts')).cinematic.active);
    assert.equal(await page.evaluate(() => window.brumaluz.char().d.walkStyle), 2);
    assert.equal(creations, 1);
    await page.screenshot({ path: 'art/creator-studio-review/after-cheer-arrival.png' });
  } finally {
    await page.evaluate(async () => {
      const { session, play } = await import('/src/game/state.ts');
      if (play.mode === 'play') (await import('/src/game/playSession.ts')).exitPlay();
      session.currentUser = null; session.activeCharacterId = null;
      (await import('/src/ui/characterSelect.ts')).showEditor();
    });
    await page.unroute(pattern);
  }
  assert.deepEqual(errors, []);
});

test('creation failure does not celebrate or enter the world', async () => {
  const pattern = /https:\/\/[^/]+\.supabase\.co\//;
  let requests = 0;
  await page.route(pattern, async route => {
    if (route.request().url().endsWith('/rpc/create_character')) requests++;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'INVALID_CHARACTER' }) });
  });
  try {
    await page.evaluate(async () => {
      const { session } = await import('/src/game/state.ts');
      session.currentUser = { id: '00000000-0000-0000-0000-000000000001' }; session.activeCharacterId = null;
      window.brumaluz.set({ name: 'Miel', attributePoints: { fuerza: 2 }, creationPoints: 2 });
      window.failedCreationCelebrations = 0;
      window.failedCreationObserver = new MutationObserver(() => {
        if (document.body.classList.contains('creator-celebrating')) window.failedCreationCelebrations++;
      });
      window.failedCreationObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
    await page.locator('#enter').click();
    await page.waitForFunction(async () => !(await import('/src/game/state.ts')).session.enteringWorld);
    assert.equal(requests, 1);
    assert.equal(await page.evaluate(() => window.failedCreationCelebrations), 0);
    assert.equal(await page.locator('body').evaluate(body => body.classList.contains('playing')), false);
    assert.equal(await page.locator('#enter').isDisabled(), false);
  } finally {
    await page.unroute(pattern);
    await page.evaluate(async () => {
      window.failedCreationObserver?.disconnect();
      (await import('/src/game/state.ts')).session.currentUser = null;
    });
  }
});

test('creation celebration releases controls and cannot enter after the creator is hidden or rebuilt', async () => {
  for (const interrupt of ['hidden', 'rebuild']) {
    await page.evaluate(async () => {
      const { session } = await import('/src/game/state.ts');
      session.enteringWorld = true;
      window.pendingCreatorCelebration = (await import('/src/ui/creatorCelebration.ts')).celebrateCreatedCharacter();
    });
    await page.waitForFunction(() => window.brumaluz.char().oneShot?.getClip().name === 'Cheering');
    await page.evaluate(interrupt => {
      if (interrupt === 'hidden') document.body.classList.add('characters-visible');
      else window.brumaluz.set({ hair: 1 });
    }, interrupt);
    assert.equal(await page.evaluate(() => window.pendingCreatorCelebration), false);
    assert.equal(await page.locator('body').evaluate(body => body.classList.contains('playing')), false);
    assert.equal(await page.locator('#panel').evaluate(panel => panel.inert), false);
    await page.evaluate(async () => {
      (await import('/src/game/state.ts')).session.enteringWorld = false;
      (await import('/src/ui/characterSelect.ts')).showEditor();
    });
  }
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
  await editor.goto(`http://127.0.0.1:${port}/npcs.html`);
  await editor.waitForFunction(() => !document.getElementById('editor-controls').disabled, null, { timeout: 90000 });
  assert.equal(await editor.locator('#appearance-detail option').count(), 180);
  await editor.locator('#appearance-detail').selectOption('179');
  assert.equal(await editor.locator('#appearance-hair option').count(), 32);
  assert.equal(await editor.locator('#appearance-acc option').count(), 200);
  await editor.locator('#appearance-hair').selectOption('27');
  await editor.locator('#appearance-acc').selectOption('198');
  await editor.getByRole('button', { name: 'Encuadrar', exact: true }).click();
  assert.notEqual(await editor.locator('#status').getAttribute('data-error'), 'true');
  await editor.screenshot({ path: 'art/creator-studio-review/npc-editor.png' });
  await editor.close(); assert.deepEqual(errors, []);
});
