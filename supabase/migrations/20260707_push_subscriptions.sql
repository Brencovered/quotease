-- Browser push notification subscriptions. Applied directly via Supabase
-- MCP; committed here for history/traceability (see lib/push.ts and
-- app/api/push/* for how these are used).
--
-- One row per browser/device that has enabled push notifications, tied to
-- the specific user (not just the business) - a device belongs to a
-- person, not the business as a whole, and RLS is scoped accordingly.
-- Sending notifications happens server-side via the admin client, which
-- bypasses RLS to look up every subscription for a business (owner +
-- active team members) at once.

create table if not exists public.push_subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_business_id_idx on public.push_subscriptions(business_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Own push subscriptions" on public.push_subscriptions;
create policy "Own push subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid());
