-- Materials Pricing Enhancement
-- Run this in the Supabase SQL editor

-- ── Pricing Tiers: customer-type markup rules ─────────────────────────
create table if not exists pricing_tiers (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  name         text not null,
  markup_pct   numeric not null default 0,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

alter table pricing_tiers enable row level security;
create policy "Own pricing tiers" on pricing_tiers
  for all using (auth.uid() = profile_id);
create index if not exists pricing_tiers_profile_idx on pricing_tiers(profile_id, sort_order);

-- ── Job Size Tiers: job-size bracket rules ────────────────────────────
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
create policy "Own job size tiers" on job_size_tiers
  for all using (auth.uid() = profile_id);
create index if not exists job_size_tiers_profile_idx on job_size_tiers(profile_id, sort_order);

-- ── Material Bundles: material-only bundles ──────────────────────────
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
create policy "Own material bundles" on material_bundles
  for all using (auth.uid() = profile_id);
create index if not exists material_bundles_profile_idx on material_bundles(profile_id, status);

-- ── Material Bundle Items: items within a bundle ─────────────────────
create table if not exists material_bundle_items (
  id           uuid primary key default gen_random_uuid(),
  bundle_id    uuid not null references material_bundles(id) on delete cascade,
  label        text not null,
  qty          numeric not null default 1,
  unit         text not null default 'each',
  unit_cost    numeric not null default 0,
  sort_order   int not null default 0
);

create index if not exists material_bundle_items_bundle_idx on material_bundle_items(bundle_id, sort_order);

-- ── Add pricing tier references to quotes ────────────────────────────
alter table quotes add column if not exists pricing_tier_id uuid references pricing_tiers(id) on delete set null;
alter table quotes add column if not exists job_size_tier_id uuid references job_size_tiers(id) on delete set null;
