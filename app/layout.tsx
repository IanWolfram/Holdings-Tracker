import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { UserAccountProvider } from "@/components/providers/UserAccountProvider";
import { SentryClientInit } from "@/components/providers/SentryClientInit";
import LegalFooter from "@/components/layout/LegalFooter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulse | Precision Ledger Terminal",
  description: "Stock news dashboard with AI verdicts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-read (hydrated from Supabase app_secrets at boot) → handed to the
  // browser SDK at runtime, so the DSN never needs to live in .env.local.
  // Populated on dynamic pages (the authenticated app); static pages prerender
  // without it, which is fine — the app surfaces that matter are all dynamic.
  const sentryDsn = process.env.SENTRY_DSN ?? "";
  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen bg-[#111317] text-[#e2e2e6] antialiased">
        <SentryClientInit dsn={sentryDsn} />
        <UserAccountProvider>{children}</UserAccountProvider>
        <LegalFooter />
      </body>
    </html>
  );
}
