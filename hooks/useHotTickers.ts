import { useCallback, useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { CongressTrade, ClassifiedStory } from "@/types/news.types";
import type { HotTicker } from "@/types/market-data.types";

const HOT_POLL_MS = 5 * 60 * 1000;
const CONGRESS_POLL_MS = 60 * 1000;
const LS_KEY = "pulse_last_seen_congress_at";

export function useHotTickers() {
  const [hotTickers, setHotTickers] = useState<HotTicker[]>([]);
  const [congressTrades, setCongressTrades] = useState<CongressTrade[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [tickerNews, setTickerNews] = useState<Record<string, ClassifiedStory[]>>({});
  const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});
  const [loadingHot, setLoadingHot] = useState(true);

  const hotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const congressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const seen = Number(localStorage.getItem(LS_KEY) ?? "0");
    setLastSeenAt(seen);
    localStorage.setItem(LS_KEY, String(Date.now()));
  }, []);

  const fetchHot = useCallback(async () => {
    try {
      const res = await authedFetch("/api/hot");
      if (!res.ok) return;
      const data: { tickers: HotTicker[] } = await res.json();
      setHotTickers(data.tickers);
    } catch {
      // ignore
    } finally {
      setLoadingHot(false);
    }
  }, []);

  const fetchCongress = useCallback(async () => {
    try {
      const res = await authedFetch("/api/congress");
      if (!res.ok) return;
      const { trades }: { trades: CongressTrade[] } = await res.json();
      setCongressTrades(trades);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchHot();
    fetchCongress();
    hotIntervalRef.current = setInterval(fetchHot, HOT_POLL_MS);
    congressIntervalRef.current = setInterval(fetchCongress, CONGRESS_POLL_MS);
    return () => {
      if (hotIntervalRef.current) clearInterval(hotIntervalRef.current);
      if (congressIntervalRef.current) clearInterval(congressIntervalRef.current);
    };
  }, [fetchHot, fetchCongress]);

  const handleTickerClick = useCallback(
    async (ticker: string) => {
      setExpandedTicker((prev) => {
        if (prev === ticker) return null;
        return ticker;
      });

      if (!tickerNews[ticker] && !loadingNews[ticker]) {
        setLoadingNews((prev) => ({ ...prev, [ticker]: true }));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 50_000);
        try {
          const res = await authedFetch(`/api/news?ticker=${ticker}`, { signal: controller.signal });
          if (res.ok) {
            const data: ClassifiedStory[] = await res.json();
            setTickerNews((prev) => ({ ...prev, [ticker]: data }));
          }
        } catch {
          // includes AbortError
        } finally {
          clearTimeout(timer);
          setLoadingNews((prev) => ({ ...prev, [ticker]: false }));
        }
      }
    },
    [tickerNews, loadingNews]
  );

  const newCongressCount = congressTrades.filter((trade) => trade.tradeDate * 1000 > lastSeenAt).length;

  return {
    hotTickers,
    congressTrades,
    lastSeenAt,
    expandedTicker,
    tickerNews,
    loadingNews,
    loadingHot,
    newCongressCount,
    fetchHot,
    fetchCongress,
    handleTickerClick,
  };
}
