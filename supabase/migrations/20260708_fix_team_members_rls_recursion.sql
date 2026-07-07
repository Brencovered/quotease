-- Applied directly via Supabase MCP (URGENT); committed here for
-- traceability.
--
-- The "Admin manages team" policy added earlier today (see
-- 20260707_remaining_team_aware_rls.sql's sibling commit) referenced
-- team_members from within its own RLS policy on team_members, and
-- since that subquery is itself subject to the same policy, Postgres
-- detected infinite recursion - every single query against
-- team_members started erroring with a 500, for every user, not just
-- admins. This broke getActiveBusinessId()/getTeamContext(), which run
-- on nearly every page load.
--
-- Fix: move the admin check into a SECURITY DEFINER function, the same
-- pattern already used by accessible_business_ids() for exactly this
-- reason - a security-definer function's internal query bypasses RLS
-- entirely, so it can safely query team_members without re-triggering
-- the policy that's checking it.

create or replace function public.is_active_team_admin(check_uid uuid, check_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where owner_profile_id = check_owner_id
      and member_user_id = check_uid
      and status = 'active'
      and role = 'admin'
  );
$$;

drop policy if exists "Admin manages team" on team_members;
create policy "Admin manages team"
  on team_members
  for all
  using (is_active_team_admin(auth.uid(), team_members.owner_profile_id))
  with check (is_active_team_admin(auth.uid(), team_members.owner_profile_id));
