import { getVaultIndex } from "./vault-index";
import { getVaultStore } from "./vault/store";
import type { Verdict, Classification } from "@/types/news.types";

// ---------------------------------------------------------------------------
// Vault Lookup — checks for manually verified stories in the World Vault
// ---------------------------------------------------------------------------

async function findInVault(url: string): Promise<Classification | null> {
  const store = await getVaultStore("system");
  const index = await getVaultIndex(store);
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
    return { verdict: "HOLD", confidence: 0.5, reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
  }
  if (buyHits > sellHits) {
    return { verdict: "BUY", confidence: Math.min(0.5 + buyHits * 0.1, 0.7), reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
  }
  if (sellHits > buyHits) {
    return { verdict: "SELL", confidence: Math.min(0.5 + sellHits * 0.1, 0.7), reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
  }
  return { verdict: "HOLD", confidence: 0.5, reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false, classificationSource: "keyword" };
}

// ---------------------------------------------------------------------------
// Inference concurrency control
// ---------------------------------------------------------------------------
// MLX runs on a single-threaded GPU — all MLX calls must be serialized.
// Cloud API calls (DeepSeek, OpenAI) can run concurrently with a limit.

let mlxQueue: Promise<unknown> = Promise.resolve();

/** Serialize MLX inference calls (single-threaded GPU constraint). */
export function withInferenceSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  const result: Promise<T> = mlxQueue.then(() => fn(), () => fn());
  mlxQueue = result.then(() => undefined, () => undefined);
  return result;
}

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
  url?: string
): Promise<Classification> {
  // 1. Check verified vault first
  if (url) {
    const cached = await findInVault(url);
    if (cached) return { ...cached, classificationSource: "vault" as const };
  }

  // 2. Keyword fallback — the agent runs MLX analysis separately via analyzeStory.
  //    Doing MLX here would mark stories isAnalyzed:true, causing the agent to skip them.
  return keywordClassify(headline, summary);
}
