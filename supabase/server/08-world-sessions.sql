create or replace function public.game_world_snapshot(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.character_id, 'userId', w.user_id, 'username', p.username,
    'vitals', public.game_public_vitals(public.game_food_data(c.id,public.game_party_data(c.id,c.data))),
    'data', public.game_public_character(c.data) || jsonb_build_object('name', c.name),
    'position', w.position, 'facing', w.facing, 'jump', w.jump, 'wave', w.wave,
    'dead', public.game_health(c.data) = 0
  ) order by w.character_id), '[]'::jsonb)
  from public.world_players w
  join public.characters c on c.id = w.character_id
  join public.profiles p on p.user_id = w.user_id
  where w.user_id <> p_user_id and w.seen_at > now() - interval '15 seconds'
    and coalesce(c.data ->> 'location', 'brumaluz') = (
      select coalesce(me.data ->> 'location', 'brumaluz')
      from public.world_players mine join public.characters me on me.id = mine.character_id
      where mine.user_id = p_user_id
    )
$$;

create or replace function public.game_party_cleanup()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(731029,2);
  delete from public.party_responses where created_at<=now()-interval '5 minutes';
  delete from public.party_members m where not exists (
    select 1 from public.world_players w where w.user_id=m.user_id and w.character_id=m.character_id
    and w.seen_at > now()-interval '15 seconds'
  );
  delete from public.party_invites i where i.expires_at<=now()
    or exists(select 1 from public.party_members m where m.user_id=i.target_user)
    or not exists(select 1 from public.world_players w where w.user_id=i.target_user and w.seen_at>now()-interval '15 seconds');
  delete from public.parties p where not exists(select 1 from public.party_members m where m.party_id=p.id);
end $$;
revoke all on function public.game_party_cleanup() from public, anon, authenticated;

create or replace function public.world_join(p_character_id uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.characters;
  previous public.world_players;
  spawn jsonb;
  pos jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_session_id is null then raise exception 'INVALID_WORLD_STATE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 1));
  c := public.game_lock_character(p_character_id);
  spawn := public.game_location_spawn(coalesce(c.data ->> 'location', 'brumaluz'));
  select * into previous from public.world_players where user_id = uid;
  if previous.character_id is not null and previous.character_id <> c.id then
    perform public.game_lock_character(previous.character_id);
  end if;
  select * into previous from public.world_players where user_id = uid for update;
  -- Conserva la posición más reciente al abrir otra pestaña, sin retroceder al último checkpoint.
  if previous.character_id is not null and not previous.dead then
    perform public.game_store(previous.character_id,
      (select data from public.characters where id = previous.character_id)
      || jsonb_build_object('position', previous.position, 'position_at', extract(epoch from now())));
  end if;
  if previous.character_id = c.id and not previous.dead then pos := previous.position;
  else pos := coalesce(nullif(c.data -> 'position', 'null'::jsonb), jsonb_build_object('x', spawn -> 'x', 'z', spawn -> 'z', 'yaw', 0));
  end if;
  insert into public.world_players(user_id, character_id, session_id, position, facing, dead)
    values(uid, c.id, p_session_id, pos, coalesce((pos ->> 'yaw')::double precision, 0) + pi(), public.game_health(c.data) = 0)
  on conflict (user_id) do update set
    character_id = excluded.character_id, session_id = excluded.session_id,
    position = excluded.position, facing = excluded.facing, jump = 0, wave = 0,
    dead = excluded.dead,
    movement_credit = case when world_players.character_id = excluded.character_id then world_players.movement_credit else 3 end,
    seen_at = now(), saved_at = now();
  c.data := public.game_store(c.id,c.data);
  perform public.game_party_cleanup();
  return jsonb_build_object('position', pos, 'status', 'ok', 'players', public.game_world_snapshot(uid),
    'encounter',c.data->'combatEncounter',
    'vitals',public.game_public_vitals(c.data),
    'food',jsonb_build_object('buff',c.data->'foodBuff','revision',c.data->'foodRevision','at',c.data->'food_at'),
    'clock',public.world_clock());
end;
$$;

create or replace function public.world_sync(p_character_id uuid, p_session_id uuid, p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.characters;
  w public.world_players;
  cfg_speed double precision := (select (value #>> '{}')::double precision from public.server_config where key = 'max_speed');
  spawn jsonb;
  px double precision;
  pz double precision;
  pyaw double precision;
  facing double precision;
  v_jump double precision;
  v_wave int;
  credit double precision;
  distance double precision;
  is_dead boolean;
  status text := 'ok';
  combat_data jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 1));
  c := public.game_lock_character(p_character_id);
  spawn := public.game_location_spawn(coalesce(c.data ->> 'location', 'brumaluz'));
  select * into w from public.world_players where user_id = uid for update;
  if w.session_id is distinct from p_session_id or w.character_id is distinct from c.id then
    raise exception 'WORLD_SESSION_REPLACED';
  end if;
  if jsonb_typeof(p_state) is distinct from 'object' then raise exception 'INVALID_WORLD_STATE'; end if;
  if not (p_state ?& array['x','z','yaw','facing','jump','wave']) or exists (
    select 1 from jsonb_each(p_state) where key = any(array['x','z','yaw','facing','jump','wave']) and jsonb_typeof(value) <> 'number'
  ) then raise exception 'INVALID_WORLD_STATE'; end if;
  px := (p_state ->> 'x')::double precision;
  pz := (p_state ->> 'z')::double precision;
  pyaw := (p_state ->> 'yaw')::double precision;
  facing := (p_state ->> 'facing')::double precision;
  v_jump := (p_state ->> 'jump')::double precision;
  -- El cliente puede estar saltando sobre una superficie baja (salto + altura del objeto).
  if not (public.game_location_contains(coalesce(c.data ->> 'location', 'brumaluz'), px, pz)
    and pyaw between -1000000 and 1000000 and facing between -1000000 and 1000000
    and v_jump between 0 and 2.4 and (p_state ->> 'wave')::numeric between 0 and 2147483647
    and (p_state ->> 'wave')::numeric = trunc((p_state ->> 'wave')::numeric)) then
    raise exception 'INVALID_WORLD_STATE';
  end if;
  v_wave := (p_state ->> 'wave')::int;
  is_dead := public.game_health(c.data) = 0;
  credit := least(3, w.movement_credit) + cfg_speed * least(15, greatest(0, extract(epoch from now() - w.seen_at)));
  distance := sqrt(power(px - (w.position ->> 'x')::double precision, 2) + power(pz - (w.position ->> 'z')::double precision, 2));
  if w.dead and not is_dead then
    w.position := coalesce(nullif(c.data -> 'position', 'null'::jsonb), jsonb_build_object('x', spawn -> 'x', 'z', spawn -> 'z', 'yaw', 0));
    status := 'corrected';
  elsif is_dead or distance > credit then
    status := 'corrected';
  else
    w.position := jsonb_build_object('x', px, 'z', pz, 'yaw', pyaw);
    w.facing := facing;
    credit := greatest(0, credit - distance);
  end if;
  update public.world_players set position = w.position, facing = w.facing,
    jump = case when is_dead then 0 else v_jump end, wave = v_wave,
    dead = is_dead, movement_credit = least(3, credit), seen_at = now()
    where user_id = uid;
  if c.data->'combatEncounter'->>'status'='active' then
    combat_data:=public.game_combat_tick(c.id,c.data,(w.position->>'x')::double precision,(w.position->>'z')::double precision);
    if combat_data is distinct from c.data then
      c.data:=public.game_store(c.id,combat_data);
      if public.game_health(c.data)=0 then
        update public.world_players set dead=true where user_id=uid;
      end if;
    end if;
  end if;
  if now() - w.saved_at >= interval '5 seconds' or now()-w.seen_at >= interval '15 seconds' then
    perform public.game_store(c.id, c.data || jsonb_build_object('position', w.position, 'position_at', extract(epoch from now())));
    update public.world_players set saved_at = now() where user_id = uid;
  end if;
  return jsonb_build_object('status', status, 'position', w.position, 'players', public.game_world_snapshot(uid),
    'encounter',c.data->'combatEncounter',
    'vitals',public.game_public_vitals(c.data),
    'food',jsonb_build_object('buff',c.data->'foodBuff','revision',c.data->'foodRevision','at',c.data->'food_at'),
    'clock',public.world_clock());
end;
$$;

create or replace function public.world_leave(p_character_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.characters;
  w public.world_players;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 1));
  select * into c from public.characters where id = p_character_id and user_id = uid for update;
  if not found then return; end if;
  select * into w from public.world_players where user_id = uid and character_id = p_character_id and session_id = p_session_id for update;
  if not found then return; end if;
  perform public.game_store(c.id, c.data || jsonb_build_object('position', w.position, 'position_at', extract(epoch from now())));
  delete from public.world_players where user_id = uid and session_id = p_session_id;
  perform public.game_party_cleanup();
end;
$$;

revoke all on function public.game_public_character(jsonb), public.game_world_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.world_join(uuid, uuid), public.world_sync(uuid, uuid, jsonb), public.world_leave(uuid, uuid) from public, anon;
grant execute on function public.world_join(uuid, uuid), public.world_sync(uuid, uuid, jsonb), public.world_leave(uuid, uuid) to authenticated;

-- Viajar por un portal a otro mapa de Pompelín. Exige estar vivo, fuera de combate y junto al portal
-- (según la última posición sincronizada); coloca al personaje en la llegada del destino.
-- La casa de Isberto se abre cuando él invita al jugador; los personajes anteriores a la historia la tienen siempre abierta.
create or replace function public.game_isberto_house_open(d jsonb)
returns boolean language sql immutable set search_path='' as $$
  select jsonb_typeof(d->'welcome') is distinct from 'object' or coalesce(d->>'shadowQuest','') in ('returning','returned')
$$;
revoke all on function public.game_isberto_house_open(jsonb) from public,anon,authenticated;

create or replace function public.world_travel(p_character_id uuid, p_session_id uuid, p_portal text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.characters;
  w public.world_players;
  p public.world_portals;
  here text;
  distance double precision;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 1));
  c := public.game_lock_character(p_character_id);
  select * into w from public.world_players where user_id = uid for update;
  if w.session_id is distinct from p_session_id or w.character_id is distinct from c.id then
    raise exception 'WORLD_SESSION_REPLACED';
  end if;
  if w.seen_at < now() - interval '15 seconds' then raise exception 'WORLD_SESSION_REPLACED'; end if;
  if public.game_health(c.data) = 0 or w.dead then raise exception 'CHARACTER_DEAD'; end if;
  if c.data -> 'combatEncounter' ->> 'status' = 'active'
    and coalesce((c.data->'combatEncounter'->>'engaged')::boolean,
      (c.data->'combatEncounter'->>'health')::numeric<(c.data->'combatEncounter'->>'maxHealth')::numeric,false)
    then raise exception 'IN_COMBAT'; end if;
  here := coalesce(c.data ->> 'location', 'brumaluz');
  select * into p from public.world_portals where map = here and id = p_portal;
  if not found then raise exception 'PORTAL_NOT_FOUND'; end if;
  -- La casa de Isberto está cerrada hasta que él invita al jugador (los personajes anteriores a la historia, siempre abierta).
  if p.target_map = 'casa_de_isberto_interior' and not public.game_isberto_house_open(c.data) then raise exception 'PORTAL_LOCKED'; end if;
  distance := sqrt(power((w.position ->> 'x')::double precision - p.x, 2) + power((w.position ->> 'z')::double precision - p.z, 2));
  if distance is null or distance > p.radius + 0.5 then raise exception 'PORTAL_TOO_FAR'; end if;
  if not public.game_location_contains(p.target_map, (p.target ->> 'x')::double precision, (p.target ->> 'z')::double precision) then
    raise exception 'INVALID_WORLD_STATE';
  end if;
  c.data := public.game_store(c.id, c.data || jsonb_build_object(
    'location', p.target_map, 'position', p.target, 'position_at', extract(epoch from now())));
  update public.world_players set position = p.target,
    facing = coalesce((p.target ->> 'yaw')::double precision, 0) + pi(), jump = 0,
    movement_credit = 3, seen_at = now(), saved_at = now()
    where user_id = uid;
  return jsonb_build_object('status', 'ok', 'location', p.target_map, 'position', p.target,
    'players', public.game_world_snapshot(uid),
    'encounter', c.data -> 'combatEncounter',
    'vitals', public.game_public_vitals(c.data),
    'food', jsonb_build_object('buff', c.data -> 'foodBuff', 'revision', c.data -> 'foodRevision', 'at', c.data -> 'food_at'),
    'clock', public.world_clock());
end;
$$;
revoke all on function public.world_travel(uuid, uuid, text) from public, anon;
grant execute on function public.world_travel(uuid, uuid, text) to authenticated;

