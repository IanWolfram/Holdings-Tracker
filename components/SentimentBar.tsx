"use client";

/**
 * Tri-state sentiment bar + numeric legend.
 *
 * Replaces the BUY/SELL-only bar in PositionCard. Key improvements:
 *   1. HOLD gets its own segment (slate) — proportion math no longer
 *      silently drops HOLD count.
 *   2. Numeric legend exposes sample size so glance-readers can tell
 *      "1 BUY vs 0 SELL" from "11 BUY vs 9 SELL".
 *   3. Optional avgConfidence surfaces model certainty.
 */

interface Props {
  buy: number;
  hold: number;
  sell: number;
  /** 0–100 — average confidence across stories. Optional. */
  avgConfidence?: number;
  /** Show the header row (label + verdict pill). Default true. */
  showHeader?: boolean;
  /** Custom header label. Default "AI Sentiment". */
  label?: string;
}

type Verdict = "bull" | "bear" | "flat";

function verdictFrom(buy: number, sell: number, hold: number): Verdict {
  if (buy === 0 && sell === 0 && hold === 0) return "flat";
  if (buy > sell) return "bull";
  if (sell > buy) return "bear";
  return "flat";
}

export default function SentimentBar({
  buy,
  hold,
  sell,
  avgConfidence,
  showHeader = true,
  label = "AI Sentiment",
}: Props) {
  const total = buy + hold + sell;
  const safe = total || 1;
  const buyPct = (buy / safe) * 100;
  const holdPct = (hold / safe) * 100;
  const sellPct = (sell / safe) * 100;

  const verdict = verdictFrom(buy, sell, hold);
  const dominantPct =
    verdict === "bull"
      ? Math.round(buyPct)
      : verdict === "bear"
      ? Math.round(sellPct)
      : Math.round(holdPct);

  const verdictLabel =
    verdict === "bull" ? "▲ BULLISH" : verdict === "bear" ? "▼ BEARISH" : "▪ NEUTRAL";
  const verdictColor =
    verdict === "bull"
      ? "text-positive"
      : verdict === "bear"
      ? "text-negative"
      : "text-slate-400";

  return (
    <div className="flex flex-col gap-2">
      {showHeader && (
        <div className="flex justify-between items-baseline">
          <span className="font-mono text-[9px] font-black text-slate-500 tracking-[0.22em] uppercase flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[12px]">psychology</span>
            {label} · {total} {total === 1 ? "story" : "stories"}
          </span>
          <span className={`font-mono text-[11px] font-bold tracking-[0.1em] ${verdictColor}`}>
            {verdictLabel} · {dominantPct}%
          </span>
        </div>
      )}

      <div className="relative h-2.5 rounded-full overflow-hidden bg-white/[0.05] flex">
        <div
          className="h-full bg-positive transition-all duration-700 ease-out"
          style={{
            width: `${buyPct}%`,
            boxShadow: "inset 0 0 8px rgba(0, 255, 136, 0.4)",
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
            boxShadow: "inset 0 0 8px rgba(255, 68, 68, 0.4)",
          }}
        />
      </div>

      <div className="flex gap-4 font-mono text-[10px] items-center">
        <LegendDot color="bg-positive" label="BUY" n={buy} />
        <LegendDot color="bg-slate-500" label="HOLD" n={hold} />
        <LegendDot color="bg-negative" label="SELL" n={sell} />
        {typeof avgConfidence === "number" && (
          <span className="ml-auto text-slate-500">
            conf avg <span className="text-white font-bold">{Math.round(avgConfidence)}%</span>
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label} <span className="text-white font-bold">{n}</span>
    </span>
  );
}
