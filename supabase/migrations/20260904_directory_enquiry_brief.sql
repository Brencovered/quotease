-- Extra brief fields on directory quote requests so the tradie gets
-- more than a name and a one-line job: photos/drawings, other quotes,
-- site suburb, and free-text notes (access, measurements, materials).

alter table public.directory_enquiries
  add column if not exists photo_paths text[] not null default '{}',
  add column if not exists other_quotes text,
  add column if not exists notes text,
  add column if not exists site_suburb text;

comment on column public.directory_enquiries.photo_paths is
  'Storage paths in job-files under directory-enquiries/{id}/';
comment on column public.directory_enquiries.other_quotes is
  'Whether the homeowner already has quotes, and any prices they shared';
comment on column public.directory_enquiries.notes is
  'Access, measurements, materials, or other notes for the tradie';
comment on column public.directory_enquiries.site_suburb is
  'Suburb the job is in, if different from the listing suburb';
