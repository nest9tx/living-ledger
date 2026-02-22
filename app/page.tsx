import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import HeroCTA from "@/app/components/HeroCTA";

type FeaturedBoost = {
  boostId: number;
  postType: "offer" | "request";
  postId: number;
  boostTier: "homepage" | "category";
  expiresAt: string;
  creditsSpent: number;
  title: string;
  description: string;
  priceCredits?: number;
  budgetCredits?: number;
  category: { name: string; icon: string } | null;
  createdAt: string;
  thumbnailPath?: string | null;
};

const loadFeaturedBoosts = async (): Promise<FeaturedBoost[]> => {
  try {
    const headerList = await headers();
    const host = headerList.get("host");
    if (!host) return [];

    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    const res = await fetch(`${protocol}://${host}/api/boost/active?tier=homepage`, {
      cache: "no-store",
    });

    if (!res.ok) return [];
    const payload = await res.json();
    return payload?.boosts || [];
  } catch {
    return [];
  }
};

export default async function Home() {
  const boosts = await loadFeaturedBoosts();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-20">

        {/* ── Hero ── */}
        <div className="flex flex-col gap-6 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.4em] text-foreground/50">
            Living Ledger
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            A marketplace built on<br className="hidden sm:block" /> mutual support.
          </h1>
          <p className="max-w-2xl text-base text-foreground/70 sm:text-lg">
            Post what you need. Share what you offer. Every completed exchange generates
            <strong className="text-foreground font-medium"> Gratitude Credits</strong> — spend them on
            other services, boost your listings, or cash out real money via Stripe.
          </p>
          <HeroCTA />
        </div>

        {/* ── How it works ── */}
        <section className="w-full space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-foreground/50">How it works</p>
            <h2 className="mt-1 text-2xl font-semibold">Three steps to get going</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Post a request or offer",
                body: "Describe what you need or what you can do. Set a credit price, pick a category, and go live in under a minute.",
              },
              {
                step: "02",
                title: "Connect and agree",
                body: "Message through the platform. Credits are held in escrow the moment a deal is struck — no money moves until both sides are satisfied.",
              },
              {
                step: "03",
                title: "Complete and get paid",
                body: "Mark delivery done. Credits release and 85% land in your account instantly. Reach 20 earned credits and cash out to USD via Stripe.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5 space-y-2">
                <span className="text-3xl font-bold text-foreground/10">{item.step}</span>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="text-sm text-foreground/65">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── What you can do ── */}
        <section className="w-full space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-foreground/50">The marketplace</p>
            <h2 className="mt-1 text-2xl font-semibold">Requests &amp; Offers</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6 space-y-2">
              <p className="text-lg font-semibold">📋 Requests</p>
              <p className="text-sm text-foreground/70">
                Need a second opinion, a quick design, some code reviewed, or someone to proofread your cover letter?
                Post a request with your budget and let the community respond.
              </p>
              <p className="text-xs text-foreground/50 pt-1">You spend credits → helper earns credits</p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6 space-y-2">
              <p className="text-lg font-semibold">🎁 Offers</p>
              <p className="text-sm text-foreground/70">
                Got a skill to share? List your offering — writing, tutoring, consulting, creative work — name your price
                and let clients come to you.
              </p>
              <p className="text-xs text-foreground/50 pt-1">Client spends credits → you earn &amp; can cash out</p>
            </div>
          </div>
        </section>

        {/* ── Featured ── */}
        <section id="featured" className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-foreground/50">Featured</p>
              <h2 className="text-2xl font-semibold">Boosted listings</h2>
            </div>
            <Link href="/browse" className="text-sm text-foreground/50 hover:text-foreground/80">
              View all →
            </Link>
          </div>

          {boosts.length === 0 ? (
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6 text-sm text-foreground/60">
              No boosted listings yet. Be the first to feature your request or offer.
            </div>
          ) : (
            <div className="grid w-full gap-4 md:grid-cols-2">
              {boosts.map((boost) => (
                <Link
                  key={`${boost.postType}-${boost.postId}-${boost.boostId}`}
                  href={`/listing/${boost.postType}/${boost.postId}`}
                  className="rounded-2xl border border-foreground/10 bg-foreground/3 hover:border-foreground/30 hover:bg-foreground/5 transition overflow-hidden"
                >
                  {boost.thumbnailPath && process.env.NEXT_PUBLIC_SUPABASE_URL && (
                    <div className="relative h-44 w-full">
                      <Image
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${boost.thumbnailPath}`}
                        alt={boost.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/60">
                        ⭐ Featured
                      </span>
                      <span className="text-xs text-foreground/50">
                        {boost.postType === "offer" ? "Offer" : "Request"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{boost.title}</h3>
                    <p className="mt-2 text-sm text-foreground/70">
                      {boost.description}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                      {boost.category && (
                        <span>
                          {boost.category.icon} {boost.category.name}
                        </span>
                      )}
                      <span>
                        {boost.postType === "offer"
                          ? `${boost.priceCredits ?? 0} credits`
                          : `${boost.budgetCredits ?? 0} credits`}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Trust & Safety ── */}
        <section className="w-full grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6">
            <h3 className="text-lg font-semibold">Why people use Living Ledger</h3>
            <ul className="mt-3 space-y-2 text-sm text-foreground/70">
              <li>• Turn your skills into real income.</li>
              <li>• Get help without negotiating cash each time.</li>
              <li>• Build trust through a visible contribution history.</li>
              <li>• Credits are backed by real transactions — 1 credit = $1.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6">
            <h3 className="text-lg font-semibold">Safety &amp; trust</h3>
            <ul className="mt-3 space-y-2 text-sm text-foreground/70">
              <li>• Escrow holds credits until delivery is confirmed.</li>
              <li>• 7-day safety window protects against disputes.</li>
              <li>• Admin dispute resolution ensures fairness.</li>
              <li>• 15% platform fee keeps the system running.</li>
            </ul>
          </div>
        </section>

      </main>
    </div>
  );
}
