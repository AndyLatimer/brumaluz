create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 16),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists characters_user_name_unique
  on public.characters (user_id, lower(name));

alter table public.characters enable row level security;

drop policy if exists "Users can read their own characters" on public.characters;
create policy "Users can read their own characters"
  on public.characters for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own characters" on public.characters;
create policy "Users can create their own characters"
  on public.characters for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own characters" on public.characters;
create policy "Users can update their own characters"
  on public.characters for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own characters" on public.characters;
create policy "Users can delete their own characters"
  on public.characters for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.characters to authenticated;

create or replace function public.enforce_character_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));

  if (select count(*) from public.characters where user_id = new.user_id) >= 5 then
    raise exception 'CHARACTER_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists characters_enforce_limit on public.characters;
create trigger characters_enforce_limit
  before insert on public.characters
  for each row execute function public.enforce_character_limit();
