import React from "react";

interface AccountSummaryProps {
  totalValue: number;
  totalPctChange?: number;
  totalGainLoss?: number;
}

export default function AccountSummary({ totalValue, totalPctChange, totalGainLoss }: AccountSummaryProps) {
  return (
    <div className="hidden lg:flex flex-col items-center gap-0.5">
      <span className="font-['Space_Grotesk'] font-black text-white text-lg leading-none tabular-nums">
        {totalValue.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })}
      </span>
      <div className="flex items-center gap-2">
        {totalPctChange !== undefined && (
          <span
            className={`font-mono text-[11px] font-bold tabular-nums ${
              totalPctChange >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {totalPctChange >= 0 ? "+" : ""}
            {totalPctChange.toFixed(2)}%
          </span>
        )}
        {totalGainLoss !== undefined && (
          <span
            className={`font-mono text-[10px] tabular-nums ${
              totalGainLoss >= 0 ? "text-positive/70" : "text-negative/70"
            }`}
          >
            {totalGainLoss >= 0 ? "+" : ""}
            {totalGainLoss.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </span>
        )}
      </div>
    </div>
  );
}
