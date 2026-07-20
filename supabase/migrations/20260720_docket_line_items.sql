-- Restructure dockets from a flat single-rate record into a proper
-- multi-line dayworks sheet: a header (dockets) with labour/plant/material
-- line items (docket_items), plus a reusable catalog of rates the tradie
-- charges builders/contractors (docket_rate_items) so entering a line is
-- "pick from my usual rates" rather than typing a rate from scratch every
-- time, with a custom entry still available for one-off outliers.

-- 1. The tradie's saved catalog of labour roles and plant/equipment items
-- they bill against, each with a default rate. Materials aren't duplicated
-- here - the existing price book already covers materials.
create table if not exists public.docket_rate_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('labour', 'plant')),
  label text not null, -- e.g. "Labourer", "Machine Operator", "Excavator", "Tipper Truck"
  default_rate numeric not null default 0,
  unit text not null default 'hour',
  created_at timestamptz not null default now()
);

create index if not exists docket_rate_items_profile_id_idx on public.docket_rate_items (profile_id);

alter table public.docket_rate_items enable row level security;
create policy "Business docket rate items" on public.docket_rate_items
  for all
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- 2. Drop the old flat-rate columns on dockets and add header-level fields
-- from the daywork sheet template (weather, client/site contact, duration).
-- Dependent generated columns (total_cost, billed_hours) must drop first.
alter table public.dockets drop column if exists total_cost;
alter table public.dockets drop column if exists billed_hours;
alter table public.dockets drop column if exists labour_hours;
alter table public.dockets drop column if exists hourly_rate;
alter table public.dockets drop column if exists minimum_hours;
alter table public.dockets drop column if exists materials_cost;

alter table public.dockets add column if not exists weather text;
alter table public.dockets add column if not exists client_name text;
alter table public.dockets add column if not exists start_time time;
alter table public.dockets add column if not exists end_time time;
-- total_cost is now maintained by a trigger (sum of docket_items), since a
-- generated column can't reference rows in a different table.
alter table public.dockets add column if not exists total_cost numeric not null default 0;

-- 3. Line items: one row per person (labour), per plant item, per material,
-- or a custom one-off entry for whatever came up on the day.
create table if not exists public.docket_items (
  id uuid primary key default gen_random_uuid(),
  docket_id uuid not null references public.dockets(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('labour', 'plant', 'material', 'custom')),

  -- Set when the line was picked from the tradie's saved catalog; null for
  -- a one-off custom entry (or for materials, which reference the existing
  -- price book by name only, not by id, matching how quotes already store
  -- material line items as plain text + cost rather than a live FK).
  source_rate_item_id uuid references public.docket_rate_items(id) on delete set null,

  label text not null, -- role/item name (labour/plant/custom) or material name
  person_name text, -- who worked this line, labour only

  start_time time,
  end_time time,
  quantity numeric not null default 0, -- hours (labour/plant) or amount (material)
  rate numeric not null default 0,
  line_total numeric generated always as (quantity * rate) stored,

  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists docket_items_docket_id_idx on public.docket_items (docket_id);
create index if not exists docket_items_profile_id_idx on public.docket_items (profile_id);

alter table public.docket_items enable row level security;
create policy "Business docket items" on public.docket_items
  for all
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- 4. Keep dockets.total_cost in sync with the sum of its line items,
-- so nothing downstream (job totals, EOM invoice bundling) needs to
-- re-join and re-sum line items itself.
create or replace function public.recalc_docket_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_docket_id uuid;
begin
  affected_docket_id := coalesce(new.docket_id, old.docket_id);
  update public.dockets
  set total_cost = (select coalesce(sum(line_total), 0) from public.docket_items where docket_id = affected_docket_id),
      updated_at = now()
  where id = affected_docket_id;
  return null;
end;
$$;

drop trigger if exists docket_items_recalc_total on public.docket_items;
create trigger docket_items_recalc_total
  after insert or update or delete on public.docket_items
  for each row execute function public.recalc_docket_total();

comment on table public.docket_rate_items is 'Tradie''s reusable catalog of labour roles and plant/equipment rates for dayworks dockets.';
comment on table public.docket_items is 'Line items (labour, plant, material, or custom) making up one dayworks docket.';
