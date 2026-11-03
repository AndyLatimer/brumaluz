// Prepare the complete reviewed cozy update. No credentials or network access.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function sqlDefinition(source,name){const start=source.indexOf(`create or replace function public.${name}(`);if(start<0)throw Error(`Missing function ${name}`);const body=source.indexOf('as $$',start);return source.slice(start,source.indexOf('$$;',body)+3);}
const normalize=s=>s.replace(/public\.test_now\(\)|clock_timestamp\(\)|now\(\)/g,'__clock__').replace(/\s+/g,' ').trim();
const body=definition=>normalize(definition.slice(definition.indexOf('as $$')+5,definition.lastIndexOf('$$;')));
const literal=value=>JSON.stringify(value).replaceAll("'","''");
export async function cozyLifePatch(){
 const read=file=>readFile(`supabase/server/${file}`,'utf8');
 const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
 const files={professions:await read('20-professions.sql'),foundation:await read('19-rpg-foundation.sql'),store:await read('21-rpg-combat.sql'),bank:await read('15-bank.sql'),world:await read('29-shared-world-generated.sql'),cozy:await read('19b-cozy-life.sql'),meals:await read('19e-shared-meals.sql')};
 const ownedRecipe=r=>!!catalog.items[r.output]?.furniture||/^plato_/.test(r.output);
 const additions={recipes:catalog.recipes,items:Object.fromEntries(Object.entries(catalog.items).filter(([id,item])=>/^(material_|gema_|fibra_|cuero_|fruta_|hongo_|grano_|plato_|merienda_)/.test(id)||item.furniture||item.recipe&&ownedRecipe(catalog.recipes[item.recipe]))),meals:catalog.meals,cozyRules:catalog.cozyRules};
 const guards=[],definitions=[],guarded=new Set();
 for(const[name,signature,path,source]of[
  ['rpg_action','uuid,text,jsonb,uuid,bigint','20-professions.sql',files.professions],
  ['game_rpg_near','jsonb,text,jsonb','20-professions.sql',files.professions],
  ['game_rpg_settle','jsonb,numeric','19-rpg-foundation.sql',files.foundation],
  ['game_stack_into','jsonb,jsonb','19-rpg-foundation.sql',files.foundation],
  ['game_store','uuid,jsonb','21-rpg-combat.sql',files.store],
  ['game_bank_spot','text','15-bank.sql',files.bank],
  ['bank_action','uuid,text,integer,jsonb,integer,integer','15-bank.sql',files.bank],
  ['world_travel','uuid,uuid,text','29-shared-world-generated.sql',files.world],
  ['game_world_snapshot','uuid','08-world-sessions.sql',files.cozy],
  ['game_party_cleanup','','08-world-sessions.sql',files.meals],
 ]){
  const previous=execFileSync('git',['show',`HEAD:supabase/server/${path}`],{encoding:'utf8'}),next=sqlDefinition(source,name);
  guarded.add(name);
  guards.push(`select trim(regexp_replace(regexp_replace(prosrc,'(public.test_now\\(\\)|clock_timestamp\\(\\)|now\\(\\))','__clock__','g'),'[[:space:]]+',' ','g')) into actual from pg_proc where oid='public.${name}(${signature})'::regprocedure;
if actual not in ($old_${name}$${body(sqlDefinition(previous,name))}$old_${name}$,$new_${name}$${body(next)}$new_${name}$) then raise exception 'Cozy patch: ${name} has unreviewed changes. Review the installed function before applying.';end if;`);
  if(!['game_world_snapshot','game_party_cleanup'].includes(name))definitions.push(next);
 }
 let prototype='';try{prototype=await readFile('art/cozy-life-review/server-patch.sql','utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const[path,source]of[['19b-cozy-life.sql',files.cozy],['19d-cozy-economy.sql',await read('19d-cozy-economy.sql')],['19e-shared-meals.sql',files.meals]]){
  let previous='';try{previous=execFileSync('git',['show',`HEAD:supabase/server/${path}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{}
  for(const match of source.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)){
   const[,name,args]=match;if(guarded.has(name))continue;guarded.add(name);
   const signature=args?args.split(',').map(arg=>arg.trim().split(/\s+/)[1]).join(','):'';
   const allowed=[source,previous,prototype].filter(s=>s.includes(`create or replace function public.${name}(`)).map(s=>body(sqlDefinition(s,name)));
   guards.push(`if to_regprocedure('public.${name}(${signature})') is not null then
select trim(regexp_replace(regexp_replace(prosrc,'(public.test_now\\(\\)|clock_timestamp\\(\\)|now\\(\\))','__clock__','g'),'[[:space:]]+',' ','g')) into actual from pg_proc where oid='public.${name}(${signature})'::regprocedure;
if actual not in (${[...new Set(allowed)].map((s,i)=>`$helper_${name}_${i}$${s}$helper_${name}_${i}$`).join(',')}) then raise exception 'Cozy patch: ${name} has unreviewed changes.';end if;end if;`);
  }
 }
 const worldLines=(await readFile('supabase/world.sql','utf8')).split('\n'),homeMap=worldLines.filter(line=>/^(insert into public.world_maps|update public.world_maps)/.test(line)&&line.includes("'casa_del_olmo'"));
 const portals=worldLines.filter(line=>/^\s*\('/.test(line)&&/'home_olmo'|'home_exit_olmo'|'home_exit_lucero'/.test(line)).map(line=>line.trim().replace(/[,;]$/,''));
 if(homeMap.length!==2||portals.length!==3)throw Error('Missing reviewed home map/portals.');
 const merge=`do $catalog_merge$
declare c jsonb:=public.game_rpg_catalog();extra jsonb:='${literal(additions)}';entry record;limits jsonb:=public.game_rpg_stack_limits();foods jsonb:=public.game_rpg_food_effects();
begin
for entry in select * from jsonb_each(extra->'recipes') loop
 if c->'recipes' ? entry.key then c:=jsonb_set(c,array['recipes',entry.key,'seconds'],entry.value->'seconds');
 elsif entry.value->>'output' like 'mueble_%' or entry.value->>'output' like 'plato_%' then c:=jsonb_set(c,array['recipes',entry.key],entry.value);end if;
end loop;
for entry in select * from jsonb_each(extra->'items') loop
 if not(c->'items' ? entry.key) then c:=jsonb_set(c,array['items',entry.key],entry.value);
 elsif coalesce((entry.value->>'sellable')::boolean,true)=false then c:=jsonb_set(c,array['items',entry.key,'sellable'],'false');end if;
 limits:=limits||jsonb_build_object(entry.key,entry.value->'stack');
 if entry.value ? 'foodEffect' then foods:=foods||jsonb_build_object(entry.key,entry.value->'foodEffect');end if;
end loop;
c:=c||jsonb_build_object('meals',extra->'meals','cozyRules',extra->'cozyRules');
execute format('create or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='''' as %L','select '||quote_literal(c::text)||'::jsonb');
execute format('create or replace function public.game_rpg_stack_limits() returns jsonb language sql immutable set search_path='''' as %L','select '||quote_literal(limits::text)||'::jsonb');
execute format('create or replace function public.game_rpg_food_effects() returns jsonb language sql immutable set search_path='''' as %L','select '||quote_literal(foods::text)||'::jsonb');
end $catalog_merge$;`;
 return `-- Prepared locally, not applied. Guards reject unreviewed function changes.
begin;
set local lock_timeout='3s';
select pg_catalog.pg_advisory_xact_lock(731029,3);
do $guard$ declare actual text;begin
${guards.join('\n')}
end $guard$;
${merge}
${files.cozy}
${await read('19d-cozy-economy.sql')}
${await read('19e-shared-meals.sql')}
${definitions.join('\n')}
${await read('19c-home-map.sql')}
${homeMap.join('\n')}
insert into public.world_portals(map,id,x,z,radius,target_map,target) values
${portals.join(',\n')}
on conflict(map,id) do update set x=excluded.x,z=excluded.z,radius=excluded.radius,target_map=excluded.target_map,target=excluded.target;
commit;
`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sql=await cozyLifePatch(),directory='art/cozy-economy-review';await mkdir(directory,{recursive:true});await writeFile(`${directory}/server-patch.sql`,sql);
 await writeFile(`${directory}/patch-manifest.json`,JSON.stringify({status:'prepared-not-applied',sha256:createHash('sha256').update(sql).digest('hex'),scope:'Reviewed housing/economy, crafting from bank, 1/3 offline speed, crafted provenance, accepted workshop orders, neighborhood quota and shared cooking. Existing characters and unrelated catalog fields preserved.'},null,2)+'\n');
 console.log(`${directory}/server-patch.sql prepared; no server contacted.`);
}
