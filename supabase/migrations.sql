-- ============================================================
-- SWIFTSCOPE v2 MIGRATION
-- Run in Supabase SQL editor after the initial schema.sql
-- ============================================================

-- Client address book
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  billing_address text,
  abn text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table clients enable row level security;
create policy "Own clients" on clients for all using (auth.uid() = profile_id);

-- Add client_id + scheduling + follow-up + expiry columns to quotes
alter table quotes
  add column if not exists client_id uuid references clients(id) on delete set null,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists estimated_days numeric,
  add column if not exists follow_up_at date,
  add column if not exists follow_up_sent_at timestamptz,
  add column if not exists quote_expires_at date,
  add column if not exists declined_reason text;

-- Variation orders (scope changes against an accepted quote)
create table if not exists variations (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  labour_hours numeric not null default 0,
  materials_cost numeric not null default 0,
  total_cost numeric not null default 0,
  status text not null default 'pending', -- pending, approved, declined
  client_approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table variations enable row level security;
create policy "Own variations" on variations for all using (auth.uid() = profile_id);

-- Job costing actuals (time + materials actually used vs quoted)
create table if not exists job_actuals (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  actual_hours numeric not null default 0,
  actual_materials_cost numeric not null default 0,
  notes text,
  recorded_at timestamptz not null default now()
);
alter table job_actuals enable row level security;
create policy "Own job actuals" on job_actuals for all using (auth.uid() = profile_id);

-- Compliance certificates per job
create table if not exists compliance_certs (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  cert_type text not null, -- CCEW, COC, ESC, other
  cert_number text,
  issued_date date,
  expiry_date date,
  storage_path text,       -- optional uploaded PDF
  notes text,
  created_at timestamptz not null default now()
);
alter table compliance_certs enable row level security;
create policy "Own compliance certs" on compliance_certs for all using (auth.uid() = profile_id);

-- Follow-up log (tracks when follow-up emails were sent/noted)
create table if not exists follow_up_log (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  method text not null default 'email', -- email, phone, sms, in_person
  notes text,
  followed_up_at timestamptz not null default now()
);
alter table follow_up_log enable row level security;
create policy "Own follow up log" on follow_up_log for all using (auth.uid() = profile_id);

-- Add markup_materials to quotes (drawing markup cost total)
alter table quotes add column if not exists markup_materials integer not null default 0;

-- Add calibration + shapes (jsonb) to client_plans (replaces legacy annotations)
alter table client_plans add column if not exists shapes jsonb not null default '[]';
alter table client_plans add column if not exists calibration jsonb;

-- ── Supplier price book ──────────────────────────────────────────────────────
-- Stores items imported from supplier CSV files (Reece, Tradelink, Middy's etc)
-- Separate from material_items which stores the tradie's own custom pricing

create table if not exists price_book_items (
  id           uuid primary key default uuid_generate_v4(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  supplier     text not null,                    -- e.g. 'reece', 'tradelink', 'middys'
  sku          text,                             -- supplier part number
  description  text not null,
  unit         text not null default 'ea',       -- ea, m, sqm, L, kg etc
  cost_price   numeric not null default 0,       -- ex GST supplier cost
  trade        text,                             -- optional trade tag
  imported_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table price_book_items enable row level security;
create policy "Own price book" on price_book_items for all using (auth.uid() = profile_id);
create index if not exists price_book_items_profile_search on price_book_items(profile_id, supplier);

-- ── Xero OAuth tokens ────────────────────────────────────────────────────────
alter table profiles
  add column if not exists xero_tenant_id        text,
  add column if not exists xero_access_token      text,
  add column if not exists xero_refresh_token     text,
  add column if not exists xero_token_expires_at  timestamptz,
  add column if not exists xero_connected_at      timestamptz;

-- Track which quotes have been pushed to Xero (xero_invoice_id already exists)
-- xero_exported_at already exists too - we reuse those columns

-- ── Xero contact mappings ────────────────────────────────────────────────────
-- Maps a Swiftscope client to their Xero contact ID.
-- Prevents duplicate contacts being created in Xero on every sync.
-- swiftscope_customer_id references client_name on quotes (via profile_id).
-- We use the clients table as the source of truth for customer identity.

create table if not exists xero_contact_mappings (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid not null references profiles(id) on delete cascade,
  client_email           text not null,          -- Swiftscope client identifier
  xero_contact_id        text not null,          -- Xero's ContactID (GUID)
  xero_contact_name      text,                   -- cached for display
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique(profile_id, client_email)               -- one Xero contact per client per tradie
);

alter table xero_contact_mappings enable row level security;
create policy "Own xero mappings" on xero_contact_mappings
  for all using (auth.uid() = profile_id);

-- Also add xero_connected_at if not already present (may have been missed)
alter table profiles
  add column if not exists xero_connected_at timestamptz;
