-- Three-tier team roles, replacing the flat admin/member binary, plus real
-- job-level access restriction (not just UI hiding) for restricted members.
--
-- Roles:
--   site_member - only sees jobs they're added to (via job_crew), can log
--                 dockets/variations, never sees any dollar figure
--   manager     - sees pricing everywhere, admin can optionally restrict
--                 them to only their allocated jobs (access_scope)
--   admin       - full, unrestricted access (this includes the owner,
--                 who isn't a team_members row at all - handled in code)
--
-- Existing 'member' rows become 'manager' (preserves their current level
-- of access - they could already see everything except Profit before this
-- migration, so demoting them to site_member without warning would be a
-- surprise regression, not a security fix).

alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add column if not exists access_scope text not null default 'all' check (access_scope in ('all', 'assigned_only'));

update public.team_members set role = 'manager' where role = 'member';

alter table public.team_members add constraint team_members_role_check check (role in ('site_member', 'manager', 'admin'));

comment on column public.team_members.role is 'site_member: job-scoped, never sees $. manager: sees pricing, admin can restrict via access_scope. admin: unrestricted.';
comment on column public.team_members.access_scope is 'Only meaningful for role=manager. site_member is always job-scoped regardless of this value; admin always unrestricted regardless of this value.';

-- Resolves the current caller's team_members row for a given business, if
-- any (null for the owner themselves, who isn't a team_members row).
create or replace function public.current_team_member(biz_id uuid)
returns public.team_members
language sql stable security definer set search_path = public
as $$
  select * from team_members
  where owner_profile_id = biz_id and member_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

-- True if the current caller's access to this business should be limited
-- to specific jobs (via job_crew) rather than the whole business.
create or replace function public.is_job_restricted(biz_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'site_member' or (role = 'manager' and access_scope = 'assigned_only')
     from team_members
     where owner_profile_id = biz_id and member_user_id = auth.uid() and status = 'active'
     limit 1),
    false
  );
$$;

-- Job ids the current caller is allowed to see, when restricted. Empty set
-- if not a restricted member of this business (the RLS policies below only
-- consult this when is_job_restricted() is true, so an empty result for an
-- unrestricted caller never matters).
create or replace function public.accessible_job_ids(biz_id uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select jc.job_id from job_crew jc
  join team_members tm on tm.id = jc.team_member_id
  where jc.profile_id = biz_id and tm.member_user_id = auth.uid() and tm.status = 'active';
$$;

-- Extend the existing "Business jobs"-style policies with the job-level
-- restriction. Additive: unrestricted callers (owner, admin, unrestricted
-- manager) are unaffected since is_job_restricted() is false for them.
drop policy if exists "Business jobs" on public.jobs;
create policy "Business jobs" on public.jobs
  for all
  using (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (not is_job_restricted(profile_id) or id in (select accessible_job_ids(profile_id)))
  )
  with check (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (not is_job_restricted(profile_id) or id in (select accessible_job_ids(profile_id)))
  );

drop policy if exists "Business dockets" on public.dockets;
create policy "Business dockets" on public.dockets
  for all
  using (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (not is_job_restricted(profile_id) or job_id in (select accessible_job_ids(profile_id)))
  )
  with check (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (not is_job_restricted(profile_id) or job_id in (select accessible_job_ids(profile_id)))
  );

drop policy if exists "Business docket items" on public.docket_items;
create policy "Business docket items" on public.docket_items
  for all
  using (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (
      not is_job_restricted(profile_id)
      or docket_id in (select id from dockets where job_id in (select accessible_job_ids(profile_id)))
    )
  )
  with check (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (
      not is_job_restricted(profile_id)
      or docket_id in (select id from dockets where job_id in (select accessible_job_ids(profile_id)))
    )
  );

drop policy if exists "Business variations" on public.variations;
create policy "Business variations" on public.variations
  for all
  using (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (not is_job_restricted(profile_id) or job_id in (select accessible_job_ids(profile_id)))
  )
  with check (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (not is_job_restricted(profile_id) or job_id in (select accessible_job_ids(profile_id)))
  );

-- quotes has no job_id of its own (it's the reverse: jobs.quote_id -> quotes.id),
-- so a restricted caller can only see a quote via a job they're crewed on that
-- references it. A quote with no job yet (still just sent, not accepted) is
-- invisible to a restricted caller - they only work on jobs they're added to,
-- not open quotes that haven't become one.
drop policy if exists "Business quotes" on public.quotes;
create policy "Business quotes" on public.quotes
  for all
  using (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (
      not is_job_restricted(profile_id)
      or exists (
        select 1 from jobs j
        where j.quote_id = quotes.id and j.id in (select accessible_job_ids(quotes.profile_id))
      )
    )
  )
  with check (
    profile_id in (select accessible_business_ids((select auth.uid())))
    and (
      not is_job_restricted(profile_id)
      or exists (
        select 1 from jobs j
        where j.quote_id = quotes.id and j.id in (select accessible_job_ids(quotes.profile_id))
      )
    )
  );
