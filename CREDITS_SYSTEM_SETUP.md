# Credits System - Activation Instructions

## What's New

Your Credits Tab is now fully functional with:
- ✅ Real credit balance stored in database
- ✅ Transaction history with details
- ✅ Auto-updating balance on transactions
- ✅ 100 credits welcome bonus for new users
- ✅ Transaction types tracking (purchase, earned, spent, refund)

## Activate the Credits System

### Step 1: Run Database Migration

Open Supabase SQL Editor and run the complete SQL from `ADD_CREDITS_SYSTEM.sql`:

This will:
1. Add `credits_balance` column to profiles (default 100)
2. Create `transactions` table with RLS
3. Give existing users 100 starting credits
4. Create auto-update trigger for balance

### Step 2: Verify in Supabase

After running the SQL:

**Check profiles table:**
- Should see new `credits_balance` column
- All users should have 100 credits

**Check transactions table:**
- New table should exist
- Empty for now (will fill as users transact)

### Step 3: Test the System

1. **Refresh your app** at http://localhost:3000
2. **Go to My Credits tab**
   - Should show: **100 credits** balance
   - Message: "No transactions yet"

3. **Sign up a NEW user** (to test welcome bonus):
   - Complete onboarding
   - Go to Credits tab
   - Should show: **100 credits**
   - Should show transaction: "Welcome bonus! 🎉 +100"

4. **Test transaction recording** (via console):
   ```javascript
   // In browser console on /dashboard
   await fetch('/api/test-transaction', { method: 'POST' });
   ```
   *(We can build this API route if you want to test manually)*

## How It Works

### Balance Storage
- Stored in `profiles.credits_balance`
- Updated automatically via database trigger
- No manual calculation needed

### Transaction Flow
```
User action → recordTransaction() called
    ↓
Insert into transactions table
    ↓
Trigger fires: update_user_balance()
    ↓
profiles.credits_balance updated
    ↓
UI shows new balance
```

### Transaction Types
- `purchase` - Buying credits with money
- `earned` - Completing services for others
- `spent` - Paying for services
- `refund` - Returning credits (disputes, etc.)

## Next Steps After Activation

Once credits are working, we can add:

1. **Buy Credits** (Stripe integration)
   - Payment processing
   - Credit top-up
   
2. **Spend Credits** (Purchase flow)
   - Deduct credits when purchasing offers
   - Hold credits in escrow
   
3. **Earn Credits** (Service completion)
   - Award credits when request fulfilled
   - Release from escrow

4. **Transaction Detail Pages**
   - Click transaction to see related post
   - View full interaction history

## Testing Checklist

- [ ] SQL migration ran successfully
- [ ] Existing users have 100 credits
- [ ] New user signup gives welcome transaction
- [ ] Credits tab shows balance
- [ ] Transaction history displays (when exists)
- [ ] No console errors

Let me know when you've run the SQL and what you see!
