import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { shopEditorPlugin } from '../tools/shop-editor-plugin.mjs';

let server, browser, directory, file, schema, tools;
const port = 4199;
const base = `http://127.0.0.1:${port}`;

const get = () => fetch(`${base}/__dev/shops`);
const put = (value, revision, headers = {}) =>
  fetch(`${base}/__dev/shops`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': revision, ...headers },
    body: JSON.stringify(value),
  });

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'brumaluz-shops-'));
  file = join(directory, 'shopsCatalog.json');

  const initialCatalog = {
    version: 1,
    shops: [
      {
        id: 'tienda_test',
        name: 'Tienda de Pruebas',
        description: 'Puesto de prueba para tests automatizados.',
        category: 'general',
        npcId: 'testiculos',
        currency: 'pelines',
        active: true,
        items: [
          { itemId: 'pan_duro', buyPrice: 4, sellPrice: 2, stock: null },
          { itemId: 'pocion_vida_minuscula', buyPrice: 15, sellPrice: 7, stock: 10 },
        ],
        tags: ['test', 'inicial'],
      },
    ],
  };

  await writeFile(file, `${JSON.stringify(initialCatalog, null, 2)}\n`, 'utf8');

  server = await createServer({
    configFile: false,
    logLevel: 'error',
    cacheDir: 'node_modules/.vite-shop-tests',
    optimizeDeps: {
      entries: ['shops.html'],
    },
    plugins: [shopEditorPlugin({ catalogPath: file })],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      hmr: false,
      watch: null,
    },
  });
  await server.listen();

  schema = await server.ssrLoadModule('/src/data/shopsCatalog.ts');
  tools = await server.ssrLoadModule('/src/dev/shopEditorTools.ts');
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('1. Shop schema validation accepts valid shops and rejects malformed fields', () => {
  const validShop = {
    id: 'tienda_valida',
    name: 'Boticario Central',
    description: 'Pociones y remedios.',
    category: 'potions_alchemy',
    npcId: 'maestro_alquimia',
    currency: 'pelines',
    active: true,
    items: [
      { itemId: 'pocion_vida_minuscula', buyPrice: 15, sellPrice: 7, stock: 20 },
    ],
    tags: ['alquimia'],
  };

  const parsed = schema.validateShop(validShop);
  assert.equal(parsed.id, 'tienda_valida');
  assert.equal(parsed.name, 'Boticario Central');
  assert.equal(parsed.items.length, 1);

  // ID inválido
  assert.throws(() => schema.validateShop({ ...validShop, id: 'INVALID-ID!' }), /ID de tienda no válido/);

  // Nombre vacío
  assert.throws(() => schema.validateShop({ ...validShop, name: '   ' }), /Nombre de tienda no válido/);

  // Ítems duplicados
  assert.throws(() => schema.validateShop({
    ...validShop,
    items: [
      { itemId: 'pan_duro', buyPrice: 4 },
      { itemId: 'pan_duro', buyPrice: 4 },
    ],
  }), /duplicado en la tienda/);
});

test('2. Template generation builds valid shop definitions', () => {
  const tpl = schema.createShopFromTemplate('tienda_fragua_isberto', 'mi_armeria');
  assert.equal(tpl.id, 'mi_armeria');
  assert.equal(tpl.category, 'weapons_armor');
  assert.equal(tpl.npcId, 'isberto');
  assert.ok(tpl.items.length > 0);

  const empty = schema.createEmptyShop('tienda_vacia', 'Tienda Nueva');
  assert.equal(empty.id, 'tienda_vacia');
  assert.equal(empty.items.length, 0);
  assert.equal(empty.currency, 'pelines');
});

test('3. Duplicate shop generates unique identifier with copy suffix', () => {
  const original = schema.createEmptyShop('tienda_armas', 'Armería');
  const copy1 = schema.duplicateShop(original, ['tienda_armas']);
  assert.equal(copy1.id, 'tienda_armas_copia');
  assert.equal(copy1.name, 'Armería (Copia)');

  const copy2 = schema.duplicateShop(original, ['tienda_armas', 'tienda_armas_copia']);
  assert.equal(copy2.id, 'tienda_armas_copia_2');
});

test('4. Audit engine detects non-existent items, missing NPCs, and price exploits', () => {
  const mockRefs = {
    items: [
      { id: 'pan_duro', label: 'Pan duro', category: 'Alimento', rarity: 'common', icon: '', value: 4, sellPrice: 2 },
      { id: 'pocion_vida_minuscula', label: 'Poción de vida', category: 'Consumible', rarity: 'common', icon: '', value: 15, sellPrice: 7 },
    ],
    npcs: [
      { id: 'testiculos', name: 'Testículos', subtitle: 'Depuración' },
    ],
  };

  // Tienda con objeto inexistente y precio exploit
  const shopWithIssues = {
    id: 'tienda_invalida',
    name: 'Tienda Errónea',
    description: '',
    category: 'general',
    npcId: 'npc_fantasma', // NPC inexistente
    currency: 'pelines',
    active: true,
    items: [
      { itemId: 'objeto_que_no_existe', buyPrice: 10, sellPrice: 5 },
      { itemId: 'pan_duro', buyPrice: 5, sellPrice: 20 }, // exploit: sell > buy
    ],
  };

  const audit = schema.auditShop(shopWithIssues, mockRefs);
  assert.equal(audit.valid, false);
  assert.ok(audit.issues.some(i => i.code === 'MISSING_NPC'));
  assert.ok(audit.issues.some(i => i.code === 'MISSING_ITEM'));
  assert.ok(audit.issues.some(i => i.code === 'EXPLOIT_PRICE'));
});

test('5. Atomic persistence saves correctly and checks ETag concurrency', async () => {
  const getRes = await get();
  assert.equal(getRes.status, 200);
  const etag = getRes.headers.get('ETag');
  const catalog = await getRes.json();

  assert.equal(catalog.version, 1);
  assert.equal(catalog.shops[0].id, 'tienda_test');

  // Guardar con ETag correcto
  const updated = structuredClone(catalog);
  updated.shops[0].name = 'Tienda de Pruebas Renombrada';
  const putRes = await put(updated, etag);
  assert.equal(putRes.status, 200);
  const newEtag = putRes.headers.get('ETag');
  assert.notEqual(newEtag, etag);

  // Intento de sobrescritura con ETag viejo (debe dar 409 Conflict)
  const staleRes = await put(updated, etag);
  assert.equal(staleRes.status, 409);
});

test('6. Local security restricts cross-origin and remote headers', async () => {
  const res = await fetch(`${base}/__dev/shops`, {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(res.status, 403);
});

test('7. HistoryManager supports undo and redo with debounce coalescing', () => {
  const initial = schema.createEmptyShop('tienda_h', 'Historial 1');
  const history = new tools.HistoryManager(initial, 60, 20);

  const state2 = { ...initial, name: 'Historial 2' };
  history.push(state2, true);
  assert.equal(history.canUndo(), true);

  const state3 = { ...initial, name: 'Historial 3' };
  history.push(state3, true);

  const undo1 = history.undo();
  assert.equal(undo1.name, 'Historial 2');

  const redo1 = history.redo();
  assert.equal(redo1.name, 'Historial 3');
});

test('8. Filter and sort orders shops correctly', () => {
  const shops = [
    { id: 'b_tienda', name: 'Boticario', category: 'potions_alchemy', npcId: 'alquimista', active: true, items: [{ itemId: 'p1' }, { itemId: 'p2' }] },
    { id: 'a_tienda', name: 'Armería', category: 'weapons_armor', npcId: 'herrero', active: false, items: [{ itemId: 'w1' }] },
  ];

  const byNameAsc = tools.filterAndSortShops(shops, { sortOrder: 'name_asc' });
  assert.equal(byNameAsc[0].name, 'Armería');
  assert.equal(byNameAsc[1].name, 'Boticario');

  const onlyActive = tools.filterAndSortShops(shops, { status: 'active' });
  assert.equal(onlyActive.length, 1);
  assert.equal(onlyActive[0].id, 'b_tienda');
});

test('9. Browser e2e: load editor, create shop, associate NPC, add items, configure prices and save', async () => {
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.error('BROWSER ERROR:', msg.text());
  });

  await page.goto(`${base}/shops.html`, { waitUntil: 'networkidle' });

  // 1. Verificar carga de la página
  const title = await page.textContent('h1');
  assert.match(title, /Editor de tiendas/);

  // 2. Crear una nueva tienda
  await page.click('#new-shop-btn');

  // Esperar a que el formulario tenga los datos de la nueva tienda
  await page.waitForSelector('#shop-name');
  await page.fill('#shop-name', 'Supertienda de Aventuras');

  // 3. Asociar un NPC existente
  await page.click('button[data-tab="merchant"]');
  await page.selectOption('#shop-npc', 'testiculos');

  // 4. Ir a la pestaña de productos y abrir el modal
  await page.click('button[data-tab="products"]');
  await page.click('#add-product-btn');

  // Esperar a que el modal esté visible
  await page.waitForSelector('.picker-item-card');
  // Hacer clic en el primer producto disponible del modal
  await page.click('.picker-item-card:first-child');

  // 5. Verificar que se añadió a la tabla y cambiar precio de compra
  await page.waitForSelector('.item-buy-price');
  await page.fill('.item-buy-price', '99');
  await page.dispatchEvent('.item-buy-price', 'change');

  // 6. Guardar la tienda
  await page.click('#save-btn');
  await page.waitForSelector('#status.success', { timeout: 5000 });

  // 7. Verificar persistencia en disco
  const diskData = JSON.parse(await readFile(file, 'utf8'));
  const savedShop = diskData.shops.find(s => s.name === 'Supertienda de Aventuras');
  assert.ok(savedShop, 'La tienda creada debe estar guardada en el JSON');
  assert.equal(savedShop.npcId, 'testiculos', 'El NPC asociado debe persistirse');
  assert.equal(savedShop.items[0].buyPrice, 99, 'El precio personalizado de compra debe persistirse');

  // 8. Duplicar la tienda
  await page.click('#duplicate-shop-btn');
  await page.click('#save-btn');
  await page.waitForSelector('#status.success', { timeout: 5000 });

  const afterDup = JSON.parse(await readFile(file, 'utf8'));
  const dupShop = afterDup.shops.find(s => s.id === `${savedShop.id}_copia`);
  assert.ok(dupShop, 'La tienda duplicada debe existir en disco');

  // 9. Eliminar la tienda duplicada con confirmación
  page.on('dialog', async dialog => {
    await dialog.accept();
  });
  await page.click('#delete-shop-btn');
  await page.click('#save-btn');
  await page.waitForSelector('#status.success', { timeout: 5000 });

  const finalData = JSON.parse(await readFile(file, 'utf8'));
  const deletedStillExists = finalData.shops.some(s => s.id === dupShop.id);
  assert.equal(deletedStillExists, false, 'La tienda eliminada no debe existir en disco');

  await page.close();
});
