import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {backend,fixture,leave} from './harness.mjs';
import {openPlayer} from './mockBackend.mjs';

test('both collectible types appear, collect independently and persist with combined progress', {timeout:120000}, async()=>{
  const world=backend(),account=fixture('Coleccionista','humano',-2.4);
  Object.assign(account.character.data,{position:{x:-2.4,z:1.8,yaw:0},inventory:Array(25).fill(null),coinBags:[],fairyDust:[],wallet:{pelines:0}});
  const player=await openPlayer(world,account),page=player.page;
  const dustCount=()=>account.character.data.inventory.reduce((n,item)=>n+(item?.id==='polvo_de_hada'?item.count:0),0);
  const collections=async()=>{
    await page.locator('#world-menu-toggle').click();
    await page.locator('#world-menu-collections').click();
  };
  try{
    await player.enter();
    await page.waitForFunction(()=>{
      const scene=window.brumaluz.city().root.parent;
      return ['fairy-dust:plaza_fuente','fairy-dust:arco_entrada','coin-bag:plaza_pozo','coin-bag:testiculos_debugger'].every(name=>{
        const root=scene.getObjectByName(name);return root?.visible&&root.children.length>1;
      });
    });
    await collections();
    assert.match(await page.locator('.collections-hero-progress').textContent(),/0%/);
    await page.locator('.collections-realm-tile').first().click();
    assert.equal(await page.locator('.collection-subzone').count(),2,'Each area has a single shared section');
    await page.locator('.collection-subzone-summary').first().click();
    const categories=page.locator('.collection-subzone').first().locator('.collection-category');
    assert.match(await categories.nth(0).textContent(),/Bolsas de pelines.*0\/2/);
    assert.match(await categories.nth(1).textContent(),/Polvos de hada.*0\/2/);
    await mkdir('art/collectibles-review',{recursive:true});
    await page.screenshot({path:'art/collectibles-review/collections-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(300);
    await page.screenshot({path:'art/collectibles-review/collections-mobile.png'});
    assert.equal(await categories.evaluateAll(rows=>rows.every(row=>{
      const rect=row.getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth;
    })),true,'Both categories and their counters fit the mobile viewport');
    await page.setViewportSize({width:1280,height:800});
    await page.keyboard.press('Escape');
    await page.locator('#interact-label').filter({hasText:'Recoger polvos de hada'}).waitFor();
    await page.evaluate(()=>window.brumaluz.view(Math.PI*.8,1.15,7));
    await page.waitForTimeout(400);
    await page.screenshot({path:'art/collectibles-review/fairy-dust-game.png'});
    world.fail.add('fairydust');
    await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Acércate'));
    assert.equal(dustCount(),0);
    assert.deepEqual(account.character.data.fairyDust,[]);
    world.fail.delete('fairydust');
    await page.keyboard.press('KeyE');
    await page.locator('.chat-log').getByText('Has encontrado 3 Polvo de hada.',{exact:true}).waitFor({state:'attached'});
    assert.equal(dustCount(),3,'The displayed reward matches the server inventory');
    assert.deepEqual(account.character.data.fairyDust,['plaza_fuente']);
    await page.waitForFunction(()=>!window.brumaluz.city().root.parent.getObjectByName('fairy-dust:plaza_fuente').visible);
    await page.evaluate(()=>window.brumaluz.move(5,-4.4));
    await page.locator('#interact-label').filter({hasText:'Recoger bolsa de pelines'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.chat-log').getByText('Has encontrado 17 pelines.',{exact:true}).waitFor({state:'attached'});
    assert.deepEqual(account.character.data.coinBags,['plaza_pozo']);
    assert.equal(dustCount(),3);
    await collections();
    assert.match(await page.locator('.collections-hero-progress').textContent(),/50%/);
    assert.match(await page.locator('.collections-realm-tile').first().getAttribute('aria-label'),/2 de 4/);
    await page.keyboard.press('Escape');
    await leave(page);await page.reload();await page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await page.waitForTimeout(500);
    const visible=await page.evaluate(()=>{
      const scene=window.brumaluz.city().root.parent;
      return ['fairy-dust:plaza_fuente','fairy-dust:arco_entrada','coin-bag:plaza_pozo','coin-bag:testiculos_debugger'].map(id=>scene.getObjectByName(id).visible);
    });
    assert.deepEqual(visible,[false,true,false,true]);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});
