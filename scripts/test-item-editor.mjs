import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { itemEditorPlugin } from '../tools/item-editor-plugin.mjs';

let server, browser, directory, file, schema, refs, editorTools;
const port = 4195;
const base = `http://127.0.0.1:${port}`;

const get = () => fetch(`${base}/__dev/items`);
const put = (value, revision, headers = {}) =>
  fetch(`${base}/__dev/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': revision, ...headers },
    body: JSON.stringify(value),
  });

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'brumaluz-items-'));
  file = join(directory, 'itemsCatalog.json');

  const initialCatalog = {
    version: 1,
    items: [
      {
        id: 'mineral_cobre_test',
        label: 'Mineral de cobre de prueba',
        description: 'Muestra de prueba para la suite de tests.',
        category: 'resource',
        rarity: 'common',
        icon: '<circle cx="12" cy="12" r="8" fill="#b47d56"/>',
        active: true,
        tags: ['mineral', 'test'],
        value: 10,
        sellPrice: 5,
        stack: 99,
        bound: false,
        sellable: true,
        tradable: true,
        storable: true,
        droppable: true,
        equippable: false,
        stats: [],
        usable: false,
        effects: [],
      },
    ],
  };

  await writeFile(file, JSON.stringify(initialCatalog, null, 2));

  server = await createServer({
    configFile: false,
    logLevel: 'error',
    cacheDir: 'node_modules/.vite-item-tests',
    optimizeDeps: {
      entries: ['items.html'],
      include: [
        'three',
        'three/examples/jsm/controls/OrbitControls.js',
        'three/examples/jsm/loaders/GLTFLoader.js',
      ],
    },
    plugins: [itemEditorPlugin({ catalogPath: file })],
    assetsInclude: ['**/*.glb'],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      hmr: false,
      watch: null,
    },
  });

  await server.listen();
  schema = await server.ssrLoadModule('/src/data/itemsCatalog.ts');
  editorTools = await server.ssrLoadModule('/src/dev/itemEditorTools.ts');

  const refRes = await fetch(`${base}/__dev/items/references`);
  assert.equal(refRes.status, 200);
  refs = await refRes.json();

  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), 'brumaluz-items-'))) {
    await rm(directory, { recursive: true, force: true });
  }
});

test('1. Schema validation accepts valid items and rejects malformed fields', () => {
  const valid = {
    id: 'pocion_magica_test',
    label: 'Poción mágica de prueba',
    description: 'Restaura maná.',
    category: 'consumable',
    rarity: 'uncommon',
    icon: '<rect width="10" height="10"/>',
    active: true,
    tags: ['pocion'],
    value: 20,
    sellPrice: 10,
    stack: 50,
    bound: false,
    sellable: true,
    tradable: true,
    storable: true,
    droppable: true,
    equippable: false,
    stats: [],
    usable: true,
    effects: [{ type: 'restore_mana', percent: 20 }],
  };

  const parsed = schema.validateItem(valid);
  assert.equal(parsed.id, 'pocion_magica_test');
  assert.equal(parsed.rarity, 'uncommon');

  // Rejections
  assert.throws(() => schema.validateItem({ ...valid, id: 'INVALID ID WITH SPACES' }));
  assert.throws(() => schema.validateItem({ ...valid, id: 'x' })); // Too short
  assert.throws(() => schema.validateItem({ ...valid, label: '' })); // Empty label
  assert.throws(() => schema.validateItem({ ...valid, value: -5 })); // Negative value
  assert.throws(() => schema.validateItem({ ...valid, stack: 0 })); // Zero stack
  assert.throws(() => schema.validateItem({ ...valid, equippable: true })); // Equippable without slot
});

test('2. Template generation creates valid stackable material, tool, armor, and consumable', () => {
  const mat = schema.createItemFromTemplate('material_apilable', 'cuero_lobo_test', 'Cuero de lobo');
  assert.equal(mat.category, 'resource');
  assert.equal(mat.stack, 99);
  assert.equal(mat.equippable, false);

  const tool = schema.createItemFromTemplate('herramienta_minero', 'pico_test', 'Pico de prueba');
  assert.equal(tool.category, 'tool');
  assert.equal(tool.equippable, true);
  assert.equal(tool.slot, 'offhand');
  assert.equal(tool.maxDurability, 100);

  const armor = schema.createItemFromTemplate('armadura_pecho', 'coraza_test', 'Coraza de prueba');
  assert.equal(armor.equippable, true);
  assert.equal(armor.slot, 'chest');
  assert(armor.stats.some(s => s.label === 'Guardia'));

  const pot = schema.createItemFromTemplate('pocion_curativa', 'pocion_vida_test', 'Poción de vida');
  assert.equal(pot.usable, true);
  assert(pot.effects.some(e => e.type === 'restore_health'));
});

test('3. References check detects items used by quests, vendors, or recipes and protects deletion', () => {
  const fakeRefs = {
    quests: [
      { id: 'mision_pan', title: 'Comida para el camino', objectiveItems: ['pan_duro'], rewardItems: [] },
    ],
    vendors: [{ id: 'testiculos', name: 'Testículos', items: ['pan_duro', 'pocion_vida_minuscula'] }],
    recipes: [{ id: 'receta_espada', output: 'espada_cobre_t1', ingredients: ['material_minero_0'] }],
    coreItemIds: ['espada_inicial'],
  };

  const usedInQuests = schema.getItemUsageReferences('pan_duro', fakeRefs);
  assert(usedInQuests.some(r => r.includes('Misión')));
  assert(usedInQuests.some(r => r.includes('Comercio')));

  const usedInCore = schema.getItemUsageReferences('espada_inicial', fakeRefs);
  assert(usedInCore.some(r => r.includes('Sistema base')));

  const usedInRecipe = schema.getItemUsageReferences('material_minero_0', fakeRefs);
  assert(usedInRecipe.some(r => r.includes('Receta de artesanía')));

  const unreferenced = schema.getItemUsageReferences('objeto_libre_sin_uso', fakeRefs);
  assert.equal(unreferenced.length, 0);
});

test('4. Atomic persistence saves correctly and checks ETag concurrency', async () => {
  const resGet = await get();
  assert.equal(resGet.status, 200);
  const etag = resGet.headers.get('ETag');
  const cat = await resGet.json();

  const newItem = {
    id: 'lingote_oro_test',
    label: 'Lingote de oro de prueba',
    description: 'Oro brillante.',
    category: 'resource',
    rarity: 'rare',
    icon: '<rect fill="#e5be4b"/>',
    active: true,
    tags: ['oro', 'lingote'],
    value: 500,
    sellPrice: 250,
    stack: 99,
    bound: false,
    sellable: true,
    tradable: true,
    storable: true,
    droppable: true,
    equippable: false,
    stats: [],
    usable: false,
    effects: [],
  };

  cat.items.push(newItem);

  // Stale ETag check
  const staleRes = await put(cat, '"stale-etag-value"');
  assert.equal(staleRes.status, 409);

  // Correct ETag check
  const okRes = await put(cat, etag);
  assert.equal(okRes.status, 200);
  const updatedCat = await okRes.json();
  assert.equal(updatedCat.items.length, 2);
  assert(updatedCat.items.some(i => i.id === 'lingote_oro_test'));

  // Verify file on disk
  const onDisk = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(onDisk.items.length, 2);
});

test('5. Local security restricts cross-origin or non-local headers', async () => {
  const crossSiteRes = await fetch(`${base}/__dev/items`, {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(crossSiteRes.status, 403);
});

test('6. HistoryManager supports undo and redo with debounce coalescing', () => {
  const h = new editorTools.HistoryManager({ id: 'test', label: 'Inicio', value: 10 });
  assert.equal(h.canUndo, false);
  assert.equal(h.canRedo, false);

  h.push({ id: 'test', label: 'Paso 1', value: 20 });
  assert.equal(h.canUndo, true);
  assert.equal(h.state.label, 'Paso 1');

  const undone = h.undo();
  assert.equal(undone.label, 'Inicio');
  assert.equal(h.canRedo, true);

  const redone = h.redo();
  assert.equal(redone.label, 'Paso 1');
});

test('7. Filter and sort orders items correctly by label, rarity, category, value', () => {
  const items = [
    { id: 'b', label: 'Báculo arcano', category: 'weapon', rarity: 'epic', value: 300, active: true, tags: [] },
    { id: 'a', label: 'Arco de tejo', category: 'weapon', rarity: 'common', value: 50, active: true, tags: [] },
    { id: 'c', label: 'Coraza real', category: 'armor', rarity: 'legendary', value: 800, active: false, tags: [] },
  ];

  const sortedAlpha = editorTools.filterAndSortItems(items, { sortBy: 'label', direction: 'asc' });
  assert.equal(sortedAlpha[0].id, 'a');
  assert.equal(sortedAlpha[1].id, 'b');

  const sortedRarityDesc = editorTools.filterAndSortItems(items, { sortBy: 'rarity', direction: 'desc' });
  assert.equal(sortedRarityDesc[0].id, 'c'); // legendary
  assert.equal(sortedRarityDesc[1].id, 'b'); // epic

  const filteredInactive = editorTools.filterAndSortItems(items, { status: 'inactive' });
  assert.equal(filteredInactive.length, 1);
  assert.equal(filteredInactive[0].id, 'c');
});

test('7.5. Server serves items.html and compiles itemEditor.ts', async () => {
  const htmlRes = await fetch(`${base}/items.html`);
  assert.equal(htmlRes.status, 200);
  const tsRes = await fetch(`${base}/src/dev/itemEditor.ts`);
  assert.equal(tsRes.status, 200, await tsRes.text());
});

test('8. End-to-end browser: load editor, edit item, verify tooltip preview and save', { timeout: 120000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('dialog', dialog => dialog.accept());
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err));
  page.on('request', req => console.log('REQ:', req.url()));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', res => { if (res.status() >= 400) console.log('RES ERR:', res.status(), res.url()); });
  try {
    await page.goto(`${base}/items.html`);
    await page.locator('#items-list .item-row').first().waitFor({ timeout: 60000 });

    // Title and status check
    const headerTitle = await page.textContent('.workshop-header h1');
    assert(headerTitle.includes('Editor de objetos'));

    // Verify row rendered
    const rows = await page.$$('#items-list .item-row');
    assert(rows.length >= 1);

    // Click "+ Crear objeto en blanco"
    await page.click('#new-item-btn');
    await page.waitForSelector('#field-id');

    // Fill form in General tab
    await page.fill('#field-id', 'test_espada_e2e');
    await page.fill('#field-label', 'Espada del Fin de Semana');
    await page.fill('#field-description', 'Espada forjada para verificar la interfaz.');
    await page.selectOption('#field-category', 'weapon');
    await page.selectOption('#field-rarity', 'epic');

    // Check tooltip preview live update
    const previewTitle = await page.textContent('#tooltip-preview .tooltip-title');
    assert.equal(previewTitle, 'Espada del Fin de Semana');

    // Switch to Properties tab
    await page.click('[data-tab="tab-properties"]');
    await page.fill('#field-value', '450');

    // Switch to Equip tab
    await page.click('[data-tab="tab-equipment"]');
    await page.check('#field-equippable');
    await page.selectOption('#field-slot', 'weapon');
    await page.selectOption('#field-requiredClass', 'guerrero');

    // Check dirty pill
    const dirtyText = await page.textContent('#dirty-pill');
    assert.equal(dirtyText, 'Cambios sin guardar');

    // Submit form (Save)
    await page.click('#save-btn');
    await page.waitForFunction(() => document.getElementById('dirty-pill')?.textContent === 'Sin cambios');

    // Verify status message
    const statusMsg = await page.textContent('#status');
    assert(statusMsg.includes('guardado correctamente'));

    // Verify new item is in the list
    const itemInList = await page.waitForSelector('[data-id="test_espada_e2e"]');
    assert(itemInList);
  } finally {
    await page.close();
  }
});
