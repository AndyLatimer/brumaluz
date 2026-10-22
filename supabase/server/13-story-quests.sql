create or replace function public.loot_corpse(p_character_id uuid,p_instance_id text,p_slot int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters; encounter jsonb; loot jsonb; pos jsonb; entry jsonb; i int; n int;
begin
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  c:=public.game_lock_character(p_character_id);
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD'; end if;
  encounter:=c.data->'combatEncounter'; loot:=encounter->'loot';
  if encounter->>'status' is distinct from 'defeated'
    or p_instance_id is null or encounter->>'instanceId' is distinct from p_instance_id
    then raise exception 'LOOT_INVALID'; end if;
  if encounter->>'looted'='true' or jsonb_typeof(loot) is distinct from 'array' or jsonb_array_length(loot)=0
    then raise exception 'LOOT_EMPTY'; end if;
  if p_slot is not null and (p_slot<0 or p_slot>=jsonb_array_length(loot) or loot->p_slot='null'::jsonb)
    then raise exception 'LOOT_INVALID'; end if;
  select position into pos from public.world_players where character_id=c.id and user_id=c.user_id
    and seen_at>now()-interval '15 seconds' for update;
  if pos is null or coalesce(c.data->>'location','brumaluz')<>'brumaluz'
    then raise exception 'COMBAT_NOT_PLAYING'; end if;
  if sqrt(power((pos->>'x')::numeric-(encounter->>'x')::numeric,2)
    +power((pos->>'z')::numeric-(encounter->>'z')::numeric,2))>3 then raise exception 'LOOT_TOO_FAR'; end if;
  for i in 0..jsonb_array_length(loot)-1 loop
    if p_slot is not null and i<>p_slot then continue; end if;
    entry:=loot->i;
    if jsonb_typeof(entry)<>'object' then continue; end if;
    for n in 1..(entry->>'count')::int loop c.data:=public.game_add_item(c.data,entry->>'id'); end loop;
    loot:=jsonb_set(loot,array[i::text],'null'::jsonb);
  end loop;
  encounter:=encounter||jsonb_build_object('loot',loot,'looted',not exists(select 1 from jsonb_array_elements(loot) x where jsonb_typeof(x)='object'));
  c.data:=c.data||jsonb_build_object('combatEncounter',encounter);
  return public.game_store(c.id,c.data);
end $$;
revoke all on function public.loot_corpse(uuid,text,int) from public,anon;
grant execute on function public.loot_corpse(uuid,text,int) to authenticated;

-- Preserve pre-loot defeated encounters as recoverable bodies, without resetting any completed loot.
update public.characters set data=data||jsonb_build_object('shadowQuest','active')
where data->'combatEncounter'->>'status' in ('active','failed','fled') and not (data ? 'shadowQuest');
update public.characters set data=data||jsonb_build_object(
  'shadowQuest','defeated','combatEncounter',data->'combatEncounter'||jsonb_build_object(
    'instanceId',gen_random_uuid()::text,'looted',false,
    'loot',jsonb_build_array(jsonb_build_object('id','esencia_sombria','count',1,'bound',true))))
where data->'combatEncounter'->>'status'='defeated' and not (data->'combatEncounter' ? 'loot')
  and data->>'shadowQuest' is distinct from 'completed';

-- Older releases ended the story on looting. Keep the exhausted body and unlock the new closing scene.
update public.characters set data=data||jsonb_build_object('shadowQuest','defeated')
where data->>'shadowQuest'='completed';

create or replace function public.shadow_action(p_character_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters:=public.game_lock_character(p_character_id);
  pos jsonb;
begin
  if c.data->'welcome'->>'stage' is distinct from 'completed' then raise exception 'WELCOME_REQUIRED'; end if;
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD'; end if;
  if p_action is null or p_action not in ('report','return') then raise exception 'SHADOW_INVALID_ACTION'; end if;
  if (p_action='report' and (c.data->>'shadowQuest' is distinct from 'defeated'
      or c.data->'combatEncounter'->>'status' is distinct from 'defeated'))
    or (p_action='return' and c.data->>'shadowQuest' is distinct from 'returning')
    then raise exception 'SHADOW_INVALID_STATE'; end if;
  select position into pos from public.world_players where character_id=c.id and user_id=c.user_id
    and seen_at>now()-interval '15 seconds' for update;
  if pos is null then raise exception 'COMBAT_NOT_PLAYING'; end if;
  -- 'report': Isberto acude junto al jugador tras registrar los restos y le invita a su casa.
  -- 'return': ya dentro de la casa, Isberto le enseña la cama y el cofre.
  -- Encerrar CASE evita que el lector de IF de PL/pgSQL se detenga en su THEN interior.
  if coalesce(c.data->>'location','brumaluz')<>(case when p_action='report' then 'brumaluz' else 'casa_de_isberto_interior' end)
    then raise exception 'SHADOW_TOO_FAR'; end if;
  if p_action='report' then
    if c.data->'combatEncounter'->>'looted' is distinct from 'true'
      or exists(select 1 from jsonb_array_elements(coalesce(c.data->'combatEncounter'->'loot','[]'::jsonb)) x where jsonb_typeof(x)='object')
      then raise exception 'SHADOW_LOOT_REQUIRED'; end if;
    if power((pos->>'x')::numeric-(c.data->'combatEncounter'->>'x')::numeric,2)
      +power((pos->>'z')::numeric-(c.data->'combatEncounter'->>'z')::numeric,2)>64
      then raise exception 'SHADOW_TOO_FAR'; end if;
  elsif power((pos->>'x')::numeric-.9,2)+power((pos->>'z')::numeric-.55,2)>16
    then raise exception 'SHADOW_TOO_FAR';
  end if;
  return public.game_store(c.id,c.data||jsonb_build_object('shadowQuest',case when p_action='report' then 'returning' else 'returned' end));
end $$;
revoke all on function public.shadow_action(uuid,text) from public,anon;
grant execute on function public.shadow_action(uuid,text) to authenticated;

-- Descansar en la cama de Isberto: vida y recurso al máximo (HOUSE_BED y BED_RADIUS en src/data/quests.ts).
create or replace function public.rest_action(p_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters:=public.game_lock_character(p_character_id);
  pos jsonb;
begin
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD'; end if;
  if c.data->'combatEncounter'->>'status'='active'
    and coalesce((c.data->'combatEncounter'->>'engaged')::boolean,
      (c.data->'combatEncounter'->>'health')::numeric<(c.data->'combatEncounter'->>'maxHealth')::numeric,false)
    then raise exception 'IN_COMBAT'; end if;
  if coalesce(c.data->>'location','brumaluz')<>'casa_de_isberto_interior' or not public.game_isberto_house_open(c.data)
    then raise exception 'REST_UNAVAILABLE'; end if;
  select position into pos from public.world_players where character_id=c.id and user_id=c.user_id
    and seen_at>now()-interval '15 seconds' for update;
  if pos is null then raise exception 'COMBAT_NOT_PLAYING'; end if;
  if sqrt(power((pos->>'x')::numeric+1.5,2)+power((pos->>'z')::numeric+2.5,2))>2.2 then raise exception 'REST_TOO_FAR'; end if;
  return public.game_store(c.id,c.data||jsonb_build_object('health',-1,'resource',-1,'health_regen',0,'resource_regen',0));
end $$;
revoke all on function public.rest_action(uuid) from public,anon;
grant execute on function public.rest_action(uuid) to authenticated;

-- Internal prerequisite for subsequent story content; legacy characters are exempt.
create or replace function public.game_require_welcome_complete(d jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(d->'welcome')='object' and d->'welcome'->>'stage' is distinct from 'completed'
    then raise exception 'WELCOME_REQUIRED'; end if;
end $$;
revoke all on function public.game_require_welcome_complete(jsonb) from public,anon,authenticated;

create or replace function public.welcome_action(p_character_id uuid,p_action text,p_origin int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters:=public.game_lock_character(p_character_id);
  d jsonb:=c.data; q jsonb:=d->'welcome'; stage text:=q->>'stage'; pos jsonb;
  lvl int:=public.game_level(d); xp int:=greatest(coalesce((d->>'experience')::int,0),0);
begin
  if not exists(select 1 from public.server_config where key='welcome_enabled' and value='true')
    then raise exception 'ACTION_DISABLED'; end if;
  if jsonb_typeof(q) is distinct from 'object' then raise exception 'WELCOME_UNAVAILABLE'; end if;
  if coalesce((d->>'health')::int,-1)=0 then raise exception 'WELCOME_DEAD'; end if;
  select position into pos from public.world_players where character_id=c.id and user_id=c.user_id
    and seen_at>now()-interval '15 seconds' for update;
  if pos is null or coalesce(d->>'location','brumaluz')<>'brumaluz' then raise exception 'WELCOME_NOT_PLAYING'; end if;
  -- La entrada termina siempre en el mismo punto; el cliente no elige coordenadas.
  -- El rango admite también personajes creados con el antiguo punto de aparición (164,0).
  if p_action='arrive' then
    if d->>'introSeen'='true' then return d; end if;
    if stage<>'available' or q->>'origin' is not null then raise exception 'WELCOME_INVALID_STATE'; end if;
    if power((pos->>'x')::numeric-177,2)+power((pos->>'z')::numeric,2)>676 then raise exception 'WELCOME_TOO_FAR'; end if;
    pos:=jsonb_build_object('x',156.5,'z',0,'yaw',pi()/2);
    update public.world_players set position=pos,facing=3*pi()/2,movement_credit=3,seen_at=now(),saved_at=now()
      where character_id=c.id and user_id=c.user_id;
    return public.game_store(c.id,d||jsonb_build_object('introSeen',true,'position',pos));
  end if;
  -- Gnomi espera recién cruzada la Puerta del Este (WELCOME_START en src/data/quests.ts).
  if p_action in ('origin','accept') and
    power((pos->>'x')::numeric-153.5,2)+power((pos->>'z')::numeric,2)>36
    then raise exception 'WELCOME_TOO_FAR'; end if;
  if p_action='origin' then
    if stage<>'available' or q->>'origin' is not null or p_origin is null or p_origin not between 0 and 2
      then raise exception 'WELCOME_INVALID_STATE'; end if;
    q:=q||jsonb_build_object('origin',p_origin);
    d:=d||jsonb_build_object('introSeen',true);
  elsif p_action='accept' then
    if stage<>'available' or q->>'origin' is null then raise exception 'WELCOME_INVALID_STATE'; end if;
    q:=q||jsonb_build_object('stage','active');
  elsif p_action='collect' then
    if stage<>'active' then raise exception 'WELCOME_INVALID_STATE'; end if;
    -- Junto al mercado de la plaza del Levante (WELCOME_BADGE).
    if power((pos->>'x')::numeric-138.6,2)+power((pos->>'z')::numeric+2.6,2)>9
      then raise exception 'WELCOME_TOO_FAR'; end if;
    q:=q||jsonb_build_object('stage','found');
  elsif p_action='claim' then
    if stage<>'found' then raise exception 'WELCOME_INVALID_STATE'; end if;
    q:=q||jsonb_build_object('stage','completed');
    d:=d||jsonb_build_object('isbertoPosition',jsonb_build_object('x',(pos->>'x')::numeric+2,'z',(pos->>'z')::numeric));
    if lvl<50 then
      xp:=xp+40;
      while lvl<50 and xp>=public.game_xp_needed(lvl) loop
        xp:=xp-public.game_xp_needed(lvl); lvl:=lvl+1;
      end loop;
      if lvl>=50 then xp:=public.game_xp_needed(50); end if;
    end if;
    d:=public.game_set_pelines(d,public.game_pelines(d)+5)||jsonb_build_object('level',lvl,'experience',xp);
  else raise exception 'WELCOME_INVALID_ACTION';
  end if;
  return public.game_store(c.id,d||jsonb_build_object('welcome',q));
end $$;
revoke all on function public.welcome_action(uuid,text,int) from public,anon;
grant execute on function public.welcome_action(uuid,text,int) to authenticated;

