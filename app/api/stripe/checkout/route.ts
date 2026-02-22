import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const STRIPE_FEE_PERCENT = 0.029;
const STRIPE_FEE_FLAT_CENTS = 30;

function calculateProcessingFee(creditCents: number) {
  const totalCents = Math.ceil(
    (creditCents + STRIPE_FEE_FLAT_CENTS) / (1 - STRIPE_FEE_PERCENT)
  );
  return Math.max(totalCents - creditCents, 0);
}

export async function POST(req: Request) {
  try {
    if (!stripeSecretKey) {
      return Response.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const credits = Number(body.credits);
    const coverFees = body.coverFees !== false;

    // Maximum 500 credits per transaction
    if (!Number.isFinite(credits) || credits < 1 || credits > 500) {
      return Response.json(
        { error: "Invalid credits amount (min: 1, max: 500 per purchase)" },
        { status: 400 }
      );
    }

    // Rate limit: max 3 purchases per 24 hours to reduce card fraud risk
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentPurchases } = await supabaseAdmin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .eq("transaction_type", "purchase")
      .gte("created_at", since);

    if ((recentPurchases ?? 0) >= 3) {
      return Response.json(
        { error: "Purchase limit reached. You can make up to 3 credit purchases every 24 hours. Please try again later or contact support@livingledger.org if you need assistance." },
        { status: 429 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-01-28.clover",
    });

    const creditCents = Math.round(credits * 100);
    const feeCents = coverFees ? calculateProcessingFee(creditCents) : 0;

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Living Ledger Credits (${credits})`,
          },
          unit_amount: creditCents,
        },
        quantity: 1,
      },
    ];

    if (feeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Processing fee",
          },
          unit_amount: feeCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${origin}/buy-credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/buy-credits/cancel`,
      metadata: {
        type: "credit_purchase",
        user_id: userData.user.id,
        credits: String(credits),
        fee_cents: String(feeCents),
        cover_fees: String(coverFees),
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
