-- Local-dev-only supplement.
--
-- These objects exist in the production Supabase project but are NOT captured
-- in the repository's tracked SQL (schema.sql / migrations.sql / migrations/),
-- so a database bootstrapped purely from tracked SQL is missing them and the
-- app breaks locally. Recreate the minimal set needed to exercise the core
-- signup -> onboarding -> quote flow on a fresh local stack.

-- handle_new_user() is defined (via CREATE OR REPLACE) in
-- supabase/migrations/20260713_fix_handle_new_user_trade_suburb.sql, but the
-- trigger that binds it to auth.users -- the standard Supabase "new user" hook
-- that inserts the profiles row (and starts the 7-day trial) -- only exists in
-- production. Without it, auth.signUp() creates the auth user but no profile,
-- and the app's post-signup profiles.update() touches zero rows.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles columns that the app reads/writes but that no tracked SQL creates
-- (added to production via untracked migrations). Without them, onboarding,
-- billing access checks and the quote builder fail with "column ... not found".
-- Types are best-effort but functionally correct for local dev.
alter table public.profiles add column if not exists team_size integer;
alter table public.profiles add column if not exists comp_access boolean not null default false;
alter table public.profiles add column if not exists default_deposit_pct numeric;
alter table public.profiles add column if not exists default_expiry_days integer;
alter table public.profiles add column if not exists archetype_defaults jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists cancel_at_period_end boolean not null default false;

-- Make PostgREST pick up the new columns without a restart.
notify pgrst, 'reload schema';
