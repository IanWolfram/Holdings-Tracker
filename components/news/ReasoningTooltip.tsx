"use client";

import { motion } from "framer-motion";
import type { ClassifiedStory } from "@/types/news.types";

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

interface Props {
  story: Pick<ClassifiedStory, "verdict" | "confidence" | "reason">;
  /** Bounding rect of the card — used to position the tooltip via fixed coords */
  anchorRect: DOMRect;
}

const TOOLTIP_WIDTH = 260;

export default function ReasoningTooltip({ story, anchorRect }: Props) {
  const color = VERDICT_COLOR[story.verdict] ?? "#64748b";
  const bg = VERDICT_BG[story.verdict] ?? "rgba(100,116,139,0.08)";
  const pct = Math.round(story.confidence * 100);

  // Position above the card, clamped so it doesn't go off-screen left/right
  const left = Math.min(
    Math.max(anchorRect.left, 8),
    window.innerWidth - TOOLTIP_WIDTH - 8
  );
  const top = anchorRect.top - 8; // will animate upward from here

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        top,
        left,
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
        pointerEvents: "none",
        transform: "translateY(-100%)",
      }}
    >
      <div
        className="rounded-lg border border-white/10 backdrop-blur-md p-2.5 text-[11px]"
        style={{ background: "rgba(10,12,18,0.92)", boxShadow: `0 0 0 1px ${color}22, 0 8px 24px rgba(0,0,0,0.6)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">
            AI Analysis
          </span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: bg, color }}
          >
            {story.verdict}
          </span>
        </div>

        {/* Confidence bar */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-500 text-[9px]">Confidence</span>
            <span className="font-mono text-[10px]" style={{ color }}>
              {pct}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
            />
          </div>
        </div>

        {/* Reasoning */}
        {story.reason ? (
          <p className="text-slate-400 leading-snug">
            {story.reason}
          </p>
        ) : (
          <p className="text-slate-600 italic">
            No reasoning provided
          </p>
        )}
      </div>
    </motion.div>
  );
}
