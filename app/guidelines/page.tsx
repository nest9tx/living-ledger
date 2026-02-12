export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">
            Community
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Guidelines</h1>
        </div>

        <div className="mt-8 space-y-8">
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
                <h3 className="font-semibold mb-2">✅ Fair pricing:</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/70">
                  <li>Set prices based on your time and skill level</li>
                  <li>Minimum service price: 5 credits ($5 USD)</li>
                  <li>Be clear about scope and deliverables</li>
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
                  <li>Asking for personal information (SSN, banking details)</li>
                  <li>Harassing or threatening members</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Credit System Rules</h2>
            <div className="space-y-3 text-foreground/70">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Buying credits:</h3>
                <p>1 credit = $1 USD. Minimum purchase: 5 credits. Non-refundable (platform policy).</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Using credits:</h3>
                <p>Credits held in escrow until work is marked complete. Platform takes 10% fee on all transactions.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Cashing out:</h3>
                <p>Weekly cashout minimum: 20 credits. Stripe processes payouts (2.9% + $0.30 fee applies).</p>
              </div>
            </div>
          </section>

          <section className="pt-4 border-t border-foreground/10">
            <p className="text-sm text-foreground/60">
              <strong>Questions?</strong> Email hello@livingledger.com (24–48 hour response)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
