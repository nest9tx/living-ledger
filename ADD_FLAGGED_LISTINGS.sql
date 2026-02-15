-- Flagged listings moderation
-- Run in Supabase SQL Editor

create table if not exists flagged_listings (
  id bigint generated always as identity primary key,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  post_type text not null check (post_type in ('offer', 'request')),
  post_id bigint not null,
  reason text,
  status text not null default 'open',
  admin_id uuid references auth.users(id) on delete set null,
  admin_note text,
  action_taken text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_flagged_listings_status
  on flagged_listings(status, created_at desc);

create index if not exists idx_flagged_listings_post
  on flagged_listings(post_type, post_id);

alter table flagged_listings enable row level security;

-- Reporters can create flags
create policy "Flagged listings insert"
  on flagged_listings for insert
  with check (auth.uid() = reporter_id);

-- Reporters can view their own flags
create policy "Flagged listings view own"
  on flagged_listings for select
  using (auth.uid() = reporter_id);

-- Admins can view all flags
create policy "Flagged listings admin view"
  on flagged_listings for select
  using (exists (
    select 1 from profiles where id = auth.uid() and is_admin = true
  ));

-- Admins can update flags
create policy "Flagged listings admin update"
  on flagged_listings for update
  using (exists (
    select 1 from profiles where id = auth.uid() and is_admin = true
  ));

notify pgrst, 'reload schema';
