-- Trades are private RPC-only records. Session IDs prevent invitations surviving a replaced tab.
create table if not exists public.player_trades (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references public.characters(id) on delete cascade,
  b uuid not null references public.characters(id) on delete cascade,
  sa uuid not null,
  sb uuid not null,
  status text not null default 'invited' check(status in ('invited','open','completed','cancelled')),
  reason text,
  revision int not null default 0,
  offer_a jsonb not null default '{"items":[],"pelines":0}',
  offer_b jsonb not null default '{"items":[],"pelines":0}',
  accepted_a boolean not null default false,
  accepted_b boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.player_trades enable row level security;
revoke all on table public.player_trades from public, anon, authenticated;
create index if not exists player_trades_a_history on public.player_trades(a,created_at desc);
create index if not exists player_trades_b_history on public.player_trades(b,created_at desc);
create index if not exists player_trades_active on public.player_trades(status) where status in ('invited','open');

create or replace function public.game_trade_valid(tr public.player_trades)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.world_players x join public.world_players y on y.character_id=tr.b
    join public.characters cx on cx.id=x.character_id join public.characters cy on cy.id=y.character_id
    where x.character_id=tr.a and x.session_id=tr.sa and y.session_id=tr.sb
      and x.seen_at>now()-interval '15 seconds' and y.seen_at>now()-interval '15 seconds'
      and not x.dead and not y.dead
      and public.game_health(cx.data)>0 and public.game_health(cy.data)>0
      and coalesce(cx.data->>'location','brumaluz')=coalesce(cy.data->>'location','brumaluz')
      and power((x.position->>'x')::float8-(y.position->>'x')::float8,2)
        +power((x.position->>'z')::float8-(y.position->>'z')::float8,2)<=100
  )
$$;

create or replace function public.game_trade_offer(d jsonb, offer jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  entry jsonb; slot jsonb; result jsonb:='[]'; seen int[]:='{}'; n int; idx int; money int;
begin
  if jsonb_typeof(offer) is distinct from 'object' or offer- 'items'- 'pelines'<>'{}'::jsonb
    or jsonb_typeof(offer->'items') is distinct from 'array'
    or jsonb_array_length(offer->'items')>25
    or coalesce(offer->>'pelines','') !~ '^[0-9]{1,10}$' then raise exception 'TRADE_INVALID_OFFER'; end if;
  money:=(offer->>'pelines')::bigint;
  if money>public.game_pelines(d) then raise exception 'NOT_ENOUGH_PELINES'; end if;
  for entry in select value from jsonb_array_elements(offer->'items') loop
    if coalesce(entry->>'slot','') !~ '^[0-9]{1,2}$' or coalesce(entry->>'count','') !~ '^[0-9]{1,3}$'
      then raise exception 'TRADE_INVALID_OFFER'; end if;
    idx:=(entry->>'slot')::int; n:=(entry->>'count')::int;
    if idx not between 0 and 24 or idx=any(seen) or n<1 then raise exception 'TRADE_INVALID_OFFER'; end if;
    seen:=array_append(seen,idx); slot:=public.game_inventory(d)->idx;
    if jsonb_typeof(slot) is distinct from 'object' or public.game_item(slot->>'id') is null
      or n>(slot->>'count')::int then raise exception 'TRADE_ITEMS_CHANGED'; end if;
    if coalesce((slot->>'bound')::boolean,false) or coalesce((public.game_item(slot->>'id')->>'bound')::boolean,false)
      then raise exception 'TRADE_BOUND'; end if;
    if entry ? 'id' and entry->>'id' is distinct from slot->>'id' then raise exception 'TRADE_ITEMS_CHANGED'; end if;
    result:=result||jsonb_build_array(jsonb_build_object('slot',idx,'id',slot->>'id','count',n));
  end loop;
  return jsonb_build_object('items',result,'pelines',money);
end $$;

create or replace function public.game_trade_remove(d jsonb, offer jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare entry jsonb; inv jsonb:=public.game_inventory(d); idx int; remaining int;
begin
  perform public.game_trade_offer(d,offer);
  for entry in select value from jsonb_array_elements(offer->'items') loop
    idx:=(entry->>'slot')::int; remaining:=(inv->idx->>'count')::int-(entry->>'count')::int;
    inv:=jsonb_set(inv,array[idx::text],case when remaining=0 then 'null'::jsonb
      else inv->idx||jsonb_build_object('count',remaining) end);
  end loop;
  return public.game_set_pelines(d||jsonb_build_object('inventory',inv),public.game_pelines(d)-(offer->>'pelines')::int);
end $$;

create or replace function public.game_trade_add(d jsonb, offer jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare entry jsonb; i int;
begin
  for entry in select value from jsonb_array_elements(offer->'items') loop
    for i in 1..(entry->>'count')::int loop d:=public.game_add_item(d,entry->>'id'); end loop;
  end loop;
  return public.game_set_pelines(d,public.game_pelines(d)+(offer->>'pelines')::int);
end $$;

create or replace function public.trade_action(p_character_id uuid, p_action text default 'state',
  p_trade_id uuid default null, p_target_id uuid default null, p_offer jsonb default null, p_revision int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=(select auth.uid()); tr public.player_trades; mine public.characters; other public.characters;
  wa public.world_players; wb public.world_players; is_a boolean; da jsonb; db jsonb; own_offer jsonb; peer_offer jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  -- Serialize trade mutations before acquiring character locks, always in UUID order.
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  select * into mine from public.characters where id=p_character_id and user_id=uid;
  if mine.id is null then raise exception 'CHARACTER_NOT_FOUND'; end if;
  update public.player_trades set status='cancelled',reason='TRADE_UNAVAILABLE',accepted_a=false,accepted_b=false
    where status in ('invited','open') and not public.game_trade_valid(player_trades);
  if p_action='invite' then
    select * into other from public.characters where id=p_target_id and user_id<>uid;
    if other.id is null then raise exception 'TRADE_UNAVAILABLE'; end if;
    if exists(select 1 from public.player_trades where status in ('invited','open')
      and (a in(mine.id,other.id) or b in(mine.id,other.id))) then raise exception 'TRADE_BUSY'; end if;
    select * into wa from public.world_players where character_id=mine.id;
    select * into wb from public.world_players where character_id=other.id;
    tr.a:=mine.id; tr.b:=other.id; tr.sa:=wa.session_id; tr.sb:=wb.session_id;
    if not public.game_trade_valid(tr) then raise exception 'TRADE_UNAVAILABLE'; end if;
    insert into public.player_trades(a,b,sa,sb) values(tr.a,tr.b,tr.sa,tr.sb) returning * into tr;
  elsif p_trade_id is not null then
    select * into tr from public.player_trades where id=p_trade_id and p_character_id in(a,b) for update;
    if tr.id is null then raise exception 'TRADE_NOT_FOUND'; end if;
  else
    select * into tr from public.player_trades where p_character_id in(a,b)
      order by (status in ('invited','open')) desc,created_at desc,id limit 1 for update;
  end if;
  if tr.id is null then
    return jsonb_build_object('trade',null,'inventory',public.game_inventory(mine.data),
      'wallet',case when jsonb_typeof(mine.data->'wallet')='object' then mine.data->'wallet' else '{}'::jsonb end
        || jsonb_build_object('pelines',public.game_pelines(mine.data)));
  end if;
  is_a:=tr.a=mine.id;
  if p_action not in ('state','invite','join','offer','accept','back','cancel') then raise exception 'TRADE_INVALID_OFFER'; end if;
  if p_action not in ('state','invite') and tr.status in ('completed','cancelled') then
    if p_action<>'cancel' then raise exception 'TRADE_CLOSED'; end if;
  elsif p_action='cancel' then
    tr.status:='cancelled'; tr.reason:='TRADE_CANCELLED'; tr.accepted_a:=false; tr.accepted_b:=false;
  elsif p_action='join' then
    if is_a or tr.status<>'invited' then raise exception 'TRADE_CLOSED'; end if;
    tr.status:='open';
  elsif p_action in ('offer','accept','back') then
    if tr.status<>'open' then raise exception 'TRADE_CLOSED'; end if;
    if p_revision is distinct from tr.revision then raise exception 'TRADE_CHANGED'; end if;
    perform 1 from public.characters where id in(tr.a,tr.b) order by id for update;
    select data into da from public.characters where id=tr.a;
    select data into db from public.characters where id=tr.b;
    if not public.game_trade_valid(tr) then raise exception 'TRADE_UNAVAILABLE'; end if;
    if p_action='offer' then
      own_offer:=public.game_trade_offer(case when is_a then da else db end,p_offer);
      if is_a then tr.offer_a:=own_offer; else tr.offer_b:=own_offer; end if;
      tr.revision:=tr.revision+1; tr.accepted_a:=false; tr.accepted_b:=false;
    else
      if is_a then tr.accepted_a:=p_action='accept'; else tr.accepted_b:=p_action='accept'; end if;
      if tr.accepted_a and tr.accepted_b then
        da:=public.game_trade_remove(da,tr.offer_a); db:=public.game_trade_remove(db,tr.offer_b);
        da:=public.game_trade_add(da,tr.offer_b); db:=public.game_trade_add(db,tr.offer_a);
        perform public.game_store(tr.a,da); perform public.game_store(tr.b,db);
        tr.status:='completed';
      end if;
    end if;
  end if;
  update public.player_trades set status=tr.status,reason=tr.reason,revision=tr.revision,
    offer_a=tr.offer_a,offer_b=tr.offer_b,accepted_a=tr.accepted_a,accepted_b=tr.accepted_b where id=tr.id;
  select * into mine from public.characters where id=p_character_id;
  select * into other from public.characters where id=case when is_a then tr.b else tr.a end;
  own_offer:=case when is_a then tr.offer_a else tr.offer_b end;
  peer_offer:=case when is_a then tr.offer_b else tr.offer_a end;
  return jsonb_build_object('trade',jsonb_build_object('id',tr.id,'status',tr.status,'reason',tr.reason,'revision',tr.revision,
    'incoming',not is_a,'peerId',other.id,'peerName',other.name,'own',own_offer,'peer',peer_offer,
    'accepted',case when is_a then tr.accepted_a else tr.accepted_b end,
    'peerAccepted',case when is_a then tr.accepted_b else tr.accepted_a end),
    'inventory',public.game_inventory(mine.data),
    'wallet',case when jsonb_typeof(mine.data->'wallet')='object' then mine.data->'wallet' else '{}'::jsonb end
      || jsonb_build_object('pelines',public.game_pelines(mine.data)));
end $$;
revoke all on function public.game_trade_valid(public.player_trades),public.game_trade_offer(jsonb,jsonb),
  public.game_trade_remove(jsonb,jsonb),public.game_trade_add(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.trade_action(uuid,text,uuid,uuid,jsonb,int) from public,anon;
grant execute on function public.trade_action(uuid,text,uuid,uuid,jsonb,int) to authenticated;

create or replace function public.move_inventory_item(p_character_id uuid, p_from int, p_to int,
  p_expected_from jsonb, p_expected_to jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters; inv jsonb; source jsonb; target jsonb; actual jsonb; expected jsonb; i int;
begin
  -- Same lock order as trade_action: a move must invalidate any accepted slot-based offer.
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  c:=public.game_lock_character(p_character_id);
  if p_from is null or p_to is null or p_from not between 0 and 24 or p_to not between 0 and 24
    or p_from=p_to then raise exception 'INVALID_ITEM'; end if;
  inv:=public.game_inventory(c.data); source:=inv->p_from; target:=inv->p_to;
  if jsonb_typeof(source) is distinct from 'object' then raise exception 'INVALID_ITEM'; end if;
  for i in 0..1 loop
    actual:=case when i=0 then source else target end;
    expected:=case when i=0 then p_expected_from else p_expected_to end;
    if jsonb_typeof(actual)='object' then
      if jsonb_typeof(expected) is distinct from 'object'
        or actual->>'id' is distinct from expected->>'id'
        or actual->>'count' is distinct from expected->>'count'
        or coalesce((actual->>'bound')::boolean,false) is distinct from coalesce((expected->>'bound')::boolean,false)
        then raise exception 'INVENTORY_CHANGED'; end if;
    elsif coalesce(expected,'null'::jsonb)<>'null'::jsonb then raise exception 'INVENTORY_CHANGED'; end if;
  end loop;
  inv:=jsonb_set(jsonb_set(inv,array[p_from::text],target),array[p_to::text],source);
  update public.player_trades set revision=revision+1,accepted_a=false,accepted_b=false,
    offer_a=case when a=p_character_id then '{"items":[],"pelines":0}'::jsonb else offer_a end,
    offer_b=case when b=p_character_id then '{"items":[],"pelines":0}'::jsonb else offer_b end
    where status in ('invited','open') and p_character_id in(a,b);
  return public.game_store(c.id,c.data||jsonb_build_object('inventory',inv));
end $$;
revoke all on function public.move_inventory_item(uuid,int,int,jsonb,jsonb) from public,anon;
grant execute on function public.move_inventory_item(uuid,int,int,jsonb,jsonb) to authenticated;

create or replace function public.change_equipment(p_character_id uuid,p_slot text,p_bag int,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters; inv jsonb; equipment jsonb; source jsonb; target jsonb; meta jsonb; free int; previous_vitals jsonb; changed jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  c:=public.game_lock_character(p_character_id);
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD'; end if;
  previous_vitals:=public.game_public_vitals(c.data);
  if p_slot is null or p_slot not in ('head','pendant','chest','hands','ring','weapon','offhand','legs','feet','trinket')
    or (p_bag is not null and p_bag not between 0 and 24) then raise exception 'EQUIPMENT_INVALID'; end if;
  inv:=public.game_inventory(c.data);
  equipment:=coalesce(c.data->'equipment','{}'::jsonb);
  source:=case when p_bag is null then equipment->p_slot else inv->p_bag end;
  if jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
    or source->>'id' is distinct from p_expected->>'id'
    or source->>'count' is distinct from p_expected->>'count'
    or coalesce((source->>'bound')::boolean,false) is distinct from coalesce((p_expected->>'bound')::boolean,false)
    then raise exception 'EQUIPMENT_CHANGED'; end if;
  meta:=public.game_equipment_item(source->>'id');
  if p_bag is not null and (meta is null or meta->>'slot' is distinct from p_slot or (meta->>'cls' is not null and meta->>'cls' is distinct from c.data->>'cls')
    or source->>'count'<>'1') then raise exception 'EQUIPMENT_INVALID'; end if;
  if p_bag is null then
    select i into free from generate_series(0,24) i where inv->i='null'::jsonb order by i limit 1;
    if free is null then raise exception 'INVENTORY_FULL'; end if;
    inv:=jsonb_set(inv,array[free::text],source);
    equipment:=jsonb_set(equipment,array[p_slot],'null'::jsonb);
  else
    target:=coalesce(equipment->p_slot,'null'::jsonb);
    inv:=jsonb_set(inv,array[p_bag::text],target);
    equipment:=jsonb_set(equipment,array[p_slot],source);
  end if;
  update public.player_trades set revision=revision+1,accepted_a=false,accepted_b=false,
    offer_a=case when a=c.id then '{"items":[],"pelines":0}'::jsonb else offer_a end,
    offer_b=case when b=c.id then '{"items":[],"pelines":0}'::jsonb else offer_b end
    where status in ('invited','open') and c.id in(a,b);
  changed:=c.data||jsonb_build_object('inventory',inv,'equipment',equipment);
  changed:=changed||jsonb_build_object(
    'health',least((previous_vitals->>'health')::int,public.game_max_health(changed)),
    'resource',least((previous_vitals->>'resource')::int,(public.game_public_vitals(changed)->>'maxResource')::int));
  return public.game_store(c.id,changed);
end $$;
revoke all on function public.change_equipment(uuid,text,int,jsonb) from public,anon;
grant execute on function public.change_equipment(uuid,text,int,jsonb) to authenticated;

