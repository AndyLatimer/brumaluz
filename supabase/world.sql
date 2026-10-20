-- Generado por el editor de mapas al publicar. No lo edites a mano.
-- Mapas de Pompelín publicados y sus portales. Se aplica después de server.sql con «npm run db:apply».
delete from public.world_portals;
delete from public.world_maps where id not in ('brumaluz', 'brumaluz_2', 'casa_de_isberto_interior');
insert into public.world_maps(id, name, spawn) values ('brumaluz', 'Brumaluz', '{"x":-6.4,"z":-11.08,"yaw":0.52}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-120,"minZ":-120,"maxX":120,"maxZ":120}'::jsonb where id = 'brumaluz';
insert into public.world_maps(id, name, spawn) values ('brumaluz_2', 'Brumaluz', '{"x":-6.4,"z":-11.08,"yaw":0.52}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-120,"minZ":-120,"maxX":120,"maxZ":120}'::jsonb where id = 'brumaluz_2';
insert into public.world_maps(id, name, spawn) values ('casa_de_isberto_interior', 'Casa de Isberto', '{"x":0,"z":3,"yaw":0}'::jsonb) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;
update public.world_maps set bounds = '{"minX":-4,"minZ":-4,"maxX":4,"maxZ":4}'::jsonb where id = 'casa_de_isberto_interior';
update public.server_config set value = '{"x":-6.4,"z":-11.08}'::jsonb where key = 'spawn';
insert into public.world_portals(map, id, x, z, radius, target_map, target) values
  ('brumaluz', 'mknnlaak', 21.75, -48.5, 0.5, 'casa_de_isberto_interior', '{"x":0,"z":3,"yaw":0}'::jsonb),
  ('casa_de_isberto_interior', 'link_70713897', 0, 3.75, 0.5, 'brumaluz', '{"x":22,"z":-48.5,"yaw":-1.57}'::jsonb);
