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
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) ||
    jsonb_build_object('equipment', coalesce(d->'equipment','{}'::jsonb))
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

-- Regeneration only advances while the character has a live world-presence lease.
-- Fractional points are retained server-side so heartbeat cadence cannot change the rate.
create or replace function public.game_regen_data(p_id uuid, d jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  seen timestamptz;
  stamp numeric := extract(epoch from clock_timestamp());
  previous numeric := coalesce((d ->> 'vitals_at')::numeric, extract(epoch from clock_timestamp()));
  active_until numeric;
  elapsed numeric := 0;
  max_health numeric := public.game_max_health(d);
  max_resource numeric;
  health_value numeric := public.game_health(d);
  resource_value numeric;
  health_remainder numeric := coalesce((d ->> 'health_regen')::numeric,0);
  resource_remainder numeric := coalesce((d ->> 'resource_regen')::numeric,0);
  health_rate numeric;
  resource_rate numeric;
  kind text := case when d ->> 'cls' in ('mago','clerigo') then 'mana' else 'stamina' end;
  total numeric;
begin
  select seen_at into seen from public.world_players where character_id=p_id;
  if seen is not null then
    active_until := extract(epoch from least(clock_timestamp(),seen+interval '15 seconds'));
    elapsed := greatest(0,active_until-previous);
  end if;

  max_resource := (public.game_level(d)-1)*6 + case when kind='mana'
    then 30+public.game_attr_total(d,'intelecto')*7
    else 50+public.game_attr_total(d,'agilidad')*3+public.game_attr_total(d,'corpulencia')*3
  end;
  max_resource := floor(max_resource*(1+least(greatest(coalesce((d->>'partyPeers')::int,0),0),3)*0.015));
  if d->'foodBuff'->>'itemId'='pan_duro' and coalesce((d->'foodBuff'->>'remaining')::numeric,0)>0 then
    max_resource := max_resource+3;
  end if;

  health_rate := case when coalesce((d->>'combat_at')::numeric,0)>=stamp-5 then 0.0025 else 0.01 end;
  resource_rate := case when kind='mana' then 0.02 else 0.04 end;

  if health_value=0 then
    health_remainder := 0;
    resource_remainder := 0;
    resource_value := (public.game_public_vitals(d)->>'resource')::numeric;
  else
    total := least(max_health,health_value+health_remainder+max_health*health_rate*elapsed);
    health_value := floor(total);
    health_remainder := case when total>=max_health then 0 else total-health_value end;

    resource_value := (public.game_public_vitals(d)->>'resource')::numeric;
    total := least(max_resource,resource_value+resource_remainder+max_resource*resource_rate*elapsed);
    resource_value := floor(total);
    resource_remainder := case when total>=max_resource then 0 else total-resource_value end;
  end if;

  return d || jsonb_build_object(
    'health',case when health_value>=max_health then -1 else health_value end,
    'resource',case when resource_value>=max_resource then -1 else coalesce(resource_value,0) end,
    'health_regen',health_remainder,'resource_regen',resource_remainder,'vitals_at',stamp
  );
end;
$$;
revoke all on function public.game_regen_data(uuid,jsonb) from public, anon, authenticated;

create or replace function public.game_combat_tick(p_id uuid, d jsonb, p_x double precision, p_z double precision)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  encounter jsonb := d->'combatEncounter';
  stamp numeric := extract(epoch from clock_timestamp());
  enemy_x numeric;
  enemy_z numeric;
  absorbed int;
  remaining int;
  hp int;
  incoming int;
begin
  if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false)
    or encounter->>'status' is distinct from 'active'
    or coalesce(d->>'location','brumaluz')<>'brumaluz'
    or coalesce((d->>'health')::int,-1)=0
    or stamp<coalesce((encounter->>'enemyAttackAt')::numeric,stamp) then
    return d;
  end if;
  enemy_x := (encounter->>'x')::numeric;
  enemy_z := (encounter->>'z')::numeric;
  if sqrt(power(p_x-enemy_x,2)+power(p_z-enemy_z,2))>2 then return d; end if;

  incoming := greatest(1,8-public.game_equipment_stat(d,'guard'));
  absorbed := least(public.game_overheal_now(d),incoming);
  remaining := incoming-absorbed;
  hp := public.game_health(d);
  if remaining>0 then hp:=greatest(0,hp-remaining); end if;
  d := d || jsonb_build_object(
    'health',hp,'overheal',public.game_overheal_now(d)-absorbed,
    'overheal_at',stamp,'combat_at',stamp
  );
  encounter := encounter || jsonb_build_object(
    'enemyAttackAt',stamp+2,'engaged',true,
    'status',case when hp=0 then 'failed' else 'active' end
  );
  return jsonb_set(d,'{combatEncounter}',encounter);
end;
$$;
revoke all on function public.game_combat_tick(uuid,jsonb,double precision,double precision) from public, anon, authenticated;

