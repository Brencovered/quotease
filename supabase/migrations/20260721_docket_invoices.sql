-- End-of-month bundling: pull every signed, not-yet-invoiced docket for a
-- job into one invoice record. This doesn't push to Xero yet (that's the
-- Tracking Category / attachment work, still separate) - it's the bundling
-- mechanic itself: sum the dockets, mark them invoiced, keep a persisted
-- record of exactly which dockets made up which invoice.

create table if not exists public.docket_invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,

  invoice_number text not null,
  period_start date not null,
  period_end date not null,
  docket_count integer not null,
  total_cost numeric not null,

  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),

  -- Populated once the Xero push is built - left null for now.
  xero_invoice_id text,
  xero_exported_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists docket_invoices_job_id_idx on public.docket_invoices (job_id);
create index if not exists docket_invoices_profile_id_idx on public.docket_invoices (profile_id);

alter table public.docket_invoices enable row level security;
create policy "Business docket invoices" on public.docket_invoices
  for all
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

-- Which bundle a docket ended up in, once invoiced.
alter table public.dockets add column if not exists docket_invoice_id uuid references public.docket_invoices(id) on delete set null;
create index if not exists dockets_docket_invoice_id_idx on public.dockets (docket_invoice_id);

comment on table public.docket_invoices is 'One EOM bundle of signed dockets for a job, invoiced together.';
