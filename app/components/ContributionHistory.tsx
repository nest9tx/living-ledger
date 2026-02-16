"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";

type Contribution = {
  id: number;
  listing_id: number;
  listing_type: "request" | "offer";
  buyer_id: string;
  provider_id: string;
  amount_credits: number;
  status: string;
  created_at: string;
  release_date: string | null;
  buyer_profile: { username: string | null };
  provider_profile: { username: string | null };
  offers?: { title: string };
  requests?: { title: string };
  ratings?: Array<{
    id: number;
    from_user_id: string;
    score: number;
    comment: string | null;
  }>;
};

export default function ContributionHistory() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{
    escrowId: number;
    toUserId: string;
    title: string;
  } | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadContributions = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        setCurrentUserId(userData.user.id);

        // Fetch escrows where user was buyer or provider
        const { data: escrows, error: escrowError } = await supabase
          .from("credit_escrow")
          .select(`
            *,
            buyer_profile:buyer_id (username),
            provider_profile:provider_id (username),
            offers:listing_id (title),
            requests:listing_id (title),
            ratings (id, from_user_id, score, comment)
          `)
          .or(`buyer_id.eq.${userData.user.id},provider_id.eq.${userData.user.id}`)
          .eq("status", "released")
          .order("created_at", { ascending: false });

        if (escrowError) throw escrowError;

        setContributions(escrows || []);
      } catch (err) {
        console.error("Error loading contributions:", err);
        setError("Failed to load contribution history");
      } finally {
        setLoading(false);
      }
    };

    loadContributions();
  }, []);

  const handleRateContribution = (escrowId: number, toUserId: string, title: string) => {
    setRatingModal({ escrowId, toUserId, title });
    setRatingScore(5);
    setRatingComment("");
  };

  const submitRating = async () => {
    if (!ratingModal || !currentUserId) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/ratings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          escrow_id: ratingModal.escrowId,
          to_user_id: ratingModal.toUserId,
          score: ratingScore,
          comment: ratingComment.trim() || null,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to submit rating");
      }

      // Refresh contributions to show new rating
      const { data: escrows } = await supabase
        .from("credit_escrow")
        .select(`
          *,
          buyer_profile:buyer_id (username),
          provider_profile:provider_id (username),
          offers:listing_id (title),
          requests:listing_id (title),
          ratings (id, from_user_id, score, comment)
        `)
        .or(`buyer_id.eq.${currentUserId},provider_id.eq.${currentUserId}`)
        .eq("status", "released")
        .order("created_at", { ascending: false });

      setContributions(escrows || []);
      setRatingModal(null);
    } catch (err) {
      console.error("Error submitting rating:", err);
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-foreground/10" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-foreground/10" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !ratingModal) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-600">⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Contribution History</h2>
        <p className="text-sm text-foreground/60 mt-1">
          Track your completed contributions and rate your counterparties.
        </p>
      </div>

      {contributions.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-8 text-center">
          <p className="text-sm text-foreground/60">
            No completed contributions yet.
          </p>
          <p className="text-xs text-foreground/50 mt-2">
            Complete transactions to build your contribution history and trust score!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {contributions.map((contrib) => {
            const isProvider = contrib.provider_id === currentUserId;
            const otherParty = isProvider ? contrib.buyer_profile : contrib.provider_profile;
            const otherPartyId = isProvider ? contrib.buyer_id : contrib.provider_id;
            const title = contrib.listing_type === "offer"
              ? contrib.offers?.title
              : contrib.requests?.title;
            
            const userRating = contrib.ratings?.find(r => r.from_user_id === currentUserId);
            const receivedRating = contrib.ratings?.find(r => r.from_user_id === otherPartyId);

            return (
              <div
                key={contrib.id}
                className="rounded-lg border border-foreground/10 bg-foreground/2 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">
                        {isProvider ? "✅ Provided" : "🛒 Purchased"}
                      </span>
                      <span className="text-xs text-foreground/60">
                        {new Date(contrib.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold">{title || "Untitled"}</h3>
                    <p className="text-sm text-foreground/70 mt-1">
                      {isProvider ? "Buyer" : "Provider"}: {otherParty?.username || "Anonymous"}
                    </p>
                    <div className="mt-2 text-sm">
                      <span className="font-medium">{contrib.amount_credits} credits</span>
                      {isProvider && (
                        <span className="text-foreground/60 ml-2">
                          (you received {Math.floor(contrib.amount_credits * 0.85)} after platform fee)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {contrib.release_date && (
                      <div className="text-xs text-foreground/50">
                        Released {new Date(contrib.release_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ratings section */}
                <div className="mt-4 pt-4 border-t border-foreground/10 space-y-3">
                  {/* Rating given by user */}
                  {userRating ? (
                    <div className="text-sm">
                      <span className="text-foreground/60">Your rating: </span>
                      <span className="font-medium">
                        {"⭐".repeat(userRating.score)} ({userRating.score}/5)
                      </span>
                      {userRating.comment && (
                        <p className="text-xs text-foreground/60 mt-1">&ldquo;{userRating.comment}&rdquo;</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRateContribution(contrib.id, otherPartyId, title || "Contribution")}
                      className="text-sm text-foreground/60 underline hover:text-foreground"
                    >
                      Rate this {isProvider ? "buyer" : "provider"} →
                    </button>
                  )}

                  {/* Rating received by user */}
                  {receivedRating && (
                    <div className="text-sm">
                      <span className="text-foreground/60">Their rating of you: </span>
                      <span className="font-medium">
                        {"⭐".repeat(receivedRating.score)} ({receivedRating.score}/5)
                      </span>
                      {receivedRating.comment && (
                        <p className="text-xs text-foreground/60 mt-1">&ldquo;{receivedRating.comment}&rdquo;</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setRatingModal(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background border border-foreground/20 shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Rate this contribution</h3>
            <p className="text-sm text-foreground/70 mb-6">{ratingModal.title}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRatingScore(star)}
                      className={`text-3xl transition ${
                        star <= ratingScore ? "opacity-100" : "opacity-30"
                      }`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Comment (optional)</label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none resize-none"
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">⚠️ {error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setRatingModal(null)}
                  className="flex-1 rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={submitRating}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Rating"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
