-- ============================================================
-- SWIFTSCOPE v2 MIGRATION
-- Run this in Supabase SQL editor after the initial schema.sql
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

-- ── SEO automation (Prompt 3 of 4) ──────────────────────────────────────
-- trade_suburb_pages: cached aggregate per trade x suburb combo, refreshed
-- weekly by app/api/cron/refresh-seo. Source of truth for actual page
-- content stays directory_listing -- this is bookkeeping for the cron and
-- sitemap, not what the live pages render from.

create table if not exists trade_suburb_pages (
  id uuid primary key default uuid_generate_v4(),
  trade text not null,
  suburb text not null,
  suburb_slug text not null,
  state text not null default 'vic',
  listing_count integer not null default 0,
  avg_rating numeric,
  total_reviews integer not null default 0,
  is_indexed boolean not null default false,
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (trade, suburb_slug, state)
);

create index if not exists trade_suburb_pages_trade_idx on trade_suburb_pages(trade);
create index if not exists trade_suburb_pages_indexed_idx on trade_suburb_pages(is_indexed);

-- No public-read policy on purpose -- only the cron route (service-role
-- client) touches this table.
alter table trade_suburb_pages enable row level security;

create table if not exists seo_refresh_log (
  id uuid primary key default uuid_generate_v4(),
  run_at timestamptz not null default now(),
  pages_scanned integer not null default 0,
  pages_updated integer not null default 0,
  pages_newly_indexed integer not null default 0,
  pages_newly_deindexed integer not null default 0,
  sitemap_pinged boolean not null default false,
  duration_ms integer,
  error text,
  status text not null default 'success' check (status in ('success', 'partial', 'failed'))
);

create index if not exists seo_refresh_log_run_at_idx on seo_refresh_log(run_at desc);

alter table seo_refresh_log enable row level security;

-- ============================================================
-- MIGRATION FIX: Onboarding columns (applied 6 July 2026)
-- ============================================================
-- The onboarding page writes suburb, digital_tools, and quote_frequency
-- to the profiles table, but these columns were never created.
-- This caused 400 errors that left users stuck on the onboarding screen.

alter table profiles
  add column if not exists suburb          text,
  add column if not exists digital_tools   text[],
  add column if not exists quote_frequency text;

-- ============================================================
-- MIGRATION: Lead Generation System (Opt-Out Model)
-- ============================================================
-- Creates the complete lead generation infrastructure:
--   homeowner_profiles, job_requests, job_claims,
--   lead_subscriptions (opt-out model), lead_matching_log
--
-- Opt-out model: Every tradie is auto-subscribed to leads for
-- their trade + suburb on onboarding. They can opt out later.

-- ── Homeowner profiles ──────────────────────────────────────────────────────
-- Homeowners who submit quote requests via the Get Quotes form.
-- Server-only access (no RLS SELECT — service role only).

create table if not exists homeowner_profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  suburb      text not null,
  postcode    text,
  created_at  timestamptz not null default now()
);

alter table homeowner_profiles enable row level security;

-- ── Job requests (leads) ───────────────────────────────────────────────────
-- Quote requests submitted by homeowners. Tradies claim these via
-- the /electrician/leads page.

create table if not exists job_requests (
  id                   uuid primary key default gen_random_uuid(),
  homeowner_id         uuid references homeowner_profiles(id) on delete cascade,
  trade                text not null,
  suburb               text not null,
  postcode             text,
  description          text not null,
  additional_details   text,
  budget               text,
  timeline             text,
  lead_temperature     text not null default 'warm',
  status               text not null default 'open',
  num_quotes_wanted    integer not null default 3,
  photo_paths          text[] not null default '{}',
  wider_radius_sent_at timestamptz,
  consent_given        boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Validate status values
alter table job_requests add constraint job_requests_status_check
  check (status in ('open','partially_claimed','fully_claimed','expired'));

-- Validate lead temperature values
alter table job_requests add constraint job_requests_temp_check
  check (lead_temperature in ('early','warm','hot'));

-- Indexes for lead matching performance
create index if not exists idx_job_requests_trade_suburb_status
  on job_requests(trade, suburb, status);

create index if not exists idx_job_requests_created_at
  on job_requests(created_at desc);

create index if not exists idx_job_requests_homeowner_id
  on job_requests(homeowner_id);

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_job_requests_updated_at on job_requests;
create trigger trg_job_requests_updated_at
  before update on job_requests
  for each row execute function update_updated_at_column();

alter table job_requests enable row level security;

-- ── Job claims ─────────────────────────────────────────────────────────────
-- Tracks which tradie claimed which job request. A request becomes
-- fully_claimed when num_quotes_wanted claims are active.

create table if not exists job_claims (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references job_requests(id) on delete cascade,
  tradie_profile_id uuid not null references profiles(id) on delete cascade,
  status            text not null default 'claimed',
  rejected_at       timestamptz,
  claimed_at        timestamptz not null default now()
);

-- Prevent duplicate active claims from the same tradie
create unique index if not exists idx_job_claims_unique_active
  on job_claims(request_id, tradie_profile_id)
  where status = 'claimed';

create index if not exists idx_job_claims_request_id
  on job_claims(request_id);

create index if not exists idx_job_claims_tradie_profile_id
  on job_claims(tradie_profile_id);

-- Validate status
alter table job_claims add constraint job_claims_status_check
  check (status in ('claimed','rejected','completed'));

alter table job_claims enable row level security;

create policy "Tradie can view own claims"
  on job_claims for select
  using (auth.uid() = tradie_profile_id);

-- ── Lead subscriptions (OPT-OUT MODEL) ────────────────────────────────────
-- Core table for the opt-out lead model.
-- Every tradie is auto-subscribed to their trade + suburb on onboarding.
-- Setting is_active = false opts them out of leads for that combo.

create table if not exists lead_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  trade       text not null,
  suburb      text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, trade, suburb)
);

-- Hot-path index: find subscribed tradies for a trade+suburb combo
create index if not exists idx_lead_subscriptions_match
  on lead_subscriptions(trade, suburb, is_active)
  where is_active = true;

create index if not exists idx_lead_subscriptions_profile_id
  on lead_subscriptions(profile_id);

drop trigger if exists trg_lead_subscriptions_updated_at on lead_subscriptions;
create trigger trg_lead_subscriptions_updated_at
  before update on lead_subscriptions
  for each row execute function update_updated_at_column();

alter table lead_subscriptions enable row level security;

drop policy if exists "Own subscriptions" on lead_subscriptions;
create policy "Own subscriptions"
  on lead_subscriptions for all
  using (auth.uid() = profile_id);

-- ── Auto-subscribe trigger ─────────────────────────────────────────────────
-- When a profile is created (new signup), automatically subscribe them
-- to leads for their trade + suburb combination.

create or replace function auto_subscribe_tradie()
returns trigger as $$
begin
  if new.suburb is not null and new.trades is not null and array_length(new.trades, 1) > 0 then
    -- Insert a subscription row for each trade
    for i in 1..array_length(new.trades, 1) loop
      insert into lead_subscriptions (profile_id, trade, suburb, is_active)
      values (new.id, lower(new.trades[i]), new.suburb, true)
      on conflict (profile_id, trade, suburb) do nothing;
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_auto_subscribe on profiles;
create trigger trg_auto_subscribe
  after insert on profiles
  for each row execute function auto_subscribe_tradie();

-- Also trigger on update when suburb or trades change
create or replace function auto_subscribe_tradie_update()
returns trigger as $$
begin
  if (new.suburb is distinct from old.suburb or new.trades is distinct from old.trades)
     and new.suburb is not null and new.trades is not null and array_length(new.trades, 1) > 0 then
    for i in 1..array_length(new.trades, 1) loop
      insert into lead_subscriptions (profile_id, trade, suburb, is_active)
      values (new.id, lower(new.trades[i]), new.suburb, true)
      on conflict (profile_id, trade, suburb) do nothing;
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_auto_subscribe_update on profiles;
create trigger trg_auto_subscribe_update
  after update on profiles
  for each row execute function auto_subscribe_tradie_update();

-- ── Lead matching log ──────────────────────────────────────────────────────
-- Audit trail: tracks which tradies were notified about which leads.
-- Useful for debugging, analytics, and compliance.

create table if not exists lead_matching_log (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references job_requests(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  notified_at  timestamptz not null default now(),
  email_sent   boolean not null default false,
  claim_status text not null default 'pending'
);

create index if not exists idx_lead_matching_log_request
  on lead_matching_log(request_id);

create index if not exists idx_lead_matching_log_profile
  on lead_matching_log(profile_id);

create index if not exists idx_lead_matching_log_notified
  on lead_matching_log(notified_at desc);

-- Validate claim_status
alter table lead_matching_log add constraint lead_matching_log_status_check
  check (claim_status in ('pending','claimed','ignored'));

alter table lead_matching_log enable row level security;
