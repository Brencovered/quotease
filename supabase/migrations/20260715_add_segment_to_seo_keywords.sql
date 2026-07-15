alter table seo_keywords
  add column if not exists segment text not null default 'saas' check (segment in ('directory', 'saas'));

-- Backfill: anything already tagged with intent='Local' or a "Directory page"/
-- "Confirmed real GSC query" note (the manual batch added earlier this session)
-- is directory-side, not product/SaaS keywords.
update seo_keywords
set segment = 'directory'
where intent = 'Local' or notes ilike 'Directory page%' or notes ilike 'Confirmed real GSC query%';

create index if not exists seo_keywords_segment_idx on seo_keywords (segment);
