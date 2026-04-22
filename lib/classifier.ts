import fs from "fs";
import path from "path";
import { WORLD_VAULT_PATH, resolveVaultPath } from "./constants";
import { getVaultIndex } from "./vault-index";
import type { Verdict, Classification } from "@/types/news.types";

// ---------------------------------------------------------------------------
// Vault Lookup — checks for manually verified stories in the World Vault
// ---------------------------------------------------------------------------

async function findInVault(url: string): Promise<Classification | null> {
  if (!WORLD_VAULT_PATH) return null;
  const index = await getVaultIndex(WORLD_VAULT_PATH);
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
];

const SELL_KEYWORDS = [
  "miss", "misses", "below expectations", "downgrade", "downgraded", "underperform",
  "sell", "lawsuit", "sued", "investigation", "fraud", "scandal", "departure",
  "resigns", "exits", "cuts guidance", "cuts forecast", "loss", "decline",
  "warning", "recall", "breach", "hack", "layoffs", "bearish", "disappoints",
];

export function keywordClassify(headline: string, summary: string): Classification {
  const text = `${headline} ${summary}`.toLowerCase();
  const buyHits = BUY_KEYWORDS.filter((k) => text.includes(k)).length;
  const sellHits = SELL_KEYWORDS.filter((k) => text.includes(k)).length;

  if (buyHits === 0 && sellHits === 0) {
    return { verdict: "HOLD", confidence: 0.5, reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false };
  }
  if (buyHits > sellHits) {
    return { verdict: "BUY", confidence: Math.min(0.5 + buyHits * 0.1, 0.9), reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false };
  }
  if (sellHits > buyHits) {
    return { verdict: "SELL", confidence: Math.min(0.5 + sellHits * 0.1, 0.9), reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false };
  }
  return { verdict: "HOLD", confidence: 0.5, reason: undefined, classifiedAt: new Date().toISOString(), isAnalyzed: false };
}

// ---------------------------------------------------------------------------
// Global Ollama semaphore — serialize all requests (Ollama is single-threaded)
// ---------------------------------------------------------------------------

let inferenceQueue: Promise<unknown> = Promise.resolve();

export function withInferenceSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  const result: Promise<T> = inferenceQueue.then(() => fn(), () => fn());
  // Advance the queue but ignore errors so future requests aren't blocked
  inferenceQueue = result.then(() => undefined, () => undefined);
  return result;
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
    if (cached) return cached;
  }

  // 2. Keyword fallback — the agent runs MLX analysis separately via analyzeStory.
  //    Doing MLX here would mark stories isAnalyzed:true, causing the agent to skip them.
  return keywordClassify(headline, summary);
}
