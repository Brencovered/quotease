-- Job ops: schedule SoT + client variation approve tokens

alter table public.jobs
  add column if not exists estimated_days numeric;

alter table public.variations
  add column if not exists public_token uuid default gen_random_uuid();

alter table public.variations
  add column if not exists client_signer_name text;

create unique index if not exists variations_public_token_uidx
  on public.variations (public_token)
  where public_token is not null;

-- Backfill tokens for existing variations
update public.variations
set public_token = gen_random_uuid()
where public_token is null;
