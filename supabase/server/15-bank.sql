-- ---------- Banco personal de la cuenta ----------
-- Un banco por cuenta, compartido por todos sus personajes. Solo se usa mediante bank_action.
-- `size` permite ampliar los huecos más adelante sin tocar los datos guardados.
create table if not exists public.account_banks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  pelines int not null default 0 check (pelines >= 0),
  size int not null default 50 check (size between 1 and 500),
  updated_at timestamptz not null default now()
);
alter table public.account_banks enable row level security;
revoke all on table public.account_banks from public,anon,authenticated;

-- Huecos del banco rellenos con null hasta su tamaño.
create or replace function public.game_bank_items(p_items jsonb,p_size int)
returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg(case when jsonb_typeof(p_items->(i-1))='object' then p_items->(i-1) else 'null'::jsonb end order by i),'[]'::jsonb)
  from generate_series(1,greatest(p_size,1)) i
$$;

-- Dónde se puede abrir el banco (debe coincidir con BANK_SPOTS en src/data/bank.ts).
create or replace function public.game_bank_spot(p_location text)
returns jsonb language sql immutable set search_path='' as $$
  select case p_location
    when 'casa_de_isberto_interior' then '{"x":2.25,"z":3.25,"radius":3}'::jsonb
  end
$$;

-- Mete un montón entero en los huecos: primero en montones iguales con sitio, luego en huecos libres.
-- Devuelve null si no cabe entero.
create or replace function public.game_stack_into(p_slots jsonb,p_item jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  slots jsonb:=p_slots; slot jsonb; i int; room int;
  id text:=p_item->>'id'; bound boolean:=coalesce((p_item->>'bound')::boolean,false);
  left_count int:=(p_item->>'count')::int;
  stack int:=greatest(coalesce((public.game_item(p_item->>'id')->>'stack')::int,50),1);
begin
  for i in 0..jsonb_array_length(slots)-1 loop
    exit when left_count<=0;
    slot:=slots->i;
    if jsonb_typeof(slot)='object' and slot->>'id'=id and coalesce((slot->>'bound')::boolean,false)=bound
      and (slot->>'count')::int<stack then
      room:=least(stack-(slot->>'count')::int,left_count);
      slots:=jsonb_set(slots,array[i::text],slot||jsonb_build_object('count',(slot->>'count')::int+room));
      left_count:=left_count-room;
    end if;
  end loop;
  for i in 0..jsonb_array_length(slots)-1 loop
    exit when left_count<=0;
    if jsonb_typeof(slots->i) is distinct from 'object' then
      room:=least(stack,left_count);
      slots:=jsonb_set(slots,array[i::text],jsonb_build_object('id',id,'count',room,'bound',bound));
      left_count:=left_count-room;
    end if;
  end loop;
  if left_count>0 then return null; end if;
  return slots;
end $$;
revoke all on function public.game_bank_items(jsonb,int),public.game_bank_spot(text),public.game_stack_into(jsonb,jsonb)
  from public,anon,authenticated;

-- open | deposit (hueco de mochila) | withdraw (hueco del banco) | deposit_pelines | withdraw_pelines.
-- Exige estar junto al baúl según la presencia del servidor. Los objetos ligados no pueden guardarse.
-- Deja un objeto en un hueco concreto: si está libre lo ocupa; si hay un montón igual, lo completa (lo que no cabe
-- vuelve en 'rest'); si hay otro objeto, se intercambian (el que había vuelve en 'rest').
create or replace function public.game_place_item(p_slots jsonb,p_index int,p_item jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  target jsonb:=p_slots->p_index; room int; moved int;
  stack int:=greatest(coalesce((public.game_item(p_item->>'id')->>'stack')::int,50),1);
begin
  if jsonb_typeof(target) is distinct from 'object' then
    return jsonb_build_object('slots',jsonb_set(p_slots,array[p_index::text],p_item),'rest',null);
  end if;
  if target->>'id'=p_item->>'id'
    and coalesce((target->>'bound')::boolean,false)=coalesce((p_item->>'bound')::boolean,false) then
    room:=greatest(stack-(target->>'count')::int,0);
    moved:=least(room,(p_item->>'count')::int);
    return jsonb_build_object(
      'slots',jsonb_set(p_slots,array[p_index::text],target||jsonb_build_object('count',(target->>'count')::int+moved)),
      'rest',case when (p_item->>'count')::int>moved then p_item||jsonb_build_object('count',(p_item->>'count')::int-moved) end);
  end if;
  return jsonb_build_object('slots',jsonb_set(p_slots,array[p_index::text],p_item),'rest',target);
end $$;
revoke all on function public.game_place_item(jsonb,int,jsonb) from public,anon,authenticated;

-- p_target: hueco de destino al arrastrar (sin él, el objeto va al primer sitio libre). 'move' reordena el baúl.
drop function if exists public.bank_action(uuid,text,int,jsonb,int);
create or replace function public.bank_action(p_character_id uuid,p_action text,p_slot int default null,
  p_expected jsonb default null,p_amount int default null,p_target int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters; d jsonb; bank public.account_banks; inv jsonb; bank_items jsonb; source jsonb; merged jsonb;
  pos jsonb; spot jsonb; changed boolean:=false; placed jsonb; rest jsonb;
begin
  -- Mismo orden de bloqueo que trade_action y move_inventory_item.
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  c:=public.game_lock_character(p_character_id);
  d:=c.data;
  if p_action is null or p_action not in ('open','deposit','withdraw','move','deposit_pelines','withdraw_pelines')
    then raise exception 'BANK_INVALID_ACTION'; end if;
  if public.game_health(d)=0 then raise exception 'BANK_DEAD'; end if;
  select position into pos from public.world_players where character_id=c.id and user_id=c.user_id
    and seen_at>now()-interval '15 seconds';
  spot:=public.game_bank_spot(coalesce(d->>'location','brumaluz'));
  if pos is null or spot is null then raise exception 'BANK_NOT_PLAYING'; end if;
  if power((pos->>'x')::numeric-(spot->>'x')::numeric,2)+power((pos->>'z')::numeric-(spot->>'z')::numeric,2)
    >power((spot->>'radius')::numeric,2) then raise exception 'BANK_TOO_FAR'; end if;

  insert into public.account_banks(user_id) values (c.user_id) on conflict (user_id) do nothing;
  perform public.game_deliver_modular_parts(c.user_id);
  select * into bank from public.account_banks where user_id=c.user_id for update;
  insert into public.equipment_modular_migrations(scope,owner,original) values('bank',c.user_id,bank.items) on conflict do nothing;
  bank_items:=public.game_bank_items(bank.items,bank.size);
  inv:=public.game_inventory(d);

  if p_action='deposit' then
    if p_slot is null or p_slot not between 0 and 24 then raise exception 'INVALID_ITEM'; end if;
    source:=inv->p_slot;
    if jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
      or source->>'id' is distinct from p_expected->>'id'
      or source->>'count' is distinct from p_expected->>'count'
      or coalesce((source->>'bound')::boolean,false) is distinct from coalesce((p_expected->>'bound')::boolean,false)
      then raise exception 'INVENTORY_CHANGED'; end if;
    if coalesce((source->>'bound')::boolean,false) or coalesce((public.game_item(source->>'id')->>'bound')::boolean,false)
      then raise exception 'BANK_ITEM_BOUND'; end if;
    if p_target is null then
      merged:=public.game_stack_into(bank_items,source);
      if merged is null then raise exception 'BANK_FULL'; end if;
      bank_items:=merged; inv:=jsonb_set(inv,array[p_slot::text],'null'::jsonb);
    else
      if p_target<0 or p_target>=bank.size then raise exception 'INVALID_ITEM'; end if;
      placed:=public.game_place_item(bank_items,p_target,source);
      bank_items:=placed->'slots'; rest:=placed->'rest';
      inv:=jsonb_set(inv,array[p_slot::text],coalesce(rest,'null'::jsonb));
    end if;
    changed:=true;
  elsif p_action='withdraw' then
    if p_slot is null or p_slot<0 or p_slot>=bank.size then raise exception 'INVALID_ITEM'; end if;
    source:=bank_items->p_slot;
    if jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
      or source->>'id' is distinct from p_expected->>'id'
      or source->>'count' is distinct from p_expected->>'count'
      or coalesce((source->>'bound')::boolean,false) is distinct from coalesce((p_expected->>'bound')::boolean,false)
      then raise exception 'BANK_CHANGED'; end if;
    if p_target is null then
      merged:=public.game_stack_into(inv,source);
      if merged is null then raise exception 'INVENTORY_FULL'; end if;
      inv:=merged; bank_items:=jsonb_set(bank_items,array[p_slot::text],'null'::jsonb);
    else
      if p_target not between 0 and 24 then raise exception 'INVALID_ITEM'; end if;
      placed:=public.game_place_item(inv,p_target,source);
      rest:=placed->'rest';
      -- Lo que había en la mochila pasa al baúl: no puede estar ligado.
      if jsonb_typeof(rest)='object' and (coalesce((rest->>'bound')::boolean,false)
        or coalesce((public.game_item(rest->>'id')->>'bound')::boolean,false)) then raise exception 'BANK_ITEM_BOUND'; end if;
      inv:=placed->'slots';
      bank_items:=jsonb_set(bank_items,array[p_slot::text],coalesce(rest,'null'::jsonb));
    end if;
    changed:=true;
  elsif p_action='move' then
    if p_slot is null or p_target is null or p_slot<0 or p_slot>=bank.size or p_target<0 or p_target>=bank.size
      or p_slot=p_target then raise exception 'INVALID_ITEM'; end if;
    source:=bank_items->p_slot;
    if jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
      or source->>'id' is distinct from p_expected->>'id'
      or source->>'count' is distinct from p_expected->>'count'
      then raise exception 'BANK_CHANGED'; end if;
    placed:=public.game_place_item(jsonb_set(bank_items,array[p_slot::text],'null'::jsonb),p_target,source);
    bank_items:=jsonb_set(placed->'slots',array[p_slot::text],coalesce(placed->'rest','null'::jsonb));
    changed:=true;
  elsif p_action='deposit_pelines' then
    if p_amount is null or p_amount<=0 then raise exception 'BANK_INVALID_ACTION'; end if;
    if public.game_pelines(d)<p_amount then raise exception 'NOT_ENOUGH_MONEY'; end if;
    d:=public.game_set_pelines(d,public.game_pelines(d)-p_amount);
    bank.pelines:=bank.pelines+p_amount; changed:=true;
  elsif p_action='withdraw_pelines' then
    if p_amount is null or p_amount<=0 then raise exception 'BANK_INVALID_ACTION'; end if;
    if bank.pelines<p_amount then raise exception 'BANK_NOT_ENOUGH_MONEY'; end if;
    d:=public.game_set_pelines(d,public.game_pelines(d)+p_amount);
    bank.pelines:=bank.pelines-p_amount; changed:=true;
  end if;

  if changed then
    update public.account_banks set items=bank_items,pelines=bank.pelines,updated_at=now() where user_id=c.user_id;
    -- Igual que move_inventory_item: cualquier cambio invalida las ofertas de intercambio abiertas.
    update public.player_trades set revision=revision+1,accepted_a=false,accepted_b=false,
      offer_a=case when a=c.id then '{"items":[],"pelines":0}'::jsonb else offer_a end,
      offer_b=case when b=c.id then '{"items":[],"pelines":0}'::jsonb else offer_b end
      where status in ('invited','open') and c.id in(a,b);
    d:=d||jsonb_build_object('inventory',inv);
  end if;
  return public.game_store(c.id,d)||jsonb_build_object('bank',jsonb_build_object('items',bank_items,'pelines',bank.pelines,'size',bank.size));
end $$;
revoke all on function public.bank_action(uuid,text,int,jsonb,int,int) from public,anon;
grant execute on function public.bank_action(uuid,text,int,jsonb,int,int) to authenticated;
