/**
 * News relevance engine — determines whether an article is actually about
 * a given stock.  API-level ticker filters (especially Polygon) are loose
 * and return tangentially-tagged stories.  This module provides a single
 * source of truth for relevance checking across all news providers.
 */

// ---------------------------------------------------------------------------
// Generic suffixes stripped from company names — matching "Technologies" or
// "Holdings" in a headline is not evidence the article is about *our* stock.
// ---------------------------------------------------------------------------
const GENERIC_SUFFIXES = new Set([
  "inc", "corp", "ltd", "llc", "llp", "co",
  "group", "holdings", "holding",
  "technologies", "technology", "tech",
  "systems", "solutions", "services", "service",
  "enterprises", "enterprise",
  "capital", "financial", "finance",
  "international", "global",
  "software", "pharmaceuticals", "pharma",
  "industries", "industry", "industrial",
  "communications", "communication",
  "resources", "resource",
  "electric", "electronics", "energy",
  "healthcare", "health", "medical",
  "securities", "investments", "partners",
]);

// ---------------------------------------------------------------------------
// Tickers that are also common English words — these need word-boundary
// matching (/\bWORD\b/) instead of simple includes() to avoid false
// positives.  E.g. "love" in a headline doesn't mean it's about LOVE stock.
// ---------------------------------------------------------------------------
const COMMON_WORD_TICKERS = new Set([
  "love", "ride", "big", "open", "hope", "care", "play", "grow", "real",
  "home", "food", "bank", "gold", "iron", "salt", "coal", "oil", "run",
  "see", "win", "fun", "top", "net", "key", "map", "app", "bot", "box",
  "fly", "fox", "gem", "gap", "peak", "leaf", "wing", "moon", "star",
  "sun", "fire", "ice", "rock", "blue", "red", "link", "work", "talk",
  "walk", "step", "spin", "snap", "beat", "dash", "rush", "rise",
  "zoom", "shop", "deal", "well", "next", "best", "fast", "free",
  "deep", "pure", "rich", "safe", "cool", "just", "only", "ever",
  "now", "way", "day", "one", "two", "all", "new", "old", "bad",
  "air", "car", "bus", "van", "sea", "sky", "bay", "arc",
]);

// ---------------------------------------------------------------------------
// Known ticker aliases — alternate cashtags or abbreviations that appear
// in articles instead of the formal ticker.
// ---------------------------------------------------------------------------
const TICKER_ALIASES: Record<string, string[]> = {
  BRK:    ["BRK.A", "BRK.B", "Berkshire"],
  "BRK.A": ["BRK", "BRK.B", "Berkshire"],
  "BRK.B": ["BRK", "BRK.A", "Berkshire"],
  GOOGL:  ["GOOG"],
  GOOG:   ["GOOGL"],
};

export interface RelevanceProfile {
  /** Lowercased ticker symbol */
  ticker: string;
  /** Significant words from the company name (generic suffixes stripped) */
  companyTerms: string[];
  /** All searchable terms (ticker + aliases + company terms) */
  allTerms: string[];
  /** Whether the ticker is also a common English word */
  isCommonWord: boolean;
  /** Pre-compiled word-boundary regex for common-word tickers */
  tickerRegex?: RegExp;
}

/**
 * Build a relevance profile for a stock.  The profile captures every term
 * that could appear in a relevant article: the ticker, known aliases, and
 * meaningful words from the company name (excluding generic suffixes).
 */
export function buildRelevanceProfile(
  ticker: string,
  companyName?: string,
): RelevanceProfile {
  const tickerLc = ticker.toLowerCase();
  const isCommonWord = COMMON_WORD_TICKERS.has(tickerLc);

  const allTerms: string[] = [tickerLc];

  // Add aliases
  const aliases = TICKER_ALIASES[ticker.toUpperCase()] ?? [];
  for (const alias of aliases) {
    allTerms.push(alias.toLowerCase());
  }

  // Extract significant words from company name
  const companyTerms: string[] = [];
  if (companyName) {
    const words = companyName.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length >= 3 && !GENERIC_SUFFIXES.has(word) && word !== tickerLc) {
        companyTerms.push(word);
        if (!allTerms.includes(word)) allTerms.push(word);
      }
    }
  }

  const tickerRegex = isCommonWord
    ? new RegExp(`\\b${escapeRegex(tickerLc)}\\b`, "i")
    : undefined;

  return { ticker: tickerLc, companyTerms, allTerms, isCommonWord, tickerRegex };
}

/**
 * Check whether an article's headline + summary are relevant to a stock.
 *
 * Relevance rules:
 * 1. Ticker exact match → relevant (uses word boundary for common-word tickers)
 * 2. Company name term match → relevant if at least 2 significant terms hit,
 *    or 1 term hit when the ticker isn't a common word (e.g. "checkpoint" for CHKP)
 * 3. Always false if no company terms and no ticker match
 */
export function isRelevantToTicker(
  headline: string,
  summary: string,
  profile: RelevanceProfile,
): boolean {
  const text = `${headline} ${summary ?? ""}`;

  // 1. Ticker match — for common-word tickers use word boundary, else includes
  if (profile.isCommonWord) {
    if (profile.tickerRegex?.test(text)) return true;
  } else {
    if (text.toLowerCase().includes(profile.ticker)) return true;
  }

  // 2. Alias match
  const aliases = TICKER_ALIASES[profile.ticker.toUpperCase()] ?? [];
  const textLc = text.toLowerCase();
  for (const alias of aliases) {
    if (textLc.includes(alias.toLowerCase())) return true;
  }

  // 3. Company name terms
  if (profile.companyTerms.length === 0) return false;

  const matchedTerms = profile.companyTerms.filter(
    (term) => textLc.includes(term),
  );

  // For common-word tickers, require at least 2 company term matches
  // to confirm the article is actually about the stock
  if (profile.isCommonWord) {
    return matchedTerms.length >= 2;
  }

  // For unique tickers, a single company term match is sufficient
  return matchedTerms.length >= 1;
}

/**
 * Score article relevance (0–1).  Higher scores mean the article is more
 * clearly about the stock.  Used for ranking when multiple articles pass
 * the relevance threshold.
 */
export function scoreRelevance(
  headline: string,
  summary: string,
  profile: RelevanceProfile,
): number {
  const text = `${headline} ${summary ?? ""}`.toLowerCase();
  let score = 0;

  // Ticker in headline is the strongest signal
  if (profile.isCommonWord) {
    if (profile.tickerRegex?.test(headline)) score += 0.4;
    else if (profile.tickerRegex?.test(summary)) score += 0.2;
  } else {
    if (headline.toLowerCase().includes(profile.ticker)) score += 0.4;
    else if (text.includes(profile.ticker)) score += 0.2;
  }

  // Company name term matches
  for (const term of profile.companyTerms) {
    if (headline.toLowerCase().includes(term)) score += 0.2;
    else if (text.includes(term)) score += 0.1;
  }

  // Bonus: ticker appears as cashtag ($CHKP)
  if (text.includes(`$${profile.ticker}`)) score += 0.15;

  return Math.min(score, 1);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}