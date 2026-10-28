// Review actual conversations with local preview characters; no live writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const out='art/dialogue-review';
await mkdir(out,{recursive:true});
const server=await createServer({cacheDir:'node_modules/.vite-dialogues',server:{host:'127.0.0.1',port:4267,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser;
const errors=[],origins=[],masters=[];
try{
  await server.listen();
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('brumaluz-language','es');
    localStorage.setItem('brumaluz-ambient','off');
    localStorage.setItem('brumaluz-menu-music','off');
  });
  await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
  await page.goto('http://127.0.0.1:4267/?test&welcome&graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:120000});
  await page.evaluate(()=>{
    window.brumaluz.set({introSeen:true,welcome:{stage:'available',origin:null},shadowQuest:null,position:{x:153.5,z:0,yaw:Math.PI/2}});
    window.brumaluz.play();
  });
  for(const race of ['humano','elfo','lagto','pelso'])for(let origin=0;origin<3;origin++){
    await page.evaluate(async({race})=>{
      (await import('/src/ui/dialog.ts')).closeDialog();
      window.brumaluz.set({race,welcome:{stage:'available',origin:null},shadowQuest:null});
      window.brumaluz.move(156.5,0);
      (await import('/src/story/quests.ts')).talkGnomi();
    },{race});
    await page.locator('#dialog .dialog-choice:not(.exit)').nth(origin).click();
    await page.getByRole('button',{name:'Aceptar misión',exact:true}).waitFor();
    const result=await page.evaluate(async({race,origin})=>({
      origin:(await import('/src/game/state.ts')).session.state.welcome.origin,
      expected:(await import('/src/data/quests.ts')).ORIGIN_REPLIES[race][origin],
      text:document.querySelector('.dialog-text').textContent,
    }),{race,origin});
    assert.equal(result.origin,origin,'Selecting the motive preserves the action');
    assert.ok(result.text.startsWith(result.expected),`${race}/${origin}: matching origin reply`);
    assert.match(result.text,/plaza del Levante/);
    origins.push({race,origin,text:result.text});
  }
  await page.setViewportSize({width:390,height:844});
  const accept=page.getByRole('button',{name:'Aceptar misión',exact:true});
  await accept.scrollIntoViewIfNeeded();
  const acceptBox=await accept.boundingBox();
  assert.ok(acceptBox&&acceptBox.y>=0&&acceptBox.y+acceptBox.height<=844);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/gnomi-mobile.png`});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'¿No eras tú quien iba a ayudarme?',exact:true}).click();
  assert.match(await page.locator('.dialog-text').textContent(),/no me descartes.*mercado.*feo empezar/s);
  assert.equal(await page.evaluate(async()=>(await import('/src/game/state.ts')).session.state.welcome.stage),'available');
  await page.screenshot({path:`${out}/gnomi-reply.png`});
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(800);
  await page.screenshot({path:`${out}/gnomi-origin.png`});
  console.log('All 12 origin replies passed.');
  const jobs=await page.evaluate(async()=>Object.keys((await import('/src/story/professionMasters.ts')).PROFESSION_GUIDES));
  for(const job of jobs){
    await page.evaluate(async job=>{
      (await import('/src/ui/dialog.ts')).closeDialog();
      window.brumaluz.set({welcome:{stage:'completed',origin:0},shadowQuest:'returned'});
      const {session}=await import('/src/game/state.ts');
      const {RPG_CATALOG}=await import('/src/data/professions.ts');
      await(await import('/src/game/cities.ts')).switchGameMap(`taller_${job}_interior`);
      session.state.location=`taller_${job}_interior`;
      const teacher=RPG_CATALOG.teachers[job];
      window.brumaluz.move(teacher.x,teacher.z+1.3);
      const id=(await import('/src/data/npcs.ts')).PROFESSION_MASTER_IDS[job];
      (await import('/src/game/interaction.ts')).talkTo(id);
    },job);
    await page.locator('#dialog').waitFor();
    const intro=await page.locator('.dialog-text').textContent();
    const personal=await page.evaluate(async job=>{
      const guide=(await import('/src/story/professionMasters.ts')).PROFESSION_GUIDES[job];
      return {question:guide.question,answer:guide.answer};
    },job);
    await page.getByRole('button',{name:personal.question,exact:true}).click();
    assert.equal(await page.locator('.dialog-text').textContent(),personal.answer);
    await page.getByRole('button',{name:'Volver a mis preguntas',exact:true}).click();
    await page.getByRole('button',{name:'Encargos diarios',exact:true}).click();
    const request=await page.locator('.dialog-text').textContent();
    assert.match(request,/Te quedan 3 de 3/);
    masters.push({job,intro,question:personal.question,answer:personal.answer,request});
    console.log(`Workshop dialogue passed: ${job}`);
    if(job==='herreria')await page.screenshot({path:`${out}/isberto-order.png`});
    if(job==='recolector'){
      await page.getByRole('button',{name:'Volver a mis preguntas',exact:true}).click();
      await page.setViewportSize({width:390,height:844});
      const start=page.getByRole('button',{name:'¿Cómo empiezo?',exact:true});
      await start.scrollIntoViewIfNeeded();
      const box=await start.boundingBox();
      assert.ok(box&&box.x>=0&&box.x+box.width<=390);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`${out}/gatherer-mobile.png`});
    }
  }
  assert.equal(new Set(masters.map(m=>m.intro)).size,12);
  assert.equal(new Set(masters.map(m=>m.request.split('\n')[0])).size,12);
  // Reopen in English to check composed greetings and daily-order placeholders.
  await page.evaluate(async()=>{
    (await import('/src/ui/dialog.ts')).closeDialog();
    (await import('/src/ui/i18n.ts')).setLanguage('en');
    (await import('/src/game/interaction.ts')).talkTo('maestro_recolector');
  });
  assert.match(await page.locator('.dialog-text').textContent(),/What are you looking for/);
  await page.getByRole('button',{name:'Encargos diarios',exact:true}).click();
  const english=await page.locator('.dialog-text').textContent();
  assert.match(english,/I’m gathering basic herbs/);
  assert.match(english,/You have 3 of 3 daily orders left/);
  assert.doesNotMatch(english,/Te quedan|Son independientes/);
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({origins,masters,english,errors,liveWrites:false},null,2));
  console.log('12 origin replies, 12 workshop voices and requests, English and mobile dialogue passed.');
}finally{
  await browser?.close();
  await server.close();
}
