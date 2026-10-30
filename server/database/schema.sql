create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(), full_name text not null, phone text unique,
  email text, role text not null check (role in ('customer','worker','admin')),
  language text default 'en', locality text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists services (
  id text primary key, name text not null, name_bn text, name_hi text, description text, icon text,
  active boolean not null default true, metadata jsonb not null default '{}', created_at timestamptz default now()
);
create table if not exists service_tasks (
  id text primary key, service_id text not null references services(id) on delete cascade,
  name text not null, name_bn text, name_hi text, description text, base_price numeric(10,2) not null default 0,
  active boolean not null default true, metadata jsonb not null default '{}', created_at timestamptz default now()
);
create table if not exists workers (
  id uuid primary key default gen_random_uuid(), user_id uuid references users(id) on delete cascade,
  legacy_id text unique, trade_id text not null references services(id), bio text, profile_photo_url text,
  locality text, address_area text, latitude double precision, longitude double precision,
  is_available boolean not null default false, kyc_status text not null default 'pending'
    check (kyc_status in ('pending','verified','rejected','suspended')),
  identity_verified boolean not null default false, background_verified boolean not null default false,
  aadhaar_verified boolean not null default false, experience_years integer not null default 0,
  jobs_completed integer not null default 0, rating_average numeric(3,2) not null default 0,
  rating_count integer not null default 0, half_day_rate numeric(10,2) not null default 0,
  daily_rate numeric(10,2) not null default 0, metadata jsonb not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now(), last_active_at timestamptz
);
create table if not exists worker_skills (
  id uuid primary key default gen_random_uuid(), worker_id uuid not null references workers(id) on delete cascade,
  skill_name text not null, created_at timestamptz default now(), unique(worker_id, skill_name)
);
create table if not exists locations (
  id text primary key, name text not null, district text default 'Nadia', state text default 'West Bengal',
  latitude double precision, longitude double precision, active boolean default true, metadata jsonb default '{}'
);
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(), customer_id uuid references users(id), service_id text not null references services(id),
  task_id text references service_tasks(id), title text not null, description text, photo_url text, locality text not null,
  address_details text, latitude double precision, longitude double precision,
  urgency text not null default 'normal' check (urgency in ('normal','urgent','emergency')),
  preferred_date date, preferred_time text, estimated_price_min numeric(10,2), estimated_price_max numeric(10,2),
  status text not null default 'open' check (status in ('open','assigned','in_progress','completed','cancelled')),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(), legacy_id text unique, job_id uuid references jobs(id),
  customer_id uuid references users(id), worker_id uuid references workers(id), service_id text not null references services(id),
  task_id text references service_tasks(id), booking_type text not null default 'immediate' check (booking_type in ('immediate','scheduled')),
  scheduled_date date, scheduled_slot text, locality text, address_details text, estimated_price_min numeric(10,2),
  estimated_price_max numeric(10,2), final_price numeric(10,2), payment_method text, payment_status text default 'pending',
  status text not null default 'pending' check (status in ('pending','confirmed','en_route','arrived','in_progress','completed','cancelled','rejected')),
  otp text, metadata jsonb not null default '{}', created_at timestamptz default now(), updated_at timestamptz default now(), completed_at timestamptz
);
create table if not exists job_offers (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade, offered_price numeric(10,2) not null,
  message text, status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz default now(), updated_at timestamptz default now(), unique(job_id,worker_id)
);
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references bookings(id) on delete cascade,
  customer_id uuid references users(id), worker_id uuid not null references workers(id),
  rating integer not null check (rating between 1 and 5), review_text text, created_at timestamptz default now()
);
create index if not exists workers_trade_id_idx on workers(trade_id);
create index if not exists workers_is_available_idx on workers(is_available);
create index if not exists workers_locality_idx on workers(locality);
create index if not exists workers_kyc_status_idx on workers(kyc_status);
create index if not exists worker_skills_worker_id_idx on worker_skills(worker_id);
create index if not exists jobs_status_idx on jobs(status);
create index if not exists jobs_service_id_idx on jobs(service_id);
create index if not exists jobs_customer_id_idx on jobs(customer_id);
create index if not exists bookings_worker_id_idx on bookings(worker_id);
create index if not exists bookings_customer_id_idx on bookings(customer_id);
create index if not exists bookings_status_idx on bookings(status);
create index if not exists reviews_worker_id_idx on reviews(worker_id);
create unique index if not exists bookings_job_id_unique on bookings(job_id) where job_id is not null;

create or replace function update_worker_rating_summary() returns trigger language plpgsql as $$
begin
  update workers set rating_count = (select count(*) from reviews where worker_id = new.worker_id),
    rating_average = (select coalesce(avg(rating),0) from reviews where worker_id = new.worker_id), updated_at = now()
  where id = new.worker_id;
  return new;
end; $$;
drop trigger if exists reviews_update_worker_rating on reviews;
create trigger reviews_update_worker_rating after insert on reviews for each row execute function update_worker_rating_summary();

create or replace function update_completed_worker_jobs() returns trigger language plpgsql as $$
begin
  if new.worker_id is not null and new.status = 'completed' and
     (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    update workers set jobs_completed = jobs_completed + 1, updated_at = now() where id = new.worker_id;
  end if;
  return new;
end; $$;
drop trigger if exists bookings_update_worker_completed_jobs on bookings;
create trigger bookings_update_worker_completed_jobs after insert or update of status on bookings
for each row execute function update_completed_worker_jobs();
