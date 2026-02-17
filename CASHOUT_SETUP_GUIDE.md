# Cashout System Setup Guide

## ✅ Complete Implementation

Your cashout system is now fully implemented with:
- Bank account connection in Settings
- Manual approval with fraud review
- Automated email notifications via Resend
- Full audit trail

---

## 🚀 Quick Setup Steps

### 1. Update Database Schema

Run this SQL in **Supabase SQL Editor**:

```sql
-- Add bank account fields for cashouts
alter table profiles
add column if not exists bank_account_name text,
add column if not exists bank_account_last4 text,
add column if not exists bank_routing_number text,
add column if not exists bank_account_type text,
add column if not exists bank_connected_at timestamptz,
add column if not exists stripe_customer_id text;

-- Refresh schema cache
notify pgrst, 'reload schema';
```

### 2. Add Environment Variable

Add to your `.env.local`:

```bash
RESEND_API_KEY=re_your_api_key_here
```

Get your API key from: https://resend.com/api-keys

### 3. Verify Resend Email Domain

In Resend dashboard:
1. Go to **Domains**
2. Add `livingledger.org`
3. Add DNS records to your domain registrar
4. Wait for verification (usually 5-10 minutes)

Or use Resend's testing domain: `onboarding@resend.dev` (change in approval/reject APIs)

---

## 📋 How It Works

### For Users:

1. **One-time setup:** User goes to Settings → Connects bank account
   - Enters account holder name, account number, routing number
   - Only last 4 digits stored in database (security)
   - Full routing number stored encrypted

2. **Request cashout:** User goes to Cashout page
   - Must have bank account connected
   - Must have ≥$20 earned credits
   - Submits request with amount

3. **Wait for approval:** User receives email when:
   - ✅ Approved: "Payment processing, arrives in 2-5 business days"
   - ❌ Rejected: "Credits returned to your balance"

### For You (Admin):

1. **Review request** in Admin Dashboard → Cashouts tab
   - See user details, amount, bank info
   - Check for suspicious patterns

2. **Click Approve or Reject**
   - **Approve:** 
     - User gets email notification
     - Console logs bank details for manual payout
     - Status → "approved"
   - **Reject:**
     - Credits returned to user
     - User gets email with reason
     - Status → "rejected"

3. **Send payment manually** (via Stripe or your bank):
   - Check console output for bank details
   - Or view in admin panel
   - Send ACH/wire transfer

4. **Mark as paid** (optional future feature):
   - Update cashout status to "paid"

---

## 🔐 Security Notes

### What's Stored:
- ✅ Bank account name (encrypted at rest by Supabase)
- ✅ Routing number (encrypted at rest)
- ✅ Last 4 digits of account number
- ❌ Full account number (NEVER stored - deleted after save)

### Best Practices:
1. **SSL/TLS:** Ensure your domain uses HTTPS
2. **Database:** Enable Supabase's row-level security (RLS)
3. **API Routes:** Already protected with auth middleware
4. **Email:** Resend uses TLS for email delivery

---

## 💳 Manual Payout Process

When you approve a cashout, check your terminal/logs:

```
=== MANUAL PAYOUT REQUIRED ===
Amount: $47.50
User: alice_smith (alice@example.com)
Bank: Alice Smith (****5678)
Routing: 021000021
Type: checking
==============================
```

### Option A: Via Stripe Dashboard
1. Go to https://dashboard.stripe.com/payouts
2. Click "New Payout"
3. Enter amount and bank details from console log
4. Add note: "Cashout #123 for @alice_smith"
5. Confirm payout

### Option B: Via Your Bank
1. Log into your business bank account
2. Create ACH transfer
3. Use bank details from console log
4. Add memo: "Living Ledger Cashout #123"
5. Submit transfer

---

## 📧 Email Templates

Users automatically receive emails for:

### Approval Email:
```
Subject: ✓ Cashout Approved - Payment Processing

Hi alice_smith,

Great news! Your cashout request has been approved.

Amount: $47.50 USD
Bank Account: ****5678

Your payment will arrive in 2-5 business days.
```

### Rejection Email:
```
Subject: Cashout Request Update

Hi alice_smith,

We're writing to inform you about your recent cashout request.

Status: Request Declined
Amount: $47.50 USD

Reason: [Admin note here]

Your $47.50 credits have been returned to your balance.
```

---

## 🔄 Future Automation (Optional)

To automate payouts without manual work, see `STRIPE_CONNECT_SETUP.md` for:
- **Stripe Connect** setup (users connect their own accounts)
- Automated transfers when you approve
- No manual bank entry required

For now, manual approval gives you:
- ✅ Fraud prevention (review each request)
- ✅ Security (no automated large transfers)
- ✅ Flexibility (handle edge cases)

---

## 🧪 Testing

### Test the flow:

1. **Create test user:**
   - Sign up with test email
   - Complete onboarding
   - Give user earned credits via admin panel

2. **Connect bank account:**
   - Go to Settings
   - Enter test bank details:
     - Name: Test User
     - Account: 1234567890
     - Routing: 110000000 (test routing)
     - Type: checking

3. **Request cashout:**
   - Go to Cashout page
   - Enter $20 (minimum)
   - Submit request

4. **Review as admin:**
   - Go to Admin → Cashouts
   - See pending request
   - Click Approve

5. **Check email:**
   - Check test email inbox
   - Should receive approval email

---

## 🐛 Troubleshooting

**"User has not connected a bank account"**
- User must visit Settings and connect bank first

**Emails not sending:**
- Check RESEND_API_KEY in .env.local
- Verify domain in Resend dashboard
- Check spam folder

**Bank details not showing in console:**
- Check admin cashout approval API logs
- Verify profile has bank_account_last4, bank_routing_number

**Credits not returning on reject:**
- Check admin cashout reject API
- Verify transaction was created

---

## 📊 Admin Dashboard Features

In the Cashouts tab you can see:
- All pending/approved/rejected requests
- User details and bank info (last 4)
- Request amounts and dates
- Approve/reject buttons
- Admin notes field

---

## Questions?

See also:
- `STRIPE_CONNECT_SETUP.md` - Automated payout setup
- `CREDIT_ADJUSTMENT_FIX.md` - Credit system explanation

