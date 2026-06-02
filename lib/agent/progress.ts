import type { AgentProgress, TickerAnalysisProgress } from "./types";

// Per-user progress state. All state is keyed by userId so concurrent runs by
// different tenants never observe or clobber each other's progress. The agent's
// caller passes a uid for every operation; CLI/cron paths use a synthetic id.
const currentProgressByUser = new Map<string, AgentProgress>();
const cancelledUsers = new Set<string>();

// Per-(user, ticker) analysis state — allows concurrent runs on different tickers.
const ANALYSIS_TTL_MS = 30 * 60 * 1000; // 30 minutes

const tickerAnalysisMap = new Map<string, { data: TickerAnalysisProgress; expiresAt: number }>();

// Composite key so one user's ticker run can never read another user's, while
// still allowing the same ticker to be analyzed concurrently by different users.
function analysisKey(uid: string, ticker: string): string {
  return `${uid}::${ticker}`;
}

const IDLE: AgentProgress = { status: "idle" };

export function setTickerAnalysis(uid: string, ticker: string, progress: TickerAnalysisProgress): void {
  tickerAnalysisMap.set(analysisKey(uid, ticker), {
    data: progress,
    expiresAt: Date.now() + ANALYSIS_TTL_MS,
  });
}

export function getTickerAnalysisProgress(uid: string, ticker: string): TickerAnalysisProgress | undefined {
  const key = analysisKey(uid, ticker);
  const entry = tickerAnalysisMap.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    tickerAnalysisMap.delete(key);
    return undefined;
  }
  return entry.data;
}

/**
 * Like {@link getTickerAnalysisProgress}, but returns a safe stub if the
 * entry has expired or was never set. Avoids non-null assertions on the
 * common "merge into current state" code path.
 */
export function getOrInitTickerAnalysis(uid: string, ticker: string): TickerAnalysisProgress {
  return (
    getTickerAnalysisProgress(uid, ticker) ?? {
      ticker,
      status: "running",
      articleIndex: 0,
      totalArticles: 0,
    }
  );
}

export function getAgentProgress(uid: string): AgentProgress {
  return currentProgressByUser.get(uid) ?? IDLE;
}

export function cancelStockAgent(uid: string): void {
  if (getAgentProgress(uid).status === "running") {
    cancelledUsers.add(uid);
    currentProgressByUser.set(uid, { status: "idle", message: "Agent run cancelled." });
  }
}

// ── Internal accessors shared within the agent module group ──
// These mutate per-user module-level state and are used by sweep.ts and
// ticker-analysis.ts. `getAgentProgress`/`cancelStockAgent` are the public,
// route-facing aliases over the same per-user state.

export function getCurrentProgress(uid: string): AgentProgress {
  return currentProgressByUser.get(uid) ?? IDLE;
}

export function setCurrentProgress(uid: string, progress: AgentProgress): void {
  currentProgressByUser.set(uid, progress);
}

export function getIsCancelled(uid: string): boolean {
  return cancelledUsers.has(uid);
}

export function resetCancelled(uid: string): void {
  cancelledUsers.delete(uid);
}
