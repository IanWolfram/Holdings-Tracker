import type { AgentProgress, TickerAnalysisProgress } from "./types";

// Global state for progress tracking across API calls
let currentProgress: AgentProgress = { status: "idle" };
let isCancelled = false;

// Per-ticker analysis state — allows concurrent runs on different tickers
const ANALYSIS_TTL_MS = 30 * 60 * 1000; // 30 minutes

const tickerAnalysisMap = new Map<string, { data: TickerAnalysisProgress; expiresAt: number }>();

export function setTickerAnalysis(ticker: string, progress: TickerAnalysisProgress): void {
  tickerAnalysisMap.set(ticker, { data: progress, expiresAt: Date.now() + ANALYSIS_TTL_MS });
}

export function getTickerAnalysisProgress(ticker: string): TickerAnalysisProgress | undefined {
  const entry = tickerAnalysisMap.get(ticker);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    tickerAnalysisMap.delete(ticker);
    return undefined;
  }
  return entry.data;
}

/**
 * Like {@link getTickerAnalysisProgress}, but returns a safe stub if the
 * entry has expired or was never set. Avoids non-null assertions on the
 * common "merge into current state" code path.
 */
export function getOrInitTickerAnalysis(ticker: string): TickerAnalysisProgress {
  return (
    getTickerAnalysisProgress(ticker) ?? {
      ticker,
      status: "running",
      articleIndex: 0,
      totalArticles: 0,
    }
  );
}

export function getAgentProgress(): AgentProgress {
  return currentProgress;
}

export function cancelStockAgent(): void {
  if (currentProgress.status === "running") {
    isCancelled = true;
    currentProgress = { status: "idle", message: "Agent run cancelled." };
  }
}

// ── Internal accessors shared within the agent module group ──
// These mutate module-level state and are used by sweep.ts and ticker-analysis.ts.

export function getCurrentProgress(): AgentProgress {
  return currentProgress;
}

export function setCurrentProgress(progress: AgentProgress): void {
  currentProgress = progress;
}

export function getIsCancelled(): boolean {
  return isCancelled;
}

export function resetCancelled(): void {
  isCancelled = false;
}