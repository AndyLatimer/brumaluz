// Prepares a two-function migration; no credentials or application.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const DAILY_BRANCH_START="elsif p_action='daily_order' then";
export const DAILY_BRANCH_END="elsif p_action='buy_recipe' then";
const source=fs.readFileSync(new URL('../supabase/server/20-professions.sql',import.meta.url),'utf8');
export const dailyOrderBranch=source.slice(source.indexOf(DAILY_BRANCH_START),source.indexOf(DAILY_BRANCH_END));
if(!dailyOrderBranch.startsWith(DAILY_BRANCH_START)||!dailyOrderBranch.endsWith(' '))throw Error('Unexpected daily branch');
export function dailyOrdersPatch(catalog,liveAction){
 let action;
 if(liveAction){
  action=liveAction;
  if(action.includes(DAILY_BRANCH_START)){
   const begin=action.indexOf(DAILY_BRANCH_START),end=action.indexOf(DAILY_BRANCH_END,begin);
   if(end<begin)throw Error('Unexpected installed daily branch');
   action=action.slice(0,begin)+dailyOrderBranch+action.slice(end);
  }else{
   if(action.split(DAILY_BRANCH_END).length!==2)throw Error('Unexpected installed recipe branch');
   action=action.replace(DAILY_BRANCH_END,dailyOrderBranch+DAILY_BRANCH_END);
  }
 }else{const start=source.indexOf('create or replace function public.rpg_action(');action=source.slice(start,source.indexOf('$$;',start)+3);}
 if(!action.trimEnd().endsWith(';'))action+=';';
 const json=catalog??JSON.parse(fs.readFileSync('src/data/generated/rpg-catalog.json','utf8'));
 return `begin;
set local lock_timeout='2s';
select pg_catalog.pg_advisory_xact_lock(731029,3);
create or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select '${JSON.stringify(json).replaceAll("'","''")}'::jsonb $catalog$;
revoke all on function public.game_rpg_catalog() from public,anon,authenticated;
${action}
revoke all on function public.rpg_action(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function public.rpg_action(uuid,text,jsonb,uuid,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 fs.mkdirSync('art/daily-orders-review',{recursive:true});fs.writeFileSync('art/daily-orders-review/server-patch.sql',dailyOrdersPatch());console.log('Prepared daily orders patch; not applied.');
}
