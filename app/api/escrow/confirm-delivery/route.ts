import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAFETY_HOLD_DAYS = 7;

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

    // Only payer (buyer) can confirm delivery
    if (escrow.payer_id !== user.id) {
      return NextResponse.json(
        { error: "Only the buyer can confirm delivery" },
        { status: 403 }
      );
    }

    // Must be in "held" status to mark as delivered
    if (escrow.status !== "held") {
      return NextResponse.json(
        { error: "Escrow must be in 'held' status to confirm delivery" },
        { status: 400 }
      );
    }

    const now = new Date();
    const releaseAvailableAt = new Date(now.getTime() + SAFETY_HOLD_DAYS * 24 * 60 * 60 * 1000);

    // Update escrow: mark as delivered and set release availability
    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "delivered",
        delivered_at: now.toISOString(),
        payer_confirmed_at: now.toISOString(),
        release_available_at: releaseAvailableAt.toISOString(),
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Failed to confirm delivery:", updateError);
      return NextResponse.json({ error: "Failed to confirm delivery" }, { status: 500 });
    }

    // Log transaction
    await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.payer_id,
        type: "escrow_delivered",
        credits: 0,
        description: `Confirmed delivery for ${escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`}. Safety hold: 7 days`,
        related_escrow_id: escrowId,
      });

    return NextResponse.json({
      success: true,
      escrowId,
      status: "delivered",
      releaseAvailableAt: releaseAvailableAt.toISOString(),
      message: `Delivery confirmed. Funds will auto-release in ${SAFETY_HOLD_DAYS} days unless disputed.`,
    });
  } catch (error: unknown) {
    console.error("Confirm delivery error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm delivery" },
      { status: 500 }
    );
  }
}
