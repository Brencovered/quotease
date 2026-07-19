-- Storage bucket for claimed-page gallery photos, following the exact
-- same folder-scoped-by-business-id RLS pattern already used for the
-- logos bucket (folder name = business id, checked against
-- accessible_business_ids() so team members can manage it too).
insert into storage.buckets (id, name, public)
values ('directory-photos', 'directory-photos', true)
on conflict (id) do nothing;

create policy "Directory photos public read"
  on storage.objects for select
  using (bucket_id = 'directory-photos');

create policy "Business directory photos write"
  on storage.objects for insert
  with check (
    bucket_id = 'directory-photos'
    and safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) mine(mine)
      where mine.mine in (select accessible_business_ids(safe_uuid((storage.foldername(name))[1])))
    )
  );

create policy "Business directory photos delete"
  on storage.objects for delete
  using (
    bucket_id = 'directory-photos'
    and safe_uuid((storage.foldername(name))[1]) is not null
    and exists (
      select 1 from accessible_business_ids(auth.uid()) mine(mine)
      where mine.mine in (select accessible_business_ids(safe_uuid((storage.foldername(name))[1])))
    )
  );

-- Social links for claimed pages -- outbound links only in v1, no
-- feed embed / API integration (see roadmap notes).
alter table directory_listing
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;
