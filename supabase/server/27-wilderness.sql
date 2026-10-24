-- First outdoor PvE circuit. Encounters and respawns are individual in this version.
create or replace function public.game_wilderness_loot(d jsonb,e jsonb) returns jsonb
language plpgsql volatile set search_path='' as $$
declare def jsonb:=public.game_wilderness_catalog()->'enemies'->(e->>'enemy'); result jsonb:='[]';entry record;recipe text;
begin
 for entry in select key,value from jsonb_each(def->'loot') loop result:=result||jsonb_build_array(jsonb_build_object('id',entry.key,'count',entry.value));end loop;
 if not coalesce((d->'wilderness'->>'firstRecipe')::boolean,false) or random()<.20 then
  select key into recipe from jsonb_each(public.game_rpg_catalog()->'recipes') r
   where (value->>'tier')::int=1 and (public.game_rpg_catalog()->'equipment'->key->>'cls'=d->>'cls')
   order by random() limit 1;
  if recipe is not null then result:=result||jsonb_build_array(jsonb_build_object('id','receta_'||recipe,'count',1));end if;
 end if;return result;
end $$;
create or replace function public.game_wilderness_reward(d jsonb,e jsonb) returns jsonb
language plpgsql volatile set search_path='' as $$
declare def jsonb:=public.game_wilderness_catalog()->'enemies'->(e->>'enemy');s jsonb:=coalesce(d->'wilderness','{}');xp int:=coalesce((d->>'experience')::int,0);lvl int:=public.game_level(d);stamp numeric:=extract(epoch from clock_timestamp());
begin
 if def is null then raise exception 'Enemigo desconocido.';end if;
 if lvl<50 then xp:=xp+(def->>'xp')::int;while lvl<50 and xp>=public.game_xp_needed(lvl) loop xp:=xp-public.game_xp_needed(lvl);lvl:=lvl+1;end loop;if lvl>=50 then xp:=public.game_xp_needed(50);end if;end if;
 s:=s||jsonb_build_object('firstRecipe',true,'kills',coalesce((s->>'kills')::int,0)+1,'respawns',coalesce(s->'respawns','{}')||jsonb_build_object(e->>'spawn',stamp+90));
 return public.game_set_pelines(d,public.game_pelines(d)+(def->>'coins')::int)||jsonb_build_object('wilderness',s,'experience',xp,'level',lvl);
end $$;

create or replace function public.game_wilderness_begin(d jsonb,site jsonb) returns jsonb
language plpgsql volatile set search_path='' as $$
declare def jsonb:=public.game_wilderness_catalog()->'enemies'->(site->>'enemy');e jsonb;stamp numeric:=extract(epoch from clock_timestamp());entry jsonb;deliveries jsonb;
begin
 if d->'combatEncounter'->>'status'='defeated' and d->'combatEncounter'->>'looted' is distinct from 'true' then
  d:=public.game_rpg_settle(d,stamp);deliveries:=d->'rpg'->'deliveries';
  for entry in select value from jsonb_array_elements(coalesce(d->'combatEncounter'->'loot','[]')) where value<>'null'::jsonb loop deliveries:=deliveries||jsonb_build_array(entry);end loop;
  d:=jsonb_set(d,'{rpg,deliveries}',deliveries);
 end if;
 e:=jsonb_build_object('id','wild_enemy','kind','wilderness','spawn',site->>'id','enemy',site->>'enemy','label',def->>'label','level',def->'level','status','active','engaged',true,'health',def->'health','maxHealth',def->'health','guard',def->'guard','x',site->'x','z',site->'z','homeX',site->'x','homeZ',site->'z','movedAt',stamp,'enemyAttackAt',stamp+.3,'instanceId',gen_random_uuid()::text,'loot','[]'::jsonb,'looted',false);
 return jsonb_set(d,'{combatEncounter}',e);
end $$;
create or replace function public.game_wilderness_aggro(d jsonb,px double precision,pz double precision) returns jsonb
language plpgsql volatile set search_path='' as $$
declare site jsonb;def jsonb;stamp numeric:=extract(epoch from clock_timestamp());
begin
 if d->>'location' is distinct from 'pompelin' or public.game_health(d)=0 or d->'combatEncounter'->>'status'='active'
  or coalesce((d->'wilderness'->>'graceUntil')::numeric,0)>stamp
  or not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) then return d;end if;
 for site in select value from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') order by power(px-(value->>'x')::numeric,2)+power(pz-(value->>'z')::numeric,2) loop
  def:=public.game_wilderness_catalog()->'enemies'->(site->>'enemy');
  if coalesce((d->'wilderness'->'respawns'->>(site->>'id'))::numeric,0)<=stamp
   and power(px-(site->>'x')::numeric,2)+power(pz-(site->>'z')::numeric,2)<=power(coalesce((def->>'aggro')::numeric,6),2)
   and public.game_rpg_sight('pompelin',px::numeric,pz::numeric,(site->>'x')::numeric,(site->>'z')::numeric) then return public.game_wilderness_begin(d,site);end if;
 end loop;return d;
end $$;
create or replace function public.game_wilderness_tick(p_id uuid,d jsonb,px double precision,pz double precision) returns jsonb
language plpgsql volatile set search_path='' as $$
declare e jsonb:=d->'combatEncounter';def jsonb:=public.game_wilderness_catalog()->'enemies'->(e->>'enemy');stamp numeric:=extract(epoch from clock_timestamp());elapsed numeric;distance numeric;dx numeric;dz numeric;nx numeric;nz numeric;step numeric;incoming numeric;blocked numeric;barrier numeric;fraction numeric;hp int;overheal int;ax numeric;az numeric;length numeric;projection numeric;hit boolean:=false;
begin
 if e->>'status' is distinct from 'active' then return d;end if;
 if d->>'location' is distinct from 'pompelin' or public.game_health(d)=0 then return jsonb_set(d,'{combatEncounter,status}','"failed"')||jsonb_build_object('wilderness',coalesce(d->'wilderness','{}')||jsonb_build_object('graceUntil',stamp+8));end if;
 elapsed:=greatest(0,stamp-coalesce((e->>'movedAt')::numeric,stamp));
 if elapsed>12 or sqrt(power(px-(e->>'homeX')::numeric,2)+power(pz-(e->>'homeZ')::numeric,2))>24 then
  return jsonb_set(d,'{combatEncounter}',e||jsonb_build_object('status','fled','windup',null))||jsonb_build_object('wilderness',coalesce(d->'wilderness','{}')||jsonb_build_object('graceUntil',stamp+6));
 end if;
 dx:=px-(e->>'x')::numeric;dz:=pz-(e->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);
 if (e->>'windup')::numeric is null and distance>(def->>'range')::numeric then
  step:=least(greatest(0,distance-(def->>'range')::numeric+.1),least(1,elapsed)*(def->>'speed')::numeric);
  nx:=(e->>'x')::numeric+dx/greatest(.001,distance)*step;nz:=(e->>'z')::numeric+dz/greatest(.001,distance)*step;
  if public.game_rpg_sight('pompelin',(e->>'x')::numeric,(e->>'z')::numeric,nx,nz) then e:=e||jsonb_build_object('x',nx,'z',nz);end if;
 elsif (e->>'windup')::numeric is null and stamp>=coalesce((e->>'enemyAttackAt')::numeric,0) then
  ax:=px;az:=pz;
  if def->>'pattern' in('line','cone') then length:=coalesce((def->>'reach')::numeric,(def->>'range')::numeric);ax:=(e->>'x')::numeric+dx/greatest(.001,distance)*length;az:=(e->>'z')::numeric+dz/greatest(.001,distance)*length;end if;
  e:=e||jsonb_build_object('windup',stamp+coalesce((def->>'windup')::numeric,1.2),'enemyAttackAt',stamp+coalesce((def->>'windup')::numeric,1.2),'aimX',ax,'aimZ',az);
 elsif (e->>'windup')::numeric<=stamp then
  ax:=coalesce((e->>'aimX')::numeric,px)-(e->>'x')::numeric;az:=coalesce((e->>'aimZ')::numeric,pz)-(e->>'z')::numeric;length:=greatest(.001,sqrt(ax*ax+az*az));
  if def->>'pattern'='circle' then hit:=power(px-(e->>'aimX')::numeric,2)+power(pz-(e->>'aimZ')::numeric,2)<=power((def->>'radius')::numeric,2);
  elsif def->>'pattern'='line' then projection:=greatest(0,least(1,(dx*ax+dz*az)/(length*length)));hit:=power(dx-ax*projection,2)+power(dz-az*projection,2)<=power((def->>'radius')::numeric,2);
  else hit:=distance<=coalesce((def->>'radius')::numeric,(def->>'range')::numeric) and (distance<.1 or (dx*ax+dz*az)/greatest(.001,distance*length)>=.5);end if;
  if hit and public.game_rpg_sight('pompelin',px::numeric,pz::numeric,(e->>'x')::numeric,(e->>'z')::numeric) then
   incoming:=(def->>'damage')::numeric*public.game_guard_multiplier(d);
   barrier:=case when coalesce((d->'enchantState'->>'barrierUntil')::numeric,0)>stamp then coalesce((d->'enchantState'->>'barrier')::numeric,0) else 0 end;
   blocked:=least(incoming,barrier);incoming:=incoming-blocked;
   if d?'enchantState' then d:=jsonb_set(d,'{enchantState,barrier}',to_jsonb(barrier-blocked));end if;
   fraction:=incoming+coalesce((d->>'incomingFraction')::numeric,0);incoming:=floor(fraction);overheal:=public.game_overheal_now(d);blocked:=least(overheal,incoming);hp:=greatest(0,public.game_health(d)-(incoming-blocked));
   d:=d||jsonb_build_object('health',hp,'overheal',overheal-blocked,'overheal_at',stamp,'incomingFraction',fraction-incoming,'combat_at',stamp);
   if hp=0 then e:=jsonb_set(e,'{status}','"failed"');d:=(d-'enchantState')||jsonb_build_object('wilderness',coalesce(d->'wilderness','{}')||jsonb_build_object('graceUntil',stamp+8));end if;
  end if;
  if def->>'pattern'='line' and public.game_rpg_sight('pompelin',(e->>'x')::numeric,(e->>'z')::numeric,(e->>'aimX')::numeric,(e->>'aimZ')::numeric) then e:=e||jsonb_build_object('x',e->'aimX','z',e->'aimZ');end if;
  e:=e||jsonb_build_object('windup',null,'attackSeq',coalesce((e->>'attackSeq')::int,0)+1,'enemyAttackAt',stamp+(def->>'interval')::numeric);
 end if;
 return jsonb_set(d,'{combatEncounter}',e||jsonb_build_object('movedAt',stamp));
end $$;

-- Preserve the story encounter's resolver; route outdoor fights through their own state machine.
-- Copy the freshly regenerated story body on each application instead of wrapping a previous wrapper.
do $$ declare body text;begin
 select pg_get_functiondef('public.game_combat_tick(uuid,jsonb,double precision,double precision)'::regprocedure) into body;
 if position('game_wilderness_tick' in body)=0 then execute replace(body,'FUNCTION public.game_combat_tick','FUNCTION public.game_story_combat_tick');end if;
end $$;
create or replace function public.game_combat_tick(p_id uuid,d jsonb,p_x double precision,p_z double precision) returns jsonb
language plpgsql volatile security definer set search_path='' as $$ begin
 d:=public.game_wilderness_aggro(d,p_x,p_z);
 if d->'combatEncounter'->>'kind'='wilderness' then return public.game_wilderness_tick(p_id,d,p_x,p_z);end if;
 return public.game_story_combat_tick(p_id,d,p_x,p_z);
end $$;

create or replace function public.wilderness_action(p_character_id uuid,p_action text,p_spawn text default null,p_slot int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.characters;w public.world_players;site jsonb;def jsonb;e jsonb;loot jsonb;entry jsonb;stamp numeric:=extract(epoch from clock_timestamp());i int;result jsonb:='{}';
begin
 c:=public.game_lock_character(p_character_id);
 select * into w from public.world_players where user_id=(select auth.uid()) and character_id=c.id and seen_at>now()-interval '15 seconds' for update;
 if not found or c.data->>'location'<>'pompelin' then raise exception 'Debes estar en Pompelín.';end if;
 if p_action is null or p_action not in('state','start','attack','skill','loot','stop') then raise exception 'Acción desconocida.';end if;
 if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) then raise exception 'COMBAT_UNAVAILABLE';end if;
 -- Explicit commands must not silently switch target (especially while looting).
 if p_action='state' then c.data:=public.game_combat_tick(c.id,c.data,(w.position->>'x')::double precision,(w.position->>'z')::double precision);
 elsif c.data->'combatEncounter'->>'kind'='wilderness' then c.data:=public.game_wilderness_tick(c.id,c.data,(w.position->>'x')::double precision,(w.position->>'z')::double precision);end if;
 e:=c.data->'combatEncounter';
 if p_action<>'state' and public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD';end if;
 if p_action='start' then
  select value into site from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') where value->>'id'=p_spawn;
  if site is null then raise exception 'Objetivo desconocido.';end if;
  if e->>'status'='active' and e->>'spawn' is distinct from p_spawn then raise exception 'Ya estás combatiendo.';end if;
  if coalesce((c.data->'wilderness'->'respawns'->>p_spawn)::numeric,0)>stamp then raise exception 'Este enemigo todavía no ha reaparecido.';end if;
  if sqrt(power((w.position->>'x')::numeric-(site->>'x')::numeric,2)+power((w.position->>'z')::numeric-(site->>'z')::numeric,2))>10 or not public.game_rpg_sight('pompelin',(w.position->>'x')::numeric,(w.position->>'z')::numeric,(site->>'x')::numeric,(site->>'z')::numeric) then raise exception 'Acércate a un enemigo visible.';end if;
  if not public.game_has_weapon(c.data) then raise exception 'COMBAT_WEAPON_REQUIRED';end if;
  if e->>'status' is distinct from 'active' then c.data:=public.game_wilderness_begin(c.data,site);end if;
 elsif p_action in('attack','skill') then
  if e->>'kind' is distinct from 'wilderness' then raise exception 'COMBAT_NO_TARGET';end if;
  if p_spawn is not null and e->>'instanceId' is distinct from p_spawn then raise exception 'COMBAT_NO_TARGET';end if;
  perform public.game_store(c.id,c.data);
  result:=public.game_wilderness_hit(c.id,p_action);
  select * into c from public.characters where characters.id=p_character_id;
  if e->>'status'='active' and c.data->'combatEncounter'->>'status'='defeated' then def:=public.game_wilderness_catalog()->'enemies'->(e->>'enemy');result:=result||jsonb_build_object('reward',jsonb_build_object('xp',def->'xp','coins',def->'coins'));end if;
 elsif p_action='loot' then
  if e->>'kind' is distinct from 'wilderness' or e->>'status' is distinct from 'defeated' or e->>'instanceId' is distinct from p_spawn then raise exception 'LOOT_INVALID';end if;
  if sqrt(power((w.position->>'x')::numeric-(e->>'x')::numeric,2)+power((w.position->>'z')::numeric-(e->>'z')::numeric,2))>3 then raise exception 'Acércate al cuerpo.';end if;
  loot:=e->'loot';if p_slot is not null and (p_slot<0 or p_slot>=jsonb_array_length(loot)) then raise exception 'LOOT_INVALID';end if;
  for i in 0..jsonb_array_length(loot)-1 loop if p_slot is not null and i<>p_slot then continue;end if;entry:=loot->i;if entry='null'::jsonb then continue;end if;c.data:=public.game_rpg_give(c.data,public.game_rpg_new_item(entry->>'id',(entry->>'count')::int),false);loot:=jsonb_set(loot,array[i::text],'null'::jsonb);end loop;
  c.data:=jsonb_set(c.data,'{combatEncounter}',e||jsonb_build_object('loot',loot,'looted',not exists(select 1 from jsonb_array_elements(loot) item where item<>'null'::jsonb)));
 elsif p_action='stop' and e->>'kind'='wilderness' and e->>'status'='active' then c.data:=jsonb_set(c.data,'{combatEncounter,status}','"fled"')||jsonb_build_object('wilderness',coalesce(c.data->'wilderness','{}')||jsonb_build_object('graceUntil',stamp+6));
 end if;
 c.data:=public.game_store(c.id,c.data);
 return result||jsonb_build_object('data',c.data,'encounter',c.data->'combatEncounter','vitals',public.game_public_vitals(c.data),'wilderness',coalesce(c.data->'wilderness','{}'));
end $$;
revoke all on function public.game_wilderness_loot(jsonb,jsonb),public.game_wilderness_reward(jsonb,jsonb),public.game_wilderness_tick(uuid,jsonb,double precision,double precision),public.game_story_combat_tick(uuid,jsonb,double precision,double precision) from public,anon,authenticated;
revoke all on function public.game_wilderness_begin(jsonb,jsonb),public.game_wilderness_aggro(jsonb,double precision,double precision) from public,anon,authenticated;
revoke all on function public.wilderness_action(uuid,text,text,int) from public,anon;
grant execute on function public.wilderness_action(uuid,text,text,int) to authenticated;
