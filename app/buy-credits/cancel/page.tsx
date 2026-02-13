"use client";

import Link from "next/link";

export default function BuyCreditsCancelPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-6 py-16 text-center space-y-4">
        <h1 className="text-3xl font-semibold">Checkout canceled</h1>
        <p className="text-sm text-foreground/70">
          No charges were made. You can try again anytime.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link
            href="/buy-credits"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Try again
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
