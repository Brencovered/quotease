-- Prevent duplicate jobs being created for the same quote. Previously only
-- a plain (non-unique) index existed on jobs.quote_id, which meant the
-- check-then-insert pattern in getOrCreateJobForQuote() was a real,
-- exploitable race: two near-simultaneous calls (the accept API + the
-- quote detail page's self-healing redirect both call it) could both pass
-- the "does a job already exist" check before either INSERT committed,
-- producing two job rows for one quote. Confirmed happening in production
-- (job ids 4f6a4a2c... and b394e31c... both linked to quote a9c43769...,
-- created 2.1 seconds apart) - the duplicate (empty, no child data) was
-- deleted before adding this constraint.
--
-- Partial (WHERE quote_id IS NOT NULL) since quick-jobs created directly
-- (not from a quote) legitimately have a null quote_id and there can be
-- many of those.
drop index if exists jobs_quote_id_idx;
create unique index jobs_quote_id_unique_idx on public.jobs (quote_id) where quote_id is not null;
