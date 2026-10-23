// Visual reference using the production item catalogue and tooltip renderer.
import fs from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:4197,strictPort:true,watch:{ignored:['**/*.zip','**/*.blend','**/.art-sources/**']}},logLevel:'error'});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1240,height:1220},deviceScaleFactor:1});
 page.on('pageerror',error=>console.error(error));
 await page.goto('http://127.0.0.1:4197/render.html');
 await page.evaluate(async()=>{
  await import('/src/styles/game/11-sheet-hud-tooltip.css');
  const {renderItemTooltip}=await import('/src/ui/itemTooltip.ts');
  document.body.replaceChildren();
  document.body.style.cssText='margin:0;padding:32px;background:#e5ddcd;color:#493e33;font-family:Georgia;box-sizing:border-box';
  const title=document.createElement('h1');title.textContent='BRUMALUZ · OBJETOS Y EQUIPO';title.style.cssText='text-align:center;font-size:26px;font-weight:normal;margin:0 0 28px';document.body.append(title);
  const grid=document.createElement('main');grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:28px;align-items:start';document.body.append(grid);
  for(const id of ['espada_inicial','baston_ambar_t2','traje_guerrero_alba_legs','traje_mago_eclipse','anillo_marea','pocion_vida_minuscula']){
   const box=document.createElement('article');box.className='game-tooltip item-tooltip visible';
   box.style.cssText='position:static;width:auto;max-width:none;max-height:none;overflow:visible;opacity:1;transform:none;pointer-events:auto';
   renderItemTooltip(box,id);grid.append(box);
  }
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await fs.mkdir('art/equipment',{recursive:true});
 await page.screenshot({path:'art/equipment/item-tooltips.png',fullPage:true});
 console.log('Rendered art/equipment/item-tooltips.png');
}finally{await browser?.close();await server.close()}
