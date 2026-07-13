-- Tracks whether the one-time signup welcome email (+ admin new-signup
-- notification) has already been sent for this account, so the client-side
-- trigger on the onboarding page (which may fire more than once - page
-- refresh, React strict-mode double-invoke, etc.) never sends duplicates.
alter table public.profiles add column if not exists welcome_email_sent_at timestamptz;
