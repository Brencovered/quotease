alter table client_plans
  add column if not exists quote_id uuid references quotes(id) on delete set null;

create index if not exists client_plans_quote_id_idx on client_plans (quote_id);

comment on column client_plans.quote_id is 'Scopes a plan to the single quote it was uploaded for (a job always originates from exactly one quote, via jobs.quote_id, so this same column correctly scopes plans on both the quote page and its resulting job page). Null for plans uploaded before this column existed via the old client-wide library flow - those will no longer appear on any specific job/quote page, only via the business-wide /plans library, which is unaffected by this change.';
