import Stripe from "stripe";
import supabase from "@/lib/supabase";

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

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const credits = Number(body.credits);
    const coverFees = body.coverFees !== false;

    if (!Number.isFinite(credits) || credits < 1 || credits > 10000) {
      return Response.json(
        { error: "Invalid credits amount" },
        { status: 400 }
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
