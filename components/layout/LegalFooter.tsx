"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Immersive full-screen app routes manage their own height; a footer would
// disrupt their layout. The legal pages render their own footer in (legal)/layout.
const HIDDEN_PREFIXES = ["/terminal", "/world", "/hot", "/agent", "/terms", "/privacy", "/disclaimer"];

export default function LegalFooter() {
  const pathname = usePathname() ?? "";
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer className="mt-auto border-t border-[var(--color-rule)] px-6 py-4 text-center text-xs text-[var(--color-ink-dimmer)]">
      <p>
        Pulse provides informational market intelligence only — not investment advice. Not a
        broker-dealer or registered investment adviser.
      </p>
      <nav className="mt-1 flex justify-center gap-4">
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
    </footer>
  );
}
