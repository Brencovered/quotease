-- =============================================================================
-- Production schema backfill (reconstructed via read-only introspection of the
-- live Supabase project). The repository tracked SQL (schema.sql, migrations.sql,
-- migrations/) does not create the full production schema: ~25 tables, ~23
-- functions, two enums, an auth.users trigger and assorted columns exist only in
-- production. This file is idempotent and applied last by scripts/db-bootstrap.sh
-- so a freshly bootstrapped database matches production.
-- Regenerate from production if the live schema changes.
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Function bodies reference objects created elsewhere; defer validation.
set check_function_bodies = off;

-- Enum types ------------------------------------------------------------------
do $$ begin if not exists (select 1 from pg_type where typname='job_stage' and typnamespace = 'public'::regnamespace) then create type public.job_stage as enum ('quoted', 'accepted', 'in_progress', 'completed', 'archived'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname='job_status' and typnamespace = 'public'::regnamespace) then create type public.job_status as enum ('scheduled', 'in_progress', 'on_hold', 'awaiting_sign_off', 'complete', 'invoiced', 'partially_paid', 'archived', 'cancelled'); end if; end $$;

-- Missing tables --------------------------------------------------------------
create table if not exists public.abn_ingest_cursor (
  id integer not null default 1,
  split_file_index integer not null default 1,
  records_processed_in_file integer not null default 0,
  last_run_at timestamp with time zone,
  internal_file_index integer not null default 0
);

create table if not exists public.abn_trade_candidates (
  id uuid not null default gen_random_uuid(),
  abn text not null,
  legal_name text not null,
  trading_name text,
  matched_trade text not null,
  state text,
  postcode text,
  entity_type text,
  processed_at timestamp with time zone,
  website_url_found text,
  directory_listing_id uuid
);

create table if not exists public.business_suppliers (
  id uuid not null default uuid_generate_v4(),
  profile_id uuid not null,
  catalog_key text,
  name text not null,
  contact_email text,
  ingestion_email text not null,
  status text not null default 'pending_approval'::text,
  outreach_sent_at timestamp with time zone,
  last_import_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.client_plans (
  id uuid not null default uuid_generate_v4(),
  client_id uuid not null,
  profile_id uuid not null,
  file_name text not null,
  storage_path text not null,
  label text,
  annotations jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  scale_metres_per_pct numeric,
  shapes jsonb not null default '[]'::jsonb,
  calibration jsonb,
  quote_id uuid
);

create table if not exists public.contact_mappings (
  id uuid not null default gen_random_uuid(),
  swiftscope_customer_id uuid not null,
  tradie_id uuid,
  xero_contact_id text not null
);

create table if not exists public.directory_claim_attempts (
  id uuid not null default gen_random_uuid(),
  attempted_business_name text not null,
  suburb text,
  trade text,
  matched_listing_id uuid,
  attempted_by_profile_id uuid,
  outcome text not null,
  created_at timestamp with time zone not null default now(),
  ip_address inet,
  user_agent text,
  verified_via_email text
);

create table if not exists public.directory_enquiries (
  id uuid not null default gen_random_uuid(),
  listing_id text,
  business_name text,
  to_email text,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  job_description text not null,
  budget text,
  stage text,
  status text default 'new'::text,
  email_sent boolean default false,
  email_error text,
  created_at timestamp with time zone default now(),
  is_claimed boolean not null default false,
  admin_notified boolean not null default false,
  customer_notified boolean not null default false,
  lead_code text,
  priority text,
  urgency text,
  customer_type text,
  pipeline_status text not null default 'new'::text,
  profile_id uuid,
  quote_id uuid,
  job_id uuid,
  photo_paths text[] not null default '{}'::text[],
  other_quotes text,
  notes text,
  site_suburb text
);

create table if not exists public.directory_exclusions (
  id uuid not null default gen_random_uuid(),
  business_name text not null,
  suburb text,
  website_domain text,
  reason text,
  requested_email text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.directory_listing (
  id uuid not null default gen_random_uuid(),
  profile_id uuid,
  business_name text not null,
  trades text[] not null default '{}'::text[],
  website_url text,
  suburb text,
  postcode text,
  latitude double precision,
  longitude double precision,
  source text not null default 'scraped'::text,
  is_claimed boolean not null default false,
  claim_token uuid not null default gen_random_uuid(),
  scraped_contact_email text,
  scraped_contact_phone text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  place_id text,
  google_rating numeric,
  google_reviews_count integer,
  photo_references text[] not null default '{}'::text[],
  blurb text,
  logo_url text,
  private_email text,
  instagram_url text,
  facebook_url text,
  services_offered text[],
  years_experience integer,
  licenses jsonb not null default '[]'::jsonb,
  photos_cached_at timestamp with time zone,
  website_scraped_at timestamp with time zone,
  outreach_contacted_at timestamp with time zone,
  street_address text,
  contact_phone text,
  services_extraction_method text,
  testimonials jsonb
);

create table if not exists public.directory_listing_traffic_daily (
  listing_id uuid not null,
  day date not null,
  pageviews integer not null default 0,
  cta_clicks integer not null default 0,
  synced_at timestamp with time zone not null default now()
);

create table if not exists public.directory_removal_requests (
  id uuid not null default gen_random_uuid(),
  listing_id uuid,
  business_name text,
  suburb text,
  requester_email text,
  reason text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone
);

create table if not exists public.directory_scrape_coverage (
  trade text not null,
  location_label text not null,
  suburb text not null,
  postcode text,
  last_scraped_at timestamp with time zone,
  last_found integer,
  last_inserted integer
);

create table if not exists public.job_board_columns (
  id uuid not null default uuid_generate_v4(),
  profile_id uuid not null,
  label text not null,
  color text not null default 'navy'::text,
  statuses text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.job_packages (
  id uuid not null default uuid_generate_v4(),
  profile_id uuid not null,
  trade text not null default 'electrician'::text,
  name text not null,
  description text,
  items jsonb not null default '[]'::jsonb,
  labour_hours numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.package_items (
  id uuid not null default gen_random_uuid(),
  package_id uuid not null,
  label text not null,
  qty numeric not null default 1,
  unit text not null default 'each'::text,
  unit_cost numeric not null default 0,
  item_key text,
  sort_order integer not null default 0
);

create table if not exists public.packages (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  title text not null,
  trade text not null default 'electrician'::text,
  description text,
  labour_hours numeric not null default 0,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.schedule_events (
  id uuid not null default uuid_generate_v4(),
  profile_id uuid not null,
  title text not null,
  notes text,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone,
  all_day boolean not null default false,
  assigned_to_member_id uuid,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  job_id uuid
);

create table if not exists public.seo_keywords (
  id uuid not null default gen_random_uuid(),
  keyword text not null,
  intent text,
  volume integer,
  keyword_difficulty integer,
  cpc_usd numeric(10,2),
  serp_features text,
  status text not null default 'new'::text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  current_position numeric,
  clicks_28d integer,
  impressions_28d integer,
  last_synced_at timestamp with time zone,
  segment text not null default 'saas'::text
);

create table if not exists public.supplier_catalog (
  key text not null,
  label text not null,
  trades text[] not null default '{}'::text[],
  csv_desc_col text,
  csv_sku_col text,
  csv_price_col text,
  csv_unit_col text,
  sort_order integer not null default 0
);

create table if not exists public.supplier_price_imports (
  id uuid not null default uuid_generate_v4(),
  business_supplier_id uuid not null,
  profile_id uuid not null,
  resend_email_id text,
  attachment_filename text,
  status text not null default 'received'::text,
  row_count integer,
  error text,
  raw_storage_path text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.team_invites (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  email text not null,
  role text not null default 'member'::text,
  status text not null default 'pending'::text,
  token text not null,
  expires_at timestamp with time zone not null default (now() + '7 days'::interval),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.timesheets (
  id uuid not null default uuid_generate_v4(),
  profile_id uuid not null,
  job_id uuid not null,
  team_member_id uuid,
  member_name text not null,
  hours numeric not null,
  hourly_rate_used numeric not null,
  work_date date not null default CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.tradie_directory_settings (
  profile_id uuid not null,
  directory_active boolean not null default false,
  monthly_fee_active boolean not null default false,
  service_suburbs text[] not null default '{}'::text[],
  service_radius_km integer not null default 20,
  lead_temps_wanted text[] not null default '{early,warm,hot}'::text[],
  stripe_subscription_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.tradie_profiles (
  id uuid not null,
  business_name text not null,
  phone text,
  updated_at timestamp with time zone default now(),
  xero_tenant_id text,
  xero_access_token text,
  xero_refresh_token text,
  xero_tokens_expires_at timestamp with time zone
);

create table if not exists public.traffic_log (
  id bigint generated always as identity,
  path text not null,
  method text not null default 'GET'::text,
  ip_address inet,
  user_agent text,
  is_bot boolean not null default false,
  bot_label text,
  created_at timestamp with time zone not null default now()
);

-- Constraints on missing tables (PK/unique/check before foreign keys) --------
do $$ begin if not exists (select 1 from pg_constraint where conname='abn_ingest_cursor_pkey' and conrelid='public.abn_ingest_cursor'::regclass) then alter table public.abn_ingest_cursor add constraint abn_ingest_cursor_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='abn_trade_candidates_pkey' and conrelid='public.abn_trade_candidates'::regclass) then alter table public.abn_trade_candidates add constraint abn_trade_candidates_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='business_suppliers_pkey' and conrelid='public.business_suppliers'::regclass) then alter table public.business_suppliers add constraint business_suppliers_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='client_plans_pkey' and conrelid='public.client_plans'::regclass) then alter table public.client_plans add constraint client_plans_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='contact_mappings_pkey' and conrelid='public.contact_mappings'::regclass) then alter table public.contact_mappings add constraint contact_mappings_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_claim_attempts_pkey' and conrelid='public.directory_claim_attempts'::regclass) then alter table public.directory_claim_attempts add constraint directory_claim_attempts_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_enquiries_pkey' and conrelid='public.directory_enquiries'::regclass) then alter table public.directory_enquiries add constraint directory_enquiries_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_exclusions_pkey' and conrelid='public.directory_exclusions'::regclass) then alter table public.directory_exclusions add constraint directory_exclusions_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_listing_pkey' and conrelid='public.directory_listing'::regclass) then alter table public.directory_listing add constraint directory_listing_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_listing_traffic_daily_pkey' and conrelid='public.directory_listing_traffic_daily'::regclass) then alter table public.directory_listing_traffic_daily add constraint directory_listing_traffic_daily_pkey PRIMARY KEY (listing_id, day); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_removal_requests_pkey' and conrelid='public.directory_removal_requests'::regclass) then alter table public.directory_removal_requests add constraint directory_removal_requests_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_scrape_coverage_pkey' and conrelid='public.directory_scrape_coverage'::regclass) then alter table public.directory_scrape_coverage add constraint directory_scrape_coverage_pkey PRIMARY KEY (trade, location_label); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='job_board_columns_pkey' and conrelid='public.job_board_columns'::regclass) then alter table public.job_board_columns add constraint job_board_columns_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='job_packages_pkey' and conrelid='public.job_packages'::regclass) then alter table public.job_packages add constraint job_packages_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='package_items_pkey' and conrelid='public.package_items'::regclass) then alter table public.package_items add constraint package_items_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='packages_pkey' and conrelid='public.packages'::regclass) then alter table public.packages add constraint packages_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='schedule_events_pkey' and conrelid='public.schedule_events'::regclass) then alter table public.schedule_events add constraint schedule_events_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='seo_keywords_pkey' and conrelid='public.seo_keywords'::regclass) then alter table public.seo_keywords add constraint seo_keywords_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='supplier_catalog_pkey' and conrelid='public.supplier_catalog'::regclass) then alter table public.supplier_catalog add constraint supplier_catalog_pkey PRIMARY KEY (key); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='supplier_price_imports_pkey' and conrelid='public.supplier_price_imports'::regclass) then alter table public.supplier_price_imports add constraint supplier_price_imports_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='team_invites_pkey' and conrelid='public.team_invites'::regclass) then alter table public.team_invites add constraint team_invites_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='timesheets_pkey' and conrelid='public.timesheets'::regclass) then alter table public.timesheets add constraint timesheets_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='tradie_directory_settings_pkey' and conrelid='public.tradie_directory_settings'::regclass) then alter table public.tradie_directory_settings add constraint tradie_directory_settings_pkey PRIMARY KEY (profile_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='tradie_profiles_pkey' and conrelid='public.tradie_profiles'::regclass) then alter table public.tradie_profiles add constraint tradie_profiles_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='traffic_log_pkey' and conrelid='public.traffic_log'::regclass) then alter table public.traffic_log add constraint traffic_log_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='abn_trade_candidates_abn_key' and conrelid='public.abn_trade_candidates'::regclass) then alter table public.abn_trade_candidates add constraint abn_trade_candidates_abn_key UNIQUE (abn); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='business_suppliers_ingestion_email_key' and conrelid='public.business_suppliers'::regclass) then alter table public.business_suppliers add constraint business_suppliers_ingestion_email_key UNIQUE (ingestion_email); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='contact_mappings_swiftscope_customer_id_tradie_id_key' and conrelid='public.contact_mappings'::regclass) then alter table public.contact_mappings add constraint contact_mappings_swiftscope_customer_id_tradie_id_key UNIQUE (swiftscope_customer_id, tradie_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_listing_place_id_unique' and conrelid='public.directory_listing'::regclass) then alter table public.directory_listing add constraint directory_listing_place_id_unique UNIQUE (place_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='seo_keywords_keyword_key' and conrelid='public.seo_keywords'::regclass) then alter table public.seo_keywords add constraint seo_keywords_keyword_key UNIQUE (keyword); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='team_invites_token_key' and conrelid='public.team_invites'::regclass) then alter table public.team_invites add constraint team_invites_token_key UNIQUE (token); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='abn_ingest_cursor_id_check' and conrelid='public.abn_ingest_cursor'::regclass) then alter table public.abn_ingest_cursor add constraint abn_ingest_cursor_id_check CHECK ((id = 1)); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='business_suppliers_status_check' and conrelid='public.business_suppliers'::regclass) then alter table public.business_suppliers add constraint business_suppliers_status_check CHECK ((status = ANY (ARRAY['pending_approval'::text, 'outreach_sent'::text, 'active'::text, 'declined'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_claim_attempts_outcome_check' and conrelid='public.directory_claim_attempts'::regclass) then alter table public.directory_claim_attempts add constraint directory_claim_attempts_outcome_check CHECK ((outcome = ANY (ARRAY['claimed'::text, 'created_new'::text, 'disputed'::text, 'rejected'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_enquiries_status_check' and conrelid='public.directory_enquiries'::regclass) then alter table public.directory_enquiries add constraint directory_enquiries_status_check CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'replied'::text, 'archived'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_listing_services_extraction_method_check' and conrelid='public.directory_listing'::regclass) then alter table public.directory_listing add constraint directory_listing_services_extraction_method_check CHECK ((services_extraction_method = ANY (ARRAY['structural'::text, 'keyword'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_removal_requests_status_check' and conrelid='public.directory_removal_requests'::regclass) then alter table public.directory_removal_requests add constraint directory_removal_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='packages_status_check' and conrelid='public.packages'::regclass) then alter table public.packages add constraint packages_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='seo_keywords_segment_check' and conrelid='public.seo_keywords'::regclass) then alter table public.seo_keywords add constraint seo_keywords_segment_check CHECK ((segment = ANY (ARRAY['directory'::text, 'saas'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='seo_keywords_status_check' and conrelid='public.seo_keywords'::regclass) then alter table public.seo_keywords add constraint seo_keywords_status_check CHECK ((status = ANY (ARRAY['new'::text, 'targeting'::text, 'tracking'::text, 'ignore'::text, 'ranking'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='supplier_price_imports_status_check' and conrelid='public.supplier_price_imports'::regclass) then alter table public.supplier_price_imports add constraint supplier_price_imports_status_check CHECK ((status = ANY (ARRAY['received'::text, 'imported'::text, 'failed'::text, 'needs_mapping'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='team_invites_status_check' and conrelid='public.team_invites'::regclass) then alter table public.team_invites add constraint team_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='team_invites_role_check' and conrelid='public.team_invites'::regclass) then alter table public.team_invites add constraint team_invites_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='abn_trade_candidates_directory_listing_id_fkey' and conrelid='public.abn_trade_candidates'::regclass) then alter table public.abn_trade_candidates add constraint abn_trade_candidates_directory_listing_id_fkey FOREIGN KEY (directory_listing_id) REFERENCES directory_listing(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='business_suppliers_profile_id_fkey' and conrelid='public.business_suppliers'::regclass) then alter table public.business_suppliers add constraint business_suppliers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='business_suppliers_catalog_key_fkey' and conrelid='public.business_suppliers'::regclass) then alter table public.business_suppliers add constraint business_suppliers_catalog_key_fkey FOREIGN KEY (catalog_key) REFERENCES supplier_catalog(key) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='client_plans_quote_id_fkey' and conrelid='public.client_plans'::regclass) then alter table public.client_plans add constraint client_plans_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='client_plans_profile_id_fkey' and conrelid='public.client_plans'::regclass) then alter table public.client_plans add constraint client_plans_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='client_plans_client_id_fkey' and conrelid='public.client_plans'::regclass) then alter table public.client_plans add constraint client_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='contact_mappings_tradie_id_fkey' and conrelid='public.contact_mappings'::regclass) then alter table public.contact_mappings add constraint contact_mappings_tradie_id_fkey FOREIGN KEY (tradie_id) REFERENCES tradie_profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_claim_attempts_attempted_by_profile_id_fkey' and conrelid='public.directory_claim_attempts'::regclass) then alter table public.directory_claim_attempts add constraint directory_claim_attempts_attempted_by_profile_id_fkey FOREIGN KEY (attempted_by_profile_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_claim_attempts_matched_listing_id_fkey' and conrelid='public.directory_claim_attempts'::regclass) then alter table public.directory_claim_attempts add constraint directory_claim_attempts_matched_listing_id_fkey FOREIGN KEY (matched_listing_id) REFERENCES directory_listing(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_enquiries_profile_id_fkey' and conrelid='public.directory_enquiries'::regclass) then alter table public.directory_enquiries add constraint directory_enquiries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_enquiries_job_id_fkey' and conrelid='public.directory_enquiries'::regclass) then alter table public.directory_enquiries add constraint directory_enquiries_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_enquiries_quote_id_fkey' and conrelid='public.directory_enquiries'::regclass) then alter table public.directory_enquiries add constraint directory_enquiries_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_listing_profile_id_fkey' and conrelid='public.directory_listing'::regclass) then alter table public.directory_listing add constraint directory_listing_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_listing_traffic_daily_listing_id_fkey' and conrelid='public.directory_listing_traffic_daily'::regclass) then alter table public.directory_listing_traffic_daily add constraint directory_listing_traffic_daily_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES directory_listing(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='directory_removal_requests_listing_id_fkey' and conrelid='public.directory_removal_requests'::regclass) then alter table public.directory_removal_requests add constraint directory_removal_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES directory_listing(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='job_board_columns_profile_id_fkey' and conrelid='public.job_board_columns'::regclass) then alter table public.job_board_columns add constraint job_board_columns_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='job_packages_profile_id_fkey' and conrelid='public.job_packages'::regclass) then alter table public.job_packages add constraint job_packages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='package_items_package_id_fkey' and conrelid='public.package_items'::regclass) then alter table public.package_items add constraint package_items_package_id_fkey FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='packages_profile_id_fkey' and conrelid='public.packages'::regclass) then alter table public.packages add constraint packages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='schedule_events_profile_id_fkey' and conrelid='public.schedule_events'::regclass) then alter table public.schedule_events add constraint schedule_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='schedule_events_created_by_fkey' and conrelid='public.schedule_events'::regclass) then alter table public.schedule_events add constraint schedule_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='schedule_events_assigned_to_member_id_fkey' and conrelid='public.schedule_events'::regclass) then alter table public.schedule_events add constraint schedule_events_assigned_to_member_id_fkey FOREIGN KEY (assigned_to_member_id) REFERENCES team_members(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='schedule_events_job_id_fkey' and conrelid='public.schedule_events'::regclass) then alter table public.schedule_events add constraint schedule_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='supplier_price_imports_business_supplier_id_fkey' and conrelid='public.supplier_price_imports'::regclass) then alter table public.supplier_price_imports add constraint supplier_price_imports_business_supplier_id_fkey FOREIGN KEY (business_supplier_id) REFERENCES business_suppliers(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='supplier_price_imports_profile_id_fkey' and conrelid='public.supplier_price_imports'::regclass) then alter table public.supplier_price_imports add constraint supplier_price_imports_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='team_invites_profile_id_fkey' and conrelid='public.team_invites'::regclass) then alter table public.team_invites add constraint team_invites_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='timesheets_team_member_id_fkey' and conrelid='public.timesheets'::regclass) then alter table public.timesheets add constraint timesheets_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='timesheets_created_by_fkey' and conrelid='public.timesheets'::regclass) then alter table public.timesheets add constraint timesheets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='timesheets_job_id_fkey' and conrelid='public.timesheets'::regclass) then alter table public.timesheets add constraint timesheets_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='timesheets_profile_id_fkey' and conrelid='public.timesheets'::regclass) then alter table public.timesheets add constraint timesheets_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='tradie_directory_settings_profile_id_fkey' and conrelid='public.tradie_directory_settings'::regclass) then alter table public.tradie_directory_settings add constraint tradie_directory_settings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='tradie_profiles_id_fkey' and conrelid='public.tradie_profiles'::regclass) then alter table public.tradie_profiles add constraint tradie_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; end if; end $$;

-- Indexes on missing tables --------------------------------------------------
create index if not exists idx_abn_candidates_unprocessed ON public.abn_trade_candidates USING btree (id) WHERE (processed_at IS NULL);
create index if not exists business_suppliers_profile_id_idx ON public.business_suppliers USING btree (profile_id);
create index if not exists idx_business_suppliers_catalog_key ON public.business_suppliers USING btree (catalog_key);
create index if not exists client_plans_quote_id_idx ON public.client_plans USING btree (quote_id);
create index if not exists idx_client_plans_profile_id ON public.client_plans USING btree (profile_id);
create index if not exists idx_client_plans_client_id ON public.client_plans USING btree (client_id);
create index if not exists idx_contact_mappings_tradie_id ON public.contact_mappings USING btree (tradie_id);
create index if not exists directory_claim_attempts_ip_idx ON public.directory_claim_attempts USING btree (ip_address, created_at DESC);
create index if not exists directory_enquiries_pipeline_idx ON public.directory_enquiries USING btree (pipeline_status);
create index if not exists directory_enquiries_profile_id_idx ON public.directory_enquiries USING btree (profile_id);
create unique index if not exists directory_enquiries_lead_code_uidx ON public.directory_enquiries USING btree (lead_code) WHERE (lead_code IS NOT NULL);
create index if not exists directory_enquiries_priority_idx ON public.directory_enquiries USING btree (priority);
create index if not exists directory_exclusions_domain_idx ON public.directory_exclusions USING btree (website_domain);
create index if not exists directory_exclusions_name_suburb_idx ON public.directory_exclusions USING btree (lower(business_name), lower(COALESCE(suburb, ''::text)));
create index if not exists idx_directory_postcode ON public.directory_listing USING btree (postcode);
create index if not exists idx_directory_location ON public.directory_listing USING btree (latitude, longitude);
create unique index if not exists directory_listing_claim_token_idx ON public.directory_listing USING btree (claim_token);
create index if not exists directory_listing_photos_cached_at_idx ON public.directory_listing USING btree (photos_cached_at) WHERE (is_claimed = false);
create index if not exists directory_listing_business_name_trgm_idx ON public.directory_listing USING gin (business_name gin_trgm_ops);
create index if not exists idx_directory_listing_profile_id ON public.directory_listing USING btree (profile_id);
create unique index if not exists idx_directory_place_id ON public.directory_listing USING btree (place_id) WHERE (place_id IS NOT NULL);
create index if not exists idx_directory_trades ON public.directory_listing USING gin (trades);
create index if not exists idx_directory_traffic_listing_day ON public.directory_listing_traffic_daily USING btree (listing_id, day DESC);
create index if not exists directory_removal_requests_status_idx ON public.directory_removal_requests USING btree (status, created_at DESC);
create index if not exists job_board_columns_profile_id_idx ON public.job_board_columns USING btree (profile_id);
create index if not exists job_packages_profile_idx ON public.job_packages USING btree (profile_id);
create index if not exists idx_package_items_package ON public.package_items USING btree (package_id);
create index if not exists idx_packages_profile ON public.packages USING btree (profile_id);
create index if not exists schedule_events_start_idx ON public.schedule_events USING btree (start_at);
create index if not exists idx_schedule_events_assigned_to_member_id ON public.schedule_events USING btree (assigned_to_member_id);
create index if not exists idx_schedule_events_created_by ON public.schedule_events USING btree (created_by);
create index if not exists schedule_events_profile_idx ON public.schedule_events USING btree (profile_id);
create index if not exists schedule_events_job_id_idx ON public.schedule_events USING btree (job_id);
create index if not exists idx_seo_keywords_volume ON public.seo_keywords USING btree (volume DESC NULLS LAST);
create index if not exists idx_seo_keywords_intent ON public.seo_keywords USING btree (intent);
create index if not exists idx_seo_keywords_status ON public.seo_keywords USING btree (status);
create index if not exists seo_keywords_segment_idx ON public.seo_keywords USING btree (segment);
create index if not exists supplier_price_imports_business_supplier_idx ON public.supplier_price_imports USING btree (business_supplier_id);
create index if not exists supplier_price_imports_profile_id_idx ON public.supplier_price_imports USING btree (profile_id);
create index if not exists idx_team_invites_profile ON public.team_invites USING btree (profile_id);
create index if not exists idx_timesheets_team_member_id ON public.timesheets USING btree (team_member_id);
create index if not exists idx_timesheets_created_by ON public.timesheets USING btree (created_by);
create index if not exists timesheets_profile_id_idx ON public.timesheets USING btree (profile_id);
create index if not exists timesheets_job_id_idx ON public.timesheets USING btree (job_id);
create index if not exists traffic_log_created_at_idx ON public.traffic_log USING btree (created_at DESC);

-- Columns present in production but not created by tracked SQL (idempotent) ---
alter table public.admin_impersonation_log add column if not exists admin_email text;
alter table public.admin_impersonation_log add column if not exists created_at timestamp with time zone default now();
alter table public.admin_impersonation_log add column if not exists id uuid default uuid_generate_v4();
alter table public.admin_impersonation_log add column if not exists reason text;
alter table public.admin_impersonation_log add column if not exists target_profile_id uuid;
alter table public.ai_drawing_analyses add column if not exists created_at timestamp with time zone default now();
alter table public.ai_drawing_analyses add column if not exists detected_items_count integer default 0;
alter table public.ai_drawing_analyses add column if not exists file_size integer;
alter table public.ai_drawing_analyses add column if not exists file_type text;
alter table public.ai_drawing_analyses add column if not exists id uuid default uuid_generate_v4();
alter table public.ai_drawing_analyses add column if not exists image_quality_score text;
alter table public.ai_drawing_analyses add column if not exists model text;
alter table public.ai_drawing_analyses add column if not exists overall_confidence text;
alter table public.ai_drawing_analyses add column if not exists processing_time_ms integer;
alter table public.ai_drawing_analyses add column if not exists profile_id uuid;
alter table public.ai_drawing_analyses add column if not exists query_score text;
alter table public.ai_drawing_analyses add column if not exists trade text;
alter table public.ai_drawing_analyses add column if not exists via text;
alter table public.blog_posts add column if not exists author_avatar text;
alter table public.blog_posts add column if not exists author_name text default 'Swiftscope'::text;
alter table public.blog_posts add column if not exists category text default 'Blog'::text;
alter table public.blog_posts add column if not exists content text default ''::text;
alter table public.blog_posts add column if not exists cover_url text;
alter table public.blog_posts add column if not exists created_at timestamp with time zone default now();
alter table public.blog_posts add column if not exists excerpt text;
alter table public.blog_posts add column if not exists featured boolean default false;
alter table public.blog_posts add column if not exists id uuid default gen_random_uuid();
alter table public.blog_posts add column if not exists published boolean default false;
alter table public.blog_posts add column if not exists published_at timestamp with time zone;
alter table public.blog_posts add column if not exists slug text;
alter table public.blog_posts add column if not exists tags text[] default '{}'::text[];
alter table public.blog_posts add column if not exists title text;
alter table public.blog_posts add column if not exists updated_at timestamp with time zone default now();
alter table public.calendar_events add column if not exists created_at timestamp with time zone default now();
alter table public.calendar_events add column if not exists description text;
alter table public.calendar_events add column if not exists end_time text;
alter table public.calendar_events add column if not exists event_date date;
alter table public.calendar_events add column if not exists event_type text default 'general'::text;
alter table public.calendar_events add column if not exists id uuid default gen_random_uuid();
alter table public.calendar_events add column if not exists is_all_day boolean default false;
alter table public.calendar_events add column if not exists job_id uuid;
alter table public.calendar_events add column if not exists profile_id uuid;
alter table public.calendar_events add column if not exists start_time text;
alter table public.calendar_events add column if not exists title text;
alter table public.calendar_events add column if not exists updated_at timestamp with time zone default now();
alter table public.clients add column if not exists abn text;
alter table public.clients add column if not exists billing_address text;
alter table public.clients add column if not exists created_at timestamp with time zone default now();
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists id uuid default uuid_generate_v4();
alter table public.clients add column if not exists name text;
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists profile_id uuid;
alter table public.clients add column if not exists updated_at timestamp with time zone default now();
alter table public.communication_log add column if not exists body text;
alter table public.communication_log add column if not exists id uuid default gen_random_uuid();
alter table public.communication_log add column if not exists job_id uuid;
alter table public.communication_log add column if not exists opened_at timestamp with time zone;
alter table public.communication_log add column if not exists profile_id uuid;
alter table public.communication_log add column if not exists quote_id uuid;
alter table public.communication_log add column if not exists sent_at timestamp with time zone default now();
alter table public.communication_log add column if not exists sent_to text;
alter table public.communication_log add column if not exists subject text;
alter table public.communication_log add column if not exists type text;
alter table public.communication_templates add column if not exists body text;
alter table public.communication_templates add column if not exists created_at timestamp with time zone default now();
alter table public.communication_templates add column if not exists id uuid default gen_random_uuid();
alter table public.communication_templates add column if not exists is_default boolean default false;
alter table public.communication_templates add column if not exists profile_id uuid;
alter table public.communication_templates add column if not exists subject text;
alter table public.communication_templates add column if not exists type text;
alter table public.communication_templates add column if not exists updated_at timestamp with time zone default now();
alter table public.compliance_certs add column if not exists cert_number text;
alter table public.compliance_certs add column if not exists cert_type text;
alter table public.compliance_certs add column if not exists created_at timestamp with time zone default now();
alter table public.compliance_certs add column if not exists expiry_date date;
alter table public.compliance_certs add column if not exists id uuid default uuid_generate_v4();
alter table public.compliance_certs add column if not exists issued_date date;
alter table public.compliance_certs add column if not exists job_id uuid;
alter table public.compliance_certs add column if not exists notes text;
alter table public.compliance_certs add column if not exists profile_id uuid;
alter table public.compliance_certs add column if not exists quote_id uuid;
alter table public.compliance_certs add column if not exists storage_path text;
alter table public.directory_goals add column if not exists created_at timestamp with time zone default now();
alter table public.directory_goals add column if not exists id uuid default gen_random_uuid();
alter table public.directory_goals add column if not exists month_start date;
alter table public.directory_goals add column if not exists profile_id uuid;
alter table public.directory_goals add column if not exists target_quotes integer;
alter table public.directory_goals add column if not exists updated_at timestamp with time zone default now();
alter table public.docket_invoices add column if not exists created_at timestamp with time zone default now();
alter table public.docket_invoices add column if not exists docket_count integer;
alter table public.docket_invoices add column if not exists id uuid default gen_random_uuid();
alter table public.docket_invoices add column if not exists invoice_number text;
alter table public.docket_invoices add column if not exists job_id uuid;
alter table public.docket_invoices add column if not exists period_end date;
alter table public.docket_invoices add column if not exists period_start date;
alter table public.docket_invoices add column if not exists profile_id uuid;
alter table public.docket_invoices add column if not exists status text default 'draft'::text;
alter table public.docket_invoices add column if not exists total_cost numeric;
alter table public.docket_invoices add column if not exists xero_exported_at timestamp with time zone;
alter table public.docket_invoices add column if not exists xero_invoice_id text;
alter table public.docket_items add column if not exists category text;
alter table public.docket_items add column if not exists created_at timestamp with time zone default now();
alter table public.docket_items add column if not exists docket_id uuid;
alter table public.docket_items add column if not exists end_time time without time zone;
alter table public.docket_items add column if not exists id uuid default gen_random_uuid();
alter table public.docket_items add column if not exists label text;
alter table public.docket_items add column if not exists line_total numeric default (quantity * rate);
alter table public.docket_items add column if not exists person_name text;
alter table public.docket_items add column if not exists profile_id uuid;
alter table public.docket_items add column if not exists quantity numeric default 0;
alter table public.docket_items add column if not exists rate numeric default 0;
alter table public.docket_items add column if not exists sort_order integer default 0;
alter table public.docket_items add column if not exists source_rate_item_id uuid;
alter table public.docket_items add column if not exists start_time time without time zone;
alter table public.docket_rate_items add column if not exists category text;
alter table public.docket_rate_items add column if not exists created_at timestamp with time zone default now();
alter table public.docket_rate_items add column if not exists default_rate numeric default 0;
alter table public.docket_rate_items add column if not exists id uuid default gen_random_uuid();
alter table public.docket_rate_items add column if not exists label text;
alter table public.docket_rate_items add column if not exists profile_id uuid;
alter table public.docket_rate_items add column if not exists unit text default 'hour'::text;
alter table public.dockets add column if not exists client_email text;
alter table public.dockets add column if not exists client_name text;
alter table public.dockets add column if not exists created_at timestamp with time zone default now();
alter table public.dockets add column if not exists description text;
alter table public.dockets add column if not exists docket_invoice_id uuid;
alter table public.dockets add column if not exists end_time time without time zone;
alter table public.dockets add column if not exists id uuid default gen_random_uuid();
alter table public.dockets add column if not exists invoiced_at timestamp with time zone;
alter table public.dockets add column if not exists job_id uuid;
alter table public.dockets add column if not exists profile_id uuid;
alter table public.dockets add column if not exists public_token uuid default gen_random_uuid();
alter table public.dockets add column if not exists sent_at timestamp with time zone;
alter table public.dockets add column if not exists signature_data text;
alter table public.dockets add column if not exists signed_at timestamp with time zone;
alter table public.dockets add column if not exists signed_by_name text;
alter table public.dockets add column if not exists start_time time without time zone;
alter table public.dockets add column if not exists status text default 'draft'::text;
alter table public.dockets add column if not exists total_cost numeric default 0;
alter table public.dockets add column if not exists updated_at timestamp with time zone default now();
alter table public.dockets add column if not exists weather text;
alter table public.dockets add column if not exists work_date date default CURRENT_DATE;
alter table public.follow_up_log add column if not exists followed_up_at timestamp with time zone default now();
alter table public.follow_up_log add column if not exists id uuid default uuid_generate_v4();
alter table public.follow_up_log add column if not exists job_id uuid;
alter table public.follow_up_log add column if not exists method text default 'email'::text;
alter table public.follow_up_log add column if not exists notes text;
alter table public.follow_up_log add column if not exists profile_id uuid;
alter table public.follow_up_log add column if not exists quote_id uuid;
alter table public.homeowner_profiles add column if not exists created_at timestamp with time zone default now();
alter table public.homeowner_profiles add column if not exists email text;
alter table public.homeowner_profiles add column if not exists id uuid default gen_random_uuid();
alter table public.homeowner_profiles add column if not exists name text;
alter table public.homeowner_profiles add column if not exists phone text;
alter table public.homeowner_profiles add column if not exists postcode text;
alter table public.homeowner_profiles add column if not exists suburb text;
alter table public.invoice_counters add column if not exists next_number integer default 1;
alter table public.invoice_counters add column if not exists profile_id uuid;
alter table public.ip_blocklist add column if not exists blocked_by text;
alter table public.ip_blocklist add column if not exists created_at timestamp with time zone default now();
alter table public.ip_blocklist add column if not exists ip_address inet;
alter table public.ip_blocklist add column if not exists reason text;
alter table public.job_actuals add column if not exists actual_hours numeric default 0;
alter table public.job_actuals add column if not exists actual_materials_cost numeric default 0;
alter table public.job_actuals add column if not exists hourly_rate_used numeric;
alter table public.job_actuals add column if not exists id uuid default uuid_generate_v4();
alter table public.job_actuals add column if not exists job_id uuid;
alter table public.job_actuals add column if not exists notes text;
alter table public.job_actuals add column if not exists profile_id uuid;
alter table public.job_actuals add column if not exists quote_id uuid;
alter table public.job_actuals add column if not exists recorded_at timestamp with time zone default now();
alter table public.job_actuals add column if not exists unexpected_costs numeric default 0;
alter table public.job_attachments add column if not exists created_at timestamp with time zone default now();
alter table public.job_attachments add column if not exists file_name text;
alter table public.job_attachments add column if not exists file_size integer;
alter table public.job_attachments add column if not exists file_type text;
alter table public.job_attachments add column if not exists id uuid default uuid_generate_v4();
alter table public.job_attachments add column if not exists job_id uuid;
alter table public.job_attachments add column if not exists profile_id uuid;
alter table public.job_attachments add column if not exists quote_id uuid;
alter table public.job_attachments add column if not exists storage_path text;
alter table public.job_claims add column if not exists claimed_at timestamp with time zone default now();
alter table public.job_claims add column if not exists id uuid default gen_random_uuid();
alter table public.job_claims add column if not exists rejected_at timestamp with time zone;
alter table public.job_claims add column if not exists request_id uuid;
alter table public.job_claims add column if not exists status text default 'claimed'::text;
alter table public.job_claims add column if not exists tradie_profile_id uuid;
alter table public.job_counters add column if not exists next_number integer default 1;
alter table public.job_counters add column if not exists profile_id uuid;
alter table public.job_crew add column if not exists created_at timestamp with time zone default now();
alter table public.job_crew add column if not exists id uuid default gen_random_uuid();
alter table public.job_crew add column if not exists job_id uuid;
alter table public.job_crew add column if not exists note text;
alter table public.job_crew add column if not exists profile_id uuid;
alter table public.job_crew add column if not exists team_member_id uuid;
alter table public.job_line_items add column if not exists created_at timestamp with time zone default now();
alter table public.job_line_items add column if not exists id uuid default uuid_generate_v4();
alter table public.job_line_items add column if not exists job_id uuid;
alter table public.job_line_items add column if not exists label text;
alter table public.job_line_items add column if not exists profile_id uuid;
alter table public.job_line_items add column if not exists quantity numeric default 1;
alter table public.job_line_items add column if not exists sort_order integer default 0;
alter table public.job_line_items add column if not exists status text default 'not_started'::text;
alter table public.job_line_items add column if not exists unit text default 'ea'::text;
alter table public.job_line_items add column if not exists updated_at timestamp with time zone default now();
alter table public.job_requests add column if not exists additional_details text;
alter table public.job_requests add column if not exists budget text;
alter table public.job_requests add column if not exists created_at timestamp with time zone default now();
alter table public.job_requests add column if not exists description text;
alter table public.job_requests add column if not exists homeowner_id uuid;
alter table public.job_requests add column if not exists id uuid default gen_random_uuid();
alter table public.job_requests add column if not exists lead_temperature text default 'early'::text;
alter table public.job_requests add column if not exists num_quotes_wanted integer default 3;
alter table public.job_requests add column if not exists photo_paths text[] default '{}'::text[];
alter table public.job_requests add column if not exists postcode text;
alter table public.job_requests add column if not exists status text default 'open'::text;
alter table public.job_requests add column if not exists suburb text;
alter table public.job_requests add column if not exists timeline text;
alter table public.job_requests add column if not exists trade text;
alter table public.job_requests add column if not exists wider_radius_sent_at timestamp with time zone;
alter table public.job_size_tiers add column if not exists created_at timestamp with time zone default now();
alter table public.job_size_tiers add column if not exists id uuid default gen_random_uuid();
alter table public.job_size_tiers add column if not exists markup_pct numeric default 0;
alter table public.job_size_tiers add column if not exists max_days numeric;
alter table public.job_size_tiers add column if not exists name text;
alter table public.job_size_tiers add column if not exists profile_id uuid;
alter table public.job_size_tiers add column if not exists sort_order integer default 0;
alter table public.job_tasks add column if not exists assigned_to_member_id uuid;
alter table public.job_tasks add column if not exists completed_at timestamp with time zone;
alter table public.job_tasks add column if not exists created_at timestamp with time zone default now();
alter table public.job_tasks add column if not exists due_date date;
alter table public.job_tasks add column if not exists id uuid default uuid_generate_v4();
alter table public.job_tasks add column if not exists job_id uuid;
alter table public.job_tasks add column if not exists profile_id uuid;
alter table public.job_tasks add column if not exists quote_id uuid;
alter table public.job_tasks add column if not exists status text default 'todo'::text;
alter table public.job_tasks add column if not exists title text;
alter table public.jobs add column if not exists amount_paid numeric default 0;
alter table public.jobs add column if not exists archived_at timestamp with time zone;
alter table public.jobs add column if not exists assigned_to_member_id uuid;
alter table public.jobs add column if not exists cancelled_at timestamp with time zone;
alter table public.jobs add column if not exists client_email text;
alter table public.jobs add column if not exists client_id uuid;
alter table public.jobs add column if not exists client_name text;
alter table public.jobs add column if not exists client_phone text;
alter table public.jobs add column if not exists completed_at timestamp with time zone;
alter table public.jobs add column if not exists created_at timestamp with time zone default now();
alter table public.jobs add column if not exists directory_enquiry_id uuid;
alter table public.jobs add column if not exists estimated_days numeric;
alter table public.jobs add column if not exists id uuid default uuid_generate_v4();
alter table public.jobs add column if not exists invoiced_at timestamp with time zone;
alter table public.jobs add column if not exists is_recurring_template boolean default false;
alter table public.jobs add column if not exists job_number integer;
alter table public.jobs add column if not exists labour_hours numeric;
alter table public.jobs add column if not exists materials_cost numeric;
alter table public.jobs add column if not exists next_occurrence_date date;
alter table public.jobs add column if not exists paid_at timestamp with time zone;
alter table public.jobs add column if not exists parent_job_id uuid;
alter table public.jobs add column if not exists profile_id uuid;
alter table public.jobs add column if not exists quote_id uuid;
alter table public.jobs add column if not exists recurrence_rule jsonb;
alter table public.jobs add column if not exists scheduled_date date;
alter table public.jobs add column if not exists scheduled_end timestamp with time zone;
alter table public.jobs add column if not exists scheduled_start timestamp with time zone;
alter table public.jobs add column if not exists site_address text;
alter table public.jobs add column if not exists site_lat numeric;
alter table public.jobs add column if not exists site_lng numeric;
alter table public.jobs add column if not exists site_notes text;
alter table public.jobs add column if not exists source text default 'quote'::text;
alter table public.jobs add column if not exists status job_status default 'scheduled'::job_status;
alter table public.jobs add column if not exists title text;
alter table public.jobs add column if not exists total_cost numeric;
alter table public.jobs add column if not exists trade text;
alter table public.jobs add column if not exists updated_at timestamp with time zone default now();
alter table public.lead_matching_log add column if not exists claim_status text default 'pending'::text;
alter table public.lead_matching_log add column if not exists email_sent boolean default false;
alter table public.lead_matching_log add column if not exists id uuid default gen_random_uuid();
alter table public.lead_matching_log add column if not exists notified_at timestamp with time zone default now();
alter table public.lead_matching_log add column if not exists profile_id uuid;
alter table public.lead_matching_log add column if not exists request_id uuid;
alter table public.lead_subscriptions add column if not exists created_at timestamp with time zone default now();
alter table public.lead_subscriptions add column if not exists id uuid default gen_random_uuid();
alter table public.lead_subscriptions add column if not exists is_active boolean default true;
alter table public.lead_subscriptions add column if not exists profile_id uuid;
alter table public.lead_subscriptions add column if not exists suburb text;
alter table public.lead_subscriptions add column if not exists trade text;
alter table public.lead_subscriptions add column if not exists updated_at timestamp with time zone default now();
alter table public.listing_creation_attempts add column if not exists created_at timestamp with time zone default now();
alter table public.listing_creation_attempts add column if not exists id uuid default gen_random_uuid();
alter table public.listing_creation_attempts add column if not exists ip_address inet;
alter table public.listing_creation_attempts add column if not exists profile_id uuid;
alter table public.material_bundle_items add column if not exists bundle_id uuid;
alter table public.material_bundle_items add column if not exists id uuid default gen_random_uuid();
alter table public.material_bundle_items add column if not exists label text;
alter table public.material_bundle_items add column if not exists qty numeric default 1;
alter table public.material_bundle_items add column if not exists sort_order integer default 0;
alter table public.material_bundle_items add column if not exists unit text default 'each'::text;
alter table public.material_bundle_items add column if not exists unit_cost numeric default 0;
alter table public.material_bundles add column if not exists created_at timestamp with time zone default now();
alter table public.material_bundles add column if not exists description text;
alter table public.material_bundles add column if not exists id uuid default gen_random_uuid();
alter table public.material_bundles add column if not exists profile_id uuid;
alter table public.material_bundles add column if not exists status text default 'active'::text;
alter table public.material_bundles add column if not exists title text;
alter table public.material_bundles add column if not exists trade text default 'electrician'::text;
alter table public.material_items add column if not exists id uuid default uuid_generate_v4();
alter table public.material_items add column if not exists item_key text;
alter table public.material_items add column if not exists label text;
alter table public.material_items add column if not exists profile_id uuid;
alter table public.material_items add column if not exists supplier text;
alter table public.material_items add column if not exists trade text default 'electrician'::text;
alter table public.material_items add column if not exists unit_cost numeric default 0;
alter table public.material_items add column if not exists updated_at timestamp with time zone default now();
alter table public.onboarding_state add column if not exists ai_assistant_used_at timestamp with time zone;
alter table public.onboarding_state add column if not exists created_at timestamp with time zone default now();
alter table public.onboarding_state add column if not exists dismissed boolean default false;
alter table public.onboarding_state add column if not exists last_nudge_sent_day integer;
alter table public.onboarding_state add column if not exists profile_id uuid;
alter table public.onboarding_state add column if not exists report_viewed_at timestamp with time zone;
alter table public.onboarding_state add column if not exists updated_at timestamp with time zone default now();
alter table public.payments add column if not exists amount numeric;
alter table public.payments add column if not exists id uuid default uuid_generate_v4();
alter table public.payments add column if not exists job_id uuid;
alter table public.payments add column if not exists profile_id uuid;
alter table public.payments add column if not exists quote_id uuid;
alter table public.payments add column if not exists recorded_at timestamp with time zone default now();
alter table public.price_book_items add column if not exists category text;
alter table public.price_book_items add column if not exists cost_price numeric default 0;
alter table public.price_book_items add column if not exists description text;
alter table public.price_book_items add column if not exists id uuid default uuid_generate_v4();
alter table public.price_book_items add column if not exists imported_at timestamp with time zone default now();
alter table public.price_book_items add column if not exists profile_id uuid;
alter table public.price_book_items add column if not exists sku text;
alter table public.price_book_items add column if not exists supplier text;
alter table public.price_book_items add column if not exists trade text;
alter table public.price_book_items add column if not exists unit text default 'ea'::text;
alter table public.pricing_tiers add column if not exists created_at timestamp with time zone default now();
alter table public.pricing_tiers add column if not exists id uuid default gen_random_uuid();
alter table public.pricing_tiers add column if not exists markup_pct numeric default 0;
alter table public.pricing_tiers add column if not exists name text;
alter table public.pricing_tiers add column if not exists profile_id uuid;
alter table public.pricing_tiers add column if not exists sort_order integer default 0;
alter table public.profiles add column if not exists abn text;
alter table public.profiles add column if not exists abn_verified_at timestamp with time zone;
alter table public.profiles add column if not exists accepts_cash boolean default true;
alter table public.profiles add column if not exists ai_addon_analyses_used integer default 0;
alter table public.profiles add column if not exists ai_addon_period text;
alter table public.profiles add column if not exists ai_addon_status text default 'none'::text;
alter table public.profiles add column if not exists ai_addon_subscription_id text;
alter table public.profiles add column if not exists ai_analyses_limit_override integer;
alter table public.profiles add column if not exists ai_free_analyses_used integer default 0;
alter table public.profiles add column if not exists archetype_defaults jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists bank_account_name text;
alter table public.profiles add column if not exists bank_account_number text;
alter table public.profiles add column if not exists bank_bsb text;
alter table public.profiles add column if not exists branding_email_footer text default 'Sent via Swiftscope'::text;
alter table public.profiles add column if not exists branding_primary_color text default '#ffb400'::text;
alter table public.profiles add column if not exists branding_tagline text;
alter table public.profiles add column if not exists business_address text;
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists cancel_at_period_end boolean default false;
alter table public.profiles add column if not exists comp_access boolean default false;
alter table public.profiles add column if not exists contact_email text;
alter table public.profiles add column if not exists contact_phone text;
alter table public.profiles add column if not exists created_at timestamp with time zone default now();
alter table public.profiles add column if not exists current_period_end timestamp with time zone;
alter table public.profiles add column if not exists default_deposit_pct integer;
alter table public.profiles add column if not exists default_expiry_days integer default 30;
alter table public.profiles add column if not exists deleted_at timestamp with time zone;
alter table public.profiles add column if not exists digital_tools text[];
alter table public.profiles add column if not exists directory_badge_verified boolean default false;
alter table public.profiles add column if not exists directory_bio text;
alter table public.profiles add column if not exists directory_email text;
alter table public.profiles add column if not exists directory_enabled boolean default false;
alter table public.profiles add column if not exists directory_phone text;
alter table public.profiles add column if not exists directory_postcode text;
alter table public.profiles add column if not exists directory_suburb text;
alter table public.profiles add column if not exists directory_website text;
alter table public.profiles add column if not exists hourly_rate numeric default 95;
alter table public.profiles add column if not exists id uuid;
alter table public.profiles add column if not exists license_number text;
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles add column if not exists materials_margin_pct numeric default 20;
alter table public.profiles add column if not exists onboarded_at timestamp with time zone;
alter table public.profiles add column if not exists ordering_contact_name text;
alter table public.profiles add column if not exists quote_frequency text;
alter table public.profiles add column if not exists send_weekly_digest boolean default false;
alter table public.profiles add column if not exists signup_ip inet;
alter table public.profiles add column if not exists signup_user_agent text;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists subscription_plan text;
alter table public.profiles add column if not exists subscription_status text default 'none'::text;
alter table public.profiles add column if not exists suburb text;
alter table public.profiles add column if not exists team_size integer;
alter table public.profiles add column if not exists terms_and_conditions text default 'Quote valid for 30 days. Materials and labour as listed above. Any variation to the scope of work will be quoted separately before proceeding. Payment due as per the terms stated on this quote.'::text;
alter table public.profiles add column if not exists trades text[] default '{}'::text[];
alter table public.profiles add column if not exists trading_name text;
alter table public.profiles add column if not exists trial_ends_at timestamp with time zone;
alter table public.profiles add column if not exists welcome_email_sent_at timestamp with time zone;
alter table public.profiles add column if not exists xero_access_token text;
alter table public.profiles add column if not exists xero_account_code text default '200'::text;
alter table public.profiles add column if not exists xero_connected boolean default false;
alter table public.profiles add column if not exists xero_connected_at timestamp with time zone;
alter table public.profiles add column if not exists xero_refresh_token text;
alter table public.profiles add column if not exists xero_tax_type text default 'OUTPUT'::text;
alter table public.profiles add column if not exists xero_tenant_id text;
alter table public.profiles add column if not exists xero_token_expires_at timestamp with time zone;
alter table public.push_subscriptions add column if not exists auth_key text;
alter table public.push_subscriptions add column if not exists business_id uuid;
alter table public.push_subscriptions add column if not exists created_at timestamp with time zone default now();
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists id uuid default uuid_generate_v4();
alter table public.push_subscriptions add column if not exists p256dh text;
alter table public.push_subscriptions add column if not exists user_id uuid;
alter table public.quotes add column if not exists accepted_at timestamp with time zone;
alter table public.quotes add column if not exists amount_paid numeric default 0;
alter table public.quotes add column if not exists assigned_to text;
alter table public.quotes add column if not exists assigned_to_member_id uuid;
alter table public.quotes add column if not exists client_email text;
alter table public.quotes add column if not exists client_id uuid;
alter table public.quotes add column if not exists client_name text;
alter table public.quotes add column if not exists client_phone text;
alter table public.quotes add column if not exists completed_at timestamp with time zone;
alter table public.quotes add column if not exists created_at timestamp with time zone default now();
alter table public.quotes add column if not exists declined_reason text;
alter table public.quotes add column if not exists directory_enquiry_id uuid;
alter table public.quotes add column if not exists estimated_days numeric;
alter table public.quotes add column if not exists follow_up_at date;
alter table public.quotes add column if not exists follow_up_sent_at timestamp with time zone;
alter table public.quotes add column if not exists id uuid default uuid_generate_v4();
alter table public.quotes add column if not exists intake_data jsonb default '{}'::jsonb;
alter table public.quotes add column if not exists invoice_number text;
alter table public.quotes add column if not exists invoiced_at timestamp with time zone;
alter table public.quotes add column if not exists job_size_tier_id uuid;
alter table public.quotes add column if not exists job_type text;
alter table public.quotes add column if not exists labour_hours numeric;
alter table public.quotes add column if not exists markup_materials jsonb default '[]'::jsonb;
alter table public.quotes add column if not exists materials_checklist jsonb default '[]'::jsonb;
alter table public.quotes add column if not exists materials_cost numeric;
alter table public.quotes add column if not exists paid_at timestamp with time zone;
alter table public.quotes add column if not exists payment_terms jsonb default '[{"days": 14, "label": "Payment due", "percent": 100, "trigger": "completion"}]'::jsonb;
alter table public.quotes add column if not exists pdf_url text;
alter table public.quotes add column if not exists planned_crew_member_ids uuid[] default '{}'::uuid[];
alter table public.quotes add column if not exists pricing_tier_id uuid;
alter table public.quotes add column if not exists profile_id uuid;
alter table public.quotes add column if not exists progress_pct integer default 0;
alter table public.quotes add column if not exists public_token uuid default uuid_generate_v4();
alter table public.quotes add column if not exists quote_expires_at date;
alter table public.quotes add column if not exists scheduled_date date;
alter table public.quotes add column if not exists scheduled_end timestamp with time zone;
alter table public.quotes add column if not exists scheduled_start timestamp with time zone;
alter table public.quotes add column if not exists sent_at timestamp with time zone;
alter table public.quotes add column if not exists site_address text;
alter table public.quotes add column if not exists site_lat numeric;
alter table public.quotes add column if not exists site_lng numeric;
alter table public.quotes add column if not exists site_notes text;
alter table public.quotes add column if not exists stage job_stage default 'quoted'::job_stage;
alter table public.quotes add column if not exists status text default 'draft'::text;
alter table public.quotes add column if not exists total_cost numeric;
alter table public.quotes add column if not exists trade text default 'electrician'::text;
alter table public.quotes add column if not exists updated_at timestamp with time zone default now();
alter table public.quotes add column if not exists xero_exported_at timestamp with time zone;
alter table public.quotes add column if not exists xero_invoice_id text;
alter table public.roadmap_items add column if not exists branch_name text;
alter table public.roadmap_items add column if not exists category text default 'feature'::text;
alter table public.roadmap_items add column if not exists created_at timestamp with time zone default now();
alter table public.roadmap_items add column if not exists description text;
alter table public.roadmap_items add column if not exists id uuid default gen_random_uuid();
alter table public.roadmap_items add column if not exists notes text;
alter table public.roadmap_items add column if not exists prd_content text;
alter table public.roadmap_items add column if not exists priority_order integer default 0;
alter table public.roadmap_items add column if not exists shipped_at timestamp with time zone;
alter table public.roadmap_items add column if not exists status text default 'idea'::text;
alter table public.roadmap_items add column if not exists title text;
alter table public.roadmap_items add column if not exists updated_at timestamp with time zone default now();
alter table public.seo_refresh_log add column if not exists duration_ms integer;
alter table public.seo_refresh_log add column if not exists error text;
alter table public.seo_refresh_log add column if not exists id uuid default uuid_generate_v4();
alter table public.seo_refresh_log add column if not exists pages_newly_deindexed integer default 0;
alter table public.seo_refresh_log add column if not exists pages_newly_indexed integer default 0;
alter table public.seo_refresh_log add column if not exists pages_scanned integer default 0;
alter table public.seo_refresh_log add column if not exists pages_updated integer default 0;
alter table public.seo_refresh_log add column if not exists run_at timestamp with time zone default now();
alter table public.seo_refresh_log add column if not exists sitemap_pinged boolean default false;
alter table public.seo_refresh_log add column if not exists status text default 'success'::text;
alter table public.site_condition_templates add column if not exists created_at timestamp with time zone default now();
alter table public.site_condition_templates add column if not exists default_amount numeric default 0;
alter table public.site_condition_templates add column if not exists id uuid default gen_random_uuid();
alter table public.site_condition_templates add column if not exists kind text;
alter table public.site_condition_templates add column if not exists label text;
alter table public.site_condition_templates add column if not exists profile_id uuid;
alter table public.site_condition_templates add column if not exists sort_order integer default 0;
alter table public.site_condition_templates add column if not exists trade text;
alter table public.site_condition_templates add column if not exists updated_at timestamp with time zone default now();
alter table public.supplier_contacts add column if not exists account_number text;
alter table public.supplier_contacts add column if not exists created_at timestamp with time zone default now();
alter table public.supplier_contacts add column if not exists email text;
alter table public.supplier_contacts add column if not exists id uuid default gen_random_uuid();
alter table public.supplier_contacts add column if not exists notes text;
alter table public.supplier_contacts add column if not exists phone text;
alter table public.supplier_contacts add column if not exists profile_id uuid;
alter table public.supplier_contacts add column if not exists supplier_name text;
alter table public.supplier_contacts add column if not exists updated_at timestamp with time zone default now();
alter table public.supplier_order_sends add column if not exists body_text text;
alter table public.supplier_order_sends add column if not exists created_at timestamp with time zone default now();
alter table public.supplier_order_sends add column if not exists delivery_notes text;
alter table public.supplier_order_sends add column if not exists fulfillment text default 'pickup'::text;
alter table public.supplier_order_sends add column if not exists id uuid default gen_random_uuid();
alter table public.supplier_order_sends add column if not exists job_id uuid;
alter table public.supplier_order_sends add column if not exists line_items jsonb default '[]'::jsonb;
alter table public.supplier_order_sends add column if not exists needed_by date;
alter table public.supplier_order_sends add column if not exists profile_id uuid;
alter table public.supplier_order_sends add column if not exists quote_id uuid;
alter table public.supplier_order_sends add column if not exists recipient_email text;
alter table public.supplier_order_sends add column if not exists send_method text default 'mailto'::text;
alter table public.supplier_order_sends add column if not exists sent_at timestamp with time zone default now();
alter table public.supplier_order_sends add column if not exists subject text;
alter table public.supplier_order_sends add column if not exists supplier_name text;
alter table public.team_members add column if not exists access_scope text default 'all'::text;
alter table public.team_members add column if not exists created_at timestamp with time zone default now();
alter table public.team_members add column if not exists email text;
alter table public.team_members add column if not exists hourly_rate numeric;
alter table public.team_members add column if not exists id uuid default uuid_generate_v4();
alter table public.team_members add column if not exists invite_token uuid default uuid_generate_v4();
alter table public.team_members add column if not exists invited_at timestamp with time zone default now();
alter table public.team_members add column if not exists joined_at timestamp with time zone;
alter table public.team_members add column if not exists member_user_id uuid;
alter table public.team_members add column if not exists name text;
alter table public.team_members add column if not exists owner_profile_id uuid;
alter table public.team_members add column if not exists role text default 'site_member'::text;
alter table public.team_members add column if not exists status text default 'invited'::text;
alter table public.trade_suburb_pages add column if not exists avg_rating numeric;
alter table public.trade_suburb_pages add column if not exists created_at timestamp with time zone default now();
alter table public.trade_suburb_pages add column if not exists id uuid default uuid_generate_v4();
alter table public.trade_suburb_pages add column if not exists is_indexed boolean default false;
alter table public.trade_suburb_pages add column if not exists last_refreshed_at timestamp with time zone default now();
alter table public.trade_suburb_pages add column if not exists listing_count integer default 0;
alter table public.trade_suburb_pages add column if not exists state text default 'vic'::text;
alter table public.trade_suburb_pages add column if not exists suburb text;
alter table public.trade_suburb_pages add column if not exists suburb_slug text;
alter table public.trade_suburb_pages add column if not exists total_reviews integer default 0;
alter table public.trade_suburb_pages add column if not exists trade text;
alter table public.variations add column if not exists client_approved_at timestamp with time zone;
alter table public.variations add column if not exists client_signer_name text;
alter table public.variations add column if not exists created_at timestamp with time zone default now();
alter table public.variations add column if not exists description text;
alter table public.variations add column if not exists id uuid default uuid_generate_v4();
alter table public.variations add column if not exists job_id uuid;
alter table public.variations add column if not exists labour_hours numeric default 0;
alter table public.variations add column if not exists materials_cost numeric default 0;
alter table public.variations add column if not exists profile_id uuid;
alter table public.variations add column if not exists public_token uuid default gen_random_uuid();
alter table public.variations add column if not exists quote_id uuid;
alter table public.variations add column if not exists status text default 'pending'::text;
alter table public.variations add column if not exists title text;
alter table public.variations add column if not exists total_cost numeric default 0;
alter table public.xero_contact_mappings add column if not exists client_email text;
alter table public.xero_contact_mappings add column if not exists created_at timestamp with time zone default now();
alter table public.xero_contact_mappings add column if not exists id uuid default gen_random_uuid();
alter table public.xero_contact_mappings add column if not exists profile_id uuid;
alter table public.xero_contact_mappings add column if not exists updated_at timestamp with time zone default now();
alter table public.xero_contact_mappings add column if not exists xero_contact_id text;
alter table public.xero_contact_mappings add column if not exists xero_contact_name text;

-- Functions -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accessible_job_ids(biz_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jc.job_id from job_crew jc
  join team_members tm on tm.id = jc.team_member_id
  where jc.profile_id = biz_id and tm.member_user_id = auth.uid() and tm.status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.check_directory_listing_not_excluded()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_domain text;
begin
  if new.website_url is not null and trim(new.website_url) <> '' then
    v_domain := lower(regexp_replace(regexp_replace(trim(new.website_url), '^https?://', ''), '^www\.', ''));
    v_domain := split_part(v_domain, '/', 1);
  end if;

  if exists (
    select 1 from public.directory_exclusions e
    where (
      lower(trim(e.business_name)) = lower(trim(new.business_name))
      and coalesce(lower(trim(e.suburb)), '') = coalesce(lower(trim(new.suburb)), '')
    )
    or (v_domain is not null and v_domain <> '' and e.website_domain = v_domain)
  ) then
    raise exception 'This business has asked to be removed from the Swiftscope directory and cannot be re-listed without their express authority (business_name=%, suburb=%)', new.business_name, new.suburb;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_trade_slot(p_slot_id uuid, p_tradie_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  rows_affected int;
begin
  update trade_claim_slot
  set status = 'claimed', claimed_by = p_tradie_id, claimed_at = now()
  where id = p_slot_id and status = 'broadcasting';

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.count_listings_needing_photo_recache()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)
  from directory_listing
  where website_url is not null
    and is_claimed = false
    and (
      photo_references is null
      or array_length(photo_references, 1) is null
      or not exists (
        select 1 from unnest(photo_references) r where r like 'http%'
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.count_listings_with_renderable_photo()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)
  from directory_listing
  where photo_references is not null
    and exists (select 1 from unnest(photo_references) r where r like 'http%');
$function$
;

CREATE OR REPLACE FUNCTION public.current_team_member(biz_id uuid)
 RETURNS team_members
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from team_members
  where owner_profile_id = biz_id and member_user_id = auth.uid() and status = 'active'
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.decrypt_secret(encrypted text, key text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
begin
  if encrypted is null then
    return null;
  end if;
  return pgp_sym_decrypt(decode(encrypted, 'base64'), key);
exception
  when others then
    return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.directory_listings_within_radius(center_lat double precision, center_lng double precision, radius_km double precision)
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  select id
  from public.directory_listing
  where latitude is not null and longitude is not null
    and public.haversine_km(latitude, longitude, center_lat, center_lng) <= radius_km;
$function$
;

CREATE OR REPLACE FUNCTION public.directory_postcode_centroid(p_postcode text)
 RETURNS TABLE(lat double precision, lng double precision)
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  select avg(latitude)::double precision, avg(longitude)::double precision
  from public.directory_listing
  where postcode = p_postcode;
$function$
;

CREATE OR REPLACE FUNCTION public.directory_search_nearby(center_lat double precision, center_lng double precision, radius_km double precision, p_trade text DEFAULT NULL::text, p_min_rating numeric DEFAULT NULL::numeric, p_min_reviews integer DEFAULT NULL::integer, p_max_reviews integer DEFAULT NULL::integer, p_sort text DEFAULT 'rating'::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS SETOF directory_listing
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  select dl.*
  from public.directory_listing dl
  where dl.latitude is not null and dl.longitude is not null
    and public.haversine_km(dl.latitude, dl.longitude, center_lat, center_lng) <= radius_km
    and (p_trade is null or dl.trades @> array[p_trade])
    and (p_min_rating is null or dl.google_rating >= p_min_rating)
    and (p_min_reviews is null or dl.google_reviews_count >= p_min_reviews)
    and (p_max_reviews is null or dl.google_reviews_count < p_max_reviews)
  order by
    case when p_sort = 'reviews' then dl.google_reviews_count end desc nulls last,
    case when p_sort = 'name' then dl.business_name end asc nulls last,
    case when p_sort = 'rating' or p_sort is null then dl.google_rating end desc nulls last,
    dl.google_reviews_count desc nulls last
  limit p_limit offset p_offset;
$function$
;

CREATE OR REPLACE FUNCTION public.directory_search_nearby_count(center_lat double precision, center_lng double precision, radius_km double precision, p_trade text DEFAULT NULL::text, p_min_rating numeric DEFAULT NULL::numeric, p_min_reviews integer DEFAULT NULL::integer, p_max_reviews integer DEFAULT NULL::integer)
 RETURNS bigint
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  select count(*)
  from public.directory_listing dl
  where dl.latitude is not null and dl.longitude is not null
    and public.haversine_km(dl.latitude, dl.longitude, center_lat, center_lng) <= radius_km
    and (p_trade is null or dl.trades @> array[p_trade])
    and (p_min_rating is null or dl.google_rating >= p_min_rating)
    and (p_min_reviews is null or dl.google_reviews_count >= p_min_reviews)
    and (p_max_reviews is null or dl.google_reviews_count < p_max_reviews);
$function$
;

CREATE OR REPLACE FUNCTION public.encrypt_secret(plain text, key text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
begin
  if plain is null then
    return null;
  end if;
  return encode(pgp_sym_encrypt(plain, key), 'base64');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  select 6371 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND subscription_status = 'admin'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_business_admin(uid uuid, biz uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select uid = biz
  or exists (
    select 1 from team_members
    where owner_profile_id = biz and member_user_id = uid and role = 'admin' and status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_job_restricted(biz_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select role = 'site_member' or (role = 'manager' and access_scope = 'assigned_only')
     from team_members
     where owner_profile_id = biz_id and member_user_id = auth.uid() and status = 'active'
     limit 1),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.listings_needing_photo_recache(p_limit integer DEFAULT 30)
 RETURNS SETOF directory_listing
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select *
  from directory_listing
  where website_url is not null
    and is_claimed = false
    and (
      photo_references is null
      or array_length(photo_references, 1) is null
      or not exists (
        select 1 from unnest(photo_references) r where r like 'http%'
      )
    )
  order by website_scraped_at asc nulls first
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_directory_listing_by_business_slug(p_stem text)
 RETURNS SETOF directory_listing
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select *
  from directory_listing
  where p_stem = regexp_replace(lower(trim(both '-' from regexp_replace(business_name, '[^a-zA-Z0-9]+', '-', 'g'))), '^-+|-+$', '', 'g')
     or p_stem like regexp_replace(lower(trim(both '-' from regexp_replace(business_name, '[^a-zA-Z0-9]+', '-', 'g'))), '^-+|-+$', '', 'g') || '-%'
  limit 2;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_directory_listing_by_uid_suffix(p_suffix text)
 RETURNS SETOF directory_listing
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select *
  from directory_listing
  where right(replace(id::text, '-', ''), 6) = lower(p_suffix)
  limit 2;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_postcode_for_suburb(p_suburb text)
 RETURNS text
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  select coalesce(
    (
      select postcode
      from public.directory_listing
      where lower(suburb) = lower(p_suburb) and postcode is not null
      group by postcode
      order by count(*) desc
      limit 1
    ),
    (
      select postcode
      from public.directory_listing
      where suburb ilike '%' || p_suburb || '%' and postcode is not null
      group by postcode
      order by count(*) desc
      limit 1
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.search_directory_listings_fuzzy(p_name text, p_trade text DEFAULT NULL::text, p_suburb text DEFAULT NULL::text, p_postcode text DEFAULT NULL::text, p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, business_name text, suburb text, postcode text, trades text[], is_claimed boolean, google_rating numeric, google_reviews_count integer, logo_url text, similarity real)
 LANGUAGE sql
 STABLE
AS $function$
  select
    dl.id,
    dl.business_name,
    dl.suburb,
    dl.postcode,
    dl.trades,
    dl.is_claimed,
    dl.google_rating,
    dl.google_reviews_count,
    dl.logo_url,
    similarity(dl.business_name, p_name) as similarity
  from directory_listing dl
  where dl.is_claimed = false
    and similarity(dl.business_name, p_name) > 0.25
    and (p_trade is null or p_trade = any(dl.trades))
    and (p_suburb is null or dl.suburb ilike p_suburb)
    and (p_postcode is null or dl.postcode = p_postcode)
  order by similarity desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.set_member_hourly_rate(p_member_id uuid, p_rate numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner uuid;
begin
  select owner_profile_id into v_owner from team_members where id = p_member_id;
  if v_owner is null then
    raise exception 'Member not found';
  end if;
  if not is_business_admin(auth.uid(), v_owner) then
    raise exception 'Not authorized';
  end if;
  update team_members set hourly_rate = p_rate where id = p_member_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at_now()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_directory_listing(p_business_name text, p_trades text[], p_website_url text, p_suburb text, p_postcode text, p_latitude double precision, p_longitude double precision, p_place_id text, p_google_rating numeric, p_google_reviews_count integer, p_photo_references text[], p_scraped_contact_phone text, p_private_email text, p_logo_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.directory_listing (
    business_name, trades, website_url, suburb, postcode,
    latitude, longitude, place_id, google_rating, google_reviews_count,
    photo_references, scraped_contact_phone, private_email, logo_url, source
  ) VALUES (
    p_business_name, p_trades, p_website_url, p_suburb, p_postcode,
    p_latitude, p_longitude, p_place_id, p_google_rating, p_google_reviews_count,
    p_photo_references, p_scraped_contact_phone, p_private_email, p_logo_url, 'scraper'
  )
  ON CONFLICT ON CONSTRAINT directory_listing_place_id_unique DO UPDATE SET
    business_name = EXCLUDED.business_name,
    trades = (SELECT array_agg(DISTINCT t) FROM unnest(directory_listing.trades || EXCLUDED.trades) AS t),
    website_url = COALESCE(EXCLUDED.website_url, directory_listing.website_url),
    suburb = EXCLUDED.suburb,
    postcode = EXCLUDED.postcode,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    google_rating = EXCLUDED.google_rating,
    google_reviews_count = EXCLUDED.google_reviews_count,
    photo_references = EXCLUDED.photo_references,
    scraped_contact_phone = COALESCE(EXCLUDED.scraped_contact_phone, directory_listing.scraped_contact_phone),
    private_email = COALESCE(EXCLUDED.private_email, directory_listing.private_email),
    logo_url = COALESCE(EXCLUDED.logo_url, directory_listing.logo_url),
    updated_at = NOW();
END;
$function$
;

-- Row level security ----------------------------------------------------------
alter table public.business_suppliers enable row level security;
alter table public.client_plans enable row level security;
alter table public.contact_mappings enable row level security;
alter table public.directory_claim_attempts enable row level security;
alter table public.directory_enquiries enable row level security;
alter table public.directory_exclusions enable row level security;
alter table public.directory_listing enable row level security;
alter table public.directory_removal_requests enable row level security;
alter table public.job_board_columns enable row level security;
alter table public.job_packages enable row level security;
alter table public.package_items enable row level security;
alter table public.packages enable row level security;
alter table public.schedule_events enable row level security;
alter table public.seo_keywords enable row level security;
alter table public.supplier_catalog enable row level security;
alter table public.supplier_price_imports enable row level security;
alter table public.team_invites enable row level security;
alter table public.timesheets enable row level security;
alter table public.tradie_directory_settings enable row level security;
alter table public.tradie_profiles enable row level security;
alter table public.traffic_log enable row level security;

-- Policies on missing tables -------------------------------------------------
drop policy if exists "Business suppliers" on public.business_suppliers; create policy "Business suppliers" on public.business_suppliers as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "Business client plans" on public.client_plans; create policy "Business client plans" on public.client_plans as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "Only admins can read claim attempts" on public.directory_claim_attempts; create policy "Only admins can read claim attempts" on public.directory_claim_attempts as permissive for select to public using (false);
drop policy if exists "Allow anonymous insert" on public.directory_enquiries; create policy "Allow anonymous insert" on public.directory_enquiries as permissive for insert to anon with check (true);
drop policy if exists "Admin read access" on public.directory_enquiries; create policy "Admin read access" on public.directory_enquiries as permissive for select to authenticated using (is_admin());
drop policy if exists "Owners manage own directory enquiries" on public.directory_enquiries; create policy "Owners manage own directory enquiries" on public.directory_enquiries as permissive for all to public using (((profile_id IS NOT NULL) AND (profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)))) with check (((profile_id IS NOT NULL) AND (profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids))));
drop policy if exists "Admin full access to directory_exclusions" on public.directory_exclusions; create policy "Admin full access to directory_exclusions" on public.directory_exclusions as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "Public read directory listings" on public.directory_listing; create policy "Public read directory listings" on public.directory_listing as permissive for select to anon, authenticated using (true);
drop policy if exists "Admin full access to directory_removal_requests" on public.directory_removal_requests; create policy "Admin full access to directory_removal_requests" on public.directory_removal_requests as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "Business job board columns" on public.job_board_columns; create policy "Business job board columns" on public.job_board_columns as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "Business job packages" on public.job_packages; create policy "Business job packages" on public.job_packages as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "Business package items" on public.package_items; create policy "Business package items" on public.package_items as permissive for all to public using ((EXISTS ( SELECT 1
   FROM packages p
  WHERE ((p.id = package_items.package_id) AND (p.profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)))))) with check ((EXISTS ( SELECT 1
   FROM packages p
  WHERE ((p.id = package_items.package_id) AND (p.profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids))))));
drop policy if exists "Business packages" on public.packages; create policy "Business packages" on public.packages as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids))) with check ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "Business schedule events" on public.schedule_events; create policy "Business schedule events" on public.schedule_events as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "seo_keywords_write_authenticated" on public.seo_keywords; create policy "seo_keywords_write_authenticated" on public.seo_keywords as permissive for all to public using ((( SELECT auth.uid() AS uid) IS NOT NULL)) with check ((( SELECT auth.uid() AS uid) IS NOT NULL));
drop policy if exists "seo_keywords_select_all" on public.seo_keywords; create policy "seo_keywords_select_all" on public.seo_keywords as permissive for select to public using (true);
drop policy if exists "Anyone can read supplier catalog" on public.supplier_catalog; create policy "Anyone can read supplier catalog" on public.supplier_catalog as permissive for select to public using (true);
drop policy if exists "Business supplier imports" on public.supplier_price_imports; create policy "Business supplier imports" on public.supplier_price_imports as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "Owner can manage invites" on public.team_invites; create policy "Owner can manage invites" on public.team_invites as permissive for all to public using ((( SELECT auth.uid() AS uid) = profile_id));
drop policy if exists "Admin manages timesheets" on public.timesheets; create policy "Admin manages timesheets" on public.timesheets as permissive for all to public using (is_business_admin(( SELECT auth.uid() AS uid), profile_id));
drop policy if exists "Business directory settings" on public.tradie_directory_settings; create policy "Business directory settings" on public.tradie_directory_settings as permissive for all to public using ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids))) with check ((profile_id IN ( SELECT accessible_business_ids(( SELECT auth.uid() AS uid)) AS accessible_business_ids)));
drop policy if exists "Admin read access to traffic_log" on public.traffic_log; create policy "Admin read access to traffic_log" on public.traffic_log as permissive for select to public using (is_admin());

-- Triggers on missing tables -------------------------------------------------
CREATE OR REPLACE TRIGGER trg_business_suppliers_updated_at BEFORE UPDATE ON public.business_suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_directory_listing_not_excluded BEFORE INSERT ON public.directory_listing FOR EACH ROW EXECUTE FUNCTION check_directory_listing_not_excluded();
CREATE OR REPLACE TRIGGER trg_listing_has_real_identity BEFORE INSERT OR UPDATE OF business_name, suburb ON public.directory_listing FOR EACH ROW EXECUTE FUNCTION check_listing_has_real_identity();
CREATE OR REPLACE TRIGGER trg_job_board_columns_updated_at BEFORE UPDATE ON public.job_board_columns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auth hook: create the profiles row on signup (prod-only trigger) -----------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

reset check_function_bodies;

-- Make PostgREST pick up the new tables/columns without a restart.
notify pgrst, 'reload schema';
