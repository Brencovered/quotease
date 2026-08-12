-- Applied via Supabase apply_migration on 2026-08-12. Committed to keep
-- migration history in sync with the database.
create table if not exists public.ip_blocklist (
  ip_address  inet primary key,
  reason      text not null,
  blocked_by  text,
  created_at  timestamptz not null default now()
);

comment on table public.ip_blocklist is
  'Specific IPs blocked from signup/claim after confirmed abuse. Deliberately not a country or ASN block.';

alter table public.ip_blocklist enable row level security;

create policy "Admin full access to ip_blocklist"
  on public.ip_blocklist for all
  using (is_admin())
  with check (is_admin());

insert into public.ip_blocklist (ip_address, reason, blocked_by) values
  ('103.78.46.30', 'Three signups across 11-12 Aug 2026 (ESM Compliance, Essendon Plumbing Services, PPC Urban), fabricated or mismatched trades, generic "Melbourne" suburb, two created fresh directory listings since deleted.', 'brendan@swiftscope.com.au')
on conflict (ip_address) do nothing;
