import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const compile = async path => ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'), {
  compilerOptions: { target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022 },
}).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const inventory = moduleUrl(await compile('../src/data/inventory.ts'));
const weapons = moduleUrl(await compile('../src/data/weapons.ts'));
const { WEAPONS, guardedDamage, equippedWeapon } = await import(weapons);
const itemCode = (await compile('../src/data/items.ts')).replace("'./weapons'",JSON.stringify(weapons));
const { ITEMS, VENDOR_STOCK } = await import(moduleUrl(itemCode));
const code = (await compile('../src/data/combat.ts')).replace("'./inventory'",JSON.stringify(inventory)).replace("'./weapons'",JSON.stringify(weapons));
const { COMBAT_KITS, starterEquipment, resolveCombat, regenerateCombat, skillRank, skillPointsAllowed,
  unspentSkillPoints, upgradeSkill, basicAttackDamage, skillPower, isInCombat } = await import(moduleUrl(code));
const state = () => ({health:60,maxHealth:100,resource:50,enemyHealth:100,nextAttack:0,nextSkill:0});
const equipmentCode = (await compile('../src/data/equipment.ts')).replace("'./inventory'",JSON.stringify(inventory)).replace("'./weapons'",JSON.stringify(weapons));
const {hasCombatWeapon,transferEquipment} = await import(moduleUrl(equipmentCode));

test('equipment preserves starter attacks and gives a modest tier one improvement to all five classes',()=>{
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    const starter=starterEquipment(cls), upgraded=structuredClone(starter);
    for(const [id,w] of Object.entries(WEAPONS)) if(w.cls===cls&&w.tier===1)upgraded[w.slot]={id,count:1};
    for(const level of [1,10,50])assert.equal(basicAttackDamage(cls,level,starter),basicAttackDamage(cls,level));
    for(const rank of [1,3,5])assert.equal(skillPower(cls,rank,starter),skillPower(cls,rank));
    const ratio=basicAttackDamage(cls,1,upgraded)/kit.damage;
    assert.ok(ratio>1&&ratio<=1.13,`${cls}: modest upgrade`);
    assert.ok(skillPower(cls,1,upgraded)>skillPower(cls,1,starter));
    const result=resolveCombat(cls,state(),'skill',10,0,1,1,upgraded);
    if(kit.skill.healing)assert.equal(result.healing,36);
    else assert.equal(result.damage[0],skillPower(cls,1,upgraded));
    assert.equal(result.state.resource,50-kit.skill.cost);
    assert.equal(result.state.nextSkill,10+kit.skill.cooldown);
  }
});

test('guard uses only a valid offhand, preserves zero damage and never grants immunity',()=>{
  for(const cls of ['guerrero','picaro']){
    const eq=starterEquipment(cls);
    assert.equal(guardedDamage(cls,eq,8),7);
    eq.offhand={id:Object.keys(WEAPONS).find(id=>WEAPONS[id].cls===cls&&WEAPONS[id].tier===1&&WEAPONS[id].slot==='offhand'),count:1};
    assert.equal(guardedDamage(cls,eq,8),6);
    assert.equal(guardedDamage(cls,eq,1),1);
    assert.equal(guardedDamage(cls,eq,0),0);
    eq.offhand.count=2; assert.equal(guardedDamage(cls,eq,8),8);
    eq.offhand={id:'escudo_inicial',count:1};
    if(cls==='picaro')assert.equal(guardedDamage(cls,eq,8),8);
  }
  const eq=starterEquipment('mago');eq.weapon={id:'espada_cobre_t1',count:1};
  assert.equal(equippedWeapon('mago',eq,'weapon'),undefined);
  assert.equal(basicAttackDamage('mago',1,eq),0);
  assert.throws(()=>resolveCombat('mago',state(),'attack',10,0,1,1,eq),/equipar/);
});

test('new weapons equip, swap and unequip through the existing inventory rules',()=>{
  for(const [id,w] of Object.entries(WEAPONS).filter(([,w])=>w.tier===1)){
    const data={cls:w.cls,health:-1,equipment:starterEquipment(w.cls),inventory:Array(25).fill(null)};
    data.inventory[0]={id,count:1}; const previous=structuredClone(data.equipment[w.slot]);
    transferEquipment(data,w.slot,0,data.inventory[0]);
    assert.equal(data.equipment[w.slot].id,id);assert.deepEqual(data.inventory[0],previous);
    transferEquipment(data,w.slot,null,data.equipment[w.slot]);
    assert.equal(data.inventory[1].id,id);
  }
});

test('server weapon catalog is identical to client equipment numbers',async()=>{
  const sql=await readFile(new URL('../supabase/server/05-weapon-stats.sql',import.meta.url),'utf8');
  const actual=Object.fromEntries([...sql.matchAll(/when '([^']+)' then '([^']+)'::jsonb/g)].map(([,id,json])=>[id,JSON.parse(json)]));
  assert.deepEqual(actual,WEAPONS);
  const catalog=await readFile(new URL('../supabase/server/05-items-vendors.sql',import.meta.url),'utf8');
  const itemFunction=catalog.split('create or replace function public.game_vendor_stock')[0];
  const itemRows=Object.fromEntries([...itemFunction.matchAll(/when '([^']+)' then '([^']+)'::jsonb/g)].map(([,id,json])=>[id,JSON.parse(json)]));
  for(const [id,w] of Object.entries(WEAPONS)){
    assert.equal(itemRows[id].value,ITEMS[id].value,`${id}: same price`);
    assert.equal(itemRows[id].stack,1);
    assert.equal(!!itemRows[id].bound,!!ITEMS[id].bound);
    assert.ok(ITEMS[id].stats.length>0);
    assert.ok(ITEMS[id].icon.length>0);
    if(w.tier===1)assert.ok(VENDOR_STOCK.testiculos.includes(id));
  }
  const stock=catalog.match(/when 'testiculos' then array\[([^\]]+)\]/)[1];
  assert.deepEqual([...stock.matchAll(/'([^']+)'/g)].map(([,id])=>id),VENDOR_STOCK.testiculos);
});

test('the eight Blender GLBs are self-contained single-mesh items within the triangle budget',async()=>{
  const { NodeIO } = await import('@gltf-transform/core');
  for(const [id,w] of Object.entries(WEAPONS).filter(([,w])=>w.tier===1)){
    const file=new URL(`../src/assets/models/items/tier1/${id}.glb`,import.meta.url);
    const doc=await new NodeIO().read(fileURLToPath(file));
    assert.equal(doc.getRoot().listMeshes().length,1,id);
    assert.equal(doc.getRoot().listMaterials().length,1,`${id}: one material`);
    assert.equal(doc.getRoot().listTextures().length,1,`${id}: embedded atlas`);
    assert.ok(doc.getRoot().listTextures()[0].getImage().length>0);
    assert.equal(doc.getRoot().listMeshes()[0].listPrimitives().length,1,`${id}: one draw call`);
    let triangles=0;
    for(const primitive of doc.getRoot().listMeshes()[0].listPrimitives()){
      triangles+=primitive.getIndices().getCount()/3;
      assert.ok(primitive.getMaterial());
      for(const name of ['POSITION','NORMAL','TEXCOORD_0'])assert.ok(Array.from(primitive.getAttribute(name).getArray()).every(Number.isFinite));
    }
    assert.ok(triangles>100&&triangles<2000,`${id}: ${triangles} triangles`);
  }
});

test('a pending mission enemy is not combat until an engagement occurs',()=>{
  assert.equal(isInCombat(null),false);
  assert.equal(isInCombat({status:'active',engaged:false}),false);
  assert.equal(isInCombat({status:'active',engaged:true}),true);
  for(const status of ['defeated','fled','failed'])assert.equal(isInCombat({status,engaged:true}),false);
});

test('local equipment transfers preserve all starter pieces, reject stale/class/full-bag changes and allow legacy unequip',()=>{
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    const data={cls,health:-1,equipment:starterEquipment(cls),inventory:Array(25).fill(null)};
    assert.equal(hasCombatWeapon(data),true);
    for(const slot of ['weapon','offhand']){
      const item=data.equipment[slot];if(!item)continue;
      const snapshot=structuredClone(item);
      transferEquipment(data,slot,null,snapshot);
      assert.equal(data.equipment[slot],null);
      assert.deepEqual(data.inventory[0],snapshot);
      if(slot==='weapon')assert.equal(hasCombatWeapon(data),false);
      assert.throws(()=>transferEquipment(data,slot,null,snapshot),/ha cambiado/);
      transferEquipment(data,slot,0,snapshot);
      assert.deepEqual(data.equipment[slot],snapshot);
      assert.equal(data.inventory[0],null);
    }
    assert.equal(data.equipment.weapon.id,kit.weapon);
    data.inventory.fill({id:'antorcha',count:1});
    const before=structuredClone(data);
    assert.throws(()=>transferEquipment(data,'weapon',null,data.equipment.weapon),/llena/);
    assert.deepEqual(data,before);
    data.inventory[0]={id:cls==='mago'?'espada_inicial':'baston_inicial',count:1,bound:true};
    assert.throws(()=>transferEquipment(data,'weapon',0,data.inventory[0]),/clase/);
  }
  const legacy={cls:'mago',health:-1,equipment:starterEquipment('guerrero'),inventory:Array(25).fill(null)};
  transferEquipment(legacy,'weapon',null,legacy.equipment.weapon);
  assert.equal(legacy.inventory[0].id,'espada_inicial');
  assert.throws(()=>transferEquipment(legacy,'weapon',0,legacy.inventory[0]),/clase/);
});

test('all five classes get distinct bound equipment in equipment slots, with fresh objects',()=>{
  const weapons=new Set();
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    const equipment=starterEquipment(cls);
    assert.equal(equipment.weapon.id,kit.weapon);
    weapons.add(equipment.weapon.id);
    for(const item of Object.values(equipment).filter(Boolean)){
      assert.equal(item.bound,true);assert.equal(item.count,1);
    }
    if(kit.offhand)assert.equal(equipment.offhand.id,kit.offhand);
    else assert.equal(equipment.offhand,null);
    equipment.weapon.count=20;
    assert.equal(starterEquipment(cls).weapon.count,1);
  }
  assert.equal(weapons.size,5);
});

test('provisional baseline damage accounts for melee risk and the cleric has a useful heal',()=>{
  const damageRates=Object.values(COMBAT_KITS).map(kit=>kit.damage/kit.interval);
  assert.ok(Math.max(...damageRates)/Math.min(...damageRates)<1.7);
  assert.ok(COMBAT_KITS.picaro.damage/COMBAT_KITS.picaro.interval>COMBAT_KITS.mago.damage/COMBAT_KITS.mago.interval);
  assert.equal(COMBAT_KITS.picaro.skill.cooldown,4.5);
  assert.equal(COMBAT_KITS.mago.damage,10);
  assert.equal(COMBAT_KITS.mago.skill.cost,20);
  assert.equal(COMBAT_KITS.mago.skill.cooldown,7);
  assert.equal(COMBAT_KITS.clerigo.damage,11);
  const cleric=COMBAT_KITS.clerigo;
  assert.equal(Math.round(cleric.damage*cleric.skill.power),32);
  assert.equal(cleric.skill.cost,12);
  assert.equal(cleric.skill.cooldown,6);
});

test('automatic attack rules enforce inclusive range, cadence and defeated targets without spending resource',()=>{
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    const before=state(), result=resolveCombat(cls,before,'attack',10,kit.range);
    assert.equal(result.state.enemyHealth,100-kit.damage);
    assert.equal(result.state.resource,50);
    assert.equal(result.state.nextAttack,10+kit.interval);
    assert.deepEqual(before,state(),'Resolver never mutates the input');
    assert.throws(()=>resolveCombat(cls,before,'attack',10,kit.range+.001),/alcance/);
    assert.throws(()=>resolveCombat(cls,result.state,'attack',10,0),/recuperando/);
    assert.doesNotThrow(()=>resolveCombat(cls,result.state,'attack',result.state.nextAttack,kit.range));
    assert.throws(()=>resolveCombat(cls,{...before,enemyHealth:0},'attack',10,0),/derrotado/);
  }
});

test('each offensive skill charges once, respects cooldown and emits the right number of impacts',()=>{
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    if(kit.skill.healing)continue;
    const result=resolveCombat(cls,state(),'skill',10,kit.range);
    assert.equal(result.state.resource,50-kit.skill.cost);
    assert.equal(result.damage.length,kit.skill.hits);
    assert.equal(result.state.enemyHealth,100-result.damage.reduce((a,b)=>a+b,0));
    assert.equal(result.state.nextSkill,10+kit.skill.cooldown);
    assert.throws(()=>resolveCombat(cls,result.state,'skill',10,0),/recuperando/);
    assert.throws(()=>resolveCombat(cls,{...state(),resource:kit.skill.cost-1},'skill',10,0),/recurso/);
    assert.doesNotThrow(()=>resolveCombat(cls,{...state(),resource:kit.skill.cost},'skill',10,kit.range));
  }
  const finishing=resolveCombat('picaro',{...state(),enemyHealth:3},'skill',10,0);
  assert.deepEqual(finishing.damage,[3,0]);assert.equal(finishing.state.enemyHealth,0);
});

test('cleric healing is self-targeted, caps at maximum health and does not damage the enemy',()=>{
  const result=resolveCombat('clerigo',{...state(),health:95,enemyHealth:0},'skill',10,500);
  assert.equal(result.healing,5);assert.equal(result.state.health,100);
  assert.equal(result.state.resource,38);assert.deepEqual(result.damage,[]);
  assert.throws(()=>resolveCombat('clerigo',{...state(),health:100},'skill',10,0),/vida completa/);
});

test('skill points accrue at every level from two, with five free-starting ranks and guarded permanent upgrades',()=>{
  for(const [level,points] of [[1,0],[2,1],[3,2],[4,3],[5,4],[8,7],[50,49]])assert.equal(skillPointsAllowed(level),points);
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    const data={cls,level:1,skillRanks:{}};
    assert.equal(skillRank(data),1);assert.equal(unspentSkillPoints(data),0);
    assert.throws(()=>upgradeSkill(data,kit.skill.id,1),/nivel/);
    data.level=5;
    assert.equal(unspentSkillPoints(data),4,'Existing levels grant points without a migration');
    assert.throws(()=>upgradeSkill(data,cls==='clerigo'?'heavy_strike':'healing',1),/clase/);
    for(let rank=1;rank<5;rank++){
      upgradeSkill(data,kit.skill.id,rank);
      assert.equal(skillRank(data),rank+1);assert.equal(unspentSkillPoints(data),4-rank);
      assert.throws(()=>upgradeSkill(data,kit.skill.id,rank),/cambiado/,'A repeated or concurrent request cannot spend twice');
    }
    assert.throws(()=>upgradeSkill(data,kit.skill.id,5),/máximo/);
    assert.equal(unspentSkillPoints({...data,level:50}),45,'Unused points remain available for future skills');
    assert.equal(skillRank({...data,level:2}),2,'Invalid over-budget ranks cannot leak into combat');
  }
});

test('each class skill uses rank power independently of level-scaled basic attacks',()=>{
  for(const [cls,expected] of [
    ['guerrero',[18,20,22,24,26]],['mago',[18,20,22,24,26]],
    ['picaro',[8,9,10,11,12]],['clerigo',[32,36,40,44,48]],['explorador',[19,21,23,25,27]],
  ]){
    const kit=COMBAT_KITS[cls];
    for(let rank=1;rank<=5;rank++){
      assert.equal(skillPower(cls,rank),expected[rank-1]);
      const result=resolveCombat(cls,{...state(),health:1},'skill',10,0,8,rank);
      if(cls==='clerigo')assert.equal(result.healing,expected[rank-1]);
      else assert.deepEqual(result.damage,Array(kit.skill.hits).fill(expected[rank-1]));
      assert.equal(result.state.resource,50-kit.skill.cost);
      assert.equal(result.state.nextSkill,10+kit.skill.cooldown);
    }
    for(const level of [1,2,4,8,20,50]){
      const expectedDamage=Math.round(kit.damage*(1+.05*(level-1)));
      assert.equal(basicAttackDamage(cls,level),expectedDamage);
      const result=resolveCombat(cls,{...state(),enemyHealth:1000},'attack',10,0,level,1);
      assert.deepEqual(result.damage,[expectedDamage]);
      assert.equal(result.state.resource,50);
      assert.equal(result.state.nextAttack,10+kit.interval);
    }
    assert.throws(()=>resolveCombat(cls,state(),'skill',10,0,1,5),/no válido/);
  }
});

test('dead actors, invalid inputs and invalid commands cannot resolve actions',()=>{
  assert.throws(()=>resolveCombat('mago',{...state(),health:0},'skill',10,0),/vida/);
  for(const value of [NaN,Infinity,-1]){
    assert.throws(()=>resolveCombat('mago',state(),'attack',value,0),/no válido/);
    assert.throws(()=>resolveCombat('mago',state(),'attack',10,value),/no válido/);
  }
  assert.throws(()=>resolveCombat('mago',state(),'admin-kill',10,0),/no válida/);
  assert.throws(()=>resolveCombat('mago',{...state(),health:101},'attack',10,0),/no válido/);
});

test('gradual regeneration preserves fractions, slows health in combat, caps values and never revives',()=>{
  const initial={...state(),resource:0};
  const outside=regenerateCombat(initial,80,'stamina',10,false);
  assert.equal(outside.health,70);assert.equal(outside.resource,32);
  const inside=regenerateCombat(initial,80,'mana',10,true);
  assert.equal(inside.health,62.5);assert.equal(inside.resource,16);
  let frames={...initial};
  for(let i=0;i<100;i++)frames=regenerateCombat(frames,80,'mana',.1,true);
  assert.ok(Math.abs(frames.health-inside.health)<1e-8);
  assert.ok(Math.abs(frames.resource-inside.resource)<1e-8);
  const full=regenerateCombat(initial,80,'stamina',10000,false);
  assert.equal(full.health,100);assert.equal(full.resource,80);
  const dead={...initial,health:0};
  assert.deepEqual(regenerateCombat(dead,80,'mana',100,false),dead);
  assert.deepEqual(initial,{...state(),resource:0});
  assert.throws(()=>regenerateCombat(initial,80,'mana',-1,false),/no válido/);
});

test('combat workbench selects targets, approaches, attacks, spends resource and cancels on manual movement', {timeout:45000}, async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4176','--strictPort']);
  let browser;
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Combat workbench server did not start')),15000);
      server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));
      server.stdout.on('data',data=>{if(data.toString().includes('4176')){clearTimeout(timer);resolve();}});
      server.stderr.on('data',data=>process.stderr.write(data));
    });
    assert.equal((await fetch('http://127.0.0.1:4176/combat.html')).status,200);
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4176/combat.html');
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='Selecciona al rival para empezar.');
    await page.locator('#attack').click();
    assert.equal(await page.locator('#status').textContent(),'Selecciona un objetivo.');
    await page.locator('#target').click();
    await page.locator('#attack').click();
    await page.waitForFunction(()=>document.querySelector('#distance').textContent.includes('Acercándote'));
    await page.locator('#move').click();
    await page.waitForTimeout(1000);
    const position=await page.locator('#combat-scene').getAttribute('data-player-x');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#combat-scene').getAttribute('data-player-x'),position,'Manual movement cancels automatic approach');
    for(const cls of Object.keys(COMBAT_KITS)){
      await page.locator('#class').selectOption(cls);
      const expected=starterEquipment(cls);
      assert.ok((await page.locator('#equipment').textContent()).length>0);
      await page.locator('#target').click();
      await page.locator('#attack').click();
      try {
        await page.waitForFunction(()=>document.querySelector('#enemy').value<100,{},{timeout:8000});
      } catch(error) {
        throw new Error(`${cls}: ${await page.locator('#distance').textContent()}; ${await page.locator('#status').textContent()}; browser errors: ${errors.join('; ')}`,{cause:error});
      }
      const moved=await page.locator('#combat-scene').getAttribute('data-player-x');
      assert.ok(Number(moved)>-5,`${cls}: real 3D actor approaches the target`);
      await page.waitForFunction(()=>Number(document.querySelector('#combat-scene').dataset.attacks)>0);
      await page.locator('#stop').click();
      const resource=await page.locator('#resource').evaluate(meter=>meter.value);
      if(cls==='clerigo'){
        await page.locator('#skill').click();
        assert.match(await page.locator('#status').textContent(),/vida completa/);
        assert.equal(await page.locator('#resource').evaluate(meter=>meter.value),resource);
      }else{
        await page.locator('#skill').click();
        const after=await page.locator('#resource').evaluate(meter=>meter.value);
        const cost=COMBAT_KITS[cls].skill.cost;
        assert.ok(after>=resource-cost&&after<resource-cost+1,`${cls}: skill cost followed by gradual regeneration`);
        assert.equal(await page.locator('#skill').isDisabled(),true);
        if(cls==='mago'){
          await page.waitForTimeout(1100);
          const regenerated=await page.locator('#resource').evaluate(meter=>meter.value);
          assert.ok(regenerated-after>1&&regenerated-after<3,'Mana regenerates continuously in the running 3D arena');
        }
      }
      await page.locator('#reset').click();
      await page.locator('#combat-scene').click({position:{x:30,y:30}});
      await page.keyboard.down('KeyD');await page.waitForTimeout(300);await page.keyboard.up('KeyD');
      assert.ok(Number(await page.locator('#combat-scene').getAttribute('data-player-x'))>-5,'WASD moves the real actor');
      assert.ok(expected.weapon.bound);
    }
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();
    if(server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
  }
});
