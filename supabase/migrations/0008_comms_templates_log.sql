-- Communication templates for email reminders and follow-ups
-- Includes communication log for tracking sends

-- Templates table (types align with UI: overdue_invoice, expiring_quote, quote_follow_up, job_update, custom)
create table if not exists communication_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null, -- 'overdue_invoice', 'expiring_quote', 'quote_follow_up', 'job_update', 'custom'
  subject text not null,
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Track every email sent through the comms panel
create table if not exists communication_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  type text not null, -- 'overdue_invoice', 'expiring_quote', 'quote_follow_up', 'job_update', 'custom'
  subject text,
  body text,
  sent_to text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);

-- RLS
alter table communication_templates enable row level security;
alter table communication_log enable row level security;

create policy if not exists "Own comms templates" on communication_templates
  for all using (auth.uid() = profile_id);

create policy if not exists "Own comms log" on communication_log
  for all using (auth.uid() = profile_id);

-- Index for fast lookups
 create index if not exists comms_templates_profile_type_idx on communication_templates(profile_id, type);
 create index if not exists comms_log_profile_sent_idx on communication_log(profile_id, sent_at desc);

-- Branding columns on profiles (for quote email customization)
alter table profiles
  add column if not exists branding_primary_color text default '#ffb400',
  add column if not exists branding_tagline text,
  add column if not exists branding_email_footer text default 'Sent via Swiftscope';
