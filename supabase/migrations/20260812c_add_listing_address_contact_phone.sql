-- Applied via Supabase apply_migration on 2026-08-12. Committed to keep
-- migration history in sync with the database.
alter table public.directory_listing
  add column if not exists street_address text,
  add column if not exists contact_phone  text;

comment on column public.directory_listing.street_address is
  'Business address entered by the owner at listing creation.';
comment on column public.directory_listing.contact_phone is
  'Contact phone entered by the owner, shown on the public listing page via click-to-reveal.';

create or replace function public.check_listing_has_real_identity()
returns trigger
language plpgsql
as $$
begin
  if new.business_name is null or trim(new.business_name) = '' then
    raise exception 'business_name is required to create a directory listing';
  end if;
  if new.suburb is not null and trim(new.suburb) ~* '^(melbourne|sydney|brisbane|perth|adelaide|canberra|hobart|darwin)$' then
    raise exception 'suburb must be a real suburb, not just the city name (got: %)', new.suburb;
  end if;
  if new.source = 'manual' and (new.contact_phone is null or trim(new.contact_phone) = '') then
    raise exception 'contact_phone is required to create a directory listing';
  end if;
  return new;
end;
$$;
