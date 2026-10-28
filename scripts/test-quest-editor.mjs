import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { questEditorPlugin } from '../tools/quest-editor-plugin.mjs';

let server, browser, directory, file, schema, refs;
const base = 'http://127.0.0.1:4194';
const output = 'art/quest-editor-review';
const get = () => fetch(`${base}/__dev/quests`);
const put = (value, revision, headers = {}) => fetch(`${base}/__dev/quests`,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':revision,...headers},body:JSON.stringify(value)});
const catalog = (...quests) => ({version:1,quests});
before(async () => {
  directory = await mkdtemp(join(tmpdir(),'brumaluz-quests-')); file = join(directory,'questCatalog.json');
  await writeFile(file,JSON.stringify(catalog())); await mkdir(output,{recursive:true});
  server = await createServer({configFile:false,logLevel:'error',cacheDir:'node_modules/.vite-quest-tests',plugins:[questEditorPlugin({catalogPath:file})],assetsInclude:['**/*.glb'],server:{host:'127.0.0.1',port:4194,strictPort:true,hmr:false,watch:null}});
  await server.listen(); schema = await server.ssrLoadModule('/src/data/questCatalog.ts');
  const response = await fetch(`${base}/__dev/quests/references`); assert.equal(response.status,200,await response.clone().text()); refs = await response.json();
  browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform === 'win32' ? 'msedge' : undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-features=msDownloadsHub']});
});
after(async () => {
  await browser?.close(); await server?.close();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(),'brumaluz-quests-'))) await rm(directory,{recursive:true,force:true});
});
function fixture(id='prueba') {
  const q = schema.newQuest(id,'gnomi');
  q.title = 'Encargo de prueba'; q.rewards.experience = 35; q.rewards.pelines = 7;
  q.objectives = [
    {id:'objetos',type:'fetch',target:refs.items[0].id,count:2,description:'Trae dos objetos.',map:'',consume:true},
    {id:'enemigos',type:'kill',target:refs.enemies[0].id,count:2,description:'Derrota dos enemigos y vuelve.',map:refs.maps[0].id,consume:false},
    {id:'contacto',type:'talk',target:'isberto',count:1,description:'Habla con Isberto.',map:'',consume:false},
  ];
  q.rewards.items = [{item:refs.items[1].id,count:1}];
  return q;
}
test('schema rejects broken dialogue, cyclic prerequisites, unsupported fields and missing world references', () => {
  const q = fixture(); assert.deepEqual(schema.validateQuestCatalog(catalog(q),refs),catalog(q));
  const mutations = [q=>q.id='../escape',q=>q.minLevel=0,q=>q.objectives[0].count=0,q=>q.objectives[1].count=1.5,
    q=>q.objectives[2].count=2,q=>q.objectives[1].consume=true,q=>q.objectives[0].map=refs.maps[0].id,
    q=>q.rewards.pelines=-1,q=>q.giver='missing',q=>q.objectives[0].target='missing',q=>q.objectives[1].target='missing',
    q=>q.objectives[1].map='missing',q=>q.dialogue.entries.offer='missing',q=>q.dialogue.nodes[0].choices[0].next='missing',
    q=>q.dialogue.nodes[0].choices[0].action='eval',q=>q.dialogue.nodes[0].choices[0].action='none',
    q=>q.dialogue.nodes[2].choices[0].action='none',q=>q.prerequisites=['missing'],q=>q.prerequisites=[q.id],
    q=>q.objectives.push(structuredClone(q.objectives[0])),q=>q.dialogue.nodes.push(structuredClone(q.dialogue.nodes[0])),
    q=>q.callback='alert(1)',q=>q.dialogue.nodes[0].choices[0].code='alert(1)'];
  for (const mutate of mutations) { const copy = structuredClone(q); mutate(copy); assert.throws(()=>schema.validateQuestCatalog(catalog(copy),refs),undefined,mutate.toString()); }
  const a = fixture('a'), b = fixture('b'); a.prerequisites=['b']; b.prerequisites=['a'];
  assert.throws(()=>schema.validateQuestCatalog(catalog(a,b),refs),/circulares/);
  b.prerequisites=[]; assert.equal(schema.validateQuestCatalog(catalog(a,b),refs).quests.length,2);
  const branch = structuredClone(q); branch.dialogue.nodes[0].choices=[{text:'Cuéntame más',next:'rama',action:'none'}];
  branch.dialogue.nodes.push({id:'rama',speaker:'isberto',text:'Esta es la explicación.',choices:[{text:'Acepto',next:'',action:'accept'}]});
  schema.validateQuestCatalog(catalog(branch),refs);
});
test('rehearsal enforces acceptance, map filters, live inventory, consumption and single payment', () => {
  const q = fixture(); q.minLevel=3; q.prerequisites=['anterior']; const s = schema.newRehearsal();
  const context = {level:3,completed:['anterior']};
  schema.rehearseEvent(q,s,'kill',q.objectives[1].target,q.objectives[1].map,2); assert.deepEqual(s.progress,{});
  assert.equal(schema.rehearseAction(q,s,'complete',context),false);
  assert.equal(schema.rehearseAction(q,s,'accept',{level:1,completed:['anterior']}),false);
  assert.equal(schema.rehearseAction(q,s,'accept',{level:3,completed:[]}),false);
  assert.equal(schema.rehearseAction(q,s,'accept',context),true); assert.equal(schema.rehearseAction(q,s,'accept',context),false);
  schema.rehearseEvent(q,s,'fetch',q.objectives[0].target,'',2);
  schema.rehearseEvent(q,s,'kill',q.objectives[1].target,'wrong',2); assert.equal(schema.objectiveProgress(q.objectives[1],s),0);
  schema.rehearseEvent(q,s,'kill',q.objectives[1].target,q.objectives[1].map,2); schema.rehearseEvent(q,s,'talk','isberto');
  assert.equal(schema.questPhase(q,s),'ready'); s.inventory[q.objectives[0].target]--;
  assert.equal(schema.questPhase(q,s),'active'); assert.equal(schema.rehearseAction(q,s,'complete',context),false);
  schema.rehearseEvent(q,s,'fetch',q.objectives[0].target); assert.equal(schema.rehearseAction(q,s,'complete',context),true);
  assert.equal(s.inventory[q.objectives[0].target],0); assert.equal(s.inventory[q.rewards.items[0].item],1); assert.equal(s.experience,35); assert.equal(s.pelines,7);
  assert.equal(schema.rehearseAction(q,s,'complete',context),false); assert.equal(s.pelines,7);
});
test('local API saves atomically, prevents stale or foreign writes and validates all references', async () => {
  await writeFile(file,JSON.stringify(catalog()));
  let response = await get(); const revision = response.headers.get('etag'); const q = fixture();
  assert.equal((await put(catalog(q),revision,{'Origin':'https://foreign.example'})).status,403);
  assert.equal((await put(catalog(q),revision,{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await put(catalog({...q,giver:'missing'}),revision)).status,400);
  assert.equal((await put(catalog(q),revision)).status,200);
  assert.equal((await put(catalog(),revision)).status,409);
  const current = await readFile(file,'utf8'); assert.equal(JSON.parse(current).quests[0].title,q.title);
  response = await get(); const writes = await Promise.all([put(catalog({...q,title:'Primera ventana'}),response.headers.get('etag')),put(catalog({...q,title:'Segunda ventana'}),response.headers.get('etag'))]);
  assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
  await writeFile(file,JSON.stringify(catalog()));
});
test('guided editor creates a quest without IDs, filters targets, explains errors and preserves custom objective text', async () => {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(`${base}/quests.html`); await page.locator('#new:enabled').waitFor({timeout:60000});
  assert.equal(await page.locator('[data-panel]:visible').count(),1);
  assert.equal(await page.locator('[data-path="id"]').isVisible(),false);
  await page.locator('#save').click(); assert.match(await page.locator('#validation').innerText(),/nombre/);
  await page.locator('[data-path="title"]').fill('Suministros para el taller');
  await page.locator('[data-path="summary"]').fill('Reúne los suministros y vuelve con Gnomi.');
  await page.locator('[data-path="giver"]').selectOption('isberto');
  assert.equal(await page.locator('[data-path="receiver"]').inputValue(),'isberto','return contact follows giver by default');
  await page.locator('#next').click();
  assert.equal(await page.locator('[data-panel]:visible').count(),1);
  await page.locator('#save').click(); assert.match(await page.locator('#validation').innerText(),/qué objeto/);
  const picker = page.locator('[data-panel="1"] input[data-filter-for]').first();
  const item = refs.items.find(v=>v.name.toLowerCase().includes('madera')) ?? refs.items[0];
  await picker.fill(item.name); assert.ok(await page.locator('[data-path="objectives.0.target"] option').count() < refs.items.length);
  await page.locator('[data-path="objectives.0.target"]').selectOption(item.id);
  await page.locator('[data-path="objectives.0.count"]').fill('5');
  assert.match(await page.locator('[data-objective-preview="0"]').innerText(),/5 ×/);
  await page.locator('.objective-card details').evaluate(el=>el.open=true);
  await page.locator('[data-path="objectives.0.description"]').fill('Prepara una entrega para el taller.');
  await page.locator('[data-path="objectives.0.count"]').fill('6');
  assert.equal(await page.locator('[data-objective-preview="0"]').innerText(),'Prepara una entrega para el taller.');
  await page.locator('[data-action="objective-add"][data-type="kill"]').click();
  assert.equal(await page.locator('[data-path="objectives.1.type"]').inputValue(),'kill');
  await page.locator('[data-action="objective-delete"][data-index="1"]').click();
  await page.locator('#next').click();
  assert.equal(await page.locator('.advanced-dialogue').getAttribute('open'),null);
  await page.locator('[data-action="question-add"]').click();
  await page.locator('.question-card [data-path$=".text"]').first().fill('¿Por qué hace falta?');
  await page.locator('[data-action="question-delete"]').click();
  assert.equal(await page.locator('.question-card').count(),0);
  await page.locator('[data-phase="active"]').click();
  await page.locator('.conversation-sheet textarea').fill('Todavía espero esos suministros.');
  await page.locator('[data-step="4"]').click(); assert.match(await page.locator('#review-content').innerText(),/Todo preparado/);
  await page.locator('#save').click(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Misión guardada'));
  const saved = JSON.parse(await readFile(file,'utf8')); assert.equal(saved.quests[0].dialogue.nodes[1].text,'Todavía espero esos suministros.');
  assert.equal(saved.quests[0].dialogue.nodes.length,4,'removing a guided question removes its unused automatic answer');
  await page.locator('[data-step="0"]').click(); await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:`${output}/guided-start-desktop.png`});
  await page.setViewportSize({width:390,height:844}); await page.screenshot({path:`${output}/guided-start-mobile.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close(); await writeFile(file,JSON.stringify(catalog()));
});
test('editor creates, edits, branches, saves, recovers drafts and rehearses complete quests on desktop and mobile', async () => {
  const page = await browser.newPage({viewport:{width:1550,height:1050}}); const errors=[];
  page.on('pageerror',error=>errors.push(error.message)); page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(()=>localStorage.setItem('brumaluz-language','es'));
  await page.goto(`${base}/quests.html`); await page.locator('#new:enabled').waitFor({timeout:60000});
  const q = fixture();
  await page.locator('.library details').evaluate(el=>el.open=true);
  await page.locator('#import').setInputFiles({name:'misiones.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(catalog(q)))});
  await page.locator('[data-path="title"]').fill('Un encargo de ensayo');
  await page.locator('[data-step="2"]').click();
  await page.locator('[data-path="dialogue.nodes.0.text"]').first().fill('¿Me ayudas con estos suministros?');
  await page.locator('[data-action="question-add"]').click();
  await page.locator('[data-path="dialogue.nodes.4.text"]').first().fill('Necesito que lo traigas todo antes de volver.');
  await page.locator('.question-card details').evaluate(el=>el.open=true);
  await page.locator('[data-path="dialogue.nodes.4.speaker"]').first().selectOption('isberto');
  await page.locator('[data-path="dialogue.nodes.0.choices.2.text"]').first().fill('¿Qué necesitas?');
  await page.locator('.conversation-sheet').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/guided-conversation-desktop.png`});
  await page.locator('#save').click(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Misión guardada'));
  const saved = JSON.parse(await readFile(file,'utf8')); assert.equal(saved.quests[0].title,'Un encargo de ensayo');
  await page.locator('[data-step="4"]').click();
  await page.locator('#test-start').click();
  assert.match(await page.locator('#dialog').innerText(),/35 XP/); assert.match(await page.locator('#dialog').innerText(),/1 ×/);
  await page.locator('.dialog-choice').filter({hasText:'¿Qué necesitas?'}).click(); assert.equal(await page.locator('#dialog-speaker').textContent(),'Isberto');
  await page.locator('.dialog-choice').filter({hasText:'Entendido, volvamos al encargo.'}).click();
  await page.locator('.dialog-choice.exit').click(); assert.match(await page.locator('#test-state').innerText(),/Oferta/);
  await page.locator('#test-talk').click(); await page.locator('.dialog-choice').filter({hasText:'Claro, te ayudaré.'}).click();
  assert.match(await page.locator('#test-state').innerText(),/En curso/);
  for (const index of [0,0,1,1,2]) await page.locator(`[data-event="${index}"]`).click();
  assert.match(await page.locator('#test-state').innerText(),/Lista para entregar/);
  await page.locator('#test-talk').click();
  await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.context').scrollTop=100000;});
  await page.screenshot({path:`${output}/editor-desktop.png`});
  await page.setViewportSize({width:390,height:844}); await page.locator('#dialog').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await page.screenshot({path:`${output}/editor-mobile.png`});
  await page.locator('.dialog-choice').filter({hasText:'Completar misión'}).click();
  assert.match(await page.locator('#test-state').innerText(),/Completada[\s\S]*35 XP · 7 pelines/);
  await page.locator('#test-talk').click(); assert.equal(await page.locator('.dialog-choice').filter({hasText:'Completar misión'}).count(),0);
  await page.locator('[data-step="0"]').click();
  await page.locator('[data-path="summary"]').fill('Borrador recuperable');
  await page.locator('[data-step="2"]').click(); await page.locator('[data-phase="active"]').click();
  await page.reload(); await page.locator('#new:enabled').waitFor(); assert.equal(await page.locator('[data-path="summary"]').inputValue(),'Borrador recuperable');
  assert.match(await page.locator('#status').innerText(),/Borrador recuperado/);
  assert.equal(await page.locator('[data-panel="2"]').isVisible(),true);
  assert.equal(await page.locator('[data-phase="active"]').getAttribute('aria-selected'),'true');
  // A second writer cannot be overwritten by a recovered draft.
  await writeFile(file,JSON.stringify(catalog({...saved.quests[0],title:'Cambio externo'})));
  await page.locator('#save').click(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('otra ventana'));
  assert.equal(JSON.parse(await readFile(file,'utf8')).quests[0].title,'Cambio externo');
  assert.deepEqual(errors,[]); await page.close();
});
test('authored dialogue renders in the real game with item rewards and guarded actions', async () => {
  const page = await browser.newPage({viewport:{width:1280,height:900}}); const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('brumaluz-language','es');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
  await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
  await page.goto(`${base}/?test&welcome&graphics=compatible`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>!!window.brumaluz,null,{timeout:120000});
  await page.evaluate(()=>{window.brumaluz.set({introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:null,position:{x:153.5,z:0,yaw:Math.PI/2}});window.brumaluz.play();});
  await page.waitForTimeout(1000);
  await page.evaluate(async q=>{
    const {questConversation}=await import('/src/story/questConversation.ts');
    const {openConversation,closeDialog}=await import('/src/ui/dialog.ts');closeDialog();
    window.questPreviewAccepted=0;
    openConversation(questConversation(q,'offer',id=>id==='gnomi'?'Gnomi':id,action=>{if(action==='accept')window.questPreviewAccepted++;return true;},id=>'Objeto de prueba'));
  },fixture());
  assert.match(await page.locator('#dialog').innerText(),/1 × Objeto de prueba/);
  await page.screenshot({path:`${output}/game-dialogue.png`});
  await page.setViewportSize({width:390,height:844}); await page.screenshot({path:`${output}/game-dialogue-mobile.png`});
  await page.locator('.dialog-choice').filter({hasText:'Claro, te ayudaré.'}).click(); assert.equal(await page.evaluate(()=>window.questPreviewAccepted),1);
  assert.deepEqual(errors,[]); await page.close();
  await writeFile(`${output}/review.json`,JSON.stringify({passed:true,liveWrites:false,checks:['schema and references','local rehearsal lifecycle','atomic writes and conflicts','five-step guided creation','searchable target lists','inline error navigation','preservation of custom objective text','automatic question and return','editor desktop and mobile','draft and current step recovery','actual game dialogue desktop and mobile']},null,2));
});
