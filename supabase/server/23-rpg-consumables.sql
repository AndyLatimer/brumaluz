create or replace function public.game_food_data(p_id uuid, d jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  seen timestamptz;
  stamp numeric := extract(epoch from now());
  remaining numeric;
begin
  if public.game_item(d->'foodBuff'->>'itemId')->>'food_seconds' is not null then
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
      then jsonb_build_object('itemId',d->'foodBuff'->>'itemId','remaining',remaining) else 'null'::jsonb end);
  else
    d := jsonb_set(d, '{foodBuff}', 'null'::jsonb);
  end if;
  return d || jsonb_build_object('food_at',stamp,'foodRevision',coalesce((d->>'foodRevision')::bigint,0));
end $$;

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
  if item ? 'resource_pct' or item ? 'heal_pct' then
    if coalesce((d->>'potionReadyAt')::numeric,0)>extract(epoch from clock_timestamp()) then raise exception 'Las pociones todavía se están recuperando.';end if;
    d:=d||jsonb_build_object('potionReadyAt',extract(epoch from clock_timestamp())+15);
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
