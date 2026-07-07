-- Applied directly via Supabase MCP; committed here for traceability.
--
-- packages/package_items RLS predated team support and was never
-- updated to use accessible_business_ids() like the rest of the schema
-- (jobs, quotes, materials, etc. all already use this pattern). A team
-- member's auth.uid() never equals the business owner's profile_id, so
-- this silently blocked team members from creating/editing/deleting
-- packages for the business they work for - discovered live-testing
-- the site as a team-member account (see also the MaterialsPanel.tsx
-- businessId fix in the same session).

drop policy if exists "Owner can manage packages" on packages;
create policy "Business packages" on packages
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));

drop policy if exists "Owner can manage package items" on package_items;
create policy "Business package items" on package_items
  for all
  using (exists (select 1 from packages p where p.id = package_items.package_id and p.profile_id in (select accessible_business_ids(auth.uid()))))
  with check (exists (select 1 from packages p where p.id = package_items.package_id and p.profile_id in (select accessible_business_ids(auth.uid()))));
