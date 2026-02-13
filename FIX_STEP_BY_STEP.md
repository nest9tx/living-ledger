# Fix Schema Cache Error - Step by Step

## Error You're Seeing
```
Could not find the 'onboarding_complete' column of 'profiles' in the schema cache
```

## What This Means
Supabase can't find a column that should exist. This usually means the table was never created properly.

## ✅ Solution (5 minutes)

### Step 1: Open Your Supabase Project
```
https://app.supabase.com/project/[YOUR-PROJECT-ID]/sql/new
```

### Step 2: Copy the Complete Fix
Go to your project folder and find: `PROFILES_TABLE_COMPLETE_FIX.sql`

Or copy this:
```sql
drop table if exists profiles cascade;

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

alter table profiles enable row level security;

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

### Step 3: Paste into Supabase SQL Editor
1. Click the SQL Editor in left sidebar
2. Click "New Query" (blue button, top right)
3. Paste the SQL above
4. Click "Run" button

### Step 4: Verify Success
You should see a green checkmark and message like:
```
✅ Success. 8 rows affected.
```

If you see an error, take a screenshot and let me know.

### Step 5: Test Onboarding
1. Go to http://localhost:3000
2. Sign up with a new email
3. Confirm email
4. Log in
5. Complete onboarding
6. Enter username and bio
7. Click "Complete setup"
8. ✅ Should work now!

## If It Still Doesn't Work

Check:
1. **Are SUPABASE env vars correct?**
   - `.env.local` should have:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

2. **Did you confirm the email?**
   - Check your email inbox (or terminal logs)
   - Click the confirmation link
   - Then log in

3. **Is the table there?**
   - In Supabase, go to **Table Editor**
   - Click on **profiles** table
   - You should see these columns:
     - id (uuid)
     - username (text)
     - bio (text)
     - avatar_url (text)
     - onboarding_complete (boolean)
     - onboarding_role (text)
     - created_at (timestamptz)
     - updated_at (timestamptz)

4. **Check the policies**
   - Click the **profiles** table
   - Click **RLS** button
   - Should see 3 policies:
     - Profiles access (SELECT)
     - Profiles insert (INSERT)
     - Profiles update (UPDATE)

## Still Stuck?

Tell me:
1. Did you see "Success" after running the SQL?
2. What error do you see now when you try onboarding?
3. Any errors in browser console (F12 → Console tab)?
