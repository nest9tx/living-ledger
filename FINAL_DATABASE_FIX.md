# Final Database Fix - Complete Instructions

Your post was created successfully but isn't showing because of 2 issues:

1. **Categories RLS policy blocking inserts** - Prevents seeding default categories
2. **Foreign key relationships not recognized** - Supabase schema cache doesn't see the relationships

## Step-by-Step Fix

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your Living Ledger project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Copy and Paste the Complete Reset SQL
Copy everything from `COMPLETE_DATABASE_RESET.sql` in your project root.

Paste it into the Supabase SQL Editor and click **Run**.

You should see:
```
CREATE TABLE (x4)
ALTER TABLE (x5)  
CREATE POLICY (x10)
INSERT 0 8
```

This means:
- ✅ 4 tables created
- ✅ 5 RLS enabled
- ✅ 10 policies created
- ✅ 8 default categories seeded

### Step 3: Verify in Supabase
After running the SQL:

1. Go to **Table Editor** (left sidebar)
2. Check **categories** table - should show 8 rows (Skills & Learning, Creative Work, etc.)
3. Check **requests** table - should be empty (old data cleared)
4. Check **offers** table - should be empty

### Step 4: Refresh Your App
1. Go to http://localhost:3000
2. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
3. You should see no errors in the console

### Step 5: Test Creating a Post
1. Click **Create Request** or **Create Offer**
2. Fill in the form and submit
3. Go to **Dashboard** - your post should appear!

## What Changed in Code

The app now fetches categories separately instead of relying on Supabase's foreign key relationship lookup, which was causing the schema cache error. This is a temporary workaround while Supabase syncs its schema cache.

## If Still Having Issues

Check the console for errors. Common issues:

- **"new row violates row-level security policy"** = RLS policies missing or wrong
- **"Could not find a relationship"** = Run the SQL again, it didn't complete
- **No categories in dropdown** = Categories didn't seed, run SQL again

If errors persist, contact support and share the console errors.
