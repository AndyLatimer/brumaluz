// Browser diagnostics for a reported movement freeze; no game or account mutations.
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',error=>console.log('PAGE ERROR:',error.stack));
 page.on('console',message=>{if(message.type()==='error')console.log('CONSOLE:',message.text().slice(0,500));});
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-ambient','off');});
 await page.goto('http://127.0.0.1:4197/?test&welcome',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.brumaluz,{timeout:120000});
 console.log('READY');
 const client=await page.context().newCDPSession(page);
 await client.send('Debugger.enable');
 client.on('Debugger.paused',async event=>{
  console.log('PAUSED STACK:',JSON.stringify(event.callFrames.slice(0,18).map(frame=>({name:frame.functionName,url:frame.url,location:frame.location}))));
  const {scriptSource}=await client.send('Debugger.getScriptSource',{scriptId:event.callFrames[0].location.scriptId});
  const line=event.callFrames[0].location.lineNumber;console.log(scriptSource.split('\n').slice(Math.max(0,line-5),line+6).join('\n'));
  console.log('LOCALS:',JSON.stringify(await client.send('Runtime.getProperties',{objectId:event.callFrames[0].scopeChain[0].object.objectId,ownProperties:true}),null,2).slice(0,6000));
  const {profile}=await client.send('Profiler.stop');fs.mkdirSync('art/diagnostics',{recursive:true});fs.writeFileSync('art/diagnostics/movement.cpuprofile',JSON.stringify(profile));
  await browser.close();process.exit(0);
 });
 await client.send('Profiler.enable');await client.send('Profiler.start');
 let watchdog=setTimeout(()=>void client.send('Debugger.pause'),45000);
 await page.evaluate(()=>{
  window.brumaluz.set({introSeen:true,welcome:{origin:0,stage:'completed'}});
  window.brumaluz.play();
  const site=window.brumaluz.city().npcSites.find(site=>site.id==='testiculos');
  if(site){window.brumaluz.move(site.position.x,site.position.z+5);window.brumaluz.view(0,.55,12);window.brumaluz.spin(Math.PI);}
 });
 console.log('PLAY');
 const started=await page.evaluate(()=>window.brumaluz.char().lastT);
 clearTimeout(watchdog);watchdog=setTimeout(()=>void client.send('Debugger.pause'),25000);
 await page.mouse.move(640,360);
 await page.keyboard.down('KeyW');
 await new Promise(resolve=>setTimeout(resolve,12000));
 console.log('MOVED');
 clearTimeout(watchdog);
 const {profile}=await client.send('Profiler.stop');
 fs.mkdirSync('art/diagnostics',{recursive:true});fs.writeFileSync('art/diagnostics/movement.cpuprofile',JSON.stringify(profile));
 console.log(await page.evaluate(started=>{const character=window.brumaluz.char(),{renderer}=window.brumaluz.debug();return {position:character.root.getWorldPosition(character.root.position.clone()).toArray(),playing:document.body.classList.contains('playing'),gameLoopSeconds:character.lastT-started,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries};},started));
 await page.screenshot({path:'art/diagnostics/movement.png'});
 console.log('PROFILE SAVED');
 clearTimeout(watchdog);
}finally{await browser.close();}
