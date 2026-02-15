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
    const flagId = Number(body?.flagId);
    const action = body?.action === "dismiss" ? "dismiss" : body?.action === "remove" ? "remove" : null;
    const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim() : null;

    if (!Number.isFinite(flagId) || !action) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const { data: flag, error: flagError } = await supabaseAdmin
      .from("flagged_listings")
      .select("id, post_type, post_id, status")
      .eq("id", flagId)
      .maybeSingle();

    if (flagError || !flag) {
      return Response.json({ error: "Flag not found" }, { status: 404 });
    }

    if (flag.status !== "open") {
      return Response.json({ error: "Flag already resolved" }, { status: 400 });
    }

    if (action === "remove") {
      const table = flag.post_type === "offer" ? "offers" : "requests";
      await supabaseAdmin.from(table).delete().eq("id", flag.post_id);
    }

    const { error: updateError } = await supabaseAdmin
      .from("flagged_listings")
      .update({
        status: "resolved",
        action_taken: action,
        admin_id: userData.user.id,
        admin_note: adminNote || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", flagId);

    if (updateError) {
      console.error("Flag resolve error:", updateError);
      return Response.json({ error: "Failed to resolve flag" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Flag resolve error:", error);
    return Response.json({ error: "Failed to resolve flag" }, { status: 500 });
  }
}
