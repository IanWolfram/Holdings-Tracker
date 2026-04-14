import fs from "fs";
import path from "path";
import type { Verdict, Classification } from "@/types/news.types";

// ---------------------------------------------------------------------------
// Agent context — loaded once from agents/stock-analyzer/*.md
// ---------------------------------------------------------------------------

function loadAgentContext(): string {
  const agentDir = path.join(process.cwd(), "agents", "stock-analyzer");
  const files = ["AGENT.md", "rules.md"];
  return files
    .map((f) => {
      try {
        return fs.readFileSync(path.join(agentDir, f), "utf-8");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

// Cache so we only read the files once per process lifetime
let agentContext: string | null = null;
function getAgentContext(): string {
  if (!agentContext) agentContext = loadAgentContext();
  return agentContext;
}

// ---------------------------------------------------------------------------
// Keyword fallback — used when Ollama is unreachable
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

function keywordClassify(headline: string, summary: string): Classification {
  const text = `${headline} ${summary}`.toLowerCase();
  const buyHits = BUY_KEYWORDS.filter((k) => text.includes(k)).length;
  const sellHits = SELL_KEYWORDS.filter((k) => text.includes(k)).length;

  if (buyHits === 0 && sellHits === 0) {
    return { verdict: "HOLD", confidence: 0.5, reason: undefined, classifiedAt: new Date().toISOString() };
  }
  if (buyHits > sellHits) {
    return { verdict: "BUY", confidence: Math.min(0.5 + buyHits * 0.1, 0.9), reason: undefined, classifiedAt: new Date().toISOString() };
  }
  if (sellHits > buyHits) {
    return { verdict: "SELL", confidence: Math.min(0.5 + sellHits * 0.1, 0.9), reason: undefined, classifiedAt: new Date().toISOString() };
  }
  return { verdict: "HOLD", confidence: 0.5, reason: undefined, classifiedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Global Ollama semaphore — serialize all requests (Ollama is single-threaded)
// ---------------------------------------------------------------------------

let ollamaQueue: Promise<unknown> = Promise.resolve();

export function withOllamaSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  const result: Promise<T> = ollamaQueue.then(() => fn(), () => fn());
  // Advance the queue but ignore errors so future requests aren't blocked
  ollamaQueue = result.then(() => undefined, () => undefined);
  return result;
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export async function classifyNews(
  ticker: string,
  headline: string,
  summary: string
): Promise<Classification> {
  // Hard-bypass Ollama completely to prevent system lag and WebGL crashing
  return keywordClassify(headline, summary);
}
