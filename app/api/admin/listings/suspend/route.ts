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

    const { listing_id, listing_type, suspend } = await req.json();

    if (!listing_id || !listing_type || suspend === undefined)
      return Response.json(
        { error: "Missing listing_id, listing_type, or suspend" },
        { status: 400 }
      );

    const table = listing_type === "offer" ? "offers" : "requests";

    const { error } = await supabaseAdmin
      .from(table)
      .update({ suspended: suspend })
      .eq("id", listing_id);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    // Also deactivate boosts when suspending
    if (suspend) {
      await supabaseAdmin
        .from("listing_boosts")
        .update({ active: false })
        .eq("listing_id", listing_id)
        .eq("listing_type", listing_type)
        .eq("active", true);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Admin suspend listing error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
