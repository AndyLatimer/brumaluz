-- ---------- Fórmulas (internas) ----------
-- New characters become eligible only after narrative/presentation approval.
insert into public.server_config(key,value) values('welcome_enabled','false') on conflict(key) do nothing;

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
create table if not exists public.party_responses (
  id uuid primary key default gen_random_uuid(),
  recipient_user uuid not null references auth.users(id) on delete cascade,
  username text not null,
  accepted boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists party_responses_recipient_idx on public.party_responses(recipient_user);
create index if not exists party_members_party_idx on public.party_members(party_id,entry_order);
create index if not exists party_invites_target_idx on public.party_invites(target_user);
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_invites enable row level security;
alter table public.party_responses enable row level security;
revoke all on public.parties, public.party_members, public.party_invites from public, anon, authenticated;
revoke all on public.party_responses from public, anon, authenticated;

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

-- PL/pgSQL resolves the equipment catalog when called (it is defined later in 05).
create or replace function public.game_equipment_vital_bonus(d jsonb,p_stat text)
returns int language plpgsql immutable set search_path='' as $$
begin return public.game_equipment_stat(d,p_stat); end $$;
revoke all on function public.game_equipment_vital_bonus(jsonb,text) from public,anon,authenticated;

create or replace function public.game_max_health(d jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select floor((60 + (public.game_level(d) - 1) * 12 + public.game_attr_total(d, 'corpulencia') * 8)
    * (1 + least(greatest(coalesce((d->>'partyPeers')::int,0),0),3) * 0.015))::int
    + case when d->'foodBuff'->>'itemId'='pan_duro' and (d->'foodBuff'->>'remaining')::numeric>0 then 5 else 0 end
    + public.game_equipment_vital_bonus(d,'maxHealth')
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

create or replace function public.game_skill_id(cls text)
returns text language sql immutable set search_path = '' as $$
  select case cls when 'guerrero' then 'heavy_strike' when 'mago' then 'arcane_discharge'
    when 'picaro' then 'double_slash' when 'clerigo' then 'healing' when 'explorador' then 'precise_shot' end
$$;

create or replace function public.game_skill_rank(d jsonb)
returns int language sql immutable set search_path = '' as $$
  select greatest(1,least(5,public.game_level(d)/2+1,
    coalesce((d->'skillRanks'->>public.game_skill_id(d->>'cls'))::int,1)))
$$;

revoke all on function public.game_skill_id(text),public.game_skill_rank(jsonb) from public,anon,authenticated;

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
  c.data := public.game_regen_data(c.id,c.data);
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
  d := public.game_regen_data(p_id,d);
  d := d || jsonb_build_object(
    'overheal', case when coalesce((d ->> 'health')::int, -1) = 0 then 0 else public.game_overheal_now(d) end,
    'overheal_at', extract(epoch from now())
  );
  update public.characters set data = d - 'partyPeers', updated_at = now() where id = p_id returning data into result;
  return public.game_party_data(p_id,result);
end;
$$;

