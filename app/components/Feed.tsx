"use client";

import { useEffect, useState } from "react";
import { fetchRequests, fetchOffers, fetchCategories } from "@/lib/supabase-helpers";
import { SkeletonFeed } from "./Skeletons";
import PostDetailModal from "./PostDetailModal";

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
  profiles: { username: string | null } | null;
  type: "request" | "offer";
  status?: string;
  capacity?: number;
  price_credits?: number;
  budget_credits?: number;
};

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "requests" | "offers">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<{ id: number; type: "request" | "offer" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
            profiles: r.profiles ? { username: r.profiles.username } : null,
          })),
          ...(offersData || []).map((o: any) => ({
            ...o,
            type: "offer" as const,
            categories: o.categories ? { name: o.categories.name, icon: o.categories.icon } : null,
            profiles: o.profiles ? { username: o.profiles.username } : null,
          })),
        ].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

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
          No posts yet. Be the first to contribute!
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => setSelectedPost({ id: item.id, type: item.type })}
              className="rounded-lg border border-foreground/10 bg-foreground/2 p-4 transition hover:border-foreground/20 hover:bg-foreground/5 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">
                      {item.type === "request" ? "🤝 Request" : "🎁 Offer"}
                    </span>
                    {item.categories && (
                      <span className="text-xs text-foreground/60">
                        {item.categories.icon} {item.categories.name}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-foreground/70">
                    {item.description}
                  </p>
                  <p className="mt-2 text-xs text-foreground/50">
                    by {item.profiles?.username || "Anonymous"} •{" "}
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {item.type === "offer" && item.price_credits !== undefined && (
                    <div className="text-sm font-semibold text-foreground">
                      {item.price_credits} 💰
                    </div>
                  )}
                  {item.type === "request" && item.budget_credits !== undefined && (
                    <div className="text-sm font-semibold text-foreground">
                      Budget: {item.budget_credits} 💰
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
        />
      )}
    </div>
  );
}
