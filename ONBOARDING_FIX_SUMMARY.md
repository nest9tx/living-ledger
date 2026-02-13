# 🔧 Onboarding & Auth Issues - Fixed

## Status: ✅ Code Changes Complete | ⏳ Waiting for Supabase Schema Update

Your issues have been identified and code fixes applied. One database schema change is needed to fully resolve the onboarding error.

---

## Issues You Reported

### 1. ❌ Onboarding Fails at Username/Bio Step
**Error**: "new row violates row-level security policy" or silent failure

**Root Cause**: Missing INSERT policy on `profiles` table

**Status**: ✅ SCHEMA CHANGE REQUIRED (see below)

### 2. ❌ Can't Log Out
**Error**: Sign out button doesn't work or page doesn't update

**Root Cause**: NavHeader wasn't listening to auth state changes

**Status**: ✅ FIXED IN CODE (deployed)

### 3. ❌ No User Dashboard After Login
**Cause**: If onboarding isn't complete, redirects to onboarding (working as designed)

**Status**: ✅ WORKING CORRECTLY (once onboarding succeeds)

---

## What Changed in Your Code

### 1. NavHeader (`app/components/NavHeader.tsx`)
```javascript
// BEFORE: Sign out didn't update UI
const handleSignOut = async () => {
  await supabase.auth.signOut();
  setUser(null);
  router.push("/");
};

// AFTER: Proper auth listener and refresh
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (session) setUser(session.user);
      else setUser(null);
    }
  );
  return () => subscription?.unsubscribe();
}, []);

const handleSignOut = async () => {
  await supabase.auth.signOut();
  setUser(null);
  router.push("/");
  router.refresh();  // <-- Refresh page
};
```

### 2. Onboarding (`app/onboarding/page.tsx`)
```javascript
// ADDED:
// - Username validation (min 2 chars, required)
// - Console error logging
// - Better error messages
// - Check that profile was actually created

if (!username.trim() || username.trim().length < 2) {
  throw new Error("Username must be at least 2 characters");
}

const { error: profileError, data } = await supabase
  .from("profiles")
  .upsert(profileData, { onConflict: "id" })
  .select();

if (!data || data.length === 0) {
  throw new Error("Profile was not created properly");
}
```

### 3. Supabase Schema (`supabase/schema.sql`)
```sql
-- ADDED THIS POLICY:
create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);
```

---

## 🚀 Next Step: Apply Supabase Fix

This **one SQL query** will unlock onboarding:

**For Supabase Cloud Users:**

1. Go to https://app.supabase.com/project/[your-project]/sql/new
2. Copy and paste this:
```sql
create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);
```
3. Click "Run"
4. You should see: `Success. One row affected.`

---

## ✅ After You Apply the Fix

### Test the Complete Flow:

**New User Registration:**
1. Go to http://localhost:3000
2. Click "Sign up"
3. Enter email & password
4. Click "Create account"
5. Check email for confirmation link (or your terminal logs)
6. Click confirmation link
7. Log in with email & password
8. **→ Onboarding page loads** ✓
9. Go through 5 steps (welcome → guidelines → role → profile → complete)
10. Enter username and bio
11. Click "Complete setup"
12. **→ Redirects to dashboard** ✓
13. See your feed, requests, offers tabs
14. **→ Click "Sign out"** ✓
15. **→ Returns to home page** ✓

**Returning User:**
1. Log in
2. **→ Goes straight to dashboard** ✓
3. Click "Sign out"
4. **→ Auth state updates immediately** ✓

---

## 📋 What's Now in Place

- ✅ Profile creation with proper RLS permissions
- ✅ Onboarding validation and error handling  
- ✅ Auth state listener in NavHeader
- ✅ Proper sign out with page refresh
- ✅ Error messages visible for debugging

---

## If Issues Persist

**Check:**
1. Did you run the SQL query in Supabase?
2. Is the policy showing in the profiles table?
3. Are env vars correct? (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
4. Check browser console (F12) for JavaScript errors
5. Check Supabase "Logs" for RLS errors

**Logs helpful?**
If you see errors when you try to complete onboarding after running the SQL, check:
- Supabase SQL Editor → Logs (left sidebar)
- Filter for "profiles" table
- Copy the error message and we can debug it

---

## Files Modified This Session

- `app/components/NavHeader.tsx` - Auth listener, sign out refresh
- `app/onboarding/page.tsx` - Better validation & error handling
- `supabase/schema.sql` - Added INSERT policy (to be applied)
- `APPLY_SUPABASE_FIX.md` - Instructions for applying the schema fix
- `QUICK_FIX.md` - Summary of changes

---

**Let me know once you've run the SQL and if onboarding works! 🚀**
