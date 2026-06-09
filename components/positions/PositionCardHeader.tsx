"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PositionChart } from "@/components/positions/PositionChart";
import StockLogo from "@/components/ui/StockLogo";
import SentimentBar from "@/components/bars/SentimentBar";
import type { SentimentDirection } from "@/lib/utils/sentiment";
import { formatCurrency, formatPercent, formatGainLoss } from "@/lib/utils/format";
import { useAccount } from "@/hooks/useAccount";
import { TIMESCALE_WINDOWS, timescaleIndex } from "@/lib/timescales";

// Selectable x-axis windows, in trading-day points (~21 trading days / month).
const WINDOWS = TIMESCALE_WINDOWS;

// Approximate a date for each point by walking back trading days (skip weekends)
// from today. Good enough for month/year axis labels without threading real
// timestamps through the data layer.
function buildTradingDates(count: number): Date[] {
  const dates: Date[] = new Array(Math.max(count, 0));
  if (count <= 0) return dates;
  const d = new Date();
  dates[count - 1] = new Date(d);
  for (let i = count - 2; i >= 0; i--) {
    do {
      d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
    dates[i] = new Date(d);
  }
  return dates;
}

function buildTicks(dates: Date[], key: string): { pos: number; label: string }[] {
  const n = dates.length;
  if (n < 2) return [];
  const pos = (i: number) => i / (n - 1);

  // 1-month view: a mark every 5 trading days (≈ weekly), labelled M/D.
  if (key === "1M") {
    const out: { pos: number; label: string }[] = [];
    for (let i = 0; i < n; i += 5) {
      out.push({ pos: pos(i), label: `${dates[i].getMonth() + 1}/${dates[i].getDate()}` });
    }
    const last = dates[n - 1];
    if (out.length === 0 || out[out.length - 1].pos < 1) {
      out.push({ pos: 1, label: `${last.getMonth() + 1}/${last.getDate()}` });
    }
    return out;
  }

  // Longer views: a mark at each month boundary, thinned to ~7 labels. The
  // partial oldest month (i=0) is skipped so the left edge isn't crowded.
  const monthIdx: number[] = [];
  for (let i = 1; i < n; i++) {
    if (dates[i].getMonth() !== dates[i - 1].getMonth()) monthIdx.push(i);
  }
  const step = Math.max(1, Math.ceil(monthIdx.length / 7));
  const withYear = key === "1Y" || key === "2Y";
  const out: { pos: number; label: string }[] = [];
  for (let k = 0; k < monthIdx.length; k += step) {
    const i = monthIdx[k];
    const mon = dates[i].toLocaleString("en-US", { month: "short" }).toUpperCase();
    out.push({
      pos: pos(i),
      label: withYear ? `${mon} '${String(dates[i].getFullYear()).slice(2)}` : mon,
    });
  }
  return out;
}

interface PriceChartPanelProps {
  history: number[];
  pricePaid: number;
  purchaseDate?: number;
  gainPositive: boolean;
  width: number;
  height: number;
}

function PriceChartPanel({ history, pricePaid, purchaseDate, gainPositive, width, height }: PriceChartPanelProps) {
  // Seed the visible window from the user's saved default timescale. This stays
  // in sync with the preference until the user manually steps this card's range,
  // after which the per-card choice wins (touchedRef latches).
  const { preferences } = useAccount();
  const defaultIdx = timescaleIndex(preferences?.defaultTimescale);
  const [windowIdx, setWindowIdx] = useState(defaultIdx);
  const touchedRef = useRef(false);
  useEffect(() => {
    if (!touchedRef.current) setWindowIdx(defaultIdx);
  }, [defaultIdx]);
  const [showCostBasis, setShowCostBasis] = useState(false);

  // Largest window the available history can actually fill.
  const maxIdx = useMemo(() => {
    let idx = 0;
    // 5% tolerance: a provider's "2y" feed is ~499 trading days, just shy of 504.
    for (let i = 0; i < WINDOWS.length; i++) {
      if (WINDOWS[i].points * 0.95 <= history.length) idx = i;
    }
    return idx;
  }, [history.length]);

  const idx = Math.min(windowIdx, maxIdx);
  const { priceSeries, ticks, buyMarker } = useMemo(() => {
    const sliced = history.slice(-WINDOWS[idx].points);
    const series = sliced.map((price, t) => ({ t, price }));
    const dates = buildTradingDates(sliced.length);

    // Place the buy marker only when the purchase falls inside the visible window.
    let marker: { t: number; price: number } | undefined;
    if (purchaseDate && pricePaid > 0 && dates.length > 1 && purchaseDate >= dates[0].getTime() - 86_400_000) {
      let best = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < dates.length; i++) {
        const diff = Math.abs(dates[i].getTime() - purchaseDate);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      }
      marker = { t: best, price: pricePaid };
    }

    return { priceSeries: series, ticks: buildTicks(dates, WINDOWS[idx].key), buyMarker: marker };
  }, [history, idx, purchaseDate, pricePaid]);

  const canExpand = idx < maxIdx;
  const canShrink = idx > 0;
  const expand = () => { touchedRef.current = true; setWindowIdx(Math.min(maxIdx, idx + 1)); };
  const shrink = () => { touchedRef.current = true; setWindowIdx(Math.max(0, idx - 1)); };

  const btn =
    "w-3.5 h-3.5 flex items-center justify-center rounded-[3px] leading-none text-slate-400 " +
    "hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent " +
    "disabled:cursor-default transition-colors";

  return (
    <div className="flex items-center gap-1.5">
      {/* PositionChart fills its container width (it measures itself), so the
          column width is set on a wrapper rather than via a prop. */}
      <div style={{ width }}>
        <PositionChart
          priceSeries={priceSeries}
          height={height}
          positive={gainPositive}
          costBasis={showCostBasis ? pricePaid : undefined}
          ticks={ticks}
          buyMarker={buyMarker}
        />
      </div>
      <div className="flex flex-col items-center gap-[2px]">
        <button
          type="button"
          className={btn}
          onClick={(e) => { e.stopPropagation(); expand(); }}
          disabled={!canExpand}
          title="Show more history"
          aria-label="Expand time range"
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 5.5 L4 2.5 L7 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="font-mono text-[6px] font-bold tracking-wide text-slate-500 tabular-nums">
          {WINDOWS[idx].key}
        </span>
        <button
          type="button"
          className={btn}
          onClick={(e) => { e.stopPropagation(); shrink(); }}
          disabled={!canShrink}
          title="Show less history"
          aria-label="Shrink time range"
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {pricePaid > 0 && (
          <button
            type="button"
            className={`${btn} mt-[1px] ${showCostBasis ? "text-amber-400 bg-amber-400/10 hover:text-amber-300" : ""}`}
            onClick={(e) => { e.stopPropagation(); setShowCostBasis((v) => !v); }}
            title="Toggle cost-basis line"
            aria-label="Toggle cost-basis line"
            aria-pressed={showCostBasis}
          >
            <svg width="8" height="8" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M0.5 4.5 H8.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.6 1.2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

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
  onRemoveProposed?: () => void;
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
          compact ? "text-[15px]" : "text-[20px]"
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
  hovered: _hovered = false,
  onAnalyzeTicker,
  isTickerAnalyzing,
  onRemoveProposed,
}: PositionCardHeaderProps) {
  const historyData = history ?? [];

  return (
    <div className={`ticker-header-glow ${glowClass}`}>
      {compact ? (
        // ---------- COMPACT HEADER ----------
        <div className="px-[9px] pt-[7px] pb-[5px] bg-black/[0.55]">
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 items-center">
            <StockLogo ticker={ticker} size={32} />
            <div className="min-w-0 flex flex-col gap-[2px]">
              <div className="flex items-baseline gap-1.5">
                <h1 className="font-mono text-[13px] font-black text-white tracking-tighter leading-none">
                  {ticker}
                </h1>
              </div>
              <span className="font-mono text-[9px] text-slate-500 font-medium leading-tight whitespace-nowrap">
                {formatCurrency(currentPrice)}
                <span className="opacity-50 text-[7px]">&nbsp;/ SH</span>
              </span>
            </div>
            <div className="shrink-0">
              <PriceChartPanel history={historyData} pricePaid={pricePaid} purchaseDate={purchaseDate} gainPositive={gainPositive} width={190} height={52} />
            </div>
          </div>
        </div>
      ) : (
        // ---------- ORIGINAL HEADER ----------
        <div className="p-3 pb-2 bg-black/[0.55]">
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-start">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <StockLogo ticker={ticker} size={48} />
            </div>
            <div className="min-w-0 flex flex-col gap-1">
              <h1 className="font-mono text-[16px] font-black text-white tracking-tighter leading-none">
                {ticker}
              </h1>
              <span className="font-mono text-[10px] text-slate-500 font-medium whitespace-nowrap">
                {formatCurrency(currentPrice)}&thinsp;
                <span className="opacity-50 text-[8px]">/ SH</span>
              </span>
            </div>
            <div className="shrink-0">
              <PriceChartPanel history={historyData} pricePaid={pricePaid} purchaseDate={purchaseDate} gainPositive={gainPositive} width={220} height={58} />
            </div>
          </div>
        </div>
      )}

      {/* ---------- STATS ROW ---------- */}
      <div className="flex border-t border-white/[0.06] bg-black/[0.55]">
        <div
          className={`flex-1 ${compact ? "py-[5px] px-2.5" : "py-2 px-4"} flex items-center justify-start`}
        >
          {isProposed && !targetShares ? (
            <Stat
              label="Watching"
              value={currentPrice > 0 ? formatCurrency(currentPrice) : "—"}
              valueClass={currentPrice > 0 ? "text-white" : "text-slate-400"}
              sub="no position"
              align="left"
              compact={compact}
            />
          ) : (
            <Stat
              label="Mkt Val"
              value={formatCurrency(marketValue)}
              sub={targetShares ? `${targetShares} sh target` : `${quantity} sh @ ${formatCurrency(pricePaid)}`}
              align="left"
              compact={compact}
            />
          )}
        </div>
        <div className="w-px bg-white/[0.06]" />
        <div
          className={`flex-[1.6] min-w-0 ${compact ? "py-[5px] px-2.5" : "py-2 px-4"} flex items-center justify-start`}
        >
          {isProposed && targetPrice ? (
            <Stat
              label="Target"
              value={formatCurrency(targetPrice)}
              valueClass="text-amber-400"
              sub={targetShares ? `${targetShares} sh` : "watching"}
              align="left"
              compact={compact}
            />
          ) : isProposed ? (
            <Stat
              label="P/L"
              value={currentPrice > 0 ? formatCurrency(currentPrice) : "—"}
              valueClass={currentPrice > 0 ? (gainPositive ? "text-positive" : "text-negative") : "text-slate-400"}
              sub={targetShares ? `${targetShares} sh` : "watching"}
              align="left"
              compact={compact}
            />
          ) : (
            <Stat
              label="P/L"
              value={formatGainLoss(gainLoss)}
              valueClass={gainPositive ? "text-positive" : "text-negative"}
              sub={`${gainPositive ? "+" : "-"}${Math.abs(gainPct).toFixed(2)}%`}
              align="left"
              compact={compact}
            />
          )}
        </div>
        {isProposed && onRemoveProposed && (
          <>
            <div className="w-px bg-white/[0.06]" />
            <div
              className={`flex-1 ${compact ? "py-[5px] px-2.5" : "py-2 px-4"} flex items-center justify-end`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveProposed();
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:text-amber-300 transition-colors font-mono text-[10px] leading-none"
                aria-label="Remove proposed position"
              >
                x
              </button>
            </div>
          </>
        )}
        {!isProposed && (
          <>
            <div className="w-px bg-white/[0.06]" />
            <div
              className={`flex-1 ${compact ? "py-[5px] px-2.5" : "py-2 px-4"} flex items-center justify-start`}
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
                align="left"
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
