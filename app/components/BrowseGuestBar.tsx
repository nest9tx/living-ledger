"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import supabase from "@/lib/supabase";

/**
 * Renders the header auth buttons + CTA strip only when the visitor is NOT signed in.
 * When signed in these elements are invisible — the global NavHeader already shows dashboard/browse.
 */
export default function BrowseGuestBar() {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsGuest(!data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => setIsGuest(!session));
    return () => subscription.unsubscribe();
  }, []);

  // Invisible placeholder while resolving so layout doesn't shift
  if (isGuest === null) return <div className="h-9" />;
  if (!isGuest) return null;

  return (
    <>
      {/* Header auth buttons */}
      <div className="flex gap-2 pt-1">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition"
        >
          Join free
        </Link>
      </div>

      {/* CTA strip — rendered as a sibling; parent must accommodate */}
    </>
  );
}

/** Separate component for the green CTA strip below the header */
export function BrowseGuestCTA() {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsGuest(!data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => setIsGuest(!session));
    return () => subscription.unsubscribe();
  }, []);

  if (!isGuest) return null;

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <p className="text-sm text-foreground/70">
        💡 <strong className="text-foreground">Sign up free</strong> to post requests, offer your skills, and earn gratitude credits.
      </p>
      <Link
        href="/signup"
        className="whitespace-nowrap text-sm font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800 transition"
      >
        Get started →
      </Link>
    </div>
  );
}
