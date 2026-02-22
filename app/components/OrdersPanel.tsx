"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type Listing = {
  id: number;
  title: string;
};

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

// Helper function to get status badge color and text
const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "disputed":
      return {
        color: "bg-red-500 text-white",
        text: "⚠️ DISPUTE",
        priority: 1
      };
    case "held":
      return {
        color: "bg-yellow-500 text-white",
        text: "⏳ PENDING",
        priority: 3
      };
    case "delivered":
      return {
        color: "bg-blue-500 text-white", 
        text: "✅ DELIVERED",
        priority: 4
      };
    case "confirmed":
      return {
        color: "bg-green-500 text-white",
        text: "🎉 CONFIRMED", 
        priority: 5
      };
    case "released":
      return {
        color: "bg-emerald-500 text-white",
        text: "💰 COMPLETED",
        priority: 6
      };
    case "refunded":
      return {
        color: "bg-gray-500 text-white",
        text: "↩️ REFUNDED",
        priority: 7
      };
    default:
      return {
        color: "bg-gray-400 text-white",
        text: status.toUpperCase(),
        priority: 8
      };
  }
};

type FilterKey = "all" | "disputed" | "held" | "delivered" | "completed";

export default function OrdersPanel() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requestMap, setRequestMap] = useState<Record<number, Listing>>({});
  const [offerMap, setOfferMap] = useState<Record<number, Listing>>({});
  const [filterStatus, setFilterStatus] = useState<FilterKey>("all");

  // Mark order-related notifications as read when component loads
  const markOrderNotificationsAsRead = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      // Get unread order-related notifications
      const notificationsRes = await fetch("/api/notifications?unread=true", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        const orderNotifications = data.notifications.filter((n: NotificationItem) => 
          n.type === "new_order" || n.type === "dispute_filed" || n.type === "order_completed"
        );

        if (orderNotifications.length > 0) {
          await fetch("/api/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "markRead",
              notificationIds: orderNotifications.map((n: NotificationItem) => n.id),
            }),
          });
        }
      }
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id || null;
        setCurrentUserId(userId);

        if (!userId) {
          setEscrows([]);
          setLoading(false);
          return;
        }

        const { data: escrowData, error: escrowError } = await supabase
          .from("credit_escrow")
          .select(
            "id, request_id, offer_id, payer_id, provider_id, credits_held, status, release_available_at, created_at, released_at"
          )
          .order("created_at", { ascending: false });

        if (escrowError) {
          console.error("Error loading escrows:", escrowError);
          setEscrows([]);
          setLoading(false);
          return;
        }

        const escrowsList = escrowData || [];
        setEscrows(escrowsList);

        const requestIds = escrowsList
          .map((item) => item.request_id)
          .filter((id): id is number => typeof id === "number");

        const offerIds = escrowsList
          .map((item) => item.offer_id)
          .filter((id): id is number => typeof id === "number");

        if (requestIds.length > 0) {
          const { data: requests } = await supabase
            .from("requests")
            .select("id, title")
            .in("id", requestIds);

          const map = (requests || []).reduce((acc, row) => {
            acc[row.id] = row;
            return acc;
          }, {} as Record<number, Listing>);

          setRequestMap(map);
        }

        if (offerIds.length > 0) {
          const { data: offers } = await supabase
            .from("offers")
            .select("id, title")
            .in("id", offerIds);

          const map = (offers || []).reduce((acc, row) => {
            acc[row.id] = row;
            return acc;
          }, {} as Record<number, Listing>);

          setOfferMap(map);
        }

        // Mark order-related notifications as read
        await markOrderNotificationsAsRead();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const emptyState = useMemo(() => !loading && escrows.length === 0, [loading, escrows]);

  const filteredEscrows = useMemo(() => {
    if (filterStatus === "all") return escrows;
    if (filterStatus === "disputed") return escrows.filter((e) => e.status === "disputed");
    if (filterStatus === "held") return escrows.filter((e) => e.status === "held" || e.status === "confirmed");
    if (filterStatus === "delivered") return escrows.filter((e) => e.status === "delivered");
    if (filterStatus === "completed") return escrows.filter((e) => e.status === "released" || e.status === "refunded");
    return escrows;
  }, [escrows, filterStatus]);

  if (loading) {
    return <div className="text-sm text-foreground/60">Loading orders…</div>;
  }

  if (emptyState) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-6 text-sm text-foreground/60">
        No active orders yet. Purchases create a shared escrow record you can track here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Filter Bar */}
      <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-3">
        <p className="text-xs text-foreground/70 mb-2">Filter by status — tap to show only that type:</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-2 py-1 rounded-full font-bold border-2 transition ${
              filterStatus === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-foreground/10 text-foreground/60 border-transparent hover:bg-foreground/20"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "disputed" ? "all" : "disputed")}
            className={`px-2 py-1 rounded-full font-bold border-2 transition ${
              filterStatus === "disputed"
                ? "bg-red-500 text-white border-red-300 ring-2 ring-red-300"
                : "bg-red-500 text-white border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            ⚠️ DISPUTE
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "held" ? "all" : "held")}
            className={`px-2 py-1 rounded-full font-bold border-2 transition ${
              filterStatus === "held"
                ? "bg-yellow-500 text-white border-yellow-200 ring-2 ring-yellow-200"
                : "bg-yellow-500 text-white border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            ⏳ PENDING
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "delivered" ? "all" : "delivered")}
            className={`px-2 py-1 rounded-full font-bold border-2 transition ${
              filterStatus === "delivered"
                ? "bg-blue-500 text-white border-blue-200 ring-2 ring-blue-200"
                : "bg-blue-500 text-white border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            ✅ DELIVERED
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "completed" ? "all" : "completed")}
            className={`px-2 py-1 rounded-full font-bold border-2 transition ${
              filterStatus === "completed"
                ? "bg-emerald-500 text-white border-emerald-200 ring-2 ring-emerald-200"
                : "bg-emerald-500 text-white border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            💰 COMPLETED
          </button>
        </div>
      </div>

      {filteredEscrows.length === 0 && (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-6 text-sm text-foreground/60">
          No orders match that filter.
        </div>
      )}

      {filteredEscrows.map((escrow) => {
        const listingTitle = escrow.offer_id
          ? offerMap[escrow.offer_id]?.title
          : escrow.request_id
            ? requestMap[escrow.request_id]?.title
            : "Untitled";

        const role = currentUserId === escrow.payer_id ? "Buyer" : "Provider";
        const releaseDate = escrow.release_available_at
          ? new Date(escrow.release_available_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : null;

        const statusBadge = getStatusBadge(escrow.status);

        // Late order: held (not yet delivered) and past the 7-day release window
        const isLate =
          escrow.status === "held" &&
          escrow.release_available_at !== null &&
          new Date(escrow.release_available_at) < new Date();

        return (
          <div
            key={escrow.id}
            className={`rounded-2xl border p-5 relative ${
              isLate
                ? "border-orange-500/40 bg-orange-500/5"
                : "border-foreground/10 bg-foreground/2"
            }`}
          >
            {/* Status Badge */}
            <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
              <div className={`px-2 py-1 text-xs font-bold rounded-full ${statusBadge.color}`}>
                {statusBadge.text}
              </div>
              {isLate && (
                <div className="px-2 py-1 text-xs font-bold rounded-full bg-orange-500 text-white">
                  ⏰ LATE
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pr-24">
              <div>
                <p className="text-sm text-foreground/60">Order #{escrow.id}</p>
                <h3 className="text-lg font-semibold">{listingTitle}</h3>
                <p className="text-xs text-foreground/60">Role: {role}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{escrow.credits_held} credits</p>
                {releaseDate && (
                  <p className="text-xs text-foreground/50">Release after {releaseDate}</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`/orders/${escrow.id}`}
                className="inline-flex rounded-md border border-foreground/20 px-3 py-2 text-xs font-medium hover:bg-foreground/5"
              >
                View order
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
