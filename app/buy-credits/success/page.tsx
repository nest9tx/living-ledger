"use client";

import Link from "next/link";

export default function BuyCreditsSuccessPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-6 py-16 text-center space-y-4">
        <h1 className="text-3xl font-semibold">Payment successful</h1>
        <p className="text-sm text-foreground/70">
          Your credits will appear in your balance shortly. If you don’t see them
          within a minute, refresh your dashboard.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link
            href="/dashboard"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Go to dashboard
          </Link>
          <Link
            href="/buy-credits"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
          >
            Buy more credits
          </Link>
        </div>
      </div>
    </div>
  );
}
