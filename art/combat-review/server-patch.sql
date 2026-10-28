-- Combat responsiveness: function bodies only; no player/map/catalog data changes.
begin;
set local lock_timeout='2s';
set local statement_timeout='20s';

create or replace function public.game_strength_power(d jsonb) returns numeric language sql immutable set search_path='' as $$ select 1+.003*greatest(0,public.game_attr_total(d,'fuerza')-5) $$;

revoke all on function public.game_strength_power(jsonb) from public,anon,authenticated;

create or replace function public.game_expertise_power(d jsonb) returns numeric language sql immutable set search_path='' as $$ select 1+.004*greatest(0,public.game_attr_total(d,'pericia')-5) $$;

revoke all on function public.game_expertise_power(jsonb) from public,anon,authenticated;

create or replace function public.game_intellect_efficiency(d jsonb) returns numeric language sql immutable set search_path='' as $$ select greatest(.75,1/(1+.004*greatest(0,public.game_attr_total(d,'intelecto')-5))) $$;

revoke all on function public.game_intellect_efficiency(jsonb) from public,anon,authenticated;

create or replace function public.game_agility_tempo(d jsonb) returns numeric language sql immutable set search_path='' as $$ select greatest(.75,1/(1+.004*greatest(0,public.game_attr_total(d,'agilidad')-5))) $$;

revoke all on function public.game_agility_tempo(jsonb) from public,anon,authenticated;

create or replace function public.game_wilderness_fresh(site jsonb) returns jsonb language sql volatile set search_path='' as $$
 select jsonb_build_object('id','wild_enemy','kind','wilderness','shared',true,'spawn',site->>'id','enemy',site->>'enemy','label',def->>'label','level',def->'level','status','idle','health',def->'health','maxHealth',def->'health','guard',def->'guard','x',site->'x','z',site->'z','homeX',site->'x','homeZ',site->'z','movedAt',extract(epoch from clock_timestamp()),'enemyAttackAt',extract(epoch from clock_timestamp())+.8,'instanceId',gen_random_uuid()::text,'members','{}'::jsonb,'attackSeq',0,'loot','[]'::jsonb,'looted',true,'habitat',site->'habitat','group',site->'group','leader',site->'leader','variant',site->'variant','activity',coalesce(def->'ai'->>'idle','watch'),'ambientSeq',0,'nextIdleAt',extract(epoch from clock_timestamp())+1+random()*3,'patrolIndex',0)
 from (select public.game_wilderness_catalog()->'enemies'->(site->>'enemy') def) q
$$;

revoke all on function public.game_wilderness_fresh(jsonb) from public,anon,authenticated;

create or replace function public.game_wilderness_join(m jsonb,p_id uuid,damage numeric default 0,support numeric default 0) returns jsonb language plpgsql volatile set search_path='' as $$
declare member jsonb:=coalesce(m->'members'->p_id::text,'{}');stamp numeric:=extract(epoch from clock_timestamp());begin
 member:=member||jsonb_build_object('damage',coalesce((member->>'damage')::numeric,0)+damage,'support',coalesce((member->>'support')::numeric,0)+support,'threat',coalesce((member->>'threat')::numeric,1)+damage+support*.5,'contactAt',stamp);
 return m||jsonb_build_object('status','active','engagedAt',case when m->>'status'='active' then coalesce((m->>'engagedAt')::numeric,stamp) else stamp end,'members',coalesce(m->'members','{}')||jsonb_build_object(p_id::text,member));
end $$;

revoke all on function public.game_wilderness_join(jsonb,uuid,numeric,numeric) from public,anon,authenticated;

create or replace function public.game_wilderness_clear(nav jsonb,x1 numeric,z1 numeric,x2 numeric,z2 numeric) returns boolean language plpgsql stable set search_path='' as $$
declare n int;i int;ix int;iz int;cell numeric;w int;k int;begin
 if nav is null then return public.game_rpg_sight('pompelin',x1,z1,x2,z2);end if;
 cell:=(nav->>'cell')::numeric;w:=(nav->>'width')::int;n:=greatest(1,ceil(sqrt(power(x2-x1,2)+power(z2-z1,2))/(cell*.3))::int);
 if n>200 then return false;end if;
 for i in 0..n loop
  ix:=floor((x1+(x2-x1)*i/n-(nav->'origin'->>0)::numeric)/cell+.5)::int;iz:=floor((z1+(z2-z1)*i/n-(nav->'origin'->>1)::numeric)/cell+.5)::int;k:=iz*w+ix;
  if ix<0 or iz<0 or ix>=w or iz>=w or not(nav->'cells' ? k::text) then return false;end if;
 end loop;return true;
end $$;

revoke all on function public.game_wilderness_clear(jsonb,numeric,numeric,numeric,numeric) from public,anon,authenticated;

create or replace function public.game_wilderness_route(m jsonb,tx numeric,tz numeric) returns jsonb language plpgsql stable set search_path='' as $$
declare nav jsonb:=public.game_wilderness_catalog()->'habitats'->(m->>'habitat');w int;cell numeric;ox numeric;oz numeric;first int;last int;node int;next_node int;queue int[];cursor int:=1;parents jsonb;result jsonb:='[]';p jsonb;limit_steps int:=0;begin
 if nav is null then return result;end if;
 w:=(nav->>'width')::int;cell:=(nav->>'cell')::numeric;ox:=(nav->'origin'->>0)::numeric;oz:=(nav->'origin'->>1)::numeric;
 select k::int into first from jsonb_object_keys(nav->'cells') k order by power(ox+(k::int%w)*cell-(m->>'x')::numeric,2)+power(oz+(k::int/w)*cell-(m->>'z')::numeric,2),k::int limit 1;
 select k::int into last from jsonb_object_keys(nav->'cells') k order by power(ox+(k::int%w)*cell-tx,2)+power(oz+(k::int/w)*cell-tz,2),k::int limit 1;
 if first is null or last is null then return result;end if;
 queue:=array[first];parents:=jsonb_build_object(first::text,-1);
 while cursor<=cardinality(queue) and cursor<=1024 loop
  node:=queue[cursor];cursor:=cursor+1;if node=last then exit;end if;
  for next_node in select value::int from jsonb_array_elements_text(nav->'cells'->node::text) loop
   if not(parents ? next_node::text) then parents:=parents||jsonb_build_object(next_node::text,node);queue:=array_append(queue,next_node);end if;
  end loop;
 end loop;
 if not(parents ? last::text) then return result;end if;
 node:=last;
 while node<>-1 and limit_steps<128 loop
  p:=jsonb_build_object('x',ox+(node%w)*cell,'z',oz+(node/w)*cell);result:=jsonb_build_array(p)||result;
  node:=(parents->>node::text)::int;limit_steps:=limit_steps+1;
 end loop;
 return result;
end $$;

revoke all on function public.game_wilderness_route(jsonb,numeric,numeric) from public,anon,authenticated;

create or replace function public.game_wilderness_move(m jsonb,tx numeric,tz numeric,speed numeric,dt numeric,stamp numeric) returns jsonb language plpgsql stable set search_path='' as $$
declare nav jsonb:=public.game_wilderness_catalog()->'habitats'->(m->>'habitat');route jsonb:=coalesce(m->'route','[]');p jsonb;x numeric:=(m->>'x')::numeric;z numeric:=(m->>'z')::numeric;dx numeric;dz numeric;distance numeric;budget numeric:=least(.5,greatest(0,dt))*speed;step numeric;nx numeric;nz numeric;trail jsonb:=coalesce(m->'trail','[]');i int;begin
 if public.game_wilderness_clear(nav,x,z,tx,tz) then route:=jsonb_build_array(jsonb_build_object('x',tx,'z',tz));
 elsif (jsonb_array_length(route)=0 and stamp-coalesce((m->>'routeAt')::numeric,0)>1.2) or power(tx-coalesce((m->>'routeX')::numeric,0),2)+power(tz-coalesce((m->>'routeZ')::numeric,0),2)>4 then
  route:=public.game_wilderness_route(m,tx,tz);m:=m||jsonb_build_object('routeAt',stamp,'routeX',tx,'routeZ',tz);
 end if;
 for i in 1..4 loop
  p:=route->0;exit when p is null or budget<=.001;
  dx:=(p->>'x')::numeric-x;dz:=(p->>'z')::numeric-z;distance:=sqrt(dx*dx+dz*dz);
  if distance<.025 then route:=route-0;continue;end if;
  step:=least(distance,budget);nx:=x+dx/distance*step;nz:=z+dz/distance*step;
  if not public.game_wilderness_clear(nav,x,z,nx,nz) then
   route:='[]';m:=m||jsonb_build_object('routeAt',0);exit;
  end if;
  x:=nx;z:=nz;budget:=budget-step;
  m:=m||jsonb_build_object('lookX',p->'x','lookZ',p->'z');
  if step>=distance-.001 then route:=route-0;end if;
 end loop;
 if power(x-(m->>'x')::numeric,2)+power(z-(m->>'z')::numeric,2)>.0001 then
  if trail->-1 is null or power((trail->-1->>'x')::numeric-(m->>'x')::numeric,2)+power((trail->-1->>'z')::numeric-(m->>'z')::numeric,2)>.25 then
   if jsonb_array_length(trail)>=128 then trail:=trail-0;end if;trail:=trail||jsonb_build_array(jsonb_build_object('x',m->'x','z',m->'z'));
  end if;
  m:=m||jsonb_build_object('blockedAt',null);
 else m:=m||jsonb_build_object('blockedAt',coalesce((m->>'blockedAt')::numeric,stamp));end if;
 return m||jsonb_build_object('x',x,'z',z,'route',route,'trail',trail);
end $$;

revoke all on function public.game_wilderness_move(jsonb,numeric,numeric,numeric,numeric,numeric) from public,anon,authenticated;

create or replace function public.game_wilderness_ambient(m jsonb,site jsonb,def jsonb,dt numeric,stamp numeric) returns jsonb language plpgsql volatile set search_path='' as $$
declare patrol jsonb:=coalesce(site->'patrol','[]');p jsonb;index int;idle text:=coalesce(def->'ai'->>'idle','watch');leader jsonb;gx numeric;gz numeric;begin
 if m->>'leader' is not null and m->>'leader'<>m->>'spawn' then
  select state into leader from public.wilderness_mobs where spawn=m->>'leader' and state->>'status'='idle';
  if leader is not null then
   gx:=(leader->>'x')::numeric+(m->>'homeX')::numeric-(leader->>'homeX')::numeric;gz:=(leader->>'z')::numeric+(m->>'homeZ')::numeric-(leader->>'homeZ')::numeric;
   if power(gx-(m->>'x')::numeric,2)+power(gz-(m->>'z')::numeric,2)>1 then
    return public.game_wilderness_move(m,gx,gz,coalesce((def->'ai'->>'walkSpeed')::numeric,.7)*1.15,dt,stamp)||jsonb_build_object('activity','patrol');
   end if;
   return m||jsonb_build_object('activity',idle,'ambientSeq',floor(stamp/5)::int,'lookX',leader->'x','lookZ',leader->'z');
  end if;
 end if;
 if jsonb_array_length(patrol)=0 then return m;end if;
 if m->>'activity'='patrol' then
  index:=coalesce((m->>'patrolIndex')::int,0)%jsonb_array_length(patrol);p:=patrol->index;
  m:=public.game_wilderness_move(m,(p->>'x')::numeric,(p->>'z')::numeric,coalesce((def->'ai'->>'walkSpeed')::numeric,.7),dt,stamp);
  if power((m->>'x')::numeric-(p->>'x')::numeric,2)+power((m->>'z')::numeric-(p->>'z')::numeric,2)<.09 or stamp-coalesce((m->>'patrolAt')::numeric,stamp)>24 then
   m:=m||jsonb_build_object('activity',idle,'patrolIndex',(index+1)%jsonb_array_length(patrol),'ambientSeq',coalesce((m->>'ambientSeq')::int,0)+1,'nextIdleAt',stamp+2+random()*4,'route','[]'::jsonb);
  end if;
 elsif stamp>=coalesce((m->>'nextIdleAt')::numeric,0) then
  m:=m||jsonb_build_object('activity','patrol','patrolAt',stamp,'routeAt',0);
 end if;return m;
end $$;

revoke all on function public.game_wilderness_ambient(jsonb,jsonb,jsonb,numeric,numeric) from public,anon,authenticated;

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
  stamp:=extract(epoch from clock_timestamp());
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

create or replace function public.game_story_combat_tick(p_id uuid, d jsonb, p_x double precision, p_z double precision)
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
    attack_kind:=case when attack_distance<=(cfg->>'meleeRange')::numeric then 'melee' else 'bolt' end;
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

create or replace function public.game_wilderness_context(p_id uuid,d jsonb,px numeric,pz numeric) returns jsonb language plpgsql volatile set search_path='' as $$
declare m jsonb;count int;selected text:=d->'wilderness'->>'selected';secondary jsonb;stamp numeric:=extract(epoch from clock_timestamp());begin
 if d->>'location'<>'pompelin' or public.game_health(d)=0 then
  if d->'combatEncounter'->>'kind'='wilderness' then d:=d-'combatEncounter';end if;return d;
 end if;
 select count(*) into count from public.wilderness_mobs where state->>'status'='active' and state->'members' ? p_id::text;
 if count>0 and coalesce((d->>'combat_at')::numeric,0)<stamp-1 then d:=d||jsonb_build_object('combat_at',stamp);end if;
 select state into m from public.wilderness_mobs where spawn=selected and state->>'status' in('idle','active');
 if m is null then
  select state into m from public.wilderness_mobs where state->>'status'='active' and state->'members' ? p_id::text order by power(px-(state->>'x')::numeric,2)+power(pz-(state->>'z')::numeric,2),spawn limit 1;
 end if;
 if m is null then
  if d->'combatEncounter'->>'kind'='wilderness' then d:=d-'combatEncounter';end if;
  return jsonb_set(d,'{wilderness}',coalesce(d->'wilderness','{}')-'selected');
 end if;
 select coalesce(jsonb_agg((state-'members'-'trail'-'route'-'routeAt'-'routeX'-'routeZ')||jsonb_build_object('id',spawn)),'[]') into secondary from public.wilderness_mobs where spawn<>m->>'spawn' and state->>'status' in('active','idle') and power((state->>'x')::numeric-(m->>'x')::numeric,2)+power((state->>'z')::numeric-(m->>'z')::numeric,2)<=16;
 d:=jsonb_set(d,'{wilderness}',(coalesce(d->'wilderness','{}')-'respawns')||jsonb_build_object('selected',m->>'spawn'));
 return jsonb_set(d,'{combatEncounter}',(m-'members'-'trail'-'route'-'routeAt'-'routeX'-'routeZ')||jsonb_build_object('status','active','attackers',count,'engaged',count>0,'loot','[]'::jsonb,'looted',true,'enemies',secondary));
end $$;

create or replace function public.game_wilderness_world_tick() returns void language plpgsql volatile set search_path='' as $$
declare row record;player record;site jsonb;m jsonb;def jsonb;catalog jsonb:=public.game_wilderness_catalog();member jsonb;members jsonb;observers jsonb;stamp numeric;dt numeric;dx numeric;dz numeric;distance numeric;step numeric;nx numeric;nz numeric;ax numeric;az numeric;len numeric;projection numeric;hit boolean;victim text;best numeric;score numeric;pos jsonb;target_pos jsonb;old_target text;blocked boolean;best_visible boolean;ai jsonb;population jsonb;ally jsonb;group_member record;leash numeric;preferred numeric;speed numeric;gx numeric;gz numeric;power_hit boolean;
begin
 if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) or not pg_catalog.pg_try_advisory_xact_lock(731029,4) then return;end if;
 stamp:=extract(epoch from clock_timestamp());
 -- Multiple players synchronize independently. Sample presence only once per
 -- simulation step rather than repeating character scans for every creature.
 if not exists(select 1 from public.wilderness_mobs where stamp-coalesce((state->>'movedAt')::numeric,0)>=.15 and (state->>'status'<>'defeated' or stamp>=coalesce((state->>'respawnAt')::numeric,0))) then return;end if;
 select coalesce(jsonb_agg(jsonb_build_object('character_id',w.character_id,'position',w.position) order by w.character_id),'[]'::jsonb) into observers
 from public.world_players w join public.characters c on c.id=w.character_id
 where w.seen_at>clock_timestamp()-interval '5 seconds' and not w.dead and c.data->>'location'='pompelin' and public.game_health(c.data)>0;
 if jsonb_array_length(observers)=0 then return;end if;
 select coalesce(jsonb_agg(state order by spawn),'[]') into population from public.wilderness_mobs;
 for row in select * from public.wilderness_mobs order by spawn for update loop
  m:=row.state;dt:=stamp-coalesce((m->>'movedAt')::numeric,stamp);if dt<.15 then continue;end if;
  if dt>3 then m:=m||jsonb_build_object('windup',null,'enemyAttackAt',stamp+.8);end if;
  def:=catalog->'enemies'->(m->>'enemy');
  select value into site from jsonb_array_elements(catalog->'spawns') where value->>'id'=row.spawn;
  ai:=coalesce(def->'ai','{}');leash:=coalesce((ai->>'leash')::numeric,24);
  -- Attach behavior to existing generations without resetting a fight or corpse.
  m:=m||jsonb_build_object('habitat',site->'habitat','group',site->'group','leader',site->'leader','variant',site->'variant');
  if m->>'status'='idle' and not exists(select 1 from jsonb_to_recordset(observers) as p(character_id uuid,position jsonb) where power((p.position->>'x')::numeric-(m->>'x')::numeric,2)+power((p.position->>'z')::numeric-(m->>'z')::numeric,2)<6400) then continue;end if;
  if m->>'status'='defeated' then
   if stamp>=coalesce((m->>'respawnAt')::numeric,0) then select value into site from jsonb_array_elements(catalog->'spawns') where value->>'id'=row.spawn;m:=public.game_wilderness_fresh(site);else continue;end if;
  end if;
  -- With no observers time does not fast-forward attacks or movement.
  dt:=least(.5,greatest(0,dt));
  if m->>'status'='returning' then
   m:=m||jsonb_build_object('activity','return');
   m:=public.game_wilderness_move(m,(m->>'homeX')::numeric,(m->>'homeZ')::numeric,4.5,dt,stamp);
   if power((m->>'x')::numeric-(m->>'homeX')::numeric,2)+power((m->>'z')::numeric-(m->>'homeZ')::numeric,2)<.04 then
    m:=m||jsonb_build_object('status','idle','health',m->'maxHealth','x',m->'homeX','z',m->'homeZ','enemyAttackAt',stamp+1,'blockedAt',null,'trail','[]'::jsonb,'route','[]'::jsonb,'activity',coalesce(ai->>'idle','watch'),'nextIdleAt',stamp+2,'targetX',null,'targetZ',null);
   end if;
  else
   members:='{}';victim:=null;best:=-1;target_pos:=null;old_target:=m->>'target';best_visible:=false;
   -- Only an explicitly authored group can assist; unrelated packs never chain.
   if m->>'group' is not null then
    for ally in select value from jsonb_array_elements(population) where value->>'group'=m->>'group' and value->>'spawn'<>m->>'spawn' and value->>'status'='active' loop
     if power((ally->>'x')::numeric-(m->>'x')::numeric,2)+power((ally->>'z')::numeric-(m->>'z')::numeric,2)>power(coalesce((ai->>'assist')::numeric,6),2) or not public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(ally->>'x')::numeric,(ally->>'z')::numeric) then continue;end if;
     for group_member in select key,value from jsonb_each(ally->'members') loop
      if not(coalesce(m->'members','{}') ? group_member.key) then
       if ai->>'temperament'='defensive' and coalesce((group_member.value->>'damage')::numeric,0)<=0 then continue;end if;
       m:=public.game_wilderness_join(m,group_member.key::uuid);
      end if;
     end loop;
    end loop;
   end if;
   for player in select * from jsonb_to_recordset(observers) as p(character_id uuid,position jsonb,guard numeric) loop
    pos:=player.position;dx:=(pos->>'x')::numeric-(m->>'x')::numeric;dz:=(pos->>'z')::numeric-(m->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);member:=m->'members'->player.character_id::text;
    if sqrt(power((pos->>'x')::numeric-(m->>'homeX')::numeric,2)+power((pos->>'z')::numeric-(m->>'homeZ')::numeric,2))>leash then continue;end if;
    if member is null and (ai->>'temperament'='defensive' or distance>case when ai->>'temperament'='territorial' then coalesce((ai->>'territory')::numeric,3) else (def->>'aggro')::numeric end) then continue;end if;
    blocked:=not public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(pos->>'x')::numeric,(pos->>'z')::numeric);
    if member is null then
     if blocked then continue;end if;
     member:=jsonb_build_object('damage',0,'support',0,'threat',1,'contactAt',stamp);
    elsif distance>greatest((def->>'aggro')::numeric+5,(def->>'range')::numeric+3) and stamp-coalesce((member->>'contactAt')::numeric,0)>6 then continue;end if;
    if not blocked and distance<=greatest((def->>'aggro')::numeric+5,(def->>'range')::numeric+3) then member:=member||jsonb_build_object('contactAt',stamp);end if;
    if not blocked then member:=member||jsonb_build_object('seenAt',stamp);elsif stamp-coalesce((member->>'seenAt')::numeric,(member->>'contactAt')::numeric,0)>6 then continue;end if;
    members:=members||jsonb_build_object(player.character_id::text,member);
    -- Prefer a reachable participant over an obscured target. The 20% threat
    -- margin still prevents oscillation between equally reachable players.
    score:=coalesce((member->>'threat')::numeric,1)*case when player.character_id::text=old_target then 1.2 else 1 end;
    if victim is null or not blocked and not best_visible or (not blocked)=best_visible and (score>best or score=best and distance<sqrt(power((target_pos->>'x')::numeric-(m->>'x')::numeric,2)+power((target_pos->>'z')::numeric-(m->>'z')::numeric,2))) then best:=score;victim:=player.character_id::text;target_pos:=pos;best_visible:=not blocked;end if;
   end loop;
   m:=m||jsonb_build_object('members',members);
   if victim is null then
    if m->>'status'='active' then m:=m||jsonb_build_object('status','returning','target',null,'windup',null,'members','{}'::jsonb,'route','[]'::jsonb,'routeAt',0);
    elsif m->>'status'='idle' then m:=public.game_wilderness_ambient(m,site,def,dt,stamp);end if;
   else
    if victim is distinct from old_target then m:=m||jsonb_build_object('blockedAt',null);end if;
    m:=m||jsonb_build_object('status','active','activity','chase','target',victim,'targetX',target_pos->'x','targetZ',target_pos->'z','engagedAt',case when m->>'status'='active' then coalesce((m->>'engagedAt')::numeric,stamp) else stamp end);
    dx:=(target_pos->>'x')::numeric-(m->>'x')::numeric;dz:=(target_pos->>'z')::numeric-(m->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);
    if (m->>'windup')::numeric is not null and (m->>'windup')::numeric<=stamp then
     ax:=(m->>'aimX')::numeric-(m->>'x')::numeric;az:=(m->>'aimZ')::numeric-(m->>'z')::numeric;len:=greatest(.001,sqrt(ax*ax+az*az));
     -- Ordinary enemies strike their chosen opponent. Re-evaluate reach and
     -- cover at contact; no floor circles, charges or collateral area damage.
     for player in select * from jsonb_to_recordset(observers) as p(character_id uuid,position jsonb,guard numeric) where p.character_id::text=victim loop
      pos:=player.position;dx:=(pos->>'x')::numeric-(m->>'x')::numeric;dz:=(pos->>'z')::numeric-(m->>'z')::numeric;distance:=sqrt(dx*dx+dz*dz);
      hit:=distance<=(def->>'range')::numeric+.15;
      if hit and public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(pos->>'x')::numeric,(pos->>'z')::numeric) then
       insert into public.wilderness_events(character_id,instance_id,kind,payload) values(player.character_id,m->>'instanceId','damage',jsonb_build_object('amount',(def->>'damage')::numeric*coalesce((m->>'attackPower')::numeric,1)*public.game_guard_multiplier((select data from public.characters where id=player.character_id)),'mitigated',true,'at',stamp,'spawn',m->>'spawn'));
       m:=public.game_wilderness_join(m,player.character_id,0,(def->>'damage')::numeric*.25);
      end if;
     end loop;
     m:=m||jsonb_build_object('windup',null,'attackSeq',coalesce((m->>'attackSeq')::int,0)+1,'enemyAttackAt',stamp+(def->>'interval')::numeric+case when m->>'attackStyle'='heavy' then coalesce((ai->>'powerRecovery')::numeric,0) else 0 end,'attackPower',1,'attackStyle','normal');
    elsif (m->>'windup')::numeric is null then
     preferred:=coalesce((ai->>'preferredRange')::numeric,(def->>'range')::numeric-.1);
     if distance<coalesce((ai->>'retreatRange')::numeric,0) and distance>.05 then
      gx:=(m->>'x')::numeric-dx/distance*1.8;gz:=(m->>'z')::numeric-dz/distance*1.8;
      if power(gx-(m->>'homeX')::numeric,2)+power(gz-(m->>'homeZ')::numeric,2)<power(leash-1,2) and public.game_wilderness_clear(catalog->'habitats'->(m->>'habitat'),(m->>'x')::numeric,(m->>'z')::numeric,gx,gz) then
       m:=public.game_wilderness_move(m,gx,gz,(def->>'speed')::numeric*.75,dt,stamp)||jsonb_build_object('activity','backstep');
      end if;
     elsif distance>(def->>'range')::numeric then
      speed:=(def->>'speed')::numeric*case when stamp-coalesce((m->>'engagedAt')::numeric,stamp)<1.5 then coalesce((ai->>'pursuitBurst')::numeric,1) else 1 end;
      gx:=(target_pos->>'x')::numeric-dx/greatest(.001,distance)*preferred;gz:=(target_pos->>'z')::numeric-dz/greatest(.001,distance)*preferred;
      -- A short lateral approach gives knife fighters a distinct movement.
      if ai->>'behavior'='skirmisher' and distance>3.5 then
       gx:=gx-dz/distance*.85*case when coalesce((m->>'variant')::int,0)%2=0 then 1 else -1 end;
       gz:=gz+dx/distance*.85*case when coalesce((m->>'variant')::int,0)%2=0 then 1 else -1 end;
      end if;
      m:=public.game_wilderness_move(m,gx,gz,speed,dt,stamp);
      if coalesce((m->>'blockedAt')::numeric,stamp)+4<stamp then m:=m||jsonb_build_object('status','returning','target',null,'members','{}'::jsonb,'routeAt',0);end if;
     end if;
     distance:=sqrt(power((target_pos->>'x')::numeric-(m->>'x')::numeric,2)+power((target_pos->>'z')::numeric-(m->>'z')::numeric,2));
     if distance<=(def->>'range')::numeric and stamp>=coalesce((m->>'enemyAttackAt')::numeric,0) and m->>'status'='active' and public.game_rpg_sight('pompelin',(m->>'x')::numeric,(m->>'z')::numeric,(target_pos->>'x')::numeric,(target_pos->>'z')::numeric) then
      power_hit:=coalesce((ai->>'powerEvery')::int,0)>0 and (coalesce((m->>'attackSeq')::int,0)+1)%greatest(1,coalesce((ai->>'powerEvery')::int,1))=0;
      m:=m||jsonb_build_object('activity','attack','windup',stamp+case when power_hit then coalesce((ai->>'powerWindup')::numeric,.6) else least(.35,(def->>'windup')::numeric) end,'attackStyle',case when power_hit then 'heavy' else 'normal' end,'attackPower',case when power_hit then coalesce((ai->>'powerMultiplier')::numeric,1) else 1 end,'aimX',target_pos->'x','aimZ',target_pos->'z','lookX',target_pos->'x','lookZ',target_pos->'z');
     end if;
    end if;
   end if;
  end if;
  update public.wilderness_mobs set state=m||jsonb_build_object('movedAt',stamp),revision=revision+1 where spawn=row.spawn;
 end loop;
 -- Abandoned mailboxes are safe to discard only when their character no longer exists.
 delete from public.wilderness_events e where e.created_at<clock_timestamp()-interval '1 day' and not exists(select 1 from public.characters c where c.id=e.character_id);
end $$;

create or replace function public.game_combat_tick(p_id uuid,d jsonb,p_x double precision,p_z double precision) returns jsonb language plpgsql volatile security definer set search_path='' as $$ begin
 if d->>'location'='pompelin' then
  perform public.game_wilderness_world_tick();d:=public.game_wilderness_consume(p_id,d);
  return public.game_wilderness_context(p_id,d,p_x::numeric,p_z::numeric);
 end if;
 if exists(select 1 from public.wilderness_events where character_id=p_id) or exists(select 1 from public.wilderness_claims where character_id=p_id and expires_at<=extract(epoch from clock_timestamp())) then d:=public.game_wilderness_consume(p_id,d);end if;
 if d->'combatEncounter'->>'kind'='wilderness' then d:=d-'combatEncounter';end if;
 return public.game_story_combat_tick(p_id,d,p_x,p_z);
end $$;

create or replace function public.wilderness_action(p_character_id uuid,p_action text,p_spawn text default null,p_slot int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters;w public.world_players;m jsonb;before jsonb;secondary jsonb;old jsonb;result jsonb:='{}';e jsonb;loot jsonb;entry jsonb;i int;stamp numeric;begin
 c:=public.game_lock_character(p_character_id);
 select * into w from public.world_players where user_id=(select auth.uid()) and character_id=c.id and seen_at>clock_timestamp()-interval '15 seconds' for update;
 if not found or c.data->>'location' is distinct from 'pompelin' then raise exception 'Debes estar en Pompelín.';end if;
 if p_action is null or p_action not in('state','start','attack','skill','loot','stop') then raise exception 'COMBAT_INVALID_ACTION';end if;
 if not coalesce((select (value#>>'{}')::boolean from public.server_config where key='combat_enabled'),false) then raise exception 'COMBAT_UNAVAILABLE';end if;
 -- Lock order: own character, own presence, shared population. Never another character.
 perform pg_catalog.pg_advisory_xact_lock(731029,4);
 if p_action='state' then perform public.game_wilderness_world_tick();end if;
 stamp:=extract(epoch from clock_timestamp());c.data:=public.game_wilderness_consume(c.id,c.data);
 if p_action<>'state' and public.game_health(c.data)=0 then raise exception 'COMBAT_DEAD';end if;
 if p_action='start' then
  select state into m from public.wilderness_mobs where spawn=p_spawn for update;
  if m is null or m->>'status' not in('idle','active') then raise exception 'COMBAT_NO_TARGET';end if;
  if sqrt(power((w.position->>'x')::numeric-(m->>'x')::numeric,2)+power((w.position->>'z')::numeric-(m->>'z')::numeric,2))>10 or not public.game_rpg_sight('pompelin',(w.position->>'x')::numeric,(w.position->>'z')::numeric,(m->>'x')::numeric,(m->>'z')::numeric) then raise exception 'COMBAT_OUT_OF_RANGE';end if;
  if not public.game_has_weapon(c.data) then raise exception 'COMBAT_WEAPON_REQUIRED';end if;
  m:=public.game_wilderness_join(m,c.id);update public.wilderness_mobs set state=m,revision=revision+1 where spawn=p_spawn;
  c.data:=jsonb_set(c.data,'{wilderness}',coalesce(c.data->'wilderness','{}')||jsonb_build_object('selected',p_spawn));
 elsif p_action in('attack','skill') then
  c.data:=public.game_wilderness_context(c.id,c.data,(w.position->>'x')::numeric,(w.position->>'z')::numeric);
  select state into before from public.wilderness_mobs where spawn=c.data->'combatEncounter'->>'spawn' for update;
  if before is null or before->>'status' not in('active','idle') or p_spawn is not null and before->>'instanceId'<>p_spawn then
   result:=jsonb_build_object('cancelled',true,'damage',0,'healing',0);
  else
  c.data:=public.game_store(c.id,c.data);result:=public.game_wilderness_hit(c.id,p_action);select data into c.data from public.characters where id=c.id;
  m:=before||jsonb_build_object('health',result->'encounter'->'health');
  if coalesce((result->>'damage')::numeric,0)>0 then m:=public.game_wilderness_join(m,c.id,(result->>'damage')::numeric);end if;
  m:=public.game_wilderness_finish(m);update public.wilderness_mobs set state=m,revision=revision+1 where spawn=before->>'spawn';
  for secondary in select value from jsonb_array_elements(coalesce(result->'encounter'->'enemies','[]')) loop
   select state into old from public.wilderness_mobs where spawn=secondary->>'id' for update;
   if old->>'instanceId'=secondary->>'instanceId' and old->>'status' in('active','idle') and (secondary->>'health')::numeric<(old->>'health')::numeric then
    m:=public.game_wilderness_join(old||jsonb_build_object('health',secondary->'health'),c.id,(old->>'health')::numeric-(secondary->>'health')::numeric);m:=public.game_wilderness_finish(m);update public.wilderness_mobs set state=m,revision=revision+1 where spawn=secondary->>'id';
   end if;
  end loop;
  result:=result||jsonb_build_object('impact',jsonb_build_object('x',before->'x','z',before->'z','label',before->'label'));
  if coalesce((result->>'healing')::numeric,0)>0 then perform public.game_wilderness_heal_threat(c.id,c.id,(result->>'healing')::numeric);end if;
  c.data:=public.game_wilderness_consume(c.id,c.data);
  end if;
 elsif p_action='loot' then
  select encounter into e from public.wilderness_claims where character_id=c.id and instance_id=p_spawn for update;
  if e is null then raise exception 'LOOT_INVALID';end if;
  if sqrt(power((w.position->>'x')::numeric-(e->>'x')::numeric,2)+power((w.position->>'z')::numeric-(e->>'z')::numeric,2))>3 then raise exception 'Acércate al cuerpo.';end if;
  loot:=e->'loot';if p_slot is not null and (p_slot<0 or p_slot>=jsonb_array_length(loot)) then raise exception 'LOOT_INVALID';end if;
  for i in 0..jsonb_array_length(loot)-1 loop if p_slot is not null and i<>p_slot then continue;end if;entry:=loot->i;if entry='null'::jsonb then continue;end if;c.data:=public.game_rpg_give(c.data,public.game_rpg_new_item(entry->>'id',(entry->>'count')::int),false);loot:=jsonb_set(loot,array[i::text],'null'::jsonb);end loop;
  if not exists(select 1 from jsonb_array_elements(loot) item where item<>'null'::jsonb) then delete from public.wilderness_claims where character_id=c.id and instance_id=p_spawn;
  else update public.wilderness_claims set encounter=e||jsonb_build_object('loot',loot) where character_id=c.id and instance_id=p_spawn;end if;
 elsif p_action='stop' then
  -- Releasing a selection never pacifies hostile creatures or resets their health.
  c.data:=jsonb_set(c.data,'{wilderness}',coalesce(c.data->'wilderness','{}')-'selected');
 end if;
 c.data:=public.game_wilderness_context(c.id,c.data,(w.position->>'x')::numeric,(w.position->>'z')::numeric);c.data:=public.game_store(c.id,c.data);
 if public.game_health(c.data)=0 then update public.world_players set dead=true where character_id=c.id;end if;
 return result||jsonb_build_object('data',c.data,'vitals',public.game_public_vitals(c.data),'encounter',c.data->'combatEncounter','wilderness',public.game_wilderness_view(c.id),'attackCooldown',greatest(0,coalesce((c.data->>'combatNextAttack')::numeric,0)-extract(epoch from clock_timestamp())),'skillCooldown',greatest(0,coalesce((c.data->>'combatNextSkill')::numeric,0)-extract(epoch from clock_timestamp())));
end $$;

notify pgrst, 'reload schema';
commit;
