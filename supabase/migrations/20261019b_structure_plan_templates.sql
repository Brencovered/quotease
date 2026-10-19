-- Build planner templates: a business saves any design as a reusable
-- starting point. Same table and RLS as builds, flagged with is_template.
alter table public.structure_plans
  add column if not exists is_template boolean not null default false;

create index if not exists idx_structure_plans_profile_template
  on public.structure_plans (profile_id, is_template, updated_at desc);

notify pgrst, 'reload schema';
