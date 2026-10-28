// Actual game renderer and loop, driven by the real SQL in an isolated database.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {aiFixture,PLAYER,SECOND} from '../scripts/wilderness-ai-fixture.mjs';
const catalog=JSON.parse(await readFile('src/data/generated/wilderness.json','utf8'));
const f=await aiFixture(catalog),server=await createServer({cacheDir:'node_modules/.vite-enemy-ai-review',server:{host:'127.0.0.1',port:4228,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser;const errors=[],checks=[];
await mkdir('art/combat-review',{recursive:true});
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const pages=[];
 for(let i=0;i<2;i++){
  console.log(`Loading real game client ${i+1}/2…`);
  const page=await browser.newPage({viewport:{width:1440,height:900}});pages.push(page);page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
  await page.goto('http://127.0.0.1:4228/?graphics=compatible',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
  await page.evaluate(async()=>{
   document.getElementById('account-gate').hidden=true;document.body.classList.remove('auth-visible','characters-visible');
   const {switchGameMap}=await import('/src/game/cities.ts'),state=await import('/src/game/state.ts');
   await switchGameMap('pompelin');state.session.state.location='pompelin';state.session.state.introSeen=true;
   window.brumaluz.play();window.aiState=state;window.aiWorld=await import('/src/game/wilderness.ts');window.aiClock=await import('/src/data/worldClock.ts');window.aiStage=await import('/src/game/stage.ts');
   window.brumaluz.move(4,-18);window.brumaluz.view(.4,.68,27);
  });
  console.log(`Client ${i+1} ready in Pompelín.`);
 }
 async function feed(seconds=.25){
  await f.step(seconds);const rows=await f.rows(),stamp=Number((await f.db.query('select extract(epoch from public.test_now()) s')).rows[0].s);
  const packet={shared:true,serverTime:stamp,mobs:rows.map(({state,revision})=>({...state,revision,attackingYou:!!state.members?.[PLAYER]})),corpses:[],inCombat:false};
  for(const page of pages)await page.evaluate(packet=>{aiClock.syncWorldClock({hour:10,secondsPerHour:36000,serverTime:packet.serverTime});aiWorld.receiveWilderness({wilderness:packet});},packet);
  await pages[0].waitForTimeout(260);return rows;
 }
 const start=await f.mob('camino_1');await f.player(start.x+45,start.z);await f.player(start.x+45,start.z+3,SECOND);
 for(let i=0;i<44;i++)await feed();
 const idle=await f.mob('camino_1');assert.ok(Math.hypot(idle.x-start.x,idle.z-start.z)>1);checks.push('SQL patrol moves in the real Pompelín map.');
 await pages[0].screenshot({path:'art/combat-review/enemies-patrol-gameplay.png'});
 console.log('Patrol captured.');
 const snapshots=[];
 for(const page of pages)snapshots.push(await page.evaluate(()=>aiWorld.wildernessTargets().map(t=>({id:t.id,x:t.root.position.x,z:t.root.position.z})).sort((a,b)=>a.id.localeCompare(b.id))));
 assert.equal(snapshots[0].length,catalog.spawns.length);assert.equal(snapshots[1].length,catalog.spawns.length);
 snapshots[0].forEach((m,i)=>assert.ok(Math.hypot(m.x-snapshots[1][i].x,m.z-snapshots[1][i].z)<.5));checks.push(`Two independent game clients render the same ${catalog.spawns.length} authoritative creatures.`);
 await f.player(start.x-9,start.z);await f.engage('camino_1');
 for(const page of pages)await page.evaluate(p=>{window.brumaluz.move(p.x-9,p.z);window.brumaluz.view(.7,.6,20);},start);
 for(let i=0;i<24;i++){await f.player(start.x-9-i*.13,start.z);await feed();}
 const chase=await f.rows();assert.equal(chase.filter(r=>r.state.group==='cuadrilla_camino'&&r.state.status==='active').length,3);checks.push('The three bandits assist their group and pursue the moving opponent.');
 await pages[0].screenshot({path:'art/combat-review/enemies-group-pursuit-gameplay.png'});
 console.log('Group pursuit captured.');
 await f.player(start.x+80,start.z);await f.player(start.x+80,start.z,SECOND);
 for(let i=0;i<40;i++)await feed();
 assert.equal((await f.mob('camino_1')).status,'idle');checks.push('Pursuers walk back and resume their ambient behavior.');
 await pages[0].screenshot({path:'art/combat-review/enemies-return-gameplay.png'});
 for(const [id,name]of [['camino_4','boar'],['camino_5','sprout']]){
  const mob=await f.mob(id);await pages[0].evaluate(m=>{window.brumaluz.move(m.x+1,m.z+4);window.brumaluz.view(.2,.48,10);},mob);
  for(let i=0;i<6;i++)await feed();
  await pages[0].screenshot({path:`art/combat-review/enemies-${name}-idle-gameplay.png`});
 }
 assert.deepEqual(errors,[]);await writeFile('art/combat-review/enemy-ai-review.json',JSON.stringify({checks,errors,clients:2,connectedToLiveServer:false},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();await server.close();await f.close();}
