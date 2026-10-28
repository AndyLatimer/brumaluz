import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export * from './src/data/combat';export * from './src/data/stats';export * from './src/data/data';export * from './src/data/weapons';export * from './src/data/shadowCombat';export {default as duration} from './src/data/combatDuration.json';export {WILDERNESS} from './src/data/wilderness';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const game=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const character=(cls,level=1)=>({...game.defaultChar(),cls,level,equipment:game.starterEquipment(cls)});
function metrics(d){return {basic:game.basicAttackDamage(d.cls,d.level,d.equipment,d),skill:game.skillPower(d.cls,1,d.equipment,d),cost:game.skillCost(d),interval:game.attackInterval(d.cls,d.equipment,d),health:game.maxHealthOf(d),resource:game.maxResourceOf(d),incoming:game.guardedDamage(d.cls,d.equipment,100,d)};}

test('each of the seven attributes has a working benefit for each of the five classes',()=>{
 for(const cls of Object.keys(game.COMBAT_KITS))for(const attr of Object.keys(game.ATTRIBUTES)){
  const d=character(cls),before=metrics(d);d.attributePoints={...d.attributePoints,[attr]:d.attributePoints[attr]+1};const after=metrics(d);
  const benefit={fuerza:after.basic>before.basic,intelecto:after.cost<before.cost,corpulencia:after.health>before.health,agilidad:after.interval<before.interval,pericia:after.skill>before.skill,presencia:after.resource>before.resource,percepcion:after.incoming<before.incoming};
  assert.ok(benefit[attr],`${cls}: ${attr} must improve a real derived stat`);
 }
});

test('attribute stacking stays bounded and no class attacks faster than its animation',()=>{
 for(const cls of Object.keys(game.COMBAT_KITS))for(const level of [1,10,50]){
  const d=character(cls,level);for(const attr of Object.keys(game.ATTRIBUTES))d.attributePoints[attr]=1000;
  const m=metrics(d);assert.ok(m.cost>=game.COMBAT_KITS[cls].skill.cost*.75-1e-9);
  assert.ok(m.interval>=game.duration[cls].basic+.04-1e-9);
  assert.ok(m.incoming>0&&m.incoming<=100);
 }
});

test('starting class damage stays close while every normal monster survives enough to respond',()=>{
 const offensive=[];
 for(const [cls,kit]of Object.entries(game.COMBAT_KITS)){
  const d=character(cls),m=metrics(d),dps=m.basic/m.interval+(kit.skill.healing?0:m.skill*kit.skill.hits/kit.skill.cooldown);
  if(!kit.skill.healing)offensive.push(dps);
  for(const enemy of Object.values(game.WILDERNESS.enemies)){
   const guard=1-Math.min(.6,enemy.guard/(enemy.guard+20));
   const seconds=enemy.health/(dps*guard);
   assert.ok(seconds>=6&&seconds<=18,`${cls} vs ${enemy.label}: estimated ${seconds.toFixed(2)} seconds`);
  }
 }
 assert.ok(Math.max(...offensive)/Math.min(...offensive)<1.2,'Offensive starter rotations remain within 20% before movement and mitigation');
});

test('the shadow fights with ordinary melee strikes and ranged bolts without area phases',()=>{
 assert.ok(game.SHADOW_COMBAT.range>Math.max(...Object.values(game.COMBAT_KITS).map(kit=>kit.range)));
 for(let sequence=0;sequence<12;sequence++){assert.equal(game.shadowAttack(8,sequence),'bolt');assert.equal(game.shadowAttack(1,sequence),'melee');}
 assert.equal(game.shadowAttack(1,1),'melee');
 assert.ok(game.SHADOW_COMBAT.damage.bolt>0);assert.ok(game.shadowWindup('bolt')<game.shadowWindup('area'));
});
