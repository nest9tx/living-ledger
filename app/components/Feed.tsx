"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchRequests, fetchOffers, fetchCategories } from "@/lib/supabase-helpers";
import { SkeletonFeed } from "./Skeletons";
import PostDetailModal from "./PostDetailModal";
import supabase from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  icon: string;
};

type FeedItem = {
  id: number;
  title: string;
  description: string;
  created_at: string;
  category_id: number | null;
  user_id: string;
  categories: { name: string; icon: string } | null;
  profiles: {
    username: string | null;
    average_rating?: number | null;
    total_ratings?: number | null;
    total_contributions?: number | null;
  } | null;
  images?: Array<{
    id: number;
    storage_path: string;
    filename: string;
    file_size: number;
    mime_type: string;
    upload_order: number;
  }>;
  type: "request" | "offer";
  status?: string;
  capacity?: number;
  price_credits?: number;
  budget_credits?: number;
  isBoosted?: boolean;
  boostTier?: "homepage" | "category" | null;
  boostExpiresAt?: string | null;
  hasHomepageBoost?: boolean;
  hasCategoryBoost?: boolean;
  is_physical?: boolean;
  shipping_credits?: number | null;
  quantity?: number | null;
};

type FeedProps = {
  guestMode?: boolean;
};

export default function Feed({ guestMode = false }: FeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "requests" | "offers">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<{ id: number; type: "request" | "offer" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Detect auth state so logged-in users on the browse page get full interaction UI
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Effective guest mode: only when prop says so AND user is not logged in
  const effectiveGuestMode = guestMode && !isLoggedIn;

  useEffect(() => {
    const loadFeed = async () => {
      try {
        setError(null);
        const [requestsData, offersData, categoriesData] = await Promise.all([
          fetchRequests(),
          fetchOffers(),
          fetchCategories(),
        ]);

        setCategories(categoriesData || []);

        const combined: FeedItem[] = [
          ...(requestsData || []).map((r: any) => ({
            ...r,
            type: "request" as const,
            categories: r.categories ? { name: r.categories.name, icon: r.categories.icon } : null,
            profiles: r.profiles
              ? {
                  username: r.profiles.username,
                  average_rating: r.profiles.average_rating,
                  total_ratings: r.profiles.total_ratings,
                  total_contributions: r.profiles.total_contributions,
                }
              : null,
          })),
          ...(offersData || []).map((o: any) => ({
            ...o,
            type: "offer" as const,
            categories: o.categories ? { name: o.categories.name, icon: o.categories.icon } : null,
            profiles: o.profiles
              ? {
                  username: o.profiles.username,
                  average_rating: o.profiles.average_rating,
                  total_ratings: o.profiles.total_ratings,
                  total_contributions: o.profiles.total_contributions,
                }
              : null,
          })),
        ].sort((a, b) => {
          // Boosted posts always come first
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;

          // Within boosted posts, sort by expiry (soonest to expire first for fair rotation)
          if (a.isBoosted && b.isBoosted) {
            const aExpiry = a.boostExpiresAt ? new Date(a.boostExpiresAt).getTime() : 0;
            const bExpiry = b.boostExpiresAt ? new Date(b.boostExpiresAt).getTime() : 0;
            return aExpiry - bExpiry;
          }

          // Non-boosted posts sorted by newest first
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setItems(combined);
      } catch (error) {
        console.error("Error loading feed:", error);
        setError("Failed to load community posts. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, [refreshKey]);

  const filtered = items.filter((item) => {
    // Apply type filter
    if (filter === "requests" && item.type !== "request") return false;
    if (filter === "offers" && item.type !== "offer") return false;

    // Apply category filter
    if (categoryFilter !== null && item.category_id !== categoryFilter) return false;

    // Apply keyword search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(q);
      const inDesc = item.description.toLowerCase().includes(q);
      const inUsername = (item.profiles?.username || "").toLowerCase().includes(q);
      if (!inTitle && !inDesc && !inUsername) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="h-8 w-12 animate-pulse rounded-full bg-foreground/10" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-foreground/10" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-foreground/10" />
        </div>
        <SkeletonFeed count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-600">⚠️ {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-600 underline hover:text-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search listings by keyword…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-foreground/20 bg-transparent px-4 py-2 pl-9 text-sm placeholder:text-foreground/40 focus:border-foreground/40 focus:outline-none"
        />
        <span className="pointer-events-none absolute left-3 top-2.5 text-foreground/40 text-sm">🔍</span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-2.5 text-foreground/40 hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-sm px-3 py-1 rounded-full transition ${
            filter === "all"
              ? "bg-foreground text-background"
              : "border border-foreground/20 hover:border-foreground/40"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("requests")}
          className={`text-sm px-3 py-1 rounded-full transition ${
            filter === "requests"
              ? "bg-foreground text-background"
              : "border border-foreground/20 hover:border-foreground/40"
          }`}
        >
          Requests
        </button>
        <button
          onClick={() => setFilter("offers")}
          className={`text-sm px-3 py-1 rounded-full transition ${
            filter === "offers"
              ? "bg-foreground text-background"
              : "border border-foreground/20 hover:border-foreground/40"
          }`}
        >
          Offers
        </button>
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-sm px-3 py-1 rounded-full transition ${
              categoryFilter === null
                ? "bg-blue-600/20 border border-blue-500/50 text-blue-600"
                : "border border-foreground/20 hover:border-foreground/40"
            }`}
          >
            All categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`text-sm px-3 py-1 rounded-full transition whitespace-nowrap ${
                categoryFilter === cat.id
                  ? "bg-emerald-600/20 border border-emerald-500/50 text-emerald-600"
                  : "border border-foreground/20 hover:border-foreground/40"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground/60">
          {searchQuery ? `No listings match "${searchQuery}".` : "No posts yet. Be the first to contribute!"}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => setSelectedPost({ id: item.id, type: item.type })}
              className={`rounded-lg border p-4 transition hover:border-foreground/20 hover:bg-foreground/5 cursor-pointer ${
                item.isBoosted
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-foreground/10 bg-foreground/2"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium capitalize">
                      {item.type === "request" ? "🤝 Request" : "🎁 Offer"}
                    </span>
                    {item.categories && (
                      <span className="text-xs text-foreground/60">
                        {item.categories.icon} {item.categories.name}
                      </span>
                    )}
                    {item.isBoosted && (
                      <>
                        {item.hasHomepageBoost && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-500/30">
                            ⭐ Featured
                          </span>
                        )}
                        {item.hasCategoryBoost && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-500/25">
                            📌 Category Pick
                          </span>
                        )}
                      </>
                    )}
                    {item.is_physical && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-500/25">
                        📦 Physical
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-foreground/70">
                    {item.description}
                  </p>
                  {/* Image preview */}
                  {item.images && item.images.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {item.images.slice(0, 3).map((image) => {
                        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                        if (!supabaseUrl) return null;
                        
                        const imageUrl = `${supabaseUrl}/storage/v1/object/public/listing-images/${image.storage_path}`;
                        return (
                          <div key={image.id} className="w-16 h-16 rounded border border-foreground/10 overflow-hidden bg-foreground/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={image.filename}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        );
                      })}
                      {item.images.length > 3 && (
                        <div className="w-16 h-16 rounded border border-foreground/10 bg-foreground/5 flex items-center justify-center text-xs text-foreground/60">
                          +{item.images.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-foreground/50">
                    by{" "}
                    {item.profiles?.username ? (
                      <Link
                        href={`/profile/${item.profiles.username}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {item.profiles.username}
                      </Link>
                    ) : (
                      "Anonymous"
                    )}
                    {item.profiles?.total_ratings ? (
                      <>
                        {" "}• ⭐ {Number(item.profiles.average_rating || 0).toFixed(1)} ({item.profiles.total_ratings})
                      </>
                    ) : (
                      <> • New</>
                    )}
                    {item.profiles?.total_contributions ? (
                      <> • {item.profiles.total_contributions} contributions</>
                    ) : null}
                    {" "}• {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {item.type === "offer" && item.price_credits !== undefined && (
                    <div className="text-sm font-semibold text-foreground">
                      {item.is_physical && item.shipping_credits
                        ? `${item.price_credits + item.shipping_credits} 💰`
                        : `${item.price_credits} 💰`}
                    </div>
                  )}
                  {item.is_physical && item.shipping_credits && item.type === "offer" && (
                    <div className="text-xs text-foreground/50 mt-0.5">
                      {item.price_credits} + {item.shipping_credits} shipping
                    </div>
                  )}
                  {item.type === "request" && item.budget_credits !== undefined && (
                    <div className="text-sm font-semibold text-foreground">
                      Budget: {item.is_physical && item.shipping_credits
                        ? `${item.budget_credits + item.shipping_credits} 💰`
                        : `${item.budget_credits} 💰`}
                    </div>
                  )}
                  {item.is_physical && item.shipping_credits && item.type === "request" && (
                    <div className="text-xs text-foreground/50 mt-0.5">
                      {item.budget_credits} + {item.shipping_credits} shipping
                    </div>
                  )}
                  {item.type === "request" && (
                    <div className="text-xs text-foreground/60 capitalize mt-1">
                      {item.status}
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
            setRefreshKey(prev => prev + 1); // Refresh feed after delete
          }}
          onBoost={() => {
            setRefreshKey(prev => prev + 1); // Refresh feed after boost
          }}
          guestMode={effectiveGuestMode}
        />
      )}
    </div>
  );
}
