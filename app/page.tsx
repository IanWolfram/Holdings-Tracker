"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import PositionCard from "@/components/PositionCard";
import type { Position } from "@/lib/etrade";
import type { ClassifiedStory } from "@/lib/news";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [news, setNews] = useState<Record<string, ClassifiedStory[]>>({});
  const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNews = useCallback(async (tickers: string[]) => {
    setLoadingNews(Object.fromEntries(tickers.map((t) => [t, true])));
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const res = await fetch(`/api/news?ticker=${ticker}`);
          if (!res.ok) return;
          const data: ClassifiedStory[] = await res.json();
          setNews((prev) => ({ ...prev, [ticker]: data }));
        } catch {
          // silently ignore per-ticker failures
        } finally {
          setLoadingNews((prev) => ({ ...prev, [ticker]: false }));
        }
      })
    );
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/positions");
      if (!res.ok) throw new Error(`Positions fetch failed: ${res.status}`);
      const data: Position[] = await res.json();
      setPositions(data);
      setLastUpdated(new Date());
      await fetchNews(data.map((p) => p.ticker));
    } catch (err) {
      console.error("[dashboard] refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNews]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return (
    <div className="min-h-screen flex flex-col bg-[#111317]">
      <TopBar lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} />
      <main className="p-6">
        {positions.length === 0 && !refreshing && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-700">candlestick_chart</span>
            <p className="text-sm text-slate-500">No positions loaded.</p>
            <button
              onClick={refresh}
              className="text-[10px] uppercase tracking-widest text-slate-400 border border-white/10 px-3 py-1 rounded-sm hover:bg-white/5 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {positions.map((pos) => (
            <PositionCard
              key={pos.ticker}
              position={pos}
              stories={news[pos.ticker] ?? []}
              loading={loadingNews[pos.ticker] ?? false}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
