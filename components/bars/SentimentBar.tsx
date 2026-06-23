"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { SentimentDirection } from "@/lib/utils/sentiment";

interface Props {
  buy: number;
  hold: number;
  sell: number;
  sentimentScore?: number;
  sentimentDirection?: SentimentDirection;
  compact?: boolean;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  /** Analyzed-news age window, in days — shown as "over N days" under the count. */
  windowDays?: number;
}

const MAX_FILL = 82;

const C = {
  buyBar:   "#2ee37e",
  buyVal:   "#2ee37e",
  holdBar:  "rgba(139,151,168,0.75)",
  holdVal:  "#8b97a8",
  sellBar:  "#ff5247",
  sellVal:  "#ff5247",
  axis:     "rgba(255,255,255,0.16)",
  border:   "rgba(255,255,255,0.06)",
  muted:    "#64748b",
  mutedDim: "#475569",
  txt:      "#e2e2e6",
  posScore: "#22c55e",
  bearScore:"#ff5247",
};

const SEGS = [
  { key: "buy",  bar: C.buyBar,  val: C.buyVal  },
  { key: "hold", bar: C.holdBar, val: C.holdVal },
  { key: "sell", bar: C.sellBar, val: C.sellVal },
] as const;

function verdictFrom(buy: number, sell: number, hold: number): SentimentDirection {
  if (buy === 0 && sell === 0 && hold === 0) return "flat";
  if (buy > sell) return "bull";
  if (sell > buy) return "bear";
  return "flat";
}

export default function SentimentBar({
  buy,
  hold,
  sell,
  sentimentScore,
  sentimentDirection,
  compact = false,
  onAnalyze,
  isAnalyzing,
  windowDays,
}: Props) {
  const total = buy + hold + sell;
  const max   = Math.max(buy, hold, sell) || 1;

  const fallbackVerdict = verdictFrom(buy, sell, hold);
  const safe = total || 1;
  const fallbackPct =
    fallbackVerdict === "bull" ? Math.round((buy  / safe) * 100) :
    fallbackVerdict === "bear" ? Math.round((sell / safe) * 100) :
                                 Math.round((hold / safe) * 100);

  const verdict      = sentimentDirection ?? fallbackVerdict;
  const displayScore = typeof sentimentScore === "number"
    ? Math.round(Math.max(0, Math.min(100, sentimentScore)))
    : fallbackPct;

  const scoreColor =
    verdict === "bull" ? C.posScore :
    verdict === "bear" ? C.bearScore :
    C.muted;

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPos,  setTooltipPos]  = useState({ top: 0, left: 0 });
  const pctRef       = useRef<HTMLSpanElement>(null);
  const hoverTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openTooltip  = () => { hoverTimer.current = setTimeout(() => setTooltipOpen(true), 250); };
  const closeTooltip = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setTooltipOpen(false); };

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  useEffect(() => {
    if (tooltipOpen && pctRef.current) {
      const r = pctRef.current.getBoundingClientRect();
      setTooltipPos({ top: r.top - 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 280)) });
    }
  }, [tooltipOpen]);

  const counts = { buy, hold, sell };

  return (
    <div className="flex items-center" style={{ gap: 15 }}>

      {/* ── SCORE BLOCK ── */}
      <div
        className="flex flex-col items-center justify-center"
        style={{ gap: 3, paddingRight: 15, borderRight: `1px solid ${C.border}`, flexShrink: 0, minWidth: compact ? 62 : 76 }}
      >
        <div className="flex items-center justify-center" style={{ gap: 6 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAnalyze?.(); }}
            disabled={!onAnalyze || isAnalyzing}
            aria-label={isAnalyzing ? "Analyzing…" : "Analyze stories"}
            className={`material-symbols-outlined leading-none select-none ${
              isAnalyzing      ? "animate-pulse" :
              onAnalyze        ? "cursor-pointer hover:scale-110 transition-transform" :
                                 "cursor-default"
            }`}
            style={{ fontSize: compact ? 15 : 19, color: isAnalyzing ? "#00ff88" : scoreColor, display: "block" }}
          >
            neurology
          </button>
          <span
            ref={pctRef}
            className="font-mono font-black leading-none tabular-nums cursor-help"
            style={{ fontSize: compact ? 15 : 20, color: scoreColor, letterSpacing: "0.01em" }}
            onMouseEnter={openTooltip}
            onMouseLeave={closeTooltip}
          >
            {displayScore}%
          </span>
        </div>
        <span
          className="font-mono font-black uppercase whitespace-nowrap tracking-[0.15em]"
          style={{ fontSize: "8.5px", color: C.muted }}
        >
          AI Conviction
        </span>
        {typeof windowDays === "number" && (
          <span
            className="font-mono uppercase tracking-[0.18em] whitespace-nowrap leading-none"
            style={{ fontSize: "7.5px", color: C.mutedDim, marginTop: 2 }}
          >
            over <span className="font-black">{windowDays}</span> days
          </span>
        )}
      </div>

      {/* ── TOTAL BLOCK ── */}
      <div className="flex flex-col justify-center items-center text-center" style={{ flexShrink: 0, minWidth: compact ? 36 : 44 }}>
        <span
          className="font-mono font-black leading-none tabular-nums"
          style={{ fontSize: compact ? 20 : 27, color: C.txt, letterSpacing: "-0.01em" }}
        >
          {total}
        </span>
        <span
          className="font-mono font-bold uppercase tracking-[0.18em]"
          style={{ fontSize: "8.5px", color: C.muted, marginTop: 2 }}
        >
          {total === 1 ? "story" : "stories"}
        </span>
      </div>

      {/* ── BAR CHART ── */}
      <div className="flex-1 min-w-0 flex items-stretch" style={{ gap: 12 }}>
        {/* vertical axis line */}
        <div style={{ width: 2, flexShrink: 0, background: C.axis, borderRadius: 1 }} />

        {/* three bar rows — zero-count rows are omitted; rows stretch evenly.
            With no stories at all, show a muted placeholder instead of an
            empty track next to a floating axis line. */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{
            minHeight: compact ? 25 : 31,
            justifyContent: total > 0 ? "space-evenly" : "center",
          }}
        >
          {total === 0 ? (
            <span
              className="font-mono font-bold uppercase tracking-[0.15em] whitespace-nowrap"
              style={{ fontSize: "8.5px", color: C.mutedDim }}
            >
              No signal yet
            </span>
          ) : (
            SEGS.filter(({ key }) => counts[key] > 0).map(({ key, bar, val: valColor }) => {
              const n = counts[key];
              const w = (n / max) * MAX_FILL;
              return (
                <div key={key} className="flex items-center min-w-0" style={{ gap: 9 }}>
                  <div
                    style={{
                      height: 7,
                      borderRadius: "0 999px 999px 0",
                      background: bar,
                      width: `${w}%`,
                      minWidth: 3,
                      transition: "width 0.35s ease",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="font-mono font-bold leading-none tabular-nums"
                    style={{ fontSize: 11, color: valColor, flexShrink: 0 }}
                  >
                    {n}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── CWCS TOOLTIP ── */}
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
                  {displayScore}% = |Polarity| &times; (1 &minus; NeutralDrag) &times; Reliability
                </div>
                <div className="space-y-1 text-slate-400">
                  <div>&#8226; <span className="text-white/80">Polarity</span> — net Positive vs Negative weight</div>
                  <div>&#8226; <span className="text-white/80">NeutralDrag</span> — penalises high Neutral share</div>
                  <div>&#8226; <span className="text-white/80">Reliability</span> — increases with sample size</div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 text-slate-500 text-[8.5px] leading-snug">
                  News-sentiment signal, informational only — not investment advice or a recommendation to trade.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
