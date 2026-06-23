import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse | Legal",
};

/**
 * Shared shell for the public legal pages (/terms, /privacy, /disclaimer).
 * These pages are intentionally outside the auth wall — see PUBLIC_PATHS in
 * middleware.ts. Content is a DRAFT pending review by a securities/fintech
 * attorney (see docs/data-handling.md and the launch plan, Layer 0).
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080808] text-[var(--color-on-surface)]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between border-b border-[var(--color-rule)] pb-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-headline)] text-lg tracking-tight text-[var(--color-on-surface)] hover:text-[var(--color-positive)] transition-colors"
          >
            Pulse
          </Link>
          <nav className="flex gap-5 text-sm text-[var(--color-outline)]">
            <Link href="/disclaimer" className="hover:text-[var(--color-on-surface)] transition-colors">
              Disclaimer
            </Link>
            <Link href="/terms" className="hover:text-[var(--color-on-surface)] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--color-on-surface)] transition-colors">
              Privacy
            </Link>
          </nav>
        </header>
        <article className="legal-prose space-y-5 text-[15px] leading-relaxed text-[var(--color-on-surface-variant)]">
          {children}
        </article>
        <footer className="mt-12 border-t border-[var(--color-rule)] pt-6 text-xs text-[var(--color-ink-dimmer)]">
          Pulse provides informational market intelligence only and is not investment advice.
          Not a broker-dealer or registered investment adviser.
        </footer>
      </div>
    </div>
  );
}
