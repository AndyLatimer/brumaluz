-- Generado automáticamente por el Editor de Objetos de Brumaluz
-- Define los objetos personalizados creados o modificados en itemsCatalog.json

create or replace function public.game_custom_item(p_item text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_item
    when 'mineral_cobre_test' then '{"value":10,"stack":99,"bound":false,"sellable":true,"storable":true,"tradable":true}'::jsonb
    when 'lingote_oro_test' then '{"value":500,"stack":99,"bound":false,"sellable":true,"storable":true,"tradable":true}'::jsonb
    when 'test_espada_e2e' then '{"value":450,"stack":50,"bound":false,"sellable":true,"storable":true,"tradable":true,"slot":"weapon","cls":"guerrero"}'::jsonb
    else null
  end
$$;

-- Extender game_item para consultar tanto items nativos como custom
create or replace function public.game_item_extended(p_item text)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(public.game_custom_item(p_item), public.game_item(p_item));
$$;
revoke all on function public.game_custom_item(text),public.game_item_extended(text) from public,anon,authenticated;
