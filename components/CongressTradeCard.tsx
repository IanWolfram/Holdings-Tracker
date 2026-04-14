"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import GlassView from "./ui/LiquidGlass/GlassView";
import type { CongressTrade } from "@/types/news.types";

const R = 8;
const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const GROW_DURATION = 0.5;

const CONGRESS_COLOR = "#b45309";   // amber-700
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

interface Props {
  trade: CongressTrade;
  isNew?: boolean;
}

export default function CongressTradeCard({ trade, isNew = false }: Props) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [hovered, setHovered] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(trade.tradeDate * 1000), { addSuffix: true });
  const tradeLabel = TRADE_LABEL[trade.tradeType] ?? "TRADE";
  const tradeColor = TRADE_COLOR[trade.tradeType] ?? "#64748b";
  const partyColor = PARTY_COLOR[trade.party] ?? "#6b7280";

  return (
    <GlassView
      layout
      layoutId={id}
      interactive
      cornerRadius={R}
      className="relative cursor-pointer group/item rounded-[8px]"
      style={{ color: CONGRESS_COLOR }}
      onClick={() => window.open(trade.url, "_blank")}
    >
      <div
        className="p-2 relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Corner brackets — brown tinted */}
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


        {/* Content */}
        <motion.div
          className="relative"
          style={{ zIndex: 2 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Top row: politician + new badge */}
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Party chip */}
              <span
                className="text-[9px] font-black px-1 py-0.5 rounded-sm leading-none shrink-0"
                style={{ backgroundColor: partyColor + "33", color: partyColor, border: `1px solid ${partyColor}44` }}
              >
                {trade.party}
              </span>
              <span className="text-[12px] font-semibold text-white leading-snug truncate">
                {trade.politician}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isNew && (
                <span className="text-[8px] font-black px-1 py-0.5 rounded-sm bg-red-500/20 text-red-400 border border-red-500/30 leading-none">
                  NEW
                </span>
              )}
              {/* Gavel icon */}
              <span className="material-symbols-outlined text-[16px]" style={{ color: CONGRESS_COLOR }}>
                gavel
              </span>
            </div>
          </div>

          {/* Ticker + trade type + amount */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-black text-white">{trade.ticker}</span>
            <span
              className="text-[9px] font-black px-1 py-0.5 rounded-sm leading-none"
              style={{ color: tradeColor, backgroundColor: tradeColor + "22", border: `1px solid ${tradeColor}44` }}
            >
              {tradeLabel}
            </span>
            <span className="text-[10px] text-slate-400 truncate">{trade.assetType}</span>
          </div>

          {/* Amount + time */}
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]" style={{ color: CONGRESS_COLOR }}>
                account_balance
              </span>
              <span>{trade.amount}</span>
              <span className="opacity-40">·</span>
              <span className="capitalize">{trade.chamber}</span>
            </div>
            <span>{timeAgo}</span>
          </div>
        </motion.div>
      </div>
    </GlassView>
  );
}
