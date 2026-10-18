-- Reglas del juego en el servidor (ejecutar DESPUÉS de schema.sql; es idempotente).
--
-- El navegador no puede escribir en public.characters. Solo puede pedir acciones concretas a las funciones
-- de este archivo, que validan todo con los datos guardados y calculan el resultado. Así vida, experiencia,
-- nivel, puntos de atributo y posición no se pueden falsificar desde el cliente.
-- Las fórmulas de vida y experiencia replican src/data/stats.ts: si cambias una, cambia la otra.

create table if not exists public.server_config (
  key text primary key,
  value jsonb not null
);
alter table public.server_config enable row level security;
revoke all on table public.server_config from anon, authenticated;

insert into public.server_config (key, value) values
  ('debug_actions', 'true'::jsonb),            -- acciones del NPC de pruebas (daño, curación, XP). Pon false en producción.
  ('spawn', '{"x": -6.4, "z": -11.085}'::jsonb), -- punto de inicio de Brumaluz (hexToWorld(0, -1.6))
  ('world_limit', '400'::jsonb),                -- |x| y |z| máximos permitidos
  ('max_speed', '9'::jsonb)                     -- m/s tolerados al guardar la posición (correr real: 6.2)
on conflict (key) do nothing;

-- ---------- Fórmulas (internas) ----------

create or replace function public.game_race_bonus(p_race text, p_attr text)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    (case p_race
      when 'humano' then '{"pericia":3,"presencia":2}'::jsonb
      when 'elfo' then '{"intelecto":2,"pericia":2,"agilidad":1}'::jsonb
      when 'lagto' then '{"fuerza":2,"corpulencia":3}'::jsonb
      when 'pelso' then '{"fuerza":1,"corpulencia":1,"agilidad":2,"percepcion":1}'::jsonb
    end) ->> p_attr
  )::int, 0)
$$;

create or replace function public.game_level(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select least(greatest(coalesce((d ->> 'level')::int, 1), 1), 50)
$$;

create or replace function public.game_xp_needed(p_level int)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(100 * power(greatest(p_level, 1)::numeric, 1.5))::int
$$;

create or replace function public.game_attr_total(d jsonb, p_attr text)
returns int
language sql
immutable
set search_path = ''
as $$
  select 5 + public.game_race_bonus(d ->> 'race', p_attr) + coalesce((d -> 'attributePoints' ->> p_attr)::int, 0)
$$;

create or replace function public.game_max_health(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select 60 + (public.game_level(d) - 1) * 12 + public.game_attr_total(d, 'corpulencia') * 8
$$;

-- Vida actual real: -1 en los datos significa "al máximo".
create or replace function public.game_health(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce((d ->> 'health')::int, -1) < 0 then public.game_max_health(d)
    else least((d ->> 'health')::int, public.game_max_health(d))
  end
$$;

create or replace function public.game_points_spent(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((value)::int), 0)::int
  from jsonb_each_text(coalesce(d -> 'attributePoints', '{}'::jsonb))
$$;

-- Puntos totales a los que da derecho el nivel: los de creación + 1 cada 3 niveles.
create or replace function public.game_points_allowed(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce((d ->> 'creationPoints')::int, least(public.game_points_spent(d), 2)) + public.game_level(d) / 3
$$;

create or replace function public.game_lock_character(p_id uuid)
returns public.characters
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
begin
  select * into c
  from public.characters
  where id = p_id and user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'CHARACTER_NOT_FOUND';
  end if;
  return c;
end;
$$;

-- Sobrecuración: la vida curada por encima del máximo (hasta el 30 % del máximo) se acumula aparte,
-- absorbe el daño antes que la vida y se pierde con el tiempo (1 punto por segundo).
-- Los valores deben coincidir con OVERHEAL en src/data/stats.ts.
create or replace function public.game_overheal_cap(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select floor(public.game_max_health(d) * 0.3)::int
$$;

-- Sobrecuración vigente ahora: lo guardado menos lo perdido desde `overheal_at`, sin pasar del tope.
create or replace function public.game_overheal_now(d jsonb)
returns int
language sql
stable
set search_path = ''
as $$
  select greatest(0, least(
    coalesce((d ->> 'overheal')::int, 0) - floor(greatest(extract(epoch from now()) - coalesce((d ->> 'overheal_at')::numeric, extract(epoch from now())), 0))::int,
    public.game_overheal_cap(d)
  ))
$$;

-- Guarda los datos fijando siempre la sobrecuración ya descontada y su marca de tiempo.
create or replace function public.game_store(p_id uuid, d jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  d := d || jsonb_build_object(
    'overheal', case when coalesce((d ->> 'health')::int, -1) = 0 then 0 else public.game_overheal_now(d) end,
    'overheal_at', extract(epoch from now())
  );
  update public.characters set data = d, updated_at = now() where id = p_id returning data into result;
  return result;
end;
$$;

-- ---------- Acciones que puede pedir el cliente ----------

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
    'creationPoints', 2, 'attributePoints', ap, 'position_at', extract(epoch from now())
  );

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
    d := (d - 'position') || jsonb_build_object('health', -1);
  end if;
  d := d || jsonb_build_object('location', 'brumaluz', 'position_at', extract(epoch from now()));
  return public.game_store(c.id, d);
end;
$$;

-- Sustituida por una función por acción (debug_damage, debug_heal, debug_xp, respawn_character).
drop function if exists public.character_action(uuid, text);

-- Las acciones debug_* (NPC de pruebas) se apagan con server_config.debug_actions = false.
create or replace function public.game_require_debug()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select (value #>> '{}')::boolean from public.server_config where key = 'debug_actions'), false) then
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
  xp := xp + 200;
  while lvl < 50 and xp >= public.game_xp_needed(lvl) loop
    xp := xp - public.game_xp_needed(lvl);
    lvl := lvl + 1;
  end loop;
  if lvl >= 50 then xp := public.game_xp_needed(50); end if;
  return public.game_store(c.id, d || jsonb_build_object('level', lvl, 'experience', xp));
end;
$$;

-- Repartir puntos de atributo: p_points = {"fuerza": 1, ...} con los puntos NUEVOS a sumar.
create or replace function public.spend_attribute_points(p_character_id uuid, p_points jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  ap jsonb := coalesce(d -> 'attributePoints', '{}'::jsonb);
  k text;
  v numeric;
  total int := 0;
begin
  if jsonb_typeof(p_points) is distinct from 'object' then raise exception 'INVALID_POINTS'; end if;
  for k in select jsonb_object_keys(p_points) loop
    if k not in ('fuerza', 'intelecto', 'corpulencia', 'agilidad', 'pericia', 'presencia', 'percepcion')
      or jsonb_typeof(p_points -> k) <> 'number' then
      raise exception 'INVALID_POINTS';
    end if;
    v := (p_points ->> k)::numeric;
    if v < 0 or v <> floor(v) then raise exception 'INVALID_POINTS'; end if;
    if public.game_attr_total(d, k) + v::int > 15 then raise exception 'ATTRIBUTE_MAXED'; end if;
    total := total + v::int;
    ap := jsonb_set(ap, array[k], to_jsonb(coalesce((ap ->> k)::int, 0) + v::int), true);
  end loop;
  if total > public.game_points_allowed(d) - public.game_points_spent(d) then raise exception 'NOT_ENOUGH_POINTS'; end if;
  d := d || jsonb_build_object('attributePoints', ap, 'creationPoints', coalesce((d ->> 'creationPoints')::int, least(public.game_points_spent(d), 2)));
  return public.game_store(c.id, d);
end;
$$;

create or replace function public.set_character_title(p_character_id uuid, p_title text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
begin
  -- Cuando haya títulos que se ganen, aquí se comprobará que el personaje cumple los requisitos.
  if p_title not in ('none', 'recien_llegado') then raise exception 'INVALID_TITLE'; end if;
  return public.game_store(c.id, c.data || jsonb_build_object('title', p_title));
end;
$$;

-- Guarda la última posición si es creíble: dentro del mundo y sin saltos imposibles desde la anterior.
-- Devuelve {"status": "ok" | "too_soon" | "too_far" | "dead", "position": {x, z, yaw} | null}.
create or replace function public.save_character_position(p_character_id uuid, p_x double precision, p_z double precision, p_yaw double precision)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  cfg_limit numeric := coalesce((select (value #>> '{}')::numeric from public.server_config where key = 'world_limit'), 400);
  cfg_speed numeric := coalesce((select (value #>> '{}')::numeric from public.server_config where key = 'max_speed'), 9);
  spawn jsonb := coalesce((select value from public.server_config where key = 'spawn'), '{"x":0,"z":0}'::jsonb);
  now_s numeric := extract(epoch from now());
  prev_x numeric := coalesce((d -> 'position' ->> 'x')::numeric, (spawn ->> 'x')::numeric);
  prev_z numeric := coalesce((d -> 'position' ->> 'z')::numeric, (spawn ->> 'z')::numeric);
  dt numeric := now_s - coalesce((d ->> 'position_at')::numeric, extract(epoch from c.updated_at));
  dist numeric;
begin
  if coalesce((d ->> 'health')::int, -1) = 0 then
    return jsonb_build_object('status', 'dead', 'position', d -> 'position');
  end if;
  if p_x is null or p_z is null or p_yaw is null
    or p_x <> p_x or p_z <> p_z or p_yaw <> p_yaw
    or abs(p_x) > cfg_limit or abs(p_z) > cfg_limit then
    return jsonb_build_object('status', 'too_far', 'position', coalesce(d -> 'position', jsonb_build_object('x', spawn -> 'x', 'z', spawn -> 'z', 'yaw', 0)));
  end if;
  if dt < 2 then
    return jsonb_build_object('status', 'too_soon', 'position', d -> 'position');
  end if;

  dist := sqrt(power(p_x::numeric - prev_x, 2) + power(p_z::numeric - prev_z, 2));
  if dist > cfg_speed * least(dt, 60) + 3 then
    return jsonb_build_object('status', 'too_far', 'position', coalesce(d -> 'position', jsonb_build_object('x', prev_x, 'z', prev_z, 'yaw', 0)));
  end if;

  d := d || jsonb_build_object(
    'position', jsonb_build_object('x', round(p_x::numeric, 2), 'z', round(p_z::numeric, 2), 'yaw', round(p_yaw::numeric, 2)),
    'position_at', now_s
  );
  perform public.game_store(c.id, d);
  return jsonb_build_object('status', 'ok', 'position', d -> 'position');
end;
$$;

-- Permisos: las funciones internas no son invocables; las acciones, solo por usuarios con sesión.
revoke all on function
  public.game_race_bonus(text, text), public.game_level(jsonb), public.game_xp_needed(int),
  public.game_attr_total(jsonb, text), public.game_max_health(jsonb), public.game_health(jsonb),
  public.game_points_spent(jsonb), public.game_points_allowed(jsonb), public.game_lock_character(uuid),
  public.game_store(uuid, jsonb), public.game_require_debug(), public.game_overheal_cap(jsonb), public.game_overheal_now(jsonb)
  from public, anon, authenticated;

revoke all on function
  public.create_character(jsonb), public.character_enter(uuid), public.respawn_character(uuid),
  public.debug_damage(uuid), public.debug_heal(uuid), public.debug_xp(uuid),
  public.spend_attribute_points(uuid, jsonb), public.set_character_title(uuid, text),
  public.save_character_position(uuid, double precision, double precision, double precision)
  from public, anon;
grant execute on function
  public.create_character(jsonb), public.character_enter(uuid), public.respawn_character(uuid),
  public.debug_damage(uuid), public.debug_heal(uuid), public.debug_xp(uuid),
  public.spend_attribute_points(uuid, jsonb), public.set_character_title(uuid, text),
  public.save_character_position(uuid, double precision, double precision, double precision)
  to authenticated;
