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

    if (!Number.isFinite(escrowId)) {
      return Response.json({ error: "Invalid escrow" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("id, provider_id, status")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    if (escrow.provider_id !== userData.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (escrow.status !== "held") {
      return Response.json({ error: "Escrow not in held status" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({ status: "delivered", provider_marked_complete_at: now })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Escrow update error:", updateError);
      return Response.json({ error: "Failed to update escrow" }, { status: 500 });
    }

    return Response.json({ status: "delivered", providerMarkedCompleteAt: now });
  } catch (error) {
    console.error("Mark delivered error:", error);
    return Response.json({ error: "Failed to mark delivered" }, { status: 500 });
  }
}
