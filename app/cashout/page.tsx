"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

type CashoutRequest = {
  id: number;
  user_id: string;
  amount_credits: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  requested_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  admin_note: string | null;
};

export default function CashoutPage() {
  const router = useRouter();
  const [earnedCredits, setEarnedCredits] = useState(0);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requests, setRequests] = useState<CashoutRequest[]>([]);
  const [hasStripeAccount, setHasStripeAccount] = useState(false);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          router.push("/login");
          return;
        }

        // Get earned credits and Stripe account status
        const { data: profile } = await supabase
          .from("profiles")
          .select("earned_credits, stripe_account_id, stripe_account_status, stripe_onboarding_complete")
          .eq("id", userData.user.id)
          .single();

        if (profile) {
          setEarnedCredits(profile.earned_credits || 0);
          setHasStripeAccount(!!profile.stripe_account_id && profile.stripe_onboarding_complete);
          setStripeAccountStatus(profile.stripe_account_status);
        }

        // Get cashout requests
        const { data: cashouts } = await supabase
          .from("cashout_requests")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("requested_at", { ascending: false })
          .limit(20);

        if (cashouts) {
          setRequests(cashouts);
        }
      } catch (err) {
        console.error("Error loading cashout data:", err);
        setError("Failed to load cashout information");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const amountNum = parseInt(amount, 10);

      if (!amountNum || amountNum < 20) {
        setError("Minimum cashout is $20");
        return;
      }

      if (amountNum > earnedCredits) {
        setError(`You can only cash out up to $${earnedCredits} of earned credits`);
        return;
      }

      setSubmitting(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch("/api/cashout/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_credits: amountNum,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create cashout request");
      }

      setSuccess(`✓ Cashout request submitted for $${amountNum}. Pending admin review.`);
      setAmount("");
      setEarnedCredits(Math.max(0, earnedCredits - amountNum));

      // Reload requests
      const { data: { user } } = await supabase.auth.getUser();
      const { data: updated } = await supabase
        .from("cashout_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("requested_at", { ascending: false })
        .limit(20);

      if (updated) {
        setRequests(updated);
      }
    } catch (err) {
      console.error("Cashout error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <p className="text-foreground/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-semibold">Cash Out Earnings</h1>
            <p className="mt-2 text-foreground/70">
              Convert your earned credits to USD. Minimum cashout: $20.
            </p>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6">
            <div className="mb-6">
              <p className="text-sm text-foreground/60">Available to cash out</p>
              <p className="mt-1 text-3xl font-semibold text-emerald-600">${earnedCredits}</p>
              <p className="mt-1 text-xs text-foreground/50">
                Only earned credits from completed services can be cashed out.
              </p>
            </div>

            {earnedCredits < 20 ? (
              <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20">
                <p className="text-sm text-yellow-700">
                  You need at least $20 to cash out. You have ${earnedCredits} — earn ${20 - earnedCredits} more to be eligible.
                </p>
              </div>
            ) : !hasStripeAccount ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-500/10 p-4 border border-blue-500/20">
                  <p className="text-sm text-blue-600 font-medium mb-2">💳 Stripe Account Required</p>
                  <p className="text-sm text-foreground/70 mb-3">
                    You need to connect a Stripe account before requesting a cashout. Stripe handles identity verification, banking details, and tax reporting.
                  </p>
                  <p className="text-xs text-foreground/60">
                    This is a one-time setup and only takes a few minutes.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/settings")}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Connect Stripe Account in Settings
                </button>
              </div>
            ) : stripeAccountStatus !== "active" ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20">
                  <p className="text-sm text-yellow-700 font-medium mb-2">⚠️ Stripe Onboarding Incomplete</p>
                  <p className="text-sm text-foreground/70">
                    Your Stripe account needs additional verification before you can request cashouts. Please complete the onboarding process.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/settings")}
                  className="w-full px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
                >
                  Complete Stripe Onboarding
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg bg-green-500/10 p-3 border border-green-500/20">
                  <p className="text-xs text-green-600">
                    ✓ Stripe account connected and verified
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Cashout Amount ($)</label>
                  <input
                    type="number"
                    min="20"
                    max={earnedCredits}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="20"
                    className="w-full rounded-lg border border-foreground/20 bg-background px-4 py-2 text-foreground placeholder:text-foreground/40 focus:border-foreground/40 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-xs text-foreground/50">
                    Min: $20 • Max: ${earnedCredits}
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-500/10 p-3 border border-red-500/20">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="rounded-lg bg-emerald-500/10 p-3 border border-emerald-500/20">
                    <p className="text-sm text-emerald-600">{success}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || earnedCredits < 20}
                  className="w-full rounded-lg bg-foreground px-4 py-2 font-medium text-background hover:bg-foreground/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Request Cashout"}
                </button>

                <p className="text-xs text-foreground/50 text-center">
                  Your request will be reviewed by our admin team within 24-48 hours.
                </p>
              </form>
            )}
          </div>

          {/* Cashout History */}
          {requests.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Cashout History</h2>
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-lg border border-foreground/10 bg-foreground/2 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">${req.amount_credits}</p>
                        <p className="text-xs text-foreground/60">
                          {new Date(req.requested_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            req.status === "pending"
                              ? "bg-yellow-500/10 text-yellow-700"
                              : req.status === "approved"
                              ? "bg-blue-500/10 text-blue-700"
                              : req.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-red-500/10 text-red-700"
                          }`}
                        >
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                        {req.admin_note && (
                          <p className="text-xs text-foreground/60 mt-2 max-w-xs">{req.admin_note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="space-y-4 rounded-lg border border-foreground/10 bg-foreground/3 p-6">
            <h3 className="font-semibold">How it works</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• <strong>Earn credits</strong> by completing services for other users</li>
              <li>• <strong>Request cashout</strong> of $20 or more earned credits</li>
              <li>• <strong>Admin review</strong> within 24-48 hours for security</li>
              <li>• <strong>Payout sent</strong> to your connected bank account via Stripe</li>
              <li>• <strong>1 credit = $1 USD</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
