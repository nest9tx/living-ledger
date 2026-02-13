# Fix Delete Functionality and Username Display

## Issue 1: Delete Not Working

**Problem:** Missing DELETE policies in database - posts can't actually be deleted.

**Fix:** Add DELETE policies to Supabase

### Steps:

1. Open Supabase SQL Editor: https://supabase.com/dashboard
2. Select your Living Ledger project
3. Click **SQL Editor** → **New Query**
4. Copy and paste this SQL:

```sql
-- Add delete policy for requests
create policy "Requests delete" on requests
  for delete
  using (auth.uid() = user_id);

-- Add delete policy for offers
create policy "Offers delete" on offers
  for delete
  using (auth.uid() = user_id);
```

5. Click **Run**
6. You should see: `CREATE POLICY (x2)`

### Test:
1. Refresh your app at http://localhost:3000
2. Click on your post
3. Click "Delete Post"
4. Post should disappear from feed immediately

---

## Issue 2: Username Shows "Anonymous" for Other Users

**Possible causes:**
1. Second user didn't complete onboarding
2. Profile not created during signup
3. RLS policy blocking profile reads

### Diagnosis Steps:

**Step 1: Check if profiles exist in Supabase**
1. Go to Supabase → **Table Editor** → **profiles** table
2. Check if BOTH users have rows
3. Verify both have `username` filled in

**Step 2: Check browser console**
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Look for errors like:
   - "Error fetching profiles"
   - Any RLS policy errors

**Step 3: If profiles are missing:**
- Second user needs to complete onboarding again
- Go through all 5 steps
- Must enter a username on the Profile step

**Step 4: If profiles exist but still show Anonymous:**
- Check console for "Error fetching profiles" message
- There may be an RLS issue - we can add a READ policy for profiles

### Quick Fix if RLS is blocking:

Run this SQL in Supabase:

```sql
-- Allow everyone to read profiles (usernames only, for display)
create policy "Profiles read all" on profiles
  for select
  using (true);
```

---

## What to check after applying fixes:

✅ Delete works and feed refreshes  
✅ Usernames show correctly for all users  
✅ Console shows no errors  
✅ Both users can see each other's posts with correct usernames

Let me know what you see in:
1. The Supabase profiles table (how many rows?)
2. Browser console errors (if any)
3. Whether delete now works after adding policies
