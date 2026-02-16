# Stripe Connect Setup Guide

## What You Need

**Two approaches available:**

### Option A: Stripe Connect (Recommended - Automated)
Users connect their own Stripe accounts, cashouts are automated via Stripe transfers.

### Option B: Manual Payouts (Simpler - Manual Work)
Users provide bank details, you manually send payments via Stripe dashboard or API.

---

## OPTION A: Stripe Connect (Automated Payouts)

### 1. Enable Stripe Connect in Dashboard
1. Go to https://dashboard.stripe.com/settings/connect
2. Enable "Custom" or "Express" accounts
3. Set up your platform's branding
4. Note your Connect settings

### 2. Add Database Field for Stripe Account ID

Run this SQL in Supabase:

```sql
-- Add stripe_account_id to profiles
ALTER TABLE profiles 
ADD COLUMN stripe_account_id TEXT;

-- Add index for lookups
CREATE INDEX idx_profiles_stripe_account ON profiles(stripe_account_id);
```

### 3. Create Stripe Connect Account Link API

This allows users to connect their Stripe accounts.

**File:** `app/api/stripe/connect/create-account/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has Stripe account
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, email")
      .eq("id", user.id)
      .single();

    let accountId = profile?.stripe_account_id;

    // Create Stripe Connect account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express", // or "standard" for more control
        country: "US",
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Save account ID to profile
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?stripe_refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?stripe_connected=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: unknown) {
    console.error("Stripe Connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Connect account" },
      { status: 500 }
    );
  }
}
```

### 4. Update Cashout Request to Use Stripe Connect

**File:** `app/api/cashout/request/route.ts` (add Stripe account check)

Add this validation before accepting cashout request:

```typescript
// Verify user has connected Stripe account
const { data: profile } = await supabaseAdmin
  .from("profiles")
  .select("stripe_account_id, earned_credits")
  .eq("id", user.id)
  .single();

if (!profile?.stripe_account_id) {
  return NextResponse.json(
    { error: "Please connect your Stripe account in Settings before requesting cashout" },
    { status: 400 }
  );
}
```

### 5. Update Cashout Approval to Transfer via Stripe

**File:** `app/api/admin/cashouts/approve/route.ts`

```typescript
// After approving in database, transfer funds
const { data: cashout } = await supabaseAdmin
  .from("cashout_requests")
  .select(`
    *,
    profiles!inner(stripe_account_id)
  `)
  .eq("id", cashoutId)
  .single();

if (cashout.profiles.stripe_account_id) {
  // Transfer to connected account
  await stripe.transfers.create({
    amount: Math.round(cashout.amount_usd * 100), // Convert to cents
    currency: "usd",
    destination: cashout.profiles.stripe_account_id,
    description: `Cashout #${cashoutId} for ${cashout.amount_credits} credits`,
  });
}
```

### 6. Add "Connect Stripe" Button in Settings

Users need a way to connect their accounts.

**In your settings page:**

```tsx
<button
  onClick={async () => {
    const res = await fetch("/api/stripe/connect/create-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe onboarding
    }
  }}
  className="px-4 py-2 bg-blue-600 text-white rounded"
>
  Connect Stripe Account
</button>
```

---

## OPTION B: Manual Payouts (Simpler Setup)

### 1. Current Flow Works
Your current setup already supports this - just add bank details to cashout form.

### 2. Update Cashout Request Form

**File:** `app/cashout/page.tsx`

Add fields for bank details:

```tsx
const [bankName, setBankName] = useState("");
const [accountNumber, setAccountNumber] = useState("");
const [routingNumber, setRoutingNumber] = useState("");
const [accountHolderName, setAccountHolderName] = useState("");

// In your form:
<input
  type="text"
  placeholder="Bank Name"
  value={bankName}
  onChange={(e) => setBankName(e.target.value)}
  required
/>
<input
  type="text"
  placeholder="Account Holder Name"
  value={accountHolderName}
  onChange={(e) => setAccountHolderName(e.target.value)}
  required
/>
<input
  type="text"
  placeholder="Account Number"
  value={accountNumber}
  onChange={(e) => setAccountNumber(e.target.value)}
  required
/>
<input
  type="text"
  placeholder="Routing Number"
  value={routingNumber}
  onChange={(e) => setRoutingNumber(e.target.value)}
  required
/>
```

### 3. Store Bank Details Securely

**Add columns to cashout_requests:**

```sql
ALTER TABLE cashout_requests
ADD COLUMN bank_name TEXT,
ADD COLUMN account_holder_name TEXT,
ADD COLUMN account_number_last4 TEXT,
ADD COLUMN routing_number TEXT;
```

### 4. Manual Payout Process

When you approve a cashout:

1. **Via Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/payouts
   - Click "Send Payout"
   - Enter amount and bank details from cashout request
   - Add note with cashout ID

2. **Via Stripe API (automated but still manual approval):**

```typescript
// In approve cashout API
const bankAccount = await stripe.customers.createSource(
  'customer_id', // or create tokenized bank account
  {
    source: {
      object: 'bank_account',
      account_number: cashout.account_number,
      routing_number: cashout.routing_number,
      country: 'US',
      currency: 'usd',
    }
  }
);

await stripe.payouts.create({
  amount: Math.round(cashout.amount_usd * 100),
  currency: 'usd',
  destination: bankAccount.id,
  description: `Cashout #${cashoutId}`,
});
```

---

## Which Should You Choose?

**Use Stripe Connect (Option A) if:**
- You want automated payouts
- You expect many cashout requests
- You want users to manage their own bank details
- You're willing to handle Connect setup complexity

**Use Manual Payouts (Option B) if:**
- You're just starting out with low volume
- You want simpler setup (no Connect configuration)
- You're comfortable manually sending payments
- You want more control over each payout

---

## Current State

Your platform currently has:
- ✅ Cashout request submission
- ✅ Admin cashout approval page
- ❌ No Stripe account connection (need Option A)
- ❌ No bank details collection (need Option B)
- ❌ No actual payout mechanism (need either option)

**Recommendation:** Start with **Option B** (manual) for MVP, then migrate to **Option A** (Connect) when you have steady volume.
