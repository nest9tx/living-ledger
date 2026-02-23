"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import PostDetailModal from "./PostDetailModal";

type MyListing = {
  id: number;
  title: string;
  description: string;
  created_at: string;
  expires_at: string | null;
  category_id: number | null;
  type: "request" | "offer";
  status?: string;
  price_credits?: number;
  budget_credits?: number;
  quantity?: number | null;
  quantity_remaining?: number | null;
  categories: { name: string; icon: string } | null;
  isBoosted?: boolean;
  boostTier?: "homepage" | "category" | null;
  boostExpiresAt?: string | null;
  hasHomepageBoost?: boolean;
  hasCategoryBoost?: boolean;
};

export default function MyListings() {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "requests" | "offers">("all");
  const [selectedPost, setSelectedPost] = useState<{ id: number; type: "request" | "offer" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [restockingId, setRestockingId] = useState<string | null>(null);

  // Returns label + colour class for expiry state
  function expiryInfo(expiresAt: string | null): { label: string; cls: string; isExpired: boolean } | null {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: "Expired", cls: "bg-red-500/15 text-red-600 border-red-500/30", isExpired: true };
    if (days <= 3) return { label: `Expires in ${days}d`, cls: "bg-orange-500/15 text-orange-600 border-orange-500/30", isExpired: false };
    if (days <= 7) return { label: `Expires in ${days}d`, cls: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", isExpired: false };
    return { label: `${days}d left`, cls: "bg-foreground/5 text-foreground/50 border-foreground/10", isExpired: false };
  }

  const renewListing = async (e: React.MouseEvent, id: number, type: "request" | "offer") => {
    e.stopPropagation();
    const key = `${type}-${id}`;
    if (renewingId === key) return;
    setRenewingId(key);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/listing/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, type }),
      });
      if (res.ok) setRefreshKey(prev => prev + 1);
    } catch {
      // silent — user can retry
    } finally {
      setRenewingId(null);
    }
  };

  const restockListing = async (e: React.MouseEvent, id: number, type: "request" | "offer") => {
    e.stopPropagation();
    const key = `${type}-${id}`;
    if (restockingId === key) return;

    const input = prompt("How many units would you like to add?\n(You can also extend 30 days at the same time — type a number, optionally followed by \"+30\" e.g. \"5+30\")");
    if (!input) return;

    const match = input.trim().match(/^(\d+)(\+30)?$/);
    if (!match) {
      alert("Invalid input. Enter a number like '5' or '5+30'.");
      return;
    }
    const addQuantity = parseInt(match[1], 10);
    const extendDays = match[2] ? 30 : 0;

    setRestockingId(key);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/listing/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, type, addQuantity, extendDays }),
      });
      if (res.ok) setRefreshKey(prev => prev + 1);
      else {
        const payload = await res.json();
        alert(payload?.error || "Restock failed. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setRestockingId(null);
    }
  };

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
            quantity,
            created_at,
            expires_at,
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
            quantity,
            created_at,
            expires_at,
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
          if (!map[key]) map[key] = [];
          map[key].push(boost);
          return map;
        }, {} as Record<string, { post_id: number; post_type: string; boost_tier: string; expires_at: string }[]>);

        const primaryBoost = (key: string) => {
          const boosts = boostMap[key];
          if (!boosts || boosts.length === 0) return null;
          return boosts.find(b => b.boost_tier === "homepage") || boosts[0];
        };

        // Count active (non-refunded/cancelled) escrows per listing to derive quantity_remaining
        const quantityLimitedRequestIds = (requests || []).filter(r => r.quantity != null).map(r => r.id);
        const quantityLimitedOfferIds = (offers || []).filter(o => o.quantity != null).map(o => o.id);

        const soldCountMap: Record<string, number> = {};

        if (quantityLimitedRequestIds.length > 0 || quantityLimitedOfferIds.length > 0) {
          const escrowQueries: PromiseLike<void>[] = [];

          if (quantityLimitedRequestIds.length > 0) {
            escrowQueries.push(
              supabase
                .from("credit_escrow")
                .select("request_id", { count: "exact" })
                .in("request_id", quantityLimitedRequestIds)
                .not("status", "in", '("refunded","cancelled")')
                .then(({ data: rows }) => {
                  (rows || []).forEach(row => {
                    if (row.request_id) soldCountMap[`request-${row.request_id}`] = (soldCountMap[`request-${row.request_id}`] || 0) + 1;
                  });
                })
            );
          }

          if (quantityLimitedOfferIds.length > 0) {
            escrowQueries.push(
              supabase
                .from("credit_escrow")
                .select("offer_id", { count: "exact" })
                .in("offer_id", quantityLimitedOfferIds)
                .not("status", "in", '("refunded","cancelled")')
                .then(({ data: rows }) => {
                  (rows || []).forEach(row => {
                    if (row.offer_id) soldCountMap[`offer-${row.offer_id}`] = (soldCountMap[`offer-${row.offer_id}`] || 0) + 1;
                  });
                })
            );
          }

          await Promise.all(escrowQueries);
        }

        // Combine and enrich
        const combined: MyListing[] = [
          ...(requests || []).map(r => {
            const category = r.categories ? (Array.isArray(r.categories) ? r.categories[0] : r.categories) : null;
            const sold = soldCountMap[`request-${r.id}`] || 0;
            return {
              ...r,
              type: "request" as const,
              categories: category,
              expires_at: r.expires_at || null,
              quantity: r.quantity ?? null,
              quantity_remaining: r.quantity != null ? Math.max(0, r.quantity - sold) : null,
              isBoosted: (boostMap[`request-${r.id}`]?.length || 0) > 0,
              boostTier: primaryBoost(`request-${r.id}`)?.boost_tier as "homepage" | "category" | null,
              boostExpiresAt: primaryBoost(`request-${r.id}`)?.expires_at || null,
              hasHomepageBoost: (boostMap[`request-${r.id}`] || []).some(b => b.boost_tier === "homepage"),
              hasCategoryBoost: (boostMap[`request-${r.id}`] || []).some(b => b.boost_tier === "category"),
            };
          }),
          ...(offers || []).map(o => {
            const category = o.categories ? (Array.isArray(o.categories) ? o.categories[0] : o.categories) : null;
            const sold = soldCountMap[`offer-${o.id}`] || 0;
            return {
              ...o,
              type: "offer" as const,
              categories: category,
              expires_at: o.expires_at || null,
              quantity: o.quantity ?? null,
              quantity_remaining: o.quantity != null ? Math.max(0, o.quantity - sold) : null,
              isBoosted: (boostMap[`offer-${o.id}`]?.length || 0) > 0,
              boostTier: primaryBoost(`offer-${o.id}`)?.boost_tier as "homepage" | "category" | null,
              boostExpiresAt: primaryBoost(`offer-${o.id}`)?.expires_at || null,
              hasHomepageBoost: (boostMap[`offer-${o.id}`] || []).some(b => b.boost_tier === "homepage"),
              hasCategoryBoost: (boostMap[`offer-${o.id}`] || []).some(b => b.boost_tier === "category"),
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
          {filtered.map((listing) => {
            const expiry = expiryInfo(listing.expires_at);
            const isExpired = expiry?.isExpired ?? false;
            const renewKey = `${listing.type}-${listing.id}`;
            return (
            <div
              key={`${listing.type}-${listing.id}`}
              onClick={() => !isExpired && setSelectedPost({ id: listing.id, type: listing.type })}
              className={`rounded-lg border p-4 transition ${
                isExpired
                  ? "border-foreground/10 bg-foreground/2 opacity-60"
                  : listing.isBoosted
                  ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60 cursor-pointer"
                  : "border-foreground/10 bg-foreground/2 hover:border-foreground/20 hover:bg-foreground/5 cursor-pointer"
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
                    {listing.isBoosted && !isExpired && (
                      <>
                        {listing.hasHomepageBoost && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-500/30">
                            ⭐ Homepage
                          </span>
                        )}
                        {listing.hasCategoryBoost && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-500/25">
                            📌 Category
                          </span>
                        )}
                      </>
                    )}
                    {listing.status && !isExpired && (
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {listing.status}
                      </span>
                    )}
                    {expiry && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${expiry.cls}`}>
                        {expiry.isExpired ? "⚠️ " : "⏳ "}{expiry.label}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">{listing.title}</h3>
                  <p className="mt-1 text-sm text-foreground/70 line-clamp-2">
                    {listing.description}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <p className="text-xs text-foreground/50">
                      Created {new Date(listing.created_at).toLocaleDateString()}
                    </p>
                    {expiry && (expiry.isExpired || expiry.label.includes("d left") === false) && (
                      <button
                        onClick={(e) => renewListing(e, listing.id, listing.type)}
                        disabled={renewingId === renewKey}
                        className="text-xs px-2 py-0.5 rounded border border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5 transition disabled:opacity-50"
                      >
                        {renewingId === renewKey ? "Renewing…" : isExpired ? "Renew listing" : "Renew (+30 days)"}
                      </button>
                    )}
                    {listing.quantity != null && !isExpired && (
                      <button
                        onClick={(e) => restockListing(e, listing.id, listing.type)}
                        disabled={restockingId === renewKey}
                        className="text-xs px-2 py-0.5 rounded border border-amber-500/30 text-amber-700 hover:border-amber-500/60 hover:bg-amber-500/5 transition disabled:opacity-50"
                      >
                        {restockingId === renewKey ? "Restocking…" : "📦 Restock"}
                      </button>
                    )}
                  </div>
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
                  {listing.quantity != null && !isExpired && (
                    <div className={`text-xs mt-1 font-medium ${listing.quantity_remaining === 0 ? "text-red-600" : "text-amber-700"}`}>
                      {listing.quantity_remaining === 0
                        ? "🚫 Sold Out"
                        : `📦 ${listing.quantity_remaining}/${listing.quantity}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
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
