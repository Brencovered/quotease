-- Supplier contacts + order send log for job materials ordering

create table if not exists public.supplier_contacts (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  supplier_name text not null,
  email        text not null,
  phone        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (profile_id, supplier_name, email)
);

create index if not exists supplier_contacts_profile_idx
  on public.supplier_contacts (profile_id);

alter table public.supplier_contacts enable row level security;

drop policy if exists "Business supplier contacts" on public.supplier_contacts;
create policy "Business supplier contacts" on public.supplier_contacts
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));

create table if not exists public.supplier_order_sends (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  quote_id        uuid references public.quotes(id) on delete set null,
  supplier_name   text not null,
  recipient_email text not null,
  subject         text not null,
  body_text       text not null,
  line_items      jsonb not null default '[]',
  fulfillment     text not null default 'pickup'
                    check (fulfillment in ('pickup', 'delivery')),
  needed_by       date,
  delivery_notes  text,
  send_method     text not null default 'mailto'
                    check (send_method in ('mailto', 'email')),
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists supplier_order_sends_job_idx
  on public.supplier_order_sends (job_id, sent_at desc);

create index if not exists supplier_order_sends_profile_idx
  on public.supplier_order_sends (profile_id);

alter table public.supplier_order_sends enable row level security;

drop policy if exists "Business supplier order sends" on public.supplier_order_sends;
create policy "Business supplier order sends" on public.supplier_order_sends
  for all
  using (profile_id in (select accessible_business_ids(auth.uid())))
  with check (profile_id in (select accessible_business_ids(auth.uid())));
