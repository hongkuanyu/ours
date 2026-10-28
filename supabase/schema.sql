-- OURS Cloud Couple Mode
-- Run in Supabase SQL Editor with the project owner account.
-- This migration is intentionally not executed by the OURS frontend.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ours_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ours_couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default '我们的双人空间',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ours_couple_members (
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create unique index if not exists ours_one_active_couple_per_user
  on public.ours_couple_members(user_id)
  where status = 'active';

create table if not exists public.ours_couple_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ours_couple_records (
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  record_key text not null,
  payload jsonb not null,
  version integer not null default 1,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (couple_id, record_key)
);

create table if not exists public.ours_couple_photos (
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  id text not null,
  storage_path text not null,
  content_type text not null default 'application/octet-stream',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (couple_id, id)
);

create table if not exists public.ours_sync_mutations (
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  mutation_id uuid not null,
  user_id uuid not null references auth.users(id),
  record_key text not null,
  applied_at timestamptz not null default now(),
  primary key (couple_id, mutation_id)
);

alter table public.ours_profiles enable row level security;
alter table public.ours_couples enable row level security;
alter table public.ours_couple_members enable row level security;
alter table public.ours_couple_invites enable row level security;
alter table public.ours_couple_records enable row level security;
alter table public.ours_couple_photos enable row level security;
alter table public.ours_sync_mutations enable row level security;

create or replace function public.ours_is_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.ours_couple_members
    where couple_id = p_couple_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.ours_my_couple()
returns table (couple_id uuid, name text, role text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.id, c.name, m.role
  from public.ours_couple_members m
  join public.ours_couples c on c.id = m.couple_id
  where m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

create or replace function public.ours_create_couple(p_name text default '我们的双人空间')
returns table (couple_id uuid, name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_name text := coalesce(nullif(trim(p_name), ''), '我们的双人空间');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_name) > 40 then raise exception 'NAME_TOO_LONG'; end if;
  if exists (select 1 from public.ours_couple_members where user_id = auth.uid() and status = 'active') then
    raise exception 'ALREADY_IN_COUPLE';
  end if;
  insert into public.ours_couples(id, name, created_by) values (v_id, v_name, auth.uid());
  insert into public.ours_couple_members(couple_id, user_id, role, status) values (v_id, auth.uid(), 'owner', 'active');
  insert into public.ours_profiles(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return query select v_id, v_name;
end;
$$;
create or replace function public.ours_create_invite(p_couple_id uuid)
returns table (invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_hash text := encode(digest(v_token, 'sha256'), 'hex');
  v_expires timestamptz := now() + interval '24 hours';
begin
  if auth.uid() is null or not public.ours_is_member(p_couple_id) then raise exception 'ACCESS_DENIED'; end if;
  perform 1 from public.ours_couples where id = p_couple_id for update;
  if (select count(*) from public.ours_couple_members where couple_id = p_couple_id and status = 'active') >= 2 then
    raise exception 'COUPLE_FULL';
  end if;
  insert into public.ours_couple_invites(couple_id, token_hash, created_by, expires_at)
  values (p_couple_id, v_hash, auth.uid(), v_expires);
  return query select v_token, v_expires;
end;
$$;

create or replace function public.ours_accept_invite(p_token text)
returns table (couple_id uuid, name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := encode(digest(trim(p_token), 'sha256'), 'hex');
  v_invite public.ours_couple_invites%rowtype;
  v_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (select 1 from public.ours_couple_members where user_id = auth.uid() and status = 'active') then
    raise exception 'ALREADY_IN_COUPLE';
  end if;
  select * into v_invite
  from public.ours_couple_invites
  where token_hash = v_hash and used_at is null and expires_at > now()
  for update;
  if not found then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;
  perform 1 from public.ours_couples where id = v_invite.couple_id for update;
  if (select count(*) from public.ours_couple_members m where m.couple_id = v_invite.couple_id and m.status = 'active') >= 2 then
    raise exception 'COUPLE_FULL';
  end if;
  insert into public.ours_couple_members(couple_id, user_id, role, status)
  values (v_invite.couple_id, auth.uid(), 'member', 'active')
  on conflict on constraint ours_couple_members_pkey do update set status = 'active', joined_at = now();
  update public.ours_couple_invites set used_by = auth.uid(), used_at = now() where id = v_invite.id;
  insert into public.ours_profiles(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select c.name into v_name from public.ours_couples c where c.id = v_invite.couple_id;
  return query select v_invite.couple_id, v_name;
end;
$$;

create or replace function public.ours_push_record(
  p_couple_id uuid,
  p_record_key text,
  p_payload jsonb,
  p_base_version integer default 0,
  p_mutation_id uuid default gen_random_uuid()
)
returns table (status text, version integer, payload jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_current public.ours_couple_records%rowtype;
  v_next integer;
begin
  if auth.uid() is null or not public.ours_is_member(p_couple_id) then raise exception 'ACCESS_DENIED'; end if;
  if p_record_key !~ '^ours-[a-z0-9-]+-v[0-9]+$' or char_length(p_record_key) > 80 then raise exception 'INVALID_RECORD_KEY'; end if;
  perform 1 from public.ours_couples where id = p_couple_id for update;
  if exists (select 1 from public.ours_sync_mutations where couple_id = p_couple_id and mutation_id = p_mutation_id) then
    select * into v_current from public.ours_couple_records where couple_id = p_couple_id and record_key = p_record_key;
    return query select 'ok'::text, v_current.version, v_current.payload, v_current.updated_at;
    return;
  end if;
  select * into v_current from public.ours_couple_records where couple_id = p_couple_id and record_key = p_record_key for update;
  if found then
    if p_base_version <> v_current.version then
      return query select 'conflict'::text, v_current.version, v_current.payload, v_current.updated_at;
      return;
    end if;
    v_next := v_current.version + 1;
    update public.ours_couple_records
      set payload = p_payload, version = v_next, updated_by = auth.uid(), updated_at = now()
      where couple_id = p_couple_id and record_key = p_record_key;
  else
    if p_base_version <> 0 then
      return query select 'conflict'::text, 0, null::jsonb, null::timestamptz;
      return;
    end if;
    v_next := 1;
    insert into public.ours_couple_records(couple_id, record_key, payload, version, updated_by)
    values (p_couple_id, p_record_key, p_payload, v_next, auth.uid());
  end if;
  insert into public.ours_sync_mutations(couple_id, mutation_id, user_id, record_key)
  values (p_couple_id, p_mutation_id, auth.uid(), p_record_key);
  return query select 'ok'::text, v_next, p_payload, now();
end;
$$;

drop policy if exists "ours_profiles_self_select" on public.ours_profiles;
create policy "ours_profiles_self_select" on public.ours_profiles for select using (user_id = auth.uid());
drop policy if exists "ours_profiles_self_update" on public.ours_profiles;
create policy "ours_profiles_self_update" on public.ours_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ours_couples_member_select" on public.ours_couples;
create policy "ours_couples_member_select" on public.ours_couples for select using (public.ours_is_member(id));
drop policy if exists "ours_couples_member_update" on public.ours_couples;
create policy "ours_couples_member_update" on public.ours_couples for update using (public.ours_is_member(id)) with check (public.ours_is_member(id));

drop policy if exists "ours_members_member_select" on public.ours_couple_members;
create policy "ours_members_member_select" on public.ours_couple_members for select using (public.ours_is_member(couple_id));

drop policy if exists "ours_records_member_select" on public.ours_couple_records;
create policy "ours_records_member_select" on public.ours_couple_records for select using (public.ours_is_member(couple_id));

drop policy if exists "ours_photos_member_select" on public.ours_couple_photos;
create policy "ours_photos_member_select" on public.ours_couple_photos for select using (public.ours_is_member(couple_id));
drop policy if exists "ours_photos_member_insert" on public.ours_couple_photos;
drop policy if exists "ours_photos_member_update" on public.ours_couple_photos;
revoke insert, update, delete on public.ours_couple_photos from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('ours-couple-media', 'ours-couple-media', false)
on conflict (id) do nothing;
update storage.buckets
set file_size_limit = 16777216, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
where id = 'ours-couple-media';

drop policy if exists "ours_storage_member_select" on storage.objects;
create policy "ours_storage_member_select" on storage.objects for select using (
  bucket_id = 'ours-couple-media' and public.ours_is_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "ours_storage_member_insert" on storage.objects;
create policy "ours_storage_member_insert" on storage.objects for insert with check (
  bucket_id = 'ours-couple-media' and public.ours_is_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "ours_storage_member_update" on storage.objects;
create policy "ours_storage_member_update" on storage.objects for update using (
  bucket_id = 'ours-couple-media' and public.ours_is_member(((storage.foldername(name))[1])::uuid)
) with check (
  bucket_id = 'ours-couple-media' and public.ours_is_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "ours_storage_member_delete" on storage.objects;
create policy "ours_storage_member_delete" on storage.objects for delete using (
  bucket_id = 'ours-couple-media' and public.ours_is_member(((storage.foldername(name))[1])::uuid)
);
create or replace function public.ours_list_records(p_couple_id uuid)
returns table (record_key text, payload jsonb, version integer, updated_at timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select r.record_key, r.payload, r.version, r.updated_at
  from public.ours_couple_records r
  where r.couple_id = p_couple_id and public.ours_is_member(p_couple_id)
  order by r.record_key;
$$;

create or replace function public.ours_register_photo(
  p_couple_id uuid,
  p_photo_id text,
  p_storage_path text,
  p_content_type text default 'application/octet-stream'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null or not public.ours_is_member(p_couple_id) then raise exception 'ACCESS_DENIED'; end if;
  if p_photo_id !~ '^[A-Za-z0-9_-]{1,140}$' then raise exception 'INVALID_PHOTO_ID'; end if;
  if p_content_type not like 'image/%' then raise exception 'INVALID_CONTENT_TYPE'; end if;
  if p_storage_path <> p_couple_id::text || '/' || p_photo_id then raise exception 'INVALID_STORAGE_PATH'; end if;
  insert into public.ours_couple_photos(couple_id, id, storage_path, content_type, created_by)
  values (p_couple_id, p_photo_id, p_storage_path, p_content_type, auth.uid())
  on conflict (couple_id, id) do update
    set storage_path = excluded.storage_path,
        content_type = excluded.content_type;
end;
$$;

create or replace function public.ours_list_photos(p_couple_id uuid)
returns table (id text, storage_path text, content_type text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p.id, p.storage_path, p.content_type, p.created_at
  from public.ours_couple_photos p
  where p.couple_id = p_couple_id and public.ours_is_member(p_couple_id)
  order by p.created_at;
$$;
-- ===== Activity events and Web Push =====

-- OURS 3.0 couple activity events + Web Push
-- Apply after the base schema from supabase/schema.sql.

create table if not exists public.ours_activity_events (
  event_id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'memory_created','memory_updated','date_created','date_updated',
    'wish_created','wish_completed','message_created',
    'todo_created','todo_completed','life_plan_updated','test'
  )),
  category text not null check (category in ('memories','dates','wishes','messages','todos','life','system')),
  entity_type text not null,
  entity_id text not null,
  mutation_id uuid not null,
  target_route text not null default 'today',
  target_anchor text not null default '',
  push_title text not null,
  push_body text not null,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (couple_id, mutation_id, event_type, entity_id)
);

create index if not exists ours_activity_recipient_created_idx
  on public.ours_activity_events(recipient_user_id, created_at desc)
  where deleted_at is null;

create table if not exists public.ours_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  push_enabled boolean not null default false,
  memory_events boolean not null default true,
  date_events boolean not null default true,
  wish_events boolean not null default true,
  message_events boolean not null default true,
  todo_events boolean not null default true,
  life_events boolean not null default true,
  quiet_start time,
  quiet_end time,
  timezone text not null default 'Asia/Shanghai',
  hide_preview boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.ours_push_subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.ours_couples(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text not null default '',
  platform text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists ours_push_subscriptions_active_idx
  on public.ours_push_subscriptions(user_id, couple_id)
  where enabled and revoked_at is null;

create table if not exists public.ours_notification_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ours_activity_events(event_id) on delete cascade,
  subscription_id uuid not null references public.ours_push_subscriptions(subscription_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','deferred','sending','sent','failed','expired','coalesced')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  error_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, subscription_id)
);

create index if not exists ours_notification_deliveries_claim_idx
  on public.ours_notification_deliveries(status, next_attempt_at, created_at);

alter table public.ours_activity_events enable row level security;
alter table public.ours_notification_preferences enable row level security;
alter table public.ours_push_subscriptions enable row level security;
alter table public.ours_notification_deliveries enable row level security;

drop policy if exists "ours_activity_recipient_select" on public.ours_activity_events;
create policy "ours_activity_recipient_select" on public.ours_activity_events
  for select using (
    recipient_user_id = auth.uid()
    and public.ours_is_member(couple_id)
    and deleted_at is null
  );

drop policy if exists "ours_preferences_self_select" on public.ours_notification_preferences;
create policy "ours_preferences_self_select" on public.ours_notification_preferences
  for select using (user_id = auth.uid() and public.ours_is_member(couple_id));
drop policy if exists "ours_preferences_self_update" on public.ours_notification_preferences;
create policy "ours_preferences_self_update" on public.ours_notification_preferences
  for update using (user_id = auth.uid() and public.ours_is_member(couple_id))
  with check (user_id = auth.uid() and public.ours_is_member(couple_id));

drop policy if exists "ours_subscriptions_self_select" on public.ours_push_subscriptions;
create policy "ours_subscriptions_self_select" on public.ours_push_subscriptions
  for select using (user_id = auth.uid() and public.ours_is_member(couple_id));
drop policy if exists "ours_subscriptions_self_delete" on public.ours_push_subscriptions;
create policy "ours_subscriptions_self_delete" on public.ours_push_subscriptions
  for delete using (user_id = auth.uid());

revoke insert, update, delete on public.ours_activity_events from anon, authenticated;
revoke insert, update, delete on public.ours_notification_preferences from anon, authenticated;
revoke insert, update, delete on public.ours_push_subscriptions from anon, authenticated;
revoke all on public.ours_notification_deliveries from anon, authenticated;
grant select on public.ours_activity_events to authenticated;
grant select on public.ours_notification_preferences to authenticated;
grant select on public.ours_push_subscriptions to authenticated;

create or replace function public.ours_notification_category_enabled(p_user_id uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((
    select case p_category
      when 'memories' then memory_events
      when 'dates' then date_events
      when 'wishes' then wish_events
      when 'messages' then message_events
      when 'todos' then todo_events
      when 'life' then life_events
      else true
    end
    from public.ours_notification_preferences
    where user_id = p_user_id
  ), true);
$$;

create or replace function public.ours_notification_quiet_state(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns table(is_quiet boolean, next_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_timezone text;
  v_start time;
  v_end time;
  v_local timestamp;
  v_time time;
  v_next timestamp;
begin
  select timezone, quiet_start, quiet_end
    into v_timezone, v_start, v_end
  from public.ours_notification_preferences
  where user_id = p_user_id;

  if not found or v_start is null or v_end is null or v_start = v_end then
    return query select false, p_at;
    return;
  end if;

  v_timezone := coalesce(nullif(v_timezone, ''), 'Asia/Shanghai');
  v_local := p_at at time zone v_timezone;
  v_time := v_local::time;

  if v_start < v_end then
    if v_time >= v_start and v_time < v_end then
      v_next := v_local::date + v_end;
      return query select true, v_next at time zone v_timezone;
      return;
    end if;
  else
    if v_time >= v_start then
      v_next := (v_local::date + 1) + v_end;
      return query select true, v_next at time zone v_timezone;
      return;
    elsif v_time < v_end then
      v_next := v_local::date + v_end;
      return query select true, v_next at time zone v_timezone;
      return;
    end if;
  end if;

  return query select false, p_at;
end;
$$;

create or replace function public.ours_enqueue_push_deliveries(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.ours_activity_events%rowtype;
  v_prefs public.ours_notification_preferences%rowtype;
  v_subscription public.ours_push_subscriptions%rowtype;
  v_quiet boolean := false;
  v_next_at timestamptz := now();
  v_inserted integer := 0;
begin
  select * into v_event
  from public.ours_activity_events
  where event_id = p_event_id and deleted_at is null;

  if not found or (v_event.event_type <> 'test' and not public.ours_is_member(v_event.couple_id)) then
    return 0;
  end if;

  select * into v_prefs
  from public.ours_notification_preferences
  where user_id = v_event.recipient_user_id and couple_id = v_event.couple_id;

  if v_event.event_type <> 'test' then
    if not found or not v_prefs.push_enabled then return 0; end if;
    if not public.ours_notification_category_enabled(v_event.recipient_user_id, v_event.category) then return 0; end if;

    if exists (
      select 1
      from public.ours_notification_deliveries d
      join public.ours_activity_events e on e.event_id = d.event_id
      where e.recipient_user_id = v_event.recipient_user_id
        and e.category = v_event.category
        and d.status in ('pending','deferred','sending','sent')
        and d.created_at > now() - interval '90 seconds'
    ) then
      return 0;
    end if;
  end if;

  select q.is_quiet, q.next_at into v_quiet, v_next_at
  from public.ours_notification_quiet_state(v_event.recipient_user_id) q;

  for v_subscription in
    select *
    from public.ours_push_subscriptions
    where user_id = v_event.recipient_user_id
      and couple_id = v_event.couple_id
      and enabled
      and revoked_at is null
  loop
    insert into public.ours_notification_deliveries(
      event_id, subscription_id, status, next_attempt_at
    ) values (
      p_event_id,
      v_subscription.subscription_id,
      case when v_quiet then 'deferred' else 'pending' end,
      case when v_quiet then v_next_at else now() end
    ) on conflict (event_id, subscription_id) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.ours_create_activity_event(
  p_couple_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_category text,
  p_entity_type text,
  p_entity_id text,
  p_mutation_id uuid,
  p_target_route text,
  p_target_anchor text,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_recipient uuid;
  v_hide_preview boolean := true;
  v_event_id uuid;
begin
  select user_id into v_recipient
  from public.ours_couple_members
  where couple_id = p_couple_id
    and status = 'active'
    and user_id <> p_actor_user_id
  limit 1;

  if v_recipient is null then return null; end if;
  if not exists (
    select 1 from public.ours_couple_members
    where couple_id = p_couple_id and user_id = p_actor_user_id and status = 'active'
  ) then return null; end if;

  if exists (
    select 1 from public.ours_activity_events
    where couple_id = p_couple_id
      and actor_user_id = p_actor_user_id
      and recipient_user_id = v_recipient
      and event_type = p_event_type
      and entity_id = p_entity_id
      and created_at > now() - interval '2 minutes'
      and deleted_at is null
  ) then
    return null;
  end if;

  select hide_preview into v_hide_preview
  from public.ours_notification_preferences
  where user_id = v_recipient;

  if coalesce(v_hide_preview, true) then
    p_title := 'OURS 有一条新动态';
    p_body := '打开 App 查看这次更新。';
  end if;

  insert into public.ours_activity_events(
    couple_id, actor_user_id, recipient_user_id, event_type, category,
    entity_type, entity_id, mutation_id, target_route, target_anchor,
    push_title, push_body
  ) values (
    p_couple_id, p_actor_user_id, v_recipient, p_event_type, p_category,
    p_entity_type, p_entity_id, p_mutation_id, p_target_route, p_target_anchor,
    p_title, p_body
  ) on conflict (couple_id, mutation_id, event_type, entity_id) do nothing
  returning event_id into v_event_id;

  if v_event_id is not null then
    perform public.ours_enqueue_push_deliveries(v_event_id);
  end if;
  return v_event_id;
end;
$$;

create or replace function public.ours_capture_record_activity(
  p_couple_id uuid,
  p_record_key text,
  p_previous jsonb,
  p_payload jsonb,
  p_mutation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_old jsonb;
  v_old_normalized jsonb;
  v_item_normalized jsonb;
  v_id text;
  v_count integer := 0;
begin
  if v_actor is null then return 0; end if;

  if p_record_key in ('ours-memories-v1','ours-events-v1','ours-supper-wishes-v2','ours-daily-notes-v1','ours-todos-v1')
     and jsonb_typeof(p_payload) = 'array' then
    for v_item in select value from jsonb_array_elements(p_payload)
    loop
      v_id := v_item->>'id';
      if v_id is null or v_id = '' then continue; end if;
      v_old := null;
      if jsonb_typeof(p_previous) = 'array' then
        select value into v_old
        from jsonb_array_elements(p_previous)
        where value->>'id' = v_id
        limit 1;
      end if;

      if p_record_key = 'ours-memories-v1' then
        if v_old is null then
          perform public.ours_create_activity_event(p_couple_id,v_actor,'memory_created','memories','memory',v_id,p_mutation_id,'memories','memories','新的回忆已收藏 📸','另一半添加了一段新的回忆。');
          v_count := v_count + 1;
        else
          v_old_normalized := v_old - 'updatedAt';
          v_item_normalized := v_item - 'updatedAt';
          if v_old_normalized <> v_item_normalized then
            perform public.ours_create_activity_event(p_couple_id,v_actor,'memory_updated','memories','memory',v_id,p_mutation_id,'memories','memories','一段回忆更新了','另一半补充了值得收藏的细节。');
            v_count := v_count + 1;
          end if;
        end if;
      elsif p_record_key = 'ours-events-v1' then
        if v_old is null then
          perform public.ours_create_activity_event(p_couple_id,v_actor,'date_created','dates','event',v_id,p_mutation_id,'plans','schedule','新的约会安排 💗','下一次见面，又多了一件期待的事。');
          v_count := v_count + 1;
        else
          v_old_normalized := v_old - 'updatedAt';
          v_item_normalized := v_item - 'updatedAt';
          if v_old_normalized <> v_item_normalized then
            perform public.ours_create_activity_event(p_couple_id,v_actor,'date_updated','dates','event',v_id,p_mutation_id,'plans','schedule','约会安排更新了','打开 OURS 看看新的计划。');
            v_count := v_count + 1;
          end if;
        end if;
      elsif p_record_key = 'ours-supper-wishes-v2' then
        if v_old is null then
          perform public.ours_create_activity_event(p_couple_id,v_actor,'wish_created','wishes','wish',v_id,p_mutation_id,'plans','wishes','共同愿望清单更新 ✨','另一半新增了一个共同愿望。');
          v_count := v_count + 1;
        elsif coalesce((v_old->>'done')::boolean,false) = false
          and coalesce((v_item->>'done')::boolean,false) = true then
          perform public.ours_create_activity_event(p_couple_id,v_actor,'wish_completed','wishes','wish',v_id,p_mutation_id,'plans','wishes','共同愿望完成 🎉','你们又完成了一件想一起做的事。');
          v_count := v_count + 1;
        end if;
      elsif p_record_key = 'ours-daily-notes-v1' then
        if v_old is null then
          perform public.ours_create_activity_event(p_couple_id,v_actor,'message_created','messages','message',v_id,p_mutation_id,'memories','daily','收到一条新留言 💌','打开 OURS，看看对方想说的话。');
          v_count := v_count + 1;
        end if;
      elsif p_record_key = 'ours-todos-v1' then
        if v_old is null then
          perform public.ours_create_activity_event(p_couple_id,v_actor,'todo_created','todos','todo',v_id,p_mutation_id,'plans','sharedTodos','共同待办更新','另一半写下一件想一起完成的小事。');
          v_count := v_count + 1;
        elsif coalesce(v_old->>'status','open') <> 'done'
          and coalesce(v_item->>'status','open') = 'done' then
          perform public.ours_create_activity_event(p_couple_id,v_actor,'todo_completed','todos','todo',v_id,p_mutation_id,'plans','sharedTodos','一件小事完成了','共同待办里又完成了一项。');
          v_count := v_count + 1;
        end if;
      end if;
    end loop;
  elsif p_record_key in ('ours-weekly-menu-v1','ours-shopping-v1')
    and p_previous is distinct from p_payload then
    perform public.ours_create_activity_event(
      p_couple_id,v_actor,'life_plan_updated','life','life_plan',p_record_key,p_mutation_id,
      'life',case when p_record_key = 'ours-weekly-menu-v1' then 'weeklyMenuCard' else 'menu' end,
      '生活计划更新','菜单或采购计划有一处新变化。'
    );
    v_count := 1;
  end if;

  return v_count;
end;
$$;

drop function if exists public.ours_push_record(uuid,text,jsonb,integer,uuid);

create or replace function public.ours_push_record(
  p_couple_id uuid,
  p_record_key text,
  p_payload jsonb,
  p_base_version integer default 0,
  p_mutation_id uuid default gen_random_uuid(),
  p_notify boolean default false
)
returns table (status text, version integer, payload jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_current public.ours_couple_records%rowtype;
  v_previous jsonb;
  v_next integer;
begin
  if auth.uid() is null or not public.ours_is_member(p_couple_id) then raise exception 'ACCESS_DENIED'; end if;
  if p_record_key !~ '^ours-[a-z0-9-]+-v[0-9]+$' or char_length(p_record_key) > 80 then raise exception 'INVALID_RECORD_KEY'; end if;
  perform 1 from public.ours_couples where id = p_couple_id for update;

  if exists (select 1 from public.ours_sync_mutations where couple_id = p_couple_id and mutation_id = p_mutation_id) then
    select * into v_current from public.ours_couple_records where couple_id = p_couple_id and record_key = p_record_key;
    return query select 'ok'::text, v_current.version, v_current.payload, v_current.updated_at;
    return;
  end if;

  select * into v_current from public.ours_couple_records where couple_id = p_couple_id and record_key = p_record_key for update;
  if found then
    if p_base_version <> v_current.version then
      return query select 'conflict'::text, v_current.version, v_current.payload, v_current.updated_at;
      return;
    end if;
    v_previous := v_current.payload;
    v_next := v_current.version + 1;
    update public.ours_couple_records
      set payload = p_payload, version = v_next, updated_by = auth.uid(), updated_at = now()
      where couple_id = p_couple_id and record_key = p_record_key;
  else
    if p_base_version <> 0 then
      return query select 'conflict'::text, 0, null::jsonb, null::timestamptz;
      return;
    end if;
    v_next := 1;
    insert into public.ours_couple_records(couple_id, record_key, payload, version, updated_by)
    values (p_couple_id, p_record_key, p_payload, v_next, auth.uid());
  end if;

  insert into public.ours_sync_mutations(couple_id, mutation_id, user_id, record_key)
  values (p_couple_id, p_mutation_id, auth.uid(), p_record_key);

  if p_notify then
    begin
      perform public.ours_capture_record_activity(p_couple_id,p_record_key,v_previous,p_payload,p_mutation_id);
    exception when others then
      null;
    end;
  end if;

  return query select 'ok'::text, v_next, p_payload, now();
end;
$$;

create or replace function public.ours_get_notification_preferences()
returns table (
  push_enabled boolean, memory_events boolean, date_events boolean,
  wish_events boolean, message_events boolean, todo_events boolean,
  life_events boolean, quiet_start time, quiet_end time,
  timezone text, hide_preview boolean, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select couple_id into v_couple from public.ours_my_couple() limit 1;
  if v_couple is null then raise exception 'COUPLE_REQUIRED'; end if;

  insert into public.ours_notification_preferences(user_id,couple_id)
  values (v_user,v_couple)
  on conflict (user_id) do update set couple_id = excluded.couple_id
  where public.ours_notification_preferences.couple_id <> excluded.couple_id;

  return query
  select p.push_enabled,p.memory_events,p.date_events,p.wish_events,p.message_events,
         p.todo_events,p.life_events,p.quiet_start,p.quiet_end,p.timezone,p.hide_preview,p.updated_at
  from public.ours_notification_preferences p
  where p.user_id = v_user;
end;
$$;

create or replace function public.ours_save_notification_preferences(
  p_push_enabled boolean,
  p_memory_events boolean,
  p_date_events boolean,
  p_wish_events boolean,
  p_message_events boolean,
  p_todo_events boolean,
  p_life_events boolean,
  p_quiet_start time,
  p_quiet_end time,
  p_timezone text,
  p_hide_preview boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Shanghai');
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select couple_id into v_couple from public.ours_my_couple() limit 1;
  if v_couple is null then raise exception 'COUPLE_REQUIRED'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then raise exception 'INVALID_TIMEZONE'; end if;

  insert into public.ours_notification_preferences(
    user_id,couple_id,push_enabled,memory_events,date_events,wish_events,
    message_events,todo_events,life_events,quiet_start,quiet_end,timezone,hide_preview,updated_at
  ) values (
    v_user,v_couple,p_push_enabled,p_memory_events,p_date_events,p_wish_events,
    p_message_events,p_todo_events,p_life_events,p_quiet_start,p_quiet_end,v_timezone,p_hide_preview,now()
  )
  on conflict (user_id) do update set
    couple_id = excluded.couple_id,
    push_enabled = excluded.push_enabled,
    memory_events = excluded.memory_events,
    date_events = excluded.date_events,
    wish_events = excluded.wish_events,
    message_events = excluded.message_events,
    todo_events = excluded.todo_events,
    life_events = excluded.life_events,
    quiet_start = excluded.quiet_start,
    quiet_end = excluded.quiet_end,
    timezone = excluded.timezone,
    hide_preview = excluded.hide_preview,
    updated_at = now();

  update public.ours_notification_deliveries d
    set status = 'coalesced', updated_at = now()
  from public.ours_activity_events e
  where d.event_id = e.event_id
    and e.recipient_user_id = v_user
    and d.status in ('pending','deferred')
    and (
      not p_push_enabled
      or not case e.category
        when 'memories' then p_memory_events
        when 'dates' then p_date_events
        when 'wishes' then p_wish_events
        when 'messages' then p_message_events
        when 'todos' then p_todo_events
        when 'life' then p_life_events
        else true
      end
    );
end;
$$;

create or replace function public.ours_register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_user_agent text default '',
  p_platform text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_existing public.ours_push_subscriptions%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(p_endpoint) < 20 or char_length(p_endpoint) > 4096 then raise exception 'INVALID_ENDPOINT'; end if;
  if char_length(p_p256dh) < 20 or char_length(p_auth_secret) < 8 then raise exception 'INVALID_SUBSCRIPTION_KEYS'; end if;
  select couple_id into v_couple from public.ours_my_couple() limit 1;
  if v_couple is null then raise exception 'COUPLE_REQUIRED'; end if;

  select * into v_existing from public.ours_push_subscriptions where endpoint = p_endpoint;
  if found and v_existing.user_id <> v_user then raise exception 'SUBSCRIPTION_OWNED_BY_ANOTHER_USER'; end if;

  insert into public.ours_push_subscriptions(
    user_id,couple_id,endpoint,p256dh,auth_secret,user_agent,platform,enabled,revoked_at,last_seen_at,updated_at
  ) values (
    v_user,v_couple,p_endpoint,p_p256dh,p_auth_secret,left(coalesce(p_user_agent,''),500),left(coalesce(p_platform,''),80),true,null,now(),now()
  )
  on conflict (endpoint) do update set
    couple_id = excluded.couple_id,
    p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret,
    user_agent = excluded.user_agent,
    platform = excluded.platform,
    enabled = true,
    revoked_at = null,
    last_seen_at = now(),
    updated_at = now()
  returning subscription_id into v_id;

  return v_id;
end;
$$;

create or replace function public.ours_revoke_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.ours_push_subscriptions
    set enabled = false, revoked_at = now(), updated_at = now()
  where endpoint = p_endpoint and user_id = v_user;
  return found;
end;
$$;

create or replace function public.ours_list_notifications(p_limit integer default 50)
returns table (
  event_id uuid, event_type text, category text, entity_type text,
  entity_id text, target_route text, target_anchor text,
  title text, body text, read_at timestamptz, created_at timestamptz, is_test boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select e.event_id,e.event_type,e.category,e.entity_type,e.entity_id,
         e.target_route,e.target_anchor,e.push_title,e.push_body,e.read_at,e.created_at,
         e.event_type = 'test'
  from public.ours_activity_events e
  where e.recipient_user_id = auth.uid()
    and public.ours_is_member(e.couple_id)
    and e.deleted_at is null
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit,50),1),100);
$$;

create or replace function public.ours_mark_notification_read(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.ours_activity_events
    set read_at = coalesce(read_at, now())
  where event_id = p_event_id
    and recipient_user_id = auth.uid()
    and public.ours_is_member(couple_id)
    and deleted_at is null;
  return found;
end;
$$;

create or replace function public.ours_mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  update public.ours_activity_events
    set read_at = now()
  where recipient_user_id = auth.uid()
    and public.ours_is_member(couple_id)
    and read_at is null
    and deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.ours_delete_notification(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.ours_activity_events
    set deleted_at = now()
  where event_id = p_event_id
    and recipient_user_id = auth.uid()
    and public.ours_is_member(couple_id)
    and deleted_at is null;
  return found;
end;
$$;

create or replace function public.ours_queue_test_notification()
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_event_id uuid := gen_random_uuid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select couple_id into v_couple from public.ours_my_couple() limit 1;
  if v_couple is null then raise exception 'COUPLE_REQUIRED'; end if;
  if not exists (
    select 1 from public.ours_push_subscriptions
    where user_id = v_user and couple_id = v_couple and enabled and revoked_at is null
  ) then raise exception 'NO_ACTIVE_SUBSCRIPTION'; end if;

  insert into public.ours_activity_events(
    event_id,couple_id,actor_user_id,recipient_user_id,event_type,category,
    entity_type,entity_id,mutation_id,target_route,target_anchor,push_title,push_body
  ) values (
    v_event_id,v_couple,v_user,v_user,'test','system','test',v_event_id::text,gen_random_uuid(),
    'us','notificationSettings','OURS 测试通知','通知已经连通，之后的新动态会在这里出现。'
  );
  perform public.ours_enqueue_push_deliveries(v_event_id);
  return v_event_id;
end;
$$;

create or replace function public.ours_claim_push_deliveries(p_limit integer default 50)
returns table (
  delivery_id uuid, event_id uuid, title text, body text, target_route text,
  target_anchor text, category text, endpoint text, p256dh text, auth_secret text, attempts integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item public.ours_notification_deliveries%rowtype;
  v_event public.ours_activity_events%rowtype;
  v_sub public.ours_push_subscriptions%rowtype;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  ) <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  update public.ours_notification_deliveries
    set status = 'pending', updated_at = now()
  where status = 'sending'
    and updated_at < now() - interval '10 minutes';

  for v_item in
    select d.* from public.ours_notification_deliveries d
    join public.ours_activity_events e on e.event_id = d.event_id
    join public.ours_push_subscriptions s on s.subscription_id = d.subscription_id
    left join public.ours_notification_preferences p on p.user_id = e.recipient_user_id
    where d.status in ('pending','deferred')
      and d.next_attempt_at <= now()
      and e.deleted_at is null
      and s.enabled
      and s.revoked_at is null
      and public.ours_is_member(e.couple_id)
      and (
        e.event_type = 'test'
        or (coalesce(p.push_enabled,false) and public.ours_notification_category_enabled(e.recipient_user_id,e.category))
      )
    order by d.created_at
    limit least(greatest(coalesce(p_limit,50),1),100)
    for update of d skip locked
  loop
    update public.ours_notification_deliveries d
      set status = 'sending', attempts = d.attempts + 1, updated_at = now()
    where d.delivery_id = v_item.delivery_id;

    select * into v_event from public.ours_activity_events e where e.event_id = v_item.event_id;
    select * into v_sub from public.ours_push_subscriptions s where s.subscription_id = v_item.subscription_id;

    delivery_id := v_item.delivery_id;
    event_id := v_item.event_id;
    title := v_event.push_title;
    body := v_event.push_body;
    target_route := v_event.target_route;
    target_anchor := v_event.target_anchor;
    category := v_event.category;
    endpoint := v_sub.endpoint;
    p256dh := v_sub.p256dh;
    auth_secret := v_sub.auth_secret;
    attempts := v_item.attempts + 1;
    return next;
  end loop;
end;
$$;

create or replace function public.ours_complete_push_delivery(
  p_delivery_id uuid,
  p_status text,
  p_error_code text default ''
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_delivery public.ours_notification_deliveries%rowtype;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  ) <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_status not in ('sent','failed','expired') then raise exception 'INVALID_STATUS'; end if;

  select * into v_delivery from public.ours_notification_deliveries where delivery_id = p_delivery_id for update;
  if not found then return; end if;

  if p_status = 'sent' then
    update public.ours_notification_deliveries
      set status = 'sent', sent_at = now(), error_code = '', updated_at = now()
    where delivery_id = p_delivery_id;
  elsif p_status = 'expired' then
    update public.ours_notification_deliveries
      set status = 'expired', error_code = left(coalesce(p_error_code,''),120), updated_at = now()
    where delivery_id = p_delivery_id;
    update public.ours_push_subscriptions
      set enabled = false, revoked_at = now(), updated_at = now()
    where subscription_id = v_delivery.subscription_id;
    update public.ours_notification_deliveries
      set status = 'expired', updated_at = now()
    where subscription_id = v_delivery.subscription_id and status in ('pending','deferred');
  else
    update public.ours_notification_deliveries
      set status = case when attempts >= 5 then 'failed' else 'pending' end,
          next_attempt_at = now() + make_interval(mins => least(60, 2 * greatest(attempts,1))),
          error_code = left(coalesce(p_error_code,''),120),
          updated_at = now()
    where delivery_id = p_delivery_id;
  end if;
end;
$$;

create or replace function public.ours_revoke_subscriptions_for_removed_member()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (TG_OP = 'UPDATE' and new.status = 'removed')
     or (TG_OP = 'DELETE') then
    update public.ours_push_subscriptions
      set enabled = false, revoked_at = now(), updated_at = now()
    where user_id = old.user_id and couple_id = old.couple_id;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists ours_revoke_subscriptions_after_member_removed on public.ours_couple_members;
create trigger ours_revoke_subscriptions_after_member_removed
after update of status on public.ours_couple_members
for each row execute function public.ours_revoke_subscriptions_for_removed_member();

drop trigger if exists ours_revoke_subscriptions_after_member_deleted on public.ours_couple_members;
create trigger ours_revoke_subscriptions_after_member_deleted
after delete on public.ours_couple_members
for each row execute function public.ours_revoke_subscriptions_for_removed_member();

revoke all on function public.ours_notification_category_enabled(uuid,text) from public, anon, authenticated;
revoke all on function public.ours_notification_quiet_state(uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.ours_enqueue_push_deliveries(uuid) from public, anon, authenticated;
revoke all on function public.ours_create_activity_event(uuid,uuid,text,text,text,text,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.ours_capture_record_activity(uuid,text,jsonb,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.ours_claim_push_deliveries(integer) from public, anon, authenticated;
revoke all on function public.ours_complete_push_delivery(uuid,text,text) from public, anon, authenticated;

grant execute on function public.ours_push_record(uuid,text,jsonb,integer,uuid,boolean) to authenticated;
grant execute on function public.ours_get_notification_preferences() to authenticated;
grant execute on function public.ours_save_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,time,time,text,boolean) to authenticated;
grant execute on function public.ours_register_push_subscription(text,text,text,text,text) to authenticated;
grant execute on function public.ours_revoke_push_subscription(text) to authenticated;
grant execute on function public.ours_list_notifications(integer) to authenticated;
grant execute on function public.ours_mark_notification_read(uuid) to authenticated;
grant execute on function public.ours_mark_all_notifications_read() to authenticated;
grant execute on function public.ours_delete_notification(uuid) to authenticated;
grant execute on function public.ours_queue_test_notification() to authenticated;
grant execute on function public.ours_claim_push_deliveries(integer) to service_role;
grant execute on function public.ours_complete_push_delivery(uuid,text,text) to service_role;
