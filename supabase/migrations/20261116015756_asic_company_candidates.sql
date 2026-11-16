-- Fields for the free ASIC company feed.
--
-- Newly registered companies are queued in abn_trade_candidates with
-- source asic_company, plus ACN and registration date, then the existing
-- website-guess step creates listings. abn is nullable because some
-- registered companies have an ACN and no ABN yet. unique(abn) stays;
-- Postgres allows more than one null. Nothing here deletes rows.

do $$
begin
  if to_regclass('public.abn_trade_candidates') is null then
    raise notice 'abn_trade_candidates does not exist yet; ASIC columns skipped';
  else
    alter table public.abn_trade_candidates
      add column if not exists source text not null default 'abn_bulk';
    alter table public.abn_trade_candidates
      add column if not exists acn text;
    alter table public.abn_trade_candidates
      add column if not exists registered_at date;
    alter table public.abn_trade_candidates
      alter column abn drop not null;

    alter table public.abn_trade_candidates
      drop constraint if exists abn_trade_candidates_source_check;
    alter table public.abn_trade_candidates
      add constraint abn_trade_candidates_source_check
      check (source in ('abn_bulk', 'asic_company'));

    create unique index if not exists abn_trade_candidates_acn_uidx
      on public.abn_trade_candidates (acn)
      where acn is not null;

    create index if not exists abn_trade_candidates_registered_at_idx
      on public.abn_trade_candidates (registered_at desc)
      where registered_at is not null;
  end if;

  if to_regclass('public.abn_directory_runs') is null then
    raise notice 'abn_directory_runs does not exist yet; asic phase check skipped';
    return;
  end if;

  alter table public.abn_directory_runs drop constraint if exists abn_directory_runs_phase_check;
  alter table public.abn_directory_runs
    add constraint abn_directory_runs_phase_check
    check (phase in ('all', 'ingest', 'enrich', 'verify', 'asic'));
end $$;
