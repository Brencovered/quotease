-- Launch security audit fixes, 2026-07-13.
-- Applied live via Supabase MCP; recorded here for traceability.

-- 1. blog_posts: was "true" for ALL authenticated users, meaning any
--    signed-up tradie customer could create/edit/delete posts on the
--    public marketing blog. Restrict writes to admin accounts
--    (profiles.subscription_status = 'admin', via is_admin()).
drop policy if exists "Allow authenticated full access" on public.blog_posts;

create policy "Admin full access"
  on public.blog_posts
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Public read access"
  on public.blog_posts
  for select
  to anon, authenticated
  using (true);

-- 2. directory_enquiries: "Allow authenticated read" let ANY signed-up
--    tradie read every homeowner's name/email/phone/job description
--    across the whole platform (no owner/business_id column scopes rows
--    to a specific tradie). Restrict reads to admin only; the app never
--    reads this table today outside of admin tooling.
drop policy if exists "Allow authenticated read" on public.directory_enquiries;

create policy "Admin read access"
  on public.directory_enquiries
  for select
  to authenticated
  using (public.is_admin());

-- 3. upsert_directory_listing: SECURITY DEFINER with no internal auth
--    check (unlike set_member_hourly_rate, which checks is_business_admin()
--    itself). Only ever called from app/api/admin/scrape/route.ts via the
--    service-role client. PostgREST was exposing it to anon/authenticated
--    (and PUBLIC, Postgres's default grant on function creation), letting
--    anyone call /rest/v1/rpc/upsert_directory_listing directly to inject
--    or overwrite arbitrary public directory listings -- i.e. hijack where
--    a business's leads go by overwriting its contact email/phone/website.
revoke execute on function public.upsert_directory_listing(
  text, text[], text, text, text, double precision, double precision,
  text, numeric, integer, text[], text, text, text
) from public;

grant execute on function public.upsert_directory_listing(
  text, text[], text, text, text, double precision, double precision,
  text, numeric, integer, text[], text, text, text
) to service_role, postgres;

-- Note: set_member_hourly_rate, is_admin, is_business_admin,
-- is_active_team_admin, accessible_business_ids, and assign_job_number
-- were also flagged by the advisor as anon/authenticated-executable
-- SECURITY DEFINER functions, but each performs its own internal
-- auth.uid()-based authorization check (or is a pure read-only helper
-- with no side effects), so no change was needed there.
--
-- directory_public's SECURITY DEFINER property was also flagged, but the
-- view only exposes fields already meant to be public (business name,
-- trades, suburb, postcode, coordinates, claimed status, logo) -- no PII.
-- SECURITY DEFINER is what lets it join profiles (RLS-locked) for anon
-- directory browsing; left as-is.
