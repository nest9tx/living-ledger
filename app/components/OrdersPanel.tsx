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

export default function OrdersPanel() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requestMap, setRequestMap] = useState<Record<number, Listing>>({});
  const [offerMap, setOfferMap] = useState<Record<number, Listing>>({});

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
      {escrows.map((escrow) => {
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

        return (
          <div
            key={escrow.id}
            className="rounded-2xl border border-foreground/10 bg-foreground/2 p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-foreground/60">Order #{escrow.id}</p>
                <h3 className="text-lg font-semibold">{listingTitle}</h3>
                <p className="text-xs text-foreground/60">Role: {role}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{escrow.credits_held} credits</p>
                <p className="text-xs text-foreground/60">Status: {escrow.status}</p>
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
