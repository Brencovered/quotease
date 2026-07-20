-- The supervisor/client needs an actual email to send the signing link to,
-- distinct from client_name (which is just a display name for who's expected
-- to sign). Matches quotes.client_email's role for the quote acceptance flow.
alter table public.dockets add column if not exists client_email text;
alter table public.dockets add column if not exists sent_at timestamptz;
