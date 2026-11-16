-- Lock the public tables that were readable with the anon key.
--
-- Production had RLS off on exactly these five:
--   abn_ingest_cursor
--   abn_trade_candidates
--   directory_listing_traffic_daily
--   directory_scrape_coverage
--   signup_attempts
--
-- Every current reader uses the service role (createAdminClient), which
-- bypasses RLS:
--   app/api/admin/abn-directory, app/admin/overview (candidates, cursor)
--   scripts/abn-directory-pipeline, lib/abnBulkIngest, lib/abnDirectoryEnrichment
--   scripts/merge-directory-duplicates (candidates and traffic)
--   components/DirectoryTrafficData, lib/directoryTrafficSync (traffic)
--   lib/directoryExpansionSweep, app/api/admin/expand-directory (coverage)
--   app/api/account/log-signup-ip, app/auth/callback, app/admin/claim-audit (signups)
--
-- Anon loses access. Authenticated admins (public.is_admin()) keep access.
-- No rows are deleted. signup_attempts and the directory tables are created
-- outside this migration on a fresh bootstrap; missing tables are skipped
-- and prod_schema_backfill.sql repeats the lock after is_admin() exists.

do $$
declare
  tbl text;
  tables text[] := array[
    'abn_ingest_cursor',
    'abn_trade_candidates',
    'directory_listing_traffic_daily',
    'directory_scrape_coverage',
    'signup_attempts'
  ];
begin
  foreach tbl in array tables loop
    if to_regclass('public.' || tbl) is null then
      raise notice '% does not exist yet; RLS skipped', tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from anon', tbl);

    if to_regprocedure('public.is_admin()') is null then
      raise notice 'public.is_admin() is missing; % has RLS on and no anon access. The admin policy is applied once is_admin() exists.', tbl;
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_admin_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      tbl || '_admin_all',
      tbl
    );
  end loop;
end $$;
