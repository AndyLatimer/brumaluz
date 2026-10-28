import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const directory='art/collectibles-review';await mkdir(directory,{recursive:true});
const server=await createServer({cacheDir:'node_modules/.vite-collectibles-review',server:{host:'127.0.0.1',port:4238,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4238/maps.html');
  await page.waitForFunction(()=>window.__mapEditor);
  await page.evaluate(async()=>{
    await (await import('/src/dev/mapEditor/docs.ts')).openById('brumaluz');
    const {camera,controls}=window.__mapEditor;
    controls.target.set(0,0,0);camera.position.set(20,35,40);controls.update();
  });
  const markers=await page.evaluate(()=>window.__mapEditor.state.doc.markers.filter(m=>['coin-bag','fairy-dust'].includes(m.text)).map(m=>m.id));
  assert.deepEqual(markers.sort(),['coins_plaza_pozo','coins_testiculos_debugger','dust_arco_entrada','dust_plaza_fuente']);
  await page.waitForTimeout(2000);
  await page.screenshot({path:`${directory}/editor-collectibles.png`});
  const progress=await page.evaluate(async()=>{
    const {renderCollections}=await import('/src/ui/collectionsWindow.ts');
    const {COIN_BAGS}=await import('/src/data/coinBags.ts');
    const {FAIRY_DUST_SPOTS}=await import('/src/data/fairyDust.ts');
    const host=document.createElement('div');document.body.append(host);
    const cases=[[[],[],0],[COIN_BAGS.map(b=>b.id),[],50],[[],FAIRY_DUST_SPOTS.map(d=>d.id),50],[COIN_BAGS.map(b=>b.id),FAIRY_DUST_SPOTS.map(d=>d.id),100]];
    const result=cases.map(([bags,dust,expected])=>{
      renderCollections(host,bags,dust);
      const percent=host.querySelector('.collections-hero-progress strong').textContent;
      const tile=host.querySelector('.collections-realm-tile');
      const regional=tile.querySelector('.collections-tile-progress').textContent;
      tile.click();host.querySelector('summary').click();
      return {percent,regional,expected,categories:host.querySelector('.collection-subzone').querySelectorAll('.collection-category').length};
    });host.remove();return result;
  });
  for(const row of progress){assert.equal(row.percent,`${row.expected}%`);assert.ok(row.regional.startsWith(`${row.expected}%`));assert.equal(row.categories,2);}
  assert.deepEqual(errors,[]);
  console.log('Editor: four collectible markers. Progress: 0%, 50% per complete type, 100% for both.');
}finally{await browser?.close();await server.close();}
