-- Generado por el editor de mapas al publicar. No lo edites a mano.
-- Mapas de Pompelín publicados y sus portales. Se aplica después de server.sql con «npm run db:apply».
delete from public.world_portals;
delete from public.world_maps where id not in ('brumaluz', 'brumaluz_2', 'casa_de_isberto_interior', 'pompelin');
insert into public.world_maps(id, name, spawn) values ('brumaluz', 'Brumaluz', '{"x":-6.4,"z":-11.08,"yaw":0.52}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-196,"minZ":-196,"maxX":196,"maxZ":196}'::jsonb where id = 'brumaluz';
insert into public.world_maps(id, name, spawn) values ('brumaluz_2', 'Brumaluz', '{"x":-6.4,"z":-11.08,"yaw":0.52}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-120,"minZ":-120,"maxX":120,"maxZ":120}'::jsonb where id = 'brumaluz_2';
insert into public.world_maps(id, name, spawn) values ('casa_de_isberto_interior', 'Casa de Isberto', '{"x":0,"z":2.25,"yaw":0}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-4,"minZ":-4,"maxX":4,"maxZ":4}'::jsonb where id = 'casa_de_isberto_interior';
insert into public.world_maps(id, name, spawn) values ('pompelin', 'Pompelín', '{"x":-120,"z":-10,"yaw":0}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-1080,"minZ":-810,"maxX":1080,"maxZ":810}'::jsonb where id = 'pompelin';
update public.server_config set value = '{"x":-6.4,"z":-11.08}'::jsonb where key = 'spawn';
insert into public.world_portals(map, id, x, z, radius, target_map, target) values
  ('brumaluz', 'salida_este', 175.2, 0, 3.6, 'pompelin', '{"x":-56,"z":-90,"yaw":-1.57}'::jsonb),
  ('brumaluz', 'salida_noreste', 87.6, -151.73, 3.6, 'pompelin', '{"x":-88,"z":-145.43,"yaw":-0.52}'::jsonb),
  ('brumaluz', 'salida_oeste', -175.2, 0, 3.6, 'pompelin', '{"x":-184,"z":-90,"yaw":1.57}'::jsonb),
  ('brumaluz', 'salida_sureste', 87.6, 151.73, 3.6, 'pompelin', '{"x":-88,"z":-34.57,"yaw":-2.62}'::jsonb),
  ('brumaluz', 'salida_suroeste', -87.6, 151.73, 3.6, 'pompelin', '{"x":-152,"z":-34.57,"yaw":2.62}'::jsonb),
  ('brumaluz', 'mknnlaak', 23.5, -48.5, 2.2, 'casa_de_isberto_interior', '{"x":0,"z":2.25,"yaw":0}'::jsonb),
  ('brumaluz_2', 'salida_este', 84.8, 0, 3.2, 'pompelin', '{"x":-56,"z":-90,"yaw":-1.57}'::jsonb),
  ('brumaluz_2', 'salida_noreste', 42.4, -73.44, 3.2, 'pompelin', '{"x":-88,"z":-145.43,"yaw":-0.52}'::jsonb),
  ('brumaluz_2', 'salida_oeste', -84.8, 0, 3.2, 'pompelin', '{"x":-184,"z":-90,"yaw":1.57}'::jsonb),
  ('brumaluz_2', 'salida_sureste', 42.4, 73.44, 3.2, 'pompelin', '{"x":-88,"z":-34.57,"yaw":-2.62}'::jsonb),
  ('brumaluz_2', 'salida_suroeste', -42.4, 73.44, 3.2, 'pompelin', '{"x":-152,"z":-34.57,"yaw":2.62}'::jsonb),
  ('casa_de_isberto_interior', 'link_70713897', 0, 2.5, 2.2, 'brumaluz', '{"x":24.5,"z":-48.5,"yaw":1.57}'::jsonb),
  ('pompelin', 'entrada_brumaluz_este', -70, -90, 4, 'brumaluz', '{"x":156,"z":0,"yaw":1.57}'::jsonb),
  ('pompelin', 'entrada_brumaluz_noreste', -95, -133.3, 4, 'brumaluz', '{"x":78,"z":-135.1,"yaw":2.62}'::jsonb),
  ('pompelin', 'entrada_brumaluz_oeste', -170, -90, 4, 'brumaluz', '{"x":-156,"z":0,"yaw":-1.57}'::jsonb),
  ('pompelin', 'entrada_brumaluz_sureste', -95, -46.7, 4, 'brumaluz', '{"x":78,"z":135.1,"yaw":0.52}'::jsonb),
  ('pompelin', 'entrada_brumaluz_suroeste', -145, -46.7, 4, 'brumaluz', '{"x":-78,"z":135.1,"yaw":-0.52}'::jsonb);
