"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import supabase from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function NavHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
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
        if (session) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Hide nav on auth pages
  const hideNavPages = ["/login", "/signup", "/onboarding"];
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
                href="/"
                className="text-sm hover:text-foreground/70"
              >
                Home
              </Link>
              <Link
                href="/dashboard"
                className="text-sm px-3 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5"
              >
                Dashboard
              </Link>
              <span className="text-sm text-foreground/70">{user.email}</span>
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
