create or replace function public.game_rpg_near(d jsonb,job text,pos jsonb) returns boolean language sql immutable set search_path='' as $$
 select exists(select 1 from jsonb_each(public.game_rpg_catalog()->'stations') s where (s.value->>'job'=job or job in('minero','lenador','recolector') and s.value->>'job'='herreria') and s.value->>'location'=coalesce(d->>'location','brumaluz') and sqrt(power((pos->>'x')::numeric-(s.value->>'x')::numeric,2)+power((pos->>'z')::numeric-(s.value->>'z')::numeric,2))<=coalesce((s.value->>'radius')::numeric,4))
 or exists(select 1 from jsonb_array_elements(coalesce(d->'rpg'->'furniture','[]')) f where f->>'job'=job and f->>'location'=d->>'location' and sqrt(power((pos->>'x')::numeric-(f->>'x')::numeric,2)+power((pos->>'z')::numeric-(f->>'z')::numeric,2))<=4)
$$;

create or replace function public.rpg_action(p_character_id uuid,p_action text,p_args jsonb default '{}',p_request uuid default null,p_revision bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 c public.characters; w public.world_players;d jsonb;s jsonb; catalog jsonb:=public.game_rpg_catalog();
 stamp numeric:=extract(epoch from clock_timestamp());id text:=coalesce(p_args->>'id','');job text:=coalesce(p_args->>'job','');
 item jsonb;meta jsonb;recipe jsonb;task jsonb;jobs jsonb;newjobs jsonb;entry record;outitem jsonb;inv jsonb;tool jsonb;
 slot int;idx int;n int;amount int;rank int;tier int;xp int;next_rank int;cost numeric;start_at numeric;duration numeric;cursor_at numeric;
 energy numeric;max_d numeric;original numeric;current_d numeric;loss numeric;fraction numeric;mat text;found boolean:=false;receipt jsonb;count_jobs int;px numeric;pz numeric;yaw numeric;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED';end if;
 perform pg_catalog.pg_advisory_xact_lock(731029,3);
 c:=public.game_lock_character(p_character_id);d:=public.game_rpg_settle(c.data,stamp);s:=d->'rpg';
 if p_action='state' then return public.game_store(c.id,d);end if;
 if p_request is null then raise exception 'REQUEST_REQUIRED';end if;
 if coalesce(s->'requests','[]') ? p_request::text then return public.game_store(c.id,d);end if;
 if coalesce((s->>'revision')::bigint,0)<>p_revision then raise exception 'Tus oficios han cambiado. Actualiza la ventana.';end if;
 if public.game_health(d)=0 then raise exception 'Debes estar vivo.';end if;
 select * into w from public.world_players where character_id=c.id and user_id=auth.uid() and seen_at>now()-interval '15 seconds' for update;
 if not found then raise exception 'Entra en el mundo para realizar esta acción.';end if;
 -- Always use validated presence, never client-submitted positions.
 d:=d||jsonb_build_object('position',w.position);
 if p_action not in('state','gather_cancel') and d->'combatEncounter'->>'status'='active' and coalesce((d->'combatEncounter'->>'engaged')::boolean,false) then raise exception 'No puedes realizar esta acción durante el combate.';end if;
 if p_args ? 'slot' then slot:=(p_args->>'slot')::int;if slot not between 0 and 1000 then raise exception 'INVALID_SLOT';end if;end if;
 rank:=public.game_rpg_rank(s,job);

 if p_action='learn' then
  recipe:=catalog->'recipes'->id;
  if recipe is null or public.game_rpg_rank(s,recipe->>'job')<(recipe->>'tier')::int then raise exception 'No tienes el dominio necesario.';end if;
  if not public.game_rpg_near(d,recipe->>'job',w.position) then raise exception 'Acércate al taller de este oficio.';end if;
  if s->'learned' ? id then raise exception 'Ya conoces esta receta.';end if;
  if (recipe->>'tier')::int>0 then d:=public.game_rpg_consume(d,'receta_'||id,1);
  else if public.game_pelines(d)<2 then raise exception 'NOT_ENOUGH_PELINES';end if;d:=public.game_set_pelines(d,public.game_pelines(d)-2);end if;
  s:=jsonb_set(s,'{learned}',s->'learned'||to_jsonb(id));

 elsif p_action='craft' then
  recipe:=catalog->'recipes'->id;job:=recipe->>'job';tier:=(recipe->>'tier')::int;
  if recipe is null or not(s->'learned' ? id) or public.game_rpg_rank(s,job)<tier then raise exception 'Aprende la receta y domina su rango.';end if;
  if not public.game_rpg_near(d,job,w.position) then raise exception 'Acércate al taller de este oficio.';end if;
  amount:=coalesce((p_args->>'count')::int,1);if amount not between 1 and 99 then raise exception 'Cantidad no válida.';end if;
  duration:=(recipe->>'seconds')::numeric*case when d->>'race'='humano' then .85 else 1 end;
  select count(*) into count_jobs from jsonb_array_elements(s->'jobs') j where j->>'job'=job and not (j->>'done')::boolean;
  if duration>0 and count_jobs+amount>5 then raise exception 'Máximo cinco trabajos por oficio.';end if;
  for entry in select * from jsonb_each_text(recipe->'ingredients') loop d:=public.game_rpg_consume(d,entry.key,entry.value::int*amount);end loop;
  for n in 1..amount loop
   xp:=public.game_rpg_craft_xp(s,job,tier);outitem:=public.game_rpg_new_item(recipe->>'output',(recipe->>'count')::int);
   if duration=0 then
    if d->>'race'='elfo' and job='alquimia' and recipe->>'output' like 'pocion_%' and random()<.25 then outitem:=outitem||jsonb_build_object('count',(outitem->>'count')::int+1);end if;
    d:=public.game_rpg_give(d,outitem,false);
    s:=jsonb_set(s,array['xp',job],to_jsonb(coalesce((s->'xp'->>job)::int,0)+xp));s:=jsonb_set(s,array['crafts',job],to_jsonb(coalesce((s->'crafts'->>job)::int,0)+1));
   else
    select greatest(stamp,coalesce(max((j->>'end')::numeric),stamp)) into start_at from jsonb_array_elements(s->'jobs') j where j->>'job'=job and not (j->>'done')::boolean;
    task:=jsonb_build_object('id',gen_random_uuid()::text,'recipe',id,'job',job,'start',start_at,'end',start_at+duration,'done',false,'ingredients',recipe->'ingredients','output',outitem,'xp',xp);
    s:=jsonb_set(s,'{jobs}',s->'jobs'||jsonb_build_array(task));
   end if;
  end loop;

 elsif p_action in('cancel','collect','reorder') then
  select value into task from jsonb_array_elements(s->'jobs') where value->>'id'=id;
  if task is null then raise exception 'Ese trabajo ya no está disponible.';end if;job:=task->>'job';
  if not public.game_rpg_near(d,job,w.position) then raise exception 'Acércate a una estación del oficio.';end if;
  if p_action='collect' then
   if not (task->>'done')::boolean then raise exception 'El trabajo no ha terminado.';end if;d:=public.game_rpg_give(d,task->'output',false);
  elsif p_action='cancel' then
   if (task->>'done')::boolean then raise exception 'El trabajo ya ha terminado.';end if;
   for entry in select * from jsonb_each_text(task->'ingredients') loop s:=jsonb_set(s,'{deliveries}',s->'deliveries'||jsonb_build_array(public.game_rpg_new_item(entry.key,entry.value::int)));end loop;
  else
   if (task->>'done')::boolean or (task->>'start')::numeric<=stamp then raise exception 'Solo puedes mover trabajos pendientes.';end if;
  end if;
  select coalesce(jsonb_agg(value order by ord),'[]') into jobs from jsonb_array_elements(s->'jobs') with ordinality as a(value,ord) where value->>'id'<>id;
  if p_action='reorder' then
   select greatest(stamp,coalesce(max((j->>'end')::numeric),stamp)) into start_at from jsonb_array_elements(jobs) j where j->>'job'=job and not (j->>'done')::boolean and (j->>'start')::numeric<=stamp;
   duration:=(task->>'end')::numeric-(task->>'start')::numeric;task:=task||jsonb_build_object('start',start_at,'end',start_at+duration);
   jobs:=jsonb_build_array(task)||jobs;cursor_at:=start_at;
  else cursor_at:=stamp;end if;
  newjobs:='[]';
  for task in select value from jsonb_array_elements(jobs) with ordinality a(value,ord) order by case when value->>'job'<>job or (value->>'done')::boolean then 0 when (value->>'start')::numeric<=stamp then 1 when value->>'id'=id then 2 else 3 end,ord loop
   if task->>'job'=job and not (task->>'done')::boolean then
    duration:=(task->>'end')::numeric-(task->>'start')::numeric;
    if (task->>'start')::numeric>stamp then task:=task||jsonb_build_object('start',cursor_at,'end',cursor_at+duration);end if;
    cursor_at:=(task->>'end')::numeric;
   end if;newjobs:=newjobs||jsonb_build_array(task);
  end loop;s:=jsonb_set(s,'{jobs}',newjobs);

 elsif p_action='delivery' then
  item:=s->'deliveries'->slot;if item is null then raise exception 'El envío no existe.';end if;
  d:=public.game_rpg_give(d,item,false);s:=jsonb_set(s,'{deliveries}',(s->'deliveries')-slot);

 elsif p_action='tool' then
  item:=public.game_inventory(d)->slot;meta:=catalog->'items'->(item->>'id');job:=meta->>'tool';
  if job is null or item->>'count'<>'1' then raise exception 'Selecciona una herramienta.';end if;
  inv:=jsonb_set(public.game_inventory(d),array[slot::text],coalesce(s->'tools'->job,'null'));d:=d||jsonb_build_object('inventory',inv);
  s:=jsonb_set(s,array['tools',job],public.game_rpg_new_item(item->>'id',1)||item);

 elsif p_action='buy_tool' then
  if job not in('minero','lenador','recolector') or not public.game_rpg_near(d,'herreria',w.position) then raise exception 'Acércate al herrero.';end if;
  if public.game_pelines(d)<20 then raise exception 'NOT_ENOUGH_PELINES';end if;
  d:=public.game_set_pelines(d,public.game_pelines(d)-20);d:=public.game_rpg_give(d,public.game_rpg_new_item('herramienta_'||job||'_0',1),false);

 elsif p_action in('gather_start','gather_finish','gather_cancel') then
  if p_action='gather_cancel' then s:=jsonb_set(s,'{gathering}','null');
  else
   meta:=catalog->'nodes'->id;job:=meta->>'job';tier:=(meta->>'tier')::int;rank:=public.game_rpg_rank(s,job);tool:=s->'tools'->job;
   if meta is null or meta->>'location'<>d->>'location' or sqrt(power((w.position->>'x')::numeric-(meta->>'x')::numeric,2)+power((w.position->>'z')::numeric-(meta->>'z')::numeric,2))>3 then raise exception 'Acércate al recurso.';end if;
   if coalesce((tool->>'durability')::numeric,0)<=0 then raise exception 'Equipa o repara la herramienta del oficio.';end if;
   cost:=(array[1,2.5,8,25,70,120]::numeric[])[greatest(0,least(5,tier-rank))+1];
   if (s->>'energy')::numeric<cost then raise exception 'No tienes suficiente energía.';end if;
   if coalesce((s->'nodes'->>id)::numeric,0)>stamp then raise exception 'Este recurso todavía se está recuperando.';end if;
   if p_action='gather_start' then
    s:=jsonb_set(s,'{gathering}',jsonb_build_object('node',id,'start',stamp,'x',w.position->'x','z',w.position->'z','damageAt',d->'combat_at'));
   else
    if s->'gathering'->>'node' is distinct from id or stamp-(s->'gathering'->>'start')::numeric<(meta->>'seconds')::numeric
      or sqrt(power((w.position->>'x')::numeric-(s->'gathering'->>'x')::numeric,2)+power((w.position->>'z')::numeric-(s->'gathering'->>'z')::numeric,2))>.5
      or coalesce((d->>'combat_at')::numeric,0)>(s->'gathering'->>'start')::numeric then raise exception 'La extracción se ha interrumpido.';end if;
    d:=public.game_rpg_give(d,public.game_rpg_new_item(meta->>'item',1),false);
    s:=jsonb_set(s,'{energy}',to_jsonb((s->>'energy')::numeric-cost));
    loss:=.25*(1+greatest(0,tier-rank)*.5)*(1-rank*.03)*(1-(catalog->'items'->(tool->>'id')->>'tier')::int*.04);
    tool:=tool||jsonb_build_object('durability',greatest(0,(tool->>'durability')::numeric-loss));s:=jsonb_set(s,array['tools',job],tool);
    s:=jsonb_set(s,array['nodes',id],to_jsonb(stamp+(meta->>'respawn')::numeric));
    s:=jsonb_set(s,array['xp',job],to_jsonb(coalesce((s->'xp'->>job)::int,0)+public.game_rpg_xp(s,job,tier)));
    s:=jsonb_set(s,array['crafts',job],to_jsonb(coalesce((s->'crafts'->>job)::int,0)+1));s:=jsonb_set(s,'{gathering}','null');
    -- Rare, tradable recipe discoveries and restoration cores come from actual play.
    if random()<.002 then d:=jsonb_set(d,'{rpg}',s);d:=public.game_rpg_give(d,public.game_rpg_new_item('nucleo_restauracion',1),true);s:=d->'rpg';
    elsif random()<.08 then
     select key into mat from jsonb_each(catalog->'recipes') r where (r.value->>'tier')::int between 1 and least(5,greatest(1,tier)) order by random() limit 1;
     if mat is not null then d:=jsonb_set(d,'{rpg}',s);d:=public.game_rpg_give(d,public.game_rpg_new_item('receta_'||mat,1),true);s:=d->'rpg';end if;
    end if;
   end if;
  end if;

 elsif p_action in('repair','restore','restore_item') then
  if not public.game_rpg_near(d,'herreria',w.position) then raise exception 'Acércate al herrero.';end if;tool:=s->'tools'->job;
  if jsonb_typeof(tool) is distinct from 'object' then raise exception 'No hay herramienta equipada.';end if;
  original:=(tool->>'originalDurability')::numeric;max_d:=(tool->>'maxDurability')::numeric;current_d:=(tool->>'durability')::numeric;tier:=(catalog->'items'->(tool->>'id')->>'tier')::int;
  if p_action='repair' then
   fraction:=(max_d-current_d)/max_d;if fraction<=0 then raise exception 'La herramienta ya está reparada.';end if;
   loss:=original*.05*(1-rank*.03)*(1-tier*.04)*fraction;
   if max_d-loss<original*.2 then raise exception 'La herramienta necesita una restauración completa.';end if;
   cost:=ceil((10+10*tier)*fraction);if public.game_pelines(d)<cost then raise exception 'NOT_ENOUGH_PELINES';end if;
   d:=public.game_set_pelines(d,public.game_pelines(d)-cost::int);tool:=tool||jsonb_build_object('maxDurability',max_d-loss,'durability',max_d-loss);
  else
   if max_d=original and current_d=original then raise exception 'La herramienta no necesita restauración.';end if;
   if p_action='restore_item' then d:=public.game_rpg_consume(d,'nucleo_restauracion',1);
   else cost:=5+tier*2;if coalesce((d->'wallet'->>'lagrimas')::int,0)<cost then raise exception 'No tienes suficientes Lágrimas de fénix.';end if;d:=jsonb_set(d,'{wallet,lagrimas}',to_jsonb((d->'wallet'->>'lagrimas')::int-cost::int));end if;
   tool:=tool||jsonb_build_object('maxDurability',original,'durability',original);
  end if;s:=jsonb_set(s,array['tools',job],tool);

 elsif p_action='energy' then
  if (s->>'energy')::numeric>=100 then raise exception 'La energía está llena.';end if;
  if coalesce((d->'wallet'->>'lagrimas')::int,0)<5 then raise exception 'No tienes suficientes Lágrimas de fénix.';end if;
  d:=jsonb_set(d,'{wallet,lagrimas}',to_jsonb((d->'wallet'->>'lagrimas')::int-5));s:=jsonb_set(s,'{energy}','100');

 elsif p_action='enchant' then
  item:=public.game_inventory(d)->slot;meta:=catalog->'items'->(item->>'id');
  if p_args ? 'target' then idx:=(p_args->>'target')::int;if idx not between 0 and 24 or idx=slot then raise exception 'Selecciona un arma válida.';end if;tool:=public.game_inventory(d)->idx;
  else tool:=d->'equipment'->'weapon';end if;
  if meta->>'enchant' is null or public.game_equipment_item(tool->>'id')->>'slot' is distinct from 'weapon' or (public.game_equipment_item(tool->>'id')->>'tier')::int<(meta->>'tier')::int then raise exception 'El arma principal debe ser de calidad igual o superior al pergamino.';end if;
  tool:=tool||jsonb_build_object('instanceId',coalesce(tool->>'instanceId',gen_random_uuid()::text),'enchantment',jsonb_build_object('id',meta->>'enchant','grade',(meta->>'tier')::int));
  d:=public.game_rpg_consume(d,item->>'id',1);
  if p_args ? 'target' then d:=jsonb_set(d,array['inventory',idx::text],tool);else d:=jsonb_set(d,'{equipment,weapon}',tool)-'enchantState';end if;

 elsif p_action='mastery' then
  if not public.game_rpg_near(d,job,w.position) or not(catalog->'professions' ? job) then raise exception 'Acércate al maestro del oficio.';end if;
  next_rank:=coalesce((s->'mastery'->>job)::int,0)+1;
  if next_rank>3 or coalesce((s->'xp'->>job)::int,0)<(array[1500,4000,10000])[next_rank] or coalesce((s->'crafts'->>job)::int,0)<next_rank*50 then raise exception 'Faltan experiencia o prácticas para este proyecto de maestría.';end if;
  mat:=case when job in('minero','herreria','joyeria') then 'minero' when job in('lenador','carpinteria','ebanisteria') then 'lenador' else 'recolector' end;
  d:=public.game_rpg_consume(d,'material_'||mat||'_0',next_rank*20);d:=public.game_rpg_consume(d,'material_'||mat||'_'||(next_rank+1)::text,next_rank*10);
  s:=jsonb_set(s,array['mastery',job],to_jsonb(next_rank));
  select key into mat from jsonb_each(catalog->'recipes') r where r.value->>'job'=job and (r.value->>'tier')::int=next_rank+2 order by key limit 1;
  if mat is not null and not(s->'learned' ? mat) then s:=jsonb_set(s,'{learned}',s->'learned'||to_jsonb(mat));end if;

 elsif p_action='place' then
  item:=public.game_inventory(d)->slot;meta:=catalog->'items'->(item->>'id');
  if meta->>'furniture' is null or d->>'location'<>'casa_de_isberto_interior' or d->>'shadowQuest' is distinct from 'returned' then raise exception 'Este mueble requiere una casa habilitada.';end if;
  if jsonb_array_length(s->'furniture')>=30 then raise exception 'Máximo treinta muebles colocados.';end if;
  if meta->>'furniture'='estacion' and not(catalog->'professions' ? job) then raise exception 'Selecciona el oficio de la estación.';end if;
  yaw:=coalesce((p_args->>'yaw')::numeric,0);px:=(w.position->>'x')::numeric+sin(yaw)*1.8;pz:=(w.position->>'z')::numeric+cos(yaw)*1.8;
  if not public.game_rpg_sight(d->>'location',(w.position->>'x')::numeric,(w.position->>'z')::numeric,px,pz) or not public.game_rpg_sight(d->>'location',px-.9,pz,px+.9,pz) or not public.game_rpg_sight(d->>'location',px,pz-.6,px,pz+.6) or exists(select 1 from jsonb_array_elements(s->'furniture') f where f->>'location'=d->>'location' and sqrt(power((f->>'x')::numeric-px,2)+power((f->>'z')::numeric-pz,2))<1.8) then raise exception 'Busca un espacio despejado delante del personaje.';end if;
  s:=jsonb_set(s,'{furniture}',s->'furniture'||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'item',item,'location',d->>'location','x',px,'z',pz,'yaw',yaw,'job',case when meta->>'furniture'='estacion' then job else null end)));
  d:=public.game_remove_item(d,slot);
 elsif p_action='pickup' then
  select value into item from jsonb_array_elements(s->'furniture') where value->>'id'=id;
  if item is null or item->>'location'<>d->>'location' or sqrt(power((w.position->>'x')::numeric-(item->>'x')::numeric,2)+power((w.position->>'z')::numeric-(item->>'z')::numeric,2))>4 then raise exception 'Acércate al mueble.';end if;
  d:=public.game_rpg_give(d,item->'item',false);select coalesce(jsonb_agg(value),'[]') into jobs from jsonb_array_elements(s->'furniture') where value->>'id'<>id;s:=jsonb_set(s,'{furniture}',jobs);
 else raise exception 'Acción de oficio no válida.';end if;

 select coalesce(jsonb_agg(value),'[]') into receipt from (select value from jsonb_array_elements(coalesce(s->'requests','[]')) with ordinality a(value,ord) order by ord desc limit 255) a;
 s:=s||jsonb_build_object('revision',p_revision+1,'requests',receipt||to_jsonb(p_request::text));d:=d||jsonb_build_object('rpg',s);
 -- Inventory changes invalidate accepted offers; both participants must review again.
 update public.player_trades set revision=revision+1,accepted_a=false,accepted_b=false,offer_a=case when a=c.id then '{"items":[],"pelines":0}'::jsonb else offer_a end,offer_b=case when b=c.id then '{"items":[],"pelines":0}'::jsonb else offer_b end where status in('open','invited') and c.id in(a,b);
 return public.game_store(c.id,d);
end $$;
revoke all on function public.rpg_action(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function public.rpg_action(uuid,text,jsonb,uuid,bigint) to authenticated;
