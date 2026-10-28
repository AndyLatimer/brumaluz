import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Real game loop, player camera, HUD and collision adapter; no editor or custom renderer.
const server=await createServer({cacheDir:'node_modules/.vite-pompelin-gameplay',server:{host:'127.0.0.1',port:4216,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser,page;const errors=[];
try{
 await server.listen();
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',error=>{errors.push(error.message);console.error('GAME EXCEPTION',error.message);});
 page.on('console',message=>{if(message.type()==='error')console.error('GAME',message.text());});
 page.on('response',response=>{if(response.status()>=400)console.error('HTTP',response.status(),response.url());});
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.goto('http://127.0.0.1:4216/?graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(async()=>{
  document.getElementById('account-gate').hidden=true;
  document.body.classList.remove('auth-visible','characters-visible');
  const {switchGameMap}=await import('/src/game/cities.ts'),{session,play}=await import('/src/game/state.ts'),{syncWorldClock}=await import('/src/data/worldClock.ts');
  window.__pompelinPlay=play;
  syncWorldClock({hour:10,secondsPerHour:36000});
  await switchGameMap('pompelin');session.state.location='pompelin';session.state.introSeen=true;
  window.brumaluz.play();window.brumaluz.move(-43,-90);window.brumaluz.view(Math.PI/2,.55,12);
 });
 await page.waitForTimeout(2000);
 const gates=await page.evaluate(()=>{
  const city=window.brumaluz.city();
  return city.portals.filter(p=>p.id.startsWith('entrada_brumaluz_')).map(portal=>{
   const arrival=city.arrivals[`desde_brumaluz_${portal.id.slice('entrada_brumaluz_'.length)}`].position;
   let point=arrival.clone(),steps=0;
   const free=city.collide(point,point.clone()).distanceTo(point)<.05;
   while(point.distanceTo(portal.position)>portal.radius&&steps++<300){
    const next=point.clone(),delta=portal.position.clone().sub(point);delta.y=0;delta.normalize().multiplyScalar(.15);
    next.add(delta);next.y=city.groundY(next.x,next.z);point=city.collide(point,next);
   }
   return {id:portal.id,trigger:portal.trigger,free,reachable:Math.hypot(point.x-portal.position.x,point.z-portal.position.z)<=portal.radius,steps};
  });
 });
 assert.equal(gates.length,5);for(const gate of gates){assert.equal(gate.trigger,'walk',gate.id);assert.ok(gate.free&&gate.reachable,JSON.stringify(gate));}
 await mkdir('art/pompelin-review',{recursive:true});
 await page.screenshot({path:'art/pompelin-review/pompelin-gameplay.png'});
 for(const shot of [
  {file:'pompelin-pradera-gameplay',x:-266,z:-158,yaw:.45},
  {file:'pompelin-cumbres-gameplay',x:715,z:480,yaw:.8},
  {file:'arboleda-llegada-gameplay',x:625,z:-195,yaw:-1.2},
  {file:'arboleda-bosque-gameplay',x:675,z:-165,yaw:.45},
 ]){
  await page.evaluate(shot=>{window.brumaluz.move(shot.x,shot.z);window.brumaluz.view(shot.yaw,.55,12);},shot);
  await page.waitForTimeout(1200);await page.screenshot({path:`art/pompelin-review/${shot.file}.png`});
 }
 const bridge=await page.evaluate(async()=>{
  const {holder,camTarget}=await import('/src/game/stage.ts'),{play}=await import('/src/game/state.ts');
  const x=345.625,z=281.875,platform=play.city.platformY(x,z);
  if(platform===null)throw Error('The bridge has no walking surface');
  window.brumaluz.move(x,z);holder.position.y=platform;play.groundHeight=platform;play.lastPlatformY=platform;
  camTarget.copy(holder.position);camTarget.y+=1.3;window.brumaluz.view(.7,.55,12);
  return {platform};
 });
 await page.waitForTimeout(1200);
 const bridgeState=await page.evaluate(async()=>{const {holder}=await import('/src/game/stage.ts');return {foot:holder.position.y,water:window.brumaluz.city().waterAt?.(holder.position.x,holder.position.z)};});
 assert.ok(Math.abs(bridgeState.foot-bridge.platform)<.1,'The player stays on the bridge deck');assert.equal(bridgeState.water,null,'The bridge deck is dry');
 await page.screenshot({path:'art/pompelin-review/pompelin-puente-gameplay.png'});
 await page.evaluate(()=>{const gate=window.brumaluz.city().portals.find(p=>p.id==='entrada_brumaluz_este');window.brumaluz.move(gate.position.x,gate.position.z);});
 await page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz',null,{timeout:90000});
 await page.waitForFunction(()=>window.__pompelinPlay.portalsArmed&&!window.__pompelinPlay.mapTravelling);
 await page.evaluate(()=>{const gate=window.brumaluz.city().portals.find(p=>p.id==='salida_este');window.brumaluz.move(gate.position.x,gate.position.z);});
 await page.waitForFunction(()=>window.brumaluz.city().locationId==='pompelin',null,{timeout:90000});
 await page.waitForFunction(()=>!window.__pompelinPlay.mapTravelling);
 await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.brumaluz.city().locationId),'pompelin');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({gates,bridge:{...bridge,...bridgeState},errors,realGameCamera:true,proximityRoundtrip:true}));
}catch(error){
 const state=await page?.evaluate(async()=>{const {play,session,fight}=await import('/src/game/state.ts'),{publishedMaps}=await import('/src/world/mapCity.ts');return {map:play.city.locationId,dead:play.dead,travelling:play.mapTravelling,armed:play.portalsArmed,combat:fight.combatEncounter,introSeen:session.state.introSeen,maps:Object.keys(publishedMaps()),notices:document.querySelector('#toast')?.textContent};}).catch(()=>null);
 console.error('Gameplay diagnostic',JSON.stringify({state,errors}));throw error;
}finally{await browser?.close();await server.close();}
