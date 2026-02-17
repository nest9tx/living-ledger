import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { User } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  let user: User | null = null;
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    user = authUser;

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
    // If account doesn't exist or was deleted, clear it from database
    if (error instanceof Error && (error.message.includes("No such account") || error.message.includes("does not exist"))) {
      console.log("Stripe account not found, clearing orphaned account ID");
      
      if (user) {
        await supabaseAdmin
          .from("profiles")
          .update({
            stripe_account_id: null,
            stripe_account_status: null,
            stripe_onboarding_complete: false,
            stripe_connected_at: null,
          })
          .eq("id", user.id);
      }
      
      // Return "not connected" status so UI shows connect button
      return NextResponse.json({ 
        connected: false,
        status: null 
      });
    }

    console.error("Stripe status check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 }
    );
  }
}
