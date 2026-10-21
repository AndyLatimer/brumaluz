import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mapEditorPlugin } from '../tools/map-editor-plugin.mjs';

// Todo se guarda en directorios temporales: las pruebas nunca tocan src/data/maps ni src/data/world.
let server, browser, directory, publishDirectory, maps;
const port = Number(process.env.TEST_MAPS_PORT || 4184);
const url = `http://127.0.0.1:${port}`;
const api = (id = '') => `${url}/__dev/maps/${id}`;
const put = (map, headers) => fetch(api(map.id), { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(map) });

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'brumaluz-maps-'));
  publishDirectory = await mkdtemp(join(tmpdir(), 'brumaluz-world-'));
  server = await createServer({
    configFile: false, logLevel: 'error', plugins: [mapEditorPlugin({ mapsDir: directory, publishDir: publishDirectory, sqlFile: join(publishDirectory, 'world.sql') })], assetsInclude: ['**/*.glb'],
    server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [process.cwd(), directory, publishDirectory] } },
  });
  await server.listen();
  maps = await server.ssrLoadModule('/src/data/maps.ts');
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true,
    args: ['--disable-features=msDownloadsHub', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
});
after(async () => {
  await browser?.close(); await server?.close();
  if (directory) await rm(directory, { recursive: true });
  if (publishDirectory) await rm(publishDirectory, { recursive: true });
});

test('minimap uses the atlas icons and tracking preferences stay isolated by character', async () => {
  const page=await browser.newPage();
  try {
    await page.goto(`${url}/src/ui/mapIcons.ts`);
    const result=await page.evaluate(async()=>{
      const {mapIcon,drawMapIcon}=await import('/src/ui/mapIcons.ts');
      const {initMinimap,updateMinimap}=await import('/src/ui/minimap.ts');
      const {createQuestTracking}=await import('/src/ui/questTracking.ts');
      document.body.innerHTML=`<div id="minimap"><canvas class="minimap-canvas" style="width:176px;height:176px"></canvas>
        <button class="minimap-zoom-in"></button><button class="minimap-zoom-out"></button>
        <span class="minimap-players"><span class="minimap-player-count"></span></span>
        <span class="minimap-dir n"></span><span class="minimap-dir e"></span><span class="minimap-dir s"></span><span class="minimap-dir w"></span>
        <span class="minimap-zone"></span><span class="minimap-coords"></span><span class="minimap-tip" hidden></span></div>`;
      const kinds=['npc','quest','waypoint','exit','interior'];
      const markers=kinds.map((kind,i)=>({id:kind,name:kind,x:Math.cos(i*Math.PI*2/5)*12,z:Math.sin(i*Math.PI*2/5)*12,kind}));
      let opened=0;
      initMinimap({player:()=>({x:0,z:0,facing:0}),markers:()=>markers,zone:()=> 'Brumaluz',openMap:()=>opened++});
      const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
      const calls=[],arrows=[],stroke=ctx.stroke.bind(ctx);
      ctx.stroke=function(path){
        if(path instanceof Path2D)calls.push({color:this.strokeStyle,alpha:this.globalAlpha,fill:this.fillStyle,scale:this.getTransform().a});
        else arrows.push(this.fillStyle);
        return path?stroke(path):stroke();
      };
      updateMinimap();
      const colors=calls.map(call=>call.color);
      const npcCalls=calls.filter(call=>call.color==='#8be07a'),questCalls=calls.filter(call=>call.color==='#ffe19b');
      const npcStyle={fill:npcCalls[0].fill,dotFill:npcCalls[1]?.fill,size:npcCalls[0].scale*24/(canvas.width/176),questSize:questCalls[0].scale*24/(canvas.width/176)};
      markers.find(marker=>marker.kind==='exit').closed=true;
      calls.length=0; updateMinimap();
      const faded=calls.some(call=>call.color==='#d1c7ff'&&Math.abs(call.alpha-.45)<.001);
      for(const [i,marker] of markers.entries()){marker.x=1000+i*100;marker.z=0;}
      calls.length=0;arrows.length=0;updateMinimap();
      const farPortalHidden=calls.every(call=>call.color!=='#d1c7ff'&&call.color!=='#ffc69d');
      const farArrows=[...arrows];
      const exit=markers.find(marker=>marker.kind==='exit');
      exit.x=25.5;
      calls.length=0;updateMinimap();
      const nearExit=calls.some(call=>call.color==='#d1c7ff');
      exit.x=25.7;
      calls.length=0;updateMinimap();
      const distantExit=calls.some(call=>call.color==='#d1c7ff');
      const drawings=[];
      for(const kind of [...kinds,'player']){
        const reference=document.createElement('canvas');reference.width=reference.height=32;
        drawMapIcon(reference.getContext('2d'),kind,16,16,24,'#ffe19b');
        drawings.push(reference.toDataURL());
      }
      canvas.click();
      const data={welcome:{origin:0,stage:'active'},shadowQuest:null},before=JSON.stringify(data);
      let key='quest-test:character-a';
      const tracking=createQuestTracking(()=>key);
      const defaultQuest=tracking.current(data);
      tracking.toggle('welcome');
      const untracked=tracking.current(data);
      key='quest-test:character-b';
      const otherCharacter=tracking.current(data);
      key='quest-test:character-a';
      const restored=createQuestTracking(()=>key).current(data);
      const unchanged=JSON.stringify(data)===before;
      data.welcome.stage='completed';
      const nextQuest=tracking.current(data);
      tracking.toggle('shadow');
      const shadowUntracked=tracking.current(data);
      data.shadowQuest='returned';
      const completed=tracking.current(data);
      return {colors,npcStyle,faded,farPortalHidden,farArrows,nearExit,distantExit,unique:new Set(drawings).size,icons:kinds.every(kind=>mapIcon(kind).includes('<path d=')),opened,
        defaultQuest,untracked,otherCharacter,restored,nextQuest,shadowUntracked,completed,unchanged};
    });
    assert.ok(result.icons);
    assert.equal(result.npcStyle.fill,'#262c31','NPC portraits use a quiet dark fill rather than a solid green silhouette');
    assert.equal(result.npcStyle.dotFill,'#8be07a','NPCs have a bright center dot');
    assert.ok(Math.abs(result.npcStyle.size-16)<.001,'NPC minimap icons are 16 CSS pixels at the standard size');
    assert.ok(result.npcStyle.size<result.npcStyle.questSize,'NPC portraits are more subtle than objective icons');
    assert.equal(result.unique,6,'Each atlas/minimap symbol has a distinct shape');
    for(const color of ['#8be07a','#ffe19b','#a5edff','#d1c7ff','#ffc69d','#fff2a6'])assert.ok(result.colors.includes(color),color);
    assert.ok(result.faded,'Unavailable portals are faded in the minimap too');
    assert.ok(result.farPortalHidden,'Distant exits and interiors do not draw icons at the rim');
    assert.deepEqual(result.farArrows,['#8be07a','#ffe19b','#a5edff'],'Distant NPCs, quests and waypoints use arrows in their own colors');
    assert.equal(result.nearExit,true,'A portal fitting in the view is drawn');
    assert.equal(result.distantExit,false,'A portal outside the view is hidden');
    assert.equal(result.opened,1);
    assert.equal(result.defaultQuest,'welcome');assert.equal(result.untracked,null);
    assert.equal(result.otherCharacter,'welcome');assert.equal(result.restored,null);
    assert.equal(result.nextQuest,'shadow');assert.equal(result.shadowUntracked,null);
    assert.equal(result.completed,null);
    assert.equal(result.unchanged,true,'Tracking never mutates quest progress');
  } finally {await page.close();}
});

test('map schema validates documents, terrain encoding, resampling and limits', () => {
  const map = maps.newMap('prueba', 'Prueba', { width: 64, depth: 32, cell: 2, height: 1.5, paint: 3, grass: 90 });
  const valid = maps.validateMap(JSON.parse(JSON.stringify(map)));
  assert.equal(valid.id, 'prueba');
  const terrain = maps.decodeTerrain(valid.terrain);
  assert.equal(terrain.columns * terrain.rows, terrain.heights.length);
  assert.ok([...terrain.heights].every(h => h === 1.5));
  assert.ok([...terrain.paint].every(p => p === 3));
  const again = maps.decodeTerrain(maps.encodeTerrain(terrain));
  assert.deepEqual([...again.heights], [...terrain.heights]);
  const resampled = maps.resampleTerrain(terrain, 128, 64, 1);
  assert.equal(resampled.columns, 129); assert.equal(resampled.rows, 65);
  assert.ok(Math.abs(maps.sampleHeight(resampled, 0.5, 0.5) - 1.5) < 1e-6);

  const object = { id: 'o1', asset: 'city/house', layer: valid.layers[0].id, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: 'auto' };
  assert.equal(maps.validateMap({ ...valid, objects: [object] }).objects.length, 1);
  const wrong = [
    m => { m.id = '../fuera'; },
    m => { m.objects = [{ ...object, asset: '../../secret' }]; },
    m => { m.objects = [{ ...object, position: [Number.NaN, 0, 0] }]; },
    m => { m.objects = [{ ...object, layer: 'no-existe' }]; },
    m => { m.objects = [object, { ...object }]; },
    m => { m.terrain = { ...m.terrain, columns: m.terrain.columns + 1 }; },
    m => { m.settings = { ...m.settings, sky: 'arcoiris' }; },
    m => { m.markers = [{ ...m.markers[0], type: 'teleport' }]; },
    m => { m.layers = Array.from({ length: maps.MAP_LIMITS.layers + 1 }, (_, i) => ({ id: `l${i}`, name: `${i}`, visible: true, locked: false })); },
  ];
  for (const mutate of wrong) {
    const copy = JSON.parse(JSON.stringify(valid));
    mutate(copy);
    assert.throws(() => maps.validateMap(copy), maps.MapValidationError);
  }
});

test('portal schema keeps legacy maps compatible and does not replace a missing arrival', () => {
  const doc = maps.newMap('links', 'Conexiones');
  assert.equal(maps.mapKind(maps.validateMap(doc)), 'zone');
  const portal = { id: 'puerta', type: 'portal', name: 'Puerta', layer: 'logica', position: [1,0,1], rotationY: 0, radius: 3 };
  doc.markers.push(portal, { ...portal, id: 'entrada', type: 'arrival' });
  doc.settings.kind = 'world';
  doc.settings.region = 'Pompelín';
  doc.settings.loadingTip = 'Prueba';
  assert.equal(maps.portalTrigger(maps.validateMap(doc).markers[1]), 'walk');
  assert.equal(maps.arrivalPoint(doc).id, 'spawn');
  assert.equal(maps.arrivalPoint(doc, 'entrada').id, 'entrada');
  assert.equal(maps.arrivalPoint(doc, 'no_existe'), undefined);
  for (const change of [
    copy => { copy.markers[1].trigger = 'click'; },
    copy => { copy.markers[1].target = { map: '../outside' }; },
    copy => { copy.markers[1].target = { map: 'destino', arrival: 'bad/path' }; },
    copy => { copy.settings.kind = 'unknown'; },
  ]) {
    const copy = structuredClone(doc); change(copy);
    assert.throws(() => maps.validateMap(copy), maps.MapValidationError);
  }
  portal.target = { map: 'destino', arrival: 'entrada' };
  assert.equal(maps.mapSummary(maps.validateMap(doc), 'rev').portals[0].target.map, 'destino');
});

test('Pompelín starter follows the continent layout and connects all five capital gates', async () => {
  const { overworldTemplate } = await server.ssrLoadModule('/src/dev/mapEditor/overworld.ts');
  const { brumaluzGateMarkers } = await server.ssrLoadModule('/src/data/pompelin.ts');
  const map = maps.validateMap(overworldTemplate());
  assert.equal(map.id, 'pompelin'); assert.equal(map.settings.kind, 'world');
  assert.ok(map.objects.length > 250);
  assert.deepEqual(map.terrain.origin, [-1800, -1350]);
  assert.equal((map.terrain.columns - 1) * map.terrain.cell, 3600);
  assert.equal((map.terrain.rows - 1) * map.terrain.cell, 2700);
  assert.equal(((map.terrain.columns - 1) * map.terrain.cell * (map.terrain.rows - 1) * map.terrain.cell) / (720 * 540), 25);
  assert.ok(map.terrain.columns * map.terrain.rows <= maps.MAX_TERRAIN_VERTICES);
  const castle = map.objects.find(object => object.asset === 'city/castle');
  assert.deepEqual(castle.scale, [10,10,10], 'no agranda los edificios al ampliar los exteriores');
  assert.deepEqual(castle.position.filter((_,i)=>i!==1), [-200,-160]);
  const homes = map.objects.filter(object => /^city\/home_/.test(object.asset) && Math.hypot(object.position[0]+200,object.position[2]+150)<30);
  assert.equal(homes.length,12,'la capital conserva su agrupación y tamaño');
  for (const portal of brumaluzGateMarkers().filter(item => item.type === 'portal')) {
    assert.ok(maps.arrivalPoint(map, portal.target.arrival), `la puerta ${portal.id} tiene llegada en el continente`);
  }
  const entries = map.markers.filter(marker => marker.type === 'portal' && marker.target?.map === 'brumaluz');
  assert.equal(entries.length, 5);
  const capital = { markers: brumaluzGateMarkers() };
  for (const entry of entries) assert.ok(maps.arrivalPoint(capital, entry.target.arrival));
  const regions = Object.fromEntries(map.markers.filter(marker => marker.type === 'zone').map(marker => [marker.id, marker.position]));
  assert.ok(regions.arboleda[0] > regions.region_brumaluz[0]);
  assert.ok(regions.cumbres_cobre[2] > regions.region_brumaluz[2]);
  assert.ok(regions.lunargenta[0] < 0 && regions.lunargenta[2] > 0);
});

test('overworld settlement decoration preserves edits, travel points and terrain without duplicating props', async () => {
  const {overworldTemplate, decorateOverworldSettlements} = await server.ssrLoadModule('/src/dev/mapEditor/overworld.ts');
  const map = overworldTemplate();
  const details = map.objects.filter(object => object.id.startsWith('detail_'));
  assert.ok(details.length >= 120, 'añade barrios, accesos y atrezo a las tres poblaciones');
  for (const region of ['region_brumaluz','rusty_hearth','lunargenta']) {
    assert.ok(details.filter(object=>object.id.startsWith(`detail_${region}_`)).length >= 25, `${region} recibe detalles`);
  }
  const markers = JSON.stringify(map.markers), terrain = JSON.stringify(map.terrain);
  const objects = JSON.stringify(map.objects);
  assert.equal(decorateOverworldSettlements(map),0);
  assert.equal(JSON.stringify(map.objects),objects);
  map.objects = map.objects.filter(object=>!object.id.startsWith('detail_'));
  map.objects[0].name = 'Edición del usuario';
  assert.equal(decorateOverworldSettlements(map),details.length);
  assert.equal(map.objects[0].name,'Edición del usuario');
  assert.equal(JSON.stringify(map.markers),markers);
  assert.equal(JSON.stringify(map.terrain),terrain);
  maps.validateMap(map);
  const catalog = JSON.parse(await readFile(join(process.cwd(),'src','assets','library','catalog.json'),'utf8'));
  const ids = new Set(catalog.assets.map(asset=>asset.id));
  for(const detail of details) if(!/^(city|builtin)\//.test(detail.asset)) assert.ok(ids.has(detail.asset), detail.asset);
  const page = await browser.newPage();
  try {
    await page.goto(`${url}/src/data/maps.ts`);
    const result = await page.evaluate(async ({details, markers})=>{
      const {loadCityModels,boxOf,BUILTIN_BOUNDS}=await import('/src/world/mapAssetsCore.ts');
      const models=await loadCityModels();
      const catalog=await (await fetch('/src/assets/library/catalog.json')).json();
      const assets=new Map(catalog.assets.map(asset=>[asset.id,asset.bounds]));
      const missing=[], blocked=[];
      for(const object of details){
        let bounds;
        if(object.asset.startsWith('city/')){
          const model=models.get(object.asset.slice(5));
          if(!model){missing.push(object.asset);continue;}
          const box=boxOf(model);bounds={min:box.min.toArray(),max:box.max.toArray()};
        }else bounds=object.asset.startsWith('builtin/')?BUILTIN_BOUNDS[object.asset.slice(8)]:assets.get(object.asset);
        if(!bounds){missing.push(object.asset);continue;}
        const angle=object.rotation[1],cos=Math.cos(angle),sin=Math.sin(angle);
        for(const marker of markers.filter(item=>['portal','arrival','spawn'].includes(item.type))){
          const dx=marker.position[0]-object.position[0], dz=marker.position[2]-object.position[2];
          const x=dx*cos-dz*sin,z=dx*sin+dz*cos;
          const gapX=Math.max(bounds.min[0]*object.scale[0]-x,0,x-bounds.max[0]*object.scale[0]);
          const gapZ=Math.max(bounds.min[2]*object.scale[2]-z,0,z-bounds.max[2]*object.scale[2]);
          if(Math.hypot(gapX,gapZ)<marker.radius+1)blocked.push(`${object.id}:${marker.id}`);
        }
      }
      return {missing,blocked};
    },{details,markers:map.markers});
    assert.deepEqual(result.missing,[]);
    assert.deepEqual(result.blocked,[],'los modelos reales no invaden portales, llegadas ni aparición');
  } finally {await page.close();}
});

test('world travel serializes RPCs, blocks duplicate travel and never sends old-map motion on stop', async () => {
  const page = await browser.newPage();
  await page.route('**/src/services/account.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      const snap = () => ({status:'ok', position:{x:1,z:0,yaw:0}, players:[]});
      export async function joinWorld() { return snap(); }
      export async function leaveWorld() { window.calls.push('leave'); }
      export async function syncWorld() {
        window.calls.push('sync');
        if (window.failSync) throw new Error('SYNC_FAILED');
        return snap();
      }
      export async function travelWorld() {
        window.calls.push('travel'); await new Promise(resolve => { window.finishTravel = resolve; });
        return {...snap(), location:'pompelin'};
      }
    `,
  }));
  try {
    await page.goto(`${url}/src/data/maps.ts`);
    const result = await page.evaluate(async () => {
      const { WorldConnection } = await import('/src/services/multiplayer.ts');
      window.calls = [];
      const hooks = { motion: () => ({x:0,z:0,yaw:0,facing:0,jump:0,wave:0}), receive() {}, stale() {}, connection() {}, replaced() {} };
      const connection = new WorldConnection('test', hooks);
      await connection.join();
      connection.start();
      await connection.suspend(); connection.resume();
      const travel = connection.travel('gate');
      while (!window.finishTravel) await new Promise(resolve => setTimeout(resolve, 0));
      let duplicate = '';
      try { await connection.travel('gate'); } catch (error) { duplicate = error.message; }
      const stopping = connection.stop();
      window.finishTravel();
      let stopped = '';
      try { await travel; } catch (error) { stopped = error.message; }
      await stopping;
      const calls = [...window.calls];
      const failing = new WorldConnection('test', hooks);
      await failing.join(); window.failSync = true;
      let failed = '';
      try { await failing.travel('gate'); } catch (error) { failed = error.message; }
      await failing.stop();
      return {calls, duplicate, stopped, failed, all:window.calls};
    });
    assert.match(result.duplicate, /viaje en curso/);
    assert.match(result.stopped, /cerrado/);
    assert.match(result.failed, /SYNC_FAILED/);
    assert.deepEqual(result.calls.slice(-2), ['travel', 'leave']);
    assert.equal(result.all.filter(call => call === 'travel').length, 1, 'un sync fallido nunca pide viajar');
  } finally { await page.close(); }
});

test('game crosses walk and E portals with loading screens and without arrival bounce', { timeout: 180000 }, async () => {
  const capital = maps.newMap('brumaluz', 'Brumaluz', { width: 64, depth: 64, cell: 2, grass: 0 });
  const zone = maps.newMap('pompelin', 'Pompelín', { width: 64, depth: 64, cell: 2, grass: 0 });
  const marker = (id, type, x, extra = {}) => ({ id, type, name: id, layer: 'logica', position: [x,0,0], radius: 3, rotationY: 0, ...extra });
  capital.markers.push(marker('salir', 'portal', 10, { trigger: 'walk', target: { map: 'pompelin', arrival: 'desde_ciudad' } }), marker('desde_mundo', 'arrival', 0));
  capital.markers.push(marker('npc_test', 'npc', -8, {npcId:'testiculos'}));
  zone.markers.push(marker('desde_ciudad', 'arrival', 10),
    marker('regreso', 'portal', 10, { trigger: 'interact', target: { map: 'brumaluz', arrival: 'desde_mundo' } }),
    marker('no_rebotar', 'portal', 10, { trigger: 'walk', target: { map: 'brumaluz', arrival: 'desde_mundo' } }));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const dialogs = [];
  page.on('dialog', dialog => { dialogs.push(dialog.message()); return dialog.dismiss(); });
  await page.route('**/src/data/world/published.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `const maps = ${JSON.stringify([capital, zone])};
      export const PUBLISHED_WORLD = Object.fromEntries(maps.map(map => [map.id, {
        id:map.id,name:map.name,kind:'zone',region:'Región de prueba',loadingTip:'Consejo de prueba',
        publishedAt:'',objects:0,assets:0,bytes:0,load:async()=>({map,assets:{}})
      }]));`,
  }));
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.brumaluz, null, { timeout: 120000 });
    await page.evaluate(() => {
      window.loadingScreens = [];
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.matches('.map-transition')) window.loadingScreens.push(node.textContent);
        }
      }).observe(document.body, { childList: true });
      document.getElementById('account-gate').hidden = true;
      document.body.classList.remove('auth-visible', 'characters-visible');
      window.brumaluz.play();
    });
    await page.waitForTimeout(1500);
    await page.locator('.minimap-canvas').click();
    await page.waitForSelector('.zone-map-chart');
    assert.equal(await page.locator('.zone-map h3').textContent(),'Brumaluz');
    assert.equal(await page.locator('.zone-map-chart canvas').getAttribute('aria-label'),'Mapa completo de Brumaluz');
    await page.locator('.zone-map-player').waitFor();
    assert.ok(await page.locator('.zone-map-north svg').isVisible());
    assert.equal(await page.locator('.zone-map-key > span').count(),6);
    assert.match(await page.locator('.zone-map-key-npc').evaluate(icon=>icon.parentElement.innerText),/NPC \(bolita\)/);
    assert.ok(await page.locator('.zone-map-poi-exit').isVisible());
    const initialScale=await page.locator('.zone-map-scale').textContent();
    assert.match(initialScale,/^\d+(?:\.\d+)? (?:m|km)$/);
    const npc=page.locator('.zone-map-npc').first();
    assert.ok(await npc.isVisible());
    await npc.hover();
    assert.match(await npc.locator('.zone-map-npc-name').innerText(),/Testículos/);
    for(const icon of [npc,page.locator('.zone-map-poi-exit'),page.locator('.zone-map-player')]){
      const expected=await icon.evaluate(el=>({x:el.style.left,z:el.style.top}));
      await icon.click();
      await page.locator('.zone-map-waypoint').waitFor();
      assert.deepEqual(await page.locator('.zone-map-waypoint').evaluate(el=>({x:el.style.left,z:el.style.top})),expected,'Clicking a map icon sets the waypoint at its exact coordinates');
      await page.locator('.zone-map-waypoint').click();
      await page.locator('.zone-map-waypoint').waitFor({state:'hidden'});
    }
    await npc.focus();await page.keyboard.press('Enter');
    await page.locator('.zone-map-waypoint').waitFor();
    await page.locator('.zone-map-waypoint').click();
    await page.getByRole('button',{name:'Acercar mapa',exact:true}).click();
    assert.equal(await page.locator('.zone-map-tools output').textContent(),'150%');
    assert.notEqual(await page.locator('.zone-map-scale').textContent(),initialScale);
    const chart=page.locator('.zone-map-chart');
    const rect=await chart.boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.wheel(0,-200);
    await page.waitForFunction(()=>document.querySelector('.zone-map-tools output').textContent==='180%');
    const beforePan=await page.locator('.zone-map-player').evaluate(marker=>parseFloat(marker.style.left));
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height/2,{steps:5});
    await page.mouse.up();
    await page.waitForTimeout(100);
    const afterPan=await page.locator('.zone-map-player').evaluate(marker=>parseFloat(marker.style.left));
    assert.ok(afterPan>beforePan+5,'arrastrar desplaza la imagen y sus marcadores');
    assert.ok(await page.locator('.zone-map-waypoint').isHidden(),'arrastrar no crea un destino');
    const mapCanvas = page.locator('.zone-map-chart canvas');
    const canvasRect = await mapCanvas.boundingBox();
    await page.mouse.click(canvasRect.x+canvasRect.width*.65,canvasRect.y+canvasRect.height*.6);
    await page.locator('.zone-map-waypoint').waitFor();
    await page.locator('.zone-map-waypoint').click();
    await page.locator('.zone-map-waypoint').waitFor({state:'hidden'});
    await page.mouse.click(canvasRect.x+canvasRect.width*.65,canvasRect.y+canvasRect.height*.6);
    await page.locator('.zone-map-waypoint').waitFor();
    const pinPosition = await page.locator('.zone-map-waypoint').evaluate(pin=>({x:parseFloat(pin.style.left),z:parseFloat(pin.style.top)}));
    assert.ok(Math.abs(pinPosition.x-65)<.5 && Math.abs(pinPosition.z-60)<.5,'el destino respeta el zoom y desplazamiento');
    await page.keyboard.press('m');
    await page.locator('#waypoint-objective-marker').waitFor();
    assert.match(await page.locator('#waypoint-objective-marker .quest-marker-distance').textContent(),/^\d+ m$/);
    await page.keyboard.press('m');
    assert.ok(await page.locator('.zone-map-waypoint').isVisible(),'el destino se mantiene al reabrir el mapa');
    await page.getByRole('button',{name:'Acercar mapa',exact:true}).click({clickCount:6,delay:30});
    assert.equal(await page.locator('.zone-map-tools output').textContent(),'800%');
    await page.getByRole('button',{name:'Ver zona completa',exact:true}).click();
    assert.equal(await page.locator('.zone-map-tools output').textContent(),'100%');
    assert.equal(await page.locator('.zone-map-scale').textContent(),initialScale);
    const resetPin=await page.locator('.zone-map-waypoint').evaluate(pin=>parseFloat(pin.style.left));
    assert.notEqual(resetPin,pinPosition.x,'el pin sigue coordenadas de mundo al quitar zoom');
    await page.getByRole('button',{name:'Quitar destino',exact:true}).click();
    await page.locator('.zone-map-waypoint').waitFor({state:'hidden'});
    assert.ok(await page.getByRole('button',{name:'Quitar destino',exact:true}).isDisabled());
    await page.locator('.zone-map-chart').focus();
    await page.keyboard.press('Enter');
    await page.locator('.zone-map-waypoint').waitFor();
    await page.keyboard.press('Delete');
    await page.locator('.zone-map-waypoint').waitFor({state:'hidden'});
    await page.keyboard.press('Enter');
    await page.locator('.zone-map-waypoint').waitFor();
    const noScroll=()=>page.locator('.map-window-frame').evaluate(frame=>({
      fits:frame.scrollHeight<=frame.clientHeight+1,
      bodyFits:frame.querySelector('#window-body').scrollHeight<=frame.querySelector('#window-body').clientHeight+1,
      contentFits:frame.querySelector('.zone-map').scrollHeight<=frame.querySelector('.zone-map').clientHeight+1,
      oldCloseHidden:getComputedStyle(frame.querySelector('.options-actions')).display==='none',
    }));
    assert.deepEqual(await noScroll(),{fits:true,bodyFits:true,contentFits:true,oldCloseHidden:true});
    await page.setViewportSize({width:800,height:500});
    assert.deepEqual(await noScroll(),{fits:true,bodyFits:true,contentFits:true,oldCloseHidden:true});
    await page.setViewportSize({width:390,height:700});
    assert.deepEqual(await noScroll(),{fits:true,bodyFits:true,contentFits:true,oldCloseHidden:true});
    await page.locator('#map-window-close').click();
    assert.ok(await page.locator('#window-backdrop').isHidden());
    await page.setViewportSize({width:1280,height:800});
    await page.keyboard.press('m');
    await page.keyboard.press('m');
    assert.ok(await page.locator('#window-backdrop').isHidden());
    await page.evaluate(() => window.brumaluz.move(10, 0));
    await page.waitForFunction(() => window.brumaluz.city().locationId === 'pompelin', null, { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('.map-transition'));
    await page.waitForTimeout(1800);
    assert.equal(await page.evaluate(() => window.brumaluz.city().locationId), 'pompelin', 'no rebota pese a llegar dentro de una salida automática');
    await page.locator('#world-menu-toggle').click();
    await page.locator('#world-menu-map').click();
    assert.equal(await page.locator('.zone-map h3').textContent(),'Pompelín');
    assert.ok(await page.locator('.zone-map-waypoint').isHidden(),'los destinos no se dibujan en mapas distintos');
    const markerPosition=await page.locator('.zone-map-player').evaluate(marker=>({x:parseFloat(marker.style.left),z:parseFloat(marker.style.top)}));
    assert.equal(markerPosition.x,65.625,'sitúa al jugador en coordenadas del mapa completo, no centrado como el minimapa');
    assert.equal(markerPosition.z,50);
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#window-backdrop').isHidden());
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.brumaluz.city().locationId === 'brumaluz', null, { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('.map-transition'));
    const screens = await page.evaluate(() => window.loadingScreens);
    assert.equal(screens.length, 2);
    assert.ok(screens.every(text => text.includes('Región de prueba') && text.includes('Consejo de prueba')));
    assert.match(screens[0], /Pompelín/); assert.match(screens[1], /Brumaluz/);
    assert.deepEqual(dialogs,[],'viajar con E no abre confirmación');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('published Isberto doors and capital gates are reachable with matching client and server radii', { timeout: 240000 }, async () => {
  const page = await browser.newPage();
  const errors=[],dialogs=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>{dialogs.push(dialog.message());return dialog.dismiss();});
  try {
    await page.goto(`${url}/src/data/maps.ts`);
    const checks = await page.evaluate(async () => {
      const source = await (await fetch('/src/world/mapCity.ts')).text();
      const THREE = await import(/from\s+["']([^"']*\/three\.js[^"']*)["']/.exec(source)[1]);
      const { buildMapCity } = await import('/src/world/mapCity.ts');
      const { PUBLISHED_WORLD } = await import('/src/data/world/published.ts');
      const result = [];
      for (const id of ['brumaluz','casa_de_isberto_interior']) {
        const {map,assets} = await PUBLISHED_WORLD[id].load();
        const city = await buildMapCity(map,assets,new THREE.Scene());
        const free = point => city.collide(point,point.clone()).distanceTo(point)<.01;
        const arrivalId = id==='brumaluz' ? 'link_02bfa0ee' : 'link_3610f501';
        const portalId = id==='brumaluz' ? 'mknnlaak' : 'link_70713897';
        const portal = city.portals.find(p=>p.id===portalId);
        const arrival = city.arrivals[arrivalId].position;
        const saved = map.markers.find(m=>m.id===portalId);
        let position = id==='brumaluz' ? new THREE.Vector3(29,0,-48.5) : arrival.clone();
        position.y=city.groundY(position.x,position.z);
        for(let step=0;step<100;step++){
          const next=position.clone().lerp(portal.position,.08);
          next.y=city.groundY(next.x,next.z);
          position=city.collide(position,next);
        }
        result.push({id,free:free(arrival),radiusMatches:portal.radius===saved.radius,
          reachable:Math.hypot(position.x-portal.position.x,position.z-portal.position.z)<=portal.radius});
        if(id==='brumaluz'){
          for(const gate of city.portals.filter(p=>p.target?.map==='pompelin')){
            if(!PUBLISHED_WORLD[gate.target.map])throw new Error('Missing overworld');
            const target=(await PUBLISHED_WORLD[gate.target.map].load()).map;
            if(!target.markers.some(m=>m.id===gate.target.arrival&&m.type==='arrival'))throw new Error('Missing overworld arrival');
          }
          const gate=city.portals.find(p=>p.id==='salida_este');
          let position=city.arrivals.llegada_este.position.clone();
          for(let step=0;step<200;step++){
            const next=position.clone();next.x+=.15;next.y=city.groundY(next.x,next.z);
            position=city.collide(position,next);
            if(Math.hypot(position.x-gate.position.x,position.z-gate.position.z)<gate.radius)break;
          }
          result.push({id:'east-gate',reachable:Math.hypot(position.x-gate.position.x,position.z-gate.position.z)<gate.radius});
        }
        city.root.clear();
      }
      return result;
    });
    for(const check of checks){
      assert.ok(check.reachable,`${check.id} must be reachable by walking`);
      if('free' in check)assert.ok(check.free,`${check.id} arrival must not intersect collision`);
      if('radiusMatches' in check)assert.ok(check.radiusMatches,`${check.id} radius must match publication`);
    }
    const sql=await readFile(join(process.cwd(),'supabase','world.sql'),'utf8');
    assert.match(sql,/'pompelin'/);
    assert.match(sql,/'mknnlaak', 23\.5, -48\.5, 2\.2/);
    await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
    await page.goto(`${url}/?graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:90000});
    await page.evaluate(()=>{
      document.getElementById('account-gate').hidden=true;
      document.body.classList.remove('auth-visible','characters-visible');
      window.brumaluz.play();
      window.brumaluz.move(24.5,-48.5);
    });
    await page.locator('#interact-label').filter({hasText:/Casa de Isberto/i}).waitFor();
    await page.keyboard.press('e');
    await page.waitForFunction(()=>window.brumaluz.city().locationId==='casa_de_isberto_interior',null,{timeout:60000});
    await page.waitForFunction(()=>!document.querySelector('.map-transition'));
    await page.locator('#interact-label').filter({hasText:'Salir a Brumaluz'}).waitFor();
    await page.keyboard.press('e');
    await page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz');
    await page.waitForFunction(()=>!document.querySelector('.map-transition'));
    // La puerta este está en la muralla exterior publicada: se llega a ella desde dentro y se pisa su portal.
    const eastGate=(await readFile(join(process.cwd(),'src','data','world','maps','brumaluz.json'),'utf8').then(JSON.parse)).markers.find(m=>m.id==='salida_este');
    await page.evaluate(x=>window.brumaluz.move(x-9,0),eastGate.position[0]);
    await page.waitForTimeout(150);
    await page.evaluate(x=>window.brumaluz.move(x,0),eastGate.position[0]);
    await page.waitForFunction(()=>window.brumaluz.city().locationId==='pompelin',null,{timeout:90000});
    await page.waitForFunction(()=>!document.querySelector('.map-transition'));
    await page.evaluate(()=>window.brumaluz.move(-150,-150));
    await page.locator('#interact-label').filter({hasText:'Brumaluz'}).waitFor();
    await page.keyboard.press('e');
    await page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz');
    await page.waitForFunction(()=>!document.querySelector('.map-transition'));
    assert.deepEqual(dialogs,[],'actual house and city travel never prompt for confirmation');
    assert.deepEqual(errors,[]);
  } finally { await page.close(); }
});

test('local map API lists, creates, reads, updates and deletes with optimistic concurrency', async () => {
  const map = maps.newMap('api_test', 'API', { width: 32, depth: 32, cell: 2 });
  assert.deepEqual(await (await fetch(api())).json(), { maps: [] });
  assert.equal((await put(map, {})).status, 409, 'sin If-None-Match no se crea');
  const created = await put(map, { 'If-None-Match': '*' });
  assert.equal(created.status, 201);
  const revision = created.headers.get('etag');
  assert.ok(revision);
  assert.equal((await put(map, { 'If-None-Match': '*' })).status, 409, 'no sobrescribe un mapa existente sin revisión');

  const read = await fetch(api('api_test'));
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('etag'), revision);
  assert.equal((await read.json()).name, 'API');

  const updated = await put({ ...map, name: 'API 2' }, { 'If-Match': revision });
  assert.equal(updated.status, 200);
  const next = updated.headers.get('etag');
  assert.notEqual(next, revision);
  assert.equal((await put({ ...map, name: 'viejo' }, { 'If-Match': revision })).status, 409, 'detecta ediciones concurrentes');

  assert.equal((await fetch(api('api_test'), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': next }, body: JSON.stringify({ ...map, id: 'otro' }) })).status, 400, 'el ID debe coincidir con la ruta');
  assert.equal((await fetch(api('api_test'), { method: 'PUT', headers: { 'Content-Type': 'text/plain', 'If-Match': next }, body: '{}' })).status, 415);
  assert.equal((await fetch(api('api_test'), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': next }, body: '{"id":"api_test"}' })).status, 400);
  assert.equal((await fetch(api('api_test'), { method: 'POST' })).status, 405);
  assert.equal((await fetch(api('..%2Fsecret'))).status, 404);

  await writeFile(join(directory, 'roto.json'), '{"no": "es un mapa"}');
  const list = (await (await fetch(api())).json()).maps;
  assert.deepEqual(list.map(entry => entry.id), ['api_test', 'roto']);
  assert.equal(list[0].name, 'API 2');
  assert.ok(list[1].error);
  assert.equal((await fetch(api('roto'))).status, 422);

  assert.equal((await fetch(api('api_test'), { method: 'DELETE', headers: { 'If-Match': revision } })).status, 409);
  assert.equal((await fetch(api('api_test'), { method: 'DELETE', headers: { 'If-Match': next } })).status, 200);
  assert.equal((await fetch(api('api_test'))).status, 404);
  await rm(join(directory, 'roto.json'));
  assert.deepEqual((await readdir(directory)).filter(name => name.endsWith('.tmp')), []);
});

test('local map API rejects cross-site and non-local requests', async () => {
  const raw = headers => new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: '/__dev/maps/', headers }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(await raw({ Host: `127.0.0.1:${port}` }), 200);
  assert.equal(await raw({ Host: 'evil.example' }), 403);
  assert.equal(await raw({ Host: `127.0.0.1:${port}`, Origin: 'http://evil.example' }), 403);
  assert.equal(await raw({ Host: `127.0.0.1:${port}`, 'Sec-Fetch-Site': 'cross-site' }), 403);
});

test('browser editor places, sculpts, undoes, saves and reopens a map', { timeout: 240000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|GPU stall|WebGL|Failed to load resource/i.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !/favicon/.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
  try {
    await page.goto(`${url}/maps.html`);
    try {
      await page.waitForFunction(() => document.getElementById('loading')?.hidden && window.__mapEditor?.state.assets.length > 1000, null, { timeout: 120000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        loading: document.getElementById('loading')?.textContent,
        hidden: document.getElementById('loading')?.hidden,
        editor: !!window.__mapEditor,
        assets: window.__mapEditor?.state.assets.length,
      })).catch(() => null);
      throw new Error(`${error.message}; editor state: ${JSON.stringify(state)}; browser errors: ${errors.join(' | ')}`);
    }
    const editor = () => page.evaluate(() => {
      const { state } = window.__mapEditor;
      return { objects: state.doc.objects.length, markers: state.doc.markers.length, colliders: state.doc.colliders.length, tool: state.tool, dirty: state.dirty, id: state.doc.id };
    });
    assert.equal((await editor()).markers, 1, 'un mapa nuevo trae su punto de aparición');

    // Buscar en español y colocar desde el catálogo.
    await page.fill('#catalog-search', 'casa');
    await page.waitForFunction(() => document.querySelectorAll('#catalog-grid .asset').length > 0);
    await page.locator('#catalog-grid .asset').first().click();
    assert.equal((await editor()).tool, 'place');
    const box = await page.locator('#viewport canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy); await page.waitForTimeout(300);
    await page.mouse.click(cx, cy);
    await page.waitForFunction(() => window.__mapEditor.state.doc.objects.length === 1);

    // Esculpir cambia el relieve y se deshace con Ctrl+Z.
    const heightSum = () => page.evaluate(() => window.__mapEditor.state.field.data.heights.reduce((sum, h) => sum + h, 0));
    const before = await heightSum();
    await page.keyboard.press('t');
    await page.mouse.move(cx + 120, cy + 60); await page.mouse.down();
    for (let i = 0; i < 12; i++) { await page.mouse.move(cx + 120 + i * 4, cy + 60); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.ok(await heightSum() > before + 1, 'subir terreno');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    assert.ok(Math.abs(await heightSum() - before) < 1e-3, 'deshacer el esculpido');

    // Colisionador y marcador.
    await page.keyboard.press('c');
    await page.mouse.move(cx - 150, cy + 80); await page.mouse.down(); await page.mouse.move(cx - 90, cy + 130, { steps: 6 }); await page.mouse.up();
    await page.keyboard.press('m');
    await page.mouse.click(cx + 200, cy - 40);
    const state = await editor();
    assert.equal(state.colliders, 1); assert.equal(state.markers, 2); assert.ok(state.dirty);

    // Guardar (Ctrl+S) crea el JSON y abrirlo de nuevo recupera todo.
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => !window.__mapEditor.state.dirty, null, { timeout: 30000 });
    const saved = JSON.parse(await readFile(join(directory, `${state.id}.json`), 'utf8'));
    assert.equal(saved.objects.length, 1); assert.equal(saved.colliders.length, 1); assert.equal(saved.markers.length, 2);
    assert.match(saved.preview, /^data:image\/jpeg;base64,/);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('loading')?.hidden && window.__mapEditor?.state.savedId && !window.__mapEditor.state.dirty, null, { timeout: 120000 });
    const reopened = await editor();
    assert.deepEqual([reopened.objects, reopened.colliders, reopened.markers, reopened.dirty], [1, 1, 2, false]);

    // Plantilla de Pompelín: todas sus piezas existen en el catálogo.
    await page.evaluate(() => document.querySelector('[data-action=open]').click());
    await page.locator('[data-action=pompelin]').click();
    await page.waitForFunction(() => document.getElementById('loading').hidden && window.__mapEditor.state.doc.objects.length > 500, null, { timeout: 120000 });
    const missing = await page.evaluate(() => {
      const { state } = window.__mapEditor;
      return [...new Set(state.doc.objects.map(object => object.asset).filter(asset => !state.assetById.has(asset)))];
    });
    assert.deepEqual(missing, []);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('publishing preserves multiple maps, generates SQL and rejects broken arrivals atomically', async () => {
  const published = api('__published');
  const post = (body, type = 'application/json') => fetch(published, { method: 'POST', headers: { 'Content-Type': type }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  assert.deepEqual(await (await fetch(published)).json(), { published: [] });

  const catalog = JSON.parse(await readFile(join(process.cwd(), 'src', 'assets', 'library', 'catalog.json'), 'utf8'));
  const library = catalog.assets[0];
  const map = maps.newMap('ciudad_test', 'Ciudad de prueba', { width: 32, depth: 32, cell: 2 });
  const layer = map.layers[0].id;
  const object = (id, asset) => ({ id, asset, layer, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: 'auto' });
  map.objects = [object('casa', 'city/home_A'), object('cosa', library.id), object('otra', library.id)];
  const created = await put({ ...map, preview: 'data:image/jpeg;base64,AAAA' }, { 'If-None-Match': '*' });
  assert.equal(created.status, 201);
  const revision = created.headers.get('etag');

  assert.equal((await post({ id: 'ciudad_test' }, 'text/plain')).status, 415);
  assert.equal((await post('{no es json')).status, 400);
  assert.equal((await post({ id: '../fuera' })).status, 400);
  assert.equal((await post({ id: 'no_existe' })).status, 404);
  assert.equal((await post({ id: 'ciudad_test', revision: '"otra"' })).status, 409, 'publicar exige la revisión guardada');
  assert.equal((await post('x'.repeat(5000))).status, 413);

  const response = await post({ id: 'ciudad_test', revision });
  assert.equal(response.status, 200);
  const meta = (await response.json()).published;
  assert.equal(meta.id, 'ciudad_test'); assert.equal(meta.objects, 3); assert.equal(meta.assets, 1);
  assert.equal(meta.bytes, library.bytes);
  assert.equal((await (await fetch(published)).json()).published[0].id, 'ciudad_test');

  const city = JSON.parse(await readFile(join(publishDirectory, 'maps', 'ciudad_test.json'), 'utf8'));
  assert.equal(city.preview, 'data:image/jpeg;base64,AAAA', 'la miniatura viaja para la pantalla de carga');
  assert.equal(city.objects.length, 3);
  const module = await readFile(join(publishDirectory, 'maps', 'ciudad_test.ts'), 'utf8');
  assert.match(module, new RegExp(`${library.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?url';`));
  assert.ok(module.includes(JSON.stringify(library.id)));
  assert.ok(!module.includes('city/home_A'), 'las piezas de la ciudad ya van en el juego');
  assert.match(await readFile(join(publishDirectory, 'published.ts'), 'utf8'), /import \* as m0 from '\.\/maps\/ciudad_test';[\s\S]*PUBLISHED_WORLD/);
  // El módulo generado se resuelve tal cual (rutas relativas a la biblioteca correctas).
  const loaded = await server.ssrLoadModule(join(publishDirectory, 'maps', 'ciudad_test.ts'));
  assert.equal(loaded.map.id, 'ciudad_test');
  assert.match(loaded.assets[library.id], /\.glb/);

  const broken = maps.newMap('ciudad_rota', 'Rota', { width: 32, depth: 32, cell: 2 });
  broken.objects = [{ ...object('x', 'nada/objects/fantasma'), layer: broken.layers[0].id }];
  assert.equal((await put(broken, { 'If-None-Match': '*' })).status, 201);
  assert.equal((await post({ id: 'ciudad_rota' })).status, 422, 'no publica recursos que no existen');
  assert.equal((await (await fetch(published)).json()).published[0].id, 'ciudad_test', 'un fallo no pisa la ciudad publicada');

  const zone = maps.newMap('zona_test', "Arboleda de O'Brien", { width: 1000, depth: 800, cell: 4 });
  zone.markers.push({ id: 'llegada', type: 'arrival', name: 'Entrada', layer: 'logica', position: [10,0,8], rotationY: 1, radius: 1 });
  assert.equal((await put(zone, { 'If-None-Match': '*' })).status, 201);
  assert.equal((await post({ id: zone.id })).status, 200);
  map.markers.push({ id: 'puerta', type: 'portal', name: 'Salida', layer: 'logica', position: [5,0,0], radius: 3, rotationY: 0,
    trigger: 'walk', target: { map: zone.id, arrival: 'llegada' } });
  assert.equal((await put(map, { 'If-Match': revision })).status, 200);
  assert.equal((await post({ id: map.id })).status, 200);
  assert.equal((await (await fetch(published)).json()).published.length, 2);
  const sql = await readFile(join(publishDirectory, 'world.sql'), 'utf8');
  assert.match(sql, /O''Brien/);
  assert.match(sql, /"x":10,"z":8,"yaw":1/);
  assert.match(sql, /"minX":-500/);
  const before = await readFile(join(publishDirectory, 'published.ts'), 'utf8');
  const zoneRevision = (await fetch(api(zone.id))).headers.get('etag');
  zone.markers = zone.markers.filter(marker => marker.id !== 'llegada');
  assert.equal((await put(zone, { 'If-Match': zoneRevision })).status, 200);
  assert.equal((await post({ id: zone.id })).status, 422, 'no publica una llegada eliminada que usan otros mapas');
  assert.equal(await readFile(join(publishDirectory, 'world.sql'), 'utf8'), sql);
  assert.equal(await readFile(join(publishDirectory, 'published.ts'), 'utf8'), before);
  assert.equal(JSON.parse(await readFile(join(publishDirectory, 'maps', 'zona_test.json'), 'utf8')).markers.length, 2, 'restaura el mapa publicado si falla el SQL');
  assert.equal((await fetch(`${published}/${zone.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await (await fetch(published)).json()).published.map(map => map.id), ['ciudad_test']);
  assert.ok((await fetch(api(zone.id))).ok, 'retirar del juego no borra el borrador');

  assert.equal((await fetch(published, { method: 'PUT' })).status, 405);
  assert.equal((await fetch(published, { method: 'DELETE' })).status, 200);
  assert.deepEqual(await (await fetch(published)).json(), { published: [] });
  assert.match(await readFile(join(publishDirectory, 'published.ts'), 'utf8'), /const META: PublishedMapMeta\[\] = \[\];/);
  assert.deepEqual(await readdir(join(publishDirectory, 'maps')), []);

  for (const id of ['ciudad_test', 'ciudad_rota', 'zona_test']) await rm(join(directory, `${id}.json`));
});

test('the game adapter turns the Brumaluz template into a playable capital', { timeout: 240000 }, async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${url}/src/data/maps.ts`);
    const result = await page.evaluate(async () => {
      // La misma URL de Three que usa el adaptador: un segundo ejemplar rompería instanceof.
      const source = await (await fetch('/src/world/mapCity.ts')).text();
      const THREE = await import(/from\s+["']([^"']*\/three\.js[^"']*)["']/.exec(source)[1]);
      const { pompelinTemplate } = await import('/src/dev/mapEditor/pompelin.ts');
      const { buildMapCity } = await import('/src/world/mapCity.ts');
      const catalog = await (await fetch('/src/assets/library/catalog.json')).json();
      const doc = await pompelinTemplate();
      const assets = Object.fromEntries(catalog.assets.map(asset => [asset.id, `/src/assets/library/${asset.path}`]));
      const city = await buildMapCity(doc, assets, new THREE.Scene());
      city.update(1, city.spawn);
      const house = doc.objects.find(object => /^city\/(home|building)_/.test(object.asset) && object.collision !== 'none');
      const target = new THREE.Vector3(house.position[0], 0, house.position[2]);
      const from = target.clone().add(new THREE.Vector3(8, 0, 0));
      const stopped = city.collide(from, target.clone());
      const terrain = city.root.getObjectByName('hex_terrain');
      const positions = terrain.geometry.getAttribute('position');
      let sunk = 0;
      for (let i = 0; i < positions.count; i++) if (positions.getY(i) < city.groundY(positions.getX(i), positions.getZ(i)) - 0.5) sunk++;
      return {
        name: city.root.name, locationId: city.locationId,
        npcs: city.npcSites.map(site => site.id),
        interactables: city.interactables.map(item => item.id),
        vendors: city.vendorSpots.length,
        spawn: city.spawn.toArray().every(Number.isFinite), spawnFree: city.collide(city.spawn, city.spawn.clone()).distanceTo(city.spawn) < 1e-6,
        blocked: stopped.distanceTo(target) > 1, sunk,
        clouds: city.root.children.some(child => child.userData.hideFromMinimap),
      };
    });

    assert.equal(result.name, 'city:brumaluz');
    assert.deepEqual([...result.npcs].sort(), ['isberto', 'testiculos']);
    assert.ok(result.interactables.includes('well'));
    assert.ok(result.vendors >= 4);
    assert.ok(result.spawn && result.spawnFree, 'aparece en un punto libre');
    assert.ok(result.blocked, 'los edificios bloquean el paso');
    assert.ok(result.sunk > 1000, 'el terreno se hunde bajo las casillas para que no asome');
    assert.ok(result.clouds, 'las nubes no salen en el minimapa');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('map selector creates the detailed capital once and preserves edits when switching maps', { timeout: 120000 }, async () => {
  const world = maps.newMap('selector_world', 'Continente de prueba', {width:32,depth:32,cell:2,grass:0});
  world.settings.kind = 'world';
  assert.equal((await put(world, {'If-None-Match':'*'})).status, 201);
  const page = await browser.newPage({viewport:{width:1500,height:900}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let discard = false;
  page.on('dialog', dialog => discard ? dialog.accept() : dialog.dismiss());
  try {
    await page.goto(`${url}/maps.html`);
    await page.waitForFunction(() => document.getElementById('loading')?.hidden && window.__mapEditor?.state.assets.length > 1000, null, {timeout:90000});
    const selector = page.getByRole('combobox', {name:'Mapa a editar'});
    await selector.selectOption(world.id);
    await page.waitForFunction(() => window.__mapEditor.state.doc.id === 'selector_world');
    await selector.selectOption('brumaluz');
    await page.waitForFunction(() => window.__mapEditor.state.doc.id === 'brumaluz', null, {timeout:30000});
    await page.waitForFunction(() => !document.getElementById('map-selector').disabled);
    const capital = await (await fetch(api('brumaluz'))).json();
    assert.equal(capital.settings.kind, 'city');
    assert.ok(capital.objects.length > 100, 'abre la ciudad detallada, no el icono del continente');
    await page.getByRole('tab',{name:'Mapa',exact:true}).click();
    await page.locator('#map-settings label').filter({hasText:/^Nombre/}).locator('input').fill('Brumaluz editada');
    await page.locator('#map-settings label').filter({hasText:/^Nombre/}).locator('input').press('Tab');
    await selector.selectOption(world.id);
    assert.equal(await selector.inputValue(), 'brumaluz', 'cancelar descarte mantiene el mapa');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await page.waitForFunction(() => !window.__mapEditor.state.dirty);
    await selector.selectOption(world.id);
    await page.waitForFunction(() => window.__mapEditor.state.doc.id === 'selector_world');
    await page.waitForFunction(() => !document.getElementById('map-selector').disabled);
    await selector.selectOption('brumaluz');
    await page.waitForFunction(() => window.__mapEditor.state.doc.name === 'Brumaluz editada');
    const entries = (await (await fetch(api())).json()).maps;
    assert.equal(entries.filter(map=>map.id.startsWith('brumaluz')).length,1,'no genera copias al cambiar');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
    for(const id of [world.id,'brumaluz']) await rm(join(directory,`${id}.json`),{force:true});
  }
});

test('portal inspector chooses destinations and saves reciprocal connections in both drafts', { timeout: 120000 }, async () => {
      const source = maps.newMap('connection_source', 'Origen', { width: 32, depth: 32, cell: 2, grass: 0 });
      const destination = maps.newMap('connection_target', 'Destino', { width: 32, depth: 32, cell: 2, grass: 0 });
      source.markers.push({ id:'portal',type:'portal',name:'Viajar',layer:'logica',position:[8,0,0],rotationY:0,radius:2 });
      destination.markers.push({ id:'arrival',type:'arrival',name:'Entrada',layer:'logica',position:[0,0,0],rotationY:0,radius:1 });
      for (const map of [source, destination]) assert.equal((await put(map, { 'If-None-Match':'*' })).status, 201);
      const page = await browser.newPage({viewport:{width:1500,height:900}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      try {
        await page.goto(`${url}/maps.html`);
        await page.waitForFunction(() => document.getElementById('loading')?.hidden && window.__mapEditor?.state.assets.length > 1000, null, {timeout:90000});
        await page.getByRole('button', { name:'Abrir', exact:true }).click();
        await page.locator('.map-card').filter({hasText:'Origen'}).getByRole('button', {name:'Abrir', exact:true}).click();
        await page.getByRole('tab', {name:'Escena', exact:true}).click();
        await page.locator('[data-key="m:portal"]').click();
        const target = page.locator('#properties label').filter({hasText:/^Mapa de destino/}).locator('select');
        await target.waitFor();
        assert.ok(await target.locator('option[value="brumaluz"]').count(), 'ofrece la capital procedural aunque no tenga borrador');
        await target.selectOption('connection_target');
        await page.locator('#properties label').filter({hasText:/^Llegada/}).locator('select').selectOption('arrival');
        await page.locator('#properties label').filter({hasText:/^Activación/}).locator('select').selectOption('interact');
        await page.getByRole('button', {name:'Conectar ida y vuelta',exact:true}).click();
        await page.waitForFunction(() => document.getElementById('hint-info').textContent.includes('Ida y vuelta conectadas'), null, {timeout:20000});
        const savedSource=await (await fetch(api(source.id))).json();
        const savedTarget=await (await fetch(api(destination.id))).json();
        const portal=savedSource.markers.find(marker=>marker.id==='portal');
        assert.equal(portal.target.map, destination.id);
        assert.equal(portal.trigger, 'interact');
        assert.ok(maps.arrivalPoint(savedTarget,portal.target.arrival));
        const back=savedTarget.markers.find(marker=>marker.type==='portal');
        assert.equal(back.target.map, source.id);
        const arrival=maps.arrivalPoint(savedSource,back.target.arrival);
        assert.ok(arrival);
        assert.ok(Math.hypot(arrival.position[0]-portal.position[0],arrival.position[2]-portal.position[2])>portal.radius);
        assert.deepEqual(errors,[]);
      } finally {
        await page.close();
        for(const map of [source,destination]) await rm(join(directory,`${map.id}.json`));
      }
});
