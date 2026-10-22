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
    when 'esencia_sombria' then '{"value":0,"bound":true,"sellable":false,"stack":50}'::jsonb
    when 'espada_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'escudo_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'baston_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'daga_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'daga_secundaria_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'varita_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'libro_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'ballesta_inicial' then '{"value":0,"stack":1,"bound":true}'::jsonb
    when 'espada_cobre_t1' then '{"value":100,"stack":1,"bound":false}'::jsonb
    when 'escudo_roble_t1' then '{"value":70,"stack":1,"bound":false}'::jsonb
    when 'baston_ambar_t1' then '{"value":110,"stack":1,"bound":false}'::jsonb
    when 'daga_cazador_t1' then '{"value":90,"stack":1,"bound":false}'::jsonb
    when 'daga_secundaria_cazador_t1' then '{"value":60,"stack":1,"bound":false}'::jsonb
    when 'varita_ambar_t1' then '{"value":100,"stack":1,"bound":false}'::jsonb
    when 'grimorio_verde_t1' then '{"value":70,"stack":1,"bound":false}'::jsonb
    when 'ballesta_roble_t1' then '{"value":110,"stack":1,"bound":false}'::jsonb
    when 'espada_cobre_t2' then '{"value":200,"stack":1,"bound":false}'::jsonb
    when 'escudo_roble_t2' then '{"value":140,"stack":1,"bound":false}'::jsonb
    when 'baston_ambar_t2' then '{"value":220,"stack":1,"bound":false}'::jsonb
    when 'daga_cazador_t2' then '{"value":180,"stack":1,"bound":false}'::jsonb
    when 'daga_secundaria_cazador_t2' then '{"value":120,"stack":1,"bound":false}'::jsonb
    when 'varita_ambar_t2' then '{"value":200,"stack":1,"bound":false}'::jsonb
    when 'grimorio_verde_t2' then '{"value":140,"stack":1,"bound":false}'::jsonb
    when 'ballesta_roble_t2' then '{"value":220,"stack":1,"bound":false}'::jsonb
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
    when 'testiculos' then array['pocion_vida_minuscula', 'pocion_mana_minuscula', 'pocion_estamina_minuscula', 'pan_duro',
      'espada_cobre_t1','escudo_roble_t1','baston_ambar_t1','daga_cazador_t1',
      'daga_secundaria_cazador_t1','varita_ambar_t1','grimorio_verde_t1','ballesta_roble_t1',
      'espada_cobre_t2','escudo_roble_t2','baston_ambar_t2','daga_cazador_t2',
      'daga_secundaria_cazador_t2','varita_ambar_t2','grimorio_verde_t2','ballesta_roble_t2']
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
create or replace function public.game_equipment_item(p_item text)
returns jsonb language sql immutable set search_path='' as $$
  select case p_item
    when 'espada_inicial' then '{"slot":"weapon","cls":"guerrero"}'::jsonb
    when 'escudo_inicial' then '{"slot":"offhand","cls":"guerrero"}'::jsonb
    when 'baston_inicial' then '{"slot":"weapon","cls":"mago"}'::jsonb
    when 'daga_inicial' then '{"slot":"weapon","cls":"picaro"}'::jsonb
    when 'daga_secundaria_inicial' then '{"slot":"offhand","cls":"picaro"}'::jsonb
    when 'varita_inicial' then '{"slot":"weapon","cls":"clerigo"}'::jsonb
    when 'libro_inicial' then '{"slot":"offhand","cls":"clerigo"}'::jsonb
    when 'ballesta_inicial' then '{"slot":"weapon","cls":"explorador"}'::jsonb
  end
$$;
create or replace function public.game_has_weapon(d jsonb)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(public.game_equipment_item(d->'equipment'->'weapon'->>'id')->>'cls'=d->>'cls'
    and public.game_equipment_item(d->'equipment'->'weapon'->>'id')->>'slot'='weapon'
    and d->'equipment'->'weapon'->>'count'='1',false)
$$;
revoke all on function public.game_equipment_item(text),public.game_has_weapon(jsonb) from public,anon,authenticated;

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
  if coalesce((item->>'sellable')::boolean,true)=false or public.game_inventory(d) -> p_slot ->> 'id' = any(array[
    'espada_inicial','escudo_inicial','baston_inicial','daga_inicial',
    'daga_secundaria_inicial','varita_inicial','libro_inicial','ballesta_inicial'
  ]) then raise exception 'ITEM_NOT_SELLABLE'; end if;
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
  cfg_speed numeric := coalesce((select (value #>> '{}')::numeric from public.server_config where key = 'max_speed'), 9);
  spawn jsonb := public.game_location_spawn(coalesce(d ->> 'location', 'brumaluz'));
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
    or not (public.game_location_contains(coalesce(d ->> 'location', 'brumaluz'), p_x, p_z)
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

