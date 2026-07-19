-- Claimed directory page ($4.99/mo standalone tier) - phase 1 schema
--
-- Extends existing directory_listing / profiles tables rather than
-- introducing a parallel business_pages table, since the claim
-- mechanism (is_claimed, claim_token, profile_id) and gallery storage
-- (photo_references) already exist on directory_listing, and abn /
-- license_number already exist on profiles for any claimed business
-- (claiming requires a profile to exist).
--
-- tradie_directory_settings is deliberately left untouched -- it's
-- scaffolded for the separate lead-matching feature (LEADS_ENABLED,
-- job_requests/job_claims) and repurposing it risks collision if that
-- feature is switched back on later.

-- 1. ABN verification / trust badge on profiles
alter table profiles
  add column if not exists abn_verified_at timestamptz,
  add column if not exists directory_badge_verified boolean not null default false;

comment on column profiles.abn_verified_at is 'Set when the entered ABN was successfully matched via the ABN Lookup API. Null if unverified.';
comment on column profiles.directory_badge_verified is 'Whether the "Verified Business" badge shows on the claimed directory page. Never set to false automatically once true -- no public score that can fall.';

-- 2. Monthly goal setting (self-set, private to the tradie, quote requests only)
create table if not exists directory_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  month_start date not null,
  target_quotes integer not null check (target_quotes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, month_start)
);

alter table directory_goals enable row level security;

create policy "Users manage their own directory goals"
  on directory_goals
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

comment on table directory_goals is 'Self-set monthly quote-request targets for claimed directory pages. Private to the tradie -- no public score or leaderboard.';

-- 3. Claim attempt audit log (supports dispute resolution via /admin)
create table if not exists directory_claim_attempts (
  id uuid primary key default gen_random_uuid(),
  attempted_business_name text not null,
  suburb text,
  trade text,
  matched_listing_id uuid references directory_listing(id) on delete set null,
  attempted_by_profile_id uuid references profiles(id) on delete set null,
  outcome text not null check (outcome in ('claimed', 'created_new', 'disputed', 'rejected')),
  created_at timestamptz not null default now()
);

alter table directory_claim_attempts enable row level security;

create policy "Only admins can read claim attempts"
  on directory_claim_attempts
  for select
  using (false);

comment on table directory_claim_attempts is 'Audit trail of directory listing claim attempts, for /admin dispute resolution. No end-user read access via RLS -- read via service role / admin routes only.';

-- 4. Fuzzy business-name matching support for the signup lookup flow
create extension if not exists pg_trgm;

create index if not exists directory_listing_business_name_trgm_idx
  on directory_listing
  using gin (business_name gin_trgm_ops);
