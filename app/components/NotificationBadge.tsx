"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";

interface Notification {
  id: number;
  type: "new_order" | "dispute_filed" | "dispute_resolved" | "order_completed" | "late_delivery" | "admin_message";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_escrow_id?: number;
  related_offer_id?: number;
  related_request_id?: number;
}

interface NotificationBadgeProps {
  className?: string;
  showCount?: boolean;
}

const getTypeColor = (type: string) => {
  switch (type) {
    case "new_order": return "bg-green-500";
    case "dispute_filed": return "bg-red-500";
    case "dispute_resolved": return "bg-blue-500";
    case "order_completed": return "bg-emerald-500";
    case "late_delivery": return "bg-yellow-500";
    case "admin_message": return "bg-purple-500";
    default: return "bg-gray-500";
  }
};

export default function NotificationBadge({ className = "", showCount = true }: NotificationBadgeProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/notifications?unread=true", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || notifications.length === 0) {
    return null;
  }

  // Group notifications by type to determine the highest priority color
  const typeGroups = notifications.reduce((acc, notif) => {
    acc[notif.type] = (acc[notif.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Priority order: admin_message > dispute_filed > late_delivery > new_order > order_completed > dispute_resolved
  const priorityOrder = ["admin_message", "dispute_filed", "late_delivery", "new_order", "order_completed", "dispute_resolved"];
  const topPriorityType = priorityOrder.find(type => typeGroups[type] > 0) || "new_order";
  
  const totalCount = notifications.length;
  const colorClass = getTypeColor(topPriorityType);

  return (
    <div className={`relative ${className}`}>
      <div
        className={`absolute -top-1 -right-1 ${colorClass} text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1 shadow-sm`}
        style={{ fontSize: "10px" }}
      >
        {showCount ? (totalCount > 99 ? "99+" : totalCount) : ""}
      </div>
    </div>
  );
}

export { type Notification };