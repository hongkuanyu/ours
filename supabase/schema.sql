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
  if (select count(*) from public.ours_couple_members where couple_id = v_invite.couple_id and status = 'active') >= 2 then
    raise exception 'COUPLE_FULL';
  end if;
  insert into public.ours_couple_members(couple_id, user_id, role, status)
  values (v_invite.couple_id, auth.uid(), 'member', 'active')
  on conflict (couple_id, user_id) do update set status = 'active', joined_at = now();
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