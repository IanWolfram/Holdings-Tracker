"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { TickerPrediction } from "@/types/predictions";

interface PredictionStripProps {
  prediction: TickerPrediction | null;
  allPredictions: TickerPrediction[];
  resolvedCount: number;
  correctCount: number;
  compact?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
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

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysLeft(runAt: number, horizonDays: number): number {
  return Math.max(0, horizonDays - Math.floor((Date.now() - runAt) / 86_400_000));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[8px] uppercase tracking-widest text-slate-700 leading-none mb-0.5">
        {label}
      </span>
      {children}
    </div>
  );
}

function PredictionRow({ p }: { p: TickerPrediction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-white/[0.04] px-4 py-2 last:border-b-0">
      <div className="flex items-center gap-3 flex-wrap">
        <Field label="Direction">
          <span className={`font-mono text-[10px] font-semibold ${DIRECTION_COLOR[p.direction]}`}>
            {DIRECTION_ARROW[p.direction]} {p.direction}
          </span>
        </Field>
        <Field label="Magnitude">
          <span className="font-mono text-[10px] text-slate-300">±{p.magnitudePct.toFixed(1)}%</span>
        </Field>
        <Field label="Conf">
          <span className="font-mono text-[10px] text-slate-300">{Math.round(p.confidence * 100)}%</span>
        </Field>
        <Field label="Horizon">
          <span className="font-mono text-[10px] text-slate-300">{p.horizonDays}d</span>
        </Field>
        <Field label="Status">
          {p.status === "resolved" && p.outcome ? (
            <span className={`font-mono text-[10px] font-semibold ${OUTCOME_COLOR[p.outcome]}`}>
              {p.outcome}
              {p.actualPct !== undefined && (
                <span className="ml-1 text-slate-500 font-normal">
                  ({p.actualPct >= 0 ? "+" : ""}
                  {p.actualPct.toFixed(1)}%)
                </span>
              )}
            </span>
          ) : (
            <span className="font-mono text-[10px] text-slate-400">{daysLeft(p.runAt, p.horizonDays)}d left</span>
          )}
        </Field>
        <Field label="Run">
          <span className="font-mono text-[10px] text-slate-500">{formatDate(p.runAt)}</span>
        </Field>
        <Field label="Price">
          <span className="font-mono text-[10px] text-slate-500">${p.priceAtPrediction.toFixed(2)}</span>
        </Field>
      </div>
      {p.reasoning && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 w-full text-left cursor-pointer group/reasoning"
        >
          <p
            className={`font-mono text-[10px] text-slate-500 group-hover/reasoning:text-slate-300 transition-colors duration-150 leading-relaxed ${
              expanded ? "" : "truncate"
            }`}
          >
            {p.reasoning}
          </p>
        </button>
      )}
    </div>
  );
}

export default function PredictionStrip({
  prediction,
  allPredictions,
  resolvedCount,
  correctCount,
  compact = false,
  open: controlledOpen,
  onToggle,
}: PredictionStripProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const hasPredictions = allPredictions.length > 0;

  const handleToggle = () => {
    if (!hasPredictions) return;
    const next = !isOpen;
    if (onToggle) {
      onToggle(next);
    } else {
      setInternalOpen(next);
    }
  };

  return (
    <div className="border-b border-white/[0.05]">
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full ${
          compact ? "px-2.5 py-1.5" : "px-4 py-2"
        } bg-black/[0.12] flex items-center gap-2 ${
          hasPredictions ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <span className={`font-mono text-slate-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          Predictions
        </span>
        {resolvedCount > 0 ? (
          <span
            className={`font-mono font-semibold ${
              correctCount / resolvedCount >= 0.6 ? "text-emerald-400" : "text-slate-400"
            } ${compact ? "text-[9px]" : "text-[10px]"}`}
          >
            {correctCount}/{resolvedCount} correct
          </span>
        ) : (
          <span className={`font-mono text-slate-700 ${compact ? "text-[9px]" : "text-[10px]"}`}>—</span>
        )}
        <span className="flex-1" />
        {hasPredictions && (
          <span
            className={`font-mono text-slate-700 shrink-0 ${compact ? "text-[8px]" : "text-[9px]"}`}
          >
            {isOpen ? "▲" : "▼"}
          </span>
        )}
      </button>

      {isOpen && hasPredictions && (
        <div className="bg-black/[0.25] max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {allPredictions.map((p, i) => (
            <PredictionRow key={`${p.ticker}-${p.runAt}-${i}`} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}