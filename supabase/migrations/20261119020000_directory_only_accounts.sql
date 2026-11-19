-- Applied via Supabase apply_migration on 2026-11-19. Committed to keep
-- migration history in sync with the database.
--
-- Claiming a directory listing no longer makes a SwiftScope (platform)
-- account. The login still exists, because it is how the tradie edits
-- their listing, but the profile is marked account_type = 'directory' and
-- middleware keeps it out of the app (dashboard, onboarding, billing),
-- sending it to /directory/manage instead. A directory account can opt
-- in to the platform later (POST /api/billing/start-trial), which flips
-- it to 'platform' and starts the 7-day trial.
alter table public.profiles
  add column if not exists account_type text not null default 'platform'
  check (account_type in ('platform', 'directory'));

comment on column public.profiles.account_type is
  'platform: a SwiftScope app account. directory: a login only for editing a claimed directory listing; no app access, no trial.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, business_name, contact_email, trial_ends_at, trades, suburb, onboarded_at, account_type)
  values (
    new.id,
    new.raw_user_meta_data->>'business_name',
    new.email,
    case
      when new.raw_user_meta_data->>'signup_source' in ('directory_claim', 'team_invite') then null
      else now() + interval '7 days'
    end,
    case
      when new.raw_user_meta_data->>'trade' is not null and new.raw_user_meta_data->>'trade' <> ''
        then array[new.raw_user_meta_data->>'trade']
      else '{}'::text[]
    end,
    new.raw_user_meta_data->>'suburb',
    -- Team invitees never run owner onboarding; membership is the real access path.
    case
      when new.raw_user_meta_data->>'signup_source' = 'team_invite' then now()
      else null
    end,
    case
      when new.raw_user_meta_data->>'signup_source' = 'directory_claim' then 'directory'
      else 'platform'
    end
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$function$;

-- Existing accounts that only ever came in through a listing claim.
-- Never touches anyone subscribed, comped, on a team, or with a quote.
-- 1. Email claims: signup_source = directory_claim (whether or not the
--    claim went on to link a listing).
update public.profiles p
set account_type = 'directory'
from auth.users u
where u.id = p.id
  and p.deleted_at is null
  and p.account_type = 'platform'
  and u.raw_user_meta_data->>'signup_source' = 'directory_claim'
  and coalesce(p.subscription_status, 'none') = 'none'
  and coalesce(p.comp_access, false) = false
  and not exists (select 1 from public.team_members t where t.member_user_id = p.id or t.owner_profile_id = p.id)
  and not exists (select 1 from public.quotes q where q.profile_id = p.id);

-- 2. Google claims: the directory auth callback nulled their trial, and
--    they are linked to a listing.
update public.profiles p
set account_type = 'directory'
from auth.users u
where u.id = p.id
  and p.deleted_at is null
  and p.account_type = 'platform'
  and u.raw_app_meta_data->>'provider' = 'google'
  and p.trial_ends_at is null
  and coalesce(p.subscription_status, 'none') = 'none'
  and coalesce(p.comp_access, false) = false
  and not exists (select 1 from public.team_members t where t.member_user_id = p.id or t.owner_profile_id = p.id)
  and not exists (select 1 from public.quotes q where q.profile_id = p.id)
  and exists (select 1 from public.directory_listing d where d.profile_id = p.id or d.claim_pending_profile_id = p.id);
