-- Team invitees get a stub profile with no trial; access comes from team_members.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, business_name, contact_email, trial_ends_at, trades, suburb, onboarded_at)
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
    end
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
  'Creates a profiles row on signup. Skips trial for directory_claim and team_invite. Team invitees are marked onboarded so they never enter owner onboarding — they join via team_members.';
