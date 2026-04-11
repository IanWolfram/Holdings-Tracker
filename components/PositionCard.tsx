"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NewsCard from "./NewsCard";
import GlassContainer from "./ui/LiquidGlass/GlassContainer";
import GlassView from "./ui/LiquidGlass/GlassView";
import { NEWS_PREVIEW_COUNT } from "@/lib/constants";
import { formatCurrency, formatPercent, formatGainLoss } from "@/lib/utils/format";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";

interface Props {
  position: Position;
  stories: ClassifiedStory[];
  loading: boolean;
}

function glowClass(buy: number, sell: number, loading: boolean): string {
  if (loading) return "glow-neutral";
  if (buy > sell) return "glow-positive";
  if (sell > buy) return "glow-negative";
  return "glow-neutral";
}

export default function PositionCard({ position, stories, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { ticker, description, marketValue, gainLoss, quantity, currentPrice, pricePaid } = position;

  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;
  const total = buy + sell + hold || 1;

  const gainPositive = gainLoss >= 0;
  const gainStr = formatGainLoss(gainLoss);

  const gainPct = pricePaid > 0 ? ((currentPrice - pricePaid) / pricePaid) * 100 : 0;
  const gainPctStr = formatPercent(gainPct);

  const mvStr = formatCurrency(marketValue);
  const priceStr = formatCurrency(currentPrice);

  const isHot = gainPct > 10;

  const visibleStories = expanded ? stories : stories.slice(0, NEWS_PREVIEW_COUNT);
  const hiddenCount = stories.length - NEWS_PREVIEW_COUNT;

  return (
    <section className="bg-surface rounded-lg overflow-hidden flex flex-col border border-white/5 hover:border-white/20 transition-colors group">
      {/* Card header with glow */}
      <div
        className={`p-3 bg-surface-container ticker-header-glow ${glowClass(buy, sell, loading)}`}
      >
        {/* Top Row: Symbol & Market Value */}
        <div className="flex justify-between items-end mb-1">
          <div className="flex items-center gap-2">
            <h2 className="font-['JetBrains_Mono'] text-2xl font-bold text-white tracking-tighter leading-none">{ticker}</h2>
            {isHot && (
              <span className="bg-[#f43f5e] text-white text-[8px] font-black px-1 rounded-sm animate-pulse">HOT</span>
            )}
          </div>
          <div className="text-right">
            <p className="font-['JetBrains_Mono'] text-xl font-bold text-white leading-none tracking-tight">{mvStr}</p>
          </div>
        </div>

        {/* Middle Row: Description & Current Price */}
        <div className="flex justify-between items-start mb-2">
          <p className="text-[11px] text-slate-400 font-medium truncate max-w-[140px]" title={description}>
            {description}
          </p>
          <div className="text-right">
            <p className="font-['JetBrains_Mono'] text-xs font-medium text-slate-300">
              {priceStr} <span className="text-[9px] text-slate-500 ml-0.5">/ SH</span>
            </p>
          </div>
        </div>

        {/* Bottom Row: P/L & Quantity */}
        <div className="flex justify-between items-center border-t border-white/5 pt-1.5">
          <div className={`flex items-baseline gap-1.5 font-['JetBrains_Mono'] ${gainPositive ? "text-[#22c55e]" : "text-[#f43f5e]"}`}>
            <span className="text-sm font-bold">{gainStr}</span>
            <span className="text-[10px] font-medium opacity-80">{gainPctStr}</span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            {quantity} <span className="opacity-60">shares</span>
          </p>
        </div>
      </div>

      {/* Verdict bar */}
      <div className="px-4 py-1.5 border-y border-white/5 flex gap-1 items-center bg-surface-container-low">
        {buy > 0 && (
          <div className="h-1.5 bg-[#22c55e] rounded-full" style={{ flex: buy }} title={`${buy} BUY`} />
        )}
        {sell > 0 && (
          <div className="h-1.5 bg-[#f43f5e] rounded-full" style={{ flex: sell }} title={`${sell} SELL`} />
        )}
        {hold > 0 && (
          <div className="h-1.5 bg-slate-600 rounded-full" style={{ flex: hold }} title={`${hold} HOLD`} />
        )}
        {total === 1 && !loading && (
          <div className="h-1.5 flex-1 bg-slate-800 rounded-full" />
        )}
        <span className="text-[10px] ml-2 text-slate-400 uppercase font-['JetBrains_Mono']">
          Verdict
        </span>
      </div>

      {/* News feed inside a Shared Glass Container */}
      <GlassContainer className="flex-1 p-3">
        <div className="space-y-3 relative">
          {loading && stories.length === 0 && <LoadingSkeleton />}

          {!loading && stories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-700">info</span>
              <p className="text-xs text-slate-500 font-medium">No news found in the last 3 days</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {visibleStories.map((story, i) => (
              <motion.div
                key={`${story.url}-${i}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="mb-3">
                  <NewsCard story={story} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </GlassContainer>

      {/* Expand / collapse toggle */}
      {stories.length > NEWS_PREVIEW_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex flex-col items-center gap-0.5 py-2 border-t border-white/5 bg-surface-container-low hover:bg-white/5 transition-colors group/toggle"
        >
          <span className="text-[10px] uppercase tracking-widest text-slate-500 group-hover/toggle:text-slate-300 transition-colors font-['Inter']">
            {expanded ? "Show less" : `${hiddenCount} more stories`}
          </span>
          <span
            className={`material-symbols-outlined text-[18px] text-slate-600 group-hover/toggle:text-slate-300 transition-all duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className={`space-y-2 animate-pulse ${i === 1 ? "opacity-60" : ""}`}>
          <div className="h-3 w-12 bg-slate-800 rounded-sm" />
          <div className="h-4 w-full bg-slate-700 rounded-sm" />
          <div className="h-4 w-3/4 bg-slate-700 rounded-sm" />
          <div className="h-2 w-20 bg-slate-800 rounded-sm mt-4" />
        </div>
      ))}
    </>
  );
}
