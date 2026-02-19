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

    const table = listing_type === "offer" ? "offers" : "requests";

    // Remove any active boosts first
    await supabaseAdmin
      .from("listing_boosts")
      .update({ active: false })
      .eq("listing_id", listing_id)
      .eq("listing_type", listing_type);

    // Delete the listing
    const { error: deleteError } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", listing_id);

    if (deleteError) {
      console.error("Delete listing error:", deleteError);
      return Response.json({ error: "Failed to delete listing" }, { status: 500 });
    }

    return Response.json({ success: true, message: `${listing_type} #${listing_id} deleted` });
  } catch (error) {
    console.error("Admin delete listing error:", error);
    return Response.json({ error: "Failed to delete listing" }, { status: 500 });
  }
}
