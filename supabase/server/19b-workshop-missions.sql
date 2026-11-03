create or replace function public.game_workshop_mission_action(d jsonb,p_action text,p_args jsonb,pos jsonb,stamp numeric)
returns jsonb language plpgsql volatile set search_path='' as $$
declare catalog jsonb:=public.game_rpg_catalog();s jsonb:=d->'rpg';missions jsonb:=coalesce(s->'workshopMissions','{}'::jsonb);mission jsonb;teacher jsonb;job text;lvl int;xp int;
begin
 job:=p_args->>'job';
 if job is null or catalog->'professionTutorial'->'jobs'->job is null then raise exception 'Elige un oficio válido.';end if;
 teacher:=catalog->'teachers'->job;
 if teacher is null or teacher->>'id' is distinct from p_args->>'master' or teacher->>'location' is distinct from d->>'location'
  or sqrt(power((pos->>'x')::numeric-(teacher->>'x')::numeric,2)+power((pos->>'z')::numeric-(teacher->>'z')::numeric,2))>coalesce((teacher->>'radius')::numeric,3) then raise exception 'Acércate al maestro de este oficio.';end if;

 if p_action='workshop_mission_accept' then
  if s->'tutorial'->>'status' is distinct from 'completed' then raise exception 'Completa primero la iniciación a un oficio.';end if;
  if missions ? job then raise exception 'Esta práctica ya está aceptada o completada.';end if;
  mission:=jsonb_build_object('status','active','progress',false,'jobIds','[]'::jsonb,'startedAt',stamp);
 elsif p_action='workshop_mission_complete' then
  mission:=missions->job;
  if mission->>'status' is distinct from 'active' then raise exception 'No tienes esta práctica pendiente.';end if;
  if not coalesce((mission->>'progress')::boolean,false) then raise exception 'Completa primero una acción normal de este oficio.';end if;
  lvl:=public.game_level(d);xp:=coalesce((d->>'experience')::int,0);
  if lvl<50 then xp:=xp+10;while lvl<50 and xp>=public.game_xp_needed(lvl) loop xp:=xp-public.game_xp_needed(lvl);lvl:=lvl+1;end loop;if lvl>=50 then xp:=public.game_xp_needed(50);end if;end if;
  d:=d||jsonb_build_object('level',lvl,'experience',xp);mission:=mission||jsonb_build_object('status','completed','completedAt',stamp);
 else raise exception 'Acción de misión de taller no válida.';end if;
 missions:=jsonb_set(missions,array[job],mission,true);
 return jsonb_set(d,'{rpg,workshopMissions}',missions,true);
end $$;
revoke all on function public.game_workshop_mission_action(jsonb,text,jsonb,jsonb,numeric) from public,anon,authenticated;

create or replace function public.game_workshop_mission_event(d jsonb,p_action text,p_args jsonb,previous jsonb)
returns jsonb language plpgsql volatile set search_path='' as $$
declare catalog jsonb:=public.game_rpg_catalog();s jsonb:=d->'rpg';missions jsonb:=s->'workshopMissions';mission jsonb;recipe jsonb;node jsonb;task jsonb;ids jsonb;job text;id text;
begin
 if missions is null or jsonb_typeof(missions)<>'object' then return d;end if;
 id:=p_args->>'id';
 recipe:=catalog->'recipes'->id;node:=catalog->'nodes'->id;
 for job,mission in select key,value from jsonb_each(missions) loop
  if mission->>'status' is distinct from 'active' then continue;end if;
  ids:=coalesce(mission->'jobIds','[]'::jsonb);
  if p_action in('collect','cancel') and ids ? id then
   if p_action='collect' then mission:=mission||'{"progress":true}'::jsonb;end if;
   select coalesce(jsonb_agg(value),'[]'::jsonb) into ids from jsonb_array_elements(ids) where value#>>'{}'<>id;
   mission:=mission||jsonb_build_object('jobIds',ids);
  elsif not coalesce((mission->>'progress')::boolean,false) and p_action='gather_finish' and node->>'job'=job then
   mission:=mission||'{"progress":true}'::jsonb;
  elsif not coalesce((mission->>'progress')::boolean,false) and p_action='craft' and recipe->>'job'=job then
   if coalesce((recipe->>'seconds')::numeric,0)=0 then mission:=mission||'{"progress":true}'::jsonb;
   else
    for task in select value from jsonb_array_elements(coalesce(s->'jobs','[]'::jsonb)) loop
     if task->>'recipe'=id and not exists(select 1 from jsonb_array_elements(coalesce(previous->'rpg'->'jobs','[]'::jsonb)) old where old->>'id'=task->>'id') then ids:=ids||to_jsonb(task->>'id');end if;
    end loop;
    mission:=mission||jsonb_build_object('jobIds',ids);
   end if;
  end if;
  missions:=jsonb_set(missions,array[job],mission,true);
 end loop;
 s:=jsonb_set(s,'{workshopMissions}',missions,true);
 return jsonb_set(d,'{rpg}',s,true);
end $$;
revoke all on function public.game_workshop_mission_event(jsonb,text,jsonb,jsonb) from public,anon,authenticated;
