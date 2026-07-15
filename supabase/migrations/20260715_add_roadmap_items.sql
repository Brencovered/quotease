create table if not exists roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'feature' check (category in ('feature', 'bug', 'infra')),
  status text not null default 'idea' check (status in ('idea', 'scoped', 'roadmap', 'in_progress', 'in_branch', 'live')),
  prd_content text,
  branch_name text,
  priority_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shipped_at timestamptz
);

create index if not exists roadmap_items_status_idx on roadmap_items (status);
create index if not exists roadmap_items_priority_idx on roadmap_items (priority_order);

alter table roadmap_items enable row level security;

-- Admin-only table: no end-user access at all. All reads/writes go through
-- createAdminClient() (service role) from server-side /admin routes, gated by
-- isAdminEmail(). No RLS policies are defined, so PostgREST/anon/authenticated
-- roles get zero access by default; only the service role (which bypasses RLS)
-- can touch this table.
