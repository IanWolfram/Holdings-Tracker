"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopBar from "@/components/layout/TopBar";
import CongressTradeCard from "@/components/cards/CongressTradeCard";
import EmptyState from "@/components/layout/EmptyState";
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
    <div className="flex flex-col bg-surface min-h-screen lg:h-screen lg:overflow-hidden">
      <TopBar lastUpdated={null} refreshing={false} onRefresh={() => { fetchHot(); fetchCongress(); }} />

      {/* Two columns on desktop — Trending (hot) left, Congress right — each
          scrolls internally so both lists stay visible without page scroll. */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 lg:min-h-0">
        <div className="flex flex-col lg:flex-row lg:justify-center gap-6 lg:gap-10 lg:h-full lg:min-h-0">

          {/* LEFT — Trending Stocks */}
          <section className="flex flex-col lg:min-h-0 lg:w-[340px] shrink-0">
            <button
              onClick={() => setTrendingCollapsed((v) => !v)}
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

            <AnimatePresence initial={false}>
              {!trendingCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1"
                >
                  {loadingHot && (
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 rounded-[10px] bg-white/[0.03] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 max-w-[340px]">
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

          {/* RIGHT — Insider & Political Intelligence */}
          <section className="flex flex-col lg:min-h-0 lg:w-[340px] shrink-0">
            <button
              onClick={() => setInsidersCollapsed((v) => !v)}
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

            <AnimatePresence initial={false}>
              {!insidersCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1"
                >
                  <div className="flex items-center gap-2 mb-3 -mt-1 ml-9">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">
                      via House Clerk &amp; Senate eFD · official filings
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

                  <div className="space-y-2 max-w-[340px]">
                    {congressTrades.map((trade) => (
                      <CongressTradeCard
                        key={trade.id}
                        trade={trade}
                        isNew={trade.tradeDate * 1000 > lastSeenAt}
                        showCompany
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

        </div>
      </main>
    </div>
  );
}
