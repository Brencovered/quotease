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
