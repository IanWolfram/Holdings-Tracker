import React from "react";
import { YAxisProps } from "./types";

/**
 * YAxis component - Renders the vertical axis and price labels
 */
export function YAxis({ pl, py, height, max, min }: YAxisProps) {
  const formatAxisLabel = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
    if (val >= 1000) return (val / 1000).toFixed(1) + "K";
    return val.toFixed(1);
  };

  return (
    <>
      <line 
        x1={pl} y1={py} x2={pl} y2={height - py} 
        stroke="currentColor" 
        className="text-white/40" 
        strokeWidth={1} 
      />
      <text 
        x={pl - 4} y={py + 2} 
        textAnchor="end" 
        fontSize="6" 
        fontWeight="bold"
        className="fill-white/40 font-mono"
      >
        {formatAxisLabel(max)}
      </text>
      <text 
        x={pl - 4} y={height - py + 2} 
        textAnchor="end" 
        fontSize="6" 
        fontWeight="bold"
        className="fill-white/30 font-mono"
      >
        {formatAxisLabel(min)}
      </text>
    </>
  );
}
