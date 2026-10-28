// Controlled combat/price benchmark: real SQL for player attacks, isolated database.
// No real credentials, player records or live writes. Not a human playtest or pathfinding benchmark.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fixture} from '../scripts/obtainability-fixture.mjs';
const read=async name=>readFile(new URL(`../supabase/server/${name}`,import.meta.url),'utf8');
const fn=(source,name)=>{const start=source.indexOf(`create or replace function public.${name}(`);if(start<0)throw Error(name);return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);};
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8')),wild=JSON.parse(await readFile('src/data/generated/wilderness.json','utf8'));
const bundle=await build({stdin:{contents:"export * from './src/data/data';export * from './src/data/combat';export * from './src/data/stats';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const game=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`),f=await fixture();
const checks=[],battles=[];
try{
 const formulas=await read('03-formulas.sql'),foundation=await read('19-rpg-foundation.sql'),equipment=await read('05-weapon-stats.sql'),items=await read('05-items-vendors.sql');
 await f.db.exec("drop function public.game_equipment_item(text);alter table world_players add column dead boolean default false;create table server_config(key text,value jsonb);insert into server_config values('combat_enabled','true');create function public.game_overheal_now(d jsonb) returns int language sql as $$select 0$$;create function public.game_rpg_sight(loc text,x1 numeric,z1 numeric,x2 numeric,z2 numeric) returns boolean language sql as $$select true$$;");
 for(const name of ['game_equipment_item','game_equipment_stat'])await f.db.exec(fn(equipment,name));
 await f.db.exec(fn(items,'game_has_weapon'));
 for(const name of ['game_race_bonus','game_attr_total','game_skill_id','game_skill_rank'])await f.db.exec(fn(formulas,name));
 for(const name of ['game_set_bonuses','game_power_multiplier','game_guard_multiplier','game_strength_power','game_expertise_power','game_intellect_efficiency','game_agility_tempo','game_weapon_tempo','game_rpg_food_bonus','game_max_health','game_rpg_resource_max','game_public_vitals'])await f.db.exec(fn(foundation,name));
 await f.db.exec(fn(formulas,'game_health'));
 await f.db.exec(fn(await read('26-wilderness-generated.sql'),'game_wilderness_hit').replaceAll('clock_timestamp()','public.test_now()'));
 for(const cls of Object.keys(game.COMBAT_KITS))for(const enemyId of ['salteador','jabali_cuero_1','jabali_cuero_2','jabali_cuero_3','jabali_cuero_4','jabali_cuero_5']){
  const enemy=wild.enemies[enemyId],tier=enemyId==='salteador'?0:Number(enemyId.at(-1)),level=tier?enemy.level:1,gearTier=Math.max(0,tier-1),d={...game.defaultChar(),cls,level,location:'pompelin',equipment:game.starterEquipment(cls)};
  if(gearTier)for(const slot of ['weapon','offhand','head','chest','hands','legs']){
   const item=Object.entries(catalog.equipment).find(([,meta])=>meta.cls===cls&&meta.tier===gearTier&&meta.slot===slot);
   if(item)d.equipment[slot]={id:item[0],count:1,bound:true};
  }
  d.skillRanks={[game.COMBAT_KITS[cls].skill.id]:Math.min(5,level)};d.health=game.maxHealthOf(d);d.resource=game.maxResourceOf(d);
  d.combatEncounter={id:'wild_enemy',kind:'wilderness',status:'active',engaged:true,health:enemy.health,maxHealth:enemy.health,guard:enemy.guard,x:0,z:0,instanceId:`pace-${cls}-${tier}`};
  await f.seed(d);await f.move({location:'pompelin',x:1,z:0});
  const maximumResource=d.resource,rate=['mago','clerigo'].includes(cls)?.02:.04;
  let time=0,last=0,nextBasic=0,nextSkill=cls==='clerigo'?Infinity:0,basicHits=0,skills=0,spent=0;
  for(let guard=0;guard<20000;guard++){
   time=Math.min(nextBasic,nextSkill);if(time>900)throw Error(`Combat exceeded benchmark limit: ${cls}/${enemyId}`);
   await f.step(Math.max(0,time-last));const current=await f.data(),resource=Math.min(maximumResource,current.resource+(time-last)*maximumResource*rate);last=time;
   await f.db.query("update characters set data=jsonb_set(data,'{resource}',$2::jsonb) where id=$1",[f.id,JSON.stringify(resource)]);
   const action=nextBasic<=nextSkill?'attack':'skill';
   if(action==='skill'&&resource+1e-8<game.skillCost({...d,resource})){nextSkill=time+.25;continue;}
   const result=(await f.db.query('select public.game_wilderness_hit($1,$2) result',[f.id,action])).rows[0].result;
   if(action==='attack'){basicHits++;nextBasic=time+Number(result.attackCooldown);}else{skills++;nextSkill=time+Number(result.skillCooldown);spent+=Math.max(0,resource-Number(result.vitals.resource));}
   if(result.encounter.status==='defeated')break;
  }
  const mitigation=Number((await f.db.query('select public.game_guard_multiplier($1) multiplier',[d])).rows[0].multiplier);
  const incomingHits=Math.max(0,1+Math.floor((time-.8-enemy.windup)/enemy.interval));
  battles.push({cls,enemy:enemyId,level,gearTier,seconds:Math.round(time*10)/10,basicHits,skills,resourceSpent:Math.round(spent),health:d.health,standingDamageEstimate:Math.round(incomingHits*enemy.damage*mitigation),note:'Player hits use production SQL. Incoming damage is a cadence estimate, without dodging, movement, heavy-attack variation, healing or health regeneration.'});
 }
 checks.push('Thirty class/enemy builds resolved through production SQL attack and skill functions with controlled time, real equipment stats and resource regeneration.');
 const recipe=catalog.recipes.espada_cobre_t1,component=catalog.recipes.componente_herreria_0,startingMoney=5,toolCost=20,firstCraftCost=toolCost+component.price+recipe.price;
 const banditKills=Math.ceil((firstCraftCost-startingMoney)/wild.enemies.salteador.coins);
 const initial=battles.filter(b=>b.enemy==='salteador');
 const conversion=Array.from({length:5},(_,i)=>{
  const tier=i+1,recipe=catalog.recipes[`curtir_cuero_${tier}`];let work=0,herbs=0;
  for(let step=1;step<=tier;step++){const batches=4**(tier-step);work+=batches*catalog.recipes[`curtir_cuero_${step}`].seconds;herbs+=batches*2;}
  return{tier,lowerHides:4,herbs:2,secondsPerUnit:recipe.seconds,basicHidesForFullChain:4**tier,herbsForFullChain:herbs,secondsForFullChain:work,source:recipe.source};
 });
 const report={scope:'Controlled benchmark, not a human session. SQL resolves outgoing attacks; travel, route contention, latency, enemy navigation and player choices are not timed.',checks,battles,firstCraft:{startingMoney,toolCost,componentRecipe:component.price,weaponRecipe:recipe.price,total:firstCraftCost,banditKillsWithoutSellingLoot:banditKills,pureCombatSecondsAtLevelOne:initial.map(b=>({cls:b.cls,seconds:Math.round(b.seconds*banditKills)})),note:'Level-one costs held constant for comparison; real leveling, loot sales, travel, recovery and competition change session duration.'},conversion,rareRecipes:{...catalog.rareRecipeDrop,pool:Object.values(catalog.recipes).filter(r=>r.source==='drop').length,expectedKillsForAny:1/catalog.rareRecipeDrop.chance,killsForHalfChance:Math.ceil(Math.log(.5)/Math.log(1-catalog.rareRecipeDrop.chance)),note:'Independent chance per qualifying personal reward; no guarantee, no pity timer.'}};
 await mkdir('art/recipe-training-review',{recursive:true});await writeFile('art/recipe-training-review/pace-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({firstCraft:report.firstCraft,conversion,rareRecipes:report.rareRecipes,battles:battles.length}));
}finally{await f.db.close();}
