-- Generated from authoritative existing entry points by tools/build-rpg-server.mjs.
create or replace function public.game_shadow_combat_config() returns jsonb language sql immutable set search_path='' as $$ select '{"health":110,"windup":1.4,"boltWindup":0.65,"meleeWindup":0.7,"recovery":1.8,"radius":1.6,"meleeRange":2.2,"range":12,"aggro":2,"damage":{"area":9,"bolt":5,"melee":6}}'::jsonb $$;
revoke all on function public.game_shadow_combat_config() from public,anon,authenticated;

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
  damage numeric;
  cost numeric := 0;
  cooldown numeric := 0;
  resource numeric;
  hp int;
  enemy_hp numeric;
  hits int;
  each_hit numeric;
  total_damage numeric := 0;
  healed numeric := 0;
  skill_rank int;
  e jsonb; es jsonb; grade int; extra numeric:=0; raw_basic numeric; actual_basic numeric; shield numeric; barrier numeric; recovered numeric:=0; counters int; bonus jsonb; events jsonb:='[]'; packed jsonb; secondary jsonb; nearest numeric; secondary_index int; points numeric; target_index int; enemy_guard numeric;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  c:=public.game_lock_character(p_character_id);
  encounter:=c.data->'combatEncounter';
  cls:=c.data->>'cls';
  bonus:=public.game_set_bonuses(c.data);
  enemy_guard:=coalesce((encounter->>'guard')::numeric,0);
  e:=c.data->'equipment'->'weapon'->'enchantment';
  es:=coalesce(c.data->'enchantState','{}');
  if es->>'weapon' is distinct from coalesce(c.data->'equipment'->'weapon'->>'instanceId',c.data->'equipment'->'weapon'->>'id') or stamp-coalesce((es->>'at')::numeric,0)>6 then es:='{}';end if;
  es:=es||jsonb_build_object('weapon',coalesce(c.data->'equipment'->'weapon'->>'instanceId',c.data->'equipment'->'weapon'->>'id'));
  grade:=least(5,greatest(1,coalesce((e->>'grade')::int,1)));
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
  cadence:=case cls when 'guerrero' then 1.5 when 'mago' then 1.5 when 'picaro' then 1.15 when 'clerigo' then 1.65 when 'explorador' then 1.5 else 0 end;
  damage:=public.game_equipment_stat(c.data,'power');
  cadence:=greatest(case cls when 'guerrero' then 0.7200000000000001 when 'picaro' then 0.7200000000000001 when 'mago' then 0.5900000000000001 when 'clerigo' then 0.5900000000000001 when 'explorador' then 0.8200000000000001 else .72 end,cadence*public.game_weapon_tempo(c.data)*public.game_agility_tempo(c.data));
  damage:=damage*public.game_power_multiplier(c.data)*public.game_strength_power(c.data)*(1+(bonus->>'power')::numeric)*public.game_weapon_tempo(c.data);
  raw_basic:=damage;
  enemy_hp:=(encounter->>'health')::numeric;
  hp:=public.game_health(c.data);
  if healing then
    cost:=12;cooldown:=6;
    if hp=public.game_max_health(c.data) then raise exception 'COMBAT_HEALTH_FULL'; end if;
  else
    if enemy_hp<=0 then raise exception 'COMBAT_NO_TARGET'; end if;
    distance:=sqrt(power((w.position->>'x')::numeric-(encounter->>'x')::numeric,2)
      +power((w.position->>'z')::numeric-(encounter->>'z')::numeric,2));
    if distance>attack_range then raise exception 'COMBAT_OUT_OF_RANGE'; end if;
    if not public.game_rpg_sight(c.data->>'location',(w.position->>'x')::numeric,(w.position->>'z')::numeric,(encounter->>'x')::numeric,(encounter->>'z')::numeric) then raise exception 'El objetivo no está en tu línea de visión.';end if;
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

  cost:=cost*(1-(bonus->>'skillCost')::numeric)*public.game_intellect_efficiency(c.data);
  resource:=(public.game_public_vitals(c.data)->>'resource')::numeric;
  if resource<cost then raise exception 'COMBAT_NOT_ENOUGH_RESOURCE'; end if;
  cost:=cost+coalesce((c.data->>'resourceCostFraction')::numeric,0);
  resource:=resource-floor(cost);
  c.data:=c.data||jsonb_build_object('resourceCostFraction',cost-floor(cost));
  if skill then c.data:=c.data||jsonb_build_object('combatNextSkill',stamp+cooldown);
  else c.data:=c.data||jsonb_build_object('combatNextAttack',stamp+cadence);
  end if;
  c.data:=c.data||jsonb_build_object('resource',resource);
  if not healing or (encounter->>'status'='active' and coalesce((encounter->>'engaged')::boolean,
    (encounter->>'health')::numeric<(encounter->>'maxHealth')::numeric,false)) then
    c.data:=c.data||jsonb_build_object('combat_at',stamp);
  end if;

  if healing then
    recovered:=(public.game_equipment_stat(c.data,'healing')+4*(skill_rank-1))*public.game_power_multiplier(c.data)*public.game_expertise_power(c.data)*(1+(bonus->>'healing')::numeric)*(1+(bonus->>'skillPower')::numeric)+coalesce((c.data->>'health_regen')::numeric,0);
    healed:=least(floor(recovered),public.game_max_health(c.data)-hp);
    c.data:=c.data||jsonb_build_object('health_regen',case when hp+healed>=public.game_max_health(c.data) then 0 else recovered-floor(recovered) end);
    c.data:=c.data||jsonb_build_object('health',hp+healed);
  else
    hits:=case when skill and cls='picaro' then 2 else 1 end;
    each_hit:=case when not skill then damage
      when cls='guerrero' then 18 when cls='mago' then 18
      when cls='picaro' then 8 when cls='explorador' then 19 else damage end;
    if skill then
      each_hit:=((each_hit+(skill_rank-1)*case when cls='picaro' then 1 else 2 end)
        *public.game_equipment_stat(c.data,'power')::numeric
        /case when cls='picaro' then 8 else 10 end)*public.game_power_multiplier(c.data)*public.game_expertise_power(c.data)*(1+(bonus->>'power')::numeric)*(1+(bonus->>'skillPower')::numeric);
    end if;
    if not skill and e is not null then
      counters:=coalesce((es->>'count')::int,0)+1;
      if e->>'id'='dark' then
        select coalesce(jsonb_object_agg(key,value),'{}') into packed from jsonb_each(coalesce(es->'marks','{}')) where stamp-coalesce((value->>'at')::numeric,0)<=6;
        counters:=coalesce((packed->coalesce(encounter->>'instanceId','shadowling')->>'count')::int,0)+1;
        es:=jsonb_set(es,'{marks}',packed);
      end if;
      es:=es||jsonb_build_object('at',stamp,'target',coalesce(encounter->>'instanceId','shadowling'));
      if e->>'id'='fire' then extra:=raw_basic*(.04+grade*.01);events:=events||jsonb_build_array(jsonb_build_object('kind','fire','amount',extra));
      elsif e->>'id'='dark' and counters>=3 then extra:=raw_basic*(.15+grade*.05);counters:=0;events:=events||jsonb_build_array(jsonb_build_object('kind','dark','amount',extra));
      elsif e->>'id'='frost' and counters>=3 then
        shield:=raw_basic*(.15+grade*.05);barrier:=case when coalesce((es->>'barrierUntil')::numeric,0)>stamp then coalesce((es->>'barrier')::numeric,0) else 0 end;
        es:=es||jsonb_build_object('barrier',greatest(shield,barrier),'barrierUntil',stamp+4);counters:=0;events:=events||jsonb_build_array(jsonb_build_object('kind','frost','amount',shield));
      elsif e->>'id'='lightning' and counters>=4 then
        counters:=4;nearest:=5;secondary_index:=-1;packed:=coalesce(encounter->'enemies','[]');
        for k in 0..jsonb_array_length(packed)-1 loop
          secondary:=packed->k;
          points:=sqrt(power((secondary->>'x')::numeric-(encounter->>'x')::numeric,2)+power((secondary->>'z')::numeric-(encounter->>'z')::numeric,2));
          if (secondary->>'health')::numeric>0 and points<=4 and points<nearest and coalesce((secondary->>'visible')::boolean,true) and public.game_rpg_sight(c.data->>'location',(encounter->>'x')::numeric,(encounter->>'z')::numeric,(secondary->>'x')::numeric,(secondary->>'z')::numeric) then nearest:=points;secondary_index:=k;end if;
        end loop;
        if secondary_index>=0 then
          secondary:=packed->secondary_index;points:=raw_basic*(.3+grade*.1)*(1-least(.6,coalesce((secondary->>'guard')::numeric,0)/(coalesce((secondary->>'guard')::numeric,0)+20)));
          points:=least(points,(secondary->>'health')::numeric);secondary:=secondary||jsonb_build_object('health',(secondary->>'health')::numeric-points);
          packed:=jsonb_set(packed,array[secondary_index::text],secondary);encounter:=jsonb_set(encounter,'{enemies}',packed);counters:=0;
          events:=events||jsonb_build_array(jsonb_build_object('kind','lightning','amount',points,'target',secondary_index,'x',secondary->'x','z',secondary->'z'));
        end if;
      end if;
      es:=es||jsonb_build_object('count',counters);
      if e->>'id'='dark' then es:=jsonb_set(es,array['marks',coalesce(encounter->>'instanceId','shadowling')],jsonb_build_object('count',counters,'at',stamp));end if;
    end if;
    actual_basic:=least(enemy_hp,each_hit*(1-least(.6,enemy_guard/(enemy_guard+20))));
    each_hit:=each_hit*(1-least(.6,enemy_guard/(enemy_guard+20)));
    for i in 1..hits loop
      exit when enemy_hp<=0;
      total_damage:=total_damage+least(each_hit,enemy_hp);
      enemy_hp:=greatest(0,enemy_hp-each_hit);
    end loop;
    if not skill and extra>0 then extra:=least(enemy_hp,extra*(1-least(.6,enemy_guard/(enemy_guard+20))));enemy_hp:=greatest(0,enemy_hp-extra);total_damage:=total_damage+extra;end if;
    if not skill and e->>'id'='vampirism' then
      recovered:=actual_basic*(.01+grade*.01)+coalesce((c.data->>'health_regen')::numeric,0);
      healed:=least(floor(recovered),public.game_max_health(c.data)-hp);hp:=hp+healed;
      c.data:=c.data||jsonb_build_object('health',hp,'health_regen',case when hp>=public.game_max_health(c.data) then 0 else recovered-floor(recovered) end);
      events:=events||jsonb_build_array(jsonb_build_object('kind','vampirism','amount',healed));
    end if;
    c.data:=c.data||jsonb_build_object('enchantState',es);
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
  c.data:=c.data||jsonb_build_object('combatVisual',jsonb_build_object('at',stamp,'action',case when skill then 'skill' else 'attack' end));
  c.data:=public.game_store(c.id,c.data);
  if public.game_health(c.data)=0 then
    update public.world_players set dead=true where user_id=uid and character_id=c.id;
  end if;
  return jsonb_build_object(
    'encounter',c.data->'combatEncounter','vitals',public.game_public_vitals(c.data),
    'damage',total_damage,'healing',healed,'events',events,'action',case when skill then 'skill' else 'attack' end,'enchantState',c.data->'enchantState',
    'attackCooldown',greatest(0,coalesce((c.data->>'combatNextAttack')::numeric,0)-stamp),'skillCooldown',greatest(0,coalesce((c.data->>'combatNextSkill')::numeric,0)-stamp),
    'quest',c.data->>'shadowQuest'
  );
end;
$$;

create or replace function public.game_combat_tick(p_id uuid, d jsonb, p_x double precision, p_z double precision)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  encounter jsonb := d->'combatEncounter';
  stamp numeric := extract(epoch from clock_timestamp());
  enemy_x numeric;
  enemy_z numeric;
  absorbed int;
  remaining int;
  hp int;
  incoming numeric; barrier numeric; blocked numeric; fraction numeric;
  cfg jsonb:=public.game_shadow_combat_config();
  attack_kind text;
  attack_distance numeric;
begin
  if encounter->>'kind'='expedition' then return d;end if;
  if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false)
    or encounter->>'status' is distinct from 'active'
    or coalesce(d->>'location','brumaluz')<>'brumaluz'
    or coalesce((d->>'health')::int,-1)=0
    or stamp<coalesce((encounter->>'enemyAttackAt')::numeric,stamp) then
    return d;
  end if;
  enemy_x := (encounter->>'x')::numeric;
  enemy_z := (encounter->>'z')::numeric;
  attack_distance:=sqrt(power(p_x-enemy_x,2)+power(p_z-enemy_z,2));
  if coalesce((encounter->>'windup')::numeric,0)=0 then
    if attack_distance>
      (case when coalesce((encounter->>'engaged')::boolean,false) then (cfg->>'range')::numeric else (cfg->>'aggro')::numeric end)
      or not public.game_rpg_sight('brumaluz',p_x::numeric,p_z::numeric,enemy_x,enemy_z) then return d; end if;
    attack_kind:=case when coalesce((encounter->>'attackSeq')::int,0)%3=0 then 'area' when attack_distance<=(cfg->>'meleeRange')::numeric then 'melee' else 'bolt' end;
    encounter:=encounter||jsonb_build_object('attackKind',attack_kind,'windup',stamp+case attack_kind when 'area' then (cfg->>'windup')::numeric when 'bolt' then (cfg->>'boltWindup')::numeric else (cfg->>'meleeWindup')::numeric end,'aimX',p_x,'aimZ',p_z,
      'attackSeq',coalesce((encounter->>'attackSeq')::int,0)+1,'engaged',true);
    return jsonb_set(d,'{combatEncounter}',encounter);
  end if;
  if stamp<(encounter->>'windup')::numeric then return d; end if;
  attack_kind:=coalesce(encounter->>'attackKind','area');
  encounter:=encounter||jsonb_build_object('windup',null,'enemyAttackAt',stamp+(cfg->>'recovery')::numeric);
  if (attack_kind='area' and sqrt(power(p_x-(encounter->>'aimX')::numeric,2)+power(p_z-(encounter->>'aimZ')::numeric,2))>(cfg->>'radius')::numeric)
    or (attack_kind='melee' and attack_distance>(cfg->>'meleeRange')::numeric)
    or attack_distance>(cfg->>'range')::numeric
    or not public.game_rpg_sight('brumaluz',p_x::numeric,p_z::numeric,enemy_x,enemy_z) then
    return jsonb_set(d,'{combatEncounter}',encounter);
  end if;

  incoming:=(cfg->'damage'->>attack_kind)::numeric*public.game_guard_multiplier(d);
  barrier:=case when coalesce((d->'enchantState'->>'barrierUntil')::numeric,0)>stamp then coalesce((d->'enchantState'->>'barrier')::numeric,0) else 0 end;
  blocked:=least(incoming,barrier);incoming:=incoming-blocked;
  if d ? 'enchantState' then d:=jsonb_set(d,'{enchantState,barrier}',to_jsonb(greatest(0,barrier-blocked)));end if;
  fraction:=incoming+coalesce((d->>'incomingFraction')::numeric,0);incoming:=floor(fraction);d:=d||jsonb_build_object('incomingFraction',fraction-incoming);
  absorbed := least(public.game_overheal_now(d),incoming);
  remaining := incoming-absorbed;
  hp := public.game_health(d);
  if remaining>0 then hp:=greatest(0,hp-remaining); end if;
  d := d || jsonb_build_object(
    'health',hp,'overheal',public.game_overheal_now(d)-absorbed,
    'overheal_at',stamp,'combat_at',stamp
  );
  encounter := encounter || jsonb_build_object(
    'enemyAttackAt',stamp+(cfg->>'recovery')::numeric,'engaged',true,
    'status',case when hp=0 then 'failed' else 'active' end
  );
  if hp=0 then d:=d-'enchantState';end if;
  return jsonb_set(d,'{combatEncounter}',encounter);
end;
$$;

create or replace function public.game_regen_data(p_id uuid, d jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  seen timestamptz;
  stamp numeric := extract(epoch from clock_timestamp());
  previous numeric := coalesce((d ->> 'vitals_at')::numeric, extract(epoch from clock_timestamp()));
  active_until numeric;
  elapsed numeric := 0;
  max_health numeric := public.game_max_health(d);
  max_resource numeric;
  health_value numeric := public.game_health(d);
  resource_value numeric;
  health_remainder numeric := coalesce((d ->> 'health_regen')::numeric,0);
  resource_remainder numeric := coalesce((d ->> 'resource_regen')::numeric,0);
  health_rate numeric;
  resource_rate numeric;
  kind text := case when d ->> 'cls' in ('mago','clerigo') then 'mana' else 'stamina' end;
  total numeric;
begin
  select seen_at into seen from public.world_players where character_id=p_id;
  if seen is not null then
    active_until := extract(epoch from least(clock_timestamp(),seen+interval '15 seconds'));
    elapsed := greatest(0,active_until-previous);
  end if;

  max_resource := public.game_rpg_resource_max(d);

  health_rate := case when coalesce((d->>'combat_at')::numeric,0)>=stamp-5 then 0.0025 else 0.01 end;
  resource_rate := case when kind='mana' then 0.02 else 0.04 end;

  if health_value=0 then
    health_remainder := 0;
    resource_remainder := 0;
    resource_value := (public.game_public_vitals(d)->>'resource')::numeric;
  else
    total := least(max_health,health_value+health_remainder+max_health*health_rate*elapsed);
    health_value := floor(total);
    health_remainder := case when total>=max_health then 0 else total-health_value end;

    resource_value := (public.game_public_vitals(d)->>'resource')::numeric;
    total := least(max_resource,resource_value+resource_remainder+max_resource*resource_rate*elapsed);
    resource_value := floor(total);
    resource_remainder := case when total>=max_resource then 0 else total-resource_value end;
  end if;

  return d || jsonb_build_object(
    'health',case when health_value>=max_health then -1 else health_value end,
    'resource',case when resource_value>=max_resource then -1 else coalesce(resource_value,0) end,
    'health_regen',health_remainder,'resource_regen',resource_remainder,'vitals_at',stamp
  );
end;
$$;

create or replace function public.game_store(p_id uuid, d jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  d := public.game_rpg_settle(d,extract(epoch from clock_timestamp()));
  d := public.game_food_data(p_id,d);
  d := public.game_regen_data(p_id,d);
  d := d || jsonb_build_object(
    'overheal', case when coalesce((d ->> 'health')::int, -1) = 0 then 0 else public.game_overheal_now(d) end,
    'overheal_at', extract(epoch from now())
  );
  d:=d||jsonb_build_object('serverRevision',coalesce((select (data->>'serverRevision')::bigint from public.characters where id=p_id),0)+1);
  update public.characters set data = d - 'partyPeers', updated_at = now() where id = p_id returning data into result;
  return public.game_party_data(p_id,result);
end;
$$;

create or replace function public.change_equipment(p_character_id uuid,p_slot text,p_bag int,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.characters; inv jsonb; equipment jsonb; source jsonb; target jsonb; meta jsonb; free int; previous_vitals jsonb; changed jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(731029,3);
  c:=public.game_lock_character(p_character_id);
  if public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD'; end if;
  previous_vitals:=public.game_public_vitals(c.data);
  if p_slot is null or p_slot not in ('head','pendant','chest','hands','ring','weapon','offhand','legs','trinket')
    or (p_bag is not null and p_bag not between 0 and 24) then raise exception 'EQUIPMENT_INVALID'; end if;
  inv:=public.game_inventory(c.data);
  equipment:=coalesce(c.data->'equipment','{}'::jsonb);
  source:=case when p_bag is null then equipment->p_slot else inv->p_bag end;
  if jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
    or source-'bound' is distinct from p_expected-'bound'
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
    source:=source||jsonb_build_object('bound',true,'instanceId',coalesce(source->>'instanceId',gen_random_uuid()::text));
    inv:=jsonb_set(inv,array[p_bag::text],target);
    equipment:=jsonb_set(equipment,array[p_slot],source);
  end if;
  update public.player_trades set revision=revision+1,accepted_a=false,accepted_b=false,
    offer_a=case when a=c.id then '{"items":[],"pelines":0}'::jsonb else offer_a end,
    offer_b=case when b=c.id then '{"items":[],"pelines":0}'::jsonb else offer_b end
    where status in ('invited','open') and c.id in(a,b);
  changed:=c.data||jsonb_build_object('inventory',inv,'equipment',equipment);
  if p_slot='weapon' then changed:=changed-'enchantState';end if;
  changed:=changed||jsonb_build_object(
    'health',least((previous_vitals->>'health')::int,public.game_max_health(changed)),
    'resource',least((previous_vitals->>'resource')::int,(public.game_public_vitals(changed)->>'maxResource')::int));
  return public.game_store(c.id,changed);
end $$;

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
    result:=result||jsonb_build_array(slot||jsonb_build_object('slot',idx,'count',n));
  end loop;
  return jsonb_build_object('items',result,'pelines',money);
end $$;

create or replace function public.game_trade_add(d jsonb, offer jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare entry jsonb; i int;
begin
  for entry in select value from jsonb_array_elements(offer->'items') loop
    d:=public.game_rpg_give(d,entry-'slot',false);
  end loop;
  return public.game_set_pelines(d,public.game_pelines(d)+(offer->>'pelines')::int);
end $$;

create or replace function public.game_place_item(p_slots jsonb,p_index int,p_item jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  target jsonb:=p_slots->p_index; room int; moved int;
  stack int:=greatest(coalesce((public.game_item(p_item->>'id')->>'stack')::int,50),1);
begin
  if jsonb_typeof(target) is distinct from 'object' then
    return jsonb_build_object('slots',jsonb_set(p_slots,array[p_index::text],p_item),'rest',null);
  end if;
  if target-'count'-'bound'=p_item-'count'-'bound'
    and target->>'id'=p_item->>'id'
    and coalesce((target->>'bound')::boolean,false)=coalesce((p_item->>'bound')::boolean,false) then
    room:=greatest(stack-(target->>'count')::int,0);
    moved:=least(room,(p_item->>'count')::int);
    return jsonb_build_object(
      'slots',jsonb_set(p_slots,array[p_index::text],target||jsonb_build_object('count',(target->>'count')::int+moved)),
      'rest',case when (p_item->>'count')::int>moved then p_item||jsonb_build_object('count',(p_item->>'count')::int-moved) end);
  end if;
  return jsonb_build_object('slots',jsonb_set(p_slots,array[p_index::text],p_item),'rest',target);
end $$;

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
        or actual-'bound' is distinct from expected-'bound' or actual->>'id' is distinct from expected->>'id'
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

create or replace function public.game_public_character(d jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) ||
    jsonb_build_object('equipment', coalesce(d->'equipment','{}'::jsonb))
  from jsonb_each(d)
  where key = any(array[
    'combatVisual', 'name', 'title', 'level', 'race', 'cls', 'sex', 'height', 'build', 'skin', 'face',
    'hair', 'hairColor', 'beard', 'eyeShape', 'eyeColor', 'brows', 'nose', 'mouth', 'detail',
    'trait', 'primary', 'secondary', 'cape', 'clothA', 'clothB', 'hairAcc', 'hairAccColor',
    'acc', 'makeup', 'makeupColor', 'accColor'
  ])
$$;
