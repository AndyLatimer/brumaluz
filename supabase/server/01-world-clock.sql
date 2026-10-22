-- ---------- Hora del mundo ----------
-- La misma para todos: sale del reloj del servidor. src/data/worldClock.ts repite la fórmula por si no hay conexión.
create or replace function public.world_clock()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'hour', mod(mod((cfg ->> 'start_hour')::numeric
      + (extract(epoch from now()) - (cfg ->> 'epoch')::numeric) / (cfg ->> 'seconds_per_hour')::numeric, 24) + 24, 24),
    'secondsPerHour', (cfg ->> 'seconds_per_hour')::numeric)
  from (select coalesce((select value from public.server_config where key = 'world_clock'),
    '{"epoch": 1767225600, "start_hour": 8, "seconds_per_hour": 600}'::jsonb) as cfg) as config;
$$;
revoke all on function public.world_clock() from public;
grant execute on function public.world_clock() to anon, authenticated;

