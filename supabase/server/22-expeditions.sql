create table if not exists public.rpg_expeditions(id uuid primary key default gen_random_uuid(), party_id uuid, leader uuid not null references public.characters(id) on delete cascade, state jsonb not null, updated_at timestamptz not null default now());
alter table public.rpg_expeditions enable row level security;
revoke all on table public.rpg_expeditions from public,anon,authenticated;

create or replace function public.heal_ally(p_character_id uuid,p_target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters;target public.characters;w public.world_players;other public.world_players;stamp numeric:=extract(epoch from clock_timestamp());amount numeric;cost numeric;fraction numeric;hp int;room int;result jsonb;party uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(731029,3);c:=public.game_lock_character(p_character_id);
 if c.data->>'cls'<>'clerigo' or not public.game_has_weapon(c.data) or public.game_health(c.data)=0 then raise exception 'No puedes usar Curación.';end if;
 if stamp<coalesce((c.data->>'combatNextSkill')::numeric,0) then raise exception 'COMBAT_COOLDOWN';end if;
 select party_id into party from public.party_members where character_id=c.id;
 if p_target<>c.id and (party is null or not exists(select 1 from public.party_members where character_id=p_target and party_id=party)) then raise exception 'Selecciona un compañero de tu grupo.';end if;
 select * into target from public.characters where id=p_target for update;
 if target.id is null then raise exception 'El aliado no está disponible.';end if;
 select * into w from public.world_players where character_id=c.id and seen_at>now()-interval '15 seconds';
 select * into other from public.world_players where character_id=target.id and seen_at>now()-interval '15 seconds';
 if w.character_id is null or other.character_id is null or c.data->>'location'<>target.data->>'location' or sqrt(power((w.position->>'x')::numeric-(other.position->>'x')::numeric,2)+power((w.position->>'z')::numeric-(other.position->>'z')::numeric,2))>6 then raise exception 'El aliado está fuera de alcance.';end if;
 if not public.game_rpg_sight(c.data->>'location',(w.position->>'x')::numeric,(w.position->>'z')::numeric,(other.position->>'x')::numeric,(other.position->>'z')::numeric) then raise exception 'El aliado no está en tu línea de visión.';end if;
 target.data:=public.game_food_data(target.id,public.game_party_data(target.id,target.data));hp:=public.game_health(target.data);room:=public.game_max_health(target.data)-hp;
 if hp<=0 or room<=0 then raise exception 'El aliado no necesita curación o está derrotado.';end if;
 cost:=12*(1-(public.game_set_bonuses(c.data)->>'skillCost')::numeric)*public.game_intellect_efficiency(c.data);
 if (public.game_public_vitals(c.data)->>'resource')::numeric<cost then raise exception 'COMBAT_NOT_ENOUGH_RESOURCE';end if;
 amount:=(public.game_equipment_stat(c.data,'healing')+4*(public.game_skill_rank(c.data)-1))*public.game_power_multiplier(c.data)*public.game_expertise_power(c.data)*(1+(public.game_set_bonuses(c.data)->>'healing')::numeric)*(1+(public.game_set_bonuses(c.data)->>'skillPower')::numeric);
 amount:=amount+coalesce((target.data->>'health_regen')::numeric,0);fraction:=case when amount>=room then 0 else amount-floor(amount) end;amount:=least(room,floor(amount));
 cost:=cost+coalesce((c.data->>'resourceCostFraction')::numeric,0);
 c.data:=c.data||jsonb_build_object('resource',(public.game_public_vitals(c.data)->>'resource')::numeric-floor(cost),'resourceCostFraction',cost-floor(cost),'combatNextSkill',stamp+6,'combatVisual',jsonb_build_object('at',stamp,'action','heal'),'combat_at',stamp);
 if target.id=c.id then c.data:=c.data||jsonb_build_object('health',hp+amount,'health_regen',fraction);
 else perform public.game_store(target.id,target.data||jsonb_build_object('health',hp+amount,'health_regen',fraction));end if;
 if c.data ? 'expeditionId' then
  update public.rpg_expeditions set state=jsonb_set(state,array['members',c.id::text],state->'members'->c.id::text||jsonb_build_object('threat',coalesce((state->'members'->c.id::text->>'threat')::numeric,0)+amount*.5,'contribution',coalesce((state->'members'->c.id::text->>'contribution')::numeric,0)+amount)) where id=(c.data->>'expeditionId')::uuid and state->>'status'='active' and state->'members' ? c.id::text;
 end if;
 c.data:=public.game_store(c.id,c.data);
 return jsonb_build_object('vitals',public.game_public_vitals(c.data),'encounter',c.data->'combatEncounter','healing',amount,'damage',0,'healTarget',p_target,'skillCooldown',6,'action','skill');
end $$;
revoke all on function public.heal_ally(uuid,uuid) from public,anon;
grant execute on function public.heal_ally(uuid,uuid) to authenticated;

create or replace function public.expedition_action(p_character_id uuid,p_action text default 'state',p_target int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters;other public.characters;w public.world_players;tr public.rpg_expeditions;party uuid;stamp numeric:=extract(epoch from clock_timestamp());s jsonb;members jsonb;enemies jsonb;enemy jsonb;enc jsonb;result jsonb;member jsonb;slot int;idx int;selected int;hp numeric;incoming numeric;remaining numeric;blocked numeric;barrier numeric;best numeric;threat numeric;victim uuid;pos jsonb;d jsonb;alive boolean;recipe text;tier int;loot jsonb;old_quest jsonb;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED';end if;
 perform pg_catalog.pg_advisory_xact_lock(731029,3);c:=public.game_lock_character(p_character_id);
 select * into w from public.world_players where character_id=c.id and user_id=auth.uid() and seen_at>now()-interval '15 seconds' for update;
 if w.character_id is null then raise exception 'Entra en el mundo.';end if;
 select party_id into party from public.party_members where character_id=c.id;
 if p_action='start' then
  if c.data->'welcome'->>'stage'<>'completed' then raise exception 'Completa primero la bienvenida de Gnomi.';end if;
  if c.data->>'location'<>'brumaluz' or sqrt(power((w.position->>'x')::numeric-(public.game_rpg_catalog()->'camp'->>'x')::numeric,2)+power((w.position->>'z')::numeric-(public.game_rpg_catalog()->'camp'->>'z')::numeric,2))>6 then raise exception 'Acércate al tablón de expediciones.';end if;
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD';end if;
  if c.data->'combatEncounter'->>'status'='active' and c.data->'combatEncounter'->>'kind' is distinct from 'expedition' then raise exception 'Termina tu combate actual.';end if;
  select * into tr from public.rpg_expeditions e where e.updated_at>now()-interval '30 minutes' and e.state->>'status'='active' and ((party is not null and e.party_id=party)or(party is null and e.leader=c.id)) order by updated_at desc limit 1 for update;
  if tr.id is null then
   enemies:='[]';for idx in 0..2 loop enemy:=jsonb_build_object('id',gen_random_uuid()::text,'label',case idx when 0 then 'Centinela umbrío' when 1 then 'Acechador umbrío' else 'Eco errante' end,'x',(public.game_rpg_catalog()->'camp'->>'x')::numeric+2+idx*1.5,'z',(public.game_rpg_catalog()->'camp'->>'z')::numeric+case when idx=1 then 1.2 else 0 end,'health',60+public.game_level(c.data)*12,'maxHealth',60+public.game_level(c.data)*12,'guard',case when idx=0 then 5 else 1 end,'visible',true);enemies:=enemies||jsonb_build_array(enemy);end loop;
   s:=jsonb_build_object('status','active','enemies',enemies,'members','{}'::jsonb,'nextAttack',stamp+3,'level',public.game_level(c.data));
   insert into public.rpg_expeditions(party_id,leader,state) values(party,c.id,s) returning * into tr;
  end if;
  s:=tr.state;members:=s->'members';
  members:=members||jsonb_build_object(c.id::text,coalesce(members->c.id::text,jsonb_build_object('threat',0,'contribution',0,'rewarded',false,'selected',0)));
  s:=jsonb_set(s,'{members}',members);c.data:=c.data||jsonb_build_object('expeditionId',tr.id::text);perform public.game_store(c.id,c.data);
 else
  select * into tr from public.rpg_expeditions where id=nullif(c.data->>'expeditionId','')::uuid for update;
  if tr.id is null then raise exception 'No hay expedición activa.';end if;s:=tr.state;
  if not(s->'members' ? c.id::text) then raise exception 'No participas en esta expedición.';end if;
  if p_action<>'leave' and tr.party_id is not null and party is distinct from tr.party_id then raise exception 'Ya no perteneces al grupo de esta expedición.';end if;
 end if;
 members:=s->'members';enemies:=s->'enemies';member:=members->c.id::text;selected:=coalesce((member->>'selected')::int,0);
 if p_action='target' then if p_target is null or p_target<0 or p_target>=jsonb_array_length(enemies) or (enemies->p_target->>'health')::numeric<=0 then raise exception 'Objetivo no válido.';end if;selected:=p_target;end if;
 if (enemies->selected->>'health')::numeric<=0 then select ord::int-1 into selected from jsonb_array_elements(enemies) with ordinality a(e,ord) where (e->>'health')::numeric>0 order by ord limit 1;selected:=coalesce(selected,0);end if;
 enemy:=enemies->selected;
 select coalesce(jsonb_agg(e),'[]') into loot from jsonb_array_elements(enemies) e where e->>'id'<>enemy->>'id' and (e->>'health')::numeric>0;
 enc:=enemy||jsonb_build_object('id','shadowling','kind','expedition','label',enemy->>'label','expeditionId',tr.id::text,'status',s->>'status','engaged',true,'instanceId',enemy->>'id','enemyAttackAt',s->'nextAttack','enemies',loot,'loot','[]'::jsonb,'looted',true,'selected',selected);
 old_quest:=c.data->'shadowQuest';
 if p_action in('attack','skill') then
  if s->>'status'<>'active' then raise exception 'El encuentro ya ha terminado.';end if;
  if c.data->>'location'<>'brumaluz' then raise exception 'El objetivo no está en tu mapa.';end if;
  perform public.game_store(c.id,c.data||jsonb_build_object('combatEncounter',enc));
  result:=public.combat_action(c.id,p_action);
  select data into d from public.characters where id=c.id;
  enemy:=enemy||jsonb_build_object('health',result->'encounter'->'health');enemies:=jsonb_set(enemies,array[selected::text],enemy);
  for enemy in select value from jsonb_array_elements(coalesce(result->'encounter'->'enemies','[]')) loop
   for idx in 0..jsonb_array_length(enemies)-1 loop if enemies->idx->>'id'=enemy->>'id' then enemies:=jsonb_set(enemies,array[idx::text],enemy);end if;end loop;
  end loop;
  threat:=coalesce((result->>'damage')::numeric,0)*case when c.data->>'cls'='guerrero' then 1.4 else 1 end+coalesce((result->>'healing')::numeric,0)*.5;
  member:=member||jsonb_build_object('threat',coalesce((member->>'threat')::numeric,0)+threat,'contribution',coalesce((member->>'contribution')::numeric,0)+coalesce((result->>'damage')::numeric,0)+coalesce((result->>'healing')::numeric,0));
  c.data:=d||jsonb_build_object('shadowQuest',old_quest);
 elsif p_action not in('start','state','target','leave') then raise exception 'Acción de expedición no válida.';end if;
 member:=member||jsonb_build_object('selected',selected);members:=jsonb_set(members,array[c.id::text],member);
 if p_action='leave' then members:=members-c.id::text;c.data:=c.data-'expeditionId'-'combatEncounter'-'enchantState';end if;
 -- Enemy turns are shared: one tick per encounter, not one tick per polling client.
 if s->>'status'='active' and stamp>=coalesce((s->>'nextAttack')::numeric,stamp) then
  for enemy in select value from jsonb_array_elements(enemies) where (value->>'health')::numeric>0 loop
   victim:=null;best:=-1;
   for member in select jsonb_build_object('id',key,'value',value) from jsonb_each(members) loop
    select p.position into pos from public.world_players p join public.characters ch on ch.id=p.character_id where p.character_id=(member->>'id')::uuid and p.seen_at>now()-interval '15 seconds' and ch.data->>'location'='brumaluz' and public.game_health(ch.data)>0;
    if pos is null then continue;end if;
    if sqrt(power((pos->>'x')::numeric-(enemy->>'x')::numeric,2)+power((pos->>'z')::numeric-(enemy->>'z')::numeric,2))>20 then continue;end if;
    threat:=coalesce((member->'value'->>'threat')::numeric,0);if threat>best then victim:=(member->>'id')::uuid;best:=threat;end if;
   end loop;
   if victim is not null then
    select position into pos from public.world_players where character_id=victim;
    remaining:=sqrt(power((pos->>'x')::numeric-(enemy->>'x')::numeric,2)+power((pos->>'z')::numeric-(enemy->>'z')::numeric,2));
    if remaining>(case when enemy->>'label'='Eco errante' then 6 else 2 end) then
     incoming:=least(2,greatest(0,remaining-1.5))/greatest(remaining,.01);
     hp:=(enemy->>'x')::numeric+((pos->>'x')::numeric-(enemy->>'x')::numeric)*incoming;
     best:=(enemy->>'z')::numeric+((pos->>'z')::numeric-(enemy->>'z')::numeric)*incoming;
     if public.game_rpg_sight('brumaluz',(enemy->>'x')::numeric,(enemy->>'z')::numeric,hp,best) then enemy:=enemy||jsonb_build_object('x',hp,'z',best);for idx in 0..jsonb_array_length(enemies)-1 loop if enemies->idx->>'id'=enemy->>'id' then enemies:=jsonb_set(enemies,array[idx::text],enemy);end if;end loop;end if;
     continue;
    end if;
    if not public.game_rpg_sight('brumaluz',(enemy->>'x')::numeric,(enemy->>'z')::numeric,(pos->>'x')::numeric,(pos->>'z')::numeric) then continue;end if;
    select * into other from public.characters where id=victim for update;d:=public.game_party_data(other.id,other.data);incoming:=(5+(s->>'level')::int*.7)*public.game_guard_multiplier(d);
    barrier:=case when coalesce((d->'enchantState'->>'barrierUntil')::numeric,0)>stamp then coalesce((d->'enchantState'->>'barrier')::numeric,0) else 0 end;
    blocked:=least(incoming,barrier);incoming:=incoming-blocked;if d ? 'enchantState' then d:=jsonb_set(d,'{enchantState,barrier}',to_jsonb(greatest(0,barrier-blocked)));end if;
    blocked:=least(incoming,public.game_overheal_now(d));remaining:=incoming-blocked+coalesce((d->>'incomingFraction')::numeric,0);hp:=greatest(0,public.game_health(d)-floor(remaining));
    d:=d||jsonb_build_object('health',hp,'incomingFraction',remaining-floor(remaining),'overheal',public.game_overheal_now(d)-blocked,'overheal_at',stamp,'combat_at',stamp);if hp=0 then d:=d-'enchantState';end if;
    perform public.game_store(other.id,d);if other.id=c.id then c.data:=d;end if;
   end if;
  end loop;s:=jsonb_set(s,'{nextAttack}',to_jsonb(stamp+2));
 end if;
 if members='{}'::jsonb then s:=jsonb_set(s,'{status}','"fled"');end if;
 if s->>'status'='active' and not exists(select 1 from jsonb_each(members) m join public.characters ch on ch.id=m.key::uuid where public.game_health(ch.data)>0) then s:=jsonb_set(s,'{status}','"failed"');end if;
 select exists(select 1 from jsonb_array_elements(enemies) e where (e->>'health')::numeric>0) into alive;
 if not alive then s:=jsonb_set(s,'{status}','"defeated"');end if;
 member:=members->c.id::text;
 if p_action<>'leave' and not alive and not coalesce((member->>'rewarded')::boolean,false) and coalesce((member->>'contribution')::numeric,0)>0 then
  tier:=least(5,greatest(1,(s->>'level')::int/10+1));
  -- Crafted-only collections are never selected here. Dungeon collection models remain distinct.
  select key into recipe from jsonb_each(public.game_rpg_catalog()->'recipes') r where (r.value->>'tier')::int<=tier and r.key ~ '(alba|eclipse|marea|forja)' and public.game_equipment_item(r.key)->>'cls'=c.data->>'cls' order by random() limit 1;
  if recipe is not null then c.data:=public.game_rpg_give(c.data,public.game_rpg_new_item(recipe,1),true);end if;
  select key into recipe from jsonb_each(public.game_rpg_catalog()->'recipes') r where (r.value->>'tier')::int between 1 and tier order by random() limit 1;
  if recipe is not null then c.data:=public.game_rpg_give(c.data,public.game_rpg_new_item('receta_'||recipe,1),true);end if;
  c.data:=public.game_set_pelines(c.data,public.game_pelines(c.data)+10+tier*5);
  c.data:=public.game_rpg_give(c.data,public.game_rpg_new_item('cuero_'||tier::text,3),true);
  c.data:=public.game_rpg_give(c.data,public.game_rpg_new_item('cuero_0',3),true);
  c.data:=public.game_party_data(c.id,c.data);
  hp:=coalesce((c.data->>'experience')::int,0)+(20+tier*10)*(1+case when coalesce((c.data->>'partyPeers')::int,0)>0 then .02 else 0 end)+coalesce((c.data->>'experienceFraction')::numeric,0);idx:=public.game_level(c.data);
  while idx<50 and hp>=public.game_xp_needed(idx) loop hp:=hp-public.game_xp_needed(idx);idx:=idx+1;end loop;
  c.data:=c.data||jsonb_build_object('experience',floor(hp),'experienceFraction',hp-floor(hp),'level',idx);
  member:=member||'{"rewarded":true}'::jsonb;members:=jsonb_set(members,array[c.id::text],member);
 end if;
 s:=s||jsonb_build_object('members',members,'enemies',enemies);update public.rpg_expeditions set state=s,updated_at=now() where id=tr.id;
 if p_action<>'leave' then
  if (enemies->selected->>'health')::numeric<=0 and alive then select ord::int-1 into selected from jsonb_array_elements(enemies) with ordinality a(e,ord) where (e->>'health')::numeric>0 order by ord limit 1;end if;
  enemy:=enemies->selected;select coalesce(jsonb_agg(e),'[]') into loot from jsonb_array_elements(enemies) e where e->>'id'<>enemy->>'id' and (e->>'health')::numeric>0;
  enc:=enemy||jsonb_build_object('id','shadowling','kind','expedition','expeditionId',tr.id::text,'status',case when public.game_health(c.data)=0 then 'failed' else s->>'status' end,'engaged',true,'instanceId',enemy->>'id','enemyAttackAt',s->'nextAttack','enemies',loot,'loot','[]'::jsonb,'looted',true,'selected',selected,'targets',enemies);
  c.data:=c.data||jsonb_build_object('combatEncounter',enc,'shadowQuest',old_quest);
 end if;
 c.data:=public.game_store(c.id,c.data);
 return coalesce(result,'{}')||jsonb_build_object('data',c.data,'vitals',public.game_public_vitals(c.data),'encounter',c.data->'combatEncounter','quest',c.data->'shadowQuest','members',members);
end $$;
revoke all on function public.expedition_action(uuid,text,int) from public,anon;
grant execute on function public.expedition_action(uuid,text,int) to authenticated;
