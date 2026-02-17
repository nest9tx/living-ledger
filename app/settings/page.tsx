"use client";

import { useState, useEffect, useCallback } from "react";
import supabase from "@/lib/supabase";
import Link from "next/link";

type UserProfile = {
  username: string;
  email: string;
  created_at: string;
  bank_account_name: string | null;
  bank_routing_number: string | null;
  bank_account_type: string | null;
  bank_account_last4: string | null;
  bank_connected_at: string | null;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  
  // Bank account fields
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankAccountType, setBankAccountType] = useState("checking");
  const [bankLast4, setBankLast4] = useState("");
  const [bankConnectedAt, setBankConnectedAt] = useState<string | null>(null);
  
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUserSettings = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUser(profile);
        setBankAccountName(profile.bank_account_name || "");
        setBankRoutingNumber(profile.bank_routing_number || "");
        setBankAccountType(profile.bank_account_type || "checking");
        setBankLast4(profile.bank_account_last4 || "");
        setBankConnectedAt(profile.bank_connected_at);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading settings:", err);
      setError("Failed to load settings");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserSettings();
  }, [loadUserSettings]);

  async function saveBankAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Validate account number (basic check)
      if (bankAccountNumber.length < 4 || bankAccountNumber.length > 17) {
        setError("Account number must be 4-17 digits");
        setSaving(false);
        return;
      }

      // Validate routing number (US: 9 digits)
      if (!/^\d{9}$/.test(bankRoutingNumber)) {
        setError("Routing number must be exactly 9 digits");
        setSaving(false);
        return;
      }

      const response = await fetch("/api/settings/bank-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          accountName: bankAccountName,
          accountNumber: bankAccountNumber,
          routingNumber: bankRoutingNumber,
          accountType: bankAccountType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save bank account");
      }

      setMessage("✓ Bank account connected successfully!");
      setBankLast4(data.last4);
      setBankConnectedAt(data.connectedAt);
      setBankAccountNumber(""); // Clear full number after save

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-foreground/60">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-foreground/60 hover:text-foreground mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-semibold">⚙️ Settings</h1>
          <p className="text-foreground/70 mt-2">
            Manage your account and payment preferences
          </p>
        </div>

        {/* Account Info */}
        <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-foreground/60">Username:</span> {user?.username}</p>
            <p><span className="text-foreground/60">Email:</span> {user?.email}</p>
            <p><span className="text-foreground/60">Member since:</span> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</p>
          </div>
        </div>

        {/* Bank Account Section */}
        <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-6">
          <h2 className="text-xl font-semibold mb-2">💰 Bank Account (For Cashouts)</h2>
          <p className="text-sm text-foreground/60 mb-6">
            Connect your bank account to receive cashout payments. Your account details are encrypted and secure.
          </p>

          {bankConnectedAt && bankLast4 ? (
            <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-green-600 font-medium mb-2">✓ Bank Account Connected</p>
              <div className="text-sm text-foreground/70 space-y-1">
                <p>Account: ****{bankLast4}</p>
                <p>Type: {bankAccountType}</p>
                <p>Connected: {new Date(bankConnectedAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => {
                  setBankConnectedAt(null);
                  setBankLast4("");
                }}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Update bank account
              </button>
            </div>
          ) : (
            <form onSubmit={saveBankAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="1234567890"
                  required
                  maxLength={17}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
                <p className="text-xs text-foreground/60 mt-1">
                  Your full account number is never stored - only the last 4 digits
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Routing Number (9 digits)
                </label>
                <input
                  type="text"
                  value={bankRoutingNumber}
                  onChange={(e) => setBankRoutingNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="021000021"
                  required
                  maxLength={9}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Account Type
                </label>
                <select
                  value={bankAccountType}
                  onChange={(e) => setBankAccountType(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/20 focus:border-foreground/40 focus:outline-none"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </div>

              {message && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                  {message}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? "Saving..." : "Connect Bank Account"}
              </button>

              <p className="text-xs text-foreground/60 text-center">
                🔒 Your bank details are encrypted and secure. We never store your full account number.
              </p>
            </form>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-600 font-medium mb-2">ℹ️ About Cashouts</p>
          <ul className="text-xs text-foreground/70 space-y-1 list-disc list-inside">
            <li>Minimum cashout: $20 USD (20 credits)</li>
            <li>Processing time: 2-5 business days after admin approval</li>
            <li>Only earned credits (not purchased credits) can be cashed out</li>
            <li>7-day escrow release required before cashout eligibility</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
