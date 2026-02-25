import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

/**
 * POST /api/admin/escrow/cancel-dispute
 *
 * Dismisses a dispute without releasing or refunding — returns the escrow
 * to "held" status so the normal completion flow can proceed.
 * Use when a dispute is frivolous, resolved privately, or filed in error.
 */
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
      return Response.json({ error: "Invalid escrow ID" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("id, status")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    if (!["disputed"].includes(escrow.status)) {
      return Response.json(
        { error: `Cannot cancel dispute — current status is "${escrow.status}"` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "held",
        dispute_reason: null,
        dispute_status: "cancelled",
        resolved_at: new Date().toISOString(),
        admin_note: adminNote,
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Cancel dispute update error:", updateError);
      return Response.json({ error: "Failed to cancel dispute" }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: "Dispute cancelled. Escrow returned to held status.",
    });
  } catch (error) {
    console.error("Cancel dispute error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to cancel dispute" },
      { status: 500 }
    );
  }
}
