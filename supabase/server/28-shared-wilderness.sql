-- Shared outdoor population. Character locks are never acquired by the world tick.
-- Damage/reward mailboxes avoid cross-character lock inversions with movement/healing.
create table if not exists public.wilderness_mobs(spawn text primary key,state jsonb not null,revision bigint not null default 1);
create table if not exists public.wilderness_events(id uuid primary key default gen_random_uuid(),character_id uuid not null,instance_id text not null,kind text not null,payload jsonb not null,created_at timestamptz not null default clock_timestamp());
create index if not exists wilderness_events_character on public.wilderness_events(character_id,created_at);
create unique index if not exists wilderness_reward_once on public.wilderness_events(character_id,instance_id,kind) where kind='reward';
create table if not exists public.wilderness_claims(character_id uuid not null references public.characters(id) on delete cascade,instance_id text not null,encounter jsonb not null,expires_at numeric not null,primary key(character_id,instance_id));
alter table public.wilderness_mobs enable row level security;
alter table public.wilderness_events enable row level security;
alter table public.wilderness_claims enable row level security;
revoke all on table public.wilderness_mobs,public.wilderness_events,public.wilderness_claims from public,anon,authenticated;

create or replace function public.game_wilderness_fresh(site jsonb) returns jsonb language sql volatile set search_path='' as $$
 select jsonb_build_object('id','wild_enemy','kind','wilderness','shared',true,'spawn',site->>'id','enemy',site->>'enemy','label',def->>'label','level',def->'level','status','idle','health',def->'health','maxHealth',def->'health','guard',def->'guard','x',site->'x','z',site->'z','homeX',site->'x','homeZ',site->'z','movedAt',extract(epoch from clock_timestamp()),'enemyAttackAt',extract(epoch from clock_timestamp())+.8,'instanceId',gen_random_uuid()::text,'members','{}'::jsonb,'attackSeq',0,'loot','[]'::jsonb,'looted',true)
 from (select public.game_wilderness_catalog()->'enemies'->(site->>'enemy') def) q
$$;
insert into public.wilderness_mobs(spawn,state) select site->>'id',public.game_wilderness_fresh(site) from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') site
on conflict(spawn) do update set state=case when wilderness_mobs.state->>'enemy' is distinct from excluded.state->>'enemy' then excluded.state else wilderness_mobs.state||jsonb_build_object('homeX',excluded.state->'homeX','homeZ',excluded.state->'homeZ')||case when wilderness_mobs.state->>'status' in('idle','defeated') then jsonb_build_object('x',excluded.state->'x','z',excluded.state->'z') else '{}'::jsonb end end,revision=wilderness_mobs.revision+1
where wilderness_mobs.state->>'homeX' is distinct from excluded.state->>'homeX' or wilderness_mobs.state->>'homeZ' is distinct from excluded.state->>'homeZ' or wilderness_mobs.state->>'enemy' is distinct from excluded.state->>'enemy';
-- Retire removed placements without deleting historical reward/loot mailboxes.
delete from public.wilderness_mobs where not exists(select 1 from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') site where site->>'id'=spawn);

create or replace function public.game_wilderness_in_combat(p_id uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.wilderness_mobs where state->>'status'='active' and state->'members' ? p_id::text)
$$;
create or replace function public.game_wilderness_join(m jsonb,p_id uuid,damage numeric default 0,support numeric default 0) returns jsonb language plpgsql volatile set search_path='' as $$
declare member jsonb:=coalesce(m->'members'->p_id::text,'{}');stamp numeric:=extract(epoch from clock_timestamp());begin
 member:=member||jsonb_build_object('damage',coalesce((member->>'damage')::numeric,0)+damage,'support',coalesce((member->>'support')::numeric,0)+support,'threat',coalesce((member->>'threat')::numeric,1)+damage+support*.5,'contactAt',stamp);
 return m||jsonb_build_object('status','active','members',coalesce(m->'members','{}')||jsonb_build_object(p_id::text,member));
end $$;

create or replace function public.game_wilderness_reward(d jsonb,e jsonb) returns jsonb language plpgsql volatile set search_path='' as $$
declare def jsonb:=public.game_wilderness_catalog()->'enemies'->(e->>'enemy');s jsonb:=coalesce(d->'wilderness','{}')-'respawns';xp int:=coalesce((d->>'experience')::int,0);lvl int:=public.game_level(d);begin
 if def is null then raise exception 'Enemigo desconocido.';end if;
 if lvl<50 then xp:=xp+(def->>'xp')::int;while lvl<50 and xp>=public.game_xp_needed(lvl) loop xp:=xp-public.game_xp_needed(lvl);lvl:=lvl+1;end loop;if lvl>=50 then xp:=public.game_xp_needed(50);end if;end if;
 s:=s||jsonb_build_object('firstRecipe',true,'kills',coalesce((s->>'kills')::int,0)+1);
 return public.game_set_pelines(d,public.game_pelines(d)+(def->>'coins')::int)||jsonb_build_object('wilderness',s,'experience',xp,'level',lvl);
end $$;
create or replace function public.game_wilderness_consume(p_id uuid,d jsonb) returns jsonb language plpgsql volatile set search_path='' as $$
declare row record;e jsonb;entry jsonb;loot jsonb;deliveries jsonb;stamp numeric:=extract(epoch from clock_timestamp());incoming numeric;barrier numeric;blocked numeric;fraction numeric;overheal numeric;hp int;begin
 -- Preserve pending loot from the previous individual implementation once.
 if d->'combatEncounter'->>'kind'='wilderness' and d->'combatEncounter'->>'shared' is distinct from 'true' then
  if d->'combatEncounter'->>'status'='defeated' and d->'combatEncounter'->>'looted' is distinct from 'true' then
   d:=public.game_rpg_settle(d,stamp);deliveries:=d->'rpg'->'deliveries';for entry in select value from jsonb_array_elements(coalesce(d->'combatEncounter'->'loot','[]')) where value<>'null'::jsonb loop deliveries:=deliveries||jsonb_build_array(entry);end loop;d:=jsonb_set(d,'{rpg,deliveries}',deliveries);
  end if;d:=d-'combatEncounter';
 end if;
 for row in select * from public.wilderness_events where character_id=p_id order by created_at,id for update loop
  if row.kind='reward' then
   e:=row.payload;loot:=public.game_wilderness_loot(d,e);d:=public.game_wilderness_reward(d,e);
   insert into public.wilderness_claims(character_id,instance_id,encounter,expires_at) values(p_id,row.instance_id,e||jsonb_build_object('status','defeated','health',0,'loot',loot,'looted',false,'shared',true),extract(epoch from row.created_at)+90) on conflict do nothing;
  elsif row.kind='damage' and d->>'location'='pompelin' and public.game_health(d)>0 and stamp-(row.payload->>'at')::numeric<10 then
   incoming:=(row.payload->>'amount')::numeric*case when row.payload->>'mitigated'='true' then 1 else public.game_guard_multiplier(d) end;
   barrier:=case when coalesce((d->'enchantState'->>'barrierUntil')::numeric,0)>(row.payload->>'at')::numeric then coalesce((d->'enchantState'->>'barrier')::numeric,0) else 0 end;
   blocked:=least(incoming,barrier);incoming:=incoming-blocked;if d?'enchantState' then d:=jsonb_set(d,'{enchantState,barrier}',to_jsonb(barrier-blocked));end if;
   fraction:=incoming+coalesce((d->>'incomingFraction')::numeric,0);incoming:=floor(fraction);overheal:=public.game_overheal_now(d);blocked:=least(overheal,incoming);hp:=greatest(0,public.game_health(d)-(incoming-blocked));
   d:=d||jsonb_build_object('health',hp,'overheal',overheal-blocked,'overheal_at',stamp,'incomingFraction',fraction-incoming,'combat_at',stamp);
   if hp=0 then d:=d-'enchantState';end if;
  end if;
  delete from public.wilderness_events where id=row.id;
 end loop;
 -- Corpses disappear on shared respawn; uncollected personal loot is recoverable.
 for row in select * from public.wilderness_claims where character_id=p_id and expires_at<=stamp for update loop
  d:=public.game_rpg_settle(d,stamp);deliveries:=d->'rpg'->'deliveries';for entry in select value from jsonb_array_elements(row.encounter->'loot') where value<>'null'::jsonb loop deliveries:=deliveries||jsonb_build_array(entry);end loop;d:=jsonb_set(d,'{rpg,deliveries}',deliveries);
  delete from public.wilderness_claims where character_id=p_id and instance_id=row.instance_id;
 end loop;
 return d;
end $$;

create or replace function public.game_wilderness_context(p_id uuid,d jsonb,px numeric,pz numeric) returns jsonb language plpgsql volatile set search_path='' as $$
declare m jsonb;count int;selected text:=d->'wilderness'->>'selected';secondary jsonb;begin
 select count(*) into count from public.wilderness_mobs where state->>'status'='active' and state->'members' ? p_id::text;
 if count>0 then d:=d||jsonb_build_object('combat_at',extract(epoch from clock_timestamp()));end if;
 if d->>'location'<>'pompelin' or public.game_health(d)=0 then
  if d->'combatEncounter'->>'kind'='wilderness' then d:=d-'combatEncounter';end if;return d;
 end if;
 select state into m from public.wilderness_mobs where spawn=selected and state->>'status' in('idle','active');
 if m is null then
  select state into m from public.wilderness_mobs where state->>'status'='active' and state->'members' ? p_id::text order by power(px-(state->>'x')::numeric,2)+power(pz-(state->>'z')::numeric,2),spawn limit 1;
 end if;
 if m is null then
  if d->'combatEncounter'->>'kind'='wilderness' then d:=d-'combatEncounter';end if;
  return jsonb_set(d,'{wilderness}',coalesce(d->'wilderness','{}')-'selected');
 end if;
 select coalesce(jsonb_agg((state-'members'-'trail')||jsonb_build_object('id',spawn)),'[]') into secondary from public.wilderness_mobs where spawn<>m->>'spawn' and state->>'status' in('active','idle') and power((state->>'x')::numeric-(m->>'x')::numeric,2)+power((state->>'z')::numeric-(m->>'z')::numeric,2)<=16;
 d:=jsonb_set(d,'{wilderness}',(coalesce(d->'wilderness','{}')-'respawns')||jsonb_build_object('selected',m->>'spawn'));
 return jsonb_set(d,'{combatEncounter}',(m-'members'-'trail')||jsonb_build_object('status','active','attackers',count,'engaged',count>0,'loot','[]'::jsonb,'looted',true,'enemies',secondary));
end $$;

create or replace function public.game_wilderness_view(p_id uuid) returns jsonb language sql volatile set search_path='' as $$
 select jsonb_build_object('shared',true,'serverTime',extract(epoch from clock_timestamp()),'skillReadyAt',coalesce((c.data->>'combatNextSkill')::numeric,0),'attackReadyAt',coalesce((c.data->>'combatNextAttack')::numeric,0),'mobs',case when c.data->>'location'='pompelin' then coalesce((select jsonb_agg((state-'members'-'trail')||jsonb_build_object('revision',revision,'attackingYou',state->>'status'='active' and state->'members' ? p_id::text) order by spawn) from public.wilderness_mobs),'[]'::jsonb) else '[]'::jsonb end,'corpses',coalesce((select jsonb_agg(encounter-'members'-'trail') from public.wilderness_claims where character_id=p_id and expires_at>extract(epoch from clock_timestamp())),'[]'::jsonb),'inCombat',public.game_wilderness_in_combat(p_id)) from public.characters c where c.id=p_id
$$;

-- Preserve the original story resolver created by 27; only replace its outdoor route.
create or replace function public.game_combat_tick(p_id uuid,d jsonb,p_x double precision,p_z double precision) returns jsonb language plpgsql volatile security definer set search_path='' as $$ begin
 perform public.game_wilderness_world_tick();d:=public.game_wilderness_consume(p_id,d);
 if d->>'location'='pompelin' then return public.game_wilderness_context(p_id,d,p_x::numeric,p_z::numeric);end if;
 if d->'combatEncounter'->>'kind'='wilderness' then d:=d-'combatEncounter';end if;
 return public.game_story_combat_tick(p_id,d,p_x,p_z);
end $$;

create or replace function public.wilderness_action(p_character_id uuid,p_action text,p_spawn text default null,p_slot int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters;w public.world_players;m jsonb;before jsonb;secondary jsonb;old jsonb;result jsonb:='{}';e jsonb;loot jsonb;entry jsonb;i int;stamp numeric;begin
 c:=public.game_lock_character(p_character_id);
 select * into w from public.world_players where user_id=(select auth.uid()) and character_id=c.id and seen_at>clock_timestamp()-interval '15 seconds' for update;
 if not found or c.data->>'location' is distinct from 'pompelin' then raise exception 'Debes estar en Pompelín.';end if;
 if p_action is null or p_action not in('state','start','attack','skill','loot','stop') then raise exception 'COMBAT_INVALID_ACTION';end if;
 if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) then raise exception 'COMBAT_UNAVAILABLE';end if;
 -- Lock order: own character, own presence, shared population. Never another character.
 perform pg_catalog.pg_advisory_xact_lock(731029,4);perform public.game_wilderness_world_tick();stamp:=extract(epoch from clock_timestamp());c.data:=public.game_wilderness_consume(c.id,c.data);
 if p_action<>'state' and public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD';end if;
 if p_action='start' then
  select state into m from public.wilderness_mobs where spawn=p_spawn for update;
  if m is null or m->>'status' not in('idle','active') then raise exception 'COMBAT_NO_TARGET';end if;
  if sqrt(power((w.position->>'x')::numeric-(m->>'x')::numeric,2)+power((w.position->>'z')::numeric-(m->>'z')::numeric,2))>10 or not public.game_rpg_sight('pompelin',(w.position->>'x')::numeric,(w.position->>'z')::numeric,(m->>'x')::numeric,(m->>'z')::numeric) then raise exception 'Acércate a un enemigo visible.';end if;
  if not public.game_has_weapon(c.data) then raise exception 'COMBAT_WEAPON_REQUIRED';end if;
  m:=public.game_wilderness_join(m,c.id);update public.wilderness_mobs set state=m,revision=revision+1 where spawn=p_spawn;
  c.data:=jsonb_set(c.data,'{wilderness}',coalesce(c.data->'wilderness','{}')||jsonb_build_object('selected',p_spawn));
 elsif p_action in('attack','skill') then
  c.data:=public.game_wilderness_context(c.id,c.data,(w.position->>'x')::numeric,(w.position->>'z')::numeric);
  select state into before from public.wilderness_mobs where spawn=c.data->'combatEncounter'->>'spawn' for update;
  if before is null or before->>'status' not in('active','idle') or p_spawn is not null and before->>'instanceId'<>p_spawn then
   result:=jsonb_build_object('cancelled',true,'damage',0,'healing',0);
  else
  c.data:=public.game_store(c.id,c.data);result:=public.game_wilderness_hit(c.id,p_action);select data into c.data from public.characters where id=c.id;
  m:=before||jsonb_build_object('health',result->'encounter'->'health');
  if coalesce((result->>'damage')::numeric,0)>0 then m:=public.game_wilderness_join(m,c.id,(result->>'damage')::numeric);end if;
  m:=public.game_wilderness_finish(m);update public.wilderness_mobs set state=m,revision=revision+1 where spawn=before->>'spawn';
  for secondary in select value from jsonb_array_elements(coalesce(result->'encounter'->'enemies','[]')) loop
   select state into old from public.wilderness_mobs where spawn=secondary->>'id' for update;
   if old->>'instanceId'=secondary->>'instanceId' and old->>'status' in('active','idle') and (secondary->>'health')::numeric<(old->>'health')::numeric then
    m:=public.game_wilderness_join(old||jsonb_build_object('health',secondary->'health'),c.id,(old->>'health')::numeric-(secondary->>'health')::numeric);m:=public.game_wilderness_finish(m);update public.wilderness_mobs set state=m,revision=revision+1 where spawn=secondary->>'id';
   end if;
  end loop;
  result:=result||jsonb_build_object('impact',jsonb_build_object('x',before->'x','z',before->'z','label',before->'label'));
  if coalesce((result->>'healing')::numeric,0)>0 then perform public.game_wilderness_heal_threat(c.id,c.id,(result->>'healing')::numeric);end if;
  c.data:=public.game_wilderness_consume(c.id,c.data);
  end if;
 elsif p_action='loot' then
  select encounter into e from public.wilderness_claims where character_id=c.id and instance_id=p_spawn for update;
  if e is null then raise exception 'LOOT_INVALID';end if;
  if sqrt(power((w.position->>'x')::numeric-(e->>'x')::numeric,2)+power((w.position->>'z')::numeric-(e->>'z')::numeric,2))>3 then raise exception 'Acércate al cuerpo.';end if;
  loot:=e->'loot';if p_slot is not null and (p_slot<0 or p_slot>=jsonb_array_length(loot)) then raise exception 'LOOT_INVALID';end if;
  for i in 0..jsonb_array_length(loot)-1 loop if p_slot is not null and i<>p_slot then continue;end if;entry:=loot->i;if entry='null'::jsonb then continue;end if;c.data:=public.game_rpg_give(c.data,public.game_rpg_new_item(entry->>'id',(entry->>'count')::int),false);loot:=jsonb_set(loot,array[i::text],'null'::jsonb);end loop;
  if not exists(select 1 from jsonb_array_elements(loot) item where item<>'null'::jsonb) then delete from public.wilderness_claims where character_id=c.id and instance_id=p_spawn;
  else update public.wilderness_claims set encounter=e||jsonb_build_object('loot',loot) where character_id=c.id and instance_id=p_spawn;end if;
 elsif p_action='stop' then
  -- Releasing a selection never pacifies hostile creatures or resets their health.
  c.data:=jsonb_set(c.data,'{wilderness}',coalesce(c.data->'wilderness','{}')-'selected');
 end if;
 c.data:=public.game_wilderness_context(c.id,c.data,(w.position->>'x')::numeric,(w.position->>'z')::numeric);c.data:=public.game_store(c.id,c.data);
 if public.game_health(c.data)=0 then update public.world_players set dead=true where character_id=c.id;end if;
 return result||jsonb_build_object('data',c.data,'vitals',public.game_public_vitals(c.data),'encounter',c.data->'combatEncounter','wilderness',public.game_wilderness_view(c.id),'attackCooldown',greatest(0,coalesce((c.data->>'combatNextAttack')::numeric,0)-extract(epoch from clock_timestamp())),'skillCooldown',greatest(0,coalesce((c.data->>'combatNextSkill')::numeric,0)-extract(epoch from clock_timestamp())));
end $$;

do $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'game_wilderness_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;
end $$;
revoke all on function public.wilderness_action(uuid,text,text,int) from public,anon;
grant execute on function public.wilderness_action(uuid,text,text,int) to authenticated;
create or replace function public.game_wilderness_finish(m jsonb) returns jsonb language plpgsql volatile set search_path='' as $$
declare member record;pos jsonb;stamp numeric:=extract(epoch from clock_timestamp());begin
 if (m->>'health')::numeric>0 or m->>'status'='defeated' then return m;end if;
 for member in select key,value from jsonb_each(m->'members') loop
  if coalesce((member.value->>'damage')::numeric,0)+coalesce((member.value->>'support')::numeric,0)<=0 then continue;end if;
  select w.position into pos from public.world_players w join public.characters c on c.id=w.character_id where w.character_id=member.key::uuid and w.seen_at>clock_timestamp()-interval '15 seconds' and c.data->>'location'='pompelin';
  if pos is null or power((pos->>'x')::numeric-(m->>'x')::numeric,2)+power((pos->>'z')::numeric-(m->>'z')::numeric,2)>3600 then continue;end if;
  insert into public.wilderness_events(character_id,instance_id,kind,payload) values(member.key::uuid,m->>'instanceId','reward',m-'members'-'trail') on conflict do nothing;
 end loop;
 return m||jsonb_build_object('status','defeated','health',0,'target',null,'windup',null,'respawnAt',stamp+90,'members','{}'::jsonb);
end $$;

create or replace function public.game_wilderness_world_tick() returns void language plpgsql volatile set search_path='' as $$
declare row record;player record;site jsonb;m jsonb;def jsonb;member jsonb;members jsonb;observers jsonb;stamp numeric;dt numeric;dx numeric;dz numeric;distance numeric;step numeric;nx numeric;nz numeric;ax numeric;az numeric;len numeric;projection numeric;hit boolean;victim text;best numeric;score numeric;pos jsonb;target_pos jsonb;old_target text;blocked boolean;best_visible boolean;trail jsonb;waypoint jsonb;
begin
 if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) or not pg_catalog.pg_try_advisory_xact_lock(731029,4) then return;end if;
 stamp:=extract(epoch from clock_timestamp());
 -- Multiple players synchronize independently. Sample presence only once per
 -- simulation step rather than repeating character scans for every creature.
 if not exists(select 1 from public.wilderness_mobs where stamp-coalesce((state->>'movedAt')::numeric,0)>=.15 and (state->>'status'<>'defeated' or stamp>=coalesce((state->>'respawnAt')::numeric,0))) then return;end if;
 select coalesce(jsonb_agg(jsonb_build_object('character_id',w.character_id,'position',w.position,'guard',public.game_guard_multiplier(c.data)) order by w.character_id),'[]'::jsonb) into observers
 from public.world_players w join public.characters c on c.id=w.character_id
 where w.seen_at>clock_timestamp()-interval '5 seconds' and not w.dead and c.data->>'location'='pompelin' and public.game_health(c.data)>0;
 for row in select * from public.wilderness_mobs order by spawn for update loop
  m:=row.state;dt:=stamp-coalesce((m->>'movedAt')::numeric,stamp);if dt<.15 then continue;end if;
  if dt>3 then m:=m||jsonb_build_object('windup',null,'enemyAttackAt',stamp+.8);end if;
  def:=public.game_wilderness_catalog()->'enemies'->(m->>'enemy');
  if m->>'status'='defeated' then
   if stamp>=coalesce((m->>'respawnAt')::numeric,0) then select value into site from jsonb_array_elements(public.game_wilderness_catalog()->'spawns') where value->>'id'=row.spawn;m:=public.game_wilderness_fresh(site);else continue;end if;
  end if;
  -- With no observers time does not fast-forward attacks or movement.
  dt:=least(.5,greatest(0,dt));
  if m->>'status'='returning' then
   trail:=coalesce(m->'trail','[]');waypoint:=jsonb_build_object('x',m->'homeX','z',m->'homeZ');
   if not public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(m->>'homeX')::numeric,(m->>'homeZ')::numeric) and jsonb_array_length(trail)>0 then
    waypoint:=trail->-1;if power((waypoint->>'x')::numeric-(m->>'x')::numeric,2)+power((waypoint->>'z')::numeric-(m->>'z')::numeric,2)<.04 then trail:=trail-(jsonb_array_length(trail)-1);waypoint:=coalesce(trail->-1,jsonb_build_object('x',m->'homeX','z',m->'homeZ'));end if;
   else trail:='[]';end if;
   dx:=(waypoint->>'x')::numeric-(m->>'x')::numeric;dz:=(waypoint->>'z')::numeric-(m->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);step:=least(distance,dt*4.5);
   m:=m||jsonb_build_object('x',(m->>'x')::numeric+dx/greatest(.001,distance)*step,'z',(m->>'z')::numeric+dz/greatest(.001,distance)*step);
   m:=m||jsonb_build_object('trail',trail);
   if power((m->>'x')::numeric-(m->>'homeX')::numeric,2)+power((m->>'z')::numeric-(m->>'homeZ')::numeric,2)<.04 then m:=m||jsonb_build_object('status','idle','health',m->'maxHealth','x',m->'homeX','z',m->'homeZ','enemyAttackAt',stamp+.8,'blockedAt',null,'trail','[]'::jsonb);end if;
  else
   members:='{}';victim:=null;best:=-1;target_pos:=null;old_target:=m->>'target';best_visible:=false;
   for player in select * from jsonb_to_recordset(observers) as p(character_id uuid,position jsonb,guard numeric) loop
    pos:=player.position;dx:=(pos->>'x')::numeric-(m->>'x')::numeric;dz:=(pos->>'z')::numeric-(m->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);member:=m->'members'->player.character_id::text;
    if sqrt(power((pos->>'x')::numeric-(m->>'homeX')::numeric,2)+power((pos->>'z')::numeric-(m->>'homeZ')::numeric,2))>24 then continue;end if;
    if member is null and distance>(def->>'aggro')::numeric then continue;end if;
    blocked:=not public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(pos->>'x')::numeric,(pos->>'z')::numeric);
    if member is null then
     if blocked then continue;end if;
     member:=jsonb_build_object('damage',0,'support',0,'threat',1,'contactAt',stamp);
    elsif distance>greatest((def->>'aggro')::numeric+5,(def->>'range')::numeric+3) and stamp-coalesce((member->>'contactAt')::numeric,0)>6 then continue;end if;
    if not blocked then member:=member||jsonb_build_object('seenAt',stamp);elsif stamp-coalesce((member->>'seenAt')::numeric,(member->>'contactAt')::numeric,0)>6 then continue;end if;
    members:=members||jsonb_build_object(player.character_id::text,member);
    -- Prefer a reachable participant over an obscured target. The 20% threat
    -- margin still prevents oscillation between equally reachable players.
    score:=coalesce((member->>'threat')::numeric,1)*case when player.character_id::text=old_target then 1.2 else 1 end;
    if victim is null or not blocked and not best_visible or (not blocked)=best_visible and (score>best or score=best and distance<sqrt(power((target_pos->>'x')::numeric-(m->>'x')::numeric,2)+power((target_pos->>'z')::numeric-(m->>'z')::numeric,2))) then best:=score;victim:=player.character_id::text;target_pos:=pos;best_visible:=not blocked;end if;
   end loop;
   m:=m||jsonb_build_object('members',members);
   if victim is null then
    if m->>'status'='active' then m:=m||jsonb_build_object('status','returning','target',null,'windup',null,'members','{}'::jsonb);end if;
   else
    if victim is distinct from old_target then m:=m||jsonb_build_object('blockedAt',null);end if;
    m:=m||jsonb_build_object('status','active','target',victim,'targetX',target_pos->'x','targetZ',target_pos->'z');
    dx:=(target_pos->>'x')::numeric-(m->>'x')::numeric;dz:=(target_pos->>'z')::numeric-(m->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);
    if (m->>'windup')::numeric is not null and (m->>'windup')::numeric<=stamp then
     ax:=(m->>'aimX')::numeric-(m->>'x')::numeric;az:=(m->>'aimZ')::numeric-(m->>'z')::numeric;len:=greatest(.001,sqrt(ax*ax+az*az));
     -- Area attacks strike every player actually inside, not only the chosen target.
     for player in select * from jsonb_to_recordset(observers) as p(character_id uuid,position jsonb,guard numeric) loop
      pos:=player.position;dx:=(pos->>'x')::numeric-(m->>'x')::numeric;dz:=(pos->>'z')::numeric-(m->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);
      if def->>'pattern'='circle' then hit:=power((pos->>'x')::numeric-(m->>'aimX')::numeric,2)+power((pos->>'z')::numeric-(m->>'aimZ')::numeric,2)<=power((def->>'radius')::numeric,2);
      elsif def->>'pattern'='line' then projection:=(dx*ax+dz*az)/(len*len);hit:=projection between 0 and 1 and abs(dx*az-dz*ax)/len<=(def->>'radius')::numeric;
      else hit:=distance<=(def->>'radius')::numeric and (distance<.1 or (dx*ax+dz*az)/greatest(.001,distance*len)>=.5);end if;
      if hit and public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(pos->>'x')::numeric,(pos->>'z')::numeric) then
       insert into public.wilderness_events(character_id,instance_id,kind,payload) values(player.character_id,m->>'instanceId','damage',jsonb_build_object('amount',(def->>'damage')::numeric*player.guard,'mitigated',true,'at',stamp,'spawn',m->>'spawn'));
       m:=public.game_wilderness_join(m,player.character_id,0,(def->>'damage')::numeric*.25);
      end if;
     end loop;
     if def->>'pattern'='line' and public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(m->>'aimX')::numeric,(m->>'aimZ')::numeric) then m:=m||jsonb_build_object('trail',coalesce(m->'trail','[]')||jsonb_build_array(jsonb_build_object('x',m->'x','z',m->'z')),'x',m->'aimX','z',m->'aimZ');end if;
     m:=m||jsonb_build_object('windup',null,'attackSeq',coalesce((m->>'attackSeq')::int,0)+1,'enemyAttackAt',stamp+(def->>'interval')::numeric);
    elsif (m->>'windup')::numeric is null then
     if distance>(def->>'range')::numeric then
      step:=least(greatest(0,distance-(def->>'range')::numeric+.05),dt*(def->>'speed')::numeric);nx:=(m->>'x')::numeric+dx/greatest(.001,distance)*step;nz:=(m->>'z')::numeric+dz/greatest(.001,distance)*step;
      blocked:=not public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,nx,nz);
      if not blocked then
       trail:=coalesce(m->'trail','[]');waypoint:=trail->-1;
       if waypoint is null or power((waypoint->>'x')::numeric-(m->>'x')::numeric,2)+power((waypoint->>'z')::numeric-(m->>'z')::numeric,2)>.16 then if jsonb_array_length(trail)>=256 then trail:=trail-1;end if;trail:=trail||jsonb_build_array(jsonb_build_object('x',m->'x','z',m->'z'));end if;
       m:=m||jsonb_build_object('trail',trail,'x',nx,'z',nz,'blockedAt',null);
      elsif coalesce((m->>'blockedAt')::numeric,stamp)+4<stamp then m:=m||jsonb_build_object('status','returning','target',null,'members','{}'::jsonb);
      else m:=m||jsonb_build_object('blockedAt',coalesce((m->>'blockedAt')::numeric,stamp));end if;
     elsif stamp>=coalesce((m->>'enemyAttackAt')::numeric,0) and public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(target_pos->>'x')::numeric,(target_pos->>'z')::numeric) then
      ax:=(target_pos->>'x')::numeric;az:=(target_pos->>'z')::numeric;
      if def->>'pattern' in('line','cone') then ax:=(m->>'x')::numeric+case when distance<.001 then 0 else dx/distance end*(def->>'reach')::numeric;az:=(m->>'z')::numeric+case when distance<.001 then 1 else dz/distance end*(def->>'reach')::numeric;end if;
      m:=m||jsonb_build_object('windup',stamp+(def->>'windup')::numeric,'aimX',ax,'aimZ',az);
     end if;
    end if;
   end if;
  end if;
  update public.wilderness_mobs set state=m||jsonb_build_object('movedAt',stamp),revision=revision+1 where spawn=row.spawn;
 end loop;
 -- Abandoned mailboxes are safe to discard only when their character no longer exists.
 delete from public.wilderness_events e where e.created_at<clock_timestamp()-interval '1 day' and not exists(select 1 from public.characters c where c.id=e.character_id);
end $$;

create or replace function public.game_wilderness_heal_threat(p_healer uuid,p_target uuid,amount numeric) returns void language plpgsql volatile set search_path='' as $$
declare row record;begin
 if amount<=0 then return;end if;
 perform pg_catalog.pg_advisory_xact_lock(731029,4);
 for row in select * from public.wilderness_mobs where state->>'status'='active' and state->'members' ? p_target::text order by spawn for update loop
  update public.wilderness_mobs set state=public.game_wilderness_join(row.state,p_healer,0,amount),revision=revision+1 where spawn=row.spawn;
 end loop;
end $$;
-- Keep every helper private, including those declared after the public RPC above.
do $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'game_wilderness_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;
end $$;
