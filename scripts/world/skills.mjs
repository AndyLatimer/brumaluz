// Pruebas del mundo en el navegador: Libro de habilidades y su progresión.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { url, browser, fixture, backend, leave } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('skillbook lists each class starter skill, supports responsive quickbar drag, persistence and self-healing', {timeout:120000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    for(const [cls,id,label] of [
      ['guerrero','heavy_strike','Golpe contundente'],['mago','arcane_discharge','Descarga arcana'],
      ['picaro','double_slash','Corte doble'],['clerigo','healing','Curación'],
      ['explorador','precise_shot','Disparo preciso'],
    ]) {
      await page.goto(`${url}/?test&graphics=compatible`);
      await page.waitForFunction(()=>!!window.brumaluz);
      await page.evaluate(({cls,weapon})=>{
        localStorage.removeItem('brumaluz-actionbar:test');
        window.brumaluz.set({cls,health:cls==='clerigo'?1:60,resource:50,equipment:{weapon:{id:weapon,count:1,bound:true}}});
        window.brumaluz.play();
      },{cls,weapon:({guerrero:'espada_inicial',mago:'baston_inicial',picaro:'daga_inicial',clerigo:'varita_inicial',explorador:'ballesta_inicial'})[cls]});
      await page.keyboard.press('KeyK');
      await page.locator('.skills-book').waitFor();
      assert.equal(await page.locator('.skill-card').count(),1);
      assert.equal(await page.locator('.skill-card h4').textContent(),label);
      await page.locator('[data-language="en"]').first().dispatchEvent('click');
      assert.match(await page.locator('.skill-card p').textContent(),/Rank 1/);
      assert.match(await page.locator('.skill-stats').textContent(),/Cost.*Cooldown/);
      await page.locator('[data-language="es"]').first().dispatchEvent('click');
      await page.locator('.skill-hero-art').hover();
      await page.locator('#game-tooltip.skill-tooltip').waitFor({state:'visible'});
      assert.match(await page.locator('#game-tooltip').textContent(),/Rango 1.*Coste.*Recarga.*Siguiente rango/s);
      assert.equal(await page.locator(`#game-tooltip [data-icon-skill="${id}"]`).count(),1);
      for(const width of [320,390,1280]) {
        await page.setViewportSize({width,height:844});
        assert.ok(await page.locator('.skills-book').evaluate(el=>el.scrollWidth<=el.clientWidth),'Skillbook fits narrow viewports');
        assert.ok(await page.locator('.game-window').evaluate(el=>{
          const r=el.getBoundingClientRect(),bar=document.querySelector('#action-bar').getBoundingClientRect();
          return r.left>=0&&r.right<=innerWidth&&r.bottom<bar.top&&bar.left>=0&&bar.right<=innerWidth;
        }),'The window stays within the viewport and above the quickbar');
      }
      const card=page.locator('.skill-card');
      await card.dragTo(page.locator('.ab-slot').nth(4));
      assert.equal(await page.locator('.ab-slot').nth(4).getAttribute('data-skill-id'),id);
      await page.keyboard.press('Escape');
      await page.locator(`.ab-slot[data-skill-id="${id}"]`).focus();
      await page.locator('#game-tooltip.skill-tooltip').waitFor({state:'visible'});
      assert.match(await page.locator('#game-tooltip').textContent(),/Rango 1/);
      await page.locator(`.ab-slot[data-skill-id="${id}"]`).blur();
      if(cls==='clerigo') {
        const healthBefore=await page.locator('#hud-health-text').textContent().then(text=>Number(text.split('/')[0]));
        const resourceBeforeCast=await page.locator('#hud-resource-text').textContent().then(text=>Number(text.split('/')[0]));
        await page.keyboard.press('Digit5');
        await page.waitForFunction(before=>Number(document.querySelector('#hud-resource-text').textContent.split('/')[0])<before,resourceBeforeCast);
        await page.waitForFunction(before=>Number(document.querySelector('#hud-health-text').textContent.split('/')[0])>before,healthBefore);
        await page.waitForFunction(id=>Number(document.querySelector(`.ab-slot[data-skill-id="${id}"] .ab-cooldown-time`).textContent)>0,id);
        assert.ok(Number(await page.locator(`.ab-slot[data-skill-id="${id}"] .ab-cooldown-time`).textContent())>0,'Skill cooldown is shown on quickbar');
        const resourceBefore=await page.locator('#hud-resource-text').textContent().then(text=>Number(text.split('/')[0]));
        await page.keyboard.press('Digit5');
        const resourceAfter=await page.locator('#hud-resource-text').textContent().then(text=>Number(text.split('/')[0]));
        assert.ok(resourceAfter>=resourceBefore,'Cooldown prevents spending resource twice while regeneration continues');
      } else {
        await page.keyboard.press('Digit5');
        assert.equal(await page.locator(`.ab-slot[data-skill-id="${id}"]`).evaluate(el=>el.classList.contains('on-cooldown')),false,'An offensive skill without a target does not start a cooldown');
      }
      await page.locator(`.ab-slot[data-skill-id="${id}"]`).click({button:'right'});
      await page.keyboard.press('KeyK');
      await page.getByRole('button',{name:'Añadir a la barra rápida'}).click();
      await page.locator('.skill-status').filter({hasText:'Habilidad disponible'}).waitFor();
      const layout=await page.evaluate(()=>JSON.parse(localStorage.getItem('brumaluz-actionbar:test')));
      assert.equal(layout.flat().filter(value=>value===`skill:${id}`).length,1,'Known skill is assigned without duplicates');
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
});

test('skillbook previews permanent rank upgrades, spends once, keeps points and scales basic attacks by level', {timeout:120000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:940}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    for(const cls of ['guerrero','mago','picaro','clerigo','explorador']){
      await page.goto(`${url}/?test&graphics=compatible`);
      await page.waitForFunction(()=>!!window.brumaluz);
      await page.evaluate(cls=>{
        const weapons={guerrero:'espada_inicial',mago:'baston_inicial',picaro:'daga_inicial',clerigo:'varita_inicial',explorador:'ballesta_inicial'};
        window.brumaluz.set({cls,level:5,health:1,resource:80,equipment:{weapon:{id:weapons[cls],count:1,bound:true}}});window.brumaluz.play();
      },cls);
      await page.keyboard.press('KeyK');
      assert.equal(await page.locator('.skill-points strong').textContent(),'4');
      assert.match(await page.locator('.skills-progress').textContent(),/nivel 6/);
      await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
      assert.match(await page.locator('.skill-confirmation').textContent(),/permanente/);
      await page.locator('.skill-confirmation').getByRole('button',{name:'Cancelar',exact:true}).click();
      assert.equal(await page.locator('.skill-points strong').textContent(),'4');
      for(let rank=2;rank<=5;rank++){
        const expected=await page.locator('.skill-next-effect').textContent();
        await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
        await page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
        await page.waitForFunction(rank=>document.querySelector('.skill-rank-label').textContent.includes(`Rango ${rank}`),rank);
        assert.equal(await page.locator('.skill-points strong').textContent(),String(5-rank));
        assert.equal(await page.locator('.skill-effect p').textContent(),expected,'The applied effect matches the preview including equipment and attributes');
      }
      assert.equal(await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).isDisabled(),true);
      assert.equal(await page.locator('.skill-rank-track .learned').count(),5);
      await page.keyboard.press('Escape');
      await page.keyboard.press('KeyK');
      assert.match(await page.locator('.skill-rank-label').textContent(),/Rango 5/);
      await page.locator('.skill-hero-art').focus();
      await page.locator('#game-tooltip.skill-tooltip').waitFor({state:'visible'});
      assert.match(await page.locator('#game-tooltip').textContent(),/Rango 5.*Rango máximo/s);
    }
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('starter skill fills a free slot without replacing items and respects manual removal after reconnect', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Alric','humano',100);
  account.character.data.inventory=[{id:'pan_duro',count:2}];
  account.character.data.equipment={weapon:{id:'espada_inicial',count:1,bound:true}};
  const player=await openPlayer(world,account);
  try {
    await player.page.evaluate(id=>{
      localStorage.setItem(`brumaluz-actionbar:${id}`,JSON.stringify([['pan_duro',null]]));
    },account.character.id);
    await player.enter();
    assert.equal(await player.page.locator('.ab-slot').nth(0).getAttribute('data-item-id'),'pan_duro');
    assert.equal(await player.page.locator('.ab-slot').nth(1).getAttribute('data-skill-id'),'heavy_strike');
    await player.page.locator('.ab-slot[data-skill-id]').click({button:'right'});
    await leave(player.page);
    await player.page.reload(); await player.page.waitForFunction(()=>!!window.brumaluz);
    await player.enter();
    assert.equal(await player.page.locator('.ab-slot[data-skill-id]').count(),0,'Removed skill stays removed on reconnect');
    assert.equal(await player.page.locator('.ab-slot').nth(0).getAttribute('data-item-id'),'pan_duro');
    await player.page.keyboard.press('KeyK');
    await player.page.getByRole('button',{name:'Añadir a la barra rápida'}).click();
    assert.equal(await player.page.locator('.ab-slot').nth(1).getAttribute('data-skill-id'),'heavy_strike');
    await player.page.keyboard.press('Escape');
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('online skill upgrades show failures, retry safely and preserve their rank after re-entry', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Alric','humano',100);
  account.character.data.level=4;
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    await player.page.keyboard.press('KeyK');
    assert.equal(await player.page.locator('.skill-points strong').textContent(),'3');
    world.fail.add('skill');
    await player.page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
    await player.page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
    await player.page.locator('.skill-status').filter({hasText:'No se ha guardado'}).waitFor();
    assert.equal(account.character.data.skillRanks,undefined);
    world.fail.delete('skill');
    world.rpcDelay.set('upgrade_skill',600);
    await player.page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
    await player.page.locator('[data-language="en"]').first().dispatchEvent('click');
    await player.page.waitForFunction(()=>document.querySelector('.skill-rank-label').textContent.includes('Rank 2'));
    await player.page.locator('[data-language="es"]').first().dispatchEvent('click');
    assert.deepEqual(account.character.data.skillRanks,{heavy_strike:2});
    assert.equal(await player.page.locator('.skill-points strong').textContent(),'2');
    await player.page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
    await player.page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
    await player.page.keyboard.press('Escape');
    await player.page.waitForFunction(()=>document.querySelector('#window-backdrop').hidden);
    await player.page.waitForTimeout(900);
    assert.deepEqual(account.character.data.skillRanks,{heavy_strike:3});
    assert.equal(await player.page.locator('#window-backdrop').isVisible(),false,'A delayed upgrade does not reopen the window');
    await leave(player.page);
    await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);
    await player.enter();await player.page.keyboard.press('KeyK');
    assert.match(await player.page.locator('.skill-rank-label').textContent(),/Rango 3/);
    assert.equal(await player.page.locator('.skill-points strong').textContent(),'1');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});
