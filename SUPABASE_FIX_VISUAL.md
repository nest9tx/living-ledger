# Supabase RLS Policy Fix - Visual Guide

## The Missing Piece

Your Supabase `profiles` table currently has:
- ✅ SELECT policy (read your own profile)
- ✅ UPDATE policy (edit your own profile)  
- ❌ **INSERT policy (CREATE your profile) ← THIS IS MISSING**

When a new user completes onboarding and tries to save their profile, Supabase says "NO" because there's no policy allowing them to INSERT.

## The One-Line Fix

**Exact SQL to copy-paste:**

```sql
create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);
```

## Where to Paste It

```
supabase.com
  └─ Your Project
      └─ SQL Editor (left menu)
          └─ New Query (blue button)
              └─ Paste the SQL above
                  └─ Click "Run" button
```

## What You'll See

### Before (No INSERT policy):
```
Profiles table policies:
  ├─ Profiles access (SELECT)
  ├─ Profiles update (UPDATE)
  └─ ❌ No INSERT policy
```

### After (With INSERT policy):
```
Profiles table policies:
  ├─ Profiles access (SELECT)
  ├─ Profiles insert (INSERT) ← NEW!
  ├─ Profiles update (UPDATE)
  └─ ✅ All operations enabled
```

## Why This Works

```javascript
// When user submits onboarding form:
const { error } = await supabase
  .from("profiles")
  .upsert({  // ← This tries to INSERT if row doesn't exist
    id: user.user.id,
    username: "john_doe",
    bio: "Developer from NYC",
    onboarding_complete: true,
    onboarding_role: "both"
  });

// Without INSERT policy:
// Error: "new row violates row-level security policy for table "profiles""

// With INSERT policy (auth.uid() = id):
// ✅ Success! User is allowed to insert their own row
```

The policy says: **"Users can insert into profiles IF the ID being inserted matches their own Supabase user ID"**

This prevents users from creating fake profiles for other people.

---

## Verification Checklist

After running the SQL:

- [ ] No error message appeared
- [ ] SQL Editor showed "Success" message
- [ ] Go to profiles table in Data Editor
- [ ] Click "RLS" button
- [ ] See 3 policies listed (Select, Insert, Update)

If you see all 3, you're good! Try onboarding again.
