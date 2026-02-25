"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import supabase from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function NavHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; id?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  const fetchBalance = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .single();
    if (data) setCreditsBalance(data.credits_balance ?? 0);
  };

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user ?? null;
        setUser(sessionUser);
        if (sessionUser?.id) fetchBalance(sessionUser.id);
      } catch (err) {
        console.error('Auth check failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        if (sessionUser?.id) fetchBalance(sessionUser.id);
        else setCreditsBalance(null);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Re-fetch balance when navigating (catches purchases / transactions)
  useEffect(() => {
    if (user?.id) fetchBalance(user.id);
  }, [pathname, user?.id]);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setCreditsBalance(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Hide nav on auth pages
  const hideNavPages = ["/login", "/signup", "/forgot-password", "/reset-password", "/onboarding"];
  if (hideNavPages.includes(pathname)) return null;

  return (
    <nav className="border-b border-foreground/10 bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold hover:opacity-70"
        >
          🌱 Living Ledger
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/browse"
                className="text-sm hover:text-foreground/70"
              >
                Browse
              </Link>
              <Link
                href="/dashboard"
                className="text-sm px-3 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5"
              >
                Dashboard
              </Link>
              {creditsBalance !== null && (
                <Link
                  href="/dashboard?tab=credits"
                  title="Your credit balance — click to manage"
                  className="flex items-center gap-1.5 rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 text-xs font-medium hover:bg-foreground/10 transition"
                >
                  <span className="text-amber-500">⚡</span>
                  <span>{creditsBalance}</span>
                </Link>
              )}
              <Link
                href="/settings"
                className="text-sm hover:text-foreground/70"
              >
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="text-sm px-3 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-50"
              >
                {loading ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <a
                href="/guidelines"
                className="text-sm hover:text-foreground/70"
              >
                Guidelines
              </a>
              <a
                href="/login"
                className="text-sm px-3 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5"
              >
                Sign in
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
