"use client";

import type { TickerPrediction } from "@/types/predictions";

interface PredictionStripProps {
  prediction: TickerPrediction | null;
  resolvedCount: number;
  correctCount: number;
}

const DIRECTION_ARROW: Record<string, string> = { UP: "▲", DOWN: "▼", FLAT: "→" };
const DIRECTION_BG: Record<string, string> = {
  UP: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DOWN: "bg-red-500/10 text-red-400 border-red-500/20",
  FLAT: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};
const OUTCOME_COLOR: Record<string, string> = {
  CORRECT: "text-emerald-400",
  PARTIAL: "text-amber-400",
  INCORRECT: "text-red-400",
};

function daysLeft(runAt: number, horizonDays: number): number {
  return Math.max(0, horizonDays - Math.floor((Date.now() - runAt) / 86_400_000));
}

export default function PredictionStrip({
  prediction,
  resolvedCount,
  correctCount,
}: PredictionStripProps) {
  return (
    <div className="px-4 py-2 border-b border-white/[0.05] bg-black/[0.12] flex items-center justify-between gap-3">
      {/* Left: label + forecast pill */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-600 shrink-0">
          Forecast
        </span>

        {prediction ? (
          <>
            {/* Direction pill */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[10px] font-semibold shrink-0 ${DIRECTION_BG[prediction.direction]}`}
            >
              {DIRECTION_ARROW[prediction.direction]}{" "}
              {prediction.direction}
            </span>

            {/* Magnitude */}
            <span className="font-mono text-[10px] text-slate-500 shrink-0">
              ±{prediction.magnitudePct.toFixed(1)}%
            </span>

            {/* Divider */}
            <span className="text-slate-700 select-none shrink-0">·</span>

            {/* Confidence */}
            <span className="font-mono text-[10px] text-slate-500 shrink-0">
              {Math.round(prediction.confidence * 100)}%{" "}
              <span className="text-slate-700">conf</span>
            </span>

            {/* Status: resolved outcome or countdown */}
            {prediction.status === "resolved" && prediction.outcome ? (
              <>
                <span className="text-slate-700 select-none shrink-0">·</span>
                <span className={`font-mono text-[10px] font-semibold shrink-0 ${OUTCOME_COLOR[prediction.outcome]}`}>
                  {prediction.outcome}
                  {prediction.actualPct !== undefined && (
                    <span className="ml-1 text-slate-500 font-normal">
                      ({prediction.actualPct >= 0 ? "+" : ""}{prediction.actualPct.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-700 select-none shrink-0">·</span>
                <span className="font-mono text-[10px] text-slate-600 shrink-0">
                  {daysLeft(prediction.runAt, prediction.horizonDays)}d left
                </span>
              </>
            )}
          </>
        ) : (
          <span className="font-mono text-[10px] text-slate-700 italic">—</span>
        )}
      </div>

      {/* Right: accuracy */}
      {resolvedCount > 0 && (
        <div className="font-mono text-[10px] shrink-0 flex items-center gap-1">
          <span className={correctCount / resolvedCount >= 0.6 ? "text-emerald-400 font-semibold" : "text-slate-500"}>
            {correctCount}/{resolvedCount}
          </span>
          <span className="text-slate-700">acc</span>
        </div>
      )}
    </div>
  );
}
