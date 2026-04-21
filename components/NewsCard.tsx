"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import GlassView from "./ui/LiquidGlass/GlassView";
import { FinnhubBadge, XBadge, RedditBadge } from "./mediabadges";
import type { ClassifiedStory } from "@/types/news.types";

const R = 8;
const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const GROW_DURATION = 0.5;

const VERDICT_COLOR: Record<string, string> = {
  BUY: "#00FF88",
  SELL: "#FF4444",
  HOLD: "#64748b",
};

const VERDICT_BG: Record<string, string> = {
  BUY: "rgba(0,255,136,0.08)",
  SELL: "rgba(255,68,68,0.08)",
  HOLD: "rgba(100,116,139,0.08)",
};

export default function NewsCard({ 
  story, 
  isAnalyzed = false,
  onAnalyze
}: { 
  story: ClassifiedStory;
  isAnalyzed?: boolean;
  onAnalyze?: (ticker: string, headline: string, summary: string) => void;
}) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [hovered, setHovered] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnalyzed || analyzing || !onAnalyze) return;
    setAnalyzing(true);
    try {
      await onAnalyze(story.ticker, story.headline, story.summary ?? "");
    } finally {
      setAnalyzing(false);
    }
  };

  const color = VERDICT_COLOR[story.verdict] ?? "#64748b";
  const verdictBg = VERDICT_BG[story.verdict] ?? "rgba(100,116,139,0.08)";
  const confidence = Math.round((story.confidence ?? 0) * 100);

  // Auto-detect if timestamp is in seconds (10 digits) or ms (13 digits) to prevent wildly futuristic dates
  const isSeconds = story.datetime && story.datetime < 10000000000;
  const timestampMs = isSeconds ? story.datetime * 1000 : story.datetime;

  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(timestampMs), { addSuffix: true })
    : "";

  return (
    <GlassView
      layout
      layoutId={id}
      interactive
      cornerRadius={R}
      className="relative cursor-pointer group/item rounded-[8px]"
      style={{ color }}
      onClick={() => window.open(story.url, "_blank")}
    >
      <div
        className="p-2 relative"
        data-hovered={hovered ? "true" : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Corner brackets */}
        <span className="news-cap news-cap-top-left" />
        <span className="news-cap news-cap-top-right" />
        <span className="news-cap news-cap-bottom-left" />
        <span className="news-cap news-cap-bottom-right" />

        {/* Animated edge fills */}
        <motion.span
          className="news-edge news-edge-top"
          initial={false}
          animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0.4 }}
          transition={{ duration: GROW_DURATION, ease: REVEAL_EASE }}
        />
        <motion.span
          className="news-edge news-edge-bottom"
          initial={false}
          animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0.4 }}
          transition={{ duration: GROW_DURATION, ease: REVEAL_EASE, delay: 0.04 }}
        />

        {/* Headline + footer */}
        <div className="relative" style={{ zIndex: 2 }}>
          <p className="block text-[13px] font-semibold leading-snug line-clamp-2 text-white transition-colors">
            {story.headline}
          </p>

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              {story.source === "finnhub" ? (
                <FinnhubBadge />
              ) : story.source === "reddit" ? (
                <RedditBadge author={story.author} />
              ) : (
                <XBadge author={story.author} />
              )}
              {timeAgo && <span>{timeAgo}</span>}
            </div>
            <motion.div
              className="flex items-center justify-center relative w-[24px] h-[24px]"
              animate={{ rotate: hovered ? -45 : 0, scale: hovered ? 1.1 : 1 }}
              transition={{ duration: 0.4, ease: REVEAL_EASE }}
            >
              <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full overflow-visible">
                <path
                  d="M 4 12 H 20 M 14 6 L 20 12 L 14 18"
                  fill="none"
                  stroke={
                    hovered
                      ? story.source === "finnhub" ? "#00FF88"
                      : story.source === "reddit" ? "#FF4500"
                      : "#ffffff"
                      : "#64748b"
                  }
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    opacity: hovered ? 1 : 0.4,
                    filter: hovered ? "drop-shadow(0 0 2px currentColor)" : "none",
                  }}
                />
              </svg>
            </motion.div>
          </div>

          {/* AI overview — expands inline on hover, pushes nothing out of view */}
          <AnimatePresence initial={false}>
            {hovered && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: REVEAL_EASE }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="mt-2 rounded-md p-2 border border-white/[0.06]"
                  style={{ background: "rgba(10,12,18,0.7)" }}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        AI Analysis
                      </span>
                      {isAnalyzed && (
                        <span className="text-[8px] font-black bg-white/10 text-white px-1 rounded-[2px] tracking-tighter">
                          M5 VERIFIED
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: verdictBg, color }}
                    >
                      {story.verdict}
                    </span>
                  </div>

                  {/* Confidence bar + Analyze Action */}
                  <div className="mb-1.5 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-500">Confidence</span>
                        <span className="font-mono text-[9px]" style={{ color }}>
                          {confidence}%
                        </span>
                      </div>
                      <div className="h-0.5 w-full rounded-full bg-white/5">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${confidence}%` }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reasoning */}
                  {story.reason ? (
                    <p className="text-[10px] text-slate-400 leading-snug">
                      {story.reason}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-600 italic">No reasoning provided</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GlassView>
  );
}
