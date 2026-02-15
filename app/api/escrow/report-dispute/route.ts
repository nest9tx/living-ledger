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

    const body = await req.json();
    const escrowId = Number(body?.escrowId);
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!Number.isFinite(escrowId)) {
      return Response.json({ error: "Invalid escrow" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("id, payer_id, provider_id, status")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    if (escrow.payer_id !== userData.user.id && escrow.provider_id !== userData.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (escrow.status === "released" || escrow.status === "refunded") {
      return Response.json({ error: "Escrow already finalized" }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "disputed",
        dispute_status: "open",
        dispute_reason: reason || null,
        disputed_at: new Date().toISOString(),
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Dispute update error:", updateError);
      return Response.json({ error: "Failed to open dispute" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Report dispute error:", error);
    return Response.json({ error: "Failed to open dispute" }, { status: 500 });
  }
}
