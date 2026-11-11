-- The pretty-slug lookup returns every row sharing the trailing 6 hex
-- chars of the id, up to a small cap. The page then keeps the row whose
-- current canonical slug matches the request. A hard limit of 2 made a
-- suffix collision 404 both businesses, because the caller treated
-- "not exactly one row" as not found.

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
  limit 8;
$$;
