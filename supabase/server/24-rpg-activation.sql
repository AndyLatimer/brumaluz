-- Enable the implemented combat on first installation, preserving later administrative toggles.
do $$ begin
 if not exists(select 1 from public.server_config where key='rpg_rules_version') then
  update public.server_config set value='true'::jsonb where key='combat_enabled';
  insert into public.server_config(key,value) values('rpg_rules_version','1'::jsonb);
 end if;
end $$;
