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

    // Case 1: Status is "confirmed" (both parties agreed) - IMMEDIATE release
    if (escrow.status === "confirmed" && bothConfirmed) {
      return releaseEscrow(escrowId, user.id, escrow);
    }

    // Case 2: Both confirmed AND 7 days have passed - Standard release condition
    if (bothConfirmed && releaseAvailableAt && now >= releaseAvailableAt) {
      return releaseEscrow(escrowId, user.id, escrow);
    }

    // Case 3: Both confirmed but 7 days hasn't passed yet (non-confirmed status)
    if (bothConfirmed && releaseAvailableAt && escrow.status !== "confirmed") {
      const daysRemaining = Math.ceil((releaseAvailableAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return NextResponse.json(
        {
          error: `Both parties confirmed! Funds will be released in ${daysRemaining} day(s) (minimum 7-day safety period)`,
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
  if (credits < 1) {
    return NextResponse.json({ error: "Invalid escrow amount" }, { status: 400 });
  }

  const fee = Math.floor(credits * PLATFORM_FEE_RATE);
  const providerCredits = Math.max(credits - fee, 0);

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

  // Award credits to provider
  const { error: creditError } = await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: escrow.provider_id,
      type: "escrow_release",
      credits: providerCredits,
      description: `Escrow released for ${escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`}. Platform fee: ${fee} credits`,
      related_escrow_id: escrowId,
    });

  if (creditError) {
    console.error("Failed to create transaction:", creditError);
  }

  // Record platform fee
  await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: escrow.payer_id,
      type: "platform_fee",
      credits: -fee,
      description: `Platform fee (${Math.round(PLATFORM_FEE_RATE * 100)}%) from escrow release`,
      related_escrow_id: escrowId,
    });

  return NextResponse.json({
    success: true,
    escrowId,
    providerCredits,
    platformFee: fee,
    message: "Escrow released successfully",
  });
}
