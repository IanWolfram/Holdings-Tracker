import React from "react";
import Sparkline from "@/components/ui/Sparkline";
import CompanyLogo from "@/components/ui/CompanyLogo";
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
}

interface StatProps {
  label: string;
  value: string;
  valueClass?: string;
  sub: string;
  align?: "left" | "center" | "right";
}

function Stat({ label, value, valueClass = "text-white", sub, align = "left" }: StatProps) {
  const alignClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
      ? "items-end text-right"
      : "items-start text-left";

  return (
    <div className={`flex flex-col gap-1 ${alignClass}`}>
      <span className="font-mono text-[8px] font-bold text-slate-500 tracking-[0.15em] uppercase">
        {label}
      </span>
      <span className={`font-mono text-[12px] font-bold leading-none tracking-tight ${valueClass}`}>
        {value}
      </span>
      <span className="font-mono text-[8.5px] font-medium text-slate-400 leading-snug break-words" title={sub}>
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
}: PositionCardHeaderProps) {
  return (
    <div className={`ticker-header-glow ${glowClass}`}>
      <div className="p-3 pb-2">
        <div className="grid grid-cols-[auto_1fr_auto] gap-2.5 items-start">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <CompanyLogo ticker={ticker} size={36} radius={8} />
            <span
              className={`font-mono text-[10px] font-black tracking-tight ${
                gainPositive ? "text-positive" : "text-negative"
              }`}
            >
              {gainPositive ? "▲" : "▼"}&nbsp;{Math.abs(gainPct).toFixed(2)}%
            </span>
          </div>
          <div className="min-w-0 flex flex-col gap-0.5">
            <h1 className="font-mono text-[18px] font-black text-white tracking-tighter leading-none">
              {ticker}
            </h1>
            <p
              className="text-[9px] text-slate-400 font-medium leading-tight truncate max-w-full"
              title={description}
            >
              {description}
            </p>
            <span className="font-mono text-[9px] text-slate-500 font-medium">
              {formatCurrency(currentPrice)}&thinsp;<span className="opacity-50 text-[8px]">/ SH</span>
            </span>
          </div>
          <div className="shrink-0">
            <Sparkline data={history || []} width={90} height={36} purchaseDate={purchaseDate} />
          </div>
        </div>
      </div>

      <div className="flex border-t border-white/[0.06]">
        <div className="flex-1 py-2 px-1.5 flex items-center justify-center">
          <Stat
            label="Mkt Val"
            value={formatCurrency(marketValue)}
            sub={`${quantity} sh`}
            align="center"
          />
        </div>
        <div className="w-px bg-white/[0.06]" />
        <div className="flex-1 py-2 px-1.5 flex items-center justify-center">
          <Stat
            label="P/L"
            value={formatGainLoss(gainLoss)}
            valueClass={gainPositive ? "text-positive" : "text-negative"}
            sub={`@ ${formatCurrency(pricePaid)}`}
            align="center"
          />
        </div>
        <div className="w-px bg-white/[0.06]" />
        <div className="flex-1 py-2 px-1.5 flex items-center justify-center">
          <Stat
            label="Today"
            value={todayDelta ? `${todayDelta.diff >= 0 ? "+" : ""}${formatCurrency(todayDelta.diff)}` : "—"}
            valueClass={
              todayDelta
                ? todayDelta.diff >= 0
                  ? "text-positive"
                  : "text-negative"
                : "text-slate-400"
            }
            sub={todayDelta ? `${formatPercent(todayDelta.pct)}` : "—"}
            align="center"
          />
        </div>
      </div>

      <div className="px-3 py-2 border-t border-white/[0.05] bg-black/[0.35]">
        <SentimentBar
          buy={buy}
          hold={hold}
          sell={sell}
          avgConfidence={avgConfidence}
          sentimentScore={sentimentScore}
          sentimentDirection={sentimentDirection}
        />
      </div>
    </div>
  );
}
