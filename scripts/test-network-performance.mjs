import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {backend,fixture,leave} from './world/harness.mjs';
import {openPlayer} from './world/mockBackend.mjs';

test('quest acceptance remains usable under latency and temporary failures without duplicated writes',{timeout:120000},async()=>{
 const world=backend(),a=fixture('Alric','humano',156.5);
 Object.assign(a.character.data,{introSeen:true,position:{x:156.5,z:0,yaw:0},welcome:{origin:0,stage:'available'}});
 const player=await openPlayer(world,a),{page}=player;let accepts=0;
 page.on('request',request=>{if(request.url().endsWith('/rpc/welcome_action')&&request.postDataJSON()?.p_action==='accept')accepts++;});
 try{
  await player.enter();
  await page.evaluate(()=>{const p=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal').position;window.brumaluz.move(p.x,p.z+1.7);});
  await page.waitForFunction(()=>document.querySelector('#interact-prompt').textContent.includes('Hablar con Gnomi'));
  await page.keyboard.press('KeyE');
  const accept=page.getByRole('button',{name:'Aceptar misión',exact:true});
  await accept.waitFor();
  world.rpcDelay.set('welcome_action',600);world.fail.add('welcome');
  await accept.click();
  await page.waitForFunction(()=>document.querySelector('#dialog').hidden||document.querySelector('#dialog').getAttribute('aria-busy')!=='true');
  assert.equal(a.character.data.welcome.stage,'available');assert.equal(await accept.isEnabled(),true);
  world.fail.delete('welcome');
  const began=performance.now();await accept.click();
  assert.equal(await page.locator('#dialog').getAttribute('aria-busy'),'true');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>document.querySelector('#dialog').hidden||document.querySelector('#dialog').getAttribute('aria-busy')!=='true');
  assert.equal(a.character.data.welcome.stage,'active');
  const acceptanceMs=performance.now()-began;
  assert.equal(accepts,2,'One failed attempt and one successful attempt; repeated E while pending sends no extra mutation');
  assert.equal(world.maximum.get(a.user.id),1);
  const diagnostics=await page.evaluate(()=>window.brumaluz.connection());
  assert.equal(diagnostics.failedRequests,0);assert.deepEqual(player.errors,[]);
  await mkdir('art/performance-review',{recursive:true});
  await page.screenshot({path:'art/performance-review/quest-accepted.png'});
  await writeFile('art/performance-review/browser.json',JSON.stringify({acceptanceMs,injectedLatencyMs:600,acceptRequests:accepts,diagnostics,errors:player.errors},null,2)+'\n');
  await leave(page);
 }finally{await player.context.close();}
});
