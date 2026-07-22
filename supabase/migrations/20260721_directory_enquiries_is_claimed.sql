-- Tracks whether a quote enquiry went to a claimed business's real
-- account email or an unclaimed listing's scraped/fallback address --
-- useful for admin visibility into how the claim-conversion nudge on
-- unclaimed-listing enquiries is performing.
alter table directory_enquiries
  add column if not exists is_claimed boolean not null default false;
