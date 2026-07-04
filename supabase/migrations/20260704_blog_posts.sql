-- Blog / publications table
create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  excerpt       text,
  content       text not null default '',
  cover_url     text,
  category      text default 'Blog',
  tags          text[] default '{}',
  author_name   text default 'Swiftscope',
  author_avatar text,
  published     boolean default false,
  featured      boolean default false,
  published_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS: public can read published posts, only service role can write
alter table public.blog_posts enable row level security;

create policy "Public can read published posts"
  on public.blog_posts for select
  using (published = true);

-- Storage bucket for blog images (run manually if bucket doesn't exist)
-- insert into storage.buckets (id, name, public) values ('blog-images', 'blog-images', true)
-- on conflict do nothing;
