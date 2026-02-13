# Database Error Diagnostics

Now that error logging is improved, check the browser console (F12 → Console tab) for the actual error message.

## Common Errors & Solutions

### Error: "new row violates row-level security policy"
**Cause**: RLS policy is blocking the INSERT

**Solution**: 
1. Go to Supabase dashboard
2. Click on the table (requests, offers, or categories)
3. Click "RLS" button
4. Verify the INSERT policy exists
5. If missing, add it

**Required policies**:
- `requests`: Insert policy with `auth.uid() = user_id`
- `offers`: Insert policy with `auth.uid() = user_id`  
- `categories`: Insert policy with `auth.uid() is not null`

---

### Error: "Invalid JWT" or "User not found"
**Cause**: Authentication issue

**Solution**:
1. Make sure you're logged in
2. Go to Supabase → Auth → Users
3. Verify your user exists
4. Check `.env.local` has correct NEXT_PUBLIC_SUPABASE_ANON_KEY

---

### Error: "column does not exist"
**Cause**: Database schema mismatch

**Solution**:
1. Go to Supabase → Table Editor
2. Click the table
3. Verify all columns exist:
   - **requests**: id, user_id, title, description, category_id, budget_credits, status, created_at
   - **offers**: id, user_id, title, description, category_id, price_credits, created_at
   - **categories**: id, name, icon, created_at

---

### Error: "No data returned"
**Cause**: Insert succeeded but returned no data

**Solution**:
1. This is usually a SELECT permission issue
2. Check RLS policies allow SELECT for read operations
3. May need to add SELECT policy: `using (true)` for public reading

---

## Check These in Order

1. **Refresh the page** - sometimes cache causes issues
2. **Open browser console** (F12) - look for the actual error message
3. **Check network tab** (F12 → Network) - see if request goes through
4. **Verify authentication** - are you logged in?
5. **Check Supabase logs** - go to Supabase → Logs to see database errors

## Run This If Still Stuck

Go to Supabase SQL Editor and run:

```sql
-- Check categories exist
SELECT COUNT(*) as category_count FROM categories;

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public';

-- Check if your user exists
SELECT id, email FROM auth.users LIMIT 1;
```

If you see the actual error now with better logging, share it and I can pinpoint the issue!
