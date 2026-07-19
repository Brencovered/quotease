-- License/certification entries for claimed pages, e.g. "Electrical
-- Contractor Licence: 123456". Stored as jsonb since a business can hold
-- more than one (electrical + a working-at-heights cert, for example),
-- and the shape (type, number) is simple enough not to warrant a
-- separate table for v1.
alter table directory_listing
  add column if not exists licenses jsonb not null default '[]'::jsonb;

comment on column directory_listing.licenses is 'Array of {type, number} objects, e.g. [{"type": "Electrical Contractor Licence", "number": "123456"}]. Self-reported, not verified against a licensing registry in v1.';
