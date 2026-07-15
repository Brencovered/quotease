alter table seo_keywords
  add column if not exists current_position numeric,
  add column if not exists clicks_28d integer,
  add column if not exists impressions_28d integer,
  add column if not exists last_synced_at timestamptz;

comment on column seo_keywords.current_position is 'Average Google Search Console position over the last 28 days, from getSearchAnalytics(). Null until a sync has run and GSC has data for this exact query string.';
comment on column seo_keywords.clicks_28d is 'Clicks from Search Console over the last 28 days, refreshed on each sync.';
comment on column seo_keywords.impressions_28d is 'Impressions from Search Console over the last 28 days, refreshed on each sync.';
