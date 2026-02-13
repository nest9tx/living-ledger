"use client";

import { useEffect, useState } from "react";
import { getUserCredits } from "@/lib/supabase-helpers";

type Transaction = {
  id: number;
  amount: number;
  description: string;
  created_at: string;
};

export default function CreditsPanel() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCredits = async () => {
      try {
        const { balance: bal, transactions: txs } = await getUserCredits();
        setBalance(bal);
        setTransactions(txs || []);
      } catch (error) {
        console.error("Error loading credits:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCredits();
  }, []);

  if (loading) {
    return <div className="text-sm text-foreground/60">Loading credits…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">
          Gratitude Credits Balance
        </p>
        <h2 className="mt-3 text-4xl font-semibold">{balance}</h2>
        <p className="mt-2 text-sm text-foreground/70">
          1 credit = $1 USD. Buy credits to request services, earn credits by offering help.
        </p>
        <div className="mt-4 flex gap-2">
          <a
            href="/buy-credits"
            className="inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Buy credits
          </a>
          {balance > 0 && (
            <a
              href="/cashout"
              className="inline-flex rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
            >
              Cash out earnings
            </a>
          )}
        </div>
        {balance === 0 && (
          <p className="mt-3 text-xs text-foreground/50">
            💡 Purchase credits to start requesting services, or post an offer to earn credits!
          </p>
        )}
      </div>

      {/* Transactions */}
      <div>
        <h3 className="font-semibold">Recent activity</h3>
        {transactions && transactions.length > 0 ? (
          <div className="mt-4 space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border border-foreground/10 bg-foreground/2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{tx.description}</p>
                  <p className="text-xs text-foreground/60">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p
                  className={`font-semibold ${
                    tx.amount > 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-foreground/60">
            No transactions yet. Purchase credits or complete services to get started.
          </p>
        )}
      </div>
    </div>
  );
}
