"use client";

import { useState } from "react";
import Link from "next/link";
import supabase from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Failed to send reset email. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Enter your email and we&apos;ll send you a secure reset link.
        </p>

        {sent ? (
          <div className="mt-8 space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-6">
            <h2 className="font-semibold text-emerald-700">Check your email</h2>
            <p className="text-sm text-emerald-700">
              If an account exists for <strong>{email}</strong>, a reset link is on the way.
            </p>
            <Link className="text-sm underline text-emerald-700" href="/login">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition disabled:opacity-60"
            >
              {loading ? "Sending link..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-foreground/70">
          Remembered your password?{" "}
          <Link className="font-medium text-foreground underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
