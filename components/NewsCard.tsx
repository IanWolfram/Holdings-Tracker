"use client";

import type { ClassifiedStory } from "@/types/news.types";
import type { UnifiedAnalysis } from "@/world-brain/brain";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useId, useRef, useState } from "react";
import { FinnhubBadge, RedditBadge, XBadge } from "./mediabadges";
import GlassView from "./ui/LiquidGlass/GlassView";

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
  const [analyzeHovered, setAnalyzeHovered] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState<UnifiedAnalysis | null>(null);
  const analyzeLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canAnalyze = !isAnalyzed && !analyzing && !deepAnalysis;

  const onAnalyzeEnter = () => {
    if (analyzeLeaveTimer.current) clearTimeout(analyzeLeaveTimer.current);
    setAnalyzeHovered(true);
  };
  const onAnalyzeLeave = () => {
    analyzeLeaveTimer.current = setTimeout(() => setAnalyzeHovered(false), 120);
  };

  const handleAnalyze = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canAnalyze) return;

    if (onAnalyze) {
      setAnalyzing(true);
      try {
        await onAnalyze(story.ticker, story.headline, story.summary ?? "");
      } finally {
        setAnalyzing(false);
      }
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: story.ticker,
          url: story.url,
          headline: story.headline,
          summary: story.summary ?? "",
        }),
      });
      if (res.ok) {
        const result: UnifiedAnalysis = await res.json();
        setDeepAnalysis(result);
      }
    } catch (err) {
      console.error("[NewsCard] Deep analyze failed:", err);
    } finally {
      setAnalyzing(false);
    }
  }, [canAnalyze, onAnalyze, story]);

  const activeVerdict = deepAnalysis?.verdict ?? story.verdict;
  const activeConfidence = deepAnalysis?.confidence ?? story.confidence;
  const activeReason = deepAnalysis?.reason ?? story.reason;
  const activeIsAnalyzed = isAnalyzed || !!deepAnalysis;

  const color = VERDICT_COLOR[activeVerdict] ?? "#64748b";
  const verdictBg = VERDICT_BG[activeVerdict] ?? "rgba(100,116,139,0.08)";
  const confidence = Math.round((activeConfidence ?? 0) * 100);

  const isSeconds = story.datetime && story.datetime < 10000000000;
  const timestampMs = isSeconds ? story.datetime * 1000 : story.datetime;
  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(timestampMs), { addSuffix: true })
    : "";

  const sourceColor =
    story.source === "finnhub" ? "#00FF88"
    : story.source === "reddit" ? "#FF4500"
    : "#ffffff";

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

            {/* Footer arrow — ↗ on hover */}
            <motion.div
              className="flex items-center justify-center relative w-[24px] h-[24px]"
              animate={{
                rotate: hovered ? -45 : 0,
                scale: hovered ? 1.1 : 1,
              }}
              transition={{ duration: 0.4, ease: REVEAL_EASE }}
            >
              <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full overflow-visible">
                <path
                  d="M 4 12 H 20 M 14 6 L 20 12 L 14 18"
                  fill="none"
                  stroke={hovered ? sourceColor : "#64748b"}
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

          {/* AI panel — expands on card hover */}
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
                <div className="mt-2">
                  {/* ── Deep Analysis trigger tab ── */}
                  <motion.div
                    className="overflow-hidden rounded-t-[4px] cursor-pointer select-none"
                    animate={{ height: analyzeHovered ? 36 : 5 }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    style={{
                      background: analyzeHovered ? `${color}18` : `${color}0d`,
                      borderTop: `1px solid ${color}${analyzeHovered ? "60" : "35"}`,
                      borderLeft: `1px solid ${color}${analyzeHovered ? "60" : "35"}`,
                      borderRight: `1px solid ${color}${analyzeHovered ? "60" : "35"}`,
                      transition: "background 0.18s, border-color 0.18s",
                    }}
                    onMouseEnter={onAnalyzeEnter}
                    onMouseLeave={onAnalyzeLeave}
                    onClick={handleAnalyze}
                  >
                    <AnimatePresence mode="wait">
                      {analyzing ? (
                        <motion.div
                          key="scanning"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 px-3 h-9"
                        >
                          <motion.div
                            className="w-2.5 h-2.5 rounded-full border-[1.5px] shrink-0"
                            style={{ borderColor: `${color}40`, borderTopColor: color }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                          />
                          <span className="font-mono text-[8px] font-black tracking-widest uppercase" style={{ color }}>
                            scanning
                          </span>
                        </motion.div>
                      ) : analyzeHovered ? (
                        <motion.div
                          key="label"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15, ease: REVEAL_EASE }}
                          className="flex items-center justify-between px-3 h-9"
                        >
                          <span
                            className="font-mono text-[9px] font-black tracking-[0.22em] uppercase"
                            style={{ color: canAnalyze ? color : "#475569" }}
                          >
                            {deepAnalysis ? "ANALYZED" : "DEEP ANALYSIS"}
                          </span>
                          {/* → arrow, faces right */}
                          <motion.svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4 shrink-0 overflow-visible"
                            animate={canAnalyze ? { x: [0, 3, 0] } : {}}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <path
                              d="M 4 12 H 20 M 14 6 L 20 12 L 14 18"
                              fill="none"
                              stroke={canAnalyze ? color : "#475569"}
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ filter: canAnalyze ? `drop-shadow(0 0 3px ${color})` : "none" }}
                            />
                          </motion.svg>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>

                  {/* ── AI Analysis box — square top corners, seamlessly joins trigger ── */}
                  <div
                    className="rounded-b-[4px] p-2"
                    style={{
                      background: "rgba(10,12,18,0.7)",
                      border: `1px solid rgba(255,255,255,0.06)`,
                      borderTop: `1px solid ${color}20`,
                    }}
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                          AI Analysis
                        </span>
                        {activeIsAnalyzed && (
                          <span className="text-[8px] font-black bg-white/10 text-white px-1 rounded-[2px] tracking-tighter">
                            {deepAnalysis ? "DEEP SCAN" : "M5 VERIFIED"}
                          </span>
                        )}
                      </div>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: verdictBg, color }}
                      >
                        {activeVerdict}
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="mb-1.5">
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

                    {/* Reasoning */}
                    {activeReason ? (
                      <p className="text-[10px] text-slate-400 leading-snug">{activeReason}</p>
                    ) : (
                      <p className="text-[10px] text-slate-600 italic">No reasoning provided</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GlassView>
  );
}
