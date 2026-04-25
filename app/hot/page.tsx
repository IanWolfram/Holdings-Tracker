"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopBar from "@/components/TopBar";
import CongressTradeCard from "@/components/CongressTradeCard";
import EmptyState from "@/components/EmptyState";
import TickerRow from "@/components/positions/TickerRow";
import { useHotTickers } from "@/hooks/useHotTickers";

export default function HotPage() {
  const {
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
  } = useHotTickers();
  const [trendingCollapsed, setTrendingCollapsed] = useState(false);
  const [insidersCollapsed, setInsidersCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopBar lastUpdated={null} refreshing={false} onRefresh={() => { fetchHot(); fetchCongress(); }} />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-10">

        {/* Trending Stocks */}
        <section>
          <button 
            onClick={() => setTrendingCollapsed(!trendingCollapsed)}
            className="flex items-center gap-3 mb-4 w-full group"
          >
            <span className="material-symbols-outlined text-[20px] text-orange-400 group-hover:scale-110 transition-transform">local_fire_department</span>
            <h2 className="font-['Space_Grotesk'] text-[18px] font-black text-white tracking-tight">
              Trending Stocks
            </h2>
            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">Today</span>
            <span className={`material-symbols-outlined text-[18px] text-slate-700 ml-auto transition-transform duration-300 ${trendingCollapsed ? "" : "rotate-180"}`}>
              expand_more
            </span>
          </button>

          <AnimatePresence>
            {!trendingCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                {loadingHot && (
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-14 rounded-[10px] bg-white/[0.03] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
                    ))}
                  </div>
                )}

                <div className="space-y-2">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Insider & Political Intelligence */}
        <section>
          <button 
            onClick={() => setInsidersCollapsed(!insidersCollapsed)}
            className="flex items-center gap-3 mb-4 w-full group text-left"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform" style={{ color: "#b45309" }}>gavel</span>
            <h2 className="font-['Space_Grotesk'] text-[18px] font-black text-white tracking-tight">
              Insider & Political Intelligence
            </h2>
            {newCongressCount > 0 && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider animate-pulse">
                {newCongressCount} NEW
              </span>
            )}
            <span className={`material-symbols-outlined text-[18px] text-slate-700 ml-auto transition-transform duration-300 ${insidersCollapsed ? "" : "rotate-180"}`}>
              expand_more
            </span>
          </button>

          <AnimatePresence>
            {!insidersCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-3 -mt-1 ml-9">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">
                    via Finnhub & Capitol Trades · refreshes every 60s
                  </span>
                </div>

                {congressTrades.length === 0 && (
                  <EmptyState
                    icon="gavel"
                    headline="No recent trades"
                    sub="The halls of Congress are silent"
                    variant="congress"
                    className="py-12"
                  />
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
              </motion.div>
            )}
          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}
