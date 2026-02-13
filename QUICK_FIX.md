# Quick Fix: Onboarding and Authentication Issues

## Issues Fixed

### 1. **Onboarding Profile Creation Failing (RLS Policy)**
**Problem**: Users couldn't create their profile during onboarding because the `profiles` table was missing an INSERT policy.

**Solution**: Added `INSERT` policy to allow users to insert their own profile:
```sql
create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);
```

### 2. **Sign Out Not Working**
**Problem**: Sign out button didn't properly update the auth state in NavHeader.

**Solution**: 
- Added proper auth state listener with `onAuthStateChange()`
- Added error handling and loading state
- Added `router.refresh()` to refresh the page after sign out
- Made the button disabled while signing out

### 3. **Better Error Messages in Onboarding**
**Problem**: Users couldn't see detailed error messages if profile creation failed.

**Solution**:
- Added validation for username (required, min 2 chars)
- Added error logging to console for debugging
- Added check that profile was actually created
- Better error message display

## How to Apply These Changes

### Option A: Using Supabase Dashboard (Recommended)
1. Go to https://app.supabase.com/project/_/sql/new
2. Copy the SQL from `supabase/schema.sql` lines 82-84
3. Run this query:
```sql
create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);
```

### Option B: Using Supabase Migrations
1. Run: `supabase migration new add_profiles_insert_policy`
2. Add the SQL above to the new migration file
3. Run: `supabase db push`

## Testing the Fix

### Test 1: New User Registration
1. Sign up with new email
2. Confirm email
3. Log in
4. Should go to onboarding (not dashboard)
5. Complete onboarding with username and bio
6. Should see "You're all set!" and redirect to dashboard

### Test 2: Sign Out
1. Log in
2. Click "Sign out" button in top nav
3. Should redirect to home page
4. Should not be able to access dashboard without logging in

### Test 3: Profile Data
1. Log in to Supabase dashboard
2. Go to profiles table
3. Should see your profile with username, bio, and onboarding_complete = true

## Remaining Work
- Logout functionality now works with proper session refresh
- Profile creation is properly authenticated
- Error messages are visible for debugging
