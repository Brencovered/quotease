-- Fix auth_rls_initplan performance lint: wrap auth.uid()/auth.jwt()/auth.role()
-- calls in (select ...) so Postgres evaluates them once per query (via InitPlan)
-- instead of once per row. No semantic change, same access rules, just faster
-- at scale. Also consolidates one exact-duplicate policy on communication_templates
-- which was also flagged under multiple_permissive_policies.

-- admin_impersonation_log
alter policy "Admin only" on public.admin_impersonation_log
  using (((select auth.jwt()) ->> 'role'::text) = 'admin'::text);

alter policy "Authenticated read own" on public.admin_impersonation_log
  using ((select auth.uid()) = target_profile_id);

alter policy "Service role full access" on public.admin_impersonation_log
  using ((select auth.role()) = 'service_role'::text);

-- ai_drawing_analyses
alter policy "Team can manage own business analyses" on public.ai_drawing_analyses
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- business_suppliers
alter policy "Business suppliers" on public.business_suppliers
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- calendar_events
alter policy "Business calendar events" on public.calendar_events
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- client_plans
alter policy "Business client plans" on public.client_plans
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- clients
alter policy "Business clients" on public.clients
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- communication_log
alter policy "Own comms log" on public.communication_log
  using ((select auth.uid()) = profile_id);

-- communication_templates: "Own comms templates" and "Owner can manage templates"
-- were byte-for-byte identical policies (both ALL, same qual). Drop the duplicate
-- and fix initplan on the one we keep. This also clears the corresponding
-- multiple_permissive_policies lint for this table.
drop policy if exists "Owner can manage templates" on public.communication_templates;

alter policy "Own comms templates" on public.communication_templates
  using ((select auth.uid()) = profile_id);

-- compliance_certs
alter policy "Business compliance certs" on public.compliance_certs
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- follow_up_log
alter policy "Business follow up log" on public.follow_up_log
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- homeowner_profiles
alter policy "Own homeowner profile" on public.homeowner_profiles
  using ((select auth.uid()) = id);

-- invoice_counters
alter policy "Business invoice counter" on public.invoice_counters
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_actuals
alter policy "Business job actuals" on public.job_actuals
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_attachments
alter policy "Business job attachments" on public.job_attachments
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_board_columns
alter policy "Business job board columns" on public.job_board_columns
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_claims
alter policy "Business job claims" on public.job_claims
  using (tradie_profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (tradie_profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_counters
alter policy "Business job counters" on public.job_counters
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_crew
alter policy "Business job crew" on public.job_crew
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_line_items
alter policy "Business job line items" on public.job_line_items
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_packages
alter policy "Business job packages" on public.job_packages
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_requests
alter policy "Own job requests" on public.job_requests
  using ((select auth.uid()) = homeowner_id);

-- job_size_tiers
alter policy "Business job size tiers" on public.job_size_tiers
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- job_tasks
alter policy "Business job tasks" on public.job_tasks
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- jobs
alter policy "Business jobs" on public.jobs
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- lead_subscriptions
alter policy "Business lead subscriptions" on public.lead_subscriptions
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- material_bundle_items
alter policy "Business material bundle items" on public.material_bundle_items
  using (exists (
    select 1 from material_bundles b
    where b.id = material_bundle_items.bundle_id
      and b.profile_id in (select accessible_business_ids((select auth.uid())))
  ))
  with check (exists (
    select 1 from material_bundles b
    where b.id = material_bundle_items.bundle_id
      and b.profile_id in (select accessible_business_ids((select auth.uid())))
  ));

-- material_bundles
alter policy "Business material bundles" on public.material_bundles
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- material_items
alter policy "Business materials" on public.material_items
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- onboarding_state
alter policy "Business onboarding state" on public.onboarding_state
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- package_items
alter policy "Business package items" on public.package_items
  using (exists (
    select 1 from packages p
    where p.id = package_items.package_id
      and p.profile_id in (select accessible_business_ids((select auth.uid())))
  ))
  with check (exists (
    select 1 from packages p
    where p.id = package_items.package_id
      and p.profile_id in (select accessible_business_ids((select auth.uid())))
  ));

-- packages
alter policy "Business packages" on public.packages
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- payments
alter policy "Business payments" on public.payments
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- price_book_items
alter policy "Business price book items" on public.price_book_items
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- pricing_tiers
alter policy "Business pricing tiers" on public.pricing_tiers
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- profiles
alter policy "Own profile" on public.profiles
  using ((select auth.uid()) = id);

alter policy "Team members can view their business owner's profile" on public.profiles
  using (id in (select accessible_business_ids((select auth.uid()))));

-- push_subscriptions
alter policy "Own push subscriptions" on public.push_subscriptions
  using (user_id = (select auth.uid()));

-- quotes
alter policy "Business quotes" on public.quotes
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- schedule_events
alter policy "Business schedule events" on public.schedule_events
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- seo_keywords
alter policy "seo_keywords_write_authenticated" on public.seo_keywords
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- site_condition_templates
alter policy "Business site condition templates" on public.site_condition_templates
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- supplier_price_imports
alter policy "Business supplier imports" on public.supplier_price_imports
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- team_invites
alter policy "Owner can manage invites" on public.team_invites
  using ((select auth.uid()) = profile_id);

-- team_members
alter policy "Admin manages team" on public.team_members
  using (is_active_team_admin((select auth.uid()), owner_profile_id))
  with check (is_active_team_admin((select auth.uid()), owner_profile_id));

alter policy "Member sees own membership" on public.team_members
  using ((select auth.uid()) = member_user_id);

alter policy "Owner manages team" on public.team_members
  using ((select auth.uid()) = owner_profile_id);

-- timesheets
alter policy "Admin manages timesheets" on public.timesheets
  using (is_business_admin((select auth.uid()), profile_id));

-- tradie_directory_settings
alter policy "Business directory settings" on public.tradie_directory_settings
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- variations
alter policy "Business variations" on public.variations
  using (profile_id in (select accessible_business_ids((select auth.uid()))));

-- xero_contact_mappings
alter policy "Business xero mappings" on public.xero_contact_mappings
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));
