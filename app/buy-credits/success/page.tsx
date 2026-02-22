"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import supabase from "@/lib/supabase";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "credited" | "already" | "error">("loading");
  const [credits, setCredits] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("No session ID found. If you were charged, your credits will appear within a minute.");
      return;
    }

    const verify = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setStatus("error");
          setMessage("Session expired. Please log in and check your balance.");
          return;
        }

        const res = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        const payload = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(payload?.error || "Could not verify payment. If you were charged, credits will appear shortly.");
          return;
        }

        setCredits(payload.credits);
        setStatus(payload.alreadyCredited ? "already" : "credited");
        setMessage(payload.message);
      } catch {
        setStatus("error");
        setMessage("Something went wrong. If you were charged, your credits will appear within a minute.");
      }
    };

    verify();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-6 py-16 text-center space-y-5">

        {status === "loading" && (
          <>
            <div className="mx-auto h-12 w-12 rounded-full border-4 border-foreground/10 border-t-foreground animate-spin" />
            <h1 className="text-2xl font-semibold">Confirming your payment...</h1>
            <p className="text-sm text-foreground/60">This takes just a moment.</p>
          </>
        )}

        {(status === "credited" || status === "already") && (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="text-3xl font-semibold">Payment successful!</h1>
            {credits !== null && (
              <p className="text-lg font-medium text-emerald-600">
                +{credits} credits added to your balance
              </p>
            )}
            <p className="text-sm text-foreground/60">{message}</p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background"
              >
                Go to dashboard
              </Link>
              <Link
                href="/buy-credits"
                className="rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium"
              >
                Buy more
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-semibold">Could not confirm automatically</h1>
            <p className="text-sm text-foreground/60 max-w-sm mx-auto">{message}</p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background"
              >
                Check my balance
              </Link>
            </div>
            <p className="text-xs text-foreground/40">
              If your balance is still incorrect after a few minutes, contact{" "}
              <a href="mailto:support@livingledger.org" className="underline">
                support@livingledger.org
              </a>
            </p>
          </>
        )}

      </div>
    </div>
  );
}

export default function BuyCreditsSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-foreground/10 border-t-foreground animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
