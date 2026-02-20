import Link from "next/link";
import Feed from "@/app/components/Feed";
import BrowseGuestBar, { BrowseGuestCTA } from "@/app/components/BrowseGuestBar";

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
          {/* Auth-aware: only visible when logged out */}
          <BrowseGuestBar />
        </div>

        {/* Auth-aware CTA strip: only visible when logged out */}
        <BrowseGuestCTA />

        {/* Live feed (guestMode disables action buttons for non-members) */}
        <Feed guestMode />
      </div>
    </div>
  );
}
