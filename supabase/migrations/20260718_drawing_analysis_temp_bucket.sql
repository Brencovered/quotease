-- Temporary holding bucket for large drawing/photo uploads bound for AI
-- analysis. Vercel's serverless functions have a hard ~4.5MB request body
-- limit that can't be raised via app config -- a real architectural PDF or
-- a full-resolution phone photo routinely exceeds that. For files under
-- the safe threshold, the client still posts directly to the analyze
-- route as before (simpler, no extra round trip). For anything larger,
-- the client uploads straight to this bucket first (browser -> Supabase
-- Storage, never touching our Vercel function's body limit), then sends
-- just the storage path to the analyze route, which downloads it
-- server-side and deletes it again once analysis is done.
--
-- Private (not public) -- these are working documents en route to
-- analysis, not directory/public assets. Folder-scoped by business id,
-- same accessible_business_ids() pattern as the logos/directory-photos
-- buckets.
insert into storage.buckets (id, name, public)
values ('drawing-analysis-temp', 'drawing-analysis-temp', false)
on conflict (id) do nothing;

create policy "Business drawing-analysis-temp read own"
  on storage.objects for select
  using (
    bucket_id = 'drawing-analysis-temp'
    and safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) mine(mine)
      where mine.mine in (select accessible_business_ids(safe_uuid((storage.foldername(name))[1])))
    )
  );

create policy "Business drawing-analysis-temp write own"
  on storage.objects for insert
  with check (
    bucket_id = 'drawing-analysis-temp'
    and safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) mine(mine)
      where mine.mine in (select accessible_business_ids(safe_uuid((storage.foldername(name))[1])))
    )
  );

create policy "Business drawing-analysis-temp delete own"
  on storage.objects for delete
  using (
    bucket_id = 'drawing-analysis-temp'
    and safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) mine(mine)
      where mine.mine in (select accessible_business_ids(safe_uuid((storage.foldername(name))[1])))
    )
  );
