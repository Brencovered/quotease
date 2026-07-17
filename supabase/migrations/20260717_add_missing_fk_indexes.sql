-- Add covering indexes for foreign keys flagged by the performance advisor as
-- unindexed. These joins (business -> jobs/quotes/clients etc.) will degrade
-- from index scans to sequential scans as row counts grow with real tenant
-- data, so add them now while tables are still small and cheap to index.

create index if not exists idx_business_suppliers_catalog_key on public.business_suppliers (catalog_key);
create index if not exists idx_client_plans_client_id on public.client_plans (client_id);
create index if not exists idx_client_plans_profile_id on public.client_plans (profile_id);
create index if not exists idx_clients_profile_id on public.clients (profile_id);
create index if not exists idx_communication_log_quote_id on public.communication_log (quote_id);
create index if not exists idx_compliance_certs_profile_id on public.compliance_certs (profile_id);
create index if not exists idx_compliance_certs_quote_id on public.compliance_certs (quote_id);
create index if not exists idx_contact_mappings_tradie_id on public.contact_mappings (tradie_id);
create index if not exists idx_directory_listing_profile_id on public.directory_listing (profile_id);
create index if not exists idx_follow_up_log_profile_id on public.follow_up_log (profile_id);
create index if not exists idx_follow_up_log_quote_id on public.follow_up_log (quote_id);
create index if not exists idx_job_actuals_profile_id on public.job_actuals (profile_id);
create index if not exists idx_job_actuals_quote_id on public.job_actuals (quote_id);
create index if not exists idx_job_attachments_profile_id on public.job_attachments (profile_id);
create index if not exists idx_job_attachments_quote_id on public.job_attachments (quote_id);
create index if not exists idx_job_claims_tradie_profile_id on public.job_claims (tradie_profile_id);
create index if not exists idx_job_crew_profile_id on public.job_crew (profile_id);
create index if not exists idx_job_requests_homeowner_id on public.job_requests (homeowner_id);
create index if not exists idx_job_tasks_assigned_to_member_id on public.job_tasks (assigned_to_member_id);
create index if not exists idx_jobs_assigned_to_member_id on public.jobs (assigned_to_member_id);
create index if not exists idx_jobs_client_id on public.jobs (client_id);
create index if not exists idx_jobs_parent_job_id on public.jobs (parent_job_id);
create index if not exists idx_payments_profile_id on public.payments (profile_id);
create index if not exists idx_payments_quote_id on public.payments (quote_id);
create index if not exists idx_quotes_client_id on public.quotes (client_id);
create index if not exists idx_quotes_job_size_tier_id on public.quotes (job_size_tier_id);
create index if not exists idx_quotes_pricing_tier_id on public.quotes (pricing_tier_id);
create index if not exists idx_quotes_profile_id on public.quotes (profile_id);
create index if not exists idx_schedule_events_assigned_to_member_id on public.schedule_events (assigned_to_member_id);
create index if not exists idx_schedule_events_created_by on public.schedule_events (created_by);
create index if not exists idx_timesheets_created_by on public.timesheets (created_by);
create index if not exists idx_timesheets_team_member_id on public.timesheets (team_member_id);
create index if not exists idx_variations_profile_id on public.variations (profile_id);
create index if not exists idx_variations_quote_id on public.variations (quote_id);

-- Drop exact-duplicate indexes flagged by the advisor (same columns, different
-- names, pure write/storage overhead with zero benefit).
drop index if exists public.business_suppliers_ingestion_email_idx;
drop index if exists public.idx_job_tasks_profile;
drop index if exists public.idx_job_tasks_quote;
