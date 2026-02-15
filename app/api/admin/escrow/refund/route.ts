import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

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
      .select("id, payer_id, credits_held, status, offer_id, request_id")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    if (escrow.status === "released" || escrow.status === "refunded") {
      return Response.json({ error: "Escrow already finalized" }, { status: 400 });
    }

    const credits = escrow.credits_held || 0;
    if (credits < 1) {
      return Response.json({ error: "Invalid escrow amount" }, { status: 400 });
    }

    const { error: refundError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.payer_id,
        amount: credits,
        description: `Escrow refund (${credits})`,
        transaction_type: "refund",
        related_offer_id: escrow.offer_id,
        related_request_id: escrow.request_id,
        can_cashout: false,
      });

    if (refundError) {
      console.error("Admin refund error:", refundError);
      return Response.json({ error: "Failed to refund" }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "refunded",
        resolved_at: new Date().toISOString(),
        admin_note: adminNote,
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Admin escrow update error:", updateError);
      return Response.json({ error: "Failed to update escrow" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin refund error:", error);
    return Response.json({ error: "Failed to refund escrow" }, { status: 500 });
  }
}
