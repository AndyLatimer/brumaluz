import fs from 'node:fs';
const source=fs.readFileSync(new URL('../supabase/server/20-professions.sql',import.meta.url),'utf8');
const start="elsif p_action='buy_recipe' then",end="elsif p_action='craft' then";
export const cleanRecipeSql=s=>s.replace(/\r\n/g,'\n').trim();
export function recipeBranch(sql){const a=sql.indexOf(start),b=sql.indexOf(end,a);if(a<0||b<a)throw Error('Missing recipe branch');return sql.slice(a,b);}
export const scrollBranch=recipeBranch(source);
export const legacyRecipeBranch=scrollBranch.slice(0,scrollBranch.indexOf("  if recipe->>'source'='drop' then raise"))+`  if recipe->>'source'='drop' then d:=public.game_rpg_consume(d,'receta_'||id,1);
  else if public.game_pelines(d)<cost then raise exception 'NOT_ENOUGH_PELINES';end if;d:=public.game_set_pelines(d,public.game_pelines(d)-cost::int);end if;
  s:=jsonb_set(s,'{learned}',s->'learned'||to_jsonb(id));

 `;
export const withoutRecipeBranch=sql=>sql.replace(recipeBranch(sql),'');
export function recipeScrollPatch(catalog,liveAction){
 let action=liveAction;
 if(action)action=action.replace(recipeBranch(action),scrollBranch);
 else{const a=source.indexOf('create or replace function public.rpg_action(');action=source.slice(a,source.indexOf('$$;',a)+3);}
 if(!action.trimEnd().endsWith(';'))action+=';';
 return `begin;
set local lock_timeout='2s';
select pg_catalog.pg_advisory_xact_lock(731029,3);
create or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select '${JSON.stringify(catalog).replaceAll("'","''")}'::jsonb $catalog$;
revoke all on function public.game_rpg_catalog() from public,anon,authenticated;
${action}
revoke all on function public.rpg_action(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function public.rpg_action(uuid,text,jsonb,uuid,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
`;
}
