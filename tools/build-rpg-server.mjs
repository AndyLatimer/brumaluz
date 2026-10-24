import fs from 'node:fs';
const read=p=>fs.readFileSync(`supabase/server/${p}`,'utf8');
function fn(source,name){const start=source.indexOf(`create or replace function public.${name}(`);if(start<0)throw new Error(name);const end=source.indexOf('$$;',source.indexOf('as $$',start))+3;return source.slice(start,end);}
function replace(s,a,b){if(!s.includes(a))throw new Error(`Missing patch: ${a}`);return s.replace(a,b);}
let combat=fn(read('07-combat.sql'),'combat_action');
const cadence=JSON.parse(fs.readFileSync('src/data/combatCadence.json','utf8'));
combat=replace(combat,"  cadence:=case cls when 'guerrero' then 1.5 when 'mago' then 1.8 when 'picaro' then 0.9\n    when 'clerigo' then 1.8 when 'explorador' then 1.7 else 0 end;",`  cadence:=case cls ${Object.entries(cadence).map(([cls,value])=>`when '${cls}' then ${value}`).join(' ')} else 0 end;`);
combat=replace(combat,"'skillCooldown',greatest", "'attackCooldown',greatest(0,coalesce((c.data->>'combatNextAttack')::numeric,0)-stamp),'skillCooldown',greatest");
combat=replace(combat,'  skill_rank int;','  skill_rank int;\n  e jsonb; es jsonb; grade int; extra numeric:=0; raw_basic numeric; actual_basic numeric; shield numeric; barrier numeric; recovered numeric:=0; counters int; bonus jsonb; events jsonb:=\'[]\'; packed jsonb; secondary jsonb; nearest numeric; secondary_index int; points numeric; target_index int; enemy_guard numeric;');
for(const name of ['damage','cost','resource','enemy_hp','each_hit','total_damage','healed'])combat=combat.replace(new RegExp(`  ${name} int`),`  ${name} numeric`);
combat=replace(combat,"  cls:=c.data->>'cls';","  cls:=c.data->>'cls';\n  bonus:=public.game_set_bonuses(c.data);\n  enemy_guard:=coalesce((encounter->>'guard')::numeric,0);\n  e:=c.data->'equipment'->'weapon'->'enchantment';\n  es:=coalesce(c.data->'enchantState','{}');\n  if es->>'weapon' is distinct from coalesce(c.data->'equipment'->'weapon'->>'instanceId',c.data->'equipment'->'weapon'->>'id') or stamp-coalesce((es->>'at')::numeric,0)>6 then es:='{}';end if;\n  es:=es||jsonb_build_object('weapon',coalesce(c.data->'equipment'->'weapon'->>'instanceId',c.data->'equipment'->'weapon'->>'id'));\n  grade:=least(5,greatest(1,coalesce((e->>'grade')::int,1)));" );
combat=replace(combat,'  damage:=round(damage*(1+0.05*(public.game_level(c.data)-1)))::int;',`  cadence:=cadence*public.game_weapon_tempo(c.data);
  damage:=damage*public.game_power_multiplier(c.data)*(1+(bonus->>'power')::numeric)*public.game_weapon_tempo(c.data);
  raw_basic:=damage;`);
combat=combat.replace("enemy_hp:=(encounter->>'health')::int;","enemy_hp:=(encounter->>'health')::numeric;");
combat=replace(combat,"  c.data:=public.game_store(c.id,c.data);","  c.data:=c.data||jsonb_build_object('combatVisual',jsonb_build_object('at',stamp,'action',case when skill then 'skill' else 'attack' end));\n  c.data:=public.game_store(c.id,c.data);");
combat=replace(combat,'  resource:=(public.game_public_vitals(c.data)->>\'resource\')::int;',"  cost:=cost*(1-(bonus->>'skillCost')::numeric);\n  resource:=(public.game_public_vitals(c.data)->>'resource')::numeric;");
combat=replace(combat,"    if distance>attack_range then raise exception 'COMBAT_OUT_OF_RANGE'; end if;","    if distance>attack_range then raise exception 'COMBAT_OUT_OF_RANGE'; end if;\n    if not public.game_rpg_sight(c.data->>'location',(w.position->>'x')::numeric,(w.position->>'z')::numeric,(encounter->>'x')::numeric,(encounter->>'z')::numeric) then raise exception 'El objetivo no está en tu línea de visión.';end if;");
combat=replace(combat,'  resource:=resource-cost;',"  cost:=cost+coalesce((c.data->>'resourceCostFraction')::numeric,0);\n  resource:=resource-floor(cost);\n  c.data:=c.data||jsonb_build_object('resourceCostFraction',cost-floor(cost));");
combat=replace(combat,"    healed:=least(public.game_equipment_stat(c.data,'healing')+4*(skill_rank-1),public.game_max_health(c.data)-hp);",`    recovered:=(public.game_equipment_stat(c.data,'healing')+4*(skill_rank-1))*public.game_power_multiplier(c.data)*(1+(bonus->>'healing')::numeric)*(1+(bonus->>'skillPower')::numeric)+coalesce((c.data->>'health_regen')::numeric,0);
    healed:=least(floor(recovered),public.game_max_health(c.data)-hp);
    c.data:=c.data||jsonb_build_object('health_regen',case when hp+healed>=public.game_max_health(c.data) then 0 else recovered-floor(recovered) end);`);
combat=replace(combat,'/case when cls=\'picaro\' then 8 else 10 end)::int;',"/case when cls='picaro' then 8 else 10 end)*public.game_power_multiplier(c.data)*(1+(bonus->>'power')::numeric)*(1+(bonus->>'skillPower')::numeric);");
combat=replace(combat,'    for i in 1..hits loop',`    if not skill and e is not null then
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
    for i in 1..hits loop`);
combat=replace(combat,"    encounter:=encounter||jsonb_build_object(\n      'health',enemy_hp",`    if not skill and extra>0 then extra:=least(enemy_hp,extra*(1-least(.6,enemy_guard/(enemy_guard+20))));enemy_hp:=greatest(0,enemy_hp-extra);total_damage:=total_damage+extra;end if;
    if not skill and e->>'id'='vampirism' then
      recovered:=actual_basic*(.01+grade*.01)+coalesce((c.data->>'health_regen')::numeric,0);
      healed:=least(floor(recovered),public.game_max_health(c.data)-hp);hp:=hp+healed;
      c.data:=c.data||jsonb_build_object('health',hp,'health_regen',case when hp>=public.game_max_health(c.data) then 0 else recovered-floor(recovered) end);
      events:=events||jsonb_build_array(jsonb_build_object('kind','vampirism','amount',healed));
    end if;
    c.data:=c.data||jsonb_build_object('enchantState',es);
    encounter:=encounter||jsonb_build_object(
      'health',enemy_hp`);
// Do not round the base of offensive skills before attributes/sets/mitigation.
combat=combat.replace('each_hit:=round((each_hit+','each_hit:=((each_hit+');
combat=replace(combat,"    'damage',total_damage,'healing',healed,","    'damage',total_damage,'healing',healed,'events',events,'action',case when skill then 'skill' else 'attack' end,'enchantState',c.data->'enchantState',");
let tick=fn(read('06-world-presence.sql'),'game_combat_tick');
tick=replace(tick,'begin\n  if not coalesce',"begin\n  if encounter->>'kind'='expedition' then return d;end if;\n  if not coalesce");
tick=replace(tick,'  incoming int;','  incoming numeric; barrier numeric; blocked numeric; fraction numeric;');
tick=replace(tick,"  incoming := greatest(1,8-public.game_equipment_stat(d,'guard'));",`  incoming:=8*public.game_guard_multiplier(d);
  barrier:=case when coalesce((d->'enchantState'->>'barrierUntil')::numeric,0)>stamp then coalesce((d->'enchantState'->>'barrier')::numeric,0) else 0 end;
  blocked:=least(incoming,barrier);incoming:=incoming-blocked;
  if d ? 'enchantState' then d:=jsonb_set(d,'{enchantState,barrier}',to_jsonb(greatest(0,barrier-blocked)));end if;
  fraction:=incoming+coalesce((d->>'incomingFraction')::numeric,0);incoming:=floor(fraction);d:=d||jsonb_build_object('incomingFraction',fraction-incoming);`);
tick=replace(tick,"  return jsonb_set(d,'{combatEncounter}',encounter);","  if hp=0 then d:=d-'enchantState';end if;\n  return jsonb_set(d,'{combatEncounter}',encounter);");
let store=fn(read('03-formulas.sql'),'game_store');store=replace(store,'  d := public.game_food_data(p_id,d);','  d := public.game_rpg_settle(d,extract(epoch from clock_timestamp()));\n  d := public.game_food_data(p_id,d);');
store=replace(store,'  update public.characters set data =',"  d:=d||jsonb_build_object('serverRevision',coalesce((select (data->>'serverRevision')::bigint from public.characters where id=p_id),0)+1);\n  update public.characters set data =");
let regen=fn(read('06-world-presence.sql'),'game_regen_data');
const resourceStart=regen.indexOf('  max_resource :='),resourceEnd=regen.indexOf('  health_rate :=');
if(resourceStart<0||resourceEnd<=resourceStart)throw new Error('Resource regeneration formula not found');
regen=replace(regen,regen.slice(resourceStart,resourceEnd),'  max_resource := public.game_rpg_resource_max(d);\n\n');
let publicCharacter=fn(read('06-world-presence.sql'),'game_public_character');publicCharacter=replace(publicCharacter,"    'name', 'title', 'level'","    'combatVisual', 'name', 'title', 'level'");
let change=fn(read('12-trade-inventory.sql'),'change_equipment');change=replace(change,'    target:=coalesce(equipment->p_slot,\'null\'::jsonb);',"    target:=coalesce(equipment->p_slot,'null'::jsonb);\n    source:=source||jsonb_build_object('bound',true,'instanceId',coalesce(source->>'instanceId',gen_random_uuid()::text));");
change=replace(change,"  changed:=c.data||jsonb_build_object('inventory',inv,'equipment',equipment);","  changed:=c.data||jsonb_build_object('inventory',inv,'equipment',equipment);\n  if p_slot='weapon' then changed:=changed-'enchantState';end if;");
// Validate exact copies, not just catalogue ID, for optimistic inventory/equipment operations.
change=replace(change,"    or source->>'id' is distinct from p_expected->>'id'", "    or source-'bound' is distinct from p_expected-'bound'\n    or source->>'id' is distinct from p_expected->>'id'");
let offer=fn(read('12-trade-inventory.sql'),'game_trade_offer');offer=replace(offer,"result:=result||jsonb_build_array(jsonb_build_object('slot',idx,'id',slot->>'id','count',n));","result:=result||jsonb_build_array(slot||jsonb_build_object('slot',idx,'count',n));");
let tradeAdd=fn(read('12-trade-inventory.sql'),'game_trade_add');tradeAdd=replace(tradeAdd,"    for i in 1..(entry->>'count')::int loop d:=public.game_add_item(d,entry->>'id'); end loop;","    d:=public.game_rpg_give(d,entry-'slot',false);");
let place=fn(read('15-bank.sql'),'game_place_item');place=replace(place,"  if target->>'id'=p_item->>'id'", "  if target-'count'-'bound'=p_item-'count'-'bound'\n    and target->>'id'=p_item->>'id'");
let move=fn(read('12-trade-inventory.sql'),'move_inventory_item');move=move.replace("actual->>'id' is distinct from expected->>'id'","actual-'bound' is distinct from expected-'bound' or actual->>'id' is distinct from expected->>'id'");
fs.writeFileSync('supabase/server/21-rpg-combat.sql',`-- Generated from authoritative existing entry points by tools/build-rpg-server.mjs.\n${[combat,tick,regen,store,change,offer,tradeAdd,place,move,publicCharacter].join('\n\n')}\n`);
console.log('Generated combat and object-preservation RPC overrides.');
let food=fn(read('03-formulas.sql'),'game_food_data');food=replace(food,"if d -> 'foodBuff' ->> 'itemId' = 'pan_duro' then","if public.game_item(d->'foodBuff'->>'itemId')->>'food_seconds' is not null then");food=replace(food,"jsonb_build_object('itemId','pan_duro','remaining',remaining)","jsonb_build_object('itemId',d->'foodBuff'->>'itemId','remaining',remaining)");
let use=fn(read('05-items-vendors.sql'),'use_item');use=replace(use,"  if item -> 'resource_pct' is not null then",`  if item ? 'resource_pct' or item ? 'heal_pct' then
    if coalesce((d->>'potionReadyAt')::numeric,0)>extract(epoch from clock_timestamp()) then raise exception 'Las pociones todavía se están recuperando.';end if;
    d:=d||jsonb_build_object('potionReadyAt',extract(epoch from clock_timestamp())+15);
  end if;
  if item -> 'resource_pct' is not null then`);
fs.writeFileSync('supabase/server/23-rpg-consumables.sql',`${food}\n\n${use}\n`);
