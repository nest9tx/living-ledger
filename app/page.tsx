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
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-10 px-6 py-20">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.4em] text-foreground/60">
            Living Ledger
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Give help. Receive help. Build credit.
          </h1>
          <p className="max-w-2xl text-base text-foreground/70 sm:text-lg">
            Living Ledger is a community marketplace for micro-acts of assistance. Post what you need,
            share what you have, and earn Gratitude Credits — redeemable for other services or cashed out to USD.
          </p>
        </div>

        <HeroCTA />

        <section id="featured" className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-foreground/60">Featured</p>
              <h2 className="text-2xl font-semibold">Boosted listings</h2>
            </div>
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

        <div className="grid w-full gap-4 md:grid-cols-3">
          {[
            {
              title: "Requests",
              copy: "Need a skill, a second opinion, or a creative collaborator? Post a request and let the community respond.",
            },
            {
              title: "Offers",
              copy: "Share your expertise — writing, code, design, coaching, and more. Build a reputation through real contributions.",
            },
            {
              title: "Gratitude Credits",
              copy: "Credits flow when help is exchanged. Spend them on services, boost your own listings, or cash out to USD.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5"
            >
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm text-foreground/70">{card.copy}</p>
            </div>
          ))}
        </div>

        <section className="w-full space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-foreground/60">
              How it works
            </p>
            <h2 className="text-2xl font-semibold">A simple loop of giving</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
              <h3 className="text-sm font-semibold">1. Post a request or offer</h3>
              <p className="mt-2 text-sm text-foreground/70">
                Tell the community what you need or what you can provide. Listings live in categories so the right people find them.
              </p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
              <h3 className="text-sm font-semibold">2. Connect and agree</h3>
              <p className="mt-2 text-sm text-foreground/70">
                Message through the platform. When you&apos;re ready, credits are held securely in escrow &mdash; no money changes hands until both sides are satisfied.
              </p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
              <h3 className="text-sm font-semibold">3. Complete and get paid</h3>
              <p className="mt-2 text-sm text-foreground/70">
                Mark delivery complete and credits release. Providers keep 85% (15% platform fee). Earned credits can be cashed out to USD at any time (min $20).
              </p>
            </div>
          </div>
        </section>

        <section className="w-full grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6">
            <h3 className="text-lg font-semibold">Why people use Living Ledger</h3>
            <ul className="mt-3 space-y-2 text-sm text-foreground/70">
              <li>• Turn your skills into community credit.</li>
              <li>• Get help without negotiating cash each time.</li>
              <li>• Build trust through visible contribution history.</li>
              <li>• Keep value circulating locally and ethically.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-6">
            <h3 className="text-lg font-semibold">Safety & trust</h3>
            <ul className="mt-3 space-y-2 text-sm text-foreground/70">
              <li>• Escrow holds funds until delivery.</li>
              <li>• 7-day safety delay helps protect against chargebacks.</li>
              <li>• Admin dispute resolution ensures fairness.</li>
              <li>• Clear platform fee (15%) keeps the system running.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
