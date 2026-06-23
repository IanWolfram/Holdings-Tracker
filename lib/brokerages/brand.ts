/**
 * Brokerage brand resolution for the TopBar connection indicator.
 *
 * Brokerage linking runs through SnapTrade, but the rail shows the user's
 * *actual* brokerage (E*TRADE, Schwab, …) — its logo and an animated
 * brand-colored "connected" gradient — not SnapTrade's own branding (that
 * lives only in the Account panel). Brands we haven't hand-tuned fall back to
 * a neutral gradient and their SnapTrade-provided logo.
 */

// Hand-tuned brands. Each maps to a `.broker-gradient--<key>` class defined in
// globals.css and a local logo at `/brokerages/<key>.png` (with remote fallback).
type KnownBrand = "etrade" | "schwab" | "robinhood" | "fidelity" | "webull";

// Substring → canonical key. SnapTrade slugs vary ("ETRADE", "CHARLES_SCHWAB",
// "ROBINHOOD"), so match loosely on the normalized identifier.
const BRAND_ALIASES: Array<[needle: string, key: KnownBrand]> = [
  ["etrade", "etrade"],
  ["schwab", "schwab"],
  ["robinhood", "robinhood"],
  ["fidelity", "fidelity"],
  ["webull", "webull"],
];

// Explicit local logo overrides for brands that ship a dedicated asset outside
// the `/brokerages/<key>.png` keyed-copy convention.
const LOGO_OVERRIDES: Partial<Record<KnownBrand, string>> = {
  etrade: "/etrade-logo.png",
};

export interface BrokerageBrand {
  /** Animated gradient classes for the "connected" label. */
  gradientClass: string;
  /** Local logo path; falls back to the SnapTrade remote logo at render. */
  logoSrc: string;
}

function normalize(slug?: string | null, name?: string | null): string {
  return (slug ?? name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveBrokerageBrand(slug?: string | null, name?: string | null): BrokerageBrand {
  const key = normalize(slug, name);
  const match = BRAND_ALIASES.find(([needle]) => key.includes(needle));
  const brand = match?.[1];
  return {
    gradientClass: brand
      ? `broker-gradient broker-gradient--${brand}`
      : "broker-gradient broker-gradient--default",
    // Prefer an explicit override, else the keyed local copy
    // (prep-brokerage-logos.ts writes `/brokerages/<key>.png`).
    logoSrc: (brand && LOGO_OVERRIDES[brand]) ?? `/brokerages/${brand ?? key}.png`,
  };
}
