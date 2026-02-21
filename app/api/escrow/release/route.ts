import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLATFORM_FEE_RATE = 0.15;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const escrowId = Number(body?.escrowId);

    if (!Number.isFinite(escrowId)) {
      return NextResponse.json({ error: "Invalid escrow ID" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("*")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return NextResponse.json({ error: "Escrow not found" }, { status: 404 });
    }

    // Check status
    if (escrow.status === "released" || escrow.status === "refunded") {
      return NextResponse.json({ error: "Escrow already processed" }, { status: 400 });
    }

    if (escrow.status === "disputed") {
      return NextResponse.json({ error: "Escrow is in dispute - contact admin" }, { status: 400 });
    }

    const isPayer = escrow.payer_id === user.id;
    const isProvider = escrow.provider_id === user.id;

    if (!isPayer && !isProvider) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ========== NEW RELEASE LOGIC ==========
    // Funds are released if:
    // 1. Status is "confirmed" (both parties agreed) - IMMEDIATE release
    // 2. Both parties confirmed AND 7 days have passed since delivery
    // 3. Admin has resolved a dispute in favor of provider
    // =======================================

    const now = new Date();
    const releaseAvailableAt = escrow.release_available_at ? new Date(escrow.release_available_at) : null;
    const bothConfirmed = escrow.payer_confirmed_at && escrow.provider_confirmed_at;

    // Check if in dispute
    if (escrow.status === "disputed") {
      return NextResponse.json(
        { error: "Escrow is in dispute - awaiting admin resolution" },
        { status: 400 }
      );
    }

    // Release is allowed when BOTH parties have confirmed AND 7 days have passed
    // since the order was placed. Confirmation alone does NOT bypass the window —
    // the safety period runs from purchase, not from delivery or confirmation.

    // Case 1: Both confirmed AND 7 days have passed → release
    if (bothConfirmed && releaseAvailableAt && now >= releaseAvailableAt) {
      return releaseEscrow(escrowId, user.id, escrow);
    }

    // Case 2: Both confirmed but 7-day window still active → tell them how long to wait
    if (bothConfirmed && releaseAvailableAt && now < releaseAvailableAt) {
      const daysRemaining = Math.ceil((releaseAvailableAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return NextResponse.json(
        {
          error: `Both parties confirmed! Funds will be available in ${daysRemaining} day(s) — the 7-day safety window runs from when the order was placed.`,
          status: "confirmed_pending",
          daysRemaining,
        },
        { status: 400 }
      );
    }

    // Case 3: Time has passed but not both confirmed - NO AUTO RELEASE
    if (releaseAvailableAt && now >= releaseAvailableAt && !bothConfirmed) {
      return NextResponse.json(
        {
          error: "Escrow requires mutual agreement to release. If there's an issue, please file a dispute.",
          status: "requires_agreement",
          canDispute: true,
        },
        { status: 400 }
      );
    }

    // Case 4: Still in initial "held" state
    if (escrow.status === "held") {
      return NextResponse.json(
        { error: "Awaiting delivery confirmation from buyer" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Invalid escrow state" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Escrow release error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to release escrow" },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function releaseEscrow(escrowId: number, userId: string, escrow: any) {
  const credits = (escrow.credits_held || 0) as number;
  if (credits <= 0) {
    return NextResponse.json({ error: "Invalid escrow amount" }, { status: 400 });
  }

  // Round to 2 decimal places to avoid floating-point drift (e.g. 10 * 0.15 = 1.4999999...)
  const platformFee = Math.round(credits * PLATFORM_FEE_RATE * 100) / 100;
  const providerCredits = Math.round((credits - platformFee) * 100) / 100;

  // Update escrow status
  const { error: updateError } = await supabaseAdmin
    .from("credit_escrow")
    .update({
      status: "released",
      released_at: new Date().toISOString(),
    })
    .eq("id", escrowId);

  if (updateError) {
    console.error("Failed to update escrow:", updateError);
    return NextResponse.json({ error: "Failed to release escrow" }, { status: 500 });
  }

  // Step 1: award the FULL escrow amount as earned.
  // Trigger adds `credits` to both earned_credits AND credits_balance.
  const { error: creditError } = await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: escrow.provider_id,
      amount: credits,
      transaction_type: "earned",
      credit_source: "earned",
      description: `Escrow released — ${escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`} (${credits} credits held)`,
      related_offer_id: escrow.offer_id ?? null,
      related_request_id: escrow.request_id ?? null,
      can_cashout: true,
    });

  if (creditError) {
    console.error("Failed to create earned transaction:", creditError);
  }

  // Step 2: deduct platform fee. credit_source: "earned" ensures the trigger
  // removes the fee from BOTH earned_credits and credits_balance — one clean deduction.
  if (platformFee > 0) {
    const { error: feeError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.provider_id,
        amount: -platformFee,
        transaction_type: "platform_fee",
        credit_source: "earned",
        description: `Platform fee (${Math.round(PLATFORM_FEE_RATE * 100)}%) from escrow release`,
        related_offer_id: escrow.offer_id ?? null,
        related_request_id: escrow.request_id ?? null,
        can_cashout: false,
      });

    if (feeError) {
      console.error("Failed to create platform fee transaction:", feeError);
    }
  }

  return NextResponse.json({
    success: true,
    escrowId,
    providerCredits,
    platformFee,
    message: "Escrow released successfully",
  });
}
