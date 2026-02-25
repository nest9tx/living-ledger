import Link from "next/link";

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div>
          <Link href="/" className="text-xs uppercase tracking-[0.3em] text-foreground/50 hover:text-foreground/80 transition">
            ← Home
          </Link>
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-foreground/60">
            Community
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Guidelines</h1>
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <p className="text-foreground/70 text-base leading-relaxed">
              Living Ledger is built on reciprocal trust. These guidelines exist to keep the community fair, safe, and worth showing up for. Violations may result in listing removal, account suspension, or permanent ban.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Core Values</h2>
            <ul className="space-y-2 text-foreground/70">
              <li><strong className="text-foreground">Contribution over extraction.</strong> Help others, not yourself alone.</li>
              <li><strong className="text-foreground">Honesty.</strong> Be truthful about your skills, availability, and needs.</li>
              <li><strong className="text-foreground">Respect.</strong> Treat all members as co-creators in this ecosystem.</li>
              <li><strong className="text-foreground">Fairness.</strong> Value others&apos; time and expertise as highly as your own.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">What&apos;s Allowed</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">✅ Requests for help:</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/70">
                  <li>Skills coaching (writing, design, tech, marketing)</li>
                  <li>Emotional support and listening</li>
                  <li>Research and information gathering</li>
                  <li>Organizing and planning assistance</li>
                  <li>Creative collaboration and co-building</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">✅ Offers of service:</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/70">
                  <li>Teaching or mentoring in your area of expertise</li>
                  <li>Creative work (design, writing, art, music)</li>
                  <li>Technical services (coding, debugging, setup)</li>
                  <li>Emotional labor (listening, counseling perspective)</li>
                  <li>Community organizing and event planning</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">✅ Physical goods (shipped):</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/70">
                  <li>Handmade and artisan items (art, crafts, ceramics, textiles)</li>
                  <li>Collectibles, prints, and limited-edition objects</li>
                  <li>DIY kits, zines, and physical creative projects</li>
                  <li>Requests for a specific physical item you need sourced or shipped</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">✅ Fair pricing:</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/70">
                  <li>Set prices based on your time and skill level</li>
                  <li>Minimum service price: 5 credits ($5 USD)</li>
                  <li>Be clear about scope and deliverables</li>
                  <li>For shipped goods: include shipping cost in your listing price or state it clearly in the description</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Physical Goods &amp; Shipped Items</h2>
            <div className="space-y-4 text-foreground/70">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
                <strong className="text-foreground">⚠️ Due diligence notice:</strong> Living Ledger does not possess, produce, warehouse, or guarantee any physical or digital items listed by members. All goods are sourced, made, and shipped directly by the individual seller. Before completing a transaction, ask questions, request additional photos, and verify condition and shipping terms to your satisfaction.
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Seller responsibilities</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Accurately describe the item — condition, dimensions, materials</li>
                  <li>Provide real photos (not stock images) in your listing</li>
                  <li>Ship within the timeframe stated in your listing</li>
                  <li>Provide tracking information once the item is dispatched</li>
                  <li>Respond promptly to buyer questions before and after sale</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Buyer responsibilities</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Confirm your shipping address before completing the transaction</li>
                  <li>Do not confirm delivery until the item has physically arrived</li>
                  <li>Open a dispute promptly if an item is significantly not as described or never arrives</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">What we don&apos;t allow</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Listing items you do not have in your possession or cannot ship</li>
                  <li>Misrepresenting condition, origin, or authenticity</li>
                  <li>Hazardous, regulated, or prohibited goods</li>
                  <li>Drop-shipping arrangements without full disclosure</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">What&apos;s Not Allowed</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">❌ Prohibited content:</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/70">
                  <li>Illegal services or products</li>
                  <li>Sexual, exploitative, or harassing content</li>
                  <li>Discrimination based on identity</li>
                  <li>Spam, scams, or misleading claims</li>
                  <li>Multi-level marketing or pyramid schemes</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">❌ Prohibited behavior:</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/70">
                  <li>Ghosting (disappearing after agreement)</li>
                  <li>Demanding payment outside the platform</li>
                  <li>Posting listings that primarily advertise external sites or lead forms</li>
                  <li>Asking for personal information (SSN, banking details)</li>
                  <li>Harassing or threatening members</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">How Credits Work</h2>
            <div className="space-y-4 text-foreground/70">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Buying credits</h3>
                <p>1 credit = $1 USD. Minimum purchase: 5 credits. <strong className="text-foreground">Purchased credits are non-refundable</strong> — only spend what you intend to use. <strong className="text-foreground">Credits never expire</strong> and remain in your account indefinitely while it is active.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Using credits for a service</h3>
                <p>When you agree to a transaction, credits move into escrow immediately. They are released to the provider only after delivery is confirmed — or after admin review if a dispute is opened. Providers receive <strong className="text-foreground">85%</strong> of the agreed amount (15% platform fee).</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Confirming delivery</h3>
                <p>Once work is complete, the provider marks it delivered. The buyer then confirms. If no dispute is raised within the allowed window, credits release automatically. <strong className="text-foreground">Do not confirm delivery until you are satisfied.</strong></p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Disputes</h3>
                <p>If something goes wrong, open a dispute from the order page. An admin will review the case within 48 hours and make a determination. Both parties may provide context. Admin decisions are final.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-1">Cashing out earned credits</h3>
                <p className="mb-2">Minimum: $20 in earned credits. Credits must have cleared the 7-day escrow safety window before they are eligible. Payouts are sent in your local currency via Stripe.</p>
                <ol className="list-decimal list-inside space-y-1 pl-2 text-sm">
                  <li>Request cashout from your dashboard</li>
                  <li>Admin reviews within 24–48 hours (fraud prevention)</li>
                  <li>Payment sent to your connected Stripe account</li>
                  <li>Stripe handles tax reporting (1099-K if applicable)</li>
                </ol>
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
                  <strong className="text-foreground">⚠️ Before requesting cashout:</strong> You must connect a Stripe account and verify your identity with Stripe (including bank account details). Set this up in <strong className="text-foreground">Settings → Stripe Connect</strong> before your first cashout request. Standard bank transfers are covered by Living Ledger — no additional fee is deducted from your payout amount.
                </div>
              </div>
            </div>
          </section>

          <section className="pt-4 border-t border-foreground/10">
            <p className="text-sm text-foreground/60">
              <strong>Questions?</strong> Email <a href="mailto:support@livingledger.org" className="underline hover:text-foreground">support@livingledger.org</a> (24–48 hour response)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
