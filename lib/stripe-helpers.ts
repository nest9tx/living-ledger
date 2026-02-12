/**
 * Stripe Integration Helpers
 * 
 * These are scaffolding functions for Stripe integration.
 * They provide the structure needed to process credit purchases,
 * manage Stripe Connect for payouts, and handle webhooks.
 * 
 * NOTE: Full implementation requires setting up:
 * - Stripe API keys in .env.local
 * - Stripe Connect account for providers
 * - Webhook endpoint configuration
 * - Server actions for secure payment processing
 */

import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
    })
  : null;

/**
 * Create a payment intent for a user to purchase credits
 * 
 * @param userId - Supabase user ID
 * @param creditsAmount - Number of credits to purchase
 * @param amount - Amount in cents (creditsAmount * 100, since 1 credit = $1)
 * @returns PaymentIntent or error
 */
export async function createBuyCreditsPaymentIntent(
  userId: string,
  creditsAmount: number,
  amount: number
) {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in .env.local');
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: 'usd',
      metadata: {
        userId,
        creditsAmount,
        type: 'credit_purchase',
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment intent',
    };
  }
}

/**
 * Create a Stripe Connect account for a service provider
 * This allows them to receive payouts
 * 
 * @param userId - Supabase user ID
 * @param email - User's email for the Connect account
 * @param country - Country code (e.g., 'US')
 * @returns Connected account ID or error
 */
export async function createConnectAccount(
  userId: string,
  email: string,
  country: string = 'US'
) {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email,
      metadata: {
        userId,
      },
    });

    return {
      success: true,
      accountId: account.id,
    };
  } catch (error) {
    console.error('Error creating Connect account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Connect account',
    };
  }
}

/**
 * Create an account link to onboard a provider
 * This generates a URL where they can complete their Stripe Connect setup
 * 
 * @param accountId - Stripe Connect account ID
 * @param refreshUrl - URL to redirect if they refresh/cancel
 * @param returnUrl - URL to redirect after successful setup
 * @returns Account link URL or error
 */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: refreshUrl,
      return_url: returnUrl,
    });

    return {
      success: true,
      url: accountLink.url,
    };
  } catch (error) {
    console.error('Error creating account link:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create account link',
    };
  }
}

/**
 * Create a payout to a provider
 * 
 * @param connectAccountId - Stripe Connect account ID
 * @param amountInCents - Amount in cents to payout
 * @param description - Description of the payout
 * @returns Payout ID or error
 */
export async function createPayout(
  connectAccountId: string,
  amountInCents: number,
  description: string = 'Provider earnings payout'
) {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    const payout = await stripe.payouts.create(
      {
        amount: amountInCents,
        currency: 'usd',
        description,
      },
      {
        stripeAccount: connectAccountId,
      }
    );

    return {
      success: true,
      payoutId: payout.id,
      status: payout.status,
    };
  } catch (error) {
    console.error('Error creating payout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payout',
    };
  }
}

/**
 * Retrieve balance information for a provider
 * Useful for showing available balance before cashout
 * 
 * @param connectAccountId - Stripe Connect account ID
 * @returns Balance details or error
 */
export async function getConnectBalance(connectAccountId: string) {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    const balance = await stripe.balance.retrieve({
      stripeAccount: connectAccountId,
    });

    return {
      success: true,
      available: balance.available[0]?.amount || 0,
      pending: balance.pending[0]?.amount || 0,
    };
  } catch (error) {
    console.error('Error retrieving balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve balance',
    };
  }
}

/**
 * Verify webhook signature
 * Use this in your webhook endpoint to verify requests are from Stripe
 * 
 * @param body - Raw request body as string
 * @param signature - Stripe signature header
 * @returns Parsed event or null if invalid
 */
export function verifyWebhookSignature(body: string, signature: string) {
  if (!stripe) {
    console.error('Stripe client not configured');
    return null;
  }
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return null;
  }
}

/**
 * Handle payment intent succeeded webhook
 * Called when a user successfully completes credit purchase
 * 
 * You'll need to:
 * 1. Extract metadata (userId, creditsAmount)
 * 2. Add credits to user's transaction ledger in Supabase
 * 3. Update user's credits balance
 * 4. Send confirmation email
 */
export function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  const { userId, creditsAmount } = paymentIntent.metadata as {
    userId: string;
    creditsAmount: string;
  };

  // TODO: Implement in server action
  // 1. Add to transactions table: { user_id, amount: +creditsAmount, reason: 'credit_purchase' }
  // 2. Log the Stripe payment ID for reconciliation
  // 3. Update user's credit balance cache if needed
  // 4. Send confirmation email

  console.log(
    `Payment succeeded for user ${userId}. Credits to add: ${creditsAmount}`
  );
}

/**
 * Handle payment intent failed webhook
 * Called when a user's payment fails
 */
export function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
) {
  const { userId } = paymentIntent.metadata as { userId: string };

  // TODO: Implement in server action
  // 1. Log the failed payment attempt
  // 2. Send notification email to user
  // 3. Optionally: queue retry logic

  console.log(`Payment failed for user ${userId}`);
}

/**
 * Handle charge refunded webhook
 * Called when a payment is refunded
 */
export function handleChargeRefunded(charge: Stripe.Charge) {
  // TODO: Implement in server action
  // 1. Find the corresponding transaction in Supabase
  // 2. Mark it as refunded
  // 3. Reverse any credits that were added
  // 4. Notify user of refund

  console.log(`Refund processed for charge ${charge.id}`);
}

/**
 * Example webhook handler
 * 
 * Usage in your API route:
 * 
 * export async function POST(req: Request) {
 *   const body = await req.text();
 *   const signature = req.headers.get('stripe-signature');
 *   
 *   const event = verifyWebhookSignature(body, signature || '');
 *   
 *   if (!event) {
 *     return Response.json({ error: 'Invalid signature' }, { status: 400 });
 *   }
 *   
 *   switch (event.type) {
 *     case 'payment_intent.succeeded':
 *       handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
 *       break;
 *     case 'payment_intent.payment_failed':
 *       handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
 *       break;
 *     case 'charge.refunded':
 *       handleChargeRefunded(event.data.object as Stripe.Charge);
 *       break;
 *   }
 *   
 *   return Response.json({ success: true });
 * }
 */
