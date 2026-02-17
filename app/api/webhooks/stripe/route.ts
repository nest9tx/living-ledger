/**
 * Stripe Webhook Endpoint
 * 
 * Path: /app/api/webhooks/stripe/route.ts
 * 
 * This endpoint handles Stripe webhook events:
 * - Payment success/failure
 * - Refunds
 * - Disputes
 * - Connect account updates
 * 
 * Configuration:
 * 1. In Stripe dashboard: Developers → Webhooks
 * 2. Add endpoint: https://youromain.com/api/webhooks/stripe
 * 3. Select events to listen for
 * 4. Copy the signing secret to STRIPE_WEBHOOK_SECRET in .env.local
 */

import {
  verifyWebhookSignature,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleChargeRefunded,
} from '@/lib/stripe-helpers';
import Stripe from 'stripe';
import supabaseAdmin from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return Response.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify the webhook signature
    const event = verifyWebhookSignature(body, signature);

    if (!event) {
      return Response.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    console.log(`Webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const credits = parseInt(session.metadata?.credits || '0', 10);
        const paymentIntentId = session.payment_intent?.toString() || session.id;

        if (!userId || !credits) {
          console.error('Missing metadata for credit purchase');
          break;
        }

        const { data: existing } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existing?.id) {
          break;
        }

        const { error: txError } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            amount: credits,
            description: `Credit purchase (${credits} credits)`,
            transaction_type: 'purchase',
            credit_source: 'purchase',
            stripe_payment_intent_id: paymentIntentId,
            can_cashout: false,
          });

        if (txError) {
          console.error('Failed to record credit purchase:', txError);
        }

        break;
      }
      // Payment successful
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        handlePaymentIntentSucceeded(paymentIntent);

        // TODO: Uncomment after implementing
        // const { userId, creditsAmount } = paymentIntent.metadata;
        // await recordTransaction(
        //   userId,
        //   parseInt(creditsAmount),
        //   'credit_purchase'
        // );
        break;
      }

      // Payment failed
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        handlePaymentIntentFailed(paymentIntent);
        break;
      }

      // Refund processed
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        handleChargeRefunded(charge);

        // TODO: Implement refund handling
        // 1. Find transaction in Supabase
        // 2. Mark as refunded
        // 3. Reverse credits
        // 4. Notify user
        break;
      }

      // Dispute created (chargeback)
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(`Dispute created for charge ${dispute.charge}`);

        // TODO: Implement dispute handling
        // 1. Flag transaction as disputed
        // 2. Hold credits in escrow
        // 3. Notify provider and requester
        // 4. Queue for moderation review
        break;
      }

      // Dispute resolved
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(`Dispute closed: ${dispute.id}, status: ${dispute.status}`);

        // TODO: Release escrowed credits based on dispute outcome
        break;
      }

      // Account updated (for Connect)
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        console.log(`Account ${account.id} updated`);

        // TODO: Update provider account status in Supabase
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
