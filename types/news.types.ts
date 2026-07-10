import type { CatalystType } from "./predictions";

export type Verdict = "BUY" | "SELL" | "HOLD";

/**
 * User-facing labels for the internal verdict enum. We classify the SENTIMENT of
 * news about a ticker — we do NOT issue trade instructions. The internal type
 * stays BUY/SELL/HOLD (data model + classifier contract), but every string a
 * user sees must route through this map so the surface reads as impersonal
 * sentiment ("Positive") rather than an imperative recommendation ("BUY").
 * Note: this is presentation framing pending securities-counsel review — it is
 * not, by itself, a determination that the product is outside adviser regulation.
 */
export const VERDICT_LABEL: Record<Verdict, string> = {
  BUY: "Positive",
  HOLD: "Neutral",
  SELL: "Negative",
};

export function computeConfidenceBucket(confidence: number, analysisFailed?: boolean): "high" | "medium" | "low" | "failed" {
  if (analysisFailed) return "failed";
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.60) return "medium";
  return "low";
}

export interface Classification {
  verdict: Verdict;
  confidence: number;
  reason?: string;
  relevanceScore?: number;
  originCountryCode?: string | null;
  catalystTypes?: CatalystType[];
  classifiedAt: string;
  isAnalyzed?: boolean;
  fromVault?: boolean;
  analysisFailed?: boolean;
  classificationSource?: "ai" | "keyword" | "vault";
  confidenceBucket?: "high" | "medium" | "low" | "failed";
}

export interface ClassifiedStory extends Classification {
  ticker: string;
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  author?: string;
  source: "finnhub" | "newsapi" | "polygon";
  originalSource?: string; // Original provider for vault stories (e.g., "finnhub", "reddit")
  isAnalyzed?: boolean;     // True if hardware-native DeepSeek analysis was performed
  analysisFailed?: boolean; // True if analysis was a fallback HOLD
  catalystTypes?: CatalystType[];
  duplicates?: ClassifiedStory[]; // Same-event stories collapsed under this canonical
}

export interface CongressTrade {
  id: string;
  politician: string;
  party: "D" | "R" | "I";
  chamber: "house" | "senate";
  ticker: string;
  companyName: string;
  tradeType: "buy" | "sell" | "buy_option" | "sell_option";
  assetType: string;   // "stock", "call option", "put option", etc.
  amount: string;      // "$1k–$15k", "$50k–$100k", etc.
  tradeDate: number;   // unix timestamp (seconds)
  filedDate: number;   // unix timestamp (seconds)
  url: string;
  isCompliant?: boolean; // filed within the STOCK Act 45-day disclosure window
  ingestedAt?: number;   // unix seconds — when our pipeline first stored the filing; drives "new" detection
}
