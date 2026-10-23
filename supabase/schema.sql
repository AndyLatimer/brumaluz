create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text check (
    username is null or (
      char_length(username) between 3 and 20
      and username collate pg_catalog."C" !~ '[^A-Za-z0-9_]'
    )
  )
);

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username collate pg_catalog."C"))
  where username is not null;

alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated
  using (true);

revoke all on table public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := new.raw_user_meta_data ->> 'username';

  if requested_username is null
    or char_length(requested_username) not between 3 and 20
    or requested_username collate pg_catalog."C" ~ '[^A-Za-z0-9_]' then
    raise exception 'USERNAME_INVALID';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username collate pg_catalog."C") = lower(requested_username collate pg_catalog."C")
  ) then
    raise exception 'USERNAME_ALREADY_TAKEN';
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, requested_username);

  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 16),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.characters
set data = jsonb_set(
  jsonb_set(data, '{level}', '1'::jsonb, true),
  '{experience}', '0'::jsonb, true
)
where jsonb_typeof(data) = 'object'
  and (not (data ? 'level') or not (data ? 'experience'));

create unique index if not exists characters_user_name_unique
  on public.characters (user_id, lower(name));

alter table public.characters enable row level security;

drop policy if exists "Users can read their own characters" on public.characters;
create policy "Users can read their own characters"
  on public.characters for select to authenticated
  using ((select auth.uid()) = user_id);

-- El cliente NO puede crear ni modificar personajes directamente: solo leerlos y borrarlos.
-- Toda escritura pasa por las funciones del servidor de más abajo (create_character, character_action, ...).
drop policy if exists "Users can create their own characters" on public.characters;
drop policy if exists "Users can update their own characters" on public.characters;

drop policy if exists "Users can delete their own characters" on public.characters;
create policy "Users can delete their own characters"
  on public.characters for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.characters from anon, authenticated;
grant select, delete on public.characters to authenticated;

create or replace function public.enforce_character_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));

  if (select count(*) from public.characters where user_id = new.user_id) >= 6 then
    raise exception 'CHARACTER_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists characters_enforce_limit on public.characters;
create trigger characters_enforce_limit
  before insert on public.characters
  for each row execute function public.enforce_character_limit();
