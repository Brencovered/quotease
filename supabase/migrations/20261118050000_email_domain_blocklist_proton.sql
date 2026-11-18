-- Applied directly on 2026-11-18. Committed to keep migration history in sync.
-- Proton Mail hands out proton.me, protonmail.com, protonmail.ch and pm.me;
-- proton.com (seeded earlier) is not one of its mail domains.
insert into public.email_domain_blocklist (domain, reason, blocked_by) values
  ('proton.me', 'Proton Mail. Blocked on request, 18 Nov 2026.', 'brendan@swiftscope.com.au'),
  ('protonmail.com', 'Proton Mail. Blocked on request, 18 Nov 2026.', 'brendan@swiftscope.com.au'),
  ('protonmail.ch', 'Proton Mail. Blocked on request, 18 Nov 2026.', 'brendan@swiftscope.com.au'),
  ('pm.me', 'Proton Mail. Blocked on request, 18 Nov 2026.', 'brendan@swiftscope.com.au')
on conflict (domain) do nothing;
