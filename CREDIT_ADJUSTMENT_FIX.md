# Credit Adjustment Bug Fix - Feb 16, 2025

## Problem Identified

**User Report:** Adding +13 credits to earned_credits (value 7) resulted in 33 instead of expected 20.

**Root Cause:** The original code was updating ONLY the specific field (earned_credits or purchased_credits) without updating the total credits_balance. This meant:
- earned_credits was correctly incremented (7 + 13 = 20)
- BUT credits_balance was NOT updated
- When UI refreshed and showed both values, it appeared broken

**Additional Issues:**
1. Confusing UI prompt (binary confirm() dialog unclear which option was which)
2. No way to adjust credits_balance directly (only earned or purchased)
3. No visibility of current balances before adjustment

---

## Solution Implemented

### 1. Fixed Balance Update Logic

**Old behavior:**
```typescript
// Only updated one field
update({ [balanceField]: newBalance })
```

**New behavior:**
```typescript
if (creditType === "earned") {
  // Update BOTH earned_credits AND credits_balance
  update({
    earned_credits: currentEarned + amount,
    credits_balance: currentTotal + amount
  });
} else if (creditType === "purchased") {
  // Update BOTH purchased_credits AND credits_balance
  update({
    purchased_credits: currentPurchased + amount,
    credits_balance: currentTotal + amount
  });
} else {
  // Update only credits_balance (legacy/promotional credits)
  update({ credits_balance: currentTotal + amount });
}
```

### 2. Improved UI Prompts

**Before:**
```typescript
const creditType = confirm("Adjust EARNED credits? (OK = earned, Cancel = purchased)") 
  ? "earned" 
  : "purchased";
```

**After:**
```typescript
// Show current balances first
alert(
  `Current Balances:\n\n` +
  `Total: 250 credits\n` +
  `Earned (cashout-eligible): 150 credits\n` +
  `Purchased: 100 credits`
);

// Three-way choice
const typeChoice = prompt(
  "Which balance to adjust?\n\n" +
  "1 = Earned credits (cashout-eligible, also updates total)\n" +
  "2 = Purchased credits (also updates total)\n" +
  "3 = Total balance only (legacy/general adjustment)\n\n" +
  "Enter 1, 2, or 3:"
);
```

### 3. Better Success Feedback

**Before:**
```typescript
alert("Balance adjusted successfully");
```

**After:**
```typescript
alert(
  `✓ Success!\n\n${payload.message}\n\n` +
  `New total balance: ${payload.newTotal} credits`
);
```

---

## Credit Types Explained

### 1. **Earned Credits** (cashout-eligible)
- Credits earned from completing requests/offers
- Subject to 7-day escrow hold before release
- Can be cashed out to USD via Stripe
- Tracked separately for tax/payout purposes

**When to adjust earned credits:**
- Refunding completed transactions
- Resolving disputes
- Manual escrow releases

### 2. **Purchased Credits** (bought with money)
- Credits user bought via Stripe checkout
- Cannot be cashed out (no refunds to prevent fraud)
- Immediately available for spending
- Tracked for accounting/analytics

**When to adjust purchased credits:**
- Refunding failed purchases
- Resolving payment disputes
- Promotional bonuses that shouldn't be cashout-eligible

### 3. **Credits Balance** (total spendable)
- The main balance users see and spend
- Sum of earned + purchased (minus spent)
- Used for boosts, requests, offers

**When to adjust balance only:**
- Promotional credits (site giveaways)
- Beta tester bonuses
- Customer service gestures
- Credits that aren't cashout-eligible and weren't purchased

---

## Example Adjustments

### Scenario 1: Promotional Welcome Bonus
```
User: @alice
Current: Total 0, Earned 0, Purchased 0
Action: Give 50 free credits

Choose option: 3 (Total balance only)
Amount: 50
Reason: "Welcome bonus for new user"

Result: Total 50, Earned 0, Purchased 0
Effect: User can spend 50 credits but can't cash out
```

### Scenario 2: Refund Completed Transaction
```
User: @bob
Current: Total 100, Earned 75, Purchased 25
Action: Refund payment of 30 credits Bob earned

Choose option: 1 (Earned credits)
Amount: -30
Reason: "Refund for disputed transaction #123"

Result: Total 70, Earned 45, Purchased 25
Effect: Removes from both earned and total
```

### Scenario 3: Promotional Upsell Bonus
```
User: @carol
Current: Total 10, Earned 0, Purchased 10
Action: Give 5 bonus credits for first purchase

Choose option: 2 (Purchased credits)
Amount: 5
Reason: "First purchase bonus"

Result: Total 15, Earned 0, Purchased 15
Effect: Adds to purchased (not cashout-eligible)
```

---

## Testing Instructions

1. **Navigate to Admin Dashboard**
   - Go to `/admin`
   - Click "Users" tab

2. **Test Addition**
   - Click "Adjust Credits" for a user
   - View current balances in alert
   - Enter `10` as amount
   - Choose option `1` (Earned)
   - Enter reason "Test addition"
   - Verify: Earned increased by 10, Total increased by 10

3. **Test Subtraction**
   - Click "Adjust Credits" again
   - Enter `-5` as amount
   - Choose option `1` (Earned)
   - Enter reason "Test subtraction"
   - Verify: Earned decreased by 5, Total decreased by 5

4. **Test Balance-Only Adjustment**
   - Click "Adjust Credits"
   - Enter `25` as amount
   - Choose option `3` (Total balance only)
   - Enter reason "Promotional credits"
   - Verify: Total increased by 25, Earned unchanged, Purchased unchanged

5. **Test Negative Balance Prevention**
   - Try to subtract more than user has
   - Should show error: "Cannot reduce balance below 0"

---

## Files Modified

1. **app/api/admin/users/adjust-balance/route.ts**
   - Fixed balance update logic to update both specific field AND total
   - Added validation for negative balances with context
   - Improved return payload with newTotal and creditType

2. **app/admin/page.tsx**
   - Added current balance display before adjustment
   - Changed binary confirm() to three-way prompt
   - Added success message with new total balance

---

## Related Documentation

See `STRIPE_CONNECT_SETUP.md` for Stripe payout implementation options.
