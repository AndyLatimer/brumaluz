-- Legwear now includes footwear. Preserve every owned item: an obsolete boot
-- becomes a complete legwear item. An equipped boot is moved to the bag/bank if
-- the leg slot is already occupied. Snapshots and pending deliveries are retained.
create or replace function public.game_combined_legwear_stack(p_item jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare candidate text; meta jsonb;
begin
  if jsonb_typeof(p_item) is distinct from 'object' then return p_item; end if;
  if coalesce(p_item->>'id','') !~ '^traje_(guerrero|mago|picaro|clerigo|explorador)_[a-z]+_feet$' then return p_item; end if;
  candidate:=regexp_replace(p_item->>'id','_feet$','_legs');
  meta:=public.game_equipment_item(candidate);
  if meta->>'slot'='legs' then return jsonb_set(p_item,'{id}',to_jsonb(candidate)); end if;
  return p_item;
end $$;
create or replace function public.game_combined_legwear_slots(p_items jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg(public.game_combined_legwear_stack(value) order by n),'[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_items)='array' then p_items else '[]'::jsonb end) with ordinality a(value,n)
$$;
revoke all on function public.game_combined_legwear_stack(jsonb), public.game_combined_legwear_slots(jsonb)
  from public,anon,authenticated;

do $$
declare
  c record; b record; pending record; inv jsonb; equipment jsonb; boot jsonb;
  converted jsonb; placed jsonb; changed jsonb; meta jsonb;
  old_resource_max int; old_resource int; old_raw_resource int;
  migrated boolean:=false; uid uuid;
begin
  -- Same serialization order as bank, trade and equipment changes.
  perform pg_catalog.pg_advisory_xact_lock(731029,3);

  for b in select * from public.account_banks for update loop
    converted:=public.game_combined_legwear_slots(b.items);
    if converted is distinct from b.items then
      insert into public.equipment_modular_migrations(scope,owner,original)
        values('legwear-v2-bank',b.user_id,to_jsonb(b)) on conflict do nothing;
      update public.account_banks set items=converted,updated_at=now() where user_id=b.user_id;
      migrated:=true;
    end if;
  end loop;
  for pending in select * from public.equipment_modular_deliveries for update loop
    converted:=public.game_combined_legwear_slots(pending.items);
    if converted is distinct from pending.items then
      insert into public.equipment_modular_migrations(scope,owner,original)
        values('legwear-v2-delivery',pending.user_id,pending.items) on conflict do nothing;
      update public.equipment_modular_deliveries set items=converted where user_id=pending.user_id;
      migrated:=true;
    end if;
  end loop;

  for c in select id,user_id,data from public.characters for update loop
    if coalesce((c.data->>'modularEquipmentVersion')::int,0)>=2 then continue; end if;
    insert into public.equipment_modular_migrations(scope,owner,original)
      values('legwear-v2-character',c.id,c.data) on conflict do nothing;
    inv:=public.game_combined_legwear_slots(public.game_inventory(c.data));
    equipment:=coalesce(c.data->'equipment','{}'::jsonb);
    boot:=equipment->'feet';

    -- Calculate the previous reserve using old footwear, not the new leg bonus.
    old_resource_max:=(public.game_public_vitals(jsonb_set(c.data,'{equipment}',equipment-'legs'))->>'maxResource')::int;
    converted:=public.game_combined_legwear_stack(boot);
    meta:=public.game_equipment_item(converted->>'id');
    if jsonb_typeof(boot)='object' and boot->>'count'='1' and meta->>'slot'='legs'
      and meta->>'cls'=c.data->>'cls' then
      old_resource_max:=old_resource_max+coalesce((meta->>'maxResource')::int,0);
    end if;
    old_raw_resource:=coalesce((c.data->>'resource')::int,-1);
    old_resource:=case when old_raw_resource<0 then old_resource_max else least(old_raw_resource,old_resource_max) end;

    if jsonb_typeof(boot)='object' then
      if jsonb_typeof(equipment->'legs') is distinct from 'object' and converted->>'count'='1'
        and meta->>'slot'='legs' and meta->>'cls'=c.data->>'cls' then
        equipment:=jsonb_set(equipment,'{legs}',converted);
      else
        placed:=public.game_stack_into(inv,converted);
        if placed is not null then inv:=placed;
        else
          insert into public.equipment_modular_deliveries(user_id,items) values(c.user_id,jsonb_build_array(converted))
            on conflict(user_id) do update set items=public.equipment_modular_deliveries.items||excluded.items;
        end if;
      end if;
    end if;
    equipment:=equipment-'feet';
    changed:=c.data||jsonb_build_object('inventory',inv,'equipment',equipment,'modularEquipmentVersion',2);
    changed:=changed||jsonb_build_object('resource',least(old_resource,(public.game_public_vitals(changed)->>'maxResource')::int));
    update public.characters set data=changed,updated_at=now() where id=c.id;
    migrated:=true;
  end loop;

  if migrated then
    update public.player_trades set status='cancelled',reason='TRADE_CHANGED',revision=revision+1,
      accepted_a=false,accepted_b=false where status in ('invited','open');
  end if;
  -- This expands banks only up to their existing limit; any overflow remains queued.
  for uid in select user_id from public.equipment_modular_deliveries loop
    perform public.game_deliver_modular_parts(uid);
  end loop;
end $$;
