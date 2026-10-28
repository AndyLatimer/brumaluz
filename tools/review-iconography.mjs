import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({cacheDir:'node_modules/.vite-icon-review',server:{host:'127.0.0.1',port:4211,strictPort:true,hmr:false,watch:null},logLevel:'error'});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__icons',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:25px;background:#eadebf;color:#493321;font:15px Georgia}section{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(10,1fr);gap:10px}.card{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 4px;border:1px solid #a38556;border-radius:5px 13px;background:#fff8e8}.art{display:flex;gap:10px;align-items:center}.art svg{width:44px;height:44px}.small svg{width:20px;height:20px}.dark{background:#30271f;border-radius:5px;padding:4px}.dark svg{width:32px;height:32px}small{font-size:11px;word-break:break-word;text-align:center}</style><main></main>'}));
 await page.goto('http://127.0.0.1:4211/__icons');
 const report=await page.evaluate(async()=>{
  const ui=await import('/src/ui/uiIcons.ts'),social=await import('/src/ui/interfaceIcons.ts'),map=await import('/src/ui/mapIcons.ts'),skill=await import('/src/ui/skillIcons.ts'),npc=await import('/src/ui/npcBadges.ts'),items=await import('/src/data/items.ts'),currency=await import('/src/data/currency.ts');
  const families={navigation:Object.keys(ui.UI_ICON_ART).map(id=>[id,ui.uiIcon(id)]),social:social.INTERFACE_ICON_IDS.map(id=>[id,social.interfaceIcon(id)]),map:['workshop','expedition','player','npc','quest','waypoint','exit','interior'].map(id=>[id,map.mapIcon(id)]),combat:['heavy_strike','arcane_discharge','double_slash','healing','precise_shot'].map(id=>[id,skill.skillIcon(id)]),npc:['debug','merchant','resident','hostile'].map(id=>[id,npc.npcBadgeIcon(id)]),currency:currency.CURRENCY_ORDER.map(id=>[id,currency.currencyIcon(id)])};
  const candidates=Object.values(items.ITEMS).filter(item=>item.id.endsWith('_0')&&/material|componente|gema|hongo|pergamino|pocion|grano/.test(item.id));
  families.objects=[...['esencia_sombria','polvo_hada',...candidates.slice(0,32).map(i=>i.id)].filter(id=>items.itemDef(id)).map(id=>[id,items.itemIcon(id)])];
  const broken=[];let count=0;
  const all=[...Object.values(families).flat(),...Object.values(items.ITEMS).map(item=>[item.id,items.itemIcon(item.id)])];
  for(const[id,art]of all){const xml=new DOMParser().parseFromString(art,'image/svg+xml');if(xml.querySelector('parsererror'))broken.push(`${id}: invalid SVG`);const holder=document.createElement('div');holder.innerHTML=art;const svg=holder.querySelector('svg');if(!svg)broken.push(`${id}: missing SVG`);else{for(const match of art.matchAll(/url\(#([^)]+)\)/g))if(!svg.querySelector(`[id="${CSS.escape(match[1])}"]`))broken.push(`${id}: unresolved ${match[1]}`);}count++;}
  for(const[name,entries]of Object.entries(families)){
   const section=document.createElement('section');section.id=name;section.innerHTML=`<h2>${name}</h2><div class="grid">${entries.map(([id,art])=>`<div class="card"><div class="art">${art}<span class="small">${art}</span><span class="dark">${art}</span></div><small>${id}</small></div>`).join('')}</div>`;document.querySelector('main').append(section);
  }
  return {count,broken,families:Object.keys(families)};
 });
 assert.deepEqual(report.broken,[]);await mkdir('art/icon-review',{recursive:true});
 for(const family of report.families)await page.locator(`#${family}`).screenshot({path:`art/icon-review/${family}.png`});
 await page.goto('http://127.0.0.1:4211/?test&graphics=compatible');await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:60000});
 assert.equal(await page.locator('#tabs .ui-art-icon').count(),5);assert.equal(await page.locator('#player-menu-toggle [data-ui-icon="character"]').count(),1);
 assert.equal(await page.locator('svg svg').count(),0,'Icons never nest another SVG inside a former icon');
 await page.evaluate(()=>window.brumaluz.play());await page.locator('#player-menu-toggle').click();
 await page.locator('#player-menu-panel [data-window="inventory"]').click();await page.locator('.inv').waitFor();
 assert.equal(await page.locator('.inv-heading .ui-art-icon').count(),3);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({validatedIcons:report.count,svgErrors:0,gameNavigation:'passed',gallery:'art/icon-review'}));
}finally{await browser?.close();await server.close();}
