-- Real jobs entity, decoupled from quotes. See lib/jobs.ts for app-side
-- helpers. Applied directly via Supabase MCP on 2026-07-06; committed here
-- for history/traceability.

do $$ begin
  create type job_status as enum (
    'scheduled', 'in_progress', 'on_hold', 'awaiting_sign_off',
    'complete', 'invoiced', 'partially_paid', 'archived', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.job_counters (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  next_number integer not null default 1
);
alter table public.job_counters enable row level security;
drop policy if exists "Business job counters" on public.job_counters;
create policy "Business job counters" on public.job_counters
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

create table if not exists public.jobs (
  id uuid primary key default extensions.uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  job_number integer not null,
  title text,
  trade text,
  status job_status not null default 'scheduled',
  source text not null default 'quote' check (source in ('quote', 'quick', 'recurring')),
  client_name text,
  client_email text,
  client_phone text,
  site_address text,
  site_notes text,
  site_lat numeric,
  site_lng numeric,
  labour_hours numeric,
  materials_cost numeric,
  total_cost numeric,
  amount_paid numeric not null default 0,
  scheduled_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  assigned_to_member_id uuid references public.team_members(id) on delete set null,
  is_recurring_template boolean not null default false,
  recurrence_rule jsonb,
  parent_job_id uuid references public.jobs(id) on delete set null,
  next_occurrence_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  invoiced_at timestamptz,
  archived_at timestamptz,
  cancelled_at timestamptz,
  paid_at timestamptz,
  unique (profile_id, job_number)
);

create index if not exists jobs_profile_id_idx on public.jobs(profile_id);
create index if not exists jobs_quote_id_idx on public.jobs(quote_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_next_occurrence_idx on public.jobs(next_occurrence_date) where is_recurring_template;

alter table public.jobs enable row level security;
drop policy if exists "Business jobs" on public.jobs;
create policy "Business jobs" on public.jobs
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

create or replace function public.assign_job_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if new.job_number is not null then return new; end if;
  insert into job_counters (profile_id, next_number) values (new.profile_id, 2)
  on conflict (profile_id) do update set next_number = job_counters.next_number + 1
  returning next_number - 1 into n;
  new.job_number := n;
  return new;
end;
$$;

drop trigger if exists trg_assign_job_number on public.jobs;
create trigger trg_assign_job_number before insert on public.jobs
  for each row execute function public.assign_job_number();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.job_actuals add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.job_attachments add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.job_tasks add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.variations add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.compliance_certs add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.follow_up_log add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.payments add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.communication_log add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.schedule_events add column if not exists job_id uuid references public.jobs(id) on delete set null;
alter table public.calendar_events add column if not exists job_id uuid references public.jobs(id) on delete set null;

create index if not exists job_actuals_job_id_idx on public.job_actuals(job_id);
create index if not exists job_attachments_job_id_idx on public.job_attachments(job_id);
create index if not exists job_tasks_job_id_idx on public.job_tasks(job_id);
create index if not exists variations_job_id_idx on public.variations(job_id);
create index if not exists compliance_certs_job_id_idx on public.compliance_certs(job_id);
create index if not exists follow_up_log_job_id_idx on public.follow_up_log(job_id);
create index if not exists payments_job_id_idx on public.payments(job_id);
create index if not exists communication_log_job_id_idx on public.communication_log(job_id);
create index if not exists schedule_events_job_id_idx on public.schedule_events(job_id);
create index if not exists calendar_events_job_id_idx on public.calendar_events(job_id);
