"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "@/lib/supabase";
import PostDetailModal from "@/app/components/PostDetailModal";

type Listing = {
  id: number;
  title: string;
  description: string;
  credits: number;
  type: "offer" | "request";
  category: { name: string; icon: string } | null;
  status: string;
  created_at: string;
};

type ProfileData = {
  id: string;
  username: string;
  bio: string | null;
  averageRating: number;
  totalRatings: number;
  totalContributions: number;
  completedOrders: number;
  memberSince: string;
  tier: "new" | "active" | "trusted";
};

const TIER_CONFIG = {
  new: {
    label: "New Member",
    icon: "🌱",
    color: "text-foreground/60 bg-foreground/8 border-foreground/15",
  },
  active: {
    label: "Active Member",
    icon: "⚡",
    color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  },
  trusted: {
    label: "Trusted Member",
    icon: "⭐",
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
};

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [listings, setListings] = useState<{ offers: Listing[]; requests: Listing[] }>({
    offers: [],
    requests: [],
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [listingFilter, setListingFilter] = useState<"all" | "offers" | "requests">("all");
  const [selectedPost, setSelectedPost] = useState<{ id: number; type: "offer" | "request" } | null>(null);

  useEffect(() => {
    // Get current viewer's user ID (for own-profile check)
    supabase.auth.getUser().then(({ data }) => {
      setViewerUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!username) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setProfile(data.profile);
        setListings(data.listings);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [username]);

  const isOwnProfile = profile && viewerUserId && profile.id === viewerUserId;

  const allListings: Listing[] = [
    ...listings.offers,
    ...listings.requests,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const visibleListings =
    listingFilter === "all"
      ? allListings
      : listingFilter === "offers"
      ? listings.offers
      : listings.requests;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 animate-pulse">
          <div className="h-4 w-24 rounded bg-foreground/10" />
          <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-8 space-y-4">
            <div className="h-8 w-48 rounded bg-foreground/10" />
            <div className="h-4 w-32 rounded bg-foreground/10" />
            <div className="h-4 w-full rounded bg-foreground/10" />
            <div className="h-4 w-3/4 rounded bg-foreground/10" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center space-y-4">
          <p className="text-5xl">🕵️</p>
          <h1 className="text-2xl font-semibold">Profile not found</h1>
          <p className="text-sm text-foreground/60">
            No member with the username <strong>@{username}</strong> exists.
          </p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground underline underline-offset-4"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const tier = TIER_CONFIG[profile.tier];
  const memberYear = new Date(profile.memberSince).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">

        {/* Back nav */}
        <button
          onClick={() => router.back()}
          className="text-xs uppercase tracking-[0.35em] text-foreground/50 hover:text-foreground/80 transition"
        >
          ← Back
        </button>

        {/* Profile card */}
        <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-8 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: avatar + name */}
            <div className="flex items-center gap-4">
              {/* Initials avatar */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-2xl font-semibold uppercase select-none">
                {profile.username.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-2xl font-semibold">@{profile.username}</h1>
                <p className="text-xs text-foreground/50 mt-0.5">Member since {memberYear}</p>
              </div>
            </div>
            {/* Right: tier badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tier.color}`}>
              {tier.icon} {tier.label}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground/50 uppercase tracking-wide">Rating</span>
              {profile.totalRatings > 0 ? (
                <span className="font-semibold">
                  ⭐ {Number(profile.averageRating).toFixed(1)}
                  <span className="text-xs text-foreground/50 font-normal ml-1">
                    ({profile.totalRatings} {profile.totalRatings === 1 ? "rating" : "ratings"})
                  </span>
                </span>
              ) : (
                <span className="text-foreground/50">No ratings yet</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground/50 uppercase tracking-wide">Contributions</span>
              <span className="font-semibold">
                {profile.totalContributions}
                <span className="text-xs text-foreground/50 font-normal ml-1">completed</span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground/50 uppercase tracking-wide">Active listings</span>
              {listings.offers.length + listings.requests.length > 0 ? (
                <a
                  href="#listings"
                  className="font-semibold hover:underline underline-offset-2"
                >
                  {listings.offers.length + listings.requests.length}
                </a>
              ) : (
                <span className="font-semibold">{listings.offers.length + listings.requests.length}</span>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio ? (
            <p className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-foreground/20 pl-3">
              {profile.bio}
            </p>
          ) : isOwnProfile ? (
            <p className="text-sm text-foreground/40 italic">
              No bio yet —{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-foreground/70">
                add one in Settings
              </Link>
            </p>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-1">
            {isOwnProfile ? (
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 px-4 py-2 text-sm hover:bg-foreground/5 transition"
              >
                ✏️ Edit profile
              </Link>
            ) : null}
          </div>
        </div>

        {/* Listings section */}
        <div id="listings" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Listings by @{profile.username}</h2>
            <div className="flex gap-2 text-sm">
              {(["all", "offers", "requests"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setListingFilter(f)}
                  className={`px-3 py-1 rounded-full transition capitalize ${
                    listingFilter === f
                      ? "bg-foreground text-background"
                      : "border border-foreground/20 hover:border-foreground/40"
                  }`}
                >
                  {f === "all"
                    ? `All (${allListings.length})`
                    : f === "offers"
                    ? `Offers (${listings.offers.length})`
                    : `Requests (${listings.requests.length})`}
                </button>
              ))}
            </div>
          </div>

          {visibleListings.length === 0 ? (
            <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-8 text-center text-sm text-foreground/50">
              {listingFilter === "all"
                ? "No active listings yet."
                : `No active ${listingFilter} yet.`}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleListings.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => setSelectedPost({ id: item.id, type: item.type })}
                  className="rounded-xl border border-foreground/10 bg-foreground/2 p-4 cursor-pointer transition hover:border-foreground/25 hover:bg-foreground/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium">
                          {item.type === "offer" ? "🎁 Offer" : "🤝 Request"}
                        </span>
                        {item.category && (
                          <span className="text-xs text-foreground/50">
                            {item.category.icon} {item.category.name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm leading-snug">{item.title}</h3>
                      <p className="mt-1 text-xs text-foreground/60 line-clamp-2">{item.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{item.credits} 💰</p>
                      <p className="text-xs text-foreground/40 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Listing detail modal */}
      {selectedPost && (
        <PostDetailModal
          postId={selectedPost.id}
          postType={selectedPost.type}
          onClose={() => setSelectedPost(null)}
          guestMode={!viewerUserId}
        />
      )}
    </div>
  );
}
