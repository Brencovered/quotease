-- directory_goals' original policy checked profile_id = auth.uid() directly,
-- which only ever matches the business owner. A team member acting via
-- getActiveBusinessId() (which correctly resolves to the owner's
-- profile_id) would be blocked, since their own auth.uid() never equals
-- the row's profile_id. Match the same accessible_business_ids() pattern
-- used elsewhere in this codebase for team-aware RLS.
drop policy if exists "Users manage their own directory goals" on directory_goals;

create policy "Business owner and team manage directory goals"
  on directory_goals
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
