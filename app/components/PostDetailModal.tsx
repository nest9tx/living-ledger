"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import { deleteRequest, deleteOffer } from "@/lib/supabase-helpers";

type PostDetailProps = {
  postId: number;
  postType: "request" | "offer";
  onClose: () => void;
  onDelete?: () => void;
};

type PostDetail = {
  id: number;
  title: string;
  description: string;
  created_at: string;
  category_id: number | null;
  user_id: string;
  categories: { name: string; icon: string } | null;
  profile?: { username: string } | null;
  price_credits?: number;
  budget_credits?: number;
  status?: string;
};

export default function PostDetailModal({ postId, postType, onClose, onDelete }: PostDetailProps) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
            .select("username")
            .eq("id", data.user_id)
            .single();
          
          postData = { ...postData, profile: profileData };
        }

        setPost(postData);
      } catch (err) {
        console.error("Error loading post:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId, postType]);

  const handleRespond = async () => {
    if (!message.trim()) {
      alert("Please enter a message");
      return;
    }

    try {
      // For MVP, we'll just show an alert
      // In the future, this would create a message/interaction record
      alert(`Message sent! (MVP: Full messaging coming soon)\n\nYour message: "${message}"`);
      setMessage("");
      onClose();
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Please try again.");
    }
  };

  const handlePurchase = async () => {
    try {
      // For MVP, we'll just show a confirmation
      // In the future, this would handle credit escrow and notifications
      const credits = postType === "offer" ? post?.price_credits : post?.budget_credits;
      if (confirm(`Purchase this ${postType} for ${credits} credits?\n\n(MVP: Payment processing coming soon)`)) {
        alert(`Purchase initiated! The creator will be notified.\n\n(MVP: Full transaction flow coming soon)`);
        onClose();
      }
    } catch (err) {
      console.error("Error purchasing:", err);
      alert("Failed to process purchase. Please try again.");
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-2">
              Description
            </h3>
            <p className="text-foreground whitespace-pre-wrap">{post.description}</p>
          </div>

          {/* Credits */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-foreground/5 border border-foreground/10">
            <div className="text-3xl">💰</div>
            <div>
              <div className="text-sm text-foreground/60">
                {postType === "offer" ? "Price" : "Budget"}
              </div>
              <div className="text-2xl font-semibold">
                {postType === "offer" ? post.price_credits : post.budget_credits} credits
              </div>
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
          {!isOwnPost && (
            <div className="border-t border-foreground/10 pt-6">
              <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-4">
                Interested?
              </h3>
              
              {/* Message Box */}
              <div className="space-y-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Send a message to the ${postType === "request" ? "requester" : "offerer"}...`}
                  className="w-full rounded-lg border border-foreground/20 bg-background px-4 py-3 text-sm focus:border-foreground/40 focus:outline-none resize-none"
                  rows={3}
                />
                
                <div className="flex gap-3">
                  <button
                    onClick={handleRespond}
                    className="flex-1 rounded-lg border border-foreground/20 bg-background px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition"
                  >
                    Send Message
                  </button>
                  <button
                    onClick={handlePurchase}
                    className="flex-1 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition"
                  >
                    {postType === "offer" ? "Purchase" : "Accept & Pay"}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-foreground/50 text-center">
                💡 MVP: Full messaging and escrow payment flow coming soon
              </p>
            </div>
          )}

          {isOwnPost && (
            <div className="border-t border-foreground/10 pt-6 space-y-4">
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
          <div className="text-xs text-foreground/50 text-center border-t border-foreground/10 pt-4">
            <div>
              Posted by <span className="font-medium">{post.profile?.username || "Anonymous"}</span>
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
      </div>
    </div>
  );
}
