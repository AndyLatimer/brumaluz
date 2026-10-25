create or replace function public.combat_start(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.characters;
  w public.world_players;
  site jsonb := (select value from public.server_config where key='combat_site');
  sx numeric := (site->>'x')::numeric;
  sz numeric := (site->>'z')::numeric;
  stamp numeric := extract(epoch from clock_timestamp());
  encounter jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  c:=public.game_lock_character(p_character_id);
  if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) then
    raise exception 'COMBAT_UNAVAILABLE';
  end if;
  if c.data->'welcome'->>'stage' is distinct from 'completed' then
    raise exception 'WELCOME_REQUIRED';
  end if;
  select * into w from public.world_players where user_id=uid and character_id=c.id
    and seen_at>now()-interval '15 seconds' for update;
  if not found then raise exception 'COMBAT_NOT_PLAYING'; end if;
  if coalesce(c.data->>'location','brumaluz')<>'brumaluz'
    or sqrt(power((w.position->>'x')::numeric-coalesce((c.data->'isbertoPosition'->>'x')::numeric,sx),2)
      +power((w.position->>'z')::numeric-coalesce((c.data->'isbertoPosition'->>'z')::numeric,sz),2))>6 then
    raise exception 'COMBAT_TOO_FAR';
  end if;
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD'; end if;
  if c.data->'combatEncounter'->>'status'='active' then raise exception 'COMBAT_ALREADY_ACTIVE'; end if;
  if c.data->'combatEncounter'->>'status'='defeated' and c.data->'combatEncounter'->>'looted' is distinct from 'true'
    then raise exception 'LOOT_PENDING'; end if;
  if c.data->>'shadowQuest' in ('completed','returned') then raise exception 'SHADOW_QUEST_COMPLETED'; end if;
  if c.data->>'shadowQuest' in ('defeated','returning') then raise exception 'SHADOW_ALREADY_DEFEATED'; end if;
  encounter:=jsonb_build_object(
    'id','shadowling','status','active','engaged',false,'health',(public.game_shadow_combat_config()->>'health')::int,'maxHealth',(public.game_shadow_combat_config()->>'health')::int,
    'instanceId',gen_random_uuid()::text,'loot','[]'::jsonb,'looted',false,
    'x',sx+3.5,'z',sz,'enemyAttackAt',stamp+2
  );
  c.data:=c.data||jsonb_build_object('combatEncounter',encounter,'shadowQuest','active');
  c.data:=public.game_store(c.id,c.data);
  return jsonb_build_object(
    'encounter',encounter,'vitals',public.game_public_vitals(c.data),
    'damage',0,'healing',0,'quest',c.data->>'shadowQuest'
  );
end;
$$;

create or replace function public.combat_action(p_character_id uuid,p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.characters;
  w public.world_players;
  encounter jsonb;
  cls text;
  skill_id text;
  skill boolean;
  healing boolean;
  stamp numeric := extract(epoch from clock_timestamp());
  distance numeric;
  attack_range numeric;
  cadence numeric;
  damage int;
  cost int := 0;
  cooldown numeric := 0;
  resource int;
  hp int;
  enemy_hp int;
  hits int;
  each_hit int;
  total_damage int := 0;
  healed int := 0;
  skill_rank int;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  c:=public.game_lock_character(p_character_id);
  encounter:=c.data->'combatEncounter';
  cls:=c.data->>'cls';
  skill_id:=public.game_skill_id(cls);
  skill_rank:=public.game_skill_rank(c.data);
  skill:=p_action='skill' or p_action=skill_id;
  healing:=cls='clerigo' and skill;
  if p_action is null or (p_action not in ('attack','skill') and p_action is distinct from skill_id) then raise exception 'COMBAT_INVALID_ACTION'; end if;
  if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) then
    raise exception 'COMBAT_UNAVAILABLE';
  end if;
  if not healing and c.data->'welcome'->>'stage' is distinct from 'completed' then
    raise exception 'WELCOME_REQUIRED';
  end if;
  select * into w from public.world_players where user_id=uid and character_id=c.id
    and seen_at>now()-interval '15 seconds' for update;
  if not found then raise exception 'COMBAT_NOT_PLAYING'; end if;
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD'; end if;
  if not public.game_has_weapon(c.data) then raise exception 'COMBAT_WEAPON_REQUIRED'; end if;
  if not healing and (encounter->>'status' is distinct from 'active' or encounter->>'id' is distinct from 'shadowling') then raise exception 'COMBAT_NO_TARGET'; end if;

  attack_range:=case cls when 'guerrero' then 1.8 when 'mago' then 6 when 'picaro' then 1.6
    when 'clerigo' then 6 when 'explorador' then 8 else 0 end;
  cadence:=case cls when 'guerrero' then 1.5 when 'mago' then 1.8 when 'picaro' then 0.9
    when 'clerigo' then 1.8 when 'explorador' then 1.7 else 0 end;
  damage:=public.game_equipment_stat(c.data,'power');
  damage:=round(damage*(1+0.05*(public.game_level(c.data)-1)))::int;
  enemy_hp:=(encounter->>'health')::int;
  hp:=public.game_health(c.data);
  if healing then
    cost:=12;cooldown:=6;
    if hp=public.game_max_health(c.data) then raise exception 'COMBAT_HEALTH_FULL'; end if;
  else
    if enemy_hp<=0 then raise exception 'COMBAT_NO_TARGET'; end if;
    distance:=sqrt(power((w.position->>'x')::numeric-(encounter->>'x')::numeric,2)
      +power((w.position->>'z')::numeric-(encounter->>'z')::numeric,2));
    if distance>attack_range then raise exception 'COMBAT_OUT_OF_RANGE'; end if;
    if skill then
      cost:=case cls when 'mago' then 20 else 15 end;
      cooldown:=case cls when 'guerrero' then 6 when 'mago' then 7 when 'picaro' then 4.5
        when 'explorador' then 6 else 0 end;
    end if;
  end if;
  if skill then
    if stamp<coalesce((c.data->>'combatNextSkill')::numeric,0) then raise exception 'COMBAT_COOLDOWN'; end if;
  elsif stamp<coalesce((c.data->>'combatNextAttack')::numeric,0) then
    raise exception 'COMBAT_COOLDOWN';
  end if;

  resource:=(public.game_public_vitals(c.data)->>'resource')::int;
  if resource<cost then raise exception 'COMBAT_NOT_ENOUGH_RESOURCE'; end if;
  resource:=resource-cost;
  if skill then c.data:=c.data||jsonb_build_object('combatNextSkill',stamp+cooldown);
  else c.data:=c.data||jsonb_build_object('combatNextAttack',stamp+cadence);
  end if;
  c.data:=c.data||jsonb_build_object('resource',resource);
  if not healing or (encounter->>'status'='active' and coalesce((encounter->>'engaged')::boolean,
    (encounter->>'health')::numeric<(encounter->>'maxHealth')::numeric,false)) then
    c.data:=c.data||jsonb_build_object('combat_at',stamp);
  end if;

  if healing then
    healed:=least(public.game_equipment_stat(c.data,'healing')+4*(skill_rank-1),public.game_max_health(c.data)-hp);
    c.data:=c.data||jsonb_build_object('health',hp+healed);
  else
    hits:=case when skill and cls='picaro' then 2 else 1 end;
    each_hit:=case when not skill then damage
      when cls='guerrero' then 18 when cls='mago' then 18
      when cls='picaro' then 8 when cls='explorador' then 19 else damage end;
    if skill then
      each_hit:=round((each_hit+(skill_rank-1)*case when cls='picaro' then 1 else 2 end)
        *public.game_equipment_stat(c.data,'power')::numeric
        /case when cls='picaro' then 8 else 10 end)::int;
    end if;
    for i in 1..hits loop
      exit when enemy_hp<=0;
      total_damage:=total_damage+least(each_hit,enemy_hp);
      enemy_hp:=greatest(0,enemy_hp-each_hit);
    end loop;
    encounter:=encounter||jsonb_build_object(
      'health',enemy_hp,'engaged',true,'status',case when enemy_hp=0 then 'defeated' else 'active' end
    );
    if enemy_hp=0 then
      encounter:=encounter||jsonb_build_object(
        'instanceId',coalesce(encounter->>'instanceId',gen_random_uuid()::text),
        'loot',jsonb_build_array(jsonb_build_object('id','esencia_sombria','count',1,'bound',true)),'looted',false);
      c.data:=c.data||jsonb_build_object('shadowQuest','defeated');
    end if;
    c.data:=jsonb_set(c.data,'{combatEncounter}',encounter);
  end if;
  c.data:=public.game_store(c.id,c.data);
  if public.game_health(c.data)=0 then
    update public.world_players set dead=true where user_id=uid and character_id=c.id;
  end if;
  return jsonb_build_object(
    'encounter',c.data->'combatEncounter','vitals',public.game_public_vitals(c.data),
    'damage',total_damage,'healing',healed,
    'skillCooldown',greatest(0,coalesce((c.data->>'combatNextSkill')::numeric,0)-stamp),
    'quest',c.data->>'shadowQuest'
  );
end;
$$;

create or replace function public.combat_stop(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.characters;
  w public.world_players;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  c:=public.game_lock_character(p_character_id);
  select * into w from public.world_players where user_id=uid and character_id=c.id
    and seen_at>now()-interval '15 seconds' for update;
  if not found then raise exception 'COMBAT_NOT_PLAYING'; end if;
  if c.data->'combatEncounter'->>'status'='active' then
    c.data:=jsonb_set(c.data,'{combatEncounter,status}','"fled"'::jsonb);
    c.data:=public.game_store(c.id,c.data);
  end if;
  return jsonb_build_object('encounter',c.data->'combatEncounter','vitals',public.game_public_vitals(c.data));
end;
$$;

