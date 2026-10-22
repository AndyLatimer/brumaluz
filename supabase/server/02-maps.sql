-- ---------- Mapas de Pompelín ----------
-- Cada mapa publicado desde el editor es un lugar (`data.location`). supabase/world.sql, que genera el
-- editor al publicar, rellena estas tablas; aquí solo se garantiza la capital.
create table if not exists public.world_maps (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null,
  spawn jsonb not null check (jsonb_typeof(spawn -> 'x') = 'number' and jsonb_typeof(spawn -> 'z') = 'number')
);
alter table public.world_maps enable row level security;
alter table public.world_maps add column if not exists bounds jsonb;
revoke all on table public.world_maps from public, anon, authenticated;
insert into public.world_maps(id, name, spawn)
  select 'brumaluz', 'Brumaluz', value || '{"yaw":0}'::jsonb from public.server_config where key = 'spawn'
on conflict (id) do nothing;

-- Portales: al estar dentro de (x, z, radius) en `map`, world_travel lleva al personaje a `target` de `target_map`.
create table if not exists public.world_portals (
  map text not null references public.world_maps(id) on delete cascade,
  id text not null,
  x double precision not null,
  z double precision not null,
  radius double precision not null check (radius between 0 and 100),
  target_map text not null references public.world_maps(id) on delete cascade,
  target jsonb not null check (jsonb_typeof(target -> 'x') = 'number' and jsonb_typeof(target -> 'z') = 'number'),
  primary key (map, id)
);
alter table public.world_portals enable row level security;
revoke all on table public.world_portals from public, anon, authenticated;

create or replace function public.game_location_spawn(p_location text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('x', spawn -> 'x', 'z', spawn -> 'z', 'yaw', coalesce(spawn -> 'yaw', '0'::jsonb)) from public.world_maps where id = p_location),
    (select value || '{"yaw":0}'::jsonb from public.server_config where key = 'spawn'),
    '{"x":0,"z":0,"yaw":0}'::jsonb)
$$;
revoke all on function public.game_location_spawn(text) from public, anon, authenticated;

create or replace function public.game_location_contains(p_location text, p_x double precision, p_z double precision)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p_x between (bounds ->> 'minX')::double precision and (bounds ->> 'maxX')::double precision
       and p_z between (bounds ->> 'minZ')::double precision and (bounds ->> 'maxZ')::double precision
    from public.world_maps where id = p_location and bounds is not null
  ), p_x between -(select (value #>> '{}')::double precision from public.server_config where key = 'world_limit')
                  and (select (value #>> '{}')::double precision from public.server_config where key = 'world_limit')
     and p_z between -(select (value #>> '{}')::double precision from public.server_config where key = 'world_limit')
                  and (select (value #>> '{}')::double precision from public.server_config where key = 'world_limit'), false)
$$;
revoke all on function public.game_location_contains(text, double precision, double precision) from public, anon, authenticated;

