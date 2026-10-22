// Pruebas del mundo en el navegador: Retratos, música, sonido ambiente y comercio entre jugadores.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { browser, fixture, backend, leave, nearbyInteractions } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('character cards keep portraits inside the inner frame and borders stable on hover', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await player.page.setViewportSize(viewport);
      const card = player.page.locator('.character-card').first();
      const before = await card.boundingBox();
      await card.hover();
      await player.page.waitForTimeout(250);
      assert.deepEqual(await card.boundingBox(), before, 'Hover must not lift the card into the scroll clip');
      const result = await card.evaluate((element) => {
        const card = element.getBoundingClientRect();
        const portrait = element.querySelector('.character-portrait').getBoundingClientRect();
        const info = element.querySelector('.character-info');
        const list = element.parentElement.getBoundingClientRect();
        return {
          left: portrait.left - card.left, top: portrait.top - card.top,
          bottom: card.bottom - portrait.bottom,
          clipped: card.top < list.top || card.bottom > list.bottom,
          overflow: getComputedStyle(info).overflow,
          radius: getComputedStyle(info).borderRadius,
          border: getComputedStyle(element, '::after').borderTopWidth,
        };
      });
      assert.ok(result.left >= 6 && result.top >= 6 && result.bottom >= 6, JSON.stringify(result));
      assert.equal(result.clipped, false);
      assert.equal(result.overflow, 'hidden');
      assert.equal(result.radius, '9px');
      assert.equal(result.border, '1px');
    }
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('menu music produces sound, persists its toggle and stops outside account screens', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  const page = player.page;
  const sample = () => page.evaluate(async () => {
    const context = window.__audioContexts[0];
    const analyser = context.createAnalyser();
    context.testMaster.connect(analyser);
    await new Promise(resolve => setTimeout(resolve, 180));
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    context.testMaster.disconnect(analyser);
    return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
  });
  try {
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0, 'Do not autoplay before interaction');
    const music = page.locator('#menu-music');
    await music.click();
    await page.waitForTimeout(1200);
    assert.ok(await sample() > 0.0001, 'Music must produce actual audio');
    assert.equal(await music.getAttribute('aria-pressed'), 'true');
    const graphics = await page.locator('#graphics-mode').boundingBox(), button = await music.boundingBox();
    assert.ok(button.x + button.width <= graphics.x && Math.abs(button.y - graphics.y) < 2);
    await page.locator('[data-language="en"]').first().click();
    assert.equal(await music.textContent(), 'Music: on');
    await page.locator('[data-language="es"]').first().click();
    await music.click();
    assert.equal(await sample(), 0, 'Mute must produce exact silence');
    await page.evaluate(() => window.__audioContexts[0].suspend());
    await music.click();
    await music.click();
    await music.click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Rapid toggles must restore music once');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await sample(), 0, 'Hidden tabs must stop music');
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Visible tabs must restore music');
    await page.locator('#new-character').click();
    assert.equal(await sample(), 0, 'Creator must stop menu music');
    await page.locator('#account-characters').click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Returning to selection must restore music');
    await player.enter();
    assert.equal(await sample(), 0, 'World must stop menu music');
    await page.keyboard.press('KeyO');
    await page.locator('[data-tab="sound"]').click();
    await page.locator('#opt-master-volume').fill('0');
    await page.keyboard.press('Escape');
    await leave(page);
    await page.waitForTimeout(1000);
    assert.ok(await sample() < 0.0001, 'Menu music must respect master volume');
    await music.click();
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('brumaluz-settings'));
      localStorage.setItem('brumaluz-settings', JSON.stringify({ ...settings, masterVolume: 80 }));
    });
    await page.reload();
    await music.waitFor({ state: 'visible' });
    assert.equal(await music.getAttribute('aria-pressed'), 'false', 'Mute preference must survive reload');
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
    await page.locator('#sign-out').click();
    await page.locator('#auth-form').waitFor({ state: 'visible' });
    assert.equal(await music.isVisible(), true, 'Music toggle must also exist on login');
    await music.click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Login must play the same music');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('menu music follows local day/night boundaries without enabling muted music', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date(2026, 9, 18, 5, 59, 30));
  const page = player.page;
  try {
    await page.evaluate(() => {
      window.__menuNotes = [];
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        const oscillator = original.call(this);
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when) => {
          window.__menuNotes.push({ pitch: Math.round(69 + 12 * Math.log2(oscillator.frequency.value / 440)), when });
          start(when);
        };
        return oscillator;
      };
    });
    await page.locator('#new-character').click();
    await page.locator('#account-characters').click();
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('daytime')), false);
    await page.locator('#menu-music').click();
    await page.waitForFunction(() => window.__menuNotes.length >= 12);
    const night = await page.evaluate(() => window.__menuNotes.slice(0, 12).map(note => note.pitch));
    assert.deepEqual(night, [48, 55, 60, 64, 72, 60, 76, 67, 79, 72, 76, 76], 'Original night arrangement must stay unchanged');

    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(60_000);
    await page.waitForFunction(() => document.body.classList.contains('daytime') && window.__menuNotes.some(note => note.pitch === 81));
    const day = await page.evaluate(() => window.__menuNotes.slice(-22));
    assert.equal(day.length, 22, 'Day arrangement has a livelier melody, accompaniment and bass');
    assert.deepEqual(day.slice(4, 10).map(note => note.pitch), [76, 60, 79, 67, 81, 72]);
    assert.ok(Math.abs(day[6].when - day[4].when - 0.34) < 0.001, 'Day melody must have a faster pulse');
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 1, 'Changing tracks must reuse the audio context');

    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(12 * 60 * 60 * 1000);
    await page.waitForFunction(() => !document.body.classList.contains('daytime') && window.__menuNotes.length >= 12);
    assert.deepEqual(await page.evaluate(() => window.__menuNotes.slice(-12).map(note => note.pitch)), night);
    await page.locator('#menu-music').click();
    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(12 * 60 * 60 * 1000);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('daytime')), true);
    assert.equal(await page.locator('#menu-music').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => window.__menuNotes.length), 0, 'Time changes must preserve mute');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('ambient sound switch changes actual output and respects volume and repeated toggles', {timeout:120000}, async()=>{
  const world=backend(), a=fixture('Alric','humano',100), player=await openPlayer(world,a);
  try {
    await player.enter();
    await player.page.keyboard.press('KeyO');
    await player.page.locator('[data-tab="sound"]').click();
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForFunction(()=>document.querySelector('#opt-ambient').getAttribute('aria-checked')==='true');
    await player.page.waitForFunction(()=>window.__audioContexts.some(context=>context.state==='running'));
    const sample=()=>player.page.evaluate(async()=>{
      const context=window.__audioContexts[0];
      const analyser=context.createAnalyser();
      context.testMaster.connect(analyser);
      await new Promise(resolve=>setTimeout(resolve,150));
      const data=new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      context.testMaster.disconnect(analyser);
      return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);
    });
    await player.page.waitForTimeout(1800);
    const enabled=await sample();
    assert.ok(enabled>0.0001,`Enabled ambient must produce sound, got RMS ${enabled}`);
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForTimeout(150);
    const disabled=await sample();
    assert.equal(disabled,0,'Disabled ambient must be exactly silent, not merely quieter');
    assert.equal(await player.page.evaluate(()=>window.__audioContexts[0].testMaster.gain.value),0);
    await player.page.locator('#opt-master-volume').fill('100');
    assert.equal(await sample(),0,'Changing volume must not reactivate disabled ambience');
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForTimeout(1800);
    assert.ok(await sample()>0.0001);
    await player.page.evaluate(()=>window.__audioContexts[0].suspend());
    await player.page.locator('#opt-ambient').click();
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForFunction(()=>window.__audioContexts[0].state==='running');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()>0.0001,'Toggle must restore suspended browser audio');
    await player.page.locator('#opt-master-volume').fill('0');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()<0.0001,'Master volume must mute ambient output');
    await player.page.locator('#opt-master-volume').fill('80');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()>0.0001,'Master volume must restore ambient output');
    assert.equal(await player.page.locator('#opt-ambient').getAttribute('aria-checked'),'true');
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('players trade through the actual interaction menu, offer quantities privately and commit both HUD inventories', {timeout:180000},async()=>{
  const world=backend(),a=fixture('Alric','humano',100),b=fixture('Elara','elfo',101);
  a.character.data.inventory=[{id:'pan_duro',count:10},{id:'pocion_vida_minuscula',count:3,bound:true}];
  b.character.data.inventory=[{id:'pocion_mana_minuscula',count:8}];
  a.character.data.wallet={pelines:100,premium:777};b.character.data.wallet={pelines:100,premium:888};
  const first=await openPlayer(world,a),second=await openPlayer(world,b);
  try {
    await first.enter();await second.enter();
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Invitar a intercambiar',exact:true}).click();
    await second.page.getByRole('dialog',{name:'Invitación de intercambio',exact:true}).waitFor();
    await second.page.getByText('¿Quieres intercambiar objetos y pelines con Alric?',{exact:true}).waitFor();
    await second.page.getByRole('button',{name:'Rechazar',exact:true}).waitFor();
    await second.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await first.page.getByText('Tu mochila',{exact:true}).waitFor();
    assert.equal(await first.page.locator('.trade-item').count(),1);
    assert.equal(await first.page.locator('.trade-peer-offer .trade-offer-item').count(),0);
    for(let i=0;i<4;i++) await first.page.getByRole('button',{name:'Añadir: Ofrecer Pan duro (1)',exact:true}).click();
    await first.page.getByLabel('Pelines ofrecidos',{exact:true}).fill('30');
    await first.page.getByRole('button',{name:'Ofertar',exact:true}).click();
    await second.page.locator('.trade-peer-offer').getByText('Pan duro ×4',{exact:true}).waitFor();
    for(let i=0;i<3;i++) await second.page.getByRole('button',{name:'Añadir: Ofrecer Poción de maná minúscula (1)',exact:true}).click();
    await second.page.getByRole('button',{name:'Ofertar',exact:true}).click();
    await first.page.locator('.trade-peer-offer').getByText('Poción de maná minúscula ×3',{exact:true}).waitFor();
    for(const width of [1280,390,320]) {
      await first.page.setViewportSize({width,height:844});
      assert.equal(await first.page.locator('.trade-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true,`Trade fits ${width}px`);
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`trade-${width}.png`)});
    }
    await first.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await second.page.locator('.trade-peer-offer.accepted').getByText('Intercambio aceptado',{exact:true}).waitFor();
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await second.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'trade-accepted-1280.png')});
    await first.page.getByRole('button',{name:'Cancelar oferta',exact:true}).click();
    await first.page.locator('[data-own-state]').getByText('Sin oferta',{exact:true}).waitFor();
    await second.page.locator('.trade-peer-offer .trade-empty').waitFor();
    for(let i=0;i<4;i++) await first.page.getByRole('button',{name:'Añadir: Ofrecer Pan duro (1)',exact:true}).click();
    await first.page.getByLabel('Pelines ofrecidos',{exact:true}).fill('30');
    await first.page.getByRole('button',{name:'Ofertar',exact:true}).click();
    await second.page.locator('.trade-peer-offer').getByText('Pan duro ×4',{exact:true}).waitFor();
    await first.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await second.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await first.page.getByText('¡Intercambio completado!',{exact:true}).waitFor();
    await second.page.getByText('¡Intercambio completado!',{exact:true}).waitFor();
    assert.equal(a.character.data.wallet.pelines,70);assert.equal(b.character.data.wallet.pelines,130);
    assert.equal(a.character.data.wallet.premium,777);assert.equal(b.character.data.wallet.premium,888);
    await first.page.setViewportSize({width:1280,height:844});
    await first.page.getByRole('button',{name:'Cerrar',exact:true}).click();
    await first.page.keyboard.press('KeyI');
    await first.page.locator('[data-item-id="pocion_mana_minuscula"]').first().waitFor();
    await first.page.locator('#window-close').click();
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Invitar a intercambiar',exact:true}).click();
    await second.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await first.page.getByText('Tu mochila',{exact:true}).waitFor();
    await first.page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await first.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    await second.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});
