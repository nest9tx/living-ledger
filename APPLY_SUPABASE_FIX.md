# Apply Supabase Schema Fix

## The Problem
The onboarding flow fails at the profile creation step with an error like:
- "new row violates row-level security policy"
- or just silently fails to save

**Root Cause**: The `profiles` table has SELECT and UPDATE policies, but NO INSERT policy. This means new users can't create their profile.

## The Solution (Copy-Paste Ready)

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Log into your project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 2: Run This Query
```sql
create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);
```

### Step 3: Click "Run"
You should see: `Success. One row affected.`

## That's It! 🎉

Now users can:
- Complete onboarding ✅
- Save their username and bio ✅
- Get redirected to dashboard ✅

## To Verify It Worked

1. Open your app at http://localhost:3000
2. Sign up with a new account
3. Confirm email
4. Log in (should go to onboarding)
5. Fill in username and bio
6. Click "Complete setup"
7. Should see ✨ "You're all set!" message
8. Should redirect to dashboard in 2 seconds

## If It Still Doesn't Work

Check these things:

**1. Policy was created?**
- Go to Supabase dashboard
- Click "profiles" table
- Click "RLS" button
- Should see 3 policies: Select, Insert, Update

**2. Supabase env vars correct?**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

**3. Check browser console for errors**
- Open browser DevTools (F12)
- Go to Console tab
- Try onboarding again
- Look for error messages

**4. Check Supabase logs**
- In Supabase dashboard
- Click "Logs" in left sidebar
- Filter by "profiles" table
- See what error Supabase is returning

## Additional Fixes Already Applied

The code also includes these improvements:

1. **Better Error Messages** - Validation for username length and presence
2. **Proper Sign Out** - Auth state listener ensures you can log out and see the change
3. **Error Logging** - Errors logged to console for debugging

If you see errors in the form, read them carefully - they often tell you exactly what went wrong!
