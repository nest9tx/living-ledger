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

    // Only provider (seller) can confirm completion
    if (escrow.provider_id !== user.id) {
      return NextResponse.json(
        { error: "Only the service provider can confirm completion" },
        { status: 403 }
      );
    }

    // Must be in "delivered" status to confirm completion
    if (escrow.status !== "delivered") {
      return NextResponse.json(
        { error: "Escrow must be in 'delivered' status to confirm completion" },
        { status: 400 }
      );
    }

    if (escrow.provider_confirmed_at) {
      return NextResponse.json(
        { error: "You have already confirmed completion" },
        { status: 400 }
      );
    }

    const now = new Date();
    const newStatus = escrow.payer_confirmed_at ? "confirmed" : "delivered";

    // Update escrow: mark provider as confirmed
    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: newStatus,
        provider_confirmed_at: now.toISOString(),
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Failed to confirm completion:", updateError);
      return NextResponse.json({ error: "Failed to confirm completion" }, { status: 500 });
    }

    // Log transaction
    await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.provider_id,
        type: "escrow_confirmed",
        credits: 0,
        description: `Confirmed completion for ${escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`}${newStatus === "confirmed" ? " - Both parties confirmed, funds ready to release" : ""}`,
        related_escrow_id: escrowId,
      });

    return NextResponse.json({
      success: true,
      escrowId,
      status: newStatus,
      bothConfirmed: newStatus === "confirmed",
      message:
        newStatus === "confirmed"
          ? "Both parties confirmed! You can now release funds immediately or wait for auto-release."
          : "Completion confirmed. Awaiting buyer confirmation for instant release.",
    });
  } catch (error: unknown) {
    console.error("Confirm completion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm completion" },
      { status: 500 }
    );
  }
}
