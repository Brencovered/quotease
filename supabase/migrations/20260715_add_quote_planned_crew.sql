-- Lets a tradie say "this quote assumes N staff" while still quoting,
-- not just after it becomes a job. Purely additive - existing quotes
-- default to an empty array, nothing else on the quotes table changes.
-- See lib/jobs.ts's getOrCreateJobForQuote, which seeds the job's crew
-- (job_crew table) from this array the moment the quote becomes a job,
-- so staff picked at quote time carry straight over rather than needing
-- to be re-picked from scratch on the Schedule tab.

alter table quotes add column if not exists planned_crew_member_ids uuid[] not null default '{}';
