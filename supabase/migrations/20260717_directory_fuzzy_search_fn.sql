-- Fuzzy business-name search for the claim/signup lookup flow.
-- Exposed as an RPC since PostgREST can't order by similarity() through
-- the normal query builder. Only searches unclaimed listings -- a
-- claimed listing should never surface as "is this you?" for someone
-- else's signup.
create or replace function search_directory_listings_fuzzy(
  p_name text,
  p_trade text default null,
  p_suburb text default null,
  p_limit int default 5
)
returns table (
  id uuid,
  business_name text,
  suburb text,
  postcode text,
  trades text[],
  is_claimed boolean,
  google_rating numeric,
  google_reviews_count integer,
  logo_url text,
  similarity real
)
language sql
stable
as $$
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
  order by similarity desc
  limit p_limit;
$$;

comment on function search_directory_listings_fuzzy is 'Fuzzy match against unclaimed directory_listing rows for the claim/signup lookup flow. Narrowed by trade and suburb alongside name similarity since business names alone are too noisy (e.g. "Mike''s Plumbing" exists in every suburb).';
