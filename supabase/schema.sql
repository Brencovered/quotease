-- Tradie Quote App schema
-- Run this in the Supabase SQL editor for a new project

create extension if not exists "uuid-ossp";

-- One row per tradie business using the app
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  trades text[] not null default '{}', -- e.g. {'electrician','carpenter'} - chosen during onboarding, not before signup
  hourly_rate numeric not null default 95,
  materials_margin_pct numeric not null default 20,
  contact_email text,
  contact_phone text,
  onboarded_at timestamptz, -- set once they've picked their trades; null means they land back on /onboarding
  xero_connected boolean not null default false,
  xero_tenant_id text,
  xero_access_token text,
  xero_refresh_token text,
  xero_token_expires_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'none', -- none, trialing, active, past_due, canceled
  subscription_plan text,                            -- monthly, annual
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- Per-tradie material price book. Seeded with placeholder defaults on signup,
-- then overwritten by their own CSV upload or manual edits.
create table material_items (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  trade text not null default 'electrician',
  item_key text not null,      -- stable key the calculator references, e.g. 'pp', 'dl_builder'
  label text not null,         -- display name, e.g. 'Power point'
  unit_cost numeric not null default 0,
  supplier text,
  updated_at timestamptz not null default now(),
  unique (profile_id, item_key)
);

-- A saved job + quote
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  client_name text,
  client_email text,
  client_phone text,
  site_address text,
  trade text not null default 'electrician',
  job_type text,
  -- raw form inputs, stored as JSON so the schema doesn't need to change
  -- every time a field is added to a trade's intake form
  intake_data jsonb not null default '{}',
  labour_hours numeric,
  materials_cost numeric,
  total_cost numeric,
  -- draft -> sent -> accepted -> (outstanding while amount_paid < total_cost) -> paid
  -- declined is a dead end from sent. "outstanding" isn't its own stored value —
  -- it's derived in the UI from status='accepted' and amount_paid < total_cost,
  -- so partial payments update naturally without a separate status to keep in sync.
  status text not null default 'draft', -- draft, sent, accepted, declined, paid
  amount_paid numeric not null default 0,
  -- e.g. [{"label":"Deposit","percent":30,"trigger":"acceptance","days":0},
  --       {"label":"Final payment","percent":70,"trigger":"completion","days":7}]
  -- trigger is when the clock starts: 'acceptance', 'completion', or 'invoice_date'.
  -- Defaults to a single 100%-on-completion term if a tradie never sets one.
  payment_terms jsonb not null default '[{"label":"Payment due","percent":100,"trigger":"completion","days":14}]',
  pdf_url text,
  sent_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz, -- when the job itself was finished, separate from when the quote was accepted
  paid_at timestamptz, -- set when amount_paid reaches total_cost
  invoice_number text,          -- e.g. INV-0001, generated when first exported to Xero
  xero_exported_at timestamptz, -- set when included in a CSV export, so it isn't exported twice
  xero_invoice_id text,         -- only used if a tradie later connects full Xero OAuth
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-tradie running invoice number counter, so invoice numbers are
-- sequential per business rather than global across all tradies
create table invoice_counters (
  profile_id uuid primary key references profiles(id) on delete cascade,
  next_number integer not null default 1
);
alter table invoice_counters enable row level security;
create policy "Own invoice counter" on invoice_counters
  for all using (auth.uid() = profile_id);

alter table profiles enable row level security;
alter table material_items enable row level security;
alter table quotes enable row level security;

create policy "Own profile" on profiles
  for all using (auth.uid() = id);

create policy "Own materials" on material_items
  for all using (auth.uid() = profile_id);

create policy "Own quotes" on quotes
  for all using (auth.uid() = profile_id);
