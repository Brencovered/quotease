-- Directory enquiry → CRM lead pipeline
-- Priority: hot / warm / cold (intent matrix)
-- Pipeline: new → quoting → quote_sent → quote_rejected → quote_won → on_job
-- Links: profile (claimed owner), quote, job

alter table public.directory_enquiries
  add column if not exists lead_code text,
  add column if not exists priority text,
  add column if not exists urgency text,
  add column if not exists customer_type text,
  add column if not exists pipeline_status text not null default 'new',
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

-- Backfill lead codes for existing rows
update public.directory_enquiries
set lead_code = 'DL-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where lead_code is null;

alter table public.directory_enquiries
  alter column lead_code drop default;

create unique index if not exists directory_enquiries_lead_code_uidx
  on public.directory_enquiries (lead_code)
  where lead_code is not null;

create index if not exists directory_enquiries_profile_id_idx
  on public.directory_enquiries (profile_id);

create index if not exists directory_enquiries_pipeline_idx
  on public.directory_enquiries (pipeline_status);

create index if not exists directory_enquiries_priority_idx
  on public.directory_enquiries (priority);

-- Quote / job can point back at the originating enquiry
alter table public.quotes
  add column if not exists directory_enquiry_id uuid references public.directory_enquiries(id) on delete set null;

alter table public.jobs
  add column if not exists directory_enquiry_id uuid references public.directory_enquiries(id) on delete set null;

create index if not exists quotes_directory_enquiry_id_idx
  on public.quotes (directory_enquiry_id);

create index if not exists jobs_directory_enquiry_id_idx
  on public.jobs (directory_enquiry_id);

-- Claimed-business owners can read/update their own enquiries (by profile_id)
drop policy if exists "Owners manage own directory enquiries" on public.directory_enquiries;
create policy "Owners manage own directory enquiries"
  on public.directory_enquiries
  for all
  using (
    profile_id is not null
    and profile_id in (select accessible_business_ids((select auth.uid())))
  )
  with check (
    profile_id is not null
    and profile_id in (select accessible_business_ids((select auth.uid())))
  );

comment on column public.directory_enquiries.priority is 'hot = budget+ASAP; warm = checking prices; cold = 6+ months out';
comment on column public.directory_enquiries.pipeline_status is 'new | quoting | quote_sent | quote_rejected | quote_won | on_job';
comment on column public.directory_enquiries.urgency is 'asap | checking | later — captured on the directory form';

-- Attach existing claimed enquiries to the listing owner where we can
update public.directory_enquiries de
set profile_id = dl.profile_id
from public.directory_listing dl
where de.listing_id is not null
  and de.listing_id = dl.id::text
  and de.profile_id is null
  and dl.profile_id is not null;
