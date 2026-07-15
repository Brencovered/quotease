-- Business + trade customizable site conditions (Level 2 connection fees,
-- switchboard isolation, scaffolding, etc). Previously a static, hardcoded
-- per-trade list in lib/peripherals.ts (PERIPHERALS_BY_TRADE) with no way
-- for a business to set their own defaults - every electrician saw the
-- same $350/$120 starting figures. This table makes those figures
-- business-owned: lib/peripherals.ts's hardcoded list becomes a one-time
-- seed source only (see getPeripheralsForBusiness), not the source of
-- truth once a business has any rows here.

create table if not exists site_condition_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  trade text not null,
  label text not null,
  kind text not null check (kind in ('fixed','daily')),
  default_amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_condition_templates_profile_trade_idx
  on site_condition_templates(profile_id, trade);

alter table site_condition_templates enable row level security;

create policy "Business site condition templates" on site_condition_templates
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
