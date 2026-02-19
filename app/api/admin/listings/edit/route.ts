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

    const { listing_id, listing_type, title, description, price_credits } =
      await req.json();

    if (!listing_id || !listing_type)
      return Response.json({ error: "Missing listing_id or listing_type" }, { status: 400 });

    const table = listing_type === "offer" ? "offers" : "requests";
    const creditField = listing_type === "offer" ? "price_credits" : "budget_credits";

    const updateData: Record<string, unknown> = {};
    if (title !== undefined && title !== "") updateData.title = title;
    if (description !== undefined && description !== "") updateData.description = description;
    if (price_credits !== undefined && price_credits !== "")
      updateData[creditField] = Number(price_credits);

    if (Object.keys(updateData).length === 0)
      return Response.json({ error: "No fields to update" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from(table)
      .update(updateData)
      .eq("id", listing_id);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Admin edit listing error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
