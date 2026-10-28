import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {backend,fixture,leave} from './harness.mjs';
import {openPlayer} from './mockBackend.mjs';

test('first fairy dust starts a persistent Gnomi quest and stops at the Arboleda lead', {timeout:120000},async()=>{
  const world=backend(),account=fixture('Polvorilla','humano',-2.4);
  Object.assign(account.character.data,{position:{x:-2.4,z:1.8,yaw:0},inventory:Array(25).fill(null),coinBags:[],fairyDust:[],wallet:{pelines:0}});
  const player=await openPlayer(world,account),page=player.page;
  const count=()=>account.character.data.inventory.reduce((n,item)=>n+(item?.id==='polvo_de_hada'?item.count:0),0);
  const reconnect=async(position)=>{await leave(page);if(position)account.character.data.position=position;await page.reload();await page.waitForFunction(()=>window.brumaluz);await player.enter();};
  const question='He encontrado este polvo. ¿Sabes qué es?';
  try{
    await player.enter();
    await page.locator('#interact-label').filter({hasText:'Recoger polvos de hada'}).waitFor();
    assert.equal(account.character.data.fairyDustQuest,undefined);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>document.querySelector('#quest-tracker strong')?.textContent==='Un polvo misterioso');
    assert.equal(account.character.data.fairyDustQuest,'ask_gnomi');assert.equal(count(),3);
    await page.keyboard.press('KeyJ');
    const entry=page.locator('[data-quest="fairy-dust"]');await entry.waitFor();
    assert.match(await entry.textContent(),/Pregunta a Gnomi/);
    await mkdir('art/collectibles-review',{recursive:true});
    await page.screenshot({path:'art/collectibles-review/dust-quest-desktop.png'});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
    assert.equal(await entry.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true);
    await page.screenshot({path:'art/collectibles-review/dust-quest-mobile.png'});
    await page.setViewportSize({width:1280,height:800});await page.keyboard.press('Escape');
    await reconnect({x:153.5,z:0,yaw:0});assert.equal(account.character.data.fairyDustQuest,'ask_gnomi');
    await page.locator('#interact-label').filter({hasText:'Hablar con Gnomi'}).waitFor();
    await page.keyboard.press('KeyE');await page.getByRole('button',{name:question,exact:true}).waitFor();
    world.fail.add('dustquest');await page.getByRole('button',{name:question,exact:true}).click();
    await page.waitForFunction(question=>[...document.querySelectorAll('#dialog button')].some(b=>b.textContent.includes(question)&&!b.disabled),question);
    assert.equal(account.character.data.fairyDustQuest,'ask_gnomi');
    assert.doesNotMatch(await page.locator('.dialog-text').textContent(),/La Arboleda/);
    world.fail.delete('dustquest');
    await page.getByRole('button',{name:question,exact:true}).click();
    await page.locator('.dialog-text').filter({hasText:'Yo preguntaría en La Arboleda'}).waitFor();
    assert.equal(account.character.data.fairyDustQuest,'arboleda');assert.equal(count(),3);
    assert.equal(account.character.data.wallet.pelines,0);
    await page.screenshot({path:'art/collectibles-review/gnomi-dust-dialog.png'});
    await page.getByRole('button',{name:'Gracias, Gnomi.',exact:true}).click();
    await page.keyboard.press('KeyJ');await entry.waitFor();
    assert.match(await entry.textContent(),/La Arboleda.*próxima etapa/s);
    assert.equal(await page.locator('#quest-objective-marker').isVisible(),false);
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.match(await entry.textContent(),/A mysterious dust.*future chapter/s);
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.keyboard.press('Escape');
    await reconnect({x:7.2,z:-6.5,yaw:0});
    await page.locator('#interact-label').filter({hasText:'Recoger polvos de hada'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>!window.brumaluz.city().root.parent.getObjectByName('fairy-dust:arco_entrada').visible);
    assert.equal(account.character.data.fairyDustQuest,'arboleda');assert.equal(count(),6);
    await reconnect();assert.equal(account.character.data.fairyDustQuest,'arboleda');
    await page.keyboard.press('KeyJ');await entry.waitFor();assert.match(await entry.textContent(),/Continuará/);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('the dust question preserves Gnomi welcome turn-in choices', {timeout:60000},async()=>{
  const world=backend(),account=fixture('DosRecados','humano',153.5);
  Object.assign(account.character.data,{position:{x:153.5,z:0,yaw:0},welcome:{origin:0,stage:'found'},fairyDust:['plaza_fuente'],fairyDustQuest:'ask_gnomi'});
  const player=await openPlayer(world,account),page=player.page;
  try{
    await player.enter();await page.locator('#interact-label').filter({hasText:'Hablar con Gnomi'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Quería hablar de otra cosa.',exact:true}).click();
    await page.getByRole('button',{name:'Completar misión',exact:true}).waitFor();
    assert.equal(account.character.data.welcome.stage,'found');
    assert.equal(account.character.data.fairyDustQuest,'ask_gnomi');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});
