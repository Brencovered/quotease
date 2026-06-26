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
  logo_url text,
  abn text,
  license_number text,
  business_address text,
  terms_and_conditions text default 'Quote valid for 30 days. Materials and labour as listed above. Any variation to the scope of work will be quoted separately before proceeding. Payment due as per the terms stated on this quote.',
  -- AI drawing analysis: 3 free lifetime uses per account, then requires
  -- the paid add-on. ai_addon_period is reset lazily (compared against the
  -- current month at request time) rather than via a cron job.
  ai_free_analyses_used integer not null default 0,
  ai_addon_status text not null default 'none', -- none, active, canceled
  ai_addon_subscription_id text,
  ai_addon_period text,
  ai_addon_analyses_used integer not null default 0,
  bank_account_name text,
  bank_bsb text,
  bank_account_number text,
  accepts_cash boolean not null default true,
  created_at timestamptz not null default now()
);

-- Storage bucket for company logos. Public read (renders in quote emails
-- without a signed URL), write restricted to the owning profile's own
-- folder (path prefix = their user id) via the policies below.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "Logo public read"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "Logo owner write"
  on storage.objects for insert
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Logo owner update"
  on storage.objects for update
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Logo owner delete"
  on storage.objects for delete
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

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
  site_lat numeric,             -- geocoded once for the map view, cached so it's never repeated
  site_lng numeric,
  -- Job-execution info: what to know before turning up, when it's
  -- scheduled, who's doing it, and what to buy.
  site_notes text,
  scheduled_date date,
  assigned_to text,
  materials_checklist jsonb not null default '[]',
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

-- Files attached to a job (drawings, plans, site photos), uploaded once a
-- quote is accepted and becomes a job to actually complete.
create table job_attachments (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_type text,
  file_size integer,
  created_at timestamptz not null default now()
);
alter table job_attachments enable row level security;
create policy "Own job attachments" on job_attachments
  for all using (auth.uid() = profile_id);

-- Private bucket - these are site drawings/plans, not meant to be public
-- like logos. Access goes through signed URLs the owning tradie generates,
-- gated by the same folder-prefix-matches-auth.uid() pattern as logos.
insert into storage.buckets (id, name, public)
values ('job-files', 'job-files', false)
on conflict (id) do nothing;

create policy "Job file owner read"
  on storage.objects for select
  using (bucket_id = 'job-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Job file owner write"
  on storage.objects for insert
  with check (bucket_id = 'job-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Job file owner delete"
  on storage.objects for delete
  using (bucket_id = 'job-files' and (storage.foldername(name))[1] = auth.uid()::text);
