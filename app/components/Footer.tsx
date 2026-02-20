import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-foreground/10">
      <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-foreground/60">
        <div>
          <p className="font-medium text-foreground">🌱 Living Ledger</p>
          <p className="text-xs mt-1">
            &copy; {new Date().getFullYear()} Living Ledger. All rights reserved.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/browse" className="hover:text-foreground transition">
            Browse
          </Link>
          <Link href="/guidelines" className="hover:text-foreground transition">
            Guidelines
          </Link>
          <Link href="/terms" className="hover:text-foreground transition">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition">
            Privacy
          </Link>
          <a
            href="mailto:support@livingledger.org"
            className="hover:text-foreground transition"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
