-- Run this once in Supabase: SQL Editor > New query.
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video','note','resource')),
  title text not null,
  url text not null,
  thumbnail_url text,
  body text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.content_items enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_aibrain_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create policy "Anyone can read published content" on public.content_items
for select to anon, authenticated using (true);
create policy "Admins manage content" on public.content_items
for all to authenticated using (public.is_aibrain_admin()) with check (public.is_aibrain_admin());
create policy "Admins can see own membership" on public.admins
for select to authenticated using (user_id = auth.uid());

grant select on public.content_items to anon, authenticated;
grant insert, update, delete on public.content_items to authenticated;
grant select on public.admins to authenticated;

-- After signing into your site once, run this with your Supabase Auth user UUID:
-- insert into public.admins (user_id) values ('PASTE-YOUR-USER-UUID-HERE');
