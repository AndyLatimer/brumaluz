import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const out='art/home-model-review';await mkdir(out,{recursive:true});
const definitions=JSON.parse(await readFile('src/data/homeFurnishings.json','utf8')),count=Object.keys(definitions).length;
const server=await createServer({cacheDir:`node_modules/.vite-home-review/${process.pid}`,server:{host:'127.0.0.1',port:4297,strictPort:true,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});
const errors=[],checks=[];let browser;
try {
 await server.listen();
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{localStorage.setItem('brumaluz-language','es');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
 await context.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
 const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 await page.goto('http://127.0.0.1:4297/assets.html',{waitUntil:'domcontentloaded',timeout:120000});
 await page.locator('#pack option[value="brumaluz-home"]').waitFor({state:'attached',timeout:120000});
 await page.locator('#pack').selectOption('brumaluz-home');
 const kinds=await page.locator('#asset option').evaluateAll(options=>options.map(o=>o.value.split('/').at(-1)));
 assert.equal(kinds.length,count);
 for(const kind of kinds) {
   await page.locator('#asset').selectOption(`brumaluz-home/objects/${kind}`);
   await page.waitForFunction(kind=>document.querySelector('#status').textContent.startsWith('Listo.')&&document.querySelector('#details').textContent.includes(`(${kind})`),kind,{timeout:60000});
   await page.screenshot({path:`${out}/editor-${kind}-back.png`});
   await page.mouse.move(1100,500);await page.mouse.down();await page.mouse.move(600,500,{steps:14});await page.mouse.up();
   await page.waitForTimeout(180);
   await page.screenshot({path:`${out}/editor-${kind}.png`});
 }
 checks.push(`All ${count} self-contained GLBs loaded in the real asset editor`);
 console.log(checks.at(-1));

 const stability=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   const {furnitureGeometry}=await import('/src/world/homeFurniture.ts');
   const {furnitureMaterial,prepareFurnitureMaterials}=await import('/src/world/homeFurnitureMaterial.ts');
   const {HOME_FURNISHINGS}=await import('/src/data/homes.ts');
   await prepareFurnitureMaterials();
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(192,192);
   const target=new THREE.WebGLRenderTarget(192,192),pixels=new Uint8Array(192*192*4);
   renderer.setRenderTarget(target);
   const scene=new THREE.Scene();scene.background=new THREE.Color('#bcb5a6');
   scene.add(new THREE.HemisphereLight('#fff4db','#706b61',2.8));
   const light=new THREE.DirectionalLight('#fff4df',3);light.position.set(2,4,-3);scene.add(light);
   const camera=new THREE.PerspectiveCamera(36,1,.01,80),results=[];
   const hash=()=>{renderer.readRenderTargetPixels(target,0,0,192,192,pixels);let h=2166136261;for(const p of pixels)h=Math.imul(h^p,16777619);return h>>>0;};
   for(const kind of Object.keys(HOME_FURNISHINGS))for(let tier=0;tier<6;tier++) {
     const g=furnitureGeometry(kind,tier),mat=furnitureMaterial(),mesh=new THREE.Mesh(g,mat);scene.add(mesh);
     const center=g.boundingBox.getCenter(new THREE.Vector3()),radius=g.boundingSphere.radius;
     function render(angle,distance) {camera.position.copy(center).add(new THREE.Vector3(Math.sin(angle),.65,-Math.cos(angle)).normalize().multiplyScalar(radius*distance));camera.lookAt(center);renderer.render(scene,camera);return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
     render(.6,4.5);const first=hash();let last;
     for(const distance of [3.8,7,15])for(const angle of [0,.6,1.6,3.2,4.6]) {last=render(angle,distance);if(last.calls!==1||last.triangles!==g.index.count/3)throw Error(`Unexpected culling: ${kind}`);}
     render(.6,4.5);if(hash()!==first)throw Error(`Unstable repeat frame: ${kind}`);
     results.push({kind,tier,triangles:last.triangles,drawCalls:last.calls,repeatFrameStable:true});
     mesh.removeFromParent();g.dispose();mat.dispose();
   }
   target.dispose();renderer.dispose();return results;
 });
 assert.equal(stability.length,count*6);checks.push(`${count*6} qualities × 15 camera/zoom positions: one draw, constant topology, identical repeat frames`);
 console.log(checks.at(-1));

 await page.goto('http://127.0.0.1:4297/?test&welcome&graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 const setupGameFixture=async()=>{
   window.brumaluz.set({introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned'});
   await window.brumaluz.play();
   const {switchGameMap}=await import('/src/game/cities.ts');await switchGameMap('casa_del_olmo');
   const {session,play}=await import('/src/game/state.ts');
   const {HOME_FURNISHINGS,NEXT_HOME,placementError}=await import('/src/data/homes.ts');
   const {RPG_CATALOG}=await import('/src/data/professions.ts');
   const furniture=[];
   // Seed only local rendering fixtures; placement uses the real room validation.
   for(const kind of Object.keys(HOME_FURNISHINGS).sort((a,b)=>HOME_FURNISHINGS[b].width*HOME_FURNISHINGS[b].depth-HOME_FURNISHINGS[a].width*HOME_FURNISHINGS[a].depth)) {
     let found=false;
     for(let z=-3;z<=3&&!found;z+=.25)for(let x=-3;x<=3&&!found;x+=.25) {
       if(placementError(kind,x,z,0,furniture,id=>RPG_CATALOG.items[id]?.furniture??'',undefined,NEXT_HOME))continue;
       furniture.push({id:kind,item:{id:`mueble_${kind}_0`,count:1,instanceId:`review-${kind}`},location:'casa_del_olmo',x,z,yaw:Math.PI});found=true;
     }
     if(!found)throw Error(`No room for ${kind}`);
   }
   session.state.rpg.furniture=furniture;session.state.rpg.homes={owned:['lucero','olmo'],primary:'olmo',access:'private'};
   const models=await import('/src/world/professionWorld.ts');models.refreshProfessionWorld(play.city,session.state.rpg);
   window.homeReview={session,play,models};window.brumaluz.move(0,1.1);window.brumaluz.view(.5,.75,12);
 };
 await page.evaluate(setupGameFixture);
 await page.waitForTimeout(700);
 await page.screenshot({path:`${out}/in-game-house.png`});
 const behavior=await page.evaluate(async()=>{
   const {session,play,models}=window.homeReview,root=play.city.root;
   const before=root.getObjectByName('furniture:mesa'),uuid=before.uuid,geometry=before.children[0].geometry.uuid;
   const piece=session.state.rpg.furniture.find(f=>f.id==='mesa'),oldYaw=piece.yaw;piece.yaw+=.2;models.refreshProfessionWorld(play.city,session.state.rpg);
   if(root.getObjectByName('furniture:mesa').uuid!==uuid||root.getObjectByName('furniture:mesa').children[0].geometry.uuid!==geometry)throw Error('Furniture recreated during movement');
   piece.yaw=oldYaw;models.refreshProfessionWorld(play.city,session.state.rpg);
   models.setFurniturePreview(play.city,'mesa',0,piece.x,piece.z,0,true,undefined,'mesa');
   const preview=root.getObjectByName('home-furniture-preview'),previewId=preview.uuid;
   if(before.visible)throw Error('Original overlaps its own moving preview');
   models.setFurniturePreview(play.city,'mesa',0,piece.x+.1,piece.z,.1,false,undefined,'mesa');
   if(root.getObjectByName('home-furniture-preview').uuid!==previewId)throw Error('Preview recreated');
   if(preview.children[0].material.transparent||!preview.children[0].material.depthWrite)throw Error('Unstable preview depth');
   models.clearFurniturePreview(play.city);if(!before.visible)throw Error('Original not restored on cancel');
   const lantern=session.state.rpg.furniture.find(f=>f.id==='farol');lantern.lit=false;models.refreshProfessionWorld(play.city,session.state.rpg);
   const lamp=root.getObjectByName('furniture:farol');if(lamp.children[0].material.emissiveIntensity!==0||lamp.children.some(c=>c.isPointLight))throw Error('Lantern remains lit');
   lantern.lit=true;models.refreshProfessionWorld(play.city,session.state.rpg);
   (await import('/src/ui/menus.ts')).setWindow('homes');
   return{modelReused:true,previewReused:true,movingOriginalHidden:true,cancelRestored:true,lanternSwitch:true,count:session.state.rpg.furniture.length};
 });
 assert.equal(behavior.count,count);checks.push(`Real game house: ${count} pieces, stable movement/refresh, non-overlapping preview, cancellation and lantern on/off`);
 await page.locator('[data-home-tab="decorate"]').click();
 await page.screenshot({path:`${out}/in-game-decoration.png`});
 console.log(checks.at(-1));

 await page.goto('http://127.0.0.1:4297/?test&welcome',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(setupGameFixture);await page.waitForTimeout(700);
 assert.equal(await page.evaluate(()=>document.getElementById('graphics-error').hidden),true);
 const normalGraphics=await page.evaluate(async()=>{
   const {graphics}=await import('/src/game/stage.ts');
   return{compatible:graphics.compatible,shadows:graphics.renderer.shadowMap.enabled};
 });
 await page.screenshot({path:`${out}/in-game-house-normal.png`});
 checks.push(`Real game normal graphics: compatible=${normalGraphics.compatible}, shadows=${normalGraphics.shadows}, no graphics error`);
 console.log(checks.at(-1));

 await page.goto('http://127.0.0.1:4297/maps.html',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByRole('button',{name:'Brumaluz · Un rincón propio',exact:true}).waitFor({timeout:120000});
 await page.getByRole('button',{name:'Brumaluz · Un rincón propio',exact:true}).click();
 for(const image of await page.locator('#catalog-grid img').all())await image.scrollIntoViewIfNeeded();
 await page.waitForFunction(count=>{const imgs=[...document.querySelectorAll('#catalog-grid img')];return imgs.length===count&&imgs.every(i=>i.complete&&i.naturalWidth>0);},count,{timeout:120000});
 await page.screenshot({path:`${out}/map-editor-catalog.png`});
 checks.push(`All ${count} thumbnails displayed in the real map editor; no map saved`);
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/review.json`,JSON.stringify({checks,errors,stability,behavior,scope:'Local visual fixtures in real editors/game. No live account or database changes. Static repeat-frame checks do not prove every possible camera/device is artifact-free.'},null,2)+'\n');
 console.log(JSON.stringify({checks,errors}));
} catch(error) {
 await writeFile(`${out}/failure.json`,JSON.stringify({checks,errors,error:error.message},null,2));throw error;
} finally {await browser?.close();await server.close();}
