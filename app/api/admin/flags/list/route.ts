import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

export async function GET(req: Request) {
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "open";

    const { data: flags, error: flagsError } = await supabaseAdmin
      .from("flagged_listings")
      .select("id, reporter_id, post_type, post_id, reason, status, created_at")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (flagsError) {
      console.error("Flag list error:", flagsError);
      return Response.json({ error: "Failed to load flags" }, { status: 500 });
    }

    const flagsList = flags || [];
    const offerIds = flagsList
      .filter((flag) => flag.post_type === "offer")
      .map((flag) => flag.post_id);
    const requestIds = flagsList
      .filter((flag) => flag.post_type === "request")
      .map((flag) => flag.post_id);

    const [offersResult, requestsResult] = await Promise.all([
      offerIds.length
        ? supabaseAdmin
            .from("offers")
            .select("id, title, description, price_credits, category_id, user_id, created_at")
            .in("id", offerIds)
        : Promise.resolve({ data: [] as { id: number; title: string; description: string | null; price_credits: number | null; category_id: number | null; user_id: string; created_at: string }[] }),
      requestIds.length
        ? supabaseAdmin
            .from("requests")
            .select("id, title, description, budget_credits, category_id, user_id, created_at")
            .in("id", requestIds)
        : Promise.resolve({ data: [] as { id: number; title: string; description: string | null; budget_credits: number | null; category_id: number | null; user_id: string; created_at: string }[] }),
    ]);

    const offerMap = (offersResult.data || []).reduce((acc, offer) => {
      acc[offer.id] = offer;
      return acc;
    }, {} as Record<number, { id: number; title: string; description: string | null; price_credits: number | null; category_id: number | null; user_id: string; created_at: string }>);

    const requestMap = (requestsResult.data || []).reduce((acc, request) => {
      acc[request.id] = request;
      return acc;
    }, {} as Record<number, { id: number; title: string; description: string | null; budget_credits: number | null; category_id: number | null; user_id: string; created_at: string }>);

    const items = flagsList.map((flag) => {
      if (flag.post_type === "offer") {
        const listing = offerMap[flag.post_id];
        return {
          ...flag,
          listingTitle: listing?.title || "Listing not found",
          listingDescription: listing?.description || null,
          listingCredits: listing?.price_credits || null,
          listingUserId: listing?.user_id || null,
          listingCreatedAt: listing?.created_at || null,
        };
      }

      const listing = requestMap[flag.post_id];
      return {
        ...flag,
        listingTitle: listing?.title || "Listing not found",
        listingDescription: listing?.description || null,
        listingCredits: listing?.budget_credits || null,
        listingUserId: listing?.user_id || null,
        listingCreatedAt: listing?.created_at || null,
      };
    });

    return Response.json({ flags: items });
  } catch (error) {
    console.error("Flag list error:", error);
    return Response.json({ error: "Failed to load flags" }, { status: 500 });
  }
}
