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
    const { imageIds, listingId, listingType } = body;

    if (!imageIds || !Array.isArray(imageIds) || !listingId || !listingType) {
      return Response.json({ error: "Missing required fields: imageIds, listingId, listingType" }, { status: 400 });
    }

    const userId = userData.user.id;

    // Verify user owns the listing
    const table = listingType === "offer" ? "offers" : "requests";
    const { data: listing, error: listingError } = await supabaseAdmin
      .from(table)
      .select("user_id")
      .eq("id", listingId)
      .single();

    if (listingError || !listing || listing.user_id !== userId) {
      return Response.json({ error: "Listing not found or access denied" }, { status: 403 });
    }

    // Update the image records to associate them with the listing
    const { data, error } = await supabaseAdmin
      .from("listing_images")
      .update({ listing_id: listingId })
      .in("id", imageIds)
      .eq("user_id", userId)
      .eq("listing_type", listingType)
      .is("listing_id", null) // Only update temporary uploads
      .select();

    if (error) {
      console.error("Failed to associate images with listing:", error);
      return Response.json({ error: "Failed to associate images" }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      associatedCount: data?.length || 0 
    });

  } catch (error) {
    console.error("Associate listing images error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}