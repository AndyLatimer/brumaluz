import fs from 'node:fs';
const source=fs.readFileSync(new URL('../supabase/server/20-professions.sql',import.meta.url),'utf8');
export const TUTORIAL_START="elsif p_action in('tutorial_accept','tutorial_visit','tutorial_complete') then";
export const TUTORIAL_END="elsif p_action='daily_order' then";
export const tutorialBranch=source.slice(source.indexOf(TUTORIAL_START),source.indexOf(TUTORIAL_END));
export const tutorialHook='d:=public.game_profession_tutorial_event(d,p_action,p_args,c.data);';
export const cleanTutorialSql=s=>s.replace(/\r\n/g,'\n').trim();
export function stripTutorialIntegration(sql){return sql.replace(tutorialBranch,'').replace(' '+tutorialHook+'\n','');}
export function professionTutorialPatch(catalog,liveAction){
 let action=liveAction;
 if(action){
  if(!action.includes(TUTORIAL_START)){
   if(action.split(TUTORIAL_END).length!==2)throw Error('Unexpected daily branch');action=action.replace(TUTORIAL_END,tutorialBranch+TUTORIAL_END);
  }
  if(!action.includes(tutorialHook)){
   const anchor='\n return public.game_store(c.id,d);';if(action.split(anchor).length!==2)throw Error('Unexpected action return');action=action.replace(anchor,'\n '+tutorialHook+anchor);
  }
 }else{const start=source.indexOf('create or replace function public.rpg_action(');action=source.slice(start,source.indexOf('$$;',start)+3);}
 if(!action.trimEnd().endsWith(';'))action+=';';
 const helpers=fs.readFileSync(new URL('../supabase/server/19a-profession-tutorial.sql',import.meta.url),'utf8');
 return `begin;
set local lock_timeout='2s';
select pg_catalog.pg_advisory_xact_lock(731029,3);
create or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select '${JSON.stringify(catalog).replaceAll("'","''")}'::jsonb $catalog$;
revoke all on function public.game_rpg_catalog() from public,anon,authenticated;
${helpers}
${action}
revoke all on function public.rpg_action(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function public.rpg_action(uuid,text,jsonb,uuid,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
`;
}
