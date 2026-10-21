-- Unique protection for directory listings.
--
-- A single global unique phone or domain would delete real multi-suburb
-- service-area pages (one brand, one number, many suburbs). Uniqueness is
-- therefore per suburb.
--
-- 13 / 1300 / 1800 / 1900 numbers are shared call centres and are not indexed.
-- Apply scripts/merge-directory-duplicates.ts --apply BEFORE this file.
-- The script merges same-name duplicates and, for different businesses that
-- share a phone or domain in one suburb, clears the normalised key on the
-- extra rows (the visible phone and website stay). It will not touch a
-- group with two claimed profiles. If any such group remains, this
-- migration stops with an error instead of deleting data.
--
-- Does nothing when directory_listing has not been created yet (fresh
-- bootstrap). prod_schema_backfill creates the same indexes on an empty table.

do $$
declare
  phone_dupes int;
  domain_dupes int;
  abn_dupes int;
begin
  if to_regclass('public.directory_listing') is null then
    raise notice 'directory_listing does not exist yet; unique indexes skipped';
    return;
  end if;

  select count(*) into phone_dupes from (
    select 1
    from public.directory_listing
    where phone_e164 is not null
      and suburb is not null
      and btrim(suburb) <> ''
      and phone_e164 !~ '^\+6113[0-9]{4}$'
      and phone_e164 !~ '^\+611(300|800|900)[0-9]{6}$'
    group by phone_e164, lower(btrim(suburb))
    having count(*) > 1
  ) s;

  select count(*) into domain_dupes from (
    select 1
    from public.directory_listing
    where website_domain is not null
      and suburb is not null
      and btrim(suburb) <> ''
    group by website_domain, lower(btrim(suburb))
    having count(*) > 1
  ) s;

  select count(*) into abn_dupes from (
    select 1
    from public.directory_listing
    where abn is not null
      and suburb is not null
      and btrim(suburb) <> ''
    group by abn, lower(btrim(suburb))
    having count(*) > 1
  ) s;

  if phone_dupes > 0 or domain_dupes > 0 or abn_dupes > 0 then
    raise exception
      'directory_listing still has duplicate identity groups (phone %, domain %, abn %). Run `npx tsx scripts/merge-directory-duplicates.ts` (dry-run), review it, then `npx tsx scripts/merge-directory-duplicates.ts --apply` before this migration. Groups with two claimed profiles are left for you to resolve.',
      phone_dupes, domain_dupes, abn_dupes;
  end if;

  create unique index if not exists directory_listing_phone_suburb_uidx
    on public.directory_listing (phone_e164, lower(btrim(suburb)))
    where phone_e164 is not null
      and suburb is not null
      and btrim(suburb) <> ''
      and phone_e164 !~ '^\+6113[0-9]{4}$'
      and phone_e164 !~ '^\+611(300|800|900)[0-9]{6}$';

  create unique index if not exists directory_listing_domain_suburb_uidx
    on public.directory_listing (website_domain, lower(btrim(suburb)))
    where website_domain is not null
      and suburb is not null
      and btrim(suburb) <> '' ;

  create unique index if not exists directory_listing_abn_suburb_uidx
    on public.directory_listing (abn, lower(btrim(suburb)))
    where abn is not null
      and suburb is not null
      and btrim(suburb) <> '' ;
end $$;
