import type { UnifiedAnalysis } from "../../world-brain/brain";

export interface AgentProgress {
  status: "idle" | "running" | "complete" | "error";
  phase?: "resolving" | "analyzing" | "forecasting" | "learning";
  ticker?: string;
  currentHeadline?: string;
  articleIndex?: number;
  totalArticles?: number;
  message?: string;
  streamText?: string;
  results?: AgentRunResult;
  isMock?: boolean;
}

export interface TickerResult {
  ticker: string;
  verdicts: {
    verdict: string;
    headline: string;
    url: string;
    analysis: UnifiedAnalysis;
  }[];
}

export interface AgentRunResult {
  totalBuys: number;
  totalSells: number;
  totalHolds: number;
  tickerResults: TickerResult[];
  startedAt: number;
  finishedAt: number;
}

export interface TickerAnalysisProgress {
  ticker: string;
  status: "idle" | "running" | "complete" | "error";
  articleIndex: number;
  totalArticles: number;
  currentHeadline?: string;
  message?: string;
  results?: TickerResult;
}