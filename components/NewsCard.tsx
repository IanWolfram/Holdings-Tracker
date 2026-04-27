"use client";

import type { ClassifiedStory } from "@/types/news.types";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import {
  CARD_RADIUS,
  REVEAL_EASE,
  HOVER_EXPAND_DELAY,
  getSourceColor,
} from "@/lib/utils/newsCardAnimations";
import NewsCardAiPanel from "@/components/news/NewsCardAiPanel";
import { FinnhubBadge, RedditBadge, XBadge } from "./mediabadges";
import GlassView from "./ui/LiquidGlass/GlassView";

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
}: {
  story: ClassifiedStory;
  isAnalyzed?: boolean;
}) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duplicates = story.duplicates ?? [];

  useEffect(() => {
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    setHovered(true);
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    expandTimerRef.current = setTimeout(() => {
      setExpanded(true);
      expandTimerRef.current = null;
    }, HOVER_EXPAND_DELAY * 1000);
  };

  const handleMouseLeave = () => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    setHovered(false);
    setExpanded(false);
  };

  const activeVerdict = story.verdict;
  const activeConfidence = story.confidence;
  const activeReason = story.reason;
  const activeIsAnalyzed = isAnalyzed;

  const color = VERDICT_COLOR[activeVerdict] ?? "#64748b";
  const verdictBg = VERDICT_BG[activeVerdict] ?? "rgba(100,116,139,0.08)";
  const confidence = Math.round((activeConfidence ?? 0) * 100);

  const isSeconds = story.datetime && story.datetime < 10000000000;
  const timestampMs = isSeconds ? story.datetime * 1000 : story.datetime;
  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(timestampMs), { addSuffix: true })
    : "";

  const sourceColor = getSourceColor(story.source);

  return (
    <GlassView
      layout
      layoutId={id}
      interactive
      cornerRadius={CARD_RADIUS}
      className="relative cursor-pointer group/item rounded-[8px]"
      style={{ color }}
      onClick={() => window.open(story.url, "_blank")}
    >
      <div
        className="p-2 relative"
        data-hovered={hovered ? "true" : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Corner brackets */}
        <span className="news-cap news-cap-top-left" />
        <span className="news-cap news-cap-top-right" />
        <span className="news-cap news-cap-bottom-left" />
        <span className="news-cap news-cap-bottom-right" />

        {/* Animated edge fills — also act as a 1s hover timer that fills to the edges before the AI panel expands */}
        <motion.span
          className="news-edge news-edge-top"
          initial={false}
          animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0.4 }}
          transition={{ duration: hovered ? HOVER_EXPAND_DELAY : 0.2, ease: "linear" }}
        />
        <motion.span
          className="news-edge news-edge-bottom"
          initial={false}
          animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0.4 }}
          transition={{ duration: hovered ? HOVER_EXPAND_DELAY : 0.2, ease: "linear" }}
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
              {duplicates.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDuplicates((v) => !v);
                  }}
                  aria-expanded={showDuplicates}
                  aria-label={`${duplicates.length} similar coverage stories`}
                  className="ml-1 px-1.5 py-[1px] rounded-full text-[9.5px] font-bold tracking-wide tabular-nums transition-colors hover:bg-white/[0.06]"
                  style={{
                    color: sourceColor,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: `1px solid ${sourceColor}33`,
                  }}
                >
                  +{duplicates.length} similar
                </button>
              )}
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
                    filter: hovered ? `drop-shadow(0 0 2px ${sourceColor})` : "none",
                  }}
                />
              </svg>
            </motion.div>
          </div>

          {/* AI panel — expands after a 1s hover, gated by the edge timer */}
          <NewsCardAiPanel
            hovered={expanded}
            color={color}
            activeIsAnalyzed={activeIsAnalyzed}
            activeVerdict={activeVerdict}
            verdictBg={verdictBg}
            confidence={confidence}
            activeReason={activeReason}
          />

          <AnimatePresence initial={false}>
            {showDuplicates && duplicates.length > 0 && (
              <motion.div
                key="duplicates"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: REVEAL_EASE }}
                className="overflow-hidden"
              >
                <div
                  className="mt-2 pt-2 space-y-1.5 border-t"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                    Similar coverage
                  </div>
                  {duplicates.map((d) => {
                    const dIsSeconds = d.datetime && d.datetime < 10000000000;
                    const dMs = dIsSeconds ? d.datetime * 1000 : d.datetime;
                    const dAgo = d.datetime
                      ? formatDistanceToNow(new Date(dMs), { addSuffix: true })
                      : "";
                    return (
                      <button
                        key={`${d.source}-${d.url}-${d.datetime}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(d.url, "_blank");
                        }}
                        className="w-full text-left flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
                      >
                        {d.source === "finnhub" ? (
                          <FinnhubBadge />
                        ) : d.source === "reddit" ? (
                          <RedditBadge author={d.author} />
                        ) : (
                          <XBadge author={d.author} />
                        )}
                        <span className="flex-1 text-[11px] text-slate-300 line-clamp-1">
                          {d.headline}
                        </span>
                        {dAgo && (
                          <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                            {dAgo}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GlassView>
  );
}
