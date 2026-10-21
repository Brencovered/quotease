-- Directory listing identity columns.
--
-- Adds normalised phone (E.164), website domain, ABN, and verification
-- fields. Backfills them. Relabels source='scraper' to google_places:
-- every one of those rows was written by the Google Places scraper and
-- already has a place_id.
--
-- This migration does not delete or merge rows. Unique indexes are in
-- 20261021130000_directory_listing_unique_identity.sql and are applied
-- only after scripts/merge-directory-duplicates.ts --apply.
--
-- On a fresh bootstrap this file runs before prod_schema_backfill creates
-- directory_listing. The functions are created either way. Column changes
-- no-op until the table exists; the backfill file repeats them.

create or replace function public.normalize_au_phone(raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  digits text;
  national text;
begin
  -- Mirrors lib/directoryIdentity.ts (libphonenumber-js, country AU) for
  -- the numbers the directory actually stores: mobiles, geographic,
  -- 13/1300/1800/1900, with or without a leading 0, +61, or 0011.
  if raw is null or btrim(raw) = '' then
    return null;
  end if;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  if digits = '' then
    return null;
  end if;
  if digits like '0011%' then
    digits := substr(digits, 5);
  end if;
  if digits like '61%' and length(digits) >= 10 then
    national := substr(digits, 3);
  elsif digits like '0%' then
    national := substr(digits, 2);
  else
    national := digits;
  end if;

  if national ~ '^4[0-9]{8}$' or national ~ '^[2378][0-9]{8}$' then
    return '+61' || national;
  end if;
  if national ~ '^1[389]00[0-9]{6}$' or national ~ '^13[0-9]{4}$' then
    return '+61' || national;
  end if;
  return null;
end;
$$;

create or replace function public.normalize_website_domain(raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned text;
  host text;
  shared text[] := array[
    'facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'youtu.be',
    'tiktok.com', 'twitter.com', 'x.com', 'google.com', 'google.com.au', 'goo.gl',
    'yellowpages.com.au', 'hipages.com.au', 'truelocal.com.au', 'hotfrog.com.au',
    'startlocal.com.au', 'linktr.ee', 'linktree.com', 'bit.ly', 'tinyurl.com',
    'reece.com.au', 'beaumont-tiles.com.au', 'actrol.com.au', 'holcim.com.au',
    'tradehq.com.au', 'servicetoday.com.au'
  ];
  item text;
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;
  cleaned := btrim(raw);
  if cleaned !~* '^https?://' then
    cleaned := 'https://' || cleaned;
  end if;
  host := substring(cleaned from '://([^/?#]+)');
  if host is null then
    return null;
  end if;
  host := lower(host);
  if position('@' in host) > 0 then
    host := split_part(host, '@', 2);
  end if;
  host := split_part(host, ':', 1);
  host := regexp_replace(host, '\.$', '');
  if host like 'www.%' then
    host := substr(host, 5);
  end if;
  if host = '' or position('.' in host) = 0 then
    return null;
  end if;
  foreach item in array shared loop
    if host = item or host like '%.' || item then
      return null;
    end if;
  end loop;
  return host;
end;
$$;

create table if not exists public.directory_listing_merge_log (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid,
  loser_id uuid,
  match_reason text not null,
  loser_snapshot jsonb not null,
  merged_at timestamptz not null default now()
);

alter table public.directory_listing_merge_log enable row level security;
revoke all on public.directory_listing_merge_log from public, anon, authenticated;

do $$
begin
  if to_regclass('public.directory_listing') is null then
    raise notice 'directory_listing does not exist yet; column backfill is skipped';
    return;
  end if;

  alter table public.directory_listing add column if not exists phone_e164 text;
  alter table public.directory_listing add column if not exists website_domain text;
  alter table public.directory_listing add column if not exists abn text;
  alter table public.directory_listing add column if not exists verified_at timestamptz;
  alter table public.directory_listing add column if not exists verification_source text;
  alter table public.directory_listing add column if not exists email_valid boolean;
  alter table public.directory_listing add column if not exists phone_identity_shared boolean not null default false;
  alter table public.directory_listing add column if not exists domain_identity_shared boolean not null default false;

  comment on column public.directory_listing.phone_e164 is 'Australian phone in E.164 (+61…). Null when missing, invalid, a shared 13/1300/1800/1900 kept only as text, or phone_identity_shared.';
  comment on column public.directory_listing.website_domain is 'Hostname of the business website, www stripped, lowercased. Null for social, directory, and supplier hosts.';
  comment on column public.directory_listing.abn is '11-digit ABN, no spaces.';
  comment on column public.directory_listing.verified_at is 'When ABN Lookup and/or MX lookup last completed. Null means due, including anything older than 90 days.';
  comment on column public.directory_listing.verification_source is 'Comma-separated results such as mx:valid,abn_lookup:active. MX lookup never sends email.';
  comment on column public.directory_listing.email_valid is 'True when the outreach address has an MX record. False when it does not. Null when unchecked or DNS was inconclusive.';
  comment on column public.directory_listing.phone_identity_shared is 'True when this row must not own the normalised phone key because a different business in the same suburb already does. The displayed phone is kept.';
  comment on column public.directory_listing.domain_identity_shared is 'True when this row must not own the normalised domain key. website_url is kept.';

  update public.directory_listing
  set phone_e164 = coalesce(public.normalize_au_phone(contact_phone), public.normalize_au_phone(scraped_contact_phone)),
      website_domain = public.normalize_website_domain(website_url)
  where phone_e164 is null or website_domain is null;

  update public.directory_listing
  set source = 'google_places'
  where source = 'scraper';
end $$;

create or replace function public.directory_listing_set_normalized_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.phone_identity_shared then
    new.phone_e164 := null;
  else
    new.phone_e164 := coalesce(
      public.normalize_au_phone(new.contact_phone),
      public.normalize_au_phone(new.scraped_contact_phone)
    );
  end if;

  if new.domain_identity_shared or new.website_url is null or btrim(new.website_url) = '' then
    new.website_domain := null;
  else
    new.website_domain := public.normalize_website_domain(new.website_url);
  end if;

  if new.abn is not null then
    new.abn := regexp_replace(new.abn, '\s+', '', 'g');
    if new.abn !~ '^[0-9]{11}$' then
      new.abn := null;
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.directory_listing') is null then
    return;
  end if;

  alter table public.directory_listing drop constraint if exists directory_listing_phone_e164_check;
  alter table public.directory_listing
    add constraint directory_listing_phone_e164_check
    check (phone_e164 is null or phone_e164 ~ '^\+61[0-9]{6,15}$');

  alter table public.directory_listing drop constraint if exists directory_listing_abn_format_check;
  alter table public.directory_listing
    add constraint directory_listing_abn_format_check
    check (abn is null or abn ~ '^[0-9]{11}$');

  alter table public.directory_listing drop constraint if exists directory_listing_website_domain_check;
  alter table public.directory_listing
    add constraint directory_listing_website_domain_check
    check (website_domain is null or website_domain ~ '^[a-z0-9.-]+\.[a-z0-9-]{2,}$');

  drop trigger if exists trg_directory_listing_normalized_identity on public.directory_listing;
  create trigger trg_directory_listing_normalized_identity
    before insert or update on public.directory_listing
    for each row execute function public.directory_listing_set_normalized_identity();

  create index if not exists directory_listing_phone_e164_idx
    on public.directory_listing (phone_e164)
    where phone_e164 is not null;

  create index if not exists directory_listing_website_domain_idx
    on public.directory_listing (website_domain)
    where website_domain is not null;

  create index if not exists directory_listing_abn_idx
    on public.directory_listing (abn)
    where abn is not null;

  create index if not exists directory_listing_verification_due_idx
    on public.directory_listing (verified_at)
    where abn is not null
       or private_email is not null
       or scraped_contact_email is not null;
end $$;

-- The Places scraper used to stamp source='scraper'. New writes set
-- google_places in the app. Keep the RPC aligned for any caller still on it.
create or replace function public.upsert_directory_listing(
  p_business_name text, p_trades text[], p_website_url text, p_suburb text, p_postcode text,
  p_latitude double precision, p_longitude double precision, p_place_id text,
  p_google_rating numeric, p_google_reviews_count integer, p_photo_references text[],
  p_scraped_contact_phone text, p_private_email text, p_logo_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.directory_listing (
    business_name, trades, website_url, suburb, postcode,
    latitude, longitude, place_id, google_rating, google_reviews_count,
    photo_references, scraped_contact_phone, private_email, logo_url, source
  ) values (
    p_business_name, p_trades, p_website_url, p_suburb, p_postcode,
    p_latitude, p_longitude, p_place_id, p_google_rating, p_google_reviews_count,
    p_photo_references, p_scraped_contact_phone, p_private_email, p_logo_url, 'google_places'
  )
  on conflict on constraint directory_listing_place_id_unique do update set
    business_name = excluded.business_name,
    trades = (select array_agg(distinct t) from unnest(directory_listing.trades || excluded.trades) as t),
    website_url = coalesce(excluded.website_url, directory_listing.website_url),
    suburb = excluded.suburb,
    postcode = excluded.postcode,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    google_rating = excluded.google_rating,
    google_reviews_count = excluded.google_reviews_count,
    photo_references = excluded.photo_references,
    scraped_contact_phone = coalesce(excluded.scraped_contact_phone, directory_listing.scraped_contact_phone),
    private_email = coalesce(excluded.private_email, directory_listing.private_email),
    logo_url = coalesce(excluded.logo_url, directory_listing.logo_url),
    source = case
      when directory_listing.source in ('scraper', 'scraped') then 'google_places'
      else directory_listing.source
    end,
    updated_at = now();
end;
$$;

revoke execute on function public.upsert_directory_listing(
  text, text[], text, text, text, double precision, double precision,
  text, numeric, integer, text[], text, text, text
) from public, anon, authenticated;

grant execute on function public.upsert_directory_listing(
  text, text[], text, text, text, double precision, double precision,
  text, numeric, integer, text[], text, text, text
) to service_role, postgres;
