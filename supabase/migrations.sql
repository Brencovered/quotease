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

-- Xero org-specific account code and tax type (read from org on connect)
alter table profiles add column if not exists xero_account_code text default '200';
alter table profiles add column if not exists xero_tax_type     text default 'OUTPUT';

-- ── Directory ─────────────────────────────────────────────────────────────────
-- Tradies opt in to the public directory via their settings.
-- directory_public is a view that only exposes opted-in profiles.

alter table profiles
  add column if not exists directory_enabled   boolean not null default false,
  add column if not exists directory_suburb    text,
  add column if not exists directory_postcode  text,
  add column if not exists directory_bio       text,
  add column if not exists directory_website   text,
  add column if not exists directory_phone     text,
  add column if not exists directory_email     text;

-- Public view -- only opted-in profiles, no sensitive data exposed
create or replace view directory_public as
  select
    id,
    business_name,
    trades,
    logo_url,
    directory_suburb    as suburb,
    directory_postcode  as postcode,
    directory_bio       as bio,
    directory_website   as website_url,
    directory_phone     as phone,
    directory_email     as email,
    true                as is_claimed
  from profiles
  where directory_enabled = true
    and business_name is not null;

-- ── Admin dashboard ──────────────────────────────────────────────────────
-- Audit trail for the admin "Access this account" feature (see
-- app/api/admin/impersonate/route.ts). No RLS policies on purpose -- only
-- ever touched by server code using the service-role client.

create table if not exists admin_impersonation_log (
  id uuid primary key default uuid_generate_v4(),
  admin_email text not null,
  target_profile_id uuid not null references profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_impersonation_log_target_idx on admin_impersonation_log(target_profile_id);

-- ── Harden signup trigger ────────────────────────────────────────────────
-- Found a real orphaned account (auth.users row with no profiles row),
-- which breaks every insert that references profile_id via FK. Added
-- ON CONFLICT DO NOTHING (idempotent) and an exception handler so a
-- profile-creation hiccup can never again silently lose a profile row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, business_name, contact_email, trial_ends_at)
  values (
    new.id,
    new.raw_user_meta_data->>'business_name',
    new.email,
    now() + interval '3 days'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$function$;

-- ── Team management ─────────────────────────────────────────────────────
-- Lets a business (a profiles row) invite other auth users to log in and
-- work on its jobs/quotes/clients/materials. profile_id stays the single
-- "which business" key everywhere else in the schema -- this does not
-- introduce a separate businesses table, on purpose, to avoid touching
-- every other table's FK. See lib/team.ts for the app-level resolver.

create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  owner_profile_id uuid not null references profiles(id) on delete cascade,
  member_user_id   uuid references auth.users(id) on delete cascade,
  email            text not null,
  name             text,
  role             text not null default 'member' check (role in ('admin', 'member')),
  status           text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  invite_token     uuid not null default uuid_generate_v4(),
  invited_at       timestamptz not null default now(),
  joined_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique (owner_profile_id, email)
);

create index if not exists team_members_owner_idx on team_members(owner_profile_id);
create index if not exists team_members_member_user_idx on team_members(member_user_id);
create unique index if not exists team_members_invite_token_idx on team_members(invite_token);

alter table team_members enable row level security;

create policy "Owner manages team" on team_members
  for all using (auth.uid() = owner_profile_id);

create policy "Member sees own membership" on team_members
  for select using (auth.uid() = member_user_id);

create or replace function public.accessible_business_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select uid
  union
  select owner_profile_id from team_members
  where member_user_id = uid and status = 'active';
$$;

grant execute on function public.accessible_business_ids(uuid) to authenticated;

-- Swap "auth.uid() = profile_id" for team-aware access on the tables a
-- team actually works in day to day. Left owner-only on purpose: Xero
-- mappings, directory/billing settings, admin tables.

drop policy if exists "Own quotes" on quotes;
create policy "Business quotes" on quotes
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

drop policy if exists "Own clients" on clients;
create policy "Business clients" on clients
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

drop policy if exists "Own materials" on material_items;
create policy "Business materials" on material_items
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

drop policy if exists "Own variations" on variations;
create policy "Business variations" on variations
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

alter table job_attachments enable row level security;
drop policy if exists "Own job attachments" on job_attachments;
create policy "Business job attachments" on job_attachments
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

alter table job_actuals enable row level security;
drop policy if exists "Own job actuals" on job_actuals;
create policy "Business job actuals" on job_actuals
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

alter table client_plans enable row level security;
drop policy if exists "Own client plans" on client_plans;
create policy "Business client plans" on client_plans
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

alter table compliance_certs enable row level security;
drop policy if exists "Own compliance certs" on compliance_certs;
create policy "Business compliance certs" on compliance_certs
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

alter table payments enable row level security;
drop policy if exists "Own payments" on payments;
create policy "Business payments" on payments
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

alter table follow_up_log enable row level security;
drop policy if exists "Own follow up log" on follow_up_log;
create policy "Business follow up log" on follow_up_log
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

-- Real job/task assignment -- quotes.assigned_to was free text anyone could
-- type, with no relation to an actual login. Add a proper FK alongside it;
-- keep the text column too so already-assigned jobs don't lose their label.

alter table quotes
  add column if not exists assigned_to_member_id uuid references team_members(id) on delete set null;

create index if not exists quotes_assigned_to_member_idx on quotes(assigned_to_member_id);

create table if not exists job_tasks (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  assigned_to_member_id uuid references team_members(id) on delete set null,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'done')),
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists job_tasks_quote_idx on job_tasks(quote_id);
create index if not exists job_tasks_profile_idx on job_tasks(profile_id);

alter table job_tasks enable row level security;
create policy "Business job tasks" on job_tasks
  for all using (profile_id in (select accessible_business_ids(auth.uid())));
