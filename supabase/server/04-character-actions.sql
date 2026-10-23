-- ---------- Acciones que puede pedir el cliente ----------

create or replace function public.upgrade_skill(p_character_id uuid,p_skill_id text,p_expected_rank int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  current_rank int := public.game_skill_rank(c.data);
begin
  if p_skill_id is distinct from public.game_skill_id(c.data->>'cls') then raise exception 'SKILL_INVALID'; end if;
  if p_expected_rank is distinct from current_rank then raise exception 'SKILL_CHANGED'; end if;
  if current_rank>=5 then raise exception 'SKILL_MAX_RANK'; end if;
  if public.game_level(c.data)<current_rank*2 then raise exception 'SKILL_LEVEL_REQUIRED'; end if;
  if public.game_level(c.data)/2-(current_rank-1)<1 then raise exception 'SKILL_NO_POINTS'; end if;
  return public.game_store(c.id,c.data||jsonb_build_object('skillRanks',
    coalesce(c.data->'skillRanks','{}'::jsonb)||jsonb_build_object(p_skill_id,current_rank+1)));
end;
$$;
revoke all on function public.upgrade_skill(uuid,text,int) from public,anon;
grant execute on function public.upgrade_skill(uuid,text,int) to authenticated;

create or replace function public.create_character(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cname text;
  d jsonb;
  ap jsonb := '{}'::jsonb;
  k text;
  v numeric;
  total int := 0;
  new_id uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'INVALID_CHARACTER'; end if;

  cname := btrim(p_data ->> 'name');
  if cname is null or cname !~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'' -]{3,16}$' then raise exception 'INVALID_NAME'; end if;
  if coalesce((p_data ->> 'race') not in ('humano', 'elfo', 'lagto', 'pelso'), true) then raise exception 'INVALID_CHARACTER'; end if;
  if coalesce((p_data ->> 'cls') not in ('guerrero', 'mago', 'picaro', 'clerigo', 'explorador'), true) then raise exception 'INVALID_CHARACTER'; end if;

  -- Reparto de puntos de creación: solo enteros no negativos, hasta 2 en total.
  if jsonb_typeof(p_data -> 'attributePoints') is distinct from 'object' then raise exception 'INVALID_CHARACTER'; end if;
  for k in select jsonb_object_keys(p_data -> 'attributePoints') loop
    if k not in ('fuerza', 'intelecto', 'corpulencia', 'agilidad', 'pericia', 'presencia', 'percepcion')
      or jsonb_typeof(p_data -> 'attributePoints' -> k) <> 'number' then
      raise exception 'INVALID_CHARACTER';
    end if;
    v := (p_data -> 'attributePoints' ->> k)::numeric;
    if v < 0 or v <> floor(v) then raise exception 'INVALID_CHARACTER'; end if;
    total := total + v::int;
    ap := ap || jsonb_build_object(k, v::int);
  end loop;
  if total > 2 then raise exception 'INVALID_CHARACTER'; end if;

  -- Todo lo que mueve el progreso (nivel, XP, vida, monedas, objetos...) lo fija el servidor.
  d := jsonb_build_object(
    'name', cname, 'title', 'recien_llegado', 'level', 1, 'experience', 0, 'health', -1, 'resource', -1,
    'location', 'brumaluz', 'race', p_data ->> 'race', 'cls', p_data ->> 'cls',
    'creationPoints', 2, 'attributePoints', ap, 'skillRanks', '{}'::jsonb, 'position_at', extract(epoch from now())
  );
  if exists(select 1 from public.server_config where key='welcome_enabled' and value='true') then
    -- La historia empieza entrando por la Puerta del Este (INTRO_GATE en src/data/quests.ts).
    d:=d||jsonb_build_object('welcome',jsonb_build_object('origin',null,'stage','available'),
      'introSeen',false,'position',jsonb_build_object('x',177,'z',0,'yaw',pi()/2));
  end if;
  d := d || jsonb_build_object('modularEquipmentVersion',2);
  d := d || jsonb_build_object('equipment',
    case p_data->>'cls'
      when 'guerrero' then '{"weapon":{"id":"espada_inicial","count":1,"bound":true},"offhand":{"id":"escudo_inicial","count":1,"bound":true}}'::jsonb
      when 'mago' then '{"weapon":{"id":"baston_inicial","count":1,"bound":true}}'::jsonb
      when 'picaro' then '{"weapon":{"id":"daga_inicial","count":1,"bound":true},"offhand":{"id":"daga_secundaria_inicial","count":1,"bound":true}}'::jsonb
      when 'clerigo' then '{"weapon":{"id":"varita_inicial","count":1,"bound":true},"offhand":{"id":"libro_inicial","count":1,"bound":true}}'::jsonb
      when 'explorador' then '{"weapon":{"id":"ballesta_inicial","count":1,"bound":true}}'::jsonb
    end);

  -- Solo la apariencia viene del cliente.
  foreach k in array array['sex', 'height', 'build', 'skin', 'face', 'hair', 'hairColor', 'beard', 'eyeShape', 'eyeColor',
    'brows', 'nose', 'mouth', 'detail', 'trait', 'primary', 'secondary', 'cape', 'clothA', 'clothB', 'hairAcc',
    'hairAccColor', 'acc', 'makeup', 'makeupColor', 'accColor'] loop
    if jsonb_typeof(p_data -> k) <> 'number' or (p_data ->> k)::numeric not between 0 and 1000 then
      raise exception 'INVALID_CHARACTER';
    end if;
    d := d || jsonb_build_object(k, p_data -> k);
  end loop;
  if (p_data ->> 'sex')::numeric not in (0, 1) then raise exception 'INVALID_CHARACTER'; end if;

  insert into public.characters (user_id, name, data) values (uid, cname, d) returning id into new_id;
  return new_id;
end;
$$;

-- Entrar al mundo: un personaje muerto reaparece en la capital; se reinicia el reloj de movimiento.
create or replace function public.character_enter(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
begin
  if coalesce((d ->> 'health')::int, -1) = 0 then
    d := (d - 'position') || jsonb_build_object('health', -1, 'location', 'brumaluz');
    update public.world_players set dead = true where character_id = c.id;
  end if;
  -- Se conserva el mapa (lugar de Pompelín) donde se quedó; si ya no está publicado, vuelve a la capital.
  if not exists (select 1 from public.world_maps where id = d ->> 'location') then
    d := (d - 'position') || jsonb_build_object('location', 'brumaluz');
  end if;
  d := d || jsonb_build_object('position_at', extract(epoch from now()));
  return public.game_store(c.id, d);
end;
$$;

-- Sustituida por una función por acción (debug_damage, debug_heal, debug_xp, respawn_character).
drop function if exists public.character_action(uuid, text);

-- Con debug_actions = false, solo la cuenta administradora puede usar el NPC de pruebas.
create or replace function public.game_require_debug()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select (value #>> '{}')::boolean from public.server_config where key = 'debug_actions'), false)
    and not exists (
      select 1 from auth.users
      where id = (select auth.uid()) and lower(email) = 'manuelperezardanuy@gmail.com'
    ) then
    raise exception 'ACTION_DISABLED';
  end if;
end;
$$;

-- Reaparecer: solo si el personaje está caído; vuelve a la capital con la vida completa.
create or replace function public.respawn_character(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
begin
  if coalesce((d ->> 'health')::int, -1) <> 0 then return d; end if;
  d := (d - 'position') || jsonb_build_object('health', -1, 'location', 'brumaluz', 'position_at', extract(epoch from now()));
  update public.world_players set dead = true,
    position = public.game_location_spawn('brumaluz')
    where character_id = c.id;
  return public.game_store(c.id, d);
end;
$$;

-- NPC de pruebas: 10 puntos de daño. La sobrecuración los absorbe primero.
create or replace function public.debug_damage(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  absorbed int;
  rest int;
begin
  perform public.game_require_debug();
  if coalesce((d ->> 'health')::int, -1) = 0 then return d; end if; -- un personaje caído no recibe nada
  absorbed := least(public.game_overheal_now(d), 10);
  rest := 10 - absorbed;
  d := d || jsonb_build_object('overheal', public.game_overheal_now(d) - absorbed, 'overheal_at', extract(epoch from now()));
  if rest > 0 then d := d || jsonb_build_object('health', greatest(public.game_health(d) - rest, 0)); end if;
  return public.game_store(c.id, d);
end;
$$;

-- NPC de pruebas: 10 puntos de vida. Lo que sobra del máximo pasa a sobrecuración (tope: 30 % del máximo).
create or replace function public.debug_heal(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  maxh int := public.game_max_health(d);
  total int := public.game_health(d) + 10;
  over int := public.game_overheal_now(d);
begin
  perform public.game_require_debug();
  if coalesce((d ->> 'health')::int, -1) = 0 then return d; end if;
  if total >= maxh then
    over := least(over + (total - maxh), public.game_overheal_cap(d));
    total := -1;
  end if;
  return public.game_store(c.id, d || jsonb_build_object('health', total, 'overheal', over, 'overheal_at', extract(epoch from now())));
end;
$$;

-- NPC de pruebas: 200 puntos de experiencia, con subida de nivel (máx. 50).
create or replace function public.debug_xp(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  lvl int := public.game_level(d);
  xp int := greatest(coalesce((d ->> 'experience')::int, 0), 0);
begin
  perform public.game_require_debug();
  if coalesce((d ->> 'health')::int, -1) = 0 or lvl >= 50 then return d; end if;
  perform public.game_require_welcome_complete(d);
  xp := xp + case when coalesce((d->>'partyPeers')::int,0)>0 then 204 else 200 end;
  while lvl < 50 and xp >= public.game_xp_needed(lvl) loop
    xp := xp - public.game_xp_needed(lvl);
    lvl := lvl + 1;
  end loop;
  if lvl >= 50 then xp := public.game_xp_needed(50); end if;
  return public.game_store(c.id, d || jsonb_build_object('level', lvl, 'experience', xp));
end;
$$;


-- Máximo de personajes por cuenta (MAX_CHARACTERS_PER_ACCOUNT en src/services/account.ts). El disparador se crea en
-- schema.sql; aquí se actualiza su función para que el límite cambie también con un `npm run db:apply` normal.
create or replace function public.enforce_character_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));

  if (select count(*) from public.characters where user_id = new.user_id) >= 6 then
    raise exception 'CHARACTER_LIMIT_REACHED';
  end if;

  return new;
end;
$$;
