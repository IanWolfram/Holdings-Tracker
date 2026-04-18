import React from "react";
import type { XAxisProps } from "./types";

const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

/**
 * XAxis component - Renders the horizontal baseline and month tick labels
 */
export function XAxis({ pl, pr, py, width, height }: XAxisProps) {
  const labelY = height - py + 8;
  const chartWidth = width - pl - pr;

  // Build 4 month labels ending at the current month, oldest → newest
  const now = new Date();
  const months = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
    return MONTH_ABBR[d.getMonth()];
  });

  // X positions: evenly spaced across the chart area
  const ticks = months.map((label, i) => ({
    label,
    x: pl + (i / (months.length - 1)) * chartWidth,
    isLast: i === months.length - 1,
  }));

  return (
    <>
      {/* Baseline */}
      <line
        x1={pl} y1={height - py} x2={width - pr} y2={height - py}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />

      {ticks.map(({ label, x, isLast }) => (
        <React.Fragment key={label}>
          <line
            x1={x} y1={height - py - 2}
            x2={x} y2={height - py + 2}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
          />
          <text
            x={x} y={labelY}
            textAnchor="middle"
            fontSize="5"
            fontWeight="bold"
            fontFamily="monospace"
            fill={isLast ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)"}
          >
            {label}
          </text>
        </React.Fragment>
      ))}
    </>
  );
}
