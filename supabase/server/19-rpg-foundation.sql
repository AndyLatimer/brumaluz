-- RPG rules: all helpers private; player mutations go through locked authenticated RPCs.
create or replace function public.game_set_bonuses(d jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='{"power":0,"healing":0,"guard":0,"maxHealth":0,"maxResource":0,"skillPower":0,"skillCost":0}'; fam int; tiers int[]; item jsonb; meta jsonb; two int; four int; stat text; v numeric; slot text;
begin
 for fam in 0..1 loop
  tiers:='{}';
  foreach slot in array array['head','chest','hands','legs'] loop
   item:=d->'equipment'->slot; meta:=public.game_rpg_catalog()->'sets'->(item->>'id');
   if item->>'count'='1' and meta->>'cls'=d->>'cls' and meta->>'slot'=slot and (meta->>'family')::int=fam then tiers:=array_append(tiers,(meta->>'tier')::int);end if;
  end loop;
  select array_agg(t order by t desc) into tiers from unnest(tiers) t;
  two:=case when cardinality(tiers)>=2 then tiers[2] else 0 end;
  four:=case when cardinality(tiers)=4 then tiers[4] else 0 end;
  if two>=1 then
   stat:=case when fam=1 then case when d->>'cls'='guerrero' then 'power' when d->>'cls'='picaro' then 'guard' else 'maxResource' end when d->>'cls'='guerrero' then 'guard' when d->>'cls'='clerigo' then 'healing' else 'power' end;
   v:=(two+1)::numeric/100*case when stat='maxResource' then 2 else 1 end;
   result:=jsonb_set(result,array[stat],to_jsonb((result->>stat)::numeric+v));
  end if;
  if four>=2 then
   stat:=case when d->>'cls'='guerrero' and fam=0 then 'maxHealth' when fam=1 and d->>'cls'<>'guerrero' then 'skillCost' else 'skillPower' end;
   v:=case when stat='skillPower' then .09+(four-2)*.05 else .05+(four-2)*.02 end;
   result:=jsonb_set(result,array[stat],to_jsonb((result->>stat)::numeric+v));
  end if;
 end loop;
 return result;
end $$;

create or replace function public.game_power_multiplier(d jsonb) returns numeric language sql immutable set search_path='' as $$
 select (1+.01*public.game_attr_total(d,case d->>'cls' when 'guerrero' then 'fuerza' when 'picaro' then 'agilidad' when 'explorador' then 'agilidad' else 'intelecto' end))*(1+.02*(public.game_level(d)-1))
$$;
create or replace function public.game_guard_multiplier(d jsonb) returns numeric language sql immutable set search_path='' as $$
 with g as(select public.game_equipment_stat(d,'guard')*(1+(public.game_set_bonuses(d)->>'guard')::numeric) as n) select 1-least(.6,n/(n+20)) from g
$$;
create or replace function public.game_weapon_tempo(d jsonb) returns numeric language sql immutable set search_path='' as $$
 select case when d->'equipment'->'weapon'->>'id' ~ 'sable|daga_luna|daga_espina' then .85 when d->'equipment'->'weapon'->>'id' ~ 'meteoro|forja|solar' then 1.15 else 1 end
$$;
create or replace function public.game_rpg_food_bonus(d jsonb,stat text) returns int language sql immutable set search_path='' as $$
 select case when coalesce((d->'foodBuff'->>'remaining')::numeric,0)<=0 then 0 when d->'foodBuff'->>'itemId'='pan_duro' then case when stat='maxHealth' then 5 else 3 end else coalesce((public.game_rpg_catalog()->'items'->(d->'foodBuff'->>'itemId')->'foodEffect'->>stat)::int,0) end
$$;
create or replace function public.game_max_health(d jsonb) returns int language sql immutable set search_path='' as $$
 select floor((60+(public.game_level(d)-1)*12+public.game_equipment_stat(d,'maxHealth'))*(1+.02*public.game_attr_total(d,'corpulencia'))*(1+(public.game_set_bonuses(d)->>'maxHealth')::numeric)*(1+least(greatest(coalesce((d->>'partyPeers')::int,0),0),3)*.015))::int
 +public.game_rpg_food_bonus(d,'maxHealth')
$$;
create or replace function public.game_rpg_resource_max(d jsonb) returns int language sql immutable set search_path='' as $$
 select floor(((public.game_level(d)-1)*6+case when d->>'cls' in('mago','clerigo') then 30+public.game_attr_total(d,'intelecto')*7 else 50+public.game_attr_total(d,'agilidad')*3+public.game_attr_total(d,'corpulencia')*3 end+public.game_equipment_stat(d,'maxResource'))*(1+(public.game_set_bonuses(d)->>'maxResource')::numeric)*(1+least(greatest(coalesce((d->>'partyPeers')::int,0),0),3)*.015))::int
 +public.game_rpg_food_bonus(d,'maxResource')
$$;
create or replace function public.game_public_vitals(d jsonb) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('serverRevision',coalesce((d->>'serverRevision')::bigint,0),'health',case when coalesce((d->>'health')::numeric,-1)<0 then public.game_max_health(d) else least((d->>'health')::numeric,public.game_max_health(d)) end,'maxHealth',public.game_max_health(d),'resourceKind',case when d->>'cls' in('mago','clerigo') then 'mana' else 'stamina' end,'resource',case when coalesce((d->>'resource')::numeric,-1)<0 then public.game_rpg_resource_max(d) else least(greatest((d->>'resource')::numeric,0),public.game_rpg_resource_max(d)) end,'maxResource',public.game_rpg_resource_max(d),'overheal',public.game_overheal_now(d),'barrier',case when (d->'enchantState'->>'barrierUntil')::numeric>extract(epoch from now()) then coalesce((d->'enchantState'->>'barrier')::numeric,0) else 0 end)
$$;

create or replace function public.game_rpg_new_item(p_id text,p_count int default 1) returns jsonb language plpgsql volatile set search_path='' as $$
declare result jsonb:=jsonb_build_object('id',p_id,'count',p_count); m jsonb:=public.game_rpg_catalog()->'items'->p_id;
begin
 if (m->>'stack')::int=1 or public.game_equipment_item(p_id) is not null then result:=result||jsonb_build_object('instanceId',gen_random_uuid()::text);end if;
 if m ? 'tool' then result:=result||'{"durability":100,"maxDurability":100,"originalDurability":100}'::jsonb;end if;
 return result;
end $$;
create or replace function public.game_stack_into(p_slots jsonb,p_item jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare slots jsonb:=p_slots; item jsonb; remaining int:=(p_item->>'count')::int; cap int:=greatest(coalesce((public.game_item(p_item->>'id')->>'stack')::int,50),1); n int;i int;
begin
 if p_item ? 'instanceId' then cap:=1;end if;
 if cap>1 then
  for i in 0..jsonb_array_length(slots)-1 loop
   item:=slots->i;
   if jsonb_typeof(item)='object' and (item-'count'-'bound')=(p_item-'count'-'bound') and coalesce((item->>'bound')::boolean,false)=coalesce((p_item->>'bound')::boolean,false) then
    n:=least(remaining,greatest(0,cap-(item->>'count')::int));remaining:=remaining-n;slots:=jsonb_set(slots,array[i::text],item||jsonb_build_object('count',(item->>'count')::int+n));
   end if;
  end loop;
 end if;
 for i in 0..jsonb_array_length(slots)-1 loop
  exit when remaining<=0;
  if jsonb_typeof(slots->i) is distinct from 'object' then n:=least(cap,remaining);slots:=jsonb_set(slots,array[i::text],p_item||jsonb_build_object('count',n));remaining:=remaining-n;end if;
 end loop;
 if remaining>0 then return null;end if;return slots;
end $$;
create or replace function public.game_rpg_give(d jsonb,item jsonb,p_defer boolean default false) returns jsonb language plpgsql immutable set search_path='' as $$
declare inv jsonb:=public.game_stack_into(public.game_inventory(d),item);
begin
 if inv is not null then return d||jsonb_build_object('inventory',inv);end if;
 if not p_defer then raise exception 'Tu mochila está llena.';end if;
 return jsonb_set(d,'{rpg}',coalesce(d->'rpg','{}')||jsonb_build_object('deliveries',coalesce(d->'rpg'->'deliveries','[]')||jsonb_build_array(item)));
end $$;
create or replace function public.game_add_item(d jsonb,p_item text) returns jsonb language plpgsql volatile set search_path='' as $$
declare item jsonb;
begin
 if public.game_item(p_item) is null then raise exception 'INVALID_ITEM';end if;
 item:=public.game_rpg_new_item(p_item,1)||jsonb_build_object('bound',coalesce((public.game_item(p_item)->>'bound')::boolean,false));return public.game_rpg_give(d,item,false);
end $$;
create or replace function public.game_rpg_consume(d jsonb,p_item text,p_count int) returns jsonb language plpgsql immutable set search_path='' as $$
declare inv jsonb:=public.game_inventory(d); remaining int:=p_count; item jsonb;n int;i int;
begin
 for i in 0..24 loop
  item:=inv->i;if item->>'id' is distinct from p_item then continue;end if;n:=least(remaining,(item->>'count')::int);remaining:=remaining-n;
  inv:=jsonb_set(inv,array[i::text],case when n=(item->>'count')::int then 'null'::jsonb else item||jsonb_build_object('count',(item->>'count')::int-n) end);exit when remaining=0;
 end loop;
 if remaining>0 then raise exception 'Faltan materiales: %',p_item;end if;return d||jsonb_build_object('inventory',inv);
end $$;
create or replace function public.game_rpg_rank(s jsonb,job text) returns int language sql immutable set search_path='' as $$
 select least(case when coalesce((s->'xp'->>job)::numeric,0)>=10000 then 5 when coalesce((s->'xp'->>job)::numeric,0)>=4000 then 4 when coalesce((s->'xp'->>job)::numeric,0)>=1500 then 3 when coalesce((s->'xp'->>job)::numeric,0)>=500 then 2 when coalesce((s->'xp'->>job)::numeric,0)>=100 then 1 else 0 end,2+coalesce((s->'mastery'->>job)::int,0))
$$;
create or replace function public.game_rpg_xp(s jsonb,job text,tier int) returns int language sql immutable set search_path='' as $$
 select case when tier<public.game_rpg_rank(s,job)-1 then 0 when tier<public.game_rpg_rank(s,job) then 4 else 10+least(10,greatest(0,tier-public.game_rpg_rank(s,job))*3) end
$$;
create or replace function public.game_rpg_craft_xp(s jsonb,job text,tier int) returns int language sql immutable set search_path='' as $$
 select public.game_rpg_xp(s,job,tier)*power(3,tier)::int
$$;
create or replace function public.game_rpg_settle(d jsonb,stamp numeric) returns jsonb language plpgsql volatile set search_path='' as $$
declare s jsonb:=coalesce(d->'rpg','{}'); jobs jsonb:='[]';task jsonb;job text; slot text;item jsonb;inv jsonb;eq jsonb;extras jsonb:='[]';copy jsonb;
begin
 s:='{"version":1,"energy":100,"xp":{},"mastery":{},"learned":[],"tools":{},"jobs":[],"deliveries":[],"nodes":{},"gathering":null,"crafts":{},"projects":{},"furniture":[]}'::jsonb||s;
 s:=s||jsonb_build_object('energy',least(100,coalesce((s->>'energy')::numeric,100)+greatest(0,stamp-coalesce((s->>'at')::numeric,stamp))*100/16560),'at',stamp);
 for task in select value from jsonb_array_elements(s->'jobs') order by (value->>'end')::numeric loop
  if not coalesce((task->>'done')::boolean,false) and (task->>'end')::numeric<=stamp then
   job:=task->>'job';task:=task||'{"done":true}'::jsonb;
   s:=jsonb_set(s,array['xp',job],to_jsonb(coalesce((s->'xp'->>job)::int,0)+public.game_rpg_craft_xp(s,job,(public.game_rpg_catalog()->'recipes'->(task->>'recipe')->>'tier')::int)));
   s:=jsonb_set(s,array['crafts',job],to_jsonb(coalesce((s->'crafts'->>job)::int,0)+1));
  end if;jobs:=jobs||jsonb_build_array(task);
 end loop;
 s:=s||jsonb_build_object('jobs',jobs);d:=d||jsonb_build_object('rpg',s);
 inv:=public.game_inventory(d);eq:=coalesce(d->'equipment','{}');
 for i in 0..24 loop
  item:=inv->i;
  if jsonb_typeof(item)='object' and (public.game_equipment_item(item->>'id') is not null or public.game_rpg_catalog()->'items'->(item->>'id')->>'stack'='1') then
   for j in 2..greatest(1,coalesce((item->>'count')::int,1)) loop
    extras:=extras||jsonb_build_array(public.game_rpg_new_item(item->>'id',1)||(item-'instanceId')||jsonb_build_object('count',1));
   end loop;
   if not(item ? 'instanceId') then item:=public.game_rpg_new_item(item->>'id',1)||item;end if;
   inv:=jsonb_set(inv,array[i::text],item||jsonb_build_object('count',1));
  end if;
 end loop;
 foreach slot in array array['head','chest','hands','legs','weapon','offhand','ring','pendant','trinket'] loop
  item:=eq->slot;if jsonb_typeof(item)='object' and not(item ? 'instanceId') then eq:=jsonb_set(eq,array[slot],public.game_rpg_new_item(item->>'id',1)||item);end if;
 end loop;
 d:=d||jsonb_build_object('inventory',inv,'equipment',eq);
 for copy in select value from jsonb_array_elements(extras) loop d:=public.game_rpg_give(d,copy,true);end loop;
 return d;
end $$;
