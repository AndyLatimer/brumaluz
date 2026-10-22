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
  ('combat_enabled', 'false'::jsonb),           -- combate personal todavía no activado en el mundo público
  ('combat_site', '{"x": 0, "z": -62.35}'::jsonb),
  ('staff_titles', '{"rey_de_pompelin": ["manuelperezardanuy@gmail.com"]}'::jsonb), -- títulos reservados: título -> emails autorizados
  -- Hora del mundo: son las `start_hour` en el instante `epoch` (1 ene 2026, UTC) y pasa una hora cada `seconds_per_hour` s reales.
  ('world_clock', '{"epoch": 1767225600, "start_hour": 8, "seconds_per_hour": 600}'::jsonb)
on conflict (key) do nothing;

update public.server_config
set value = jsonb_set(value, '{reina_de_pompelin}', (
  select jsonb_agg(distinct email)
  from jsonb_array_elements(
    coalesce(value -> 'reina_de_pompelin', '[]'::jsonb) || '["veronicaluxen17@gmail.com"]'::jsonb
  ) as emails(email)
))
where key = 'staff_titles';

