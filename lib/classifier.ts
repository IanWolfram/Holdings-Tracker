import { FALLBACK_CONFIDENCE, SYSTEM_USER_ID } from "./constants";
import { getVaultIndex } from "./vault-index";
import { getVaultStore } from "./vault/store";
import type { Verdict, Classification } from "@/types/news.types";

// ---------------------------------------------------------------------------
// Vault Lookup — checks for manually verified stories in the World Vault
// ---------------------------------------------------------------------------

async function findInVault(url: string, userId: string = SYSTEM_USER_ID): Promise<Classification | null> {
  const store = await getVaultStore(userId);
  const index = await getVaultIndex(store, userId);
  return index.get(url) || null;
}

// ---------------------------------------------------------------------------
// Keyword fallback — used when Ollama is disabled or unreachable
// ---------------------------------------------------------------------------

const BUY_KEYWORDS = [
  "beat", "beats", "exceeds", "surpasses", "record", "upgrade", "upgraded",
  "outperform", "buy", "strong", "growth", "raises guidance", "raises forecast",
  "partnership", "launches", "expands", "acquires", "acquisition", "wins",
  "positive", "profit", "revenue up", "earnings beat", "bullish", "breakthrough",
  "surge", "soar", "rally", "outperform", "overweight", "beats consensus",
  "record revenue", "bullish thesis",
];

const SELL_KEYWORDS = [
  "miss", "misses", "below expectations", "downgrade", "downgraded", "underperform",
  "sell", "lawsuit", "sued", "investigation", "fraud", "scandal", "departure",
  "resigns", "exits", "cuts guidance", "cuts forecast", "loss", "decline",
  "warning", "recall", "breach", "hack", "layoffs", "bearish", "disappoints",
  "plunge", "plummets", "cut to", "underweight", "sell rating", "below estimates",
  "revenue decline", "guidance cut",
];

export function keywordClassify(headline: string, summary: string): Classification {
  const text = `${headline} ${summary}`.toLowerCase();
  const buyHits = BUY_KEYWORDS.filter((k) => text.includes(k)).length;
  const sellHits = SELL_KEYWORDS.filter((k) => text.includes(k)).length;

  if (buyHits === 0 && sellHits === 0) {
    return { verdict: "HOLD", confidence: FALLBACK_CONFIDENCE, reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
  }
  if (buyHits > sellHits) {
    return { verdict: "BUY", confidence: Math.min(FALLBACK_CONFIDENCE + buyHits * 0.1, 0.7), reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
  }
  if (sellHits > buyHits) {
    return { verdict: "SELL", confidence: Math.min(FALLBACK_CONFIDENCE + sellHits * 0.1, 0.7), reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
  }
  return { verdict: "HOLD", confidence: FALLBACK_CONFIDENCE, reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
}

// ---------------------------------------------------------------------------
// Cloud API concurrency control
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_CLOUD = 4;
let cloudActive = 0;
let cloudQueue: Array<() => void> = [];

/** Limit cloud API inference calls to MAX_CONCURRENT_CLOUD concurrent. */
export function withCloudSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      cloudActive++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          cloudActive--;
          if (cloudQueue.length > 0) {
            const next = cloudQueue.shift()!;
            next();
          }
        });
    };
    if (cloudActive < MAX_CONCURRENT_CLOUD) {
      run();
    } else {
      cloudQueue.push(run);
    }
  });
}

// ---------------------------------------------------------------------------
// Main classifier — thin wrapper around the unified brain
// ---------------------------------------------------------------------------

export async function classifyNews(
  ticker: string,
  headline: string,
  summary: string,
  url?: string,
  userId: string = SYSTEM_USER_ID,
): Promise<Classification> {
  // 1. Check verified vault first
  if (url) {
    const cached = await findInVault(url, userId);
    if (cached) return { ...cached, classificationSource: "vault" as const };
  }

  // 2. Keyword fallback — the agent runs full AI analysis separately via analyzeStory.
  //    Doing AI here would mark stories isAnalyzed:true, causing the agent to skip them.
  return keywordClassify(headline, summary);
}
