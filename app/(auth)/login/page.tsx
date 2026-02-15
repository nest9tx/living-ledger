"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Check if onboarding is complete
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", user.user.id)
          .single();

        if (!profile?.onboarding_complete) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err) {
      setLoading(false);
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to the server. Please check your internet connection and try again.';
      setError(errorMsg);
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Log in to continue building the Living Ledger.
        </p>

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

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-3 text-sm text-foreground/70">
          <Link className="underline" href="/forgot-password">
            Forgot your password?
          </Link>
        </div>

        <p className="mt-6 text-sm text-foreground/70">
          New here?{" "}
          <Link className="font-medium text-foreground underline" href="/signup">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
