-- Adds an optional postcode filter to the fuzzy business-name search, on
-- top of the existing trade/suburb narrowing. Suburb names alone can be
-- ambiguous across states (e.g. "Richmond" exists in both VIC and NSW) --
-- postcode disambiguates when the tradie provides one.
--
-- Postgres treats a changed parameter list as a new overload rather than a
-- true replace, which becomes ambiguous against the old 4-arg signature --
-- drop it explicitly first.
drop function if exists search_directory_listings_fuzzy(text, text, text, int);

create or replace function search_directory_listings_fuzzy(
  p_name text,
  p_trade text default null,
  p_suburb text default null,
  p_postcode text default null,
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
    and (p_postcode is null or dl.postcode = p_postcode)
  order by similarity desc
  limit p_limit;
$$;

comment on function search_directory_listings_fuzzy is 'Fuzzy match against unclaimed directory_listing rows for the claim/signup lookup flow. Narrowed by trade, suburb, and optionally postcode since business names and suburb names alone are too noisy (e.g. "Mike''s Plumbing" exists in every suburb, "Richmond" exists in multiple states).';
