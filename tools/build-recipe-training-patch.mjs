import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const read=name=>fs.readFileSync(new URL(`../supabase/server/${name}`,import.meta.url),'utf8');
const definition=(source,name)=>{const start=source.indexOf(`create or replace function public.${name}(`);if(start<0)throw Error(name);return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);};
export function recipeTrainingPatch(catalog=JSON.parse(fs.readFileSync(new URL('../src/data/generated/rpg-catalog.json',import.meta.url),'utf8'))){
 return `-- Recipes are taught by masters. Exceptional scrolls remain rare combat loot.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select pg_catalog.pg_advisory_xact_lock(731029,3);
select pg_catalog.pg_advisory_xact_lock(731029,4);
create or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select '${JSON.stringify(catalog).replaceAll("'","''")}'::jsonb $catalog$;
revoke all on function public.game_rpg_catalog() from public,anon,authenticated;
${definition(read('20-professions.sql'),'rpg_action')}
revoke all on function public.rpg_action(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function public.rpg_action(uuid,text,jsonb,uuid,bigint) to authenticated;
${definition(read('27-wilderness.sql'),'game_wilderness_loot')}
revoke all on function public.game_wilderness_loot(jsonb,jsonb) from public,anon,authenticated;
${definition(read('22-expeditions.sql'),'expedition_action')}
revoke all on function public.expedition_action(uuid,text,integer) from public,anon;
grant execute on function public.expedition_action(uuid,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 fs.mkdirSync('art/recipe-training-review',{recursive:true});fs.writeFileSync('art/recipe-training-review/server-patch.sql',recipeTrainingPatch());console.log('Prepared art/recipe-training-review/server-patch.sql. Not applied.');
}
