-- ============================================================
-- JOB LINE ITEMS with per-item progress tracking
-- Each line item from a quote gets its own progress status
-- that can be tracked independently through the job lifecycle.
-- ============================================================

create table if not exists public.job_line_items (
  id             uuid primary key default extensions.uuid_generate_v4(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  label          text not null,
  quantity       numeric not null default 1,
  unit           text not null default 'ea',
  status         text not null default 'not_started'
                   check (status in (
                     'not_started',
                     'materials_ordered',
                     'materials_sent_to_site',
                     'installed',
                     'complete'
                   )),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Indexes
 create index if not exists job_line_items_job_id_idx on public.job_line_items(job_id);
create index if not exists job_line_items_profile_id_idx on public.job_line_items(profile_id);

-- RLS
alter table public.job_line_items enable row level security;
drop policy if exists "Business job line items" on public.job_line_items;
create policy "Business job line items" on public.job_line_items
  for all using (profile_id in (select accessible_business_ids(auth.uid())));

-- Auto-update updated_at trigger (reuses existing set_updated_at if available)
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_job_line_items_updated_at'
  ) then
    create trigger trg_job_line_items_updated_at
      before update on public.job_line_items
      for each row execute function public.set_updated_at();
  end if;
end $$;
