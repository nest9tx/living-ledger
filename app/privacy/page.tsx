import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.3em] text-foreground/50 hover:text-foreground/80 transition"
        >
          ← Home
        </Link>
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-foreground/60">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-foreground/50">
          Effective: February 2026 &middot; Last updated: February 2026
        </p>

        <div className="mt-8 space-y-8 text-foreground/70 leading-relaxed">
          <section>
            <p className="text-base">
              Living Ledger (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed
              to protecting your privacy. This Policy explains what personal information we
              collect, how we use it, and your rights regarding it. By using Living Ledger, you
              agree to this Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              1. Information We Collect
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Account Information</h3>
                <p>
                  When you register, we collect your email address and the username you choose.
                  You may optionally provide a display name or profile information.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Transaction Data</h3>
                <p>
                  We store records of credits purchased, services transacted, escrow activity,
                  cashout requests, and dispute history associated with your account.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Payment Information</h3>
                <p>
                  Credit card and bank account details are processed directly by Stripe. Living
                  Ledger does not store your raw payment credentials. We receive a Stripe
                  customer ID and payout account status only.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Usage Data</h3>
                <p>
                  We may log basic usage information including IP addresses and page activity,
                  used primarily for security monitoring and fraud prevention.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Messages</h3>
                <p>
                  Messages sent between users through the Platform are stored to facilitate
                  transactions and to provide evidence in dispute resolution.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              2. How We Use Your Information
            </h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>To create and manage your account</li>
              <li>To process credit purchases and service transactions</li>
              <li>
                To send transactional emails (order updates, dispute notices, cashout status)
              </li>
              <li>To detect fraud and maintain Platform security</li>
              <li>To resolve disputes between users</li>
              <li>To comply with legal obligations (e.g. Stripe tax reporting via 1099-K)</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties. We do not use your
              data for advertising targeting or profiling.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              3. Third-Party Services
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Supabase</h3>
                <p>
                  Our database and authentication are powered by Supabase, hosted on AWS
                  infrastructure. Your account data, listings, messages, and transaction records
                  are stored on Supabase servers. View{" "}
                  <a
                    href="https://supabase.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Supabase&apos;s Privacy Policy
                  </a>
                  .
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Stripe</h3>
                <p>
                  All payment processing and payout transfers are handled by Stripe. When you
                  purchase credits or connect a payout account, you interact directly with
                  Stripe&apos;s secure systems. Living Ledger receives only the identifiers
                  necessary to manage your account. View{" "}
                  <a
                    href="https://stripe.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Stripe&apos;s Privacy Policy
                  </a>
                  .
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Resend</h3>
                <p>
                  Transactional emails are sent via Resend. Your email address is shared with
                  Resend solely for the purpose of delivering Platform notifications. View{" "}
                  <a
                    href="https://resend.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Resend&apos;s Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Data Retention</h2>
            <p>
              We retain your account and transaction data for as long as your account is active
              and as required by applicable law. Financial transaction records may be retained
              for up to 7 years for accounting and legal compliance. If you request account
              deletion, we will remove your personal identifying information within 30 days,
              subject to any legal retention obligations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Cookies</h2>
            <p>
              Living Ledger uses session cookies and browser local storage solely to maintain
              your authentication state. We do not use tracking cookies, advertising pixels, or
              cross-site tracking of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Your Rights</h2>
            <p className="mb-3">Depending on your location, you may have the right to:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated personal data</li>
              <li>Object to or restrict certain types of processing</li>
              <li>Receive a portable copy of your data (where technically feasible)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:support@livingledger.org"
                className="underline text-foreground hover:text-foreground/70"
              >
                support@livingledger.org
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Children</h2>
            <p>
              Living Ledger is not directed at anyone under the age of 18. We do not knowingly
              collect personal information from minors. If we become aware that a minor has
              registered, we will terminate their account promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              communicated via email or a notice on the Platform before they take effect.
              Continued use after changes constitutes acceptance of the updated Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Contact</h2>
            <p>
              Privacy questions or data requests:{" "}
              <a
                href="mailto:support@livingledger.org"
                className="underline text-foreground hover:text-foreground/70"
              >
                support@livingledger.org
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
