-- Tracks when a listing's Google-sourced photos were last downloaded and
-- cached to Supabase Storage (see app/api/admin/directory/cache-photos and
-- the weekly cron that calls it). Lets a periodic job select only
-- listings actually due for a refresh (never cached, or cached long ago)
-- instead of needing to sweep the entire directory in one run.
alter table directory_listing
  add column if not exists photos_cached_at timestamptz;

create index if not exists directory_listing_photos_cached_at_idx
  on directory_listing (photos_cached_at)
  where is_claimed = false;
