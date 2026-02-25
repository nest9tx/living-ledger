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
    const id = Number(body?.id);
    const type = body?.type as "offer" | "request" | undefined;
    const addQuantity = Number(body?.addQuantity);
    const extendDays: number = Number(body?.extendDays) || 0;

    if (!Number.isFinite(id) || !["offer", "request"].includes(type as string)) {
      return Response.json({ error: "Invalid parameters" }, { status: 400 });
    }

    if (!Number.isFinite(addQuantity) || addQuantity < 1 || addQuantity > 1000) {
      return Response.json({ error: "addQuantity must be between 1 and 1000" }, { status: 400 });
    }

    const table = type === "offer" ? "offers" : "requests";

    // Verify ownership
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from(table)
      .select("id, user_id, quantity, expires_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !listing) {
      return Response.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.user_id !== userData.user.id) {
      return Response.json({ error: "Not your listing" }, { status: 403 });
    }

    // Build update payload
    const currentQty = listing.quantity ?? 0;
    const newQty = currentQty + addQuantity;

    const updates: Record<string, unknown> = { quantity: newQty, is_sold_out: false };

    if (extendDays > 0) {
      const base = listing.expires_at
        ? Math.max(new Date(listing.expires_at).getTime(), Date.now())
        : Date.now();
      updates.expires_at = new Date(base + extendDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("Restock error:", updateError);
      return Response.json({ error: "Failed to restock listing" }, { status: 500 });
    }

    return Response.json({ success: true, newQuantity: newQty });
  } catch (error) {
    console.error("Restock route error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
