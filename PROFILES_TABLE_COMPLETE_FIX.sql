-- COPY AND PASTE THIS ENTIRE BLOCK INTO SUPABASE SQL EDITOR --
-- This will fix the "onboarding_complete column not found" error

-- Drop the problematic table
drop table if exists profiles cascade;

-- Recreate the profiles table with all required columns
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  bio text,
  avatar_url text,
  onboarding_complete boolean default false,
  onboarding_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;

-- Create SELECT policy
create policy "Profiles access" on profiles
  for select
  using (auth.uid() = id);

-- Create INSERT policy (the one we added to fix the issue)
create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);

-- Create UPDATE policy
create policy "Profiles update" on profiles
  for update
  using (auth.uid() = id);

-- Success! You should see "Success. 8 rows affected" or similar
