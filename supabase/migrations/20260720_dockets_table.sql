-- Dayworks dockets: a per-day, signed record of hours + materials against a
-- job/project, for time-and-materials billing rather than a fixed quote.
-- Multiple dockets accumulate against one job and bundle into a single
-- end-of-month invoice (see jobs.invoiced_at / jobs.total_cost, which the
-- EOM bundling flow will populate from the sum of a job's dockets).

create table if not exists public.dockets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,

  work_date date not null default current_date,
  description text,

  labour_hours numeric not null default 0,
  hourly_rate numeric not null default 0,
  minimum_hours numeric not null default 4,
  materials_cost numeric not null default 0,

  -- Billed hours are floored at minimum_hours (e.g. a 4-hour minimum
  -- callout), not the raw hours worked.
  billed_hours numeric generated always as (greatest(labour_hours, minimum_hours)) stored,
  total_cost numeric generated always as (greatest(labour_hours, minimum_hours) * hourly_rate + materials_cost) stored,

  status text not null default 'draft' check (status in ('draft', 'sent', 'signed', 'invoiced')),

  -- Client-facing signing link, same pattern as quotes.public_token
  public_token uuid not null default gen_random_uuid(),

  signed_by_name text,
  signature_data text, -- base64 PNG data URL of the drawn signature
  signed_at timestamptz,

  invoiced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dockets_public_token_idx on public.dockets (public_token);
create index if not exists dockets_job_id_idx on public.dockets (job_id);
create index if not exists dockets_profile_id_idx on public.dockets (profile_id);
create index if not exists dockets_status_idx on public.dockets (status);

alter table public.dockets enable row level security;

-- Matches the existing team-aware pattern used by variations/jobs/quotes.
create policy "Business dockets" on public.dockets
  for all
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

comment on table public.dockets is 'Per-day, client-signed dayworks records against a job. Bundle into one EOM invoice.';
