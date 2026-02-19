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
      .update({ active: false })
      .eq("listing_id", listing_id)
      .eq("listing_type", listing_type)
      .eq("active", true);

    // Insert a free 24-hour homepage boost
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error } = await supabaseAdmin.from("listing_boosts").insert({
      listing_id,
      listing_type,
      boost_type: "homepage",
      active: true,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      credits_spent: 0,
      admin_granted: true,
    });

    if (error) {
      // If expires_at or admin_granted columns don't exist, try without them
      const { error: fallbackError } = await supabaseAdmin
        .from("listing_boosts")
        .insert({
          listing_id,
          listing_type,
          boost_type: "homepage",
          active: true,
        });
      if (fallbackError)
        return Response.json({ error: fallbackError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Admin boost listing error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
