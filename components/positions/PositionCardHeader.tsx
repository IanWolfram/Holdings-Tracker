import React from "react";
import Sparkline from "@/components/ui/Sparkline";
import { TerminalCube } from "@/components/world/StockLogoCube";
import SentimentBar from "@/components/SentimentBar";
import type { SentimentDirection } from "@/lib/utils/sentiment";
import { formatCurrency, formatPercent, formatGainLoss } from "@/lib/utils/format";

interface TodayDelta {
  diff: number;
  pct: number;
}

interface PositionCardHeaderProps {
  ticker: string;
  description: string;
  marketValue: number;
  gainLoss: number;
  quantity: number;
  currentPrice: number;
  pricePaid: number;
  history?: number[];
  purchaseDate?: number;
  gainPositive: boolean;
  gainPct: number;
  todayDelta: TodayDelta | null;
  buy: number;
  hold: number;
  sell: number;
  avgConfidence?: number;
  sentimentScore?: number;
  sentimentDirection?: SentimentDirection;
  glowClass: string;
  compact?: boolean;
  isProposed?: boolean;
  targetPrice?: number;
  targetShares?: number;
  hovered?: boolean;
  onAnalyzeTicker?: () => void;
  isTickerAnalyzing?: boolean;
}

interface StatProps {
  label: string;
  value: string;
  valueClass?: string;
  sub: string;
  align?: "left" | "center" | "right";
  compact?: boolean;
}

function Stat({ label, value, valueClass = "text-white", sub, align = "left", compact = false }: StatProps) {
  const alignClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
      ? "items-end text-right"
      : "items-start text-left";

  return (
    <div className={`flex flex-col ${compact ? "gap-0.5" : "gap-1"} ${alignClass}`}>
      <span
        className={`font-mono font-bold text-slate-500 uppercase ${
          compact ? "text-[7px] tracking-[0.14em]" : "text-[8px] tracking-[0.15em]"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono font-bold leading-none tracking-tight ${
          compact ? "text-[11px]" : "text-[12px]"
        } ${valueClass}`}
      >
        {value}
      </span>
      <span
        className={`font-mono font-medium text-slate-400 leading-snug break-words ${
          compact ? "text-[7.5px]" : "text-[8.5px]"
        }`}
        title={sub}
      >
        {sub}
      </span>
    </div>
  );
}

export default function PositionCardHeader({
  ticker,
  description,
  marketValue,
  gainLoss,
  quantity,
  currentPrice,
  pricePaid,
  history,
  purchaseDate,
  gainPositive,
  gainPct,
  todayDelta,
  buy,
  hold,
  sell,
  avgConfidence,
  sentimentScore,
  sentimentDirection,
  glowClass,
  compact = false,
  isProposed,
  targetPrice,
  targetShares,
  hovered = false,
  onAnalyzeTicker,
  isTickerAnalyzing,
}: PositionCardHeaderProps) {
  return (
    <div className={`ticker-header-glow ${glowClass}`}>
      {compact ? (
        // ---------- COMPACT HEADER ----------
        <div className="px-[9px] pt-[7px] pb-[5px]">
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 items-center">
            <TerminalCube ticker={ticker} size={32} spinning={hovered} />
            <div className="min-w-0 flex flex-col gap-[1px]">
              <div className="flex items-baseline gap-1.5">
                <h1 className="font-mono text-[14px] font-black text-white tracking-tighter leading-none">
                  {ticker}
                </h1>
                {isProposed && (
                  <span className="ml-0.5 inline-flex items-center rounded px-1 py-0.5 text-[6px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Proposed
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 min-w-0 text-[8px] leading-tight">
                <span
                  className="text-slate-400 font-medium truncate"
                  title={description}
                >
                  {description}
                </span>
                <span className="font-mono text-slate-500 font-medium shrink-0">
                  · {formatCurrency(currentPrice)}
                  <span className="opacity-50 text-[7px]">&nbsp;/ SH</span>
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <Sparkline data={history || []} width={76} height={24} purchaseDate={purchaseDate} />
            </div>
          </div>
        </div>
      ) : (
        // ---------- ORIGINAL HEADER ----------
        <div className="p-3 pb-2">
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-start">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <TerminalCube ticker={ticker} size={48} spinning={hovered} />
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <h1 className="font-mono text-[18px] font-black text-white tracking-tighter leading-none">
                {ticker}
              </h1>
              {isProposed && (
                <span className="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[7px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Proposed
                </span>
              )}
              <p
                className="text-[9px] text-slate-400 font-medium leading-tight truncate max-w-full"
                title={description}
              >
                {description}
              </p>
              <span className="font-mono text-[9px] text-slate-500 font-medium">
                {formatCurrency(currentPrice)}&thinsp;
                <span className="opacity-50 text-[8px]">/ SH</span>
              </span>
            </div>
            <div className="shrink-0">
              <Sparkline data={history || []} width={90} height={36} purchaseDate={purchaseDate} />
            </div>
          </div>
        </div>
      )}

      {/* ---------- STATS ROW ---------- */}
      <div className="flex border-t border-white/[0.06]">
        <div
          className={`flex-1 ${compact ? "py-[5px] px-1" : "py-2 px-1.5"} flex items-center justify-center`}
        >
          {isProposed && !targetShares ? (
            <Stat
              label="Watching"
              value={currentPrice > 0 ? formatCurrency(currentPrice) : "—"}
              valueClass={currentPrice > 0 ? "text-white" : "text-slate-400"}
              sub="no position"
              align="center"
              compact={compact}
            />
          ) : (
            <Stat
              label="Mkt Val"
              value={formatCurrency(marketValue)}
              sub={targetShares ? `${targetShares} sh target` : `${quantity} sh`}
              align="center"
              compact={compact}
            />
          )}
        </div>
        <div className="w-px bg-white/[0.06]" />
        <div
          className={`flex-1 ${compact ? "py-[5px] px-1" : "py-2 px-1.5"} flex items-center justify-center`}
        >
          {isProposed && targetPrice ? (
            <Stat
              label="Target"
              value={formatCurrency(targetPrice)}
              valueClass="text-amber-400"
              sub={targetShares ? `${targetShares} sh` : "watching"}
              align="center"
              compact={compact}
            />
          ) : isProposed ? (
            <Stat
              label="P/L"
              value={currentPrice > 0 ? formatCurrency(currentPrice) : "—"}
              valueClass={currentPrice > 0 ? (gainPositive ? "text-positive" : "text-negative") : "text-slate-400"}
              sub={targetShares ? `${targetShares} sh` : "watching"}
              align="center"
              compact={compact}
            />
          ) : (
            <Stat
              label="P/L"
              value={formatGainLoss(gainLoss)}
              valueClass={gainPositive ? "text-positive" : "text-negative"}
              sub={`${gainPositive ? "▲" : "▼"} ${Math.abs(gainPct).toFixed(2)}%  ·  @ ${formatCurrency(pricePaid)}`}
              align="center"
              compact={compact}
            />
          )}
        </div>
        {!isProposed && (
          <>
            <div className="w-px bg-white/[0.06]" />
            <div
              className={`flex-1 ${compact ? "py-[5px] px-1" : "py-2 px-1.5"} flex items-center justify-center`}
            >
              <Stat
                label="Today"
                value={
                  todayDelta
                    ? `${todayDelta.diff >= 0 ? "+" : ""}${formatCurrency(todayDelta.diff)}`
                    : "—"
                }
                valueClass={
                  todayDelta
                    ? todayDelta.diff >= 0
                      ? "text-positive"
                      : "text-negative"
                    : "text-slate-400"
                }
                sub={todayDelta ? `${formatPercent(todayDelta.pct)}` : "—"}
                align="center"
                compact={compact}
              />
            </div>
          </>
        )}
      </div>

      {/* ---------- SENTIMENT BAR ---------- */}
      <div
        className={`${
          compact ? "px-[9px] py-[5px]" : "px-3 py-2"
        } border-t border-white/[0.05] bg-black/[0.35]`}
      >
        <SentimentBar
          buy={buy}
          hold={hold}
          sell={sell}
          avgConfidence={avgConfidence}
          sentimentScore={sentimentScore}
          sentimentDirection={sentimentDirection}
          compact={compact}
          onAnalyze={onAnalyzeTicker}
          isAnalyzing={isTickerAnalyzing}
        />
      </div>
    </div>
  );
}
