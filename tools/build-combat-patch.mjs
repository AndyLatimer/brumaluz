// A narrow, transactional combat patch. Does not run world/map/catalog migrations.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const read=name=>readFileSync(`supabase/server/${name}`,'utf8');
function definition(source,name){
 const start=source.indexOf(`create or replace function public.${name}(`);
 if(start<0)throw new Error(`Missing function ${name}`);
 const body=source.indexOf('as $$',start),end=source.indexOf('$$;',body+5);
 if(body<0||end<0)throw new Error(`Incomplete function ${name}`);
 return source.slice(start,end+3);
}
export function combatPatch(){
 const generated=read('21-rpg-combat.sql'),shared=read('28-shared-wilderness.sql'),foundation=read('19-rpg-foundation.sql');
 const helpers=['game_strength_power','game_expertise_power','game_intellect_efficiency','game_agility_tempo'];
 return [...helpers.flatMap(name=>[definition(foundation,name),`revoke all on function public.${name}(jsonb) from public,anon,authenticated;`]),...Object.entries(wildernessAiHelpers).flatMap(([name,signature])=>[definition(shared,name),`revoke all on function public.${name}(${signature}) from public,anon,authenticated;`]),definition(generated,'game_shadow_combat_config'),"revoke all on function public.game_shadow_combat_config() from public,anon,authenticated;",definition(generated,'combat_action'),
  definition(generated,'game_combat_tick').replace('public.game_combat_tick(','public.game_story_combat_tick('),
  ...['game_wilderness_context','game_wilderness_world_tick','game_combat_tick','wilderness_action'].map(name=>definition(shared,name))].join('\n\n');
}
export const wildernessAiHelpers={game_wilderness_fresh:'jsonb',game_wilderness_join:'jsonb,uuid,numeric,numeric',game_wilderness_clear:'jsonb,numeric,numeric,numeric,numeric',game_wilderness_route:'jsonb,numeric,numeric',game_wilderness_move:'jsonb,numeric,numeric,numeric,numeric,numeric',game_wilderness_ambient:'jsonb,jsonb,jsonb,numeric,numeric'};
mkdirSync('art/combat-review',{recursive:true});
writeFileSync('art/combat-review/server-patch.sql',`-- Combat responsiveness: function bodies only; no player/map/catalog data changes.\nbegin;\nset local lock_timeout='2s';\nset local statement_timeout='20s';\n\n${combatPatch()}\n\nnotify pgrst, 'reload schema';\ncommit;\n`);
console.log('Prepared art/combat-review/server-patch.sql (combat functions only; transactional).');
