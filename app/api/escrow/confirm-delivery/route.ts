import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Must be in "held" status to mark as delivered OR "delivered" status to confirm satisfaction
    if (escrow.status !== "held" && escrow.status !== "delivered") {
      return NextResponse.json(
        { error: "Escrow must be in 'held' or 'delivered' status to confirm" },
        { status: 400 }
      );
    }

    // If already in delivered status, this is a satisfaction confirmation
    if (escrow.status === "delivered") {
      if (escrow.payer_confirmed_at) {
        return NextResponse.json(
          { error: "You have already confirmed satisfaction" },
          { status: 400 }
        );
      }

      // Just update payer_confirmed_at for satisfaction confirmation
      const now = new Date();
      const newStatus = escrow.provider_confirmed_at ? "confirmed" : "delivered";

      const { error: updateError } = await supabaseAdmin
        .from("credit_escrow")
        .update({
          status: newStatus,
          payer_confirmed_at: now.toISOString(),
        })
        .eq("id", escrowId);

      if (updateError) {
        console.error("Failed to confirm satisfaction:", updateError);
        return NextResponse.json({ error: "Failed to confirm satisfaction" }, { status: 500 });
      }

      // Log transaction
      await supabaseAdmin
        .from("transactions")
        .insert({
          user_id: escrow.payer_id,
          type: "escrow_confirmed",
          credits: 0,
          description: `Confirmed satisfaction for ${escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`}${newStatus === "confirmed" ? " - Both parties confirmed, funds ready to release" : ""}`,
          related_escrow_id: escrowId,
        });

      return NextResponse.json({
        success: true,
        escrowId,
        status: newStatus,
        bothConfirmed: newStatus === "confirmed",
        message: newStatus === "confirmed" 
          ? "Both parties confirmed! You can now release funds immediately or wait for auto-release."
          : "Satisfaction confirmed! Awaiting provider confirmation for instant release.",
      });
    }

    const now = new Date();
    // Do NOT reset release_available_at here — it was set at purchase time
    // (purchase date + 7 days) and must not be extended on delivery confirmation.
    // The safety window runs from when money changed hands, not when delivery happened.

    // Update escrow: mark as delivered, preserve original release date
    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "delivered",
        delivered_at: now.toISOString(),
        payer_confirmed_at: now.toISOString(),
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
      releaseAvailableAt: escrow.release_available_at,
      message: `Delivery confirmed. Funds release on the original schedule (7 days from order date).`,
    });
  } catch (error: unknown) {
    console.error("Confirm delivery error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm delivery" },
      { status: 500 }
    );
  }
}
