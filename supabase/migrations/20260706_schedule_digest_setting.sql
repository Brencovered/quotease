-- Add weekly schedule digest setting to profiles
alter table public.profiles
  add column if not exists send_weekly_digest boolean not null default false;
