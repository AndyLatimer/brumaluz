-- ---------- Chat multijugador ----------
-- Los mensajes solo se crean con chat_send (el cliente no puede insertar): el servidor limpia el texto,
-- limita el ritmo, aplica silencios y fija remitente y título. Los clientes los reciben por Realtime (RLS aplicada).
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('general', 'zone', 'whisper')),
  sender_user uuid not null references auth.users (id) on delete cascade,
  sender_name text not null,
  sender_title text not null default 'none',
  recipient_user uuid references auth.users (id) on delete cascade,
  recipient_name text,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
-- Por si la tabla se creó con una versión anterior de este archivo.
alter table public.chat_messages add column if not exists zone text;
alter table public.chat_messages add column if not exists sender_account text;
alter table public.chat_messages add column if not exists party_id uuid;
alter table public.chat_messages add column if not exists party_audience uuid[];
alter table public.chat_messages drop constraint if exists chat_messages_channel_check;
alter table public.chat_messages add constraint chat_messages_channel_check check (channel in ('general', 'zone', 'whisper','party'));
create index if not exists chat_messages_created_idx on public.chat_messages (created_at);
alter table public.chat_messages enable row level security;

-- general/zone: públicos; whisper: participantes; party: destinatarios originales que sigan en el grupo.
drop policy if exists "Read public and own chat messages" on public.chat_messages;
create policy "Read public and own chat messages"
  on public.chat_messages for select to authenticated
  using (channel in ('general', 'zone')
    or (channel='whisper' and (sender_user=(select auth.uid()) or recipient_user=(select auth.uid())))
    or (channel='party' and (select auth.uid())=any(party_audience) and public.party_chat_member(party_id)));

revoke all on table public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

-- Silencios: se ponen a mano desde el editor SQL, p. ej.
--   insert into public.chat_mutes (user_id, until, reason) values ('<uuid>', now() + interval '1 day', 'spam');
create table if not exists public.chat_mutes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,
  reason text
);
alter table public.chat_mutes enable row level security;
revoke all on table public.chat_mutes from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- Canales: general, zone, party o whisper (p_to identifica la cuenta destinataria).
drop function if exists public.chat_send(uuid, text, text, text);
create or replace function public.chat_send(p_character_id uuid, p_body text, p_channel text default 'general', p_to text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters := public.game_lock_character(p_character_id);
  clean text := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:][:space:]]+', ' ', 'g'));
  me text;
  target_user uuid;
  target_account text;
  msg public.chat_messages;
  pid uuid;
  audience uuid[];
begin
  if p_channel not in ('general', 'zone', 'whisper','party') then raise exception 'INVALID_CHANNEL'; end if;
  if p_channel='party' then
    perform public.game_party_cleanup();
    select party_id into pid from public.party_members where user_id=c.user_id and character_id=c.id;
    if pid is null then raise exception 'PARTY_NOT_JOINED'; end if;
    select array_agg(user_id) into audience from public.party_members where party_id=pid;
  end if;
  if clean = '' then raise exception 'CHAT_EMPTY'; end if;
  if char_length(clean) > 200 then raise exception 'CHAT_TOO_LONG'; end if;
  if exists (select 1 from public.chat_mutes m where m.user_id = c.user_id and m.until > now()) then raise exception 'CHAT_MUTED'; end if;
  if (select count(*) from public.chat_messages where sender_user = c.user_id and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'CHAT_RATE_LIMIT';
  end if;
  select username into me from public.profiles where user_id = c.user_id;
  if p_channel = 'whisper' then
    select user_id, username into target_user, target_account from public.profiles
      where username is not null and lower(username collate pg_catalog."C") = lower(btrim(coalesce(p_to, '')) collate pg_catalog."C");
    if target_user is null then raise exception 'PLAYER_NOT_FOUND'; end if;
    if target_user = c.user_id then raise exception 'CANNOT_WHISPER_SELF'; end if;
  end if;
  delete from public.chat_messages where created_at < now() - interval '3 days';
  insert into public.chat_messages (channel, zone, sender_user, sender_name, sender_account, sender_title, recipient_user, recipient_name, body,party_id,party_audience)
  values (
    p_channel, case when p_channel = 'zone' then coalesce(c.data ->> 'location', 'brumaluz') end,
    c.user_id, c.name, me, coalesce(c.data ->> 'title', 'none'), target_user, target_account, clean,pid,audience
  )
  returning * into msg;
  return to_jsonb(msg);
end;
$$;

