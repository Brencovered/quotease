-- Separates the supplier's own product category (e.g. Bunnings Trade's
-- "Timber - Posts", "Decking", "Pipe & Fittings") from `trade`, which the
-- quote builder hard-filters on to decide which materials are searchable
-- in which trade's builder.
--
-- Root cause of a real production bug: CSV import treated "category" as an
-- interchangeable synonym for "trade" and wrote the raw supplier category
-- straight into the trade column. A carpenter's price book ended up with
-- 17 rows literally tagged "carpenter" and ~55 more tagged things like
-- "Timber - Framing"/"Decking"/"Fixings" that the quote builder's
-- .eq("trade", "carpenter") filter could never match -- so a real
-- "100x100mm Treated Pine Post" a tradie searched "pine" for came back
-- "No matches in your price book", even though it was sitting right there.
alter table price_book_items
  add column if not exists category text;

comment on column price_book_items.category is
  'Raw supplier/CSV category label (e.g. "Timber - Posts"), kept separate from trade so it never gates quote-builder visibility. Populated going forward by app/api/materials/upload; NULL for rows imported before this column existed.';
