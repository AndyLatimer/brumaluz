import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const out='art/resources-review';await mkdir(out,{recursive:true});
const server=await createServer({optimizeDeps:{noDiscovery:true,entries:[]},server:{host:'127.0.0.1',port:4247,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser;const errors=[];
try{
 await server.listen();browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
 const page=await browser.newPage({viewport:{width:1100,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.route(/https:\/\/[^/]+\.supabase\.co\//,r=>r.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.route('http://127.0.0.1:4247/__resource-icons',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>svg.item-art{width:100%;height:100%}body{margin:0}</style><body></body>'}));
 await page.goto('http://127.0.0.1:4247/__resource-icons');
 const count=await page.evaluate(async()=>{
  const {ITEMS,itemIcon}=await import('/src/data/items.ts'),{resourceFamily}=await import('/src/data/resourceAppearance.ts');
  const items=Object.values(ITEMS).filter(i=>resourceFamily(i.id));window.__resourceIconItems=items;
  const gallery=document.createElement('div');gallery.id='resource-icon-review';
  gallery.style.cssText='position:fixed;inset:0;z-index:999999;background:#201c19;color:#ecd8ae;padding:25px;overflow:auto;font:14px Georgia';
  gallery.innerHTML='<h1 style="margin:0 0 16px">Recursos de Brumaluz</h1><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">'+items.map(i=>`<div style="display:flex;gap:9px;align-items:center;padding:5px;background:#322a22;border:1px solid #695438;border-radius:7px"><span style="width:56px;height:56px;flex-shrink:0">${itemIcon(i.id)}</span><span>${i.label}</span></div>`).join('')+'</div>';
  document.body.append(gallery);return items.length;
 });
 assert.equal(count,48);
 assert.equal(await page.locator('#resource-icon-review svg').count(),48);
 assert.equal(await page.locator('#resource-icon-review image').count(),48);
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('#resource-icon-review image')].map(node=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=node.getAttribute('href');})));});
 const unique=await page.evaluate(()=>{const ids=[...document.querySelectorAll('#resource-icon-review [id]')].map(e=>e.id);return ids.length===new Set(ids).size;});assert.equal(unique,true);
 await page.screenshot({path:`${out}/inventory-resource-icons.png`});
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const grid=document.querySelector('#resource-icon-review>div');grid.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';});
 await page.screenshot({path:out+'/resource-icons-mobile.png'});
 await page.setViewportSize({width:1100,height:650});
 await page.evaluate(async()=>{
  const {equipmentSlotPainting,gatheringToolPainting}=await import('/src/art/inventoryPaintings.ts');
  const labels={head:'Cabeza',pendant:'Colgante',chest:'Torso',hands:'Manos',ring:'Anillo',weapon:'Arma',offhand:'Mano izquierda',legs:'Piernas',trinket:'Abalorio'};
  document.getElementById('resource-icon-review').innerHTML='<h1>Equipo y herramientas</h1><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:20px">'+[...Object.entries(labels).map(([slot,label])=>[equipmentSlotPainting(slot),label]),...['pickaxe','axe','sickle'].map(k=>[gatheringToolPainting(k),k])].map(([art,label])=>`<div style="text-align:center;padding:12px;background:#382f26;border:1px solid #947448;border-radius:10px"><svg viewBox="0 0 24 24" style="width:112px;height:112px">${art}</svg><p>${label}</p></div>`).join('')+'</div>';
 });
 await page.screenshot({path:out+'/equipment-slot-icons.png'});
 await page.setViewportSize({width:1100,height:900});
 await page.goto('http://127.0.0.1:4247/?test&graphics=compatible');await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
 await page.evaluate(async()=>{
  window.brumaluz.set({introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned'});window.brumaluz.play();
  const {ITEMS}=await import('/src/data/items.ts'),{resourceFamily}=await import('/src/data/resourceAppearance.ts'),{session}=await import('/src/game/state.ts');
  const items=Object.values(ITEMS).filter(i=>resourceFamily(i.id));session.state.inventory=Array.from({length:25},(_,i)=>({id:items[(i*7)%48].id,count:i+3}));
  (await import('/src/ui/menus.ts')).setWindow('inventory');
 });
 await page.waitForTimeout(400);await page.screenshot({path:out+'/inventory-resources-desktop.png'});
 assert.deepEqual(errors,[]);await writeFile(`${out}/resource-icons-review.json`,JSON.stringify({resources:count,uniqueGradientIds:unique,errors,localFixtures:true},null,2));
 console.log(JSON.stringify({resources:count,uniqueGradientIds:unique,errors}));
}finally{await browser?.close();await server.close();}
