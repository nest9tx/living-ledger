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

    const fallbackUsername =
      (user.user_metadata as { username?: string } | undefined)?.username ||
      (user.email ? user.email.split("@")[0] : "user");

    // Check if user already has Stripe Connect account
    let { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, username")
      .eq("id", user.id)
      .single();

    if (!profile) {
      const { data: createdProfile } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: user.id,
            username: fallbackUsername,
            onboarding_complete: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select("stripe_account_id, username")
        .single();

      profile = createdProfile || null;
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let accountId = profile.stripe_account_id;

    // Create Stripe Connect account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express", // Express accounts are simpler for users
        country: "US",
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          user_id: user.id,
          username: profile.username || fallbackUsername,
        },
      });

      accountId = account.id;

      // Save account ID to profile
      await supabaseAdmin
        .from("profiles")
        .update({ 
          stripe_account_id: accountId,
          stripe_account_status: "pending",
        })
        .eq("id", user.id);
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    if (!origin.startsWith("http")) {
      return NextResponse.json(
        { error: "Missing or invalid app URL. Set NEXT_PUBLIC_APP_URL to https://your-domain.com" },
        { status: 400 }
      );
    }

    // Create account link for onboarding/re-authentication
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/settings?stripe_refresh=true`,
      return_url: `${origin}/settings?stripe_connected=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ 
      url: accountLink.url,
      accountId 
    });
  } catch (error: unknown) {
    console.error("Stripe Connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Connect account" },
      { status: 500 }
    );
  }
}
