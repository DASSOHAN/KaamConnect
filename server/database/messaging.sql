-- Apply after schema.sql. App accounts are linked to Supabase Auth identities.
alter table public.users add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.users add column if not exists is_suspended boolean not null default false;
create unique index if not exists workers_user_id_unique on public.workers(user_id) where user_id is not null;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  status text not null default 'active' check (status in ('active','closed','blocked')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (job_id is not null or booking_id is not null)
);
create unique index if not exists conversations_job_worker_unique on public.conversations(job_id, worker_id) where job_id is not null;
create unique index if not exists conversations_booking_unique on public.conversations(booking_id) where booking_id is not null;
create index if not exists conversations_customer_updated_idx on public.conversations(customer_id, updated_at desc);
create index if not exists conversations_worker_updated_idx on public.conversations(worker_id, updated_at desc);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);
create index if not exists conversation_participants_user_idx on public.conversation_participants(user_id, conversation_id);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  sender_id uuid not null references public.users(id),
  labour_cost numeric(10,2) not null check (labour_cost >= 0),
  material_cost numeric(10,2) not null default 0 check (material_cost >= 0),
  travel_cost numeric(10,2) not null default 0 check (travel_cost >= 0),
  total_estimate numeric(10,2) generated always as (labour_cost + material_cost + travel_cost) stored,
  notes text not null default '',
  status text not null default 'proposed' check (status in ('proposed','change_requested','accepted','rejected')),
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotations_conversation_created_idx on public.quotations(conversation_id, created_at);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  message_type text not null check (message_type in ('text','image','system','quote')),
  message_text text,
  attachment_url text, -- Private bucket object path, never a public URL.
  quotation_id uuid references public.quotations(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  check ((message_type = 'text' and nullif(trim(message_text), '') is not null and attachment_url is null and quotation_id is null)
      or (message_type = 'image' and attachment_url is not null and quotation_id is null)
      or (message_type = 'system' and quotation_id is null)
      or (message_type = 'quote' and quotation_id is not null and attachment_url is null))
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_unread_idx on public.messages(conversation_id, is_read) where is_read = false;
create index if not exists messages_sender_created_idx on public.messages(sender_id, created_at desc);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  created_at timestamptz not null default now(),
  unique(message_id, reporter_id)
);
create index if not exists message_reports_status_created_idx on public.message_reports(status, created_at desc);

create table if not exists public.contact_sharing_attempts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  detection_type text not null check (detection_type in ('phone','email','whatsapp')),
  created_at timestamptz not null default now()
);
create index if not exists contact_sharing_attempts_created_idx on public.contact_sharing_attempts(created_at desc);

create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id),
  target_user_id uuid references public.users(id),
  conversation_id uuid references public.conversations(id),
  report_id uuid references public.message_reports(id),
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_rate_limits (
  user_id uuid primary key references public.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  message_count integer not null default 0
);
alter table public.chat_rate_limits enable row level security;

create or replace function public.consume_chat_rate_limit(target_user_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$ declare allowed boolean;
begin
  insert into public.chat_rate_limits(user_id, window_started_at, message_count)
  values (target_user_id, now(), 1)
  on conflict (user_id) do update set
    message_count = case when chat_rate_limits.window_started_at < now() - interval '1 minute' then 1 else chat_rate_limits.message_count + 1 end,
    window_started_at = case when chat_rate_limits.window_started_at < now() - interval '1 minute' then now() else chat_rate_limits.window_started_at end;
  select message_count <= 30 into allowed from public.chat_rate_limits where user_id = target_user_id;
  return allowed;
end $$;
revoke all on function public.consume_chat_rate_limit(uuid) from public;
grant execute on function public.consume_chat_rate_limit(uuid) to service_role;

create or replace function public.current_app_user_id() returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.users where auth_user_id = auth.uid() and not is_suspended limit 1 $$;

create or replace function public.can_access_conversation(target_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.conversation_participants cp
  where cp.conversation_id = target_conversation_id and cp.user_id = public.current_app_user_id()
) $$;

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.users where auth_user_id = auth.uid() and not is_suspended limit 1 $$;

revoke all on function public.current_app_user_id() from public;
revoke all on function public.can_access_conversation(uuid) from public;
grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.can_access_conversation(uuid) to authenticated;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

alter table public.users enable row level security;
drop policy if exists "users read own account" on public.users;
create policy "users read own account" on public.users for select to authenticated
using (auth_user_id = auth.uid() or public.current_app_role() = 'admin');

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.quotations enable row level security;
alter table public.message_reports enable row level security;
alter table public.contact_sharing_attempts enable row level security;
alter table public.admin_action_logs enable row level security;

drop policy if exists "participants read own conversations" on public.conversations;
create policy "participants read own conversations" on public.conversations for select to authenticated using (public.can_access_conversation(id));
drop policy if exists "participants read membership rows" on public.conversation_participants;
create policy "participants read membership rows" on public.conversation_participants for select to authenticated using (user_id = public.current_app_user_id());
drop policy if exists "participants read chat messages" on public.messages;
create policy "participants read chat messages" on public.messages for select to authenticated using (public.can_access_conversation(conversation_id));
drop policy if exists "participants read quotations" on public.quotations;
create policy "participants read quotations" on public.quotations for select to authenticated using (public.can_access_conversation(conversation_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-avatars', 'worker-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "workers upload own profile photo" on storage.objects;
create policy "workers upload own profile photo" on storage.objects for insert to authenticated
with check (bucket_id = 'worker-avatars' and (storage.foldername(name))[1] = public.current_app_user_id()::text and public.current_app_role() = 'worker');
drop policy if exists "workers update own profile photo" on storage.objects;
create policy "workers update own profile photo" on storage.objects for update to authenticated
using (bucket_id = 'worker-avatars' and (storage.foldername(name))[1] = public.current_app_user_id()::text and public.current_app_role() = 'worker')
with check (bucket_id = 'worker-avatars' and (storage.foldername(name))[1] = public.current_app_user_id()::text and public.current_app_role() = 'worker');
drop policy if exists "workers delete own profile photo" on storage.objects;
create policy "workers delete own profile photo" on storage.objects for delete to authenticated
using (bucket_id = 'worker-avatars' and (storage.foldername(name))[1] = public.current_app_user_id()::text and public.current_app_role() = 'worker');
drop policy if exists "participants upload chat attachments" on storage.objects;
create policy "participants upload chat attachments" on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments'
  and public.can_access_conversation((storage.foldername(name))[1]::uuid)
  and (storage.foldername(name))[2] = public.current_app_user_id()::text);

alter table public.messages replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
