import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const server=await createServer({cacheDir:'node_modules/.vite-pompelin-review',server:{host:'127.0.0.1',port:4212,strictPort:true,hmr:false,watch:null},logLevel:'error'});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(`${e.text()} ${JSON.stringify(e.location())}`);});
 page.on('response',r=>{if(r.status()>=400)console.error('HTTP',r.status(),r.url());});
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'text/javascript',body:'export function createHotContext(){return {on(){},accept(){},dispose(){}}}'}));
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.route('**/__landscape',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style>'}));await page.goto('http://127.0.0.1:4212/__landscape');
 const report=await page.evaluate(async()=>{
  const transformed=await(await fetch('/src/world/mapCity.ts')).text();
  const threeUrl=/from "([^"]*\/three\.js[^"]*)"/.exec(transformed)?.[1];
  if(!threeUrl)throw Error('Cannot resolve the map renderer Three instance');
  const T=await import(threeUrl),{loadPublishedMap}=await import('/src/world/mapCity.ts');
  const scene=new T.Scene();scene.background=new T.Color('#c9decc');scene.fog=new T.Fog('#c9decc',90,280);
  scene.add(new T.HemisphereLight('#fff5d7','#647b47',2.2));const sun=new T.DirectionalLight('#fff1ce',2.5);sun.position.set(-30,70,35);scene.add(sun);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(50,innerWidth/innerHeight,.1,1300),{city}=await loadPublishedMap('pompelin',scene);scene.add(city.root);
  const blocked=[];
  for(const[id,arrival]of Object.entries(city.arrivals)){if(!id.startsWith('desde_brumaluz_'))continue;const p=arrival.position,q=city.collide(p,p.clone());if(p.distanceTo(q)>.2)blocked.push(id);}
  camera.position.set(-35,13,-61);camera.lookAt(-72,3,-90);camera.updateMatrixWorld();city.update(1,new T.Vector3(-56,2,-90));renderer.render(scene,camera);
  const terrain=city.root.getObjectByName('hex_terrain');const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const visible=terrain.children.filter(p=>p.visible&&frustum.intersectsObject(p));
  window.landscape={city,scene,camera,renderer,T};
  return {blocked,patches:terrain.children.length,nearbyPatches:visible.length,terrainFaces:visible.reduce((n,p)=>n+p.geometry.index.count/3,0),fullTerrainFaces:terrain.geometry.index.count/3,drawCalls:renderer.info.render.calls};
 });
 assert.deepEqual(report.blocked,[],'All five arrival points stay clear');assert.ok(report.patches>20&&report.nearbyPatches<report.patches/5,JSON.stringify(report));
 await page.screenshot({path:'art/pompelin-review/puerta-en-juego.png'});
 await page.evaluate(()=>{const{city,camera,renderer,scene,T}=landscape;scene.fog.far=600;scene.fog.near=180;camera.position.set(-230,80,40);camera.lookAt(-120,3,-90);city.update(2,new T.Vector3(-120,3,-90));renderer.render(scene,camera);});
 await page.screenshot({path:'art/pompelin-review/capital-en-juego.png'});
 const views=[
  {name:'arboledas-del-camino',eye:[-295,22,-115],target:[-252,4,-184],focus:[-266,3,-158]},
  {name:'colinas-del-norte',eye:[-260,30,-235],target:[-380,8,-410],focus:[-285,4,-275]},
  {name:'cumbres-restauradas',eye:[678,45,490],target:[790,8,575],focus:[735,1,560]},
  {name:'ribera',eye:[344,19,265],target:[401,0,227],focus:[365,1,245]},
  {name:'puente-del-camino',eye:[375,23,295],target:[343,0,280],focus:[346,1,280]},
  {name:'arboleda-copas',eye:[480,105,-75],target:[655,3,-225],focus:[650,1,-225]},
  {name:'arboleda-sendero',eye:[595,10,-176],target:[640,3,-205],focus:[625,1,-195]},
 ];
 for(const view of views){await page.evaluate(view=>{const{city,camera,renderer,scene,T}=landscape;scene.fog.near=100;scene.fog.far=330;camera.position.set(...view.eye);camera.lookAt(...view.target);const focus=new T.Vector3(...view.focus);city.update(3,focus);for(let n=0;n<24;n++)city.fadeOccluders?.(camera.position,[focus.clone().add(new T.Vector3(0,1.2,0))],.05);renderer.render(scene,camera);},view);await page.screenshot({path:`art/pompelin-review/${view.name}.png`});}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser?.close();await server.close();}
