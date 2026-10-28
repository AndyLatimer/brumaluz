// Reviewable AI/catalog migration; no application or credentials are used here.
import fs from 'node:fs';
import {wildernessAiHelpers} from './build-combat-patch.mjs';
const shared=fs.readFileSync('supabase/server/28-shared-wilderness.sql','utf8');
const generated=fs.readFileSync('supabase/server/26-wilderness-generated.sql','utf8');
function definition(source,name){
 const start=source.indexOf(`create or replace function public.${name}(`),body=source.indexOf('as $$',start);
 const end=name==='game_wilderness_catalog'?source.indexOf('$catalog$;',start)+11:source.indexOf('$$;',body)+3;
 if(start<0||end<=start)throw new Error('Missing definition '+name);return source.slice(start,end);
}
export function wildernessPatch(){
 const start=shared.indexOf('insert into public.wilderness_mobs(spawn,state)'),end=shared.indexOf('-- Retire removed placements',start);
 return `-- Patrols, pursuit, small groups and enemy personalities. No map/resource/player migrations.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select pg_catalog.pg_advisory_xact_lock(731029,4);
${definition(generated,'game_wilderness_catalog')}
revoke all on function public.game_wilderness_catalog() from public,anon,authenticated;
${Object.entries(wildernessAiHelpers).map(([name,signature])=>definition(shared,name)+`\nrevoke all on function public.${name}(${signature}) from public,anon,authenticated;`).join('\n\n')}
${['game_wilderness_context','game_wilderness_view','game_wilderness_world_tick'].map(name=>definition(shared,name)).join('\n\n')}
revoke all on function public.game_wilderness_context(uuid,jsonb,numeric,numeric),public.game_wilderness_view(uuid),public.game_wilderness_world_tick() from public,anon,authenticated;
${shared.slice(start,end)}
notify pgrst, 'reload schema';
commit;
`;
}
fs.mkdirSync('art/combat-review',{recursive:true});
fs.writeFileSync('art/combat-review/enemy-ai-server-patch.sql',wildernessPatch());
console.log('Prepared art/combat-review/enemy-ai-server-patch.sql. Not applied.');
