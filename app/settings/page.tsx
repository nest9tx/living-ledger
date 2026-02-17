"use client";

import { useState, useEffect, useCallback } from "react";
import supabase from "@/lib/supabase";
import Link from "next/link";

type UserProfile = {
  username: string;
  email: string | null;
  created_at: string | null;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_connected_at: string | null;
};

type StripeStatus = {
  connected: boolean;
  status: string | null;
  accountId?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUserSettings = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const fallbackEmail = session.user.email ?? null;
      const fallbackUsername =
        session.user.user_metadata?.username ||
        (fallbackEmail ? fallbackEmail.split("@")[0] : "user");

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, created_at, stripe_account_id, stripe_account_status, stripe_onboarding_complete, stripe_connected_at")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUser({
          ...profile,
          email: fallbackEmail,
        });

        // Check Stripe Connect status if account exists
        if (profile.stripe_account_id) {
          await checkStripeStatus(session.access_token);
        }
      } else {
        // Create a minimal profile if missing
        const { data: createdProfile } = await supabase
          .from("profiles")
          .upsert(
            {
              id: session.user.id,
              username: fallbackUsername,
              onboarding_complete: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .select("username, created_at, stripe_account_id, stripe_account_status, stripe_onboarding_complete, stripe_connected_at")
          .single();

        setUser({
          username: createdProfile?.username || fallbackUsername,
          email: fallbackEmail,
          created_at: createdProfile?.created_at || null,
          stripe_account_id: createdProfile?.stripe_account_id || null,
          stripe_account_status: createdProfile?.stripe_account_status || null,
          stripe_onboarding_complete: createdProfile?.stripe_onboarding_complete || null,
          stripe_connected_at: createdProfile?.stripe_connected_at || null,
        });
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading settings:", err);
      setError("Failed to load settings");
      setLoading(false);
    }
  }, []);

  const checkStripeStatus = async (token: string) => {
    try {
      const res = await fetch("/api/stripe/connect/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await res.json();
      setStripeStatus(data);
    } catch (err) {
      console.error("Failed to check Stripe status:", err);
    }
  };

  useEffect(() => {
    loadUserSettings();

    // Check for return from Stripe onboarding (client-side only)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const stripeConnected = params.get("stripe_connected");
      const stripeRefresh = params.get("stripe_refresh");

      if (stripeConnected === "true") {
        setMessage("✓ Stripe account connected successfully! You can now request cashouts.");
      } else if (stripeRefresh === "true") {
        setError("Stripe onboarding was not completed. Please try again.");
      }
    }
  }, [loadUserSettings]);

  const handleConnectStripe = async () => {
    setConnecting(true);
    setError("");
    setMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect Stripe account");
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect Stripe account");
      setConnecting(false);
    }
  };

  const handleResetStripe = async () => {
    setConnecting(true);
    setError("");
    setMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/stripe/connect/reset", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset Stripe connection");
      }

      setStripeStatus({ connected: false, status: null });
      setMessage("Stripe connection reset. You can connect again.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset Stripe connection");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-foreground/60">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-foreground/60 hover:text-foreground mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-semibold">⚙️ Settings</h1>
          <p className="text-foreground/70 mt-2">
            Manage your account and payment preferences
          </p>
        </div>

        {/* Account Info */}
        <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-foreground/60">Username:</span> {user?.username}</p>
            <p><span className="text-foreground/60">Email:</span> {user?.email}</p>
            <p><span className="text-foreground/60">Member since:</span> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</p>
          </div>
        </div>

        {/* Stripe Connect Section */}
        <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
          <h2 className="text-xl font-semibold mb-2">💰 Stripe Connect (For Cashouts)</h2>
          <p className="text-sm text-foreground/60 mb-6">
            Connect your Stripe account to receive cashout payments. Stripe handles all banking details, identity verification, and tax reporting.
          </p>

          {stripeStatus?.connected && stripeStatus?.status === "active" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-green-600 font-medium mb-2">✓ Stripe Account Connected</p>
                <div className="text-sm text-foreground/70 space-y-1">
                  <p>Account ID: {stripeStatus.accountId?.slice(0, 20)}...</p>
                  <p>Status: Active & verified</p>
                  <p>Payouts: Enabled</p>
                  {user?.stripe_connected_at && (
                    <p>Connected: {new Date(user.stripe_connected_at).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleConnectStripe}
                  disabled={connecting}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Update Stripe account details
                </button>
                <button
                  onClick={handleResetStripe}
                  disabled={connecting}
                  className="text-sm text-red-600 hover:underline"
                >
                  Reset Stripe connection
                </button>
              </div>
            </div>
          ) : stripeStatus?.connected && stripeStatus?.status === "pending" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-yellow-700 font-medium mb-2">⚠️ Stripe Onboarding Incomplete</p>
                <p className="text-sm text-foreground/70">
                  Your Stripe account needs additional information. Please complete the onboarding process to enable cashouts.
                </p>
              </div>
              
              <button
                onClick={handleConnectStripe}
                disabled={connecting}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {connecting ? "Redirecting to Stripe..." : "Complete Stripe Onboarding"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-foreground/70">
                  <strong>What you&apos;ll need:</strong>
                </p>
                <ul className="text-sm text-foreground/70 mt-2 space-y-1 list-disc list-inside">
                  <li>Government-issued ID (driver&apos;s license or passport)</li>
                  <li>Social Security Number or Tax ID</li>
                  <li>Bank account details</li>
                  <li>Personal information (address, date of birth)</li>
                </ul>
              </div>

              {message && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                  {message}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleConnectStripe}
                disabled={connecting}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {connecting ? "Redirecting to Stripe..." : "Connect Stripe Account"}
              </button>

              <p className="text-xs text-foreground/60 text-center">
                🔒 You&apos;ll be redirected to Stripe&apos;s secure platform. Your banking details are managed by Stripe, never stored on our servers.
              </p>
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-600 font-medium mb-2">ℹ️ About Stripe Connect</p>
          <ul className="text-xs text-foreground/70 space-y-1 list-disc list-inside">
            <li>Stripe verifies your identity (required by law for financial transactions)</li>
            <li>Your bank details are encrypted and stored securely by Stripe</li>
            <li>Stripe handles tax reporting (1099-K forms if you earn over $600/year)</li>
            <li>Automated transfers when admin approves cashouts (2-5 business days)</li>
            <li>Minimum cashout: $20 USD • Only earned credits can be cashed out</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
