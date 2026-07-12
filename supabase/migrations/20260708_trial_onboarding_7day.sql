-- 7-day trial onboarding tracking. Applied directly via Supabase MCP;
-- committed here for history/traceability (see lib/onboarding.ts).

-- Trial length: bump signup trigger from 3 days to 7 days.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, business_name, contact_email, trial_ends_at)
  values (
    new.id,
    new.raw_user_meta_data->>'business_name',
    new.email,
    now() + interval '7 days'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$function$;

-- One row per business tracking onboarding checklist state. Most milestones
-- are derived live from existing tables (quotes, jobs, team_members, etc)
-- at read time -- this table only holds the handful of things with no clean
-- DB signal (AI assistant usage, report views) plus dismiss state.
create table if not exists public.onboarding_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  dismissed boolean not null default false,
  ai_assistant_used_at timestamptz,
  report_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_state enable row level security;

drop policy if exists "Business onboarding state" on public.onboarding_state;
create policy "Business onboarding state" on public.onboarding_state
  for all using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));

create or replace function public.touch_onboarding_state_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_onboarding_state_updated_at on public.onboarding_state;
create trigger trg_onboarding_state_updated_at
  before update on public.onboarding_state
  for each row execute function public.touch_onboarding_state_updated_at();

-- Idempotency guard for the daily trial-nudge-email cron -- prevents a
-- re-run or a slow cron from double-sending the same day's email.
alter table public.onboarding_state
  add column if not exists last_nudge_sent_day integer;
