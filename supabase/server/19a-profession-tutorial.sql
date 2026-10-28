-- Optional profession lesson. Progress comes only from validated normal actions.
create or replace function public.game_profession_tutorial_action(d jsonb,p_action text,p_args jsonb,pos jsonb,stamp numeric)
returns jsonb language plpgsql volatile set search_path='' as $$
declare catalog jsonb:=public.game_rpg_catalog();defs jsonb:=catalog->'professionTutorial';s jsonb:=d->'rpg';q jsonb:=s->'tutorial';cfg jsonb;target jsonb;job text;lvl int;xp int;
begin
 if p_action='tutorial_accept' then
  if q is not null and q<>'null'::jsonb then raise exception 'Ya tienes una iniciación de oficio elegida.';end if;
  if jsonb_typeof(d->'welcome')='object' and (d->'welcome'->>'stage' is distinct from 'completed' or d->>'shadowQuest' is distinct from 'returned') then raise exception 'Termina primero la bienvenida y el regreso con Isberto.';end if;
  job:=p_args->>'job';cfg:=defs->'jobs'->job;if cfg is null then raise exception 'Elige un oficio válido.';end if;
  target:=case when d->>'shadowQuest'='returned' then defs->'mentor' else defs->'legacyMentor' end;
  if p_args->>'master' is distinct from 'gnomi' then raise exception 'Habla con Gnomi para elegir tu iniciación.';end if;
 else
  if q->>'status' is distinct from 'active' then raise exception 'No tienes una iniciación de oficio pendiente.';end if;
  job:=q->>'job';cfg:=defs->'jobs'->job;target:=catalog->'teachers'->job;
  if p_args->>'master' is distinct from target->>'id' then raise exception 'Habla con el maestro del oficio elegido.';end if;
 end if;
 if target is null or d->>'location' is distinct from target->>'location' or sqrt(power((pos->>'x')::numeric-(target->>'x')::numeric,2)+power((pos->>'z')::numeric-(target->>'z')::numeric,2))>coalesce((target->>'radius')::numeric,3) then raise exception 'Acércate al interlocutor de la misión.';end if;
 if p_action='tutorial_accept' then
  q:=jsonb_build_object('job',job,'status','active','visited',false,'equipped',coalesce((s->'tools'->(cfg->>'gatherJob')->>'durability')::numeric,0)>0,'gathered',0,'crafted',0,'collected',0,'delivered',false,'jobIds','[]'::jsonb,'startedAt',stamp);
 elsif p_action='tutorial_visit' then q:=q||jsonb_build_object('visited',true,'equipped',coalesce((q->>'equipped')::boolean,false) or coalesce((s->'tools'->(cfg->>'gatherJob')->>'durability')::numeric,0)>0);
 elsif p_action='tutorial_complete' then
  if not coalesce((q->>'visited')::boolean,false) or not coalesce((q->>'equipped')::boolean,false) or coalesce((q->>'gathered')::int,0)<1 or not coalesce((q->>'delivered')::boolean,false) or cfg->>'recipe' is not null and (coalesce((q->>'collected')::int,0)<2 or not(s->'learned' ? (cfg->>'recipe'))) then raise exception 'Completa los pasos normales del oficio antes de entregar la misión.';end if;
  lvl:=public.game_level(d);xp:=coalesce((d->>'experience')::int,0);
  if lvl<50 then xp:=xp+(defs->'reward'->>'experience')::int;while lvl<50 and xp>=public.game_xp_needed(lvl) loop xp:=xp-public.game_xp_needed(lvl);lvl:=lvl+1;end loop;if lvl>=50 then xp:=public.game_xp_needed(50);end if;end if;
  d:=d||jsonb_build_object('level',lvl,'experience',xp);q:=q||jsonb_build_object('status','completed','completedAt',stamp);
 else raise exception 'Acción de iniciación no válida.';end if;
 return jsonb_set(d,'{rpg,tutorial}',q);
end $$;
revoke all on function public.game_profession_tutorial_action(jsonb,text,jsonb,jsonb,numeric) from public,anon,authenticated;

create or replace function public.game_profession_tutorial_event(d jsonb,p_action text,p_args jsonb,previous jsonb)
returns jsonb language plpgsql volatile set search_path='' as $$
declare s jsonb:=d->'rpg';q jsonb:=s->'tutorial';catalog jsonb;cfg jsonb;recipe jsonb;node jsonb;item jsonb;task jsonb;ids jsonb;amount int;
begin
 if q->>'status' is distinct from 'active' then return d;end if;
 catalog:=public.game_rpg_catalog();
 cfg:=catalog->'professionTutorial'->'jobs'->(q->>'job');if cfg is null then return d;end if;
 if p_action='tool' then
  if coalesce((s->'tools'->(cfg->>'gatherJob')->>'durability')::numeric,0)>0 then q:=q||'{"equipped":true}'::jsonb;end if;
 end if;
 if not coalesce((q->>'visited')::boolean,false) then return jsonb_set(d,'{rpg,tutorial}',q);end if;
 recipe:=catalog->'recipes'->(cfg->>'recipe');ids:=coalesce(q->'jobIds','[]');
 if p_action='gather_finish' then
  node:=catalog->'nodes'->(p_args->>'id');item:=case when recipe is null then catalog->'dailyOrders'->'orders'->(cfg->>'order')->'ingredients' else recipe->'ingredients' end;
  if node->>'job'=cfg->>'gatherJob' and item ? (node->>'item') then q:=q||jsonb_build_object('gathered',coalesce((q->>'gathered')::int,0)+1);end if;
 elsif p_action='craft' and p_args->>'id'=cfg->>'recipe' and coalesce((q->>'gathered')::int,0)>=1 then
  amount:=coalesce((p_args->>'count')::int,1);
  if (recipe->>'seconds')::numeric=0 then q:=q||jsonb_build_object('collected',least(2,coalesce((q->>'collected')::int,0)+amount));
  else
   for task in select value from jsonb_array_elements(s->'jobs') loop
    if task->>'recipe'=cfg->>'recipe' and not exists(select 1 from jsonb_array_elements(coalesce(previous->'rpg'->'jobs','[]')) old where old->>'id'=task->>'id') then ids:=ids||to_jsonb(task->>'id');end if;
   end loop;
  end if;
 elsif p_action in('collect','cancel') and ids ? (p_args->>'id') then
  if p_action='collect' then q:=q||jsonb_build_object('collected',least(2,coalesce((q->>'collected')::int,0)+1));end if;
  select coalesce(jsonb_agg(value),'[]') into ids from jsonb_array_elements(ids) where value#>>'{}'<>p_args->>'id';
 elsif p_action='daily_order' and p_args->>'id'=cfg->>'order' and coalesce((q->>'gathered')::int,0)>=1 and (recipe is null or coalesce((q->>'collected')::int,0)>=2) then q:=q||'{"delivered":true}'::jsonb;
 end if;
 q:=q||jsonb_build_object('jobIds',ids,'crafted',least(2,coalesce((q->>'collected')::int,0)+jsonb_array_length(ids)));
 return jsonb_set(d,'{rpg,tutorial}',q);
end $$;
revoke all on function public.game_profession_tutorial_event(jsonb,text,jsonb,jsonb) from public,anon,authenticated;
