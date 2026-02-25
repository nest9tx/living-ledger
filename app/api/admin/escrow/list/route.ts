import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    let query = supabaseAdmin
      .from("credit_escrow")
      .select(
        "id, request_id, offer_id, payer_id, provider_id, credits_held, status, release_available_at, buyer_confirmed_at, provider_marked_complete_at, dispute_status, dispute_reason, disputed_at, resolved_at, admin_note, tracking_carrier, tracking_number, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Admin escrow list error:", error);
      return Response.json({ error: "Failed to load escrows" }, { status: 500 });
    }

    return Response.json({ escrows: data || [] });
  } catch (error) {
    console.error("Admin escrow list error:", error);
    return Response.json({ error: "Failed to load escrows" }, { status: 500 });
  }
}
