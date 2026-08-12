-- Applied via Supabase apply_migration on 2026-08-12. Committed to keep
-- migration history in sync with the database.
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
  return new;
end;
$$;

drop trigger if exists trg_listing_has_real_identity on public.directory_listing;
create trigger trg_listing_has_real_identity
  before insert or update of business_name, suburb on public.directory_listing
  for each row
  execute function public.check_listing_has_real_identity();

create table if not exists public.listing_creation_attempts (
  id          uuid primary key default gen_random_uuid(),
  ip_address  inet not null,
  profile_id  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists listing_creation_attempts_ip_time_idx
  on public.listing_creation_attempts (ip_address, created_at desc);
alter table public.listing_creation_attempts enable row level security;
create policy "Admin full access to listing_creation_attempts"
  on public.listing_creation_attempts for all
  using (is_admin())
  with check (is_admin());

create or replace function public.check_profile_business_name_not_blank()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' and new.business_name is not null and trim(new.business_name) = '' then
    raise exception 'business_name cannot be an empty string; use null if genuinely unset';
  end if;
  if TG_OP = 'UPDATE' and old.business_name is not null and trim(old.business_name) <> ''
     and new.business_name is not null and trim(new.business_name) = '' then
    raise exception 'business_name cannot be cleared to blank once set';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_business_name_not_blank on public.profiles;
create trigger trg_profile_business_name_not_blank
  before insert or update of business_name on public.profiles
  for each row
  execute function public.check_profile_business_name_not_blank();
