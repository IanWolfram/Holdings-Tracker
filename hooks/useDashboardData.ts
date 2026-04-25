import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";
import type { TickerPrediction } from "@/types/predictions";

const CONGRESS_POLL_MS = 60_000;
const AGENT_POLL_MS_ACTIVE = 2_000;
const AGENT_POLL_MS_IDLE = 30_000;

export function useDashboardData() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [news, setNews] = useState<Record<string, ClassifiedStory[]>>({});
  const [congressTrades, setCongressTrades] = useState<Record<string, CongressTrade[]>>({});
  const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cashBalance, setCashBalance] = useState<number | undefined>(undefined);
  const [totalGainLoss, setTotalGainLoss] = useState<number | undefined>(undefined);
  const [agentState, setAgentState] = useState<AgentProgress>({ status: "idle" });
  const [predictions, setPredictions] = useState<Record<string, TickerPrediction[]>>({});

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const congressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentPollRateRef = useRef<number>(AGENT_POLL_MS_IDLE);
  const heldTickersRef = useRef<string[]>([]);
  const prevAgentStatusRef = useRef<string>("idle");

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch("/api/predictions");
      if (!res.ok) return;
      const { predictions: data } = await res.json();
      setPredictions(data);
    } catch {
      // ignore
    }
  }, []);

  const fetchNews = useCallback(async (tickers: string[]) => {
    setLoadingNews(Object.fromEntries(tickers.map((ticker) => [ticker, true])));
    await Promise.all(
      tickers.map(async (ticker) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 300_000);
        try {
          const res = await fetch(`/api/news?ticker=${ticker}`, { signal: controller.signal });
          if (!res.ok) return;
          const data: ClassifiedStory[] = await res.json();
          setNews((prev) => ({ ...prev, [ticker]: data }));
        } catch {
          // includes AbortError
        } finally {
          clearTimeout(timer);
          setLoadingNews((prev) => ({ ...prev, [ticker]: false }));
        }
      })
    );
  }, []);

  const fetchCongress = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;
    try {
      const res = await fetch("/api/congress");
      if (!res.ok) return;
      const { trades }: { trades: CongressTrade[] } = await res.json();
      const tickerSet = new Set(tickers.map((ticker) => ticker.toUpperCase()));
      const byTicker: Record<string, CongressTrade[]> = {};
      for (const trade of trades) {
        if (tickerSet.has(trade.ticker)) {
          if (!byTicker[trade.ticker]) {
            byTicker[trade.ticker] = [];
          }
          byTicker[trade.ticker].push(trade);
        }
      }
      setCongressTrades(byTicker);
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [posRes, balRes, pnlRes] = await Promise.all([
        fetch("/api/positions"),
        fetch("/api/balance"),
        fetch("/api/pnl"),
      ]);
      if (!posRes.ok) throw new Error(`Positions fetch failed: ${posRes.status}`);
      const data: Position[] = await posRes.json();
      const sortedData = [...data].sort((a, b) => b.marketValue - a.marketValue);
      setPositions(sortedData);
      setLastUpdated(new Date());
      if (balRes.ok) {
        const { cashBalance: cash } = await balRes.json();
        setCashBalance(cash);
      }
      if (pnlRes.ok) {
        const { totalPnL } = await pnlRes.json();
        setTotalGainLoss(totalPnL);
      }
      const tickers = data.map((position) => position.ticker);
      heldTickersRef.current = tickers;
      await Promise.all([fetchNews(tickers), fetchCongress(tickers), fetchPredictions()]);
    } catch (err) {
      console.error("[dashboard] refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCongress, fetchNews]);

  const mergeAgentResults = useCallback((progress: AgentProgress) => {
    if (!progress.results) return;
    const agentResults = progress.results;
    setNews((prev) => {
      const updated = { ...prev };
      for (const { ticker, verdicts } of agentResults.tickerResults) {
        if (!updated[ticker]) continue;
        updated[ticker] = updated[ticker].map((story) => {
          const match = verdicts.find((verdict) => verdict.url === story.url || verdict.headline === story.headline);
          if (!match) return story;
          return {
            ...story,
            verdict: match.analysis.verdict as ClassifiedStory["verdict"],
            confidence: match.analysis.confidence,
            reason: match.analysis.reason ?? story.reason,
            isAnalyzed: true,
            classifiedAt: new Date().toISOString(),
          };
        });
      }
      return updated;
    });
  }, []);

  const pollAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/run");
      if (!res.ok) return;
      const data: AgentProgress = await res.json();

      const wasRunning = prevAgentStatusRef.current === "running";
      const justCompleted = wasRunning && data.status === "complete";
      prevAgentStatusRef.current = data.status;

      setAgentState(data);
      if (justCompleted) {
        mergeAgentResults(data);
        fetchPredictions();
      }

      const desiredRate = data.status === "running" ? AGENT_POLL_MS_ACTIVE : AGENT_POLL_MS_IDLE;
      if (desiredRate !== agentPollRateRef.current) {
        agentPollRateRef.current = desiredRate;
        if (agentIntervalRef.current) clearInterval(agentIntervalRef.current);
        agentIntervalRef.current = setInterval(pollAgent, desiredRate);
      }
    } catch {
      // ignore
    }
  }, [mergeAgentResults, fetchPredictions]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    congressIntervalRef.current = setInterval(() => {
      fetchCongress(heldTickersRef.current);
    }, CONGRESS_POLL_MS);
    return () => {
      if (congressIntervalRef.current) clearInterval(congressIntervalRef.current);
    };
  }, [fetchCongress]);

  useEffect(() => {
    pollAgent();
    agentIntervalRef.current = setInterval(pollAgent, agentPollRateRef.current);
    return () => {
      if (agentIntervalRef.current) clearInterval(agentIntervalRef.current);
    };
  }, [pollAgent]);

  return {
    positions,
    news,
    congressTrades,
    loadingNews,
    refreshing,
    lastUpdated,
    cashBalance,
    totalGainLoss,
    agentState,
    predictions,
    refresh,
  };
}
