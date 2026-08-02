-- The team_roles_job_access migration (2026-07-21) added a three-tier CHECK
-- constraint on team_members.role ('site_member' | 'manager' | 'admin') but
-- never updated the column's own DEFAULT, which was still the old two-tier
-- value 'member'. That default violates the table's own check constraint,
-- so any insert that relied on it (and the app code, which also wrote the
-- literal string 'member') has been failing with a constraint violation
-- since that migration went in. Fixes the default to match the constraint.
alter table public.team_members
  alter column role set default 'site_member';

-- Defensive: normalize any legacy 'member' rows that might exist despite
-- the constraint (e.g. written before the constraint was added).
update public.team_members set role = 'site_member' where role = 'member';
