import React from "react";
import { XAxisProps } from "./types";

/**
 * XAxis component - Renders the horizontal baseline and hash marks
 */
export function XAxis({ pl, pr, py, width, height, points, dataLength }: XAxisProps) {
  const hashInterval = Math.floor(dataLength / 3);
  const hashes = [hashInterval, hashInterval * 2];

  return (
    <>
      <line 
        x1={pl} y1={height - py} x2={width - pr} y2={height - py} 
        stroke="currentColor" 
        className="text-white/20" 
        strokeWidth={1} 
      />
      {hashes.map((idx, i) => {
        const p = points[idx];
        if (!p) return null;
        return (
          <line
            key={i}
            x1={p.x}
            y1={height - py - 1}
            x2={p.x}
            y2={height - py + 1}
            stroke="currentColor"
            className="text-white/30"
            strokeWidth={1}
          />
        );
      })}
    </>
  );
}
