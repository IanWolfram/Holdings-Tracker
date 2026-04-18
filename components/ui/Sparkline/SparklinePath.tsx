import React from "react";
import type { SparklinePathProps } from "./types";

/**
 * SparklinePath component - Renders the actual data line and highlight
 */
export function SparklinePath({ points, isPositive }: SparklinePathProps) {
  if (points.length < 2) return null;

  const pathData = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const color = isPositive ? "#00FF88" : "#FF4444";

  return (
    <>
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
        className="transition-all duration-300"
      />
      <circle 
        cx={points[points.length - 1].x} 
        cy={points[points.length - 1].y} 
        r={2} 
        fill={color} 
        filter="url(#glow)"
      />
    </>
  );
}
