import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';

test('profession guides, recipes and tools remain usable and reflect the player state',{timeout:240000},async()=>{
 const server=await createServer({
  cacheDir:join('node_modules','.vite-profession-ui-test'),
  optimizeDeps:{noDiscovery:true,entries:[]},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null},
  logLevel:'error',
 });
 let browser;
 const errors=[];
 try{
  await server.listen();
  const port=server.httpServer.address().port;
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1360,height:768},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('brumaluz-language','es');localStorage.setItem('brumaluz-ambient','off');localStorage.setItem('brumaluz-menu-music','off');});
  await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
  await page.goto(`http://127.0.0.1:${port}/?test&welcome&graphics=compatible`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.brumaluz,null,{timeout:120000});
  await page.evaluate(async()=>{
   window.brumaluz.set({name:'Aprendiz',introSeen:true,welcome:{stage:'completed',origin:0},shadowQuest:'returned'});
   window.brumaluz.play();
   const {session}=await import('/src/game/state.ts');
   const {professionState}=await import('/src/data/professions.ts');
   session.state.rpg=professionState(session.state.rpg);
  });
  const open=async(job,tab='guide')=>page.evaluate(async({job,tab})=>{
   const {selectProfessionTab}=await import('/src/ui/professionsWindow.ts');
   const {setWindow}=await import('/src/ui/menus.ts');
   selectProfessionTab(tab,job);setWindow('professions');
  },{job,tab});
  const capture=async name=>{if(process.env.PROFESSION_REVIEW_DIR)await page.screenshot({path:join(process.env.PROFESSION_REVIEW_DIR,name)});};
  const reveal=async selector=>page.evaluate(selector=>{
   const node=document.querySelector(selector);
   if(!node)throw new Error(`Missing ${selector}`);
   node.scrollIntoView({block:'nearest',inline:'nearest'});
   const rect=node.getBoundingClientRect();
   let left=Math.max(rect.left,0),right=Math.min(rect.right,innerWidth),top=Math.max(rect.top,0),bottom=Math.min(rect.bottom,innerHeight);
   for(let parent=node.parentElement;parent;parent=parent.parentElement){
    const style=getComputedStyle(parent),clip=parent.getBoundingClientRect();
    if(['auto','scroll','hidden','clip'].includes(style.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}
    if(['auto','scroll','hidden','clip'].includes(style.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}
   }
   return {width:rect.width,height:rect.height,visibleWidth:Math.max(0,right-left),visibleHeight:Math.max(0,bottom-top)};
  },selector);
  const assertCompactHeader=async job=>{
   await open(job);
   const layout=await page.locator('.profession-header').evaluate(node=>{
    const identity=node.querySelector('.profession-identity'),energy=node.querySelector('.profession-energy');
    const headerBox=node.getBoundingClientRect(),identityBox=identity.getBoundingClientRect(),energyBox=energy.getBoundingClientRect(),closeBox=document.querySelector('#window-close').getBoundingClientRect();
    const closeOverlapsEnergy=closeBox.left<energyBox.right&&closeBox.right>energyBox.left&&closeBox.top<energyBox.bottom&&closeBox.bottom>energyBox.top;
    return {headerRight:headerBox.right,identityRight:identityBox.right,energyLeft:energyBox.left,energyRight:energyBox.right,identityOverflow:identity.scrollWidth>identity.clientWidth,energyOverflow:energy.scrollWidth>energy.clientWidth,closeOverlapsEnergy};
   });
   assert.ok(layout.identityRight<=layout.energyLeft&&layout.energyRight<=layout.headerRight&&!layout.identityOverflow&&!layout.energyOverflow&&!layout.closeOverlapsEnergy,`${job}: identity and energy fit the compact header`);
  };
  const tutorialSnapshot=async()=>page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts'),{RPG_CATALOG}=await import('/src/data/professions.ts');
   const {PROFESSION_TUTORIAL,tutorialObjective,tutorialSteps,tutorialTarget}=await import('/src/data/professionTutorial.ts');
   const {t}=await import('/src/ui/i18n.ts');
   const make=job=>{
    const data=structuredClone(session.state),cfg=PROFESSION_TUTORIAL.jobs[job];
    data.inventory=Array(25).fill(null);
    data.rpg.learned=cfg.recipe?[cfg.recipe]:[];
    data.rpg.tutorial={job,status:'active',visited:true,equipped:true,gathered:0,crafted:0,collected:0,delivered:false,jobIds:[],startedAt:0};
    return data;
   };
   const mining=make('minero'),smithing=make('herreria'),gathering=make('recolector');
   const miningText=tutorialObjective(mining,t),smithingText=tutorialObjective(smithing,t),gatheringText=tutorialObjective(gathering,t);
   const target=tutorialTarget(mining,RPG_CATALOG.teachers.minero.location,t);
   const steps=tutorialSteps(mining,t).map(step=>step.label);
   mining.rpg.tutorial.gathered=1;
   const afterGather=tutorialObjective(mining,t);
   smithing.rpg.tutorial.gathered=1;smithing.rpg.tutorial.crafted=1;smithing.inventory[0]={id:'material_minero_0',count:3};
   const partialCraft=tutorialObjective(smithing,t);
   smithing.rpg.tutorial.crafted=2;smithing.rpg.tutorial.collected=1;
   const partialCollect=tutorialObjective(smithing,t);
   return {miningText,smithingText,gatheringText,target,steps,afterGather,partialCraft,partialCollect};
  });
  const jobs=['herreria','peleteria','sastreria','carpinteria','ebanisteria','joyeria','alquimia','encantamiento','cocina','minero','lenador','recolector'];
  for(const job of jobs){
   await open(job);
   assert.equal(await page.locator('.profession-guide-step').count(),3,`${job}: three practical steps`);
   assert.equal(await page.locator('[data-profession-control="guide-recipes"]').isVisible(),true,`${job}: direct recipe or resource access`);
   assert.equal(await page.locator('[data-profession-control="guide-work"]').isVisible(),true,`${job}: direct job or tool access`);
   const copy=await page.locator('.profession-guide').innerText();
   assert.match(copy,['minero','lenador','recolector'].includes(job)?/Equipa tu herramienta/:/Compra un pergamino al maestro/);
   if(['alquimia','cocina'].includes(job))assert.match(copy,/componentes usan la cola/);
  }
  await open('herreria');
  await capture('professions-guide-desktop.png');
  const desktopGuide=await page.locator('.profession-guide').boundingBox();
  for(const control of ['locate-workshop','guide-progress']){
   const action=await page.locator(`[data-profession-control="${control}"]`).boundingBox();
   assert.ok(action.y>=desktopGuide.y&&action.y+action.height<=desktopGuide.y+desktopGuide.height,`Desktop guide keeps ${control} visible without scrolling`);
  }
  await page.locator('[data-profession-control="guide-recipes"]').click();
  assert.equal(await page.locator('[data-profession-control="tab-recipes"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-profession-control="recipe-componente_herreria_0"]').click();
  assert.doesNotMatch(await page.locator('.profession-recipe-hero').innerText(),/\bcrafting\b/);
  assert.match(await page.locator('.profession-recipe-checkout').innerText(),/maestro.*50 Pelines/);
  await capture('professions-recipes-desktop.png');
  const rareId=await page.evaluate(async()=>Object.values((await import('/src/data/professions.ts')).RPG_CATALOG.recipes).find(recipe=>recipe.job==='herreria'&&recipe.source==='drop').id);
  await page.locator(`[data-profession-control="recipe-${rareId}"]`).click();
  assert.match(await page.locator('.profession-recipe-checkout').innerText(),/botín muy raro de criaturas de nivel 26 o superior/);
  const spanishTutorial=await tutorialSnapshot();
  assert.match(spanishTutorial.miningText,/4 × Cobre, 2 × Gema · Aprendiz/);
  assert.match(spanishTutorial.smithingText,/6 × Cobre/);
  assert.match(spanishTutorial.gatheringText,/2 × Hierbas silvestres, 2 × Cereal · Aprendiz, 2 × Fruta y bayas · Aprendiz/);
  assert.doesNotMatch(spanishTutorial.afterGather,/Extrae un recurso/);
  assert.match(spanishTutorial.partialCraft,/el componente .* que falta/);
  assert.match(spanishTutorial.partialCollect,/el componente que falta/);
  assert.equal(spanishTutorial.target.name,'Sal del taller para continuar','The gathering objective points out of the workshop');
  const shop=await page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts'),{RPG_CATALOG}=await import('/src/data/professions.ts');
   const {professionMasterConversation}=await import('/src/story/professionMasters.ts');
   const conversation=professionMasterConversation({job:'herreria',name:'Isberto',subtitle:'',onOpen:()=>{},training:{getState:()=>session.state,buy:async()=>false}});
   const normal=conversation.nodes.purchase_componente_herreria_0;
   const exceptional=Object.values(RPG_CATALOG.recipes).find(recipe=>recipe.job==='herreria'&&recipe.source==='drop');
   const rare=conversation.nodes[`purchase_${exceptional.id}`];
   return {normal:normal.text,normalCanBuy:normal.choices[0].when(),rare:rare.text,rareCanBuy:rare.choices[0].when()};
  });
  assert.match(shop.normal,/Precio: 50 Pelines/);
  assert.equal(shop.normalCanBuy,true);
  assert.match(shop.rare,/botín muy raro de criaturas de nivel 26 o superior/);
  assert.equal(shop.rareCanBuy,false,'Exceptional scrolls cannot be purchased');

  await page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts'),{holder}=await import('/src/game/stage.ts'),{RPG_CATALOG}=await import('/src/data/professions.ts');
   const {testBank}=await import('/src/game/inventory.ts');
   const state=session.state.rpg,recipe=RPG_CATALOG.recipes.componente_herreria_0;
   state.learned=[recipe.id];state.xp.herreria=1500;state.crafts.herreria=50;
   state.bankAvailable=Object.fromEntries(Object.keys(recipe.ingredients).map(id=>[id,100]));
   state.bankAvailable.material_minero_0=100;state.bankAvailable.material_minero_2=100;state.bankAvailable.nucleo_restauracion=1;
   const bankItems=Object.entries(state.bankAvailable).flatMap(([id,count])=>count===100?[{id,count:99},{id,count:1}]:[{id,count}]);
   testBank.items=Array.from({length:testBank.size},(_,index)=>bankItems[index]??null);
   state.furniture=[{id:'test-station',job:'herreria',location:session.state.location,x:holder.position.x,z:holder.position.z,yaw:0,item:{id:'mueble_estacion_0',count:1}}];
   state.tools.minero={id:'herramienta_minero_0',count:1,durability:20,maxDurability:100,originalDurability:100};
   session.state.inventory=Array(25).fill(null);
  });
  await open('herreria','recipes');
  await page.locator('[data-profession-control="recipe-componente_herreria_0"]').click();
  assert.match(await page.locator('.profession-materials').innerText(),/100\s*\/\s*\d/,'Crafting counts bank materials');
  assert.equal(await page.locator('.profession-recipe-checkout .primary').isEnabled(),true,'A matching nearby station and bank materials allow crafting');
  await open('herreria','mastery');
  assert.match(await page.locator('.profession-mastery-body').innerText(),/Materiales necesarios en la mochila/);
  assert.match(await page.locator('.profession-mastery-body .profession-material').first().innerText(),/0\s*\/\s*20/,'Mastery does not count bank materials');
  assert.equal(await page.getByRole('button',{name:'Completar proyecto'}).isDisabled(),true);
  await page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts');
   session.state.inventory[0]={id:'material_minero_0',count:20};
   session.state.inventory[1]={id:'material_minero_2',count:10};
  });
  await open('herreria','mastery');
  assert.equal(await page.getByRole('button',{name:'Completar proyecto'}).isEnabled(),true,'Mastery accepts materials carried in the bag');
  await open('minero','recipes');
  assert.match(await page.locator('.profession-field-resource').first().innerText(),/20 en la mochila/,'The field notebook reports bag contents, not bank contents');
  await open('minero','tools');
  assert.equal(await page.getByRole('button',{name:'Usar núcleo de restauración'}).isDisabled(),true,'A restoration core in the bank cannot be used');
  await page.evaluate(async()=>{(await import('/src/game/state.ts')).session.state.inventory[2]={id:'nucleo_restauracion',count:1};});
  await open('minero','tools');
  assert.equal(await page.getByRole('button',{name:'Usar núcleo de restauración'}).isEnabled(),true,'A restoration core in the bag can be used at a smithing station');
  await open('minero','mastery');
  assert.match(await page.locator('.profession-location').innerText(),/Visita el taller/,'A home smithing station is not a gathering mastery station');
  const publicAlias=await page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts'),{holder}=await import('/src/game/stage.ts'),{RPG_CATALOG}=await import('/src/data/professions.ts');
   const {selectProfessionTab,renderProfessions}=await import('/src/ui/professionsWindow.ts');
   const site=RPG_CATALOG.stations.herreria,oldLocation=session.state.location,oldPosition=holder.position.clone();
   try{
    session.state.location=site.location;holder.position.set(site.x,oldPosition.y,site.z);
    selectProfessionTab('mastery','minero');
    const body=document.createElement('div');renderProfessions(body,session.state);
    return body.querySelector('.profession-location').textContent;
   }finally{session.state.location=oldLocation;holder.position.copy(oldPosition);}
  });
  assert.match(publicAlias,/Estación disponible/,'The public smithing station supports gathering mastery');

  await page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts');
   const now=Date.now()/1000;
   session.state.rpg.jobs=Array.from({length:5},(_,i)=>({id:`test-job-${i}`,recipe:'componente_herreria_0',job:'herreria',start:now+i*60,end:now+(i+1)*60,done:false,ingredients:{},output:{id:'componente_herreria_0',count:1},xp:10}));
  });
  await open('herreria','recipes');
  await page.locator('[data-profession-control="recipe-componente_herreria_0"]').click();
  assert.match(await page.locator('.profession-recipe-checkout').innerText(),/Cola llena: espera a que termine un trabajo o cancela uno/);
  assert.equal(await page.locator('.profession-recipe-checkout .primary').isDisabled(),true);
  await page.locator('[data-profession-control="tab-jobs"]').click();
  assert.equal(await page.locator('.profession-queue-slot').count(),5);
  assert.equal(await page.locator('.profession-order').count(),5);
  await page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts');
   session.state.rpg.jobs[0].done=true;session.state.rpg.jobs[0].end=Date.now()/1000-1;
  });
  await open('herreria','recipes');
  assert.equal(await page.locator('.profession-recipe-checkout .primary').isEnabled(),true,'A finished job no longer occupies a slot before collection');
  await open('herreria','jobs');
  assert.equal(await page.locator('.profession-order.ready').count(),1);
  assert.equal(await page.locator('.profession-queue-slot.occupied, .profession-queue-slot.active').count(),4);

  for(const [width,height] of [[1024,768],[760,900],[390,844],[320,640]]){
   await page.setViewportSize({width,height});
   await open('herreria');
   if(width===390)await capture('professions-guide-mobile.png');
   if(width===390){
    const firstStep=await page.locator('.profession-guide-step').first().boundingBox(),guide=await page.locator('.profession-guide').boundingBox();
    assert.ok(firstStep.y>=guide.y&&firstStep.y+firstStep.height<=guide.y+guide.height,`${width}px: the first instruction is visible without scrolling`);
   }
   const dimensions=await page.locator('.profession-window').evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
   assert.ok(dimensions.scroll<=dimensions.client,`${width}px: profession window must not overflow horizontally`);
   const guideAction=await reveal('[data-profession-control="guide-recipes"]');
   assert.ok(guideAction.visibleWidth>=guideAction.width-1&&guideAction.visibleHeight>=guideAction.height-1,`${width}px: guide action is reachable`);
   await page.locator('[data-profession-control="guide-recipes"]').click();
   await page.locator('[data-profession-control="recipe-componente_herreria_0"]').click();
   const checkout=await reveal('.profession-recipe-checkout .primary');
   assert.ok(checkout.visibleWidth>=checkout.width-1&&checkout.visibleHeight>=checkout.height-1,`${width}px: recipe action is reachable`);
   if(width===390)await capture('professions-recipes-mobile.png');
  }
  for(const [width,height] of [[390,844],[320,640]]){
   await page.setViewportSize({width,height});
   await open('minero');
   if(width===390)await capture('professions-gathering-mobile.png');
   if(width===320)await capture('professions-gathering-320.png');
   assert.equal(await page.locator('.profession-energy').isVisible(),true,`${width}px: gathering energy is visible`);
   const firstInstruction=await page.locator('.profession-guide-step h4').first().boundingBox(),guide=await page.locator('.profession-guide').boundingBox();
   assert.ok(firstInstruction.y>=guide.y&&firstInstruction.y+firstInstruction.height<=guide.y+guide.height,`${width}px: the first gathering instruction is visible without scrolling`);
   const dimensions=await page.locator('.profession-window').evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
   assert.ok(dimensions.scroll<=dimensions.client,`${width}px: gathering must not overflow horizontally`);
   const toolAction=await reveal('[data-profession-control="guide-work"]');
   if(width===320)await capture('professions-gathering-320-scrolled.png');
   assert.ok(toolAction.visibleWidth>=toolAction.width-1&&toolAction.visibleHeight>=toolAction.height-1,`${width}px: gathering tool action is reachable (${JSON.stringify(toolAction)})`);
   await page.locator('[data-profession-control="guide-work"]').click();
   assert.equal(await page.locator('[data-profession-control="tab-tools"]').getAttribute('aria-pressed'),'true');
  }
  for(const job of ['minero','lenador','recolector'])await assertCompactHeader(job);

  await page.setViewportSize({width:1360,height:768});
  await page.evaluate(async()=>{(await import('/src/ui/i18n.ts')).setLanguage('en');});
  await open('herreria');
  assert.match(await page.locator('.profession-guide').innerText(),/Buy a scroll from the master/);
  assert.match(await page.locator('.profession-footer').innerText(),/Human affinity/);
  await page.locator('[data-profession-control="guide-work"]').click();
  assert.match(await page.locator('.profession-page-jobs').innerText(),/One active job and four waiting/);
  await open('herreria','recipes');
  const search=page.getByRole('searchbox',{name:'Search recipes'});
  await search.fill('Smithing component');
  assert.equal(await page.locator('[data-profession-control="recipe-componente_herreria_0"]').count(),1,'Recipes can be found by their translated name');
  await search.fill('Componente de Herrería');
  assert.equal(await page.locator('[data-profession-control="recipe-componente_herreria_0"]').count(),1,'The original recipe name remains searchable');
  await search.fill('');
  await open('herreria','mastery');
  assert.match(await page.locator('.profession-mastery-body').innerText(),/Advance to Expert[\s\S]*50 \/ 50 practices/);
  await open('minero','tools');
  assert.match(await page.locator('.profession-tool-card').innerText(),/Repair · \d+ Pelines/);
  assert.equal(await page.getByRole('button',{name:'Use restoration core'}).isEnabled(),true);
  const englishTutorial=await tutorialSnapshot();
  assert.match(englishTutorial.miningText,/4 × Copper, 2 × Gem · Apprentice/);
  assert.match(englishTutorial.smithingText,/6 × Copper/);
  assert.match(englishTutorial.gatheringText,/2 × Wild herbs, 2 × Grain · Apprentice, 2 × Fruit and berries · Apprentice/);
  assert.match(englishTutorial.steps[1],/Equip a Mining tool/);
  assert.equal(englishTutorial.target.name,'Leave the workshop to continue');
  await page.setViewportSize({width:320,height:640});
  for(const job of ['minero','lenador','recolector'])await assertCompactHeader(job);
  await page.setViewportSize({width:1360,height:768});
  const masters=await page.evaluate(async()=>{
   const {PROFESSION_GUIDES,professionMasterConversation}=await import('/src/story/professionMasters.ts');
   const {t}=await import('/src/ui/i18n.ts');
   return Object.keys(PROFESSION_GUIDES).map(job=>{
    const conversation=professionMasterConversation({job,name:'Master',subtitle:'',onOpen:()=>{}});
    return {job,intro:conversation.nodes.intro.text,first:conversation.nodes.first.text,firstSource:PROFESSION_GUIDES[job].firstStep,question:t(PROFESSION_GUIDES[job].question),questionSource:PROFESSION_GUIDES[job].question,answer:t(conversation.nodes.trade.text),answerSource:conversation.nodes.trade.text,choices:conversation.nodes.intro.choices.map(choice=>t(choice.text))};
   });
  });
  assert.equal(masters.length,12);
  for(const master of masters){
   assert.ok(master.intro.length<210,`${master.job}: concise introduction`);
   assert.ok(master.first.length<210,`${master.job}: concise first step`);
   assert.doesNotMatch(master.intro,/[¿¡]/,`${master.job}: introduction is translated`);
   assert.ok(!master.first.includes(master.firstSource),`${master.job}: first step is translated`);
   assert.notEqual(master.question,master.questionSource,`${master.job}: trade question is translated`);
   assert.notEqual(master.answer,master.answerSource,`${master.job}: trade answer is translated`);
   for(const choice of master.choices)assert.doesNotMatch(choice,/[¿¡]/,`${master.job}: choice is translated`);
  }
  await page.evaluate(async()=>{
   const {professionMasterConversation}=await import('/src/story/professionMasters.ts'),{openConversation}=await import('/src/ui/dialog.ts');
   openConversation(professionMasterConversation({job:'herreria',name:'Isberto',subtitle:'',onOpen:()=>{}}));
  });
  assert.match(await page.locator('#dialog').innerText(),/What do you need for the forge/);
  assert.match(await page.locator('#dialog').innerText(),/How do I get started\?/);
  assert.match(await page.locator('#dialog').innerText(),/Browse recipes/);
  await page.evaluate(async()=>{
   const {session}=await import('/src/game/state.ts'),{setLanguage}=await import('/src/ui/i18n.ts');
   const {professionMasterConversation}=await import('/src/story/professionMasters.ts'),{openConversation}=await import('/src/ui/dialog.ts');
   const {setWindow}=await import('/src/ui/menus.ts');
   setWindow(null,false);setLanguage('es');
   session.state.rpg.learned=session.state.rpg.learned.filter(id=>id!=='componente_herreria_0');
   const conversation=professionMasterConversation({job:'herreria',name:'Isberto',subtitle:'',onOpen:()=>{},training:{getState:()=>session.state,buy:async()=>false}});
   openConversation({...conversation,start:'purchase_componente_herreria_0'});
  });
  assert.match(await page.locator('#dialog .dialog-text').innerText(),/Precio: 50 Pelines/);
  assert.equal(await page.getByRole('button',{name:/Comprar por 50 Pelines/}).isVisible(),true);
  await page.evaluate(async()=>{(await import('/src/ui/i18n.ts')).setLanguage('en');});
  assert.match(await page.locator('#dialog .dialog-text').innerText(),/Smithing component[\s\S]*Price: 50 Pelines/);
  assert.equal(await page.getByRole('button',{name:/Buy for 50 Pelines/}).isVisible(),true,'Purchase confirmation follows a language change');
  await page.evaluate(async()=>{(await import('/src/ui/i18n.ts')).setLanguage('es');});
  assert.match(await page.locator('#dialog .dialog-text').innerText(),/Precio: 50 Pelines/);
  assert.equal(await page.getByRole('button',{name:/Comprar por 50 Pelines/}).isVisible(),true);
  await page.getByRole('button',{name:/Comprar por 50 Pelines/}).click();
  assert.match(await page.locator('#dialog .dialog-text').innerText(),/Precio: 50 Pelines/,'A failed purchase must not show a receipt');
  assert.deepEqual(errors,[]);
 }finally{
  await browser?.close();
  await server.close();
 }
});
