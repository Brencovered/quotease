-- Applied via Supabase apply_migration on 2026-08-12. Committed to keep
-- migration history in sync with the database.
alter table public.directory_claim_attempts
  add column if not exists ip_address   inet,
  add column if not exists user_agent   text,
  add column if not exists verified_via_email text;

alter table public.profiles
  add column if not exists signup_ip         inet,
  add column if not exists signup_user_agent text;

comment on column public.directory_claim_attempts.ip_address is
  'Client IP from x-forwarded-for at claim time. Vercel sets this; the left-most entry is the real client.';
comment on column public.directory_claim_attempts.verified_via_email is
  'Address a confirmation was sent to when claiming a scraped listing. Null = unverified claim.';
comment on column public.profiles.signup_ip is
  'Client IP captured at onboarding. auth.audit_log_entries is pruned by Supabase and cannot be relied on.';

create index if not exists directory_claim_attempts_ip_idx
  on public.directory_claim_attempts (ip_address, created_at desc);
