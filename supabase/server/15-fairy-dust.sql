-- ---------- Polvos de hada del mundo ----------
-- Catálogo de montones de polvo: posición y rango de recompensa (1-5 unidades). Mantener ids y posiciones iguales a src/data/fairyDust.ts.
create or replace function public.game_fairy_dust(p_id text)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('x',b.x,'z',b.z,'min',b.lo,'max',b.hi) from (values
    ('plaza_fuente',-2.4::numeric,1.8::numeric,1,5),
    ('arco_entrada',7.2::numeric,-6.5::numeric,1,5)
  ) as b(id,x,z,lo,hi) where b.id=p_id
$$;
revoke all on function public.game_fairy_dust(text) from public,anon,authenticated;

-- Recoger un montón de polvo: una vez por personaje, a menos de 3 m según la presencia del servidor.
-- Otorga polvo de hada (1-5 unidades) al inventario; el cliente solo ve el resultado.
create or replace function public.collect_fairy_dust(p_character_id uuid,p_dust_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters:=public.game_lock_character(p_character_id);
  d jsonb:=c.data; dust jsonb:=public.game_fairy_dust(p_dust_id); pos jsonb; taken jsonb; amount int; i int;
begin
  if dust is null then raise exception 'FAIRY_DUST_INVALID'; end if;
  if public.game_health(d)=0 then raise exception 'FAIRY_DUST_DEAD'; end if;
  taken:=case when jsonb_typeof(d->'fairyDust')='array' then d->'fairyDust' else '[]'::jsonb end;
  if taken ? p_dust_id then raise exception 'FAIRY_DUST_TAKEN'; end if;
  select position into pos from public.world_players where character_id=c.id and user_id=c.user_id
    and seen_at>now()-interval '15 seconds';
  if pos is null or coalesce(d->>'location','brumaluz')<>'brumaluz' then raise exception 'FAIRY_DUST_NOT_PLAYING'; end if;
  if power((pos->>'x')::numeric-(dust->>'x')::numeric,2)+power((pos->>'z')::numeric-(dust->>'z')::numeric,2)>9
    then raise exception 'FAIRY_DUST_TOO_FAR'; end if;
  amount:=1+floor(random()*5)::int;
  for i in 1..amount loop
    d:=public.game_add_item(d,'polvo_de_hada');
  end loop;
  d:=d||jsonb_build_object('fairyDust',taken||to_jsonb(p_dust_id));
  return public.game_store(c.id,d);
end $$;
revoke all on function public.collect_fairy_dust(uuid,text) from public,anon;
grant execute on function public.collect_fairy_dust(uuid,text) to authenticated;
