"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DesktopDashboard from "@/components/DesktopDashboard";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";

const CONGRESS_POLL_MS = 60_000;
const AGENT_POLL_MS_ACTIVE = 2_000;  // while running
const AGENT_POLL_MS_IDLE   = 30_000; // while idle/complete

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [news, setNews] = useState<Record<string, ClassifiedStory[]>>({});
  const [congressTrades, setCongressTrades] = useState<Record<string, CongressTrade[]>>({});
  const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cashBalance, setCashBalance] = useState<number | undefined>(undefined);
  const [totalGainLoss, setTotalGainLoss] = useState<number | undefined>(undefined);
  const [agentState, setAgentState] = useState<AgentProgress>({ status: "idle" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const congressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentPollRateRef = useRef<number>(AGENT_POLL_MS_IDLE);
  const heldTickersRef = useRef<string[]>([]);
  const prevAgentStatusRef = useRef<string>("idle");

  const fetchNews = useCallback(async (tickers: string[]) => {
    setLoadingNews(Object.fromEntries(tickers.map((t) => [t, true])));
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
          // includes AbortError — silently ignore per-ticker failures
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
      const tickerSet = new Set(tickers.map((t) => t.toUpperCase()));
      const byTicker: Record<string, CongressTrade[]> = {};
      for (const trade of trades) {
        if (tickerSet.has(trade.ticker)) {
          if (!byTicker[trade.ticker]) byTicker[trade.ticker] = [];
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
      const tickers = data.map((p) => p.ticker);
      heldTickersRef.current = tickers;
      await Promise.all([fetchNews(tickers), fetchCongress(tickers)]);
    } catch (err) {
      console.error("[dashboard] refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNews, fetchCongress]);

  // Merge agent verdicts into news state without a server round-trip
  const mergeAgentResults = useCallback((progress: AgentProgress) => {
    if (!progress.results) return;
    setNews((prev) => {
      const updated = { ...prev };
      for (const { ticker, verdicts } of progress.results!.tickerResults) {
        if (!updated[ticker]) continue;
        updated[ticker] = updated[ticker].map((story) => {
          const match = verdicts.find((v) => v.url === story.url || v.headline === story.headline);
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

  // Poll agent progress
  const pollAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/run");
      if (!res.ok) return;
      const data: AgentProgress = await res.json();

      const wasRunning = prevAgentStatusRef.current === "running";
      const justCompleted = wasRunning && data.status === "complete";
      prevAgentStatusRef.current = data.status;

      setAgentState(data);
      if (justCompleted) mergeAgentResults(data);

      // Reschedule at appropriate rate for current status
      const desiredRate = data.status === "running" ? AGENT_POLL_MS_ACTIVE : AGENT_POLL_MS_IDLE;
      if (desiredRate !== agentPollRateRef.current) {
        agentPollRateRef.current = desiredRate;
        if (agentIntervalRef.current) clearInterval(agentIntervalRef.current);
        agentIntervalRef.current = setInterval(pollAgent, desiredRate);
      }
    } catch {
      // ignore
    }
  }, [mergeAgentResults]);

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

  return (
    <>
      <div className="hidden md:block">
        <DesktopDashboard
          positions={positions}
          news={news}
          congressTrades={congressTrades}
          loadingNews={loadingNews}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
          agentState={agentState}
          totalValue={positions.length > 0 ? positions.reduce((sum, p) => sum + p.marketValue, 0) : undefined}
          totalCostBasis={positions.length > 0 ? positions.reduce((sum, p) => sum + p.pricePaid * p.quantity, 0) : undefined}
          totalGainLoss={totalGainLoss}
          cashBalance={cashBalance}
        />
      </div>
      <div className="block md:hidden">
        <MobileDashboard
          positions={positions}
          news={news}
          loadingNews={loadingNews}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      </div>
    </>
  );
}
