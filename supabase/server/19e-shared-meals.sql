-- Supervised cooking: snapshots, contribution ledger and deferred refunds.
alter table public.cozy_projects add column if not exists owner_id uuid;
alter table public.cozy_projects add column if not exists menu jsonb;
alter table public.cozy_projects add column if not exists last_pulse numeric;
alter table public.cozy_projects add column if not exists remaining numeric not null default 1800;
alter table public.cozy_projects add column if not exists complete_at numeric;
alter table public.cozy_projects add column if not exists canceled_at numeric;
alter table public.cozy_projects add column if not exists ledger jsonb not null default '[]';
create index if not exists cozy_projects_owner on public.cozy_projects(owner_id);
create index if not exists cozy_projects_scope on public.cozy_projects(scope);
create index if not exists cozy_projects_contributors on public.cozy_projects using gin(contributors);
-- The previous prototype used one project per scope. Multiple preparations are approved.
alter table public.cozy_projects drop constraint if exists cozy_projects_scope_key;
create table if not exists public.cozy_refunds(project_id uuid not null,recipient uuid not null references public.characters(id) on delete cascade,sequence int not null,item jsonb not null,primary key(project_id,recipient,sequence));
alter table public.cozy_refunds enable row level security;
revoke all on table public.cozy_refunds from public,anon,authenticated;

create table if not exists public.meal_daily_menus(character_id uuid not null references public.characters(id) on delete cascade,day text not null,rank int not null,menu jsonb not null,primary key(character_id,day,rank));
alter table public.meal_daily_menus enable row level security;
revoke all on table public.meal_daily_menus from public,anon,authenticated;
create or replace function public.game_meal_menu(cid uuid,d jsonb,stamp numeric) returns jsonb language plpgsql volatile security definer set search_path='' as $$
<<menus>>
declare pool jsonb;result jsonb:='[]';cached jsonb;i int;offset_at int;rank int:=public.game_rpg_rank(d->'rpg','cocina');day text:=to_char(to_timestamp(stamp) at time zone 'UTC','YYYY-MM-DD');
begin
 select m.menu into cached from public.meal_daily_menus m where m.character_id=cid and m.day=menus.day and m.rank=menus.rank;
 if cached is not null then return cached;end if;
 delete from public.meal_daily_menus where character_id=cid and meal_daily_menus.day<to_char((to_timestamp(stamp) at time zone 'UTC')-interval '7 days','YYYY-MM-DD');
 select jsonb_agg(value order by key collate "C") into pool from jsonb_each(public.game_rpg_catalog()->'meals') where (value->>'tier')::int=rank;
 if pool is null then return result;end if;
 offset_at:=(public.game_cozy_hash(cid::text)+floor(stamp/86400)::bigint*3)%jsonb_array_length(pool);
 for i in 0..least(2,jsonb_array_length(pool)-1) loop result:=result||jsonb_build_array(pool->((offset_at+i)%jsonb_array_length(pool)));end loop;
 insert into public.meal_daily_menus(character_id,day,rank,menu) values(cid,menus.day,menus.rank,result) on conflict do nothing;
 select m.menu into result from public.meal_daily_menus m where m.character_id=cid and m.day=menus.day and m.rank=menus.rank;
 return result;
end $$;
create or replace function public.game_meal_cancel(project uuid,stamp numeric) returns void language plpgsql volatile security definer set search_path='' as $$
declare p public.cozy_projects;entry record;
begin
 select * into p from public.cozy_projects where id=project for update;
 if p.id is null or p.complete_at is not null or p.canceled_at is not null or p.menu is null then return;end if;
 update public.cozy_projects set canceled_at=stamp where id=project;
 for entry in select value,ordinality from jsonb_array_elements(p.ledger) with ordinality loop
  insert into public.cozy_refunds(project_id,recipient,sequence,item) values(project,(entry.value->>'character')::uuid,entry.ordinality,entry.value->'item') on conflict do nothing;
 end loop;
end $$;
create or replace function public.game_meals_tick(stamp numeric,cid uuid) returns void language plpgsql volatile security definer set search_path='' as $$
declare p public.cozy_projects;party uuid;active_until numeric;elapsed numeric;left_time numeric;
begin
 select party_id into party from public.party_members where character_id=cid;
 for p in select * from public.cozy_projects where menu is not null and complete_at is null and canceled_at is null
  and (owner_id=cid or contributors ? cid::text or scope='party:'||party::text) order by id for update loop
  if p.scope like 'party:%' and not exists(select 1 from public.parties where id=substr(p.scope,7)::uuid) then perform public.game_meal_cancel(p.id,stamp);continue;end if;
  select max(least(stamp,extract(epoch from w.seen_at)+15)) into active_until from public.world_players w
   where w.character_id=p.owner_id or p.contributors ? w.character_id::text or exists(select 1 from public.party_members pm where pm.character_id=w.character_id and 'party:'||pm.party_id::text=p.scope);
  elapsed:=greatest(0,coalesce(active_until,p.last_pulse)-coalesce(p.last_pulse,stamp));left_time:=greatest(0,p.remaining-elapsed);
  update public.cozy_projects set remaining=left_time,last_pulse=stamp where id=p.id;
  if left_time=0 then perform public.game_meal_cancel(p.id,stamp);end if;
 end loop;
end $$;
create or replace function public.game_meal_mail(cid uuid,d jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r record;s jsonb:=coalesce(d->'rpg','{}');deliveries jsonb:=coalesce(s->'deliveries','[]');
begin
 for r in select * from public.cozy_refunds where recipient=cid order by project_id,sequence for update loop
  deliveries:=deliveries||jsonb_build_array(r.item);delete from public.cozy_refunds where project_id=r.project_id and recipient=cid and sequence=r.sequence;
 end loop;
 return d||jsonb_build_object('rpg',s||jsonb_build_object('deliveries',deliveries));
end $$;
create or replace function public.game_presence_cozy_clock() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare stamp numeric:=extract(epoch from clock_timestamp());elapsed numeric;
begin
 if TG_OP<>'INSERT' then
  perform public.game_meals_tick(stamp,old.character_id);
  elapsed:=greatest(0,least(case when TG_OP='DELETE' then stamp else extract(epoch from new.seen_at) end,extract(epoch from old.seen_at)+15)-extract(epoch from old.seen_at));
  if exists(select 1 from public.characters c cross join lateral jsonb_array_elements(coalesce(c.data->'rpg'->'jobs','[]')) j where c.id=old.character_id and not coalesce((j->>'done')::boolean,false)) then
   insert into public.craft_activity(character_id,online_seconds) values(old.character_id,elapsed) on conflict(character_id) do update set online_seconds=public.craft_activity.online_seconds+excluded.online_seconds;
  end if;
 end if;
 if TG_OP<>'DELETE' then
  if TG_OP='INSERT' or new.character_id is distinct from old.character_id then perform public.game_meals_tick(stamp,new.character_id);end if;
  return new;
 end if;
 return old;
end $$;
drop trigger if exists presence_cozy_clock on public.world_players;
create trigger presence_cozy_clock before insert or update of seen_at,character_id or delete on public.world_players for each row execute function public.game_presence_cozy_clock();
create or replace function public.game_party_cancel_meals() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare p record;begin
 for p in select id from public.cozy_projects where scope='party:'||old.id::text and complete_at is null and canceled_at is null and menu is not null order by id loop perform public.game_meal_cancel(p.id,extract(epoch from clock_timestamp()));end loop;
 return old;
end $$;
drop trigger if exists party_cancel_meals on public.parties;
create trigger party_cancel_meals before delete on public.parties for each row execute function public.game_party_cancel_meals();

create or replace function public.game_meal_action(cid uuid,d jsonb,action text,args jsonb,pos jsonb,stamp numeric) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p public.cozy_projects;party uuid;scope_id text;leader uuid;teacher jsonb:=public.game_rpg_catalog()->'teachers'->'cocina';cfg jsonb;day text:=to_char(to_timestamp(stamp) at time zone 'UTC','YYYY-MM-DD');s jsonb:=d->'rpg';q jsonb;inv jsonb;item jsonb;consumed jsonb;idx int;needed int;amount int;entry record;rewardable boolean;done boolean;
begin
 if args->>'master' is distinct from teacher->>'id' or d->>'location' is distinct from teacher->>'location' or sqrt(power((pos->>'x')::numeric-(teacher->>'x')::numeric,2)+power((pos->>'z')::numeric-(teacher->>'z')::numeric,2))>3 then raise exception 'Habla con el maestro de Cocina.';end if;
 perform public.game_meals_tick(stamp,cid);d:=public.game_meal_mail(cid,d);s:=d->'rpg';
 select party_id into party from public.party_members where character_id=cid;scope_id:=coalesce('party:'||party::text,'character:'||cid::text);
 q:=case when s->'mealQuota'->>'day'=day then s->'mealQuota' else jsonb_build_object('day',day,'completed',0) end;
 if action='meal_start' then
  if party is not null then select character_id into leader from public.party_members where party_id=party order by entry_order limit 1;if leader<>cid then raise exception 'El líder elige la receta de su menú.';end if;end if;
  if (select count(*) from public.cozy_projects where menu is not null and canceled_at is null and complete_at is null and (owner_id=cid or contributors ? cid::text))>=3 then raise exception 'Ya tienes tres preparaciones pendientes.';end if;
  select value into cfg from jsonb_array_elements(public.game_meal_menu(cid,d,stamp)) where value->>'id'=args->>'id';
  if cfg is null then raise exception 'Elige una receta de tu menú de hoy.';end if;
  cfg:=cfg||jsonb_build_object('pelines',(cfg->>'difficulty')::int*10,'xp',(cfg->>'difficulty')::int*5,'count',1);
  insert into public.cozy_projects(scope,owner_id,menu,last_pulse) values(scope_id,cid,cfg,stamp);
 elsif action in('neighbor_contribute','meal_contribute') then
  select * into p from public.cozy_projects where id=(args->>'project')::uuid for update;
  if p.id is null or p.scope<>scope_id or p.canceled_at is not null or p.complete_at is not null then raise exception 'Preparación no disponible.';end if;
  if not(p.contributors ? cid::text) and p.owner_id<>cid and (select count(*) from public.cozy_projects where menu is not null and canceled_at is null and complete_at is null and (owner_id=cid or contributors ? cid::text))>=3 then raise exception 'Ya tienes tres preparaciones pendientes.';end if;
  needed:=(p.menu->'ingredients'->>(args->>'id'))::int;
  if needed is null or coalesce((p.ingredients->>(args->>'id'))::int,0)>=needed then raise exception 'Este ingrediente ya está completo o no forma parte de la receta.';end if;
  rewardable:=coalesce((q->>'completed')::int,0)<2;
  if not rewardable and not coalesce((args->>'help')::boolean,false) then raise exception 'Ya has cobrado dos meriendas. Confirma que quieres ayudar sin recompensa.';end if;
  inv:=public.game_inventory(d);
  for idx in 0..24 loop item:=inv->idx;if item->>'id'=args->>'id' and not coalesce((item->>'bound')::boolean,false) then consumed:=item||'{"count":1}';inv:=jsonb_set(inv,array[idx::text],case when (item->>'count')::int=1 then 'null'::jsonb else item||jsonb_build_object('count',(item->>'count')::int-1) end);exit;end if;end loop;
  if consumed is null then raise exception 'Falta el ingrediente en la mochila.';end if;
  p.ingredients:=jsonb_set(p.ingredients,array[args->>'id'],to_jsonb(coalesce((p.ingredients->>(args->>'id'))::int,0)+1));
  done:=not exists(select 1 from jsonb_each_text(p.menu->'ingredients') where coalesce((p.ingredients->>key)::int,0)<value::int);
  update public.cozy_projects set ingredients=p.ingredients,contributors=case when contributors ? cid::text then contributors else contributors||jsonb_build_array(cid) end,
   ledger=ledger||jsonb_build_array(jsonb_build_object('character',cid,'item',consumed,'rewardable',rewardable)),remaining=1800,last_pulse=stamp,complete_at=case when done then stamp end where id=p.id;
  d:=d||jsonb_build_object('inventory',inv);
 elsif action in('neighbor_claim','meal_claim') then
  select * into p from public.cozy_projects where id=(args->>'id')::uuid for update;
  if p.id is null or p.complete_at is null or p.canceled_at is not null or p.claimed ? cid::text or not(p.contributors ? cid::text) then raise exception 'No tienes recompensa pendiente de esta preparación.';end if;
  if stamp>=p.complete_at+604800 then raise exception 'La recompensa ha caducado tras siete días.';end if;
  if coalesce((q->>'completed')::int,0)>=2 then raise exception 'Ya has cobrado dos meriendas hoy.';end if;
  if not exists(select 1 from jsonb_array_elements(p.ledger) where value->>'character'=cid::text and (value->>'rewardable')::boolean) then raise exception 'Esta aportación era ayuda sin recompensa.';end if;
  d:=public.game_rpg_give(d,public.game_rpg_new_item(p.menu->>'output',coalesce((p.menu->>'count')::int,1)),true);s:=d->'rpg';
  d:=public.game_set_pelines(d,public.game_pelines(d)+(p.menu->>'pelines')::int);
  s:=jsonb_set(s,array['xp','cocina'],to_jsonb(coalesce((s->'xp'->>'cocina')::int,0)+(p.menu->>'xp')::int));
  s:=s||jsonb_build_object('mealQuota',q||jsonb_build_object('completed',coalesce((q->>'completed')::int,0)+1));d:=d||jsonb_build_object('rpg',s);
  update public.cozy_projects set claimed=claimed||jsonb_build_array(cid) where id=p.id;
 else raise exception 'No se permite cancelar manualmente una merienda.';end if;
 return d;
end $$;
create or replace function public.game_meal_view(cid uuid,stamp numeric) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'active',p.canceled_at is null and p.complete_at is null,'ingredients',p.ingredients,'recipe',p.menu,'remaining',p.remaining,'complete',p.complete_at is not null,'expiresAt',p.complete_at+604800,'contributors',jsonb_array_length(p.contributors),'contributed',p.contributors ? cid::text,'claimed',p.claimed ? cid::text,'rewardable',exists(select 1 from jsonb_array_elements(p.ledger) where value->>'character'=cid::text and (value->>'rewardable')::boolean)) order by p.id),'[]')
 from public.cozy_projects p where p.menu is not null and p.canceled_at is null and (p.complete_at is null or stamp<p.complete_at+604800) and
 (p.owner_id=cid or p.contributors ? cid::text or exists(select 1 from public.party_members pm where pm.character_id=cid and p.scope='party:'||pm.party_id::text))
$$;
revoke all on function public.game_meal_cancel(uuid,numeric),public.game_meals_tick(numeric,uuid),public.game_meal_mail(uuid,jsonb),public.game_presence_cozy_clock(),public.game_party_cancel_meals(),public.game_meal_action(uuid,jsonb,text,jsonb,jsonb,numeric),public.game_meal_view(uuid,numeric),public.game_meal_menu(uuid,jsonb,numeric) from public,anon,authenticated;

-- An automatic offline cleanup must not dissolve a paused cooking group.
-- Explicitly leaving/disbanding still follows the normal party rules.
create or replace function public.game_party_cleanup() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(731029,2);
 delete from public.party_responses where created_at<=now()-interval '5 minutes';
 delete from public.party_members m where not exists(select 1 from public.world_players w where w.user_id=m.user_id and w.character_id=m.character_id and w.seen_at>now()-interval '15 seconds')
  and not exists(select 1 from public.cozy_projects p where p.scope='party:'||m.party_id::text and p.menu is not null and p.complete_at is null and p.canceled_at is null);
 delete from public.party_invites i where i.expires_at<=now() or exists(select 1 from public.party_members m where m.user_id=i.target_user)
  or not exists(select 1 from public.world_players w where w.user_id=i.target_user and w.seen_at>now()-interval '15 seconds');
 delete from public.parties p where not exists(select 1 from public.party_members m where m.party_id=p.id);
end $$;
revoke all on function public.game_party_cleanup() from public,anon,authenticated;
