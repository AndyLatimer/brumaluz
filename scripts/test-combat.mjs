import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createServer } from 'vite';
import { sqlFunction } from './runtime-performance-sql.mjs';

const bundle = await build({stdin:{contents:`export { WEAPONS, guardedDamage, equippedWeapon } from './src/data/weapons';
export { ITEMS, VENDOR_STOCK } from './src/data/items';
export { defaultChar } from './src/data/data';
export { COMBAT_KITS, starterEquipment, resolveCombat, regenerateCombat, skillRank, skillPointsAllowed,
  unspentSkillPoints, upgradeSkill, basicAttackDamage, skillPower, isInCombat } from './src/data/combat';
export { EQUIPPABLE, hasCombatWeapon, transferEquipment } from './src/data/equipment';`,
  resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',plugins:[{
    name:'test-vite-glob-stub',
    setup(builder){builder.onLoad({filter:/\.[jt]sx?$/},async args=>{
      const contents=await readFile(args.path,'utf8');
      if(!contents.includes('import.meta.glob'))return;
      const loader=args.path.endsWith('.tsx')?'tsx':args.path.endsWith('.ts')?'ts':args.path.endsWith('.jsx')?'jsx':'js';
      return {contents:contents.replace(/import\.meta\.glob(?:<[^>]+>)?\s*\(/g,'(() => ({}))('),loader};
    });}
  }]});
const game = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const { WEAPONS, guardedDamage, equippedWeapon, ITEMS, VENDOR_STOCK, defaultChar, COMBAT_KITS, starterEquipment, resolveCombat,
  regenerateCombat, skillRank, skillPointsAllowed, unspentSkillPoints, upgradeSkill, basicAttackDamage, skillPower,
  isInCombat, EQUIPPABLE, hasCombatWeapon, transferEquipment } = game;
const state = () => ({health:60,maxHealth:100,resource:50,enemyHealth:100,nextAttack:0,nextSkill:0});

test('equipment preserves starter attacks and gives a modest tier one improvement to all five classes',()=>{
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    const starter=starterEquipment(cls), upgraded=structuredClone(starter);
    for(const [id,w] of Object.entries(WEAPONS)) if(w.cls===cls&&w.tier===1)upgraded[w.slot]={id,count:1};
    for(const level of [1,10,50])assert.equal(basicAttackDamage(cls,level,starter),basicAttackDamage(cls,level));
    for(const rank of [1,3,5])assert.ok(skillPower(cls,rank,starter)>0);
    const ratio=basicAttackDamage(cls,1,upgraded)/kit.damage;
    assert.ok(ratio>1&&ratio<=1.13,`${cls}: modest upgrade`);
    assert.ok(skillPower(cls,1,upgraded)>skillPower(cls,1,starter));
    const result=resolveCombat(cls,state(),'skill',10,0,1,1,upgraded);
    const expected=skillPower(cls,1,upgraded,undefined,kit.skill.id);
    if(kit.skill.mode==='healing')assert.equal(result.healing,Math.min(state().maxHealth-state().health,expected));
    else assert.equal(result.damage[0],expected);
    assert.equal(result.state.resource,50-kit.skill.cost);
    assert.equal(result.state.nextSkill,10+kit.skill.cooldown);
  }
});

test('guard uses only a valid offhand, preserves zero damage and never grants immunity',()=>{
  for(const cls of ['guerrero','picaro']){
    const eq=starterEquipment(cls);
    const unguarded=guardedDamage(cls,{...eq,offhand:null},8);
    assert.ok(unguarded>0&&unguarded<=8);
    assert.ok(guardedDamage(cls,eq,8)<=unguarded);
    eq.offhand={id:Object.keys(WEAPONS).find(id=>WEAPONS[id].cls===cls&&WEAPONS[id].tier===1&&WEAPONS[id].slot==='offhand'),count:1};
    assert.ok(guardedDamage(cls,eq,8)<unguarded);
    assert.ok(guardedDamage(cls,eq,1)>0);
    assert.equal(guardedDamage(cls,eq,0),0);
    eq.offhand.count=2; assert.equal(guardedDamage(cls,eq,8),unguarded);
    eq.offhand={id:'escudo_inicial',count:1};
    if(cls==='picaro')assert.equal(guardedDamage(cls,eq,8),unguarded);
  }
  const eq=starterEquipment('mago');eq.weapon={id:'espada_cobre_t1',count:1};
  assert.equal(equippedWeapon('mago',eq,'weapon'),undefined);
  assert.equal(basicAttackDamage('mago',1,eq),0);
  assert.throws(()=>resolveCombat('mago',state(),'attack',10,0,1,1,eq),/equipar/);
});

test('new weapons equip, swap and unequip through the existing inventory rules',()=>{
  for(const [id,w] of Object.entries(WEAPONS).filter(([,w])=>w.tier===1)){
    const data={...defaultChar(),cls:w.cls,equipment:starterEquipment(w.cls),inventory:Array(25).fill(null)};
    data.inventory[0]={id,count:1}; const previous=structuredClone(data.equipment[w.slot]);
    transferEquipment(data,w.slot,0,data.inventory[0]);
    assert.equal(data.equipment[w.slot].id,id);assert.deepEqual(data.inventory[0],previous);
    transferEquipment(data,w.slot,null,data.equipment[w.slot]);
    assert.equal(data.inventory[1].id,id);
  }
});

test('server equipment catalog is identical to client equipment numbers',async()=>{
  const sql=await readFile(new URL('../supabase/server/05-weapon-stats.sql',import.meta.url),'utf8');
  const fields=['cls','slot','tier','kind','guard','power','healing','maxHealth','maxResource'];
  const expected=Object.fromEntries(Object.entries(EQUIPPABLE).map(([id,item])=>[
    id,Object.fromEntries(fields.filter(key=>item[key]!==undefined).map(key=>[key,item[key]])),
  ]));
  const equipmentFunction=sqlFunction(sql,'game_equipment_item');
  const actual=Object.fromEntries([...equipmentFunction.matchAll(/when '([^']+)' then '([^']+)'::jsonb/g)].map(([,id,json])=>[id,JSON.parse(json)]));
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort());
  for(const [id,item] of Object.entries(expected))assert.deepEqual(actual[id],item,`${id}: server equipment metadata`);
  const itemFunction=sqlFunction(sql,'game_item');
  const itemRows=Object.fromEntries([...itemFunction.matchAll(/when '([^']+)' then '([^']+)'::jsonb/g)].map(([,id,json])=>[id,JSON.parse(json)]));
  for(const id of Object.keys(WEAPONS)){
    assert.equal(itemRows[id].value,ITEMS[id].value,`${id}: same price`);
    assert.equal(itemRows[id].stack,1);
    assert.equal(!!itemRows[id].bound,!!ITEMS[id].bound);
    assert.ok(ITEMS[id].stats.length>0);
    assert.ok(ITEMS[id].icon.length>0);
  }
  for(const id of ['espada_cobre_t1','escudo_roble_t1','baston_ambar_t1','daga_cazador_t1',
    'daga_secundaria_cazador_t1','varita_ambar_t1','grimorio_verde_t1','ballesta_roble_t1'])
    assert.ok(VENDOR_STOCK.testiculos.includes(id),`${id}: provisional vendor stock`);
  const stock=sqlFunction(sql,'game_vendor_stock').match(/when 'testiculos' then array\[([^\]]+)\]/)[1];
  assert.deepEqual([...stock.matchAll(/'([^']+)'/g)].map(([,id])=>id),VENDOR_STOCK.testiculos);
});

test('tier-one weapon GLBs are self-contained and within the geometry budget',async()=>{
  const { NodeIO } = await import('@gltf-transform/core');
  const manifest=JSON.parse(await readFile(new URL('../src/assets/models/items/weapon_manifest.json',import.meta.url),'utf8'));
  const entries=manifest.filter(item=>WEAPONS[item.id]?.tier===1);
  assert.deepEqual(entries.map(item=>item.id).sort(),Object.entries(WEAPONS).filter(([,w])=>w.tier===1).map(([id])=>id).sort());
  for(const {id,model} of entries){
    const file=new URL(model,new URL('../src/assets/models/items/',import.meta.url));
    const doc=await new NodeIO().read(fileURLToPath(file));
    assert.equal(doc.getRoot().listMeshes().length,1,id);
    const materials=doc.getRoot().listMaterials(),textures=doc.getRoot().listTextures();
    assert.ok(materials.length>0&&materials.length<=2,`${id}: material budget`);
    assert.ok(textures.length>0&&textures.length<=2,`${id}: texture budget`);
    for(const texture of textures)assert.ok(texture.getImage()?.length>0,`${id}: embedded texture`);
    assert.ok(doc.getRoot().listMeshes()[0].listPrimitives().length<=2,`${id}: draw-call budget`);
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
    const data={...defaultChar(),cls,equipment:starterEquipment(cls),inventory:Array(25).fill(null)};
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
      assert.match(data.equipment[slot].instanceId,/^[a-f0-9-]{36}$/);
      assert.deepEqual(data.equipment[slot],{...snapshot,instanceId:data.equipment[slot].instanceId});
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
  const legacy={...defaultChar(),cls:'mago',equipment:starterEquipment('guerrero'),inventory:Array(25).fill(null)};
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
  assert.equal(Math.round(cleric.skill.baseHealing*cleric.skill.power),32);
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

test('all class skills charge once, respect cooldown and resolve the right effect',()=>{
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    for(const skill of kit.skills){
      const level=skill.unlockLevel;
      const current={...state(),enemyHealth:1000};
      const result=resolveCombat(cls,current,skill.id,10,kit.range,level);
      const expected=skillPower(cls,1,undefined,undefined,skill.id)*(1+.02*(level-1));
      assert.equal(result.state.resource,50-skill.cost,`${cls}/${skill.id}: resource`);
      assert.equal(result.state.skillReadyAt[skill.id],10+skill.cooldown,`${cls}/${skill.id}: cooldown`);
      if(skill.mode==='healing'){
        assert.equal(result.healing,Math.min(current.maxHealth-current.health,expected),`${cls}/${skill.id}: healing`);
        assert.deepEqual(result.damage,[]);
      }else{
        assert.equal(result.damage.length,skill.hits,`${cls}/${skill.id}: hits`);
        assert.ok(result.damage.every(hit=>hit===expected),`${cls}/${skill.id}: per-hit damage`);
        assert.ok(Math.abs(result.state.enemyHealth-(1000-result.damage.reduce((a,b)=>a+b,0)))<1e-8);
      }
      assert.throws(()=>resolveCombat(cls,result.state,skill.id,10,0,level),/recuperando/);
      assert.throws(()=>resolveCombat(cls,{...current,resource:skill.cost-1},skill.id,10,0,level),/recurso/);
      assert.doesNotThrow(()=>resolveCombat(cls,{...current,resource:skill.cost},skill.id,10,kit.range,level));
    }
  }
  const finishing=resolveCombat('picaro',{...state(),enemyHealth:3},'skill',10,0);
  assert.deepEqual(finishing.damage,[3,0]);assert.equal(finishing.state.enemyHealth,0);
});

test('skill cooldowns are independent and remain valid combat state',()=>{
  const [first,second]=COMBAT_KITS.picaro.skills;
  const useFirst=resolveCombat('picaro',state(),first.id,10,0);
  assert.equal(useFirst.state.skillReadyAt[first.id],10+first.cooldown);
  assert.throws(()=>resolveCombat('picaro',useFirst.state,first.id,10,0),/recuperando/);
  const useSecond=resolveCombat('picaro',useFirst.state,second.id,10,0);
  assert.equal(useSecond.state.skillReadyAt[first.id],10+first.cooldown);
  assert.equal(useSecond.state.skillReadyAt[second.id],10+second.cooldown);
  assert.equal(useSecond.state.resource,50-first.cost-second.cost);
  assert.doesNotThrow(()=>regenerateCombat(useSecond.state,100,'stamina',1,true));
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

test('all class skill ranks scale independently of level-scaled basic attacks',()=>{
  for(const [cls,kit] of Object.entries(COMBAT_KITS)){
    for(const skill of kit.skills){
      for(let rank=1;rank<=5;rank++){
        const level=skill.unlockLevel+rank-1;
        const expected=skillPower(cls,rank,undefined,undefined,skill.id)*(1+.02*(level-1));
        const result=resolveCombat(cls,state(),skill.id,10,0,level,rank);
        assert.equal(result.state.resource,50-skill.cost);
        assert.equal(result.state.skillReadyAt[skill.id],10+skill.cooldown);
        if(skill.mode==='healing')assert.equal(result.healing,Math.min(state().maxHealth-state().health,expected));
        else{
          assert.equal(result.damage.length,skill.hits);
          assert.ok(result.damage.every(hit=>hit===expected),`${cls}/${skill.id}, rank ${rank}`);
        }
      }
    }
    for(const level of [1,2,4,8,20,50]){
      const expectedDamage=kit.damage*(1+.02*(level-1));
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

test('combat workbench selects targets, approaches, attacks, spends resource and cancels on manual movement', {timeout:90000}, async()=>{
  const server=await createServer({optimizeDeps:{noDiscovery:true,entries:[]},
    server:{host:'127.0.0.1',port:4176,strictPort:true,hmr:false,watch:null},logLevel:'error'});
  let browser;
  try{
    await server.listen();
    assert.equal((await fetch('http://127.0.0.1:4176/combat.html')).status,200);
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
    const page=await browser.newPage();
    const errors=[];let crashed=false;
    page.on('pageerror',error=>errors.push(error.message));
    page.on('crash',()=>{crashed=true;errors.push('La página de combate dejó de responder.');});
    await page.goto('http://127.0.0.1:4176/combat.html',{waitUntil:'commit'});
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Selecciona al rival para empezar.',null,{timeout:60000});
    await page.locator('#attack').click();
    assert.equal(await page.locator('#status').textContent(),'Selecciona un objetivo.');
    await page.locator('#target').click();
    await page.locator('#move').click();
    await page.waitForFunction(()=>Number(document.querySelector('#distance').textContent.match(/Distancia: ([\d.]+)/)?.[1])>1.8);
    await page.locator('#attack').click();
    await page.waitForFunction(()=>document.querySelector('#distance').textContent.includes('Acercándote'));
    await page.locator('#move').click();
    const distance=Number((await page.locator('#distance').textContent()).match(/Distancia: ([\d.]+)/)?.[1]);
    await page.waitForFunction(previous=>Number(document.querySelector('#distance').textContent.match(/Distancia: ([\d.]+)/)?.[1])>previous, distance);
    assert.ok(await page.locator('#status').textContent()==='Movimiento manual: aproximación interrumpida.');
    for(const cls of Object.keys(COMBAT_KITS)){
      await page.locator('#class').selectOption(cls);
      const expected=starterEquipment(cls);
      assert.ok((await page.locator('#equipment').textContent()).length>0);
      await page.locator('#target').click();
      await page.locator('#attack').click();
      try {
        await page.waitForFunction(()=>document.querySelector('#enemy').value<100,{},{timeout:15000});
      } catch(error) {
        if(page.isClosed()||crashed)throw new Error(`${cls}: el navegador cerró la prueba de combate; ${errors.join('; ')}`,{cause:error});
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
    await server.close();
  }
});
