-- Generado por el editor de mapas al publicar. No lo edites a mano.
-- Mapas de Pompelín publicados y sus portales. Se aplica después del SQL del servidor con «npm run db:apply».
delete from public.world_portals;
delete from public.world_maps where id not in ('brumaluz', 'brumaluz_2', 'casa_de_isberto_interior', 'habitacion_posada_lucero_del_alba', 'pompelin', 'posada_lucero_del_alba', 'taller_alquimia_interior', 'taller_carpinteria_interior', 'taller_cocina_interior', 'taller_ebanisteria_interior', 'taller_encantamiento_interior', 'taller_herreria_interior', 'taller_joyeria_interior', 'taller_lenador_interior', 'taller_minero_interior', 'taller_peleteria_interior', 'taller_recolector_interior', 'taller_sastreria_interior');
insert into public.world_maps(id, name, spawn) values ('brumaluz', 'Brumaluz', '{"x":-6.4,"z":-11.08,"yaw":0.52}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-196,"minZ":-196,"maxX":196,"maxZ":196}'::jsonb where id = 'brumaluz';
insert into public.world_maps(id, name, spawn) values ('brumaluz_2', 'Brumaluz', '{"x":-6.4,"z":-11.08,"yaw":0.52}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-120,"minZ":-120,"maxX":120,"maxZ":120}'::jsonb where id = 'brumaluz_2';
insert into public.world_maps(id, name, spawn) values ('casa_de_isberto_interior', 'Casa de Isberto', '{"x":0,"z":2.25,"yaw":0}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-4,"minZ":-4,"maxX":4,"maxZ":4}'::jsonb where id = 'casa_de_isberto_interior';
insert into public.world_maps(id, name, spawn) values ('habitacion_posada_lucero_del_alba', 'Habitación posada Lucero del alba', '{"x":0,"z":0,"yaw":0}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-2.5,"minZ":-2.5,"maxX":2.5,"maxZ":2.5}'::jsonb where id = 'habitacion_posada_lucero_del_alba';
insert into public.world_maps(id, name, spawn) values ('pompelin', 'Pompelín', '{"x":-120,"z":-10,"yaw":0}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-1080,"minZ":-810,"maxX":1080,"maxZ":810}'::jsonb where id = 'pompelin';
insert into public.world_maps(id, name, spawn) values ('posada_lucero_del_alba', 'Posada lucero del alba', '{"x":0,"z":11,"yaw":0}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-8,"minZ":-12,"maxX":8,"maxZ":12}'::jsonb where id = 'posada_lucero_del_alba';
insert into public.world_maps(id, name, spawn) values ('taller_alquimia_interior', 'Taller de Alquimia', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_alquimia_interior';
insert into public.world_maps(id, name, spawn) values ('taller_carpinteria_interior', 'Taller de Carpintería', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-9,"minZ":-6.5,"maxX":9,"maxZ":6.5}'::jsonb where id = 'taller_carpinteria_interior';
insert into public.world_maps(id, name, spawn) values ('taller_cocina_interior', 'Cocina de Brumaluz', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_cocina_interior';
insert into public.world_maps(id, name, spawn) values ('taller_ebanisteria_interior', 'Taller de Ebanistería', '{"x":0,"z":4.2,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-9,"minZ":-7.5,"maxX":9,"maxZ":7.5}'::jsonb where id = 'taller_ebanisteria_interior';
insert into public.world_maps(id, name, spawn) values ('taller_encantamiento_interior', 'Taller de Encantamiento', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_encantamiento_interior';
insert into public.world_maps(id, name, spawn) values ('taller_herreria_interior', 'Forja de Brumaluz', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_herreria_interior';
insert into public.world_maps(id, name, spawn) values ('taller_joyeria_interior', 'Taller de Joyería', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_joyeria_interior';
insert into public.world_maps(id, name, spawn) values ('taller_lenador_interior', 'Taller de Leñadores', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_lenador_interior';
insert into public.world_maps(id, name, spawn) values ('taller_minero_interior', 'Taller de Minería', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_minero_interior';
insert into public.world_maps(id, name, spawn) values ('taller_peleteria_interior', 'Taller de Peletería', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_peleteria_interior';
insert into public.world_maps(id, name, spawn) values ('taller_recolector_interior', 'Taller de Recolección', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_recolector_interior';
insert into public.world_maps(id, name, spawn) values ('taller_sastreria_interior', 'Taller de Sastrería', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-7.5,"minZ":-6.5,"maxX":7.5,"maxZ":6.5}'::jsonb where id = 'taller_sastreria_interior';
update public.server_config set value = '{"x":-6.4,"z":-11.08}'::jsonb where key = 'spawn';
insert into public.world_portals(map, id, x, z, radius, target_map, target) values
  ('brumaluz', 'salida_este', 175.2, 0, 3.6, 'pompelin', '{"x":-56,"z":-90,"yaw":-1.57}'::jsonb),
  ('brumaluz', 'salida_noreste', 87.6, -151.73, 3.6, 'pompelin', '{"x":-88,"z":-145.43,"yaw":-0.52}'::jsonb),
  ('brumaluz', 'salida_oeste', -175.2, 0, 3.6, 'pompelin', '{"x":-184,"z":-90,"yaw":1.57}'::jsonb),
  ('brumaluz', 'salida_sureste', 87.6, 151.73, 3.6, 'pompelin', '{"x":-88,"z":-34.57,"yaw":-2.62}'::jsonb),
  ('brumaluz', 'salida_suroeste', -87.6, 151.73, 3.6, 'pompelin', '{"x":-152,"z":-34.57,"yaw":2.62}'::jsonb),
  ('brumaluz', 'mknnlaak', 23.5, -48.5, 2.2, 'casa_de_isberto_interior', '{"x":0,"z":2.25,"yaw":0}'::jsonb),
  ('brumaluz', 'mki9y7l0', -78, 54.5, 1.5, 'posada_lucero_del_alba', '{"x":0,"z":11,"yaw":0}'::jsonb),
  ('brumaluz', 'taller_herreria', -112.23, -34.64, 2.2, 'taller_herreria_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_peleteria', -115.77, -41.57, 2.2, 'taller_peleteria_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_sastreria', -111.77, -48.5, 2.2, 'taller_sastreria_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_carpinteria', -123.01, -55.43, 2.2, 'taller_carpinteria_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_ebanisteria', -115.01, -69.28, 2.2, 'taller_ebanisteria_interior', '{"x":0,"z":4.2,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_joyeria', -99.01, -55.43, 2.2, 'taller_joyeria_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_alquimia', -83.85, -41.57, 2.2, 'taller_alquimia_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_encantamiento', -95.77, -76.21, 2.2, 'taller_encantamiento_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_cocina', -104.99, -62.35, 2.2, 'taller_cocina_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_minero', -128.15, -48.5, 2.2, 'taller_minero_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_lenador', -135.01, -34.64, 2.2, 'taller_lenador_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz', 'taller_recolector', -96.15, -62.35, 2.2, 'taller_recolector_interior', '{"x":0,"z":2.9,"yaw":3.14}'::jsonb),
  ('brumaluz_2', 'salida_este', 84.8, 0, 3.2, 'pompelin', '{"x":-56,"z":-90,"yaw":-1.57}'::jsonb),
  ('brumaluz_2', 'salida_noreste', 42.4, -73.44, 3.2, 'pompelin', '{"x":-88,"z":-145.43,"yaw":-0.52}'::jsonb),
  ('brumaluz_2', 'salida_oeste', -84.8, 0, 3.2, 'pompelin', '{"x":-184,"z":-90,"yaw":1.57}'::jsonb),
  ('brumaluz_2', 'salida_sureste', 42.4, 73.44, 3.2, 'pompelin', '{"x":-88,"z":-34.57,"yaw":-2.62}'::jsonb),
  ('brumaluz_2', 'salida_suroeste', -42.4, 73.44, 3.2, 'pompelin', '{"x":-152,"z":-34.57,"yaw":2.62}'::jsonb),
  ('casa_de_isberto_interior', 'link_70713897', 0, 2.5, 2.2, 'brumaluz', '{"x":23,"z":-48.5,"yaw":-1.57}'::jsonb),
  ('pompelin', 'entrada_brumaluz_este', -70, -90, 4, 'brumaluz', '{"x":156,"z":0,"yaw":1.57}'::jsonb),
  ('pompelin', 'entrada_brumaluz_noreste', -95, -133.3, 4, 'brumaluz', '{"x":78,"z":-135.1,"yaw":2.62}'::jsonb),
  ('pompelin', 'entrada_brumaluz_oeste', -170, -90, 4, 'brumaluz', '{"x":-156,"z":0,"yaw":-1.57}'::jsonb),
  ('pompelin', 'entrada_brumaluz_sureste', -95, -46.7, 4, 'brumaluz', '{"x":78,"z":135.1,"yaw":0.52}'::jsonb),
  ('pompelin', 'entrada_brumaluz_suroeste', -145, -46.7, 4, 'brumaluz', '{"x":-78,"z":135.1,"yaw":-0.52}'::jsonb),
  ('posada_lucero_del_alba', 'mkf9n1bp', -7, 6, 1, 'habitacion_posada_lucero_del_alba', '{"x":0,"z":0,"yaw":0}'::jsonb),
  ('taller_alquimia_interior', 'salida_taller_alquimia', 0, 4.2, 1.3, 'brumaluz', '{"x":-82.4,"z":-41.57,"yaw":4.71}'::jsonb),
  ('taller_carpinteria_interior', 'salida_taller_carpinteria', 0, 4.2, 1.3, 'brumaluz', '{"x":-124.46,"z":-55.43,"yaw":1.57}'::jsonb),
  ('taller_cocina_interior', 'salida_taller_cocina', 0, 4.2, 1.3, 'brumaluz', '{"x":-103.54,"z":-62.35,"yaw":4.71}'::jsonb),
  ('taller_ebanisteria_interior', 'salida_taller_ebanisteria', 0, 5.5, 1.3, 'brumaluz', '{"x":-116.46,"z":-69.28,"yaw":1.57}'::jsonb),
  ('taller_encantamiento_interior', 'salida_taller_encantamiento', 0, 4.2, 1.3, 'brumaluz', '{"x":-94.32,"z":-76.21,"yaw":4.71}'::jsonb),
  ('taller_herreria_interior', 'salida_taller_herreria', 0, 4.2, 1.3, 'brumaluz', '{"x":-113.68,"z":-34.64,"yaw":1.57}'::jsonb),
  ('taller_joyeria_interior', 'salida_taller_joyeria', 0, 4.2, 1.3, 'brumaluz', '{"x":-100.46,"z":-55.43,"yaw":1.57}'::jsonb),
  ('taller_lenador_interior', 'salida_taller_lenador', 0, 4.2, 1.3, 'brumaluz', '{"x":-136.46,"z":-34.64,"yaw":1.57}'::jsonb),
  ('taller_minero_interior', 'salida_taller_minero', 0, 4.2, 1.3, 'brumaluz', '{"x":-129.6,"z":-48.5,"yaw":1.57}'::jsonb),
  ('taller_peleteria_interior', 'salida_taller_peleteria', 0, 4.2, 1.3, 'brumaluz', '{"x":-114.32,"z":-41.57,"yaw":4.71}'::jsonb),
  ('taller_recolector_interior', 'salida_taller_recolector', 0, 4.2, 1.3, 'brumaluz', '{"x":-97.6,"z":-62.35,"yaw":1.57}'::jsonb),
  ('taller_sastreria_interior', 'salida_taller_sastreria', 0, 4.2, 1.3, 'brumaluz', '{"x":-110.32,"z":-48.5,"yaw":4.71}'::jsonb);

-- Coleccionables publicados desde el editor.
create or replace function public.game_coin_bag(p_id text)
returns jsonb language sql immutable set search_path='' as $$
select value from (values
  ('plaza_pozo', '{"x":3.6,"z":-3.2,"min":10,"max":30,"location":"brumaluz"}'::jsonb),
  ('testiculos_debugger', '{"x":-9.2,"z":5.028203230275508,"min":20,"max":40,"location":"brumaluz"}'::jsonb)
) as spots(id,value) where id=p_id
$$;
revoke all on function public.game_coin_bag(text) from public,anon,authenticated;

create or replace function public.game_fairy_dust(p_id text)
returns jsonb language sql immutable set search_path='' as $$
select value from (values
  ('plaza_fuente', '{"x":-2.4,"z":1.8,"min":1,"max":5,"location":"brumaluz"}'::jsonb),
  ('arco_entrada', '{"x":7.2,"z":-6.5,"min":1,"max":5,"location":"brumaluz"}'::jsonb)
) as spots(id,value) where id=p_id
$$;
revoke all on function public.game_fairy_dust(text) from public,anon,authenticated;
