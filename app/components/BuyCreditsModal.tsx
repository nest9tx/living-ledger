"use client";

/**
 * Buy Credits Component
 * 
 * Allows users to purchase additional Gratitude Credits
 * using Stripe payment processing.
 * 
 * TODO: Full implementation requires:
 * 1. Stripe Elements/Card setup
 * 2. PaymentIntent client-side handling
 * 3. Webhook integration for credit recording
 * 4. Success/error handling
 */

import { useState } from "react";

type CreditPackage = {
  id: string;
  credits: number;
  price: number;
  savings?: number;
};

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "small", credits: 10, price: 10 },
  { id: "medium", credits: 50, price: 45, savings: 5 },
  { id: "large", credits: 100, price: 85, savings: 15 },
  { id: "xlarge", credits: 500, price: 400, savings: 100 },
];

export default function BuyCreditsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [selectedPackage, setSelectedPackage] = useState<string>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkg = CREDIT_PACKAGES.find((p) => p.id === selectedPackage);

  const handlePurchase = async () => {
    if (!pkg) return;

    setLoading(true);
    setError(null);

    try {
      // TODO: Implement payment processing
      // 1. Call createBuyCreditsPaymentIntent from stripe-helpers
      // 2. Initialize Stripe Payment Element
      // 3. Handle payment confirmation
      // 4. Redirect to success page
      // 5. Webhook will add credits to user's account

      console.log(`Purchasing ${pkg.credits} credits for $${pkg.price}`);

      // Temporary placeholder
      alert(
        `This will purchase ${pkg.credits} credits for $${pkg.price}\n\nFull payment integration coming soon!`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Payment failed";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-background rounded-lg border border-foreground/10 p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Buy Credits</h2>
          <button
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-foreground/70 mb-6">
          1 credit = $1 USD. Credits never expire and can be used for any service
          on the platform.
        </p>

        <div className="space-y-3 mb-6">
          {CREDIT_PACKAGES.map((pkg) => (
            <label
              key={pkg.id}
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                selectedPackage === pkg.id
                  ? "border-foreground bg-foreground/5"
                  : "border-foreground/10 hover:border-foreground/20"
              }`}
            >
              <input
                type="radio"
                name="package"
                value={pkg.id}
                checked={selectedPackage === pkg.id}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium">
                  {pkg.credits} Credits — ${pkg.price}
                </div>
                {pkg.savings && (
                  <div className="text-xs text-emerald-600">
                    Save ${pkg.savings}
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold">
                ${(pkg.price / pkg.credits).toFixed(2)}/credit
              </div>
            </label>
          ))}
        </div>

        {error && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 mb-4">
            ⚠️ {error}
          </p>
        )}

        <button
          onClick={handlePurchase}
          disabled={loading}
          className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition disabled:opacity-60 mb-2"
        >
          {loading ? "Processing…" : `Buy ${pkg?.credits} Credits`}
        </button>

        <button
          onClick={onClose}
          className="w-full rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5"
        >
          Cancel
        </button>

        <p className="text-xs text-foreground/50 text-center mt-4">
          Your payment is processed securely by Stripe.
        </p>
      </div>
    </div>
  );
}
