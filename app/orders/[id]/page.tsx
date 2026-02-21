"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

type Escrow = {
  id: number;
  request_id: number | null;
  offer_id: number | null;
  payer_id: string;
  provider_id: string;
  credits_held: number;
  status: string;
  release_available_at: string | null;
  created_at: string;
  released_at: string | null;
  delivered_at: string | null;
  payer_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  dispute_reported_at: string | null;
  dispute_status?: string | null;
  dispute_reason?: string | null;
};

type Listing = {
  id: number;
  title: string;
  description?: string | null;
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params?.id);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id || null;
        setCurrentUserId(userId);

        if (!userId || !Number.isFinite(orderId)) {
          setError("Invalid order.");
          setLoading(false);
          return;
        }

        const { data: escrowData, error: escrowError } = await supabase
          .from("credit_escrow")
          .select(
            "id, request_id, offer_id, payer_id, provider_id, credits_held, status, release_available_at, created_at, released_at, delivered_at, payer_confirmed_at, provider_confirmed_at, dispute_reported_at, dispute_status, dispute_reason"
          )
          .eq("id", orderId)
          .maybeSingle();

        if (escrowError || !escrowData) {
          setError("Order not found.");
          setLoading(false);
          return;
        }

        setEscrow(escrowData);

        if (escrowData.offer_id) {
          const { data } = await supabase
            .from("offers")
            .select("id, title, description")
            .eq("id", escrowData.offer_id)
            .maybeSingle();
          setListing(data || null);
        }

        if (escrowData.request_id) {
          const { data } = await supabase
            .from("requests")
            .select("id, title, description")
            .eq("id", escrowData.request_id)
            .maybeSingle();
          setListing(data || null);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orderId]);

  const role = useMemo(() => {
    if (!escrow || !currentUserId) return null;
    if (escrow.payer_id === currentUserId) return "buyer";
    if (escrow.provider_id === currentUserId) return "provider";
    return null;
  }, [escrow, currentUserId]);

  const handleConfirmDelivery = async () => {
    if (!escrow) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/escrow/confirm-delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escrowId: escrow.id }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to confirm delivery");
      }

      setEscrow({
        ...escrow,
        status: payload.status,
        delivered_at: payload.deliveredAt || escrow.delivered_at,
        payer_confirmed_at: new Date().toISOString(),
        release_available_at: payload.releaseAvailableAt || escrow.release_available_at,
      });
      setNotice("Delivery confirmed! 7-day safety period started. Funds will be released when both parties confirm or after 7 days.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm delivery");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!escrow) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/escrow/confirm-completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escrowId: escrow.id }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to confirm completion");
      }

      setEscrow({
        ...escrow,
        status: payload.status,
        provider_confirmed_at: new Date().toISOString(),
      });
      if (payload.bothConfirmed) {
        setNotice("Both parties confirmed! Funds can be released immediately.");
      } else {
        setNotice("Completion confirmed! Awaiting buyer confirmation for instant release.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm completion");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!escrow) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/escrow/release", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escrowId: escrow.id }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to release escrow");
      }

      setEscrow({
        ...escrow,
        status: "released",
        released_at: new Date().toISOString(),
      });
      setNotice("Funds released successfully. Provider earnings will be available for cashout.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release escrow");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!escrow) return;
    const reason = prompt("Describe the issue in detail (required for admin review):") || "";
    if (!reason.trim()) {
      setError("Please provide a detailed description of the issue.");
      return;
    }
    
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/escrow/report-dispute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escrowId: escrow.id, reason }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to open dispute");
      }

      setEscrow({
        ...escrow,
        status: "disputed",
        dispute_status: "open",
        dispute_reported_at: new Date().toISOString(),
        dispute_reason: reason,
      } as Escrow);
      setNotice("Dispute submitted successfully! An admin will review within 48 hours. Both parties will have 48 hours to respond to admin requests.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open dispute");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelDispute = async () => {
    if (!escrow) return;
    
    if (!confirm("Are you sure you want to cancel this dispute? The order will return to normal escrow process.")) {
      return;
    }
    
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/escrow/cancel-dispute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escrowId: escrow.id }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to cancel dispute");
      }

      setEscrow({
        ...escrow,
        status: "held",
        dispute_status: null,
        dispute_reported_at: null,
        dispute_reason: null,
      } as Escrow);
      setNotice("Dispute cancelled successfully. Order returned to normal escrow process.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel dispute");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <p className="text-sm text-foreground/60">Loading order…</p>
        </div>
      </div>
    );
  }

  if (error || !escrow || !role) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Order unavailable</h1>
          <p className="text-sm text-foreground/60">{error || "This order could not be loaded."}</p>
          <a
            href="/dashboard"
            className="inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  const releaseDate = escrow.release_available_at
    ? new Date(escrow.release_available_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">Order</p>
          <h1 className="mt-2 text-3xl font-semibold">Order #{escrow.id}</h1>
          <p className="mt-2 text-sm text-foreground/70">{listing?.title || "Untitled listing"}</p>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Status</span>
            <span className="font-medium capitalize">{escrow.status}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Credits held</span>
            <span className="font-medium">{escrow.credits_held}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Order placed</span>
            <span className="font-medium">{new Date(escrow.created_at).toLocaleDateString()}</span>
          </div>
          {escrow.delivered_at && (
            <div className="flex items-center justify-between text-sm">
              <span>Delivered on</span>
              <span className="font-medium">{new Date(escrow.delivered_at).toLocaleDateString()}</span>
            </div>
          )}
          {releaseDate && (
            <div className="flex items-center justify-between text-sm">
              <span>Funds release date</span>
              <span className="font-medium">{releaseDate}</span>
            </div>
          )}
          
          {/* Confirmation Status */}
          <div className="border-t border-foreground/10 pt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Buyer confirmed</span>
              <span className="font-medium">{escrow.payer_confirmed_at ? "✓ Yes" : "○ No"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Provider confirmed</span>
              <span className="font-medium">{escrow.provider_confirmed_at ? "✓ Yes" : "○ No"}</span>
            </div>
          </div>
          
          <p className="text-xs text-foreground/60">
            Buyers pay the listed price. Providers receive 85% after completion (15% platform fee). Funds release 7 days from the order date once both parties confirm.
          </p>
          {escrow.status === "disputed" && (
            <div className="rounded-lg bg-red-500/10 p-3 border border-red-500/20">
              <p className="text-xs font-medium text-red-600 mb-1">
                Dispute Status: {escrow.dispute_status === "open" ? "Under Review" : escrow.dispute_status}
              </p>
              {escrow.dispute_reason && (
                <p className="text-xs text-red-600">Reason: {escrow.dispute_reason}</p>
              )}
              {escrow.dispute_reported_at && (
                <p className="text-xs text-red-600 mt-1">
                  Reported: {new Date(escrow.dispute_reported_at).toLocaleDateString()} | Admin Response: Within 48 hours
                </p>
              )}
            </div>
          )}
        </div>

        {notice && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Provider Actions */}
        {role === "provider" && escrow.status === "held" && (
          <button
            onClick={handleConfirmCompletion}
            disabled={actionLoading}
            className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
          >
            {actionLoading ? "Updating…" : "Confirm Work Completed"}
          </button>
        )}

        {/* Provider can confirm completion after delivery */}
        {role === "provider" && escrow.status === "delivered" && !escrow.provider_confirmed_at && (
          <button
            onClick={handleConfirmCompletion}
            disabled={actionLoading}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {actionLoading ? "Updating…" : "Confirm Completion"}
          </button>
        )}

        {/* Buyer Actions */}
        {role === "buyer" && escrow.status === "held" && (
          <button
            onClick={handleConfirmDelivery}
            disabled={actionLoading}
            className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {actionLoading ? "Updating…" : "Confirm Delivery Received"}
          </button>
        )}

        {/* Buyer can confirm satisfaction after initial confirmation */}
        {role === "buyer" && escrow.status === "delivered" && !escrow.payer_confirmed_at && (
          <button
            onClick={handleConfirmDelivery}
            disabled={actionLoading}
            className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {actionLoading ? "Updating…" : "Confirm Satisfaction"}
          </button>
        )}

        {/* Release Funds (only when both confirmed and 7 days passed OR admin approved) */}
        {((escrow.payer_confirmed_at && escrow.provider_confirmed_at) || escrow.status === "confirmed") && 
         escrow.status !== "released" && escrow.status !== "disputed" && (
          <button
            onClick={handleRelease}
            disabled={actionLoading}
            className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {actionLoading ? "Releasing…" : "Release Funds"}
          </button>
        )}

        {/* Dispute Button - Available to both parties when not resolved */}
        {escrow.status !== "released" && escrow.status !== "refunded" && escrow.status !== "disputed" && (
          <button
            onClick={handleReportIssue}
            disabled={actionLoading}
            className="w-full rounded-md border border-red-500/40 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-500/5 disabled:opacity-60"
          >
            {actionLoading ? "Submitting…" : "Report Issue / Dispute"}
          </button>
        )}

        {/* Cancel Dispute Button - Available only to the person who reported it */}
        {escrow.status === "disputed" && escrow.dispute_status === "open" && (
          <button
            onClick={handleCancelDispute}
            disabled={actionLoading}
            className="w-full rounded-md border border-orange-500/40 px-4 py-3 text-sm font-medium text-orange-600 hover:bg-orange-500/5 disabled:opacity-60"
          >
            {actionLoading ? "Cancelling…" : "Cancel Dispute"}
          </button>
        )}

        <a
          href="/dashboard"
          className="inline-flex w-fit rounded-md border border-foreground/20 px-4 py-2 text-sm"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
