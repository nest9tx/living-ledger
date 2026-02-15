"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Your reset link has expired. Please request a new one.");
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Failed to update password. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold">Set a new password</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Choose a strong password to secure your account.
        </p>

        {success ? (
          <div className="mt-8 space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-6">
            <h2 className="font-semibold text-emerald-700">Password updated</h2>
            <p className="text-sm text-emerald-700">
              You can now sign in with your new password.
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                New password
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

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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
              {loading ? "Saving..." : "Update password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-foreground/70">
          <Link className="font-medium text-foreground underline" href="/login">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
