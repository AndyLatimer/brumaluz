-- ---------- Amigos por cuenta ----------
create table if not exists public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high))
);
create index if not exists friendships_high_idx on public.friendships(user_high);
create index if not exists friendships_pending_sender_idx on public.friendships(requested_by) where status = 'pending';
alter table public.friendships enable row level security;
revoke all on table public.friendships from public, anon, authenticated;

create or replace function public.party_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); pid uuid; members jsonb; incoming jsonb; outgoing jsonb; responses jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.game_party_cleanup();
  select party_id into pid from public.party_members where user_id=uid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',m.user_id,'characterId',m.character_id,'username',p.username,'data',public.game_public_character(c.data),
    'vitals',public.game_public_vitals(public.game_food_data(c.id,public.game_party_data(c.id,c.data))),
    'position',w.position,'location',coalesce(c.data->>'location','brumaluz')
  ) order by m.entry_order),'[]'::jsonb) into members
  from public.party_members m join public.characters c on c.id=m.character_id
  join public.profiles p on p.user_id=m.user_id join public.world_players w on w.user_id=m.user_id
  where m.party_id=pid;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'username',p.username) order by i.expires_at),'[]'::jsonb)
  into incoming from public.party_invites i join public.party_members leader on leader.party_id=i.party_id
  join public.profiles p on p.user_id=leader.user_id
  where i.target_user=uid and leader.entry_order=(select min(entry_order) from public.party_members where party_id=i.party_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'username',p.username) order by i.expires_at),'[]'::jsonb)
  into outgoing from public.party_invites i join public.profiles p on p.user_id=i.target_user
  where i.party_id=pid and uid=(select user_id from public.party_members where party_id=pid order by entry_order limit 1);
  with delivered as (
    delete from public.party_responses where recipient_user=uid returning id,username,accepted,created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'username',username,'accepted',accepted) order by created_at,id),'[]'::jsonb)
    into responses from delivered;
  return jsonb_build_object('id',pid,'members',members,'incoming',incoming,'outgoing',outgoing,'responses',responses);
end $$;

create or replace function public.party_invite(p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); target uuid; pid uuid; cid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists(select 1 from public.profiles where user_id=uid and username is not null) then
    raise exception 'PARTY_USERNAME_REQUIRED';
  end if;
  perform public.game_party_cleanup();
  select character_id into cid from public.world_players where user_id=uid and seen_at>now()-interval '15 seconds';
  if cid is null then raise exception 'PARTY_NOT_PLAYING'; end if;
  select p.user_id into target from public.profiles p join public.world_players w on w.user_id=p.user_id
    where lower(p.username collate pg_catalog."C")=lower(ltrim(btrim(p_username),'~') collate pg_catalog."C")
    and w.seen_at>now()-interval '15 seconds';
  if target is null then raise exception 'PARTY_TARGET_OFFLINE'; end if;
  if target=uid then raise exception 'PARTY_SELF'; end if;
  if exists(select 1 from public.party_members where user_id=target) then raise exception 'PARTY_ALREADY_JOINED'; end if;
  select party_id into pid from public.party_members where user_id=uid;
  if pid is null then
    insert into public.parties default values returning id into pid;
    insert into public.party_members(user_id,character_id,party_id) values(uid,cid,pid);
  end if;
  if uid<>(select user_id from public.party_members where party_id=pid order by entry_order limit 1) then raise exception 'PARTY_LEADER_ONLY'; end if;
  if (select count(*) from public.party_members where party_id=pid)>=4 then raise exception 'PARTY_FULL'; end if;
  if exists(select 1 from public.party_invites where party_id=pid and target_user=target) then raise exception 'PARTY_INVITE_EXISTS'; end if;
  if (select count(*) from public.party_invites where party_id=pid)>=3 then raise exception 'PARTY_INVITE_LIMIT'; end if;
  insert into public.party_invites(party_id,target_user) values(pid,target);
end $$;

create or replace function public.party_respond(p_invite_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); invitation public.party_invites; cid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_accept is null then raise exception 'PARTY_INVITE_INVALID'; end if;
  perform public.game_party_cleanup();
  select * into invitation from public.party_invites where id=p_invite_id and target_user=uid;
  if not found then raise exception 'PARTY_INVITE_INVALID'; end if;
  if p_accept then
    select character_id into cid from public.world_players where user_id=uid and seen_at>now()-interval '15 seconds';
    if cid is null then raise exception 'PARTY_NOT_PLAYING'; end if;
    if exists(select 1 from public.party_members where user_id=uid) then raise exception 'PARTY_ALREADY_JOINED'; end if;
    if (select count(*) from public.party_members where party_id=invitation.party_id)>=4 then raise exception 'PARTY_FULL'; end if;
    insert into public.party_members(user_id,character_id,party_id) values(uid,cid,invitation.party_id);
    delete from public.party_invites where target_user=uid;
  else delete from public.party_invites where id=invitation.id;
  end if;
  insert into public.party_responses(recipient_user,username,accepted)
    select leader.user_id,p.username,p_accept from public.party_members leader
    join public.profiles p on p.user_id=uid where leader.party_id=invitation.party_id
    order by leader.entry_order limit 1;
  if not p_accept then
    delete from public.parties p where p.id=invitation.party_id
      and (select count(*) from public.party_members where party_id=p.id)=1
      and not exists(select 1 from public.party_invites where party_id=p.id);
  end if;
end $$;

create or replace function public.party_leave()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); pid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.game_party_cleanup();
  delete from public.party_members where user_id=uid returning party_id into pid;
  if pid is null then raise exception 'PARTY_NOT_JOINED'; end if;
  perform public.game_party_cleanup();
end $$;

create or replace function public.party_chat_member(p_party_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.party_members m join public.world_players w
    on w.user_id=m.user_id and w.character_id=m.character_id
    where m.party_id=p_party_id and m.user_id=(select auth.uid()) and w.seen_at>now()-interval '15 seconds')
$$;
revoke all on function public.party_state(),public.party_invite(text),public.party_respond(uuid,boolean),public.party_leave(),public.party_chat_member(uuid) from public,anon;
grant execute on function public.party_state(),public.party_invite(text),public.party_respond(uuid,boolean),public.party_leave(),public.party_chat_member(uuid) to authenticated;

create or replace function public.friends_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.user_id, 'username', p.username,
    'status', case when f.status = 'accepted' then 'friend' when f.requested_by = uid then 'outgoing' else 'incoming' end,
    'online', w.user_id is not null,
    'characterName', c.name, 'location', c.data ->> 'location', 'characterClass', c.data ->> 'cls',
    'characterLevel', case when c.id is not null then public.game_level(c.data) else null end
  ) order by lower(p.username)), '[]'::jsonb) into result
  from public.friendships f
  join public.profiles p on p.user_id = case when f.user_low = uid then f.user_high else f.user_low end
  left join public.world_players w on w.user_id = p.user_id and f.status = 'accepted' and w.seen_at > now() - interval '15 seconds'
  left join public.characters c on c.id = w.character_id
  where uid in (f.user_low, f.user_high);
  return result;
end;
$$;

create or replace function public.friend_request(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target uuid;
  lo uuid;
  hi uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where user_id = uid and username is not null) then
    raise exception 'FRIEND_USERNAME_REQUIRED';
  end if;
  select user_id into target from public.profiles
    where lower(username collate pg_catalog."C") = lower(btrim(coalesce(p_username, '')) collate pg_catalog."C");
  if target is null then raise exception 'PLAYER_NOT_FOUND'; end if;
  if target = uid then raise exception 'FRIEND_SELF'; end if;
  lo := least(uid, target); hi := greatest(uid, target);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 2));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lo::text || hi::text, 3));
  if exists (select 1 from public.friendships where user_low = lo and user_high = hi) then
    raise exception 'FRIEND_ALREADY_EXISTS';
  end if;
  if (select count(*) from public.friendships where requested_by = uid and status = 'pending') >= 50 then
    raise exception 'FRIEND_REQUEST_LIMIT';
  end if;
  insert into public.friendships(user_low, user_high, requested_by) values(lo, hi, uid);
end;
$$;

create or replace function public.friend_update(p_user_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  lo uuid := least(uid, p_user_id);
  hi uuid := greatest(uid, p_user_id);
  f public.friendships;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_user_id is null or p_user_id = uid or p_action is null or p_action not in ('accept', 'remove') then
    raise exception 'INVALID_FRIEND_ACTION';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lo::text || hi::text, 3));
  select * into f from public.friendships where user_low = lo and user_high = hi for update;
  if not found then raise exception 'FRIEND_NOT_FOUND'; end if;
  if p_action = 'accept' then
    if f.status <> 'pending' or f.requested_by = uid then raise exception 'INVALID_FRIEND_ACTION'; end if;
    update public.friendships set status = 'accepted' where user_low = lo and user_high = hi;
  else
    delete from public.friendships where user_low = lo and user_high = hi;
  end if;
end;
$$;

revoke all on function public.friends_list(), public.friend_request(text), public.friend_update(uuid, text) from public, anon;
grant execute on function public.friends_list(), public.friend_request(text), public.friend_update(uuid, text) to authenticated;

