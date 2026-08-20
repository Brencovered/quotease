-- Track when someone taps Start on a job so Done can auto-log hours.

alter table public.jobs
  add column if not exists work_started_at timestamptz;
