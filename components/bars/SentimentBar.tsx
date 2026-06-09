"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { SentimentDirection } from "@/lib/utils/sentiment";

interface Props {
  buy: number;
  hold: number;
  sell: number;
  avgConfidence?: number;
  sentimentScore?: number;
  sentimentDirection?: SentimentDirection;
  showHeader?: boolean;
  label?: string;
  compact?: boolean;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

function verdictFrom(buy: number, sell: number, hold: number): SentimentDirection {
  if (buy === 0 && sell === 0 && hold === 0) return "flat";
  if (buy > sell) return "bull";
  if (sell > buy) return "bear";
  return "flat";
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export default function SentimentBar({
  buy,
  hold,
  sell,
  avgConfidence,
  sentimentScore,
  sentimentDirection,
  showHeader = true,
  label = "AI Conviction",
  compact = false,
  onAnalyze,
  isAnalyzing,
}: Props) {
  const total = buy + hold + sell;
  const safe = total || 1;
  const buyPct = (buy / safe) * 100;
  const holdPct = (hold / safe) * 100;
  const sellPct = (sell / safe) * 100;

  const fallbackVerdict = verdictFrom(buy, sell, hold);
  const fallbackPct =
    fallbackVerdict === "bull"
      ? Math.round(buyPct)
      : fallbackVerdict === "bear"
      ? Math.round(sellPct)
      : Math.round(holdPct);

  const verdict = sentimentDirection ?? fallbackVerdict;
  const displayPct =
    typeof sentimentScore === "number"
      ? Math.round(clampPercent(sentimentScore))
      : fallbackPct;

  const verdictColor =
    verdict === "bull"
      ? "text-positive"
      : verdict === "bear"
      ? "text-negative"
      : "text-slate-400";

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const pctRef = useRef<HTMLSpanElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    hoverTimerRef.current = setTimeout(() => setTooltipOpen(true), 250);
  };
  const hideTooltip = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setTooltipOpen(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (tooltipOpen && pctRef.current) {
      const rect = pctRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
      });
    }
  }, [tooltipOpen]);

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"}`}>
      {showHeader && (
        <div className="flex justify-between items-center gap-2">
          <span
            className={`font-mono font-black text-slate-500 uppercase flex items-center whitespace-nowrap shrink-0 ${
              compact
                ? "text-[8px] tracking-[0.16em] gap-1"
                : "text-[9px] tracking-[0.18em] gap-1.5"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze?.();
              }}
              disabled={isAnalyzing}
              aria-label={isAnalyzing ? "Analyzing stories..." : "Analyze stories"}
              tabIndex={0}
              className={`material-symbols-outlined ${compact ? "text-[11px]" : "text-[12px]"} ${
                isAnalyzing
                  ? "animate-pulse"
                  : onAnalyze
                    ? "cursor-pointer hover:scale-110 transition-transform"
                    : ""
              }`}
              style={{
                color: isAnalyzing
                  ? "rgba(0, 255, 136, 0.9)"
                  : verdict === "bull"
                    ? "rgba(34, 197, 94, 0.8)"
                    : verdict === "bear"
                      ? "rgba(239, 68, 68, 0.8)"
                      : undefined,
              }}
            >
              neurology
            </button>
            {compact ? (
              <span>
                {label}
                <span className="text-slate-600 font-medium">
                  &nbsp;· {total} {total === 1 ? "story" : "stories"}
                </span>
              </span>
            ) : (
              <span className="flex flex-col leading-tight">
                <span>{label}</span>
                <span className="text-slate-600 font-medium">
                  {total} {total === 1 ? "story" : "stories"}
                </span>
              </span>
            )}
          </span>
          <span
            ref={pctRef}
            className={`font-mono font-bold tracking-[0.1em] whitespace-nowrap shrink-0 cursor-help ${verdictColor} ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
          >
            {displayPct}%
          </span>
        </div>
      )}

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {tooltipOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 3 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: 268,
                zIndex: 9999,
                pointerEvents: "none",
                transform: "translateY(-100%)",
              }}
            >
              <div
                className="rounded-lg border border-white/10 backdrop-blur-md p-3 text-[10px] leading-snug"
                style={{ background: "rgba(10,12,18,0.94)", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
              >
                <div className="text-slate-500 uppercase tracking-widest text-[8px] font-bold mb-1.5">
                  CWCS — Confidence-Weighted Conviction Score
                </div>
                <div className="text-slate-300 mb-2">
                  {displayPct}% = |Polarity| &times; (1 &minus; NeutralDrag) &times; Reliability
                </div>
                <div className="space-y-1 text-slate-400">
                  <div>&#8226; <span className="text-white/80">Polarity</span> — net Buy vs Sell weight</div>
                  <div>&#8226; <span className="text-white/80">NeutralDrag</span> — penalises high HOLD share</div>
                  <div>&#8226; <span className="text-white/80">Reliability</span> — increases with sample size</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div
        className={`relative rounded-full overflow-hidden bg-white/[0.05] flex ${
          compact ? "h-1.5" : "h-2.5"
        }`}
      >
        <div
          className="h-full bg-positive transition-all duration-700 ease-out"
          style={{
            width: `${buyPct}%`,
            boxShadow: `inset 0 0 ${compact ? 6 : 8}px rgba(0, 255, 136, 0.4)`,
          }}
        />
        <div
          className="h-full bg-slate-500/60 transition-all duration-700 ease-out"
          style={{ width: `${holdPct}%` }}
        />
        <div
          className="h-full bg-negative transition-all duration-700 ease-out"
          style={{
            width: `${sellPct}%`,
            boxShadow: `inset 0 0 ${compact ? 6 : 8}px rgba(255, 68, 68, 0.4)`,
          }}
        />
      </div>

      <div
        className={`flex items-center font-mono ${
          compact ? "gap-3 text-[9px]" : "gap-4 text-[10px]"
        }`}
      >
        <LegendDot color="bg-positive" label="BUY" n={buy} compact={compact} />
        <LegendDot color="bg-slate-500" label="HOLD" n={hold} compact={compact} />
        <LegendDot color="bg-negative" label="SELL" n={sell} compact={compact} />
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
  n,
  compact = false,
}: {
  color: string;
  label: string;
  n: number;
  compact?: boolean;
}) {
  return (
    <span className={`flex items-center text-slate-400 ${compact ? "gap-1" : "gap-1.5"}`}>
      <span className={`rounded-full ${color} ${compact ? "w-1 h-1" : "w-1.5 h-1.5"}`} />
      {label} <span className="text-white font-bold">{n}</span>
    </span>
  );
}