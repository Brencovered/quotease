-- Build planner: 3D structure designs (sheds, garages, studios) a business
-- prices up and turns into a quote. `plan` is the planner's own JSON model;
-- `summary` is a derived snapshot (priced material lines + labour stages)
-- written on every save so the quote wizard and list pages can read totals
-- without running the 3D engine server-side.
create table if not exists public.structure_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  name text not null default 'Untitled build',
  plan jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  materials_total numeric not null default 0,
  labour_hours numeric not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_structure_plans_profile_updated on public.structure_plans (profile_id, updated_at desc);
create index if not exists idx_structure_plans_client_id on public.structure_plans (client_id);
create index if not exists idx_structure_plans_quote_id on public.structure_plans (quote_id);

alter table public.structure_plans enable row level security;

drop policy if exists "Business structure plans" on public.structure_plans;
create policy "Business structure plans" on public.structure_plans
  for all
  using (profile_id in (select accessible_business_ids((select auth.uid()))))
  with check (profile_id in (select accessible_business_ids((select auth.uid()))));

create or replace function public.touch_structure_plans_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_structure_plans_updated_at on public.structure_plans;
create trigger trg_structure_plans_updated_at
  before update on public.structure_plans
  for each row execute function public.touch_structure_plans_updated_at();
