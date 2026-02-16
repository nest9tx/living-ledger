"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type ListingDetail = {
  id: number;
  title: string;
  description: string | null;
  user_id: string;
  category_id: number | null;
  created_at: string;
  price_credits?: number;
  budget_credits?: number;
  status?: string;
  user?: {
    id: string;
    username: string;
    bio: string | null;
    avatar_url: string | null;
  };
  category?: {
    id: number;
    name: string;
    icon: string;
  };
  isBoosted?: boolean;
  boostTier?: "homepage" | "category" | null;
  boostExpiresAt?: string | null;
};

export default function ListingDetailPage() {
  const params = useParams();
  const type = params?.type as "offer" | "request" | undefined;
  const id = params?.id as string | undefined;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadListing = async () => {
      try {
        if (!type || !id) {
          setError("Invalid listing");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/listing/detail?type=${type}&id=${id}`);
        if (!res.ok) {
          const payload = await res.json();
          throw new Error(payload?.error || "Failed to load listing");
        }

        const { listing: data } = await res.json();
        setListing(data);
      } catch (err) {
        console.error("Error loading listing:", err);
        setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        setLoading(false);
      }
    };

    loadListing();
  }, [type, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-foreground/60">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
            <p className="text-red-600">{error || "Listing not found"}</p>
            <Link href="/" className="mt-4 inline-block text-sm hover:underline text-foreground/70">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const credits = type === "offer" ? listing.price_credits : listing.budget_credits;
  const isOffer = type === "offer";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Header with back link */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-foreground/60 hover:text-foreground mb-4 inline-block">
            ← Back to listings
          </Link>

          {/* Boost badge */}
          {listing.isBoosted && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-500/20">
                ⭐ Featured {listing.boostTier === "homepage" ? "on homepage" : "in category"}
                {listing.boostExpiresAt && (
                  <span className="text-emerald-600/70">
                    until {new Date(listing.boostExpiresAt).toLocaleDateString()}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {/* Title & Meta */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/60 mb-2">
                    {isOffer ? "Offer" : "Request"}
                  </p>
                  <h1 className="text-3xl font-semibold">{listing.title}</h1>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-foreground/70">
                {listing.category && (
                  <span>
                    {listing.category.icon} {listing.category.name}
                  </span>
                )}
                <span>{new Date(listing.created_at).toLocaleDateString()}</span>
                <span className="font-medium text-foreground">
                  {credits ?? 0} credits
                </span>
              </div>
            </div>

            {/* Description */}
            {listing.description && (
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                <h2 className="font-semibold mb-3">About this {isOffer ? "offer" : "request"}</h2>
                <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {listing.description}
                </p>
              </div>
            )}

            {/* How it works */}
            <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
              <h2 className="font-semibold mb-3">How this works</h2>
              <div className="space-y-2 text-sm text-foreground/70">
                {isOffer ? (
                  <>
                    <p>
                      <strong>You request this service</strong> by clicking the button below.
                    </p>
                    <p>
                      <strong>Credits are held in escrow</strong> until you confirm completion.
                    </p>
                    <p>
                      <strong>After 7 days</strong> of safety delay, credits are released to the provider.
                    </p>
                    <p className="text-xs text-foreground/60 mt-3">
                      The provider receives 85% of credits. 15% platform fee supports moderation, trust, and community.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>You offer your services</strong> to help with this request.
                    </p>
                    <p>
                      <strong>Message the requester</strong> to discuss details and agree on terms.
                    </p>
                    <p>
                      <strong>Credits are paid after completion</strong> when both parties agree work is done.
                    </p>
                    <p>
                      <strong>You&apos;ll receive 85% of the budgeted credits.</strong> 15% platform fee supports the ecosystem.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User card */}
            {listing.user && (
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                <h2 className="font-semibold mb-4">Posted by</h2>
                <div className="space-y-3">
                  {listing.user.avatar_url && (
                    <Image
                      src={listing.user.avatar_url}
                      alt={listing.user.username}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{listing.user.username}</p>
                    {listing.user.bio && (
                      <p className="text-xs text-foreground/60 mt-1">{listing.user.bio}</p>
                    )}
                  </div>
                </div>
                <button className="w-full mt-4 rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition">
                  Message user
                </button>
              </div>
            )}

            {/* Credits info */}
            <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
              <h2 className="font-semibold mb-3">Credits</h2>
              <div className="text-3xl font-bold text-emerald-600">{credits ?? 0}</div>
              <p className="text-xs text-foreground/60 mt-2">
                1 credit = $1 USD
              </p>
            </div>

            {/* Action button */}
            <button className="w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background hover:bg-foreground/90 transition">
              {isOffer ? "Request this service" : "Offer your help"}
            </button>

            {/* Status */}
            {listing.status && (
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
                <p className="text-xs text-foreground/60">Status</p>
                <p className="font-medium capitalize mt-1">{listing.status}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
