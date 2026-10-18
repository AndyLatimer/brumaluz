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
  ('max_speed', '9'::jsonb),                    -- m/s tolerados al guardar la posición (correr real: 6.2)
  ('staff_titles', '{"rey_de_pompelin": ["manuelperezardanuy@gmail.com"]}'::jsonb) -- títulos reservados: título -> emails autorizados
on conflict (key) do nothing;

update public.server_config
set value = jsonb_set(value, '{reina_de_pompelin}', (
  select jsonb_agg(distinct email)
  from jsonb_array_elements(
    coalesce(value -> 'reina_de_pompelin', '[]'::jsonb) || '["veronicaluxen17@gmail.com"]'::jsonb
  ) as emails(email)
))
where key = 'staff_titles';

-- ---------- Fórmulas (internas) ----------

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.party_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  character_id uuid not null unique references public.characters(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  entry_order bigint generated always as identity
);
create table if not exists public.party_invites (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  target_user uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '90 seconds',
  unique(party_id, target_user)
);
create index if not exists party_members_party_idx on public.party_members(party_id,entry_order);
create index if not exists party_invites_target_idx on public.party_invites(target_user);
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_invites enable row level security;
revoke all on public.parties, public.party_members, public.party_invites from public, anon, authenticated;

-- Solo descuenta tiempo confirmado de presencia; una concesión caducada se detiene en su último latido.
create or replace function public.game_food_data(p_id uuid, d jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  seen timestamptz;
  stamp numeric := extract(epoch from now());
  remaining numeric;
begin
  if d -> 'foodBuff' ->> 'itemId' = 'pan_duro' then
    if to_regclass('public.world_players') is not null then
      select seen_at into seen from public.world_players where character_id=p_id;
    end if;
    remaining := least(900, greatest(0, coalesce((d -> 'foodBuff' ->> 'remaining')::numeric,0)));
    if seen is not null then
      remaining := greatest(0, remaining - greatest(0,
        extract(epoch from case when seen > now()-interval '15 seconds' then now() else seen end)
        - coalesce((d ->> 'food_at')::numeric, stamp)));
    end if;
    d := jsonb_set(d, '{foodBuff}', case when remaining > 0
      then jsonb_build_object('itemId','pan_duro','remaining',remaining) else 'null'::jsonb end);
  else
    d := jsonb_set(d, '{foodBuff}', 'null'::jsonb);
  end if;
  return d || jsonb_build_object('food_at',stamp,'foodRevision',coalesce((d->>'foodRevision')::bigint,0));
end $$;
revoke all on function public.game_food_data(uuid,jsonb) from public, anon, authenticated;

-- Dynamic party bonuses never persist in character data or trust client input.
create or replace function public.game_party_data(p_id uuid, d jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare peers int := 0;
begin
  if to_regclass('public.world_players') is not null then
    select greatest(count(*)::int - 1, 0) into peers
    from public.party_members m join public.world_players w on w.user_id=m.user_id and w.character_id=m.character_id
    where m.party_id=(select party_id from public.party_members where character_id=p_id)
      and w.seen_at > now()-interval '15 seconds'
      and exists(select 1 from public.party_members me join public.world_players mine
        on mine.user_id=me.user_id and mine.character_id=me.character_id
        where me.character_id=p_id and mine.seen_at > now()-interval '15 seconds');
  end if;
  return (d - 'partyPeers') || jsonb_build_object('partyPeers',least(peers,3));
end $$;
revoke all on function public.game_party_data(uuid,jsonb) from public, anon, authenticated;

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
  select floor((60 + (public.game_level(d) - 1) * 12 + public.game_attr_total(d, 'corpulencia') * 8)
    * (1 + least(greatest(coalesce((d->>'partyPeers')::int,0),0),3) * 0.015))::int
    + case when d->'foodBuff'->>'itemId'='pan_duro' and (d->'foodBuff'->>'remaining')::numeric>0 then 5 else 0 end
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
  c.data := public.game_food_data(c.id,public.game_party_data(c.id,c.data));
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
  d := public.game_food_data(p_id,d);
  d := d || jsonb_build_object(
    'overheal', case when coalesce((d ->> 'health')::int, -1) = 0 then 0 else public.game_overheal_now(d) end,
    'overheal_at', extract(epoch from now())
  );
  update public.characters set data = d - 'partyPeers', updated_at = now() where id = p_id returning data into result;
  return public.game_party_data(p_id,result);
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
    update public.world_players set dead = true where character_id = c.id;
  end if;
  d := d || jsonb_build_object('location', 'brumaluz', 'position_at', extract(epoch from now()));
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
    position = (select value || '{"yaw":0}'::jsonb from public.server_config where key = 'spawn')
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
  xp := xp + case when coalesce((d->>'partyPeers')::int,0)>0 then 204 else 200 end;
  while lvl < 50 and xp >= public.game_xp_needed(lvl) loop
    xp := xp - public.game_xp_needed(lvl);
    lvl := lvl + 1;
  end loop;
  if lvl >= 50 then xp := public.game_xp_needed(50); end if;
  return public.game_store(c.id, d || jsonb_build_object('level', lvl, 'experience', xp));
end;
$$;

-- ---------- Objetos, dinero y vendedores ----------
-- Los precios y efectos replican src/data/items.ts: si cambias uno, cambia el otro.

-- Catálogo: value = precio de compra en pelines (el vendedor paga la mitad), stack = máximo por hueco (opcional; por defecto 50).
create or replace function public.game_item(p_item text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_item
    when 'pan_duro' then jsonb_build_object('value', 4, 'food_seconds', 900, 'bound', false)
    when 'pocion_vida_minuscula' then jsonb_build_object('value', 10, 'heal_pct', 5, 'bound', false)
    when 'pocion_mana_minuscula' then jsonb_build_object('value', 10, 'resource_pct', 5, 'resource_kind', 'mana', 'bound', false)
    when 'pocion_estamina_minuscula' then jsonb_build_object('value', 10, 'resource_pct', 5, 'resource_kind', 'stamina', 'bound', false)
    else null
  end
$$;

-- Mercancía de cada vendedor (por id de NPC).
create or replace function public.game_vendor_stock(p_vendor text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_vendor
    when 'testiculos' then array['pocion_vida_minuscula', 'pocion_mana_minuscula', 'pocion_estamina_minuscula', 'pan_duro']
    else array[]::text[]
  end
$$;

create or replace function public.game_pelines(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select greatest(coalesce((d #>> '{wallet,pelines}')::int, 0), 0)
$$;

create or replace function public.game_set_pelines(d jsonb, amount int)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select d || jsonb_build_object('wallet', coalesce(d -> 'wallet', '{}'::jsonb) || jsonb_build_object('pelines', greatest(amount, 0)))
$$;

-- Mochila de 25 huecos (relleno con null si el personaje aún no tiene).
create or replace function public.game_inventory(d jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(coalesce(d -> 'inventory' -> (i - 1), 'null'::jsonb) order by i), '[]'::jsonb)
  from generate_series(1, 25) i
$$;

-- Añade una unidad: primero a un montón con sitio, si no al primer hueco libre.
create or replace function public.game_add_item(d jsonb, p_item text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  inv jsonb := public.game_inventory(d);
  stack int := coalesce((public.game_item(p_item) ->> 'stack')::int, 50);
  slot jsonb;
  i int;
begin
  for i in 0..24 loop
    slot := inv -> i;
    if jsonb_typeof(slot) = 'object' and slot ->> 'id' = p_item
      and coalesce((slot->>'bound')::boolean,false) = coalesce((public.game_item(p_item)->>'bound')::boolean,false)
      and (slot ->> 'count')::int < stack then
      return d || jsonb_build_object('inventory', jsonb_set(inv, array[i::text], slot || jsonb_build_object('count', (slot ->> 'count')::int + 1)));
    end if;
  end loop;
  for i in 0..24 loop
    if jsonb_typeof(inv -> i) is distinct from 'object' then
      return d || jsonb_build_object('inventory', jsonb_set(inv, array[i::text], jsonb_build_object('id', p_item, 'count', 1, 'bound', coalesce((public.game_item(p_item)->>'bound')::boolean,false))));
    end if;
  end loop;
  raise exception 'INVENTORY_FULL';
end;
$$;

-- Quita una unidad del hueco indicado.
create or replace function public.game_remove_item(d jsonb, p_slot int)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  inv jsonb := public.game_inventory(d);
  slot jsonb;
begin
  if p_slot is null or p_slot not between 0 and 24 then raise exception 'INVALID_ITEM'; end if;
  slot := inv -> p_slot;
  if jsonb_typeof(slot) is distinct from 'object' then raise exception 'INVALID_ITEM'; end if;
  if (slot ->> 'count')::int <= 1 then
    inv := jsonb_set(inv, array[p_slot::text], 'null'::jsonb);
  else
    inv := jsonb_set(inv, array[p_slot::text], slot || jsonb_build_object('count', (slot ->> 'count')::int - 1));
  end if;
  return d || jsonb_build_object('inventory', inv);
end;
$$;

-- NPC de pruebas: 100 pelines.
create or replace function public.debug_money(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
begin
  perform public.game_require_debug();
  if coalesce((d ->> 'health')::int, -1) = 0 then return d; end if;
  return public.game_store(c.id, public.game_set_pelines(d, public.game_pelines(d) + 100));
end;
$$;

-- Comprar una unidad a un vendedor: el servidor comprueba mercancía, saldo y hueco, y cobra el precio del catálogo.
create or replace function public.vendor_buy(p_character_id uuid, p_vendor text, p_item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  price int;
begin
  if coalesce((d ->> 'health')::int, -1) = 0 then return d; end if;
  if not (p_item = any (public.game_vendor_stock(p_vendor))) then raise exception 'ITEM_NOT_FOR_SALE'; end if;
  price := (public.game_item(p_item) ->> 'value')::int;
  if public.game_pelines(d) < price then raise exception 'NOT_ENOUGH_MONEY'; end if;
  d := public.game_add_item(d, p_item);
  return public.game_store(c.id, public.game_set_pelines(d, public.game_pelines(d) - price));
end;
$$;

-- Vender una unidad del hueco indicado: el vendedor paga la mitad del valor.
create or replace function public.vendor_sell(p_character_id uuid, p_vendor text, p_slot int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  item jsonb;
  price int;
begin
  if coalesce((d ->> 'health')::int, -1) = 0 then return d; end if;
  if cardinality(public.game_vendor_stock(p_vendor)) = 0 then raise exception 'INVALID_VENDOR'; end if;
  if p_slot is null or p_slot not between 0 and 24 then raise exception 'INVALID_ITEM'; end if;
  item := public.game_item(public.game_inventory(d) -> p_slot ->> 'id');
  if item is null then raise exception 'INVALID_ITEM'; end if;
  price := greatest(1, floor((item ->> 'value')::int / 2.0)::int);
  d := public.game_remove_item(d, p_slot);
  return public.game_store(c.id, public.game_set_pelines(d, public.game_pelines(d) + price));
end;
$$;

-- Las pociones restauran un % de vida (sin sobrecuración) o del recurso de la clase.
create or replace function public.use_item(p_character_id uuid, p_slot int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  d jsonb := c.data;
  item jsonb;
  maxh int := public.game_max_health(d);
  total int;
  vitals jsonb;
  item_id text;
begin
  if coalesce((d ->> 'health')::int, -1) = 0 then return d; end if;
  if p_slot is null or p_slot not between 0 and 24 then raise exception 'INVALID_ITEM'; end if;
  item_id := public.game_inventory(d) -> p_slot ->> 'id';
  item := public.game_item(item_id);
  if item is null then raise exception 'INVALID_ITEM'; end if;
  if item -> 'food_seconds' is not null then
    vitals := public.game_public_vitals(d);
    d := public.game_remove_item(d,p_slot);
    d := d || jsonb_build_object('health',(vitals->>'health')::int,'resource',(vitals->>'resource')::int,
      'foodBuff',jsonb_build_object('itemId',item_id,'remaining',(item->>'food_seconds')::int),
      'foodRevision',coalesce((d->>'foodRevision')::bigint,0)+1,'food_at',extract(epoch from now()));
    return public.game_store(c.id,d);
  end if;
  if item -> 'resource_pct' is not null then
    vitals := public.game_public_vitals(d);
    if item ->> 'resource_kind' <> vitals ->> 'resourceKind' then raise exception 'WRONG_RESOURCE'; end if;
    maxh := (vitals ->> 'maxResource')::int;
    if (vitals ->> 'resource')::int >= maxh then raise exception 'RESOURCE_FULL'; end if;
    total := least(maxh, (vitals ->> 'resource')::int + greatest(1, ceil(maxh * (item ->> 'resource_pct')::int / 100.0)::int));
    d := public.game_remove_item(d, p_slot);
    return public.game_store(c.id, d || jsonb_build_object('resource', case when total >= maxh then -1 else total end));
  end if;
  if item -> 'heal_pct' is null then raise exception 'ITEM_NOT_USABLE'; end if;
  if public.game_health(d) >= maxh then raise exception 'NOTHING_TO_HEAL'; end if;
  total := least(maxh, public.game_health(d) + greatest(1, ceil(maxh * (item ->> 'heal_pct')::int / 100.0)::int));
  d := public.game_remove_item(d, p_slot);
  return public.game_store(c.id, d || jsonb_build_object('health', case when total >= maxh then -1 else total end));
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
  if p_title not in ('none', 'recien_llegado') and not public.game_title_granted(p_title) then raise exception 'INVALID_TITLE'; end if;
  return public.game_store(c.id, c.data || jsonb_build_object('title', p_title));
end;
$$;

-- Títulos reservados: server_config.staff_titles = {"titulo": ["email", ...]}. Solo esas cuentas pueden usarlos.
create or replace function public.game_title_granted(p_title text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select exists (
      select 1 from jsonb_array_elements_text(value -> p_title) as e(email)
      where lower(e.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    )
    from public.server_config where key = 'staff_titles' and jsonb_typeof(value -> p_title) = 'array'
  ), false)
$$;

-- Títulos reservados que puede usar la cuenta actual (el cliente solo los muestra en el selector).
create or replace function public.my_titles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.key), array[]::text[])
  from public.server_config c, jsonb_object_keys(c.value) as t(key)
  where c.key = 'staff_titles' and public.game_title_granted(t.key)
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
    or not (p_x between -cfg_limit and cfg_limit and p_z between -cfg_limit and cfg_limit
      and p_yaw between -1000000 and 1000000) then
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

-- ---------- Mundo compartido ----------
-- Una concesión por cuenta. No se publica la tabla characters ni el inventario de otros jugadores.
create table if not exists public.world_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  character_id uuid not null unique references public.characters(id) on delete cascade,
  session_id uuid not null,
  position jsonb not null,
  facing double precision not null default 0,
  jump double precision not null default 0,
  wave int not null default 0,
  dead boolean not null default false,
  movement_credit double precision not null default 3,
  seen_at timestamptz not null default now(),
  saved_at timestamptz not null default now()
);
alter table public.world_players enable row level security;
revoke all on table public.world_players from public, anon, authenticated;

create or replace function public.game_public_character(d jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(d)
  where key = any(array[
    'name', 'title', 'level', 'race', 'cls', 'sex', 'height', 'build', 'skin', 'face',
    'hair', 'hairColor', 'beard', 'eyeShape', 'eyeColor', 'brows', 'nose', 'mouth', 'detail',
    'trait', 'primary', 'secondary', 'cape', 'clothA', 'clothB', 'hairAcc', 'hairAccColor',
    'acc', 'makeup', 'makeupColor', 'accColor'
  ])
$$;

create or replace function public.game_public_vitals(d jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with resource as (
    select case when d ->> 'cls' in ('mago', 'clerigo') then 'mana' else 'stamina' end as kind
  ), maximum as (
    select kind, (public.game_level(d) - 1) * 6 + case when kind = 'mana'
      then 30 + public.game_attr_total(d, 'intelecto') * 7
      else 50 + public.game_attr_total(d, 'agilidad') * 3 + public.game_attr_total(d, 'corpulencia') * 3
    end as base_amount from resource
  ), boosted as (
    select kind, floor(base_amount * (1 + least(greatest(coalesce((d->>'partyPeers')::int,0),0),3) * 0.015))::int
      + case when d->'foodBuff'->>'itemId'='pan_duro' and (d->'foodBuff'->>'remaining')::numeric>0 then 3 else 0 end as amount
    from maximum
  )
  select jsonb_build_object(
    'health', public.game_health(d), 'maxHealth', public.game_max_health(d),
    'overheal', case when public.game_health(d) = 0 then 0 else public.game_overheal_now(d) end,
    'resourceKind', kind, 'maxResource', amount,
    'resource', case when coalesce((d ->> 'resource')::int, -1) < 0 then amount
      else least(greatest((d ->> 'resource')::int, 0), amount) end
  ) from boosted
$$;
revoke all on function public.game_public_vitals(jsonb) from public, anon, authenticated;

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
  spawn jsonb := (select value from public.server_config where key = 'spawn');
  pos jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_session_id is null then raise exception 'INVALID_WORLD_STATE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 1));
  c := public.game_lock_character(p_character_id);
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
    'food',jsonb_build_object('buff',c.data->'foodBuff','revision',c.data->'foodRevision','at',c.data->'food_at'));
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
  cfg_limit double precision := (select (value #>> '{}')::double precision from public.server_config where key = 'world_limit');
  cfg_speed double precision := (select (value #>> '{}')::double precision from public.server_config where key = 'max_speed');
  spawn jsonb := (select value from public.server_config where key = 'spawn');
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
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 1));
  c := public.game_lock_character(p_character_id);
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
  if not (px between -cfg_limit and cfg_limit and pz between -cfg_limit and cfg_limit
    and pyaw between -1000000 and 1000000 and facing between -1000000 and 1000000
    and v_jump between 0 and 0.7 and (p_state ->> 'wave')::numeric between 0 and 2147483647
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
  if now() - w.saved_at >= interval '5 seconds' or now()-w.seen_at >= interval '15 seconds' then
    perform public.game_store(c.id, c.data || jsonb_build_object('position', w.position, 'position_at', extract(epoch from now())));
    update public.world_players set saved_at = now() where user_id = uid;
  end if;
  return jsonb_build_object('status', status, 'position', w.position, 'players', public.game_world_snapshot(uid),
    'food',jsonb_build_object('buff',c.data->'foodBuff','revision',c.data->'foodRevision','at',c.data->'food_at'));
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

-- ---------- Amigos por cuenta ----------
create table if not exists public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high))
);
create index if not exists friendships_high_idx on public.friendships(user_high);
create index if not exists friendships_pending_sender_idx on public.friendships(requested_by) where status = 'pending';
alter table public.friendships enable row level security;
revoke all on table public.friendships from public, anon, authenticated;

create or replace function public.party_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); pid uuid; members jsonb; incoming jsonb; outgoing jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.game_party_cleanup();
  select party_id into pid from public.party_members where user_id=uid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',m.user_id,'characterId',m.character_id,'username',p.username,'data',public.game_public_character(c.data),
    'vitals',public.game_public_vitals(public.game_food_data(c.id,public.game_party_data(c.id,c.data))),
    'position',w.position,'location',coalesce(c.data->>'location','brumaluz')
  ) order by m.entry_order),'[]'::jsonb) into members
  from public.party_members m join public.characters c on c.id=m.character_id
  join public.profiles p on p.user_id=m.user_id join public.world_players w on w.user_id=m.user_id
  where m.party_id=pid;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'username',p.username) order by i.expires_at),'[]'::jsonb)
  into incoming from public.party_invites i join public.party_members leader on leader.party_id=i.party_id
  join public.profiles p on p.user_id=leader.user_id
  where i.target_user=uid and leader.entry_order=(select min(entry_order) from public.party_members where party_id=i.party_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'username',p.username) order by i.expires_at),'[]'::jsonb)
  into outgoing from public.party_invites i join public.profiles p on p.user_id=i.target_user
  where i.party_id=pid and uid=(select user_id from public.party_members where party_id=pid order by entry_order limit 1);
  return jsonb_build_object('id',pid,'members',members,'incoming',incoming,'outgoing',outgoing);
end $$;

create or replace function public.party_invite(p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); target uuid; pid uuid; cid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists(select 1 from public.profiles where user_id=uid and username is not null) then
    raise exception 'PARTY_USERNAME_REQUIRED';
  end if;
  perform public.game_party_cleanup();
  select character_id into cid from public.world_players where user_id=uid and seen_at>now()-interval '15 seconds';
  if cid is null then raise exception 'PARTY_NOT_PLAYING'; end if;
  select p.user_id into target from public.profiles p join public.world_players w on w.user_id=p.user_id
    where lower(p.username collate pg_catalog."C")=lower(ltrim(btrim(p_username),'~') collate pg_catalog."C")
    and w.seen_at>now()-interval '15 seconds';
  if target is null then raise exception 'PARTY_TARGET_OFFLINE'; end if;
  if target=uid then raise exception 'PARTY_SELF'; end if;
  if exists(select 1 from public.party_members where user_id=target) then raise exception 'PARTY_ALREADY_JOINED'; end if;
  select party_id into pid from public.party_members where user_id=uid;
  if pid is null then
    insert into public.parties default values returning id into pid;
    insert into public.party_members(user_id,character_id,party_id) values(uid,cid,pid);
  end if;
  if uid<>(select user_id from public.party_members where party_id=pid order by entry_order limit 1) then raise exception 'PARTY_LEADER_ONLY'; end if;
  if (select count(*) from public.party_members where party_id=pid)>=4 then raise exception 'PARTY_FULL'; end if;
  if exists(select 1 from public.party_invites where party_id=pid and target_user=target) then raise exception 'PARTY_INVITE_EXISTS'; end if;
  if (select count(*) from public.party_invites where party_id=pid)>=3 then raise exception 'PARTY_INVITE_LIMIT'; end if;
  insert into public.party_invites(party_id,target_user) values(pid,target);
end $$;

create or replace function public.party_respond(p_invite_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); invitation public.party_invites; cid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_accept is null then raise exception 'PARTY_INVITE_INVALID'; end if;
  perform public.game_party_cleanup();
  select * into invitation from public.party_invites where id=p_invite_id and target_user=uid;
  if not found then raise exception 'PARTY_INVITE_INVALID'; end if;
  if p_accept then
    select character_id into cid from public.world_players where user_id=uid and seen_at>now()-interval '15 seconds';
    if cid is null then raise exception 'PARTY_NOT_PLAYING'; end if;
    if exists(select 1 from public.party_members where user_id=uid) then raise exception 'PARTY_ALREADY_JOINED'; end if;
    if (select count(*) from public.party_members where party_id=invitation.party_id)>=4 then raise exception 'PARTY_FULL'; end if;
    insert into public.party_members(user_id,character_id,party_id) values(uid,cid,invitation.party_id);
    delete from public.party_invites where target_user=uid;
  else delete from public.party_invites where id=invitation.id;
  end if;
end $$;

create or replace function public.party_leave()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); pid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.game_party_cleanup();
  delete from public.party_members where user_id=uid returning party_id into pid;
  if pid is null then raise exception 'PARTY_NOT_JOINED'; end if;
  perform public.game_party_cleanup();
end $$;

create or replace function public.party_chat_member(p_party_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.party_members m join public.world_players w
    on w.user_id=m.user_id and w.character_id=m.character_id
    where m.party_id=p_party_id and m.user_id=(select auth.uid()) and w.seen_at>now()-interval '15 seconds')
$$;
revoke all on function public.party_state(),public.party_invite(text),public.party_respond(uuid,boolean),public.party_leave(),public.party_chat_member(uuid) from public,anon;
grant execute on function public.party_state(),public.party_invite(text),public.party_respond(uuid,boolean),public.party_leave(),public.party_chat_member(uuid) to authenticated;

create or replace function public.friends_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.user_id, 'username', p.username,
    'status', case when f.status = 'accepted' then 'friend' when f.requested_by = uid then 'outgoing' else 'incoming' end,
    'online', w.user_id is not null,
    'characterName', c.name, 'location', c.data ->> 'location', 'characterClass', c.data ->> 'cls',
    'characterLevel', case when c.id is not null then public.game_level(c.data) else null end
  ) order by lower(p.username)), '[]'::jsonb) into result
  from public.friendships f
  join public.profiles p on p.user_id = case when f.user_low = uid then f.user_high else f.user_low end
  left join public.world_players w on w.user_id = p.user_id and f.status = 'accepted' and w.seen_at > now() - interval '15 seconds'
  left join public.characters c on c.id = w.character_id
  where uid in (f.user_low, f.user_high);
  return result;
end;
$$;

create or replace function public.friend_request(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target uuid;
  lo uuid;
  hi uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where user_id = uid and username is not null) then
    raise exception 'FRIEND_USERNAME_REQUIRED';
  end if;
  select user_id into target from public.profiles
    where lower(username collate pg_catalog."C") = lower(btrim(coalesce(p_username, '')) collate pg_catalog."C");
  if target is null then raise exception 'PLAYER_NOT_FOUND'; end if;
  if target = uid then raise exception 'FRIEND_SELF'; end if;
  lo := least(uid, target); hi := greatest(uid, target);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 2));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lo::text || hi::text, 3));
  if exists (select 1 from public.friendships where user_low = lo and user_high = hi) then
    raise exception 'FRIEND_ALREADY_EXISTS';
  end if;
  if (select count(*) from public.friendships where requested_by = uid and status = 'pending') >= 50 then
    raise exception 'FRIEND_REQUEST_LIMIT';
  end if;
  insert into public.friendships(user_low, user_high, requested_by) values(lo, hi, uid);
end;
$$;

create or replace function public.friend_update(p_user_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  lo uuid := least(uid, p_user_id);
  hi uuid := greatest(uid, p_user_id);
  f public.friendships;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_user_id is null or p_user_id = uid or p_action is null or p_action not in ('accept', 'remove') then
    raise exception 'INVALID_FRIEND_ACTION';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lo::text || hi::text, 3));
  select * into f from public.friendships where user_low = lo and user_high = hi for update;
  if not found then raise exception 'FRIEND_NOT_FOUND'; end if;
  if p_action = 'accept' then
    if f.status <> 'pending' or f.requested_by = uid then raise exception 'INVALID_FRIEND_ACTION'; end if;
    update public.friendships set status = 'accepted' where user_low = lo and user_high = hi;
  else
    delete from public.friendships where user_low = lo and user_high = hi;
  end if;
end;
$$;

revoke all on function public.friends_list(), public.friend_request(text), public.friend_update(uuid, text) from public, anon;
grant execute on function public.friends_list(), public.friend_request(text), public.friend_update(uuid, text) to authenticated;

-- ---------- Chat multijugador ----------
-- Los mensajes solo se crean con chat_send (el cliente no puede insertar): el servidor limpia el texto,
-- limita el ritmo, aplica silencios y fija remitente y título. Los clientes los reciben por Realtime (RLS aplicada).
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('general', 'zone', 'whisper')),
  sender_user uuid not null references auth.users (id) on delete cascade,
  sender_name text not null,
  sender_title text not null default 'none',
  recipient_user uuid references auth.users (id) on delete cascade,
  recipient_name text,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
-- Por si la tabla se creó con una versión anterior de este archivo.
alter table public.chat_messages add column if not exists zone text;
alter table public.chat_messages add column if not exists sender_account text;
alter table public.chat_messages add column if not exists party_id uuid;
alter table public.chat_messages add column if not exists party_audience uuid[];
alter table public.chat_messages drop constraint if exists chat_messages_channel_check;
alter table public.chat_messages add constraint chat_messages_channel_check check (channel in ('general', 'zone', 'whisper','party'));
create index if not exists chat_messages_created_idx on public.chat_messages (created_at);
alter table public.chat_messages enable row level security;

-- general/zone: públicos; whisper: participantes; party: destinatarios originales que sigan en el grupo.
drop policy if exists "Read public and own chat messages" on public.chat_messages;
create policy "Read public and own chat messages"
  on public.chat_messages for select to authenticated
  using (channel in ('general', 'zone')
    or (channel='whisper' and (sender_user=(select auth.uid()) or recipient_user=(select auth.uid())))
    or (channel='party' and (select auth.uid())=any(party_audience) and public.party_chat_member(party_id)));

revoke all on table public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

-- Silencios: se ponen a mano desde el editor SQL, p. ej.
--   insert into public.chat_mutes (user_id, until, reason) values ('<uuid>', now() + interval '1 day', 'spam');
create table if not exists public.chat_mutes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,
  reason text
);
alter table public.chat_mutes enable row level security;
revoke all on table public.chat_mutes from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- Canales: general, zone, party o whisper (p_to identifica la cuenta destinataria).
drop function if exists public.chat_send(uuid, text, text, text);
create or replace function public.chat_send(p_character_id uuid, p_body text, p_channel text default 'general', p_to text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  clean text := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:][:space:]]+', ' ', 'g'));
  me text;
  target_user uuid;
  target_account text;
  msg public.chat_messages;
  pid uuid;
  audience uuid[];
begin
  if p_channel not in ('general', 'zone', 'whisper','party') then raise exception 'INVALID_CHANNEL'; end if;
  if p_channel='party' then
    perform public.game_party_cleanup();
    select party_id into pid from public.party_members where user_id=c.user_id and character_id=c.id;
    if pid is null then raise exception 'PARTY_NOT_JOINED'; end if;
    select array_agg(user_id) into audience from public.party_members where party_id=pid;
  end if;
  if clean = '' then raise exception 'CHAT_EMPTY'; end if;
  if char_length(clean) > 200 then raise exception 'CHAT_TOO_LONG'; end if;
  if exists (select 1 from public.chat_mutes m where m.user_id = c.user_id and m.until > now()) then raise exception 'CHAT_MUTED'; end if;
  if (select count(*) from public.chat_messages where sender_user = c.user_id and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'CHAT_RATE_LIMIT';
  end if;
  select username into me from public.profiles where user_id = c.user_id;
  if p_channel = 'whisper' then
    select user_id, username into target_user, target_account from public.profiles
      where username is not null and lower(username collate pg_catalog."C") = lower(btrim(coalesce(p_to, '')) collate pg_catalog."C");
    if target_user is null then raise exception 'PLAYER_NOT_FOUND'; end if;
    if target_user = c.user_id then raise exception 'CANNOT_WHISPER_SELF'; end if;
  end if;
  delete from public.chat_messages where created_at < now() - interval '3 days';
  insert into public.chat_messages (channel, zone, sender_user, sender_name, sender_account, sender_title, recipient_user, recipient_name, body,party_id,party_audience)
  values (
    p_channel, case when p_channel = 'zone' then coalesce(c.data ->> 'location', 'brumaluz') end,
    c.user_id, c.name, me, coalesce(c.data ->> 'title', 'none'), target_user, target_account, clean,pid,audience
  )
  returning * into msg;
  return to_jsonb(msg);
end;
$$;

-- Permisos: las funciones internas no son invocables; las acciones, solo por usuarios con sesión.
revoke all on function
  public.game_race_bonus(text, text), public.game_level(jsonb), public.game_xp_needed(int),
  public.game_attr_total(jsonb, text), public.game_max_health(jsonb), public.game_health(jsonb),
  public.game_points_spent(jsonb), public.game_points_allowed(jsonb), public.game_lock_character(uuid),
  public.game_store(uuid, jsonb), public.game_require_debug(), public.game_overheal_cap(jsonb), public.game_overheal_now(jsonb),
  public.game_item(text), public.game_vendor_stock(text), public.game_pelines(jsonb), public.game_set_pelines(jsonb, int),
  public.game_inventory(jsonb), public.game_add_item(jsonb, text), public.game_remove_item(jsonb, int), public.game_title_granted(text)
  from public, anon, authenticated;

revoke all on function public.my_titles() from public, anon;
grant execute on function public.my_titles() to authenticated;

revoke all on function
  public.create_character(jsonb), public.character_enter(uuid), public.respawn_character(uuid),
  public.debug_damage(uuid), public.debug_heal(uuid), public.debug_xp(uuid), public.debug_money(uuid),
  public.vendor_buy(uuid, text, text), public.vendor_sell(uuid, text, int), public.use_item(uuid, int),
  public.spend_attribute_points(uuid, jsonb), public.set_character_title(uuid, text),
  public.save_character_position(uuid, double precision, double precision, double precision), public.chat_send(uuid, text, text, text)
  from public, anon;
grant execute on function
  public.create_character(jsonb), public.character_enter(uuid), public.respawn_character(uuid),
  public.debug_damage(uuid), public.debug_heal(uuid), public.debug_xp(uuid), public.debug_money(uuid),
  public.vendor_buy(uuid, text, text), public.vendor_sell(uuid, text, int), public.use_item(uuid, int),
  public.spend_attribute_points(uuid, jsonb), public.set_character_title(uuid, text),
  public.save_character_position(uuid, double precision, double precision, double precision), public.chat_send(uuid, text, text, text)
  to authenticated;

-- Trades are private RPC-only records. Session IDs prevent invitations surviving a replaced tab.
create table if not exists public.player_trades (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references public.characters(id) on delete cascade,
  b uuid not null references public.characters(id) on delete cascade,
  sa uuid not null,
  sb uuid not null,
  status text not null default 'invited' check(status in ('invited','open','completed','cancelled')),
  reason text,
  revision int not null default 0,
  offer_a jsonb not null default '{"items":[],"pelines":0}',
  offer_b jsonb not null default '{"items":[],"pelines":0}',
  accepted_a boolean not null default false,
  accepted_b boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.player_trades enable row level security;
revoke all on table public.player_trades from public, anon, authenticated;
create index if not exists player_trades_a_history on public.player_trades(a,created_at desc);
create index if not exists player_trades_b_history on public.player_trades(b,created_at desc);
create index if not exists player_trades_active on public.player_trades(status) where status in ('invited','open');

create or replace function public.game_trade_valid(tr public.player_trades)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.world_players x join public.world_players y on y.character_id=tr.b
    join public.characters cx on cx.id=x.character_id join public.characters cy on cy.id=y.character_id
    where x.character_id=tr.a and x.session_id=tr.sa and y.session_id=tr.sb
      and x.seen_at>now()-interval '15 seconds' and y.seen_at>now()-interval '15 seconds'
      and not x.dead and not y.dead
      and public.game_health(cx.data)>0 and public.game_health(cy.data)>0
      and coalesce(cx.data->>'location','brumaluz')=coalesce(cy.data->>'location','brumaluz')
      and power((x.position->>'x')::float8-(y.position->>'x')::float8,2)
        +power((x.position->>'z')::float8-(y.position->>'z')::float8,2)<=100
  )
$$;

create or replace function public.game_trade_offer(d jsonb, offer jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  entry jsonb; slot jsonb; result jsonb:='[]'; seen int[]:='{}'; n int; idx int; money int;
begin
  if jsonb_typeof(offer) is distinct from 'object' or offer- 'items'- 'pelines'<>'{}'::jsonb
    or jsonb_typeof(offer->'items') is distinct from 'array'
    or jsonb_array_length(offer->'items')>25
    or coalesce(offer->>'pelines','') !~ '^[0-9]{1,10}$' then raise exception 'TRADE_INVALID_OFFER'; end if;
  money:=(offer->>'pelines')::bigint;
  if money>public.game_pelines(d) then raise exception 'NOT_ENOUGH_PELINES'; end if;
  for entry in select value from jsonb_array_elements(offer->'items') loop
    if coalesce(entry->>'slot','') !~ '^[0-9]{1,2}$' or coalesce(entry->>'count','') !~ '^[0-9]{1,3}$'
      then raise exception 'TRADE_INVALID_OFFER'; end if;
    idx:=(entry->>'slot')::int; n:=(entry->>'count')::int;
    if idx not between 0 and 24 or idx=any(seen) or n<1 then raise exception 'TRADE_INVALID_OFFER'; end if;
    seen:=array_append(seen,idx); slot:=public.game_inventory(d)->idx;
    if jsonb_typeof(slot) is distinct from 'object' or public.game_item(slot->>'id') is null
      or n>(slot->>'count')::int then raise exception 'TRADE_ITEMS_CHANGED'; end if;
    if coalesce((slot->>'bound')::boolean,false) or coalesce((public.game_item(slot->>'id')->>'bound')::boolean,false)
      then raise exception 'TRADE_BOUND'; end if;
    if entry ? 'id' and entry->>'id' is distinct from slot->>'id' then raise exception 'TRADE_ITEMS_CHANGED'; end if;
    result:=result||jsonb_build_array(jsonb_build_object('slot',idx,'id',slot->>'id','count',n));
  end loop;
  return jsonb_build_object('items',result,'pelines',money);
end $$;

create or replace function public.game_trade_remove(d jsonb, offer jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare entry jsonb; inv jsonb:=public.game_inventory(d); idx int; remaining int;
begin
  perform public.game_trade_offer(d,offer);
  for entry in select value from jsonb_array_elements(offer->'items') loop
    idx:=(entry->>'slot')::int; remaining:=(inv->idx->>'count')::int-(entry->>'count')::int;
    inv:=jsonb_set(inv,array[idx::text],case when remaining=0 then 'null'::jsonb
      else inv->idx||jsonb_build_object('count',remaining) end);
  end loop;
  return public.game_set_pelines(d||jsonb_build_object('inventory',inv),public.game_pelines(d)-(offer->>'pelines')::int);
end $$;

create or replace function public.game_trade_add(d jsonb, offer jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare entry jsonb; i int;
begin
  for entry in select value from jsonb_array_elements(offer->'items') loop
    for i in 1..(entry->>'count')::int loop d:=public.game_add_item(d,entry->>'id'); end loop;
  end loop;
  return public.game_set_pelines(d,public.game_pelines(d)+(offer->>'pelines')::int);
end $$;

create or replace function public.trade_action(p_character_id uuid, p_action text default 'state',
  p_trade_id uuid default null, p_target_id uuid default null, p_offer jsonb default null, p_revision int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=(select auth.uid()); tr public.player_trades; mine public.characters; other public.characters;
  wa public.world_players; wb public.world_players; is_a boolean; da jsonb; db jsonb; own_offer jsonb; peer_offer jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  -- Serialize trade mutations before acquiring character locks, always in UUID order.
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  select * into mine from public.characters where id=p_character_id and user_id=uid;
  if mine.id is null then raise exception 'CHARACTER_NOT_FOUND'; end if;
  update public.player_trades set status='cancelled',reason='TRADE_UNAVAILABLE',accepted_a=false,accepted_b=false
    where status in ('invited','open') and not public.game_trade_valid(player_trades);
  if p_action='invite' then
    select * into other from public.characters where id=p_target_id and user_id<>uid;
    if other.id is null then raise exception 'TRADE_UNAVAILABLE'; end if;
    if exists(select 1 from public.player_trades where status in ('invited','open')
      and (a in(mine.id,other.id) or b in(mine.id,other.id))) then raise exception 'TRADE_BUSY'; end if;
    select * into wa from public.world_players where character_id=mine.id;
    select * into wb from public.world_players where character_id=other.id;
    tr.a:=mine.id; tr.b:=other.id; tr.sa:=wa.session_id; tr.sb:=wb.session_id;
    if not public.game_trade_valid(tr) then raise exception 'TRADE_UNAVAILABLE'; end if;
    insert into public.player_trades(a,b,sa,sb) values(tr.a,tr.b,tr.sa,tr.sb) returning * into tr;
  elsif p_trade_id is not null then
    select * into tr from public.player_trades where id=p_trade_id and p_character_id in(a,b) for update;
    if tr.id is null then raise exception 'TRADE_NOT_FOUND'; end if;
  else
    select * into tr from public.player_trades where p_character_id in(a,b)
      order by (status in ('invited','open')) desc,created_at desc,id limit 1 for update;
  end if;
  if tr.id is null then
    return jsonb_build_object('trade',null,'inventory',public.game_inventory(mine.data),
      'wallet',case when jsonb_typeof(mine.data->'wallet')='object' then mine.data->'wallet' else '{}'::jsonb end
        || jsonb_build_object('pelines',public.game_pelines(mine.data)));
  end if;
  is_a:=tr.a=mine.id;
  if p_action not in ('state','invite','join','offer','accept','back','cancel') then raise exception 'TRADE_INVALID_OFFER'; end if;
  if p_action not in ('state','invite') and tr.status in ('completed','cancelled') then
    if p_action<>'cancel' then raise exception 'TRADE_CLOSED'; end if;
  elsif p_action='cancel' then
    tr.status:='cancelled'; tr.reason:='TRADE_CANCELLED'; tr.accepted_a:=false; tr.accepted_b:=false;
  elsif p_action='join' then
    if is_a or tr.status<>'invited' then raise exception 'TRADE_CLOSED'; end if;
    tr.status:='open';
  elsif p_action in ('offer','accept','back') then
    if tr.status<>'open' then raise exception 'TRADE_CLOSED'; end if;
    if p_revision is distinct from tr.revision then raise exception 'TRADE_CHANGED'; end if;
    perform 1 from public.characters where id in(tr.a,tr.b) order by id for update;
    select data into da from public.characters where id=tr.a;
    select data into db from public.characters where id=tr.b;
    if not public.game_trade_valid(tr) then raise exception 'TRADE_UNAVAILABLE'; end if;
    if p_action='offer' then
      own_offer:=public.game_trade_offer(case when is_a then da else db end,p_offer);
      if is_a then tr.offer_a:=own_offer; else tr.offer_b:=own_offer; end if;
      tr.revision:=tr.revision+1; tr.accepted_a:=false; tr.accepted_b:=false;
    else
      if is_a then tr.accepted_a:=p_action='accept'; else tr.accepted_b:=p_action='accept'; end if;
      if tr.accepted_a and tr.accepted_b then
        da:=public.game_trade_remove(da,tr.offer_a); db:=public.game_trade_remove(db,tr.offer_b);
        da:=public.game_trade_add(da,tr.offer_b); db:=public.game_trade_add(db,tr.offer_a);
        perform public.game_store(tr.a,da); perform public.game_store(tr.b,db);
        tr.status:='completed';
      end if;
    end if;
  end if;
  update public.player_trades set status=tr.status,reason=tr.reason,revision=tr.revision,
    offer_a=tr.offer_a,offer_b=tr.offer_b,accepted_a=tr.accepted_a,accepted_b=tr.accepted_b where id=tr.id;
  select * into mine from public.characters where id=p_character_id;
  select * into other from public.characters where id=case when is_a then tr.b else tr.a end;
  own_offer:=case when is_a then tr.offer_a else tr.offer_b end;
  peer_offer:=case when is_a then tr.offer_b else tr.offer_a end;
  return jsonb_build_object('trade',jsonb_build_object('id',tr.id,'status',tr.status,'reason',tr.reason,'revision',tr.revision,
    'incoming',not is_a,'peerId',other.id,'peerName',other.name,'own',own_offer,'peer',peer_offer,
    'accepted',case when is_a then tr.accepted_a else tr.accepted_b end,
    'peerAccepted',case when is_a then tr.accepted_b else tr.accepted_a end),
    'inventory',public.game_inventory(mine.data),
    'wallet',case when jsonb_typeof(mine.data->'wallet')='object' then mine.data->'wallet' else '{}'::jsonb end
      || jsonb_build_object('pelines',public.game_pelines(mine.data)));
end $$;
revoke all on function public.game_trade_valid(public.player_trades),public.game_trade_offer(jsonb,jsonb),
  public.game_trade_remove(jsonb,jsonb),public.game_trade_add(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.trade_action(uuid,text,uuid,uuid,jsonb,int) from public,anon;
grant execute on function public.trade_action(uuid,text,uuid,uuid,jsonb,int) to authenticated;

create or replace function public.move_inventory_item(p_character_id uuid, p_from int, p_to int,
  p_expected_from jsonb, p_expected_to jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters; inv jsonb; source jsonb; target jsonb; actual jsonb; expected jsonb; i int;
begin
  -- Same lock order as trade_action: a move must invalidate any accepted slot-based offer.
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  c:=public.game_lock_character(p_character_id);
  if p_from is null or p_to is null or p_from not between 0 and 24 or p_to not between 0 and 24
    or p_from=p_to then raise exception 'INVALID_ITEM'; end if;
  inv:=public.game_inventory(c.data); source:=inv->p_from; target:=inv->p_to;
  if jsonb_typeof(source) is distinct from 'object' then raise exception 'INVALID_ITEM'; end if;
  for i in 0..1 loop
    actual:=case when i=0 then source else target end;
    expected:=case when i=0 then p_expected_from else p_expected_to end;
    if jsonb_typeof(actual)='object' then
      if jsonb_typeof(expected) is distinct from 'object'
        or actual->>'id' is distinct from expected->>'id'
        or actual->>'count' is distinct from expected->>'count'
        or coalesce((actual->>'bound')::boolean,false) is distinct from coalesce((expected->>'bound')::boolean,false)
        then raise exception 'INVENTORY_CHANGED'; end if;
    elsif coalesce(expected,'null'::jsonb)<>'null'::jsonb then raise exception 'INVENTORY_CHANGED'; end if;
  end loop;
  inv:=jsonb_set(jsonb_set(inv,array[p_from::text],target),array[p_to::text],source);
  update public.player_trades set revision=revision+1,accepted_a=false,accepted_b=false,
    offer_a=case when a=p_character_id then '{"items":[],"pelines":0}'::jsonb else offer_a end,
    offer_b=case when b=p_character_id then '{"items":[],"pelines":0}'::jsonb else offer_b end
    where status in ('invited','open') and p_character_id in(a,b);
  return public.game_store(c.id,c.data||jsonb_build_object('inventory',inv));
end $$;
revoke all on function public.move_inventory_item(uuid,int,int,jsonb,jsonb) from public,anon;
grant execute on function public.move_inventory_item(uuid,int,int,jsonb,jsonb) to authenticated;
