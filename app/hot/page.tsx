"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopBar from "@/components/TopBar";
import NewsCard from "@/components/NewsCard";
import CongressTradeCard from "@/components/CongressTradeCard";
import type { CongressTrade, ClassifiedStory } from "@/types/news.types";
import type { HotTicker } from "@/types/market-data.types";

const HOT_POLL_MS = 5 * 60 * 1000;    // 5 minutes
const CONGRESS_POLL_MS = 60 * 1000;   // 1 minute
const LS_KEY = "pulse_last_seen_congress_at";

function ChangeBar({ pct }: { pct: number }) {
  const abs = Math.min(Math.abs(pct), 20); // cap visual at 20%
  const positive = pct >= 0;
  return (
    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${(abs / 20) * 100}%`,
          backgroundColor: positive ? "#00FF88" : "#FF4444",
          boxShadow: positive ? "0 0 6px rgba(0,255,136,0.4)" : "0 0 6px rgba(255,68,68,0.4)",
        }}
      />
    </div>
  );
}

interface TickerRowProps {
  ticker: HotTicker;
  expanded: boolean;
  onClick: () => void;
  news: ClassifiedStory[];
  loadingNews: boolean;
}

function TickerRow({ ticker, expanded, onClick, news, loadingNews }: TickerRowProps) {
  const positive = ticker.changePercent >= 0;
  const changeStr = `${positive ? "+" : ""}${ticker.changePercent.toFixed(2)}%`;
  const priceStr = `$${ticker.currentPrice.toFixed(2)}`;

  return (
    <motion.div layout className="rounded-[10px] overflow-hidden border border-white/5 bg-black/30">
      <button
        onClick={onClick}
        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-white/[0.03] transition-colors text-left"
      >
        {/* Rank / heat indicator */}
        <div className="shrink-0 w-1.5 h-8 rounded-full" style={{
          backgroundColor: positive ? "#00FF88" : "#FF4444",
          boxShadow: positive ? "0 0 8px rgba(0,255,136,0.5)" : "0 0 8px rgba(255,68,68,0.5)",
        }} />

        {/* Ticker + company */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[16px] font-black text-white tracking-tight">{ticker.ticker}</span>
            <span className={`font-mono text-[13px] font-bold ${positive ? "text-[#00FF88]" : "text-[#FF4444]"}`}>
              {changeStr}
            </span>
          </div>
          <div className="mt-1 w-full max-w-[200px]">
            <ChangeBar pct={ticker.changePercent} />
          </div>
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          <span className="font-mono text-[14px] text-slate-300">{priceStr}</span>
        </div>

        {/* Expand chevron */}
        <span
          className={`material-symbols-outlined text-[18px] text-slate-600 transition-transform duration-300 shrink-0 ${expanded ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="news"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-3">
              {loadingNews && (
                <div className="flex items-center gap-2 py-4 justify-center opacity-40">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span className="text-[11px] text-slate-500">Loading news…</span>
                </div>
              )}
              {!loadingNews && news.length === 0 && (
                <p className="text-[11px] text-slate-600 text-center py-4">No recent news</p>
              )}
              {news.slice(0, 5).map((story, i) => (
                <NewsCard key={`${story.url}-${i}`} story={story} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HotPage() {
  const [hotTickers, setHotTickers] = useState<HotTicker[]>([]);
  const [congressTrades, setCongressTrades] = useState<CongressTrade[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [tickerNews, setTickerNews] = useState<Record<string, ClassifiedStory[]>>({});
  const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});
  const [loadingHot, setLoadingHot] = useState(true);

  const hotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const congressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Record last-seen on mount + clear badge
  useEffect(() => {
    const seen = Number(localStorage.getItem(LS_KEY) ?? "0");
    setLastSeenAt(seen);
    localStorage.setItem(LS_KEY, String(Date.now()));
  }, []);

  const fetchHot = useCallback(async () => {
    try {
      const res = await fetch("/api/hot");
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
      const res = await fetch("/api/congress");
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

  const handleTickerClick = useCallback(async (ticker: string) => {
    setExpandedTicker((prev) => {
      if (prev === ticker) return null;
      return ticker;
    });

    if (!tickerNews[ticker] && !loadingNews[ticker]) {
      setLoadingNews((prev) => ({ ...prev, [ticker]: true }));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50_000);
      try {
        const res = await fetch(`/api/news?ticker=${ticker}`, { signal: controller.signal });
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
  }, [tickerNews, loadingNews]);

  const newCongressCount = congressTrades.filter((t) => t.tradeDate * 1000 > lastSeenAt).length;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopBar lastUpdated={null} refreshing={false} onRefresh={() => { fetchHot(); fetchCongress(); }} />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-10">

        {/* Trending Stocks */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[22px] text-orange-400">local_fire_department</span>
            <h2 className="font-['Space_Grotesk'] text-[18px] font-black text-white tracking-tight">
              Trending Stocks
            </h2>
            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">Today</span>
          </div>

          {loadingHot && (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-[10px] bg-white/[0.03] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          )}

          <AnimatePresence>
            <motion.div className="space-y-2">
              {hotTickers.map((t) => (
                <TickerRow
                  key={t.ticker}
                  ticker={t}
                  expanded={expandedTicker === t.ticker}
                  onClick={() => handleTickerClick(t.ticker)}
                  news={tickerNews[t.ticker] ?? []}
                  loadingNews={loadingNews[t.ticker] ?? false}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Congress Trades */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[22px]" style={{ color: "#b45309" }}>gavel</span>
            <h2 className="font-['Space_Grotesk'] text-[18px] font-black text-white tracking-tight">
              Global Congress Feed
            </h2>
            {newCongressCount > 0 && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider animate-pulse">
                {newCongressCount} NEW
              </span>
            )}
            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold ml-auto">
              via Capitol Trades · refreshes every 60s
            </span>
          </div>

          {congressTrades.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 opacity-30">
              <span className="material-symbols-outlined text-4xl">gavel</span>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">No recent trades</p>
            </div>
          )}

          <div className="space-y-2">
            {congressTrades.map((trade) => (
              <CongressTradeCard
                key={trade.id}
                trade={trade}
                isNew={trade.tradeDate * 1000 > lastSeenAt}
              />
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
