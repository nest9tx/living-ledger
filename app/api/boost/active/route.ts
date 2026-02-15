import supabaseAdmin from "@/lib/supabase-admin";

type OfferRow = {
  id: number;
  title: string;
  description: string | null;
  price_credits: number | null;
  category_id: number | null;
  created_at: string;
  user_id: string;
};

type RequestRow = {
  id: number;
  title: string;
  description: string | null;
  budget_credits: number | null;
  category_id: number | null;
  created_at: string;
  user_id: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tier = url.searchParams.get("tier");
    const categoryId = url.searchParams.get("categoryId");

    // Expire old boosts
    await supabaseAdmin
      .from("listing_boosts")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("expires_at", new Date().toISOString());

    let query = supabaseAdmin
      .from("listing_boosts")
      .select("id, post_type, post_id, boost_tier, category_id, expires_at, credits_spent")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(20);

    if (tier === "homepage" || tier === "category") {
      query = query.eq("boost_tier", tier);
    }

    if (categoryId) {
      query = query.eq("category_id", Number(categoryId));
    }

    const { data: boosts, error } = await query;
    if (error) {
      console.error("Boost fetch error:", error);
      return Response.json({ error: "Failed to load boosts" }, { status: 500 });
    }

    const boostList = boosts || [];
    const offerIds = boostList
      .filter((b) => b.post_type === "offer")
      .map((b) => b.post_id);
    const requestIds = boostList
      .filter((b) => b.post_type === "request")
      .map((b) => b.post_id);

    const [offersResult, requestsResult, categoriesResult] = await Promise.all([
      offerIds.length
        ? supabaseAdmin
            .from("offers")
            .select("id, title, description, price_credits, category_id, created_at, user_id")
            .in("id", offerIds)
        : Promise.resolve({ data: [] as OfferRow[] }),
      requestIds.length
        ? supabaseAdmin
            .from("requests")
            .select("id, title, description, budget_credits, category_id, created_at, user_id")
            .in("id", requestIds)
        : Promise.resolve({ data: [] as RequestRow[] }),
      supabaseAdmin
        .from("categories")
        .select("id, name, icon"),
    ]);

    const categoryMap = (categoriesResult.data || []).reduce((acc, cat) => {
      acc[cat.id] = cat;
      return acc;
    }, {} as Record<number, { id: number; name: string; icon: string }>);

    const offerMap = (offersResult.data || []).reduce((acc, offer) => {
      acc[offer.id] = offer;
      return acc;
    }, {} as Record<number, OfferRow>);

    const requestMap = (requestsResult.data || []).reduce((acc, request) => {
      acc[request.id] = request;
      return acc;
    }, {} as Record<number, RequestRow>);

    const items = boostList
      .map((boost) => {
        if (boost.post_type === "offer") {
          const listing = offerMap[boost.post_id];
          if (!listing) return null;
          const category = listing.category_id ? categoryMap[listing.category_id] : null;

          return {
            boostId: boost.id,
            postType: boost.post_type,
            postId: boost.post_id,
            boostTier: boost.boost_tier,
            expiresAt: boost.expires_at,
            creditsSpent: boost.credits_spent,
            title: listing.title,
            description: listing.description,
            priceCredits: listing.price_credits,
            budgetCredits: null,
            category: category ? { name: category.name, icon: category.icon } : null,
            createdAt: listing.created_at,
            userId: listing.user_id,
          };
        }

        const listing = requestMap[boost.post_id];
        if (!listing) return null;
        const category = listing.category_id ? categoryMap[listing.category_id] : null;

        return {
          boostId: boost.id,
          postType: boost.post_type,
          postId: boost.post_id,
          boostTier: boost.boost_tier,
          expiresAt: boost.expires_at,
          creditsSpent: boost.credits_spent,
          title: listing.title,
          description: listing.description,
          priceCredits: null,
          budgetCredits: listing.budget_credits,
          category: category ? { name: category.name, icon: category.icon } : null,
          createdAt: listing.created_at,
          userId: listing.user_id,
        };
      })
      .filter(Boolean);

    return Response.json({ boosts: items });
  } catch (error) {
    console.error("Boost fetch error:", error);
    return Response.json({ error: "Failed to load boosts" }, { status: 500 });
  }
}
