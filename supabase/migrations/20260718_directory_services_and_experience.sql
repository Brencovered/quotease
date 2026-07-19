-- More substantial service-offering content for claimed pages: a
-- structured services list and years of experience, alongside the
-- existing free-text blurb.
alter table directory_listing
  add column if not exists services_offered text[],
  add column if not exists years_experience integer;
