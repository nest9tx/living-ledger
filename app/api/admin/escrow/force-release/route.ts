import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

const PLATFORM_FEE_RATE = 0.15;

export async function POST(req: Request) {
  try {
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const escrowId = Number(body?.escrowId);
    const adminNote = body?.adminNote || null;

    if (!Number.isFinite(escrowId)) {
      return Response.json({ error: "Invalid escrow" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("id, provider_id, credits_held, status, offer_id, request_id")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    if (escrow.status === "released") {
      return Response.json({ error: "Escrow already released" }, { status: 400 });
    }

    const credits = escrow.credits_held || 0;
    const fee = Math.round(credits * PLATFORM_FEE_RATE);
    const providerCredits = Math.max(credits - fee, 0);

    const { error: earnedError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.provider_id,
        amount: providerCredits,
        description: `Escrow release (${credits})`,
        transaction_type: "earned",
        credit_source: "earned",
        related_offer_id: escrow.offer_id,
        related_request_id: escrow.request_id,
        can_cashout: true,
      });

    if (earnedError) {
      console.error("Admin release credit error:", earnedError);
      return Response.json({ error: "Failed to credit provider" }, { status: 500 });
    }

    if (fee > 0) {
      const { error: feeError } = await supabaseAdmin.from("transactions").insert({
        user_id: escrow.provider_id,
        amount: -fee,
        description: "Platform fee (15%)",
        transaction_type: "platform_fee",
        related_offer_id: escrow.offer_id,
        related_request_id: escrow.request_id,
        can_cashout: false,
      });

      if (feeError) {
        console.error("Admin fee error:", feeError);
        return Response.json({ error: "Failed to apply platform fee" }, { status: 500 });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "released",
        dispute_status: "resolved",
        resolved_at: new Date().toISOString(),
        admin_note: adminNote,
        released_at: new Date().toISOString(),
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Admin escrow update error:", updateError);
      return Response.json({ error: "Failed to update escrow" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin force release error:", error);
    return Response.json({ error: "Failed to release escrow" }, { status: 500 });
  }
}
