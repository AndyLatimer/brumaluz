/**
 * Real-browser review of the original Brumaluz hamlet pack.
 *
 * Run after generating the GLBs and catalog: node tools/review-hamlet.mjs
 * Uses an isolated Edge context and a Vite server without editor write plugins.
 * The review scene exists only in browser memory. No project map is saved.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const arboleda = process.argv.includes('--arboleda');
const pack = arboleda ? 'brumaluz-arboleda' : 'brumaluz-hamlet';
const output = path.join(root, 'art', arboleda ? 'arboleda' : 'hamlet', 'review');
const explicitCatalog = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const candidates = explicitCatalog ? [path.resolve(root, explicitCatalog)] : [
  path.join(root, 'src', 'assets', 'library', pack, 'catalog.json'),
  path.join(root, 'src', 'assets', 'library', 'catalog-hamlet.json'),
  path.join(root, 'src', 'assets', 'library', 'catalog.json'),
];
let catalogFile, entries;
for (const candidate of candidates) {
  let data;
  try { data = JSON.parse(await readFile(candidate, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const list = Array.isArray(data) ? data : data.assets;
  if (!Array.isArray(list)) continue;
  const selected = list.filter(asset => asset.pack === pack || asset.id?.startsWith(`${pack}/`));
  if (selected.length) { catalogFile = candidate; entries = selected; break; }
}
assert.ok(entries?.length, `Generate the ${pack} GLBs and catalog before running this review.`);
assert.equal(new Set(entries.map(asset => asset.id)).size, entries.length, 'Duplicate asset IDs');
await mkdir(output, { recursive: true });

const issues = [];
const apiWrites = [];
const report = { pack, catalog: path.relative(root, catalogFile), assets: [], captures: [], editor: null, issues };
let browser, server;
function watch(page, label) {
  page.on('pageerror', error => issues.push(`${label}: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      issues.push(`${label}: HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) {
      issues.push(`${label}: ${message.text()}`);
    }
  });
}
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const heroPatterns = [/cottage|herbalist|house/i, /workshop|tavern|inn|shop|laboratory/i, /bookcase|cabinet|table/i, /market|fountain|well|lantern/i];
const heroes = [];
for (const pattern of heroPatterns) {
  const hero = entries.find(asset => pattern.test(`${asset.name ?? ''} ${asset.id}`) && !heroes.includes(asset));
  if (hero) heroes.push(hero);
}
for (const asset of entries) { if (heroes.length >= 4) break; if (!heroes.includes(asset)) heroes.push(asset); }

try {
  server = await createServer({
    root, configFile: false,
    cacheDir: 'node_modules/.vite-hamlet-review',
    server: { host: '127.0.0.1', port: 0 },
    assetsInclude: ['**/*.glb'],
    define: { 'import.meta.env.NPC_RANGER': 'false', 'import.meta.env.NPC_ROGUE_HOODED': 'false' },
    logLevel: 'warn',
  });
  await server.listen();
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  // The minimal Vite server has no map backend. Stub reads, reject every write.
  await context.route(/\/__dev\/maps(?:\/|$)/, async route => {
    const request = route.request();
    if (request.method() !== 'GET') {
      apiWrites.push(`${request.method()} ${request.url()}`);
      await route.fulfill({ status: 405, json: { error: 'Review scenes cannot save or publish maps.' } });
      return;
    }
    const pathname = new URL(request.url()).pathname;
    await route.fulfill({ status: 200, json: pathname.endsWith('/__published') ? { published: [] } : { maps: [] } });
  });

  const page = await context.newPage();
  watch(page, 'GLB');
  await page.goto(`${base}/render.html`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__renderAsset === 'function', null, { timeout: 90_000 });
  // Exercise the actual application loader, rather than parsing the GLB in Node.
  report.assets = await page.evaluate(async ids => {
    const { catalog, loadLibraryAsset } = await import('/src/art/library.ts');
    const results = [];
    for (const id of ids) {
      const entry = catalog.assets.find(asset => asset.id === id);
      if (!entry) throw new Error(`Missing from application catalog: ${id}`);
      const { gltf, url } = await loadLibraryAsset(id);
      let meshes = 0, triangles = 0, texturedMaterials = 0;
      const geometries = new Set(), materials = new Set(), textures = new Set();
      gltf.scene.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        const geometry = object.geometry;
        geometries.add(geometry);
        const position = geometry.getAttribute('position');
        if (!position?.count) throw new Error(`Empty mesh: ${id}/${object.name}`);
        for (let index = 0; index < position.count; index++) {
          if (![position.getX(index), position.getY(index), position.getZ(index)].every(Number.isFinite)) {
            throw new Error(`Nonfinite vertex: ${id}/${object.name}`);
          }
        }
        triangles += (geometry.index?.count ?? position.count) / 3;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          if (material.map) texturedMaterials++;
          for (const value of Object.values(material)) if (value?.isTexture) {
            if (!value.image?.width || !value.image?.height) throw new Error(`Unloaded texture: ${id}`);
            textures.add(value);
          }
        }
      });
      if (!meshes || !triangles) throw new Error(`GLB has no visible geometry: ${id}`);
      results.push({ id, url, meshes, triangles, materials: materials.size, textures: textures.size, texturedMaterials });
      for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
    }
    return results;
  }, entries.map(asset => asset.id));
  assert.equal(report.assets.length, entries.length);
  for (const hero of heroes) {
    const result = report.assets.find(asset => asset.id === hero.id);
    const info = await page.evaluate(async url => {
      window.__resize();
      return window.__renderAsset(url);
    }, result.url);
    assert.ok(info.size.every(value => Number.isFinite(value) && value > 0), `Invalid bounds: ${hero.id}`);
    await settle(page);
    const file = `${hero.id.split('/').pop()}.png`;
    await page.screenshot({ path: path.join(output, file) });
    report.captures.push({ file, asset: hero.id, size: info.size });
  }

  const editor = await context.newPage();
  watch(editor, 'editor');
  editor.on('dialog', dialog => dialog.dismiss());
  await editor.goto(`${base}/maps.html`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await editor.waitForFunction(() => window.__mapEditor?.state.assets.length && document.querySelector('#loading').hidden, null, { timeout: 90_000 });
  const groupLabel = await editor.evaluate(group => window.__mapEditor.state.assets.find(asset => asset.group === group)?.groupLabel, pack);
  assert.ok(groupLabel, `Editor has no ${pack} group`);
  await editor.locator('#catalog-groups button').filter({ hasText: groupLabel }).click();
  const cards = editor.locator('#catalog-grid button[data-asset]');
  assert.equal(await cards.count(), entries.length, 'Editor catalog card count differs from source catalog');
  await editor.waitForFunction(() => {
    const images = [...document.querySelectorAll('#catalog-grid img')].filter(image => {
      const bounds = image.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < innerHeight;
    });
    return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 60_000 });
  await settle(editor);
  await editor.screenshot({ path: path.join(output, 'editor-catalog.png') });
  report.captures.push({ file: 'editor-catalog.png', cards: await cards.count() });

  // Create an unsaved document, then place the first hero through real UI events.
  await editor.evaluate(async () => {
    const { newMap } = await import('/src/data/maps.ts');
    const { openDocument, controls, camera, state } = await import('/src/dev/mapEditor/core.ts');
    const doc = newMap('hamlet_visual_review', 'Brumaluz · revisión del arrabal', { width: 64, depth: 56, cell: 1, paint: 1, grass: 10 });
    doc.settings.sky = 'day'; doc.settings.fog = 0; doc.settings.clouds = false; doc.settings.fireflies = false;
    openDocument(doc, null, null);
    state.snap.mode = 'off';
    controls.target.set(0, 1, 0);
    camera.position.set(12, 13, 20);
    controls.update();
  });
  const firstHero = heroes[0];
  await editor.locator(`#catalog-grid button[data-asset="${firstHero.id}"]`).click();
  const point = await editor.evaluate(() => {
    const { THREE, camera } = window.__mapEditor;
    const canvas = document.querySelector('#viewport canvas');
    const bounds = canvas.getBoundingClientRect();
    const point = new THREE.Vector3(0, 0, 0).project(camera);
    return { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2 };
  });
  await editor.mouse.move(point.x, point.y);
  await settle(editor);
  await editor.mouse.click(point.x, point.y);
  await editor.waitForFunction(id => window.__mapEditor.state.doc.objects.some(object => object.asset === id), firstHero.id);

  // Arrange supporting pieces with the editor's own placement operation.
  const placement = await editor.evaluate(async ({ assets, hero }) => {
    const { THREE, state, scene, camera, controls } = window.__mapEditor;
    const core = await import('/src/dev/mapEditor/core.ts');
    const { dropAsset, placement } = await import('/src/dev/mapEditor/place.ts');
    const { setTool } = await import('/src/dev/mapEditor/tools.ts');
    const matches = (regex, excluded = new Set()) => assets.find(asset => regex.test(`${asset.name ?? ''} ${asset.id}`) && !excluded.has(asset.id));
    const used = new Set([hero]);
    const add = (regex, x, z, yaw = 0) => {
      const asset = matches(regex, used);
      if (!asset) return;
      used.add(asset.id);
      placement.yaw = yaw;
      dropAsset(asset.id, new THREE.Vector3(x, 0, z));
    };
    const first = state.doc.objects.find(object => object.asset === hero);
    first.position = [-4.2, 0, -2];
    first.rotation[1] = -.12;
    add(/workshop|tavern|inn|shop|cottage|house|laboratory/i, 5, -3, -.15);
    add(/well|fountain|market/i, 5.8, 4.3, 0);
    add(/table/i, -3, 4.8, .12);
    add(/bench/i, -3, 6.2, .12);
    add(/planter|flower/i, -.1, 1.8, .1);
    add(/barrel|crate/i, -7, .4, .22);
    add(/lantern|lamp/i, 1.5, 2.4, 0);
    add(/sign/i, -1.6, -.6, -.1);
    if (hero.startsWith('brumaluz-arboleda/')) {
      add(/tree_ancient/i, -9, -6, 0);
      add(/tree_weeping/i, 9, -7, .4);
      add(/fern_cluster/i, -6, 2, 0);
      add(/gateway/i, 0, 7.8, 0);
    }
    state.view.grid = false; state.view.markers = false;
    core.syncScene();
    await core.objectLayer.ready();
    core.objectLayer.root.traverse(object => {
      if (object.userData.missingAsset) throw new Error(`Editor substituted a missing-asset placeholder: ${object.userData.missingAsset}`);
    });
    core.setSelection([]);
    setTool('select');
    controls.target.set(.3, 1.45, .7);
    camera.position.set(18, 14, 25);
    camera.fov = 39; camera.updateProjectionMatrix(); controls.update();
    const { Character, loadKits } = await import('/src/character/character.ts');
    const { defaultChar } = await import('/src/data/data.ts');
    await loadKits();
    const actor = new Character(defaultChar(), { outfit: false });
    actor.root.name = 'review-scale-character';
    actor.root.position.set(.2, 0, 5.3); actor.root.rotation.y = .45;
    scene.add(actor.root); actor.update(0); actor.update(.1);
    await core.rebuildCollision();
    core.environment.follow(controls.target, 25);
    core.renderEditorView();
    return {
      document: state.doc.id, savedId: state.savedId,
      objects: state.doc.objects.map(object => ({ asset: object.asset, scale: object.scale, position: object.position })),
      catalogCount: state.assets.filter(asset => asset.group === hero.split('/')[0]).length,
      characterForScale: true,
    };
  }, { assets: entries, hero: firstHero.id });
  assert.equal(placement.savedId, null, 'Review must remain unsaved');
  assert.ok(placement.objects.length >= 4, 'Hero scene has too few supporting pieces');
  assert.equal(placement.catalogCount, entries.length);
  for (const object of placement.objects) assert.deepEqual(object.scale, [1, 1, 1], `Wrong metre scale: ${object.asset}`);
  await editor.mouse.move(10, 10);
  await settle(editor);
  assert.ok(!/No se pudo|Error/.test(await editor.locator('#hint-info').textContent()), 'Editor reported a status error');
  await editor.screenshot({ path: path.join(output, 'editor-hamlet-hero.png') });
  await editor.addStyleTag({ content: '#tool-options,#statusbar{visibility:hidden!important}' });
  await editor.locator('#viewport').screenshot({ path: path.join(output, 'hamlet-in-world.png') });
  report.captures.push({ file: 'editor-hamlet-hero.png' }, { file: 'hamlet-in-world.png' });
  report.editor = placement;
  assert.deepEqual(apiWrites, [], 'Review attempted to save, delete, or publish a map');
  assert.deepEqual(issues, [], 'Browser review reported errors');
  console.log(`Reviewed ${entries.length} GLBs; ${placement.objects.length} objects placed in the real editor.`);
  console.log(`Captures: ${path.relative(root, output)}`);
} finally {
  report.issues = [...new Set(issues)];
  report.apiWrites = apiWrites;
  await writeFile(path.join(output, 'browser-review.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  await server?.close();
}
