"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import supabase from "@/lib/supabase";
import { deleteRequest, deleteOffer } from "@/lib/supabase-helpers";
import MessageThread from "./MessageThread";

type PostDetailProps = {
  postId: number;
  postType: "request" | "offer";
  onClose: () => void;
  onDelete?: () => void;
  onBoost?: () => void;
  defaultTab?: "details" | "messages";
  guestMode?: boolean;
};

type PostDetail = {
  id: number;
  title: string;
  description: string;
  created_at: string;
  category_id: number | null;
  user_id: string;
  categories: { name: string; icon: string } | null;
  profile?: {
    username: string | null;
    average_rating?: number | null;
    total_ratings?: number | null;
    total_contributions?: number | null;
  } | null;
  images?: Array<{
    id: number;
    storage_path: string;
    filename: string;
  }>;
  price_credits?: number;
  budget_credits?: number;
  status?: string;
  quantity?: number | null;
  is_physical?: boolean;
  shipping_credits?: number | null;
  shipping_region?: string | null;
};

export default function PostDetailModal({ postId, postType, onClose, onDelete, onBoost, defaultTab = "details", guestMode = false }: PostDetailProps) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [boostLoading, setBoostLoading] = useState(false);
  const [boostError, setBoostError] = useState<string | null>(null);
  const [boostSuccess, setBoostSuccess] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "messages">(defaultTab);
  const [quantityRemaining, setQuantityRemaining] = useState<number | null>(null);
  const [lastBoostTier, setLastBoostTier] = useState<"homepage" | "category" | null>(null);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id || null);
    };
    getCurrentUser();

    // Fetch post details
    const loadPost = async () => {
      try {
        const table = postType === "request" ? "requests" : "offers";
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("id", postId)
          .single();

        if (error) throw error;

        let postData = data;

        // Fetch category separately
        if (data?.category_id) {
          const { data: categoryData } = await supabase
            .from("categories")
            .select("name, icon")
            .eq("id", data.category_id)
            .single();
          
          postData = { ...postData, categories: categoryData };
        } else {
          postData = { ...postData, categories: null };
        }

        // Fetch profile separately
        if (data?.user_id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username, average_rating, total_ratings, total_contributions")
            .eq("id", data.user_id)
            .single();
          
          postData = { ...postData, profile: profileData };
        }

        // Fetch listing images
        const { data: imageData } = await supabase
          .from("listing_images")
          .select("id, storage_path, filename")
          .eq("listing_type", postType)
          .eq("listing_id", postId)
          .order("upload_order", { ascending: true });

        postData = { ...postData, images: imageData || [] };

        setPost(postData);

        // Derive quantity remaining from active escrows if listing has a quantity cap
        if (postData.quantity != null) {
          const escrowField = postType === "offer" ? "offer_id" : "request_id";
          const { count: soldCount } = await supabase
            .from("credit_escrow")
            .select("id", { count: "exact", head: true })
            .eq(escrowField, postId)
            .not("status", "in", '("refunded","cancelled")');
          setQuantityRemaining(Math.max(0, postData.quantity - (soldCount || 0)));
        }
      } catch (err) {
        console.error("Error loading post:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId, postType]);

  const handleOpenMessages = () => {
    // Switch to Messages tab
    setActiveTab("messages");
  };

  const handleConfirmPurchase = async () => {
    try {
      setPurchaseError(null);
      const baseCredits = postType === "offer" ? post?.price_credits : post?.budget_credits;
      if (!baseCredits) {
        setPurchaseError("This listing does not have a valid credit amount.");
        return;
      }

      const shippingCredits = post?.is_physical ? (post.shipping_credits || 0) : 0;
      const totalCredits = baseCredits + shippingCredits;

      setPurchaseLoading(true);
      setShowPurchaseConfirm(false);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setPurchaseError("Please sign in again to continue.");
        setPurchaseLoading(false);
        return;
      }

      const res = await fetch("/api/escrow/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, postType, credits: totalCredits }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to hold credits");
      }

      onClose();
      window.location.href = `/orders/${payload.escrowId}`;
    } catch (err) {
      console.error("Error purchasing:", err);
      setPurchaseError(err instanceof Error ? err.message : "Failed to process purchase.");
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this ${postType}?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      if (postType === "request") {
        await deleteRequest(postId);
      } else {
        await deleteOffer(postId);
      }
      
      alert(`${postType === "request" ? "Request" : "Offer"} deleted successfully!`);
      onDelete?.(); // Trigger refresh in parent
      onClose();
    } catch (err) {
      console.error("Error deleting:", err);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleBoost = async (tier: "homepage" | "category", durationDays: number) => {
    try {
      setBoostError(null);
      setBoostSuccess(null);

      const label = tier === "homepage" ? "Homepage" : "Category";
      const cost = tier === "homepage" ? 10 : durationDays === 3 ? 10 : 5;

      if (!confirm(`Boost this listing on ${label}?\n\nCost: ${cost} credits\nDuration: ${durationDays} day${durationDays > 1 ? "s" : ""}`)) {
        return;
      }

      setBoostLoading(true);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        alert("Please sign in again to continue.");
        return;
      }

      const res = await fetch("/api/boost/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, postType, tier, durationDays }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create boost");
      }

      setLastBoostTier(tier);
      setBoostSuccess(
        `Success! ${payload.creditsSpent} credits deducted. Boost active until ${new Date(
          payload.expiresAt
        ).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}.`
      );

      // Trigger feed refresh
      if (onBoost) {
        onBoost();
      }
    } catch (err) {
      console.error("Boost error:", err);
      setBoostError(err instanceof Error ? err.message : "Failed to boost listing.");
    } finally {
      setBoostLoading(false);
    }
  };

  const handleFlag = async () => {
    try {
      setFlagError(null);
      setFlagSuccess(null);

      const reason = prompt("Why are you reporting this listing? (optional)") || "";
      setFlagLoading(true);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        alert("Please sign in again to continue.");
        return;
      }

      const res = await fetch("/api/flags/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, postType, reason }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to report listing");
      }

      setFlagSuccess("Thanks for the report. Our team will review it shortly.");
    } catch (err) {
      console.error("Flag error:", err);
      setFlagError(err instanceof Error ? err.message : "Failed to report listing.");
    } finally {
      setFlagLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-lg bg-background p-6">
          <p className="text-sm text-foreground/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-lg bg-background p-6">
          <p className="text-sm text-red-600">Post not found</p>
          <button onClick={onClose} className="mt-4 text-sm underline">
            Close
          </button>
        </div>
      </div>
    );
  }

  const isOwnPost = currentUserId === post.user_id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-background border border-foreground/20 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-foreground/10 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">
                  {postType === "request" ? "🤝 Request" : "🎁 Offer"}
                </span>
                {post.categories && (
                  <span className="text-xs text-foreground/60">
                    {post.categories.icon} {post.categories.name}
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-semibold">{post.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-foreground/60 hover:text-foreground text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-foreground/10 px-6">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-3 text-sm font-medium transition ${
              activeTab === "details"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`px-4 py-3 text-sm font-medium transition ${
              activeTab === "messages"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Messages
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === "details" && (
            <div className="space-y-6">{/* Description */}
          <div>
            <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-2">
              Description
            </h3>
            <p className="text-foreground whitespace-pre-wrap">{post.description}</p>
          </div>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-2">
                Images
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {post.images.map((image) => {
                  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                  if (!supabaseUrl) return null;
                  const imageUrl = `${supabaseUrl}/storage/v1/object/public/listing-images/${image.storage_path}`;
                  return (
                    <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden border border-foreground/10 bg-foreground/5">
                      <Image
                        src={imageUrl}
                        alt={image.filename}
                        fill
                        className="object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Credits */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-foreground/5 border border-foreground/10">
            <div className="text-3xl">💰</div>
            <div className="flex-1">
              <div className="text-sm text-foreground/60">
                {postType === "offer" ? "Price" : "Budget"}
              </div>
              {post.is_physical && post.shipping_credits ? (
                <>
                  <div className="text-sm text-foreground/70 mt-0.5">
                    <span className="font-semibold text-foreground">{postType === "offer" ? post.price_credits : post.budget_credits}</span>
                    {" + "}
                    <span className="font-semibold text-foreground">{post.shipping_credits}</span>
                    {" shipping"}
                  </div>
                  <div className="text-2xl font-semibold">
                    {(postType === "offer" ? (post.price_credits || 0) : (post.budget_credits || 0)) + post.shipping_credits} credits total
                  </div>
                  {post.shipping_region && (
                    <div className="mt-1 text-xs text-amber-700">🌍 Ships: <span className="capitalize">{post.shipping_region === "domestic" ? "USA only" : post.shipping_region}</span></div>
                  )}
                </>
              ) : (
                <div className="text-2xl font-semibold">
                  {postType === "offer" ? post.price_credits : post.budget_credits} credits
                </div>
              )}
              {post.quantity != null && (
                quantityRemaining === 0 ? (
                  <div className="mt-1 text-sm font-medium text-red-600">🚫 Sold Out</div>
                ) : quantityRemaining != null ? (
                  <div className="mt-1 text-sm font-medium text-amber-700">
                    📦 {quantityRemaining} of {post.quantity} remaining
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Status */}
          {postType === "request" && post.status && (
            <div>
              <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-2">
                Status
              </h3>
              <span className="inline-block px-3 py-1 rounded-full bg-foreground/10 text-sm capitalize">
                {post.status}
              </span>
            </div>
          )}

          {/* Interaction Section */}
          {guestMode ? (
            <div className="border-t border-foreground/10 pt-6">
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-5 text-center space-y-3">
                <p className="font-medium">Want to respond to this listing?</p>
                <p className="text-sm text-foreground/60">Create a free account to message, purchase, or post your own listings.</p>
                <div className="flex gap-3 justify-center">
                  <a href="/signup" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition">
                    Join free
                  </a>
                  <a href="/login" className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition">
                    Sign in
                  </a>
                </div>
              </div>
            </div>
          ) : !isOwnPost && (
            <div className="border-t border-foreground/10 pt-6">
              <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-4">
                Interested?
              </h3>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                {showPurchaseConfirm ? (
                  <div className="rounded-lg border border-foreground/15 bg-foreground/5 p-4 space-y-3">
                    <p className="text-sm font-semibold">Confirm purchase</p>
                    {post.is_physical && post.shipping_credits ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground/60">Item</span>
                          <span>{postType === "offer" ? post.price_credits : post.budget_credits} credits</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground/60">Shipping</span>
                          <span>{post.shipping_credits} credits</span>
                        </div>
                        <div className="flex justify-between border-t border-foreground/10 pt-2">
                          <span className="text-sm font-semibold">Total to escrow</span>
                          <span className="text-lg font-bold text-emerald-600">{(postType === "offer" ? (post.price_credits || 0) : (post.budget_credits || 0)) + post.shipping_credits}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground/60">Credits to escrow</span>
                        <span className="text-lg font-bold text-emerald-600">{postType === "offer" ? post.price_credits : post.budget_credits}</span>
                      </div>
                    )}
                    <p className="text-xs text-foreground/60">Held safely until confirmed complete. Released after 7-day delay.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowPurchaseConfirm(false)}
                        className="flex-1 rounded-lg border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/5 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmPurchase}
                        disabled={purchaseLoading}
                        className="flex-1 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition disabled:opacity-50"
                      >
                        {purchaseLoading ? "Processing..." : "Confirm"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handleOpenMessages}
                      className="flex-1 rounded-lg border border-foreground/20 bg-background px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition"
                    >
                      💬 Message Seller
                    </button>
                    <button
                      onClick={() => setShowPurchaseConfirm(true)}
                      disabled={purchaseLoading || (post.quantity != null && quantityRemaining === 0)}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                        post.quantity != null && quantityRemaining === 0
                          ? "bg-foreground/20 text-foreground/50 cursor-not-allowed"
                          : "bg-foreground text-background hover:bg-foreground/90"
                      }`}
                    >
                      {post.quantity != null && quantityRemaining === 0
                        ? "Sold Out"
                        : postType === "offer"
                          ? "Purchase"
                          : "Accept & Pay"}
                    </button>
                  </div>
                )}
              </div>

                {purchaseError && (
                  <p className="mt-3 text-xs text-red-600 text-center">
                    {purchaseError}
                  </p>
                )}
                <p className="mt-3 text-xs text-foreground/50 text-center">
                  💡 Buyers pay the listed price. Providers receive 90% after completion (10% platform fee).
                </p>
                <p className="mt-1 text-xs text-foreground/50 text-center">
                  Credits are held in escrow and release after a 7-day safety delay.
                </p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <button
                    onClick={handleFlag}
                    disabled={flagLoading}
                    className="text-xs text-foreground/60 underline hover:text-foreground"
                  >
                    {flagLoading ? "Reporting..." : "Report this listing"}
                  </button>
                  {flagError && (
                    <p className="text-xs text-red-600">{flagError}</p>
                  )}
                  {flagSuccess && (
                    <p className="text-xs text-emerald-600">{flagSuccess}</p>
                  )}
                </div>
            </div>
          )}

          {isOwnPost && (
            <div className="border-t border-foreground/10 pt-6 space-y-4">
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
                <p className="text-sm font-medium">Boost this listing</p>
                <p className="mt-1 text-xs text-foreground/60">
                  Homepage boosts reach all visitors. Category boosts target your category.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleBoost("homepage", 1)}
                    disabled={boostLoading}
                    className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-medium hover:bg-foreground/5 transition"
                  >
                    ⭐ Homepage (10 credits / 24h)
                  </button>
                  <button
                    onClick={() => handleBoost("category", 1)}
                    disabled={boostLoading}
                    className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-medium hover:bg-foreground/5 transition"
                  >
                    📌 Category (5 credits / 24h)
                  </button>
                  <button
                    onClick={() => handleBoost("category", 3)}
                    disabled={boostLoading}
                    className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-medium hover:bg-foreground/5 transition"
                  >
                    📌 Category (10 credits / 3 days)
                  </button>
                </div>
                {boostError && (
                  <p className="mt-3 text-xs text-red-600">{boostError}</p>
                )}
                {boostSuccess && (
                  <div className="mt-3 text-xs text-emerald-600 space-y-2">
                    <p>{boostSuccess}</p>
                    <Link
                      href={lastBoostTier === "category" ? "/browse" : "/#featured"}
                      className="inline-flex items-center gap-1 text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
                    >
                      {lastBoostTier === "category"
                        ? "View boosted listing in category"
                        : "View boosted listing on homepage"}
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete Post"}
                </button>
              </div>
              <p className="text-sm text-foreground/60 text-center">
                You&apos;ll be notified when someone responds to your {postType}.
              </p>
            </div>
          )}

          {/* Meta info */}
          <div className="text-xs text-foreground/50 text-center border-t border-foreground/10 pt-4 mt-6">
            <div>
              Posted by{" "}
              {post.profile?.username ? (
                <Link
                  href={`/profile/${post.profile.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium hover:underline underline-offset-2"
                >
                  {post.profile.username}
                </Link>
              ) : (
                <span className="font-medium">Anonymous</span>
              )}
              {post.profile?.total_ratings ? (
                <>
                  {" "}• ⭐ {Number(post.profile.average_rating || 0).toFixed(1)} ({post.profile.total_ratings})
                </>
              ) : (
                <> • New</>
              )}
              {post.profile?.total_contributions ? (
                <> • {post.profile.total_contributions} contributions</>
              ) : null}
            </div>
            <div className="mt-1">
              {new Date(post.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </div>
          </div>
          </div>
          )}

          {activeTab === "messages" && post && (
            <MessageThread
              listingId={postId}
              listingType={postType}
              listingOwnerId={post.user_id}
              listingTitle={post.title}
            />
          )}
        </div>
      </div>
    </div>
  );
}
