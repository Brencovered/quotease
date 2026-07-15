-- Multi-person crew assignment for jobs.
--
-- jobs.assigned_to_member_id is a single column - a job can only ever have
-- one person on it. Real crews are 2-5+ people. This is purely additive:
-- assigned_to_member_id is untouched (schedule calendar, dashboard stats,
-- and job list all still read it as the "primary"/scheduling contact), and
-- job_crew is a new table layered on top for "who's actually on site."
--
-- No existing column, view, or function is modified or dropped.

create table if not exists job_crew (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (job_id, team_member_id)
);

create index if not exists job_crew_job_id_idx on job_crew(job_id);
create index if not exists job_crew_team_member_id_idx on job_crew(team_member_id);

alter table job_crew enable row level security;

-- Matches the existing "Business jobs" / "Business job attachments" pattern
-- used everywhere else in the schema (accessible_business_ids scoping).
create policy "Business job crew" on job_crew
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
