import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {backend,fixture,remote,leave} from './world/harness.mjs';
import {openPlayer} from './world/mockBackend.mjs';
const outfits=JSON.parse(readFileSync(new URL('../src/data/outfits.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../dist/.vite/manifest.json',import.meta.url),'utf8'));

test('equipment loads on demand, metadata keeps remote meshes, and late model loads cannot recreate departed players',{timeout:180000},async()=>{
 const world=backend(),a=fixture('Alric','humano',-6.4),b=fixture('Elara','elfo',-5.4);
 const first=await openPlayer(world,a),second=await openPlayer(world,b);
 const advanced=outfits.find(o=>o.cls==='guerrero'&&o.tier===3),late=outfits.find(o=>o.cls==='guerrero'&&o.tier===4);
 const requests=[];first.page.on('request',request=>{if(request.url().endsWith('.glb'))requests.push(request.url());});
 const id=b.character.id;
 const remoteUuid=()=>first.page.evaluate(id=>window.brumaluz.players().find(p=>p.id===id)?.root.uuid,id);
 let release;
 try{
  await first.enter();await second.enter();await remote(first.page,id);
  const palettes=await first.page.evaluate(()=>{
    for(let i=0;i<40;i++)window.brumaluz.set({clothA:i%17,clothB:Math.floor(i/17)%17,hairColor:i%18});
    return window.brumaluz.debug().recolorCache;
  });
  assert.ok(palettes.active>0);assert.ok(palettes.unused<=32,'Repeated real character rebuilds keep the released palette cache bounded');
  assert.ok(!(await first.page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name))).some(url=>url.includes(advanced.id)),'An unused advanced collection is absent from startup');
  assert.ok(!(await first.page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name))).some(url=>/pompelin-[^/]+\.js/.test(url)),'The continent map stays deferred while playing in town');
  const house=manifest['src/data/world/maps/casa_de_isberto_interior.ts'];
  const destination=await first.page.evaluate(async path=>{const module=await import(path);return {id:module.map.id,assets:Object.keys(module.assets).length};},'/'+house.file);
  assert.equal(destination.id,'casa_de_isberto_interior');assert.ok(destination.assets>0,'An unvisited destination chunk can be loaded on demand');
  const original=await remoteUuid();
  b.character.data.level=2;b.character.data.title='none';
  await first.page.waitForFunction(id=>window.brumaluz.players().find(p=>p.id===id)?.level===2,id);
  assert.equal(await remoteUuid(),original,'Level/title updates preserve the mesh and animation');
  assert.equal(await first.page.locator(`[data-player-id="${id}"] > span`).isVisible(),false);
  b.character.data.equipment={chest:{id:advanced.id,count:1}};
  await first.page.waitForFunction(({id,original})=>window.brumaluz.players().find(p=>p.id===id)?.root.uuid!==original,{id,original});
  assert.equal(requests.filter(url=>url.includes(advanced.id)).length,1,'Concurrent snapshots share a single equipment request');
  await mkdir('art/performance-review/client',{recursive:true});
  await first.page.screenshot({path:'art/performance-review/client/equipment-in-game.png'});
  await writeFile('art/performance-review/client/bugs.json',JSON.stringify({palettes,remoteMetadataPreservesModel:true,equipmentRequests:1,errors:[...first.errors,...second.errors]},null,2)+'\n');
  let began;const started=new Promise(resolve=>began=resolve),blocked=new Promise(resolve=>release=resolve);
  await first.page.route('**/*.glb',async route=>{if(route.request().url().includes(late.id)){began();await blocked;}await route.continue();});
  b.character.data.equipment={chest:{id:late.id,count:1}};
  let timer;
  try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Lazy model request did not start')),15000);})]);}finally{clearTimeout(timer);}
  await leave(first.page);release();
  await first.page.waitForTimeout(1200);
  assert.equal(await first.page.evaluate(()=>window.brumaluz.players().length),0);
  assert.equal(await first.page.locator('.nameplate.player').count(),0);
  assert.deepEqual([...first.errors,...second.errors],[]);
 }finally{release?.();await first.context.close();await second.context.close();}
});
