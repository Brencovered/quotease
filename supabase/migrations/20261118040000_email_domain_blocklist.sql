-- Applied via Supabase apply_migration on 2026-11-18. Committed to keep
-- migration history in sync with the database.
--
-- Email domains refused at signup. Enforced by a BEFORE INSERT trigger on
-- auth.users, not in app code: Google OAuth signups are created on
-- Supabase's own infrastructure and never pass through our signup routes
-- (same reason ip_blocklist is also checked in middleware). Raising here
-- stops the auth.users row being created at all, for every sign-up path.
-- Also checked when an existing user changes their email.
create table if not exists public.email_domain_blocklist (
  domain      text primary key check (domain = lower(domain)),
  reason      text not null,
  blocked_by  text,
  created_at  timestamptz not null default now()
);

comment on table public.email_domain_blocklist is
  'Email domains refused at signup and on email change. Checked by the block_email_domain trigger on auth.users.';

alter table public.email_domain_blocklist enable row level security;

create policy "Admin full access to email_domain_blocklist"
  on public.email_domain_blocklist for all
  using (is_admin())
  with check (is_admin());

create or replace function public.block_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and exists (
    select 1 from public.email_domain_blocklist
    where domain = lower(split_part(new.email, '@', 2))
  ) then
    -- Deliberately vague, same as the IP blocklist's 404: say nothing
    -- that tells someone to just switch domains.
    raise exception 'Signup is not available for this email address'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists block_email_domain on auth.users;
create trigger block_email_domain
  before insert or update of email on auth.users
  for each row execute function public.block_email_domain();

insert into public.email_domain_blocklist (domain, reason, blocked_by) values
  ('stayboba.com', 'Blocked on request, 18 Nov 2026. One signup on 17 Nov 2026.', 'brendan@swiftscope.com.au'),
  ('proton.com', 'Blocked on request, 18 Nov 2026.', 'brendan@swiftscope.com.au')
on conflict (domain) do nothing;
