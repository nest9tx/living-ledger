"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";

export default function HeroCTA() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => setLoggedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);

  const base =
    "inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-medium transition";
  const primary = `${base} bg-foreground text-background hover:bg-foreground/90`;
  const secondary = `${base} border border-foreground/20 hover:bg-foreground/5`;

  // Skeleton prevents layout shift while auth state resolves
  if (loggedIn === null) {
    return (
      <div className="flex gap-3">
        <div className="h-9 w-32 animate-pulse rounded-md bg-foreground/10" />
        <div className="h-9 w-36 animate-pulse rounded-md bg-foreground/10" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-foreground/10" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {loggedIn ? (
        <>
          <a href="/dashboard" className={primary}>
            Go to dashboard
          </a>
          <a href="/browse" className={secondary}>
            Browse listings
          </a>
          <a href="/guidelines" className={secondary}>
            How it works
          </a>
        </>
      ) : (
        <>
          <a href="/signup" className={primary}>
            Join free
          </a>
          <a href="/browse" className={secondary}>
            Browse listings
          </a>
          <a href="/login" className={secondary}>
            Sign in
          </a>
          <a href="/guidelines" className={secondary}>
            How it works
          </a>
        </>
      )}
    </div>
  );
}
