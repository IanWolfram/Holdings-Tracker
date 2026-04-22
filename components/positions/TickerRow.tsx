import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ClassifiedStory } from "@/types/news.types";
import type { HotTicker } from "@/types/market-data.types";
import NewsCard from "@/components/NewsCard";
import EmptyState from "@/components/EmptyState";
import ChangeBar from "@/components/ui/ChangeBar";

interface TickerRowProps {
  ticker: HotTicker;
  expanded: boolean;
  onClick: () => void;
  news: ClassifiedStory[];
  loadingNews: boolean;
}

export default function TickerRow({ ticker, expanded, onClick, news, loadingNews }: TickerRowProps) {
  const positive = ticker.changePercent >= 0;
  const changeStr = `${positive ? "+" : ""}${ticker.changePercent.toFixed(2)}%`;
  const priceStr = `$${ticker.currentPrice.toFixed(2)}`;

  return (
    <motion.div layout className="rounded-[10px] overflow-hidden border border-white/5 bg-black/30">
      <button
        onClick={onClick}
        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div
          className="shrink-0 w-1.5 h-8 rounded-full"
          style={{
            backgroundColor: positive ? "#00FF88" : "#FF4444",
            boxShadow: positive
              ? "0 0 8px rgba(0,255,136,0.5)"
              : "0 0 8px rgba(255,68,68,0.5)",
          }}
        />

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

        <div className="text-right shrink-0">
          <span className="font-mono text-[14px] text-slate-300">{priceStr}</span>
        </div>

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
                <EmptyState
                  icon="progress_activity"
                  headline="Loading news…"
                  variant="loading"
                  className="py-4"
                />
              )}
              {!loadingNews && news.length === 0 && (
                <EmptyState
                  icon="candlestick_chart"
                  headline="No recent news"
                  sub="Refresh or check back later"
                  variant="neutral"
                  className="py-4"
                />
              )}
              {news.slice(0, 5).map((story, index) => (
                <NewsCard key={`${story.url}-${index}`} story={story} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
