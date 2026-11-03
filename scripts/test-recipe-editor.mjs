import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { recipeEditorPlugin } from '../tools/recipe-editor-plugin.mjs';

let server, browser, directory, file, schema, tools;
const port = 4198;
const base = `http://127.0.0.1:${port}`;

const get = () => fetch(`${base}/__dev/recipes`);
const put = (value, revision, headers = {}) =>
  fetch(`${base}/__dev/recipes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': revision, ...headers },
    body: JSON.stringify(value),
  });

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'brumaluz-recipes-'));
  file = join(directory, 'recipesCatalog.json');

  const initialCatalog = {
    version: 1,
    stations: [
      {
        id: 'banco_carpinteria',
        label: 'Banco de carpintería',
        description: 'Mesa de corte y ensamble.',
        icon: '<path d="M4 10h16v3H4z"/>',
        job: 'carpinteria',
        category: 'Taller',
        active: true,
      },
      {
        id: 'forja',
        label: 'Forja y yunque',
        description: 'Fragua para fundir y templar.',
        icon: '<path d="M6 7h12l3 4-4 2v6H7v-6L3 11Z"/>',
        job: 'herreria',
        category: 'Taller',
        active: true,
      },
    ],
    folders: ['Mobiliario', 'Forja'],
    recipes: [
      {
        id: 'mesa_de_madera',
        label: 'Mesa de madera',
        description: 'Mesa de cuatro patas hecha con tablones y clavos.',
        category: 'mueble',
        folder: 'Mobiliario',
        active: true,
        ingredients: [
          { itemId: 'madera', count: 8 },
          { itemId: 'tablones', count: 4 },
          { itemId: 'clavos', count: 2 },
        ],
        output: {
          itemId: 'mesa_de_madera',
          count: 1,
          chance: 100,
          isPrimary: true,
        },
        craftingTime: 30,
        successRate: 100,
        stations: ['banco_carpinteria'],
        requirements: {
          requiredProfession: 'carpinteria',
          requiredRank: 0,
          minCharacterLevel: 1,
        },
        tags: ['mueble', 'madera', 'carpinteria'],
      },
    ],
  };

  await writeFile(file, JSON.stringify(initialCatalog, null, 2));

  server = await createServer({
    configFile: false,
    logLevel: 'error',
    cacheDir: 'node_modules/.vite-recipe-tests',
    optimizeDeps: {
      entries: ['recipes.html'],
    },
    plugins: [recipeEditorPlugin({ catalogPath: file })],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      hmr: false,
      watch: null,
    },
  });

  await server.listen();
  schema = await server.ssrLoadModule('/src/data/recipesCatalog.ts');
  tools = await server.ssrLoadModule('/src/dev/recipeEditorTools.ts');

  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), 'brumaluz-recipes-'))) {
    await rm(directory, { recursive: true, force: true });
  }
});

test('1. Recipe schema validation accepts valid recipes and rejects malformed fields', () => {
  const validRecipe = {
    id: 'silla_roble',
    label: 'Silla de roble',
    description: 'Silla cómoda tallada a mano.',
    category: 'mueble',
    active: true,
    ingredients: [{ itemId: 'madera', count: 4 }],
    output: { itemId: 'silla_roble', count: 1, chance: 100, isPrimary: true },
    craftingTime: 20,
    successRate: 100,
    stations: ['banco_carpinteria'],
    requirements: { requiredProfession: 'carpinteria' },
    tags: ['mueble'],
  };

  const validated = schema.validateRecipe(validRecipe);
  assert.equal(validated.id, 'silla_roble');
  assert.equal(validated.craftingTime, 20);
  assert.equal(validated.ingredients.length, 1);

  // Reject invalid ID
  assert.throws(() => {
    schema.validateRecipe({ ...validRecipe, id: 'INVALID-ID!' });
  }, /no es válido/i);

  // Reject zero ingredients
  assert.throws(() => {
    schema.validateRecipe({ ...validRecipe, ingredients: [] });
  }, /al menos un ingrediente/i);

  // Reject duplicate ingredients
  assert.throws(() => {
    schema.validateRecipe({
      ...validRecipe,
      ingredients: [
        { itemId: 'madera', count: 2 },
        { itemId: 'madera', count: 3 },
      ],
    });
  }, /duplicado/i);

  // Reject negative crafting time
  assert.throws(() => {
    schema.validateRecipe({ ...validRecipe, craftingTime: -5 });
  }, /número entre/i);
});

test('2. Station schema validation validates definitions and protects against duplicates', () => {
  const station = {
    id: 'banco_alquimia_nuevo',
    label: 'Mesa de destilación',
    description: 'Mesa para pociones.',
    job: 'alquimia',
    active: true,
  };

  const validStation = schema.validateStation(station);
  assert.equal(validStation.id, 'banco_alquimia_nuevo');
  assert.equal(validStation.job, 'alquimia');

  // Duplicate station in catalog
  assert.throws(() => {
    schema.validateRecipeCatalog({
      version: 1,
      stations: [
        { id: 'forja', label: 'Forja 1', active: true },
        { id: 'forja', label: 'Forja 2', active: true },
      ],
      recipes: [],
    });
  }, /ID de estación duplicado/i);
});

test('3. Template generation builds recipes correctly including user prompt example', () => {
  const mesa = schema.createRecipeFromTemplate('mesa_madera');
  assert.equal(mesa.category, 'mueble');
  assert.equal(mesa.craftingTime, 30);
  assert.equal(mesa.ingredients.length, 3);
  assert.equal(mesa.ingredients.find(i => i.itemId === 'madera')?.count, 8);
  assert.equal(mesa.ingredients.find(i => i.itemId === 'tablones')?.count, 4);
  assert.equal(mesa.ingredients.find(i => i.itemId === 'clavos')?.count, 2);
  assert.equal(mesa.output.count, 1);
  assert.equal(mesa.stations[0], 'banco_carpinteria');

  const espada = schema.createRecipeFromTemplate('espada_acero');
  assert.equal(espada.category, 'arma');
  assert.equal(espada.stations[0], 'forja');
});

test('4. Audit engine detects non-existent items and duplicate recipes', () => {
  const itemsMap = new Map([
    ['madera', { id: 'madera', label: 'Madera de roble' }],
  ]);
  const stationsMap = new Map([
    ['banco_carpinteria', { id: 'banco_carpinteria', label: 'Banco de carpintería' }],
  ]);

  const recipeWithMissing = {
    id: 'test_receta',
    label: 'Test receta',
    description: '',
    category: 'mueble',
    active: true,
    ingredients: [
      { itemId: 'madera', count: 2 },
      { itemId: 'mineral_fantasma', count: 1 },
    ],
    output: { itemId: 'objeto_inexistente', count: 1, chance: 100 },
    craftingTime: 10,
    successRate: 100,
    stations: ['estacion_inexistente'],
    requirements: {},
    tags: [],
  };

  const issues = tools.auditRecipe(recipeWithMissing, itemsMap, stationsMap, [recipeWithMissing]);
  assert.ok(issues.some(i => i.message.includes('mineral_fantasma')));
  assert.ok(issues.some(i => i.message.includes('objeto_inexistente')));
  assert.ok(issues.some(i => i.message.includes('estacion_inexistente')));
});

test('5. Dependency checker protects station and recipe deletion', () => {
  const allRecipes = [
    {
      id: 'tablones_madera',
      label: 'Tablones de madera',
      output: { itemId: 'tablones', count: 4 },
      ingredients: [{ itemId: 'madera', count: 2 }],
      stations: ['banco_carpinteria'],
      requirements: {},
    },
    {
      id: 'mesa_madera',
      label: 'Mesa de madera',
      output: { itemId: 'mesa_madera', count: 1 },
      ingredients: [{ itemId: 'tablones', count: 4 }],
      stations: ['banco_carpinteria'],
      requirements: {},
    },
  ];

  // Station dependency
  const stationDep = tools.checkStationDependencies('banco_carpinteria', allRecipes);
  assert.equal(stationDep.inUseCount, 2);

  // Recipe dependency: tablones is used as ingredient by mesa_madera
  const recipeDep = tools.checkRecipeDependencies('tablones_madera', 'tablones', allRecipes);
  assert.equal(recipeDep.canDelete, false);
  assert.ok(recipeDep.warnings[0].includes('Mesa de madera'));
});

test('6. Atomic persistence saves correctly and checks ETag concurrency', async () => {
  const getRes = await get();
  assert.equal(getRes.status, 200);
  const etag = getRes.headers.get('ETag');
  assert.ok(etag);
  const currentCatalog = await getRes.json();
  assert.equal(currentCatalog.recipes.length, 1);

  // Add a new recipe and PUT
  const updatedCatalog = structuredClone(currentCatalog);
  updatedCatalog.recipes.push({
    id: 'nueva_receta_guardada',
    label: 'Nueva receta guardada',
    description: 'Prueba de guardado atómico.',
    category: 'mueble',
    active: true,
    ingredients: [{ itemId: 'madera', count: 5 }],
    output: { itemId: 'nueva_receta_guardada', count: 1, chance: 100, isPrimary: true },
    craftingTime: 25,
    successRate: 100,
    stations: ['banco_carpinteria'],
    requirements: { requiredProfession: 'carpinteria' },
    tags: ['test'],
  });

  const putRes = await put(updatedCatalog, etag);
  assert.equal(putRes.status, 200);
  const newEtag = putRes.headers.get('ETag');
  assert.notEqual(newEtag, etag);

  // Stale ETag collision check
  const conflictRes = await put(updatedCatalog, etag);
  assert.equal(conflictRes.status, 409);

  // Check saved disk contents
  const disk = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(disk.recipes.length, 2);
  assert.equal(disk.recipes[1].id, 'nueva_receta_guardada');
});

test('7. Local security restricts cross-origin or non-local headers', async () => {
  const res = await fetch(`${base}/__dev/recipes`, {
    headers: { Origin: 'http://malicious-site.com' },
  });
  assert.equal(res.status, 403);
});

test('8. HistoryManager supports undo and redo with debounce coalescing', () => {
  const initial = { id: 'receta_1', label: 'Inicio', count: 1 };
  const history = new tools.HistoryManager(initial, 60, 50);

  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);

  history.push({ ...initial, label: 'Paso 1' }, true);
  assert.equal(history.canUndo(), true);

  history.push({ ...initial, label: 'Paso 2' }, true);
  assert.equal(history.current.label, 'Paso 2');

  const undone = history.undo();
  assert.equal(undone.label, 'Paso 1');
  assert.equal(history.canRedo(), true);

  const redone = history.redo();
  assert.equal(redone.label, 'Paso 2');
});

test('9. Filter and sort orders recipes correctly', () => {
  const recipes = [
    {
      id: 'z_receta',
      label: 'Zumo revitalizante',
      category: 'pocion',
      craftingTime: 10,
      successRate: 100,
      active: true,
      ingredients: [{ itemId: 'fruta', count: 1 }],
      output: { itemId: 'zumo', count: 1 },
      stations: ['mesa_alquimia'],
      requirements: { requiredProfession: 'alquimia' },
      tags: [],
    },
    {
      id: 'a_receta',
      label: 'Arco de tejo',
      category: 'arma',
      craftingTime: 60,
      successRate: 90,
      active: false,
      ingredients: [{ itemId: 'madera', count: 3 }],
      output: { itemId: 'arco', count: 1 },
      stations: ['banco_carpinteria'],
      requirements: { requiredProfession: 'carpinteria' },
      tags: [],
    },
  ];

  // Sort by label asc
  const sortedLabelAsc = tools.filterAndSortRecipes(recipes, { sortBy: 'label', sortDirection: 'asc' });
  assert.equal(sortedLabelAsc[0].id, 'a_receta');

  // Filter by status active
  const onlyActive = tools.filterAndSortRecipes(recipes, { status: 'active' });
  assert.equal(onlyActive.length, 1);
  assert.equal(onlyActive[0].id, 'z_receta');

  // Filter by profession
  const onlyAlquimia = tools.filterAndSortRecipes(recipes, { profession: 'alquimia' });
  assert.equal(onlyAlquimia.length, 1);
  assert.equal(onlyAlquimia[0].id, 'z_receta');
});

test('10. End-to-end browser: load editor, edit recipe, verify visual designer and save to disk', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/recipes.html`);

  // Wait for status loaded
  await page.waitForSelector('#status.success', { timeout: 10000 });

  // Verify header navigation link for Recetas is active
  const activeNav = await page.$eval('.workshop-header nav a.active', el => el.textContent?.trim());
  assert.equal(activeNav, 'Recetas');

  // Verify visual canvas elements are rendered
  await page.waitForSelector('#visual-canvas');
  await page.waitForSelector('#visual-ingredients-slots .item-slot');
  await page.waitForSelector('#visual-output-slot');

  // Verify the default loaded recipe is "Mesa de madera"
  const draftTitle = await page.$eval('#draft-title', el => el.textContent?.trim());
  assert.equal(draftTitle, 'Mesa de madera');

  // Verify visual canvas displays correct time
  const timePill = await page.$eval('#visual-time-pill', el => el.textContent?.trim());
  assert.equal(timePill, '30 s');

  // Verify economics widget displays metrics
  await page.waitForSelector('#econ-cost');
  await page.waitForSelector('#econ-profit');

  // Edit time in form to 45 seconds
  await page.click('#tab-btn-requirements');
  await page.fill('#field-crafting-time', '45');
  await page.dispatchEvent('#field-crafting-time', 'input');

  // Verify visual canvas reacts
  const updatedTimePill = await page.$eval('#visual-time-pill', el => el.textContent?.trim());
  assert.equal(updatedTimePill, '45 s');

  // Verify dirty indicator shows unsaved changes
  const dirtyText = await page.$eval('#dirty-indicator', el => el.textContent?.trim());
  assert.equal(dirtyText, 'Cambios sin guardar');

  // Save recipe
  await page.click('#save-recipe-btn');

  // Wait for saved pill
  await page.waitForSelector('#dirty-indicator.clean');

  // Verify changes were persisted in the temporary disk catalog file
  const diskData = JSON.parse(await readFile(file, 'utf8'));
  const savedMesa = diskData.recipes.find(r => r.id === 'mesa_de_madera');
  assert.equal(savedMesa.craftingTime, 45);

  await page.close();
});

test('11. Economic balance calculation computes material cost, product value and margin', () => {
  const itemsMap = new Map([
    ['madera', { id: 'madera', value: 2 }],
    ['tablones', { id: 'tablones', value: 5 }],
    ['clavos', { id: 'clavos', value: 1 }],
    ['mesa_de_madera', { id: 'mesa_de_madera', value: 60 }],
  ]);

  const recipe = {
    id: 'mesa_de_madera',
    label: 'Mesa de madera',
    ingredients: [
      { itemId: 'madera', count: 8 }, // 16
      { itemId: 'tablones', count: 4 }, // 20
      { itemId: 'clavos', count: 2 }, // 2 -> total cost 38
    ],
    output: { itemId: 'mesa_de_madera', count: 1 }, // 60
    craftingTime: 30,
  };

  const econ = tools.calculateRecipeEconomics(recipe, itemsMap);
  assert.equal(econ.ingredientCost, 38);
  assert.equal(econ.outputValue, 60);
  assert.equal(econ.netProfit, 22);
  assert.ok(econ.profitMarginPct > 57);
  assert.ok(econ.profitPerSecond > 0.7);
});

test('12. Crafting simulation accurately calculates successes, failures, and material usage', () => {
  const recipe = {
    id: 'pocion_alquimia',
    label: 'Poción',
    successRate: 80, // 80% success
    craftingTime: 10,
    ingredients: [{ itemId: 'hierba', count: 2 }],
    output: { itemId: 'pocion', count: 1, chance: 100 },
  };

  // Mock deterministic random values: 0.1 (win), 0.5 (win), 0.85 (fail), 0.2 (win)
  const rolls = [0.1, 0.5, 0.85, 0.2];
  let rollIdx = 0;
  const mockRandom = () => rolls[rollIdx++ % rolls.length];

  const sim = tools.simulateCrafting(recipe, 4, mockRandom);
  assert.equal(sim.attempts, 4);
  assert.equal(sim.successes, 3);
  assert.equal(sim.failures, 1);
  assert.equal(sim.totalOutputs, 3);
  assert.equal(sim.totalTimeSeconds, 40);
  assert.equal(sim.materialsSpent[0].count, 8); // 2 * 4 attempts
});

test('13. Production chain resolves sub-recipe hierarchy and detects craftables vs raw materials', () => {
  const allRecipes = [
    {
      id: 'tablones_receta',
      label: 'Fabricar tablones',
      output: { itemId: 'tablones', count: 2 },
      ingredients: [{ itemId: 'madera_bruta', count: 1 }],
    },
    {
      id: 'mesa_receta',
      label: 'Fabricar mesa',
      output: { itemId: 'mesa_madera', count: 1 },
      ingredients: [
        { itemId: 'tablones', count: 4 },
        { itemId: 'clavos_hierro', count: 2 },
      ],
    },
  ];

  const itemsMap = new Map([
    ['tablones', { id: 'tablones', label: 'Tablones de roble' }],
    ['madera_bruta', { id: 'madera_bruta', label: 'Madera en bruto' }],
    ['clavos_hierro', { id: 'clavos_hierro', label: 'Clavos de hierro' }],
  ]);

  const tree = tools.resolveProductionChain(allRecipes[1], allRecipes, itemsMap);
  assert.equal(tree.length, 2);

  // Tablones is craftable and has sub-ingredients
  const tablonesNode = tree.find(n => n.itemId === 'tablones');
  assert.ok(tablonesNode);
  assert.equal(tablonesNode.isCraftable, true);
  assert.equal(tablonesNode.subIngredients?.length, 1);
  assert.equal(tablonesNode.subIngredients[0].itemId, 'madera_bruta');

  // Clavos is raw/elemental (no recipe in this list)
  const clavosNode = tree.find(n => n.itemId === 'clavos_hierro');
  assert.ok(clavosNode);
  assert.equal(clavosNode.isCraftable, false);
});

test('14. Sync RPG endpoint imports every canonical recipe without overwriting custom ones', async () => {
  const before = await (await get()).json();
  const canonical = JSON.parse(await readFile(resolve('src', 'data', 'generated', 'rpg-catalog.json'), 'utf8'));
  const existingIds = new Set(before.recipes.map(recipe => recipe.id));
  const canonicalIds = Object.keys(canonical.recipes);
  const addedIds = canonicalIds.filter(id => !existingIds.has(id));

  const syncRes = await fetch(`${base}/__dev/recipes/sync-rpg`, { method: 'POST' });
  assert.equal(syncRes.status, 200);
  const data = await syncRes.json();

  assert.equal(data.success, true);
  assert.equal(data.added, addedIds.length);
  assert.equal(data.existing, canonicalIds.length - addedIds.length);
  assert.equal(data.total, before.recipes.length + addedIds.length);

  // Read disk file and verify
  const disk = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(disk.recipes.length, data.total);
  const byId = new Map(disk.recipes.map(recipe => [recipe.id, recipe]));
  for (const id of canonicalIds) assert.ok(byId.has(id), `Missing canonical recipe ${id}`);
  for (const recipe of before.recipes) assert.deepEqual(byId.get(recipe.id), recipe);

  // Check presence of several canonical recipes across jobs
  const minero = byId.get('herramienta_minero_0');
  assert.ok(minero, 'Recipe herramienta_minero_0 must exist');
  assert.equal(minero.requirements.requiredProfession, 'herreria');
  assert.deepEqual(minero.stations, ['forja']);
  assert.ok(minero.notes.includes(`${canonical.recipes.herramienta_minero_0.price} Pelines`));

  const cuero = byId.get('curtir_cuero_1');
  assert.ok(cuero, 'Recipe curtir_cuero_1 must exist');
  assert.equal(cuero.requirements.requiredProfession, 'peleteria');
  assert.deepEqual(cuero.stations, ['curtiduria']);
  assert.equal(cuero.craftingTime, canonical.recipes.curtir_cuero_1.seconds);
  assert.equal(canonical.recipes.pan_duro.seconds, 0);
  assert.equal(byId.get('pan_duro').craftingTime, 0, 'Instant recipes remain instant');

  // Ensure all recipes pass full validation
  for (const r of disk.recipes) {
    schema.validateRecipe(r);
  }
});

test('15. Browser e2e: existing RPG recipes can be filtered, edited, and new recipes added alongside', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/recipes.html`);

  await page.waitForSelector('#status.success', { timeout: 10000 });

  const initialCatalog = JSON.parse(await readFile(file, 'utf8'));
  const assertProfessionCounts = async recipes => {
    const chips = await page.$$eval('.filter-chip-btn[data-prof]:not([data-prof="all"])', buttons =>
      buttons.map(button => ({
        job: button.getAttribute('data-prof'),
        count: button.querySelector('.filter-chip-count')?.textContent,
      }))
    );
    assert.ok(chips.length > 0);
    for (const chip of chips) {
      const count = recipes.filter(recipe => recipe.requirements.requiredProfession === chip.job).length;
      assert.equal(chip.count, ` (${count})`, `Incorrect count for ${chip.job}`);
    }
  };

  // 1. Verify library and profession counts match the loaded catalog
  const badgeText = await page.$eval('#recipes-count-badge', el => el.textContent?.trim());
  assert.equal(badgeText, `${initialCatalog.recipes.length} recetas (${initialCatalog.recipes.length} visibles)`);
  await assertProfessionCounts(initialCatalog.recipes);

  // 2. Test Quick Filter by Herrería
  await page.click('.filter-chip-btn[data-prof="herreria"]');
  await page.waitForTimeout(200);

  const herreriaBadge = await page.$eval('#recipes-count-badge', el => el.textContent?.trim());
  assert.ok(herreriaBadge?.includes('visibles'), 'Should filter visible count');

  // 3. Search for existing recipe "Pico · Aprendiz"
  await page.fill('#search-input', 'Pico · Aprendiz');
  await page.dispatchEvent('#search-input', 'input');
  await page.waitForTimeout(200);

  // Click on the recipe card
  await page.waitForSelector('.recipe-card');
  await page.click('.recipe-card');

  // Verify form loaded the existing recipe
  const loadedTitle = await page.$eval('#draft-title', el => el.textContent?.trim());
  assert.ok(loadedTitle?.includes('Pico'), `Expected title to contain Pico, got: ${loadedTitle}`);

  // 4. Edit the existing recipe: modify crafting time
  await page.click('#tab-btn-requirements');
  await page.fill('#field-crafting-time', '150');
  await page.dispatchEvent('#field-crafting-time', 'input');
  await page.click('#save-recipe-btn');
  await page.waitForSelector('#dirty-indicator.clean');

  // Verify on disk that the existing recipe was updated
  let disk = JSON.parse(await readFile(file, 'utf8'));
  const updatedPico = disk.recipes.find(r => r.id === 'herramienta_minero_0');
  assert.equal(updatedPico.craftingTime, 150);

  // 5. Add a brand new recipe
  await page.click('#new-recipe-btn');
  await page.click('#tab-btn-general');
  await page.fill('#field-label', 'Báculo de llamas arcanas');
  await page.dispatchEvent('#field-label', 'input');

  await page.click('#tab-btn-ingredients');
  // First ingredient row is created by default; edit count
  await page.waitForSelector('#ingredients-table-body tr:first-child .ing-count-input');
  await page.fill('#ingredients-table-body tr:first-child .ing-count-input', '7');
  await page.dispatchEvent('#ingredients-table-body tr:first-child .ing-count-input', 'change');

  await page.click('#save-recipe-btn');
  await page.waitForSelector('#dirty-indicator.clean');

  // Verify newly created recipe exists on disk alongside the RPG recipes
  disk = JSON.parse(await readFile(file, 'utf8'));
  const newBaculo = disk.recipes.find(r => r.id === 'baculo_de_llamas_arcanas');
  assert.ok(newBaculo, 'Newly created recipe must be saved to disk');
  assert.equal(newBaculo.ingredients[0].count, 7);
  assert.equal(disk.recipes.length, initialCatalog.recipes.length + 1);
  await assertProfessionCounts(disk.recipes);

  await page.close();
});

test('16. Visual canvas direct manipulation: add via picker, output stepper, remove slot, category pills and presets', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/recipes.html`);

  await page.waitForSelector('#status.success', { timeout: 10000 });

  // 1. Create a new recipe to start clean
  await page.click('#new-recipe-btn');
  await page.fill('#field-label', 'Banco de descanso visual');
  await page.dispatchEvent('#field-label', 'input');

  // Verify starting ingredients in canvas (1 default slot)
  let slots = await page.$$('#visual-ingredients-slots .item-slot');
  assert.equal(slots.length, 1);

  // 2. Click "+ Añadir" directly on the canvas to open Item Picker
  await page.click('#visual-add-ing-btn');
  await page.waitForSelector('#item-picker-modal:not([hidden])');

  // 3. Filter Item Picker by category "material"
  await page.click('.picker-cat-btn[data-cat="material"]');
  await page.waitForTimeout(150);

  // Select the first item card in picker
  await page.waitForSelector('.item-picker-card');
  await page.click('.item-picker-card');

  // Verify Item Picker closed and a 2nd slot was added directly to canvas
  await page.waitForSelector('#item-picker-modal', { state: 'hidden' });
  slots = await page.$$('#visual-ingredients-slots .item-slot');
  assert.equal(slots.length, 2, 'Should have added a second ingredient slot directly to canvas');

  // 4. Test output stepper on canvas (+ button)
  const initialOutputCount = await page.$eval('#visual-output-count', el => el.textContent?.trim());
  assert.equal(initialOutputCount, '1');

  await page.click('#visual-output-plus');
  const incrementedOutputCount = await page.$eval('#visual-output-count', el => el.textContent?.trim());
  assert.equal(incrementedOutputCount, '2');

  // 5. Test removing an ingredient directly from canvas using slot-remove-btn
  await page.click('#visual-ingredients-slots .item-slot:last-child .slot-remove-btn');
  slots = await page.$$('#visual-ingredients-slots .item-slot');
  assert.equal(slots.length, 1, 'Should have removed one slot directly from canvas');

  // 6. Test time preset pills in Tab 4
  await page.click('#tab-btn-requirements');
  await page.click('.time-preset-btn[data-s="15"]');
  const timeDisplay = await page.$eval('#time-human-display', el => el.textContent?.trim());
  assert.equal(timeDisplay, '15 s');

  // 7. Save recipe and verify disk persistence
  await page.click('#save-recipe-btn');
  await page.waitForSelector('#dirty-indicator.clean');

  const disk = JSON.parse(await readFile(file, 'utf8'));
  const savedBanco = disk.recipes.find(r => r.id === 'banco_de_descanso_visual');
  assert.ok(savedBanco, 'Saved recipe must exist on disk');
  assert.equal(savedBanco.output.count, 2);
  assert.equal(savedBanco.craftingTime, 15);

  await page.close();
});

test('17. Unsaved recipe drafts are preserved when navigation is cancelled', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/recipes.html`);
  await page.waitForSelector('#status.success', { timeout: 10000 });

  const cards = await page.$$('.recipe-card');
  assert.ok(cards.length > 1, 'Expected more than one recipe to test navigation');
  const targetTitle = await cards[1].$eval('.recipe-card-title', el => el.textContent?.trim());

  await page.fill('#field-label', 'Borrador por conservar');
  page.once('dialog', dialog => dialog.dismiss());
  await cards[1].click();
  assert.equal(await page.$eval('#draft-title', el => el.textContent?.trim()), 'Borrador por conservar');
  assert.equal(await page.$eval('#dirty-indicator', el => el.textContent?.trim()), 'Cambios sin guardar');

  page.once('dialog', dialog => dialog.accept());
  await cards[1].click();
  assert.equal(await page.$eval('#draft-title', el => el.textContent?.trim()), targetTitle);

  await page.fill('#field-label', 'Otro borrador por conservar');
  page.once('dialog', dialog => dialog.dismiss());
  await page.click('#new-recipe-btn');
  assert.equal(await page.$eval('#draft-title', el => el.textContent?.trim()), 'Otro borrador por conservar');

  page.once('dialog', dialog => dialog.accept());
  await page.click('#new-recipe-btn');
  assert.equal(await page.$eval('#draft-title', el => el.textContent?.trim()), 'Nueva receta');

  await page.close();
});

test('18. Batch edits and imports clear the unsaved indicator after persistence', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/recipes.html`);
  await page.waitForSelector('#status.success', { timeout: 10000 });

  const recipeId = await page.$eval('.recipe-card-checkbox', el => el.getAttribute('data-id'));
  await page.check('.recipe-card-checkbox');
  await page.click('#batch-edit-btn');
  await page.selectOption('#batch-active-select', 'false');
  await page.click('#apply-batch-btn');
  await page.waitForSelector('#dirty-indicator.clean');

  let disk = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(disk.recipes.find(recipe => recipe.id === recipeId)?.active, false);

  const importFile = join(directory, 'recipe-import.json');
  await writeFile(importFile, JSON.stringify(disk, null, 2));
  page.once('dialog', dialog => dialog.accept());
  await page.setInputFiles('#import-input', importFile);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'Catálogo importado y guardado.');
  await page.waitForSelector('#dirty-indicator.clean');
  assert.equal(await page.$eval('#dirty-indicator', el => el.textContent?.trim()), 'Guardado');

  await page.close();
});
