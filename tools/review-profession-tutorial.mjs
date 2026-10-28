// UI integration review with real profession RPCs in isolated PostgreSQL/WASM.
// Map positioning and clock jumps are review fixtures, not a timed play session.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fixture} from '../scripts/obtainability-fixture.mjs';
const out='art/profession-tutorial-review';await mkdir(out,{recursive:true});
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8')),defs=catalog.professionTutorial,f=await fixture();
const server=await createServer({cacheDir:'node_modules/.vite-profession-tutorial',server:{host:'127.0.0.1',port:4261,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser,page;const errors=[],actions=[],consoleErrors=[];
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'){consoleErrors.push(m.text());console.error(m.text());}});
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-language','es');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,async route=>{
  if(!route.request().url().endsWith('/rpc/rpg_action'))return route.fulfill({status:200,contentType:'application/json',body:'null'});
  const b=route.request().postDataJSON();actions.push({action:b.p_action,args:b.p_args});
  if(b.p_action==='gather_finish')await f.step(catalog.nodes[b.p_args.id].seconds+1);
  try{const result=await f.action(b.p_action,b.p_args,b.p_request,b.p_revision);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});}
  catch(e){return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:e.message})});}
 });
 await page.goto('http://127.0.0.1:4261/?test&welcome&graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(()=>{window.brumaluz.set({name:'Aprendiz',cls:'guerrero',introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned',health:66,wallet:{pelines:70}});window.brumaluz.play();});
 const initial=await page.evaluate(async()=>(await import('/src/game/state.ts')).session.state);await f.seed(initial);await f.db.exec('update test_clock set stamp=now()');
 await page.evaluate(async id=>{const {session}=await import('/src/game/state.ts');session.activeCharacterId=id;session.worldConnection={pause(){},resume(){}};},f.id);
 const go=async(location,point)=>{await f.move({...point,location});await page.evaluate(async({location,point})=>{const {session}=await import('/src/game/state.ts'),menus=await import('/src/ui/menus.ts');(await import('/src/ui/dialog.ts')).closeDialog();menus.setWindow(null);menus.setGameMenuOpen(false);await(await import('/src/game/cities.ts')).switchGameMap(location);session.state.location=location;window.brumaluz.move(point.x,point.z);window.brumaluz.view(.4,.7,10);}, {location,point});};
 const action=async(name,args={})=>{const okay=await page.evaluate(async({name,args})=>(await import('/src/game/professions.ts')).performProfession(name,args),{name,args});assert.equal(okay,true,name);};
 const choice=text=>page.locator('#dialog .dialog-choice').filter({hasText:text});
 const talkToMaster=()=>page.evaluate(async()=>{(await import('/src/ui/menus.ts')).setWindow(null);(await import('/src/game/interaction.ts')).talkTo('isberto');});
 const teacher={...catalog.teachers.herreria,z:catalog.teachers.herreria.z+1.3};
 await go('brumaluz',defs.mentor);await page.waitForTimeout(350);await page.keyboard.press('KeyE');await choice('Quiero fabricar algo.').click();await choice(/Herrería$/).click();
 assert.match(await page.locator('#dialog').innerText(),/40 XP/);assert.equal((await f.data()).rpg?.tutorial,undefined,'viewing offer must not accept');
 await page.screenshot({path:`${out}/offer-desktop.png`});await page.setViewportSize({width:390,height:844});await choice('Aceptar misión').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/offer-mobile.png`});await choice('Aceptar misión').click();
 await page.waitForFunction(async()=>(await import('/src/game/state.ts')).session.state.rpg?.tutorial?.job==='herreria');await choice('Vamos al taller.').click();
 await page.keyboard.press('KeyJ');assert.equal(await page.locator('[data-quest="profession"]').count(),1);assert.match(await page.locator('[data-quest="profession"]').innerText(),/Hablar con el maestro/);await page.screenshot({path:`${out}/journal-mobile.png`});await page.setViewportSize({width:1440,height:1000});
 await go(teacher.location,teacher);await talkToMaster();await choice('Mi iniciación al oficio').click();await choice('Empezar la práctica').click();await page.keyboard.press('Escape');
 await action('buy_tool',{job:'minero'});
 await page.evaluate(async()=>(await import('/src/ui/menus.ts')).setWindow('inventory'));
 const toolSlot=await page.evaluate(async()=>(await import('/src/game/state.ts')).session.state.inventory.findIndex(item=>item?.id==='herramienta_minero_0'));await page.locator(`.inv-slot[data-index="${toolSlot}"]`).click();
 await page.waitForFunction(async()=>{const {session,play}=await import('/src/game/state.ts');return !!session.state.rpg.tools.minero&&!play.actionBusy;});await page.evaluate(async()=>(await import('/src/ui/menus.ts')).setWindow(null));
 await talkToMaster();await choice('Comprar recetas').click();await choice(/Aprendiz$/).click();
 for(let n=0;n<15&&await choice('Componente de Herrería').count()===0;n++)await choice('Página siguiente').click();
 await choice('Componente de Herrería').click();await choice('Comprar por 50 Pelines').click();await choice('Abrir mochila').click();
 const recipeSlot=await page.evaluate(async()=>(await import('/src/game/state.ts')).session.state.inventory.findIndex(item=>item?.id==='receta_componente_herreria_0'));assert.ok(recipeSlot>=0);await page.locator(`.inv-slot[data-index="${recipeSlot}"]`).click();await page.waitForFunction(async()=>{const {session,play}=await import('/src/game/state.ts');return session.state.rpg.learned.includes('componente_herreria_0')&&!play.actionBusy;});await page.evaluate(async()=>(await import('/src/ui/menus.ts')).setWindow(null));
 const nodes=Object.values(catalog.nodes).filter(n=>n.item==='material_minero_0').slice(0,6);
 for(const node of nodes){
  await go(node.location,node);await page.evaluate(async id=>await(await import('/src/game/professions.ts')).gatherResource(id),node.id);
 }
 assert.equal((await f.data()).rpg.tutorial.gathered,6);
 await go(teacher.location,teacher);await action('craft',{id:'componente_herreria_0',count:2});
 await page.keyboard.press('KeyJ');await page.screenshot({path:`${out}/waiting-for-work.png`});await page.keyboard.press('Escape');
 await f.step(61);await action('state');let d=await f.data();for(const id of d.rpg.tutorial.jobIds)await action('collect',{id});
 await talkToMaster();await choice('Encargos diarios').click();await choice('Componentes para la forja').click();await choice('Entregar y cobrar 75 Pelines').click();await choice('Volver a mis preguntas').click();await choice('Mi iniciación al oficio').click();
 assert.match(await page.locator('#dialog .dialog-quest-card').innerText(),/Entrega de misión/);await page.screenshot({path:`${out}/turn-in-desktop.png`});await page.setViewportSize({width:390,height:844});await choice('Completar misión').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/turn-in-mobile.png`});await choice('Completar misión').click();
 d=await f.data();assert.equal(d.rpg.tutorial.status,'completed');assert.equal(d.experience,40);assert.equal(d.wallet.pelines,75);assert.equal(d.rpg.dailyOrders.completed,1);assert.equal(d.rpg.tutorial.collected,2);
 await choice('Seguir con el oficio').waitFor({state:'visible'});await choice('Salir de la conversación').click();await page.keyboard.press('KeyJ');await page.locator('[data-quest-control="completed"]').click();await page.locator('[data-quest-control="completed-profession"]').click();await page.screenshot({path:`${out}/completed-mobile.png`});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser-report.json`,JSON.stringify({passed:true,errors,selected:'herreria',actualSqlActions:actions,completed:d.rpg.tutorial,final:{pelines:d.wallet.pelines,experience:d.experience,dailyOrders:d.rpg.dailyOrders},fixture:{startingPelines:70,positioning:true,queueClockAdvanced:true},liveWrites:false},null,2));console.log('Quest offer, profession choice, real RPC loop, mobile journal and explicit turn-in passed.');
 for(const name of ['failure.json','failure.png'])await unlink(`${out}/${name}`).catch(e=>{if(e.code!=='ENOENT')throw e;});
}catch(e){if(page){await writeFile(`${out}/failure.json`,JSON.stringify({error:e.message,errors,consoleErrors,body:await page.locator('body').innerText()},null,2));await page.screenshot({path:`${out}/failure.png`});}throw e;}finally{await browser?.close();await server.close();await f.db.close();}
