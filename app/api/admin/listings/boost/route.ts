import supabaseAdmin from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: admin } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (!admin?.is_admin)
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const { listing_id, listing_type } = await req.json();

    if (!listing_id || !listing_type)
      return Response.json({ error: "Missing listing_id or listing_type" }, { status: 400 });

    // Deactivate any existing active boosts first to avoid duplicates
    await supabaseAdmin
      .from("listing_boosts")
      .update({ is_active: false })
      .eq("post_id", listing_id)
      .eq("post_type", listing_type)
      .eq("is_active", true);

    // Insert a free 24-hour homepage boost
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { error } = await supabaseAdmin.from("listing_boosts").insert({
      post_id: listing_id,
      post_type: listing_type,
      boost_tier: "homepage",
      is_active: true,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      credits_spent: 0,
      duration_hours: 24,
    });

    if (error) {
      console.error("Admin boost insert error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Admin boost listing error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
