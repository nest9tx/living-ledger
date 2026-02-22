"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

/**
 * /auth/confirm
 *
 * Landing page for Supabase email confirmation links.
 * Supabase appends #access_token=...&type=signup to the redirect URL.
 * The Supabase client automatically detects and processes the hash fragment
 * on initialization, setting the session. We just need to wait for it,
 * then redirect the user to onboarding.
 */
export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Listen for the SIGNED_IN event that Supabase fires after processing the
    // hash fragment — more reliable than a fixed setTimeout on slow connections.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setStatus("success");
          await new Promise((resolve) => setTimeout(resolve, 1500));
          router.replace("/onboarding");
        }
      }
    );

    // Fallback: if the session is already present (e.g. hash was processed
    // before this component mounted), check immediately.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) return; // wait for the event above
      subscription.unsubscribe();
      setStatus("success");
      setTimeout(() => router.replace("/onboarding"), 1500);
    });

    // Safety net: after 8 seconds with no session, show the error state.
    const timeout = setTimeout(async () => {
      subscription.unsubscribe();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("success");
        router.replace("/onboarding");
        return;
      }
      const hash = window.location.hash;
      if (hash.includes("error=")) {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const desc = params.get("error_description") || "Confirmation failed.";
        setErrorMessage(decodeURIComponent(desc.replace(/\+/g, " ")));
      } else {
        setErrorMessage(
          "We couldn't verify your email. The link may have expired — please request a new one."
        );
      }
      setStatus("error");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-5">

        {status === "loading" && (
          <>
            <div className="mx-auto h-12 w-12 rounded-full border-4 border-foreground/10 border-t-foreground animate-spin" />
            <h1 className="text-xl font-semibold">Confirming your email…</h1>
            <p className="text-sm text-foreground/60">Just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="text-xl font-semibold">Email confirmed!</h1>
            <p className="text-sm text-foreground/60">
              Taking you to onboarding…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-semibold">Confirmation failed</h1>
            <p className="text-sm text-foreground/60 max-w-xs mx-auto">
              {errorMessage}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => router.push("/signup")}
                className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Try signing up again
              </button>
              <button
                onClick={() => router.push("/login")}
                className="w-full rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
              >
                Go to login
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
