-- All internal helpers are unavailable to API roles, including functions added by later RPG migrations.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'game_rpg_%' or p.proname in('game_set_bonuses','game_power_multiplier','game_guard_multiplier','game_weapon_tempo')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
