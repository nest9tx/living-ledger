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
  shippingCredits?: number;
  isPhysical?: boolean;
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
                body: "Mark delivery done. Credits release and 90% land in your account instantly. Reach 20 earned credits and cash out to USD via Stripe.",
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
                Need a second opinion, a quick design, some code reviewed, or a handmade item shipped to your door?
                Post a request with your budget and let the community respond.
              </p>
              <p className="text-xs text-foreground/50 pt-1">You spend credits → helper earns credits</p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6 space-y-2">
              <p className="text-lg font-semibold">🎁 Offers</p>
              <p className="text-sm text-foreground/70">
                Got a skill or something to sell? List your offering — writing, tutoring, creative work, or handmade goods — name your price
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
                          ? boost.isPhysical && boost.shippingCredits
                            ? `${boost.priceCredits ?? 0} + ${boost.shippingCredits} shipping`
                            : `${boost.priceCredits ?? 0} credits`
                          : boost.isPhysical && boost.shippingCredits
                            ? `${boost.budgetCredits ?? 0} + ${boost.shippingCredits} shipping`
                            : `${boost.budgetCredits ?? 0} credits`}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Community / Discord ── */}
        <section className="w-full">
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-500" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Join the Living Ledger community on Discord</p>
              <p className="text-sm text-foreground/65 mt-1">
                Get support, share feedback, follow platform updates, and connect with other members — all in one place.
              </p>
            </div>
            <a
              href="https://discord.gg/jrKdhkxt"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>
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
              <li>• 10% platform fee keeps the system running.</li>
            </ul>
          </div>
        </section>

      </main>
    </div>
  );
}
