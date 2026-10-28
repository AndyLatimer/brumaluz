-- ---------- Bolsas de pelines del mundo ----------
-- Catálogo inicial de bolsas. Al publicar, world.sql lo sustituye por los puntos del editor,
-- coordinados con src/data/world/collectibles.json (posición, mapa y rango de pelines).
create or replace function public.game_coin_bag(p_id text)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('x',b.x,'z',b.z,'min',b.lo,'max',b.hi) from (values
    ('plaza_pozo',3.6::numeric,-3.2::numeric,10,30),
    ('testiculos_debugger',-9.2::numeric,5.028203230275508::numeric,20,40)
  ) as b(id,x,z,lo,hi) where b.id=p_id
$$;
revoke all on function public.game_coin_bag(text) from public,anon,authenticated;

-- Recoger una bolsa: una vez por personaje, a menos de 3 m según la presencia del servidor.
-- La cantidad se sortea aquí; el cliente solo ve el monedero resultante.
create or replace function public.collect_coin_bag(p_character_id uuid,p_bag_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters:=public.game_lock_character(p_character_id);
  d jsonb:=c.data; bag jsonb:=public.game_coin_bag(p_bag_id); pos jsonb; taken jsonb; amount int;
begin
  if bag is null then raise exception 'COIN_BAG_INVALID'; end if;
  if public.game_health(d)=0 then raise exception 'COIN_BAG_DEAD'; end if;
  taken:=case when jsonb_typeof(d->'coinBags')='array' then d->'coinBags' else '[]'::jsonb end;
  if taken ? p_bag_id then raise exception 'COIN_BAG_TAKEN'; end if;
  select position into pos from public.world_players where character_id=c.id and user_id=c.user_id
    and seen_at>now()-interval '15 seconds';
  if pos is null or coalesce(d->>'location','brumaluz')<>coalesce(bag->>'location','brumaluz') then raise exception 'COIN_BAG_NOT_PLAYING'; end if;
  if power((pos->>'x')::numeric-(bag->>'x')::numeric,2)+power((pos->>'z')::numeric-(bag->>'z')::numeric,2)>9
    then raise exception 'COIN_BAG_TOO_FAR'; end if;
  amount:=(bag->>'min')::int+floor(random()*((bag->>'max')::int-(bag->>'min')::int+1))::int;
  d:=public.game_set_pelines(d,public.game_pelines(d)+amount)||jsonb_build_object('coinBags',taken||to_jsonb(p_bag_id));
  return public.game_store(c.id,d);
end $$;
revoke all on function public.collect_coin_bag(uuid,text) from public,anon;
grant execute on function public.collect_coin_bag(uuid,text) to authenticated;

