"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { recordTransaction } from "@/lib/supabase-helpers";

type OnboardingStep = "welcome" | "guidelines" | "role" | "profile" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [role, setRole] = useState<"seeker" | "provider" | "both" | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGuidelinesAccept = () => {
    setStep("role");
  };

  const handleRoleSelect = (selectedRole: "seeker" | "provider" | "both") => {
    setRole(selectedRole);
    setStep("profile");
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Validate username
      if (!username.trim()) {
        throw new Error("Username is required");
      }

      if (username.trim().length < 2) {
        throw new Error("Username must be at least 2 characters");
      }

      // Create or update profile
      const profileData = {
        id: user.user.id,
        username: username.trim(),
        bio: bio.trim(),
        credits_balance: 0, // Users start with 0 - must buy credits to request services
        onboarding_complete: true,
        onboarding_role: role,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError, data } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "id" })
        .select();

      if (profileError) {
        console.error("Profile error details:", profileError);
        throw new Error(profileError.message || "Failed to save profile");
      }

      if (!data || data.length === 0) {
        throw new Error("Profile was not created properly");
      }

      // No welcome bonus - users must purchase credits
      // This ensures every credit = real money in the system

      setStep("complete");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        {/* Welcome Step */}
        {step === "welcome" && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">
                Welcome to
              </p>
              <h1 className="mt-3 text-4xl font-semibold">Living Ledger</h1>
              <p className="mt-3 max-w-xl text-lg text-foreground/70">
                A community where every act of help generates real value. Let&apos;s walk you through how it works.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-foreground/10 bg-foreground/3 p-6">
              <h2 className="font-semibold">How it works in 3 ideas:</h2>
              <ul className="space-y-3 text-sm text-foreground/70">
                <li className="flex gap-3">
                  <span className="text-lg">🤝</span>
                  <span>
                    <strong>Post a need or offer help.</strong> Requests and offerings happen in categories.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-lg">💳</span>
                  <span>
                    <strong>Pay or earn Gratitude Credits.</strong> 1 credit = $1. Buy credits to hire, earn credits by helping.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-lg">🏦</span>
                  <span>
                    <strong>Credits held in escrow until work is done.</strong> Safe for both sides. Cash out via Stripe ($20 min, 7-day escrow release).
                  </span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setStep("guidelines")}
              className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background"
            >
              Continue to guidelines
            </button>
          </div>
        )}

        {/* Guidelines Step */}
        {step === "guidelines" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold">Community Guidelines</h1>
              <p className="mt-2 text-sm text-foreground/70">
                We keep this space safe and focused on genuine help.
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-lg border border-foreground/10 bg-foreground/2 p-6 space-y-4 text-sm">
              <h3 className="font-semibold">What we value:</h3>
              <ul className="space-y-2 text-foreground/70">
                <li>✅ Honesty about your skills and availability</li>
                <li>✅ Respectful, timely communication</li>
                <li>✅ Fair pricing for your time</li>
                <li>✅ Delivering what you promised</li>
              </ul>

              <h3 className="font-semibold">What we don&apos;t allow:</h3>
              <ul className="space-y-2 text-foreground/70">
                <li>❌ Illegal services or scams</li>
                <li>❌ Harassment, hate speech, or discrimination</li>
                <li>❌ Ghosting (disappearing after agreement)</li>
                <li>❌ Spam or misleading claims</li>
              </ul>

              <p className="text-xs text-foreground/50 pt-4">
                Read the full guidelines at /guidelines
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  required
                  className="mt-1"
                />
                <span className="text-sm text-foreground/70">
                  I understand and agree to the Community Guidelines
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("welcome")}
                className="flex-1 rounded-md border border-foreground/20 px-4 py-3 text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleGuidelinesAccept}
                className="flex-1 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background"
              >
                I agree, continue
              </button>
            </div>
          </div>
        )}

        {/* Role Selection Step */}
        {step === "role" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold">How will you participate?</h1>
              <p className="mt-2 text-sm text-foreground/70">
                You can change this anytime.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <button
                onClick={() => handleRoleSelect("seeker")}
                className="rounded-lg border-2 border-foreground/20 bg-transparent px-4 py-6 text-center transition hover:border-foreground"
              >
                <div className="text-3xl">🤝</div>
                <h3 className="mt-2 font-semibold">I need help</h3>
                <p className="mt-1 text-xs text-foreground/70">
                  Post requests and pay for services
                </p>
              </button>

              <button
                onClick={() => handleRoleSelect("provider")}
                className="rounded-lg border-2 border-foreground/20 bg-transparent px-4 py-6 text-center transition hover:border-foreground"
              >
                <div className="text-3xl">🎁</div>
                <h3 className="mt-2 font-semibold">I offer help</h3>
                <p className="mt-1 text-xs text-foreground/70">
                  Post services and earn credits
                </p>
              </button>

              <button
                onClick={() => handleRoleSelect("both")}
                className="rounded-lg border-2 border-foreground/20 bg-transparent px-4 py-6 text-center transition hover:border-foreground"
              >
                <div className="text-3xl">🔄</div>
                <h3 className="mt-2 font-semibold">Both</h3>
                <p className="mt-1 text-xs text-foreground/70">
                  Give and receive help
                </p>
              </button>
            </div>

            <button
              onClick={() => setStep("guidelines")}
              className="w-full rounded-md border border-foreground/20 px-4 py-3 text-sm font-medium"
            >
              Back
            </button>
          </div>
        )}

        {/* Profile Setup Step */}
        {step === "profile" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold">Complete your profile</h1>
              <p className="mt-2 text-sm text-foreground/70">
                Help others know who you are.
              </p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="How should we call you?"
                  className="mt-1 w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium" htmlFor="bio">
                  Bio (optional)
                </label>
                <textarea
                  id="bio"
                  placeholder="What do you want others to know about you?"
                  className="mt-1 w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("role")}
                  className="flex-1 rounded-md border border-foreground/20 px-4 py-3 text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !username}
                  className="flex-1 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background transition disabled:opacity-60"
                >
                  {loading ? "Setting up…" : "Complete setup"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <div className="space-y-6 text-center">
            <div className="text-6xl">✨</div>
            <div>
              <h1 className="text-3xl font-semibold">You&apos;re all set!</h1>
              <p className="mt-3 text-sm text-foreground/70">
                Welcome to the Living Ledger, {username}. Redirecting to your dashboard…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
