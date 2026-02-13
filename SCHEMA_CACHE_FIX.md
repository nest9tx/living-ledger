# Schema Cache Issue - Fix

## The Problem

Supabase shows: `Could not find the 'onboarding_complete' column of 'profiles' in the schema cache`

This means:
1. Your database table might be missing columns
2. Or the schema cache needs to be refreshed

## Quick Fix Options

### Option A: Force Refresh Supabase Schema Cache (Recommended - 2 minutes)

1. Go to your Supabase project: https://app.supabase.com/project/[YOUR-PROJECT]
2. In the **left sidebar**, scroll down and click **"Migrations"**
3. At the top right, click the **"Refresh schema cache"** button (if you see it)
4. Or go to **Settings** → **Database** → click **"Refresh schema"** button
5. Wait 10-20 seconds for the cache to refresh
6. Try onboarding again

### Option B: Drop and Recreate the Profiles Table (More thorough - 5 minutes)

If Option A doesn't work, run this SQL in your Supabase SQL Editor:

```sql
-- Drop the problematic table
drop table if exists profiles cascade;

-- Recreate it with all columns
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  bio text,
  avatar_url text,
  onboarding_complete boolean default false,
  onboarding_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Add all policies
create policy "Profiles access" on profiles
  for select
  using (auth.uid() = id);

create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);

create policy "Profiles update" on profiles
  for update
  using (auth.uid() = id);
```

**⚠️ Warning**: This will delete all existing user profiles. Only do this if you don't have important test data.

## Steps to Apply Option B:

1. Go to https://app.supabase.com/project/[YOUR-PROJECT]/sql/new
2. Copy the entire SQL block above
3. Paste it into the SQL Editor
4. Click "Run"
5. Wait for success message
6. Try onboarding again

## Verify It Worked

After either option:
1. Go to http://localhost:3000
2. Sign up with a new email
3. Confirm email
4. Log in
5. Try onboarding - should work now!

If you still see the error:
- Check browser console for more details
- Go to Supabase "Logs" and look for errors
- Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are correct in .env.local
