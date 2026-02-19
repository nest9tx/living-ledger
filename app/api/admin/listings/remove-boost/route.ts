import supabaseAdmin from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: admin } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (!admin?.is_admin) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { listing_id, listing_type } = await req.json();

    if (!listing_id || !listing_type) {
      return Response.json({ error: "listing_id and listing_type required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("listing_boosts")
      .update({ is_active: false })
      .eq("post_id", listing_id)
      .eq("post_type", listing_type)
      .eq("is_active", true);

    if (error) {
      console.error("Remove boost error:", error);
      return Response.json({ error: "Failed to remove boost" }, { status: 500 });
    }

    return Response.json({ success: true, message: `Boost removed from ${listing_type} #${listing_id}` });
  } catch (error) {
    console.error("Admin remove boost error:", error);
    return Response.json({ error: "Failed to remove boost" }, { status: 500 });
  }
}
