-- Applied via Supabase apply_migration on 2026-08-12. Committed to keep
-- migration history in sync with the database.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, business_name, contact_email, trial_ends_at, trades, suburb)
  values (
    new.id,
    new.raw_user_meta_data->>'business_name',
    new.email,
    case
      when new.raw_user_meta_data->>'signup_source' = 'directory_claim' then null
      else now() + interval '7 days'
    end,
    case
      when new.raw_user_meta_data->>'trade' is not null and new.raw_user_meta_data->>'trade' <> ''
        then array[new.raw_user_meta_data->>'trade']
      else '{}'::text[]
    end,
    new.raw_user_meta_data->>'suburb'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

comment on function public.handle_new_user is
  'Creates a profiles row on signup. Skips starting a 7-day platform trial when raw_user_meta_data.signup_source = directory_claim -- that path is listing-only and must never grant platform access. Directory signups have to go through real /onboarding like anyone else.';
