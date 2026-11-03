import {readFileSync} from 'node:fs';

export function sqlFunction(source,name){
 const start=source.indexOf(`create or replace function public.${name}(`);
 if(start<0)throw Error(`Missing SQL function ${name}`);
 const tail=source.slice(start),open=/\bas\s+(\$[a-zA-Z_]*\$)/i.exec(tail);
 if(!open)throw Error(`Missing SQL body ${name}`);
 const end=tail.indexOf(open[1],open.index+open[0].length)+open[1].length;
 if(end<open.index+open[0].length)throw Error(`Unterminated SQL body ${name}`);
 return tail.slice(0,end)+';';
}

export function runtimeMetadataIds(){
 const source=readFileSync(new URL('../supabase/server/05-weapon-stats.sql',import.meta.url),'utf8');
 return [...new Set([...sqlFunction(source,'game_item').matchAll(/when '([^']+)' then/g)].map(m=>m[1]))].sort();
}

/** Targeted, transactional patch: never reapplies story/data migrations. */
export function runtimePerformanceSql(){
 const groups={
  '05-weapon-stats.sql':['game_equipment_item','game_item'],
  '18a-rpg-runtime-rules.sql':['game_rpg_sets','game_rpg_food_effects','game_rpg_stack_limits'],
  '19-rpg-foundation.sql':['game_set_bonuses','game_rpg_food_bonus','game_public_vitals','game_rpg_settle'],
  '21-rpg-combat.sql':['game_regen_data'],
  '23-rpg-consumables.sql':['game_food_data'],
 };
 return Object.entries(groups).flatMap(([file,names])=>{
  const source=readFileSync(new URL(`../supabase/server/${file}`,import.meta.url),'utf8');
  return names.map(name=>sqlFunction(source,name));
 }).join('\n')+'\nrevoke all on function public.game_rpg_sets(),public.game_rpg_food_effects(),public.game_rpg_stack_limits() from public,anon,authenticated;\n';
}
