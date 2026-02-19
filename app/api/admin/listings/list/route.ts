import supabaseAdmin from "@/lib/supabase-admin";

export async function GET(req: Request) {
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

    // Fetch all active offers and requests
    const [offersRes, requestsRes, boostsRes] = await Promise.all([
      supabaseAdmin
        .from("offers")
        .select("id, title, description, price_credits, status, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("requests")
        .select("id, title, description, budget_credits, status, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("listing_boosts")
        .select("id, listing_id, listing_type, boost_type, active, created_at")
        .eq("active", true),
    ]);

    // Get all unique user IDs to resolve usernames
    const userIds = [
      ...new Set([
        ...(offersRes.data || []).map((o) => o.user_id),
        ...(requestsRes.data || []).map((r) => r.user_id),
      ]),
    ];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    const usernameMap = (profiles || []).reduce(
      (acc, p) => { acc[p.id] = p.username; return acc; },
      {} as Record<string, string>
    );

    const boostedIds = new Set(
      (boostsRes.data || []).map((b) => `${b.listing_type}:${b.listing_id}`)
    );

    const offers = (offersRes.data || []).map((o) => ({
      ...o,
      listing_type: "offer",
      username: usernameMap[o.user_id] || "Unknown",
      is_boosted: boostedIds.has(`offer:${o.id}`),
      display_credits: o.price_credits,
    }));

    const requests = (requestsRes.data || []).map((r) => ({
      ...r,
      listing_type: "request",
      username: usernameMap[r.user_id] || "Unknown",
      is_boosted: boostedIds.has(`request:${r.id}`),
      display_credits: r.budget_credits,
    }));

    return Response.json({
      offers,
      requests,
      active_boosts: boostsRes.data || [],
    });
  } catch (error) {
    console.error("Admin listings list error:", error);
    return Response.json({ error: "Failed to load listings" }, { status: 500 });
  }
}
