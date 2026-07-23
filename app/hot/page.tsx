"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopBar from "@/components/layout/TopBar";
import CongressTradeCard from "@/components/cards/CongressTradeCard";
import EmptyState from "@/components/layout/EmptyState";
import TickerRow from "@/components/positions/TickerRow";
import { useHotTickers } from "@/hooks/useHotTickers";
import { useTrackedPoliticians } from "@/hooks/useTrackedPoliticians";
import { fetchCongressTradesByPolitician } from "@/lib/api/congress-client";
import type { CongressTrade } from "@/types/news.types";

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
  const [politicianSearch, setPoliticianSearch] = useState("");
  const { tracked, addTracked, removeTracked, isTracked } = useTrackedPoliticians();

  const politicianQuery = politicianSearch.trim().toLowerCase();
  // Server-side search results for the typed politician. The recent feed only
  // holds the latest ~60 filings, so a tracked person whose trades predate that
  // window (e.g. Nancy Pelosi) won't appear without querying the DB by name.
  const [searchResults, setSearchResults] = useState<CongressTrade[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = politicianSearch.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const results = await fetchCongressTradesByPolitician(q);
      if (!cancelled) {
        setSearchResults(results);
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [politicianSearch]);

  const visibleTrades = useMemo(() => {
    if (!politicianQuery) return congressTrades;
    // Prefer DB results; fall back to an instant local filter of the recent feed
    // while the debounced server query is still in flight.
    if (searchResults) return searchResults;
    return congressTrades.filter((t) => t.politician.toLowerCase().includes(politicianQuery));
  }, [congressTrades, politicianQuery, searchResults]);

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
              className="flex items-center gap-2.5 mb-4 w-full group text-left"
            >
              <span className="material-symbols-outlined text-[20px] shrink-0 group-hover:scale-110 transition-transform" style={{ color: "#b45309" }}>gavel</span>
              <h2 className="font-['Space_Grotesk'] text-[18px] font-black text-white tracking-tight whitespace-nowrap shrink-0">
                Political Intelligence
              </h2>
              {newCongressCount > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider animate-pulse shrink-0">
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
                  {/* Saved politician watchlist — tap a badge to filter to that person */}
                  {tracked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5 max-w-[340px]">
                      {tracked.map((name) => {
                        const active = politicianQuery === name.toLowerCase();
                        return (
                          <span
                            key={name}
                            onClick={() => setPoliticianSearch(active ? "" : name)}
                            className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition-colors ${
                              active
                                ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
                                : "bg-white/[0.04] text-slate-300 border-white/10 hover:border-amber-500/30 hover:text-amber-100"
                            }`}
                          >
                            {name}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTracked(name);
                                if (active) setPoliticianSearch("");
                              }}
                              aria-label={`Stop tracking ${name}`}
                              className="material-symbols-outlined text-[12px] leading-none text-slate-500 hover:text-red-400"
                            >
                              close
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Search politicians + save current name to the watchlist */}
                  <div className="flex items-center gap-1.5 mb-3 max-w-[340px] rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 focus-within:border-amber-500/40 transition-colors">
                    <span className="material-symbols-outlined text-[15px] text-slate-500 shrink-0">search</span>
                    <input
                      value={politicianSearch}
                      onChange={(e) => setPoliticianSearch(e.target.value)}
                      placeholder="Search politician…"
                      className="flex-1 min-w-0 bg-transparent text-[12px] text-slate-200 placeholder:text-slate-600 outline-none"
                    />
                    {politicianSearch && (
                      <button
                        onClick={() => setPoliticianSearch("")}
                        aria-label="Clear search"
                        className="material-symbols-outlined text-[14px] text-slate-500 hover:text-slate-300 shrink-0"
                      >
                        close
                      </button>
                    )}
                    <button
                      onClick={() => addTracked(politicianSearch)}
                      disabled={!politicianSearch.trim() || isTracked(politicianSearch)}
                      title={isTracked(politicianSearch) ? "Already tracking" : "Track this name"}
                      aria-label="Track this politician"
                      className="material-symbols-outlined text-[16px] text-amber-400 hover:text-amber-300 disabled:opacity-30 disabled:cursor-default shrink-0"
                    >
                      {isTracked(politicianSearch) ? "bookmark_added" : "bookmark_add"}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-3 ml-9">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">
                      via House Clerk &amp; Senate eFD · official filings
                    </span>
                  </div>

                  {searchLoading && visibleTrades.length === 0 && (
                    <EmptyState
                      icon="progress_activity"
                      headline="Searching filings…"
                      variant="loading"
                      className="py-12"
                    />
                  )}

                  {!searchLoading && visibleTrades.length === 0 && (
                    <EmptyState
                      icon="gavel"
                      headline={politicianQuery ? "No matching trades" : "No recent trades"}
                      sub={
                        politicianQuery
                          ? `No filings for "${politicianSearch.trim()}"`
                          : "The halls of Congress are silent"
                      }
                      variant="congress"
                      className="py-12"
                    />
                  )}

                  <div className="space-y-2 max-w-[340px]">
                    {visibleTrades.map((trade) => (
                      <CongressTradeCard
                        key={trade.id}
                        trade={trade}
                        isNew={(trade.ingestedAt ?? 0) * 1000 > lastSeenAt}
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
