-- Progress rows for the free ABN directory workflow.
--
-- The admin page inserts a queued row, then GitHub Actions
-- (abn-directory.yml) updates it as the bulk extract is parsed and
-- listings are created. The page polls this table. It does not delete
-- directory rows.
--
-- abn_trade_candidates.created_at lets that same page show the newest
-- candidates while phase 1 is inserting them. On a fresh bootstrap the
-- candidates table is created later by prod_schema_backfill.sql, which
-- repeats this column.

create table if not exists public.abn_directory_runs (
  id uuid primary key default gen_random_uuid(),
  phase text not null,
  status text not null default 'queued',
  message text,
  error text,
  github_run_id text,
  github_run_url text,
  triggered_by text,
  candidates_inserted integer not null default 0,
  listings_created integer not null default 0,
  candidates_processed integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint abn_directory_runs_phase_check check (phase in ('all', 'ingest', 'enrich', 'verify')),
  constraint abn_directory_runs_status_check check (status in ('queued', 'running', 'done', 'failed'))
);

create index if not exists abn_directory_runs_active_idx
  on public.abn_directory_runs (created_at desc);

alter table public.abn_directory_runs enable row level security;
revoke all on public.abn_directory_runs from public, anon, authenticated;

do $$
begin
  if to_regclass('public.abn_trade_candidates') is null then
    raise notice 'abn_trade_candidates does not exist yet; created_at skipped';
    return;
  end if;
  alter table public.abn_trade_candidates
    add column if not exists created_at timestamptz not null default now();
  create index if not exists abn_trade_candidates_created_at_idx
    on public.abn_trade_candidates (created_at desc);
end $$;
