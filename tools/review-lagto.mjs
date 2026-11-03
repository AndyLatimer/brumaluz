import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const out='art/lagto-review',before=process.argv.includes('--before');await mkdir(out,{recursive:true});
const catalog=JSON.parse(await readFile('src/assets/library/brumaluz-lagto/catalog.json','utf8'));
const server=await createServer({cacheDir:`node_modules/.vite-lagto-review/${process.pid}`,server:{host:'127.0.0.1',port:4298,strictPort:true,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});
server.middlewares.use('/__lagto',(_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>Lagto</title><body></body>');});
let browser;const errors=[],checks=[];
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.route(/https:\/\/[^/]+\.supabase\.co\//,r=>r.fulfill({status:200,contentType:'application/json',body:'null'}));
 const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 await page.route('http://127.0.0.1:4298/__lagto',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Lagto</title><body></body>'}));
 await page.goto('http://127.0.0.1:4298/__lagto');
 const result=await page.evaluate(async assets=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const {loadLibraryAsset}=await import('/src/art/library.ts');
  document.head.insertAdjacentHTML('beforeend','<style>body{margin:0;padding:28px;background:#252b2b;color:#e2d5bb;font:15px Georgia}h1{margin:0 0 10px;color:#d99c6d}h2{margin:28px 0 12px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.card{background:#333b3a;border:1px solid #687365;border-radius:12px;text-align:center;padding:8px}.card img{width:100%;height:190px;object-fit:contain}.card p{margin:4px 0;font-size:12px}small{color:#aaa997}</style>');
  document.body.innerHTML='<h1>Cumbres de Cobre · Pueblo Lagto\'</h1><p>Cantería, metalurgia y vida de las cumbres</p>';
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(400,310);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,400/310,.01,500);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.05);room.dispose();scene.environment=env.texture;scene.environmentIntensity=.4;
  scene.add(new THREE.HemisphereLight('#fff1d4','#54656a',2.1));const key=new THREE.DirectionalLight('#ffe8cc',3.5);key.position.set(-3,7,5);scene.add(key);
  const audit=[];
  for(const category of ['Edificios','Mobiliario','Atrezo y decoración']){
   const section=document.createElement('section');section.dataset.category=category;section.innerHTML=`<h2>${category}</h2><div class="grid"></div>`;document.body.append(section);
   for(const asset of assets.filter(a=>a.category===category)){
    const {gltf}=await loadLibraryAsset(asset.id),object=gltf.scene;scene.add(object);
    const box=new THREE.Box3().setFromObject(object),center=box.getCenter(new THREE.Vector3()),r=box.getSize(new THREE.Vector3()).length()/2;
    camera.position.copy(center).add(new THREE.Vector3(.85,.62,1).normalize().multiplyScalar(r*3.8));camera.lookAt(center);renderer.render(scene,camera);
    const card=document.createElement('article');card.className='card';card.innerHTML=`<img src="${renderer.domElement.toDataURL()}"><p>${asset.label}</p><small>${asset.name}</small>`;section.querySelector('.grid').append(card);
    let triangles=0,textures=0;object.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])textures+=['map','normalMap','roughnessMap','metalnessMap','emissiveMap'].filter(k=>m[k]).length;}});
    audit.push({name:asset.name,triangles,textures});object.removeFromParent();
   }
  }
  renderer.dispose();env.dispose();pmrem.dispose();return audit;
 },catalog.assets);
 for(const [category,name]of [['Edificios','buildings'],['Mobiliario','furniture'],['Atrezo y decoración','props']])await page.locator(`section[data-category="${category}"]`).screenshot({path:`${out}/${before?'before-':''}${name}.png`});
 await page.screenshot({path:`${out}/${before?'before-':''}gallery.png`,fullPage:true});checks.push(`Rendered all ${result.length} GLBs with the game loader`);
 if(!before){
  await page.goto('http://127.0.0.1:4298/assets.html');await page.locator('#pack option[value="brumaluz-lagto"]').waitFor({state:'attached',timeout:120000});await page.locator('#pack').selectOption('brumaluz-lagto');
  for(const name of ['house_copper_bastion','forge_cobre_foundry','throne_basalt_copper','bed_cavern_hearth','cart_mine_ore','rug_lizard_weave']){
   await page.locator('#asset').selectOption(`brumaluz-lagto/objects/${name}`);
   await page.waitForFunction(n=>document.querySelector('#status').textContent.startsWith('Listo.')&&document.querySelector('#details').textContent.includes(`(${n})`),name,{timeout:60000});
   await page.screenshot({path:`${out}/editor-${name}.png`});
  }
  checks.push('Architecture, furnishings and mining props inspected in the real asset editor');
  await page.goto('http://127.0.0.1:4298/?test',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
  const world=await page.evaluate(async assets=>{
   window.brumaluz.set({introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned'});await window.brumaluz.play();
   const {instantiateMapAsset}=await import('/src/world/mapAssets.ts');
   const {scene,camera,renderer,stage,holder,graphics}=await import('/src/game/stage.ts');
   const THREE=await import('/node_modules/three/build/three.module.js');
   const groups=[],sources=new Set();
   for(const [index,category]of ['Edificios','Mobiliario','Atrezo y decoración'].entries()){
    const group=new THREE.Group();group.name=`Lagto review ${category}`;group.visible=false;scene.add(group);
    const list=assets.filter(a=>a.category===category),step=index===0?11:index===1?4:5;
    for(let i=0;i<list.length;i++){
     const object=await instantiateMapAsset(list[i].id);object.position.set((i%4-1.5)*step,0,Math.floor(i/4)*step);group.add(object);
     object.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(m[key])sources.add(m[key].source);});
    }
    groups.push({group,index,step,rows:Math.ceil(list.length/4),category});
   }
   renderer.setAnimationLoop(null);
   if(scene.fog){scene.fog.near=150;scene.fog.far=250;}
   window.lagtoWorldReview={groups,scene,camera,renderer,stage,holder};
   return{models:groups.reduce((n,g)=>n+g.group.children.length,0),textureSources:sources.size,compatible:graphics.compatible};
  },catalog.assets);
  assert.equal(world.models,50);assert.equal(world.textureSources,4,'Shared atlases must share GPU image sources');
  for(const [index,name]of ['buildings','furniture','props'].entries()){
   await page.evaluate(index=>{
    const {groups,camera,stage,holder}=window.lagtoWorldReview,g=groups[index];
    for(const entry of groups)entry.group.visible=entry===g;
    const centerZ=(g.rows-1)*g.step/2,d=index===0?44:22;
    holder.position.set(0,0,-3);camera.clearViewOffset();camera.position.set(d*.7,d*.85,centerZ+d);camera.lookAt(0,index===0?2:.5,centerZ);camera.updateProjectionMatrix();stage.render();stage.render();
   },index);
   await page.screenshot({path:`${out}/in-game-${name}.png`});
  }
  checks.push(`All 50 models shown with the real game renderer; four shared atlas sources; compatible=${world.compatible}`);
  await page.goto('http://127.0.0.1:4298/maps.html',{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByRole('button',{name:"Cumbres de Cobre · Pueblo Lagto'",exact:true}).waitFor({timeout:120000});
  await page.getByRole('button',{name:"Cumbres de Cobre · Pueblo Lagto'",exact:true}).click();
  assert.equal(await page.locator('#catalog-grid img').count(),50);
  for(const img of await page.locator('#catalog-grid img').all()){
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(img=>new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth>0)return resolve();const timer=setTimeout(()=>reject(Error('Thumbnail timeout')),30000);img.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});}));
  }
  await page.locator('#catalog-grid img').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/map-editor-catalog.png`});
  checks.push('All 50 map editor thumbnails loaded; no map or account was saved');
 }
 assert.equal(result.length,50);assert.deepEqual(errors,[]);
 await writeFile(`${out}/${before?'before-':''}review.json`,JSON.stringify({checks,errors,assets:result},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();await server.close();}
