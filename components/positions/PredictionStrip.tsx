"use client";

import type { TickerPrediction } from "@/types/predictions";

interface PredictionStripProps {
  prediction: TickerPrediction | null;
  resolvedCount: number;
  correctCount: number;
}

const DIRECTION_ARROW: Record<string, string> = { UP: "▲", DOWN: "▼", FLAT: "→" };
const DIRECTION_COLOR: Record<string, string> = {
  UP: "text-emerald-400",
  DOWN: "text-red-400",
  FLAT: "text-slate-400",
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
  const arrow = prediction ? DIRECTION_ARROW[prediction.direction] : null;
  const dirColor = prediction ? DIRECTION_COLOR[prediction.direction] : "";

  return (
    <div className="px-4 py-2 border-b border-white/[0.05] bg-black/[0.15] flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
        <span className="text-[9px] uppercase tracking-widest text-slate-600">7d forecast</span>
        {prediction ? (
          <>
            <span className={`font-bold ${dirColor}`}>
              {arrow} {prediction.direction}
            </span>
            <span className="text-slate-500">+/-{prediction.magnitudePct.toFixed(1)}%</span>
            <span className="text-slate-500">{Math.round(prediction.confidence * 100)}% conf</span>

            {prediction.status === "resolved" && prediction.outcome ? (
              <span className={`font-semibold ${OUTCOME_COLOR[prediction.outcome]}`}>
                {prediction.outcome}
                {prediction.actualPct !== undefined && (
                  <span className="ml-1 text-slate-500">
                    ({prediction.actualPct >= 0 ? "+" : ""}{prediction.actualPct.toFixed(1)}%)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-600">{daysLeft(prediction.runAt, prediction.horizonDays)}d left</span>
            )}
          </>
        ) : (
          <span className="text-slate-600 italic">no active forecast</span>
        )}
      </div>

      {resolvedCount > 0 && (
        <div className="font-mono text-[10px] text-slate-500 shrink-0">
          <span className={correctCount / resolvedCount >= 0.6 ? "text-emerald-500" : "text-slate-500"}>
            {correctCount}/{resolvedCount}
          </span>
          {" correct"}
        </div>
      )}
    </div>
  );
}
