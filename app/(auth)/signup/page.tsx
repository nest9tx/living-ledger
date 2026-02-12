"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      setLoading(false);

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setShowConfirmation(true);
      
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setLoading(false);
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to the server. Please check your internet connection and try again.';
      setError(errorMsg);
      console.error('Signup error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Join the Living Ledger and start contributing.
        </p>

        {showConfirmation ? (
          <div className="mt-8 space-y-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-6">
            <h2 className="font-semibold text-emerald-700">Check your email</h2>
            <p className="text-sm text-emerald-700">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click it to verify your account, then you&apos;ll be able to log in.
            </p>
            <p className="text-xs text-emerald-600">
              Redirecting to login in 3 seconds…
            </p>
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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-foreground/70">
          Already have an account?{" "}
          <a className="font-medium text-foreground underline" href="/login">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
