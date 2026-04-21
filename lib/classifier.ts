import fs from "fs";
import path from "path";
import { WORLD_VAULT_PATH, resolveVaultPath } from "./constants";
import type { Verdict, Classification } from "@/types/news.types";

// ---------------------------------------------------------------------------
// Vault Lookup — checks for manually verified stories in the World Vault
// ---------------------------------------------------------------------------

async function findInVault(url: string): Promise<Classification | null> {
  const vaultPath = resolveVaultPath(WORLD_VAULT_PATH);
  if (!vaultPath) return null;
  const newsDir = path.join(vaultPath, "news");
  if (!fs.existsSync(newsDir)) return null;

  try {
    const files = fs.readdirSync(newsDir);
    // Sort files by date descending (assuming YYYY-MM-DD prefix) to find newest first
    const mdFiles = files.filter(f => f.endsWith(".md")).sort().reverse();

    for (const file of mdFiles) {
      const content = fs.readFileSync(path.join(newsDir, file), "utf-8");
      // Fast check for URL match
      if (content.includes(url)) {
        // Simple frontmatter parser
        const lines = content.split("\n");
        const fm: Record<string, string> = {};
        let inFm = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "---") {
            if (!inFm) { inFm = true; continue; }
            else break;
          }
          if (inFm) {
            const splitIdx = line.indexOf(":");
            if (splitIdx !== -1) {
              const key = line.slice(0, splitIdx).trim();
              const val = line.slice(splitIdx + 1).trim().replace(/^["']|["']$/g, '');
              fm[key] = val;
            }
          }
        }

        if (fm.verdict) {
          // Extract reason from the AI Analysis section if possible
          let reason = fm.reason;
          if (!reason) {
            const analysisMatch = content.match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/);
            if (analysisMatch) reason = analysisMatch[1].trim();
          }

          return {
            verdict: fm.verdict as Verdict,
            confidence: parseFloat(fm.confidence || "0.9"),
            reason: reason || undefined,
            relevanceScore: parseFloat(fm.relevance || "0"),
            originCountryCode: fm.country || null,
            classifiedAt: new Date().toISOString(),
            isAnalyzed: fm.verified === "true",
            fromVault: true,
          };
        }
      }
    }
  } catch (err) {
    console.error("[classifier] Vault lookup failed:", err);
  }
  return null;
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

  // 2. Always attempt the MLX brain — fall back to keywords only on error or if the server is absent
  try {
    const { analyzeStory } = await import("../world-brain/brain");
    const result = await analyzeStory(ticker, headline, summary);
    return {
      verdict: result.verdict as Verdict,
      confidence: result.confidence,
      reason: result.reason || undefined,
      relevanceScore: result.relevanceScore,
      originCountryCode: result.originCountryCode,
      classifiedAt: new Date().toISOString(),
      isAnalyzed: true,
      fromVault: false,
    };
  } catch (err) {
    console.error(`[classifier] Brain error for ${ticker}:`, err);
    return keywordClassify(headline, summary);
  }
}
