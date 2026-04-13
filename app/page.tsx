"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DesktopDashboard from "@/components/DesktopDashboard";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";

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
      const sortedData = [...data].sort((a, b) => b.marketValue - a.marketValue);
      setPositions(sortedData);
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
    <>
      <div className="hidden md:block">
        <DesktopDashboard
          positions={positions}
          news={news}
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
