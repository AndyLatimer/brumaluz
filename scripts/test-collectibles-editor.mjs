import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir,mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mapEditorPlugin} from '../tools/map-editor-plugin.mjs';
import {collectibleCatalog,collectiblesSql,defaultCollectibles} from '../tools/collectibles.mjs';

test('catalog preserves old IDs, follows edits and excludes hidden and deleted collectibles',()=>{
  const marker=(id,text,x=2,layer='logic')=>({id,type:'interaction',text,position:[x,0,3],rotationY:.7,layer});
  const map={id:'brumaluz',layers:[{id:'logic',visible:true},{id:'hidden',visible:false}],markers:[marker('coins_plaza_pozo','coin-bag'),marker('dust_collect_test','fairy-dust'),marker('dust_secret','fairy-dust',8,'hidden')]};
  const spots=collectibleCatalog([map]);
  assert.deepEqual(spots.map(s=>s.id),['plaza_pozo','collect_test']);
  assert.equal(spots[0].x,2);
  assert.equal(collectibleCatalog([{...map,markers:[]}]).length,0);
  const other=collectibleCatalog([{...map,id:'pompelin'}]);
  assert.deepEqual(other.map(s=>s.id),['pompelin:collect_test']);
  assert.equal(other[0].area,'Alrededores de Brumaluz');
  assert.deepEqual(collectibleCatalog([{id:'brumaluz',procedural:true}]).length,4);
});

test('editor adds both types, undoes, saves, publishes and collects them in the game', {timeout:180000}, async()=>{
  const workspace=resolve('node_modules'),directory=await mkdtemp(join(workspace,'.collectibles-test-'));
  const mapsDir=join(directory,'drafts'),publishDir=join(directory,'world'),sqlFile=join(directory,'world.sql');
  await mkdir(mapsDir);await mkdir(publishDir);
  await writeFile(join(publishDir,'collectibles.json'),'[]');
  await writeFile(join(publishDir,'published.ts'),'export const PUBLISHED_WORLD = {};');
  const fixtureModules={
    [resolve('src/data/world/collectibles.json')]:join(publishDir,'collectibles.json'),
    [resolve('src/data/world/published')]:join(publishDir,'published.ts'),
  };
  const server=await createServer({configFile:false,cacheDir:join(directory,'cache'),logLevel:'error',assetsInclude:['**/*.glb'],
    plugins:[{name:'collectibles-fixture',enforce:'pre',resolveId(source,importer){
      if(!importer)return;
      const path=source.startsWith('/src/')?resolve(source.slice(1)):source.startsWith('.')?resolve(dirname(importer),source):source;
      return fixtureModules[path];
    }},mapEditorPlugin({mapsDir,publishDir,sqlFile})],
    server:{host:'127.0.0.1',port:4241,strictPort:true,hmr:false,watch:null,fs:{allow:[process.cwd()]}}});
  let browser;
  try{
    await server.listen();
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.addInitScript(()=>{localStorage.setItem('brumaluz-language','es');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
    await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const url='http://127.0.0.1:4241';
    await page.goto(`${url}/maps.html`);await page.locator('#loading').waitFor({state:'hidden'});
    await page.evaluate(async()=>{
      const {newMap}=await import('/src/data/maps.ts'),{openDocument}=await import('/src/dev/mapEditor/core.ts');
      openDocument(newMap('brumaluz','Coleccionables de prueba',{width:64,depth:64,cell:2}),null,null);
      const {camera,controls}=window.__mapEditor;controls.target.set(0,0,0);camera.position.set(0,40,28);controls.update();
    });
    await page.getByRole('button',{name:'✦ Añadir coleccionables',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__mapEditor.state.tool),'collectible');
    const place=async(x,z)=>{
      const point=await page.evaluate(({x,z})=>{
        const {THREE,camera}=window.__mapEditor,rect=document.querySelector('#viewport canvas').getBoundingClientRect();
        const p=new THREE.Vector3(x,0,z).project(camera);return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
      },{x,z});await page.mouse.click(point.x,point.y);
    };
    await place(5,0);
    await page.locator('#tool-options select').first().selectOption('fairy-dust');
    await place(-5,0);
    const count=()=>page.evaluate(()=>window.__mapEditor.state.doc.markers.filter(m=>['coin-bag','fairy-dust'].includes(m.text)).length);
    assert.equal(await count(),2);
    await page.keyboard.press('Control+z');assert.equal(await count(),1);
    await page.keyboard.press('Control+y');assert.equal(await count(),2);
    await page.waitForFunction(()=>window.__mapEditor.scene.getObjectsByProperty('name','collectible-model').length===2);
    await mkdir('art/collectibles-review',{recursive:true});
    await page.screenshot({path:'art/collectibles-review/editor-add-collectibles.png'});
    await page.keyboard.press('Control+s');await page.waitForFunction(()=>!window.__mapEditor.state.dirty);
    const post=()=>fetch(`${url}/__dev/maps/__published`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'brumaluz'})});
    const published=await post();assert.equal(published.status,200,await published.text());
    const catalog=JSON.parse(await readFile(join(publishDir,'collectibles.json'),'utf8'));
    assert.equal(catalog.length,2);assert.deepEqual(catalog.map(s=>s.kind),['coin-bag','fairy-dust']);
    const sql=await readFile(sqlFile,'utf8');for(const spot of catalog)assert.ok(sql.includes(spot.id));
    await page.goto(`${url}/?test&graphics=compatible`);await page.waitForFunction(()=>window.brumaluz,null,{timeout:60000});
    await page.evaluate(spot=>{
      window.brumaluz.set({introSeen:true,welcome:null,shadowQuest:null,coinBags:[],fairyDust:[],wallet:{pelines:0}});
      window.brumaluz.play();window.brumaluz.move(spot.x,spot.z+1);window.brumaluz.view(.5,.8,7);
    },catalog[0]);
    await page.locator('#interact-label').filter({hasText:'Recoger bolsa de pelines'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(async id=>(await import('/src/game/state.ts')).session.state.coinBags.includes(id),catalog[0].id);
    await page.evaluate(spot=>window.brumaluz.move(spot.x,spot.z+1),catalog[1]);
    await page.locator('#interact-label').filter({hasText:'Recoger polvos de hada'}).waitFor();
    await page.screenshot({path:'art/collectibles-review/published-editor-collectibles.png'});
    await page.keyboard.press('KeyE');
    await page.waitForFunction(async id=>(await import('/src/game/state.ts')).session.state.fairyDust.includes(id),catalog[1].id);
    await page.locator('#world-menu-toggle').click();await page.locator('#world-menu-collections').click();
    assert.match(await page.locator('.collections-hero-progress').textContent(),/100%/);
    assert.deepEqual(errors,[]);
    // Republishing edits the same ID; deletion removes it from both catalogs.
    const draft=JSON.parse(await readFile(join(mapsDir,'brumaluz.json'),'utf8'));
    draft.markers=draft.markers.filter(m=>m.text!=='fairy-dust');
    draft.markers.find(m=>m.text==='coin-bag').position[0]=9;
    const current=await fetch(`${url}/__dev/maps/brumaluz`);
    const saved=await fetch(`${url}/__dev/maps/brumaluz`,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':current.headers.get('etag')},body:JSON.stringify(draft)});
    assert.equal(saved.status,200);assert.equal((await post()).status,200);
    const updated=JSON.parse(await readFile(join(publishDir,'collectibles.json'),'utf8'));
    assert.equal(updated.length,1);assert.equal(updated[0].id,catalog[0].id);assert.equal(updated[0].x,9);
    assert.ok(!(await readFile(sqlFile,'utf8')).includes(catalog[1].id));
  }finally{
    await browser?.close();await server.close();
    assert.ok(resolve(directory).startsWith(workspace+sep));await rm(directory,{recursive:true,force:true});
  }
});

const pglitePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let sqlAvailable=true;try{await access(pglitePath);}catch{sqlAvailable=false;}
test('generated SQL validates map catalogs and retains reward ranges',{skip:!sqlAvailable,timeout:60000},async()=>{
  const {PGlite}=await import(pathToFileURL(pglitePath).href),db=new PGlite();
  try{
    await db.exec('create role anon; create role authenticated;');
    await db.exec(collectiblesSql(defaultCollectibles));
    assert.deepEqual((await db.query("select public.game_coin_bag('testiculos_debugger') as spot")).rows[0].spot,
      {x:-9.2,z:5.028203230275508,min:20,max:40,location:'brumaluz'});
    await db.exec(collectiblesSql([{...defaultCollectibles[2],id:'pompelin:collect_test',mapId:'pompelin',x:40}]));
    assert.equal((await db.query("select public.game_fairy_dust('pompelin:collect_test')->>'location' as map")).rows[0].map,'pompelin');
    assert.equal((await db.query("select public.game_coin_bag('plaza_pozo') as spot")).rows[0].spot,null);
    await db.exec(`
      create table public.characters(id uuid primary key,user_id uuid,data jsonb);
      create table public.world_players(character_id uuid,user_id uuid,position jsonb,seen_at timestamptz);
      create function public.game_lock_character(p_id uuid) returns public.characters language sql as $$select c from public.characters c where id=p_id$$;
      create function public.game_health(d jsonb) returns integer language sql as $$select 10$$;
      create function public.game_pelines(d jsonb) returns numeric language sql as $$select coalesce((d->>'pelines')::numeric,0)$$;
      create function public.game_set_pelines(d jsonb,n numeric) returns jsonb language sql as $$select d||jsonb_build_object('pelines',n)$$;
      create function public.game_add_item(d jsonb,item text) returns jsonb language plpgsql as $$begin
        if d->>'full'='true' then raise exception 'INVENTORY_FULL'; end if;
        return d||jsonb_build_object('dustCount',coalesce((d->>'dustCount')::integer,0)+1);
      end$$;
      create function public.game_store(p_id uuid,d jsonb) returns jsonb language sql as $$update public.characters set data=d where id=p_id returning data$$;
    `);
    for(const name of ['14-coin-bags.sql','15-fairy-dust.sql'])await db.exec(await readFile(new URL(`../supabase/server/${name}`,import.meta.url),'utf8'));
    const catalog=[{...defaultCollectibles[0],id:'pompelin:bag',mapId:'pompelin',x:10,z:3},{...defaultCollectibles[2],id:'pompelin:dust',mapId:'pompelin',x:40,z:3}];
    await db.exec(collectiblesSql(catalog));
    const id=randomUUID(),user=randomUUID();
    await db.query('insert into public.characters values($1,$2,$3)',[id,user,{location:'brumaluz'}]);
    await db.query('insert into public.world_players values($1,$2,$3,now())',[id,user,{x:40,z:3}]);
    const dust=()=>db.query("select public.collect_fairy_dust($1,'pompelin:dust') as data",[id]);
    await assert.rejects(dust,/FAIRY_DUST_NOT_PLAYING/);
    await db.query("update public.characters set data=data||'{\"location\":\"pompelin\"}'");
    await db.query("update public.characters set data=data||'{\"full\":true}'");
    await assert.rejects(dust,/INVENTORY_FULL/);
    assert.equal((await db.query('select data from public.characters')).rows[0].data.fairyDustQuest,undefined);
    await db.query("update public.characters set data=data-'full'");
    const reward=(await dust()).rows[0].data;
    assert.ok(reward.dustCount>=1&&reward.dustCount<=5);assert.deepEqual(reward.fairyDust,['pompelin:dust']);
    assert.equal(reward.fairyDustQuest,'ask_gnomi');
    await assert.rejects(dust,/FAIRY_DUST_TAKEN/);
    const bag=()=>db.query("select public.collect_coin_bag($1,'pompelin:bag') as data",[id]);
    await assert.rejects(bag,/COIN_BAG_TOO_FAR/);
    await db.query("update public.world_players set position='{\"x\":10,\"z\":3}'");
    const coins=(await bag()).rows[0].data;
    assert.ok(coins.pelines>=10&&coins.pelines<=30);assert.deepEqual(coins.coinBags,['pompelin:bag']);
    assert.deepEqual(coins.fairyDust,['pompelin:dust']);
    await assert.rejects(bag,/COIN_BAG_TAKEN/);
    const ask=()=>db.query('select public.fairy_dust_quest_action($1) as data',[id]);
    await assert.rejects(ask,/FAIRY_DUST_QUEST_TOO_FAR/);
    await db.query("update public.characters set data=data||'{\"location\":\"brumaluz\"}'");
    await assert.rejects(ask,/FAIRY_DUST_QUEST_TOO_FAR/);
    await db.query("update public.world_players set position='{\"x\":153.5,\"z\":0}'");
    const answered=(await ask()).rows[0].data;
    assert.equal(answered.fairyDustQuest,'arboleda');assert.equal(answered.dustCount,coins.dustCount);
    assert.equal(answered.pelines,coins.pelines);
    await assert.rejects(ask,/FAIRY_DUST_QUEST_STATE/);
    const another={...catalog[1],id:'pompelin:another'};await db.exec(collectiblesSql([...catalog,another]));
    await db.query("update public.characters set data=data||'{\"location\":\"pompelin\"}'");
    await db.query("update public.world_players set position='{\"x\":40,\"z\":3}'");
    assert.equal((await db.query("select public.collect_fairy_dust($1,'pompelin:another') as data",[id])).rows[0].data.fairyDustQuest,'arboleda');
  }finally{await db.close();}
});
