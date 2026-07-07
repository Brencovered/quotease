-- Applied directly via Supabase MCP; committed here for traceability.
--
-- storage.objects RLS for the job-files and logos buckets predated team
-- support and checked literally auth.uid() = the folder owner. Files are
-- stored under ${uploader_id}/... (the individual uploader's own id,
-- not the business id), so a file uploaded by a team member was
-- invisible to the business owner and every other team member, and
-- vice versa - job photos, compliance certs, and plan uploads all
-- silently siloed per-person instead of shared across the team.
--
-- Fix: a "same business" check via accessible_business_ids() overlap
-- between the viewer and the uploader, rather than requiring the ids
-- to match exactly. This correctly covers every combination (owner
-- uploads/member views, member uploads/owner views, member A uploads/
-- member B views) without needing to move any already-uploaded files
-- or change the upload path convention anywhere in the app.
--
-- public.safe_uuid() guards against non-UUID folder segments - the
-- job-files bucket also holds homeowner lead-request photos under a
-- literal "leads/..." prefix, which broke a naive ::uuid cast when
-- Postgres evaluated the policy against every row in the bucket.

create or replace function public.safe_uuid(input text)
returns uuid as $$
begin
  return input::uuid;
exception when invalid_text_representation then
  return null;
end;
$$ language plpgsql immutable;

drop policy if exists "Job file owner read" on storage.objects;
drop policy if exists "Business job files read" on storage.objects;
create policy "Business job files read"
  on storage.objects for select
  using (
    bucket_id = 'job-files'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) as mine
      where mine in (select accessible_business_ids(public.safe_uuid((storage.foldername(name))[1])))
    )
  );

drop policy if exists "Job file owner write" on storage.objects;
drop policy if exists "Business job files write" on storage.objects;
create policy "Business job files write"
  on storage.objects for insert
  with check (
    bucket_id = 'job-files'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) as mine
      where mine in (select accessible_business_ids(public.safe_uuid((storage.foldername(name))[1])))
    )
  );

drop policy if exists "Job file owner delete" on storage.objects;
drop policy if exists "Business job files delete" on storage.objects;
create policy "Business job files delete"
  on storage.objects for delete
  using (
    bucket_id = 'job-files'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) as mine
      where mine in (select accessible_business_ids(public.safe_uuid((storage.foldername(name))[1])))
    )
  );

-- Logos: public read stays unrestricted (unchanged, already correct).
-- Update/delete/write only matter for re-uploading - same fix for
-- consistency.
drop policy if exists "Logo owner update" on storage.objects;
drop policy if exists "Business logo update" on storage.objects;
create policy "Business logo update"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) as mine
      where mine in (select accessible_business_ids(public.safe_uuid((storage.foldername(name))[1])))
    )
  );

drop policy if exists "Logo owner delete" on storage.objects;
drop policy if exists "Business logo delete" on storage.objects;
create policy "Business logo delete"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) as mine
      where mine in (select accessible_business_ids(public.safe_uuid((storage.foldername(name))[1])))
    )
  );

drop policy if exists "Logo owner write" on storage.objects;
drop policy if exists "Business logo write" on storage.objects;
create policy "Business logo write"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) as mine
      where mine in (select accessible_business_ids(public.safe_uuid((storage.foldername(name))[1])))
    )
  );
