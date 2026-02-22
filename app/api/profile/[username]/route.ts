import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    // Fetch profile by username (public fields only)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, username, bio, average_rating, total_ratings, total_contributions, created_at")
      .eq("username", username)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count completed orders (buyer or provider) for tier calculation
    const { count: completedOrders } = await supabaseAdmin
      .from("credit_escrow")
      .select("id", { count: "exact", head: true })
      .or(`payer_id.eq.${profile.id},provider_id.eq.${profile.id}`)
      .eq("status", "released");

    // Determine trust tier
    const ratings = profile.total_ratings ?? 0;
    const orders = completedOrders ?? 0;
    let tier: "new" | "active" | "trusted";
    if (ratings >= 5) {
      tier = "trusted";
    } else if (orders >= 1) {
      tier = "active";
    } else {
      tier = "new";
    }

    // Fetch active offers (offers table has no status column)
    const { data: offers } = await supabaseAdmin
      .from("offers")
      .select("id, title, description, price_credits, category_id, created_at")
      .eq("user_id", profile.id)
      .neq("suspended", true)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch active requests
    const { data: requests } = await supabaseAdmin
      .from("requests")
      .select("id, title, description, budget_credits, category_id, created_at, status")
      .eq("user_id", profile.id)
      .neq("suspended", true)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(50);

    // Enrich listings with category names
    const allCategoryIds = [
      ...new Set([
        ...(offers || []).map((o) => o.category_id).filter(Boolean),
        ...(requests || []).map((r) => r.category_id).filter(Boolean),
      ]),
    ];

    let categoryMap: Record<number, { name: string; icon: string }> = {};
    if (allCategoryIds.length > 0) {
      const { data: categories } = await supabaseAdmin
        .from("categories")
        .select("id, name, icon")
        .in("id", allCategoryIds);
      categoryMap = (categories || []).reduce(
        (acc, c) => ({ ...acc, [c.id]: { name: c.name, icon: c.icon } }),
        {}
      );
    }

    const enrichedOffers = (offers || []).map((o) => ({
      ...o,
      type: "offer" as const,
      credits: o.price_credits,
      category: o.category_id ? categoryMap[o.category_id] ?? null : null,
    }));

    const enrichedRequests = (requests || []).map((r) => ({
      ...r,
      type: "request" as const,
      credits: r.budget_credits,
      category: r.category_id ? categoryMap[r.category_id] ?? null : null,
    }));

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        bio: profile.bio ?? null,
        averageRating: profile.average_rating ?? 0,
        totalRatings: profile.total_ratings ?? 0,
        totalContributions: profile.total_contributions ?? 0,
        completedOrders: orders,
        memberSince: profile.created_at,
        tier,
      },
      listings: {
        offers: enrichedOffers,
        requests: enrichedRequests,
      },
    });
  } catch (err) {
    console.error("Profile API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
