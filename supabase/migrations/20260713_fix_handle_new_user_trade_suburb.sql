-- Real bug found while investigating why a test signup ("Test Chippy")
-- had an empty trades array despite selecting a trade at signup.
--
-- Root cause: app/signup/page.tsx passes trade/suburb/business_name into
-- auth.signUp()'s options.data (raw_user_meta_data), then ALSO tries to
-- write them to profiles directly via a client-side .update() call --
-- but only `if (data.session)` is truthy. Supabase only returns an
-- active session immediately when email confirmation is disabled; when
-- it's required (the normal case -- this project does show a "check
-- your email" step), signUp() returns no session, the client-side
-- update never runs, and this trigger was the only other place profiles
-- got created from that metadata -- but it only copied business_name,
-- never trades or suburb. Every email-confirmed signup has been landing
-- with trades: [] (defaulting to "electrician" everywhere that reads
-- trades[0] with a fallback) and no suburb, regardless of what the
-- person actually selected.
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
    now() + interval '7 days',
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

-- Backfill accounts caught by this bug before the fix -- their real
-- trade/suburb selections are still sitting in auth.users.raw_user_meta_data,
-- just never made it into profiles. Only fills suburb where still null
-- (some had already set it themselves via the onboarding wizard's
-- separate suburb field, unaffected by this bug -- don't overwrite with
-- stale signup-time data).
update profiles p
set trades = array[u.raw_user_meta_data->>'trade']
from auth.users u
where u.id = p.id
  and array_length(p.trades, 1) is null
  and u.raw_user_meta_data->>'trade' is not null
  and u.raw_user_meta_data->>'trade' <> '';

update profiles p
set suburb = u.raw_user_meta_data->>'suburb'
from auth.users u
where u.id = p.id
  and p.suburb is null
  and u.raw_user_meta_data->>'suburb' is not null
  and u.raw_user_meta_data->>'suburb' <> '';
