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
  provider_marked_complete_at: string | null;
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
            "id, request_id, offer_id, payer_id, provider_id, credits_held, status, release_available_at, created_at, released_at, provider_marked_complete_at"
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

  const handleMarkDelivered = async () => {
    if (!escrow) return;
    setActionLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/escrow/mark-delivered", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escrowId: escrow.id }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to mark delivered");
      }

      setEscrow({
        ...escrow,
        status: payload.status,
        provider_marked_complete_at: payload.providerMarkedCompleteAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!escrow) return;
    setActionLoading(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release escrow");
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
          {releaseDate && (
            <div className="flex items-center justify-between text-sm">
              <span>Release available</span>
              <span className="font-medium">{releaseDate}</span>
            </div>
          )}
          <p className="text-xs text-foreground/60">
            Buyers pay the listed price. Providers receive 85% after completion (15% platform fee).
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {role === "provider" && escrow.status === "held" && (
          <button
            onClick={handleMarkDelivered}
            disabled={actionLoading}
            className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
          >
            {actionLoading ? "Updating…" : "Mark delivered"}
          </button>
        )}

        {role === "buyer" && escrow.status !== "released" && (
          <button
            onClick={handleRelease}
            disabled={actionLoading}
            className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
          >
            {actionLoading ? "Releasing…" : "Release funds"}
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
