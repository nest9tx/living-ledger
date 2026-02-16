"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

const CREDIT_PACKS = [10, 25, 50, 100];
const STRIPE_FEE_PERCENT = 0.029;
const STRIPE_FEE_FLAT_CENTS = 30;

const calculateProcessingFee = (creditCents: number) => {
  const totalCents = Math.ceil(
    (creditCents + STRIPE_FEE_FLAT_CENTS) / (1 - STRIPE_FEE_PERCENT)
  );
  return Math.max(totalCents - creditCents, 0);
};

export default function BuyCreditsPage() {
  const router = useRouter();
  const [credits, setCredits] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.push("/login");
      }
    };
    checkSession();
  }, [router]);

  const totals = useMemo(() => {
    const creditCents = credits * 100;
    const feeCents = calculateProcessingFee(creditCents);
    return {
      creditCents,
      feeCents,
      totalCents: creditCents + feeCents,
    };
  }, [credits]);

  const handleCheckout = async () => {
    try {
      setError(null);
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ credits, coverFees: true }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create checkout session");
      }

      if (payload?.url) {
        window.location.href = payload.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">
            Living Ledger
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Buy Credits</h1>
          <p className="mt-2 text-sm text-foreground/70">
            1 credit = $1 USD. A processing fee is added at checkout so Living Ledger
            receives the full credit value.
          </p>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Select amount</h2>
          <div className="flex flex-wrap gap-2">
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack}
                onClick={() => setCredits(pack)}
                className={`rounded-full px-4 py-2 text-sm font-medium border transition ${
                  credits === pack
                    ? "bg-foreground text-background border-foreground"
                    : "border-foreground/20 hover:border-foreground/40"
                }`}
              >
                {pack} credits
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-sm text-foreground/70">Custom amount:</label>
            <input
              type="number"
              min={1}
              max={500}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value || 1))}
              className="w-28 rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
            />
            <span className="text-xs text-foreground/60">(max: 500)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-foreground/2 p-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Credits</span>
            <span>${(totals.creditCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Processing fee (estimated)</span>
            <span>${(totals.feeCents / 100).toFixed(2)}</span>
          </div>
          <div className="border-t border-foreground/10 pt-3 flex items-center justify-between font-semibold">
            <span>Total</span>
            <span>${(totals.totalCents / 100).toFixed(2)}</span>
          </div>
          <p className="text-xs text-foreground/50">
            Stripe fees vary by card/region. The fee shown is an estimate.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Continue to checkout"}
        </button>
      </div>
    </div>
  );
}
