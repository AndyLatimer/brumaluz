-- Skill progression only. Preserves existing ownership checks, grants and player data.

begin;

set local lock_timeout='2s';

set local statement_timeout='15s';

create or replace function public.game_skill_rank(d jsonb)
returns int language sql immutable set search_path = '' as $$
  select greatest(1,least(5,public.game_level(d),
    coalesce((d->'skillRanks'->>public.game_skill_id(d->>'cls'))::int,1)))
$$;

create or replace function public.upgrade_skill(p_character_id uuid,p_skill_id text,p_expected_rank int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  current_rank int := public.game_skill_rank(c.data);
begin
  if p_skill_id is distinct from public.game_skill_id(c.data->>'cls') then raise exception 'SKILL_INVALID'; end if;
  if p_expected_rank is distinct from current_rank then raise exception 'SKILL_CHANGED'; end if;
  if current_rank>=5 then raise exception 'SKILL_MAX_RANK'; end if;
  if public.game_level(c.data)<current_rank+1 then raise exception 'SKILL_LEVEL_REQUIRED'; end if;
  if public.game_level(c.data)-1-(current_rank-1)<1 then raise exception 'SKILL_NO_POINTS'; end if;
  return public.game_store(c.id,c.data||jsonb_build_object('skillRanks',
    coalesce(c.data->'skillRanks','{}'::jsonb)||jsonb_build_object(p_skill_id,current_rank+1)));
end;
$$;

notify pgrst, 'reload schema';

commit;
