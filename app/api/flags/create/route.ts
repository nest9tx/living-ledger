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
    const postId = Number(body?.postId);
    const postType = body?.postType === "offer" ? "offer" : body?.postType === "request" ? "request" : null;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!Number.isFinite(postId) || !postType) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const table = postType === "offer" ? "offers" : "requests";
    const { data: listing, error: listingError } = await supabaseAdmin
      .from(table)
      .select("id, user_id")
      .eq("id", postId)
      .maybeSingle();

    if (listingError || !listing) {
      return Response.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.user_id === userData.user.id) {
      return Response.json({ error: "You cannot report your own listing" }, { status: 400 });
    }

    const { error: flagError } = await supabaseAdmin
      .from("flagged_listings")
      .insert({
        reporter_id: userData.user.id,
        post_type: postType,
        post_id: postId,
        reason: reason || null,
        status: "open",
      });

    if (flagError) {
      console.error("Flag create error:", flagError);
      return Response.json({ error: "Failed to flag listing" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Flag create error:", error);
    return Response.json({ error: "Failed to flag listing" }, { status: 500 });
  }
}
