import supabaseAdmin from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") as "offer" | "request";
    const id = url.searchParams.get("id");

    if (!type || !["offer", "request"].includes(type) || !id) {
      return Response.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const listingId = parseInt(id, 10);
    if (!Number.isFinite(listingId)) {
      return Response.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    const table = type === "offer" ? "offers" : "requests";

    // Fetch listing
    const { data: listing, error: listingError } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return Response.json({ error: "Listing not found" }, { status: 404 });
    }

    // Fetch user profile
    const { data: user } = await supabaseAdmin
      .from("profiles")
      .select("id, username, bio, avatar_url")
      .eq("id", listing.user_id)
      .single();

    // Fetch category
    let category = null;
    if (listing.category_id) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("id, name, icon")
        .eq("id", listing.category_id)
        .single();
      category = cat;
    }

    // Check if boosted
    const { data: boost } = await supabaseAdmin
      .from("listing_boosts")
      .select("id, boost_tier, expires_at")
      .eq("post_type", type)
      .eq("post_id", listingId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .single();

    // Fetch listing images
    const { data: images } = await supabaseAdmin
      .from("listing_images")
      .select("id, storage_path, filename, file_size, mime_type, upload_order")
      .eq("listing_type", type)
      .eq("listing_id", listingId)
      .order("upload_order", { ascending: true });

    // Derive quantity_remaining from active escrows when listing has a quantity cap
    let quantitySold = 0;
    let quantityRemaining: number | null = null;
    if (listing.quantity != null) {
      const escrowFilter = type === "offer" ? "offer_id" : "request_id";
      const { count: soldCount } = await supabaseAdmin
        .from("credit_escrow")
        .select("id", { count: "exact", head: true })
        .eq(escrowFilter, listingId)
        .not("status", "in", '("refunded","cancelled")');
      quantitySold = soldCount || 0;
      quantityRemaining = Math.max(0, listing.quantity - quantitySold);
    }

    return Response.json({
      listing: {
        ...listing,
        user,
        category,
        images: images || [],
        isBoosted: !!boost,
        boostTier: boost?.boost_tier || null,
        boostExpiresAt: boost?.expires_at || null,
        quantity_sold: quantitySold,
        quantity_remaining: quantityRemaining,
      },
    });
  } catch (error) {
    console.error("Listing detail error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load listing" },
      { status: 500 }
    );
  }
}
