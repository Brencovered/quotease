-- Applied directly via Supabase MCP; committed here for traceability.
--
-- supabase/migrations/0009_materials_pricing.sql (see that file) was
-- written with a comment saying "Run this in the Supabase SQL editor"
-- but was never actually applied to production - same class of bug as
-- lead_subscriptions/lead_matching_log found earlier today. Pricing
-- Tiers, Job Size Tiers, and Material Bundles have been completely
-- non-functional for every user (not a team-scoping issue - the tables
-- genuinely didn't exist), surfaced as browser console 500s on
-- /api/pricing-tiers, /api/job-size-tiers, /api/material-bundles.
--
-- Applied here with team-aware RLS (accessible_business_ids()) from
-- the start, rather than the original file's plain auth.uid() =
-- profile_id, to avoid recreating the exact team-scoping bug fixed
-- everywhere else today.

create table if not exists pricing_tiers (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  name         text not null,
  markup_pct   numeric not null default 0,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

alter table pricing_tiers enable row level security;
create policy "Business pricing tiers" on pricing_tiers
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
create index if not exists pricing_tiers_profile_idx on pricing_tiers(profile_id, sort_order);

create table if not exists job_size_tiers (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  name         text not null,
  max_days     numeric,
  markup_pct   numeric not null default 0,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

alter table job_size_tiers enable row level security;
create policy "Business job size tiers" on job_size_tiers
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
create index if not exists job_size_tiers_profile_idx on job_size_tiers(profile_id, sort_order);

create table if not exists material_bundles (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  title        text not null,
  trade        text not null default 'electrician',
  description  text,
  status       text not null default 'active',
  created_at   timestamptz not null default now()
);

alter table material_bundles enable row level security;
create policy "Business material bundles" on material_bundles
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
create index if not exists material_bundles_profile_idx on material_bundles(profile_id, status);

create table if not exists material_bundle_items (
  id           uuid primary key default gen_random_uuid(),
  bundle_id    uuid not null references material_bundles(id) on delete cascade,
  label        text not null,
  qty          numeric not null default 1,
  unit         text not null default 'each',
  unit_cost    numeric not null default 0,
  sort_order   int not null default 0
);

alter table material_bundle_items enable row level security;
create policy "Business material bundle items" on material_bundle_items
  for all
  using (exists (select 1 from material_bundles b where b.id = material_bundle_items.bundle_id and b.profile_id in (select accessible_business_ids(auth.uid()))))
  with check (exists (select 1 from material_bundles b where b.id = material_bundle_items.bundle_id and b.profile_id in (select accessible_business_ids(auth.uid()))));
create index if not exists material_bundle_items_bundle_idx on material_bundle_items(bundle_id, sort_order);

alter table quotes add column if not exists pricing_tier_id uuid references pricing_tiers(id) on delete set null;
alter table quotes add column if not exists job_size_tier_id uuid references job_size_tiers(id) on delete set null;
