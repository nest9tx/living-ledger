import Link from "next/link";

export default function TermsPage() {
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
        <h1 className="mt-3 text-4xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-foreground/50">
          Effective: February 2026 &middot; Last updated: February 2026
        </p>

        <div className="mt-8 space-y-8 text-foreground/70 leading-relaxed">
          <section>
            <p className="text-base">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Living
              Ledger (the &ldquo;Platform&rdquo;). By creating an account or using the Platform in
              any way, you agree to these Terms in full. If you do not agree, do not use the
              Platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Eligibility</h2>
            <p>
              You must be at least 18 years old to use Living Ledger. By registering, you
              represent that you are 18 or older, that you will provide accurate information about
              yourself, and that you will maintain only one account per person.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              2. What Living Ledger Is
            </h2>
            <p>
              Living Ledger is a peer-to-peer marketplace where community members post requests for
              help and offers of service. We facilitate transactions using a credit-based system
              (&ldquo;Gratitude Credits&rdquo;). Living Ledger does not itself provide any services
              listed by users and is not a party to agreements made between users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Your Account</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>Keep your credentials secure. Do not share your login with others.</li>
              <li>You may not transfer, sell, or assign your account to another person.</li>
              <li>You may change your username once per 30-day period.</li>
              <li>
                We reserve the right to suspend or terminate accounts that violate these Terms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              4. The Credit System
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Purchasing Credits</h3>
                <p>
                  Credits are sold at a rate of $1 USD per credit, with a minimum purchase of 5
                  credits. All credit purchases are processed through Stripe and are{" "}
                  <strong className="text-foreground">non-refundable</strong>. Only purchase
                  credits you intend to use.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Credit Expiry</h3>
                <p>
                  Purchased and earned credits{" "}
                  <strong className="text-foreground">never expire</strong>. They remain in your
                  account for as long as your account is active. Accounts that remain inactive for
                  more than 24 consecutive months may be subject to closure following 60 days&apos;
                  written notice to the email address on file. Any credits remaining at the time
                  of account closure will be addressed in accordance with applicable law.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Earning Credits</h3>
                <p>
                  Credits earned by providing services are held in escrow during a 7-day safety
                  window before becoming eligible for cashout. A{" "}
                  <strong className="text-foreground">15% platform fee</strong> is deducted when
                  escrow releases to the provider.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Cashing Out Earned Credits</h3>
                <p>
                  Earned credits (received through completed services) may be cashed out via Stripe. Payouts are delivered in your local currency (Stripe handles conversion). The minimum cashout amount is $20 USD equivalent. Cashout requests are reviewed by
                  an admin within 24–48 hours. Purchased credits cannot be cashed out.
                  Standard bank transfers are covered by Living Ledger at no additional cost to
                  you. Instant payout options, if offered in the future, may carry a small fee
                  disclosed at the time of the request. Cross-border transfers may incur a small
                  Stripe fee (typically 0.25%) absorbed by the platform.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              5. Transactions &amp; Escrow
            </h2>
            <p>
              When a buyer agrees to a transaction, the agreed credit amount is placed into
              escrow. Credits are released to the service provider only after delivery is
              confirmed by the buyer, or after admin review if a dispute is raised. Providers
              receive 85% of the agreed amount (15% platform fee). Credits released in error are
              subject to administrative correction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Platform Fees</h2>
            <p>
              Living Ledger charges a{" "}
              <strong className="text-foreground">15% platform fee</strong> on all completed
              service transactions. This fee is automatically deducted when escrow releases. No
              additional fees are charged on earned credits at the time of standard cashout.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              7. Conduct &amp; Prohibited Uses
            </h2>
            <p className="mb-3">You may not use Living Ledger to:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Offer or request illegal goods or services</li>
              <li>Engage in harassment, threats, or discriminatory behavior</li>
              <li>Solicit payment outside the Platform to circumvent fees</li>
              <li>Create fake listings, fake accounts, or misrepresent your identity</li>
              <li>Transmit malware or otherwise attempt to compromise Platform security</li>
              <li>Violate any applicable law or regulation</li>
            </ul>
            <p className="mt-3">
              Full conduct standards are in our{" "}
              <Link
                href="/guidelines"
                className="underline text-foreground hover:text-foreground/70"
              >
                Community Guidelines
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              8. Dispute Resolution
            </h2>
            <p>
              Disputes between buyers and sellers should first be attempted to be resolved
              between the parties via Platform messaging. If unsuccessful, either party may
              escalate to admin review from the order page within the dispute window. Admin
              decisions are final. Living Ledger is not liable for the outcome of user disputes
              or the quality of services exchanged between users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              9. Intellectual Property
            </h2>
            <p>
              You retain ownership of content you post. By posting, you grant Living Ledger a
              limited, non-exclusive, royalty-free license to display and transmit your content
              solely to operate the Platform. You represent that you have all necessary rights to
              any content you post and that it does not infringe third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              10. Physical Goods &amp; Shipping
            </h2>
            <div className="space-y-4">
              <p>
                Living Ledger supports listings for physical goods (handmade items, art, collectibles, crafts, and similar tangible products) in addition to digital services. When a listing is marked as a physical item, the following terms apply:
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  <strong className="text-foreground">Shipping is the seller&apos;s responsibility.</strong> The seller must package and ship the item in a timely manner after a transaction is agreed. Shipping costs, if any, are set by the seller and displayed separately on the listing.
                </li>
                <li>
                  <strong className="text-foreground">Buyers must provide a shipping address.</strong> Buyers are responsible for sending a valid shipping address to the seller via the platform&apos;s message system before or immediately after a transaction is confirmed. Living Ledger does not store or process shipping addresses.
                </li>
                <li>
                  <strong className="text-foreground">Living Ledger is not liable for shipping.</strong> We are not responsible for lost, stolen, damaged, delayed, or undelivered items. Any issues with shipping are between the buyer and seller, and may be escalated through the dispute system if evidence of misrepresentation exists.
                </li>
                <li>
                  <strong className="text-foreground">Item condition.</strong> Sellers must accurately represent the condition and description of physical items. Misrepresentation may result in a dispute, admin review, and potential account action. Buyers are encouraged to request photos and ask questions via messaging before completing a transaction.
                </li>
                <li>
                  <strong className="text-foreground">Disputes for physical goods.</strong> If an item arrives significantly not as described, buyers may open a dispute from the order page and provide photographic evidence. Admin decisions in these cases are final.
                </li>
                <li>
                  <strong className="text-foreground">Prohibited physical goods.</strong> Physical listings are subject to the same conduct rules as all listings. You may not sell illegal items, counterfeit goods, weapons, hazardous materials, or any products that violate applicable law.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">11. Disclaimers</h2>
            <p>
              Living Ledger is provided &ldquo;as is&rdquo; without warranties of any kind,
              express or implied. We do not guarantee the quality, safety, legality, or timely
              delivery of services listed by users. Use the Platform at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              12. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, Living Ledger and its operators
              shall not be liable for any indirect, incidental, consequential, or punitive damages
              arising from your use of the Platform or any transaction between users. Our total
              liability to you shall not exceed the platform fees you paid in the 3 months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              13. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold Living Ledger and its operators harmless from any
              claims, losses, damages, or legal fees arising from your use of the Platform, your
              violations of these Terms, or your interactions with other users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              14. Changes &amp; Termination
            </h2>
            <p>
              We may update these Terms at any time. Material changes will be communicated by
              email or a prominent notice on the Platform at least 14 days before taking effect.
              Continued use after the effective date constitutes acceptance. We may suspend or
              terminate your account for violations of these Terms, at our discretion, with or
              without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">15. Contact</h2>
            <p>
              Questions about these Terms?{" "}
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
