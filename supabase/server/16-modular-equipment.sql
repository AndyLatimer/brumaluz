-- One-time conversion of previously purchased full outfits. No inventory slot is overwritten.
create table if not exists public.equipment_modular_migrations (
  scope text not null, owner uuid not null, original jsonb not null,
  created_at timestamptz not null default now(), primary key(scope,owner)
);
create table if not exists public.equipment_modular_deliveries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb
);
alter table public.equipment_modular_migrations enable row level security;
alter table public.equipment_modular_deliveries enable row level security;
revoke all on public.equipment_modular_migrations,public.equipment_modular_deliveries from public,anon,authenticated;

-- Queued compensation is retained even if an account has reached the bank's 500-slot limit.
create or replace function public.game_deliver_modular_parts(p_user uuid)
returns void language plpgsql set search_path='' as $$
declare pending jsonb; item jsonb; remaining jsonb:='[]'::jsonb; b public.account_banks; placed jsonb;
begin
  select items into pending from public.equipment_modular_deliveries where user_id=p_user for update;
  if pending is null or jsonb_array_length(pending)=0 then return; end if;
  insert into public.account_banks(user_id) values(p_user) on conflict do nothing;
  select * into b from public.account_banks where user_id=p_user for update;
  b.items:=public.game_bank_items(b.items,b.size);
  for item in select value from jsonb_array_elements(pending) loop
    placed:=public.game_stack_into(b.items,item);
    if placed is null and b.size<500 then
      b.size:=b.size+1;b.items:=b.items||'null'::jsonb;
      placed:=public.game_stack_into(b.items,item);
    end if;
    if placed is null then remaining:=remaining||jsonb_build_array(item);else b.items:=placed;end if;
  end loop;
  update public.account_banks set items=b.items,size=b.size,updated_at=now() where user_id=p_user;
  update public.equipment_modular_deliveries set items=remaining where user_id=p_user;
end $$;
revoke all on function public.game_deliver_modular_parts(uuid) from public,anon,authenticated;

do $$
declare c record; b record; entry jsonb; item jsonb; inv jsonb; equipment jsonb; extras jsonb;
  part text; free int; quantity int; ledger_count int; uid uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  for c in select id,user_id,data from public.characters for update loop
    insert into public.equipment_modular_migrations(scope,owner,original) values('character',c.id,c.data) on conflict do nothing;
    get diagnostics ledger_count=row_count;
    if ledger_count=0 or coalesce((c.data->>'modularEquipmentVersion')::int,0)>=1 then continue;end if;
    inv:=public.game_inventory(c.data);equipment:=coalesce(c.data->'equipment','{}'::jsonb);extras:='[]'::jsonb;
    -- Only IDs of the previous 50 full outfits qualify, not new head/hand/leg/foot pieces.
    for entry in select value from jsonb_array_elements(inv) union all select equipment->'chest' loop
      if jsonb_typeof(entry) is distinct from 'object' or coalesce(entry->>'id','') !~ '^traje_(guerrero|mago|picaro|clerigo|explorador)_(artesano|ambar|violeta|aurora|fuego|alba|eclipse|roble|marea|forja)$' then continue;end if;
      for quantity in 1..greatest(1,(entry->>'count')::int) loop
        foreach part in array array['hands','legs','feet'] loop
          item:=jsonb_build_object('id',(entry->>'id')||'_'||part,'count',1,'bound',coalesce((entry->>'bound')::boolean,false));
          if entry=equipment->'chest' and quantity=1 and jsonb_typeof(equipment->part) is distinct from 'object' then
            equipment:=jsonb_set(equipment,array[part],item);
          else extras:=extras||jsonb_build_array(item);end if;
        end loop;
      end loop;
    end loop;
    for item in select value from jsonb_array_elements(extras) loop
      select i into free from generate_series(0,24)i where jsonb_typeof(inv->i) is distinct from 'object' order by i limit 1;
      if free is not null then inv:=jsonb_set(inv,array[free::text],item);
      else insert into public.equipment_modular_deliveries(user_id,items) values(c.user_id,jsonb_build_array(item))
        on conflict(user_id) do update set items=public.equipment_modular_deliveries.items||excluded.items;
      end if;
    end loop;
    update public.characters set data=c.data||jsonb_build_object('equipment',equipment,'inventory',inv,'modularEquipmentVersion',1),updated_at=now() where id=c.id;
  end loop;
  for b in select user_id,items from public.account_banks for update loop
    insert into public.equipment_modular_migrations(scope,owner,original) values('bank',b.user_id,b.items) on conflict do nothing;
    get diagnostics ledger_count=row_count;if ledger_count=0 then continue;end if;
    extras:='[]'::jsonb;
    for entry in select value from jsonb_array_elements(b.items) loop
      if jsonb_typeof(entry) is distinct from 'object' or coalesce(entry->>'id','') !~ '^traje_(guerrero|mago|picaro|clerigo|explorador)_(artesano|ambar|violeta|aurora|fuego|alba|eclipse|roble|marea|forja)$' then continue;end if;
      for quantity in 1..greatest(1,(entry->>'count')::int) loop
        foreach part in array array['hands','legs','feet'] loop
          extras:=extras||jsonb_build_array(jsonb_build_object('id',(entry->>'id')||'_'||part,'count',1,'bound',coalesce((entry->>'bound')::boolean,false)));
        end loop;
      end loop;
    end loop;
    if jsonb_array_length(extras)>0 then
      insert into public.equipment_modular_deliveries(user_id,items) values(b.user_id,extras)
      on conflict(user_id) do update set items=public.equipment_modular_deliveries.items||excluded.items;
    end if;
  end loop;
  for uid in select user_id from public.equipment_modular_deliveries loop perform public.game_deliver_modular_parts(uid);end loop;
end $$;
