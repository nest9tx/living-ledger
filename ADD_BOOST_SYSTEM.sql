-- Featured/Boosted Listings System
-- Run in Supabase SQL Editor

-- Add boost tracking table
create table if not exists listing_boosts (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  post_type text not null check (post_type in ('offer', 'request')),
  post_id bigint not null,
  boost_tier text not null check (boost_tier in ('homepage', 'category')),
  category text, -- Only required for category boosts
  credits_spent int not null,
  duration_hours int not null default 24,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Indexes for efficient queries
create index if not exists idx_listing_boosts_active 
  on listing_boosts(is_active, expires_at) where is_active = true;

create index if not exists idx_listing_boosts_homepage 
  on listing_boosts(boost_tier, expires_at) where boost_tier = 'homepage' and is_active = true;

create index if not exists idx_listing_boosts_category 
  on listing_boosts(category, expires_at) where boost_tier = 'category' and is_active = true;

create index if not exists idx_listing_boosts_user
  on listing_boosts(user_id, is_active);

-- Function to auto-expire boosts
create or replace function expire_old_boosts()
returns void as $$
begin
  update listing_boosts
  set is_active = false
  where is_active = true
    and expires_at < now();
end;
$$ language plpgsql;

-- Add last_boosted_at to offers and requests (for cooldown enforcement)
alter table offers
add column if not exists last_boosted_at timestamptz;

alter table requests
add column if not exists last_boosted_at timestamptz;

-- RLS policies for listing_boosts
alter table listing_boosts enable row level security;

-- Users can view all active boosts (to see what's boosted)
create policy "Anyone can view active boosts"
  on listing_boosts for select
  using (is_active = true);

-- Users can view their own boost history
create policy "Users can view own boosts"
  on listing_boosts for select
  using (auth.uid() = user_id);

-- Only authenticated users can create boosts (via API)
create policy "Authenticated users can create boosts"
  on listing_boosts for insert
  with check (auth.uid() = user_id);

-- Refresh schema cache
notify pgrst, 'reload schema';
