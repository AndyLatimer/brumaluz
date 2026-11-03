-- Approved cozy economy. No character reset, no inferred ownership of legacy goods.
create table if not exists public.craft_activity(character_id uuid primary key references public.characters(id) on delete cascade, online_seconds numeric not null default 0);
alter table public.craft_activity enable row level security;
revoke all on table public.craft_activity from public,anon,authenticated;

create or replace function public.game_cozy_hash(value text) returns bigint language plpgsql immutable set search_path='' as $$
declare result bigint:=0;i int;begin for i in 1..length(value) loop result:=(result*31+ascii(substr(value,i,1)))%2147483647;end loop;return result;end $$;

create or replace function public.game_craft_online(cid uuid,stamp numeric) returns numeric language sql stable set search_path='' as $$
 select coalesce((select online_seconds from public.craft_activity where character_id=cid),0)+
 coalesce((select greatest(0,least(stamp,extract(epoch from seen_at)+15)-extract(epoch from seen_at)) from public.world_players where character_id=cid),0)
$$;
create or replace function public.game_craft_clock(s jsonb,stamp numeric) returns jsonb language plpgsql volatile set search_path='' as $$
declare cid uuid:=nullif(s->>'owner','')::uuid;elapsed numeric;online numeric;credit numeric;shift numeric;tasks jsonb:='[]';task jsonb;
begin
 if cid is null then return s;end if;
 online:=public.game_craft_online(cid,stamp);
 if s ? 'workAt' then
  elapsed:=greatest(0,stamp-(s->>'workAt')::numeric);
  credit:=least(elapsed,greatest(0,online-coalesce((s->>'workOnline')::numeric,online)));
  shift:=(elapsed-credit)*2/3;
  for task in select value from jsonb_array_elements(coalesce(s->'jobs','[]')) loop
   if not coalesce((task->>'done')::boolean,false) then task:=task||jsonb_build_object('start',(task->>'start')::numeric+shift,'end',(task->>'end')::numeric+shift);end if;
   tasks:=tasks||jsonb_build_array(task);
  end loop;s:=s||jsonb_build_object('jobs',tasks);
 end if;
 return s||jsonb_build_object('workAt',stamp,'workOnline',online);
end $$;

-- The caller already holds the character lock. Account bank locks are shared with
-- bank_action so another character on the account cannot spend the same material.
create or replace function public.game_craft_consume(cid uuid,d jsonb,needs jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare uid uuid;bank public.account_banks;inv jsonb:=public.game_inventory(d);slots jsonb;entry record;item jsonb;remaining int;n int;i int;source int;ledger jsonb:='[]';
begin
 select user_id into uid from public.characters where id=cid;
 insert into public.account_banks(user_id) values(uid) on conflict do nothing;
 select * into bank from public.account_banks where user_id=uid for update;
 slots:=public.game_bank_items(bank.items,bank.size);
 for entry in select * from jsonb_each_text(needs) loop
  remaining:=entry.value::int;
  for source in 0..1 loop
   for i in 0..case when source=0 then 24 else bank.size-1 end loop
    item:=case when source=0 then inv->i else slots->i end;
    if item->>'id' is distinct from entry.key then continue;end if;
    n:=least(remaining,(item->>'count')::int);remaining:=remaining-n;
    ledger:=ledger||jsonb_build_array(item||jsonb_build_object('count',n));
    item:=case when n=(item->>'count')::int then 'null'::jsonb else item||jsonb_build_object('count',(item->>'count')::int-n) end;
    if source=0 then inv:=jsonb_set(inv,array[i::text],item);else slots:=jsonb_set(slots,array[i::text],item);end if;
    exit when remaining=0;
   end loop;exit when remaining=0;
  end loop;
  if remaining>0 then raise exception 'Faltan materiales: %',entry.key;end if;
 end loop;
 update public.account_banks set items=slots,updated_at=now() where user_id=uid;
 return d||jsonb_build_object('inventory',inv,'craftConsumed',ledger);
end $$;
create or replace function public.game_craft_bank(cid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(id,n),'{}') from (select value->>'id' id,sum((value->>'count')::int) n from public.account_banks b join public.characters c on c.user_id=b.user_id cross join lateral jsonb_array_elements(b.items) where c.id=cid and jsonb_typeof(value)='object' group by value->>'id') q
$$;

create table if not exists public.daily_order_offers(day text not null,job text not null,rank int not null,offers jsonb not null,primary key(day,job,rank));
alter table public.daily_order_offers enable row level security;
revoke all on table public.daily_order_offers from public,anon,authenticated;
create or replace function public.game_order_offers(d jsonb,job text,stamp numeric) returns jsonb language plpgsql volatile security definer set search_path='' as $$
<<offers>>
declare catalog jsonb;rank int:=public.game_rpg_rank(d->'rpg',job);tier int;day text:=to_char(to_timestamp(stamp) at time zone 'UTC','YYYY-MM-DD');slot int;pool jsonb;r jsonb;cached jsonb;tool text;rare boolean;factor numeric;quantity int;result jsonb:='[]';
begin
 select o.offers into cached from public.daily_order_offers o where o.day=offers.day and o.job=game_order_offers.job and o.rank=offers.rank;
 if cached is not null then return cached;end if;
 delete from public.daily_order_offers where daily_order_offers.day<to_char((to_timestamp(stamp) at time zone 'UTC')-interval '7 days','YYYY-MM-DD');
 catalog:=public.game_rpg_catalog();
 if not(catalog->'teachers' ? job) then raise exception 'Maestro no válido.';end if;
 tool:=case when job in('minero','lenador','recolector') then job end;
 rare:=rank=5 and public.game_cozy_hash('rare|'||day||'|'||job)%1000<5;
 for slot in 0..2 loop
  tier:=case when rank=5 then case when rare and slot=2 then 5 else 4 end else rank end;
  select coalesce(jsonb_agg(value order by key collate "C"),'[]') into pool from jsonb_each(catalog->'recipes')
   where (value->>'tier')::int=tier and not coalesce((value->>'processing')::boolean,false)
   and case when tool is not null then catalog->'items'->(value->>'output')->>'tool'=tool else value->>'job'=job end;
  if jsonb_array_length(pool)=0 then continue;end if;
  r:=pool->(public.game_cozy_hash(day||'|'||job||'|'||rank||'|'||slot)%jsonb_array_length(pool))::int;
  factor:=case when r->>'output' like 'componente\_%' escape '\' then .8 else 1 end;
  quantity:=case when factor=.8 then 2 when r->>'job' in('alquimia','cocina') then 3 else 1 end;
  result:=result||jsonb_build_array(jsonb_build_object('id',day||':'||job||':'||rank||':'||slot,'job',job,'day',day,'label',r->>'label','recipe',r->>'id','tier',tier,'ingredients',jsonb_build_object(r->>'output',quantity),'reward',floor(50*power(3,tier)*factor),'xp',floor(5*power(3,tier)*factor)));
 end loop;
 insert into public.daily_order_offers(day,job,rank,offers) values(offers.day,game_order_offers.job,offers.rank,result) on conflict do nothing;
 select o.offers into result from public.daily_order_offers o where o.day=offers.day and o.job=game_order_offers.job and o.rank=offers.rank;
 return result;
end $$;
create or replace function public.game_order_count(d jsonb,id text) returns int language sql immutable set search_path='' as $$
 select coalesce(sum((value->>'count')::int),0)::int from jsonb_array_elements(public.game_inventory(d)) where value->>'id'=id and not coalesce((value->>'bound')::boolean,false) and value->>'craftedBy'=d->'rpg'->>'owner' and not coalesce((value->>'used')::boolean,false)
 and (not(value ? 'durability') or value->'durability'=value->'originalDurability' and value->'maxDurability'=value->'originalDurability')
$$;
create or replace function public.game_order_ready(d jsonb,o jsonb) returns boolean language sql immutable set search_path='' as $$
 select not exists(select 1 from jsonb_each_text(o->'ingredients') where public.game_order_count(d,key)<value::int)
$$;
revoke all on function public.game_cozy_hash(text),public.game_order_count(jsonb,text),public.game_order_ready(jsonb,jsonb) from public,anon,authenticated;
create or replace function public.game_order_action(cid uuid,d jsonb,action text,args jsonb,pos jsonb,stamp numeric) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare day text:=to_char(to_timestamp(stamp) at time zone 'UTC','YYYY-MM-DD');s jsonb:=d->'rpg';q jsonb;pending jsonb;selected jsonb;o jsonb;teacher jsonb;entry record;inv jsonb:=public.game_inventory(d);item jsonb;left_count int;n int;i int;completed int;
begin
 q:=case when s->'dailyOrders'->>'day'=day then s->'dailyOrders' else jsonb_build_object('day',day,'completed',0,'accepted','[]'::jsonb) end;
 pending:=coalesce(q->'accepted','[]');completed:=coalesce((q->>'completed')::int,0);
 if action='order_view' then
  teacher:=public.game_rpg_catalog()->'teachers'->(args->>'job');
  if teacher is null or teacher->>'id' is distinct from args->>'master' or teacher->>'location' is distinct from d->>'location' or sqrt(power((pos->>'x')::numeric-(teacher->>'x')::numeric,2)+power((pos->>'z')::numeric-(teacher->>'z')::numeric,2))>3 then raise exception 'Habla con el maestro de este encargo.';end if;
  s:=s||jsonb_build_object('orderViews',coalesce(s->'orderViews','{}')||jsonb_build_object(args->>'job',jsonb_build_object('day',day,'rank',public.game_rpg_rank(s,args->>'job'),'offers',public.game_order_offers(d,args->>'job',stamp))));
  return d||jsonb_build_object('rpg',s);
 elsif action='order_accept' then
  if jsonb_array_length(pending)>=3 then raise exception 'Ya tienes tres encargos pendientes.';end if;
  select value into o from jsonb_array_elements(public.game_order_offers(d,args->>'job',stamp)) where value->>'id'=args->>'id';
  if o is null then raise exception 'La oferta ha cambiado.';end if;
  if args ? 'recipe' and o->>'recipe' is distinct from args->>'recipe' or args ? 'reward' and o->'reward' is distinct from args->'reward' then raise exception 'La oferta ha cambiado. Consulta de nuevo al maestro.';end if;
  selected:=jsonb_build_array(o||jsonb_build_object('acceptedId',gen_random_uuid()::text));
 elsif action='order_cancel' then
  if not exists(select 1 from jsonb_array_elements(pending) where value->>'acceptedId'=args->>'id') then raise exception 'Encargo no disponible.';end if;
  select coalesce(jsonb_agg(value),'[]') into pending from jsonb_array_elements(pending) where value->>'acceptedId'<>args->>'id';
 elsif action in('order_claim','order_claim_all') then
  select coalesce(jsonb_agg(value),'[]') into selected from (select value from jsonb_array_elements(pending) with ordinality q(value,ord) where case when action='order_claim' then value->>'acceptedId'=args->>'id' else value->>'job'=args->>'job' and public.game_order_ready(d,value) end order by ord limit case when action='order_claim_all' then greatest(0,3-completed) else 1 end) chosen;
  if jsonb_array_length(selected)=0 then raise exception 'No tienes encargos completos de este maestro.';end if;
 else raise exception 'El suministro antiguo ya no es un encargo diario.';end if;
 for o in select value from jsonb_array_elements(coalesce(selected,'[]')) loop
  teacher:=public.game_rpg_catalog()->'teachers'->(o->>'job');
  if teacher is null or teacher->>'id' is distinct from args->>'master' or teacher->>'location' is distinct from d->>'location' or sqrt(power((pos->>'x')::numeric-(teacher->>'x')::numeric,2)+power((pos->>'z')::numeric-(teacher->>'z')::numeric,2))>coalesce((teacher->>'radius')::numeric,3) then raise exception 'Habla con el maestro de este encargo.';end if;
  if action='order_accept' then pending:=pending||jsonb_build_array(o);continue;end if;
  if completed>=3 then raise exception 'Ya has completado tus tres encargos diarios.';end if;
  if not public.game_order_ready(d||jsonb_build_object('inventory',inv),o) then if action='order_claim_all' then continue;end if;raise exception 'Faltan productos propios nuevos y sin usar.';end if;
  for entry in select * from jsonb_each_text(o->'ingredients') loop
   left_count:=entry.value::int;
   for i in 0..24 loop
    item:=inv->i;
    if public.game_order_count(d||jsonb_build_object('inventory',jsonb_build_array(item)),entry.key)=0 then continue;end if;
    n:=least(left_count,(item->>'count')::int);left_count:=left_count-n;
    inv:=jsonb_set(inv,array[i::text],case when n=(item->>'count')::int then 'null'::jsonb else item||jsonb_build_object('count',(item->>'count')::int-n) end);exit when left_count=0;
   end loop;
  end loop;
  d:=public.game_set_pelines(d,public.game_pelines(d)+(o->>'reward')::int);
  s:=jsonb_set(s,array['xp',o->>'job'],to_jsonb(coalesce((s->'xp'->(o->>'job'))::int,0)+(o->>'xp')::int));completed:=completed+1;
  select coalesce(jsonb_agg(value),'[]') into pending from jsonb_array_elements(pending) where value->>'acceptedId'<>o->>'acceptedId';
 end loop;
 if o is not null then s:=s||jsonb_build_object('orderViews',coalesce(s->'orderViews','{}')||jsonb_build_object(o->>'job',jsonb_build_object('day',day,'rank',public.game_rpg_rank(s,o->>'job'),'offers',public.game_order_offers(d||jsonb_build_object('rpg',s),o->>'job',stamp))));end if;
 return d||jsonb_build_object('inventory',inv,'rpg',s||jsonb_build_object('dailyOrders',jsonb_build_object('day',day,'completed',completed,'accepted',pending)));
end $$;
revoke all on function public.game_craft_clock(jsonb,numeric),public.game_craft_online(uuid,numeric),public.game_craft_consume(uuid,jsonb,jsonb),public.game_craft_bank(uuid),public.game_order_action(uuid,jsonb,text,jsonb,jsonb,numeric),public.game_order_offers(jsonb,text,numeric) from public,anon,authenticated;

create or replace function public.game_neighborhood_action(cid uuid,d jsonb,args jsonb,pos jsonb,stamp numeric) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare s jsonb:=d->'rpg';q jsonb:=coalesce(s->'neighborhood','{}');cfg jsonb:=public.game_neighborhood_plans()->(args->>'id');teacher jsonb;day text:=to_char(to_timestamp(stamp) at time zone 'UTC','YYYY-MM-DD');quota jsonb;inv jsonb:=public.game_inventory(d);entry record;item jsonb;left_count int;n int;i int;
begin
 if cfg is null or coalesce(q->'preparations','[]') ? (args->>'id') then raise exception 'Proyecto no disponible o ya terminado.';end if;
 teacher:=public.game_rpg_catalog()->'teachers'->(cfg->>'job');
 if args->>'master' is distinct from teacher->>'id' or d->>'location' is distinct from teacher->>'location' or sqrt(power((pos->>'x')::numeric-(teacher->>'x')::numeric,2)+power((pos->>'z')::numeric-(teacher->>'z')::numeric,2))>3 then raise exception 'Habla con el maestro de este proyecto.';end if;
 quota:=case when q->'quota'->>'day'=day then q->'quota' else jsonb_build_object('day',day,'completed',0) end;
 if (quota->>'completed')::int>=2 then raise exception 'Ya has completado dos proyectos de barrio hoy.';end if;
 for entry in select * from jsonb_each_text(cfg->'ingredients') loop
  if public.game_order_count(d,entry.key)<entry.value::int then raise exception 'Faltan componentes fabricados por este personaje.';end if;
  left_count:=entry.value::int;
  for i in 0..24 loop
   item:=inv->i;if item->>'id' is distinct from entry.key or coalesce((item->>'bound')::boolean,false) or item->>'craftedBy' is distinct from cid::text then continue;end if;
   n:=least(left_count,(item->>'count')::int);left_count:=left_count-n;inv:=jsonb_set(inv,array[i::text],case when n=(item->>'count')::int then 'null'::jsonb else item||jsonb_build_object('count',(item->>'count')::int-n) end);exit when left_count=0;
  end loop;
 end loop;
 d:=public.game_set_pelines(d||jsonb_build_object('inventory',inv),public.game_pelines(d)+(cfg->>'pelines')::int);
 q:=q||jsonb_build_object('preparations',coalesce(q->'preparations','[]')||jsonb_build_array(args->>'id'),'quota',quota||jsonb_build_object('completed',(quota->>'completed')::int+1));
 d:=d||jsonb_build_object('rpg',s||jsonb_build_object('neighborhood',q));
 if cfg ? 'gift' then d:=public.game_rpg_give(d,public.game_rpg_new_item(cfg->>'gift',1)||'{"bound":true}',true);end if;
 return d;
end $$;
revoke all on function public.game_neighborhood_action(uuid,jsonb,jsonb,jsonb,numeric) from public,anon,authenticated;
