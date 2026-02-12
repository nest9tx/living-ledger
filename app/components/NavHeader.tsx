"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import supabase from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function NavHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string } | null>(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    };
    checkAuth();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  // Hide nav on auth pages
  const hideNavPages = ["/login", "/signup", "/onboarding"];
  if (hideNavPages.includes(pathname)) return null;

  return (
    <nav className="border-b border-foreground/10 bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between">
        <Link
          href={user ? "/dashboard" : "/"}
          className="text-lg font-semibold hover:opacity-70"
        >
          🌱 Living Ledger
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-foreground/70">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-sm px-3 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5"
              >
                Sign out
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
