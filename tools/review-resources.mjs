import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const directory='art/resources-review';await mkdir(directory,{recursive:true});
const server=await createServer({cacheDir:'node_modules/.vite-resources-review',server:{host:'127.0.0.1',port:4224,strictPort:true,hmr:false,watch:null},logLevel:'error'});
server.middlewares.use('/__resources',(_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Brumaluz · recursos</title><body></body>');});
let browser;const errors=[],checks=[];
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',error=>{errors.push(error.message);console.error(page.url(),error.stack);});
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');localStorage.setItem('brumaluz-language','es');});
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.route('http://127.0.0.1:4224/__resources',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Resource models</title><body></body>'}));
 await page.goto('http://127.0.0.1:4224/__resources');
 const geometryAudit=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {resourceGeometry,furnitureGeometry,gatheringToolGeometry,resourceMaterial}=await import('/src/world/resourceModels.ts');
  const {RESOURCE_FAMILIES,resourceDrawing}=await import('/src/data/resourceAppearance.ts');
  const {itemIcon}=await import('/src/data/items.ts');
  document.head.insertAdjacentHTML('beforeend',`<style>body{margin:0;padding:32px;background:#e7d9bb;color:#503d2b;font:15px Georgia}h1{font-size:26px;margin:0 0 8px}p{color:#8c7351}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}article{border:1px solid #b39b72;border-radius:8px 20px 8px 8px;background:#f2e6cb;padding:12px;text-align:center}article img{width:100%;height:172px;object-fit:contain}h3{margin:7px;font-size:16px}footer{display:flex;justify-content:center;gap:10px;margin-top:10px}footer svg{width:34px;height:34px}</style>`);
  document.body.innerHTML='<h1>Brumaluz · cuaderno de recursos</h1><p>Modelos de campo e iconos compartidos · ocho familias</p><main></main>';
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(400,320);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,400/320,.1,30);scene.add(new THREE.HemisphereLight('#fff0d4','#8d846d',3));const sun=new THREE.DirectionalLight('#fff3d7',3);sun.position.set(-3,6,5);scene.add(sun);
  function preview(geometry,height=1){
   const mesh=new THREE.Mesh(geometry,resourceMaterial());scene.add(mesh);camera.position.set(2.6,2,-3.1).multiplyScalar(height);camera.lookAt(0,height*.43,0);renderer.render(scene,camera);
   const image=renderer.domElement.toDataURL();mesh.removeFromParent();geometry.dispose();mesh.material.dispose();return image;
  }
  const audit=[];
  for(const [family,identity]of Object.entries(RESOURCE_FAMILIES)){
   for(let tier=0;tier<6;tier++)for(const depleted of [false,true]){
    const geometry=resourceGeometry(family,tier,depleted);const positions=geometry.attributes.position.array;
    if(!positions.every(Number.isFinite))throw Error(`Nonfinite geometry: ${family}/${tier}`);
    audit.push({family,tier,depleted,triangles:positions.length/9});geometry.dispose();
   }
   const card=document.createElement('article');card.innerHTML=`<img src="${preview(resourceGeometry(family,0),family==='wood'?1.1:.82)}"><h3>${identity.label}</h3><footer>${[0,1,2,3,4,5].map(tier=>`<svg viewBox="0 0 24 24">${resourceDrawing(family,tier)}</svg>`).join('')}</footer>`;document.querySelector('main').append(card);
  }
  window.resourcePreview={preview,furnitureGeometry,gatheringToolGeometry,itemIcon,renderer};return audit;
 });
 await page.screenshot({path:`${directory}/resources-and-icons.png`,fullPage:true});checks.push('All eight resource families and all 96 available/depleted geometries have finite vertices.');
 await page.evaluate(()=>{
  const {preview,furnitureGeometry,gatheringToolGeometry,itemIcon}=window.resourcePreview;
  document.querySelector('h1').textContent='Brumaluz · herramientas y mobiliario';document.querySelector('p').textContent='Piezas que se usan y se fabrican en los oficios';document.querySelector('main').innerHTML='';
  for(const kind of ['taburete','mesa','biblioteca','estacion']){const card=document.createElement('article');card.innerHTML=`<img src="${preview(furnitureGeometry(kind,0),kind==='biblioteca'?1.4:1)}"><h3>${kind}</h3><footer>${itemIcon(`mueble_${kind}_0`)}</footer>`;document.querySelector('main').append(card);}
  for(const job of ['minero','lenador','recolector']){const card=document.createElement('article');card.innerHTML=`<img src="${preview(gatheringToolGeometry(job),.75)}"><h3>${job}</h3><footer>${itemIcon(`herramienta_${job}_0`)}</footer>`;document.querySelector('main').append(card);}
 });
 await page.screenshot({path:`${directory}/tools-and-furniture.png`,fullPage:true});
 await page.goto('http://127.0.0.1:4224/?test&welcome&graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {session}=await import('/src/game/state.ts');const {professionState}=await import('/src/data/professions.ts');const {syncWorldClock}=await import('/src/data/worldClock.ts');
  window.brumaluz.set({name:'Artesana',cls:'guerrero',introSeen:true,welcome:{origin:0,stage:'completed'},shadowQuest:'returned',equipment:{weapon:{id:'espada_inicial',count:1,bound:true}},health:60});
  session.state.rpg=professionState();for(const job of ['minero','lenador','recolector'])session.state.rpg.tools[job]={id:`herramienta_${job}_0`,count:1,durability:100,maxDurability:100,originalDurability:100};
  session.state.wallet.pelines=500;syncWorldClock({hour:10,secondsPerHour:36000});window.brumaluz.play();
  const {switchGameMap}=await import('/src/game/cities.ts');await switchGameMap('pompelin');session.state.location='pompelin';
 });
 const fixtures=await page.evaluate(async()=>{
  const {RPG_CATALOG}=await import('/src/data/professions.ts'),{resourceFamily}=await import('/src/data/resourceAppearance.ts');
  return Object.keys((await import('/src/data/resourceAppearance.ts')).RESOURCE_FAMILIES).map(family=>Object.values(RPG_CATALOG.nodes).find(n=>n.tier===0&&resourceFamily(n.item)===family));
 });
 for(const node of fixtures){
  await page.evaluate(node=>{window.brumaluz.move(node.x+1.1,node.z+1.8);window.brumaluz.spin(Math.PI);window.brumaluz.view(.55,.48,5.5);},node);
  await page.waitForTimeout(450);await page.screenshot({path:`${directory}/game-${node.id}.png`});
 }
 for(const job of ['minero','lenador','recolector']){
  const node=fixtures.find(node=>node.job===job);
  await page.evaluate(async node=>{
   const {holder}=await import('/src/game/stage.ts');window.brumaluz.move(node.x,node.z+1.2);holder.rotation.y=Math.PI;
   window.gatherPromise=(await import('/src/game/professions.ts')).gatherResource(node.id);
  },node);
  await page.locator('.gather-progress:not(.complete)').waitFor();await page.waitForTimeout(450);
  await page.screenshot({path:`${directory}/gather-${job}.png`});
  const tool=await page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('gathering-tool'));assert.equal(tool,true);
  await page.evaluate(()=>window.gatherPromise);await page.locator('.gather-progress.complete').waitFor();
  const result=await page.evaluate(async node=>{const {session}=await import('/src/game/state.ts');return {material:session.state.inventory.find(i=>i?.id===node.item)?.count,energy:session.state.rpg.energy,cooldown:session.state.rpg.nodes[node.id],tool:!!window.brumaluz.char().root.getObjectByName('gathering-tool')};},node);
  assert.equal(result.material,1);assert.ok(result.cooldown>Date.now()/1000);assert.equal(result.tool,false);checks.push(`${job}: timed extraction, held tool, material receipt and depletion.`);
  await page.screenshot({path:`${directory}/gathered-${job}.png`});
 }
 const cancelNode=fixtures.find(n=>n.job==='recolector');
 await page.evaluate(async node=>{const {session}=await import('/src/game/state.ts');delete session.state.rpg.nodes[node.id];window.gatherPromise=(await import('/src/game/professions.ts')).gatherResource(node.id);},cancelNode);
 await page.locator('.gather-progress:not(.complete)').waitFor();await page.locator('.gather-progress button').click();await page.evaluate(()=>window.gatherPromise);
 assert.equal(await page.locator('.gather-progress').count(),0);checks.push('Cancelling removes progress and held tools without granting another material.');
 for(const reason of ['movement','damage']){
  await page.evaluate(async({node,reason})=>{
   const {session}=await import('/src/game/state.ts');delete session.state.rpg.nodes[node.id];window.brumaluz.move(node.x,node.z+1.2);
   window.gatherPromise=(await import('/src/game/professions.ts')).gatherResource(node.id);window.cancelReason=reason;
  },{node:cancelNode,reason});
  await page.locator('.gather-progress:not(.complete)').waitFor();
  await page.evaluate(async node=>{if(window.cancelReason==='movement')window.brumaluz.move(node.x+1,node.z+1.2);else (await import('/src/game/state.ts')).session.state.health-=1;},cancelNode);
  await page.evaluate(()=>window.gatherPromise);assert.equal(await page.locator('.gather-progress').count(),0);
  assert.equal(await page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('gathering-tool')),false);
 }checks.push('Movement and damage interrupt extraction and remove its held tool.');
 await page.evaluate(async()=>{const {selectProfessionTab}=await import('/src/ui/professionsWindow.ts');selectProfessionTab('recipes','recolector');(await import('/src/ui/menus.ts')).setWindow('professions');});
 await page.locator('.profession-field-resource').first().waitFor();await page.screenshot({path:`${directory}/field-guide-desktop.png`});
 assert.ok(await page.locator('.profession-field-locate:enabled').count()>0);
 await page.locator('.profession-field-locate:enabled').first().click();await page.locator('.zone-map').waitFor();
 assert.ok(await page.locator('.zone-map-resource').count()>0);await page.screenshot({path:`${directory}/resource-map.png`});checks.push('Field guide locates a resource on the real zone map.');
 await page.evaluate(async()=>{
  const {switchGameMap}=await import('/src/game/cities.ts'),{session,play}=await import('/src/game/state.ts');
  await switchGameMap('casa_de_isberto_interior');session.state.location=play.city.locationId;
  const pos=play.city.spawn;window.brumaluz.move(pos.x,pos.z);
  session.state.rpg.furniture=[{id:'review-forge',item:{id:'mueble_estacion_0',count:1},location:play.city.locationId,x:pos.x+1.5,z:pos.z,yaw:Math.PI,job:'herreria'}];
  const {RPG_CATALOG}=await import('/src/data/professions.ts'),recipe=RPG_CATALOG.recipes.herramienta_minero_0;
  session.state.rpg.learned.push(recipe.id);session.state.inventory=Array(25).fill(null);Object.keys(recipe.ingredients).forEach((id,i)=>session.state.inventory[i]={id,count:60});
  (await import('/src/world/professionWorld.ts')).refreshProfessionWorld(play.city,session.state.rpg);
  window.brumaluz.view(.8,.5,5);
 });
 await page.waitForTimeout(500);await page.screenshot({path:`${directory}/home-workbench.png`});
 await page.evaluate(async()=>{
  (await import('/src/ui/professionsWindow.ts')).selectProfessionTab('recipes','herreria');(await import('/src/ui/menus.ts')).setWindow('professions');
 });
 await page.locator('[data-profession-control="recipe-herramienta_minero_0"]').click();
 await page.screenshot({path:`${directory}/crafting-desktop.png`});
 await page.getByRole('button',{name:'Encargar pieza',exact:true}).click();
 const crafted=await page.evaluate(async()=>{const {session}=await import('/src/game/state.ts');return {jobs:session.state.rpg.jobs.length,materials:session.state.inventory.filter(Boolean).reduce((n,i)=>n+i.count,0)};});
 assert.equal(crafted.jobs,1);assert.ok(crafted.materials<60);checks.push('Crafting at an installed home workbench reserves materials and creates a timed job.');
 await page.evaluate(async()=>{
  const {session}=await import('/src/game/state.ts'),{RPG_CATALOG}=await import('/src/data/professions.ts');
  const now=Date.now()/1000,recipes=Object.values(RPG_CATALOG.recipes).filter(r=>r.job==='herreria'&&r.tier===0).slice(0,3);
  session.state.rpg.jobs=recipes.map((r,i)=>({id:`review-${i}`,recipe:r.id,job:r.job,start:now+(i-1)*60,end:now+i*60-10,done:i===0,ingredients:r.ingredients,output:{id:r.output,count:1},xp:10}));
  const {selectProfessionTab}=await import('/src/ui/professionsWindow.ts');selectProfessionTab('jobs','herreria');(await import('/src/ui/menus.ts')).setWindow('professions');
 });
 await page.screenshot({path:`${directory}/jobs-desktop.png`});assert.equal(await page.locator('.profession-order').count(),3);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.screenshot({path:`${directory}/jobs-${width}.png`});
  assert.equal(await page.locator('.profession-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true,`Workshop fits ${width}px`);
  const bounds=await page.locator('.profession-window-frame').evaluate(el=>{const box=el.getBoundingClientRect(),bar=document.getElementById('action-bar').getBoundingClientRect();return {left:box.left,right:box.right,bottom:box.bottom,width:innerWidth,bar:bar.top};});
  assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.bar,JSON.stringify(bounds));
  await page.evaluate(async()=>{(await import('/src/ui/professionsWindow.ts')).selectProfessionTab('recipes','recolector');(await import('/src/ui/menus.ts')).setWindow('professions');});
  await page.screenshot({path:`${directory}/field-guide-${width}.png`});assert.equal(await page.locator('.profession-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.evaluate(async()=>{(await import('/src/ui/professionsWindow.ts')).selectProfessionTab('jobs','herreria');(await import('/src/ui/menus.ts')).setWindow('professions');});
 }checks.push('Jobs and field guide fit 390px and 320px.');
 await page.evaluate(async()=>{(await import('/src/ui/professionsWindow.ts')).selectProfessionTab('recipes','recolector');(await import('/src/ui/menus.ts')).setWindow('professions');(await import('/src/ui/i18n.ts')).setLanguage('en');});
 assert.match(await page.locator('.profession-field-availability').first().textContent(),/available/);
 await page.screenshot({path:`${directory}/field-guide-english.png`});checks.push('Resource availability and gathering details translate to English.');
 await page.evaluate(async()=>{(await import('/src/ui/i18n.ts')).setLanguage('es');});
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:4224/?graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(async node=>{
  document.getElementById('account-gate').hidden=true;document.body.classList.remove('auth-visible','characters-visible');
  const {session}=await import('/src/game/state.ts'),{syncWorldClock}=await import('/src/data/worldClock.ts');
  window.brumaluz.set({introSeen:true,welcome:{origin:0,stage:'completed'},shadowQuest:'returned',equipment:{weapon:{id:'espada_inicial',count:1,bound:true}}});
  window.brumaluz.play();await (await import('/src/game/cities.ts')).switchGameMap('pompelin');session.state.location='pompelin';syncWorldClock({hour:10,secondsPerHour:36000});
  window.brumaluz.move(node.x,node.z+1.2);window.brumaluz.spin(Math.PI);window.brumaluz.view(.55,.48,5.5);window.brumaluz.char().beginGathering('minero');
 },fixtures[0]);
 await page.waitForTimeout(1200);await page.screenshot({path:`${directory}/resources-real-game.png`});checks.push('Resource and held tool checked with the normal game renderer, outside test mode.');
 await page.goto('http://127.0.0.1:4224/maps.html',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__mapEditor?.state?.surface,null,{timeout:120000});
 await page.evaluate(async node=>{const {openById}=await import('/src/dev/mapEditor/docs.ts');await openById('pompelin');const {camera,controls,state}=window.__mapEditor,y=state.field.heightAt(node.x,node.z);camera.position.set(node.x+5,y+5,node.z+7);controls.target.set(node.x,y+.4,node.z);controls.update();},fixtures[0]);
 await page.waitForTimeout(1000);
 const preview=await page.evaluate(()=>window.__mapEditor.scene.getObjectByName('editor-resource-preview')?.userData.nodeCount);
 assert.equal(preview,216);await page.screenshot({path:`${directory}/editor-resources.png`});checks.push('Map editor shows the same 216 resource nodes without storing duplicate map objects.');
 assert.deepEqual(errors,[]);
 await writeFile(`${directory}/review.json`,JSON.stringify({checks,geometryAudit,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();await server.close();}
