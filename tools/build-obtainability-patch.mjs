// Prepare only; never connects to a database or applies changes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const read=name=>fs.readFileSync(new URL(`../supabase/server/${name}`,import.meta.url),'utf8');
function definition(source,name){
 const start=source.indexOf(`create or replace function public.${name}(`);
 const marker=name.endsWith('_catalog')?'$catalog$;':'$$;';
 const end=source.indexOf(marker,start);
 if(start<0||end<start)throw new Error(`Missing definition ${name}`);
 return source.slice(start,end+marker.length);
}
export function obtainabilityPatch({rpgCatalog,wildernessCatalog}={}){
 const foundation=read('19-rpg-foundation.sql'),professions=read('20-professions.sql'),legacy=read('27-wilderness.sql');
 const functions=[
  [read('18-rpg-catalog.sql'),'game_rpg_catalog',''],
  [read('26-wilderness-generated.sql'),'game_wilderness_catalog',''],
  [foundation,'game_rpg_recipe_xp','jsonb,jsonb'],
  [foundation,'game_rpg_settle','jsonb,numeric'],
  [legacy,'game_wilderness_loot','jsonb,jsonb'],
 ];
 const catalogDefinition=(name,value)=>`create or replace function public.${name}() returns jsonb language sql immutable set search_path='' as $catalog$ select '${JSON.stringify(value).replaceAll("'","''")}'::jsonb $catalog$;`;
 return `-- Obtainable hides and first weapon recipe. No map edits or player-data rewrite.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select pg_catalog.pg_advisory_xact_lock(731029,3);
select pg_catalog.pg_advisory_xact_lock(731029,4);
${functions.map(([source,name,args])=>`${name==='game_rpg_catalog'&&rpgCatalog?catalogDefinition(name,rpgCatalog):name==='game_wilderness_catalog'&&wildernessCatalog?catalogDefinition(name,wildernessCatalog):definition(source,name)}\nrevoke all on function public.${name}(${args}) from public,anon,authenticated;`).join('\n\n')}
${definition(professions,'rpg_action')}
revoke all on function public.rpg_action(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function public.rpg_action(uuid,text,jsonb,uuid,bigint) to authenticated;
-- Existing creatures, corpses, generations and player inventories stay intact.
insert into public.wilderness_mobs(spawn,state)
 select site->>'id',public.game_wilderness_fresh(site)
 from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') site
 where site->>'id' in ('cuero_1','cuero_2','cuero_3','cuero_4','cuero_5')
 on conflict(spawn) do nothing;
notify pgrst, 'reload schema';
commit;
`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 fs.mkdirSync('art/obtainability-review',{recursive:true});
 fs.writeFileSync('art/obtainability-review/server-patch.sql',obtainabilityPatch());
 console.log('Prepared art/obtainability-review/server-patch.sql. Not applied.');
}
