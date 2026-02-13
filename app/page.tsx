export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-10 px-6 py-20">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.4em] text-foreground/60">
            Living Ledger
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            A community for micro-acts of help.
          </h1>
          <p className="max-w-2xl text-base text-foreground/70 sm:text-lg">
            Post a request, offer your gifts, and earn gratitude credits that
            circulate through a community built on contribution.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background"
            href="/signup"
          >
            Join the community
          </a>
          <a
            className="inline-flex items-center justify-center rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium"
            href="/login"
          >
            Sign in
          </a>
          <a
            className="inline-flex items-center justify-center rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium"
            href="/guidelines"
          >
            Learn more
          </a>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-3">
          {[
            {
              title: "Requests",
              copy: "Ask for help with skills, wisdom, or support and receive focused responses.",
            },
            {
              title: "Offers",
              copy: "Share your gifts and grow a trusted reputation through real contributions.",
            },
            {
              title: "Gratitude Credits",
              copy: "Track the value you generate and reinvest it into the ecosystem.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-foreground/10 bg-foreground/3"
            >
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm text-foreground/70">{card.copy}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
