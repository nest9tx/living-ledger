import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavHeader from "./components/NavHeader";
import Footer from "./components/Footer";

// Applied before React hydrates to prevent flash of wrong theme
const themeScript = `
  try {
    const t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.classList.add(t);
    }
  } catch {}
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://livingledger.org"),
  title: {
    default: "Living Ledger — Give Help. Receive Help. Build Credit.",
    template: "%s | Living Ledger",
  },
  description:
    "A community marketplace for micro-acts of assistance. Post requests, post offers, earn Gratitude Credits, and cash out real money via Stripe.",
  keywords: ["community marketplace", "micro-services", "gratitude credits", "skill sharing", "freelance", "help exchange"],
  authors: [{ name: "Living Ledger" }],
  openGraph: {
    type: "website",
    url: "https://livingledger.org",
    siteName: "Living Ledger",
    title: "Living Ledger — Give Help. Receive Help. Build Credit.",
    description:
      "A community marketplace for micro-acts of assistance. Post requests, post offers, earn Gratitude Credits, and cash out real money via Stripe.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Living Ledger — Community Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Living Ledger — Give Help. Receive Help. Build Credit.",
    description:
      "A community marketplace for micro-acts of assistance. Earn credits for helping others and cash out via Stripe.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
