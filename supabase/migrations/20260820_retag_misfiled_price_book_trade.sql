-- Retag price-book rows that were silently filed under "electrician" because
-- app/api/materials/upload selected profiles.trade (column does not exist;
-- the real column is profiles.trades text[]) and fell back to electrician on
-- every failed lookup. Packages and material_bundles had the same hardcoded
-- default in the UI.
--
-- Only rewrite when the account's primary trade (trades[1]) is set and is NOT
-- electrician -- genuine electrician accounts keep their correctly tagged rows.

update public.price_book_items pbi
set trade = p.trades[1]
from public.profiles p
where pbi.profile_id = p.id
  and pbi.trade = 'electrician'
  and p.trades[1] is not null
  and p.trades[1] <> ''
  and p.trades[1] <> 'electrician';

update public.packages pkg
set trade = p.trades[1]
from public.profiles p
where pkg.profile_id = p.id
  and pkg.trade = 'electrician'
  and p.trades[1] is not null
  and p.trades[1] <> ''
  and p.trades[1] <> 'electrician';

update public.material_bundles mb
set trade = p.trades[1]
from public.profiles p
where mb.profile_id = p.id
  and mb.trade = 'electrician'
  and p.trades[1] is not null
  and p.trades[1] <> ''
  and p.trades[1] <> 'electrician';
