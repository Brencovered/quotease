-- Allow tasks with no quote/job (standalone team tasks).
-- Job-linked tasks still set job_id and/or quote_id as usual.

alter table public.job_tasks
  alter column quote_id drop not null;

comment on column public.job_tasks.quote_id is
  'Optional. Null for standalone tasks not tied to a quote.';

comment on column public.job_tasks.job_id is
  'Optional. Null for standalone tasks not tied to a job.';
