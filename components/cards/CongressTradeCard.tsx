"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import GlassView from "@/components/ui/LiquidGlass/GlassView";
import {
  CARD_RADIUS,
  HOVER_EXPAND_DELAY,
  REVEAL_EASE,
} from "@/lib/utils/newsCardAnimations";
import type { CongressTrade } from "@/types/news.types";

const CONGRESS_COLOR = "#b45309"; // amber-700 — section identity
const CARD_BG = "rgba(38, 26, 14, 0.55)"; // dark muted brown card fill
const EDGE_BROWN = "#8a5a2b"; // brown corner brackets + edge fills

const PARTY_COLOR: Record<string, string> = {
  D: "#3b82f6", // blue
  R: "#ef4444", // red
  I: "#6b7280", // gray
};

const TRADE_LABEL: Record<string, string> = {
  buy: "BUY",
  sell: "SELL",
  buy_option: "CALL",
  sell_option: "PUT",
};

const TRADE_COLOR: Record<string, string> = {
  buy: "#00FF88",
  sell: "#FF4444",
  buy_option: "#60a5fa",
  sell_option: "#f97316",
};

/** Whole days between the trade and its filing; null when a date is missing. */
function disclosureDelayDays(trade: CongressTrade): number | null {
  if (!trade.tradeDate || !trade.filedDate) return null;
  const days = Math.round((trade.filedDate - trade.tradeDate) / 86_400);
  return Number.isFinite(days) ? Math.max(0, days) : null;
}

/** Format a unix-seconds timestamp as a short date, or an em dash when missing. */
function shortDate(ts: number | undefined): string {
  if (!ts) return "—";
  return format(new Date(ts * 1000), "MMM d, yyyy");
}

/** Animated arrow that rotates on hover — mirrors the news card affordance. */
function NavArrowIcon({ hovered, color }: { hovered: boolean; color: string }) {
  return (
    <motion.div
      className="flex items-center justify-center relative w-4 h-4 shrink-0"
      animate={{ rotate: hovered ? -45 : 0, scale: hovered ? 1.1 : 1 }}
      transition={{ duration: 0.4, ease: REVEAL_EASE }}
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full overflow-visible">
        <path
          d="M 4 12 H 20 M 14 6 L 20 12 L 14 18"
          fill="none"
          stroke={hovered ? color : "#64748b"}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: hovered ? 1 : 0.4,
            filter: hovered ? `drop-shadow(0 0 2px ${color})` : "none",
          }}
        />
      </svg>
    </motion.div>
  );
}

/** Single labelled metric used inside the disclosure panel. */
function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-[10px] font-mono truncate" style={{ color: color ?? "#cbd5e1" }}>
        {value}
      </span>
    </div>
  );
}

/** Reveal-on-hover disclosure detail — analogous to the news card's AI panel. */
function CongressDetailPanel({
  expanded,
  trade,
  tradeColor,
  compact,
}: {
  expanded: boolean;
  trade: CongressTrade;
  tradeColor: string;
  compact: boolean;
}) {
  const compliant = trade.isCompliant;
  const delayDays = disclosureDelayDays(trade);
  // Tie the figure's colour to STOCK Act compliance: green within the window,
  // amber when late, slate when the dates are unknown.
  const delayColor =
    compliant === undefined ? "#64748b" : compliant ? "#00FF88" : CONGRESS_COLOR;
  const delayText =
    delayDays === null
      ? "—"
      : delayDays === 0
        ? "same day"
        : `${delayDays} day${delayDays === 1 ? "" : "s"} after trade`;

  return (
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          key="disclosure"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: REVEAL_EASE }}
          className="overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={compact ? "mt-[6px]" : "mt-2"}>
            <div
              className={compact ? "rounded-[3px] p-1.5" : "rounded-[4px] p-2"}
              style={{
                background: "rgba(24, 16, 8, 0.85)", // deep brown — matches card theme
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Header: label + STOCK Act compliance flag */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Disclosed
                </span>
                {compliant !== undefined && (
                  <span
                    className="text-[8px] font-black px-1 py-0.5 rounded-[2px] tracking-tight leading-none"
                    style={{
                      color: compliant ? "#00FF88" : CONGRESS_COLOR,
                      background: compliant ? "rgba(0,255,136,0.10)" : "rgba(180,83,9,0.14)",
                      border: `1px solid ${compliant ? "rgba(0,255,136,0.3)" : "rgba(180,83,9,0.4)"}`,
                    }}
                  >
                    {compliant ? "ON TIME" : "LATE FILE"}
                  </span>
                )}
              </div>

              {/* Disclosure delay — how long after the trade it was filed */}
              <div className="flex items-center mb-2.5">
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded truncate"
                  style={{ color: delayColor, background: `${delayColor}14` }}
                >
                  {delayText}
                </span>
              </div>

              {/* Disclosure facts */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <DetailItem label="Traded" value={shortDate(trade.tradeDate)} />
                <DetailItem label="Filed" value={shortDate(trade.filedDate)} />
                <DetailItem label="Asset" value={trade.assetType || "—"} />
                <DetailItem label="Chamber" value={trade.chamber === "senate" ? "Senate" : "House"} />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface Props {
  trade: CongressTrade;
  isNew?: boolean;
  /** Kept so the collapsed stack can pin the top card open (matches NewsCard). */
  pinned?: boolean;
  compact?: boolean;
  /** Show the traded company's full name. Used on the HOT page's mixed-ticker
   *  list; off on the terminal where the card already sits under its ticker. */
  showCompany?: boolean;
}

export default function CongressTradeCard({
  trade,
  isNew = false,
  pinned = false,
  compact = process.env.NEXT_PUBLIC_UI_MODE === "compact",
  showCompany = false,
}: Props) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerHoveredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pinned && !innerHoveredRef.current) setExpanded(false);
  }, [pinned]);

  const handleMouseEnter = () => {
    innerHoveredRef.current = true;
    setHovered(true);
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    expandTimerRef.current = setTimeout(() => {
      setExpanded(true);
      expandTimerRef.current = null;
    }, HOVER_EXPAND_DELAY * 1_000);
  };

  const handleMouseLeave = () => {
    innerHoveredRef.current = false;
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    setHovered(false);
    if (!pinned) setExpanded(false);
  };

  // Show time since disclosure (filed) — the feed's "news" event — and the date
  // the list is ordered by. Falls back to the trade date if a filing date is
  // missing. (traded_date can carry future option dates → misleading "in N months".)
  const headlineDate = (trade.filedDate || trade.tradeDate) * 1000;
  const timeAgo = formatDistanceToNow(new Date(headlineDate), { addSuffix: true });
  const tradeLabel = TRADE_LABEL[trade.tradeType] ?? "TRADE";
  const tradeColor = TRADE_COLOR[trade.tradeType] ?? "#64748b";
  const partyColor = PARTY_COLOR[trade.party] ?? "#6b7280";

  return (
    <GlassView
      layout
      layoutId={id}
      interactive
      cornerRadius={CARD_RADIUS}
      className="relative cursor-pointer group/item rounded-[8px]"
      style={{ color: EDGE_BROWN, border: "none" }}
      onClick={() => window.open(trade.url, "_blank")}
    >
      <div
        className={`${compact ? "px-[7px] py-[6px]" : "px-2.5 py-2.5"} relative rounded-[8px]`}
        style={{ backgroundColor: CARD_BG }}
        data-hovered={hovered ? "true" : undefined}
        data-expanded={expanded ? "true" : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Corner brackets */}
        <span className="news-cap news-cap-top-left" />
        <span className="news-cap news-cap-top-right" />
        <span className="news-cap news-cap-bottom-left" />
        <span className="news-cap news-cap-bottom-right" />

        {/* Animated edge fills — grow on hover over the same cadence as news cards */}
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

        <div className="relative" style={{ zIndex: 2 }}>
          {/* Primary line: gavel + party + politician (the "headline") */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="material-symbols-outlined text-[15px] shrink-0"
              style={{ color: CONGRESS_COLOR }}
            >
              gavel
            </span>
            <span
              className="text-[9px] font-black px-1 py-0.5 rounded-sm leading-none shrink-0 tracking-wide"
              style={{
                backgroundColor: partyColor + "33",
                color: partyColor,
                border: `1px solid ${partyColor}44`,
              }}
            >
              {trade.party}
            </span>
            <span className={`${compact ? "text-[12px]" : "text-[13px]"} font-semibold text-white leading-snug truncate tracking-[-0.01em]`}>
              {trade.politician}
            </span>
            {isNew && (
              <span className="text-[7.5px] font-black px-1 py-0.5 rounded-sm bg-red-500/20 text-red-400 border border-red-500/30 leading-none shrink-0">
                NEW
              </span>
            )}
          </div>

          {/* Company line — only where the list spans multiple tickers (HOT page) */}
          {showCompany && (trade.companyName || trade.ticker) && (
            <div className={`${compact ? "mt-1" : "mt-1.5"} flex items-center gap-1.5 min-w-0`}>
              <span className="font-mono text-[9px] font-bold text-slate-400 shrink-0 tracking-wide">
                {trade.ticker}
              </span>
              {/* Skip when the name fell back to the ticker (unparseable / prose
                  leak) so we don't render "HOLX HOLX". */}
              {trade.companyName && trade.companyName !== trade.ticker && (
                <span className="text-[10px] text-slate-400/90 truncate leading-snug">
                  {trade.companyName}
                </span>
              )}
            </div>
          )}

          {/* Meta line: action pill + ticker + amount … time + arrow */}
          <div className={`${compact ? "mt-1.5" : "mt-2.5"} flex items-center gap-2 text-[11px] text-slate-400`}>
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-sm leading-none shrink-0 tracking-wide"
              style={{
                color: tradeColor,
                backgroundColor: tradeColor + "22",
                border: `1px solid ${tradeColor}44`,
              }}
            >
              {tradeLabel}
            </span>
            <span className="truncate font-mono text-[10.5px] text-slate-300/90">{trade.amount}</span>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <span className="tabular-nums text-[10px] text-slate-500">{timeAgo}</span>
              <NavArrowIcon hovered={hovered} color={tradeColor} />
            </div>
          </div>

          <CongressDetailPanel
            expanded={expanded}
            trade={trade}
            tradeColor={tradeColor}
            compact={compact}
          />
        </div>
      </div>
    </GlassView>
  );
}
