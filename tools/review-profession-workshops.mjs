import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const {workshops}=JSON.parse(await readFile('src/data/workshops.json','utf8'));
const out='art/workshops-review';await mkdir(out,{recursive:true});
const server=await createServer({cacheDir:'node_modules/.vite-workshops-review',server:{host:'127.0.0.1',port:4239,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser;const errors=[],checks=[];
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const page=await browser.newPage({viewport:{width:1360,height:920},reducedMotion:'reduce'});
 page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');localStorage.setItem('brumaluz-language','es');});
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.goto('http://127.0.0.1:4239/?test&welcome&graphics=compatible',{timeout:120000,waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(async()=>{
  window.brumaluz.set({name:'Visitante',introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned',health:66});
  const {session,play}=await import('/src/game/state.ts');session.state.wallet.pelines=500;window.__workshopPlay=play;
  (await import('/src/data/worldClock.ts')).syncWorldClock({hour:10,secondsPerHour:36000});window.brumaluz.play();
 });
 assert.equal(await page.evaluate(async()=>Object.keys((await import('/src/game/state.ts')).session.worldCharacters).length),3,'Masters are loaded when their workshop is visited');
 await page.evaluate(w=>{window.brumaluz.move(w.entrance.x,w.entrance.z);window.brumaluz.view(.3,1.05,65);},workshops[0]);
 await page.waitForTimeout(600);await page.screenshot({path:`${out}/artisan-district-game.png`});
 for(const workshop of workshops){
  console.log(`Review ${workshop.job}`);
  await page.evaluate(entrance=>{window.brumaluz.move(entrance.x,entrance.z);window.brumaluz.view(entrance.yaw,.55,9);},workshop.entrance);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(id=>window.brumaluz.city().locationId===id&&!window.__workshopPlay.mapTravelling,workshop.mapId,{timeout:90000});
  const state=await page.evaluate(async w=>{
   const {npcActors}=await import('/src/game/cities.ts'),{play}=await import('/src/game/state.ts'),actor=npcActors.find(a=>a.id===w.masterId);
   const bank=play.city.interactables.find(i=>i.id===`station:${w.job}`);
   const at=new (await import('/node_modules/three/build/three.module.js')).Vector3(w.station.x,0,w.station.z);at.y=play.city.groundY(at.x,at.z);
   return {master:actor?.id,visible:actor?.character.root.visible,bank:!!bank,free:play.city.collide(at,at.clone()).distanceTo(at)<.1};
  },workshop);
  assert.deepEqual(state,{master:workshop.masterId,visible:true,bank:true,free:true});
  const blocked=await page.evaluate(async w=>{
   const {play}=await import('/src/game/state.ts'),{Vector3}=await import('/node_modules/three/build/three.module.js');
   const failures=[];
   for(const target of [w.station,{x:w.master.x,z:w.master.z+1.15}])for(let i=0;i<=20;i++){
    const t=i/20,x=w.arrival.x+(target.x-w.arrival.x)*t,z=w.arrival.z+(target.z-w.arrival.z)*t;
    const at=new Vector3(x,play.city.groundY(x,z),z);
    if(play.city.collide(at,at.clone()).distanceTo(at)>.1)failures.push([x,z]);
   }
   return failures;
  },workshop);
  assert.deepEqual(blocked,[],`${workshop.job}: clear approach from arrival to teacher and bank`);
  await page.evaluate(w=>{window.brumaluz.move(w.arrival.x,w.arrival.z-.2);window.brumaluz.view(.4,.7,10);},workshop);
  await page.waitForTimeout(450);await page.screenshot({path:`${out}/game-${workshop.job}.png`});
  await page.evaluate(w=>window.brumaluz.move(w.master.x,w.master.z+1.15),workshop);
  await page.keyboard.press('KeyE');await page.locator('#dialog:not([hidden])').waitFor();
  assert.match(await page.locator('#dialog').textContent(),/¿Cómo empiezo/);
  assert.equal((await page.locator('#dialog').textContent()).includes('\\n'),false,'Dialogue paragraphs use real line breaks');
  if(workshop.job==='herreria')await page.screenshot({path:`${out}/master-dialogue.png`});
  await page.getByRole('button',{name:workshop.job==='minero'||workshop.job==='lenador'||workshop.job==='recolector'?'Consultar los recursos':'Ver las recetas',exact:true}).click();
  await page.locator('.profession-window').waitFor();assert.match(await page.locator('.profession-header').textContent(),new RegExp(workshop.job==='minero'?'Minero':workshop.job==='lenador'?'Leñador':workshop.job==='recolector'?'Recolector':workshop.label));
  if(!['minero','lenador','recolector'].includes(workshop.job)){
   assert.equal(await page.locator('.profession-recipe-checkout .primary').count(),0,'The book cannot buy recipes; purchases stay in the master conversation');
   assert.match(await page.locator('.profession-recipe-checkout').innerText(),/maestro/);
  }
  await page.locator('#window-close').click();
  await page.evaluate(w=>window.brumaluz.move(w.station.x,w.station.z),workshop);await page.keyboard.press('KeyE');await page.locator('.profession-window').waitFor();
  assert.match(await page.locator('.profession-location').textContent(),/Estación disponible|Pompelín/);
  await page.locator('[data-profession-control="tab-guide"]').click();
  assert.ok(await page.locator('.profession-guide-step').count()>=3);
  if(workshop.job==='herreria'||workshop.job==='recolector'){
   await page.screenshot({path:`${out}/guide-${workshop.job}.png`});
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/guide-${workshop.job}-390.png`});
   assert.equal(await page.locator('.profession-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   await page.setViewportSize({width:1360,height:920});
  }
  await page.locator('#window-close').click();
  await page.evaluate(w=>window.brumaluz.move(w.exit.x,w.exit.z),workshop);await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz'&&!window.__workshopPlay.mapTravelling,null,{timeout:90000});
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.brumaluz.city().locationId),'brumaluz');
  checks.push(`${workshop.job}: door roundtrip, master dialogue, bank, guide and clear arrival.`);
 }
 // A normal game render checks lighting and the same lazy master outside test mode.
 await page.goto('http://127.0.0.1:4239/?graphics=compatible',{timeout:120000,waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(async()=>{
  document.getElementById('account-gate').hidden=true;document.body.classList.remove('auth-visible','characters-visible');window.brumaluz.set({introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned'});window.brumaluz.play();
  const {session}=await import('/src/game/state.ts');await (await import('/src/game/cities.ts')).switchGameMap('taller_alquimia_interior');session.state.location='taller_alquimia_interior';window.brumaluz.move(0,2.3);window.brumaluz.view(.4,.7,10);
 });
 await page.waitForTimeout(600);await page.screenshot({path:`${out}/normal-game-alquimia.png`});
 await page.goto('http://127.0.0.1:4239/maps.html',{timeout:120000,waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__mapEditor?.state?.surface,null,{timeout:120000});
 await page.evaluate(async()=>{await (await import('/src/dev/mapEditor/docs.ts')).openById('brumaluz');const {camera,controls}=window.__mapEditor;camera.position.set(-85,80,5);controls.target.set(-104,0,-55);controls.update();});
 await page.waitForTimeout(700);await page.screenshot({path:`${out}/artisan-district-editor.png`});
 for(const {job} of workshops){
  await page.evaluate(async job=>{await (await import('/src/dev/mapEditor/docs.ts')).openById(`taller_${job}_interior`);const {camera,controls}=window.__mapEditor;camera.position.set(10,13,15);controls.target.set(0,.5,0);controls.update();},job);
  await page.waitForTimeout(700);await page.screenshot({path:`${out}/map-editor-${job}.png`});
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/review.json`,JSON.stringify({checks,errors,localFixtures:true,normalGameRenderer:true,editor:true},null,2));console.log(JSON.stringify({checks,errors}));
}catch(error){console.error(error);throw error;}finally{await browser?.close();await server.close();}
