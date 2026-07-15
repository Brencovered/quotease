-- Resolves the pretty directory listing slug's trailing UID suffix
-- (last 6 hex chars of the row's real UUID, hyphens stripped - see
-- buildDirectorySlug in lib/seo/meta.ts) back to the actual row.
--
-- Needed because PostgREST/Supabase-js can't apply a LIKE/ILIKE filter
-- directly to a uuid column without an explicit cast, which is why this
-- couldn't just be a .ilike() filter from the app. security invoker +
-- explicit search_path since this reads a publicly-readable table
-- (directory_listing already has a public SELECT policy) - no elevated
-- privileges needed.
--
-- Returns up to 2 rows so the caller (app/directory/[slug]/page.tsx) can
-- detect the astronomically unlikely case of a suffix collision and fall
-- back to notFound() rather than silently serving the wrong business.

create or replace function public.resolve_directory_listing_by_uid_suffix(p_suffix text)
returns setof directory_listing
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from directory_listing
  where right(replace(id::text, '-', ''), 6) = lower(p_suffix)
  limit 2;
$$;
