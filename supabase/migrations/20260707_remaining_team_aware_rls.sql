-- Applied directly via Supabase MCP; committed here for traceability.
--
-- Same legacy gap as packages/package_items (see
-- 20260707_packages_team_aware_rls.sql): these tables predate team
-- support and were never migrated to accessible_business_ids(). Each is
-- a genuinely shared business resource (scheduling, invoice numbering,
-- Xero mappings, directory settings) that a team member should be able
-- to read/write for the business they work for, not just the literal
-- owner.
--
-- job_tasks already had a correct team-aware policy alongside the
-- stale one - this just drops the redundant legacy policy there for
-- cleanliness, it was not a live bug.
--
-- Deliberately NOT touched: team_invites (inviting members may be
-- intentionally owner-only - a permissions judgment call, not a clear
-- bug) and communication_log/communication_templates (the Comms
-- section was removed entirely; communication_templates isn't
-- referenced by any code path, and communication_log is only touched
-- by account-deletion cleanup - not worth changing for a feature with
-- no UI left).

drop policy if exists "Owner can manage tasks" on job_tasks;

drop policy if exists "Users can manage their own calendar events" on calendar_events;
create policy "Business calendar events" on calendar_events
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));

drop policy if exists "Own invoice counter" on invoice_counters;
create policy "Business invoice counter" on invoice_counters
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));

drop policy if exists "Own xero mappings" on xero_contact_mappings;
create policy "Business xero mappings" on xero_contact_mappings
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));

drop policy if exists "Own directory settings" on tradie_directory_settings;
create policy "Business directory settings" on tradie_directory_settings
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
