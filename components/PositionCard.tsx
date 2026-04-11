"use client";

import { useState } from "react";
import NewsItem from "./NewsItem";
import type { Position } from "@/lib/etrade";
import type { ClassifiedStory } from "@/lib/news";

const PREVIEW_COUNT = 3;

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

  const { ticker, marketValue, gainLoss, quantity } = position;

  const buy  = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;
  const total = buy + sell + hold || 1;

  const gainPositive = gainLoss >= 0;
  const gainStr = `${gainPositive ? "▲ +" : "▼ "}$${Math.abs(gainLoss).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const mvStr = `$${marketValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const gainPct = position.pricePaid > 0
    ? ((position.currentPrice - position.pricePaid) / position.pricePaid) * 100
    : 0;
  const isHot = gainPct > 10;

  const visibleStories = expanded ? stories : stories.slice(0, PREVIEW_COUNT);
  const hiddenCount = stories.length - PREVIEW_COUNT;

  return (
    <section className="bg-[#1e2023] rounded-lg overflow-hidden flex flex-col border border-white/5 hover:border-white/20 transition-colors group">
      {/* Card header with glow */}
      <div
        className={`p-4 bg-[#282a2d] flex justify-between items-start ticker-header-glow ${glowClass(buy, sell, loading)}`}
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-['JetBrains_Mono'] text-xl font-bold text-[#e2e2e6]">{ticker}</h2>
            {isHot && (
              <span className="bg-white text-black text-[8px] font-black px-1 rounded-sm">HOT</span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">{quantity} shares</p>
        </div>
        <div className="text-right">
          <p className="font-['JetBrains_Mono'] text-lg font-bold text-[#e2e2e6]">{mvStr}</p>
          <p className={`font-['JetBrains_Mono'] text-xs font-medium ${gainPositive ? "text-[#22c55e]" : "text-[#f43f5e]"}`}>
            {gainStr}
          </p>
        </div>
      </div>

      {/* Verdict bar */}
      <div className="px-4 py-2 border-y border-white/5 flex gap-1 items-center bg-[#1a1c1f]">
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

      {/* News feed */}
      <div className="flex-1 p-4 space-y-4">
        {loading && stories.length === 0 && <LoadingSkeleton />}

        {!loading && stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-700">info</span>
            <p className="text-xs text-slate-500 font-medium">No news found in the last 3 days</p>
          </div>
        )}

        {visibleStories.map((story, i) => (
          <NewsItem key={`${story.url}-${i}`} story={story} />
        ))}
      </div>

      {/* Expand / collapse toggle */}
      {stories.length > PREVIEW_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex flex-col items-center gap-0.5 py-3 border-t border-white/5 bg-[#1a1c1f] hover:bg-white/5 transition-colors group/toggle"
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
