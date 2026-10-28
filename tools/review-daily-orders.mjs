// Actual game/master UI, backed by isolated PostgreSQL profession RPCs.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fixture} from '../scripts/obtainability-fixture.mjs';
const out='art/daily-orders-review';await mkdir(out,{recursive:true});
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8')),f=await fixture();
const server=await createServer({cacheDir:'node_modules/.vite-daily-orders',server:{host:'127.0.0.1',port:4259,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser;const errors=[],calls=[];
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-language','es');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,async route=>{
  if(!route.request().url().endsWith('/rpc/rpg_action'))return route.fulfill({status:200,contentType:'application/json',body:'null'});
  const b=route.request().postDataJSON();calls.push({action:b.p_action,args:b.p_args});
  try{const result=await f.action(b.p_action,b.p_args,b.p_request,b.p_revision);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});}
  catch(error){return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:error.message})});}
 });
 await page.goto('http://127.0.0.1:4259/?test&welcome&graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(async()=>{
  window.brumaluz.set({name:'Artesano',cls:'guerrero',introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned',health:66,wallet:{pelines:5}});window.brumaluz.play();
  const {session}=await import('/src/game/state.ts'),{professionState,RPG_CATALOG}=await import('/src/data/professions.ts');
  await(await import('/src/game/cities.ts')).switchGameMap('taller_herreria_interior');session.state.location='taller_herreria_interior';session.state.rpg=professionState(undefined);
  session.state.inventory=Array(25).fill(null);session.state.inventory[0]={id:'componente_herreria_0',count:6};
  const teacher=RPG_CATALOG.teachers.herreria;window.brumaluz.move(teacher.x,teacher.z+1.3);window.brumaluz.view(.4,.7,10);
 });
 const state=await page.evaluate(async()=>(await import('/src/game/state.ts')).session.state);await f.seed(state);await f.move(catalog.teachers.herreria);
 await page.evaluate(async id=>{const {session}=await import('/src/game/state.ts');session.activeCharacterId=id;session.worldConnection={pause(){},resume(){}};},f.id);
 await page.keyboard.press('KeyE');const choice=text=>page.locator('#dialog .dialog-choice').filter({hasText:text});
 await choice('Encargos diarios').click();assert.match(await page.locator('#dialog').innerText(),/Te quedan 3 de 3/);assert.match(await page.locator('#dialog').innerText(),/independientes de los proyectos/);
 await choice('Componentes para la forja').click();assert.match(await page.locator('#dialog').innerText(),/6 \/ 2/);assert.match(await page.locator('#dialog').innerText(),/75 Pelines/);
 await page.screenshot({path:out+'/daily-desktop.png'});
 await page.setViewportSize({width:390,height:844});const deliver=choice('Entregar y cobrar 75 Pelines');await deliver.scrollIntoViewIfNeeded();
 const box=await deliver.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=844);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:out+'/daily-mobile.png'});
 await deliver.click();await page.waitForFunction(async()=>(await import('/src/game/state.ts')).session.state.wallet.pelines===80);
 assert.match(await page.locator('#dialog').innerText(),/Te quedan 2 encargos/);
 for(let n=0;n<2;n++){await choice('Ver encargos diarios').click();await choice('Componentes para la forja').click();await choice('Entregar y cobrar 75 Pelines').click();}
 await page.waitForFunction(async()=>(await import('/src/game/state.ts')).session.state.rpg.dailyOrders.completed===3);
 await choice('Ver encargos diarios').click();assert.match(await page.locator('#dialog').innerText(),/Te quedan 0 de 3/);await choice('Componentes para la forja').click();assert.equal(await choice('Entregar y cobrar').count(),0);
 await page.screenshot({path:out+'/daily-limit.png'});
 const done=await f.data();assert.equal(done.wallet.pelines,230);assert.equal(done.inventory.filter(Boolean).length,0);assert.equal(done.rpg.dailyOrders.completed,3);assert.equal(calls.filter(c=>c.action==='daily_order').length,3);assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser-report.json`,JSON.stringify({passed:true,desktop:true,mobileWidth:390,actualSqlDeliveries:3,paid:225,sharedDailyLimit:3,errors,liveWrites:false},null,2));console.log('Daily order master dialogue, mobile delivery, SQL payment and exhausted allowance passed.');
}finally{await browser?.close();await server.close();await f.db.close();}
