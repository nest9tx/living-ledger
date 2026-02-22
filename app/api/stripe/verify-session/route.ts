import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/stripe/verify-session
 *
 * Called from the buy-credits success page to credit the user immediately.
 * Acts as a reliable fallback for webhook delivery failures.
 *
 * - Verifies the session is paid via Stripe API
 * - Confirms the session belongs to the authenticated user
 * - Idempotent: skips if already credited (checks stripe_payment_intent_id)
 * - Inserts a `transactions` row → DB trigger updates purchased_credits + credits_balance
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });

    // Retrieve session from Stripe to confirm payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed", status: session.payment_status },
        { status: 400 }
      );
    }

    // Confirm this session belongs to the authenticated user
    const sessionUserId = session.metadata?.user_id;
    if (!sessionUserId || sessionUserId !== user.id) {
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    const credits = parseInt(session.metadata?.credits || "0", 10);
    if (!credits || credits < 1) {
      return NextResponse.json({ error: "Invalid credits in session metadata" }, { status: 400 });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? session.id);

    // Idempotency check — already credited?
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existing?.id) {
      // Already credited (by webhook or previous verify call) — return success
      return NextResponse.json({
        success: true,
        credits,
        alreadyCredited: true,
        message: `${credits} credits are already in your balance.`,
      });
    }

    // Insert transaction — DB trigger (update_balance) handles profile update
    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: credits,
      description: `Credit purchase (${credits} credits)`,
      transaction_type: "purchase",
      credit_source: "purchase",
      stripe_payment_intent_id: paymentIntentId,
      can_cashout: false,
    });

    if (txError) {
      console.error("verify-session: transaction insert error:", txError);
      return NextResponse.json({ error: "Failed to credit account" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      credits,
      alreadyCredited: false,
      message: `${credits} credits added to your balance.`,
    });
  } catch (err) {
    console.error("verify-session error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
