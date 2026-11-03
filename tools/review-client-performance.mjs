// Production startup/network/heap measurements. No account or server mutations.
import {preview} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const label=process.env.PERFORMANCE_LABEL??(process.argv.includes('--baseline')?'baseline':'optimized');
const folder=resolve(process.env.PERFORMANCE_DIST??'dist');
const server=await preview({configFile:false,build:{outDir:folder},preview:{host:'127.0.0.1',port:4281,strictPort:true}});
let browser;const errors=[];
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.addInitScript(()=>{localStorage.setItem('brumaluz-menu-music','off');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-language','es');});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');
 let transferredBytes=0;const requests=[];
 cdp.on('Network.loadingFinished',event=>transferredBytes+=event.encodedDataLength);
 page.on('request',request=>{if(!request.url().startsWith('data:'))requests.push({type:request.resourceType(),path:new URL(request.url()).pathname});});
 const began=performance.now();
 await page.goto('http://127.0.0.1:4281/?test&welcome&graphics=compatible',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:180000});
 const readyMs=performance.now()-began;
 const metrics=await page.evaluate(()=>{
  const {renderer}=window.brumaluz.debug();
  return {heapBytes:performance.memory?.usedJSHeapSize??null,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
   documents:performance.getEntriesByType('navigation').map(e=>({transferBytes:e.transferSize,decodedBytes:e.decodedBodySize})),
   resources:performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin)).map(e=>({path:new URL(e.name).pathname,bytes:e.encodedBodySize}))};
 });
 const report={label,scope:'Fresh Chromium context on localhost, production build, compatible mode; software-rendered startup, not a hardware FPS benchmark',htmlBytes:(await stat(resolve(folder,'index.html'))).size,readyMs,transferredBytes,requests:requests.length,glbRequests:requests.filter(r=>r.path.endsWith('.glb')).length,...metrics,errors};
 await mkdir('art/performance-review/client',{recursive:true});
 await writeFile(`art/performance-review/client/${label}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,resources:report.resources.length,documents:undefined},null,2));
 if(errors.length)process.exitCode=1;
}finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
