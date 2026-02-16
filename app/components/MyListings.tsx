"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import PostDetailModal from "./PostDetailModal";

type MyListing = {
  id: number;
  title: string;
  description: string;
  created_at: string;
  category_id: number | null;
  type: "request" | "offer";
  status?: string;
  price_credits?: number;
  budget_credits?: number;
  categories: { name: string; icon: string } | null;
  isBoosted?: boolean;
  boostTier?: "homepage" | "category" | null;
  boostExpiresAt?: string | null;
};

export default function MyListings() {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "requests" | "offers">("all");
  const [selectedPost, setSelectedPost] = useState<{ id: number; type: "request" | "offer" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadMyListings = async () => {
      try {
        setError(null);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const userId = userData.user.id;

        // Fetch user's requests
        const { data: requests, error: reqError } = await supabase
          .from("requests")
          .select(`
            id,
            title,
            description,
            status,
            budget_credits,
            created_at,
            category_id,
            categories:category_id (name, icon)
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (reqError) throw reqError;

        // Fetch user's offers
        const { data: offers, error: offError } = await supabase
          .from("offers")
          .select(`
            id,
            title,
            description,
            price_credits,
            created_at,
            category_id,
            categories:category_id (name, icon)
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (offError) throw offError;

        // Fetch boost data for user's listings
        const requestIds = (requests || []).map(r => r.id);
        const offerIds = (offers || []).map(o => o.id);

        const { data: boostData } = await supabase
          .from("listing_boosts")
          .select("post_id, post_type, boost_tier, expires_at")
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .or(`and(post_type.eq.request,post_id.in.(${requestIds.join(",")})),and(post_type.eq.offer,post_id.in.(${offerIds.join(",")}))`);

        const boostMap = (boostData || []).reduce((map, boost) => {
          const key = `${boost.post_type}-${boost.post_id}`;
          map[key] = boost;
          return map;
        }, {} as Record<string, { post_id: number; post_type: string; boost_tier: string; expires_at: string }>);

        // Combine and enrich
        const combined: MyListing[] = [
          ...(requests || []).map(r => {
            const category = r.categories ? (Array.isArray(r.categories) ? r.categories[0] : r.categories) : null;
            return {
              ...r,
              type: "request" as const,
              categories: category,
              isBoosted: !!boostMap[`request-${r.id}`],
              boostTier: boostMap[`request-${r.id}`]?.boost_tier as "homepage" | "category" | null,
              boostExpiresAt: boostMap[`request-${r.id}`]?.expires_at || null,
            };
          }),
          ...(offers || []).map(o => {
            const category = o.categories ? (Array.isArray(o.categories) ? o.categories[0] : o.categories) : null;
            return {
              ...o,
              type: "offer" as const,
              categories: category,
              isBoosted: !!boostMap[`offer-${o.id}`],
              boostTier: boostMap[`offer-${o.id}`]?.boost_tier as "homepage" | "category" | null,
              boostExpiresAt: boostMap[`offer-${o.id}`]?.expires_at || null,
            };
          }),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setListings(combined);
      } catch (err) {
        console.error("Error loading my listings:", err);
        setError("Failed to load your listings. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadMyListings();
  }, [refreshKey]);

  const filtered = listings.filter((item) => {
    if (filter === "requests") return item.type === "request";
    if (filter === "offers") return item.type === "offer";
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-foreground/10" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-foreground/10" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-600">⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`text-sm px-3 py-1 rounded-full transition ${
            filter === "all"
              ? "bg-foreground text-background"
              : "border border-foreground/20 hover:border-foreground/40"
          }`}
        >
          All ({listings.length})
        </button>
        <button
          onClick={() => setFilter("requests")}
          className={`text-sm px-3 py-1 rounded-full transition ${
            filter === "requests"
              ? "bg-foreground text-background"
              : "border border-foreground/20 hover:border-foreground/40"
          }`}
        >
          Requests ({listings.filter(l => l.type === "request").length})
        </button>
        <button
          onClick={() => setFilter("offers")}
          className={`text-sm px-3 py-1 rounded-full transition ${
            filter === "offers"
              ? "bg-foreground text-background"
              : "border border-foreground/20 hover:border-foreground/40"
          }`}
        >
          Offers ({listings.filter(l => l.type === "offer").length})
        </button>
      </div>

      {/* Listings */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-8 text-center">
          <p className="text-sm text-foreground/60">
            {filter === "all" 
              ? "You haven't created any listings yet."
              : filter === "requests"
              ? "You haven't created any requests yet."
              : "You haven't created any offers yet."}
          </p>
          <p className="text-xs text-foreground/50 mt-2">
            Use the tabs above to create your first {filter === "all" ? "listing" : filter.slice(0, -1)}!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((listing) => (
            <div
              key={`${listing.type}-${listing.id}`}
              onClick={() => setSelectedPost({ id: listing.id, type: listing.type })}
              className={`rounded-lg border p-4 transition hover:border-foreground/20 hover:bg-foreground/5 cursor-pointer ${
                listing.isBoosted
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-foreground/10 bg-foreground/2"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-sm font-medium capitalize">
                      {listing.type === "request" ? "🤝 Request" : "🎁 Offer"}
                    </span>
                    {listing.categories && (
                      <span className="text-xs text-foreground/60">
                        {listing.categories.icon} {listing.categories.name}
                      </span>
                    )}
                    {listing.isBoosted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-500/30">
                        ⭐ {listing.boostTier === "homepage" ? "Homepage" : "Category"}
                      </span>
                    )}
                    {listing.status && (
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {listing.status}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">{listing.title}</h3>
                  <p className="mt-1 text-sm text-foreground/70 line-clamp-2">
                    {listing.description}
                  </p>
                  <p className="mt-2 text-xs text-foreground/50">
                    Created {new Date(listing.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {listing.type === "offer" && listing.price_credits !== undefined && (
                    <div className="text-sm font-semibold text-foreground">
                      {listing.price_credits} 💰
                    </div>
                  )}
                  {listing.type === "request" && listing.budget_credits !== undefined && (
                    <div className="text-sm font-semibold text-foreground">
                      {listing.budget_credits} 💰
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          postId={selectedPost.id}
          postType={selectedPost.type}
          onClose={() => setSelectedPost(null)}
          onDelete={() => {
            setSelectedPost(null);
            setRefreshKey(prev => prev + 1);
          }}
          onBoost={() => {
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
