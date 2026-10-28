// Read-only audit of the active gathering/crafting/outdoor-combat circuit.
// Retired expeditions, debug grants and player-to-player redistribution are not sources.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function auditObtainability(catalog, wilderness) {
 const recipes=Object.values(catalog.recipes), sources=new Map();
 const add=(item,source)=>{if(!sources.has(item))sources.set(item,[]);sources.get(item).push(source);};
 for(const node of Object.values(catalog.nodes))add(node.item,{kind:'gathering',id:node.id,job:node.job,tier:node.tier});
 const activeEnemies=new Set(wilderness.spawns.map(spawn=>spawn.enemy));
 for(const [id,enemy]of Object.entries(wilderness.enemies))if(activeEnemies.has(id))
  for(const item of Object.keys(enemy.loot??{}))add(item,{kind:'combat',id,level:enemy.level});
 // Fixed point: a recipe's result is obtainable only when all of its ingredients are.
 // This checks physical materials, separately from recipe learning and profession ranks.
 const obtainable=new Set(sources.keys());
 let changed=true;
 while(changed){changed=false;for(const recipe of recipes)if(!obtainable.has(recipe.output)&&Object.keys(recipe.ingredients).every(id=>obtainable.has(id))){obtainable.add(recipe.output);changed=true;}}
 const missingIngredients=[...new Set(recipes.flatMap(recipe=>Object.keys(recipe.ingredients)))].filter(id=>!obtainable.has(id)).sort();
 const blockedRecipes=recipes.filter(recipe=>!Object.keys(recipe.ingredients).every(id=>obtainable.has(id))).map(recipe=>({id:recipe.id,job:recipe.job,tier:recipe.tier,missing:Object.keys(recipe.ingredients).filter(id=>!obtainable.has(id))}));
 const firstUpgrades=Object.keys(wilderness.enemies).length?Object.fromEntries(['guerrero','mago','picaro','clerigo','explorador'].map(cls=>{
  const choices=recipes.filter(recipe=>recipe.tier===1&&catalog.equipment[recipe.output]?.cls===cls&&catalog.equipment[recipe.output]?.slot==='weapon');
  return [cls,choices.map(recipe=>({id:recipe.id,job:recipe.job,ingredientsObtainable:obtainable.has(recipe.output)}))];
 })):{};
 return {scope:'Active gathering, crafting and outdoor loot; excludes retired expeditions, vendors, debug grants and existing player stock. Material closure does not prove recipe learning, rank progression, travel or affordability.',counts:{recipes:recipes.length,nodes:Object.keys(catalog.nodes).length,activeEnemyTypes:activeEnemies.size,spawns:wilderness.spawns.length},missingIngredients,blockedRecipes,firstUpgrades};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/generated/rpg-catalog.json',import.meta.url),'utf8'));
 const wilderness=JSON.parse(fs.readFileSync(new URL('../src/data/generated/wilderness.json',import.meta.url),'utf8'));
 const report=auditObtainability(catalog,wilderness);
 console.log(JSON.stringify(report,null,2));
 if(report.blockedRecipes.length)process.exitCode=1;
}
