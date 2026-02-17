import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
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

    // Get user's Stripe account ID and connection time
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, stripe_connected_at")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_account_id) {
      return NextResponse.json({ 
        connected: false,
        status: null 
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    // Check if account is fully onboarded
    const isComplete = account.details_submitted && account.charges_enabled && account.payouts_enabled;

    // Update database with current status
    await supabaseAdmin
      .from("profiles")
      .update({
        stripe_account_status: isComplete ? "active" : "pending",
        stripe_onboarding_complete: isComplete,
        stripe_connected_at: isComplete ? (profile.stripe_connected_at || new Date().toISOString()) : null,
      })
      .eq("id", user.id);

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      status: isComplete ? "active" : "pending",
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error: unknown) {
    console.error("Stripe status check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 }
    );
  }
}
