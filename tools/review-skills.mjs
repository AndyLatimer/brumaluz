import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const directory='art/skills-review';
await mkdir(directory,{recursive:true});
const definitions=[];
for(const [file,name] of [['03-formulas.sql','game_skill_rank'],['04-character-actions.sql','upgrade_skill']]) {
  const source=await readFile(`supabase/server/${file}`,'utf8');
  const start=source.indexOf(`create or replace function public.${name}(`);
  const end=source.indexOf('$$;',source.indexOf('as $$',start));
  assert.ok(start>=0&&end>start,name);definitions.push(source.slice(start,end+3));
}
await writeFile(`${directory}/server-patch.sql`,[
  '-- Skill progression only. Preserves existing ownership checks, grants and player data.',
  'begin;',"set local lock_timeout='2s';","set local statement_timeout='15s';",
  ...definitions,"notify pgrst, 'reload schema';",'commit;','',
].join('\n\n'));
const server=await createServer({cacheDir:'node_modules/.vite-skills-review',server:{host:'127.0.0.1',port:4198,strictPort:true,hmr:false,watch:null}});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:940},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],checks=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');localStorage.setItem('brumaluz-language','es');
  });
  async function open(cls,level,rank=1) {
    await page.goto('http://127.0.0.1:4198/?test&graphics=compatible');
    await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:60000});
    await page.evaluate(({cls,level,rank})=>{
      const ids={guerrero:'heavy_strike',mago:'arcane_discharge',picaro:'double_slash',clerigo:'healing',explorador:'precise_shot'};
      const weapons={guerrero:'espada_inicial',mago:'baston_inicial',picaro:'daga_inicial',clerigo:'varita_inicial',explorador:'ballesta_inicial'};
      window.brumaluz.set({cls,level,experience:36,skillRanks:{[ids[cls]]:rank},equipment:{weapon:{id:weapons[cls],count:1,bound:true}}});
      window.brumaluz.play();
    },{cls,level,rank});
    await page.keyboard.press('KeyK');await page.locator('.skills-book').waitFor();
    await page.mouse.move(5,5);
  }
  await open('guerrero',3,2);
  assert.equal(await page.locator('.skill-points strong').textContent(),'1');
  assert.equal(await page.locator('.skill-upgrade').isEnabled(),true);
  assert.match(await page.locator('.skills-progress').textContent(),/nivel 4/);
  assert.equal(await page.locator('.skills-xp').evaluate(el=>el.value),36);
  await page.screenshot({path:`${directory}/skills-desktop.png`});
  await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
  assert.match(await page.locator('.skill-confirmation').textContent(),/permanente/);
  await page.screenshot({path:`${directory}/skills-confirmation.png`});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await page.locator('.skill-points strong').textContent(),'1');
  await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.skill-rank-label').textContent.includes('Rango 3'));
  assert.equal(await page.locator('.skill-points strong').textContent(),'0');
  assert.equal(await page.locator('.skill-upgrade').isDisabled(),true);
  assert.match(await page.locator('.skill-status').textContent(),/Mejora aprendida/);
  checks.push('Level 3 upgrade, cancellation, point spending, success feedback and locked next rank.');
  await page.screenshot({path:`${directory}/skills-upgraded.png`});
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    await page.locator('.skill-upgrade').scrollIntoViewIfNeeded();
    const fits=await page.locator('.skills-book').evaluate(el=>el.scrollWidth<=el.clientWidth);
    assert.equal(fits,true,`Skillbook fits ${width}px`);
    await page.screenshot({path:`${directory}/skills-${width}.png`});
    const bounds=await page.locator('.game-window').evaluate(el=>{
      const r=el.getBoundingClientRect(),bar=document.querySelector('#action-bar').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,barTop:bar.top,width:innerWidth};
    });
    assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.barTop,JSON.stringify(bounds));
    checks.push(`Fits ${width}px with quickbar accessible.`);
  }
  await page.setViewportSize({width:1280,height:940});
  for(const cls of ['mago','picaro','clerigo','explorador']) {
    await open(cls,3,2);
    const values=await page.locator('.skill-comparison strong').allTextContents();
    assert.ok(Number(values[1])>Number(values[0]),`${cls}: next rank is stronger`);
    assert.equal(await page.locator('.skill-gain').textContent().then(text=>/Infinity|NaN/.test(text)),false);
    if(cls==='clerigo') {
      assert.equal(await page.locator('.skill-comparison-label').textContent(),'Curación total');
      await page.screenshot({path:`${directory}/skills-healing.png`});
    }
  }
  checks.push('Numerical damage/healing comparison for all five classes.');
  await open('guerrero',5,5);
  assert.equal(await page.locator('.skill-rank-track .learned').count(),5);
  assert.equal(await page.locator('.skill-upgrade').isDisabled(),true);
  await page.screenshot({path:`${directory}/skills-mastery.png`});
  await page.locator('[data-language="en"]').first().dispatchEvent('click');
  assert.match(await page.locator('.skill-availability').textContent(),/Mastery achieved/);
  assert.match(await page.locator('.skills-progress').textContent(),/Next point: level 6/);
  await open('guerrero',1);
  assert.equal(await page.locator('.skill-upgrade').isDisabled(),true);
  assert.equal(await page.locator('.skill-points strong').textContent(),'0');
  checks.push('Maximum rank at level 5, English translation, free rank and no points at level 1.');
  assert.deepEqual(errors,[]);
  await writeFile(`${directory}/review.json`,JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors}));
} finally { await browser?.close();await server.close(); }
