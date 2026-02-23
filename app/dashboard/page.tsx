"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabase";
import { seedDefaultCategories } from "@/lib/supabase-helpers";
import Feed from "@/app/components/Feed";
import RequestForm from "@/app/components/RequestForm";
import OfferForm from "@/app/components/OfferForm";
import CreditsPanel from "@/app/components/CreditsPanel";
import OrdersPanel from "@/app/components/OrdersPanel";
import MyListings from "@/app/components/MyListings";
import ContributionHistory from "@/app/components/ContributionHistory";
import MessagesInbox from "@/app/components/MessagesInbox";
import NotificationBadge from "@/app/components/NotificationBadge";

type DashboardUser = {
  email?: string;
};

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"feed" | "orders" | "request" | "offer" | "credits" | "listings" | "history" | "messages">(
    "feed"
  );
  const [feedKey, setFeedKey] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [creditsBalance, setCreditsBalance] = useState<number>(0);
  const [onboardingRole, setOnboardingRole] = useState<string | null>(null);
  const [composeWithUser, setComposeWithUser] = useState<{ userId: string; username: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      
      if (!data.session?.user) {
        router.push("/login");
        return;
      }

      setUser(data.session.user ?? null);
      
      // Check if onboarding is complete
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete, credits_balance, onboarding_role")
        .eq("id", data.session.user.id)
        .single();

      if (!profile?.onboarding_complete) {
        router.push("/onboarding");
        return;
      }

      setCreditsBalance(profile.credits_balance ?? 0);
      setOnboardingRole(profile.onboarding_role ?? null);

      await seedDefaultCategories();
      setLoading(false);
    };

    loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const userId = sessionData.session?.user?.id;

        if (!token || !userId) {
          setUnreadMessages(0);
          return;
        }

        const response = await fetch("/api/messages/list", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setUnreadMessages(0);
          return;
        }

        const { messages } = await response.json();
        const unreadCount = (messages || []).filter(
          (msg: { to_user_id: string; is_read: boolean }) => msg.to_user_id === userId && !msg.is_read
        ).length;

        setUnreadMessages(unreadCount);
      } catch {
        setUnreadMessages(0);
      }
    };

    if (user) {
      loadUnreadCount();
    }
  }, [user, activeTab]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <p className="text-sm text-foreground/70">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
          <h1 className="text-3xl font-semibold">You’re not signed in</h1>
          <p className="text-sm text-foreground/70">
            Sign in to see your Living Ledger dashboard.
          </p>
          <a
            className="inline-flex w-fit rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
            href="/login"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Reads ?tab= query param — must be inside Suspense for Next.js SSR */}
      <Suspense fallback={null}>
        <TabSyncer setActiveTab={setActiveTab} setComposeWithUser={setComposeWithUser} />
      </Suspense>
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-8">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">
            Living Ledger
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-foreground/70">Signed in as {user.email}</p>
        </div>

        {/* Tabs */}
        <div className="relative">
          <div className="flex gap-2 border-b border-foreground/10 overflow-x-auto pr-16">
          <button
            onClick={() => setActiveTab("feed")}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeTab === "feed"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Community Feed
          </button>
          <button
            onClick={() => setActiveTab("credits")}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeTab === "credits"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            My Credits
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`relative pl-4 pr-8 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeTab === "orders"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Current Orders
            <NotificationBadge />
          </button>
          <button
            onClick={() => setActiveTab("request")}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeTab === "request"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Post a Request
          </button>
          <button
            onClick={() => setActiveTab("offer")}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeTab === "offer"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Offer Your Gifts
          </button>
          <button
            onClick={() => setActiveTab("listings")}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeTab === "listings"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            My Listings
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === "messages"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Messages
            {unreadMessages > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white">
                {unreadMessages}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeTab === "history"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            History & Ratings
          </button>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-14 bg-linear-to-l from-background to-transparent" />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-foreground/50 md:hidden">
            Scroll →
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "feed" && (
            <>
              {creditsBalance <= 0 && (
                <div className="space-y-3">
                  {(onboardingRole === "seeker" || onboardingRole === "both") && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Want to post a request?</p>
                        <p className="text-xs text-foreground/60 mt-0.5">
                          Credits are used to fund your requests and boost your listings. Buy a pack to get started.
                        </p>
                      </div>
                      <a
                        href="/buy-credits"
                        className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        Buy Credits
                      </a>
                    </div>
                  )}
                  {(onboardingRole === "provider" || onboardingRole === "both") && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Offering a service?</p>
                        <p className="text-xs text-foreground/60 mt-0.5">
                          You earn credits when clients accept your work — cashout via Stripe once you reach 20 credits.
                          Boost your listing to get more visibility.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("offer")}
                        className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Post an Offer
                      </button>
                    </div>
                  )}
                </div>
              )}
              <Feed key={feedKey} />
            </>
          )}
          {activeTab === "credits" && <CreditsPanel />}
          {activeTab === "orders" && <OrdersPanel />}
          {activeTab === "listings" && <MyListings />}
          {activeTab === "messages" && <MessagesInbox composeWithUserId={composeWithUser?.userId} composeWithUsername={composeWithUser?.username} onComposeDone={() => setComposeWithUser(null)} />}
          {activeTab === "history" && <ContributionHistory />}
          {activeTab === "request" && (
            <RequestForm
              onSuccess={() => {
                setActiveTab("feed");
                setFeedKey((prev) => prev + 1);
              }}
            />
          )}
          {activeTab === "offer" && (
            <OfferForm
              onSuccess={() => {
                setActiveTab("feed");
                setFeedKey((prev) => prev + 1);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <button
          onClick={handleSignOut}
          className="w-fit rounded-md border border-foreground/20 px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// Separate component so useSearchParams is inside a Suspense boundary
type TabName = "feed" | "orders" | "request" | "offer" | "credits" | "listings" | "history" | "messages";
const VALID_TABS: TabName[] = ["feed", "orders", "request", "offer", "credits", "listings", "history", "messages"];

function TabSyncer({ setActiveTab, setComposeWithUser }: {
  setActiveTab: (tab: TabName) => void;
  setComposeWithUser: (u: { userId: string; username: string } | null) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab") as TabName | null;
    if (tab && VALID_TABS.includes(tab)) setActiveTab(tab);
    // ?compose=userId:username  →  open compose panel for that user
    const compose = searchParams.get("compose");
    if (compose) {
      const [userId, ...rest] = compose.split(":");
      const username = rest.join(":");
      if (userId && username) setComposeWithUser({ userId, username });
    }
  }, [searchParams, setActiveTab, setComposeWithUser]);
  return null;
}
