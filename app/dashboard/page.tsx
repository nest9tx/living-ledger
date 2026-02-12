"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { seedDefaultCategories } from "@/lib/supabase-helpers";
import Feed from "@/app/components/Feed";
import RequestForm from "@/app/components/RequestForm";
import OfferForm from "@/app/components/OfferForm";
import CreditsPanel from "@/app/components/CreditsPanel";

type DashboardUser = {
  email?: string;
};

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"feed" | "request" | "offer" | "credits">(
    "feed"
  );
  const [feedKey, setFeedKey] = useState(0);
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
        .select("onboarding_complete")
        .eq("id", data.session.user.id)
        .single();

      if (!profile?.onboarding_complete) {
        router.push("/onboarding");
        return;
      }

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
        <div className="flex gap-2 border-b border-foreground/10 overflow-x-auto">
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
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "feed" && <Feed key={feedKey} />}
          {activeTab === "credits" && <CreditsPanel />}
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
