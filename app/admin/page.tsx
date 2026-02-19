"use client";

/**
 * Admin Dashboard
 * 
 * Access restricted to admins only.
 * Shows moderation tools, platform analytics, and user management.
 * 
 * Route: /app/admin
 * 
 * TODO: Implement full features:
 * 1. Verify user is admin (check is_admin flag in profiles)
 * 2. Add analytics: total users, credits flowing, revenue
 * 3. Moderation queue: flagged posts, disputed transactions
 * 4. User management: suspend, delete, reset credits
 * 5. Dispute resolution: review cases, release escrowed credits
 * 6. Settings: configure platform fees, listing duration, etc
 */

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import { SkeletonLoader, SkeletonTableRow } from "@/app/components/Skeletons";

type AdminStats = {
  totalUsers: number;
  activeListings: number;
  totalCreditsFlowing: number;
  platformRevenue: number;
  flaggedItems: number;
  openDisputes: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "moderation" | "disputes" | "cashouts" | "listings" | "users" | "messages" | "settings"
  >("overview");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashouts, setCashouts] = useState<any[]>([]);
  const [cashoutsLoading, setCashoutsLoading] = useState(false);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [flags, setFlags] = useState<any[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [listings, setListings] = useState<{ offers: any[]; requests: any[] }>({ offers: [], requests: [] });
  const [listingsLoading, setListingsLoading] = useState(false);
  const [editListing, setEditListing] = useState<{
    id: number;
    type: string;
    title: string;
    description: string;
    price: number | string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    const checkAdminAndLoadStats = async () => {
      try {
        // Check if current user is admin
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.user.id)
          .single();

        if (!profile?.is_admin) {
          setError("Admin access denied");
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        // Fetch real statistics from API
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) {
          setError("No session token");
          setLoading(false);
          return;
        }

        const statsRes = await fetch("/api/admin/stats", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!statsRes.ok) {
          setError("Failed to load statistics");
          setLoading(false);
          return;
        }

        const statsData = await statsRes.json();
        setStats(statsData.stats);

        await Promise.all([loadDisputes(), loadFlags(), loadCashouts(), loadUsers(), loadAdminMessages()]);
      } catch (err) {
        console.error("Admin dashboard error:", err);
        setError("Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndLoadStats();
  }, []);

  // Load users when Users tab is clicked
  useEffect(() => {
    if (activeTab === "users" && users.length === 0) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadDisputes = async () => {
    setDisputeLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/admin/escrow/list?status=disputed", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Failed to load disputes:", payload?.error);
        return;
      }

      setDisputes(payload.escrows || []);
    } finally {
      setDisputeLoading(false);
    }
  };

  const loadFlags = async () => {
    setFlagsLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/admin/flags/list?status=open", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Failed to load flags:", payload?.error);
        return;
      }

      setFlags(payload.flags || []);
    } finally {
      setFlagsLoading(false);
    }
  };

  const loadCashouts = async () => {
    setCashoutsLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/admin/cashout/list?status=pending", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Failed to load cashouts:", payload?.error);
        return;
      }

      setCashouts(payload.cashouts || []);
    } finally {
      setCashoutsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/admin/users/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Failed to load users:", payload?.error);
        return;
      }

      setUsers(payload.users || []);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAdminMessages = async () => {
    setMessagesLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/messages/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Failed to load admin messages:", payload?.error);
        return;
      }

      // Filter for all messages in conversations involving current admin
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        // Get all conversations where admin is involved and no listing_id (admin conversations)
        const adminConversationMessages = payload.messages?.filter((msg: {
          from_user_id: string;
          to_user_id: string;
          listing_id?: number | null;
        }) => 
          (msg.from_user_id === userData.user.id || msg.to_user_id === userData.user.id) && 
          !msg.listing_id
        ) || [];

        // Get unique user IDs to fetch usernames
        const userIds = Array.from(new Set(
          adminConversationMessages.flatMap((msg: any) => [msg.from_user_id, msg.to_user_id])
        )).filter((id) => typeof id === 'string' && id !== userData.user.id) as string[];

        // Fetch usernames
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);

        const usernameMap = (profiles || []).reduce((acc: any, profile: any) => {
          acc[profile.id] = profile.username || "Unknown User";
          return acc;
        }, {});

        // Group messages by other user (conversation partner)
        const conversationGroups: Record<string, any[]> = {};
        
        adminConversationMessages.forEach((msg: any) => {
          const otherUserId = msg.from_user_id === userData.user.id ? msg.to_user_id : msg.from_user_id;
          if (!conversationGroups[otherUserId]) {
            conversationGroups[otherUserId] = [];
          }
          conversationGroups[otherUserId].push({
            ...msg,
            from_username: usernameMap[msg.from_user_id] || "Unknown User",
            to_username: usernameMap[msg.to_user_id] || "Unknown User",
            other_user_id: otherUserId,
            other_username: usernameMap[otherUserId] || "Unknown User"
          });
        });

        // Convert to flat list sorted by latest message per conversation
        const conversationList = Object.entries(conversationGroups).map(([otherUserId, messages]) => {
          const sortedMessages = messages.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          return sortedMessages[0]; // Get latest message to represent the conversation
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setAdminMessages(conversationList);
      }
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleFlagResolve = async (flagId: number, action: "dismiss" | "remove") => {
    const adminNote = prompt("Admin note (optional):") || "";
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch("/api/admin/flags/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ flagId, action, adminNote }),
    });

    const payload = await res.json();
    if (!res.ok) {
      alert(payload?.error || "Failed to resolve flag");
      return;
    }

    await loadFlags();
  };

  const handleAdminRelease = async (escrowId: number) => {
    const adminNote = prompt("Admin note (optional):") || "";
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch("/api/admin/escrow/force-release", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ escrowId, adminNote }),
    });

    const payload = await res.json();
    if (!res.ok) {
      alert(payload?.error || "Failed to release escrow");
      return;
    }

    await loadDisputes();
  };

  const handleAdminRefund = async (escrowId: number) => {
    const adminNote = prompt("Admin note (optional):") || "";
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch("/api/admin/escrow/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ escrowId, adminNote }),
    });

    const payload = await res.json();
    if (!res.ok) {
      alert(payload?.error || "Failed to refund escrow");
      return;
    }

    await loadDisputes();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-6xl mx-auto">
          <SkeletonLoader width="w-1/3" height="h-8" />
          <div className="mt-6 space-y-4">
            <SkeletonTableRow columns={4} />
            <SkeletonTableRow columns={4} />
            <SkeletonTableRow columns={4} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-6">
            <p className="text-red-600">⚠️ {error || "Access denied"}</p>
            <p className="text-sm text-red-600/80 mt-2">
              You do not have permission to access the admin dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const loadListings = async () => {
    setListingsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/admin/listings/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (res.ok) setListings({ offers: payload.offers || [], requests: payload.requests || [] });
    } finally {
      setListingsLoading(false);
    }
  };

  const handleDeleteListing = async (listing_id: number, listing_type: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/admin/listings/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listing_id, listing_type }),
    });
    const payload = await res.json();
    if (!res.ok) { alert(payload?.error || "Failed to delete"); return; }
    alert("✓ Listing deleted");
    await loadListings();
  };

  const handleRemoveBoost = async (listing_id: number, listing_type: string) => {
    if (!confirm(`Remove boost from this ${listing_type}?`)) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/admin/listings/remove-boost", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listing_id, listing_type }),
    });
    const payload = await res.json();
    if (!res.ok) { alert(payload?.error || "Failed to remove boost"); return; }
    alert("✓ Boost removed");
    await loadListings();
  };

  const handleSaveEdit = async () => {
    if (!editListing) return;
    setEditSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/listings/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        listing_id: editListing.id,
        listing_type: editListing.type,
        title: editListing.title,
        description: editListing.description,
        price_credits: editListing.price,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditListing(null);
      await loadListings();
    } else {
      const payload = await res.json();
      alert(payload.error || "Failed to save changes.");
    }
  };

  const handleAdminBoost = async (listing_id: number, listing_type: string) => {
    if (!confirm("Grant a free 30-day homepage boost to this listing?")) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/listings/boost", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listing_id, listing_type }),
    });
    if (res.ok) {
      await loadListings();
    } else {
      const payload = await res.json();
      alert(payload.error || "Failed to apply boost.");
    }
  };

  const handleSuspend = async (listing_id: number, listing_type: string, suspend: boolean) => {
    const action = suspend ? "suspend" : "reinstate";
    if (!confirm(`Are you sure you want to ${action} this listing?`)) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/listings/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listing_id, listing_type, suspend }),
    });
    if (res.ok) {
      await loadListings();
    } else {
      const payload = await res.json();
      alert(payload.error || `Failed to ${action} listing.`);
    }
  };

  const tabList = ["overview", "moderation", "disputes", "cashouts", "listings", "users", "messages", "settings"] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">🔧 Admin Dashboard</h1>
          <p className="text-foreground/70 mt-2">
            Platform moderation, analytics, and management
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
              <p className="text-sm text-foreground/70">Total Users</p>
              <p className="text-2xl font-semibold mt-2">{stats.totalUsers}</p>
            </div>
            <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
              <p className="text-sm text-foreground/70">Active Listings</p>
              <p className="text-2xl font-semibold mt-2">{stats.activeListings}</p>
            </div>
            <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
              <p className="text-sm text-foreground/70">Credits Flowing</p>
              <p className="text-2xl font-semibold mt-2">{stats.totalCreditsFlowing}</p>
            </div>
            <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
              <p className="text-sm text-foreground/70">Platform Revenue</p>
              <p className="text-2xl font-semibold mt-2">${stats.platformRevenue}</p>
            </div>
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-600">Flagged Items</p>
              <p className="text-2xl font-semibold mt-2 text-yellow-600">
                {stats.flaggedItems}
              </p>
            </div>
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm text-red-600">Open Disputes</p>
              <p className="text-2xl font-semibold mt-2 text-red-600">
                {stats.openDisputes}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-foreground/10 mb-6">
          <div className="flex gap-8 overflow-x-auto">
            {tabList.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab as any);
                  if (tab === "listings") loadListings();
                }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition capitalize ${
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground/60 hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Platform Overview</h2>
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                <p className="text-foreground/70">
                  Real-time platform analytics and metrics coming soon.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-foreground/60">
                  <li>• Daily active users trend</li>
                  <li>• Credit flow metrics (total, velocity)</li>
                  <li>• Revenue & marketplace health</li>
                  <li>• Trust score distribution</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "moderation" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Moderation Queue</h2>
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                <p className="text-foreground/70 mb-4">
                  Flagged content awaiting review ({stats?.flaggedItems || 0})
                </p>
                {flagsLoading ? (
                  <p className="text-sm text-foreground/60">Loading flags…</p>
                ) : flags.length === 0 ? (
                  <p className="text-sm text-foreground/60">
                    No flagged listings right now.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {flags.map((flag) => (
                      <div
                        key={flag.id}
                        className="flex flex-col gap-3 rounded-lg border border-yellow-500/20 p-3"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">Flag #{flag.id}</p>
                              <p className="text-xs text-foreground/50">
                                {flag.post_type === "offer" ? "Offer" : "Request"} • Reported{" "}
                                {new Date(flag.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            {flag.listingCredits && (
                              <span className="text-sm font-medium">
                                {flag.listingCredits} credits
                              </span>
                            )}
                          </div>
                          <div className="rounded bg-foreground/5 p-3 space-y-2">
                            <p className="text-sm font-medium">{flag.listingTitle}</p>
                            {flag.listingDescription && (
                              <p className="text-xs text-foreground/70 whitespace-pre-wrap">
                                {flag.listingDescription}
                              </p>
                            )}
                          </div>
                          {flag.reason && (
                            <div className="rounded bg-red-500/5 p-2">
                              <p className="text-xs text-red-600">
                                <strong>Report reason:</strong> {flag.reason}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleFlagResolve(flag.id, "dismiss")}
                            className="px-3 py-1 text-xs rounded border border-green-500/20 text-green-600 hover:bg-green-500/5"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={() => handleFlagResolve(flag.id, "remove")}
                            className="px-3 py-1 text-xs rounded border border-red-500/20 text-red-600 hover:bg-red-500/5"
                          >
                            Remove listing
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "disputes" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Dispute Resolution</h2>
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                <p className="text-foreground/70 mb-4">
                  Open disputes: {disputes.length}
                </p>
                {disputeLoading ? (
                  <p className="text-sm text-foreground/60">Loading disputes…</p>
                ) : disputes.length === 0 ? (
                  <p className="text-sm text-foreground/60">
                    No open disputes right now.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {disputes.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg border border-red-500/20 p-3"
                      >
                        <div className="flex flex-col gap-1">
                          <p className="font-medium">Dispute #{item.id}</p>
                          <p className="text-xs text-foreground/50">
                            {item.credits_held} credits • Status: {item.status}
                          </p>
                          {item.dispute_reason && (
                            <p className="text-xs text-foreground/60">
                              Reason: {item.dispute_reason}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAdminRelease(item.id)}
                            className="px-3 py-1 text-xs rounded border border-foreground/20 hover:bg-foreground/5"
                          >
                            Release to provider
                          </button>
                          <button
                            onClick={() => handleAdminRefund(item.id)}
                            className="px-3 py-1 text-xs rounded border border-red-500/20 text-red-600 hover:bg-red-500/5"
                          >
                            Refund buyer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "cashouts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Cashout Requests</h2>
                <button
                  onClick={loadCashouts}
                  className="text-sm px-3 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
                >
                  Refresh
                </button>
              </div>

              {cashoutsLoading ? (
                <p className="text-foreground/60">Loading cashouts...</p>
              ) : cashouts.length === 0 ? (
                <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                  <p className="text-foreground/70">No pending cashout requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cashouts.map((req) => (
                    <div key={req.id} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">
                            ${req.amount_credits} from {req.user?.username || "Unknown user"}
                          </p>
                          <p className="text-xs text-foreground/60 mt-1">
                            {req.user?.email || "No email"} · Requested {new Date(req.requested_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs mt-1">
                            {req.user?.stripe_account_id && req.user?.stripe_onboarding_complete
                              ? <span className="text-emerald-600">✓ Stripe connected ({req.user.stripe_account_status}) · {req.user.stripe_account_id}</span>
                              : <span className="text-amber-500">⚠ No Stripe account — manual payout required</span>
                            }
                          </p>
                          {req.admin_note && (
                            <p className="text-xs text-foreground/70 mt-2 italic">{req.admin_note}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const note = prompt("Admin note (optional):");
                              const { data } = await supabase.auth.getSession();
                              const token = data.session?.access_token;
                              if (!token) return;

                              const res = await fetch("/api/admin/cashout/approve", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ cashout_id: req.id, admin_note: note }),
                              });

                              const payload = await res.json();
                              if (!res.ok) {
                                alert(payload?.error || "Failed to approve");
                                return;
                              }

                              if (payload.transferSuccessful) {
                                alert(`✓ Cashout approved and $${req.amount_credits} transferred via Stripe automatically.`);
                              } else {
                                alert(`✓ Cashout approved but Stripe transfer failed — manual payout required.\n\nUser: ${req.user?.username} (${req.user?.email})\nAmount: $${req.amount_credits}\nStripe ID: ${req.user?.stripe_account_id || "Not connected"}`);
                              }
                              await loadCashouts();
                            }}
                            className="px-3 py-1 text-xs rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              const note = prompt("Rejection reason:");
                              const { data } = await supabase.auth.getSession();
                              const token = data.session?.access_token;
                              if (!token) return;

                              const res = await fetch("/api/admin/cashout/reject", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ cashout_id: req.id, admin_note: note }),
                              });

                              const payload = await res.json();
                              if (!res.ok) {
                                alert(payload?.error || "Failed to reject");
                                return;
                              }

                              alert("✓ Cashout rejected and credits returned to user");
                              await loadCashouts();
                            }}
                            className="px-3 py-1 text-xs rounded bg-red-500/10 border border-red-500/20 text-red-700 hover:bg-red-500/20"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "listings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Listing Management</h2>
                <button
                  onClick={loadListings}
                  className="text-sm px-3 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
                >
                  Refresh
                </button>
              </div>

              {/* Edit modal */}
              {editListing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-lg rounded-lg border border-foreground/20 bg-background shadow-xl p-6 space-y-4">
                    <h3 className="font-semibold text-lg">Edit Listing</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-foreground/60 uppercase tracking-wide">Title</label>
                        <input
                          type="text"
                          value={editListing.title}
                          onChange={(e) => setEditListing({ ...editListing, title: e.target.value })}
                          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-foreground/60 uppercase tracking-wide">Description</label>
                        <textarea
                          value={editListing.description}
                          onChange={(e) => setEditListing({ ...editListing, description: e.target.value })}
                          rows={4}
                          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-foreground/60 uppercase tracking-wide">
                          {editListing.type === "offer" ? "Price" : "Budget"} (credits)
                        </label>
                        <input
                          type="number"
                          value={editListing.price}
                          onChange={(e) => setEditListing({ ...editListing, price: e.target.value })}
                          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        onClick={() => setEditListing(null)}
                        className="px-4 py-2 text-sm rounded border border-foreground/20 hover:bg-foreground/5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={editSaving}
                        className="px-4 py-2 text-sm rounded bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                      >
                        {editSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {listingsLoading ? (
                <p className="text-foreground/60 text-sm">Loading listings…</p>
              ) : (
                <>
                  {/* Offers */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-2">
                      Offers ({listings.offers.length})
                    </h3>
                    {listings.offers.length === 0 ? (
                      <p className="text-sm text-foreground/50">No offers found.</p>
                    ) : (
                      <div className="space-y-2">
                        {listings.offers.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                              item.suspended
                                ? "border-orange-500/30 bg-orange-500/5"
                                : "border-foreground/10 bg-foreground/2"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">{item.title}</p>
                                {item.is_boosted && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/20">⚡ Boosted</span>
                                )}
                                {item.suspended && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 border border-orange-500/20">🚫 Suspended</span>
                                )}
                                <span className="text-xs text-foreground/50">{item.display_credits} credits · by {item.username}</span>
                              </div>
                              <p className="text-xs text-foreground/50 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                              <button
                                onClick={() => setEditListing({ id: item.id, type: "offer", title: item.title, description: item.description, price: item.display_credits })}
                                className="px-2 py-1 text-xs rounded border border-foreground/20 hover:bg-foreground/5"
                              >
                                Edit
                              </button>
                              {!item.is_boosted && !item.suspended && (
                                <button
                                  onClick={() => handleAdminBoost(item.id, "offer")}
                                  className="px-2 py-1 text-xs rounded border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5"
                                >
                                  ⭐ Boost
                                </button>
                              )}
                              {item.is_boosted && (
                                <button
                                  onClick={() => handleRemoveBoost(item.id, "offer")}
                                  className="px-2 py-1 text-xs rounded border border-amber-500/20 text-amber-600 hover:bg-amber-500/5"
                                >
                                  Remove boost
                                </button>
                              )}
                              <button
                                onClick={() => handleSuspend(item.id, "offer", !item.suspended)}
                                className={`px-2 py-1 text-xs rounded border ${
                                  item.suspended
                                    ? "border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5"
                                    : "border-orange-500/20 text-orange-600 hover:bg-orange-500/5"
                                }`}
                              >
                                {item.suspended ? "Reinstate" : "Suspend"}
                              </button>
                              <button
                                onClick={() => handleDeleteListing(item.id, "offer", item.title)}
                                className="px-2 py-1 text-xs rounded border border-red-500/20 text-red-600 hover:bg-red-500/5"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Requests */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-2 mt-4">
                      Requests ({listings.requests.length})
                    </h3>
                    {listings.requests.length === 0 ? (
                      <p className="text-sm text-foreground/50">No requests found.</p>
                    ) : (
                      <div className="space-y-2">
                        {listings.requests.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                              item.suspended
                                ? "border-orange-500/30 bg-orange-500/5"
                                : "border-foreground/10 bg-foreground/2"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">{item.title}</p>
                                {item.is_boosted && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/20">⚡ Boosted</span>
                                )}
                                {item.suspended && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 border border-orange-500/20">🚫 Suspended</span>
                                )}
                                <span className="text-xs text-foreground/50">Budget: {item.display_credits} credits · by {item.username}</span>
                              </div>
                              <p className="text-xs text-foreground/50 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                              <button
                                onClick={() => setEditListing({ id: item.id, type: "request", title: item.title, description: item.description, price: item.display_credits })}
                                className="px-2 py-1 text-xs rounded border border-foreground/20 hover:bg-foreground/5"
                              >
                                Edit
                              </button>
                              {!item.is_boosted && !item.suspended && (
                                <button
                                  onClick={() => handleAdminBoost(item.id, "request")}
                                  className="px-2 py-1 text-xs rounded border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5"
                                >
                                  ⭐ Boost
                                </button>
                              )}
                              {item.is_boosted && (
                                <button
                                  onClick={() => handleRemoveBoost(item.id, "request")}
                                  className="px-2 py-1 text-xs rounded border border-amber-500/20 text-amber-600 hover:bg-amber-500/5"
                                >
                                  Remove boost
                                </button>
                              )}
                              <button
                                onClick={() => handleSuspend(item.id, "request", !item.suspended)}
                                className={`px-2 py-1 text-xs rounded border ${
                                  item.suspended
                                    ? "border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5"
                                    : "border-orange-500/20 text-orange-600 hover:bg-orange-500/5"
                                }`}
                              >
                                {item.suspended ? "Reinstate" : "Suspend"}
                              </button>
                              <button
                                onClick={() => handleDeleteListing(item.id, "request", item.title)}
                                className="px-2 py-1 text-xs rounded border border-red-500/20 text-red-600 hover:bg-red-500/5"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">User Management</h2>
                <button
                  onClick={loadUsers}
                  className="text-sm px-3 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
                >
                  Refresh
                </button>
              </div>

              {usersLoading ? (
                <p className="text-foreground/60">Loading users...</p>
              ) : users.length === 0 ? (
                <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                  <p className="text-foreground/70">No users found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-foreground/60">Total users: {users.length}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-foreground/10">
                          <th className="text-left py-2 px-2">User</th>
                          <th className="text-left py-2 px-2">Credits</th>
                          <th className="text-left py-2 px-2">Rating</th>
                          <th className="text-left py-2 px-2">Joined</th>
                          <th className="text-left py-2 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-foreground/10">
                            <td className="py-3 px-2">
                              <div>
                                <p className="font-medium">{user.username || "Anonymous"}</p>
                                <p className="text-xs text-foreground/60">
                                  ID: {user.id.substring(0, 8)}...
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-xs space-y-1">
                                <p>Balance: {user.credits_balance || 0}</p>
                                <p className="text-foreground/60">Earned: {user.earned_credits || 0}</p>
                                <p className="text-foreground/60">Purchased: {user.purchased_credits || 0}</p>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              {user.total_ratings > 0 ? (
                                <div className="text-xs">
                                  <p>⭐ {user.average_rating?.toFixed(1)}</p>
                                  <p className="text-foreground/60">({user.total_ratings} ratings)</p>
                                  <p className="text-foreground/60">{user.total_contributions} contributions</p>
                                </div>
                              ) : (
                                <span className="text-xs text-foreground/60">No ratings</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-xs text-foreground/60">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    // Show current balances first
                                    alert(
                                      `Current Balances for ${user.username}:\n\n` +
                                      `Total: ${user.credits_balance || 0} credits\n` +
                                      `Earned (cashout-eligible): ${user.earned_credits || 0} credits\n` +
                                      `Purchased: ${user.purchased_credits || 0} credits`
                                    );

                                    const amount = prompt(`Adjust credits for ${user.username}:\nEnter amount (positive to add, negative to subtract):`);
                                    if (!amount) return;

                                    const reason = prompt("Reason for adjustment:");
                                    if (!reason) return;

                                    // Three-way choice for credit type
                                    const typeChoice = prompt(
                                      "Which balance to adjust?\n\n" +
                                      "1 = Earned credits (cashout-eligible, also updates total)\n" +
                                      "2 = Purchased credits (also updates total)\n" +
                                      "3 = Total balance only (legacy/general adjustment)\n\n" +
                                      "Enter 1, 2, or 3:"
                                    );
                                    
                                    let creditType = "balance";
                                    if (typeChoice === "1") creditType = "earned";
                                    else if (typeChoice === "2") creditType = "purchased";
                                    else if (typeChoice !== "3") {
                                      alert("Invalid choice. Cancelled.");
                                      return;
                                    }

                                    const { data } = await supabase.auth.getSession();
                                    const token = data.session?.access_token;
                                    if (!token) return;

                                    const res = await fetch("/api/admin/users/adjust-balance", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({
                                        userId: user.id,
                                        amount: parseInt(amount),
                                        reason,
                                        creditType,
                                      }),
                                    });

                                    const payload = await res.json();
                                    if (!res.ok) {
                                      alert(`Error: ${payload?.error || "Failed to adjust balance"}`);
                                      return;
                                    }

                                    alert(
                                      `✓ Success!\n\n${payload.message}\n\n` +
                                      `New total balance: ${payload.newTotal} credits`
                                    );
                                    await loadUsers();
                                  }}
                                  className="text-xs px-2 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
                                >
                                  Adjust Credits
                                </button>
                                
                                <button
                                  onClick={async () => {
                                    const message = prompt(`Send admin message to ${user.username}:`);
                                    if (!message?.trim()) return;

                                    const { data } = await supabase.auth.getSession();
                                    const token = data.session?.access_token;
                                    if (!token) return;

                                    // Send the message
                                    const res = await fetch("/api/messages/send", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({
                                        to_user_id: user.id,
                                        content: `[ADMIN] ${message.trim()}`,
                                      }),
                                    });

                                    const payload = await res.json();
                                    if (!res.ok) {
                                      alert(`Error: ${payload?.error || "Failed to send message"}`);
                                      return;
                                    }

                                    // Create notification for the user
                                    await fetch("/api/notifications", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({
                                        user_id: user.id,
                                        type: "admin_message",
                                        title: "Admin Message",
                                        message: `You have received a message from admin`,
                                      }),
                                    });

                                    alert(`✓ Message sent to ${user.username}`);
                                    await loadAdminMessages(); // Refresh admin messages
                                  }}
                                  className="text-xs px-2 py-1 rounded border border-blue-500/40 text-blue-600 hover:bg-blue-500/5"
                                >
                                  Send Message
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "messages" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Admin Messages</h2>
                <button
                  onClick={loadAdminMessages}
                  className="text-sm px-3 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
                >
                  Refresh
                </button>
              </div>

              {messagesLoading ? (
                <p className="text-foreground/60">Loading messages...</p>
              ) : adminMessages.length === 0 ? (
                <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                  <p className="text-foreground/70">No admin messages found</p>
                  <p className="text-sm text-foreground/60 mt-2">
                    Messages you send to users from the Users tab will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-foreground/60">Total conversations: {adminMessages.length}</p>
                  <div className="space-y-3">
                    {adminMessages.map((conversation) => (
                      <div key={`${conversation.other_user_id}-${conversation.created_at}`} className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-blue-600">
                                Admin Conversation
                              </span>
                              <span className="text-xs text-foreground/60">with</span>
                              <span className="text-sm font-medium">
                                {conversation.other_username}
                              </span>
                              <span className="text-xs text-foreground/60">
                                {new Date(conversation.created_at).toLocaleDateString()} {new Date(conversation.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm">{conversation.content}</p>
                          </div>
                          <div className="flex gap-2">
                            {!conversation.is_read && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-600">
                                Unread
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Platform Settings</h2>
              <div className="space-y-3">
                <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
                  <label className="text-sm font-medium">Platform Fee (%)</label>
                  <input
                    type="number"
                    defaultValue="15"
                    min="0"
                    max="50"
                    className="mt-2 w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
                  <label className="text-sm font-medium">Listing Duration (days)</label>
                  <input
                    type="number"
                    defaultValue="30"
                    min="1"
                    className="mt-2 w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
                  <label className="text-sm font-medium">
                    Minimum Cashout (credits)
                  </label>
                  <input
                    type="number"
                    defaultValue="20"
                    min="1"
                    className="mt-2 w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <button className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90">
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
