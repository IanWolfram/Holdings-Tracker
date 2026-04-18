"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DesktopDashboard from "@/components/DesktopDashboard";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";

const CONGRESS_POLL_MS = 60_000; // 1 minute

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [news, setNews] = useState<Record<string, ClassifiedStory[]>>({});
  const [congressTrades, setCongressTrades] = useState<Record<string, CongressTrade[]>>({});
  const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const congressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldTickersRef = useRef<string[]>([]);

  const fetchNews = useCallback(async (tickers: string[]) => {
    setLoadingNews(Object.fromEntries(tickers.map((t) => [t, true])));
    await Promise.all(
      tickers.map(async (ticker) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 50_000);
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
      const res = await fetch("/api/positions");
      if (!res.ok) throw new Error(`Positions fetch failed: ${res.status}`);
      const data: Position[] = await res.json();
      const sortedData = [...data].sort((a, b) => b.marketValue - a.marketValue);
      setPositions(sortedData);
      setLastUpdated(new Date());
      const tickers = data.map((p) => p.ticker);
      heldTickersRef.current = tickers;
      await Promise.all([fetchNews(tickers), fetchCongress(tickers)]);
    } catch (err) {
      console.error("[dashboard] refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNews, fetchCongress]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  // Poll congress trades independently every minute
  useEffect(() => {
    congressIntervalRef.current = setInterval(() => {
      fetchCongress(heldTickersRef.current);
    }, CONGRESS_POLL_MS);
    return () => {
      if (congressIntervalRef.current) clearInterval(congressIntervalRef.current);
    };
  }, [fetchCongress]);

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
