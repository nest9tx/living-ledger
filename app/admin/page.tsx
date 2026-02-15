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
    "overview" | "moderation" | "disputes" | "users" | "settings"
  >("overview");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [flags, setFlags] = useState<any[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);

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

        await Promise.all([loadDisputes(), loadFlags()]);
      } catch (err) {
        console.error("Admin dashboard error:", err);
        setError("Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndLoadStats();
  }, []);

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
            {(
              ["overview", "moderation", "disputes", "users", "settings"] as const
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
                        <div className="flex flex-col gap-1">
                          <p className="font-medium">Flag #{flag.id}</p>
                          <p className="text-xs text-foreground/60">
                            {flag.post_type} • {flag.listingTitle}
                          </p>
                          {flag.reason && (
                            <p className="text-xs text-foreground/50">Reason: {flag.reason}</p>
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

          {activeTab === "users" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">User Management</h2>
              <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
                <p className="text-foreground/70 mb-4">Total users: {stats?.totalUsers}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-foreground/10">
                        <th className="text-left py-2 px-2">User</th>
                        <th className="text-left py-2 px-2">Joined</th>
                        <th className="text-left py-2 px-2">Status</th>
                        <th className="text-left py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-foreground/10">
                        <td className="py-2 px-2">Coming soon…</td>
                        <td className="py-2 px-2">-</td>
                        <td className="py-2 px-2">-</td>
                        <td className="py-2 px-2">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
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
