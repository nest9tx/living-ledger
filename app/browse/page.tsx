import Link from "next/link";
import Feed from "@/app/components/Feed";

export default function BrowsePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/" className="text-xs uppercase tracking-[0.4em] text-foreground/50 hover:text-foreground/80 transition">
              ← Living Ledger
            </Link>
            <h1 className="mt-3 text-3xl font-semibold">Community Listings</h1>
            <p className="mt-1 text-sm text-foreground/60">
              Browse requests and offers from the community.
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition"
            >
              Join free
            </Link>
          </div>
        </div>

        {/* Guest CTA strip */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm text-foreground/70">
            💡 <strong className="text-foreground">Sign up free</strong> to post requests, offer your skills, and earn gratitude credits.
          </p>
          <Link
            href="/signup"
            className="whitespace-nowrap text-sm font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800 transition"
          >
            Get started →
          </Link>
        </div>

        {/* Live feed (guest mode — no delete/buy/message) */}
        <Feed guestMode />
      </div>
    </div>
  );
}
