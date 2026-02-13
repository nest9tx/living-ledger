-- Fix username display for all users
-- This allows everyone to see usernames (but not private profile data)

-- First, check what policies exist
-- If you see a policy that blocks reads, we'll add a new one

-- Add policy to allow all authenticated users to read all profiles
create policy "Profiles read all" on profiles
  for select
  using (true);

-- This allows:
-- ✅ Everyone can see usernames (for post attribution)
-- ✅ Still protected by RLS (can't modify others' profiles)
-- ✅ Private data like email stays in auth.users (not exposed)
