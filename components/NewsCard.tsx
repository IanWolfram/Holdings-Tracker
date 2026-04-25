"use client";

import type { ClassifiedStory } from "@/types/news.types";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useId, useState } from "react";
import {
  CARD_RADIUS,
  REVEAL_EASE,
  GROW_DURATION,
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
          <NewsCardAiPanel
            hovered={hovered}
            color={color}
            activeIsAnalyzed={activeIsAnalyzed}
            activeVerdict={activeVerdict}
            verdictBg={verdictBg}
            confidence={confidence}
            activeReason={activeReason}
          />
        </div>
      </div>
    </GlassView>
  );
}
