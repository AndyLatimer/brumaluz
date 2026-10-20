import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { npcWorkshopPlugin } from '../tools/npc-workshop-plugin.mjs';

let server, browser, directory, catalogPath, schema;
const url = 'http://127.0.0.1:4183';
const empty = () => ({ version: 1, npcs: [] });
const json = value => JSON.stringify(value, null, 2) + '\n';
const get = () => fetch(`${url}/__dev/npcs`);
const put = (value, revision, headers = {}) => fetch(`${url}/__dev/npcs`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': revision, ...headers }, body: JSON.stringify(value),
});
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'brumaluz-npcs-'));
  catalogPath = join(directory, 'npcs.json');
  await writeFile(catalogPath, json(empty()));
  server = await createServer({
    configFile: false, logLevel: 'error', plugins: [
      {
        name: 'isolated-world-npc-catalog',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === './npcs.json' && importer?.replaceAll('\\', '/').endsWith('/src/data/worldNpcs.ts')) return catalogPath;
        },
      },
      npcWorkshopPlugin({ catalogPath }),
    ], assetsInclude: ['**/*.glb'],
    server: { host: '127.0.0.1', port: 4183, strictPort: true, fs: { allow: [process.cwd(), directory] } },
  });
  await server.listen();
  assert.equal((await get()).status, 200);
  schema = await server.ssrLoadModule('/src/data/npcs.ts');
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true,
    // Edge's downloads hub creates a WebUI target unsupported by this Playwright version.
    args: ['--disable-features=msDownloadsHub'],
  });
});
beforeEach(async () => { await writeFile(catalogPath, json(empty())); });
after(async () => {
  await browser?.close(); await server?.close();
  if (directory) await rm(directory, { recursive: true });
});

test('NPC schema strictly validates complete appearances, independent stats and reusable render options', async () => {
  const { RACES, CLASSES, ATTRIBUTES } = await server.ssrLoadModule('/src/data/data.ts');
  const { attributeTotal } = await server.ssrLoadModule('/src/data/stats.ts');
  for (const race of Object.keys(RACES)) for (const cls of Object.keys(CLASSES)) {
    const npc = schema.newNpc('npc_prueba'); npc.appearance.race = race; npc.appearance.cls = cls;
    npc.appearance.hair = 15; npc.appearance.acc = 7; npc.stats.level = 9999; npc.stats.maxHealth = 900000; npc.stats.health = 888888;
    for (const key of Object.keys(ATTRIBUTES)) npc.stats.attributes[key] = 999;
    assert.deepEqual(schema.validateNpc(npc), npc);
    const character = schema.npcCharacter(npc);
    for (const key of Object.keys(ATTRIBUTES)) assert.equal(attributeTotal(character, key), 999);
    assert.equal(character.level, 9999); assert.equal(character.health, 888888);
    assert.equal(schema.npcBuildOptions(npc).outfit, false);
    assert.equal(schema.npcBuildOptions(npc).wardrobe, undefined);
    const copy = schema.validateNpc(npc); copy.stats.health = 0; assert.equal(npc.stats.health, 888888);
  }
  const wrong = [
    npc => { npc.id = '../outside'; }, npc => { npc.name = ' '; }, npc => { npc.appearance.hair = 16; },
    npc => { npc.appearance.skin = 999; }, npc => { npc.appearance.hairAcc = 5; },
    npc => { npc.appearance.face = 4; }, npc => { npc.appearance.unknown = 1; },
    npc => { npc.stats.health = 101; }, npc => { npc.stats.maxHealth = 0; }, npc => { npc.stats.level = 1.5; },
    npc => { npc.stats.attributes.fuerza = -1; }, npc => { delete npc.stats.attributes.pericia; },
    npc => { npc.render.scale = NaN; }, npc => { npc.render.clothing.head.piece = 'unknown'; },
    npc => { npc.render.clothing.torso.piece = 'Mage.head'; }, npc => { npc.render.clothing.leftArm.piece = ''; },
    npc => { npc.render.clothing.torso.primary = -2; }, npc => { delete npc.render.clothing.back; },
    npc => { npc.render.weapon = 'escudo_inicial'; }, npc => { npc.render.offhand = 'espada_inicial'; },
    npc => { npc.render.weapon = 'constructor'; }, npc => { npc.wallet = {}; }, npc => { delete npc.appearance.skin; },
    npc => { npc.badgeIcon = '../outside.png'; }, npc => { npc.badgeIcon = 'https://unrelated.invalid/image'; },
  ];
  for (const mutate of wrong) { const npc = schema.newNpc(); mutate(npc); assert.throws(() => schema.validateNpc(npc), undefined, mutate.toString()); }
  for (const badgeIcon of ['', 'herrero', 'caballero_norte-2']) {
    assert.equal(schema.validateNpc({ ...schema.newNpc(), badgeIcon }).badgeIcon, badgeIcon);
  }
  for (const badgeIcon of ['herrero.png', 'icono nuevo', '<img>', 'X', 'a'.repeat(65)]) {
    assert.throws(() => schema.validateNpc({ ...schema.newNpc(), badgeIcon }), undefined, badgeIcon);
  }
  const old = schema.newNpc(); delete old.badgeIcon;
  assert.equal(schema.validateNpc(old).badgeIcon, '');
  for (const value of [{ version: 2, npcs: [] }, { ...empty(), extra: true }, { version: 1, npcs: [schema.newNpc(), schema.newNpc()] },
    { version: 1, npcs: Array.from({ length: 1001 }, (_, index) => schema.newNpc(`npc_${index}`)) }]) {
    assert.throws(() => schema.validateNpcCatalog(value));
  }
});

test('existing project NPCs are registered and protected from accidental removal, while their fields remain editable', async () => {
  const value = schema.validateNpcCatalog(JSON.parse(await readFile(new URL('../src/data/npcs.json', import.meta.url), 'utf8')));
  for (const id of schema.WORLD_NPC_IDS) assert.ok(value.npcs.some(npc => npc.id === id), id);
  await writeFile(catalogPath, json(value));
  const revision = (await get()).headers.get('ETag');
  assert.equal((await put({ ...value, npcs: value.npcs.filter(npc => npc.id !== 'gnomi') }, revision)).status, 400);
  const npc = value.npcs.find(npc => npc.id === 'isberto'); npc.name = 'Isberto editado'; npc.badgeIcon = 'granjero_pendiente';
  assert.equal((await put(value, revision)).status, 200);
  assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs.find(npc => npc.id === 'isberto').badgeIcon, 'granjero_pendiente');
});

test('previously saved preset-based NPCs migrate to one editable fixed outfit without changing identity or stats', async () => {
  const { defaultChar } = await server.ssrLoadModule('/src/data/data.ts');
  const { NPC_CLOTHING } = await server.ssrLoadModule('/src/data/npcClothing.ts');
  assert.equal(new Set(NPC_CLOTHING.map(piece => piece.id)).size, NPC_CLOTHING.length);
  for (const outfit of ['villager', 'class', 'helpers']) {
    const original = schema.newNpc('guardado_anterior'), data = defaultChar();
    original.name = 'NPC existente'; original.stats.health = 35;
    const legacy = { ...original, appearance: { ...original.appearance, clothA: data.clothA, clothB: data.clothB, primary: data.primary, secondary: data.secondary },
      render: { outfit, scale: 1.4, width: 1.1, height: .9, hat: true, cape: 'Mage', weapon: '', offhand: '' } };
    const catalog = { version: 1, npcs: [legacy] };
    await writeFile(catalogPath, json(catalog));
    const response = await get(), next = await response.json();
    assert.equal(response.status, 200);
    assert.equal(next.npcs[0].id, original.id); assert.deepEqual(next.npcs[0].stats, original.stats);
    assert.equal(next.npcs[0].render.clothing.torso.piece, `${outfit === 'helpers' ? 'helpers' : outfit === 'class' ? 'Knight' : 'Rogue'}.torso`);
    assert.equal(next.npcs[0].render.clothing.cape.piece, 'Mage.cape');
    assert.equal(next.npcs[0].render.clothing.torso.primary, outfit === 'helpers' ? -1 : outfit === 'class' ? data.primary : data.clothA);
    assert.ok(!Object.hasOwn(next.npcs[0].render, 'outfit'));
    next.npcs[0].name = 'NPC existente editado';
    next.npcs[0].render.clothing.leftArm.piece = 'Ranger.leftArm';
    assert.equal((await put(next, response.headers.get('ETag'))).status, 200);
    const disk = JSON.parse(await readFile(catalogPath, 'utf8'));
    assert.equal(disk.npcs.length, 1); assert.equal(disk.npcs[0].id, original.id);
    assert.equal(disk.npcs[0].name, 'NPC existente editado');
    assert.equal(disk.npcs[0].render.clothing.leftArm.piece, 'Ranger.leftArm');
  }
});

test('development JSON storage saves, reloads, rejects invalid writes and detects concurrent edits', async () => {
  let response = await get(); const original = response.headers.get('ETag');
  assert.deepEqual(await response.json(), empty());
  const value = { version: 1, npcs: [schema.newNpc('herrera')] };
  response = await put(value, original); assert.equal(response.status, 200);
  const revision = response.headers.get('ETag'); assert.notEqual(revision, original);
  assert.deepEqual(JSON.parse(await readFile(catalogPath, 'utf8')), value);
  assert.deepEqual(await (await get()).json(), value);
  assert.equal((await put(empty(), original)).status, 409);
  assert.equal((await put({ version: 2, npcs: [] }, revision)).status, 400);
  assert.equal((await put(empty(), revision, { Origin: 'https://unrelated.invalid' })).status, 403);
  const wrongHost = await new Promise((resolve, reject) => {
    const request = httpRequest(`${url}/__dev/npcs`, { headers: { Host: 'unrelated.invalid' } }, response => {
      response.resume(); resolve(response.statusCode);
    });
    request.once('error', reject); request.end();
  });
  assert.equal(wrongHost, 403);
  assert.equal((await put(empty(), revision, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fetch(`${url}/__dev/npcs/other`)).status, 404);
  assert.equal((await fetch(`${url}/__dev/npcs`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}/__dev/npcs`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': revision }, body: '{' })).status, 400);
  assert.equal((await put('x'.repeat(4_000_001), revision)).status, 413);
  const concurrent = await Promise.all([put(empty(), revision), put(empty(), revision)]);
  assert.deepEqual(concurrent.map(value => value.status).sort(), [200, 409]);
  assert.deepEqual(await readdir(directory), ['npcs.json']);
  const diskRevision = (await get()).headers.get('ETag');
  await writeFile(catalogPath, json(value));
  assert.equal((await put(empty(), diskRevision)).status, 409);
});

test('all 139 new Medium clips share the runtime character rest pose, not just bone names', async () => {
  const io = new NodeIO(), base = (await io.read(fileURLToPath(new URL('../src/assets/models/Mage.glb', import.meta.url)))).getRoot();
  const catalog = JSON.parse(await readFile(new URL('../src/assets/library/catalog.json', import.meta.url), 'utf8'));
  let clips = 0;
  for (const source of catalog.assets.filter(asset => asset.pack === 'character-animations' && asset.kind === 'animations' && asset.rig === 'medium')) {
    const library = (await io.read(fileURLToPath(new URL(`../src/assets/library/${source.path}`, import.meta.url)))).getRoot();
    for (const clip of library.listAnimations()) {
      for (const channel of clip.listChannels()) {
        const source = channel.getTargetNode(), target = base.listNodes().find(node => node.getName() === source.getName());
        assert.ok(target, source.getName());
        source.getMatrix().forEach((value, index) => assert.ok(Math.abs(value - target.getMatrix()[index]) < 1e-4, `${clip.getName()}:${source.getName()}: rest pose`));
      }
      clips++;
    }
  }
  assert.equal(clips, 139);
});

test('browser NPC workshop persists full appearance/stats, duplicates, imports, exports and handles conflicts without losing drafts', { timeout: 180000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage(), errors = [];
  const listen = message => {
    if (message.type() === 'error' && message.location().url !== `${url}/favicon.ico`
      || message.type() === 'warning' && /PropertyBinding|No target node/.test(message.text())) errors.push(message.text());
  };
  page.on('pageerror', error => errors.push(error.message)); page.on('console', listen);
  page.on('dialog', dialog => {
    void dialog.accept().catch(error => { if (!page.isClosed()) errors.push(error.message); });
  });
  try {
    await page.goto(`${url}/npcs.html`);
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.'), null, { timeout: 60000 });
    assert.equal(await page.locator('#appearance select').count(), 21);
    await page.locator('#npc-id').fill('herrera_brumaluz');
    await page.locator('#npc-name').fill('Maestra Alba');
    await page.locator('#npc-subtitle').fill('Herrera de Brumaluz');
    await page.locator('#npc-notes').fill('Pendiente de colocar junto a la fragua.');
    await page.locator('#npc-badgeIcon').fill('herrero_pendiente');
    await page.locator('#appearance-race').selectOption('pelso');
    await page.locator('#appearance-skin').selectOption('7');
    await page.locator('#appearance-trait').selectOption('2');
    await page.locator('#appearance-cls').selectOption('mago');
    await page.locator('#appearance-hair').selectOption('15');
    await page.locator('#appearance-acc').selectOption('7');
    await page.locator('#appearance-hairColor').selectOption('2');
    await page.locator('#clothing-torso').selectOption('Mage.torso');
    await page.locator('#clothing-torso-primary').selectOption('2');
    await page.locator('#clothing-leftArm').selectOption('Ranger.leftArm');
    await page.locator('#clothing-rightArm').selectOption('Knight.rightArm');
    await page.locator('#clothing-leftLeg').selectOption('Rogue_Hooded.leftLeg');
    await page.locator('#clothing-rightLeg').selectOption('Barbarian.rightLeg');
    await page.locator('#clothing-cape').selectOption('Knight.cape');
    await page.locator('#clothing-head').selectOption('');
    await page.locator('#render-weapon').selectOption('espada_inicial');
    await page.locator('#render-offhand').selectOption('escudo_inicial');
    await page.locator('#render-scale').fill('1.5');
    await page.locator('#npc-level').fill('120');
    await page.locator('#attribute-fuerza').fill('500');
    await page.locator('#npc-maxHealth').fill('90000');
    await page.locator('#npc-health').fill('45678');
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Guardado en el proyecto:'));
    let disk = JSON.parse(await readFile(catalogPath, 'utf8'));
    assert.equal(disk.npcs.length, 1);
    const saved = disk.npcs[0];
    assert.equal(saved.stats.attributes.fuerza, 500); assert.equal(saved.stats.health, 45678);
    assert.equal(saved.stats.maxHealth, 90000); assert.equal(saved.stats.level, 120);
    assert.equal(saved.appearance.hair, 15); assert.equal(saved.appearance.skin, 7);
    assert.equal(saved.render.clothing.cape.piece, 'Knight.cape'); assert.equal(saved.render.weapon, 'espada_inicial');
    assert.equal(saved.render.scale, 1.5); assert.equal(saved.render.clothing.head.piece, '');
    assert.equal(saved.render.clothing.leftArm.piece, 'Ranger.leftArm');
    assert.equal(saved.render.clothing.torso.primary, 2);
    assert.equal(saved.badgeIcon, 'herrero_pendiente');
    assert.ok(!Object.hasOwn(saved.render, 'outfit'));
    const extra = schema.newNpc('importado_desde_biblioteca');
    await page.locator('#import').setInputFiles({ name: 'biblioteca.json', mimeType: 'application/json', buffer: Buffer.from(json({ version: 1, npcs: [extra] })) });
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Biblioteca importada:'));
    assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs.length, 2);
    await page.locator('#library').selectOption(extra.id);
    await page.locator('#delete').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Ficha eliminada'));
    assert.equal(await page.locator('#npc-id').getAttribute('readonly'), '');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.'));
    await page.locator('#library').selectOption(saved.id); await page.locator('#load').click();
    assert.equal(await page.locator('#npc-name').inputValue(), saved.name);
    assert.equal(await page.locator('#appearance-skin').inputValue(), '7');
    assert.equal(await page.locator('#render-weapon').inputValue(), 'espada_inicial');
    assert.equal(await page.locator('#clothing-leftArm').inputValue(), 'Ranger.leftArm');
    assert.equal(await page.locator('#clothing-torso-primary').inputValue(), '2');
    assert.equal(await page.locator('#npc-badgeIcon').inputValue(), 'herrero_pendiente');
    assert.equal(await page.locator('#badge-preview').getAttribute('data-badge-status'), 'pending');
    await page.locator('#appearance-cls').selectOption('explorador');
    assert.equal(await page.locator('#clothing-torso').inputValue(), 'Mage.torso');
    assert.equal(await page.locator('#clothing-leftArm').inputValue(), 'Ranger.leftArm');
    assert.match(await page.locator('#preview-stats').textContent(), /45678 \/ 90000/);
    assert.equal(await page.locator('#animation option').count(), 142);
    const animationValues = await page.locator('#animation option').evaluateAll(nodes => nodes.slice(3).map(node => node.value));
    for (const value of animationValues) {
      await page.locator('#animation').selectOption(value);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    await page.locator('#animation').selectOption('idle');
    for (const button of ['wave', 'speak', 'pickup', 'consume', 'hit', 'die']) await page.locator(`#${button}`).click();
    await page.locator('#animation').selectOption('walk');
    await page.locator('#duplicate').click();
    assert.equal(await page.locator('#npc-id').inputValue(), saved.id + '_2');
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Guardado en el proyecto:'));
    assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs.length, 2);
    await page.locator('#npc-name').fill('Alba editada');
    await page.locator('#clothing-rightArm').selectOption('helpers.rightArm');
    await page.locator('#clothing-rightArm-primary').selectOption('3');
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Guardado en el proyecto: Alba editada'));
    const downloading = page.waitForEvent('download'); await page.locator('#export').click();
    const download = await downloading; const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(exported.name, 'Alba editada');
    assert.equal(exported.render.clothing.rightArm.piece, 'helpers.rightArm');
    assert.equal(exported.render.clothing.rightArm.primary, 3);
    await page.locator('#import').setInputFiles({ name: 'npc.json', mimeType: 'application/json', buffer: Buffer.from(json(exported)) });
    await page.waitForFunction(() => document.querySelector('#npc-id').value.endsWith('_2_2'));
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Guardado en el proyecto:'));
    assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs.length, 3);
    await page.locator('#delete').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Ficha eliminada'));
    assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs.length, 2);
    // Reloaded catalog data must not erase the current unsaved draft.
    const beforeReload = await page.locator('#npc-id').inputValue();
    await page.locator('#reload').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Biblioteca recargada'));
    assert.equal(await page.locator('#npc-id').inputValue(), beforeReload);
    await page.locator('#library').selectOption(saved.id); await page.locator('#load').click();
    await page.locator('#npc-name').fill('Mi edición local');
    disk = JSON.parse(await readFile(catalogPath, 'utf8')); disk.npcs[0].subtitle = 'Edición externa';
    await writeFile(catalogPath, json(disk));
    page.off('console', listen);
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('catálogo cambió'));
    assert.equal(await page.locator('#npc-name').inputValue(), 'Mi edición local');
    assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs[0].name, saved.name);
    await page.locator('#reload').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Biblioteca recargada'));
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Guardado en el proyecto:'));
    page.on('console', listen);
    assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs[0].name, 'Mi edición local');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')]
      .filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => `${node.tagName}#${node.id}`));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, overflow.join(', '));
    assert.ok(await page.locator('#scene').isVisible());
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('saved edits to all three existing NPCs reach their actual world actors and badges without reloading the editor on save', { timeout: 120000 }, async () => {
  const value = schema.validateNpcCatalog(JSON.parse(await readFile(new URL('../src/data/npcs.json', import.meta.url), 'utf8')));
  await writeFile(catalogPath, json(value));
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const editor = await context.newPage(), game = await context.newPage(), errors = [];
  for (const page of [editor, game]) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', event => { if (event.type() === 'warning' && /PropertyBinding|No target node/.test(event.text())) errors.push(event.text()); });
  }
  try {
    await editor.goto(`${url}/npcs.html`);
    await editor.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.'));
    await game.addInitScript(() => {
      localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off');
      localStorage.setItem('brumaluz-language', 'es');
    });
    await game.goto(`${url}/?test&graphics=compatible`);
    await game.waitForFunction(() => !!window.brumaluz, null, { timeout: 60000 });
    let editorReloads = 0;
    editor.on('framenavigated', frame => { if (frame === editor.mainFrame()) editorReloads++; });
    for (const [id, name] of [['testiculos', 'Probador editado'], ['gnomi', 'Gnomi editado'], ['isberto', 'Isberto editado']]) {
      await editor.locator('#library').selectOption(id); await editor.locator('#load').click();
      assert.equal(await editor.locator('#delete').isDisabled(), true);
      await editor.locator('#npc-name').fill(name);
      await editor.locator('#npc-subtitle').fill(`Subtitulo de ${id}`);
      await editor.locator('#npc-badgeIcon').fill(`${id}_pintado`);
      if (id === 'testiculos') {
        await editor.locator('#clothing-leftArm').selectOption('Ranger.leftArm');
        await editor.locator('#render-scale').fill('1.25');
        await editor.locator('#npc-level').fill('17');
        await editor.locator('#npc-maxHealth').fill('789');
        await editor.locator('#npc-health').fill('123');
      }
      if (id === 'gnomi') await editor.locator('#render-scale').fill('0.55');
      await editor.locator('#save').click();
      await editor.waitForFunction(name => document.querySelector('#status').textContent.startsWith(`Guardado en el proyecto: ${name}`), name);
      assert.equal(await editor.locator('#npc-id').inputValue(), id);
      assert.equal(await editor.locator('#badge-preview').getAttribute('data-badge-status'), 'pending');
    }
    assert.equal(editorReloads, 0);
    assert.equal(JSON.parse(await readFile(catalogPath, 'utf8')).npcs.length, value.npcs.length);
    await game.reload();
    await game.waitForFunction(() => !!window.brumaluz, null, { timeout: 60000 });
    const actors = await game.evaluate(() => {
      const scene = window.brumaluz.city().root.parent;
      const test = scene.getObjectByName('npc:testiculos'), farmer = scene.getObjectByName('npc:isberto');
      const gnome = scene.getObjectByName('gnomi-rig').children[0];
      return { leftArm: !!test.getObjectByName('Ranger_ArmLeft'), oldLeftArm: !!test.getObjectByName('Rogue_ArmLeft'),
        scale: test.scale.x, gnomeScale: gnome.scale.x, farmerHidden: !farmer.visible };
    });
    assert.equal(actors.leftArm, true); assert.equal(actors.oldLeftArm, false);
    assert.equal(actors.scale, 1.25); assert.equal(actors.gnomeScale, .55); assert.equal(actors.farmerHidden, true);
    await game.evaluate(() => { window.brumaluz.play(); window.brumaluz.move(2, -.4); window.brumaluz.view(0, .55, 12); });
    await game.waitForFunction(() => !document.querySelector('.nameplate.npc:not(.welcome-nameplate)').hidden);
    await game.mouse.move(1278, 848);
    await game.waitForFunction(() => document.querySelector('#target-frame').dataset.targetId === 'npc:testiculos' && !document.querySelector('#target-frame').hidden);
    assert.equal(await game.locator('.target-name').textContent(), 'Probador editado');
    assert.match(await game.locator('.target-level').textContent(), /17/);
    assert.equal(await game.locator('.target-health span').textContent(), '123 / 789');
    assert.equal(await game.locator('.target-emblem').getAttribute('data-badge-icon'), 'testiculos_pintado');
    assert.equal(await game.locator('.target-emblem').getAttribute('data-badge-status'), 'pending');
    await game.evaluate(() => {
      const gnome = window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      window.brumaluz.move(gnome.position.x, gnome.position.z + 1.7);
    });
    await game.waitForFunction(() => document.querySelector('#interact-label').textContent.includes('Gnomi editado'));
    await game.keyboard.press('KeyE');
    await game.locator('#dialog').waitFor({ state: 'visible' });
    assert.equal(await game.locator('.dialog-speaker').textContent(), 'Gnomi editado');
    assert.equal(await game.locator('.dialog-subtitle').textContent(), 'Subtitulo de gnomi');
    assert.equal(editorReloads, 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('NPC badge renderer supports default, reserved, loaded and late-failing images without corrupting the current badge', async () => {
  const context = await browser.newContext(), page = await context.newPage();
  const errors = [];
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  try {
    await page.goto(`${url}/npcs.html`);
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.'));
    const result = await page.evaluate(async () => {
      const { renderNpcBadge } = await import('/src/ui/npcBadges.ts');
      const element = document.createElement('div'); document.body.append(element);
      renderNpcBadge(element, 'debug', 'Depuración');
      const automatic = element.dataset.badgeStatus === 'default' && !!element.querySelector('svg');
      renderNpcBadge(element, 'resident', 'Herrero', 'pendiente');
      const pending = element.dataset.badgeStatus === 'pending' && element.title.includes('pendiente');
      const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
      renderNpcBadge(element, 'resident', 'Herrero', 'pintado', [{ id: 'pintado', url }]);
      const image = element.querySelector('img'); await image.decode();
      const loaded = element.dataset.badgeStatus === 'ready' && image.naturalWidth === 1;
      image.dispatchEvent(new Event('error'));
      const failed = element.dataset.badgeStatus === 'error' && !!element.querySelector('svg') && element.title.includes('No se pudo cargar');
      renderNpcBadge(element, 'resident', 'Herrero', 'pintado', [{ id: 'pintado', url }]);
      const obsoleteImage = element.querySelector('img'); await obsoleteImage.decode();
      renderNpcBadge(element, 'merchant', 'Comerciante');
      obsoleteImage.dispatchEvent(new Event('error'));
      const stale = element.dataset.badgeStatus === 'default' && !!element.querySelector('svg') && element.title === 'Comerciante';
      element.remove(); return { automatic, pending, loaded, failed, stale };
    });
    assert.deepEqual(result, { automatic: true, pending: true, loaded: true, failed: true, stale: true });
    assert.deepEqual(errors, ['No se pudo cargar el icono de NPC pintado.']);
  } finally { await context.close(); }
});

test('NPC renderer preserves defaults while supporting every outfit, cape, hat, equipment and scale combination', { timeout: 120000 }, async () => {
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.goto(`${url}/npcs.html`);
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.'), null, { timeout: 60000 });
    const result = await page.evaluate(async () => {
      const { Character } = await import('/src/character/character.ts');
      const { createNpc } = await import('/src/character/npc.ts');
      const { newNpc, npcCharacter } = await import('/src/data/npcs.ts');
      const { RACES, CLASSES, CLOTH } = await import('/src/data/data.ts');
      const { NPC_CLOTHING, NPC_CLOTHING_SLOTS } = await import('/src/data/npcClothing.ts');
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const failures = [], check = (value, label) => { if (!value) failures.push(label); };
      const names = actor => { const result = []; actor.root.traverse(node => result.push(node.name)); return result; };
      let count = 0;
      for (const race of Object.keys(RACES)) for (const cls of Object.keys(CLASSES)) {
        const npc = newNpc(); npc.appearance.race = race; npc.appearance.cls = cls;
        const plain = new Character(npcCharacter(npc), { outfit: false });
        const created = await createNpc(npc);
        check(JSON.stringify(names(plain).sort()) === JSON.stringify(names(created).sort()), `${race}/${cls}: changed default geometry`);
        plain.dispose(); created.dispose();
      }
      async function checkClothing(npc) {
        npc.render = { ...npc.render, scale: 1.8, width: 1.2, height: .8, weapon: 'espada_inicial', offhand: 'escudo_inicial' };
        const actor = await createNpc(npc), children = names(actor);
        check(children.includes('1H_Sword') && children.includes('Badge_Shield'), 'missing explicit equipment');
        for (const selection of Object.values(npc.render.clothing)) {
          if (!selection.piece) continue;
          const definition = NPC_CLOTHING.find(piece => piece.id === selection.piece);
          for (const node of definition.nodes) check(children.filter(name => name === node).length === 1, `${selection.piece}: missing/duplicate ${node}`);
        }
        actor.update(0); actor.update(.1); actor.heal();
        for (let time = .2; time < 1.1; time += .1) actor.update(time);
        check(actor.root.scale.x === 1.8, 'healing reset NPC scale');
        const box = new THREE.Box3().setFromObject(actor.root);
        check(!box.isEmpty() && [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite), 'invalid bounds');
        check(box.getSize(new THREE.Vector3()).length() < 15, 'exploded rig');
        actor.dispose(); count++;
      }
      for (const race of Object.keys(RACES)) for (const piece of NPC_CLOTHING) {
        const npc = newNpc(); npc.appearance.race = race;
        npc.render.clothing[piece.slot] = { piece: piece.id, primary: 2, secondary: 3 };
        await checkClothing(npc);
      }
      const colored = newNpc();
      colored.render.clothing.leftArm = { piece: 'helpers.leftArm', primary: 2, secondary: 3 };
      const tinted = await createNpc(colored);
      const sleeve = tinted.root.getObjectByName('helpers-sleeve-l');
      const sleeveMaterial = Array.isArray(sleeve.material) ? sleeve.material[0] : sleeve.material;
      check(sleeveMaterial.color.getHexString() === new THREE.Color(CLOTH[2]).getHexString(), 'piece color not applied');
      const hand = tinted.root.getObjectByName('anatomy-hand-left');
      const handMaterial = Array.isArray(hand.material) ? hand.material[0] : hand.material;
      check(handMaterial.color.getHexString() === new THREE.Color(RACES[colored.appearance.race].skins[colored.appearance.skin]).getHexString(), 'garment recolored skin');
      tinted.dispose();
      const slots = Object.keys(NPC_CLOTHING_SLOTS), races = Object.keys(RACES), classes = Object.keys(CLASSES);
      for (let index = 0; index < 408; index++) {
        const npc = newNpc(); npc.appearance.race = races[index % races.length]; npc.appearance.cls = classes[index % classes.length];
        slots.forEach((slot, slotIndex) => {
          const choices = NPC_CLOTHING.filter(piece => piece.slot === slot);
          npc.render.clothing[slot] = { piece: choices[(index * (slotIndex + 3) + slotIndex) % choices.length].id,
            primary: index % CLOTH.length, secondary: (index + 3) % CLOTH.length };
        });
        await checkClothing(npc);
      }
      const { catalog, loadLibraryAsset } = await import('/src/art/library.ts');
      const actor = await createNpc(newNpc()), sources = catalog.assets.filter(asset => asset.kind === 'animations' && asset.pack === 'character-animations' && asset.rig === 'medium');
      let clips = 0, time = 0;
      for (const source of sources) {
        const { gltf } = await loadLibraryAsset(source.id);
        for (const clip of gltf.animations) {
          actor.stopGesture(); actor.playClip(clip); actor.update(time); time += .1; actor.update(time); clips++;
        }
      }
      actor.dispose();
      return { failures, count, clips, expected: NPC_CLOTHING.length * races.length + 408 };
    });
    assert.equal(result.count, result.expected); assert.ok(result.count >= 600);
    assert.equal(result.clips, 139); assert.deepEqual(result.failures, []);
  } finally { await context.close(); }
});

test('NPC file storage middleware is absent from production preview', async () => {
  const production = await preview({ logLevel: 'error', preview: { host: '127.0.0.1', port: 4184, strictPort: true } });
  try {
    const response = await fetch('http://127.0.0.1:4184/__dev/npcs');
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /application\/json/);
    const write = await fetch('http://127.0.0.1:4184/__dev/npcs', { method: 'PUT', body: json(empty()) });
    assert.notEqual(write.status, 200);
  } finally {
    await new Promise(resolve => { production.httpServer.close(resolve); production.httpServer.closeAllConnections(); });
  }
});
